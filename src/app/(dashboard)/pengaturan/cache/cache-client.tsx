"use client"

import { useState } from "react"
import { clearAllCacheAction, deleteCacheKeyAction, getCacheStatsAction } from "@/lib/actions/cache-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Trash2, RefreshCw, Server, Search, Check, AlertCircle, HardDrive } from "lucide-react"

interface CacheKeyInfo {
  key: string
  isExpired: boolean
  expirationDate: string
}

interface CacheStats {
  activeCount: number
  expiredCount: number
  keys: CacheKeyInfo[]
}

export function CacheClient({ initialStats }: { initialStats: CacheStats }) {
  const [stats, setStats] = useState<CacheStats>(initialStats)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  async function handleRefresh() {
    setLoading(true)
    const result = await getCacheStatsAction()
    if (result.success && result.data) {
      setStats(result.data)
      toast.success("Statistik cache diperbarui")
    } else {
      toast.error(result.error || "Gagal memperbarui statistik cache")
    }
    setLoading(false)
  }

  async function handleClearAll() {
    if (!confirm("Apakah Anda yakin ingin menghapus seluruh cache aplikasi? Ini dapat meningkatkan beban database sementara waktu.")) {
      return
    }
    setLoading(true)
    const result = await clearAllCacheAction()
    if (result.success) {
      toast.success(`Berhasil membersihkan cache! ${result.count} data dihapus.`)
      // Refresh stats
      const refreshResult = await getCacheStatsAction()
      if (refreshResult.success && refreshResult.data) {
        setStats(refreshResult.data)
      }
    } else {
      toast.error(result.error || "Gagal membersihkan cache")
    }
    setLoading(false)
  }

  async function handleDeleteKey(key: string) {
    setLoading(true)
    const result = await deleteCacheKeyAction(key)
    if (result.success) {
      toast.success(`Cache key "${key}" berhasil dihapus.`)
      // Refresh stats
      const refreshResult = await getCacheStatsAction()
      if (refreshResult.success && refreshResult.data) {
        setStats(refreshResult.data)
      }
    } else {
      toast.error(result.error || "Gagal menghapus cache key")
    }
    setLoading(false)
  }

  const filteredKeys = stats.keys.filter(k => 
    k.key.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalKeys = stats.keys.length

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Manajemen Cache</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pantau dan bersihkan data cache server untuk meningkatkan performa modul yang sering diakses.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={handleRefresh} 
            disabled={loading}
            className="flex items-center gap-2 rounded-xl"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Perbarui
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleClearAll} 
            disabled={loading}
            className="flex items-center gap-2 rounded-xl font-semibold shadow-md hover:shadow-lg transition-all"
          >
            <Trash2 className="h-4 w-4" />
            Hapus Semua Cache
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-blue-50/20 dark:from-slate-950 dark:to-slate-900/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-semibold text-slate-500">Cache Aktif</CardTitle>
            <Server className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-500">{stats.activeCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Data tersimpan dan siap dibaca cepat</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-amber-50/20 dark:from-slate-950 dark:to-slate-900/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-semibold text-slate-500">Cache Kadaluarsa</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-500">{stats.expiredCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Akan dihapus otomatis pada akses berikutnya</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-indigo-50/20 dark:from-slate-950 dark:to-slate-900/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-semibold text-slate-500">Total Entri Cache</CardTitle>
            <HardDrive className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-500">{totalKeys}</div>
            <p className="text-xs text-muted-foreground mt-1">Total key yang tersimpan di database</p>
          </CardContent>
        </Card>
      </div>

      {/* Main List */}
      <Card className="rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-lg overflow-hidden">
        <CardHeader className="bg-slate-50/80 dark:bg-slate-900/40 border-b border-slate-200/60 dark:border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-bold">Daftar Key Cache</CardTitle>
              <CardDescription>Menampilkan seluruh key yang tersimpan di sistem caching database.</CardDescription>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Cari key cache..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus-visible:ring-blue-500"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredKeys.length === 0 ? (
            <div className="p-12 text-center text-slate-400 dark:text-slate-600">
              <Server className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="font-semibold text-sm">Tidak ada key cache ditemukan</p>
              <p className="text-xs mt-1">Database cache kosong atau tidak cocok dengan filter pencarian.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/50 dark:bg-slate-900/20 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200/40 dark:border-slate-800/40">
                    <th className="px-6 py-3.5">Nama Key</th>
                    <th className="px-6 py-3.5">Kadaluarsa Pada</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
                  {filteredKeys.map((k) => (
                    <tr 
                      key={k.key} 
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors"
                    >
                      <td className="px-6 py-4 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                        {k.key}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {k.expirationDate}
                      </td>
                      <td className="px-6 py-4">
                        {k.isExpired ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400">
                            Kadaluarsa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400">
                            <Check className="h-3 w-3" />
                            Aktif
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteKey(k.key)}
                          disabled={loading}
                          className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
