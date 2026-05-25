"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, CreditCard, Receipt, Clock, User, CheckCircle, AlertTriangle } from "lucide-react"
import { recordLoanPayment } from "@/lib/actions/loan-payments"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import Link from "next/link"

const formatRp = (v: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(v)

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  active: { label: "Aktif", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-450 border-emerald-200" },
  paid_off: { label: "Lunas", cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200" },
  overdue: { label: "Menunggak", cls: "bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-450 border-rose-200" },
  closed: { label: "Selesai", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-450 border-blue-200" },
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
  schedules: {
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
  }[]
}

export function KelolaPinjamanClient({ initialLoans }: { initialLoans: Loan[] }) {
  const [loans, setLoans] = useState<Loan[]>(initialLoans)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  const router = useRouter()

  // Form State
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("free")
  const [amountPaid, setAmountPaid] = useState<string>("")
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "salary_cut" | "saving_deduct" | "transfer">("transfer")
  const [reference, setReference] = useState("")
  const [penaltyAmount, setPenaltyAmount] = useState<string>("0")
  const [note, setNote] = useState("")

  const filteredLoans = loans.filter((l) => {
    const matchSearch =
      l.member_name.toLowerCase().includes(search.toLowerCase()) ||
      l.loan_no.toLowerCase().includes(search.toLowerCase()) ||
      l.member_nik.includes(search)
    const matchStatus = statusFilter === "all" ? true : l.status === statusFilter
    return matchSearch && matchStatus
  })

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
      if (sch) {
        setAmountPaid(sch.total_due.toString())
      }
    }
  }

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLoan) return
    const amt = parseFloat(amountPaid)
    if (isNaN(amt) || amt <= 0) {
      return toast.error("Nominal pembayaran tidak valid.")
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
        
        // Refresh page data
        router.refresh()
        
        // Update local state by reconstructing outstanding/status (simulated for immediate response)
        const updated = loans.map((l) => {
          if (l.id === selectedLoan.id) {
            const newOutstanding = Math.max(0, l.outstanding - amt)
            return {
              ...l,
              outstanding: newOutstanding,
              total_paid: l.total_paid + amt,
              status: newOutstanding <= 0 ? "closed" : l.status,
            }
          }
          return l
        })
        setLoans(updated)
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

      {/* Main Loan Table */}
      <Card className="border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                <TableRow>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 pl-6">No. Pinjaman</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider py-4">Anggota (NIK)</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider py-4">Produk</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 text-right">Plafon</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 text-right">Sisa Pokok</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 text-right">Angsuran/Bln</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 text-center">Status</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 text-center pr-6">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLoans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-slate-400 dark:text-slate-500">
                      Tidak ada data pinjaman anggota.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLoans.map((l) => (
                    <TableRow key={l.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                      <TableCell className="font-mono text-sm py-4 pl-6 text-blue-600 dark:text-blue-400 font-semibold">{l.loan_no}</TableCell>
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
                        <Badge className={`${STATUS_MAP[l.status]?.cls} border px-2.5 py-0.5 rounded-full text-xs font-semibold`}>
                          {STATUS_MAP[l.status]?.label || l.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 text-center pr-6">
                        <div className="flex items-center justify-center gap-2">
                          <Link href={`/pinjaman/transaksi/${l.id}`} className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-transparent h-9 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-350 dark:hover:bg-slate-900/30">
                            Jadwal
                          </Link>
                          {l.status !== "paid_off" && l.status !== "closed" && (
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Record Payment Dialog */}
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

              {/* Schedule Select */}
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
                          Bulan ke-{s.installment_no} (Jatuh Tempo: {new Date(s.due_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}) - {formatRp(s.total_due)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Amount Paid */}
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

              {/* Penalty Amount */}
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

              {/* Payment Method */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Metode Pembayaran</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(val: any) => setPaymentMethod(val)}
                >
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

              {/* Reference */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Bukti Referensi / No. Transfer (Opsional)</Label>
                <Input
                  placeholder="Contoh: TRX-BANK-998822"
                  className="h-11"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>

              {/* Notes */}
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
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11"
                  onClick={() => setPaymentDialogOpen(false)}
                >
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
    </div>
  )
}
