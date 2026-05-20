"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckCircle, Truck, XCircle, Eye, Package, MapPin, MessageSquare } from "lucide-react"
import { updateOnlineOrderStatus } from "@/lib/actions/online-orders"
import { toast } from "sonner"

const formatRp = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pending:    { label: "Menunggu",   cls: "bg-amber-100 text-amber-700 border-amber-200" },
  confirmed:  { label: "Dikonfirmasi", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  processing: { label: "Diproses",   cls: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  delivered:  { label: "Selesai",    cls: "bg-green-100 text-green-700 border-green-200" },
  cancelled:  { label: "Dibatalkan", cls: "bg-red-100 text-red-700 border-red-200" },
}

const PM_LABEL: Record<string, string> = {
  cash: "Tunai", paylater: "Paylater", qris: "QRIS", transfer: "Transfer"
}

export function OnlinePesananClient({ orders }: { orders: any[] }) {
  const [filter, setFilter] = useState("pending")
  const [loading, setLoading] = useState<number | null>(null)
  const [detailOrder, setDetailOrder] = useState<any | null>(null)

  const filtered = filter === "all" ? orders : orders.filter(o => o.order_status === filter)
  const pendingCount = orders.filter(o => o.order_status === "pending").length

  const handleStatus = async (orderId: number, status: "confirmed" | "processing" | "delivered" | "cancelled") => {
    setLoading(orderId)
    const res = await updateOnlineOrderStatus(orderId, status)
    if (res.success) toast.success("Status pesanan diperbarui")
    else toast.error(res.error)
    setLoading(null)
  }

  const FILTERS = [
    { value: "pending", label: `Menunggu${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
    { value: "confirmed", label: "Dikonfirmasi" },
    { value: "processing", label: "Diproses" },
    { value: "delivered", label: "Selesai" },
    { value: "all", label: "Semua" },
  ]

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <Button key={f.value} size="sm" variant={filter === f.value ? "default" : "outline"}
            onClick={() => setFilter(f.value)}>
            {f.label}
          </Button>
        ))}
      </div>

      <div className="border rounded-xl overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Pesanan</TableHead>
              <TableHead>Anggota</TableHead>
              <TableHead>Pesan / Catatan</TableHead>
              <TableHead>Pembayaran</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead>Waktu</TableHead>
              <TableHead className="text-center">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  Tidak ada pesanan.
                </TableCell>
              </TableRow>
            )}
            {filtered.map(o => {
              const sc = STATUS_CONFIG[o.order_status] || STATUS_CONFIG.pending
              const isDelivery = o.note?.includes("[ANTAR ke:")
              return (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs font-semibold">{o.order_no}</TableCell>
                  <TableCell>
                    <div className="font-medium">{o.member_name}</div>
                    <div className="text-xs text-muted-foreground">{o.member_phone}</div>
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <div className="flex items-start gap-1.5">
                      {isDelivery
                        ? <Truck className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                        : <Package className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                      }
                      <span className="text-xs line-clamp-2">{o.note || "-"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-medium">{PM_LABEL[o.payment_method] || o.payment_method}</span>
                  </TableCell>
                  <TableCell className="text-right font-bold">{formatRp(o.grand_total)}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={sc.cls}>{sc.label}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatTime(o.ordered_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="outline" size="icon" className="h-7 w-7" title="Detail"
                        onClick={() => setDetailOrder(o)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {o.order_status === "pending" && (
                        <Button variant="outline" size="icon" className="h-7 w-7 text-blue-600 border-blue-200"
                          title="Konfirmasi" disabled={loading === o.id}
                          onClick={() => handleStatus(o.id, "confirmed")}>
                          <CheckCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {o.order_status === "confirmed" && (
                        <Button variant="outline" size="icon" className="h-7 w-7 text-indigo-600 border-indigo-200"
                          title="Tandai Diproses" disabled={loading === o.id}
                          onClick={() => handleStatus(o.id, "processing")}>
                          <Package className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {o.order_status === "processing" && (
                        <Button variant="outline" size="icon" className="h-7 w-7 text-green-600 border-green-200"
                          title="Tandai Selesai / Terkirim" disabled={loading === o.id}
                          onClick={() => handleStatus(o.id, "delivered")}>
                          <Truck className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {["pending", "confirmed"].includes(o.order_status) && (
                        <Button variant="outline" size="icon" className="h-7 w-7 text-red-600 border-red-200"
                          title="Batalkan" disabled={loading === o.id}
                          onClick={() => handleStatus(o.id, "cancelled")}>
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailOrder} onOpenChange={() => setDetailOrder(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detail Pesanan — {detailOrder?.order_no}</DialogTitle>
          </DialogHeader>
          {detailOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground">Anggota</p><p className="font-semibold">{detailOrder.member_name}</p></div>
                <div><p className="text-muted-foreground">No. HP</p><p className="font-semibold">{detailOrder.member_phone}</p></div>
                <div><p className="text-muted-foreground">Pembayaran</p><p className="font-semibold">{PM_LABEL[detailOrder.payment_method]}</p></div>
                <div><p className="text-muted-foreground">Total</p><p className="font-bold text-blue-600">{formatRp(detailOrder.grand_total)}</p></div>
              </div>
              {detailOrder.delivery_address && (
                <div className="flex gap-2 p-2 bg-blue-50 rounded-lg border border-blue-100 text-sm">
                  <MapPin className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <p>{detailOrder.delivery_address}</p>
                </div>
              )}
              {detailOrder.note && (
                <div className="flex gap-2 p-2 bg-slate-50 rounded-lg border text-sm">
                  <MessageSquare className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                  <p>{detailOrder.note}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Item Pesanan</p>
                <div className="space-y-1">
                  {detailOrder.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{item.name} ×{item.qty}</span>
                      <span className="font-medium">{formatRp(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
