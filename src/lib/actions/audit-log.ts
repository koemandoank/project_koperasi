"use server"

import { prisma } from "@/lib/db/prisma"
import { Prisma } from "@prisma/client"
import { auth } from "@/auth"
import { checkRole } from "@/lib/auth-helpers"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AuditCategory =
  | "loan"
  | "saving"
  | "member"
  | "user"
  | "shu_config"
  | "pos"
  | "approval"
  | "setting"
  | "other"

export interface AuditLogRow {
  id: number
  action: string
  model_type: string
  category: AuditCategory
  model_id: number | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  url: string | null
  created_at: string
  user: {
    id: number
    username: string
    role: string
    nik: string | null
    full_name: string | null
  } | null
}

export interface AuditLogFilters {
  search?: string      // cari NIK / nama / username
  category?: string   // model_type filter
  action?: string     // CREATE | UPDATE | DELETE | LOGIN | LOGOUT
  role?: string       // filter by user role
  from?: string
  to?: string
  page?: number
}

export interface AuditLogResult {
  data: AuditLogRow[]
  total: number
  page: number
  pageSize: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Constant: mapping model_type → AuditCategory
// ─────────────────────────────────────────────────────────────────────────────

const MODEL_CATEGORY_MAP: Record<string, AuditCategory> = {
  // Pinjaman
  loans:              "loan",
  loan_applications:  "approval",
  loan_schedules:     "loan",
  loan_payments:      "loan",
  loan_products:      "loan",
  loan_rules:         "loan",
  // Simpanan
  savings:            "saving",
  saving_types:       "saving",
  saving_transactions:"saving",
  // Anggota & User
  members:            "member",
  users:              "user",
  // SHU & Pengaturan
  shu_config:         "shu_config",
  shu_periods:        "shu_config",
  app_settings:       "setting",
  // Toko / POS
  orders:                  "pos",
  products:                "pos",
  order_returns:           "pos",
  order_payments:          "pos",
  cash_register_sessions:  "pos",
  promotions:              "pos",
  // Pembelian
  suppliers:               "pos",
  purchase_orders:         "pos",
  good_receipts:           "pos",
  // Inventaris
  stock_balances:          "pos",
  stock_transfer_orders:   "pos",
  stock_opname:            "pos",
  product_costing:         "pos",
  // Konsinyasi
  consignment_items:       "pos",
  consignment_payables:    "pos",
  consignment_settlements: "pos",
  // CRM / Loyalty
  loyalty_memberships:     "pos",
  loyalty_programs:        "pos",
  // Keuangan (AP/AR)
  accounts_payable:        "setting",
  accounts_receivable:     "setting",
  // Akuntansi
  monthly_closures:        "setting",
}

function resolveCategory(modelType: string): AuditCategory {
  return MODEL_CATEGORY_MAP[modelType] ?? "other"
}

// ─────────────────────────────────────────────────────────────────────────────
// Allowed roles untuk halaman log
// ─────────────────────────────────────────────────────────────────────────────

const LOG_VISIBLE_ROLES = ["superadmin", "admin", "pengurus", "kasir"] as const

// ─────────────────────────────────────────────────────────────────────────────
// Main Action
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ambil daftar audit log dengan filter dan paginasi.
 * Hanya menampilkan log dari user dengan role yang relevan
 * (admin, pengurus, ketua, kasir, superadmin).
 *
 * @param filters - Kriteria filter
 * @returns AuditLogResult dengan data, total, dan info halaman
 */
export async function getAuditLogs(
  filters: AuditLogFilters
): Promise<AuditLogResult> {
  const session = await auth()
  checkRole(session, ["superadmin", "admin", "pengurus", "kasir"])

  const PAGE_SIZE = 25
  const page = Math.max(1, filters.page ?? 1)
  const skip = (page - 1) * PAGE_SIZE

  const now = new Date()
  const startDate = filters.from
    ? new Date(filters.from)
    : new Date(now.getFullYear(), now.getMonth(), 1)
  const endDate = filters.to
    ? new Date(filters.to)
    : now

  endDate.setHours(23, 59, 59, 999)

  try {
    // Base where: hanya user dengan role yang relevan
    const where: Prisma.AuditLogWhereInput = {
      created_at: { gte: startDate, lte: endDate },
      users: {
        role: filters.role && filters.role !== "all"
          ? filters.role as any
          : { in: LOG_VISIBLE_ROLES as unknown as Prisma.Enumusers_roleFilter["in"] },
      },
    }

    // Filter kategori/model_type
    if (filters.category && filters.category !== "all") {
      // Cari semua model_type yang map ke category ini
      const matchedTypes = Object.entries(MODEL_CATEGORY_MAP)
        .filter(([, cat]) => cat === filters.category)
        .map(([type]) => type)
      where.model_type = { in: matchedTypes.length ? matchedTypes : [filters.category] }
    }

    // Filter action
    if (filters.action && filters.action !== "all") {
      where.action = filters.action
    }

    const [rawLogs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        include: {
          users: {
            include: { members: { select: { nik: true, full_name: true } } },
          },
        },
        orderBy: { created_at: "desc" },
        skip,
        take: PAGE_SIZE,
      }),
      prisma.auditLog.count({ where }),
    ])

    // Filter search (nik / nama / username) — dilakukan in-memory setelah JOIN
    let logs = rawLogs.map((log: any) => ({
      id: Number(log.id),
      action: log.action,
      model_type: log.model_type ?? "unknown",
      category: resolveCategory(log.model_type ?? ""),
      model_id: log.model_id ? Number(log.model_id) : null,
      old_values: log.old_values as Record<string, unknown> | null,
      new_values: log.new_values as Record<string, unknown> | null,
      ip_address: log.ip_address,
      url: log.url,
      created_at: log.created_at.toISOString(),
      user: log.users
        ? {
            id: Number(log.users.id),
            username: log.users.username,
            role: log.users.role,
            nik: log.users.members?.nik ?? null,
            full_name: log.users.members?.full_name ?? null,
          }
        : null,
    })) as AuditLogRow[]

    if (filters.search) {
      const q = filters.search.toLowerCase()
      logs = logs.filter(
        (l: any) =>
          l.user?.username?.toLowerCase().includes(q) ||
          l.user?.full_name?.toLowerCase().includes(q) ||
          l.user?.nik?.toLowerCase().includes(q)
      )
    }

    return { data: logs, total, page, pageSize: PAGE_SIZE }
  } catch (error) {
    console.error("[getAuditLogs] Error:", error)
    return { data: [], total: 0, page: 1, pageSize: PAGE_SIZE }
  }
}

/**
 * Ambil daftar distinct kategori yang tersedia di audit_logs untuk filter UI.
 */
export async function getAuditCategories(): Promise<string[]> {
  try {
    const session = await auth()
    checkRole(session, ["superadmin", "admin", "pengurus", "kasir"])

    const types = await prisma.auditLog.findMany({
      select: { model_type: true },
      distinct: ["model_type"],
      where: { model_type: { not: null } },
    })
    const categories = [...new Set(
      types.map((t: any) => resolveCategory(t.model_type ?? ""))
    )] as string[]
    return categories
  } catch {
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Role Summary
// ─────────────────────────────────────────────────────────────────────────────

export interface RoleSummaryRow {
  role: string
  total: number
  byAction: Record<string, number>
  users: { username: string; full_name: string | null; count: number }[]
}

/**
 * Statistik aktivitas dikelompokkan per role dalam rentang tanggal.
 * Berguna untuk tab "Per Role" di halaman log.
 */
export async function getRoleSummary(
  from?: string,
  to?: string
): Promise<RoleSummaryRow[]> {
  const session = await auth()
  checkRole(session, ["superadmin", "admin", "pengurus", "kasir"])

  const now = new Date()
  const startDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1)
  const endDate   = to   ? new Date(to)   : now
  endDate.setHours(23, 59, 59, 999)

  try {
    // Ambil semua log dalam periode dengan data user
    const logs = await prisma.auditLog.findMany({
      where: {
        created_at: { gte: startDate, lte: endDate },
        users: {
          role: { in: LOG_VISIBLE_ROLES as unknown as Prisma.Enumusers_roleFilter["in"] },
        },
      },
      include: {
        users: {
          include: { members: { select: { full_name: true } } },
        },
      },
      orderBy: { created_at: "desc" },
    })

    // Group by role
    const roleMap = new Map<string, {
      total: number
      byAction: Record<string, number>
      users: Map<string, { username: string; full_name: string | null; count: number }>
    }>()

    for (const log of logs) {
      const role = log.users?.role ?? "unknown"
      if (!roleMap.has(role)) {
        roleMap.set(role, { total: 0, byAction: {}, users: new Map() })
      }
      const entry = roleMap.get(role)!
      entry.total++
      entry.byAction[log.action] = (entry.byAction[log.action] ?? 0) + 1

      // Track per user
      const username  = log.users?.username ?? "unknown"
      const full_name = log.users?.members?.full_name ?? null
      if (!entry.users.has(username)) {
        entry.users.set(username, { username, full_name, count: 0 })
      }
      entry.users.get(username)!.count++
    }

    // Convert to array, urutkan berdasarkan total desc
    const ORDER = ["superadmin", "admin", "pengurus", "kasir"]
    return [...roleMap.entries()]
      .sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]))
      .map(([role, data]) => ({
        role,
        total: data.total,
        byAction: data.byAction,
        users: [...data.users.values()].sort((a, b) => b.count - a.count).slice(0, 10),
      }))
  } catch (error) {
    console.error("[getRoleSummary] Error:", error)
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline Summary (per hari)
// ─────────────────────────────────────────────────────────────────────────────

export interface TimelineDayRow {
  date: string            // YYYY-MM-DD
  total: number
  byRole: Record<string, number>
  byAction: Record<string, number>
}

/**
 * Ringkasan aktivitas dikelompokkan per hari untuk grafik timeline.
 * Digunakan di tampilan "Harian / Mingguan / Bulanan".
 */
export async function getTimelineSummary(
  from?: string,
  to?: string,
  role?: string
): Promise<TimelineDayRow[]> {
  const session = await auth()
  checkRole(session, ["superadmin", "admin", "pengurus", "kasir"])

  const now = new Date()
  const startDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1)
  const endDate   = to   ? new Date(to)   : now
  endDate.setHours(23, 59, 59, 999)

  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        created_at: { gte: startDate, lte: endDate },
        users: {
          role: role && role !== "all"
            ? role as any
            : { in: LOG_VISIBLE_ROLES as unknown as Prisma.Enumusers_roleFilter["in"] },
        },
      },
      include: { users: { select: { role: true } } },
      orderBy: { created_at: "asc" },
    })

    // Group by date string (YYYY-MM-DD)
    const dayMap = new Map<string, TimelineDayRow>()

    for (const log of logs) {
      const d = log.created_at.toISOString().slice(0, 10)
      if (!dayMap.has(d)) {
        dayMap.set(d, { date: d, total: 0, byRole: {}, byAction: {} })
      }
      const entry = dayMap.get(d)!
      entry.total++

      const r = log.users?.role ?? "unknown"
      entry.byRole[r]   = (entry.byRole[r]   ?? 0) + 1
      entry.byAction[log.action] = (entry.byAction[log.action] ?? 0) + 1
    }

    return [...dayMap.values()]
  } catch (error) {
    console.error("[getTimelineSummary] Error:", error)
    return []
  }
}
