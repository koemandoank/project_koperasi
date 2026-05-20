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
