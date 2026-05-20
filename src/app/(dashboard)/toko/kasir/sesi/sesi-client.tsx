"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  createCashRegisterSession,
  closeCashRegisterSession,
  getSessionSummary,
} from "@/lib/actions/pos-transactions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import {
  Lock, Unlock, ShoppingCart, CreditCard, Smartphone,
  ArrowUpRight, ArrowDownRight, AlertTriangle, CheckCircle2,
  RefreshCw, ChevronRight, Banknote, Wallet, History, Clock,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"

// ─── Types ──────────────────────────────────────────────────────────────────

type ActiveSession = {
  id: number; opened_at: string; opening_balance: number; opened_by: string
}
type RegisterStatus = {
  id: number; register_no: string; register_name: string; location: string
  is_active: boolean; active_session: ActiveSession | null
}
type SessionHistory = {
  id: number; session_date: string; opened_at: string; closed_at?: string | null
  opening_balance: number; closing_balance: number | null; difference: number | null
  status: string; opened_by_name: string; closed_by_name: string | null
  register_name: string
}
type SessionSummary = {
  session_id: number; session_date: string; opened_at: string; opened_by: string
  register_name: string; register_no: string; opening_balance: number
  expected_balance: number; total_transactions: number; total_sales: number
  total_refunds: number; net_sales: number
  breakdown: { cash: number; qris: number; transfer: number; paylater: number }
  orders: { id: number; order_no: string; grand_total: number; payment_method: string; ordered_at: string }[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const rp = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n)
const fmtTime  = (iso: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))
const fmtDate  = (iso: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(iso))
const fmtShort = (iso: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "short" }).format(new Date(iso))

// ─── Main Component ──────────────────────────────────────────────────────────

export function SesiKasirClient({
  registers, history, currentUser,
}: {
  registers: RegisterStatus[]
  history: SessionHistory[]
  currentUser: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Open dialog
  const [openDialog, setOpenDialog]   = useState(false)
  const [selectedReg, setSelectedReg] = useState<RegisterStatus | null>(null)
  const [openBal, setOpenBal]         = useState("")
  const [openNote, setOpenNote]       = useState("")
  const [openErr, setOpenErr]         = useState("")

  // Close dialog
  const [closeDialog, setCloseDialog]     = useState(false)
  const [closeBal, setCloseBal]           = useState("")
  const [summary, setSummary]             = useState<SessionSummary | null>(null)
  const [summaryLoading, setSummaryLoad]  = useState(false)
  const [closeErr, setCloseErr]           = useState("")

  // History tab
  const [showHistory, setShowHistory] = useState(false)

  // ── Open ────────────────────────────────────────────────────────────────────
  const handleOpenClick = (reg: RegisterStatus) => {
    setSelectedReg(reg); setOpenBal(""); setOpenNote(""); setOpenErr(""); setOpenDialog(true)
  }
  const handleOpenSubmit = async () => {
    const bal = parseFloat(openBal.replace(/\D/g, ""))
    if (isNaN(bal) || bal < 0) { setOpenErr("Masukkan saldo awal yang valid (≥ 0)"); return }
    setOpenErr("")
    startTransition(async () => {
      const res = await createCashRegisterSession(BigInt(selectedReg!.id), bal, openNote || undefined)
      if (!res.success) { setOpenErr(res.error ?? "Gagal membuka sesi"); return }
      setOpenDialog(false); router.refresh()
    })
  }

  // ── Close ───────────────────────────────────────────────────────────────────
  const handleCloseClick = async (reg: RegisterStatus) => {
    if (!reg.active_session) return
    setSelectedReg(reg); setCloseBal(""); setCloseErr(""); setSummary(null)
    setCloseDialog(true); setSummaryLoad(true)
    const res = await getSessionSummary(reg.active_session.id)
    setSummaryLoad(false)
    if (res.success && res.data) {
      setSummary(res.data as SessionSummary)
      setCloseBal(String(Math.round(res.data.expected_balance)))
    }
  }
  const handleCloseSubmit = async () => {
    const bal = parseFloat(closeBal.replace(/\D/g, ""))
    if (isNaN(bal) || bal < 0) { setCloseErr("Masukkan saldo akhir yang valid"); return }
    setCloseErr("")
    startTransition(async () => {
      const res = await closeCashRegisterSession(BigInt(selectedReg!.active_session!.id), bal)
      if (!res.success) { setCloseErr(res.error ?? "Gagal menutup sesi"); return }
      setCloseDialog(false); setSummary(null); router.refresh()
    })
  }

  const diff = summary ? parseFloat(closeBal || "0") - summary.expected_balance : 0

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b pb-0">
        {[
          { id: false, label: "Status Kasir", icon: CreditCard },
          { id: true,  label: `Riwayat Sesi (${history.length})`, icon: History },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={String(id)}
            onClick={() => setShowHistory(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              showHistory === id
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {/* ── Status Panel ──────────────────────────────────────────────────────── */}
      {!showHistory && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {registers.map((reg) => {
            const has = !!reg.active_session
            return (
              <div key={reg.id} className={`rounded-2xl border shadow-md overflow-hidden transition-all ${
                has ? "border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30"
                    : "border-slate-200 bg-card"
              }`}>
                {/* Header */}
                <div className={`px-5 py-4 flex items-center justify-between border-b ${
                  has ? "border-emerald-200 dark:border-emerald-800" : "border-slate-100 dark:border-slate-800"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${has ? "bg-emerald-500" : "bg-slate-400"}`}>
                      <CreditCard className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">{reg.register_name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{reg.register_no} · {reg.location}</p>
                    </div>
                  </div>
                  <Badge className={has
                    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                    : "bg-slate-100 text-slate-500 border-slate-200"
                  }>{has ? "Sesi Aktif" : "Tutup"}</Badge>
                </div>

                {/* Session Info */}
                <div className="px-5 py-4 space-y-3">
                  {has ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/70 dark:bg-black/20 rounded-xl p-3">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Saldo Awal</p>
                          <p className="font-bold text-emerald-700 text-sm mt-0.5">{rp(reg.active_session!.opening_balance)}</p>
                        </div>
                        <div className="bg-white/70 dark:bg-black/20 rounded-xl p-3">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Dibuka Oleh</p>
                          <p className="font-bold text-sm mt-0.5">{reg.active_session!.opened_by}</p>
                        </div>
                      </div>
                      <div className="bg-white/70 dark:bg-black/20 rounded-xl p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Waktu Buka</p>
                        <p className="font-semibold text-sm mt-0.5">{fmtTime(reg.active_session!.opened_at)}</p>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center py-4 gap-2 text-muted-foreground">
                      <Lock className="h-10 w-10 opacity-30" />
                      <p className="text-sm">Belum ada sesi aktif</p>
                      <p className="text-xs opacity-60">Buka sesi untuk mulai transaksi</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className={`px-5 pb-5 flex gap-2 ${has ? "justify-between" : "justify-center"}`}>
                  {!has && (
                    <Button onClick={() => handleOpenClick(reg)}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2" disabled={isPending}>
                      <Unlock className="h-4 w-4" /> Buka Sesi Kasir
                    </Button>
                  )}
                  {has && (
                    <>
                      <Button variant="outline"
                        className="flex-1 gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => router.push("/toko/kasir")}>
                        <ShoppingCart className="h-4 w-4" /> Mulai Transaksi <ChevronRight className="h-3 w-3" />
                      </Button>
                      <Button onClick={() => handleCloseClick(reg)}
                        className="bg-rose-600 hover:bg-rose-700 text-white gap-2" disabled={isPending}>
                        <Lock className="h-4 w-4" /> Tutup
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
          {registers.length === 0 && (
            <div className="col-span-3 text-center py-16 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Tidak ada kasir aktif.</p>
            </div>
          )}
        </div>
      )}

      {/* ── History Panel ─────────────────────────────────────────────────────── */}
      {showHistory && (
        <div className="rounded-2xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  {["Tanggal", "Kasir", "Buka", "Tutup", "Saldo Awal", "Saldo Akhir", "Selisih", "Status", "Operator"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.map((s) => {
                  const diffVal = s.difference ?? 0
                  const isOpen = s.status === "open"
                  return (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{fmtShort(s.session_date)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.register_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          {new Date(s.opened_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {s.closed_at
                          ? new Date(s.closed_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
                          : <span className="text-emerald-600 font-medium">Aktif</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-right">{rp(s.opening_balance)}</td>
                      <td className="px-4 py-3 font-mono text-right">
                        {s.closing_balance != null ? rp(s.closing_balance) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-right">
                        {s.difference != null ? (
                          <span className={`font-semibold ${
                            Math.abs(diffVal) < 1 ? "text-emerald-600"
                            : diffVal < 0 ? "text-red-600" : "text-amber-600"
                          }`}>
                            {diffVal >= 0 ? "+" : ""}{rp(diffVal)}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={
                          isOpen ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                          : s.status === "reconciled" ? "bg-blue-100 text-blue-700 border-blue-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                        }>
                          {isOpen ? "Aktif" : s.status === "reconciled" ? "Rekonsiliasi" : "Tutup"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{s.opened_by_name}</td>
                    </tr>
                  )
                })}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                      <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      Belum ada riwayat sesi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Dialog Buka Sesi ─────────────────────────────────────────────────── */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlock className="h-5 w-5 text-indigo-500" /> Buka Sesi Kasir
            </DialogTitle>
            <DialogDescription>{selectedReg?.register_name} · {selectedReg?.location}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 p-3">
              <p className="text-xs text-indigo-700 dark:text-indigo-300"><strong>Tanggal:</strong> {fmtDate(new Date().toISOString())}</p>
              <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-0.5"><strong>Operator:</strong> {currentUser}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Saldo Awal Kas <span className="text-red-500">*</span></Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm text-muted-foreground font-medium">Rp</span>
                <Input className="pl-9 text-lg font-bold" placeholder="0"
                  value={openBal} onChange={e => setOpenBal(e.target.value.replace(/\D/g, ""))}
                  onFocus={e => e.target.select()} />
              </div>
              <p className="text-[11px] text-muted-foreground">Jumlah uang tunai di laci kasir saat sesi dimulai</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Catatan (opsional)</Label>
              <Input placeholder="Misal: Shift pagi..." value={openNote} onChange={e => setOpenNote(e.target.value)} />
            </div>
            {openErr && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2 border border-red-200">
                <AlertTriangle className="h-4 w-4 shrink-0" />{openErr}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)} disabled={isPending}>Batal</Button>
            <Button onClick={handleOpenSubmit} disabled={isPending} className="bg-indigo-600 hover:bg-indigo-700">
              {isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Unlock className="h-4 w-4 mr-2" />}
              Buka Sesi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Tutup Sesi ─────────────────────────────────────────────────── */}
      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-rose-500" /> Tutup Sesi Kasir
            </DialogTitle>
            <DialogDescription>{selectedReg?.register_name} — Rekap transaksi hari ini</DialogDescription>
          </DialogHeader>

          {summaryLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <RefreshCw className="h-8 w-8 animate-spin" />
              <p className="text-sm">Menghitung ringkasan transaksi...</p>
            </div>
          ) : summary ? (
            <div className="space-y-5 py-2">
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Total Transaksi", val: `${summary.total_transactions} order`, icon: ShoppingCart, color: "text-blue-600" },
                  { label: "Total Penjualan",  val: rp(summary.total_sales),   icon: ArrowUpRight,   color: "text-emerald-600" },
                  { label: "Total Retur",      val: rp(summary.total_refunds), icon: ArrowDownRight, color: "text-rose-600" },
                  { label: "Penjualan Bersih", val: rp(summary.net_sales),     icon: Wallet,         color: "text-indigo-600" },
                ].map(({ label, val, icon: Icon, color }) => (
                  <div key={label} className="rounded-xl border bg-card p-3 shadow-sm">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className={`h-3.5 w-3.5 ${color}`} />
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
                    </div>
                    <p className={`font-bold text-sm ${color}`}>{val}</p>
                  </div>
                ))}
              </div>

              {/* Breakdown */}
              <div className="rounded-xl border bg-slate-50 dark:bg-slate-900/50 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Breakdown Metode Bayar</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Tunai",    val: summary.breakdown.cash,     icon: Banknote,    color: "text-emerald-600" },
                    { label: "QRIS",     val: summary.breakdown.qris,     icon: Smartphone,  color: "text-violet-600"  },
                    { label: "Transfer", val: summary.breakdown.transfer,  icon: CreditCard,  color: "text-blue-600"   },
                    { label: "Paylater", val: summary.breakdown.paylater,  icon: Wallet,      color: "text-amber-600"  },
                  ].map(({ label, val, icon: Icon, color }) => (
                    <div key={label} className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 shrink-0 ${color}`} />
                      <div>
                        <p className="text-[10px] text-muted-foreground">{label}</p>
                        <p className={`font-bold text-sm ${color}`}>{rp(val)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rekonsiliasi */}
              <div className="rounded-xl border p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Rekonsiliasi Kas</p>
                {[
                  { label: "Saldo Awal", val: rp(summary.opening_balance), sign: "" },
                  { label: "+ Tunai & QRIS", val: rp(summary.breakdown.cash + summary.breakdown.qris), sign: "text-emerald-600" },
                ].map(({ label, val, sign }) => (
                  <div key={label} className="flex justify-between py-1.5 border-b">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className={`font-semibold ${sign}`}>{val}</span>
                  </div>
                ))}
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-sm font-semibold">Saldo Kas Diharapkan</span>
                  <span className="font-bold text-indigo-600">{rp(summary.expected_balance)}</span>
                </div>

                {/* Input saldo aktual */}
                <div className="space-y-1.5 pt-1">
                  <Label className="text-sm font-semibold">
                    Saldo Akhir Aktual (Hitung Fisik) <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-sm text-muted-foreground font-medium">Rp</span>
                    <Input className="pl-9 text-lg font-bold" placeholder="0"
                      value={closeBal} onChange={e => setCloseBal(e.target.value.replace(/\D/g, ""))}
                      onFocus={e => e.target.select()} />
                  </div>
                </div>

                {/* Selisih */}
                {closeBal !== "" && (
                  <div className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                    Math.abs(diff) < 1 ? "bg-emerald-50 border border-emerald-200"
                    : diff < 0 ? "bg-red-50 border border-red-200"
                    : "bg-amber-50 border border-amber-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      {Math.abs(diff) < 1
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        : <AlertTriangle className="h-4 w-4 text-rose-600" />}
                      <span className="text-sm font-semibold">Selisih</span>
                    </div>
                    <span className={`font-bold text-sm ${
                      Math.abs(diff) < 1 ? "text-emerald-600" : diff < 0 ? "text-red-600" : "text-amber-600"
                    }`}>
                      {diff >= 0 ? "+" : ""}{rp(diff)}
                    </span>
                  </div>
                )}
              </div>

              {closeErr && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2 border border-red-200">
                  <AlertTriangle className="h-4 w-4 shrink-0" />{closeErr}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground text-sm">Gagal memuat ringkasan sesi.</div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialog(false)} disabled={isPending}>Batal</Button>
            <Button onClick={handleCloseSubmit}
              disabled={isPending || summaryLoading || !closeBal}
              className="bg-rose-600 hover:bg-rose-700 text-white">
              {isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
              Tutup Sesi & Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
