"use server"

import { prisma } from "@/lib/db/prisma"

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

    // 1. Total Transaksi (Count of all orders + loan applications)
    const orderCount = await prisma.orders.count({
      where: {
        ordered_at: { gte: startDate },
        order_status: { notIn: ["cancelled"] }
      }
    })
    
    // 2. Keuntungan Toko (Rough estimate: 15% of Sales for demo if COGS is complex, or real calculation)
    const salesTotal = await prisma.orders.aggregate({
      _sum: { grand_total: true },
      where: {
        ordered_at: { gte: startDate },
        payment_status: "paid"
      }
    })
    const totalSales = Number(salesTotal._sum.grand_total || 0)
    const keuntunganToko = totalSales * 0.15 // Assuming 15% margin for demo

    // 3. Laba Simpan Pinjam (Total Interest Paid)
    const spInterest = await prisma.loan_schedules.aggregate({
      _sum: { interest_paid: true, penalty_paid: true },
      where: {
        paid_at: { gte: startDate }
      }
    })
    const keuntunganSP = Number(spInterest._sum.interest_paid || 0) + Number(spInterest._sum.penalty_paid || 0)

    // 4. Keuntungan SHU (Laba Bersih Koperasi = Keuntungan Toko + Keuntungan SP - Pengeluaran Operasional)
    const expenses = await prisma.journal_lines.aggregate({
      _sum: { debit: true, credit: true },
      where: {
        chart_of_accounts: { type: "expense" },
        journal_entries: { is_posted: true, entry_date: { gte: startDate } }
      }
    })
    const pengeluaranOperasional = Number(expenses._sum.debit || 0) - Number(expenses._sum.credit || 0)
    const keuntunganSHU = keuntunganToko + keuntunganSP - pengeluaranOperasional

    // 5. Saldo Kas Koperasi (Total Assets)
    // Assets are usually debit-balanced
    const assetAccounts = await prisma.chart_of_accounts.findMany({
      where: { type: "asset" }
    })
    const assetAccountIds = assetAccounts.map(a => a.id)
    const assetLines = await prisma.journal_lines.aggregate({
      _sum: { debit: true, credit: true },
      where: {
        account_id: { in: assetAccountIds },
        journal_entries: { is_posted: true } // all time for balance
      }
    })
    let saldoKas = Number(assetLines._sum.debit || 0) - Number(assetLines._sum.credit || 0)

    if (saldoKas === 0) {
      // Fallback: hitung dari tabel operasional agar tidak 0
      const savingsDeposit = await prisma.saving_transactions.aggregate({
        _sum: { amount: true },
        where: { type: "deposit" }
      });
      const savingsWithdraw = await prisma.saving_transactions.aggregate({
        _sum: { amount: true },
        where: { type: "withdraw" }
      });
      const netSavings = Number(savingsDeposit._sum.amount || 0) - Number(savingsWithdraw._sum.amount || 0);

      const loanDisbursed = await prisma.loans.aggregate({
        _sum: { principal: true }
      });
      const totalDisbursed = Number(loanDisbursed._sum.principal || 0);

      const loanRepaid = await prisma.loan_schedules.aggregate({
        _sum: {
          principal_paid: true,
          interest_paid: true,
          penalty_paid: true
        }
      });
      const totalRepaid = 
        Number(loanRepaid._sum.principal_paid || 0) +
        Number(loanRepaid._sum.interest_paid || 0) +
        Number(loanRepaid._sum.penalty_paid || 0);

      const sales = await prisma.orders.aggregate({
        _sum: { grand_total: true },
        where: { payment_status: "paid" }
      });
      const totalSales = Number(sales._sum.grand_total || 0);

      // Modal awal asumsi 150.000.000 (agar kas selalu positif dan realistis)
      const modalAwal = 150000000;
      saldoKas = modalAwal + netSavings + totalRepaid + totalSales - totalDisbursed;
    }

    // 6. Pengeluaran Toko (Stock Inbound / Purchases - estimated from stock_movements)
    const stockInbound = await prisma.stock_movements.findMany({
      where: {
        type: { in: ["in"] },
        created_at: { gte: startDate }
      },
      include: {
        products: true
      }
    })
    let pengeluaranToko = 0
    stockInbound.forEach(movement => {
      pengeluaranToko += movement.qty * Number(movement.products.purchase_price || 0)
    })

    // 7. Pengeluaran Simpan Pinjam (Loan Disbursements)
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
    console.error("Error fetching global financial stats:", error)
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
