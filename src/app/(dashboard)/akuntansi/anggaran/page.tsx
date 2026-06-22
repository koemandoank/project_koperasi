import React from "react"
import { getBudgets } from "@/lib/actions/budgets"
import { AnggaranClient } from "./anggaran-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * AnggaranPage - Server Component
 * 
 * Mengambil data pos anggaran koperasi dari database (dengan auto-seeding jika kosong)
 * dan mendelegasikan fungsionalitas interaktif ke Client Component AnggaranClient.
 */
export default async function AnggaranPage() {
  const budgets = await getBudgets()

  return <AnggaranClient initialBudgets={budgets} />
}
