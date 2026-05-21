"use server"

import { prisma } from "@/lib/db/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { logAudit } from "@/lib/actions/log-audit"

// ─────────────────────────────────────────────────────────────────────────────
// Types & Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface ChartOfAccountItem {
  id: number
  code: string
  name: string
  type: "asset" | "liability" | "equity" | "revenue" | "expense"
  normal_balance: "debit" | "credit"
}

export interface TransactionInput {
  type: "pemasukan" | "pengeluaran"
  amount: number
  accountId: number // Rekening Pembayar (Asset)
  categoryId: number // Kategori Pemasukan/Pengeluaran (Revenue/Expense)
  date: string
  notes?: string
}

export interface RecentTransactionItem {
  id: number
  entry_no: string
  entry_date: string
  description: string
  amount: number
  type: "pemasukan" | "pengeluaran"
  category_name: string
  account_name: string
  created_at: string
}

export interface TransactionStats {
  pemasukanHariIni: number
  pengeluaranHariIni: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper / Initialization Services
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ensures that the default Chart of Accounts (COA) are populated.
 * Creates default asset, revenue, and expense accounts if they are not already in the DB.
 * 
 * @returns {Promise<bigint>} The active unit ID to associate accounts with.
 * @throws {Error} If no unit can be found or created.
 */
async function ensureDefaultAccounts(): Promise<bigint> {
  const unit = await prisma.unit.findFirst()
  if (!unit) {
    throw new Error("No active unit found in the database. Please initialize units first.")
  }
  const unitId = unit.id

  const defaults = [
    // Rekening / Bank (Asset)
    { code: "10101", name: "Kas Utama", type: "asset" as const, normal_balance: "debit" as const },
    { code: "10102", name: "Bank Mandiri (Koperasi)", type: "asset" as const, normal_balance: "debit" as const },
    { code: "10103", name: "Bank BCA Koperasi (BCA)", type: "asset" as const, normal_balance: "debit" as const },

    // Pengeluaran (Expense)
    { code: "50101", name: "Pembayaran Gaji karyawan", type: "expense" as const, normal_balance: "debit" as const },
    { code: "50102", name: "Pembelian ATK Koperasi", type: "expense" as const, normal_balance: "debit" as const },

    // Pemasukan (Revenue)
    { code: "40101", name: "Jasa Koperasi", type: "revenue" as const, normal_balance: "credit" as const },
    { code: "40102", name: "Penjualan Produk Koperasi", type: "revenue" as const, normal_balance: "credit" as const },
  ]

  for (const item of defaults) {
    const existing = await prisma.chart_of_accounts.findFirst({
      where: { unit_id: unitId, code: item.code }
    })
    if (!existing) {
      await prisma.chart_of_accounts.create({
        data: {
          unit_id: unitId,
          code: item.code,
          name: item.name,
          type: item.type,
          normal_balance: item.normal_balance,
          level: 1,
          is_header: false,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      })
    }
  }

  return unitId
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Actions / API Controller Layer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches the Chart of Accounts categorized by their financial type.
 * Initializes default accounts automatically if the table is empty or missing defaults.
 * 
 * @returns {Promise<{ accounts: ChartOfAccountItem[], categoriesExpense: ChartOfAccountItem[], categoriesIncome: ChartOfAccountItem[] }>} Account list.
 */
export async function getTransactionFormOptions() {
  try {
    const unitId = await ensureDefaultAccounts()

    const allCoa = await prisma.chart_of_accounts.findMany({
      where: { unit_id: unitId, is_active: true },
      orderBy: { code: "asc" }
    })

    const mapped = allCoa.map(c => ({
      id: Number(c.id),
      code: c.code,
      name: c.name,
      type: c.type as "asset" | "liability" | "equity" | "revenue" | "expense",
      normal_balance: c.normal_balance as "debit" | "credit"
    }))

    return {
      success: true,
      accounts: mapped.filter(a => a.type === "asset" && !a.code.startsWith("12")),
      categoriesExpense: mapped.filter(a => a.type === "expense"),
      categoriesIncome: mapped.filter(a => a.type === "revenue")
    }
  } catch (error: any) {
    console.error("[getTransactionFormOptions] Error details:", error)
    return {
      success: false,
      error: error.message || "Gagal memuat opsi transaksi.",
      accounts: [],
      categoriesExpense: [],
      categoriesIncome: []
    }
  }
}

/**
 * Dynamically creates a new Chart of Account (Category or Bank) based on user input.
 * 
 * @param {string} name - Name of the new category or account.
 * @param {"asset" | "revenue" | "expense"} type - The accounting type.
 * @returns {Promise<{ success: boolean, data?: ChartOfAccountItem, error?: string }>} The creation result.
 */
export async function createAdditionalAccount(name: string, type: "asset" | "revenue" | "expense") {
  try {
    const session = await auth()
    if (!session?.user) {
      return { success: false, error: "Sesi kedaluwarsa. Silakan login kembali." }
    }

    const unit = await prisma.unit.findFirst()
    if (!unit) {
      return { success: false, error: "Unit koperasi tidak ditemukan." }
    }
    const unitId = unit.id

    // Generate account code dynamically based on type
    const prefix = type === "asset" ? "101" : type === "revenue" ? "401" : "501"
    
    // Find the max existing code with the same prefix to auto-increment
    const siblingAccounts = await prisma.chart_of_accounts.findMany({
      where: { unit_id: unitId, code: { startsWith: prefix } },
      select: { code: true }
    })

    let maxNum = 3 // default starting offset
    siblingAccounts.forEach(a => {
      const suffix = parseInt(a.code.substring(3))
      if (!isNaN(suffix) && suffix > maxNum) {
        maxNum = suffix
      }
    })
    
    const nextNum = maxNum + 1
    const newCode = `${prefix}${String(nextNum).padStart(2, "0")}`

    const newCoa = await prisma.chart_of_accounts.create({
      data: {
        unit_id: unitId,
        code: newCode,
        name: name,
        type: type,
        normal_balance: type === "revenue" ? "credit" : "debit",
        level: 1,
        is_header: false,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    })

    await logAudit({
      action: "CREATE",
      modelType: "chart_of_accounts",
      modelId: newCoa.id,
      newValues: { code: newCode, name, type }
    })

    return {
      success: true,
      data: {
        id: Number(newCoa.id),
        code: newCoa.code,
        name: newCoa.name,
        type: newCoa.type as "asset" | "revenue" | "expense",
        normal_balance: newCoa.normal_balance as "debit" | "credit"
      }
    }
  } catch (error: any) {
    console.error("[createAdditionalAccount] Exception stacktrace:", error)
    return { success: false, error: error.message || "Gagal membuat kategori tambahan." }
  }
}

/**
 * Creates a manual transaction in a database transaction block using double-entry ledger lines.
 * 
 * @param {TransactionInput} input - The validated transaction data.
 * @returns {Promise<{ success: boolean, error?: string }>} The transaction execution result.
 */
export async function createManualTransaction(input: TransactionInput) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { success: false, error: "Anda harus login untuk melakukan transaksi ini." }
    }
    const userId = BigInt(session.user.id)

    const unit = await prisma.unit.findFirst()
    if (!unit) {
      return { success: false, error: "Unit koperasi tidak terdefinisi." }
    }
    const unitId = unit.id

    if (!input.amount || input.amount <= 0) {
      return { success: false, error: "Jumlah nominal transaksi harus lebih dari Rp 0." }
    }

    const dateParsed = new Date(input.date)
    
    // Generate unique Transaction reference code
    const dateStr = input.date.replace(/-/g, "")
    const randomSuffix = String(Math.floor(1000 + Math.random() * 9000))
    const entryNo = `TX-${dateStr}-${randomSuffix}`

    // Fetch accounts to confirm they exist and resolve names for log
    const [account, category] = await prisma.$transaction([
      prisma.chart_of_accounts.findUnique({ where: { id: BigInt(input.accountId) } }),
      prisma.chart_of_accounts.findUnique({ where: { id: BigInt(input.categoryId) } })
    ])

    if (!account || !category) {
      return { success: false, error: "Rekening atau kategori transaksi tidak valid." }
    }

    const txDescription = input.notes || `${category.name} via ${account.name}`

    // Perform Double-Entry accounting in a Prisma Transaction block
    await prisma.$transaction(async (tx) => {
      // 1. Create the Journal Entry
      const entry = await tx.journal_entries.create({
        data: {
          unit_id: unitId,
          entry_no: entryNo,
          entry_date: dateParsed,
          description: txDescription,
          reference: category.name,
          source: "manual",
          posted_by: userId,
          posted_at: new Date(),
          is_posted: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      })

      // 2. Create the Ledger Lines
      if (input.type === "pengeluaran") {
        // Pengeluaran: Expense Increases (Debit), Asset Decreases (Credit)
        // Debit (Expense)
        await tx.journal_lines.create({
          data: {
            journal_id: entry.id,
            account_id: category.id,
            debit: input.amount,
            credit: 0,
            description: input.notes || `Pengeluaran ${category.name}`,
            created_at: new Date(),
            updated_at: new Date()
          }
        })

        // Credit (Asset)
        await tx.journal_lines.create({
          data: {
            journal_id: entry.id,
            account_id: account.id,
            debit: 0,
            credit: input.amount,
            description: input.notes || `Pengeluaran via ${account.name}`,
            created_at: new Date(),
            updated_at: new Date()
          }
        })
      } else {
        // Pemasukan: Asset Increases (Debit), Revenue Increases (Credit)
        // Debit (Asset)
        await tx.journal_lines.create({
          data: {
            journal_id: entry.id,
            account_id: account.id,
            debit: input.amount,
            credit: 0,
            description: input.notes || `Penerimaan via ${account.name}`,
            created_at: new Date(),
            updated_at: new Date()
          }
        })

        // Credit (Revenue)
        await tx.journal_lines.create({
          data: {
            journal_id: entry.id,
            account_id: category.id,
            debit: 0,
            credit: input.amount,
            description: input.notes || `Penerimaan ${category.name}`,
            created_at: new Date(),
            updated_at: new Date()
          }
        })
      }
    })

    await logAudit({
      action: "CREATE",
      modelType: "journal_entries",
      modelId: null,
      newValues: { entryNo, amount: input.amount, type: input.type, category: category.name }
    })

    revalidatePath("/akuntansi/transaksi")
    revalidatePath("/akuntansi/buku-besar")
    revalidatePath("/dashboard/home")

    return { success: true }
  } catch (error: any) {
    console.error("[createManualTransaction] Fatal Transaction error:", error)
    return { success: false, error: error.message || "Gagal menyimpan transaksi." }
  }
}

/**
 * Returns today's general income and expense stats.
 * 
 * @returns {Promise<{ success: boolean, stats: TransactionStats }>} Stats.
 */
export async function getTodayTransactionStats(): Promise<{ success: boolean; stats: TransactionStats }> {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Sum credits/debits of revenues/expenses recorded today
    const [pemasukanLines, pengeluaranLines] = await prisma.$transaction([
      // Pemasukan: revenues increased (credit) or assets increased (debit) from manual pemasukan
      prisma.journal_lines.aggregate({
        _sum: { credit: true },
        where: {
          chart_of_accounts: { type: "revenue" },
          journal_entries: {
            is_posted: true,
            entry_date: { gte: today, lt: tomorrow }
          }
        }
      }),
      // Pengeluaran: expenses increased (debit) from manual pengeluaran
      prisma.journal_lines.aggregate({
        _sum: { debit: true },
        where: {
          chart_of_accounts: { type: "expense" },
          journal_entries: {
            is_posted: true,
            entry_date: { gte: today, lt: tomorrow }
          }
        }
      })
    ])

    return {
      success: true,
      stats: {
        pemasukanHariIni: Number(pemasukanLines._sum.credit || 0),
        pengeluaranHariIni: Number(pengeluaranLines._sum.debit || 0)
      }
    }
  } catch (error: any) {
    console.error("[getTodayTransactionStats] Error:", error)
    return {
      success: false,
      stats: { pemasukanHariIni: 0, pengeluaranHariIni: 0 }
    }
  }
}

/**
 * Seeds default manual transactions if none exist in the database.
 * 
 * @returns {Promise<void>}
 */
async function ensureDefaultTransactions(): Promise<void> {
  const unit = await prisma.unit.findFirst()
  if (!unit) return
  const unitId = unit.id

  // Check if there are already any manual entries
  const existing = await prisma.journal_entries.findFirst({
    where: { source: "manual" }
  })
  if (existing) return

  // Seed default COAs first
  await ensureDefaultAccounts()

  // Find COAs
  const kasUtama = await prisma.chart_of_accounts.findFirst({ where: { unit_id: unitId, code: "10101" } })
  const bankMandiri = await prisma.chart_of_accounts.findFirst({ where: { unit_id: unitId, code: "10102" } })
  const CSGaji = await prisma.chart_of_accounts.findFirst({ where: { unit_id: unitId, code: "50101" } })
  const ATK = await prisma.chart_of_accounts.findFirst({ where: { unit_id: unitId, code: "50102" } })
  const jasaKop = await prisma.chart_of_accounts.findFirst({ where: { unit_id: unitId, code: "40101" } })
  const penjualanKop = await prisma.chart_of_accounts.findFirst({ where: { unit_id: unitId, code: "40102" } })

  if (!kasUtama || !bankMandiri || !CSGaji || !ATK || !jasaKop || !penjualanKop) return

  const dummyTxList = [
    {
      description: "Pembelian ATK Koperasi Kantor",
      notes: "Kertas A4, Pulpen, dan Binder Clip",
      type: "pengeluaran" as const,
      amount: 150000,
      account: kasUtama,
      category: ATK,
      offsetDays: 0
    },
    {
      description: "Pembayaran Gaji Cleaning Service",
      notes: "Gaji kebersihan kantor bulan berjalan",
      type: "pengeluaran" as const,
      amount: 750000,
      account: bankMandiri,
      category: CSGaji,
      offsetDays: 1
    },
    {
      description: "Penerimaan Jasa Konsultasi Anggota",
      notes: "Jasa pendampingan administrasi pinjaman mandiri",
      type: "pemasukan" as const,
      amount: 1200000,
      account: bankMandiri,
      category: jasaKop,
      offsetDays: 2
    },
    {
      description: "Hasil Penjualan Produk Toko Harian",
      notes: "Penerimaan kas POS toko retail harian",
      type: "pemasukan" as const,
      amount: 2400000,
      account: kasUtama,
      category: penjualanKop,
      offsetDays: 3
    }
  ]

  for (const item of dummyTxList) {
    const txDate = new Date()
    txDate.setDate(txDate.getDate() - item.offsetDays)

    const dateStr = txDate.toISOString().split("T")[0].replace(/-/g, "")
    const randomSuffix = String(Math.floor(1000 + Math.random() * 9000))
    const entryNo = `TX-${dateStr}-${randomSuffix}`

    await prisma.$transaction(async (tx) => {
      const entry = await tx.journal_entries.create({
        data: {
          unit_id: unitId,
          entry_no: entryNo,
          entry_date: txDate,
          description: item.description,
          reference: item.category.name,
          source: "manual",
          is_posted: true,
          created_at: txDate,
          updated_at: txDate
        }
      })

      if (item.type === "pengeluaran") {
        // Debit Expense
        await tx.journal_lines.create({
          data: {
            journal_id: entry.id,
            account_id: item.category.id,
            debit: item.amount,
            credit: 0,
            description: item.notes,
            created_at: txDate,
            updated_at: txDate
          }
        })

        // Credit Asset
        await tx.journal_lines.create({
          data: {
            journal_id: entry.id,
            account_id: item.account.id,
            debit: 0,
            credit: item.amount,
            description: item.notes,
            created_at: txDate,
            updated_at: txDate
          }
        })
      } else {
        // Debit Asset
        await tx.journal_lines.create({
          data: {
            journal_id: entry.id,
            account_id: item.account.id,
            debit: item.amount,
            credit: 0,
            description: item.notes,
            created_at: txDate,
            updated_at: txDate
          }
        })

        // Credit Revenue
        await tx.journal_lines.create({
          data: {
            journal_id: entry.id,
            account_id: item.category.id,
            debit: 0,
            credit: item.amount,
            description: item.notes,
            created_at: txDate,
            updated_at: txDate
          }
        })
      }
    })
  }
}

/**
 * Fetches the list of recent manual transactions to populate the "Transaksi Terkini" list.
 * 
 * @param {number} limit - Maximum rows to pull.
 * @returns {Promise<{ success: boolean, entries: RecentTransactionItem[] }>} Recent entries.
 */
export async function getRecentTransactions(limit = 10): Promise<{ success: boolean; entries: RecentTransactionItem[] }> {
  try {
    // Seed default transactions if empty
    await ensureDefaultTransactions()

    const entries = await prisma.journal_entries.findMany({
      where: { source: "manual" },
      include: {
        journal_lines: {
          include: { chart_of_accounts: true }
        }
      },
      orderBy: { entry_date: "desc" },
      take: limit
    })

    const result: RecentTransactionItem[] = []

    for (const e of entries) {
      // Manual entries have exactly 2 lines: one Debit, one Credit
      const debitLine = e.journal_lines.find(l => Number(l.debit) > 0)
      const creditLine = e.journal_lines.find(l => Number(l.credit) > 0)

      if (!debitLine || !creditLine) continue

      // Detect if it is Income or Expense
      // Pengeluaran: Category is Expense (Debit), Account is Asset (Credit)
      // Pemasukan: Account is Asset (Debit), Category is Revenue (Credit)
      const isExpense = debitLine.chart_of_accounts.type === "expense"
      
      const categoryName = isExpense ? debitLine.chart_of_accounts.name : creditLine.chart_of_accounts.name
      const accountName = isExpense ? creditLine.chart_of_accounts.name : debitLine.chart_of_accounts.name
      const amount = isExpense ? Number(debitLine.debit) : Number(creditLine.credit)

      result.push({
        id: Number(e.id),
        entry_no: e.entry_no,
        entry_date: e.entry_date.toISOString().split("T")[0],
        description: e.description,
        amount,
        type: isExpense ? "pengeluaran" : "pemasukan",
        category_name: categoryName,
        account_name: accountName,
        created_at: e.created_at ? e.created_at.toISOString() : new Date().toISOString()
      })
    }

    return {
      success: true,
      entries: result
    }
  } catch (error: any) {
    console.error("[getRecentTransactions] Error:", error)
    return {
      success: false,
      entries: []
    }
  }
}
