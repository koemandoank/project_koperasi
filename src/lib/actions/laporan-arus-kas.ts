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

function getPeriodDates(year: number): { startDate: Date; endDate: Date; prevEndDate: Date } {
  return {
    startDate: new Date(year, 0, 1, 0, 0, 0),
    endDate: new Date(year, 11, 31, 23, 59, 59),
    prevEndDate: new Date(year - 1, 11, 31, 23, 59, 59),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Menghitung Saldo Kas Awal (dari COA kas & bank periode sebelumnya)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Menghitung total saldo akun kas dan bank pada akhir periode sebelumnya
 * sebagai kas awal periode saat ini.
 *
 * @param {Date} prevEndDate - Tanggal akhir periode sebelumnya (31 Des tahun lalu)
 * @returns {Promise<number>} Saldo kas awal
 */
async function getKasAwal(prevEndDate: Date): Promise<number> {
  try {
    // Ambil semua akun COA tipe asset dengan kode 10xxx (kas & bank)
    const kasAccounts = await prisma.chart_of_accounts.findMany({
      where: {
        is_active: true,
        type: "asset",
        OR: [
          { code: { startsWith: "10" } },
          { name: { contains: "kas" } },
          { name: { contains: "bank" } },
        ],
      },
    })

    let totalKas = 0
    for (const acc of kasAccounts) {
      const agg = await prisma.journal_lines.aggregate({
        where: {
          account_id: acc.id,
          journal_entries: { is_posted: true, entry_date: { lte: prevEndDate } },
        },
        _sum: { debit: true, credit: true },
      })
      const balance = Number(agg._sum.debit ?? 0) - Number(agg._sum.credit ?? 0)
      totalKas += balance
    }
    return totalKas
  } catch (error) {
    console.error("Error in getKasAwal:", error)
    return 0
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AKTIVITAS OPERASIONAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Menghitung komponen arus kas dari aktivitas operasional koperasi.
 *
 * @param {Date} startDate - Tanggal awal periode
 * @param {Date} endDate - Tanggal akhir periode
 * @returns {Promise<ArusKasOperasional>} Rincian arus kas operasional
 */
async function getOperasional(startDate: Date, endDate: Date): Promise<ArusKasOperasional> {
  try {
    // 1. Penerimaan dari penjualan tunai (POS: cash, qris, transfer)
    const penjualanTunai = await prisma.orders.aggregate({
      where: {
        payment_status: "paid",
        paid_at: { gte: startDate, lte: endDate },
        payment_method: { in: ["cash", "qris", "transfer"] },
      },
      _sum: { grand_total: true },
    })
    const penerimaanKasPenjualan = Number(penjualanTunai._sum.grand_total ?? 0)

    // 2. Penerimaan dari penjualan kredit/potong simpanan
    const penjualanKredit = await prisma.orders.aggregate({
      where: {
        payment_status: "paid",
        paid_at: { gte: startDate, lte: endDate },
        payment_method: { in: ["saving_deduct", "paylater"] },
      },
      _sum: { grand_total: true },
    })
    const penerimaanKreditPenjualan = Number(penjualanKredit._sum.grand_total ?? 0)

    // 3. Penerimaan jasa bunga angsuran pinjaman
    const bungaDiterima = await prisma.loan_schedules.aggregate({
      where: {
        status: "paid",
        paid_at: { gte: startDate, lte: endDate },
      },
      _sum: { interest_paid: true },
    })
    const penerimaanBungaPinjaman = Number(bungaDiterima._sum.interest_paid ?? 0)

    // 4. Penerimaan denda keterlambatan
    const dendaDiterima = await prisma.loan_schedules.aggregate({
      where: {
        status: "paid",
        paid_at: { gte: startDate, lte: endDate },
        penalty_paid: { gt: 0 },
      },
      _sum: { penalty_paid: true },
    })
    const penerimaanDendaPinjaman = Number(dendaDiterima._sum.penalty_paid ?? 0)

    // 5. Pembayaran ke supplier (Purchase Order yang diterima pada periode ini)
    const pembayaranPO = await prisma.purchase_orders.aggregate({
      where: {
        status: "received",
        updated_at: { gte: startDate, lte: endDate },
      },
      _sum: { total_amount: true },
    })
    const pembayaranKeSupplier = Number(pembayaranPO._sum.total_amount ?? 0)

    // 6. Beban operasional dari jurnal manual (COA tipe expense)
    const bebanOperasional = await prisma.journal_lines.aggregate({
      where: {
        journal_entries: {
          is_posted: true,
          entry_date: { gte: startDate, lte: endDate },
        },
        chart_of_accounts: { type: "expense" },
      },
      _sum: { debit: true, credit: true },
    })
    const bebanOperasionalLainnya = Number(bebanOperasional._sum.debit ?? 0) - Number(bebanOperasional._sum.credit ?? 0)

    const kasNetOperasional =
      penerimaanKasPenjualan +
      penerimaanKreditPenjualan +
      penerimaanBungaPinjaman +
      penerimaanDendaPinjaman -
      pembayaranKeSupplier -
      bebanOperasionalLainnya

    return {
      penerimaanKasPenjualan,
      penerimaanKreditPenjualan,
      penerimaanBungaPinjaman,
      penerimaanDendaPinjaman,
      pembayaranKeSupplier,
      bebanOperasionalLainnya,
      kasNetOperasional,
    }
  } catch (error) {
    console.error("Error in getOperasional:", error)
    throw error
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AKTIVITAS INVESTASI
// ─────────────────────────────────────────────────────────────────────────────

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
    // Pembelian aset tetap = debit pada COA kode 12xx dalam periode ini
    const asetTetapAccounts = await prisma.chart_of_accounts.findMany({
      where: {
        is_active: true,
        type: "asset",
        code: { startsWith: "12" },
      },
    })

    let pembelianAsetTetap = 0
    let pelepasanAsetTetap = 0

    for (const acc of asetTetapAccounts) {
      const agg = await prisma.journal_lines.aggregate({
        where: {
          account_id: acc.id,
          journal_entries: { is_posted: true, entry_date: { gte: startDate, lte: endDate } },
        },
        _sum: { debit: true, credit: true },
      })
      pembelianAsetTetap += Number(agg._sum.debit ?? 0)
      pelepasanAsetTetap += Number(agg._sum.credit ?? 0)
    }

    const kasNetInvestasi = pelepasanAsetTetap - pembelianAsetTetap

    return {
      pembelianAsetTetap,
      pelepasanAsetTetap,
      kasNetInvestasi,
    }
  } catch (error) {
    console.error("Error in getInvestasi:", error)
    throw error
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AKTIVITAS PENDANAAN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Menghitung komponen arus kas dari aktivitas pendanaan koperasi,
 * mencakup mutasi simpanan anggota dan pinjaman.
 *
 * @param {Date} startDate - Tanggal awal periode
 * @param {Date} endDate - Tanggal akhir periode
 * @returns {Promise<ArusKasPendanaan>} Rincian arus kas pendanaan
 */
async function getPendanaan(startDate: Date, endDate: Date): Promise<ArusKasPendanaan> {
  try {
    // Ambil tipe simpanan POKOK dan WAJIB
    const [typePOKOK, typeWAJIB] = await Promise.all([
      prisma.saving_types.findFirst({ where: { code: { contains: "POKOK" } } }),
      prisma.saving_types.findFirst({ where: { code: { contains: "WAJIB" } } }),
    ])

    // Penerimaan simpanan pokok
    let penerimaanSimpananPokok = 0
    if (typePOKOK) {
      const agg = await prisma.saving_transactions.aggregate({
        where: {
          type: "deposit",
          transaction_at: { gte: startDate, lte: endDate },
          savings: { saving_type_id: typePOKOK.id },
        },
        _sum: { amount: true },
      })
      penerimaanSimpananPokok = Number(agg._sum.amount ?? 0)
    }

    // Penerimaan simpanan wajib
    let penerimaanSimpananWajib = 0
    if (typeWAJIB) {
      const agg = await prisma.saving_transactions.aggregate({
        where: {
          type: "deposit",
          transaction_at: { gte: startDate, lte: endDate },
          savings: { saving_type_id: typeWAJIB.id },
        },
        _sum: { amount: true },
      })
      penerimaanSimpananWajib = Number(agg._sum.amount ?? 0)
    }

    // Penerimaan simpanan sukarela
    const typePokokId = typePOKOK?.id
    const typeWajibId = typeWAJIB?.id
    const aggSukarela = await prisma.saving_transactions.aggregate({
      where: {
        type: "deposit",
        transaction_at: { gte: startDate, lte: endDate },
        ...(typePokokId && typeWajibId
          ? { savings: { saving_type_id: { notIn: [typePokokId, typeWajibId] } } }
          : {}),
      },
      _sum: { amount: true },
    })
    const penerimaanSimpananSukarela = Number(aggSukarela._sum.amount ?? 0)

    // Penarikan simpanan
    const aggWithdraw = await prisma.saving_transactions.aggregate({
      where: {
        type: "withdraw",
        transaction_at: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
    })
    const penarikanSimpanan = Number(aggWithdraw._sum.amount ?? 0)

    // Pencairan pinjaman baru
    const aggPencairan = await prisma.loans.aggregate({
      where: {
        disbursed_at: { gte: startDate, lte: endDate },
      },
      _sum: { principal: true },
    })
    const pencairanPinjaman = Number(aggPencairan._sum.principal ?? 0)

    // Penerimaan cicilan pokok
    const aggPokok = await prisma.loan_schedules.aggregate({
      where: {
        status: "paid",
        paid_at: { gte: startDate, lte: endDate },
      },
      _sum: { principal_paid: true },
    })
    const angsuranPokokDiterima = Number(aggPokok._sum.principal_paid ?? 0)

    const kasNetPendanaan =
      penerimaanSimpananPokok +
      penerimaanSimpananWajib +
      penerimaanSimpananSukarela -
      penarikanSimpanan +
      angsuranPokokDiterima -
      pencairanPinjaman

    return {
      penerimaanSimpananPokok,
      penerimaanSimpananWajib,
      penerimaanSimpananSukarela,
      penarikanSimpanan,
      pencairanPinjaman,
      angsuranPokokDiterima,
      kasNetPendanaan,
    }
  } catch (error) {
    console.error("Error in getPendanaan:", error)
    throw error
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT: getArusKas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mengambil Laporan Arus Kas Koperasi untuk satu tahun buku.
 * Menyusun tiga aktivitas: Operasional, Investasi, dan Pendanaan.
 *
 * @param {number} year - Tahun buku laporan arus kas
 * @returns {Promise<ArusKasReport>} Laporan arus kas lengkap
 * @throws {Error} Jika terjadi kegagalan akses database
 */
export async function getArusKas(year: number): Promise<ArusKasReport> {
  try {
    const { startDate, endDate, prevEndDate } = getPeriodDates(year)

    const [operasional, investasi, pendanaan, kasAwal] = await Promise.all([
      getOperasional(startDate, endDate),
      getInvestasi(startDate, endDate),
      getPendanaan(startDate, endDate),
      getKasAwal(prevEndDate),
    ])

    const kenaikanKasBersih =
      operasional.kasNetOperasional +
      investasi.kasNetInvestasi +
      pendanaan.kasNetPendanaan

    const kasAkhir = kasAwal + kenaikanKasBersih

    return {
      year,
      operasional,
      investasi,
      pendanaan,
      kasAwal,
      kenaikanKasBersih,
      kasAkhir,
    }
  } catch (error) {
    console.error("Error in getArusKas:", error)
    throw error
  }
}
