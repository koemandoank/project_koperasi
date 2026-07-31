"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CalendarClock, Check, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { approvePayrollBatch, rejectPayrollBatch } from "@/lib/actions/payroll"

type PayrollBatch = {
  id: string
  period_code: string
  eligible_members: number
  sw_total_estimate: number
  loan_schedule_count: number
  loan_total_estimate: number
  generated_by: string
}

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n)
}

export function PayrollDraftBanner({ drafts }: { drafts: PayrollBatch[] }) {
  const router = useRouter()
  const [processingId, setProcessingId] = useState<string | null>(null)

  if (!drafts || drafts.length === 0) return null

  async function handleApprove(id: string) {
    setProcessingId(id)
    try {
      const res = await approvePayrollBatch(Number(id))
      if (res.success && "savingsCount" in res) {
        toast.success(`Draft disetujui & diproses! SW: ${res.savingsCount} orang, Angsuran: ${res.loansCount} cicilan.`)
        router.refresh()
      } else {
        toast.error((res as any).error || "Gagal memproses draft.")
      }
    } catch (e) {
      toast.error("Terjadi kesalahan sistem.")
    } finally {
      setProcessingId(null)
    }
  }

  async function handleReject(id: string) {
    const reason = window.prompt("Alasan menolak draft ini? (opsional)") || "Ditolak oleh pengurus"
    setProcessingId(id)
    try {
      const res = await rejectPayrollBatch(Number(id), reason)
      if (res.success) {
        toast.success("Draft ditolak.")
        router.refresh()
      } else {
        toast.error(res.error || "Gagal menolak draft.")
      }
    } catch (e) {
      toast.error("Terjadi kesalahan sistem.")
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="space-y-3">
      {drafts.map((d) => {
        const id = String(d.id)
        const isProcessing = processingId === id
        return (
          <Card key={id} className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="flex items-start gap-3">
                <CalendarClock className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">Draft Potongan Gaji Otomatis — Periode {d.period_code}</p>
                    <Badge variant="outline" className="text-[10px]">{d.generated_by === "cron" ? "Dibuat Otomatis" : "Manual"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Simpanan Wajib: {d.eligible_members} anggota ({fmt(Number(d.sw_total_estimate))})
                    {" · "}
                    Angsuran Pinjaman: {d.loan_schedule_count} cicilan ({fmt(Number(d.loan_total_estimate))})
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sistem hanya menyiapkan perkiraan ini — belum ada satu pun transaksi yang diposting.
                    Tinjau dulu, lalu Setujui untuk memproses, atau Tolak kalau data payroll perusahaan belum final.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => handleReject(id)} disabled={isProcessing}>
                  <X className="h-4 w-4 mr-1" /> Tolak
                </Button>
                <Button size="sm" onClick={() => handleApprove(id)} disabled={isProcessing}>
                  {isProcessing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                  Setujui & Proses
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
