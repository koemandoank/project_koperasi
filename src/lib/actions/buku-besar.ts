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

export async function getGeneralLedgerNotifications() {
  try {
    const notifications: { type: "info" | "warning" | "error"; message: string; actionLink?: string }[] = []
    
    // 1. Cek Jurnal Draft (Unposted)
    const draftCount = await prisma.journal_entries.count({
      where: { is_posted: false }
    })
    if (draftCount > 0) {
      notifications.push({
        type: "warning",
        message: `Terdapat ${draftCount} jurnal berstatus DRAFT (belum diposting ke Buku Besar).`,
        actionLink: "/akuntansi/buku-besar"
      })
    }

    // 2. Cek Tutup Buku Bulanan
    const now = new Date()
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonth = lastMonthDate.getMonth() + 1
    const lastYear = lastMonthDate.getFullYear()

    const lastMonthClosed = await prisma.monthly_closures.findFirst({
      where: { month: lastMonth, year: lastYear }
    })

    if (!lastMonthClosed) {
      notifications.push({
        type: "error",
        message: `Tutup buku bulanan untuk periode ${lastMonth}/${lastYear} belum diproses!`,
        actionLink: "/akuntansi/tutup-buku"
      })
    }

    // 3. Cek Transaksi Kasir POS yang Belum Ditutup Buku
    const unclosedSales = await prisma.orders.aggregate({
      where: {
        payment_status: "paid",
        paid_at: {
          gte: new Date(lastYear, lastMonth - 1, 1),
          lte: now
        }
      },
      _sum: { grand_total: true }
    })
    const unclosedSalesAmount = Number(unclosedSales._sum.grand_total || 0)
    if (unclosedSalesAmount > 0 && !lastMonthClosed) {
      notifications.push({
        type: "info",
        message: `Terdapat transaksi toko berjalan sebesar ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(unclosedSalesAmount)} yang menunggu pelaporan tutup buku bulanan.`,
        actionLink: "/akuntansi/tutup-buku"
      })
    }

    return notifications
  } catch (error) {
    console.error("getGeneralLedgerNotifications error:", error)
    return []
  }
}
