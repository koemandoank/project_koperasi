"use client"

import { useState, useMemo, useCallback } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Home, LayoutDashboard, Users, CreditCard, Wallet, FileText,
  Lock, Unlock, Settings, Store, Package, ClipboardCheck,
  BookOpen, PieChart, ChevronRight, ShoppingBag, Inbox,
  ShoppingCart, TrendingDown, BarChart3, Truck, X, Megaphone,
  Building2, Banknote, Receipt, ShieldAlert, Clock, PlusCircle,
  ArrowLeftRight, Coins, Calculator, Landmark, TrendingUp, Printer, ShieldCheck, CalendarCheck,
  Smartphone, Server, CloudUpload, Search, PanelLeftClose, PanelLeft,
  ChevronDown
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
      { href: "/laporan/potongan-gaji", label: "Potongan Gaji",     icon: Receipt },
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
      { href: "/ppob",           label: "Transaksi PPOB",   icon: Smartphone },
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
    roles: ["superadmin", "admin", "pengurus", "kasir", "petugas_akuntan", "pengawas"],
    items: [
      { href: "/akuntansi/laporan-keuangan", label: "Laporan Keuangan RAT", icon: FileText },
      { href: "/laporan/partisipasi-anggota", label: "Partisipasi Anggota RAT", icon: Users },
      { href: "/akuntansi/rat-absensi", label: "Absensi & Hak Suara RAT", icon: CalendarCheck },
      { href: "/akuntansi/buku-besar",  label: "Buku Besar",              icon: BookOpen },
      { href: "/akuntansi/tutup-buku",  label: "Tutup Buku",              icon: Lock },
      { href: "/laporan/analitik",      label: "Analitik Keuangan",       icon: TrendingUp },
      { href: "/laporan/harian",        label: "Laporan Harian",         icon: FileText },
      { href: "/laporan/po-konsinyasi", label: "Laporan PO & Konsinyasi",  icon: FileText },
      { href: "/laporan/stok",          label: "Riwayat Keluar Masuk Stok", icon: Package },
    ],
  },

  // ── PENGAWAS KOPERASI ─────────────────────
  {
    groupLabel: "Pengawas Koperasi",
    icon: ShieldCheck,
    roles: ["superadmin", "pengawas"],
    items: [
      { href: "/pengawas", label: "Dashboard Pengawas", icon: ShieldCheck },
    ],
  },

  // ── LOG AKTIVITAS ─────────────────────────
  {
    groupLabel: "Log & Audit",
    icon: ShieldAlert,
    roles: ["superadmin", "admin", "pengurus", "ketua", "petugas_akuntan", "pengawas"],
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
      { href: "/pengaturan/kop-surat", label: "Kop & TTD Laporan", icon: Printer },
      { href: "/pengaturan/ppob", label: "Pengaturan PPOB", icon: CreditCard },
      { href: "/pengaturan/cache", label: "Manajemen Cache", icon: Server },
      { href: "/pengaturan/backup", label: "Backup & Drive", icon: CloudUpload },
      { href: "/pengaturan", label: "Pengaturan Umum", icon: Settings },
    ],
  },
]

// ─────────────────────────────────────────────
// Per-item visibility rules per role
// ─────────────────────────────────────────────

const ITEM_ROLE_MAP: Record<string, string[]> = {
  "/dashboard/home":              ["superadmin", "admin", "pengurus", "kasir", "anggota"],
  "/dashboard?forceDashboard=true": ["superadmin", "admin", "pengurus", "kasir", "anggota"],
  "/anggota":                     ["superadmin", "admin", "pengurus"],
  "/akun":                        ["superadmin", "admin"],
  "/log":                         ["superadmin", "admin", "pengurus", "ketua", "petugas_akuntan", "pengawas"],
  "/simpanan":                    ["superadmin", "admin", "pengurus", "anggota"],
  "/pinjaman":                    ["superadmin", "admin", "pengurus", "anggota"],
  "/pinjaman/produk":             ["superadmin", "admin", "pengurus"],
  "/pinjaman/approval":           ["superadmin", "admin", "pengurus"],
  "/toko/kasir/sesi":             ["superadmin", "admin", "pengurus", "kasir"],
  "/toko/kasir":                  ["superadmin", "admin", "pengurus", "kasir"],
  "/toko":                        ["anggota"],
  "/ppob":                        ["superadmin", "admin", "pengurus", "kasir", "anggota"],
  "/toko/produk":                 ["superadmin", "admin", "pengurus", "kasir"],
  "/toko/pesanan":                ["superadmin", "admin", "pengurus", "kasir"],
  "/toko/inventaris":             ["superadmin", "admin", "pengurus", "kasir"],
  "/pembelian":                   ["superadmin", "admin", "pengurus"],
  "/toko/konsinyasi":             ["superadmin", "admin", "pengurus", "kasir"],
  "/keuangan":                    ["superadmin", "admin", "pengurus", "kasir"],
  "/akuntansi/transaksi":         ["superadmin", "admin", "pengurus", "kasir"],
  "/akuntansi/anggaran":          ["superadmin", "admin", "pengurus", "kasir"],
  "/akuntansi/aset-tetap":        ["superadmin", "admin", "pengurus", "kasir"],
  "/akuntansi/pembagian-shu":     ["superadmin", "admin", "pengurus"],
  "/akuntansi/laporan-keuangan":  ["superadmin", "admin", "pengurus"],
  "/laporan/partisipasi-anggota": ["superadmin", "admin", "pengurus"],
  "/akuntansi/rat-absensi":       ["superadmin", "admin", "pengurus"],
  "/laporan/harian":              ["superadmin", "admin", "pengurus", "kasir"],
  "/laporan/po-konsinyasi":       ["superadmin", "admin", "pengurus"],
  "/laporan/stok":                ["superadmin", "admin", "pengurus", "kasir"],
  "/laporan/potongan-gaji":       ["superadmin", "admin", "pengurus"],
  "/laporan/analitik":            ["superadmin", "admin", "pengurus", "kasir"],
  "/akuntansi/buku-besar":        ["superadmin", "admin", "petugas_akuntan"],
  "/akuntansi/tutup-buku":        ["superadmin", "admin", "petugas_akuntan"],
  "/pengawas":                    ["superadmin", "pengawas"],
  "/pengaturan/shu":              ["superadmin", "admin", "pengurus"],
  "/pengaturan/promosi":          ["superadmin", "admin"],
  "/pengaturan/dashboard-anggota": ["superadmin", "admin", "pengurus"],
  "/pengaturan/kop-surat":        ["superadmin", "admin", "pengurus"],
  "/pengaturan/ppob":             ["superadmin", "admin", "pengurus"],
  "/pengaturan/cache":            ["superadmin", "admin"],
  "/pengaturan/backup":           ["superadmin", "admin"],
  "/pengaturan":                  ["superadmin", "admin"],
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

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

function isItemActive(pathname: string, href: string): boolean {
  const isDashboard = href.startsWith("/dashboard")
  return isDashboard
    ? pathname === href || pathname === "/dashboard"
    : pathname === href || pathname.startsWith(href + "/")
}

// ─────────────────────────────────────────────
// Mini NavItem (icon only)
// ─────────────────────────────────────────────

function MiniNavItem({ icon: Icon, label, href, pathname, onClick }: {
  icon: React.ElementType; label: string; href: string; pathname: string; onClick?: () => void
}) {
  const active = isItemActive(pathname, href)
  return (
    <Link
      href={href}
      onClick={onClick}
      title={label}
      className={cn(
        "relative flex items-center justify-center h-10 w-10 mx-auto rounded-xl transition-all duration-200 group",
        active
          ? "text-primary bg-primary/10"
          : "text-zinc-400 dark:text-zinc-500 hover:text-primary hover:bg-primary/5"
      )}
    >
      {active && <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-primary rounded-r-full" />}
      <Icon className="h-4.5 w-4.5" />
    </Link>
  )
}

// ─────────────────────────────────────────────
// Group Label Component
// ─────────────────────────────────────────────

function GroupLabel({ label, icon: Icon, collapsed }: { label: string; icon?: React.ElementType; collapsed?: boolean }) {
  if (collapsed) return null
  return (
    <div className="flex items-center gap-2 px-3 pt-5 pb-1.5">
      {Icon && <Icon className="h-3 w-3 text-primary shrink-0" />}
      <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.18em]">
        {label}
      </span>
      <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-900 ml-1" />
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
  companyName?: string
  logoUrl?: string
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // Filter groups by role + label adjustment
  const groups = useMemo(() => {
    return getGroupsByRole(role).map((g) => ({
      ...g,
      items: g.items.map((item) => {
        if (item.href === "/pinjaman") {
          return { ...item, label: role === "anggota" ? "Pinjaman Saya" : "Manajemen Pinjaman" }
        }
        return item
      }),
    }))
  }, [role])

  // Filter by search
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups
    const q = searchQuery.toLowerCase()
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((item) => item.label.toLowerCase().includes(q) || g.groupLabel.toLowerCase().includes(q)),
      }))
      .filter((g) => g.items.length > 0)
  }, [groups, searchQuery])

  const toggleCollapse = useCallback(() => setCollapsed((v) => !v), [])
  const closeSearch = useCallback(() => setSearchQuery(""), [])

  return (
    <div
      className={cn(
        "flex h-full flex-col bg-white dark:bg-zinc-950 border-r border-zinc-200/60 dark:border-zinc-800/80 z-10 transition-all duration-300 relative",
        collapsed ? "w-[68px]" : "w-full max-w-xs"
      )}
    >
      {/* Close Button — Mobile Only */}
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Tutup menu"
          className="absolute top-4 right-4 p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors md:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      {/* ── Header / Brand ── */}
      {collapsed ? (
        <div className="flex h-16 shrink-0 items-center justify-center border-b border-zinc-100 dark:border-zinc-900">
          <div className="h-8 w-8 rounded-xl overflow-hidden shadow-sm border border-zinc-200 dark:border-zinc-800">
            <img src={logoUrl || "/icon.jpg"} alt="" className="h-full w-full object-cover" />
          </div>
        </div>
      ) : (
        <div className="flex h-20 shrink-0 items-center px-6 border-b border-zinc-100 dark:border-zinc-900 bg-white dark:bg-zinc-950">
          <div className="flex items-center gap-3 w-full">
            <div className="h-10 w-10 rounded-xl overflow-hidden shadow-sm border border-zinc-200 dark:border-zinc-800 flex-shrink-0">
              <img src={logoUrl || "/icon.jpg"} alt="Logo" className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-sm tracking-wide text-zinc-800 dark:text-zinc-100 leading-tight truncate font-heading">
                {companyName}
              </span>
              <span className="text-[10px] text-primary uppercase tracking-widest font-semibold mt-0.5">
                {role}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Collapse Toggle (desktop only) ── */}
      <button
        onClick={toggleCollapse}
        className="hidden md:flex absolute -right-3 top-20 h-6 w-6 items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 shadow-sm transition-colors z-20"
      >
        {collapsed ? <PanelLeft className="h-3 w-3" /> : <PanelLeftClose className="h-3 w-3" />}
      </button>

      {/* ── Search Filter (expanded only, desktop) ── */}
      {!collapsed && (
        <div className="hidden md:block px-3 pt-3 pb-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Cari menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 placeholder-zinc-400 focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all outline-none"
            />
            {searchQuery && (
              <button onClick={closeSearch} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Scrollable Nav ── */}
      <div className="flex-1 overflow-y-auto py-2 px-3 flex flex-col">
        {collapsed ? (
          // Mini Mode — icons only
          <div className="flex flex-col items-center gap-1 py-2">
            {groups.map((group) =>
              group.items.map((link) => {
                if (link.mobileOnly) return null
                return (
                  <MiniNavItem
                    key={link.href}
                    icon={link.icon}
                    label={link.label}
                    href={link.href}
                    pathname={pathname}
                    onClick={onClose}
                  />
                )
              })
            )}
          </div>
        ) : (
          // Expanded Mode
          <>
            {searchQuery && filteredGroups.length === 0 && (
              <div className="px-3 py-8 text-center">
                <p className="text-xs text-zinc-400 dark:text-zinc-500">Tidak ada menu yang cocok</p>
              </div>
            )}
            {filteredGroups.map((group) => (
              <div key={group.groupLabel}>
                <GroupLabel label={group.groupLabel} icon={group.icon} collapsed={collapsed} />

                <div className="flex flex-col gap-0.5 mt-0.5">
                  {group.items.map((link) => {
                    const isActive = isItemActive(pathname, link.href)
                    const Icon = link.icon

                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={onClose}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 group relative overflow-hidden",
                          link.mobileOnly ? "md:hidden" : "",
                          isActive
                            ? "text-primary bg-primary/5 dark:bg-primary/10"
                            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 hover:text-zinc-900 dark:hover:text-zinc-200"
                        )}
                      >
                        {/* Active indicator bar */}
                        {isActive && (
                          <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-primary rounded-r-full" />
                        )}

                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-transform duration-200",
                            isActive ? "text-primary" : "text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300"
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
          </>
        )}
      </div>

      {/* ── Footer ── */}
      {collapsed ? (
        <div className="p-3 border-t border-zinc-100 dark:border-zinc-900 flex justify-center">
          <div className="h-8 w-8 rounded-xl bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
            <Server className="h-3.5 w-3.5 text-zinc-400" />
          </div>
        </div>
      ) : (
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-900">
          <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900 p-3 border border-zinc-100/50 dark:border-zinc-800/50">
            <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Versi Sistem</p>
            <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mt-0.5">v3.0.0 NextJS</p>
          </div>
        </div>
      )}
    </div>
  )
}
