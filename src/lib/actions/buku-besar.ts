"use server"

import { prisma } from "@/lib/db/prisma";

export async function getJournalEntries(params?: {
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
}) {
  try {
    const page = params?.page || 1
    const limit = 30
    const skip = (page - 1) * limit

    const where: any = {}

    if (params?.startDate || params?.endDate) {
      where.entry_date = {}
      if (params.startDate) where.entry_date.gte = new Date(params.startDate)
      if (params.endDate) where.entry_date.lte = new Date(params.endDate)
    }

    if (params?.search) {
      where.OR = [
        { description: { contains: params.search } },
        { entry_no: { contains: params.search } },
        { reference: { contains: params.search } },
      ]
    }

    const [entries, total] = await prisma.$transaction([
      prisma.journal_entries.findMany({
        where,
        include: {
          journal_lines: {
            include: { chart_of_accounts: true }
          },
          units: true
        },
        orderBy: { entry_date: "desc" },
        skip,
        take: limit,
      }),
      prisma.journal_entries.count({ where })
    ])

    return {
      entries: entries.map(e => ({
        id: Number(e.id),
        entry_no: e.entry_no,
        entry_date: e.entry_date.toISOString().split("T")[0],
        description: e.description,
        reference: e.reference || "-",
        source: e.source,
        is_posted: e.is_posted,
        unit_name: e.units?.name || "-",
        lines: e.journal_lines.map(l => ({
          id: Number(l.id),
          account_code: l.chart_of_accounts?.code || "-",
          account_name: l.chart_of_accounts?.name || "-",
          debit: Number(l.debit),
          credit: Number(l.credit),
          description: l.description || "",
        }))
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    }
  } catch (error) {
    console.error("getJournalEntries error:", error);
    return { entries: [], total: 0, page: 1, totalPages: 0 }
  }
}

/** Tipe item notifikasi buku besar */
interface NotificationItem {
  type: "info" | "warning" | "error"
  message: string
  detail?: string
  actionLink?: string
}

/**
 * Menghitung berapa hari yang lalu sebuah tanggal.
 * @param {Date} date Tanggal yang akan dihitung
 * @returns {number} Jumlah hari lalu
 */
function daysAgo(date: Date): number {
  const diffMs = Date.now() - date.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Menghasilkan daftar notifikasi yang relevan untuk dashboard Buku Besar.
 * Mencakup: jurnal draft, tutup buku, transaksi kasir pending, 
 * pembayaran pinjaman tanpa jurnal, simpanan tanpa jurnal, dan penyusutan aset tetap.
 *
 * @returns {Promise<NotificationItem[]>} Array notifikasi yang perlu ditindaklanjuti
 */
export async function getGeneralLedgerNotifications(): Promise<NotificationItem[]> {
  try {
    const notifications: NotificationItem[] = []
    const now = new Date()

    // ── 1. Jurnal Draft (Unposted) ───────────────────────────────────────
    const draftCount = await prisma.journal_entries.count({
      where: { is_posted: false }
    })
    if (draftCount > 0) {
      notifications.push({
        type: "warning",
        message: `${draftCount} jurnal berstatus DRAFT belum diposting ke Buku Besar.`,
        detail: "Jurnal draft tidak tercermin dalam laporan keuangan. Segera posting untuk memastikan keakuratan data.",
        actionLink: "/akuntansi/buku-besar"
      })
    }

    // ── 2. Tutup Buku Bulan Lalu ──────────────────────────────────────────
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonth = lastMonthDate.getMonth() + 1
    const lastYear = lastMonthDate.getFullYear()

    const lastMonthClosed = await prisma.monthly_closures.findFirst({
      where: { month: lastMonth, year: lastYear }
    })

    if (!lastMonthClosed) {
      notifications.push({
        type: "error",
        message: `Tutup buku bulan ${lastMonth}/${lastYear} belum diproses!`,
        detail: "Tutup buku wajib dilakukan di awal bulan berikutnya agar SHU sementara terhitung akurat.",
        actionLink: "/akuntansi/tutup-buku"
      })
    }

    // ── 3. Transaksi Toko Berjalan Menunggu Tutup Buku ───────────────────
    const periodStart = new Date(lastYear, lastMonth - 1, 1)
    const unclosedSales = await prisma.orders.aggregate({
      where: {
        payment_status: "paid",
        paid_at: { gte: periodStart, lte: now }
      },
      _sum: { grand_total: true }
    })
    const unclosedSalesAmount = Number(unclosedSales._sum.grand_total || 0)
    if (unclosedSalesAmount > 0 && !lastMonthClosed) {
      const formattedAmount = new Intl.NumberFormat('id-ID', {
        style: 'currency', currency: 'IDR', maximumFractionDigits: 0
      }).format(unclosedSalesAmount)
      notifications.push({
        type: "info",
        message: `Transaksi toko berjalan sebesar ${formattedAmount} menunggu tutup buku.`,
        detail: "Pastikan seluruh transaksi kasir sudah diverifikasi sebelum menutup buku bulanan.",
        actionLink: "/akuntansi/tutup-buku"
      })
    }

    // ── 4. Pembayaran Pinjaman Lunas Hari Ini Tanpa Jurnal Manual ────────
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1)

    const todayPaidSchedules = await prisma.loan_schedules.count({
      where: {
        status: "paid",
        paid_at: { gte: todayStart, lte: todayEnd }
      }
    })
    if (todayPaidSchedules > 0) {
      notifications.push({
        type: "info",
        message: `${todayPaidSchedules} angsuran pinjaman dibayar hari ini — pastikan jurnal penerimaan kas sudah tercatat.`,
        detail: "Verifikasi pencatatan debit Kas dan kredit Piutang Pinjaman sudah sesuai.",
        actionLink: "/akuntansi/transaksi?type=pemasukan"
      })
    }

    // ── 5. Simpanan Masuk Bulan Ini Tanpa Jurnal Terkait ─────────────────
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const depositCount = await prisma.saving_transactions.count({
      where: {
        type: "deposit",
        created_at: { gte: monthStart }
      }
    })

    // Hitung berapa jurnal simpanan (source='saving') yang sudah tercatat bulan ini
    const savingJournalCount = await prisma.journal_entries.count({
      where: {
        source: "saving",
        entry_date: { gte: monthStart }
      }
    })

    if (depositCount > 0 && savingJournalCount === 0) {
      notifications.push({
        type: "warning",
        message: `${depositCount} transaksi simpanan bulan ini belum memiliki jurnal akuntansi terkait.`,
        detail: "Input jurnal debit Kas / Kredit Simpanan Anggota untuk setiap setoran yang masuk.",
        actionLink: "/akuntansi/transaksi"
      })
    }

    // ── 6. Angsuran Menunggak (Overdue) Bulan Ini ─────────────────────
    const today = new Date()
    const overdueCount = await prisma.loan_schedules.count({
      where: {
        status: "pending",
        due_date: { lt: today }
      }
    })

    if (overdueCount > 0) {
      notifications.push({
        type: "warning",
        message: `${overdueCount} angsuran pinjaman sudah jatuh tempo dan belum dibayar (overdue).`,
        detail: "Anggota yang menunggak perlu dihubungi dan dicatat dendanya. Pastikan angsuran diproses agar pendapatan bunga tercatat akurat.",
        actionLink: "/pinjaman"
      })
    }

    return notifications
  } catch (error) {
    console.error("getGeneralLedgerNotifications error:", error)
    return []
  }
}
