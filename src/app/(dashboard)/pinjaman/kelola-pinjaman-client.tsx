"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Search, Receipt, CheckCircle, Users, ChevronDown } from "lucide-react"
import { recordLoanPayment } from "@/lib/actions/loan-payments"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"

const formatRp = (v: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(v)

const formatDueDate = (dateStr: string | null) => {
  if (!dateStr) return "-"
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  active: { label: "Aktif", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-450 border-emerald-200" },
  paid_off: { label: "Lunas", cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200" },
  overdue: { label: "Menunggak", cls: "bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-450 border-rose-200" },
  closed: { label: "Selesai", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-450 border-blue-200" },
}

/** Status yang layak dipilih untuk pembayaran massal */
const PAYABLE_STATUSES = new Set(["active", "overdue"])

/** Cek apakah cicilan terdekat dapat dibayar pada bulan berjalan */
const isPayableThisMonth = (loan: Loan) => {
  if (!PAYABLE_STATUSES.has(loan.status)) return false
  const nextUnpaid = loan.schedules.find((s) => s.status !== "paid")
  if (!nextUnpaid) return false

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() // 0-indexed

  const dueDate = new Date(nextUnpaid.due_date)
  const dueYear = dueDate.getFullYear()
  const dueMonth = dueDate.getMonth()

  // Hanya boleh jika jatuh tempo di tahun/bulan berjalan atau masa lalu (menunggak)
  return dueYear < currentYear || (dueYear === currentYear && dueMonth <= currentMonth)
}

interface LoanSchedule {
  id: number
  installment_no: number
  due_date: string
  principal_due: number
  interest_due: number
  total_due: number
  status: string
  principal_paid: number
  interest_paid: number
  penalty_paid: number
}

interface Loan {
  id: number
  loan_no: string
  member_name: string
  member_nik: string
  member_code: string
  product_name: string
  principal: number
  outstanding: number
  total_paid: number
  monthly_installment: number
  tenor_months: number
  status: string
  repayment_method: string
  disbursed_at: string | null
  schedules: LoanSchedule[]
}

type PaymentMethod = "cash" | "salary_cut" | "saving_deduct" | "transfer"

export function KelolaPinjamanClient({ initialLoans }: { initialLoans: Loan[] }) {
  const [loans, setLoans] = useState<Loan[]>(initialLoans)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  // Single payment dialog state
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Bulk select state
  const [selectedLoanIds, setSelectedLoanIds] = useState<Set<number>>(new Set())
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [bulkPaymentMethod, setBulkPaymentMethod] = useState<PaymentMethod>("transfer")
  const [bulkReference, setBulkReference] = useState("")
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null)

  // Single payment form state
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("free")
  const [amountPaid, setAmountPaid] = useState<string>("")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("transfer")
  const [reference, setReference] = useState("")
  const [penaltyAmount, setPenaltyAmount] = useState<string>("0")
  const [note, setNote] = useState("")

  const router = useRouter()

  const filteredLoans = useMemo(() =>
    loans.filter((l) => {
      const matchSearch =
        l.member_name.toLowerCase().includes(search.toLowerCase()) ||
        l.loan_no.toLowerCase().includes(search.toLowerCase()) ||
        l.member_nik.includes(search)
      const matchStatus = statusFilter === "all" ? true : l.status === statusFilter
      return matchSearch && matchStatus
    }),
    [loans, search, statusFilter]
  )

  /** Loan yang bisa dibayar dari daftar ter-filter pada bulan berjalan */
  const payableFilteredLoans = useMemo(
    () => filteredLoans.filter((l) => isPayableThisMonth(l)),
    [filteredLoans]
  )

  const isAllSelected =
    payableFilteredLoans.length > 0 &&
    payableFilteredLoans.every((l) => selectedLoanIds.has(l.id))

  const isIndeterminate =
    !isAllSelected && payableFilteredLoans.some((l) => selectedLoanIds.has(l.id))

  /** Toggle select-all pada filtered payable loans */
  const handleSelectAll = () => {
    if (isAllSelected) {
      const next = new Set(selectedLoanIds)
      payableFilteredLoans.forEach((l) => next.delete(l.id))
      setSelectedLoanIds(next)
    } else {
      const next = new Set(selectedLoanIds)
      payableFilteredLoans.forEach((l) => next.add(l.id))
      setSelectedLoanIds(next)
    }
  }

  const handleToggleLoan = (id: number) => {
    const next = new Set(selectedLoanIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedLoanIds(next)
  }

  // ─── Single Payment ───────────────────────────────────────────────────────

  const openPaymentModal = (loan: Loan) => {
    setSelectedLoan(loan)
    const nextUnpaid = loan.schedules.find((s) => s.status !== "paid")
    if (nextUnpaid) {
      setSelectedScheduleId(nextUnpaid.id.toString())
      setAmountPaid(nextUnpaid.total_due.toString())
    } else {
      setSelectedScheduleId("free")
      setAmountPaid("")
    }
    setPaymentMethod("transfer")
    setReference("")
    setPenaltyAmount("0")
    setNote("")
    setPaymentDialogOpen(true)
  }

  const handleScheduleChange = (val: string | null) => {
    if (!val) return
    setSelectedScheduleId(val)
    if (val === "free") {
      setAmountPaid("")
    } else {
      const sch = selectedLoan?.schedules.find((s) => s.id.toString() === val)
      if (sch) setAmountPaid(sch.total_due.toString())
    }
  }

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLoan) return
    const amt = parseFloat(amountPaid)
    if (isNaN(amt) || amt <= 0) return toast.error("Nominal pembayaran tidak valid.")

    // Proteksi: Tampilkan konfirmasi jika membayar cicilan bulan depan (future schedule)
    if (selectedScheduleId !== "free") {
      const schObj = selectedLoan.schedules.find((s) => s.id.toString() === selectedScheduleId)
      if (schObj) {
        const now = new Date()
        const currentYear = now.getFullYear()
        const currentMonth = now.getMonth() // 0-indexed
        
        const dueDate = new Date(schObj.due_date)
        const dueYear = dueDate.getFullYear()
        const dueMonth = dueDate.getMonth()
        
        if (dueYear > currentYear || (dueYear === currentYear && dueMonth > currentMonth)) {
          const confirmMsg = `PERINGATAN: Cicilan Bulan ke-${schObj.installment_no} (Jatuh Tempo: ${dueDate.toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })}) jatuh pada bulan depan. Apakah Anda yakin ingin memproses pembayaran di muka?`
          if (!window.confirm(confirmMsg)) {
            return
          }
        }
      }
    }

    setSubmitting(true)
    try {
      const res = await recordLoanPayment({
        loanId: selectedLoan.id,
        scheduleId: selectedScheduleId === "free" ? undefined : parseInt(selectedScheduleId),
        amountPaid: amt,
        paymentMethod,
        reference,
        penaltyAmount: parseFloat(penaltyAmount) || 0,
        note,
      })

      if (res.success) {
        toast.success(`Pembayaran cicilan untuk ${selectedLoan.member_name} berhasil dicatat.`)
        setPaymentDialogOpen(false)
        router.refresh()
        setLoans((prev) =>
          prev.map((l) => {
            if (l.id !== selectedLoan.id) return l
            const newOutstanding = Math.max(0, l.outstanding - amt)
            return { ...l, outstanding: newOutstanding, total_paid: l.total_paid + amt, status: newOutstanding <= 0 ? "paid_off" : l.status }
          })
        )
      } else {
        toast.error(res.error || "Gagal mencatat pembayaran.")
      }
    } catch (error: any) {
      console.error(error)
      toast.error("Terjadi kesalahan sistem.")
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Bulk Payment ─────────────────────────────────────────────────────────

  /** Daftar loan yang saat ini dipilih untuk bulk pay */
  const selectedLoansData = useMemo(
    () => loans.filter((l) => selectedLoanIds.has(l.id) && PAYABLE_STATUSES.has(l.status)),
    [loans, selectedLoanIds]
  )

  const totalBulkAmount = useMemo(
    () => selectedLoansData.reduce((sum, l) => sum + l.monthly_installment, 0),
    [selectedLoansData]
  )

  const openBulkDialog = () => {
    setBulkPaymentMethod("transfer")
    setBulkReference("")
    setBulkProgress(null)
    setBulkDialogOpen(true)
  }

  const handleBulkPayment = async () => {
    if (selectedLoansData.length === 0) return

    setBulkSubmitting(true)
    setBulkProgress({ done: 0, total: selectedLoansData.length })

    let successCount = 0
    let failCount = 0

    for (let i = 0; i < selectedLoansData.length; i++) {
      const loan = selectedLoansData[i]
      const nextUnpaid = loan.schedules.find((s) => s.status !== "paid")
      const amount = nextUnpaid ? nextUnpaid.total_due : loan.monthly_installment
      const scheduleId = nextUnpaid ? nextUnpaid.id : undefined

      try {
        const res = await recordLoanPayment({
          loanId: loan.id,
          scheduleId,
          amountPaid: amount,
          paymentMethod: bulkPaymentMethod,
          reference: bulkReference,
          penaltyAmount: 0,
          note: `Pembayaran massal — ${bulkReference || "tanpa referensi"}`,
        })

        if (res.success) {
          successCount++
          setLoans((prev) =>
            prev.map((l) => {
              if (l.id !== loan.id) return l
              const newOutstanding = Math.max(0, l.outstanding - amount)
              return { ...l, outstanding: newOutstanding, total_paid: l.total_paid + amount, status: newOutstanding <= 0 ? "paid_off" : l.status }
            })
          )
        } else {
          failCount++
          console.error(`Bulk payment failed for loan ${loan.loan_no}:`, res.error)
        }
      } catch (err) {
        failCount++
        console.error(`Bulk payment error for loan ${loan.loan_no}:`, err)
      }

      setBulkProgress({ done: i + 1, total: selectedLoansData.length })
    }

    setBulkSubmitting(false)
    setBulkDialogOpen(false)
    setSelectedLoanIds(new Set())

    if (successCount > 0) {
      toast.success(`${successCount} pembayaran berhasil dicatat.${failCount > 0 ? ` ${failCount} gagal.` : ""}`)
      router.refresh()
    } else {
      toast.error("Semua pembayaran gagal. Cek koneksi dan coba lagi.")
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Cari anggota, NIK, atau no. pinjaman..."
            className="pl-9 h-11"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar w-full md:w-auto pb-1">
          {["all", "active", "overdue", "paid_off"].map((st) => (
            <Button
              key={st}
              variant={statusFilter === st ? "default" : "outline"}
              className="h-10 rounded-full px-4 text-sm font-semibold shrink-0"
              onClick={() => setStatusFilter(st)}
            >
              {st === "all" ? "Semua Status" : STATUS_MAP[st]?.label || st}
            </Button>
          ))}
        </div>
      </div>

      {/* Bulk Action Toolbar — tampil saat ada loan terpilih */}
      {selectedLoanIds.size > 0 && (
        <div className="flex items-center justify-between gap-4 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl animate-in slide-in-from-top-2 duration-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-emerald-600 text-white shadow-sm">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="font-bold text-emerald-900 dark:text-emerald-200 text-sm">
                {selectedLoanIds.size} pinjaman dipilih
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Total angsuran: <span className="font-bold">{formatRp(totalBulkAmount)}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-100"
              onClick={() => setSelectedLoanIds(new Set())}
            >
              Batalkan Pilihan
            </Button>
            <Button
              size="sm"
              className="h-9 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white border-0 flex items-center gap-1.5"
              onClick={openBulkDialog}
            >
              <Receipt className="h-3.5 w-3.5" />
              Bayar Semua Terpilih
            </Button>
          </div>
        </div>
      )}

      {/* Main Loan Table */}
      <Card className="border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                <TableRow>
                  <TableHead className="w-12 pl-4">
                    {payableFilteredLoans.length > 0 && (
                      <Checkbox
                        checked={isAllSelected}
                        ref={(el) => {
                          if (el) (el as any).indeterminate = isIndeterminate
                        }}
                        onCheckedChange={handleSelectAll}
                        aria-label="Pilih semua pinjaman aktif"
                        className="border-slate-300"
                      />
                    )}
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider py-4">No. Pinjaman</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider py-4">Anggota (NIK)</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider py-4">Produk</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 text-right">Plafon</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 text-right">Sisa Pokok</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 text-right">Angsuran/Bln</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 text-center">Jatuh Tempo</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 text-center">Status</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 text-center pr-6">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLoans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-10 text-slate-400 dark:text-slate-500">
                      Tidak ada data pinjaman anggota.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLoans.map((l) => {
                    const isPayable = PAYABLE_STATUSES.has(l.status)
                    const canPayBulk = isPayableThisMonth(l)
                    const isChecked = selectedLoanIds.has(l.id)
                    return (
                      <TableRow
                        key={l.id}
                        className={`hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors ${isChecked ? "bg-emerald-50/40 dark:bg-emerald-950/10" : ""}`}
                      >
                        <TableCell className="w-12 pl-4">
                          {canPayBulk ? (
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => handleToggleLoan(l.id)}
                              aria-label={`Pilih pinjaman ${l.loan_no}`}
                              className="border-slate-300"
                            />
                          ) : (
                            <span className="w-4 h-4 block" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm py-4 text-blue-600 dark:text-blue-400 font-semibold">{l.loan_no}</TableCell>
                        <TableCell className="py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 dark:text-slate-50">{l.member_name}</span>
                            <span className="text-xs text-slate-400 font-mono">NIK: {l.member_nik}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 font-semibold text-slate-700 dark:text-slate-350">{l.product_name}</TableCell>
                        <TableCell className="py-4 text-right font-medium">{formatRp(l.principal)}</TableCell>
                        <TableCell className="py-4 text-right font-bold text-rose-600 dark:text-rose-400">{formatRp(l.outstanding)}</TableCell>
                        <TableCell className="py-4 text-right font-medium text-slate-700 dark:text-slate-350">{formatRp(l.monthly_installment)}</TableCell>
                        <TableCell className="py-4 text-center">
                          {(() => {
                            const nextUnpaid = l.schedules.find((s) => s.status !== "paid")
                            const nextDueDate = nextUnpaid ? nextUnpaid.due_date : null
                            return nextDueDate ? (
                              <span
                                className={cn(
                                  "text-xs font-semibold px-2.5 py-1 rounded-md border inline-block whitespace-nowrap",
                                  l.status === "overdue"
                                    ? "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-450"
                                    : "bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800/40 dark:border-slate-800 dark:text-slate-300"
                                )}
                              >
                                {formatDueDate(nextDueDate)}
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-600 font-mono">-</span>
                            )
                          })()}
                        </TableCell>
                        <TableCell className="py-4 text-center">
                          <Badge className={`${STATUS_MAP[l.status]?.cls} border px-2.5 py-0.5 rounded-full text-xs font-semibold`}>
                            {STATUS_MAP[l.status]?.label || l.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 text-center pr-6">
                          <div className="flex items-center justify-center gap-2">
                            <Link
                              href={`/pinjaman/transaksi/${l.id}`}
                              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-transparent h-9 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-350 dark:hover:bg-slate-900/30"
                            >
                              Jadwal
                            </Link>
                            {isPayable && (
                              <Button
                                size="sm"
                                className="h-9 px-3 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white border-0 flex items-center gap-1.5"
                                onClick={() => openPaymentModal(l)}
                              >
                                <Receipt className="h-3.5 w-3.5" />
                                Bayar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Single Payment Dialog ──────────────────────────────────────── */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Receipt className="h-5 w-5 text-emerald-600" />
              Catat Pembayaran Angsuran
            </DialogTitle>
            <DialogDescription>
              Input penerimaan cicilan dari anggota <strong>{selectedLoan?.member_name}</strong> secara langsung ke sistem.
            </DialogDescription>
          </DialogHeader>

          {selectedLoan && (
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                <div>
                  <p className="text-slate-400">Total Sisa Pokok</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{formatRp(selectedLoan.outstanding)}</p>
                </div>
                <div>
                  <p className="text-slate-400">Jumlah Angsuran / Bln</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{formatRp(selectedLoan.monthly_installment)}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Pilih Cicilan Bulanan</Label>
                <Select value={selectedScheduleId} onValueChange={handleScheduleChange}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Pilih jadwal angsuran" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Bebas / Tanpa Jadwal Spesifik</SelectItem>
                    {selectedLoan.schedules
                      .filter((s) => s.status !== "paid")
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          Bulan ke-{s.installment_no} (Jatuh Tempo: {new Date(s.due_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}) — {formatRp(s.total_due)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Nominal yang Dibayar (Rp)</Label>
                <Input
                  type="number"
                  required
                  placeholder="Contoh: 500000"
                  className="h-11 text-base font-semibold"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Denda Keterlambatan (Opsional, Rp)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  className="h-11 text-base"
                  value={penaltyAmount}
                  onChange={(e) => setPenaltyAmount(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Metode Pembayaran</Label>
                <Select value={paymentMethod} onValueChange={(val: any) => setPaymentMethod(val)}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer">Bank Transfer (Giro/Virtual Account)</SelectItem>
                    <SelectItem value="cash">Tunai / Cash Laci Toko</SelectItem>
                    <SelectItem value="salary_cut">Potong Gaji / Payroll</SelectItem>
                    <SelectItem value="saving_deduct">Debet Simpanan Sukarela</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Bukti Referensi / No. Transfer (Opsional)</Label>
                <Input
                  placeholder="Contoh: TRX-BANK-998822"
                  className="h-11"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Catatan Tambahan (Opsional)</Label>
                <Input
                  placeholder="Tulis catatan jika ada..."
                  className="h-11"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <DialogFooter className="pt-2 gap-2 md:gap-0">
                <Button type="button" variant="ghost" className="h-11" onClick={() => setPaymentDialogOpen(false)}>
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-11 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold flex items-center gap-1.5 px-6"
                >
                  <CheckCircle className="h-4 w-4" />
                  {submitting ? "Memproses..." : "Simpan Pembayaran"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Bulk Payment Dialog ───────────────────────────────────────── */}
      <Dialog open={bulkDialogOpen} onOpenChange={(open) => { if (!bulkSubmitting) setBulkDialogOpen(open) }}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" />
              Bayar Semua Pinjaman Terpilih
            </DialogTitle>
            <DialogDescription>
              Proses angsuran bulan berjalan untuk <strong>{selectedLoansData.length} pinjaman</strong> sekaligus.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Summary Card */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ringkasan Pembayaran Massal</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {selectedLoansData.map((l) => {
                  const nextUnpaid = l.schedules.find((s) => s.status !== "paid")
                  const amount = nextUnpaid ? nextUnpaid.total_due : l.monthly_installment
                  return (
                    <div key={l.id} className="flex justify-between items-center text-sm">
                      <div>
                        <span className="font-mono font-semibold text-blue-600 text-xs">{l.loan_no}</span>
                        <span className="text-slate-500 text-xs ml-2">{l.member_name}</span>
                      </div>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{formatRp(amount)}</span>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-sm font-semibold text-slate-600">Total Keseluruhan</span>
                <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-400">{formatRp(totalBulkAmount)}</span>
              </div>
            </div>

            {/* Bulk Payment Method */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Metode Pembayaran (untuk semua)</Label>
              <Select value={bulkPaymentMethod} onValueChange={(val: any) => setBulkPaymentMethod(val)}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transfer">Bank Transfer (Giro/Virtual Account)</SelectItem>
                  <SelectItem value="cash">Tunai / Cash Laci Toko</SelectItem>
                  <SelectItem value="salary_cut">Potong Gaji / Payroll</SelectItem>
                  <SelectItem value="saving_deduct">Debet Simpanan Sukarela</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bulk Reference */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">No. Referensi / Batch (Opsional)</Label>
              <Input
                placeholder="Contoh: PAYROLL-MEI-2026"
                className="h-11"
                value={bulkReference}
                onChange={(e) => setBulkReference(e.target.value)}
              />
            </div>

            {/* Progress bar saat proses */}
            {bulkProgress && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Memproses pembayaran...</span>
                  <span>{bulkProgress.done} / {bulkProgress.total}</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 gap-2 md:gap-0">
            <Button
              type="button"
              variant="ghost"
              className="h-11"
              onClick={() => setBulkDialogOpen(false)}
              disabled={bulkSubmitting}
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={bulkSubmitting}
              className="h-11 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold flex items-center gap-1.5 px-6"
              onClick={handleBulkPayment}
            >
              <CheckCircle className="h-4 w-4" />
              {bulkSubmitting
                ? `Memproses ${bulkProgress?.done ?? 0}/${bulkProgress?.total ?? selectedLoansData.length}...`
                : `Proses ${selectedLoansData.length} Pembayaran`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
