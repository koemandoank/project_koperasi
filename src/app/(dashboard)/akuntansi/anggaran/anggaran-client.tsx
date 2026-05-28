"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { 
  Calculator, Wallet, AlertCircle, FileSpreadsheet, Plus, 
  Loader2, X, Check, Calendar, ArrowUpRight, ArrowDownRight, Tag 
} from "lucide-react"
import { BudgetData, createBudgetPost, getBudgetTransactions, BudgetTransaction } from "@/lib/actions/budgets"

interface AnggaranClientProps {
  initialBudgets: BudgetData[]
}

/**
 * AnggaranClient - Client Component
 * 
 * Merender dashboard interaktif anggaran koperasi dengan modul penambahan
 * pos anggaran baru dan dialog rincian realisasi belanja realistis.
 * 
 * @param {AnggaranClientProps} props - Initial data budgets dari database.
 */
export function AnggaranClient({ initialBudgets }: AnggaranClientProps) {
  const [budgets, setBudgets] = useState<BudgetData[]>(initialBudgets)
  const [loading, setLoading] = useState<boolean>(false)

  // State untuk Modal Buat Pos Anggaran
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false)
  const [newCode, setNewCode] = useState<string>("")
  const [newName, setNewName] = useState<string>("")
  const [newAllocated, setNewAllocated] = useState<number>(0)
  const [newColor, setNewColor] = useState<string>("bg-indigo-600")
  const [newYear, setNewYear] = useState<number>(2026)

  // State untuk Modal Lihat Rincian
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false)
  const [selectedBudget, setSelectedBudget] = useState<BudgetData | null>(null)
  const [transactions, setTransactions] = useState<BudgetTransaction[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState<boolean>(false)

  // ─────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────
  
  /**
   * Format mata uang rupiah.
   */
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { 
      style: 'currency', 
      currency: 'IDR', 
      maximumFractionDigits: 0 
    }).format(val)
  }

  /**
   * Format ribuan ke angka biasa.
   */
  const parseFormattedNumber = (val: string): number => {
    const clean = val.replace(/\D/g, "")
    if (!clean) return 0
    return parseInt(clean, 10)
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseFormattedNumber(e.target.value)
    setNewAllocated(parsed)
  }

  /**
   * Menghitung total rekap anggaran.
   */
  const totalAllocated = budgets.reduce((s: any, b: any) => s + b.allocated, 0)
  const totalUsed = budgets.reduce((s: any, b: any) => s + b.used, 0)
  const totalRemaining = totalAllocated - totalUsed
  const overallUsagePct = totalAllocated > 0 ? Math.round((totalUsed / totalAllocated) * 100) : 0

  // ─────────────────────────────────────────────
  // Event Handlers
  // ─────────────────────────────────────────────

  /**
   * Menyimpan Pos Anggaran Baru ke database.
   */
  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newCode.trim()) {
      toast.error("Kode rekening pos anggaran wajib diisi.")
      return
    }
    if (!newName.trim()) {
      toast.error("Nama pos anggaran wajib diisi.")
      return
    }
    if (newAllocated <= 0) {
      toast.error("Pagu alokasi anggaran harus lebih besar dari Rp 0.")
      return
    }

    try {
      setLoading(true)
      const res = await createBudgetPost({
        code: newCode.trim(),
        name: newName.trim(),
        allocated: newAllocated,
        color: newColor,
        year: newYear,
      })

      if (res.success) {
        toast.success("Pos anggaran baru berhasil disimpan!")
        
        // Update local state
        const updatedBudget: BudgetData = {
          id: Math.random(), // Temporary local ID before reload
          code: newCode.trim(),
          name: newName.trim(),
          allocated: newAllocated,
          used: 0,
          color: newColor,
          year: newYear,
          created_at: new Date(),
          updated_at: new Date(),
        }
        setBudgets((prev) => [...prev, updatedBudget].sort((a, b) => a.code.localeCompare(b.code)))
        
        // Reset Form
        setNewCode("")
        setNewName("")
        setNewAllocated(0)
        setNewColor("bg-indigo-600")
        setIsCreateOpen(false)
      } else {
        toast.error(res.error || "Gagal menyimpan pos anggaran baru.")
      }
    } catch (err) {
      console.error(err)
      toast.error("Terjadi kegagalan koneksi sistem.")
    } finally {
      setLoading(false)
    }
  }

  /**
   * Membuka Detail Transaksi Pos Anggaran & melakukan fetch dinamis.
   */
  const handleOpenDetail = async (budget: BudgetData) => {
    setSelectedBudget(budget)
    setIsDetailOpen(true)
    setLoadingTransactions(true)
    try {
      const data = await getBudgetTransactions(budget.code)
      setTransactions(data)
    } catch (err) {
      console.error(err)
      toast.error("Gagal memuat log pengeluaran anggaran.")
    } finally {
      setLoadingTransactions(false)
    }
  }

  const colorOptions = [
    { value: "bg-indigo-600", label: "Indigo" },
    { value: "bg-emerald-600", label: "Emerald" },
    { value: "bg-blue-600", label: "Blue" },
    { value: "bg-amber-500", label: "Amber" },
    { value: "bg-teal-600", label: "Teal" },
    { value: "bg-rose-500", label: "Rose" },
    { value: "bg-violet-600", label: "Violet" },
  ]

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
            Manajemen Anggaran
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Pantau alokasi, penggunaan, dan sisa pagu anggaran divisi koperasi secara berkala.
          </p>
        </div>
        
        <Button 
          onClick={() => setIsCreateOpen(true)}
          className="h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 self-start md:self-auto"
        >
          <Plus className="h-4.5 w-4.5" />
          Buat Pos Anggaran
        </Button>
      </div>

      {/* Stats Summary Card Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <Card className="border border-slate-100 dark:border-slate-900 shadow-md rounded-2xl bg-white dark:bg-slate-950 p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Pagu Alokasi</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1.5">
                {formatCurrency(totalAllocated)}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Calculator className="h-5 w-5" />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3 font-medium">Periode Tahun Buku 2026</p>
        </Card>

        <Card className="border border-slate-100 dark:border-slate-900 shadow-md rounded-2xl bg-white dark:bg-slate-950 p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Realisasi Anggaran</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1.5">
                {formatCurrency(totalUsed)}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-3">
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">
              {overallUsagePct}% Terpakai
            </span>
          </div>
        </Card>

        <Card className="border border-slate-100 dark:border-slate-900 shadow-md rounded-2xl bg-white dark:bg-slate-950 p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sisa Pagu Bersih</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1.5">
                {formatCurrency(totalRemaining)}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3 font-medium">Batas toleransi deviasi &lt; 5%</p>
        </Card>

      </div>

      {/* Alert Warning Box jika ada anggaran kritis */}
      {budgets.some((b: any) => (b.allocated > 0 ? (b.used / b.allocated) : 0) >= 0.85) && (
        <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/60 dark:border-amber-900/30 rounded-2xl p-4 flex gap-3 items-start animate-pulse">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold text-amber-800 dark:text-amber-400">Perhatian Kepatuhan Keuangan</p>
            <p className="text-amber-700/85 dark:text-slate-400 mt-0.5">
              Salah satu pos anggaran Anda telah melewati batas ambang aman kuota terpakai (&gt;85%). Silakan ajukan persetujuan perubahan anggaran jika terdapat rencana transaksi pengeluaran baru pada pos terkait.
            </p>
          </div>
        </div>
      )}

      {/* Grid of Budget Cards */}
      <div className="space-y-4">
        <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-200 tracking-tight">Pos Anggaran Aktif</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {budgets.map((b: any, i: any) => {
            const pct = b.allocated > 0 ? Math.round((b.used / b.allocated) * 100) : 0
            return (
              <Card key={b.id || i} className="border border-slate-200/60 dark:border-slate-800 shadow-md rounded-2xl bg-white dark:bg-slate-950 p-6 space-y-4 hover:shadow-lg transition-all duration-300">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-base text-slate-850 dark:text-slate-100">{b.name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Kode Rekening: {b.code}</p>
                  </div>
                  <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                    pct >= 85 
                      ? "bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400" 
                      : pct >= 60 
                        ? "bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400" 
                        : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400"
                  }`}>
                    {pct}% Terpakai
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-850 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        pct >= 85 ? "bg-rose-500" : pct >= 60 ? "bg-amber-500" : b.color
                      }`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 font-medium">
                    <span>Terpakai: {formatCurrency(b.used)}</span>
                    <span>Pagu: {formatCurrency(b.allocated)}</span>
                  </div>
                </div>

                <div className="flex justify-between text-[11px] text-slate-450 border-t border-slate-150/50 dark:border-slate-900 pt-3 mt-1.5 font-medium">
                  <span>Sisa Saldo: {formatCurrency(b.allocated - b.used)}</span>
                  <button 
                    onClick={() => handleOpenDetail(b)}
                    className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline hover:text-indigo-700 flex items-center gap-1 transition-all"
                  >
                    Lihat Rincian &rarr;
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────── */}
      {/* MODAL DIALOG: Buat Pos Anggaran Baru */}
      {/* ──────────────────────────────────────────────────────── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 shadow-2xl p-6">
          <form onSubmit={handleSaveBudget} className="space-y-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-slate-900 dark:text-slate-100">
                Buat Pos Anggaran Baru
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500 dark:text-slate-400">
                Tambahkan akun rekening anggaran belanja koperasi untuk tahun buku {newYear}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Kode Rekening Pos
                </label>
                <Input
                  required
                  placeholder="Contoh: 501.08"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="rounded-xl border-slate-200 dark:border-slate-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Nama Pos Anggaran
                </label>
                <Input
                  required
                  placeholder="Contoh: Promosi & Pemasaran"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="rounded-xl border-slate-200 dark:border-slate-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Pagu Alokasi (Rp)
                </label>
                <Input
                  required
                  type="text"
                  placeholder="Contoh: 15.000.000"
                  value={newAllocated === 0 ? "" : new Intl.NumberFormat("id-ID").format(newAllocated)}
                  onChange={handleAmountChange}
                  className="rounded-xl border-slate-200 dark:border-slate-800 font-extrabold text-slate-900 dark:text-slate-50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Tahun Buku
                </label>
                <Input
                  required
                  type="number"
                  value={newYear}
                  onChange={(e) => setNewYear(parseInt(e.target.value) || 2026)}
                  className="rounded-xl border-slate-200 dark:border-slate-800"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Tema Warna Visual
                </label>
                <div className="flex flex-wrap gap-2.5 mt-1">
                  {colorOptions.map((opt: any) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setNewColor(opt.value)}
                      className={`h-7 px-3 rounded-full text-xs font-bold transition-all border flex items-center gap-1 ${
                        newColor === opt.value
                          ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-50 dark:text-slate-900 dark:border-slate-50"
                          : "bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400"
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${opt.value}`} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-xl"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Simpan Pos Anggaran
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ──────────────────────────────────────────────────────── */}
      {/* MODAL DIALOG: Lihat Rincian & Riwayat Transaksi */}
      {/* ──────────────────────────────────────────────────────── */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-[700px] rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 shadow-2xl p-6">
          {selectedBudget && (
            <div className="space-y-6">
              <DialogHeader>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                  <Tag className="w-3.5 h-3.5" />
                  Rincian Pagu Anggaran • {selectedBudget.code}
                </div>
                <DialogTitle className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-50 mt-1">
                  {selectedBudget.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                  Berikut rincian sisa saldo, progress serapan pagu, dan riwayat realisasi biaya.
                </DialogDescription>
              </DialogHeader>

              {/* Status Pagu Section */}
              <div className="grid grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-900">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pagu Alokasi</p>
                  <p className="text-sm md:text-base font-extrabold text-slate-900 dark:text-slate-100">
                    {formatCurrency(selectedBudget.allocated)}
                  </p>
                </div>
                <div className="space-y-1 border-l border-slate-200 dark:border-slate-800 pl-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Realisasi</p>
                  <p className="text-sm md:text-base font-extrabold text-indigo-600 dark:text-indigo-400">
                    {formatCurrency(selectedBudget.used)}
                  </p>
                </div>
                <div className="space-y-1 border-l border-slate-200 dark:border-slate-800 pl-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sisa Saldo</p>
                  <p className="text-sm md:text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(selectedBudget.allocated - selectedBudget.used)}
                  </p>
                </div>
              </div>

              {/* Visual Serapan Progress */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                  <span>Prosentase Serapan Anggaran</span>
                  <span>{selectedBudget.allocated > 0 ? Math.round((selectedBudget.used / selectedBudget.allocated) * 100) : 0}%</span>
                </div>
                <div className="h-3 w-full bg-slate-100 dark:bg-slate-850 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      (selectedBudget.allocated > 0 ? (selectedBudget.used / selectedBudget.allocated) : 0) >= 0.85 
                        ? "bg-rose-500" 
                        : (selectedBudget.allocated > 0 ? (selectedBudget.used / selectedBudget.allocated) : 0) >= 0.60 
                          ? "bg-amber-500" 
                          : selectedBudget.color
                    }`}
                    style={{ width: `${Math.min(selectedBudget.allocated > 0 ? Math.round((selectedBudget.used / selectedBudget.allocated) * 100) : 0, 100)}%` }}
                  />
                </div>
              </div>

              {/* Transactions Timeline List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Riwayat Pengeluaran Riil
                </h4>

                {loadingTransactions ? (
                  <div className="flex flex-col items-center justify-center py-10 space-y-2">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    <p className="text-xs text-slate-400 font-bold">Menghubungkan ke buku besar...</p>
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    <p className="text-xs text-slate-400 font-medium">Belum ada realisasi transaksi belanja pada pos ini.</p>
                  </div>
                ) : (
                  <div className="border border-slate-100 dark:border-slate-900 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto max-h-[250px] overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-900 text-slate-400 font-bold uppercase tracking-wider sticky top-0">
                          <tr>
                            <th className="px-4 py-2.5">Tanggal</th>
                            <th className="px-4 py-2.5">Keterangan</th>
                            <th className="px-4 py-2.5 text-right">Jumlah</th>
                            <th className="px-4 py-2.5 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-900 bg-white dark:bg-slate-950 font-medium text-slate-700 dark:text-slate-350">
                          {transactions.map((tx: any) => (
                            <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                              <td className="px-4 py-3 text-slate-400 font-bold whitespace-nowrap">
                                {new Date(tx.date).toLocaleDateString("id-ID", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </td>
                              <td className="px-4 py-3 min-w-[200px]">
                                <p className="font-extrabold text-slate-850 dark:text-slate-100 leading-tight">
                                  {tx.description}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  Ref: {tx.reference} • Recipient: {tx.recipient}
                                </p>
                              </td>
                              <td className="px-4 py-3 text-right font-extrabold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                                {formatCurrency(tx.amount)}
                              </td>
                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                  tx.status === "completed"
                                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-455"
                                    : "bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-455"
                                }`}>
                                  {tx.status === "completed" ? (
                                    <>
                                      <Check className="w-2.5 h-2.5" />
                                      Lunas
                                    </>
                                  ) : (
                                    <>
                                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                      Tertunda
                                    </>
                                  )}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-900">
                <Button 
                  onClick={() => setIsDetailOpen(false)}
                  className="rounded-xl px-5 bg-slate-900 hover:bg-slate-800 text-white font-bold"
                >
                  Tutup Dialog
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
    </div>
  )
}
