import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getAuditLogs, getRoleSummary, getTimelineSummary } from "@/lib/actions/audit-log"
import { LogClient } from "./log-client"
import { ShieldAlert } from "lucide-react"

const ALLOWED_ROLES = ["superadmin", "admin", "pengurus", "ketua"] as const

export default async function LogPage({
  searchParams,
}: {
  searchParams: {
    search?: string
    category?: string
    action?: string
    role?: string
    from?: string
    to?: string
    page?: string
    tab?: string
  }
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const userRole = session.user.role as string
  if (!(ALLOWED_ROLES as readonly string[]).includes(userRole)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <ShieldAlert className="h-16 w-16 text-red-400" />
        <h2 className="text-xl font-bold">Akses Ditolak</h2>
        <p className="text-muted-foreground text-sm max-w-xs">
          Anda tidak memiliki izin untuk mengakses halaman Log Aktivitas.
        </p>
      </div>
    )
  }

  // Next.js 15: await searchParams
  const sp = await searchParams

  const filters = {
    search:   sp.search   ?? "",
    category: sp.category ?? "all",
    action:   sp.action   ?? "all",
    role:     sp.role     ?? "all",
    from:     sp.from     ?? "",
    to:       sp.to       ?? "",
    page:     Number(sp.page ?? "1"),
    tab:      sp.tab      ?? "log",
  }

  // Fetch semua data paralel
  const [result, roleSummary, timeline] = await Promise.all([
    getAuditLogs({
      search:   filters.search   || undefined,
      category: filters.category === "all" ? undefined : filters.category,
      action:   filters.action   === "all" ? undefined : filters.action,
      role:     filters.role     === "all" ? undefined : filters.role,
      from:     filters.from     || undefined,
      to:       filters.to       || undefined,
      page:     filters.page,
    }),
    getRoleSummary(filters.from || undefined, filters.to || undefined),
    getTimelineSummary(
      filters.from || undefined,
      filters.to   || undefined,
      filters.role === "all" ? undefined : filters.role
    ),
  ])

  const periodLabel =
    filters.from && filters.to
      ? `${filters.from} s/d ${filters.to}`
      : "Bulan Ini"

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-indigo-500" />
          Log Aktivitas Sistem
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Riwayat perubahan data, approval, dan aktivitas pengguna berperan (Admin · Pengurus · Ketua · Kasir)
          {" · "} Periode: {periodLabel}
        </p>
      </div>

      <LogClient
        result={result}
        roleSummary={roleSummary}
        timeline={timeline}
        filters={filters}
      />
    </div>
  )
}
