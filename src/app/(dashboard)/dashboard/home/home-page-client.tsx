"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Wallet, CreditCard, ShoppingBag, User, ChevronLeft, ChevronRight } from "lucide-react"

export function DashboardHomePage({ 
  settings, 
  promotions, 
  todayOrders,
  dashboardConfig 
}: { 
  settings: any; 
  promotions: any[]; 
  todayOrders: any[];
  dashboardConfig?: { show_financial_stats?: boolean }
}) {
  const activePromotions = promotions.filter(p => p.is_active) || []
  const ads = activePromotions.length > 0 ? activePromotions : [
    {
      id: 1,
      title: "Diskon 20% untuk Anggota Baru",
      description: "Dapatkan diskon spesial untuk produk pilihan.",
      image_url: "/koperasi.png",
    },
    {
      id: 2,
      title: "Simpanan Berjangka Tinggi Bunga",
      description: "Investasi aman dengan bunga kompetitif.",
      image_url: "/koperasi.png",
    },
    {
      id: 3,
      title: "Belanja Online Mudah & Cepat",
      description: "Nikmati kemudahan berbelanja dari rumah.",
      image_url: "/koperasi.png",
    },
  ]

  const [currentSlide, setCurrentSlide] = useState(0)
  const [statsPeriod, setStatsPeriod] = useState<"weekly"|"monthly"|"yearly">("monthly")

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % ads.length)
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + ads.length) % ads.length)

  return (
    <div className="space-y-6 p-4 md:max-w-3xl md:mx-auto">
      <div className="rounded-3xl border border-slate-200 bg-white/95 dark:bg-slate-950/90 dark:border-slate-800 p-6 shadow-sm text-center">
        <div className="relative mx-auto h-20 w-20 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700 bg-slate-50">
          <Image
            src={settings?.logo_url || "/koperasi.png"}
            alt="Logo Koperasi"
            fill
            className="object-contain p-3"
          />
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-100">{settings?.company_name || "Koperasi Digital"}</h1>
        <p className="text-sm text-muted-foreground mt-2">Halaman Home setelah login. Akses cepat fitur utama dan ringkasan hari ini.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Link href="/simpanan" className="flex flex-col items-center rounded-3xl border border-slate-200 bg-white p-4 text-center shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-950">
          <Wallet className="mb-2 h-8 w-8 text-blue-600" />
          <span className="text-sm font-semibold">Simpanan</span>
        </Link>
        <Link href="/pinjaman" className="flex flex-col items-center rounded-3xl border border-slate-200 bg-white p-4 text-center shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-950">
          <CreditCard className="mb-2 h-8 w-8 text-emerald-600" />
          <span className="text-sm font-semibold">Pinjaman</span>
        </Link>
        <Link href="/toko" className="flex flex-col items-center rounded-3xl border border-slate-200 bg-white p-4 text-center shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-950">
          <ShoppingBag className="mb-2 h-8 w-8 text-amber-600" />
          <span className="text-sm font-semibold">Toko</span>
        </Link>
        <Link href="/profil" className="flex flex-col items-center rounded-3xl border border-slate-200 bg-white p-4 text-center shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-950">
          <User className="mb-2 h-8 w-8 text-violet-600" />
          <span className="text-sm font-semibold">Profil</span>
        </Link>
      </div>

      {dashboardConfig?.show_financial_stats && (
        <Card className="border-indigo-100 dark:border-indigo-900/50 shadow-sm overflow-hidden">
          <CardHeader className="bg-indigo-50/50 dark:bg-indigo-950/20 pb-4 border-b border-indigo-100 dark:border-indigo-900/50">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="text-lg text-indigo-900 dark:text-indigo-300">Statistik Koperasi Global</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Transparansi keuangan dan operasional koperasi</p>
              </div>
              <div className="flex bg-white dark:bg-slate-900 rounded-full p-1 border shadow-sm self-stretch sm:self-auto">
                <button 
                  onClick={() => setStatsPeriod('weekly')}
                  className={`flex-1 sm:flex-none px-3 py-1 text-xs font-medium rounded-full transition-colors ${statsPeriod === 'weekly' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  Mingguan
                </button>
                <button 
                  onClick={() => setStatsPeriod('monthly')}
                  className={`flex-1 sm:flex-none px-3 py-1 text-xs font-medium rounded-full transition-colors ${statsPeriod === 'monthly' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  Bulanan
                </button>
                <button 
                  onClick={() => setStatsPeriod('yearly')}
                  className={`flex-1 sm:flex-none px-3 py-1 text-xs font-medium rounded-full transition-colors ${statsPeriod === 'yearly' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  Tahunan
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Transaksi</p>
                <p className="text-2xl font-bold text-slate-700 dark:text-slate-200">
                  {statsPeriod === 'weekly' ? '142' : statsPeriod === 'monthly' ? '684' : '8,245'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Keuntungan (SHU)</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {statsPeriod === 'weekly' ? 'Rp 4,2M' : statsPeriod === 'monthly' ? 'Rp 18,5M' : 'Rp 225M'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pengeluaran</p>
                <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                  {statsPeriod === 'weekly' ? 'Rp 1,1M' : statsPeriod === 'monthly' ? 'Rp 4,8M' : 'Rp 56M'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Saldo Kas Koperasi</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  Rp 1,45 Triliun
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Promosi & Iklan</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative overflow-hidden rounded-b-2xl bg-slate-950 text-white">
            <div className="flex transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
              {ads.map((ad) => (
                <div key={ad.id} className="w-full flex-shrink-0 p-5">
                  <div className="rounded-3xl bg-gradient-to-r from-blue-600 via-slate-900 to-purple-700 p-5 text-center shadow-xl">
                    {ad.image_url && ad.image_url !== "/koperasi.png" ? (
                      <div className="mb-3">
                        <Image src={ad.image_url} alt={ad.title} width={200} height={100} className="mx-auto rounded-lg object-cover" />
                      </div>
                    ) : null}
                    <h3 className="font-semibold text-sm uppercase tracking-[0.2em] text-blue-100">{ad.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-100/90">{ad.description}</p>
                    {ad.link_url && (
                      <Link href={ad.link_url} className="mt-3 inline-block text-xs text-blue-200 hover:text-white underline">
                        Pelajari lebih lanjut
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={prevSlide} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-900 shadow-md hover:bg-white">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={nextSlide} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-900 shadow-md hover:bg-white">
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
              {ads.map((_, index) => (
                <span key={index} className={`h-2 w-2 rounded-full ${index === currentSlide ? 'bg-white' : 'bg-white/40'}`} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Riwayat Belanja Hari Ini</CardTitle>
        </CardHeader>
        <CardContent>
          {todayOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Belum ada belanja hari ini.</p>
          ) : (
            <div className="space-y-3">
              {todayOrders.slice(0, 5).map((order: any) => (
                <div key={order.id} className="flex justify-between items-center border-b pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-semibold">Order #{order.order_no}</p>
                    <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleTimeString('id-ID')}</p>
                  </div>
                  <span className="font-bold text-amber-600">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(order.grand_total)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
