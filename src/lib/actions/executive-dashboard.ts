"use server"

import { prisma } from "@/lib/db/prisma"

// ─── Types ────────────────────────────────────────────────────────────────────

export type FinancialOverview = {
  totalKasBank:       number   // Total saldo aset likuid (kas + bank) dari COA
  totalSimpanan:      number   // Akumulasi simpanan pokok + wajib + sukarela anggota
  totalPinjamanBeredar: number // Outstanding principal seluruh pinjaman aktif
  estimasiSHU:        number   // Laba YTD = (pendapatan - HPP - beban operasional)
}

export type LoanHealth = {
  nplAmount:        number  // Nilai total pinjaman macet/telat (outstanding)
  nplRatio:         number  // Persentase NPL vs total outstanding (%)
  pendingApprovals: number  // Jumlah pengajuan pinjaman menunggu persetujuan
  dueSoon:          {       // Angsuran jatuh tempo 7 hari ke depan
    member_name: string
    loan_no:     string
    due_date:    string
    amount_due:  number
  }[]
}

export type MembershipStats = {
  total:     number
  active:    number
  inactive:  number
  growthByMonth: { month: string; new_members: number }[]
}

export type CashFlowPoint = {
  label:      string  // e.g. "2025-05-01"
  pemasukan:  number  // angsuran masuk + simpanan masuk + penjualan
  pengeluaran: number // pencairan pinjaman + pengeluaran operasional
}

export type ExecutiveDashboardData = {
  financialOverview:  FinancialOverview
  loanHealth:         LoanHealth
  membershipStats:    MembershipStats
  cashFlowMonthly:    CashFlowPoint[]   // 12 bulan terakhir
  generatedAt:        string            // ISO timestamp
}

// ─── Sub-services (Single Responsibility) ──────────────────────────────────────

/**
 * Menghitung saldo Kas & Bank koperasi berdasarkan COA Aset.
 * Jika saldo COA bernilai 0, dilakukan fallback kalkulasi dari sub-ledger operasional.
 *
 * @returns {Promise<number>} Saldo Kas & Bank riil
 * @throws {Error} Jika terjadi kesalahan pada query database
 */
async function calculateTotalKasBank(): Promise<number> {
  try {
    const assetAccounts = await prisma.chart_of_accounts.findMany({ where: { type: "asset" } });
    const assetIds = assetAccounts.map((a) => a.id);
    const assetLines = await prisma.journal_lines.aggregate({
      _sum: { debit: true, credit: true },
      where: { account_id: { in: assetIds }, journal_entries: { is_posted: true } },
    });
    const totalKasBank = Number(assetLines._sum.debit || 0) - Number(assetLines._sum.credit || 0);

    if (totalKasBank !== 0) return Math.max(0, totalKasBank);

    const [savingsDeposit, savingsWithdraw, loanDisbursedAll, loanRepaid, salesAll] = await Promise.all([
      prisma.saving_transactions.aggregate({ _sum: { amount: true }, where: { type: "deposit" } }),
      prisma.saving_transactions.aggregate({ _sum: { amount: true }, where: { type: "withdraw" } }),
      prisma.loans.aggregate({ _sum: { principal: true } }),
      prisma.loan_schedules.aggregate({ _sum: { principal_paid: true, interest_paid: true, penalty_paid: true } }),
      prisma.orders.aggregate({ _sum: { grand_total: true }, where: { payment_status: "paid" } }),
    ]);

    const netSavings = Number(savingsDeposit._sum.amount || 0) - Number(savingsWithdraw._sum.amount || 0);
    const totalDisbursed = Number(loanDisbursedAll._sum.principal || 0);
    const totalRepaid = Number(loanRepaid._sum.principal_paid || 0) +
      Number(loanRepaid._sum.interest_paid || 0) +
      Number(loanRepaid._sum.penalty_paid || 0);
    const totalSalesAll = Number(salesAll._sum.grand_total || 0);

    return Math.max(0, netSavings + totalRepaid + totalSalesAll - totalDisbursed);
  } catch (error) {
    console.error("[calculateTotalKasBank] Error:", error);
    throw error;
  }
}

/**
 * Menghitung akumulasi total simpanan bersih anggota (deposit - withdraw).
 *
 * @returns {Promise<number>} Total simpanan bersih anggota
 * @throws {Error} Jika terjadi kesalahan pada query database
 */
async function calculateTotalSimpanan(): Promise<number> {
  try {
    const totalSimpananAgg = await prisma.saving_transactions.groupBy({
      by: ["type"],
      _sum: { amount: true },
    });
    const simpananMap = Object.fromEntries(
      totalSimpananAgg.map((g) => [g.type, Number(g._sum.amount || 0)])
    );
    return Math.max(0, (simpananMap["deposit"] || 0) - (simpananMap["withdraw"] || 0));
  } catch (error) {
    console.error("[calculateTotalSimpanan] Error:", error);
    throw error;
  }
}

/**
 * Menghitung estimasi sisa hasil usaha (SHU) berjalan YTD.
 *
 * @param {Date} yearStart - Awal tahun berjalan (1 Januari)
 * @returns {Promise<number>} Estimasi nilai SHU YTD
 * @throws {Error} Jika terjadi kesalahan pada query database
 */
async function calculateEstimasiSHU(yearStart: Date): Promise<number> {
  try {
    const [ytdRev, ytdHppItems, ytdExp, omzetYtd] = await Promise.all([
      prisma.journal_lines.aggregate({
        _sum: { credit: true, debit: true },
        where: { chart_of_accounts: { type: "revenue" }, journal_entries: { is_posted: true, entry_date: { gte: yearStart } } },
      }),
      prisma.order_items.findMany({
        where: { orders: { payment_status: "paid", ordered_at: { gte: yearStart } } },
        select: { qty: true, products: { select: { purchase_price: true } } },
      }),
      prisma.journal_lines.aggregate({
        _sum: { debit: true, credit: true },
        where: { chart_of_accounts: { type: "expense" }, journal_entries: { is_posted: true, entry_date: { gte: yearStart } } },
      }),
      prisma.orders.aggregate({
        _sum: { grand_total: true },
        where: { payment_status: "paid", ordered_at: { gte: yearStart } },
      }),
    ]);

    const ytdHpp = ytdHppItems.reduce((s, i) => s + i.qty * Number(i.products?.purchase_price ?? 0), 0);
    const labaKotor = Number(omzetYtd._sum.grand_total || 0) - ytdHpp;
    const pendapatanSP = Number(ytdRev._sum.credit || 0) - Number(ytdRev._sum.debit || 0);
    const bebanYtd = Number(ytdExp._sum.debit || 0) - Number(ytdExp._sum.credit || 0);
    
    return labaKotor + pendapatanSP - bebanYtd;
  } catch (error) {
    console.error("[calculateEstimasiSHU] Error:", error);
    throw error;
  }
}

/**
 * Mengambil ringkasan data finansial koperasi (Kas/Bank, Simpanan, Outstanding Pinjaman, Estimasi SHU).
 *
 * @param {Date} yearStart - Awal tahun berjalan (1 Januari)
 * @returns {Promise<FinancialOverview>} Data ringkasan keuangan
 */
async function getFinancialOverview(yearStart: Date): Promise<FinancialOverview> {
  try {
    const [totalKasBank, totalSimpanan, activeLoansAgg, estimasiSHU] = await Promise.all([
      calculateTotalKasBank(),
      calculateTotalSimpanan(),
      prisma.loans.aggregate({
        _sum: { outstanding_principal: true },
        where: { status: "active" },
      }),
      calculateEstimasiSHU(yearStart),
    ]);

    return {
      totalKasBank,
      totalSimpanan,
      totalPinjamanBeredar: Number(activeLoansAgg._sum.outstanding_principal || 0),
      estimasiSHU,
    };
  } catch (error) {
    console.error("[getFinancialOverview] Error:", error);
    throw error;
  }
}

/**
 * Mengambil data kesehatan kredit/pinjaman koperasi (NPL, Pending Approval, Jatuh Tempo).
 *
 * @param {Date} now - Waktu sekarang
 * @param {Date} next7Days - Waktu 7 hari ke depan
 * @param {number} totalPinjamanBeredar - Total pinjaman beredar sebagai pembagi rasio NPL
 * @returns {Promise<LoanHealth>} Data kesehatan pinjaman
 */
async function getLoanHealth(
  now: Date,
  next7Days: Date,
  totalPinjamanBeredar: number
): Promise<LoanHealth> {
  try {
    const [nplSchedules, pendingApprovals, dueSoonSchedules] = await Promise.all([
      prisma.loan_schedules.findMany({
        where: {
          due_date: { lt: now },
          status: { in: ["pending", "partial", "overdue"] },
        },
        select: {
          total_due: true,
          principal_paid: true,
          interest_paid: true,
          penalty_paid: true,
        },
      }),
      prisma.loan_applications.count({
        where: { status: { in: ["pending", "under_review"] } },
      }),
      prisma.loan_schedules.findMany({
        where: {
          due_date: { gte: now, lte: next7Days },
          status: { in: ["pending", "partial"] },
        },
        select: {
          due_date: true,
          total_due: true,
          principal_paid: true,
          interest_paid: true,
          loans: {
            select: {
              loan_no: true,
              members: { select: { full_name: true } },
            },
          },
        },
        orderBy: { due_date: "asc" },
        take: 15,
      }),
    ])

    const nplAmount = nplSchedules.reduce((sum, s) => {
      const outstanding =
        Number(s.total_due) - Number(s.principal_paid) - Number(s.interest_paid) - Number(s.penalty_paid || 0)
      return sum + Math.max(0, outstanding)
    }, 0)
    const nplRatio = totalPinjamanBeredar > 0
      ? Math.round((nplAmount / totalPinjamanBeredar) * 10000) / 100
      : 0

    const dueSoon = dueSoonSchedules.map((s) => ({
      member_name: s.loans.members?.full_name ?? "-",
      loan_no:     s.loans.loan_no,
      due_date:    (s.due_date as Date).toLocaleDateString("id-ID"),
      amount_due:  Math.max(
        0,
        Number(s.total_due) - Number(s.principal_paid) - Number(s.interest_paid)
      ),
    }))

    return {
      nplAmount,
      nplRatio,
      pendingApprovals,
      dueSoon,
    }
  } catch (error) {
    console.error("[getLoanHealth] Error:", error)
    throw error
  }
}

/**
 * Mengambil statistik anggota koperasi (Total, Aktif, Inaktif, dan Pertumbuhan Bulanan).
 *
 * @returns {Promise<MembershipStats>} Data statistik anggota
 */
async function getMembershipStats(): Promise<MembershipStats> {
  try {
    const [memberCounts, memberGrowthRaw] = await Promise.all([
      prisma.member.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.$queryRaw<{ month: string; new_members: number }[]>`
        SELECT
          DATE_FORMAT(created_at, '%Y-%m') AS month,
          COUNT(*) AS new_members
        FROM members
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m')
        ORDER BY month ASC
      `,
    ])

    const statusMap = Object.fromEntries(
      memberCounts.map((g) => [g.status, g._count.id])
    )
    const membershipStats: MembershipStats = {
      total:    memberCounts.reduce((s, g) => s + g._count.id, 0),
      active:   statusMap["active"]   || 0,
      inactive: (statusMap["inactive"] || 0) + (statusMap["suspended"] || 0),
      growthByMonth: (memberGrowthRaw as any[]).map((r) => ({
        month:       String(r.month),
        new_members: Number(r.new_members),
      })),
    }

    return membershipStats
  } catch (error) {
    console.error("[getMembershipStats] Error:", error)
    throw error
  }
}

/**
 * Mengambil data arus kas masuk vs keluar 12 bulan terakhir.
 *
 * @returns {Promise<CashFlowPoint[]>} Deret data arus kas bulanan
 */
async function getCashFlowMonthly(): Promise<CashFlowPoint[]> {
  try {
    const cashFlowRaw = await prisma.$queryRaw<
      { month: string; pemasukan: number; pengeluaran: number }[]
    >`
      SELECT
        DATE_FORMAT(bulan, '%Y-%m') AS month,
        SUM(pemasukan)              AS pemasukan,
        SUM(pengeluaran)            AS pengeluaran
      FROM (
        SELECT DATE_FORMAT(paid_at, '%Y-%m-01') AS bulan,
               SUM(principal_paid + interest_paid + COALESCE(penalty_paid, 0)) AS pemasukan,
               0 AS pengeluaran
        FROM loan_schedules
        WHERE paid_at IS NOT NULL
          AND paid_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        GROUP BY DATE_FORMAT(paid_at, '%Y-%m-01')

        UNION ALL

        SELECT DATE_FORMAT(transaction_at, '%Y-%m-01') AS bulan,
               SUM(amount) AS pemasukan,
               0 AS pengeluaran
        FROM saving_transactions
        WHERE type = 'deposit'
          AND transaction_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        GROUP BY DATE_FORMAT(transaction_at, '%Y-%m-01')

        UNION ALL

        SELECT DATE_FORMAT(COALESCE(paid_at, ordered_at), '%Y-%m-01') AS bulan,
               SUM(grand_total) AS pemasukan,
               0 AS pengeluaran
        FROM orders
        WHERE payment_status = 'paid'
          AND payment_method != 'paylater'
          AND COALESCE(paid_at, ordered_at) >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        GROUP BY DATE_FORMAT(COALESCE(paid_at, ordered_at), '%Y-%m-01')

        UNION ALL

        SELECT DATE_FORMAT(disbursed_at, '%Y-%m-01') AS bulan,
               0 AS pemasukan,
               SUM(principal) AS pengeluaran
        FROM loans
        WHERE disbursed_at IS NOT NULL
          AND disbursed_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        GROUP BY DATE_FORMAT(disbursed_at, '%Y-%m-01')
      ) t
      GROUP BY DATE_FORMAT(bulan, '%Y-%m')
      ORDER BY month ASC
    `

    return (cashFlowRaw as any[]).map((r) => ({
      label:       String(r.month),
      pemasukan:   Number(r.pemasukan  || 0),
      pengeluaran: Number(r.pengeluaran || 0),
    }))
  } catch (error) {
    console.error("[getCashFlowMonthly] Error:", error)
    throw error
  }
}

// ─── Main Action ──────────────────────────────────────────────────────────────

/**
 * Mengambil semua data dashboard eksekutif pengurus koperasi dari database riil.
 * Mencakup: Ringkasan Finansial, Kesehatan Kredit, Statistik Anggota, dan Arus Kas.
 *
 * @returns {Promise<ExecutiveDashboardData>} Data dashboard komprehensif
 */
export async function getExecutiveDashboardData(): Promise<ExecutiveDashboardData> {
  const emptyData: ExecutiveDashboardData = {
    financialOverview:  { totalKasBank: 0, totalSimpanan: 0, totalPinjamanBeredar: 0, estimasiSHU: 0 },
    loanHealth:         { nplAmount: 0, nplRatio: 0, pendingApprovals: 0, dueSoon: [] },
    membershipStats:    { total: 0, active: 0, inactive: 0, growthByMonth: [] },
    cashFlowMonthly:    [],
    generatedAt:        new Date().toISOString(),
  }

  try {
    const now        = new Date()
    const yearStart  = new Date(now.getFullYear(), 0, 1)
    const next7Days  = new Date(now)
    next7Days.setDate(now.getDate() + 7)

    const financialOverview = await getFinancialOverview(yearStart)
    const loanHealth = await getLoanHealth(now, next7Days, financialOverview.totalPinjamanBeredar)
    const membershipStats = await getMembershipStats()
    const cashFlowMonthly = await getCashFlowMonthly()

    return {
      financialOverview,
      loanHealth,
      membershipStats,
      cashFlowMonthly,
      generatedAt: now.toISOString(),
    }
  } catch (error) {
    console.error("[getExecutiveDashboardData] Error:", error)
    return emptyData
  }
}
