"use client"

/**
 * MobileHeader — Top App Bar (Mobile Only)
 *
 * A compact sticky header for mobile screens showing:
 * - Back button (when not on a root page)
 * - Page title (resolved from pathname)
 * - Notification bell + profile avatar
 *
 * Hidden on desktop (md+).
 *
 * @param user - Session user object
 * @param notifications - Array of notification objects
 */

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ChevronLeft, Bell, User as UserIcon, CreditCard, ShoppingBag, X } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────
// Page Title Map — maps pathname prefix → display title
// ─────────────────────────────────────────────

const PAGE_TITLES: Record<string, string> = {
  "/dashboard/home":          "Beranda",
  "/dashboard":               "Dashboard",
  "/anggota":                 "Data Anggota",
  "/akun":                    "Data Akun",
  "/simpanan":                "Simpanan",
  "/pinjaman/produk":         "Produk Pinjaman",
  "/pinjaman/approval":       "Approval Pinjaman",
  "/pinjaman/transaksi":      "Jadwal Cicilan",
  "/pinjaman":                "Pinjaman",
  "/toko/kasir/sesi":         "Sesi Kasir",
  "/toko/kasir":              "Mesin Kasir",
  "/toko/produk":             "Katalog Produk",
  "/toko/pesanan":            "Pesanan Online",
  "/toko/inventaris":         "Inventaris",
  "/toko/konsinyasi":         "Konsinyasi",
  "/toko":                    "Belanja Online",
  "/pembelian":               "Pembelian / PO",
  "/keuangan":                "Hutang & Piutang",
  "/laporan/harian":          "Laporan Harian",
  "/laporan/analitik":        "Analitik & P&L",
  "/laporan/po-konsinyasi":   "Laporan PO & Konsinyasi",
  "/laporan/stok":            "Riwayat Stok",
  "/laporan/potongan-gaji":   "Laporan Gaji",
  "/akuntansi/buku-besar":    "Buku Besar",
  "/akuntansi/tutup-buku":    "Tutup Buku",
  "/pengaturan/shu":          "Pengaturan SHU",
  "/pengaturan/promosi":      "Promosi",
  "/pengaturan/dashboard-anggota": "Dashboard Anggota",
  "/pengaturan":              "Pengaturan",
  "/profil":                  "Profil Saya",
  "/log":                     "Log Aktivitas",
}

/** Root pages that should NOT show a back button */
const ROOT_PATHS = new Set([
  "/dashboard",
  "/dashboard/home",
  "/toko",
  "/profil",
])

/**
 * Resolves a page title from the current pathname.
 * Tries longest-matching prefix first.
 */
function resolveTitle(pathname: string): string {
  // Sort keys by length descending for longest-prefix match
  const sortedKeys = Object.keys(PAGE_TITLES).sort((a, b) => b.length - a.length)
  for (const key of sortedKeys) {
    if (pathname === key || pathname.startsWith(key + "/")) {
      return PAGE_TITLES[key]
    }
  }
  return "Koperasi"
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function MobileHeader({
  user,
  notifications,
}: {
  user: any
  notifications: Array<{ type: string; message: string; count: number; href: string }>
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [notifOpen, setNotifOpen] = useState(false)

  const totalNotif = notifications.reduce((s, n) => s + n.count, 0)
  const title = resolveTitle(pathname)
  const isRoot = ROOT_PATHS.has(pathname)

  const NOTIF_ICONS: Record<string, React.ElementType> = {
    loan: CreditCard,
    order: ShoppingBag,
  }

  return (
    <>
      {/* ── Top App Bar ── */}
      <header
        className={cn(
          // Position
          "fixed top-0 inset-x-0 z-40",
          // Only mobile
          "md:hidden",
          // Background
          "bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl",
          // Border
          "border-b border-slate-200/60 dark:border-slate-800",
          // Shadow
          "shadow-sm",
          // Safe area top (for Android status bar / notch)
          "pt-[env(safe-area-inset-top)]",
        )}
      >
        <div className="flex h-14 items-center justify-between px-2">
          {/* Left: Back Button or Brand */}
          <div className="w-12 flex items-center">
            {!isRoot ? (
              <button
                onClick={() => router.back()}
                aria-label="Kembali"
                className="flex items-center justify-center h-12 w-12 rounded-full active:bg-slate-100 dark:active:bg-slate-800 transition-colors"
              >
                <ChevronLeft className="h-6 w-6 text-slate-700 dark:text-slate-300" />
              </button>
            ) : (
              <div className="h-8 w-8 rounded-lg overflow-hidden ml-2">
                <img src="/icon.jpg" alt="Logo" className="h-full w-full object-cover" />
              </div>
            )}
          </div>

          {/* Center: Page Title */}
          <h1 className="flex-1 text-center text-base font-bold text-slate-900 dark:text-slate-50 truncate px-2">
            {title}
          </h1>

          {/* Right: Bell + Avatar */}
          <div className="w-auto flex items-center gap-1">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(v => !v)}
                aria-label="Notifikasi"
                className="flex items-center justify-center h-12 w-12 rounded-full active:bg-slate-100 dark:active:bg-slate-800 transition-colors relative"
              >
                <Bell className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                {totalNotif > 0 && (
                  <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-red-500 border border-white dark:border-slate-950" />
                )}
              </button>

              {/* Notification Dropdown */}
              {notifOpen && (
                <div className="absolute right-0 top-full mt-1 w-80 max-w-[calc(100vw-1rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <h4 className="font-semibold text-sm">Notifikasi</h4>
                    <div className="flex items-center gap-2">
                      {totalNotif > 0 && (
                        <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">{totalNotif}</span>
                      )}
                      <button onClick={() => setNotifOpen(false)} className="p-1 rounded-full active:bg-slate-100">
                        <X className="h-4 w-4 text-slate-400" />
                      </button>
                    </div>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-slate-400">
                      Tidak ada notifikasi baru.
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-auto no-scrollbar">
                      {notifications.map((n, i) => {
                        const Icon = NOTIF_ICONS[n.type] || Bell
                        return (
                          <Link
                            key={i}
                            href={n.href}
                            onClick={() => setNotifOpen(false)}
                            className="flex items-start gap-3 px-4 py-3 active:bg-slate-50 dark:active:bg-slate-800 border-b last:border-0 transition-colors"
                          >
                            <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                              <Icon className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium leading-tight">{n.message}</p>
                              <p className="text-xs text-slate-400 mt-0.5">Klik untuk lihat →</p>
                            </div>
                            <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold shrink-0">
                              {n.count}
                            </span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Profile Avatar */}
            <Link
              href="/profil"
              className="flex items-center justify-center h-12 w-12 rounded-full active:bg-slate-100 dark:active:bg-slate-800 transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-sm">
                <UserIcon className="h-4 w-4" />
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* Spacer so content doesn't hide behind fixed header */}
      <div className="h-14 md:hidden" aria-hidden="true"
        style={{ height: `calc(3.5rem + env(safe-area-inset-top))` }}
      />
    </>
  )
}
