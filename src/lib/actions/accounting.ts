"use server"

import { prisma } from "@/lib/db/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { logAudit } from "@/lib/actions/log-audit"

/** Fetch semua riwayat tutup buku, urut terbaru */
export async function getMonthlyClosures() {
  try {
    const closures = await prisma.monthly_closures.findMany({
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    return closures.map((c: any) => ({
      ...c,
      id: Number(c.id),
      total_revenue: Number(c.total_revenue),
      total_expense: Number(c.total_expense),
      net_income: Number(c.net_income),
      closed_by: c.closed_by ? Number(c.closed_by) : null,
    }));
  } catch (error) {
    console.error("getMonthlyClosures error:", error);
    return [];
  }
}

/**
 * Menghitung total omzet toko (POS/Online yang paid) plus bunga & denda pinjaman pada periode tertentu.
 * 
 * @param {Date} startDate Tanggal mulai periode
 * @param {Date} endDate Tanggal akhir periode
 * @returns {Promise<number>} Total pendapatan operasional riil
 * @throws {Error} Mengembalikan error jika terjadi kesalahan query database
 */
async function calculateOperationalRevenue(startDate: Date, endDate: Date): Promise<number> {
  try {
    const ordersSum = await prisma.orders.aggregate({
      where: {
        payment_status: "paid",
        paid_at: { gte: startDate, lte: endDate },
      },
      _sum: { grand_total: true },
    });

    const loanSchedulesSum = await prisma.loan_schedules.aggregate({
      where: {
        status: "paid",
        paid_at: { gte: startDate, lte: endDate },
      },
      _sum: {
        interest_paid: true,
        penalty_paid: true,
      },
    });

    return Number(ordersSum._sum.grand_total ?? 0) +
           Number(loanSchedulesSum._sum.interest_paid ?? 0) +
           Number(loanSchedulesSum._sum.penalty_paid ?? 0);
  } catch (error) {
    console.error("Error in calculateOperationalRevenue:", error);
    throw error;
  }
}

/**
 * Menghitung total pendapatan dari Chart of Accounts (COA) tipe 'revenue' pada jurnal umum.
 * 
 * @param {Date} startDate Tanggal mulai periode
 * @param {Date} endDate Tanggal akhir periode
 * @returns {Promise<number>} Total pendapatan dari jurnal umum (Kredit - Debet)
 */
async function calculateJournalRevenue(startDate: Date, endDate: Date): Promise<number> {
  try {
    const journalSum = await prisma.journal_lines.aggregate({
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

    return Number(journalSum._sum.credit ?? 0) - Number(journalSum._sum.debit ?? 0);
  } catch (error) {
    console.error("Error in calculateJournalRevenue:", error);
    throw error;
  }
}

/**
 * Menghitung Harga Pokok Penjualan (HPP / COGS) riil dari produk terjual lunas pada periode tertentu.
 * 
 * @param {Date} startDate Tanggal mulai periode
 * @param {Date} endDate Tanggal akhir periode
 * @returns {Promise<number>} Total HPP toko
 */
async function calculateStoreCogs(startDate: Date, endDate: Date): Promise<number> {
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
        const purchasePrice = Number(item.purchase_price ?? 0);
        totalCogs += item.qty * purchasePrice;
      }
    }
    return totalCogs;
  } catch (error) {
    console.error("Error in calculateStoreCogs:", error);
    throw error;
  }
}

/**
 * Menghitung total beban operasional riil dari Chart of Accounts (COA) tipe 'expense' pada jurnal umum.
 * 
 * @param {Date} startDate Tanggal mulai periode
 * @param {Date} endDate Tanggal akhir periode
 * @returns {Promise<number>} Total beban operasional (Debet - Kredit)
 */
async function calculateJournalExpenses(startDate: Date, endDate: Date): Promise<number> {
  try {
    const journalSum = await prisma.journal_lines.aggregate({
      where: {
        journal_entries: {
          is_posted: true,
          entry_date: { gte: startDate, lte: endDate },
        },
        chart_of_accounts: {
          type: "expense",
        },
      },
      _sum: {
        debit: true,
        credit: true,
      },
    });

    return Number(journalSum._sum.debit ?? 0) - Number(journalSum._sum.credit ?? 0);
  } catch (error) {
    console.error("Error in calculateJournalExpenses:", error);
    throw error;
  }
}

/**
 * Lakukan tutup buku untuk bulan/tahun tertentu dengan formula akuntansi standar koperasi.
 * 
 * @param {number} month Bulan penutupan (1-12)
 * @param {number} year Tahun penutupan
 * @returns {Promise<{ success: boolean; error?: string }>} Hasil eksekusi penutupan
 */
export async function performMonthlyClosing(month: number, year: number) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return { success: false, error: "Tidak terautentikasi." };

    // Validasi input
    if (month < 1 || month > 12 || year < 2000 || year > 2100) {
      return { success: false, error: "Periode tidak valid." };
    }

    // Cek duplikasi
    const existing = await prisma.monthly_closures.findUnique({
      where: { month_year: { month, year } },
    });
    if (existing) {
      return { success: false, error: "Bulan ini sudah ditutup." };
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59); // Hari terakhir 23:59:59

    // 1. Pendapatan (Revenue)
    const opRevenue = await calculateOperationalRevenue(startDate, endDate);
    const journalRevenue = await calculateJournalRevenue(startDate, endDate);
    const totalRevenue = opRevenue + journalRevenue;

    // 2. Beban / Biaya (Expense)
    const storeCogs = await calculateStoreCogs(startDate, endDate);
    const journalExpense = await calculateJournalExpenses(startDate, endDate);
    const totalExpense = storeCogs + journalExpense;

    const netIncome = totalRevenue - totalExpense;

    await prisma.monthly_closures.create({
      data: {
        month,
        year,
        total_revenue: totalRevenue,
        total_expense: totalExpense,
        net_income: netIncome,
        closed_by: BigInt(userId),
      },
    });

    revalidatePath("/akuntansi/tutup-buku");

    await logAudit({
      action: "CREATE",
      modelType: "monthly_closures",
      modelId: null,
      newValues: {
        month,
        year,
        total_revenue: totalRevenue,
        total_expense: totalExpense,
        net_income: netIncome,
        note: "Tutup buku bulanan dilakukan dengan logika HPP dan bunga pinjaman yang benar",
      },
    });

    return { success: true };
  } catch (error) {
    console.error("performMonthlyClosing error:", error);
    return { success: false, error: "Gagal memproses tutup buku bulanan." };
  }
}

/** Status tiap item pengecekan kesiapan tutup buku */
export type CheckStatus = "ok" | "warning" | "error" | "loading"

export interface ClosingCheckItem {
  id: string
  label: string
  status: CheckStatus
  detail: string
  actionLink?: string
}

/**
 * Menjalankan 5 pengecekan otomatis kesiapan tutup buku untuk periode tertentu.
 * Harus dipanggil sebelum `performMonthlyClosing` untuk memastikan data bersih.
 *
 * @param {number} month Bulan yang akan ditutup (1–12)
 * @param {number} year  Tahun yang akan ditutup
 * @returns {Promise<ClosingCheckItem[]>} Array hasil pengecekan
 */
export async function getClosingReadinessCheck(
  month: number,
  year: number
): Promise<ClosingCheckItem[]> {
  const checks: ClosingCheckItem[] = []

  try {
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59)

    // ── Cek 1: Periode belum pernah ditutup (duplikasi) ────────────────
    const existing = await prisma.monthly_closures.findFirst({
      where: { month, year }
    })
    checks.push(
      existing
        ? {
            id: "no_duplicate",
            label: "Periode belum ditutup sebelumnya",
            status: "error",
            detail: `Periode ${month}/${year} sudah pernah ditutup. Tidak bisa diproses ulang.`,
          }
        : {
            id: "no_duplicate",
            label: "Periode belum ditutup sebelumnya",
            status: "ok",
            detail: "Periode ini belum memiliki catatan tutup buku.",
          }
    )

    // ── Cek 2: Bulan sebelumnya sudah ditutup (urutan sekuensial) ──────
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    const prevClosed = await prisma.monthly_closures.findFirst({
      where: { month: prevMonth, year: prevYear }
    })
    checks.push(
      prevClosed || (prevMonth === 12 && prevYear < year - 1)
        ? {
            id: "sequential_order",
            label: "Bulan sebelumnya sudah ditutup",
            status: "ok",
            detail: `Tutup buku ${prevMonth}/${prevYear} sudah selesai. Urutan periode valid.`,
          }
        : {
            id: "sequential_order",
            label: "Bulan sebelumnya sudah ditutup",
            status: "warning",
            detail: `Tutup buku ${prevMonth}/${prevYear} belum dilakukan. Dianjurkan menutup secara berurutan.`,
            actionLink: "/akuntansi/tutup-buku",
          }
    )

    // ── Cek 3: Tidak ada jurnal Draft (unposted) ───────────────────────
    const draftCount = await prisma.journal_entries.count({
      where: {
        is_posted: false,
        entry_date: { gte: startDate, lte: endDate }
      }
    })
    checks.push(
      draftCount === 0
        ? {
            id: "no_draft_journals",
            label: "Tidak ada jurnal Draft di periode ini",
            status: "ok",
            detail: "Semua jurnal pada periode ini sudah diposting ke buku besar.",
          }
        : {
            id: "no_draft_journals",
            label: "Tidak ada jurnal Draft di periode ini",
            status: "error",
            detail: `Terdapat ${draftCount} jurnal berstatus Draft. Posting semua jurnal sebelum tutup buku.`,
            actionLink: "/akuntansi/buku-besar",
          }
    )

    // ── Cek 4: Ada transaksi di periode (tidak menutup bulan kosong) ───
    const transactionCount = await prisma.journal_entries.count({
      where: {
        is_posted: true,
        entry_date: { gte: startDate, lte: endDate }
      }
    })
    const orderCount = await prisma.orders.count({
      where: {
        payment_status: "paid",
        paid_at: { gte: startDate, lte: endDate }
      }
    })
    const hasActivity = transactionCount > 0 || orderCount > 0
    checks.push(
      hasActivity
        ? {
            id: "has_activity",
            label: "Terdapat transaksi pada periode ini",
            status: "ok",
            detail: `${transactionCount} jurnal posted + ${orderCount} transaksi toko ditemukan.`,
          }
        : {
            id: "has_activity",
            label: "Terdapat transaksi pada periode ini",
            status: "warning",
            detail: "Tidak ada transaksi tercatat di periode ini. Pastikan data sudah lengkap sebelum menutup.",
          }
    )

    // ── Cek 5: Tidak ada pinjaman aktif tanpa jadwal angsuran ──────────
    const loansWithoutSchedule = await prisma.loans.count({
      where: {
        status: "active",
        loan_schedules: { none: {} }
      }
    })
    checks.push(
      loansWithoutSchedule === 0
        ? {
            id: "loan_schedules_complete",
            label: "Semua pinjaman aktif memiliki jadwal angsuran",
            status: "ok",
            detail: "Tidak ada pinjaman aktif tanpa jadwal angsuran yang dapat menyebabkan kalkulasi pendapatan bunga tidak akurat.",
          }
        : {
            id: "loan_schedules_complete",
            label: "Semua pinjaman aktif memiliki jadwal angsuran",
            status: "warning",
            detail: `${loansWithoutSchedule} pinjaman aktif tidak memiliki jadwal angsuran. Pendapatan bunga mungkin tidak akurat.`,
            actionLink: "/pinjaman",
          }
    )

    return checks
  } catch (error) {
    console.error("getClosingReadinessCheck error:", error)
    return [
      {
        id: "system_error",
        label: "Pengecekan sistem",
        status: "error",
        detail: "Gagal menjalankan pengecekan. Cek koneksi database dan coba lagi.",
      }
    ]
  }
}
