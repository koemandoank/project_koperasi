"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { createConsignmentItem, returnConsignmentItem, createConsignmentSettlement, recordConsignmentPayable } from "@/lib/actions/consignment"
import { formatCurrency } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface Item {
  id: number;
  product_id: number;
  product_name: string;
  supplier_id: number;
  supplier_name: string;
  qty_received: number;
  qty_sold: number;
  qty_unbilled: number;
  qty_returned: number;
  qty_remaining: number;
  unit_price: number;
  margin_pct: number;
  status: string;
  return_reason: string | null;
  return_date: string | null;
  received_at: string;
}

interface Payable {
  id: number;
  supplier_id: number;
  supplier_name: string;
  period_start: string;
  period_end: string;
  total_qty_sold: number;
  total_revenue: number;
  margin_amount: number;
  payable_amount: number;
  status: string;
  settlements: any[];
}

export default function KonsinyasiClient({ items, payables, suppliers, products }: { items: Item[], payables: Payable[], suppliers: any[], products: any[] }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("stok")
  
  // Create New Item Dialog
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({ product_id: "", supplier_id: "", qty: "", price: "", date: new Date().toISOString().split("T")[0] })
  
  // Return Dialog
  const [isReturnOpen, setIsReturnOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [returnQty, setReturnQty] = useState("")
  const [returnReasonKey, setReturnReasonKey] = useState("")
  const [returnReasonCustom, setReturnReasonCustom] = useState("")

  // Settlement Dialog
  const [isSettleOpen, setIsSettleOpen] = useState(false)
  const [selectedPayable, setSelectedPayable] = useState<Payable | null>(null)
  const [settleAmount, setSettleAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("transfer")
  const [refNo, setRefNo] = useState("")

  const [isLoading, setIsLoading] = useState(false)

  const handleAdd = async () => {
    if (!addForm.product_id || !addForm.supplier_id || !addForm.qty || !addForm.price || !addForm.date) {
      toast.error("Mohon lengkapi semua field")
      return
    }
    setIsLoading(true)
    const res = await createConsignmentItem(
      Number(addForm.product_id),
      Number(addForm.supplier_id),
      Number(addForm.qty),
      Number(addForm.price),
      new Date(addForm.date)
    )
    if (res.success) {
      toast.success("Barang konsinyasi berhasil ditambahkan")
      setIsAddOpen(false)
    } else {
      toast.error(res.error || "Gagal menambahkan")
    }
    setIsLoading(false)
  }

  const handleReturn = async () => {
    if (!selectedItem || !returnQty || Number(returnQty) <= 0) return
    const finalReason = returnReasonKey === 'lainnya' ? returnReasonCustom.trim() : returnReasonKey
    if (!finalReason) {
      toast.error("Alasan retur wajib dipilih")
      return
    }
    setIsLoading(true)
    const res = await returnConsignmentItem(Number(selectedItem.id), Number(returnQty), finalReason)
    if (res.success) {
      toast.success("Retur barang berhasil diproses")
      setIsReturnOpen(false)
      setReturnQty("")
      setReturnReasonKey("")
      setReturnReasonCustom("")
      setSelectedItem(null)
      router.refresh()
    } else {
      toast.error(res.error || "Gagal melakukan retur")
    }
    setIsLoading(false)
  }

  const handleCreatePayable = async (item: Item) => {
    if (item.qty_unbilled <= 0) return
    if (!confirm(`Buat tagihan pembayaran untuk ${item.qty_unbilled} unit ${item.product_name} senilai ${formatCurrency(item.qty_unbilled * item.unit_price)}?`)) return
    
    setIsLoading(true)
    const res = await recordConsignmentPayable(
      item.supplier_id,
      item.id,
      item.qty_unbilled,
      item.unit_price,
      item.qty_unbilled * item.unit_price
    )
    if (res.success) {
      toast.success("Tagihan berhasil dibuat")
      router.refresh()
    } else {
      toast.error(res.error || "Gagal membuat tagihan")
    }
    setIsLoading(false)
  }

  const handleSettle = async () => {
    if (!selectedPayable || !settleAmount || Number(settleAmount) <= 0) return
    setIsLoading(true)
    const res = await createConsignmentSettlement(
      Number(selectedPayable.id),
      Number(settleAmount),
      paymentMethod,
      refNo
    )
    if (res.success) {
      toast.success("Pembayaran tagihan berhasil dicatat")
      setIsSettleOpen(false)
    } else {
      toast.error(res.error || "Gagal mencatat pembayaran")
    }
    setIsLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-[400px]">
          <TabsList>
            <TabsTrigger value="stok">Stok Titipan</TabsTrigger>
            <TabsTrigger value="tagihan">Tagihan & Settlement</TabsTrigger>
          </TabsList>
        </Tabs>
        
        {activeTab === "stok" && (
          <Button onClick={() => setIsAddOpen(true)}>+ Penerimaan Konsinyasi</Button>
        )}
      </div>

      <Tabs value={activeTab} className="w-full">
        <TabsContent value="stok">
          <Card>
            <CardHeader>
              <CardTitle>Daftar Barang Konsinyasi</CardTitle>
              <CardDescription>Manajemen stok barang titipan yang aktif dan siap dijual.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tgl Masuk</TableHead>
                    <TableHead>Produk</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Diterima</TableHead>
                    <TableHead>Terjual</TableHead>
                    <TableHead>Sisa</TableHead>
                    <TableHead>HPP</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>{item.received_at}</TableCell>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell>{item.supplier_name}</TableCell>
                      <TableCell>{item.qty_received}</TableCell>
                      <TableCell>{item.qty_sold}</TableCell>
                      <TableCell className="font-bold">{item.qty_remaining}</TableCell>
                      <TableCell>{formatCurrency(item.unit_price)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                            {item.status === 'returned' ? '✓ Diretur' : item.status}
                          </Badge>
                          {item.qty_returned > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {item.qty_returned} unit diretur
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {item.qty_returned > 0 && item.return_reason && (
                            <div className="text-xs bg-amber-50 border border-amber-200 rounded px-2 py-1 text-amber-800 max-w-[160px]">
                              <span className="font-semibold block">Alasan retur:</span>
                              {item.return_reason}
                              {item.return_date && (
                                <span className="block text-amber-600 mt-0.5">
                                  {new Date(item.return_date).toLocaleDateString('id-ID')}
                                </span>
                              )}
                            </div>
                          )}
                          <Button 
                            variant="destructive" 
                            size="sm"
                            disabled={item.qty_remaining === 0}
                            onClick={() => { 
                              setSelectedItem(item)
                              setReturnQty("")
                              setReturnReasonKey("")
                              setReturnReasonCustom("")
                              setIsReturnOpen(true)
                            }}
                          >
                            Retur
                          </Button>
                          {item.qty_unbilled > 0 && (
                            <Button 
                              variant="default"
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700"
                              onClick={() => handleCreatePayable(item)}
                              disabled={isLoading}
                              title="Barang sudah laku terjual, silakan buat tagihan pembayaran untuk supplier"
                            >
                              Buat Tagihan ({item.qty_unbilled})
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center">Tidak ada barang konsinyasi aktif</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tagihan">
          <Card>
            <CardHeader>
              <CardTitle>Tagihan Pembayaran</CardTitle>
              <CardDescription>Pembayaran ke supplier untuk barang konsinyasi yang laku.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Periode</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Total Terjual</TableHead>
                    <TableHead>Total Tagihan</TableHead>
                    <TableHead>Telah Dibayar</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payables.map(p => {
                    const totalPaid = p.settlements.reduce((sum, s) => sum + s.amount_paid, 0);
                    return (
                      <TableRow key={p.id}>
                        <TableCell>{p.period_start} s/d {p.period_end}</TableCell>
                        <TableCell>{p.supplier_name}</TableCell>
                        <TableCell>{p.total_qty_sold}</TableCell>
                        <TableCell className="font-bold text-blue-600">{formatCurrency(p.payable_amount)}</TableCell>
                        <TableCell className="text-green-600">{formatCurrency(totalPaid)}</TableCell>
                        <TableCell>
                          <Badge variant={p.status === 'paid' ? 'default' : p.status === 'pending' ? 'destructive' : 'secondary'}>{p.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            disabled={p.status === 'paid'}
                            onClick={() => { setSelectedPayable(p); setSettleAmount((p.payable_amount - totalPaid).toString()); setIsSettleOpen(true); }}
                          >
                            Bayar
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {payables.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center">Tidak ada tagihan konsinyasi</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Penerimaan Barang Konsinyasi</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Produk</Label>
              <Select value={addForm.product_id} onValueChange={(val) => setAddForm({...addForm, product_id: val ?? ''})}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Pilih Produk" />
                </SelectTrigger>
                <SelectContent>
                  {products.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Supplier</Label>
              <Select value={addForm.supplier_id} onValueChange={(val) => setAddForm({...addForm, supplier_id: val ?? ''})}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Pilih Supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.supplier_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Qty</Label>
              <Input type="number" className="col-span-3" value={addForm.qty} onChange={e => setAddForm({...addForm, qty: e.target.value})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">HPP (Unit)</Label>
              <Input type="number" className="col-span-3" value={addForm.price} onChange={e => setAddForm({...addForm, price: e.target.value})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Tgl Masuk</Label>
              <Input type="date" className="col-span-3" value={addForm.date} onChange={e => setAddForm({...addForm, date: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Batal</Button>
            <Button onClick={handleAdd} disabled={isLoading}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReturnOpen} onOpenChange={setIsReturnOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Retur Barang Konsinyasi</DialogTitle>
            <DialogDescription>Kembalikan stok ke supplier. Catat alasan dengan jelas untuk laporan.</DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="grid gap-4 py-2">
              {/* Info barang */}
              <div className="rounded-lg bg-muted/50 border p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Produk</span>
                  <span className="font-semibold">{selectedItem.product_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Supplier</span>
                  <span>{selectedItem.supplier_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sisa Stok Dapat Diretur</span>
                  <span className="font-bold text-blue-600">{selectedItem.qty_remaining}</span>
                </div>
              </div>

              {/* Qty retur */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Qty Retur</Label>
                <Input 
                  type="number" 
                  className="col-span-3" 
                  min={1}
                  max={selectedItem.qty_remaining}
                  value={returnQty} 
                  onChange={e => setReturnQty(e.target.value)} 
                  placeholder={`Maks. ${selectedItem.qty_remaining}`}
                />
              </div>

              {/* Alasan retur - dropdown */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Alasan</Label>
                <Select value={returnReasonKey} onValueChange={v => setReturnReasonKey(v ?? 'Barang mendekati kadaluarsa')}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Pilih alasan retur..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Barang mendekati kadaluarsa">⏰ Mendekati kadaluarsa</SelectItem>
                    <SelectItem value="Barang kadaluarsa">❌ Kadaluarsa</SelectItem>
                    <SelectItem value="Barang rusak / cacat">🔧 Barang rusak / cacat</SelectItem>
                    <SelectItem value="Barang tidak laku">📦 Tidak laku terjual</SelectItem>
                    <SelectItem value="Permintaan supplier">🤝 Permintaan supplier</SelectItem>
                    <SelectItem value="Kontrak konsinyasi berakhir">📋 Kontrak berakhir</SelectItem>
                    <SelectItem value="lainnya">✏️ Lainnya (tulis manual)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Custom reason jika pilih Lainnya */}
              {returnReasonKey === 'lainnya' && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Keterangan</Label>
                  <Input
                    className="col-span-3"
                    placeholder="Tulis alasan retur..."
                    value={returnReasonCustom}
                    onChange={e => setReturnReasonCustom(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReturnOpen(false)}>Batal</Button>
            <Button variant="destructive" onClick={handleReturn} disabled={isLoading}>
              {isLoading ? "Memproses..." : "Proses Retur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSettleOpen} onOpenChange={setIsSettleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settlement Tagihan</DialogTitle>
          </DialogHeader>
          {selectedPayable && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Nominal Bayar</Label>
                <Input type="number" className="col-span-3" value={settleAmount} onChange={e => setSettleAmount(e.target.value)} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Metode</Label>
                <Select value={paymentMethod} onValueChange={v => setPaymentMethod(v ?? 'transfer')}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Pilih Metode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer">Transfer Bank</SelectItem>
                    <SelectItem value="cash">Tunai</SelectItem>
                    <SelectItem value="check">Cek/Giro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">No. Referensi</Label>
                <Input className="col-span-3" value={refNo} onChange={e => setRefNo(e.target.value)} placeholder="Opsional (No. Rekening/Struk)" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettleOpen(false)}>Batal</Button>
            <Button onClick={handleSettle} disabled={isLoading}>Proses Pembayaran</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
