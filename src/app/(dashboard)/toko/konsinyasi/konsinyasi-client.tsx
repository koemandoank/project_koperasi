"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody, DrawerFooter, DrawerDescription } from "@/components/ui/drawer"
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
  qty_sold: number;     // terjual di POS (real-time dari stok aktual)
  qty_billed: number;  // sudah dibuatkan tagihan ke supplier
  qty_unbilled: number; // terjual tapi belum ditagih
  qty_returned: number;
  qty_remaining: number;
  unit_price: number;
  status: string;
  return_reason: string | null;
  return_date: string | null;
  received_at: string;
}

interface Payable {
  id: number;
  supplier_id: number;
  supplier_name: string;
  product_name: string;
  period_start: string;
  period_end: string;
  total_qty_sold: number;
  unit_price: number;
  total_revenue: number;
  payable_amount: number;
  status: string;
  settlements: any[];
}

export default function KonsinyasiClient({ items, payables, suppliers, products }: { items: Item[], payables: Payable[], suppliers: any[], products: { id: number; name: string; category: string; purchase_price: number }[] }) {
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
      setAddForm({ product_id: "", supplier_id: "", qty: "", price: "", date: new Date().toISOString().split("T")[0] })
      router.refresh()
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
      <div className="flex gap-2 flex-wrap items-center justify-between">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-[400px]">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="stok" className="h-10 text-sm">Stok Titipan</TabsTrigger>
            <TabsTrigger value="tagihan" className="h-10 text-sm">Tagihan & Settlement</TabsTrigger>
          </TabsList>
        </Tabs>
        
        {activeTab === "stok" && (
          <Button onClick={() => setIsAddOpen(true)} className="w-full md:w-auto h-12 text-sm font-semibold mt-2 md:mt-0">
            + Penerimaan Konsinyasi
          </Button>
        )}
      </div>

      <Tabs value={activeTab} className="w-full">
        <TabsContent value="stok">
          <Card className="border-0 md:border">
            <CardHeader className="px-4 md:px-6">
              <CardTitle className="text-lg md:text-xl font-bold">Daftar Barang Konsinyasi</CardTitle>
              <CardDescription className="text-xs md:text-sm">Manajemen stok barang titipan yang aktif dan siap dijual.</CardDescription>
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              {/* Desktop Table */}
              <div className="hidden md:block">
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
                    {items.map((item: any) => (
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
                              <span className="text-xs text-slate-400">
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
              </div>

              {/* Mobile Card Feed */}
              <div className="block md:hidden space-y-3">
                {items.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 border border-dashed rounded-2xl bg-white dark:bg-slate-900">
                    Tidak ada barang konsinyasi aktif
                  </div>
                ) : (
                  items.map((item: any) => (
                    <div
                      key={item.id}
                      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-3"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="font-bold text-base text-slate-900 dark:text-slate-50">{item.product_name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">Supplier: {item.supplier_name}</p>
                        </div>
                        <Badge variant={item.status === 'active' ? 'default' : 'secondary'} className="text-xs shrink-0">
                          {item.status === 'returned' ? '✓ Diretur' : item.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs border-t border-slate-50 dark:border-slate-800/50 pt-2.5">
                        <div>
                          <p className="text-slate-400">Diterima</p>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{item.qty_received} unit</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Terjual</p>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{item.qty_sold} unit</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Sisa Stok</p>
                          <p className="font-bold text-blue-600">{item.qty_remaining} unit</p>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl">
                        <span className="text-slate-400">Harga Beli (HPP)</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(item.unit_price)}</span>
                      </div>

                      {item.qty_returned > 0 && item.return_reason && (
                        <div className="text-xs bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl p-2.5 text-amber-800 dark:text-amber-300">
                          <span className="font-semibold block">Keterangan Retur ({item.qty_returned} unit):</span>
                          {item.return_reason}
                        </div>
                      )}

                      <div className="flex items-center gap-2 border-t border-slate-50 dark:border-slate-800/50 pt-3">
                        <Button 
                          variant="outline" 
                          className="flex-1 h-11 text-red-600 border-red-200 hover:bg-red-50 text-xs font-semibold"
                          disabled={item.qty_remaining === 0}
                          onClick={() => { 
                            setSelectedItem(item)
                            setReturnQty("")
                            setReturnReasonKey("")
                            setReturnReasonCustom("")
                            setIsReturnOpen(true)
                          }}
                        >
                          Retur Barang
                        </Button>
                        {item.qty_unbilled > 0 && (
                          <Button 
                            variant="default"
                            className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-xs font-semibold"
                            onClick={() => handleCreatePayable(item)}
                            disabled={isLoading}
                          >
                            Tagih ({item.qty_unbilled})
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tagihan">
          <Card className="border-0 md:border">
            <CardHeader className="px-4 md:px-6">
              <CardTitle className="text-lg md:text-xl font-bold">Tagihan Pembayaran</CardTitle>
              <CardDescription className="text-xs md:text-sm">Pembayaran ke supplier untuk barang konsinyasi yang laku.</CardDescription>
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              {/* Desktop Table View */}
              <div className="hidden md:block">
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
                    {payables.map((p: any) => {
                      const totalPaid = p.settlements.reduce((sum: any, s: any) => sum + s.amount_paid, 0);
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
              </div>

              {/* Mobile Card Feed View */}
              <div className="block md:hidden space-y-3">
                {payables.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 border border-dashed rounded-2xl bg-white dark:bg-slate-900">
                    Tidak ada tagihan konsinyasi
                  </div>
                ) : (
                  payables.map((p: any) => {
                    const totalPaid = p.settlements.reduce((sum: any, s: any) => sum + s.amount_paid, 0);
                    return (
                      <div
                        key={p.id}
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-3"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <p className="font-bold text-base text-slate-900 dark:text-slate-50">{p.supplier_name}</p>
                            <p className="text-xs text-slate-400 mt-0.5">Periode: {p.period_start} s/d {p.period_end}</p>
                          </div>
                          <Badge variant={p.status === 'paid' ? 'default' : p.status === 'pending' ? 'destructive' : 'secondary'} className="text-xs shrink-0">
                            {p.status}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-50 dark:border-slate-800/50 pt-2.5">
                          <div>
                            <p className="text-slate-400">Total Tagihan</p>
                            <p className="font-bold text-blue-600 text-sm">{formatCurrency(p.payable_amount)}</p>
                          </div>
                          <div>
                            <p className="text-slate-400">Telah Dibayar</p>
                            <p className="font-bold text-green-600 text-sm">{formatCurrency(totalPaid)}</p>
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-xs bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl">
                          <span className="text-slate-400">Total Terjual</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{p.total_qty_sold} unit</span>
                        </div>

                        <Button 
                          variant="outline" 
                          className="w-full h-11 text-xs font-semibold border-slate-200 hover:bg-slate-50"
                          disabled={p.status === 'paid'}
                          onClick={() => { setSelectedPayable(p); setSettleAmount((p.payable_amount - totalPaid).toString()); setIsSettleOpen(true); }}
                        >
                          Bayar Tagihan
                        </Button>
                      </div>
                    )
                  })
                )}
              </div>
              </CardContent>
            </Card>
        </TabsContent>
      </Tabs>

      {/* Penerimaan Consignment Item Drawer */}
      <Drawer open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DrawerContent showClose>
          <DrawerHeader>
            <DrawerTitle>Penerimaan Barang Konsinyasi</DrawerTitle>
          </DrawerHeader>
          <DrawerBody className="space-y-4">
            <div className="space-y-1">
              <Label className="font-semibold text-sm">Produk</Label>
              <Select value={addForm.product_id} onValueChange={(val) => setAddForm({...addForm, product_id: val ?? ''})}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Pilih Produk" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p: any) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name}{p.category ? ` — ${p.category}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="font-semibold text-sm">Supplier</Label>
              <Select value={addForm.supplier_id} onValueChange={(val) => setAddForm({...addForm, supplier_id: val ?? ''})}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Pilih Supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id.toString()}>{s.supplier_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-semibold text-sm">Qty Diterima</Label>
                <Input type="number" className="h-12 text-base" value={addForm.qty} onChange={e => setAddForm({...addForm, qty: e.target.value})} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="font-semibold text-sm">Harga Beli HPP (Unit)</Label>
                <Input type="number" className="h-12 text-base" value={addForm.price} onChange={e => setAddForm({...addForm, price: e.target.value})} placeholder="0" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="font-semibold text-sm">Tgl Penerimaan</Label>
              <Input type="date" className="h-12 text-base" value={addForm.date} onChange={e => setAddForm({...addForm, date: e.target.value})} />
            </div>
          </DrawerBody>
          <DrawerFooter>
            <Button className="w-full h-12 text-base font-semibold" onClick={handleAdd} disabled={isLoading}>Simpan Penerimaan</Button>
            <Button variant="ghost" className="w-full h-12" onClick={() => setIsAddOpen(false)}>Batal</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Retur Drawer */}
      <Drawer open={isReturnOpen} onOpenChange={setIsReturnOpen}>
        <DrawerContent showClose>
          <DrawerHeader>
            <DrawerTitle>Retur Barang Konsinyasi</DrawerTitle>
            <DrawerDescription>Kembalikan sisa stok titipan ke supplier dengan alasan yang valid.</DrawerDescription>
          </DrawerHeader>
          {selectedItem && (
            <DrawerBody className="space-y-4">
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 border p-4 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Nama Produk</span>
                  <span className="font-bold text-slate-850 dark:text-slate-100">{selectedItem.product_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Supplier</span>
                  <span className="font-medium">{selectedItem.supplier_name}</span>
                </div>
                <div className="flex justify-between border-t border-dashed border-slate-200 dark:border-slate-800 pt-2">
                  <span className="text-slate-400">Maks. Stok Diretur</span>
                  <span className="font-extrabold text-blue-600 text-base">{selectedItem.qty_remaining} unit</span>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="font-semibold text-sm">Jumlah Unit Retur</Label>
                <Input 
                  type="number" 
                  className="h-12 text-base" 
                  min={1}
                  max={selectedItem.qty_remaining}
                  value={returnQty} 
                  onChange={e => setReturnQty(e.target.value)} 
                  placeholder={`Maksimal ${selectedItem.qty_remaining} unit`}
                />
              </div>

              <div className="space-y-1">
                <Label className="font-semibold text-sm">Alasan Retur</Label>
                <Select value={returnReasonKey} onValueChange={v => setReturnReasonKey(v ?? 'Barang mendekati kadaluarsa')}>
                  <SelectTrigger className="h-12 text-base">
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

              {returnReasonKey === 'lainnya' && (
                <div className="space-y-1 animate-in fade-in-50 duration-200">
                  <Label className="font-semibold text-sm">Tuliskan Keterangan Lainnya</Label>
                  <Input
                    className="h-12 text-base"
                    placeholder="Tulis alasan retur..."
                    value={returnReasonCustom}
                    onChange={e => setReturnReasonCustom(e.target.value)}
                  />
                </div>
              )}
            </DrawerBody>
          )}
          <DrawerFooter>
            <Button variant="destructive" className="w-full h-12 text-base font-semibold" onClick={handleReturn} disabled={isLoading}>
              {isLoading ? "Memproses Retur..." : "Proses Retur Sekarang"}
            </Button>
            <Button variant="ghost" className="w-full h-12" onClick={() => setIsReturnOpen(false)}>Batal</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Settlement/Pembayaran Drawer */}
      <Drawer open={isSettleOpen} onOpenChange={setIsSettleOpen}>
        <DrawerContent showClose>
          <DrawerHeader>
            <DrawerTitle>Settlement Pembayaran Konsinyasi</DrawerTitle>
          </DrawerHeader>
          {selectedPayable && (
            <DrawerBody className="space-y-4">
              <div className="rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 p-4 text-sm space-y-1">
                <p className="text-slate-400">Supplier Penerima</p>
                <p className="font-extrabold text-base text-slate-800 dark:text-slate-200">{selectedPayable.supplier_name}</p>
              </div>

              <div className="space-y-1">
                <Label className="font-semibold text-sm">Nominal Pembayaran (Rp)</Label>
                <Input type="number" className="h-12 text-base font-bold text-blue-600" value={settleAmount} onChange={e => setSettleAmount(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="font-semibold text-sm">Metode Pembayaran</Label>
                <Select value={paymentMethod} onValueChange={v => setPaymentMethod(v ?? 'transfer')}>
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder="Pilih Metode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer">🏦 Transfer Bank</SelectItem>
                    <SelectItem value="cash">💵 Tunai / Cash</SelectItem>
                    <SelectItem value="check">📜 Cek / Giro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="font-semibold text-sm">No. Referensi (opsional)</Label>
                <Input className="h-12 text-base" value={refNo} onChange={e => setRefNo(e.target.value)} placeholder="cth: No. Struk atau Rekening" />
              </div>
            </DrawerBody>
          )}
          <DrawerFooter>
            <Button className="w-full h-12 text-base font-semibold" onClick={handleSettle} disabled={isLoading}>
              {isLoading ? "Memproses..." : "Konfirmasi Pembayaran"}
            </Button>
            <Button variant="ghost" className="w-full h-12" onClick={() => setIsSettleOpen(false)}>Batal</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
