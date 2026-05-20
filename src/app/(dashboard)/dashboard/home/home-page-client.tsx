"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Wallet, CreditCard, ShoppingBag, User, ChevronLeft, ChevronRight, Home, Megaphone, Clock } from "lucide-react"
import { getGlobalFinancialStats } from "@/lib/actions/global-financial-stats"

// ─── Tipe ────────────────────────────────────────────────────────────────────
type StatsPeriod = "weekly" | "monthly" | "yearly"
type MobileTab   = "beranda" | "promosi" | "riwayat"

// ─── Props ───────────────────────────────────────────────────────────────────
interface Props {
  settings: any
  promotions: any[]
  todayOrders: any[]
  dashboardConfig?: { show_financial_stats?: boolean }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const FALLBACK_ADS = [
  { id: 1, title: "Diskon 20% untuk Anggota Baru",      description: "Dapatkan diskon spesial untuk produk pilihan.",    image_url: "/koperasi.png", link_url: null },
  { id: 2, title: "Simpanan Berjangka Tinggi Bunga",    description: "Investasi aman dengan bunga kompetitif.",          image_url: "/koperasi.png", link_url: null },
  { id: 3, title: "Belanja Online Mudah & Cepat",       description: "Nikmati kemudahan berbelanja dari rumah.",         image_url: "/koperasi.png", link_url: null },
]

const formatRupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n)

// ─── Sub-komponen Statistik ───────────────────────────────────────────────────
function StatsCard({ period, setPeriod }: { period: StatsPeriod; setPeriod: (p: StatsPeriod) => void }) {
  const [financialData, setFinancialData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    getGlobalFinancialStats(period).then(res => {
      if (active) {
        setFinancialData(res)
        setLoading(false)
      }
    }).catch(err => {
      console.error(err)
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [period])

  const tabBtn = (label: string, key: StatsPeriod) => (
    <button
      key={key}
      onClick={() => setPeriod(key)}
      className={`flex-1 sm:flex-none px-3 py-1 text-xs font-medium rounded-full transition-colors ${
        period === key
          ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
          : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      }`}
    >
      {label}
    </button>
  )

  const formatVal = (label: string, value: number, isCurrency: boolean = true) => {
    if (loading) return "Memuat..."
    if (!financialData) return "—"
    if (isCurrency) {
      return formatRupiah(value)
    }
    return value.toLocaleString("id-ID")
  }

  const items = [
    { label: "Total Transaksi",    value: formatVal("Total Transaksi", financialData?.totalTransaksi || 0, false), color: "text-slate-700 dark:text-slate-200" },
    { label: "Keuntungan (SHU)",   value: formatVal("Keuntungan (SHU)", financialData?.keuntunganSHU || 0),        color: "text-emerald-600 dark:text-emerald-400" },
    { label: "Pengeluaran",        value: formatVal("Pengeluaran", financialData?.pengeluaranOperasional || 0),    color: "text-rose-600 dark:text-rose-400" },
    { label: "Saldo Kas Koperasi", value: formatVal("Saldo Kas Koperasi", financialData?.saldoKas || 0),           color: "text-blue-600 dark:text-blue-400" },
  ]

  return (
    <Card className="border-indigo-100 dark:border-indigo-900/50 shadow-sm overflow-hidden">
      <CardHeader className="bg-indigo-50/50 dark:bg-indigo-950/20 pb-4 border-b border-indigo-100 dark:border-indigo-900/50">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <CardTitle className="text-base text-indigo-900 dark:text-indigo-300">Statistik Koperasi</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Transparansi keuangan &amp; operasional</p>
          </div>
          <div className="flex bg-white dark:bg-slate-900 rounded-full p-1 border shadow-sm">
            {tabBtn("Mingguan", "weekly")}
            {tabBtn("Bulanan",  "monthly")}
            {tabBtn("Tahunan",  "yearly")}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-2 gap-3">
          {items.map(({ label, value, color }) => (
            <div key={label} className="space-y-0.5">
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Sub-komponen Carousel Promosi ────────────────────────────────────────────
function PromosiCarousel({ ads }: { ads: typeof FALLBACK_ADS }) {
  const [slide, setSlide] = useState(0)
  const next = () => setSlide((p) => (p + 1) % ads.length)
  const prev = () => setSlide((p) => (p - 1 + ads.length) % ads.length)

  return (
    <Card>
      {/* Header hanya tampil di desktop */}
      <CardHeader className="hidden md:block">
        <CardTitle className="text-lg">Promosi &amp; Iklan</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative overflow-hidden rounded-2xl bg-slate-950 text-white">
          <div
            className="flex transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(-${slide * 100}%)` }}
          >
            {ads.map((ad) => (
              <div key={ad.id} className="w-full flex-shrink-0 p-4">
                <div className="rounded-2xl bg-gradient-to-r from-blue-600 via-slate-900 to-purple-700 p-4 text-center shadow-xl">
                  {ad.image_url && ad.image_url !== "/koperasi.png" && (
                    <div className="mb-2">
                      <Image src={ad.image_url} alt={ad.title} width={200} height={100} className="mx-auto rounded-lg object-cover" />
                    </div>
                  )}
                  <h3 className="font-semibold text-sm uppercase tracking-[0.15em] text-blue-100">{ad.title}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-100/90">{ad.description}</p>
                  {ad.link_url && (
                    <Link href={ad.link_url} className="mt-2 inline-block text-xs text-blue-200 hover:text-white underline">
                      Pelajari lebih lanjut
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
          {ads.length > 1 && (
            <>
              <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-slate-900 shadow-md hover:bg-white">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-slate-900 shadow-md hover:bg-white">
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
            {ads.map((_, i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === slide ? "bg-white" : "bg-white/40"}`} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Sub-komponen Riwayat Belanja ─────────────────────────────────────────────
function RiwayatBelanja({ orders }: { orders: any[] }) {
  return (
    <Card>
      {/* Header hanya tampil di desktop */}
      <CardHeader className="hidden md:block">
        <CardTitle className="text-lg">Riwayat Belanja Hari Ini</CardTitle>
      </CardHeader>
      <CardContent className={orders.length === 0 ? "" : "p-0"}>
        {orders.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <Clock className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            Belum ada belanja hari ini.
          </div>
        ) : (
          <div className="divide-y">
            {orders.slice(0, 10).map((order: any) => (
              <div key={order.id} className="flex justify-between items-center px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">Order #{order.order_no}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.created_at).toLocaleTimeString("id-ID")}
                  </p>
                </div>
                <span className="font-bold text-amber-600 text-sm">
                  {formatRupiah(order.grand_total)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Komponen Menu Shortcut ───────────────────────────────────────────────────
function MenuShortcut() {
  const menus = [
    { href: "/simpanan",  icon: <Wallet      className="mb-1.5 h-7 w-7 text-blue-600" />,   label: "Simpanan" },
    { href: "/pinjaman",  icon: <CreditCard  className="mb-1.5 h-7 w-7 text-emerald-600" />, label: "Pinjaman" },
    { href: "/toko",      icon: <ShoppingBag className="mb-1.5 h-7 w-7 text-amber-600" />,   label: "Toko" },
    { href: "/profil",    icon: <User        className="mb-1.5 h-7 w-7 text-violet-600" />,  label: "Profil" },
  ]
  return (
    <div className="grid grid-cols-4 gap-2">
      {menus.map(({ href, icon, label }) => (
        <Link
          key={href}
          href={href}
          className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white py-3 px-1 text-center shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-950"
        >
          {icon}
          <span className="text-xs font-semibold">{label}</span>
        </Link>
      ))}
    </div>
  )
}

// ─── Komponen Utama ───────────────────────────────────────────────────────────
export function DashboardHomePage({ settings, promotions, todayOrders, dashboardConfig }: Props) {
  const [activeTab,  setActiveTab]  = useState<MobileTab>("beranda")
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>("monthly")

  const ads = promotions.filter((p) => p.is_active).length > 0
    ? promotions.filter((p) => p.is_active)
    : FALLBACK_ADS

  // ── Tab Navigation (hanya mobile) ──────────────────────────────────────────
  const tabs: { key: MobileTab; label: string; icon: React.ReactNode }[] = [
    { key: "beranda", label: "Beranda", icon: <Home      className="h-4 w-4" /> },
    { key: "promosi", label: "Promosi", icon: <Megaphone className="h-4 w-4" /> },
    { key: "riwayat", label: "Riwayat", icon: <Clock     className="h-4 w-4" /> },
  ]

  return (
    <div className="md:max-w-3xl md:mx-auto">
      {/* ── DESKTOP: layout stacked biasa (tidak diubah sama sekali) ─────────── */}
      <div className="hidden md:flex md:flex-col gap-6 p-4">
        {/* Welcome Card */}
        <div className="rounded-3xl border border-slate-200 bg-white/95 dark:bg-slate-950/90 dark:border-slate-800 p-6 shadow-sm text-center">
          <div className="relative mx-auto h-20 w-20 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700 bg-slate-50">
            <Image
              src={settings?.logo_url || "/koperasi.png"}
              alt="Logo Koperasi"
              fill
              className="object-contain p-3"
            />
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-100">
            {settings?.company_name || "Koperasi Sulfindo"}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Halaman Home setelah login. Akses cepat fitur utama dan ringkasan hari ini.
          </p>
        </div>

        {/* Menu 2x2 */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { href: "/simpanan", icon: <Wallet className="mb-2 h-8 w-8 text-blue-600" />,      label: "Simpanan" },
            { href: "/pinjaman", icon: <CreditCard className="mb-2 h-8 w-8 text-emerald-600" />, label: "Pinjaman" },
            { href: "/toko",     icon: <ShoppingBag className="mb-2 h-8 w-8 text-amber-600" />,  label: "Toko" },
            { href: "/profil",   icon: <User className="mb-2 h-8 w-8 text-violet-600" />,        label: "Profil" },
          ].map(({ href, icon, label }) => (
            <Link key={href} href={href} className="flex flex-col items-center rounded-3xl border border-slate-200 bg-white p-4 text-center shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-950">
              {icon}
              <span className="text-sm font-semibold">{label}</span>
            </Link>
          ))}
        </div>

        {dashboardConfig?.show_financial_stats && (
          <StatsCard period={statsPeriod} setPeriod={setStatsPeriod} />
        )}

        <PromosiCarousel ads={ads} />
        <RiwayatBelanja orders={todayOrders} />
      </div>

      {/* ── MOBILE: Sistem TAB ────────────────────────────────────────────────── */}
      <div className="md:hidden flex flex-col" style={{ height: "calc(100dvh - 120px)" }}>
        {/* Tab Nav Bar */}
        <div className="flex bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4">
          {tabs.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                activeTab === key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500"
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content — scrollable */}
        <div className="flex-1 overflow-y-auto">

          {/* TAB: Beranda */}
          {activeTab === "beranda" && (
            <div className="space-y-4 p-4">
              <MenuShortcut />
              {dashboardConfig?.show_financial_stats && (
                <StatsCard period={statsPeriod} setPeriod={setStatsPeriod} />
              )}
            </div>
          )}

          {/* TAB: Promosi */}
          {activeTab === "promosi" && (
            <div className="p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Promosi &amp; Iklan Aktif</p>
              <PromosiCarousel ads={ads} />
              {/* Daftar ringkas semua promosi */}
              <div className="space-y-2">
                {ads.map((ad) => (
                  <div key={ad.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3 flex gap-3 items-start">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex-shrink-0 flex items-center justify-center">
                      <Megaphone className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">{ad.title}</p>
                      {ad.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ad.description}</p>}
                      {ad.link_url && (
                        <Link href={ad.link_url} className="mt-1 inline-block text-xs text-blue-600 hover:underline">
                          Lihat selengkapnya →
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: Riwayat */}
          {activeTab === "riwayat" && (
            <div className="p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Riwayat Belanja Hari Ini</p>
              <RiwayatBelanja orders={todayOrders} />
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
