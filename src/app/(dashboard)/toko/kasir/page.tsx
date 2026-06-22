import { getProducts } from "@/lib/actions/products"
import { getMembers } from "@/lib/actions/members"
import { getCashRegisterStatus } from "@/lib/actions/pos-transactions"
import { PosClient } from "./pos-client"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Unlock, AlertTriangle } from "lucide-react"

export default async function PosPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  // Cek sesi kasir aktif
  const statusResult = await getCashRegisterStatus()
  const registers    = statusResult.success ? (statusResult.data ?? []) : []
  const hasActiveSession = registers.some((r: any) => r.active_session !== null)

  // Fetch produk & anggota secara paralel
  const [products, members] = await Promise.all([
    getProducts(),
    getMembers(),
  ])

  const activeProducts = products.filter((p: any) => p.is_active)

  return (
    <div className="p-4 md:p-6 bg-slate-50/50 dark:bg-background/50 h-[calc(100vh-4rem)]">
      {/* Banner peringatan jika sesi belum dibuka */}
      {!hasActiveSession && (
        <div className="mb-4 flex items-center gap-4 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 px-4 py-3 shadow-sm">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Sesi Kasir Belum Dibuka
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Anda harus membuka sesi kasir terlebih dahulu sebelum dapat melakukan transaksi.
            </p>
          </div>
          <a
            href="/toko/kasir/sesi"
            className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-colors shrink-0"
          >
            <Unlock className="h-4 w-4" /> Buka Sesi
          </a>
        </div>
      )}

      <PosClient
        products={activeProducts}
        members={members}
        sessionActive={hasActiveSession}
      />
    </div>
  )
}
