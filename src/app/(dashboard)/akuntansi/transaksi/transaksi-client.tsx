"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { 
  TrendingUp, TrendingDown, RefreshCw, 
  ArrowUpRight, Plus, Loader2 
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { 
  createAdditionalAccount, 
  createManualTransaction, 
  getTodayTransactionStats, 
  getRecentTransactions, 
  ChartOfAccountItem, 
  RecentTransactionItem, 
  TransactionStats 
} from "@/lib/actions/transactions"

interface TransaksiClientProps {
  initialAccounts: ChartOfAccountItem[]
  initialCategoriesExpense: ChartOfAccountItem[]
  initialCategoriesIncome: ChartOfAccountItem[]
  initialStats: TransactionStats
  initialRecentTransactions: RecentTransactionItem[]
}

/**
 * TransaksiClient - Client Component
 * 
 * Merender form input transaksi (Pemasukan / Pengeluaran) secara interaktif
 * beserta ringkasan statistik harian dan daftar riwayat transaksi terbaru.
 * Mendukung penambahan Kategori dan Rekening bank baru secara dinamis (inline modal).
 */
export function TransaksiClient({
  initialAccounts,
  initialCategoriesExpense,
  initialCategoriesIncome,
  initialStats,
  initialRecentTransactions
}: TransaksiClientProps) {
  const router = useRouter()

  // ─────────────────────────────────────────────
  // State Management
  // ─────────────────────────────────────────────
  const [type, setType] = useState<"pemasukan" | "pengeluaran">("pengeluaran")
  const [amount, setAmount] = useState<number>(0)
  const [accountId, setAccountId] = useState<string>("")
  const [categoryId, setCategoryId] = useState<string>("")
  const [date, setDate] = useState<string>(() => new Date().toISOString().split("T")[0])
  const [notes, setNotes] = useState<string>("")
  
  const [loading, setLoading] = useState<boolean>(false)
  const [refreshing, setRefreshing] = useState<boolean>(false)

  // Dynamic lists from database
  const [accounts, setAccounts] = useState<ChartOfAccountItem[]>(initialAccounts)
  const [categoriesExpense, setCategoriesExpense] = useState<ChartOfAccountItem[]>(initialCategoriesExpense)
  const [categoriesIncome, setCategoriesIncome] = useState<ChartOfAccountItem[]>(initialCategoriesIncome)
  const [stats, setStats] = useState<TransactionStats>(initialStats)
  const [recentTransactions, setRecentTransactions] = useState<RecentTransactionItem[]>(initialRecentTransactions)

  // Modal Dialog states
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false)
  const [addModalType, setAddModalType] = useState<"category" | "bank">("category")
  const [addModalName, setAddModalName] = useState<string>("")
  const [addModalLoading, setAddModalLoading] = useState<boolean>(false)

  // ─────────────────────────────────────────────
  // Sync Selection on Tab / List changes
  // ─────────────────────────────────────────────
  useEffect(() => {
    const currentCategories = type === "pengeluaran" ? categoriesExpense : categoriesIncome
    if (currentCategories.length > 0) {
      // Auto select first category in the new tab
      setCategoryId(currentCategories[0].id.toString())
    } else {
      setCategoryId("")
    }
  }, [type, categoriesExpense, categoriesIncome])

  useEffect(() => {
    if (!accountId && accounts.length > 0) {
      // Auto select first account/bank
      setAccountId(accounts[0].id.toString())
    }
  }, [accounts, accountId])

  // ─────────────────────────────────────────────
  // Format / Parsing Utilities
  // ─────────────────────────────────────────────
  const formatNumberWithSeparator = (num: number): string => {
    return new Intl.NumberFormat("id-ID").format(num)
  }

  const parseFormattedNumber = (val: string): number => {
    const clean = val.replace(/\D/g, "")
    if (!clean) return 0
    return parseInt(clean, 10)
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { 
      style: 'currency', 
      currency: 'IDR', 
      maximumFractionDigits: 0 
    }).format(val)
  }

  const formatTransactionAmount = (amt: number, txType: "pemasukan" | "pengeluaran") => {
    const formatted = formatCurrency(amt)
    // Strip "Rp" logo and non-breaking space for clean custom presentation
    const cleanVal = formatted.replace("Rp\u00A0", "").replace("Rp", "")
    return txType === "pengeluaran" ? `-Rp ${cleanVal}` : `+Rp ${cleanVal}`
  }

  const formatDateIndo = (dateStr: string) => {
    try {
      const monthsIndo = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni", 
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
      ]
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      return `${d.getDate()} ${monthsIndo[d.getMonth()]} ${d.getFullYear()}`
    } catch {
      return dateStr
    }
  }

  // ─────────────────────────────────────────────
  // Event Handlers
  // ─────────────────────────────────────────────
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseFormattedNumber(e.target.value)
    setAmount(parsed)
  }

  const openAddModal = (modalType: "category" | "bank") => {
    setAddModalType(modalType)
    setAddModalName("")
    setIsAddModalOpen(true)
  }

  const handleSaveAdditionalAccount = async () => {
    if (!addModalName.trim()) return
    setAddModalLoading(true)
    
    try {
      const accountType = addModalType === "bank" 
        ? "asset" 
        : (type === "pengeluaran" ? "expense" : "revenue")
      
      const res = await createAdditionalAccount(addModalName.trim(), accountType)
      
      if (res.success && res.data) {
        toast.success(`${addModalType === "category" ? "Kategori" : "Rekening"} baru berhasil dibuat!`)
        
        // Push newly created account to local state and auto-select it
        if (addModalType === "bank") {
          setAccounts(prev => [...prev, res.data!])
          setAccountId(res.data!.id.toString())
        } else {
          if (type === "pengeluaran") {
            setCategoriesExpense(prev => [...prev, res.data!])
          } else {
            setCategoriesIncome(prev => [...prev, res.data!])
          }
          setCategoryId(res.data!.id.toString())
        }
        
        setIsAddModalOpen(false)
        setAddModalName("")
        router.refresh()
      } else {
        toast.error(res.error || "Gagal membuat kategori/rekening tambahan.")
      }
    } catch (err: any) {
      toast.error("Terjadi kesalahan saat menambahkan kategori/rekening.")
      console.error(err)
    } finally {
      setAddModalLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const statsRes = await getTodayTransactionStats()
      const recentRes = await getRecentTransactions(10)
      
      if (statsRes.success && statsRes.stats) {
        setStats(statsRes.stats)
      }
      if (recentRes.success && recentRes.entries) {
        setRecentTransactions(recentRes.entries)
      }
      router.refresh()
      toast.success("Data berhasil diperbarui.")
    } catch (err) {
      toast.error("Gagal memperbarui data transaksi.")
      console.error(err)
    } finally {
      setRefreshing(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (amount <= 0) {
      toast.error("Nominal transaksi harus lebih besar dari Rp 0.")
      return
    }
    if (!categoryId) {
      toast.error("Silakan pilih kategori transaksi.")
      return
    }
    if (!accountId) {
      toast.error("Silakan pilih rekening transaksi.")
      return
    }

    setLoading(true)
    try {
      const res = await createManualTransaction({
        type,
        amount,
        accountId: Number(accountId),
        categoryId: Number(categoryId),
        date,
        notes: notes.trim() || undefined
      })

      if (res.success) {
        toast.success("Transaksi berhasil disimpan!")
        setAmount(0)
        setNotes("")
        
        // Refresh local dashboard states directly
        const statsRes = await getTodayTransactionStats()
        const recentRes = await getRecentTransactions(10)
        if (statsRes.success && statsRes.stats) {
          setStats(statsRes.stats)
        }
        if (recentRes.success && recentRes.entries) {
          setRecentTransactions(recentRes.entries)
        }
        router.refresh()
      } else {
        toast.error(res.error || "Gagal menyimpan transaksi manual.")
      }
    } catch (err: any) {
      toast.error("Terjadi kesalahan sistem saat memproses transaksi.")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const currentCategories = type === "pengeluaran" ? categoriesExpense : categoriesIncome

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      
      {/* ── LEFT COLUMN: INPUT FORM ───────────────────────────────────────── */}
      <div className="lg:col-span-7 space-y-6">
        <Card className="border border-slate-200/60 dark:border-slate-800 shadow-xl rounded-2xl bg-white dark:bg-slate-950 overflow-hidden">
          <CardContent className="p-6 md:p-8 space-y-6">
            
            {/* Elegant Tab Switcher */}
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setType("pemasukan")}
                className={cn(
                  "flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-bold transition-all duration-200 border",
                  type === "pemasukan"
                    ? "bg-emerald-50/70 border-emerald-500 text-emerald-600 dark:bg-emerald-950/20 dark:border-emerald-500/80 dark:text-emerald-400 shadow-sm"
                    : "bg-slate-50/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-900/70"
                )}
              >
                <TrendingUp className="h-4.5 w-4.5" />
                Pemasukan
              </button>
              <button
                type="button"
                onClick={() => setType("pengeluaran")}
                className={cn(
                  "flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-bold transition-all duration-200 border",
                  type === "pengeluaran"
                    ? "bg-rose-50/70 border-rose-500 text-rose-600 dark:bg-rose-950/20 dark:border-rose-500/80 dark:text-rose-400 shadow-sm"
                    : "bg-slate-50/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-900/70"
                )}
              >
                <TrendingDown className="h-4.5 w-4.5" />
                Pengeluaran
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Premium Numeric Amount Input Section */}
              <div className="flex flex-col items-center justify-center py-6 border-b border-dashed border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-[0.2em] mb-2.5">
                  {type === "pengeluaran" ? "JUMLAH PENGELUARAN" : "JUMLAH PEMASUKAN"}
                </span>
                <div className="flex items-center justify-center font-bold text-slate-900 dark:text-slate-50 relative">
                  <span className={cn(
                    "text-3xl mr-2 font-black select-none",
                    type === "pengeluaran" ? "text-rose-500" : "text-emerald-500"
                  )}>Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={amount === 0 ? "" : formatNumberWithSeparator(amount)}
                    onChange={handleAmountChange}
                    placeholder="0"
                    className={cn(
                      "text-5xl md:text-6xl font-extrabold bg-transparent border-0 focus:outline-none focus:ring-0 text-center w-full max-w-[280px] p-0 border-b-2 transition-all duration-300",
                      type === "pengeluaran" 
                        ? "border-rose-200 focus:border-rose-500 text-rose-600 dark:text-rose-400 placeholder-rose-250 focus:placeholder-transparent" 
                        : "border-emerald-200 focus:border-emerald-500 text-emerald-600 dark:text-emerald-400 placeholder-emerald-250 focus:placeholder-transparent"
                    )}
                  />
                </div>
              </div>

              {/* Grid: Kategori & Tanggal */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Category Selection */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Kategori *
                    </label>
                    <button
                      type="button"
                      onClick={() => openAddModal("category")}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="h-3 w-3" /> Tambah Kategori
                    </button>
                  </div>
                  <div className="relative">
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="h-12 w-full text-base rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all duration-200 shadow-sm appearance-none"
                      required
                    >
                      <option value="" disabled>Pilih kategori...</option>
                      {currentCategories.map((c) => (
                        <option key={c.id} value={c.id.toString()}>{c.name}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      ▼
                    </div>
                  </div>
                </div>

                {/* Date Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Tanggal *
                  </label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-12 text-base rounded-xl border-slate-200/80 focus:border-indigo-500 shadow-sm bg-white dark:bg-slate-900"
                    required
                  />
                </div>

              </div>

              {/* Notes Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Catatan <span className="text-slate-350 font-normal text-[10px]">(opsional)</span>
                </label>
                <Input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Misal: Bayar tagihan listrik, Gaji karyawan..."
                  className="h-12 text-base rounded-xl border-slate-200/80 focus:border-indigo-500 shadow-sm bg-white dark:bg-slate-900"
                />
              </div>

              {/* Account Selection */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Rekening Pembayar / Penerima *
                  </label>
                  <button
                    type="button"
                    onClick={() => openAddModal("bank")}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:underline flex items-center gap-0.5"
                  >
                    <Plus className="h-3 w-3" /> Tambah Rekening
                  </button>
                </div>
                <div className="relative">
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="h-12 w-full text-base rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all duration-200 shadow-sm appearance-none"
                    required
                  >
                    <option value="" disabled>Pilih rekening...</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id.toString()}>{acc.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    ▼
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading || amount <= 0}
                className={cn(
                  "w-full h-12 rounded-xl text-base font-bold shadow-lg transition-all duration-200 mt-2",
                  type === "pengeluaran"
                    ? "bg-rose-600 hover:bg-rose-700 text-white dark:bg-rose-600 dark:hover:bg-rose-750"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-750"
                )}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" /> Menyimpan...
                  </span>
                ) : (
                  `Simpan ${type === "pengeluaran" ? "Pengeluaran" : "Pemasukan"}`
                )}
              </Button>

            </form>
          </CardContent>
        </Card>
      </div>

      {/* ── RIGHT COLUMN: STATS & HISTORY ─────────────────────────────────── */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* Row: Stats Pemasukan & Pengeluaran */}
        <div className="grid grid-cols-2 gap-4">
          
          {/* Stats Card: Pemasukan */}
          <Card className="border border-slate-100 dark:border-slate-900 shadow-md rounded-2xl bg-white dark:bg-slate-950 p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
            <p className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
              Pemasukan
            </p>
            <p className="text-lg md:text-xl font-black text-slate-900 dark:text-slate-100 mt-1 truncate">
              {formatCurrency(stats.pemasukanHariIni)}
            </p>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Hari ini</p>
          </Card>

          {/* Stats Card: Pengeluaran */}
          <Card className="border border-slate-100 dark:border-slate-900 shadow-md rounded-2xl bg-white dark:bg-slate-950 p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
            <p className="text-[10px] font-extrabold text-rose-600 dark:text-rose-400 uppercase tracking-widest">
              Pengeluaran
            </p>
            <p className="text-lg md:text-xl font-black text-slate-900 dark:text-slate-100 mt-1 truncate">
              {formatCurrency(stats.pengeluaranHariIni)}
            </p>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Hari ini</p>
          </Card>

        </div>

        {/* Card: Transaksi Terkini */}
        <Card className="border border-slate-200/60 dark:border-slate-800 shadow-xl rounded-2xl bg-white dark:bg-slate-950 overflow-hidden">
          
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-850">
            <h3 className="font-extrabold text-xs text-slate-800 dark:text-slate-100 tracking-wider uppercase">
              Transaksi Terkini
            </h3>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1 font-bold active:scale-95 transition-transform"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              Muat Ulang
            </button>
          </div>

          <div className="p-6 pt-2 space-y-4">
            {recentTransactions.length === 0 ? (
              <div className="py-8 text-center text-slate-400 dark:text-slate-600 text-sm">
                Belum ada transaksi manual hari ini.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-900 max-h-[360px] overflow-y-auto pr-1 no-scrollbar">
                {recentTransactions.map((tx) => (
                  <div key={tx.id} className="py-3.5 flex items-center justify-between group transition-all duration-200">
                    <div className="flex items-center gap-3">
                      {/* Status Dot */}
                      <span className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        tx.type === "pengeluaran" ? "bg-rose-500" : "bg-emerald-500"
                      )} />
                      
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-slate-850 dark:text-slate-200 line-clamp-1">
                          {tx.category_name}
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 leading-tight">
                          {formatDateIndo(tx.entry_date)} {tx.description ? `• ${tx.description}` : ""}
                        </span>
                      </div>
                    </div>
                    
                    <span className={cn(
                      "font-extrabold text-sm ml-2 whitespace-nowrap shrink-0",
                      tx.type === "pengeluaran" ? "text-rose-600 dark:text-rose-455" : "text-emerald-600 dark:text-emerald-455"
                    )}>
                      {formatTransactionAmount(tx.amount, tx.type)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Bottom link to Buku Besar */}
            <div className="border-t border-slate-100 dark:border-slate-900 pt-4 mt-2">
              <Link href="/akuntansi/buku-besar" className="w-full h-11 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-slate-650 dark:text-slate-350 transition-all duration-200 shadow-sm">
                Lihat Semua Histori
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>

          </div>
        </Card>

      </div>

      {/* ── DYNAMIC ADDITION DIALOG ────────────────────────────────────────── */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 shadow-2xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-50">
              {addModalType === "category" ? "Tambah Kategori Baru" : "Tambah Rekening Baru"}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 dark:text-slate-400">
              {addModalType === "category" 
                ? "Kategori ini akan dicatat dalam Chart of Accounts (COA) untuk pelaporan keuangan."
                : "Nama bank atau dompet kas baru untuk pencatatan penyimpanan/pembayaran aset."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-450 dark:text-slate-350 uppercase tracking-wider">
                Nama {addModalType === "category" ? "Kategori" : "Rekening"} *
              </label>
              <Input
                type="text"
                value={addModalName}
                onChange={(e) => setAddModalName(e.target.value)}
                placeholder={
                  addModalType === "category" 
                    ? (type === "pengeluaran" ? "Misal: Biaya Seragam Karyawan" : "Misal: Pendapatan Sponsor") 
                    : "Misal: Bank Mandiri (Koperasi)"
                }
                className="h-12 rounded-xl text-base border-slate-200/80 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter className="flex flex-row justify-end gap-3 mt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsAddModalOpen(false)}
              className="rounded-xl h-11 px-4 text-slate-650 dark:text-slate-350"
            >
              Batal
            </Button>
            <Button 
              type="button" 
              onClick={handleSaveAdditionalAccount}
              disabled={addModalLoading || !addModalName.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11 px-5 font-bold"
            >
              {addModalLoading ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
