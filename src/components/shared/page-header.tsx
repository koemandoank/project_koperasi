"use client"

import { usePathname } from "next/navigation"
import {
  Home, LayoutDashboard, Users, CreditCard, Wallet, FileText,
  Lock, Unlock, Settings, Store, Package, ClipboardCheck,
  BookOpen, ShoppingBag, Inbox, Truck, Megaphone,
  Building2, Banknote, Receipt, ShieldAlert, Clock,
  ArrowLeftRight, Coins, Calculator, Landmark, TrendingUp, User
} from "lucide-react"

// ─────────────────────────────────────────────────────────
// Route → { label, icon } map
// Urutan: lebih spesifik di atas (prefix matching dari bawah)
// ─────────────────────────────────────────────────────────

const ROUTE_MAP: Array<{
  /** Prefix path yang cocok */
  match: string
  /** Exact match only (tidak cocokkan sub-path) */
  exact?: boolean
  label: string
  Icon: React.ElementType
  color?: string
}> = [
  // Dashboard
  { match: "/dashboard",             exact: true,  label: "Dashboard",                  Icon: LayoutDashboard, color: "text-blue-600" },
  { match: "/dashboard/home",        exact: true,  label: "Beranda",                    Icon: Home,            color: "text-blue-500" },

  // Anggota & Akun
  { match: "/anggota",                             label: "Data Anggota",               Icon: Users,           color: "text-indigo-600" },
  { match: "/akun",                                label: "Data Akun User",             Icon: Lock,            color: "text-slate-600" },
  { match: "/profil",                              label: "Profil Saya",                Icon: User,            color: "text-violet-600" },

  // Simpan Pinjam
  { match: "/pinjaman/approval",                   label: "Approval Pinjaman",          Icon: ClipboardCheck,  color: "text-orange-600" },
  { match: "/pinjaman/produk",                     label: "Produk Pinjaman",            Icon: CreditCard,      color: "text-blue-600" },
  { match: "/pinjaman",                            label: "Pinjaman Saya",              Icon: CreditCard,      color: "text-blue-600" },
  { match: "/simpanan",                            label: "Simpanan",                   Icon: Wallet,          color: "text-emerald-600" },

  // Keuangan
  { match: "/akuntansi/transaksi",                 label: "Transaksi",                  Icon: ArrowLeftRight,  color: "text-red-600" },
  { match: "/akuntansi/anggaran",                  label: "Anggaran",                   Icon: Calculator,      color: "text-amber-600" },
  { match: "/akuntansi/aset-tetap",                label: "Aset Tetap",                 Icon: Landmark,        color: "text-stone-600" },
  { match: "/akuntansi/buku-besar",                label: "Buku Besar",                 Icon: BookOpen,        color: "text-cyan-600" },
  { match: "/akuntansi/tutup-buku",                label: "Tutup Buku",                 Icon: Lock,            color: "text-red-700" },
  { match: "/akuntansi/laporan-keuangan",          label: "Laporan Keuangan RAT",       Icon: FileText,        color: "text-blue-600" },
  { match: "/akuntansi/pembagian-shu",             label: "Penyaluran SHU RAT",         Icon: Coins,           color: "text-green-600" },
  { match: "/keuangan",                            label: "Keuangan",                   Icon: Coins,           color: "text-emerald-600" },
  { match: "/pengaturan/shu",                      label: "SHU & Distribusi",           Icon: TrendingUp,      color: "text-green-600" },

  // Laporan
  { match: "/laporan/partisipasi-anggota",         label: "Partisipasi Anggota RAT",    Icon: Users,           color: "text-indigo-600" },
  { match: "/laporan/analitik",                    label: "Laporan Keuangan",           Icon: TrendingUp,      color: "text-green-600" },
  { match: "/laporan/harian",                      label: "Laporan Harian",             Icon: FileText,        color: "text-slate-600" },
  { match: "/laporan/po-konsinyasi",               label: "Laporan PO & Konsinyasi",    Icon: FileText,        color: "text-slate-600" },
  { match: "/laporan/stok",                        label: "Riwayat Stok",               Icon: Package,         color: "text-slate-600" },
  { match: "/laporan/potongan-gaji",               label: "Laporan Gaji",               Icon: FileText,        color: "text-slate-600" },

  // Toko — urutan spesifik dulu
  { match: "/toko/kasir/sesi",                     label: "Sesi Kasir",                 Icon: Unlock,          color: "text-orange-600" },
  { match: "/toko/kasir",                          label: "Mesin Kasir (POS)",          Icon: Store,           color: "text-violet-600" },
  { match: "/toko/produk",                         label: "Katalog Produk",             Icon: Package,         color: "text-blue-600" },
  { match: "/toko/pesanan",                        label: "Pesanan Online",             Icon: Inbox,           color: "text-indigo-600" },
  { match: "/toko/inventaris",                     label: "Inventaris",                 Icon: ClipboardCheck,  color: "text-teal-600" },
  { match: "/toko/konsinyasi",                     label: "Konsinyasi",                 Icon: Package,         color: "text-amber-600" },
  { match: "/toko",                                label: "Belanja Online",             Icon: ShoppingBag,     color: "text-pink-600" },
  { match: "/pembelian",                           label: "Pembelian / PO",             Icon: Truck,           color: "text-sky-600" },

  // Log & Audit
  { match: "/log",                                 label: "Log Aktivitas",              Icon: ShieldAlert,     color: "text-red-600" },

  // Pengaturan
  { match: "/pengaturan/promosi",                  label: "Promosi",                    Icon: Megaphone,       color: "text-pink-600" },
  { match: "/pengaturan/dashboard-anggota",        label: "Dashboard Anggota",          Icon: LayoutDashboard, color: "text-indigo-600" },
  { match: "/pengaturan",                          label: "Pengaturan Umum",            Icon: Settings,        color: "text-slate-600" },
]

/**
 * Resolusi route ke entry label+icon.
 * Iterasi dari paling spesifik ke paling umum menggunakan startsWith.
 *
 * @param pathname - Pathname saat ini dari usePathname()
 * @returns Entry yang cocok atau undefined
 */
function resolveRoute(pathname: string) {
  // Normalisasi: buang query string
  const clean = pathname.split("?")[0]

  for (const entry of ROUTE_MAP) {
    if (entry.exact) {
      if (clean === entry.match) return entry
    } else {
      if (clean === entry.match || clean.startsWith(entry.match + "/")) return entry
    }
  }
  return undefined
}

/**
 * PageHeader — menampilkan nama + icon halaman aktif di header desktop.
 * Dibaca dari pathname dan dicocokkan ke ROUTE_MAP.
 */
export function PageHeader() {
  const pathname = usePathname()
  const entry = resolveRoute(pathname)

  if (!entry) {
    // Fallback — tidak ada route yang cocok
    return (
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <LayoutDashboard className="h-5 w-5 text-slate-500" />
        </div>
        <span className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
          Dashboard
        </span>
      </div>
    )
  }

  const { Icon, label, color = "text-blue-600" } = entry

  return (
    <div className="flex items-center gap-3">
      <div className={`h-9 w-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-center`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
        {label}
      </h1>
    </div>
  )
}
