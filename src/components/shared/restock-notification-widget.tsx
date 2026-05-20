'use client'

/**
 * RestockNotificationWidget
 * Menampilkan permintaan restock dari kasir di dashboard pengurus.
 * Pengurus dapat langsung memproses dan membuat Draft PO dari widget ini.
 */

import React, { useState, useTransition } from 'react'
import { createPOFromRestock } from '@/lib/actions/stock-alerts'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BellRing, ShoppingCart, Edit2, Package, Trash2, CheckCircle2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { cn, formatCurrency } from '@/lib/utils'

type RestockItem = {
  id: number
  name: string
  sku: string
  stock: number
  min_stock: number
  purchase_price: number
  category: string
  categorySlug?: string
}

type Supplier = {
  id: number
  supplier_name: string
}

type POLineItem = {
  productId: number
  productName: string
  sku: string
  qtyOrdered: number
  unitPrice: number
}

interface Props {
  restockAlerts: RestockItem[]
  suppliers: Supplier[]
}

export function RestockNotificationWidget({ restockAlerts, suppliers }: Props) {
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [lastPO, setLastPO] = useState<{ poNo: string; poId: number } | null>(null)

  // Form state
  const [supplierId, setSupplierId] = useState<string>('')
  const [expectedDate, setExpectedDate] = useState<string>(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  )
  const [notes, setNotes] = useState<string>('')
  const [lines, setLines] = useState<POLineItem[]>([])

  const handleOpenModal = () => {
    // Pre-fill items from non-consignment restock alerts
    const standardItems = restockAlerts.filter(i => i.categorySlug !== 'konsinyasi')
    setLines(standardItems.map(item => ({
      productId:   item.id,
      productName: item.name,
      sku:         item.sku,
      qtyOrdered:  Math.max(item.min_stock * 2 - item.stock, item.min_stock),
      unitPrice:   item.purchase_price,
    })))
    setSupplierId('')
    setNotes('')
    setOpen(true)
  }

  const updateLine = (idx: number, field: 'qtyOrdered' | 'unitPrice', value: number) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l))
  }

  const removeLine = (idx: number) => {
    setLines(prev => prev.filter((_, i) => i !== idx))
  }

  const subtotal = lines.reduce((s, l) => s + l.qtyOrdered * l.unitPrice, 0)
  const tax      = subtotal * 0.1
  const total    = subtotal + tax

  const handleSubmit = () => {
    if (!supplierId) { toast.error('Pilih supplier terlebih dahulu'); return }
    if (lines.length === 0) { toast.error('Tambahkan minimal 1 item PO'); return }
    if (!expectedDate)      { toast.error('Tanggal ekspektasi wajib diisi'); return }

    startTransition(async () => {
      const res = await createPOFromRestock(
        Number(supplierId),
        lines.map(l => ({ productId: l.productId, qtyOrdered: l.qtyOrdered, unitPrice: l.unitPrice })),
        expectedDate,
        notes || undefined
      )
      if (res.success) {
        toast.success(`Draft PO berhasil dibuat: ${res.poNo}`)
        setLastPO({ poNo: res.poNo!, poId: res.poId! })
        setOpen(false)
      } else {
        toast.error(res.message || 'Gagal membuat PO')
      }
    })
  }

  if (restockAlerts.length === 0 && !lastPO) return null

  return (
    <>
      {/* SUCCESS BANNER */}
      {lastPO && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-center justify-between pt-4 pb-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-semibold text-green-700">PO berhasil dibuat: {lastPO.poNo}</p>
                <p className="text-xs text-green-600">Draft PO sudah masuk ke daftar pembelian, silakan proses lebih lanjut.</p>
              </div>
            </div>
            <Link href="/pembelian">
              <Button size="sm" variant="outline" className="gap-1 border-green-300 text-green-700">
                <ExternalLink className="h-3.5 w-3.5" /> Lihat PO
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* ALERT WIDGET */}
      {restockAlerts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-orange-700">
                <BellRing className="h-5 w-5" />
                Permintaan Restock dari Kasir
                <Badge className="bg-orange-600 text-white">{restockAlerts.length}</Badge>
              </CardTitle>
              <div className="flex gap-2">
                {restockAlerts.filter(i => i.categorySlug !== 'konsinyasi').length > 0 && (
                  <Button
                    size="sm"
                    onClick={handleOpenModal}
                    className="gap-2 bg-orange-600 hover:bg-orange-700"
                  >
                    <ShoppingCart className="h-4 w-4" /> Proses PO ({restockAlerts.filter(i => i.categorySlug !== 'konsinyasi').length})
                  </Button>
                )}
                {restockAlerts.filter(i => i.categorySlug === 'konsinyasi').length > 0 && (
                  <Link
                    href="/toko/konsinyasi"
                    className={cn(
                      buttonVariants({ size: 'sm', variant: 'outline' }),
                      "gap-2 text-orange-700 border-orange-300"
                    )}
                  >
                    <Package className="h-4 w-4" /> Konsinyasi ({restockAlerts.filter(i => i.categorySlug === 'konsinyasi').length})
                  </Link>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {restockAlerts.map(item => {
                const isConsignment = item.categorySlug === 'konsinyasi';
                return (
                  <div key={item.id} className={`flex items-center gap-3 bg-white rounded-lg border p-3 shadow-sm ${isConsignment ? 'border-blue-200' : ''}`}>
                    <div className={`${isConsignment ? 'bg-blue-100' : 'bg-orange-100'} p-2 rounded flex-shrink-0`}>
                      <Package className={`h-4 w-4 ${isConsignment ? 'text-blue-600' : 'text-orange-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        SKU: {item.sku} | Sisa: <span className="text-red-600 font-bold">{item.stock}</span> (Min: {item.min_stock})
                      </p>
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-xs text-muted-foreground">HPP: {formatCurrency(item.purchase_price)}</p>
                        {isConsignment && <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700">Konsinyasi</Badge>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* MODAL BUAT PO */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-orange-600" />
              Buat Purchase Order dari Permintaan Restock
            </DialogTitle>
            <DialogDescription>
              Edit kuantitas dan harga sebelum membuat Draft PO. PO akan langsung masuk ke daftar Pembelian.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Header PO */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplier-select">Supplier <span className="text-red-500">*</span></Label>
                <Select value={supplierId} onValueChange={(v) => setSupplierId(v ?? '')}>
                  <SelectTrigger id="supplier-select">
                    <SelectValue placeholder="Pilih Supplier..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.supplier_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expected-date">Estimasi Datang <span className="text-red-500">*</span></Label>
                <Input
                  id="expected-date"
                  type="date"
                  value={expectedDate}
                  onChange={e => setExpectedDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="po-notes">Catatan</Label>
                <Input
                  id="po-notes"
                  placeholder="Catatan PO opsional..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Items Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produk</TableHead>
                    <TableHead className="text-right w-32">Qty Pesan</TableHead>
                    <TableHead className="text-right w-40">Harga Beli</TableHead>
                    <TableHead className="text-right w-36">Subtotal</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, idx) => (
                    <TableRow key={line.productId}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{line.productName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{line.sku}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={String(line.qtyOrdered ?? 1)}
                          onChange={e => updateLine(idx, 'qtyOrdered', Math.max(1, Number(e.target.value)))}
                          className="text-right h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={String(line.unitPrice ?? 0)}
                          onChange={e => updateLine(idx, 'unitPrice', Math.max(0, Number(e.target.value)))}
                          className="text-right h-8"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        {formatCurrency(line.qtyOrdered * line.unitPrice)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-500 hover:text-red-700"
                          onClick={() => removeLine(idx)}
                          title="Hapus item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {lines.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">
                        Semua item sudah dihapus. Tambahkan produk atau tutup modal.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Summary */}
            <div className="flex justify-end">
              <div className="space-y-1 text-sm w-64">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PPN 10%</span>
                  <span>{formatCurrency(tax)}</span>
                </div>
                <div className="flex justify-between font-bold border-t pt-1">
                  <span>Total PO</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending || lines.length === 0 || !supplierId}
              className="gap-2 bg-orange-600 hover:bg-orange-700"
            >
              <ShoppingCart className="h-4 w-4" />
              {isPending ? 'Membuat PO...' : 'Buat Draft PO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
