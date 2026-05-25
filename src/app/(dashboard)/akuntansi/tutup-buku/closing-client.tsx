"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { performMonthlyClosing, getClosingReadinessCheck, type ClosingCheckItem } from "@/lib/actions/accounting"
import { toast } from "sonner"
import { Lock, ShieldCheck, AlertTriangle, AlertCircle, CheckCircle2, Loader2, RefreshCw, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
]

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)

/**
 * Komponen ikon status pengecekan kesiapan tutup buku.
 * @param {{ status: ClosingCheckItem['status'] }} props
 */
function CheckIcon({ status }: { status: ClosingCheckItem["status"] }) {
  if (status === "loading") return <Loader2 className="h-4.5 w-4.5 text-slate-400 animate-spin shrink-0" />
  if (status === "ok")      return <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
  if (status === "warning") return <AlertTriangle className="h-5 w-5 text-amber-500 dark:text-amber-400 shrink-0" />
  if (status === "error")   return <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
  return null
}

export function ClosingClient({ closures }: { closures: any[] }) {
  const now = new Date()
  const router = useRouter()

  const [month, setMonth] = useState((now.getMonth() + 1).toString())
  const [year, setYear] = useState(now.getFullYear().toString())
  const [loading, setLoading] = useState(false)

  // Pre-check state
  const [checks, setChecks] = useState<ClosingCheckItem[] | null>(null)
  const [checkLoading, setCheckLoading] = useState(false)
  const [checkDone, setCheckDone] = useState(false)

  /** Jalankan semua pengecekan otomatis untuk periode yang dipilih */
  const runChecks = useCallback(async () => {
    setCheckLoading(true)
    setCheckDone(false)
    // Tampilkan skeleton loading dulu
    setChecks([
      { id: "no_duplicate",          label: "Periode belum ditutup sebelumnya",             status: "loading", detail: "" },
      { id: "sequential_order",      label: "Bulan sebelumnya sudah ditutup",                status: "loading", detail: "" },
      { id: "no_draft_journals",     label: "Tidak ada jurnal Draft di periode ini",          status: "loading", detail: "" },
      { id: "has_activity",          label: "Terdapat transaksi pada periode ini",            status: "loading", detail: "" },
      { id: "loan_schedules_complete", label: "Semua pinjaman aktif memiliki jadwal angsuran", status: "loading", detail: "" },
    ])

    try {
      const result = await getClosingReadinessCheck(parseInt(month), parseInt(year))
      setChecks(result)
      setCheckDone(true)
    } catch {
      toast.error("Gagal menjalankan pengecekan kesiapan.")
      setChecks(null)
    } finally {
      setCheckLoading(false)
    }
  }, [month, year])

  /** Reset pengecekan saat periode berubah */
  useEffect(() => {
    setChecks(null)
    setCheckDone(false)
  }, [month, year])

  const hasBlockingError = checks?.some(c => c.status === "error") ?? false
  const allOk = checks?.every(c => c.status === "ok" || c.status === "warning") ?? false

  const handleCloseMonth = async () => {
    if (!checkDone) {
      toast.warning("Jalankan pengecekan kesiapan terlebih dahulu sebelum menutup buku.")
      return
    }
    if (hasBlockingError) {
      toast.error("Selesaikan semua masalah kritis sebelum menutup buku.")
      return
    }
    if (!confirm(`Tutup buku untuk periode ${MONTHS[parseInt(month) - 1]} ${year}?\nTransaksi pada periode ini tidak dapat diubah setelah ditutup.`)) return

    setLoading(true)
    const res = await performMonthlyClosing(parseInt(month), parseInt(year))
    if (res.success) {
      toast.success(`Buku berhasil ditutup untuk periode ${MONTHS[parseInt(month) - 1]} ${year}.`)
      router.refresh()
      setChecks(null)
      setCheckDone(false)
    } else {
      toast.error(res.error)
    }
    setLoading(false)
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
      {/* ── Kiri: Form Tutup Buku ─────────────────────────────────────── */}
      <div className="space-y-4">
        <Card className="border border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-lg font-bold">Proses Tutup Buku</CardTitle>
            <CardDescription>Pilih periode, lakukan pengecekan, lalu kunci.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0 md:pt-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Bulan</label>
                <Select value={month} onValueChange={(v) => setMonth(v || month)}>
                  <SelectTrigger className="h-12 text-base rounded-xl">
                    <SelectValue placeholder="Bulan" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i} value={(i + 1).toString()}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Tahun</label>
                <Select value={year} onValueChange={(v) => v ? setYear(v) : null}>
                  <SelectTrigger className="h-12 text-base rounded-xl">
                    <SelectValue placeholder="Tahun" />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2].map(offset => {
                      const y = now.getFullYear() - offset
                      return <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tombol Cek Kesiapan */}
            <Button
              variant="outline"
              className="w-full h-12 rounded-xl text-base font-semibold gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-900/50 dark:text-blue-400 dark:hover:bg-blue-950/20"
              onClick={runChecks}
              disabled={checkLoading}
            >
              {checkLoading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Mengecek...</>
                : checkDone
                ? <><RefreshCw className="h-4 w-4" /> Cek Ulang Kesiapan</>
                : <><ShieldCheck className="h-4 w-4" /> Cek Kesiapan Tutup Buku</>
              }
            </Button>

            {/* Tombol Tutup Buku — aktif hanya setelah cek selesai dan tidak ada error kritis */}
            <Button
              className={cn(
                "w-full h-12 rounded-xl text-base font-semibold gap-2 transition-all",
                !checkDone
                  ? "opacity-50 cursor-not-allowed"
                  : hasBlockingError
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              )}
              onClick={handleCloseMonth}
              disabled={loading || !checkDone || hasBlockingError}
            >
              <Lock className="h-5 w-5" />
              {loading
                ? "Memproses..."
                : !checkDone
                ? "Jalankan cek kesiapan dulu"
                : hasBlockingError
                ? "Ada masalah kritis — tidak bisa ditutup"
                : `Tutup Buku ${MONTHS[parseInt(month) - 1]} ${year}`
              }
            </Button>

            {/* Status hint */}
            {checkDone && !hasBlockingError && (
              <p className="text-xs text-center text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {allOk ? "Semua cek lolos — siap tutup buku." : "Cek selesai — ada peringatan yang perlu diperhatikan."}
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Hasil Pengecekan Otomatis ──────────────────────────────────── */}
        {checks && (
          <Card className="border border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="p-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold">Hasil Pengecekan Otomatis</CardTitle>
                <div className="flex items-center gap-1.5">
                  {checks.filter(c => c.status === "error").length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                      {checks.filter(c => c.status === "error").length} Kritis
                    </span>
                  )}
                  {checks.filter(c => c.status === "warning").length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      {checks.filter(c => c.status === "warning").length} Peringatan
                    </span>
                  )}
                  {checks.every(c => c.status === "ok") && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      Semua OK
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {checks.map((check) => (
                  <div
                    key={check.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 transition-colors",
                      check.status === "error"   && "bg-rose-50/50 dark:bg-rose-950/10",
                      check.status === "warning" && "bg-amber-50/50 dark:bg-amber-950/10",
                      check.status === "ok"      && "bg-transparent",
                      check.status === "loading" && "bg-transparent"
                    )}
                  >
                    <div className="mt-0.5">
                      <CheckIcon status={check.status} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-semibold leading-snug",
                        check.status === "error"   && "text-rose-800 dark:text-rose-300",
                        check.status === "warning" && "text-amber-800 dark:text-amber-300",
                        check.status === "ok"      && "text-slate-800 dark:text-slate-200",
                        check.status === "loading" && "text-slate-400",
                      )}>
                        {check.label}
                      </p>
                      {check.detail && check.status !== "loading" && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                          {check.detail}
                        </p>
                      )}
                    </div>
                    {check.actionLink && check.status !== "ok" && check.status !== "loading" && (
                      <button
                        onClick={() => router.push(check.actionLink!)}
                        className={cn(
                          "shrink-0 flex items-center gap-0.5 text-xs font-bold",
                          check.status === "error"   && "text-rose-600 hover:text-rose-700",
                          check.status === "warning" && "text-amber-600 hover:text-amber-700",
                        )}
                      >
                        Perbaiki <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Kanan: Riwayat Tutup Buku ─────────────────────────────────── */}
      <Card className="border border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg font-bold">Riwayat Tutup Buku</CardTitle>
          <CardDescription>Daftar bulan yang sudah dikunci beserta ringkasan keuangannya.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 md:p-6 md:pt-0">
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Periode</TableHead>
                  <TableHead className="text-right">Total Pendapatan</TableHead>
                  <TableHead className="text-right">Total Pengeluaran</TableHead>
                  <TableHead className="text-right">SHU Sementara</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closures.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-400 py-4">Belum ada riwayat tutup buku.</TableCell>
                  </TableRow>
                )}
                {closures.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{MONTHS[c.month - 1]} {c.year}</TableCell>
                    <TableCell className="text-right text-green-600">{formatCurrency(c.total_revenue)}</TableCell>
                    <TableCell className="text-right text-red-600">{formatCurrency(c.total_expense)}</TableCell>
                    <TableCell className="text-right font-bold text-primary">{formatCurrency(c.net_income)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card Feed View */}
          <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {closures.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                Belum ada riwayat tutup buku.
              </div>
            ) : (
              closures.map(c => (
                <div key={c.id} className="p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-base text-slate-900 dark:text-slate-50">{MONTHS[c.month - 1]} {c.year}</span>
                    <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-650 px-2 py-0.5 rounded-full font-semibold">Terkunci</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl p-2.5">
                      <p className="text-slate-400 text-[10px]">Total Pendapatan</p>
                      <p className="font-bold text-green-600 mt-0.5">{formatCurrency(c.total_revenue)}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl p-2.5">
                      <p className="text-slate-400 text-[10px]">Total Pengeluaran</p>
                      <p className="font-bold text-red-650 mt-0.5">{formatCurrency(c.total_expense)}</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs border-t border-slate-50 dark:border-slate-800/35 pt-2.5 mt-1">
                    <span className="text-slate-400">SHU Sementara</span>
                    <span className="font-extrabold text-blue-600 dark:text-blue-450 text-sm">{formatCurrency(c.net_income)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
