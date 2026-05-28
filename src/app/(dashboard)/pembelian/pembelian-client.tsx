"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart, Truck, Plus, CheckCircle, Clock, Package, PackageCheck, AlertTriangle, RotateCcw } from "lucide-react";
import { createSupplier, createPurchaseOrder, approvePurchaseOrder, getPOItemsForReceipt, receiveGoodsFromPO } from "@/lib/actions/procurement";

type Supplier = {
  id: number; supplier_code: string; supplier_name: string;
  contact_person: string; phone: string; email: string;
  city: string; payment_terms: number; is_active: boolean; po_count: number;
};
type PurchaseOrder = {
  id: number; po_no: string; supplier_name: string; supplier_id: number;
  po_date: string; expected_delivery: string; status: string;
  subtotal: number; tax_amount: number; total_amount: number;
  notes: string | null; item_count: number;
};

type GRItem = {
  id: number;
  product_id: number;
  product_name: string;
  qty_ordered: number;
  qty_received: number;
  unit_price: number;
  // form state
  qty_accepted: number;
  qty_rejected: number;
  reject_reason: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:             { label: "Draft",           color: "bg-slate-100 text-slate-700" },
  submitted:         { label: "Diajukan",        color: "bg-blue-100 text-blue-700" },
  approved:          { label: "Disetujui",       color: "bg-green-100 text-green-700" },
  partial_received:  { label: "Parsial Diterima", color: "bg-yellow-100 text-yellow-700" },
  received:          { label: "Diterima",        color: "bg-teal-100 text-teal-700" },
  cancelled:         { label: "Dibatalkan",      color: "bg-red-100 text-red-700" },
};

const formatRp = (val: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);

type Product = {
  id: number; name: string; purchase_price: number;
};

export function PembelianClient({
  suppliers: initialSuppliers,
  purchaseOrders: initialPOs,
  products = [],
}: {
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  products?: Product[];
}) {
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [pos, setPos] = useState(initialPOs);
  const [loading, setLoading] = useState(false);

  // Supplier form
  const [supplierDialog, setSupplierDialog] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    code: "", name: "", contact: "", phone: "", email: "", city: "", terms: "30",
  });

  // PO form
  const [poDialog, setPoDialog] = useState(false);
  const [poForm, setPoForm] = useState({
    supplier_id: "", po_date: new Date().toISOString().split("T")[0],
    delivery: "", notes: "",
    items: [{ product_id: "", product_name: "", qty: 1, unit_price: 0 }],
  });

  // GR (Good Receipt) dialog
  const [grDialog, setGrDialog]     = useState(false);
  const [grLoading, setGrLoading]   = useState(false);
  const [grPoData, setGrPoData]     = useState<{ id: number; po_no: string; supplier_name: string; supplier_id: number } | null>(null);
  const [grItems, setGrItems]       = useState<GRItem[]>([]);
  const [grNotes, setGrNotes]       = useState("");

  const openGRDialog = async (po: PurchaseOrder) => {
    setGrLoading(true);
    setGrDialog(true);
    setGrPoData({ id: po.id, po_no: po.po_no, supplier_name: po.supplier_name, supplier_id: po.supplier_id });
    setGrNotes("");
    try {
      const res = await getPOItemsForReceipt(po.id);
      if (res.success && res.data) {
        const itemsWithRemaining = res.data.items.map((item: any) => {
          const remaining = Math.max(0, item.qty_ordered - item.qty_received);
          return {
            ...item,
            qty_ordered: remaining,   // update qty_ordered display to be the remaining qty
            qty_accepted: remaining,  // default: semua sisa diterima
            qty_rejected: 0,
            reject_reason: "",
          };
        }).filter((item: any) => item.qty_ordered > 0);

        if (itemsWithRemaining.length === 0) {
          toast.info("Semua barang untuk PO ini sudah diterima penuh.");
          setGrDialog(false);
          return;
        }

        setGrItems(itemsWithRemaining);
      } else {
        toast.error("Gagal memuat data item PO.");
        setGrDialog(false);
      }
    } catch {
      toast.error("Terjadi kesalahan saat memuat data.");
      setGrDialog(false);
    } finally {
      setGrLoading(false);
    }
  };

  const updateGRItem = (idx: number, field: keyof GRItem, value: number | string) => {
    setGrItems(prev => prev.map((item: any, i: any) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      // auto-sync: if qty_accepted changes, recalculate qty_rejected
      if (field === "qty_accepted") {
        const accepted = Math.min(Number(value), item.qty_ordered);
        updated.qty_accepted = accepted;
        updated.qty_rejected = item.qty_ordered - accepted;
      }
      if (field === "qty_rejected") {
        const rejected = Math.min(Number(value), item.qty_ordered);
        updated.qty_rejected = rejected;
        updated.qty_accepted = item.qty_ordered - rejected;
      }
      return updated;
    }));
  };

  const handleSubmitGR = async () => {
    if (!grPoData) return;
    const hasInvalid = grItems.some((i: any) => (i.qty_accepted + i.qty_rejected) !== i.qty_ordered);
    if (hasInvalid) return toast.error("Jumlah diterima + ditolak harus sama dengan jumlah dipesan untuk setiap item.");
    setGrLoading(true);
    try {
      const res = await receiveGoodsFromPO(
        grPoData.id,
        grPoData.supplier_id,
        grItems.map((i: any) => ({
          productId:    i.product_id,
          qtyReceived:  i.qty_ordered, // total sisa yang sedang diterima kali ini
          qtyAccepted:  i.qty_accepted,
          qtyRejected:  i.qty_rejected,
          rejectReason: i.reject_reason || undefined,
        })),
        grNotes || undefined
      );
      if (res.success) {
        const hasReject = grItems.some((i: any) => i.qty_rejected > 0);
        toast.success(`Barang berhasil diterima. No. GR: ${(res as any).grNo}${hasReject ? " — Ada retur ke supplier." : ""}`);
        setGrDialog(false);
        // Update PO status optimistically
        const allRejected = grItems.every((i: any) => i.qty_accepted === 0);
        const newStatus = allRejected ? "cancelled" : hasReject ? "partial_received" : "received";
        setPos(prev => prev.map((p: any) => p.id === grPoData.id ? { ...p, status: newStatus } : p));
      } else {
        toast.error((res as any).error ?? "Gagal menyimpan Good Receipt.");
      }
    } finally {
      setGrLoading(false);
    }
  };

  const handleCreateSupplier = async () => {
    if (!supplierForm.code || !supplierForm.name) return toast.error("Kode dan Nama supplier wajib diisi.");
    setLoading(true);
    try {
      const res = await createSupplier(
        supplierForm.code, supplierForm.name, supplierForm.contact,
        supplierForm.phone, supplierForm.email, undefined, supplierForm.city,
        parseInt(supplierForm.terms) || 30
      );
      if (res.success) {
        toast.success("Supplier berhasil ditambahkan.");
        setSupplierDialog(false);
        setSupplierForm({ code: "", name: "", contact: "", phone: "", email: "", city: "", terms: "30" });
        // Refresh: add optimistically
        setSuppliers((prev) => [
          ...prev,
          { id: Number((res as any).data?.id ?? 0), supplier_code: supplierForm.code, supplier_name: supplierForm.name,
            contact_person: supplierForm.contact, phone: supplierForm.phone, email: supplierForm.email,
            city: supplierForm.city, payment_terms: parseInt(supplierForm.terms) || 30, is_active: true, po_count: 0 },
        ]);
      } else {
        toast.error((res as any).error ?? "Gagal menambahkan supplier.");
      }
    } finally { setLoading(false); }
  };

  const handleCreatePO = async () => {
    if (!poForm.supplier_id || !poForm.delivery) return toast.error("Supplier dan Tanggal Pengiriman wajib diisi.");
    const validItems = poForm.items.filter((i: any) => i.product_name && i.qty > 0 && i.unit_price > 0);
    if (validItems.length === 0) return toast.error("Minimal satu item harus diisi.");
    setLoading(true);
    try {
      const res = await createPurchaseOrder(
        parseInt(poForm.supplier_id),
        new Date(poForm.po_date),
        new Date(poForm.delivery),
        validItems.map((i: any) => ({
          productId: i.product_id ? parseInt(i.product_id) : 0,
          qtyOrdered: i.qty,
          unitPrice: i.unit_price,
        })),
        poForm.notes
      );
      if (res.success) {
        toast.success("Purchase Order berhasil dibuat.");
        setPoDialog(false);
        const d = (res as any).data;
        setPos((prev) => [
          { 
            id: Number(d.id), 
            po_no: d.po_no,
            supplier_name: suppliers.find((s: any) => s.id === parseInt(poForm.supplier_id))?.supplier_name ?? "-",
            supplier_id: parseInt(poForm.supplier_id), 
            po_date: poForm.po_date,
            expected_delivery: poForm.delivery, 
            status: "draft",
            subtotal: Number(d.subtotal ?? d.total_amount),
            tax_amount: Number(d.tax_amount ?? 0),
            total_amount: Number(d.total_amount), 
            notes: poForm.notes || null,
            item_count: validItems.length 
          },
          ...prev,
        ]);
      } else {
        toast.error((res as any).error ?? "Gagal membuat PO.");
      }
    } finally { setLoading(false); }
  };

  const handleApprovePO = async (poId: number) => {
    if (!confirm("Setujui Purchase Order ini?")) return;
    setLoading(true);
    try {
      const res = await approvePurchaseOrder(poId);
      if (res.success) {
        toast.success("PO berhasil disetujui.");
        setPos((prev) => prev.map((p: any) => p.id === poId ? { ...p, status: "approved" } : p));
      } else {
        toast.error((res as any).error ?? "Gagal menyetujui PO.");
      }
    } finally { setLoading(false); }
  };

  const totalPoValue = pos.filter((p: any) => p.status !== "cancelled").reduce((s: any, p: any) => s + p.total_amount, 0);
  const pendingPos = pos.filter((p: any) => ["draft", "submitted"].includes(p.status)).length;
  const approvedPos = pos.filter((p: any) => p.status === "approved").length;

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-blue-100">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg"><Truck className="h-5 w-5 text-blue-600" /></div>
            <div><p className="text-xs text-muted-foreground">Total Supplier</p><p className="text-2xl font-bold">{suppliers.length}</p></div>
          </CardContent>
        </Card>
        <Card className="border-yellow-100">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg"><Clock className="h-5 w-5 text-yellow-600" /></div>
            <div><p className="text-xs text-muted-foreground">PO Menunggu</p><p className="text-2xl font-bold">{pendingPos}</p></div>
          </CardContent>
        </Card>
        <Card className="border-green-100">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg"><Package className="h-5 w-5 text-green-600" /></div>
            <div><p className="text-xs text-muted-foreground">Nilai PO Aktif</p><p className="text-lg font-bold">{formatRp(totalPoValue)}</p></div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="po">
        <TabsList>
          <TabsTrigger value="po"><ShoppingCart className="h-4 w-4 mr-2" />Purchase Order</TabsTrigger>
          <TabsTrigger value="supplier"><Truck className="h-4 w-4 mr-2" />Supplier</TabsTrigger>
        </TabsList>

        {/* Purchase Orders Tab */}
        <TabsContent value="po" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button onClick={() => setPoDialog(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" /> Buat PO Baru
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. PO</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Tgl PO</TableHead>
                    <TableHead>Est. Terima</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pos.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Belum ada Purchase Order.</TableCell></TableRow>
                  )}
                  {pos.map((po: any) => {
                    const cfg = STATUS_CONFIG[po.status] ?? { label: po.status, color: "bg-slate-100 text-slate-700" };
                    return (
                      <TableRow key={po.id}>
                        <TableCell className="font-mono font-medium">{po.po_no}</TableCell>
                        <TableCell>{po.supplier_name}</TableCell>
                        <TableCell>{po.po_date}</TableCell>
                        <TableCell>{po.expected_delivery}</TableCell>
                        <TableCell className="text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatRp(po.total_amount)}</TableCell>
                        <TableCell className="text-center space-x-1">
                          {po.status === "draft" && (
                            <Button size="sm" variant="outline" className="text-green-600 border-green-200"
                              onClick={() => handleApprovePO(po.id)} disabled={loading}>
                              <CheckCircle className="h-3 w-3 mr-1" /> Setujui
                            </Button>
                          )}
                          {(po.status === "approved" || po.status === "partial_received") && (
                            <Button size="sm" variant="outline" className="text-blue-600 border-blue-200"
                              onClick={() => openGRDialog(po)} disabled={grLoading}>
                              <PackageCheck className="h-3 w-3 mr-1" />
                              {po.status === "partial_received" ? "Terima Sisa" : "Terima Barang"}
                            </Button>
                          )}
                          {po.status === "received" && (
                            <span className="text-xs text-teal-600 font-medium flex items-center gap-1 justify-center">
                              <CheckCircle className="h-3 w-3" /> Selesai
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Supplier Tab */}
        <TabsContent value="supplier" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setSupplierDialog(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" /> Tambah Supplier
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kode</TableHead>
                    <TableHead>Nama Supplier</TableHead>
                    <TableHead>Kontak</TableHead>
                    <TableHead>Kota</TableHead>
                    <TableHead className="text-center">Term</TableHead>
                    <TableHead className="text-center">PO</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Belum ada supplier.</TableCell></TableRow>
                  )}
                  {suppliers.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono">{s.supplier_code}</TableCell>
                      <TableCell className="font-medium">{s.supplier_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.phone}</TableCell>
                      <TableCell>{s.city}</TableCell>
                      <TableCell className="text-center">{s.payment_terms} hari</TableCell>
                      <TableCell className="text-center">{s.po_count}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={s.is_active ? "default" : "secondary"}>{s.is_active ? "Aktif" : "Nonaktif"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: Tambah Supplier */}
      <Dialog open={supplierDialog} onOpenChange={setSupplierDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Tambah Supplier Baru</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Kode Supplier *", key: "code", placeholder: "mis: SUP-001" },
              { label: "Nama Supplier *", key: "name", placeholder: "PT. Contoh Supplier" },
              { label: "Kontak", key: "contact", placeholder: "Nama PIC" },
              { label: "Telepon", key: "phone", placeholder: "08xx" },
              { label: "Email", key: "email", placeholder: "email@contoh.com" },
              { label: "Kota", key: "city", placeholder: "Jakarta" },
            ].map((f: any) => (
              <div key={f.key} className="space-y-1">
                <Label>{f.label}</Label>
                <Input value={(supplierForm as any)[f.key]} placeholder={f.placeholder}
                  onChange={(e) => setSupplierForm((p) => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div className="space-y-1 col-span-2">
              <Label>Payment Terms (hari)</Label>
              <Input type="number" value={supplierForm.terms}
                onChange={(e) => setSupplierForm((p) => ({ ...p, terms: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupplierDialog(false)}>Batal</Button>
            <Button onClick={handleCreateSupplier} disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Buat PO */}
      <Dialog open={poDialog} onOpenChange={setPoDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Buat Purchase Order</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 col-span-2">
                <Label>Supplier *</Label>
                <select className="w-full border rounded-md p-2 bg-background text-sm"
                  value={poForm.supplier_id}
                  onChange={(e) => setPoForm((p) => ({ ...p, supplier_id: e.target.value }))}>
                  <option value="">-- Pilih Supplier --</option>
                  {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Tanggal PO</Label>
                <Input type="date" value={poForm.po_date}
                  onChange={(e) => setPoForm((p) => ({ ...p, po_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Est. Tanggal Terima *</Label>
                <Input type="date" value={poForm.delivery}
                  onChange={(e) => setPoForm((p) => ({ ...p, delivery: e.target.value }))} />
              </div>
            </div>

            {/* Info: konsinyasi products excluded */}
            <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
              <Package className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
              <span>
                <strong>Catatan:</strong> Produk kategori <strong>Konsinyasi (Titip Jual)</strong> tidak tersedia di form ini.
                Untuk menerima barang konsinyasi, gunakan menu <strong>Toko → Konsinyasi</strong>.
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Item Barang</Label>
                <Button type="button" variant="outline" size="sm"
                  onClick={() => setPoForm((p) => ({ ...p, items: [...p.items, { product_id: "", product_name: "", qty: 1, unit_price: 0 }] }))}>
                  <Plus className="h-3 w-3 mr-1" /> Tambah Item
                </Button>
              </div>
              {poForm.items.map((item: any, idx: any) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5 space-y-1">
                    <Label className="text-xs">Nama Barang</Label>
                    <select className="w-full border rounded-md p-2 bg-background text-sm h-9"
                      value={item.product_id}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        const product = products.find((p: any) => p.id.toString() === selectedId);
                        setPoForm((p) => ({
                          ...p,
                          items: p.items.map((x: any, i: any) => i === idx ? {
                            ...x,
                            product_id: selectedId,
                            product_name: product?.name || "",
                            unit_price: product ? product.purchase_price : x.unit_price
                          } : x)
                        }))
                      }}>
                      <option value="">-- Pilih Barang --</option>
                      {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Qty</Label>
                    <Input type="number" min={1} value={item.qty}
                      onChange={(e) => setPoForm((p) => ({ ...p, items: p.items.map((x: any, i: any) => i === idx ? { ...x, qty: parseInt(e.target.value) || 1 } : x) }))} />
                  </div>
                  <div className="col-span-4 space-y-1">
                    <Label className="text-xs">Harga Satuan</Label>
                    <Input type="number" min={0} value={item.unit_price}
                      onChange={(e) => setPoForm((p) => ({ ...p, items: p.items.map((x: any, i: any) => i === idx ? { ...x, unit_price: parseInt(e.target.value) || 0 } : x) }))} />
                  </div>
                  <div className="col-span-1">
                    <Button type="button" variant="ghost" size="icon" className="text-red-500"
                      disabled={poForm.items.length <= 1}
                      onClick={() => setPoForm((p) => ({ ...p, items: p.items.filter((_: any, i: any) => i !== idx) }))}>
                      ✕
                    </Button>
                  </div>
                </div>
              ))}
              <div className="text-right text-sm font-semibold text-blue-600">
                Subtotal: {formatRp(poForm.items.reduce((s: any, i: any) => s + (i.qty * i.unit_price), 0))} + PPN 10%
              </div>
            </div>

            <div className="space-y-1">
              <Label>Catatan (opsional)</Label>
              <Input value={poForm.notes} placeholder="Catatan untuk supplier..."
                onChange={(e) => setPoForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPoDialog(false)}>Batal</Button>
            <Button onClick={handleCreatePO} disabled={loading}>
              {loading ? "Menyimpan..." : "Buat PO"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Good Receipt - Verifikasi Penerimaan Barang */}
      <Dialog open={grDialog} onOpenChange={setGrDialog}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-blue-600" />
              Penerimaan Barang (Good Receipt)
            </DialogTitle>
            {grPoData && (
              <p className="text-sm text-muted-foreground mt-1">
                PO: <span className="font-mono font-semibold">{grPoData.po_no}</span> — Supplier: {grPoData.supplier_name}
              </p>
            )}
          </DialogHeader>

          {grLoading && !grItems.length ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <RotateCcw className="h-4 w-4 animate-spin" /> Memuat data barang...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Nama Barang</TableHead>
                      <TableHead className="text-center w-20">Dipesan</TableHead>
                      <TableHead className="text-center w-28 text-green-700">✓ Diterima</TableHead>
                      <TableHead className="text-center w-28 text-red-700">✕ Ditolak</TableHead>
                      <TableHead className="w-48">Alasan Tolak</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grItems.map((item: any, idx: any) => (
                      <TableRow key={item.id} className={item.qty_rejected > 0 ? "bg-red-50/40" : ""}>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell className="text-center font-semibold">{item.qty_ordered}</TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number" min={0} max={item.qty_ordered}
                            value={item.qty_accepted}
                            className="h-8 text-center text-green-700 font-semibold border-green-200 focus:border-green-400"
                            onChange={(e) => updateGRItem(idx, "qty_accepted", parseInt(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number" min={0} max={item.qty_ordered}
                            value={item.qty_rejected}
                            className="h-8 text-center text-red-600 font-semibold border-red-200 focus:border-red-400"
                            onChange={(e) => updateGRItem(idx, "qty_rejected", parseInt(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell>
                          {item.qty_rejected > 0 ? (
                            <Input
                              placeholder="Alasan (cacat, kurang, dll)"
                              value={item.reject_reason}
                              className="h-8 text-xs border-red-200"
                              onChange={(e) => updateGRItem(idx, "reject_reason", e.target.value)}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-green-50 border border-green-100 p-3 text-center">
                  <p className="text-xs text-green-700 mb-1">Total Diterima</p>
                  <p className="text-xl font-bold text-green-700">
                    {grItems.reduce((s: any, i: any) => s + i.qty_accepted, 0)} pcs
                  </p>
                </div>
                <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-center">
                  <p className="text-xs text-red-700 mb-1">Total Ditolak / Retur</p>
                  <p className="text-xl font-bold text-red-600">
                    {grItems.reduce((s: any, i: any) => s + i.qty_rejected, 0)} pcs
                  </p>
                </div>
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-center">
                  <p className="text-xs text-blue-700 mb-1">Status GR</p>
                  <p className="text-sm font-bold text-blue-700">
                    {grItems.every((i: any) => i.qty_accepted === 0) ? "Semua Ditolak"
                      : grItems.some((i: any) => i.qty_rejected > 0) ? "Parsial Diterima"
                      : "Semua Diterima"}
                  </p>
                </div>
              </div>

              {grItems.some((i: any) => i.qty_rejected > 0) && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Barang yang ditolak akan dicatat sebagai <strong>retur ke supplier</strong> dan <strong>tidak</strong> masuk ke stok.</span>
                </div>
              )}

              <div className="space-y-1">
                <Label>Catatan Penerimaan (opsional)</Label>
                <Input value={grNotes} placeholder="Catatan tambahan..."
                  onChange={(e) => setGrNotes(e.target.value)} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setGrDialog(false)} disabled={grLoading}>Batal</Button>
            <Button onClick={handleSubmitGR} disabled={grLoading || !grItems.length}
              className="bg-blue-600 hover:bg-blue-700">
              {grLoading ? <><RotateCcw className="h-3 w-3 mr-2 animate-spin" />Menyimpan...</>
                : <><PackageCheck className="h-4 w-4 mr-2" />Konfirmasi Penerimaan</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
