"use server"

import { prisma } from "@/lib/db/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { logAudit } from "@/lib/actions/log-audit"

// ─────────────────────────────────────────────────────────────────────────────
// Types & Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface FixedAssetItem {
  id: string
  name: string
  category: "Peralatan" | "KENDARAAN" | "BANGUNAN"
  condition: "BARU" | "BAIK" | "RUSAK"
  acquisitionDate: string
  acquisitionCost: number
}

export interface CreateFixedAssetInput {
  name: string
  category: "Peralatan" | "KENDARAAN" | "BANGUNAN"
  condition: "BARU" | "BAIK" | "RUSAK"
  acquisitionCost: number
  acquisitionDate: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Services
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Helper to ensure default fixed assets exist in the database.
 * Seeds the three mock assets matching the user mockup if none exist.
 * 
 * @returns {Promise<void>}
 */
async function ensureDefaultFixedAssets(): Promise<void> {
  const unit = await prisma.unit.findFirst()
  if (!unit) return

  const unitId = unit.id

  // Check if we have any fixed asset accounts (prefix 12)
  const existingAssets = await prisma.chart_of_accounts.findFirst({
    where: {
      unit_id: unitId,
      code: { startsWith: "12" }
    }
  })

  if (existingAssets) return

  // Seed default fixed assets
  const defaults = [
    {
      code: "12101",
      name: "Laptop Admin Lenovo [BARU]",
      category: "Peralatan" as const,
      condition: "BARU" as const,
      cost: 9500000,
      date: "2026-02-01"
    },
    {
      code: "12201",
      name: "Motor Operasional Supra X [BAIK]",
      category: "KENDARAAN" as const,
      condition: "BAIK" as const,
      cost: 16000000,
      date: "2024-02-10"
    },
    {
      code: "12301",
      name: "Gedung Kantor Koperasi Pusat [BAIK]",
      category: "BANGUNAN" as const,
      condition: "BAIK" as const,
      cost: 350000000,
      date: "2023-05-10"
    }
  ]

  // Find a cash account to credit (debit fixed asset, credit cash)
  let cashAccount = await prisma.chart_of_accounts.findFirst({
    where: { unit_id: unitId, code: "10101" } // Kas Utama
  })

  if (!cashAccount) {
    cashAccount = await prisma.chart_of_accounts.findFirst({
      where: { unit_id: unitId, type: "asset" }
    })
  }

  if (!cashAccount) return

  // Seed each default asset with double-entry journal posting
  for (const item of defaults) {
    await prisma.$transaction(async (tx: any) => {
      // 1. Create COA account for Fixed Asset
      const coa = await tx.chart_of_accounts.create({
        data: {
          unit_id: unitId,
          code: item.code,
          name: item.name,
          type: "asset",
          normal_balance: "debit",
          level: 1,
          is_header: false,
          is_active: true,
          created_at: new Date(item.date),
          updated_at: new Date(item.date)
        }
      })

      // 2. Create Journal Entry
      const entryNo = `TX-FA-${item.code}-${String(Math.floor(1000 + Math.random() * 9000))}`
      const entry = await tx.journal_entries.create({
        data: {
          unit_id: unitId,
          entry_no: entryNo,
          entry_date: new Date(item.date),
          description: `Perolehan Aset Tetap: ${item.name.split(" [")[0]}`,
          reference: "Pencatatan Aset Baru",
          source: "manual",
          is_posted: true,
          created_at: new Date(item.date),
          updated_at: new Date(item.date)
        }
      })

      // 3. Journal Lines: Debit Fixed Asset Account
      await tx.journal_lines.create({
        data: {
          journal_id: entry.id,
          account_id: coa.id,
          debit: item.cost,
          credit: 0,
          description: `Debit Perolehan Aset: ${item.name.split(" [")[0]}`,
          created_at: new Date(item.date),
          updated_at: new Date(item.date)
        }
      })

      // 4. Journal Lines: Credit Cash Account
      await tx.journal_lines.create({
        data: {
          journal_id: entry.id,
          account_id: cashAccount!.id,
          debit: 0,
          credit: item.cost,
          description: `Kredit Kas untuk Pembelian Aset: ${item.name.split(" [")[0]}`,
          created_at: new Date(item.date),
          updated_at: new Date(item.date)
        }
      })
    })
  }
}

/**
 * Fetches all fixed assets registered in the database (represented in COA with codes starting with 12).
 * Seeds defaults automatically if no assets are found.
 * 
 * @returns {Promise<{ success: boolean, assets: FixedAssetItem[], error?: string }>} The result containing the asset list.
 */
export async function getFixedAssets(): Promise<{ success: boolean; assets: FixedAssetItem[]; error?: string }> {
  try {
    const unit = await prisma.unit.findFirst()
    if (!unit) {
      return { success: false, assets: [], error: "Unit koperasi belum dikonfigurasi." }
    }
    const unitId = unit.id

    // Seed defaults if empty
    await ensureDefaultFixedAssets()

    // Fetch all accounts starting with 12 (Fixed Assets)
    const assetCoas = await prisma.chart_of_accounts.findMany({
      where: {
        unit_id: unitId,
        code: { startsWith: "12" },
        is_active: true
      },
      include: {
        journal_lines: {
          include: {
            journal_entries: true
          }
        }
      },
      orderBy: { code: "asc" }
    })

    const results: FixedAssetItem[] = []

    for (const coa of assetCoas) {
      // Extract clean name and condition from formatted name (e.g. "Laptop [BARU]" -> name: "Laptop", condition: "BARU")
      let cleanName = coa.name
      let condition: "BARU" | "BAIK" | "RUSAK" = "BAIK"

      if (coa.name.includes(" [") && coa.name.endsWith("]")) {
        const parts = coa.name.split(" [")
        cleanName = parts[0]
        const condRaw = parts[1].replace("]", "")
        if (condRaw === "BARU" || condRaw === "BAIK" || condRaw === "RUSAK") {
          condition = condRaw
        }
      }

      // Calculate cost based on ledger debit lines (acquisition cost)
      const cost = coa.journal_lines.reduce((sum: any, line: any) => sum + Number(line.debit) - Number(line.credit), 0)

      // Get acquisition date from earliest journal entry or fallback to coa created_at
      let acquisitionDate = coa.created_at ? coa.created_at.toISOString().split("T")[0] : new Date().toISOString().split("T")[0]
      if (coa.journal_lines.length > 0) {
        const sortedLines = [...coa.journal_lines].sort(
          (a, b) => new Date(a.journal_entries.entry_date).getTime() - new Date(b.journal_entries.entry_date).getTime()
        )
        acquisitionDate = sortedLines[0].journal_entries.entry_date.toISOString().split("T")[0]
      }

      // Resolve category based on prefix code
      let category: "Peralatan" | "KENDARAAN" | "BANGUNAN" = "Peralatan"
      if (coa.code.startsWith("122")) {
        category = "KENDARAAN"
      } else if (coa.code.startsWith("123")) {
        category = "BANGUNAN"
      }

      results.push({
        id: `AST-${coa.code}`,
        name: cleanName,
        category,
        condition,
        acquisitionDate,
        acquisitionCost: cost > 0 ? cost : 0
      })
    }

    return {
      success: true,
      assets: results
    }
  } catch (error: any) {
    console.error("[getFixedAssets] Fatal Exception:", error)
    return {
      success: false,
      assets: [],
      error: error.message || "Gagal mengambil daftar aset tetap."
    }
  }
}

/**
 * Creates and registers a new fixed asset. Creates a COA record and posts a double-entry journal line.
 * 
 * @param {CreateFixedAssetInput} input - The asset input.
 * @returns {Promise<{ success: boolean, error?: string }>} The result.
 */
export async function createFixedAsset(input: CreateFixedAssetInput): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth()
    if (!session?.user) {
      return { success: false, error: "Sesi kedaluwarsa. Silakan login kembali." }
    }
    const userId = BigInt(session.user.id)

    const unit = await prisma.unit.findFirst()
    if (!unit) {
      return { success: false, error: "Unit koperasi tidak ditemukan." }
    }
    const unitId = unit.id

    if (!input.name.trim()) {
      return { success: false, error: "Nama aset tidak boleh kosong." }
    }
    if (input.acquisitionCost <= 0) {
      return { success: false, error: "Nilai perolehan harus lebih besar dari Rp 0." }
    }

    // Determine prefix code based on category
    const prefix = input.category === "Peralatan" ? "121" : input.category === "KENDARAAN" ? "122" : "123"

    // Find the next available account code
    const siblingCoas = await prisma.chart_of_accounts.findMany({
      where: {
        unit_id: unitId,
        code: { startsWith: prefix }
      },
      select: { code: true }
    })

    let maxIndex = 0
    siblingCoas.forEach((c: any) => {
      const idx = parseInt(c.code.substring(3), 10)
      if (!isNaN(idx) && idx > maxIndex) {
        maxIndex = idx
      }
    })

    const nextIndex = maxIndex + 1
    const nextCode = `${prefix}${String(nextIndex).padStart(2, "0")}`
    const formattedName = `${input.name.trim()} [${input.condition}]`

    // Find cash account to credit
    let cashAccount = await prisma.chart_of_accounts.findFirst({
      where: { unit_id: unitId, code: "10101" } // Kas Utama
    })

    if (!cashAccount) {
      cashAccount = await prisma.chart_of_accounts.findFirst({
        where: { unit_id: unitId, type: "asset" }
      })
    }

    if (!cashAccount) {
      return { success: false, error: "Rekening kas untuk pembayaran pembelian aset tidak ditemukan." }
    }

    const dateParsed = new Date(input.acquisitionDate)

    // Execute in a robust database transaction block
    await prisma.$transaction(async (tx: any) => {
      // 1. Create COA Account for Fixed Asset
      const coa = await tx.chart_of_accounts.create({
        data: {
          unit_id: unitId,
          code: nextCode,
          name: formattedName,
          type: "asset",
          normal_balance: "debit",
          level: 1,
          is_header: false,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      })

      // 2. Create Journal Entry
      const entryNo = `TX-FA-${nextCode}-${String(Math.floor(1000 + Math.random() * 9000))}`
      const entry = await tx.journal_entries.create({
        data: {
          unit_id: unitId,
          entry_no: entryNo,
          entry_date: dateParsed,
          description: `Perolehan Aset Tetap: ${input.name.trim()}`,
          reference: "Pencatatan Aset Baru",
          source: "manual",
          posted_by: userId,
          posted_at: new Date(),
          is_posted: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      })

      // 3. Ledger Lines: Debit Fixed Asset Account
      await tx.journal_lines.create({
        data: {
          journal_id: entry.id,
          account_id: coa.id,
          debit: input.acquisitionCost,
          credit: 0,
          description: `Debit Perolehan Aset: ${input.name.trim()}`,
          created_at: new Date(),
          updated_at: new Date()
        }
      })

      // 4. Ledger Lines: Credit Cash Account
      await tx.journal_lines.create({
        data: {
          journal_id: entry.id,
          account_id: cashAccount!.id,
          debit: 0,
          credit: input.acquisitionCost,
          description: `Kredit Kas Pembelian Aset: ${input.name.trim()}`,
          created_at: new Date(),
          updated_at: new Date()
        }
      })
    })

    // Log the audit trial
    await logAudit({
      action: "CREATE",
      modelType: "chart_of_accounts",
      modelId: null,
      newValues: { code: nextCode, name: input.name, cost: input.acquisitionCost }
    })

    revalidatePath("/akuntansi/aset-tetap")
    revalidatePath("/dashboard/home")

    return { success: true }
  } catch (error: any) {
    console.error("[createFixedAsset] Exception:", error)
    return { success: false, error: error.message || "Gagal menyimpan aset baru." }
  }
}

/**
 * Memperbarui detail nama dan kondisi aset tetap fisik di database.
 * 
 * @param {string} code - Kode rekening aset tetap yang akan diperbarui (misal: "12101").
 * @param {object} data - Data baru berupa nama dan kondisi aset.
 * @returns {Promise<{ success: boolean; error?: string }>} Hasil status operasi.
 */
export async function updateFixedAsset(
  code: string,
  data: { name: string; condition: "BARU" | "BAIK" | "RUSAK" }
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth()
    if (!session?.user) {
      return { success: false, error: "Sesi kedaluwarsa. Silakan login kembali." }
    }

    const unit = await prisma.unit.findFirst()
    if (!unit) {
      return { success: false, error: "Unit koperasi tidak ditemukan." }
    }

    const formattedName = `${data.name.trim()} [${data.condition}]`

    const account = await prisma.chart_of_accounts.findFirst({
      where: { unit_id: unit.id, code },
    })

    if (!account) {
      return { success: false, error: "Rekening aset tetap tidak ditemukan." }
    }

    await prisma.chart_of_accounts.update({
      where: { id: account.id },
      data: { name: formattedName, updated_at: new Date() },
    })

    await logAudit({
      action: "UPDATE",
      modelType: "chart_of_accounts",
      modelId: Number(account.id),
      newValues: { code, name: data.name, condition: data.condition },
    })

    revalidatePath("/akuntansi/aset-tetap")
    return { success: true }
  } catch (error: any) {
    console.error("[updateFixedAsset] Exception:", error)
    return { success: false, error: error.message || "Gagal memperbarui aset." }
  }
}

/**
 * Menghapus/menonaktifkan aset tetap dari dashboard dengan menandai rekening is_active = false.
 * Hal ini menjaga keutuhan audit ledger transaksi historis ganda.
 * 
 * @param {string} code - Kode rekening aset tetap yang akan dinonaktifkan (misal: "12101").
 * @returns {Promise<{ success: boolean; error?: string }>} Hasil status operasi.
 */
export async function deleteFixedAsset(code: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth()
    if (!session?.user) {
      return { success: false, error: "Sesi kedaluwarsa. Silakan login kembali." }
    }

    const unit = await prisma.unit.findFirst()
    if (!unit) {
      return { success: false, error: "Unit koperasi tidak ditemukan." }
    }

    const account = await prisma.chart_of_accounts.findFirst({
      where: { unit_id: unit.id, code },
    })

    if (!account) {
      return { success: false, error: "Rekening aset tetap tidak ditemukan." }
    }

    await prisma.chart_of_accounts.update({
      where: { id: account.id },
      data: { is_active: false, updated_at: new Date() },
    })

    await logAudit({
      action: "DELETE",
      modelType: "chart_of_accounts",
      modelId: Number(account.id),
      newValues: { code, is_active: false },
    })

    revalidatePath("/akuntansi/aset-tetap")
    return { success: true }
  } catch (error: any) {
    console.error("[deleteFixedAsset] Exception:", error)
    return { success: false, error: error.message || "Gagal menonaktifkan aset." }
  }
}

