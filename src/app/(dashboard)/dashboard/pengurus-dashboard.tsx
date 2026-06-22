"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import {
  Landmark, Wallet, TrendingUp, CreditCard,
  AlertTriangle, Clock, Users, UserCheck, UserMinus,
  FileText, ShieldCheck, Receipt, RefreshCw,
  ArrowUpRight, ArrowDownRight, Activity,
} from "lucide-react"
import { getExecutiveDashboardData, type ExecutiveDashboardData } from "@/lib/actions/executive-dashboard"
import { RestockNotificationWidget } from "@/components/shared/restock-notification-widget"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", maximumFractionDigits: 0,
  }).format(n)

const fmtShort = (n: number): string => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}M`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}Jt`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}Rb`
  return n.toLocaleString("id-ID")
}

const fmtMonth = (ym: string) => {
  if (!ym) return "-"
  const [y, m] = ym.split("-")
  const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"]
  return `${months[Number(m) - 1]} ${y?.slice(2)}`
}

type Supplier   = { id: number; supplier_name: string }
type RestockItem = {
  id: number; name: string; sku: string; stock: number
  min_stock: number; purchase_price: number; category: string
}

interface Props {
  data:        any          // dari getAdminStats (untuk restockAlerts)
  suppliers:   Supplier[]
  companyName?: string
}

// ─── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  title, value, sub, icon: Icon, color = "indigo", trend,
}: {
  title:   string
  value:   string
  sub?:    string
  icon:    React.ElementType
  color?:  "indigo" | "emerald" | "rose" | "amber" | "blue" | "violet"
  trend?:  "up" | "down" | "neutral"
}) {
  const iconColor: Record<string, string> = {
    indigo:  "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10",
    emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
    rose:    "text-rose-600 dark:text-rose-400 bg-rose-500/10",
    amber:   "text-amber-500 dark:text-amber-400 bg-amber-500/10",
    blue:    "text-blue-600 dark:text-blue-400 bg-blue-500/10",
    violet:  "text-violet-600 dark:text-violet-400 bg-violet-500/10",
  }

  return (
    <Card className="border border-zinc-200/60 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 shadow-sm transition-all duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          {title}
        </CardTitle>
        <div className={`h-9 w-9 rounded-xl ${iconColor[color]} flex items-center justify-center flex-shrink-0`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-550">
          {value}
        </div>
        {sub && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            {trend === "up"   && <ArrowUpRight   className="h-3 w-3 text-emerald-500" />}
            {trend === "down" && <ArrowDownRight  className="h-3 w-3 text-rose-500" />}
            {sub}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

/**
 * Dashboard Eksekutif Pengurus Koperasi.
 * Menampilkan: Financial Overview, Loan Health, Membership Stats, Cash Flow, Quick Actions.
 *
 * @param props.data         Data admin stats (untuk restock alerts)
 * @param props.suppliers    Daftar supplier aktif
 * @param props.companyName  Nama perusahaan / koperasi
 */
export function PengurusDashboard({ data, suppliers, companyName = "Koperasi" }: Props) {
  const [exec, setExec]       = useState<ExecutiveDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<string>("")

  const restockAlerts: RestockItem[] = data?.restockAlerts ?? []

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getExecutiveDashboardData()
      setExec(result)
      setLastUpdate(new Date().toLocaleTimeString("id-ID"))
    } catch (err) {
      console.error("[PengurusDashboard] loadData error:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const nplBadgeColor = !exec ? "secondary"
    : exec.loanHealth.nplRatio <= 2 ? "default"
    : exec.loanHealth.nplRatio <= 5 ? "secondary"
    : "destructive"

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-screen-xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">{companyName}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Dashboard Eksekutif · {lastUpdate ? `Diperbarui ${lastUpdate}` : "Memuat data..."}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={loadData} disabled={loading} className="self-start sm:self-auto h-11 px-4 text-sm font-semibold rounded-2xl active:scale-[0.98] transition-transform">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* ── Restock Alert ────────────────────────────────────────────────────── */}
      {restockAlerts.length > 0 && (
        <RestockNotificationWidget restockAlerts={restockAlerts} suppliers={suppliers} />
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          SEKSI 1: RINGKASAN FINANSIAL
      ════════════════════════════════════════════════════════════════════════ */}
      <section>
        <h2 className="text-xs font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest mb-3">
          📊 Ringkasan Finansial (Year-to-Date)
        </h2>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Total Kas & Bank"
            value={loading ? "—" : fmtShort(exec?.financialOverview.totalKasBank ?? 0)}
            sub="Saldo likuid dari COA Aset"
            icon={Landmark}
            color="blue"
          />
          <KpiCard
            title="Total Simpanan Anggota"
            value={loading ? "—" : fmtShort(exec?.financialOverview.totalSimpanan ?? 0)}
            sub="Pokok + Wajib + Sukarela"
            icon={Wallet}
            color="indigo"
          />
          <KpiCard
            title="Pinjaman Beredar"
            value={loading ? "—" : fmtShort(exec?.financialOverview.totalPinjamanBeredar ?? 0)}
            sub="Outstanding principal aktif"
            icon={CreditCard}
            color="amber"
          />
          <KpiCard
            title="Estimasi SHU (YTD)"
            value={loading ? "—" : fmtShort(exec?.financialOverview.estimasiSHU ?? 0)}
            sub="Laba Toko + SP - Beban"
            icon={TrendingUp}
            color={!exec || exec.financialOverview.estimasiSHU >= 0 ? "emerald" : "rose"}
            trend={!exec || exec.financialOverview.estimasiSHU >= 0 ? "up" : "down"}
          />
        </div>

        {/* Detail finansial lengkap */}
        {exec && (
          <div className="mt-3 grid gap-2 grid-cols-2 md:grid-cols-4 text-center">
            {[
              { label: "Total Kas & Bank",    val: fmt(exec.financialOverview.totalKasBank) },
              { label: "Total Simpanan",       val: fmt(exec.financialOverview.totalSimpanan) },
              { label: "Pinjaman Beredar",     val: fmt(exec.financialOverview.totalPinjamanBeredar) },
              { label: "Estimasi SHU (YTD)",   val: fmt(exec.financialOverview.estimasiSHU) },
            ].map(({  label, val  }: any) => (
              <div key={label} className="rounded-xl border border-zinc-200/50 dark:border-zinc-800/85 bg-white dark:bg-zinc-900/50 px-3 py-2">
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">{label}</p>
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100 mt-0.5 break-all">{val}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SEKSI 2: KESEHATAN KREDIT
      ════════════════════════════════════════════════════════════════════════ */}
      <section>
        <h2 className="text-xs font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest mb-3">
          🏦 Kesehatan Kredit
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {/* NPL */}
          <Card className="border border-zinc-200/60 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-zinc-500 dark:text-zinc-400">Rasio NPL</CardTitle>
                <AlertTriangle className="h-4 w-4 text-rose-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-extrabold text-rose-600 dark:text-rose-400">
                  {loading ? "—" : `${exec?.loanHealth.nplRatio ?? 0}%`}
                </span>
                <Badge variant={nplBadgeColor} className="mb-1">
                  {!exec ? "—"
                    : exec.loanHealth.nplRatio <= 2 ? "Sehat"
                    : exec.loanHealth.nplRatio <= 5 ? "Waspada"
                    : "Kritis"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                NPL: {loading ? "—" : fmt(exec?.loanHealth.nplAmount ?? 0)}
              </p>
              <div className="mt-2 h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, exec?.loanHealth.nplRatio ?? 0) * 10}%`,
                    background: !exec || exec.loanHealth.nplRatio <= 2
                      ? "#10b981" : exec.loanHealth.nplRatio <= 5
                      ? "#f59e0b" : "#ef4444",
                  }}
                />
              </div>
              <p className="text-[10px] text-zinc-400 mt-1">Batas aman: &lt;5% (OJK)</p>
            </CardContent>
          </Card>

          {/* Pending Approvals */}
          <Card className="border border-zinc-200/60 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-zinc-500 dark:text-zinc-400">Antrean Persetujuan</CardTitle>
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-primary">
                {loading ? "—" : exec?.loanHealth.pendingApprovals ?? 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Pengajuan pinjaman menunggu verifikasi</p>
              <Link href="/pinjaman/approval">
                <Button size="sm" variant="outline" className="mt-3 w-full text-xs h-10 rounded-2xl active:scale-[0.98] transition-transform">
                  Buka Approval Center →
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Jatuh Tempo 7 Hari */}
          <Card className="border border-zinc-200/60 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-zinc-500 dark:text-zinc-400">Jatuh Tempo (7 Hari)</CardTitle>
                <Clock className="h-4 w-4 text-zinc-500" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Memuat...</p>
              ) : (exec?.loanHealth.dueSoon.length ?? 0) === 0 ? (
                <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Tidak ada tagihan jatuh tempo</p>
              ) : (
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {exec!.loanHealth.dueSoon.map((d: any, i: any) => (
                    <div key={i} className="flex justify-between items-start text-xs border-b border-zinc-100 dark:border-zinc-800 pb-1.5 last:border-0">
                      <div>
                        <p className="font-semibold text-zinc-800 dark:text-zinc-250 leading-tight">{d.member_name}</p>
                        <p className="text-zinc-400 dark:text-zinc-500">{d.loan_no} · {d.due_date}</p>
                      </div>
                      <span className="font-bold text-rose-600 dark:text-rose-450 shrink-0 ml-2">{fmtShort(d.amount_due)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SEKSI 3: STATISTIK KEANGGOTAAN
      ════════════════════════════════════════════════════════════════════════ */}
      {/* ─── Statistik Keanggotaan ─── */}
      <section>
        <h2 className="text-xs font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest mb-3">
          👥 Statistik Keanggotaan
        </h2>
        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7">
          {/* KPI Cards */}
          <div className="md:col-span-2 lg:col-span-2 grid gap-3">
            <KpiCard
              title="Total Anggota"
              value={loading ? "—" : (exec?.membershipStats.total ?? 0).toLocaleString("id-ID")}
              sub="Seluruh status"
              icon={Users}
              color="indigo"
            />
            <KpiCard
              title="Anggota Aktif"
              value={loading ? "—" : (exec?.membershipStats.active ?? 0).toLocaleString("id-ID")}
              sub={loading || !exec ? "" : `${Math.round((exec.membershipStats.active / Math.max(1, exec.membershipStats.total)) * 100)}% dari total`}
              icon={UserCheck}
              color="emerald"
              trend="up"
            />
            <KpiCard
              title="Non-Aktif / Pensiun"
              value={loading ? "—" : (exec?.membershipStats.inactive ?? 0).toLocaleString("id-ID")}
              sub="Inactive + Suspended"
              icon={UserMinus}
              color="rose"
            />
          </div>

          {/* Growth Chart */}
          <Card className="md:col-span-2 lg:col-span-5 border border-zinc-200/60 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-500 dark:text-zinc-400">Pertumbuhan Anggota Baru (12 Bulan)</CardTitle>
            </CardHeader>
            <CardContent>
              {loading || !exec?.membershipStats.growthByMonth.length ? (
                <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
                  {loading ? "Memuat grafik..." : "Belum ada data pendaftaran"}
                </div>
              ) : (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={exec.membershipStats.growthByMonth.map((g: any) => ({
                      ...g, label: fmtMonth(g.month)
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip formatter={(v) => [`${v} anggota`, "Baru"]} />
                      <Bar dataKey="new_members" name="Anggota Baru" fill="oklch(0.643 0.17 162)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SEKSI 4: VISUALISASI ARUS KAS
      ════════════════════════════════════════════════════════════════════════ */}
      <section>
        <h2 className="text-xs font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest mb-3">
          💸 Arus Kas (12 Bulan Terakhir)
        </h2>
        <Card className="border border-zinc-200/60 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base text-zinc-800 dark:text-zinc-150">Pemasukan vs Pengeluaran</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Angsuran masuk + Simpanan + Penjualan vs Pencairan Pinjaman
              </p>
            </div>
            <Activity className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading || !exec?.cashFlowMonthly.length ? (
              <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                {loading ? "Memuat grafik arus kas..." : "Belum ada data arus kas"}
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={exec.cashFlowMonthly.map((c: any) => ({
                    ...c, label: fmtMonth(c.label)
                  }))}>
                    <defs>
                      <linearGradient id="gradPemasukan" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="oklch(0.643 0.17 162)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="oklch(0.643 0.17 162)" stopOpacity={0}    />
                      </linearGradient>
                      <linearGradient id="gradPengeluaran" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#f43f5e" stopOpacity={0.20} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={(v) => `${fmtShort(v)}`} tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(v, name) => [fmt(Number(v)), name]}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px" }} />
                    <Area
                      type="monotone" dataKey="pemasukan" name="Pemasukan"
                      stroke="oklch(0.643 0.17 162)" strokeWidth={2} fill="url(#gradPemasukan)"
                    />
                    <Area
                      type="monotone" dataKey="pengeluaran" name="Pengeluaran"
                      stroke="#f43f5e" strokeWidth={2} fill="url(#gradPengeluaran)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SEKSI 5: TINDAKAN CEPAT (QUICK ACTIONS)
      ════════════════════════════════════════════════════════════════════════ */}
      <section>
        <h2 className="text-xs font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest mb-3">
          ⚡ Tindakan Cepat
        </h2>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {[
            { href: "/akuntansi/transaksi",         icon: Receipt,     label: "Input Transaksi",      color: "from-emerald-500 to-emerald-700" },
            { href: "/pinjaman/approval",            icon: ShieldCheck, label: "Approval Pinjaman",    color: "from-amber-500 to-orange-650" },
            { href: "/akuntansi/laporan-keuangan",  icon: FileText,    label: "Lap. Keuangan RAT",    color: "from-zinc-500 to-zinc-700" },
            { href: "/laporan/analitik",             icon: TrendingUp,  label: "Analitik Toko",        color: "from-zinc-700 to-zinc-900" },
            { href: "/laporan/potongan-gaji",        icon: CreditCard,  label: "Potongan Gaji",        color: "from-rose-500 to-red-650" },
            { href: "/akuntansi/pembagian-shu",      icon: Wallet,      label: "Pembagian SHU",        color: "from-emerald-600 to-teal-800" },
          ].map(({  href, icon: Icon, label, color  }: any) => (
            <Link key={href} href={href}>
              <div className="flex flex-col items-center gap-2 p-3.5 rounded-2xl bg-white dark:bg-zinc-900/50 border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm hover:shadow-md active:scale-95 transition-all cursor-pointer">
                <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-sm`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <span className="text-[11px] font-semibold text-zinc-750 dark:text-zinc-350 text-center leading-tight">
                  {label}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Timestamp */}
      {exec && (
        <p className="text-[10px] text-zinc-400 dark:text-zinc-650 text-center mt-2">
          Data diambil dari database pada {new Date(exec.generatedAt).toLocaleString("id-ID")}
        </p>
      )}
    </div>
  )
}
