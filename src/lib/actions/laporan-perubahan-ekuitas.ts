"use server"

import { prisma } from "@/lib/db/prisma"

// ─────────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface PerubahanEkuitasItem {
  keterangan: string
  jumlah: number
}

export interface PerubahanEkuitasReport {
  year: number
  modalAwal: number
  penambahan: {
    items: PerubahanEkuitasItem[]
    total: number
  }
  pengurangan: {
    items: PerubahanEkuitasItem[]
    total: number
  }
  modalAkhir: number
  /** SHU berjalan tahun ini yang menjadi bagian dari modal akhir */
  shuBerjalan: number
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Total Saldo Ekuitas COA pada Tanggal Tertentu
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Menghitung total saldo ekuitas dari semua akun COA tipe equity
 * pada tanggal tertentu (berdasarkan journal_lines yang terposting).
 *
 * @param {Date} asOfDate - Tanggal pemotongan saldo
 * @returns {Promise<number>} Total saldo ekuitas
 */
async function getTotalEkuitasCoa(asOfDate: Date): Promise<number> {
  try {
    const equityAccounts = await prisma.chart_of_accounts.findMany({
      where: { is_active: true, type: "equity" },
    })

    let total = 0
    for (const acc of equityAccounts) {
      const agg = await prisma.journal_lines.aggregate({
        where: {
          account_id: acc.id,
          journal_entries: { is_posted: true, entry_date: { lte: asOfDate } },
        },
        _sum: { debit: true, credit: true },
      })
      // Akun ekuitas bersaldo normal kredit → credit - debit
      total += Number(agg._sum.credit ?? 0) - Number(agg._sum.debit ?? 0)
    }
    return total
  } catch (error) {
    console.error("Error in getTotalEkuitasCoa:", error)
    return 0
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT: getPerubahanEkuitas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mengambil Laporan Perubahan Ekuitas Koperasi untuk satu tahun buku.
 * Menyajikan jembatan informasi dari modal awal hingga modal akhir
 * sesuai standar SAK ETAP Koperasi.
 *
 * @param {number} year - Tahun buku laporan perubahan ekuitas
 * @returns {Promise<PerubahanEkuitasReport>} Laporan perubahan ekuitas
 * @throws {Error} Jika terjadi kegagalan akses database
 */
export async function getPerubahanEkuitas(year: number): Promise<PerubahanEkuitasReport> {
  try {
    const startDate = new Date(year, 0, 1, 0, 0, 0)
    const endDate = new Date(year, 11, 31, 23, 59, 59)
    const prevEndDate = new Date(year - 1, 11, 31, 23, 59, 59)

    // 1. Modal Awal = saldo ekuitas COA pada akhir tahun sebelumnya
    const modalAwal = await getTotalEkuitasCoa(prevEndDate)

    // 2. Penambahan Simpanan Pokok (setoran anggota baru/lama)
    const typePOKOK = await prisma.saving_types.findFirst({
      where: {
        OR: [
          { code: "SP" },
          { code: { contains: "POKOK" } },
          { name: { contains: "Pokok" } }
        ]
      },
    })
    let simpananPokok = 0
    if (typePOKOK) {
      const agg = await prisma.saving_transactions.aggregate({
        where: {
          type: { in: ["deposit", "salary_cut"] },
          transaction_at: { gte: startDate, lte: endDate },
          savings: { saving_type_id: typePOKOK.id },
        },
        _sum: { amount: true },
      })
      simpananPokok = Number(agg._sum.amount ?? 0)
    }

    // 3. Penambahan Simpanan Wajib (setoran bulanan)
    const typeWAJIB = await prisma.saving_types.findFirst({
      where: {
        OR: [
          { code: "SW" },
          { code: { contains: "WAJIB" } },
          { name: { contains: "Wajib" } }
        ]
      },
    })
    let simpananWajib = 0
    if (typeWAJIB) {
      const agg = await prisma.saving_transactions.aggregate({
        where: {
          type: { in: ["deposit", "salary_cut"] },
          transaction_at: { gte: startDate, lte: endDate },
          savings: { saving_type_id: typeWAJIB.id },
        },
        _sum: { amount: true },
      })
      simpananWajib = Number(agg._sum.amount ?? 0)
    }

    // 4. Alokasi Dana Cadangan dari SHU tahun lalu
    const shuPeriodLalu = await prisma.shu_periods.findFirst({
      where: { period_year: year - 1, status: "distributed" },
      orderBy: { period_year: "desc" },
    })
    const danaCadangan = shuPeriodLalu
      ? Number(shuPeriodLalu.shu_for_reserve ?? 0)
      : 0

    // 5. SHU Berjalan (dari Laporan Laba Rugi tahun ini)
    // Kalkulasi manual langsung agar tidak circular import
    const storeRevAgg = await prisma.orders.aggregate({
      where: { payment_status: "paid", paid_at: { gte: startDate, lte: endDate } },
      _sum: { grand_total: true },
    })
    const storeRevenue = Number(storeRevAgg._sum.grand_total ?? 0)

    const loanInterestAgg = await prisma.loan_schedules.aggregate({
      where: { status: "paid", paid_at: { gte: startDate, lte: endDate } },
      _sum: { interest_paid: true, penalty_paid: true },
    })
    const loanRevenue =
      Number(loanInterestAgg._sum.interest_paid ?? 0) +
      Number(loanInterestAgg._sum.penalty_paid ?? 0)

    // Hitung HPP Toko secara historis
    const paidOrders = await prisma.orders.findMany({
      where: {
        payment_status: "paid",
        paid_at: { gte: startDate, lte: endDate },
      },
      include: {
        order_items: {
          select: {
            qty: true,
            purchase_price: true,
          },
        },
      },
    })
    let storeCogs = 0
    for (const order of paidOrders) {
      for (const item of order.order_items) {
        storeCogs += item.qty * Number(item.purchase_price ?? 0)
      }
    }

    const grossProfit = (storeRevenue - storeCogs) + loanRevenue
    const expenseAgg = await prisma.journal_lines.aggregate({
      where: {
        journal_entries: { is_posted: true, entry_date: { gte: startDate, lte: endDate } },
        chart_of_accounts: { type: "expense" },
      },
      _sum: { debit: true, credit: true },
    })
    const totalExpense = Number(expenseAgg._sum.debit ?? 0) - Number(expenseAgg._sum.credit ?? 0)
    const shuBerjalan = grossProfit - totalExpense

    // 6. Pengurangan: Penarikan simpanan
    const withdrawAgg = await prisma.saving_transactions.aggregate({
      where: {
        type: "withdraw",
        transaction_at: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
    })
    const penarikanSimpanan = Number(withdrawAgg._sum.amount ?? 0)

    // 7. Pengurangan: Pembagian SHU tahun ini kepada anggota
    const shuPeriodIni = await prisma.shu_periods.findFirst({
      where: { period_year: year, status: "distributed" },
    })
    const pembagianShu = shuPeriodIni
      ? Number(shuPeriodIni.shu_for_member ?? 0)
      : 0

    // Susun laporan
    const totalPenambahan = simpananPokok + simpananWajib + danaCadangan + shuBerjalan
    const totalPengurangan = penarikanSimpanan + pembagianShu
    const modalAkhir = modalAwal + totalPenambahan - totalPengurangan

    return {
      year,
      modalAwal,
      penambahan: {
        items: [
          { keterangan: "Setoran Simpanan Pokok", jumlah: simpananPokok },
          { keterangan: "Setoran Simpanan Wajib", jumlah: simpananWajib },
          { keterangan: "Alokasi Dana Cadangan (SHU Tahun Lalu)", jumlah: danaCadangan },
          { keterangan: `SHU Berjalan Tahun ${year}`, jumlah: shuBerjalan },
        ],
        total: totalPenambahan,
      },
      pengurangan: {
        items: [
          { keterangan: "Penarikan Simpanan Anggota", jumlah: penarikanSimpanan },
          { keterangan: `Pembagian SHU Kepada Anggota Tahun ${year}`, jumlah: pembagianShu },
        ],
        total: totalPengurangan,
      },
      modalAkhir,
      shuBerjalan,
    }
  } catch (error) {
    console.error("Error in getPerubahanEkuitas:", error)
    throw error
  }
}
