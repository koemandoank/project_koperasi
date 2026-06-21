"use client"

import { useState } from "react"
import { LogOut, User as UserIcon, Bell, Search, Menu, CreditCard, ShoppingBag, X } from "lucide-react"
import { logout } from "@/lib/actions/auth"
import Image from "next/image"
import Link from "next/link"
import { Sidebar } from "./sidebar"

export function HeaderClient({
  user,
  settings,
  notifications
}: {
  user: any
  settings: any
  notifications: Array<{ type: string; message: string; count: number; href: string }>
}) {
  const [notifOpen, setNotifOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const totalNotif = notifications.reduce((s, n) => s + n.count, 0)

  const NOTIF_ICONS: Record<string, any> = {
    loan: CreditCard,
    order: ShoppingBag,
  }

  return (
    <>
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-full max-w-xs bg-white dark:bg-slate-950 shadow-2xl transform transition-transform duration-300">
            <Sidebar role={user?.role} onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      <header className="flex h-20 shrink-0 items-center justify-between border-b border-slate-200/60 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl px-4 md:px-6 shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-4">
          {/* Hamburger Menu for Mobile */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden md:flex items-center gap-3">
            <div className="relative h-10 w-10 bg-white rounded-lg shadow-sm border border-slate-100 flex items-center justify-center overflow-hidden">
              <Image
                src={settings?.logo_url || "/koperasi.png"}
                alt="Logo"
                fill
                className="object-contain p-1"
                priority
              />
            </div>
            <h2 className="text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-400 dark:to-indigo-400">
              {settings?.company_name || "Koperasi Digital"}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Search */}
          <div className="hidden lg:flex items-center relative mr-4">
            <Search className="absolute left-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari transaksi..."
              className="pl-9 pr-4 py-2 w-64 rounded-full bg-slate-100 dark:bg-slate-900 border-transparent focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-sm outline-none"
            />
          </div>

          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setNotifOpen(v => !v)}
              className="relative p-2 rounded-full text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Bell className="h-5 w-5" />
              {totalNotif > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white dark:border-slate-950 animate-pulse" />
              )}
            </button>

            {/* Dropdown */}
            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <h4 className="font-semibold text-sm">Notifikasi</h4>
                  {totalNotif > 0 && (
                    <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">{totalNotif}</span>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Tidak ada notifikasi baru.
                  </div>
                ) : (
                  <div className="max-h-72 overflow-auto">
                    {notifications.map((n, i) => {
                      const Icon = NOTIF_ICONS[n.type] || Bell
                      return (
                        <Link
                          key={i}
                          href={n.href}
                          onClick={() => setNotifOpen(false)}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 border-b last:border-0 transition-colors"
                        >
                          <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                            <Icon className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{n.message}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Klik untuk lihat detail →</p>
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

          {/* User Info + Logout */}
          <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-800">
            <div className="flex flex-col text-right hidden md:flex">
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{user?.name}</span>
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full mt-0.5 inline-block w-fit self-end">
                {user?.role}
              </span>
            </div>
            <Link href="/profil" className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md ring-2 ring-indigo-100 dark:ring-indigo-900/50 hover:ring-indigo-300 transition-all cursor-pointer">
              <UserIcon className="h-5 w-5" />
            </Link>
            <form action={logout}>
              <button
                type="submit"
                title="Logout"
                className="ml-1 p-2 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
      </header>
    </>
  )
}
