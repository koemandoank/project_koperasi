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
 * Lakukan tutup buku untuk bulan/tahun tertentu.
 * Revenue  = SUM(grand_total) dari orders yang lunas pada periode tsb.
 * Expense  = SUM(credit) dari journal_lines dengan sumber "adjustment" / expense pada periode tsb.
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
    const endDate = new Date(year, month, 0, 23, 59, 59); // Last day 23:59:59

    // Revenue: total omzet POS + online yang sudah lunas bulan ini
    const revenueResult = await prisma.orders.aggregate({
      where: {
        payment_status: "paid",
        paid_at: { gte: startDate, lte: endDate },
      },
      _sum: { grand_total: true },
    });
    const totalRevenue = Number(revenueResult._sum.grand_total ?? 0);

    // Expense: SUM cicilan pinjaman yang dibayar pada bulan ini (principal_portion)
    const expenseResult = await prisma.loan_payments.aggregate({
      where: {
        paid_at: { gte: startDate, lte: endDate },
      },
      _sum: { interest_portion: true },
    });
    // Expense diambil dari bunga yang dibayarkan (cost of funds) sebagai proxy biaya
    const totalExpense = Number(expenseResult._sum.interest_portion ?? 0);

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
        note: "Tutup buku bulanan dilakukan",
      },
    });

    return { success: true };
  } catch (error) {
    console.error("performMonthlyClosing error:", error);
    return { success: false, error: "Gagal memproses tutup buku bulanan." };
  }
}
