/**
 * Tipe data untuk struktur pos Chart of Accounts (COA) di Laporan Keuangan.
 */
export interface CoaSummaryItem {
  id: string;
  code: string;
  name: string;
  balance: number;
}

/**
 * Tipe data untuk Laporan Neraca (Balance Sheet).
 * Neraca harus memenuhi persamaan dasar akuntansi: Aset = Kewajiban + Ekuitas.
 */
export interface NeracaReport {
  year: number;
  assets: {
    currentAssets: CoaSummaryItem[];
    fixedAssets: CoaSummaryItem[];
    totalCurrentAssets: number;
    totalFixedAssets: number;
    totalAssets: number;
  };
  liabilities: {
    currentLiabilities: CoaSummaryItem[];
    longTermLiabilities: CoaSummaryItem[];
    totalCurrentLiabilities: number;
    totalLongTermLiabilities: number;
    totalLiabilities: number;
  };
  equity: {
    memberSavings: CoaSummaryItem[];
    reservesAndOthers: CoaSummaryItem[];
    currentShu: number; // SHU tahun berjalan yang belum didistribusikan
    totalEquity: number;
  };
  totalLiabilitiesAndEquity: number;
  variance: number; // Selisih balance (harus 0.00)
}

/**
 * Tipe data untuk Laporan Laba Rugi (Perhitungan Hasil Usaha - PHU).
 */
export interface LabaRugiReport {
  year: number;
  revenue: {
    storeRevenue: number;         // Pendapatan/omzet Toko (POS)
    loanInterestRevenue: number;  // Pendapatan bunga pinjaman
    loanPenaltyRevenue: number;   // Pendapatan denda pinjaman
    otherRevenue: number;         // Pendapatan jurnal umum
    totalRevenue: number;
  };
  cogs: {
    storeCogs: number;            // HPP Toko
    totalCogs: number;
  };
  grossProfit: number;            // Laba kotor (Total Revenue - COGS)
  expenses: {
    operationalExpenses: CoaSummaryItem[];
    totalExpenses: number;
  };
  netShu: number;                 // SHU Bersih (Gross Profit - Total Expenses)
}
