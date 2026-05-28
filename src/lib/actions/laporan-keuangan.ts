"use server"

import { prisma } from "@/lib/db/prisma"
import { NeracaReport, LabaRugiReport, CoaSummaryItem } from "@/lib/types/laporan-keuangan.types"

/**
 * Helper: Menghitung saldo satu akun COA.
 * 
 * @param {bigint} coaId ID Akun COA
 * @param {string} normalBalance Jenis saldo normal ("debit" | "credit")
 * @param {Date} endDate Batas tanggal penutupan
 * @returns {Promise<number>} Saldo terhitung
 */
async function getCoaBalance(coaId: bigint, normalBalance: string, endDate: Date): Promise<number> {
  try {
    const journalLinesSum = await prisma.journal_lines.aggregate({
      where: {
        account_id: coaId,
        journal_entries: { is_posted: true, entry_date: { lte: endDate } },
      },
      _sum: { debit: true, credit: true },
    });

    const debit = Number(journalLinesSum._sum.debit ?? 0);
    const credit = Number(journalLinesSum._sum.credit ?? 0);
    return normalBalance === "debit" ? debit - credit : credit - debit;
  } catch (error) {
    console.error(`Error in getCoaBalance for COA ${coaId}:`, error);
    throw error;
  }
}

/**
 * Mengambil saldo COA berdasarkan tipe akun.
 * 
 * @param {string} type Tipe akun ('asset', 'liability', 'equity', 'revenue', 'expense')
 * @param {Date} endDate Batas tanggal penutupan
 * @returns {Promise<CoaSummaryItem[]>} Daftar saldo akun COA
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
      const balance = await getCoaBalance(coa.id, coa.normal_balance, endDate);
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
 * @returns {Promise<number>} Total omzet
 */
async function calculateStoreRevenueForPeriod(startDate: Date, endDate: Date): Promise<number> {
  try {
    const aggregate = await prisma.orders.aggregate({
      where: {
        payment_status: "paid",
        paid_at: { gte: startDate, lte: endDate },
      },
      _sum: { grand_total: true },
    });
    return Number(aggregate._sum.grand_total ?? 0);
  } catch (error) {
    console.error("Error in calculateStoreRevenueForPeriod:", error);
    throw error;
  }
}

/**
 * Helper: Menghitung total denda pinjaman periode tertentu.
 * 
 * @param {Date} startDate Tanggal awal
 * @param {Date} endDate Tanggal akhir
 * @returns {Promise<number>} Total denda
 * @throws {Error} Mengembalikan error jika terjadi kesalahan query database
 */
async function calculateLoanPenaltyForPeriod(startDate: Date, endDate: Date): Promise<number> {
  try {
    const aggregate = await prisma.loan_schedules.aggregate({
      where: {
        status: "paid",
        paid_at: { gte: startDate, lte: endDate },
      },
      _sum: { penalty_paid: true },
    });
    return Number(aggregate._sum.penalty_paid ?? 0);
  } catch (error) {
    console.error("Error in calculateLoanPenaltyForPeriod:", error);
    throw error;
  }
}

/**
 * Helper: Menghitung total bunga pinjaman periode tertentu.
 * 
 * @param {Date} startDate Tanggal awal
 * @param {Date} endDate Tanggal akhir
 * @returns {Promise<number>} Total bunga
 * @throws {Error} Mengembalikan error jika terjadi kesalahan query database
 */
async function calculateLoanInterestForPeriod(startDate: Date, endDate: Date): Promise<number> {
  try {
    const aggregate = await prisma.loan_schedules.aggregate({
      where: {
        status: "paid",
        paid_at: { gte: startDate, lte: endDate },
      },
      _sum: { interest_paid: true },
    });
    return Number(aggregate._sum.interest_paid ?? 0);
  } catch (error) {
    console.error("Error in calculateLoanInterestForPeriod:", error);
    throw error;
  }
}

/**
 * Helper: Menghitung total pendapatan COA tipe 'revenue' pada periode tertentu.
 * 
 * @param {Date} startDate Tanggal awal
 * @param {Date} endDate Tanggal akhir
 * @returns {Promise<number>} Total pendapatan jurnal umum
 */
async function calculateJournalRevenueForPeriod(startDate: Date, endDate: Date): Promise<number> {
  try {
    const aggregate = await prisma.journal_lines.aggregate({
      where: {
        journal_entries: {
          is_posted: true,
          entry_date: { gte: startDate, lte: endDate },
        },
        chart_of_accounts: { 
          type: "revenue",
          code: {
            notIn: ["40101", "40102", "40104"]
          }
        },
      },
      _sum: { debit: true, credit: true },
    });
    return Number(aggregate._sum.credit ?? 0) - Number(aggregate._sum.debit ?? 0);
  } catch (error) {
    console.error("Error in calculateJournalRevenueForPeriod:", error);
    throw error;
  }
}

/**
 * Helper: Menghitung HPP Toko berdasarkan harga beli produk ter-realisasi.
 * 
 * @param {Date} startDate Tanggal awal
 * @param {Date} endDate Tanggal akhir
 * @returns {Promise<number>} Total HPP toko
 */
async function calculateStoreCogsForPeriod(startDate: Date, endDate: Date): Promise<number> {
  try {
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
    });

    let totalCogs = 0;
    for (const order of paidOrders) {
      for (const item of order.order_items) {
        totalCogs += item.qty * Number(item.purchase_price ?? 0);
      }
    }
    return totalCogs;
  } catch (error) {
    console.error("Error in calculateStoreCogsForPeriod:", error);
    throw error;
  }
}

/**
 * Helper: Menghitung saldo COA Beban (Expense) pada periode tertentu.
 * 
 * @param {Date} startDate Tanggal awal
 * @param {Date} endDate Tanggal akhir
 * @returns {Promise<CoaSummaryItem[]>} Daftar beban operasional
 */
async function calculateOperationalExpensesForPeriod(startDate: Date, endDate: Date): Promise<CoaSummaryItem[]> {
  try {
    const coas = await prisma.chart_of_accounts.findMany({
      where: { is_active: true, type: "expense" },
      orderBy: { code: "asc" },
    });

    const result: CoaSummaryItem[] = [];
    for (const coa of coas) {
      const aggregate = await prisma.journal_lines.aggregate({
        where: {
          account_id: coa.id,
          journal_entries: { is_posted: true, entry_date: { gte: startDate, lte: endDate } },
        },
        _sum: { debit: true, credit: true },
      });

      const balance = Number(aggregate._sum.debit ?? 0) - Number(aggregate._sum.credit ?? 0);
      if (balance !== 0) {
        result.push({ id: coa.id.toString(), code: coa.code, name: coa.name, balance });
      }
    }
    return result;
  } catch (error) {
    console.error("Error in calculateOperationalExpensesForPeriod:", error);
    throw error;
  }
}

/**
 * Mengambil Laporan Laba Rugi (Perhitungan Hasil Usaha) Koperasi.
 * 
 * @param {number} year Tahun Laporan
 * @returns {Promise<LabaRugiReport>} Laporan laba rugi terhitung
 */
export async function getLabaRugi(year: number): Promise<LabaRugiReport> {
  try {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const storeRevenue = await calculateStoreRevenueForPeriod(startDate, endDate);
    const loanInterestRevenue = await calculateLoanInterestForPeriod(startDate, endDate);
    const loanPenaltyRevenue = await calculateLoanPenaltyForPeriod(startDate, endDate);
    const otherRevenue = await calculateJournalRevenueForPeriod(startDate, endDate);
    const totalRevenue = storeRevenue + loanInterestRevenue + loanPenaltyRevenue + otherRevenue;

    const storeCogs = await calculateStoreCogsForPeriod(startDate, endDate);
    const grossProfit = totalRevenue - storeCogs;

    const operationalExpenses = await calculateOperationalExpensesForPeriod(startDate, endDate);
    const totalExpenses = operationalExpenses.reduce((sum: any, item: any) => sum + item.balance, 0);
    const netShu = grossProfit - totalExpenses;

    return {
      year,
      revenue: { storeRevenue, loanInterestRevenue, loanPenaltyRevenue, otherRevenue, totalRevenue },
      cogs: { storeCogs, totalCogs: storeCogs },
      grossProfit,
      expenses: { operationalExpenses, totalExpenses },
      netShu,
    };
  } catch (error) {
    console.error("Error in getLabaRugi:", error);
    throw error;
  }
}

/**
 * Helper: Mengelompokkan dan menjumlahkan data Aset.
 * 
 * @param {CoaSummaryItem[]} coasAsset Daftar saldo akun aset
 */
function extractAssets(coasAsset: CoaSummaryItem[]) {
  const fixedAssets = coasAsset.filter(
        (item: any) => item.code.startsWith("12") || /tetap|peralatan|kendaraan|akumulasi|gedung|tanah/i.test(item.name)
  );
  const currentAssets = coasAsset.filter((item: any) => !fixedAssets.includes(item));
  const totalCurrentAssets = currentAssets.reduce((sum: any, item: any) => sum + item.balance, 0);
  const totalFixedAssets = fixedAssets.reduce((sum: any, item: any) => sum + item.balance, 0);
  return {
    currentAssets,
    fixedAssets,
    totalCurrentAssets,
    totalFixedAssets,
    totalAssets: totalCurrentAssets + totalFixedAssets,
  };
}

/**
 * Helper: Mengelompokkan dan menjumlahkan data Kewajiban.
 * 
 * @param {CoaSummaryItem[]} coasLiability Daftar saldo akun kewajiban
 */
function extractLiabilities(coasLiability: CoaSummaryItem[]) {
  const longTermLiabilities = coasLiability.filter(
        (item: any) => item.code.startsWith("22") || /panjang|bank/i.test(item.name)
  );
  const currentLiabilities = coasLiability.filter((item: any) => !longTermLiabilities.includes(item));
  const totalCurrentLiabilities = currentLiabilities.reduce((sum: any, item: any) => sum + item.balance, 0);
  const totalLongTermLiabilities = longTermLiabilities.reduce((sum: any, item: any) => sum + item.balance, 0);
  return {
    currentLiabilities,
    longTermLiabilities,
    totalCurrentLiabilities,
    totalLongTermLiabilities,
    totalLiabilities: totalCurrentLiabilities + totalLongTermLiabilities,
  };
}

/**
 * Helper: Mengelompokkan dan menjumlahkan data Ekuitas.
 * 
 * @param {CoaSummaryItem[]} coasEquity Daftar saldo akun ekuitas
 * @param {number} currentShu SHU berjalan tahun buku
 */
function extractEquity(coasEquity: CoaSummaryItem[], currentShu: number) {
  const memberSavings = coasEquity.filter(
        (item: any) => item.code.startsWith("31") || /simpanan pokok|simpanan wajib/i.test(item.name)
  );
  const reservesAndOthers = coasEquity.filter((item: any) => !memberSavings.includes(item));
  const totalMemberSavings = memberSavings.reduce((sum: any, item: any) => sum + item.balance, 0);
  const totalReserves = reservesAndOthers.reduce((sum: any, item: any) => sum + item.balance, 0);
  return {
    memberSavings,
    reservesAndOthers,
    currentShu,
    totalEquity: totalMemberSavings + totalReserves + currentShu,
  };
}

/**
 * Mengambil Laporan Neraca Koperasi.
 * 
 * @param {number} year Tahun Laporan Neraca (31 Desember)
 * @returns {Promise<NeracaReport>} Laporan neraca terhitung
 */
export async function getNeraca(year: number): Promise<NeracaReport> {
  try {
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const assets = extractAssets(await getBalancesByType("asset", endDate));
    const liabilities = extractLiabilities(await getBalancesByType("liability", endDate));

    const labaRugi = await getLabaRugi(year);
    const equity = extractEquity(await getBalancesByType("equity", endDate), labaRugi.netShu);

    const totalLiabilitiesAndEquity = liabilities.totalLiabilities + equity.totalEquity;
    const variance = Number((assets.totalAssets - totalLiabilitiesAndEquity).toFixed(2));

    return {
      year,
      assets,
      liabilities,
      equity,
      totalLiabilitiesAndEquity,
      variance,
    };
  } catch (error) {
    console.error("Error in getNeraca:", error);
    throw error;
  }
}
