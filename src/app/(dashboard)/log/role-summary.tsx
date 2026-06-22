"use client"

import type { RoleSummaryRow, TimelineDayRow } from "@/lib/actions/audit-log"

const ROLE_BADGE: Record<string, string> = {
  superadmin: "bg-red-100 text-red-700 border-red-200",
  admin:      "bg-violet-100 text-violet-700 border-violet-200",
  pengurus:   "bg-blue-100 text-blue-700 border-blue-200",
  ketua:      "bg-amber-100 text-amber-700 border-amber-200",
  kasir:      "bg-teal-100 text-teal-700 border-teal-200",
}

const ACTION_COLOR: Record<string, string> = {
  CREATE: "#16a34a", UPDATE: "#ca8a04", DELETE: "#dc2626",
  APPROVE: "#059669", REJECT: "#e11d48", RESET_PASSWORD: "#ea580c",
  LOGIN: "#0284c7", LOGIN_FAILED: "#b91c1c", LOGOUT: "#64748b",
}

const ACTION_LABEL: Record<string, string> = {
  CREATE: "Tambah", UPDATE: "Ubah", DELETE: "Hapus",
  APPROVE: "Approve", REJECT: "Tolak", RESET_PASSWORD: "Reset PW",
  LOGIN: "Login", LOGIN_FAILED: "Login Gagal", LOGOUT: "Logout",
}

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Super Admin", admin: "Admin",
  pengurus: "Pengurus", ketua: "Ketua", kasir: "Kasir",
}

// ─── Role Cards ───────────────────────────────────────────────────────────────

export function RoleSummaryPanel({ data }: { data: RoleSummaryRow[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground text-sm">
        Tidak ada aktivitas dalam periode ini.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Role Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {data.map((r: any) => (
          <div key={r.role} className={`rounded-xl border p-4 shadow-sm ${ROLE_BADGE[r.role] ?? "bg-slate-50"}`}>
            <p className="text-xs font-bold uppercase tracking-wider opacity-70">{ROLE_LABEL[r.role] ?? r.role}</p>
            <p className="text-3xl font-black mt-1">{r.total.toLocaleString("id-ID")}</p>
            <p className="text-[11px] opacity-60 mt-0.5">aktivitas</p>
          </div>
        ))}
      </div>

      {/* Per Role Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {data.map((r: any) => (
          <div key={r.role} className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className={`px-4 py-3 border-b flex items-center justify-between ${ROLE_BADGE[r.role] ?? ""}`}>
              <span className="font-bold text-sm">{ROLE_LABEL[r.role] ?? r.role}</span>
              <span className="text-xs font-mono opacity-70">{r.total} aktivitas</span>
            </div>

            {/* Action breakdown */}
            <div className="px-4 py-3 space-y-1.5 border-b">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Breakdown Aksi</p>
              {(Object.entries(r.byAction) as [string, number][])
                .sort(([, a], [, b]) => b - a)
                .map(([action, count]) => {
                  const pct = Math.round((count / r.total) * 100)
                  return (
                    <div key={action} className="flex items-center gap-2">
                      <span className="text-[10px] w-24 shrink-0" style={{ color: ACTION_COLOR[action] ?? "#64748b" }}>
                        {ACTION_LABEL[action] ?? action}
                      </span>
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: ACTION_COLOR[action] ?? "#94a3b8" }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground w-8 text-right">{count}</span>
                    </div>
                  )
                })}
            </div>

            {/* Top users */}
            <div className="px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Top Pengguna</p>
              <div className="space-y-1">
                {r.users.slice(0, 5).map((u: any, i: any) => (
                  <div key={u.username} className="flex items-center gap-2 text-xs">
                    <span className="w-4 text-muted-foreground text-[10px] text-right">{i + 1}.</span>
                    <span className="flex-1 font-medium truncate">{u.full_name ?? u.username}</span>
                    <span className="font-mono text-muted-foreground">{u.count}×</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Timeline Panel ───────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  superadmin: "#ef4444", admin: "#8b5cf6",
  pengurus: "#3b82f6", ketua: "#f59e0b", kasir: "#14b8a6",
}

function fmtDate(d: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(d))
}

export function TimelinePanel({ data }: { data: TimelineDayRow[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground text-sm">
        Tidak ada aktivitas dalam periode ini.
      </div>
    )
  }

  const maxTotal = Math.max(...data.map((d: any) => d.total), 1)
  const roles    = [...new Set(data.flatMap((d: any) => Object.keys(d.byRole)))]

  return (
    <div className="space-y-5">
      {/* Bar chart */}
      <div className="rounded-xl border bg-card shadow-sm p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
          Aktivitas Per Hari
        </p>
        <div className="flex items-end gap-1 overflow-x-auto pb-2" style={{ minHeight: 120 }}>
          {data.map((day: any) => {
            const h = Math.max(4, Math.round((day.total / maxTotal) * 100))
            return (
              <div key={day.date} className="flex flex-col items-center gap-1 shrink-0" style={{ minWidth: 28 }}>
                <span className="text-[9px] text-muted-foreground">{day.total}</span>
                <div className="w-5 rounded-t-sm bg-indigo-500 transition-all" style={{ height: h }} title={`${fmtDate(day.date)}: ${day.total}`} />
                <span className="text-[9px] text-muted-foreground rotate-45 origin-left mt-1 whitespace-nowrap">{fmtDate(day.date)}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Role legend */}
      <div className="flex flex-wrap gap-3">
        {roles.map((r: any) => (
          <div key={r} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ROLE_COLORS[r] ?? "#94a3b8" }} />
            <span className="text-xs">{ROLE_LABEL[r] ?? r}</span>
          </div>
        ))}
      </div>

      {/* Day table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900 text-xs text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2.5 font-semibold">Tanggal</th>
              <th className="text-right px-4 py-2.5 font-semibold">Total</th>
              {roles.map((r: any) => (
                <th key={r} className="text-right px-3 py-2.5 font-semibold">
                  <span style={{ color: ROLE_COLORS[r] }}>{ROLE_LABEL[r] ?? r}</span>
                </th>
              ))}
              <th className="text-left px-4 py-2.5 font-semibold">Aksi Terbanyak</th>
            </tr>
          </thead>
          <tbody>
            {[...data].reverse().map((day: any, i: any) => {
              const topAction = (Object.entries(day.byAction) as [string, number][]).sort(([, a], [, b]) => b - a)[0]
              return (
                <tr key={day.date} className={i % 2 === 0 ? "" : "bg-slate-50/50 dark:bg-slate-900/30"}>
                  <td className="px-4 py-2 font-medium">{fmtDate(day.date)}</td>
                  <td className="px-4 py-2 text-right font-bold">{day.total}</td>
                  {roles.map((r: any) => (
                    <td key={r} className="px-3 py-2 text-right text-muted-foreground">
                      {day.byRole[r] ?? 0}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {topAction ? (
                      <span style={{ color: ACTION_COLOR[topAction[0]] }}>
                        {ACTION_LABEL[topAction[0]] ?? topAction[0]} ({topAction[1]})
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
