"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { LogOut, User as UserIcon, Bell, Search, Menu, CreditCard, ShoppingBag, X, Sun, Moon, ChevronDown, ExternalLink, Settings, Command, LayoutDashboard, Home } from "lucide-react"
import { signOut } from "next-auth/react"
import Link from "next/link"
import { Sidebar } from "./sidebar"
import { cn } from "@/lib/utils"

type Notification = { type: string; message: string; count: number; href: string }

// ─── Web Audio API — efek chime double-beep premium ─────────────────────────

function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
    const playTone = (freq: number, startTime: number, duration: number, gainVal: number) => {
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      oscillator.type = "sine"
      oscillator.frequency.setValueAtTime(freq, startTime)
      gainNode.gain.setValueAtTime(0, startTime)
      gainNode.gain.linearRampToValueAtTime(gainVal, startTime + 0.02)
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
      oscillator.start(startTime)
      oscillator.stop(startTime + duration)
    }
    const now = ctx.currentTime
    playTone(587.33, now, 0.35, 0.25)
    playTone(783.99, now + 0.18, 0.45, 0.2)
  } catch {
    // ignore
  }
}

// ─── Hook: polling notifikasi setiap 15 detik ─────────────────────────────────

function useNotificationPolling(initialNotifications: Notification[]) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications)
  const [hasNew, setHasNew] = useState(false)
  const prevCountRef = useRef(initialNotifications.reduce((s, n) => s + n.count, 0))

  const poll = useCallback(async () => {
    try {
      const { getNotifications } = await import("@/lib/actions/member-portal")
      const fresh = await getNotifications()
      const freshCount = fresh.reduce((s, n) => s + n.count, 0)
      const prevCount = prevCountRef.current
      if (freshCount > prevCount) {
        setHasNew(true)
        playNotificationSound()
        setTimeout(() => setHasNew(false), 1000)
      }
      prevCountRef.current = freshCount
      setNotifications(fresh)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(poll, 15_000)
    return () => clearInterval(interval)
  }, [poll])

  return { notifications, hasNew }
}

// ─── Command Palette (⌘K) — lightweight client-side ─────────────────────────

function useCommandPalette(items: { label: string; href: string }[]) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const filtered = query.trim()
    ? items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
    : items.slice(0, 8)

  return { open, setOpen, query, setQuery, filtered, close: () => { setOpen(false); setQuery("") } }
}

// ─── Notification type icon map ──────────────────────────────────────────────

const NOTIF_ICONS: Record<string, React.ElementType> = {
  loan: CreditCard,
  order: ShoppingBag,
}

// ─── NOTIF_COLORS ────────────────────────────────────────────────────────────

const NOTIF_COLORS: Record<string, string> = {
  loan: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
  order: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
}

const NOTIF_BADGE_COLORS: Record<string, string> = {
  loan: "bg-orange-500",
  order: "bg-blue-500",
}

// ─── Breadcrumb ──────────────────────────────────────────────────────────────

function Breadcrumb() {
  // ⚡ dynamic require — hooks rule pgc
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const pathname = require("next/navigation").usePathname()
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length <= 1) return null

  return (
    <nav className="hidden md:flex items-center gap-1.5 px-6 py-2 text-xs text-zinc-400 dark:text-zinc-500 border-b border-zinc-100 dark:border-zinc-900 bg-white/50 dark:bg-zinc-950/50">
      <Link href="/dashboard" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">Dashboard</Link>
      {segments.slice(1).map((seg, i) => (
        <span key={seg} className="flex items-center gap-1.5">
          <span className="text-zinc-300 dark:text-zinc-600">/</span>
          <span className={i === segments.length - 2 ? "text-zinc-700 dark:text-zinc-200 font-medium" : "text-zinc-400 dark:text-zinc-500 capitalize"}>
            {seg.replace(/-/g, " ")}
          </span>
        </span>
      ))}
    </nav>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Dark Mode Toggle
// ─────────────────────────────────────────────────────────────────────────────

function DarkModeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"))
  }, [])

  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle("dark", next)
    try {
      localStorage.setItem("theme", next ? "dark" : "light")
    } catch { /* ignore */ }
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors w-full"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span>{dark ? "Mode Terang" : "Mode Gelap"}</span>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function HeaderClient({
  user,
  settings,
  notifications: initialNotifications,
}: {
  user: any
  settings: any
  notifications: Notification[]
}) {
  const [notifOpen, setNotifOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)

  const { notifications, hasNew } = useNotificationPolling(initialNotifications)
  const totalNotif = notifications.reduce((s, n) => s + n.count, 0)

  // Build menu items for command palette
  const menuItems = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Data Anggota", href: "/anggota" },
    { label: "Simpanan", href: "/simpanan" },
    { label: "Pinjaman", href: "/pinjaman" },
    { label: "Transaksi", href: "/akuntansi/transaksi" },
    { label: "Keuangan", href: "/keuangan" },
    { label: "Toko", href: "/toko" },
    { label: "Laporan Keuangan RAT", href: "/akuntansi/laporan-keuangan" },
    { label: "Pengaturan", href: "/pengaturan" },
    { label: "Profil", href: "/profil" },
  ]

  const cmd = useCommandPalette(menuItems)

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenuOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <>
      {/* ── Command Palette Overlay ── */}
      {cmd.open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={cmd.close}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <Search className="h-4 w-4 text-zinc-400 shrink-0" />
              <input
                type="text"
                placeholder="Cari menu..."
                value={cmd.query}
                onChange={(e) => cmd.setQuery(e.target.value)}
                autoFocus
                className="flex-1 bg-transparent text-sm text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 outline-none"
              />
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
                <Command className="h-3 w-3" />K
              </kbd>
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {cmd.filtered.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-zinc-400">Tidak ada hasil</div>
              ) : (
                cmd.filtered.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={cmd.close}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <Search className="h-3.5 w-3.5 text-zinc-400" />
                    {item.label}
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Sidebar Overlay ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-full max-w-xs bg-white dark:bg-slate-950 shadow-2xl transform transition-transform duration-300">
            <Sidebar role={user?.role} onClose={() => setSidebarOpen(false)} companyName={settings?.company_name ?? "Koperasi"} logoUrl={settings?.logo_url ?? "/icon.jpg"} />
          </div>
        </div>
      )}

      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/60 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl px-4 md:px-6 shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-4">
          {/* Hamburger Menu for Mobile */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:text-primary hover:bg-emerald-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Page Header (desktop) — breadcrumb sudah di bawah */}
          <div className="hidden md:flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-sm flex items-center justify-center">
              <LayoutDashboard className="h-4 w-4 text-primary" />
            </div>
            <h1 className="text-lg font-extrabold text-zinc-800 dark:text-zinc-100 tracking-tight">
              Koperasi Digital
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* ── Command-K Search ── */}
          <button
            onClick={() => cmd.setOpen(true)}
            className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all text-xs w-48"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="flex-1 text-left">Cari menu...</span>
            <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1 py-0.5 text-[10px] font-medium text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>

          {/* ── Notification Bell ── */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen(v => !v)}
              className="relative p-2 rounded-full text-zinc-500 hover:text-primary hover:bg-emerald-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Bell
                className={cn(
                  "h-5 w-5 transition-colors",
                  totalNotif > 0 ? "text-primary" : "",
                  hasNew ? "animate-bell-ring" : totalNotif > 0 ? "animate-bell-shake" : ""
                )}
              />
              {totalNotif > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white dark:border-slate-950 animate-pulse" />
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                  <h4 className="font-semibold text-sm text-zinc-800 dark:text-zinc-100">Notifikasi</h4>
                  {totalNotif > 0 && (
                    <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold px-2 py-0.5 rounded-full">{totalNotif}</span>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-zinc-400 dark:text-zinc-500">
                    Tidak ada notifikasi baru.
                  </div>
                ) : (
                  <div className="max-h-72 overflow-auto">
                    {notifications.map((n, i) => {
                      const Icon = NOTIF_ICONS[n.type] || Bell
                      const colorClasses = NOTIF_COLORS[n.type] || "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                      const badgeColor = NOTIF_BADGE_COLORS[n.type] || "bg-zinc-500"
                      return (
                        <Link
                          key={i}
                          href={n.href}
                          onClick={() => setNotifOpen(false)}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 border-b border-zinc-50 dark:border-zinc-800 last:border-0 transition-colors"
                        >
                          <div className={`h-8 w-8 rounded-full ${colorClasses} flex items-center justify-center shrink-0`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{n.message}</p>
                            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Klik untuk lihat detail →</p>
                          </div>
                          <span className={`${badgeColor} text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold shrink-0`}>
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

          {/* ── User Avatar + Dropdown ── */}
          <div className="relative" ref={userRef}>
            <button
              onClick={() => setUserMenuOpen(v => !v)}
              className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
            >
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white shadow-sm ring-2 ring-emerald-100 dark:ring-emerald-900/50">
                <UserIcon className="h-4 w-4" />
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100 leading-tight">{user?.name}</span>
                <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">{user?.role}</span>
              </div>
              <ChevronDown className="hidden md:block h-3 w-3 text-zinc-400" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl z-50 py-1">
                <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{user?.name}</p>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{user?.email || ""}</p>
                </div>

                <Link
                  href="/profil"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <UserIcon className="h-4 w-4" />
                  <span>Profil Saya</span>
                </Link>

                <Link
                  href="/pengaturan"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <Settings className="h-4 w-4" />
                  <span>Pengaturan</span>
                </Link>

                <div className="border-t border-zinc-100 dark:border-zinc-800 my-1" />

                <DarkModeToggle />

                <div className="border-t border-zinc-100 dark:border-zinc-800 my-1" />

                <button
                  onClick={async () => {
                    setUserMenuOpen(false)
                    localStorage.clear()
                    sessionStorage.clear()
                    await signOut({ callbackUrl: "/login" })
                  }}
                  className="flex items-center gap-3 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors w-full text-left"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Keluar</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Breadcrumb ── */}
      <Breadcrumb />
    </>
  )
}


