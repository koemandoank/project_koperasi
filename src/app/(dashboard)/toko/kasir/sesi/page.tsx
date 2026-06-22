import { auth } from "@/auth"
import { redirect } from "next/navigation"
import {
  getCashRegisterStatus,
  getCashRegisterSessions,
} from "@/lib/actions/pos-transactions"
import { SesiKasirClient } from "./sesi-client"
import { CreditCard, ShieldAlert } from "lucide-react"

const ALLOWED_ROLES = ["superadmin", "admin", "kasir", "pengurus", "ketua"] as const

export default async function SesiKasirPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const role = session.user.role as string
  if (!(ALLOWED_ROLES as readonly string[]).includes(role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <ShieldAlert className="h-16 w-16 text-red-400" />
        <h2 className="text-xl font-bold">Akses Ditolak</h2>
        <p className="text-muted-foreground text-sm">Anda tidak memiliki akses ke halaman ini.</p>
      </div>
    )
  }

  // Fetch status kasir untuk dapat daftar register + registerId dinamis
  const statusResult = await getCashRegisterStatus()
  const registers    = statusResult.success ? (statusResult.data ?? []) : []
  const firstRegId   = registers[0]?.id ?? 1

  // Fetch riwayat 30 sesi terakhir kasir pertama
  const historyResult = await getCashRegisterSessions(BigInt(firstRegId), 30)

  // Serialize Date fields → string untuk client component
  const history = historyResult.success
    ? (historyResult.data ?? []).map((s: any) => ({
        ...s,
        session_date: typeof s.session_date === "string"
          ? s.session_date
          : (s.session_date as any)?.toISOString?.().slice(0, 10) ?? String(s.session_date),
        opened_at: typeof s.opened_at === "string"
          ? s.opened_at
          : (s.opened_at as any)?.toISOString?.() ?? String(s.opened_at),
        closed_at: s.closed_at
          ? (typeof s.closed_at === "string" ? s.closed_at : (s.closed_at as any)?.toISOString?.() ?? String(s.closed_at))
          : null,
      }))
    : []

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-indigo-500" />
          Sesi Kasir
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Buka sesi sebelum mulai transaksi · Tutup sesi di akhir hari untuk rekap kas
        </p>
      </div>

      <SesiKasirClient
        registers={registers}
        history={history}
        currentUser={(session.user as any).username ?? session.user.name ?? '-'}
      />
    </div>
  )
}
