"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog"
import { CheckCircle, XCircle, Eye, Search } from "lucide-react"
import { updateLoanStatus } from "@/lib/actions/loans"
import { toast } from "sonner"

const STATUS_BADGE: Record<string, { label: string; variant: any; className: string }> = {
  draft:     { label: "Draft",     variant: "outline",     className: "text-slate-500" },
  pending: { label: "Menunggu",  variant: "secondary",   className: "text-amber-600 border-amber-200 bg-amber-50" },
  approved:  { label: "Disetujui", variant: "default",     className: "text-green-700 border-green-200 bg-green-50" },
  rejected:  { label: "Ditolak",   variant: "destructive", className: "" },
}

const formatRp = (v: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)

export function ApprovalClient({ applications }: { applications: any[] }) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("pending")
  const [loading, setLoading] = useState<number | null>(null)
  const [selectedApp, setSelectedApp] = useState<any | null>(null)
  const [rejectNote, setRejectNote] = useState("")
  const [rejectDialog, setRejectDialog] = useState(false)

  const filtered = applications.filter(a => {
    const matchSearch = a.member_name.toLowerCase().includes(search.toLowerCase()) ||
      a.member_nik.includes(search) || a.application_no.includes(search)
    const matchFilter = filter === "all" ? true : a.status === filter
    return matchSearch && matchFilter
  })

  const handleApprove = async (appId: number) => {
    if (!confirm("Setujui pengajuan pinjaman ini?")) return
    setLoading(appId)
    const res = await updateLoanStatus(appId, "approve")
    if (res.success) toast.success("Pengajuan disetujui!")
    else toast.error(res.error)
    setLoading(null)
  }

  const openReject = (app: any) => {
    setSelectedApp(app)
    setRejectNote("")
    setRejectDialog(true)
  }

  const handleReject = async () => {
    if (!selectedApp) return
    setLoading(selectedApp.id)
    const res = await updateLoanStatus(selectedApp.id, "reject", rejectNote)
    if (res.success) {
      toast.success("Pengajuan ditolak.")
      setRejectDialog(false)
    } else {
      toast.error(res.error)
    }
    setLoading(null)
  }

  const FILTERS = [
    { value: "all", label: "Semua" },
    { value: "pending", label: "Menunggu" },
    { value: "approved", label: "Disetujui" },
    { value: "rejected", label: "Ditolak" },
  ]

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Cari nama, NIK, atau no. pengajuan..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {FILTERS.map(f => (
            <Button key={f.value} variant={filter === f.value ? "default" : "outline"} size="sm" onClick={() => setFilter(f.value)}>
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="border rounded-xl bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Pengajuan</TableHead>
              <TableHead>Anggota / NIK</TableHead>
              <TableHead>Produk Pinjaman</TableHead>
              <TableHead className="text-right">Jumlah</TableHead>
              <TableHead className="text-center">Tenor</TableHead>
              <TableHead>Tujuan</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  Tidak ada data pengajuan.
                </TableCell>
              </TableRow>
            )}
            {filtered.map(app => {
              const badge = STATUS_BADGE[app.status] || STATUS_BADGE.draft
              return (
                <TableRow key={app.id}>
                  <TableCell className="font-mono text-xs">{app.application_no}</TableCell>
                  <TableCell>
                    <div className="font-medium">{app.member_name}</div>
                    <div className="text-xs text-muted-foreground">NIK: {app.member_nik}</div>
                  </TableCell>
                  <TableCell>{app.product_name}</TableCell>
                  <TableCell className="text-right font-semibold">{formatRp(app.amount_requested)}</TableCell>
                  <TableCell className="text-center">{app.tenor_months} bln</TableCell>
                  <TableCell className="max-w-[180px] truncate text-sm">{app.purpose}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={badge.className}>{badge.label}</Badge>
                  </TableCell>
                  <TableCell>
                    {app.status === "pending" ? (
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 text-green-600 border-green-200 hover:bg-green-50"
                          title="Setujui"
                          onClick={() => handleApprove(app.id)}
                          disabled={loading === app.id}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 text-red-600 border-red-200 hover:bg-red-50"
                          title="Tolak"
                          onClick={() => openReject(app)}
                          disabled={loading === app.id}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex justify-center">
                        <span className="text-xs text-muted-foreground italic">
                          {app.status === "approved" ? "Sudah disetujui" : "Ditolak"}
                        </span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tolak Pengajuan Pinjaman</DialogTitle>
            <DialogDescription>
              Pengajuan dari <strong>{selectedApp?.member_name}</strong> sejumlah{" "}
              <strong>{selectedApp ? formatRp(selectedApp.amount_requested) : ""}</strong> akan ditolak.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Alasan Penolakan (opsional)</label>
            <Input
              placeholder="Masukkan alasan penolakan..."
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(false)}>Batal</Button>
            <Button variant="destructive" onClick={handleReject} disabled={loading === selectedApp?.id}>
              {loading === selectedApp?.id ? "Memproses..." : "Tolak Pengajuan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
