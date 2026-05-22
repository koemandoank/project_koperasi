"use server"

import { prisma } from "@/lib/db/prisma"
import { NeracaReport, LabaRugiReport, CoaSummaryItem } from "@/lib/types/laporan-keuangan.types"

/**
 * Mengambil saldo COA berdasarkan tipe akun.
 * 
 * @param {string} type Tipe akun ('asset', 'liability', 'equity', 'revenue', 'expense')
 * @param {Date} endDate Batas tanggal penutupan
 * @returns {Promise<CoaSummaryItem[]>}
 */
async function getBalancesByType(
  type: "asset" | "liability" | "equity" | "revenue" | "expense", 
  endDate: Date
): Promise<CoaSummaryItem[]> {
  try {
    const coas = await prisma.chart_of_accounts.findMany({
      where: { is_active: true, type },
      orderBy: { code: "asc" },
    });

    const result: CoaSummaryItem[] = [];

    for (const coa of coas) {
      const journalLinesSum = await prisma.journal_lines.aggregate({
        where: {
          account_id: coa.id,
          journal_entries: {
            is_posted: true,
            entry_date: { lte: endDate },
          },
        },
        _sum: {
          debit: true,
          credit: true,
        },
      });

      const debit = Number(journalLinesSum._sum.debit ?? 0);
      const credit = Number(journalLinesSum._sum.credit ?? 0);
      
      let balance = 0;
      if (coa.normal_balance === "debit") {
        balance = debit - credit;
      } else {
        balance = credit - debit;
      }

      result.push({
        id: coa.id.toString(),
        code: coa.code,
        name: coa.name,
        balance,
      });
    }

    return result;
  } catch (error) {
    console.error(`Error in getBalancesByType for ${type}:`, error);
    throw error;
  }
}

/**
 * Helper: Menghitung total omzet toko (POS/Online yang paid) periode tertentu.
 * 
 * @param {Date} startDate Tanggal awal
 * @param {Date} endDate Tanggal akhir
 * @returns {Promise<number>}
 */
async function calculateStoreRevenueForPeriod(startDate: Date, endDate: Date): Promise<number> {
  const aggregate = await prisma.orders.aggregate({
    where: {
      payment_status: "paid",
      paid_at: { gte: startDate, lte: endDate },
    },
    _sum: { grand_total: true },
  });
  return Number(aggregate._sum.grand_total ?? 0);
}

/**
 * Helper: Menghitung total bunga pinjaman periode tertentu.
 * 
 * @param {Date} startDate Tanggal awal
 * @param {Date} endDate Tanggal akhir
 * @returns {Promise<number>}
 */
async function calculateLoanInterestForPeriod(startDate: Date, endDate: Date): Promise<number> {
  const aggregate = await prisma.loan_payments.aggregate({
    where: {
      paid_at: { gte: startDate, lte: endDate },
    },
    _sum: { interest_portion: true },
  });
  return Number(aggregate._sum.interest_portion ?? 0);
}

/**
 * Helper: Menghitung total denda pinjaman periode tertentu.
 * 
 * @param {Date} startDate Tanggal awal
 * @param {Date} endDate Tanggal akhir
 * @returns {Promise<number>}
 */
async function calculateLoanPenaltyForPeriod(startDate: Date, endDate: Date): Promise<number> {
  const aggregate = await prisma.loan_payments.aggregate({
    where: {
      paid_at: { gte: startDate, lte: endDate },
    },
    _sum: { penalty_amount: true },
  });
  return Number(aggregate._sum.penalty_amount ?? 0);
}

/**
 * Helper: Menghitung total pendapatan COA tipe 'revenue' pada periode tertentu.
 * 
 * @param {Date} startDate Tanggal awal
 * @param {Date} endDate Tanggal akhir
 * @returns {Promise<number>}
 */
async function calculateJournalRevenueForPeriod(startDate: Date, endDate: Date): Promise<number> {
  const aggregate = await prisma.journal_lines.aggregate({
    where: {
      journal_entries: {
        is_posted: true,
        entry_date: { gte: startDate, lte: endDate },
      },
      chart_of_accounts: {
        type: "revenue",
      },
    },
    _sum: {
      debit: true,
      credit: true,
    },
  });
  return Number(aggregate._sum.credit ?? 0) - Number(aggregate._sum.debit ?? 0);
}

/**
 * Helper: Menghitung HPP Toko berdasarkan harga beli produk ter-realisasi.
 * 
 * @param {Date} startDate Tanggal awal
 * @param {Date} endDate Tanggal akhir
 * @returns {Promise<number>}
 */
async function calculateStoreCogsForPeriod(startDate: Date, endDate: Date): Promise<number> {
  const paidOrders = await prisma.orders.findMany({
    where: {
      payment_status: "paid",
      paid_at: { gte: startDate, lte: endDate },
    },
    include: {
      order_items: {
        include: {
          products: {
            select: { purchase_price: true },
          },
        },
      },
    },
  });

  let totalCogs = 0;
  for (const order of paidOrders) {
    for (const item of order.order_items) {
      totalCogs += item.qty * Number(item.products?.purchase_price ?? 0);
    }
  }
  return totalCogs;
}

/**
 * Helper: Menghitung saldo COA Beban (Expense) pada periode tertentu.
 * 
 * @param {Date} startDate Tanggal awal
 * @param {Date} endDate Tanggal akhir
 * @returns {Promise<CoaSummaryItem[]>}
 */
async function calculateOperationalExpensesForPeriod(startDate: Date, endDate: Date): Promise<CoaSummaryItem[]> {
  const coas = await prisma.chart_of_accounts.findMany({
    where: { is_active: true, type: "expense" },
    orderBy: { code: "asc" },
  });

  const result: CoaSummaryItem[] = [];
  for (const coa of coas) {
    const aggregate = await prisma.journal_lines.aggregate({
      where: {
        account_id: coa.id,
        journal_entries: {
          is_posted: true,
          entry_date: { gte: startDate, lte: endDate },
        },
      },
      _sum: { debit: true, credit: true },
    });

    const balance = Number(aggregate._sum.debit ?? 0) - Number(aggregate._sum.credit ?? 0);
    if (balance !== 0) {
      result.push({
        id: coa.id.toString(),
        code: coa.code,
        name: coa.name,
        balance,
      });
    }
  }
  return result;
}

/**
 * Mengambil Laporan Laba Rugi (Perhitungan Hasil Usaha) Koperasi.
 * 
 * @param {number} year Tahun Laporan
 * @returns {Promise<LabaRugiReport>}
 */
export async function getLabaRugi(year: number): Promise<LabaRugiReport> {
  try {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    // 1. Pendapatan
    const storeRevenue = await calculateStoreRevenueForPeriod(startDate, endDate);
    const loanInterestRevenue = await calculateLoanInterestForPeriod(startDate, endDate);
    const loanPenaltyRevenue = await calculateLoanPenaltyForPeriod(startDate, endDate);
    const otherRevenue = await calculateJournalRevenueForPeriod(startDate, endDate);
    const totalRevenue = storeRevenue + loanInterestRevenue + loanPenaltyRevenue + otherRevenue;

    // 2. HPP
    const storeCogs = await calculateStoreCogsForPeriod(startDate, endDate);
    const totalCogs = storeCogs;

    const grossProfit = totalRevenue - totalCogs;

    // 3. Beban Operasional
    const operationalExpenses = await calculateOperationalExpensesForPeriod(startDate, endDate);
    const totalExpenses = operationalExpenses.reduce((sum, item) => sum + item.balance, 0);

    const netShu = grossProfit - totalExpenses;

    return {
      year,
      revenue: {
        storeRevenue,
        loanInterestRevenue,
        loanPenaltyRevenue,
        otherRevenue,
        totalRevenue,
      },
      cogs: {
        storeCogs,
        totalCogs,
      },
      grossProfit,
      expenses: {
        operationalExpenses,
        totalExpenses,
      },
      netShu,
    };
  } catch (error) {
    console.error("Error in getLabaRugi:", error);
    throw error;
  }
}

/**
 * Mengambil Laporan Neraca Koperasi.
 * 
 * @param {number} year Tahun Laporan Neraca (31 Desember)
 * @returns {Promise<NeracaReport>}
 */
export async function getNeraca(year: number): Promise<NeracaReport> {
  try {
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    // 1. Klasifikasi Aset (Lancar & Tetap)
    const coasAsset = await getBalancesByType("asset", endDate);
    const fixedAssets = coasAsset.filter(
      (item) => item.code.startsWith("12") || /tetap|peralatan|kendaraan|akumulasi|gedung|tanah/i.test(item.name)
    );
    const currentAssets = coasAsset.filter((item) => !fixedAssets.includes(item));

    const totalCurrentAssets = currentAssets.reduce((sum, item) => sum + item.balance, 0);
    const totalFixedAssets = fixedAssets.reduce((sum, item) => sum + item.balance, 0);
    const totalAssets = totalCurrentAssets + totalFixedAssets;

    // 2. Klasifikasi Kewajiban (Jangka Pendek & Jangka Panjang)
    const coasLiability = await getBalancesByType("liability", endDate);
    const longTermLiabilities = coasLiability.filter(
      (item) => item.code.startsWith("22") || /panjang|bank/i.test(item.name)
    );
    const currentLiabilities = coasLiability.filter((item) => !longTermLiabilities.includes(item));

    const totalCurrentLiabilities = currentLiabilities.reduce((sum, item) => sum + item.balance, 0);
    const totalLongTermLiabilities = longTermLiabilities.reduce((sum, item) => sum + item.balance, 0);
    const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;

    // 3. Klasifikasi Ekuitas (Simpanan Anggota & Cadangan)
    const coasEquity = await getBalancesByType("equity", endDate);
    const memberSavings = coasEquity.filter(
      (item) => item.code.startsWith("31") || /simpanan pokok|simpanan wajib/i.test(item.name)
    );
    const reservesAndOthers = coasEquity.filter((item) => !memberSavings.includes(item));

    const totalMemberSavings = memberSavings.reduce((sum, item) => sum + item.balance, 0);
    const totalReserves = reservesAndOthers.reduce((sum, item) => sum + item.balance, 0);

    // SHU tahun berjalan (dari perhitungan PHU)
    const labaRugi = await getLabaRugi(year);
    const currentShu = labaRugi.netShu;

    const totalEquity = totalMemberSavings + totalReserves + currentShu;
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

    const variance = Number((totalAssets - totalLiabilitiesAndEquity).toFixed(2));

    return {
      year,
      assets: {
        currentAssets,
        fixedAssets,
        totalCurrentAssets,
        totalFixedAssets,
        totalAssets,
      },
      liabilities: {
        currentLiabilities,
        longTermLiabilities,
        totalCurrentLiabilities,
        totalLongTermLiabilities,
        totalLiabilities,
      },
      equity: {
        memberSavings,
        reservesAndOthers,
        currentShu,
        totalEquity,
      },
      totalLiabilitiesAndEquity,
      variance,
    };
  } catch (error) {
    console.error("Error in getNeraca:", error);
    throw error;
  }
}
