"use client"

/**
 * ApprovalClient — Loan Approval Mobile Card List
 *
 * Replaces the desktop <Table> with a card list for loan applications.
 * Reject dialog is converted to a Drawer bottom sheet.
 * All state, filter logic, and Server Action calls are preserved.
 *
 * @param applications - Loan application list from server
 */

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerBody,
  DrawerFooter,
} from "@/components/ui/drawer"
import { CheckCircle, XCircle, Search, User, CreditCard, Clock, AlertCircle } from "lucide-react"
import { updateLoanStatus } from "@/lib/actions/loans"
import { toast } from "sonner"

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft:    { label: "Draft",      className: "bg-slate-100 text-slate-600 border-slate-200" },
  pending:  { label: "Menunggu",   className: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "Disetujui", className: "bg-green-50 text-green-700 border-green-200" },
  rejected: { label: "Ditolak",   className: "bg-red-50 text-red-700 border-red-200" },
}

const formatRp = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)

export function ApprovalClient({ applications }: { applications: any[] }) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("pending")
  const [loading, setLoading] = useState<number | null>(null)
  const [selectedApp, setSelectedApp] = useState<any | null>(null)
  const [rejectNote, setRejectNote] = useState("")
  const [rejectDrawer, setRejectDrawer] = useState(false)

  const FILTERS = [
    { value: "all",      label: "Semua" },
    { value: "pending",  label: "Menunggu" },
    { value: "approved", label: "Disetujui" },
    { value: "rejected", label: "Ditolak" },
  ]

  const filtered = applications.filter(a => {
    const matchSearch =
      a.member_name.toLowerCase().includes(search.toLowerCase()) ||
      a.member_nik.includes(search) ||
      a.application_no.includes(search)
    const matchFilter = filter === "all" ? true : a.status === filter
    return matchSearch && matchFilter
  })

  /**
   * Approves a loan application after confirmation.
   * @param appId - Application ID to approve
   */
  const handleApprove = async (appId: number) => {
    if (!confirm("Setujui pengajuan pinjaman ini?")) return
    setLoading(appId)
    const res = await updateLoanStatus(appId, "approve")
    if (res.success) toast.success("Pengajuan disetujui!")
    else toast.error(res.error)
    setLoading(null)
  }

  /**
   * Opens the reject drawer for the selected application.
   * @param app - Application object to reject
   */
  const openReject = (app: any) => {
    setSelectedApp(app)
    setRejectNote("")
    setRejectDrawer(true)
  }

  /**
   * Submits rejection with an optional note via Server Action.
   */
  const handleReject = async () => {
    if (!selectedApp) return
    setLoading(selectedApp.id)
    const res = await updateLoanStatus(selectedApp.id, "reject", rejectNote)
    if (res.success) {
      toast.success("Pengajuan ditolak.")
      setRejectDrawer(false)
    } else {
      toast.error(res.error)
    }
    setLoading(null)
  }

  return (
    <>
      {/* ── Search & Filter Bar ── */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9 h-12 text-base"
            placeholder="Cari nama, NIK, atau no. pengajuan..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {FILTERS.map(f => (
            <Button
              key={f.value}
              variant={filter === f.value ? "default" : "outline"}
              className="h-10 shrink-0 rounded-full px-4"
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* ── Empty State ── */}
      {filtered.length === 0 && (
        <div className="py-12 text-center text-slate-400 text-sm">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-slate-200" />
          Tidak ada data pengajuan.
        </div>
      )}

      {/* ── Card List ── */}
      <div className="space-y-3 mt-3">
        {filtered.map(app => {
          const status = STATUS_CONFIG[app.status] || STATUS_CONFIG.draft

          return (
            <div
              key={app.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3 p-4 pb-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-slate-400 mb-0.5">{app.application_no}</p>
                  <p className="font-semibold text-base text-slate-900 dark:text-slate-50">{app.member_name}</p>
                  <p className="text-sm text-slate-400 flex items-center gap-1">
                    <User className="h-3 w-3" /> NIK: {app.member_nik}
                  </p>
                </div>
                <Badge className={`${status.className} shrink-0 text-xs border`}>
                  {status.label}
                </Badge>
              </div>

              {/* Card Body — Loan Details */}
              <div className="px-4 pb-3 grid grid-cols-2 gap-2 border-t border-slate-50 dark:border-slate-800 pt-3">
                <div>
                  <p className="text-xs text-slate-400">Produk Pinjaman</p>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{app.product_name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Jumlah Pinjaman</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-50">{formatRp(app.amount_requested)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Tenor</p>
                  <p className="text-sm font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3 text-slate-400" />{app.tenor_months} bulan
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Tujuan Pinjaman</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-1">{app.purpose || "-"}</p>
                </div>
              </div>

              {/* Card Actions */}
              {app.status === "pending" ? (
                <div className="flex gap-2 px-4 py-3 border-t border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                  <Button
                    className="flex-1 h-12 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white gap-2"
                    onClick={() => handleApprove(app.id)}
                    disabled={loading === app.id}
                  >
                    <CheckCircle className="h-4 w-4" />
                    {loading === app.id ? "Memproses..." : "Setujui"}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 h-12 text-red-600 border-red-200 active:bg-red-50 gap-2"
                    onClick={() => openReject(app)}
                    disabled={loading === app.id}
                  >
                    <XCircle className="h-4 w-4" />
                    Tolak
                  </Button>
                </div>
              ) : (
                <div className="px-4 py-3 border-t border-slate-50 dark:border-slate-800">
                  <p className="text-sm text-slate-400 italic text-center">
                    {app.status === "approved" ? "✓ Sudah disetujui" : "✕ Telah ditolak"}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Reject Drawer (Bottom Sheet) ── */}
      <Drawer open={rejectDrawer} onOpenChange={setRejectDrawer}>
        <DrawerContent showClose>
          <DrawerHeader>
            <DrawerTitle>Tolak Pengajuan Pinjaman</DrawerTitle>
            <DrawerDescription>
              Pengajuan dari <strong>{selectedApp?.member_name}</strong> sejumlah{" "}
              <strong>{selectedApp ? formatRp(selectedApp.amount_requested) : ""}</strong> akan ditolak.
            </DrawerDescription>
          </DrawerHeader>

          <DrawerBody>
            <div className="space-y-2">
              <Label className="font-semibold">Alasan Penolakan (opsional)</Label>
              <Input
                className="h-12 text-base"
                placeholder="Masukkan alasan penolakan..."
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
              />
            </div>
          </DrawerBody>

          <DrawerFooter>
            <Button
              variant="destructive"
              className="w-full h-12 text-base font-semibold"
              onClick={handleReject}
              disabled={loading === selectedApp?.id}
            >
              {loading === selectedApp?.id ? "Memproses..." : "Tolak Pengajuan"}
            </Button>
            <Button
              variant="ghost"
              className="w-full h-12"
              onClick={() => setRejectDrawer(false)}
            >
              Batal
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  )
}
