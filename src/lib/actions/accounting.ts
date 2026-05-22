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

    return closures.map((c) => ({
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

    const loanPaymentsSum = await prisma.loan_payments.aggregate({
      where: {
        paid_at: { gte: startDate, lte: endDate },
      },
      _sum: {
        interest_portion: true,
        penalty_amount: true,
      },
    });

    return Number(ordersSum._sum.grand_total ?? 0) +
           Number(loanPaymentsSum._sum.interest_portion ?? 0) +
           Number(loanPaymentsSum._sum.penalty_amount ?? 0);
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
        const purchasePrice = Number(item.products?.purchase_price ?? 0);
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
