"use server"

import { prisma } from "@/lib/db/prisma"

/**
 * Mengambil statistik keuangan global koperasi untuk dashboard utama.
 * Seluruh kalkulasi diambil dari database riil tanpa hardcoded value.
 *
 * @param {"weekly" | "monthly" | "yearly"} period Rentang waktu laporan
 * @returns {Promise<object>} Ringkasan finansial koperasi
 * @throws {Error} Mengembalikan objek nol jika terjadi error database
 */
export async function getGlobalFinancialStats(period: "weekly" | "monthly" | "yearly") {
  try {
    const now = new Date()
    let startDate: Date

    if (period === "weekly") {
      startDate = new Date(now)
      startDate.setDate(now.getDate() - 7)
    } else if (period === "monthly") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    } else {
      startDate = new Date(now.getFullYear(), 0, 1)
    }

    // 1. Total Transaksi (Count of all orders excluding cancelled)
    const orderCount = await prisma.orders.count({
      where: {
        ordered_at: { gte: startDate },
        order_status: { notIn: ["cancelled"] }
      }
    })

    // 2. Keuntungan Toko — Dihitung dari HPP riil per order_items (no hardcoded margin)
    const soldItems = await prisma.order_items.findMany({
      where: {
        orders: {
          ordered_at: { gte: startDate },
          payment_status: "paid",
        }
      },
      select: {
        qty: true,
        subtotal: true,
        products: {
          select: { purchase_price: true }
        }
      }
    })

    let totalSales = 0
    let totalCogs  = 0
    for (const item of soldItems) {
      const revenue = Number(item.subtotal ?? 0)
      const cogs    = Number(item.products?.purchase_price ?? 0) * item.qty
      totalSales   += revenue
      totalCogs    += cogs
    }
    const keuntunganToko = totalSales - totalCogs

    // 3. Laba Simpan Pinjam (Total Bunga + Denda yang Terbayar)
    const spInterest = await prisma.loan_schedules.aggregate({
      _sum: { interest_paid: true, penalty_paid: true },
      where: {
        paid_at: { gte: startDate }
      }
    })
    const keuntunganSP = Number(spInterest._sum.interest_paid || 0) + Number(spInterest._sum.penalty_paid || 0)

    // 4. Pengeluaran Operasional dari COA beban yang sudah diposting
    const expenses = await prisma.journal_lines.aggregate({
      _sum: { debit: true, credit: true },
      where: {
        chart_of_accounts: { type: "expense" },
        journal_entries: { is_posted: true, entry_date: { gte: startDate } }
      }
    })
    const pengeluaranOperasional = Number(expenses._sum.debit || 0) - Number(expenses._sum.credit || 0)

    // 5. SHU Berjalan = Keuntungan Toko + Keuntungan SP - Pengeluaran Operasional
    const keuntunganSHU = keuntunganToko + keuntunganSP - pengeluaranOperasional

    // 6. Saldo Kas dari Jurnal COA Aset (all-time, bukan hanya periode)
    const assetAccounts = await prisma.chart_of_accounts.findMany({
      where: { type: "asset" }
    })
    const assetAccountIds = assetAccounts.map((a: any) => a.id)
    const assetLines = await prisma.journal_lines.aggregate({
      _sum: { debit: true, credit: true },
      where: {
        account_id: { in: assetAccountIds },
        journal_entries: { is_posted: true }
      }
    })
    let saldoKas = Number(assetLines._sum.debit || 0) - Number(assetLines._sum.credit || 0)

    // Fallback akuntansi jika COA belum dikonfigurasi: hitung dari sub-ledger operasional
    if (saldoKas === 0) {
      const [savingsDeposit, savingsWithdraw, loanDisbursedAll, loanRepaid, salesAll] =
        await Promise.all([
          prisma.saving_transactions.aggregate({ _sum: { amount: true }, where: { type: "deposit" } }),
          prisma.saving_transactions.aggregate({ _sum: { amount: true }, where: { type: "withdraw" } }),
          prisma.loans.aggregate({ _sum: { principal: true } }),
          prisma.loan_schedules.aggregate({
            _sum: { principal_paid: true, interest_paid: true, penalty_paid: true }
          }),
          prisma.orders.aggregate({ _sum: { grand_total: true }, where: { payment_status: "paid" } }),
        ])

      const netSavings    = Number(savingsDeposit._sum.amount || 0) - Number(savingsWithdraw._sum.amount || 0)
      const totalDisbursed = Number(loanDisbursedAll._sum.principal || 0)
      const totalRepaid   = Number(loanRepaid._sum.principal_paid || 0)
                          + Number(loanRepaid._sum.interest_paid || 0)
                          + Number(loanRepaid._sum.penalty_paid || 0)
      const totalSalesAll = Number(salesAll._sum.grand_total || 0)

      // Tidak ada magic number — saldo dihitung murni dari aliran kas operasional
      saldoKas = netSavings + totalRepaid + totalSalesAll - totalDisbursed
    }

    // 7. Pengeluaran Toko (Nilai HPP barang masuk dari stock_movements type='in')
    const stockInbound = await prisma.stock_movements.findMany({
      where: {
        type: { in: ["in"] },
        created_at: { gte: startDate }
      },
      include: {
        products: { select: { purchase_price: true } }
      }
    })
    let pengeluaranToko = 0
    stockInbound.forEach((movement: any) => {
      pengeluaranToko += movement.qty * Number(movement.products.purchase_price || 0)
    })

    // 8. Pengeluaran Simpan Pinjam (Realisasi Pencairan Pinjaman)
    const loanDisbursed = await prisma.loans.aggregate({
      _sum: { principal: true },
      where: {
        disbursed_at: { gte: startDate },
        status: { in: ["active", "paid_off"] }
      }
    })
    const pengeluaranSP = Number(loanDisbursed._sum.principal || 0)

    return {
      keuntunganSHU,
      totalTransaksi: orderCount,
      pengeluaranOperasional,
      saldoKas,
      keuntunganToko,
      keuntunganSP,
      pengeluaranToko,
      pengeluaranSP
    }
  } catch (error) {
    console.error("[getGlobalFinancialStats] Error fetching global financial stats:", error)
    return {
      keuntunganSHU: 0,
      totalTransaksi: 0,
      pengeluaranOperasional: 0,
      saldoKas: 0,
      keuntunganToko: 0,
      keuntunganSP: 0,
      pengeluaranToko: 0,
      pengeluaranSP: 0
    }
  }
}
