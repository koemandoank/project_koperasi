"use client"

/**
 * BottomNav — Bottom Navigation Bar (Mobile Only)
 *
 * Displays role-specific navigation tabs fixed at the bottom of the screen.
 * Hidden on desktop (md+). Uses Capacitor safe-area-inset-bottom for notch support.
 *
 * @param role - Current user role from NextAuth session
 */

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Home, Wallet, CreditCard, ShoppingBag, User,
  Store, FileText, Settings, BarChart3, Menu,
  LayoutDashboard, Package, Truck, BookOpen
} from "lucide-react"

// ─────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────

interface NavTab {
  href: string
  label: string
  icon: React.ElementType
  /** Additional hrefs that should also mark this tab as active */
  matchPrefixes?: string[]
}

// ─────────────────────────────────────────────
// Role-based Tab Definitions
// ─────────────────────────────────────────────

/**
 * Returns the 4-5 tabs to display in the bottom nav for the given role.
 *
 * @param role - User role string from session
 * @returns Array of NavTab objects
 */
function getTabsForRole(role: string): NavTab[] {
  switch (role) {
    case "anggota":
      return [
        { href: "/dashboard/home",                 label: "Beranda",   icon: Home },
        { href: "/dashboard?forceDashboard=true",  label: "Transaksi", icon: LayoutDashboard },
        { href: "/simpanan",                       label: "Simpanan",  icon: Wallet },
        { href: "/pinjaman",                       label: "Pinjaman",  icon: CreditCard },
        { href: "/toko",                           label: "Toko",      icon: ShoppingBag },
        { href: "/profil",                         label: "Profil",    icon: User },
      ]

    case "kasir":
      return [
        { href: "/dashboard",         label: "Beranda",  icon: Home },
        { href: "/toko/kasir",        label: "Kasir",    icon: Store, matchPrefixes: ["/toko/kasir"] },
        { href: "/toko/pesanan",      label: "Pesanan",  icon: Package },
        { href: "/laporan/harian",    label: "Laporan",  icon: FileText },
        { href: "/profil",            label: "Profil",   icon: User },
      ]

    case "admin":
      return [
        { href: "/dashboard",         label: "Beranda",  icon: Home },
        { href: "/anggota",           label: "Anggota",  icon: User },
        { href: "/toko/produk",       label: "Produk",   icon: Package },
        { href: "/laporan/analitik",  label: "Laporan",  icon: BarChart3 },
        { href: "/pengaturan",        label: "Pengaturan", icon: Settings },
      ]

    case "pengurus":
    case "ketua":
      return [
        { href: "/dashboard",         label: "Beranda",  icon: LayoutDashboard },
        { href: "/toko",              label: "Toko",     icon: Store, matchPrefixes: ["/toko", "/pembelian"] },
        { href: "/laporan/analitik",  label: "Analitik", icon: BarChart3 },
        { href: "/akuntansi/buku-besar", label: "Akuntansi", icon: BookOpen },
        { href: "/pengaturan",        label: "Pengaturan", icon: Settings },
      ]

    case "superadmin":
    default:
      return [
        { href: "/dashboard",         label: "Beranda",  icon: Home },
        { href: "/anggota",           label: "Anggota",  icon: User },
        { href: "/laporan/analitik",  label: "Laporan",  icon: BarChart3 },
        { href: "/pengaturan",        label: "Pengaturan", icon: Settings },
        { href: "/dashboard?forceDashboard=true", label: "Menu", icon: Menu },
      ]
  }
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function BottomNav({ role }: { role: string }) {
  const pathname = usePathname()
  const tabs = getTabsForRole(role)

  return (
    <nav
      aria-label="Navigasi utama"
      className={cn(
        // Position
        "fixed bottom-0 inset-x-0 z-50",
        // Only show on mobile
        "md:hidden",
        // Background & border
        "bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl",
        "border-t border-slate-200/80 dark:border-slate-800",
        // Shadow
        "shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.08)]",
        // Safe area for notch/home indicator
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <div className="flex items-stretch h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon

          // Active detection: exact match or prefix match
          const hrefPath = tab.href.split("?")[0]
          const isActive =
            pathname === hrefPath ||
            (tab.matchPrefixes?.some((p) => pathname.startsWith(p))) ||
            (hrefPath !== "/dashboard" && hrefPath !== "/dashboard/home" && pathname.startsWith(hrefPath + "/"))

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                // Layout
                "flex flex-1 flex-col items-center justify-center gap-0.5",
                // Touch target
                "min-h-12",
                // Active press state
                "active:bg-slate-50 dark:active:bg-slate-900",
                // Transition
                "transition-colors duration-150",
              )}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    "h-5 w-5 transition-all duration-200",
                    isActive
                      ? "text-blue-600 dark:text-blue-400 scale-110"
                      : "text-slate-400 dark:text-slate-500"
                  )}
                />
                {/* Active indicator dot */}
                {isActive && (
                  <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                )}
              </div>
              <span
                className={cn(
                  "text-[11px] leading-tight font-medium transition-colors duration-200",
                  isActive
                    ? "text-blue-600 dark:text-blue-400 font-semibold"
                    : "text-slate-400 dark:text-slate-500"
                )}
              >
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
