"use server"

import { prisma } from "@/lib/db/prisma"

// ─────────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface FinancialRatios {
  year: number
  currentRatio: number           // Aset Lancar / Kewajiban Lancar (%)
  derRatio: number               // Total Kewajiban / Total Ekuitas (%)
  nplRatio: number               // Pinjaman Macet / Total Pinjaman Aktif (%)
  roeRatio: number               // SHU Bersih / Total Ekuitas (%)
  totalAsetLancar: number
  totalKewajibanLancar: number
  totalKewajiban: number
  totalEkuitas: number
  shuBersih: number
  totalPinjamanAktif: number
  totalPinjamanNPL: number
  /** Label kesehatan masing-masing rasio */
  health: {
    currentRatio: "sehat" | "cukup" | "rendah"
    derRatio: "sehat" | "cukup" | "tinggi"
    nplRatio: "sehat" | "cukup" | "buruk"
    roeRatio: "sehat" | "cukup" | "rendah"
  }
}

export interface LoanCollectibilityItem {
  loanId: string
  loanNo: string
  memberName: string
  memberCode: string
  principal: number
  outstandingPrincipal: number
  totalOverdue: number
  dpd: number           // Days Past Due — hari keterlambatan terlama
  kategori: "Lancar" | "Kurang Lancar" | "Diragukan" | "Macet"
  installmentCount: number
  overdueInstallments: number
}

export interface LoanCollectibilityReport {
  total: number
  lancar: number
  kurangLancar: number
  diragukan: number
  macet: number
  totalNilaiLancar: number
  totalNilaiKurangLancar: number
  totalNilaiDiragukan: number
  totalNilaiMacet: number
  items: LoanCollectibilityItem[]
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Saldo COA per Tipe & Kode
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Menghitung total saldo akun COA berdasarkan tipe dan prefix kode.
 *
 * @param {string} type - Tipe akun COA ('asset' | 'liability' | 'equity' | ...)
 * @param {Date} asOfDate - Tanggal pemotongan saldo
 * @param {string} [codePrefix] - Prefix kode akun (misal: '11' untuk aset lancar)
 * @returns {Promise<number>} Total saldo
 */
async function getSaldoCoa(
  type: "asset" | "liability" | "equity" | "revenue" | "expense",
  asOfDate: Date,
  codePrefix?: string
): Promise<number> {
  try {
    const accounts = await prisma.chart_of_accounts.findMany({
      where: {
        is_active: true,
        type,
        ...(codePrefix ? { code: { startsWith: codePrefix } } : {}),
      },
    })

    let total = 0
    for (const acc of accounts) {
      const agg = await prisma.journal_lines.aggregate({
        where: {
          account_id: acc.id,
          journal_entries: { is_posted: true, entry_date: { lte: asOfDate } },
        },
        _sum: { debit: true, credit: true },
      })
      const debit = Number(agg._sum.debit ?? 0)
      const credit = Number(agg._sum.credit ?? 0)
      // Aset & Expense: normal debit. Liability, Equity, Revenue: normal credit
      if (type === "asset" || type === "expense") {
        total += debit - credit
      } else {
        total += credit - debit
      }
    }
    return Math.max(0, total)
  } catch (error) {
    console.error(`Error in getSaldoCoa (${type}, ${codePrefix}):`, error)
    return 0
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT: getFinancialRatios
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Menghitung 4 rasio keuangan utama kesehatan koperasi untuk dashboard pengawas.
 * Mencakup: Current Ratio, DER, NPL, dan ROE.
 *
 * @param {number} year - Tahun buku untuk analisis rasio
 * @returns {Promise<FinancialRatios>} Objek rasio keuangan lengkap dengan label kesehatan
 * @throws {Error} Jika terjadi kegagalan akses database
 */
export async function getFinancialRatios(year: number): Promise<FinancialRatios> {
  try {
    const endDate = new Date(year, 11, 31, 23, 59, 59)
    const startDate = new Date(year, 0, 1, 0, 0, 0)

    // Paralel fetch semua komponen yang dibutuhkan
    const [
      totalAsetLancar,
      totalKewajibanLancar,
      totalKewajiban,
      totalEkuitas,
    ] = await Promise.all([
      getSaldoCoa("asset", endDate, "11"),  // Aset Lancar: kode 11xx
      getSaldoCoa("liability", endDate, "21"), // Kewajiban Lancar: kode 21xx
      getSaldoCoa("liability", endDate),
      getSaldoCoa("equity", endDate),
    ])

    // SHU Bersih Tahun ini
    const storeRevAgg = await prisma.orders.aggregate({
      where: { payment_status: "paid", paid_at: { gte: startDate, lte: endDate } },
      _sum: { grand_total: true },
    })
    const loanRevAgg = await prisma.loan_schedules.aggregate({
      where: { status: "paid", paid_at: { gte: startDate, lte: endDate } },
      _sum: { interest_paid: true, penalty_paid: true },
    })
    const expenseAgg = await prisma.journal_lines.aggregate({
      where: {
        journal_entries: { is_posted: true, entry_date: { gte: startDate, lte: endDate } },
        chart_of_accounts: { type: "expense" },
      },
      _sum: { debit: true, credit: true },
    })
    const totalRevenue =
      Number(storeRevAgg._sum.grand_total ?? 0) +
      Number(loanRevAgg._sum.interest_paid ?? 0) +
      Number(loanRevAgg._sum.penalty_paid ?? 0)
    const totalExpense = Number(expenseAgg._sum.debit ?? 0) - Number(expenseAgg._sum.credit ?? 0)
    const shuBersih = totalRevenue - totalExpense

    // NPL: Pinjaman dengan jadwal yang DPD > 0 dan status pending
    const today = new Date()
    const overdueSchedules = await prisma.loan_schedules.findMany({
      where: {
        status: "pending",
        due_date: { lt: today },
        loans: { status: "active" },
      },
      select: {
        loan_id: true,
        principal_due: true,
        interest_due: true,
        due_date: true,
      },
    })

    // Hitung set loan_id yang NPL
    const nplLoanIds = new Set(overdueSchedules.map((s) => s.loan_id))
    const totalPinjamanNPL_principal = overdueSchedules.reduce(
      (sum, s) => sum + Number(s.principal_due) + Number(s.interest_due),
      0
    )

    // Total pinjaman aktif
    const totalPinjamanAgg = await prisma.loans.aggregate({
      where: { status: "active" },
      _sum: { outstanding_principal: true },
    })
    const totalPinjamanAktif = Number(totalPinjamanAgg._sum.outstanding_principal ?? 0)

    // Kalkulasi Rasio
    const currentRatio = totalKewajibanLancar > 0
      ? (totalAsetLancar / totalKewajibanLancar) * 100
      : 999.99
    const derRatio = totalEkuitas > 0
      ? (totalKewajiban / totalEkuitas) * 100
      : 0
    const nplRatio = totalPinjamanAktif > 0
      ? (totalPinjamanNPL_principal / totalPinjamanAktif) * 100
      : 0
    const roeRatio = totalEkuitas > 0
      ? (shuBersih / totalEkuitas) * 100
      : 0

    // Label Kesehatan
    const health = {
      currentRatio:
        currentRatio >= 200
          ? ("sehat" as const)
          : currentRatio >= 125
          ? ("cukup" as const)
          : ("rendah" as const),
      derRatio:
        derRatio < 100
          ? ("sehat" as const)
          : derRatio < 200
          ? ("cukup" as const)
          : ("tinggi" as const),
      nplRatio:
        nplRatio < 5
          ? ("sehat" as const)
          : nplRatio < 10
          ? ("cukup" as const)
          : ("buruk" as const),
      roeRatio:
        roeRatio >= 10
          ? ("sehat" as const)
          : roeRatio >= 5
          ? ("cukup" as const)
          : ("rendah" as const),
    }

    return {
      year,
      currentRatio: Number(currentRatio.toFixed(2)),
      derRatio: Number(derRatio.toFixed(2)),
      nplRatio: Number(nplRatio.toFixed(2)),
      roeRatio: Number(roeRatio.toFixed(2)),
      totalAsetLancar,
      totalKewajibanLancar,
      totalKewajiban,
      totalEkuitas,
      shuBersih,
      totalPinjamanAktif,
      totalPinjamanNPL: totalPinjamanNPL_principal,
      health,
    }
  } catch (error) {
    console.error("Error in getFinancialRatios:", error)
    throw error
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT: getLoanCollectibility
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mengklasifikasikan seluruh pinjaman aktif berdasarkan kolektibilitas (DPD).
 * Kategori: Lancar (0 hari), Kurang Lancar (1-90), Diragukan (91-180), Macet (>180).
 *
 * @returns {Promise<LoanCollectibilityReport>} Laporan kolektibilitas pinjaman lengkap
 * @throws {Error} Jika terjadi kegagalan akses database
 */
export async function getLoanCollectibility(): Promise<LoanCollectibilityReport> {
  try {
    const today = new Date()

    // Ambil semua pinjaman aktif dengan jadwal tertunda
    const activeLoans = await prisma.loans.findMany({
      where: { status: "active" },
      include: {
        members: { select: { full_name: true, member_code: true } },
        loan_schedules: {
          where: { status: "pending" },
          orderBy: { due_date: "asc" },
        },
      },
      orderBy: { disbursed_at: "desc" },
    })

    const items: LoanCollectibilityItem[] = []
    let lancar = 0, kurangLancar = 0, diragukan = 0, macet = 0
    let totalNilaiLancar = 0, totalNilaiKurangLancar = 0, totalNilaiDiragukan = 0, totalNilaiMacet = 0

    for (const loan of activeLoans) {
      const overdueSchedules = loan.loan_schedules.filter(
        (s) => new Date(s.due_date) < today
      )

      // DPD = selisih hari angsuran tertunggak terlama dengan hari ini
      let dpd = 0
      let totalOverdue = 0
      if (overdueSchedules.length > 0) {
        const earliestOverdue = overdueSchedules[0]
        dpd = Math.floor(
          (today.getTime() - new Date(earliestOverdue.due_date).getTime()) /
            (1000 * 60 * 60 * 24)
        )
        totalOverdue = overdueSchedules.reduce(
          (sum, s) => sum + Number(s.principal_due) + Number(s.interest_due),
          0
        )
      }

      let kategori: LoanCollectibilityItem["kategori"]
      const outstandingPrincipal = Number(loan.outstanding_principal)

      if (dpd === 0) {
        kategori = "Lancar"
        lancar++
        totalNilaiLancar += outstandingPrincipal
      } else if (dpd <= 90) {
        kategori = "Kurang Lancar"
        kurangLancar++
        totalNilaiKurangLancar += outstandingPrincipal
      } else if (dpd <= 180) {
        kategori = "Diragukan"
        diragukan++
        totalNilaiDiragukan += outstandingPrincipal
      } else {
        kategori = "Macet"
        macet++
        totalNilaiMacet += outstandingPrincipal
      }

      items.push({
        loanId: loan.id.toString(),
        loanNo: loan.loan_no,
        memberName: loan.members.full_name,
        memberCode: loan.members.member_code,
        principal: Number(loan.principal),
        outstandingPrincipal,
        totalOverdue,
        dpd,
        kategori,
        installmentCount: loan.tenor_months,
        overdueInstallments: overdueSchedules.length,
      })
    }

    // Urutkan: macet teratas → kurang lancar → lancar
    items.sort((a, b) => b.dpd - a.dpd)

    return {
      total: items.length,
      lancar,
      kurangLancar,
      diragukan,
      macet,
      totalNilaiLancar,
      totalNilaiKurangLancar,
      totalNilaiDiragukan,
      totalNilaiMacet,
      items,
    }
  } catch (error) {
    console.error("Error in getLoanCollectibility:", error)
    throw error
  }
}
