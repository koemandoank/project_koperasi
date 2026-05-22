"use server"

import { prisma } from "@/lib/db/prisma"

// ─────────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface ArusKasOperasional {
  penerimaanKasPenjualan: number    // Penerimaan tunai dari penjualan toko (POS cash/qris/transfer)
  penerimaanKreditPenjualan: number // Penjualan kredit/potong simpanan
  penerimaanBungaPinjaman: number   // Penerimaan jasa bunga angsuran
  penerimaanDendaPinjaman: number   // Penerimaan denda keterlambatan
  pembayaranKeSupplier: number      // Pembayaran ke supplier (PO received)
  bebanOperasionalLainnya: number   // Beban operasional dari jurnal manual
  kasNetOperasional: number         // Net arus kas operasional
}

export interface ArusKasInvestasi {
  pembelianAsetTetap: number    // Pembelian aset tetap (COA kode 12xx)
  pelepasanAsetTetap: number    // Penerimaan dari pelepasan aset (jika ada)
  kasNetInvestasi: number       // Net arus kas investasi
}

export interface ArusKasPendanaan {
  penerimaanSimpananPokok: number  // Setoran simpanan pokok anggota baru
  penerimaanSimpananWajib: number  // Setoran simpanan wajib bulanan
  penerimaanSimpananSukarela: number // Setoran simpanan sukarela
  penarikanSimpanan: number        // Penarikan simpanan anggota
  pencairanPinjaman: number        // Pinjaman baru yang dicairkan
  angsuranPokokDiterima: number    // Penerimaan cicilan pokok pinjaman
  kasNetPendanaan: number          // Net arus kas pendanaan
}

export interface ArusKasReport {
  year: number
  operasional: ArusKasOperasional
  investasi: ArusKasInvestasi
  pendanaan: ArusKasPendanaan
  kasAwal: number
  kenaikanKasBersih: number
  kasAkhir: number
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Batas Tanggal Periode Tahun
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mendapatkan rentang tanggal untuk tahun buku laporan arus kas.
 *
 * @param {number} year - Tahun buku laporan
 * @returns {{ startDate: Date; endDate: Date; prevEndDate: Date }} Objek rentang tanggal
 */
function getPeriodDates(year: number): { startDate: Date; endDate: Date; prevEndDate: Date } {
  return {
    startDate: new Date(year, 0, 1, 0, 0, 0),
    endDate: new Date(year, 11, 31, 23, 59, 59),
    prevEndDate: new Date(year - 1, 11, 31, 23, 59, 59),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA ACCESS & CALCULATIONS: OPERATIONAL ACTIVITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Menghitung total nominal penjualan berdasarkan metode pembayaran tertentu.
 *
 * @param {Date} startDate - Tanggal awal periode
 * @param {Date} endDate - Tanggal akhir periode
 * @param {string[]} methods - Daftar metode pembayaran yang difilter
 * @returns {Promise<number>} Total nominal penjualan
 * @throws {Error} Jika terjadi kesalahan pada query database
 */
async function calculatePenjualan(
  startDate: Date,
  endDate: Date,
  methods: string[]
): Promise<number> {
  try {
    const agg = await prisma.orders.aggregate({
      where: {
        payment_status: "paid",
        paid_at: { gte: startDate, lte: endDate },
        payment_method: { in: methods as any },
      },
      _sum: { grand_total: true },
    });
    return Number(agg?._sum?.grand_total ?? 0);
  } catch (error) {
    console.error(`[calculatePenjualan] Error for methods ${methods.join(",")}:`, error);
    throw error;
  }
}

/**
 * Menghitung total bunga dan denda angsuran pinjaman yang diterima.
 *
 * @param {Date} startDate - Tanggal awal periode
 * @param {Date} endDate - Tanggal akhir periode
 * @returns {Promise<{ interest: number; penalty: number }>} Nominal bunga dan denda
 * @throws {Error} Jika terjadi kesalahan pada query database
 */
async function calculateBungaDenda(
  startDate: Date,
  endDate: Date
): Promise<{ interest: number; penalty: number }> {
  try {
    const agg = await prisma.loan_schedules.aggregate({
      where: {
        status: "paid",
        paid_at: { gte: startDate, lte: endDate },
      },
      _sum: { interest_paid: true, penalty_paid: true },
    });
    return {
      interest: Number(agg?._sum?.interest_paid ?? 0),
      penalty: Number(agg?._sum?.penalty_paid ?? 0),
    };
  } catch (error) {
    console.error("[calculateBungaDenda] Error:", error);
    throw error;
  }
}

/**
 * Menghitung total pembayaran ke supplier berdasarkan Purchase Order yang diterima.
 *
 * @param {Date} startDate - Tanggal awal periode
 * @param {Date} endDate - Tanggal akhir periode
 * @returns {Promise<number>} Total nominal pembayaran PO
 * @throws {Error} Jika terjadi kesalahan pada query database
 */
async function calculatePembayaranPO(startDate: Date, endDate: Date): Promise<number> {
  try {
    const agg = await prisma.purchase_orders.aggregate({
      where: {
        status: "received",
        updated_at: { gte: startDate, lte: endDate },
      },
      _sum: { total_amount: true },
    });
    return Number(agg?._sum?.total_amount ?? 0);
  } catch (error) {
    console.error("[calculatePembayaranPO] Error:", error);
    throw error;
  }
}

/**
 * Menghitung total beban operasional lainnya dari lines jurnal manual.
 *
 * @param {Date} startDate - Tanggal awal periode
 * @param {Date} endDate - Tanggal akhir periode
 * @returns {Promise<number>} Nominal beban operasional
 * @throws {Error} Jika terjadi kesalahan pada query database
 */
async function calculateBebanOperasional(startDate: Date, endDate: Date): Promise<number> {
  try {
    const agg = await prisma.journal_lines.aggregate({
      where: {
        journal_entries: {
          is_posted: true,
          entry_date: { gte: startDate, lte: endDate },
        },
        chart_of_accounts: { type: "expense" },
      },
      _sum: { debit: true, credit: true },
    });
    return Number(agg?._sum?.debit ?? 0) - Number(agg?._sum?.credit ?? 0);
  } catch (error) {
    console.error("[calculateBebanOperasional] Error:", error);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA ACCESS & CALCULATIONS: INVESTASI ACTIVITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Menghitung mutasi debit dan kredit untuk sekumpulan akun COA.
 *
 * @param {bigint[]} accountIds - Daftar ID akun COA
 * @param {Date} startDate - Tanggal awal periode
 * @param {Date} endDate - Tanggal akhir periode
 * @returns {Promise<{ debit: number; credit: number }>} Total debit dan kredit
 * @throws {Error} Jika terjadi kesalahan pada query database
 */
async function calculateCoaMutasi(
  accountIds: bigint[],
  startDate: Date,
  endDate: Date
): Promise<{ debit: number; credit: number }> {
  try {
    if (accountIds.length === 0) return { debit: 0, credit: 0 };
    const agg = await prisma.journal_lines.aggregate({
      where: {
        account_id: { in: accountIds },
        journal_entries: { is_posted: true, entry_date: { gte: startDate, lte: endDate } },
      },
      _sum: { debit: true, credit: true },
    });
    return {
      debit: Number(agg?._sum?.debit ?? 0),
      credit: Number(agg?._sum?.credit ?? 0),
    };
  } catch (error) {
    console.error("[calculateCoaMutasi] Error:", error);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA ACCESS & CALCULATIONS: FUNDING (PENDANAAN) ACTIVITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mencari tipe simpanan Pokok berdasarkan pola.
 *
 * @returns {Promise<bigint | null>} ID tipe simpanan Pokok atau null
 * @throws {Error} Jika terjadi kesalahan pada query database
 */
async function findPokokId(): Promise<bigint | null> {
  try {
    const match = await prisma.saving_types.findFirst({
      where: { OR: [{ code: "SP" }, { code: { contains: "POKOK" } }, { name: { contains: "Pokok" } }] },
      select: { id: true },
    });
    return match?.id ?? null;
  } catch (error) {
    console.error("[findPokokId] Error:", error);
    throw error;
  }
}

/**
 * Mencari tipe simpanan Wajib berdasarkan pola.
 *
 * @returns {Promise<bigint | null>} ID tipe simpanan Wajib atau null
 * @throws {Error} Jika terjadi kesalahan pada query database
 */
async function findWajibId(): Promise<bigint | null> {
  try {
    const match = await prisma.saving_types.findFirst({
      where: { OR: [{ code: "SW" }, { code: { contains: "WAJIB" } }, { name: { contains: "Wajib" } }] },
      select: { id: true },
    });
    return match?.id ?? null;
  } catch (error) {
    console.error("[findWajibId] Error:", error);
    throw error;
  }
}

/**
 * Menghitung penerimaan dari simpanan tertentu (deposit).
 *
 * @param {bigint | null} typeId - ID tipe simpanan (optional)
 * @param {bigint[] | null} excludeIds - ID tipe simpanan yang dikecualikan (optional)
 * @param {Date} startDate - Tanggal awal periode
 * @param {Date} endDate - Tanggal akhir periode
 * @returns {Promise<number>} Nominal simpanan masuk
 * @throws {Error} Jika terjadi kesalahan pada query database
 */
async function calculateSimpananMasuk(
  typeId: bigint | null,
  excludeIds: bigint[] | null,
  startDate: Date,
  endDate: Date
): Promise<number> {
  try {
    const whereClause: any = {
      type: "deposit",
      transaction_at: { gte: startDate, lte: endDate },
    };
    if (typeId) {
      whereClause.savings = { saving_type_id: typeId };
    } else if (excludeIds && excludeIds.length > 0) {
      whereClause.savings = { saving_type_id: { notIn: excludeIds } };
    }
    const agg = await prisma.saving_transactions.aggregate({
      where: whereClause,
      _sum: { amount: true },
    });
    return Number(agg?._sum?.amount ?? 0);
  } catch (error) {
    console.error("[calculateSimpananMasuk] Error:", error);
    throw error;
  }
}

/**
 * Menghitung total penarikan simpanan (withdraw) dalam periode tertentu.
 *
 * @param {Date} startDate - Tanggal awal periode
 * @param {Date} endDate - Tanggal akhir periode
 * @returns {Promise<number>} Nominal penarikan simpanan
 * @throws {Error} Jika terjadi kesalahan pada query database
 */
async function calculateSimpananKeluar(startDate: Date, endDate: Date): Promise<number> {
  try {
    const agg = await prisma.saving_transactions.aggregate({
      where: { type: "withdraw", transaction_at: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
    });
    return Number(agg?._sum?.amount ?? 0);
  } catch (error) {
    console.error("[calculateSimpananKeluar] Error:", error);
    throw error;
  }
}

/**
 * Menghitung total pencairan pinjaman baru dalam periode tertentu.
 *
 * @param {Date} startDate - Tanggal awal periode
 * @param {Date} endDate - Tanggal akhir periode
 * @returns {Promise<number>} Nominal pencairan pinjaman
 * @throws {Error} Jika terjadi kesalahan pada query database
 */
async function calculatePencairanPinjaman(startDate: Date, endDate: Date): Promise<number> {
  try {
    const agg = await prisma.loans.aggregate({
      where: { disbursed_at: { gte: startDate, lte: endDate } },
      _sum: { principal: true },
    });
    return Number(agg?._sum?.principal ?? 0);
  } catch (error) {
    console.error("[calculatePencairanPinjaman] Error:", error);
    throw error;
  }
}

/**
 * Menghitung total penerimaan angsuran pokok pinjaman.
 *
 * @param {Date} startDate - Tanggal awal periode
 * @param {Date} endDate - Tanggal akhir periode
 * @returns {Promise<number>} Nominal angsuran pokok diterima
 * @throws {Error} Jika terjadi kesalahan pada query database
 */
async function calculateAngsuranPokok(startDate: Date, endDate: Date): Promise<number> {
  try {
    const agg = await prisma.loan_schedules.aggregate({
      where: { status: "paid", paid_at: { gte: startDate, lte: endDate } },
      _sum: { principal_paid: true },
    });
    return Number(agg?._sum?.principal_paid ?? 0);
  } catch (error) {
    console.error("[calculateAngsuranPokok] Error:", error);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-SERVICES (MAX 30 LINES & ERROR TOLERANT)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Menghitung total saldo akun kas dan bank pada akhir periode sebelumnya.
 *
 * @param {Date} prevEndDate - Tanggal akhir periode sebelumnya
 * @returns {Promise<number>} Saldo kas awal
 */
async function getKasAwal(prevEndDate: Date): Promise<number> {
  try {
    const kasAccounts = await prisma.chart_of_accounts.findMany({
      where: {
        is_active: true,
        type: "asset",
        OR: [{ code: { startsWith: "10" } }, { name: { contains: "kas" } }, { name: { contains: "bank" } }],
      },
      select: { id: true },
    });
    const ids = kasAccounts.map((acc) => acc.id);
    if (ids.length === 0) return 0;

    const agg = await prisma.journal_lines.aggregate({
      where: {
        account_id: { in: ids },
        journal_entries: { is_posted: true, entry_date: { lte: prevEndDate } },
      },
      _sum: { debit: true, credit: true },
    });
    return Number(agg?._sum?.debit ?? 0) - Number(agg?._sum?.credit ?? 0);
  } catch (error) {
    console.error("[getKasAwal] Failed, returning 0:", error);
    return 0;
  }
}

/**
 * Menghitung komponen arus kas dari aktivitas operasional koperasi.
 *
 * @param {Date} startDate - Tanggal awal periode
 * @param {Date} endDate - Tanggal akhir periode
 * @returns {Promise<ArusKasOperasional>} Rincian arus kas operasional
 */
async function getOperasional(startDate: Date, endDate: Date): Promise<ArusKasOperasional> {
  try {
    const [tunai, kredit, bungaDenda, po, beban] = await Promise.all([
      calculatePenjualan(startDate, endDate, ["cash", "qris", "transfer"]),
      calculatePenjualan(startDate, endDate, ["saving_deduct", "paylater"]),
      calculateBungaDenda(startDate, endDate),
      calculatePembayaranPO(startDate, endDate),
      calculateBebanOperasional(startDate, endDate),
    ]);

    const kasNet = tunai + kredit + bungaDenda.interest + bungaDenda.penalty - po - beban;

    return {
      penerimaanKasPenjualan: tunai,
      penerimaanKreditPenjualan: kredit,
      penerimaanBungaPinjaman: bungaDenda.interest,
      penerimaanDendaPinjaman: bungaDenda.penalty,
      pembayaranKeSupplier: po,
      bebanOperasionalLainnya: beban,
      kasNetOperasional: kasNet,
    };
  } catch (error) {
    console.error("[getOperasional] Failed, returning empty defaults:", error);
    return {
      penerimaanKasPenjualan: 0,
      penerimaanKreditPenjualan: 0,
      penerimaanBungaPinjaman: 0,
      penerimaanDendaPinjaman: 0,
      pembayaranKeSupplier: 0,
      bebanOperasionalLainnya: 0,
      kasNetOperasional: 0,
    };
  }
}

/**
 * Menghitung komponen arus kas dari aktivitas investasi koperasi
 * berdasarkan pergerakan akun COA aset tetap (kode 12xx).
 *
 * @param {Date} startDate - Tanggal awal periode
 * @param {Date} endDate - Tanggal akhir periode
 * @returns {Promise<ArusKasInvestasi>} Rincian arus kas investasi
 */
async function getInvestasi(startDate: Date, endDate: Date): Promise<ArusKasInvestasi> {
  try {
    const asetTetapAccounts = await prisma.chart_of_accounts.findMany({
      where: { is_active: true, type: "asset", code: { startsWith: "12" } },
      select: { id: true },
    });
    const ids = asetTetapAccounts.map((a) => a.id);
    const mutasi = await calculateCoaMutasi(ids, startDate, endDate);
    
    return {
      pembelianAsetTetap: mutasi.debit,
      pelepasanAsetTetap: mutasi.credit,
      kasNetInvestasi: mutasi.credit - mutasi.debit,
    };
  } catch (error) {
    console.error("[getInvestasi] Failed, returning empty defaults:", error);
    return { pembelianAsetTetap: 0, pelepasanAsetTetap: 0, kasNetInvestasi: 0 };
  }
}

/**
 * Menghitung komponen arus kas dari aktivitas pendanaan koperasi.
 *
 * @param {Date} startDate - Tanggal awal periode
 * @param {Date} endDate - Tanggal akhir periode
 * @returns {Promise<ArusKasPendanaan>} Rincian arus kas pendanaan
 */
async function getPendanaan(startDate: Date, endDate: Date): Promise<ArusKasPendanaan> {
  try {
    const [pokokId, wajibId] = await Promise.all([findPokokId(), findWajibId()]);
    const excludes = [pokokId, wajibId].filter((id): id is bigint => id !== null);

    const [pokok, wajib, sukarela, keluar, pencairan, angsuran] = await Promise.all([
      pokokId ? calculateSimpananMasuk(pokokId, null, startDate, endDate) : Promise.resolve(0),
      wajibId ? calculateSimpananMasuk(wajibId, null, startDate, endDate) : Promise.resolve(0),
      calculateSimpananMasuk(null, excludes, startDate, endDate),
      calculateSimpananKeluar(startDate, endDate),
      calculatePencairanPinjaman(startDate, endDate),
      calculateAngsuranPokok(startDate, endDate),
    ]);

    return {
      penerimaanSimpananPokok: pokok,
      penerimaanSimpananWajib: wajib,
      penerimaanSimpananSukarela: sukarela,
      penarikanSimpanan: keluar,
      pencairanPinjaman: pencairan,
      angsuranPokokDiterima: angsuran,
      kasNetPendanaan: pokok + wajib + sukarela - keluar + angsuran - pencairan,
    };
  } catch (error) {
    console.error("[getPendanaan] Failed, returning empty defaults:", error);
    return {
      penerimaanSimpananPokok: 0,
      penerimaanSimpananWajib: 0,
      penerimaanSimpananSukarela: 0,
      penarikanSimpanan: 0,
      pencairanPinjaman: 0,
      angsuranPokokDiterima: 0,
      kasNetPendanaan: 0,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ACTION & EMPTY TEMPLATE HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Membuat data default kosong untuk Laporan Arus Kas.
 *
 * @param {number} year - Tahun buku laporan arus kas
 * @returns {ArusKasReport} Laporan arus kas kosong
 */
function createEmptyReport(year: number): ArusKasReport {
  return {
    year,
    operasional: {
      penerimaanKasPenjualan: 0,
      penerimaanKreditPenjualan: 0,
      penerimaanBungaPinjaman: 0,
      penerimaanDendaPinjaman: 0,
      pembayaranKeSupplier: 0,
      bebanOperasionalLainnya: 0,
      kasNetOperasional: 0,
    },
    investasi: { pembelianAsetTetap: 0, pelepasanAsetTetap: 0, kasNetInvestasi: 0 },
    pendanaan: {
      penerimaanSimpananPokok: 0,
      penerimaanSimpananWajib: 0,
      penerimaanSimpananSukarela: 0,
      penarikanSimpanan: 0,
      pencairanPinjaman: 0,
      angsuranPokokDiterima: 0,
      kasNetPendanaan: 0,
    },
    kasAwal: 0,
    kenaikanKasBersih: 0,
    kasAkhir: 0,
  };
}

/**
 * Mengambil Laporan Arus Kas Koperasi untuk satu tahun buku.
 * Menyusun tiga aktivitas: Operasional, Investasi, dan Pendanaan.
 *
 * @param {number} year - Tahun buku laporan arus kas
 * @returns {Promise<ArusKasReport>} Laporan arus kas lengkap
 */
export async function getArusKas(year: number): Promise<ArusKasReport> {
  try {
    const { startDate, endDate, prevEndDate } = getPeriodDates(year);
    const [operasional, investasi, pendanaan, kasAwal] = await Promise.all([
      getOperasional(startDate, endDate),
      getInvestasi(startDate, endDate),
      getPendanaan(startDate, endDate),
      getKasAwal(prevEndDate),
    ]);
    const kenaikanKasBersih = operasional.kasNetOperasional + investasi.kasNetInvestasi + pendanaan.kasNetPendanaan;
    return {
      year,
      operasional,
      investasi,
      pendanaan,
      kasAwal,
      kenaikanKasBersih,
      kasAkhir: kasAwal + kenaikanKasBersih,
    };
  } catch (error) {
    console.error("[getArusKas] Failed, returning defaults:", error);
    return createEmptyReport(year);
  }
}
