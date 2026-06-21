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
  Package, BookOpen
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
        { href: "/dashboard?forceDashboard=true",  label: "Transaksi", icon: BarChart3 },
        { href: "/simpanan",                       label: "Simpanan",  icon: Wallet },
        { href: "/pinjaman",                       label: "Pinjaman",  icon: CreditCard },
        { href: "/toko",                           label: "Toko",      icon: ShoppingBag },
        { href: "/profil",                         label: "Profil",    icon: User },
      ]

    case "kasir":
      return [
        { href: "/dashboard/home",    label: "Beranda",  icon: Home },
        { href: "/toko/kasir",        label: "Kasir",    icon: Store, matchPrefixes: ["/toko/kasir"] },
        { href: "/toko/pesanan",      label: "Pesanan",  icon: Package },
        { href: "/laporan/harian",    label: "Laporan",  icon: FileText },
        { href: "/profil",            label: "Profil",   icon: User },
      ]

    case "admin":
      return [
        { href: "/dashboard/home",    label: "Beranda",  icon: Home },
        { href: "/anggota",           label: "Anggota",  icon: User },
        { href: "/toko/produk",       label: "Produk",   icon: Package },
        { href: "/laporan/analitik",  label: "Laporan",  icon: BarChart3 },
        { href: "/pengaturan",        label: "Pengaturan", icon: Settings },
      ]

    case "pengurus":
    case "ketua":
      return [
        { href: "/dashboard/home",       label: "Beranda",  icon: Home },
        { href: "/anggota",              label: "Anggota",  icon: User },
        { href: "/pinjaman/approval",    label: "Approval", icon: BookOpen, matchPrefixes: ["/pinjaman"] },
        { href: "/laporan/analitik",     label: "Analitik", icon: BarChart3 },
        { href: "/pengaturan",           label: "Pengaturan", icon: Settings },
      ]

    case "superadmin":
    default:
      return [
        { href: "/dashboard/home",    label: "Beranda",  icon: Home },
        { href: "/anggota",           label: "Anggota",  icon: User },
        { href: "/laporan/analitik",  label: "Laporan",  icon: BarChart3 },
        { href: "/pengaturan",        label: "Pengaturan", icon: Settings },
        { href: "/log",               label: "Log", icon: Menu },
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
        "bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl",
        "border-t border-zinc-200/80 dark:border-zinc-800/80",
        // Shadow
        "shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.04)]",
        // Safe area for notch/home indicator
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <div className="flex items-stretch h-16">
        {tabs.map((tab: any) => {
          const Icon = tab.icon

          // Active detection: exact match or prefix match
          const hrefPath = tab.href.split("?")[0]
          const isActive =
            pathname === hrefPath ||
            (tab.matchPrefixes?.some((p: any) => pathname.startsWith(p))) ||
            (hrefPath !== "/dashboard" && hrefPath !== "/dashboard/home" && pathname.startsWith(hrefPath + "/"))

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                // Layout
                "flex flex-1 flex-col items-center justify-center gap-0.5 transform active:scale-[0.95]",
                // Touch target
                "min-h-12",
                // Active press state
                "active:bg-zinc-50 dark:active:bg-zinc-900",
                // Transition
                "transition-all duration-150",
              )}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    "h-5 w-5 transition-all duration-200",
                    isActive
                      ? "text-primary scale-110"
                      : "text-zinc-400 dark:text-zinc-500"
                  )}
                />
                {/* Active indicator dot */}
                {isActive && (
                  <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </div>
              <span
                className={cn(
                  "text-[11px] leading-tight font-medium transition-colors duration-200",
                  isActive
                    ? "text-primary font-semibold"
                    : "text-zinc-400 dark:text-zinc-500"
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
