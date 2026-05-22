"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Home, LayoutDashboard, Users, CreditCard, Wallet, FileText,
  Lock, Unlock, Settings, Store, Package, ClipboardCheck,
  BookOpen, PieChart, ChevronRight, ShoppingBag, Inbox,
  ShoppingCart, TrendingDown, BarChart3, Truck, X, Megaphone,
  Building2, Banknote, Receipt, ShieldAlert, Clock, PlusCircle,
  ArrowLeftRight, Coins, Calculator, Landmark, TrendingUp
} from "lucide-react"


// ─────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  /** Tampil hanya di mobile nav bar */
  mobileOnly?: boolean
}

interface NavGroup {
  groupLabel: string
  icon?: React.ElementType
  items: NavItem[]
  /** Role yang diperbolehkan melihat group ini. Kosong = semua role. */
  roles?: string[]
}

// ─────────────────────────────────────────────
// Navigation Groups — semua group tersedia; visibilitas dikontrol via `roles`
// ─────────────────────────────────────────────

const ALL_GROUPS: NavGroup[] = [
  // ── UMUM ──────────────────────────────────
  {
    groupLabel: "Umum",
    icon: Building2,
    roles: ["superadmin", "admin", "pengurus", "kasir", "anggota"],
    items: [
      { href: "/dashboard/home", label: "Home", icon: Home, mobileOnly: true },
      { href: "/dashboard?forceDashboard=true", label: "Dashboard", icon: LayoutDashboard },
      { href: "/anggota", label: "Data Anggota", icon: Users },
      { href: "/akun", label: "Data Akun User", icon: Lock },
    ],
  },

  // ── SIMPAN PINJAM ─────────────────────────
  {
    groupLabel: "Simpan Pinjam",
    icon: Banknote,
    roles: ["superadmin", "admin", "pengurus", "anggota"],
    items: [
      { href: "/simpanan", label: "Simpanan", icon: Wallet },
      { href: "/pinjaman", label: "Pinjaman Saya", icon: CreditCard },
      { href: "/pinjaman/produk", label: "Produk Pinjaman", icon: CreditCard },
      { href: "/pinjaman/approval", label: "Approval Pinjaman", icon: ClipboardCheck },
    ],
  },

  // ── KEUANGAN ──────────────────────────────
  {
    groupLabel: "Keuangan",
    icon: Banknote,
    roles: ["superadmin", "admin", "pengurus", "kasir"],
    items: [
      { href: "/akuntansi/transaksi",   label: "Transaksi",         icon: ArrowLeftRight },
      { href: "/keuangan",              label: "Keuangan",          icon: Coins },
      { href: "/akuntansi/anggaran",    label: "Anggaran",          icon: Calculator },
      { href: "/akuntansi/aset-tetap",  label: "Aset Tetap",        icon: Landmark },
      { href: "/akuntansi/pembagian-shu", label: "Penyaluran SHU RAT", icon: Coins },
      { href: "/pengaturan/shu",        label: "SHU & Distribusi",  icon: TrendingUp },
    ],
  },

  // ── TOKO ──────────────────────────────────
  {
    groupLabel: "Toko",
    icon: Store,
    roles: ["superadmin", "admin", "pengurus", "kasir", "anggota"],
    items: [
      { href: "/toko/kasir/sesi", label: "Sesi Kasir",      icon: Unlock },
      { href: "/toko/kasir",      label: "Mesin Kasir (POS)", icon: Store },
      { href: "/toko",           label: "Belanja Online",   icon: ShoppingBag },
      { href: "/toko/produk",    label: "Katalog Produk",   icon: Package },
      { href: "/toko/pesanan",   label: "Pesanan Online",   icon: Inbox },
      { href: "/toko/inventaris",label: "Inventaris",       icon: ClipboardCheck },
      { href: "/pembelian",      label: "Pembelian / PO",   icon: Truck },
      { href: "/toko/konsinyasi",label: "Konsinyasi",       icon: Package },
    ],
  },

  // ── LAPORAN & AKUNTANSI ───────────────────
  {
    groupLabel: "Laporan & Akuntansi",
    icon: Receipt,
    roles: ["superadmin", "admin", "pengurus", "kasir"],
    items: [
      { href: "/akuntansi/laporan-keuangan", label: "Laporan Keuangan RAT", icon: FileText },
      { href: "/laporan/partisipasi-anggota", label: "Partisipasi Anggota RAT", icon: Users },
      { href: "/akuntansi/buku-besar",  label: "Buku Besar",              icon: BookOpen },
      { href: "/akuntansi/tutup-buku",  label: "Tutup Buku",              icon: Lock },
      { href: "/laporan/analitik",      label: "Analitik Keuangan",       icon: TrendingUp },
      { href: "/laporan/harian",        label: "Laporan Harian",         icon: FileText },
      { href: "/laporan/po-konsinyasi", label: "Laporan PO & Konsinyasi",  icon: FileText },
      { href: "/laporan/stok",          label: "Riwayat Keluar Masuk Stok", icon: Package },
      { href: "/laporan/potongan-gaji", label: "Laporan Gaji",             icon: FileText },
    ],
  },

  // ── LOG AKTIVITAS ─────────────────────────
  {
    groupLabel: "Log & Audit",
    icon: ShieldAlert,
    roles: ["superadmin", "admin", "pengurus", "ketua"],
    items: [
      { href: "/log",             label: "Log Aktivitas",     icon: ShieldAlert },
      { href: "/toko/kasir/sesi", label: "Riwayat Sesi Kasir", icon: Clock },
    ],
  },

  // ── PENGATURAN ────────────────────────────
  {
    groupLabel: "Pengaturan",
    icon: Settings,
    roles: ["superadmin", "admin", "pengurus"],
    items: [
      { href: "/pengaturan/promosi", label: "Promosi", icon: Megaphone },
      { href: "/pengaturan/dashboard-anggota", label: "Dashboard Anggota", icon: LayoutDashboard },
      { href: "/pengaturan", label: "Pengaturan Umum", icon: Settings },
    ],
  },
]

// ─────────────────────────────────────────────
// Per-item visibility rules per role
// Untuk setiap item, tentukan siapa yang boleh melihatnya
// ─────────────────────────────────────────────

const ITEM_ROLE_MAP: Record<string, string[]> = {
  "/dashboard/home":              ["superadmin", "admin", "pengurus", "kasir", "anggota"],
  "/dashboard?forceDashboard=true": ["superadmin", "admin", "pengurus", "kasir", "anggota"],
  "/anggota":                     ["superadmin", "admin", "pengurus"],
  "/akun":                        ["superadmin", "admin"],
  // Log & Audit
  "/log":                         ["superadmin", "admin", "pengurus", "ketua"],
  // Simpan pinjam
  "/simpanan":                    ["superadmin", "admin", "pengurus", "anggota"],
  "/pinjaman":                    ["anggota"],
  "/pinjaman/produk":             ["superadmin", "admin", "pengurus"],
  "/pinjaman/approval":           ["superadmin", "admin", "pengurus"],
  // Toko
  "/toko/kasir/sesi":             ["superadmin", "admin", "pengurus", "kasir"],
  "/toko/kasir":                  ["superadmin", "admin", "pengurus", "kasir"],
  "/toko":                        ["anggota"],
  "/toko/produk":                 ["superadmin", "admin", "pengurus", "kasir"],
  "/toko/pesanan":                ["superadmin", "admin", "pengurus", "kasir"],
  "/toko/inventaris":             ["superadmin", "admin", "pengurus", "kasir"],
  "/pembelian":                   ["superadmin", "admin", "pengurus"],
  "/toko/konsinyasi":             ["superadmin", "admin", "pengurus", "kasir"],
  "/keuangan":                    ["superadmin", "admin", "pengurus", "kasir"],
  // Laporan & Akuntansi
  "/akuntansi/transaksi":         ["superadmin", "admin", "pengurus", "kasir"],
  "/akuntansi/anggaran":          ["superadmin", "admin", "pengurus", "kasir"],
  "/akuntansi/aset-tetap":        ["superadmin", "admin", "pengurus", "kasir"],
  "/akuntansi/pembagian-shu":     ["superadmin", "admin", "pengurus"],
  "/akuntansi/laporan-keuangan":  ["superadmin", "admin", "pengurus"],
  "/laporan/partisipasi-anggota": ["superadmin", "admin", "pengurus"],
  "/laporan/harian":              ["superadmin", "admin", "pengurus", "kasir"],
  "/laporan/po-konsinyasi":       ["superadmin", "admin", "pengurus"],
  "/laporan/stok":                ["superadmin", "admin", "pengurus", "kasir"],
  "/laporan/potongan-gaji":       ["superadmin", "admin", "pengurus"],
  "/laporan/analitik":            ["superadmin", "admin", "pengurus", "kasir"],
  "/akuntansi/buku-besar":        ["superadmin", "admin"],
  "/akuntansi/tutup-buku":        ["superadmin", "admin"],
  // Pengaturan
  "/pengaturan/shu":              ["superadmin", "admin", "pengurus"],
  "/pengaturan/promosi":          ["superadmin", "admin"],
  "/pengaturan/dashboard-anggota": ["superadmin", "admin", "pengurus"],
  "/pengaturan":                  ["superadmin", "admin"],
}


/**
 * Filter grup dan item menu berdasarkan role pengguna.
 *
 * @param role - Role pengguna saat ini
 * @returns NavGroup[] yang sudah difilter per role
 */
function getGroupsByRole(role: string): NavGroup[] {
  return ALL_GROUPS
    .filter((g) => !g.roles || g.roles.includes(role))
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        const allowed = ITEM_ROLE_MAP[item.href]
        return !allowed || allowed.includes(role)
      }),
    }))
    .filter((g) => g.items.length > 0)
}

// ─────────────────────────────────────────────
// Group Label Component
// ─────────────────────────────────────────────

function GroupLabel({ label, icon: Icon }: { label: string; icon?: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 px-3 pt-5 pb-1.5">
      {Icon && <Icon className="h-3.5 w-3.5 text-indigo-400 dark:text-indigo-500 shrink-0" />}
      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.18em]">
        {label}
      </span>
      <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800 ml-1" />
    </div>
  )
}

// ─────────────────────────────────────────────
// Sidebar Component
// ─────────────────────────────────────────────

export function Sidebar({
  role,
  onClose,
  companyName = "Koperasi",
  logoUrl = "/icon.jpg",
}: {
  role: string
  onClose?: () => void
  /** Nama koperasi dari pengaturan umum (app_settings.company_name) */
  companyName?: string
  /** URL logo dari pengaturan umum (app_settings.logo_url) */
  logoUrl?: string
}) {
  const pathname = usePathname()
  const groups = getGroupsByRole(role)

  return (
    <div className="flex h-full w-full max-w-xs flex-col bg-white dark:bg-slate-950 border-r border-slate-200/60 dark:border-slate-800 shadow-2xl z-10 transition-all duration-300 relative">
      {/* Close Button — Mobile Only */}
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Tutup menu"
          className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors md:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      {/* Header / Brand */}
      <div className="flex h-20 shrink-0 items-center px-6 border-b border-white/10 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 dark:from-blue-900 dark:via-indigo-900 dark:to-violet-900 shadow-inner">
        <div className="flex items-center gap-3 w-full">
          <div className="h-10 w-10 rounded-xl overflow-hidden shadow-sm border border-white/30 flex-shrink-0">
            <img src={logoUrl || "/icon.jpg"} alt="Logo Koperasi" className="h-full w-full object-cover" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-lg tracking-wide text-white drop-shadow-md leading-tight line-clamp-2">
              {companyName}
            </span>
            <span className="text-[10px] text-blue-100 uppercase tracking-widest font-medium capitalize">
              {role}
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable Nav */}
      <div className="flex-1 overflow-y-auto py-2 px-3 flex flex-col">
        {groups.map((group) => (
          <div key={group.groupLabel}>
            <GroupLabel label={group.groupLabel} icon={group.icon} />

            <div className="flex flex-col gap-0.5 mt-0.5">
              {group.items.map((link) => {
                /**
                 * Menentukan apakah link saat ini aktif.
                 * Untuk link dashboard, pencocokan dilakukan secara exact agar tidak
                 * menyebabkan false-positive pada sub-route.
                 */
                const isDashboard = link.href.startsWith("/dashboard")
                const isActive = isDashboard
                  ? pathname === link.href || pathname === "/dashboard"
                  : pathname === link.href || pathname.startsWith(link.href + "/")

                const Icon = link.icon

                const isFinancialGroup = group.groupLabel === "Keuangan"

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 group relative overflow-hidden",
                      link.mobileOnly ? "md:hidden" : "",
                      isActive
                        ? (isFinancialGroup
                          ? "text-red-800 dark:text-red-400 bg-[#fdf4f4] dark:bg-red-950/20 border-2 border-slate-900 dark:border-slate-800 font-extrabold shadow-sm rounded-xl"
                          : "text-white shadow-lg bg-gradient-to-r from-blue-500 to-indigo-600 border border-blue-400/30")
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-blue-600 dark:hover:text-blue-400"
                    )}
                  >
                    {/* Active indicator bar */}
                    {isActive && !isFinancialGroup && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/40 rounded-r-full" />
                    )}

                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-transform duration-200",
                        isActive 
                          ? (isFinancialGroup ? "text-red-800 dark:text-red-400 font-extrabold" : "text-white") 
                          : "text-slate-400 group-hover:text-blue-500"
                      )}
                    />
                    <span className="flex-1 truncate">{link.label}</span>

                    {!isActive && (
                      <ChevronRight className="h-3 w-3 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0" />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800">
        <div className="rounded-lg bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 p-3 border border-indigo-100/50 dark:border-indigo-900/30">
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Versi Sistem</p>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">v3.0.0 NextJS</p>
        </div>
      </div>
    </div>
  )
}
