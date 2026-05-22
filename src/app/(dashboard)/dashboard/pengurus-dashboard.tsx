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
  const bg: Record<string, string> = {
    indigo:  "bg-indigo-50  border-indigo-100  dark:bg-indigo-950/30  dark:border-indigo-900/40",
    emerald: "bg-emerald-50 border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900/40",
    rose:    "bg-rose-50    border-rose-100    dark:bg-rose-950/30    dark:border-rose-900/40",
    amber:   "bg-amber-50   border-amber-100   dark:bg-amber-950/30   dark:border-amber-900/40",
    blue:    "bg-blue-50    border-blue-100    dark:bg-blue-950/30    dark:border-blue-900/40",
    violet:  "bg-violet-50  border-violet-100  dark:bg-violet-950/30  dark:border-violet-900/40",
  }
  const iconBg: Record<string, string> = {
    indigo:  "bg-indigo-600",
    emerald: "bg-emerald-600",
    rose:    "bg-rose-600",
    amber:   "bg-amber-500",
    blue:    "bg-blue-600",
    violet:  "bg-violet-600",
  }
  const textColor: Record<string, string> = {
    indigo:  "text-indigo-900  dark:text-indigo-100",
    emerald: "text-emerald-900 dark:text-emerald-100",
    rose:    "text-rose-900    dark:text-rose-100",
    amber:   "text-amber-900   dark:text-amber-100",
    blue:    "text-blue-900    dark:text-blue-100",
    violet:  "text-violet-900  dark:text-violet-100",
  }

  return (
    <Card className={`border ${bg[color]}`}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className={`text-sm font-semibold ${textColor[color]} opacity-80`}>
          {title}
        </CardTitle>
        <div className={`h-9 w-9 rounded-xl ${iconBg[color]} flex items-center justify-center shadow-sm flex-shrink-0`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-extrabold tracking-tight ${textColor[color]}`}>
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
        <Button size="sm" variant="outline" onClick={loadData} disabled={loading} className="self-start sm:self-auto">
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
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">
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
            ].map(({ label, val }) => (
              <div key={label} className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5 break-all">{val}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SEKSI 2: KESEHATAN KREDIT
      ════════════════════════════════════════════════════════════════════════ */}
      <section>
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">
          🏦 Kesehatan Kredit
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {/* NPL */}
          <Card className="border-rose-100 dark:border-rose-900/40">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-rose-800 dark:text-rose-300">Rasio NPL</CardTitle>
                <AlertTriangle className="h-4 w-4 text-rose-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-extrabold text-rose-600">
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
              <div className="mt-2 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
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
              <p className="text-[10px] text-slate-400 mt-1">Batas aman: &lt;5% (OJK)</p>
            </CardContent>
          </Card>

          {/* Pending Approvals */}
          <Card className="border-amber-100 dark:border-amber-900/40">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-amber-800 dark:text-amber-300">Antrean Persetujuan</CardTitle>
                <ShieldCheck className="h-4 w-4 text-amber-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-amber-600">
                {loading ? "—" : exec?.loanHealth.pendingApprovals ?? 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Pengajuan pinjaman menunggu verifikasi</p>
              <Link href="/pinjaman/approval">
                <Button size="sm" variant="outline" className="mt-3 w-full text-xs border-amber-200 text-amber-700 hover:bg-amber-50">
                  Buka Approval Center →
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Jatuh Tempo 7 Hari */}
          <Card className="border-indigo-100 dark:border-indigo-900/40">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-indigo-800 dark:text-indigo-300">Jatuh Tempo (7 Hari)</CardTitle>
                <Clock className="h-4 w-4 text-indigo-500" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Memuat...</p>
              ) : (exec?.loanHealth.dueSoon.length ?? 0) === 0 ? (
                <p className="text-sm text-emerald-600 font-medium">Tidak ada tagihan jatuh tempo</p>
              ) : (
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {exec!.loanHealth.dueSoon.map((d, i) => (
                    <div key={i} className="flex justify-between items-start text-xs border-b border-slate-50 dark:border-slate-800 pb-1.5 last:border-0">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-100 leading-tight">{d.member_name}</p>
                        <p className="text-slate-400">{d.loan_no} · {d.due_date}</p>
                      </div>
                      <span className="font-bold text-rose-600 shrink-0 ml-2">{fmtShort(d.amount_due)}</span>
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
      <section>
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">
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
          <Card className="md:col-span-2 lg:col-span-5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Pertumbuhan Anggota Baru (12 Bulan)</CardTitle>
            </CardHeader>
            <CardContent>
              {loading || !exec?.membershipStats.growthByMonth.length ? (
                <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
                  {loading ? "Memuat grafik..." : "Belum ada data pendaftaran"}
                </div>
              ) : (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={exec.membershipStats.growthByMonth.map(g => ({
                      ...g, label: fmtMonth(g.month)
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip formatter={(v) => [`${v} anggota`, "Baru"]} />
                      <Bar dataKey="new_members" name="Anggota Baru" fill="#6366f1" radius={[4, 4, 0, 0]} />
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
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">
          💸 Arus Kas (12 Bulan Terakhir)
        </h2>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Pemasukan vs Pengeluaran</CardTitle>
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
                  <AreaChart data={exec.cashFlowMonthly.map(c => ({
                    ...c, label: fmtMonth(c.label)
                  }))}>
                    <defs>
                      <linearGradient id="gradPemasukan" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}    />
                      </linearGradient>
                      <linearGradient id="gradPengeluaran" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#f43f5e" stopOpacity={0.20} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={(v) => `${fmtShort(v)}`} tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(v, name) => [fmt(Number(v)), name]}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px" }} />
                    <Area
                      type="monotone" dataKey="pemasukan" name="Pemasukan"
                      stroke="#10b981" strokeWidth={2} fill="url(#gradPemasukan)"
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
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">
          ⚡ Tindakan Cepat
        </h2>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {[
            { href: "/akuntansi/transaksi",         icon: Receipt,     label: "Input Transaksi",      color: "from-blue-500 to-blue-700" },
            { href: "/pinjaman/approval",            icon: ShieldCheck, label: "Approval Pinjaman",    color: "from-amber-500 to-orange-600" },
            { href: "/akuntansi/laporan-keuangan",  icon: FileText,    label: "Lap. Keuangan RAT",    color: "from-emerald-500 to-teal-600" },
            { href: "/laporan/analitik",             icon: TrendingUp,  label: "Analitik Toko",        color: "from-violet-500 to-purple-700" },
            { href: "/laporan/potongan-gaji",        icon: CreditCard,  label: "Potongan Gaji",        color: "from-rose-500 to-red-600" },
            { href: "/akuntansi/pembagian-shu",      icon: Wallet,      label: "Pembagian SHU",        color: "from-indigo-500 to-indigo-700" },
          ].map(({ href, icon: Icon, label, color }) => (
            <Link key={href} href={href}>
              <div className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md active:scale-95 transition-all cursor-pointer">
                <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-sm`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 text-center leading-tight">
                  {label}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Timestamp */}
      {exec && (
        <p className="text-[10px] text-slate-300 dark:text-slate-700 text-center mt-2">
          Data diambil dari database pada {new Date(exec.generatedAt).toLocaleString("id-ID")}
        </p>
      )}
    </div>
  )
}
