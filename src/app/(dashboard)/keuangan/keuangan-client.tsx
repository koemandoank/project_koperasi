"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingDown, TrendingUp, AlertTriangle, Plus, DollarSign } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { recordAPPayment, recordARPayment } from "@/lib/actions/accounts";

type AP = { id: number; invoice_no: string; supplier_name: string; invoice_date: string; due_date: string; total_amount: number; amount_paid: number; amount_due: number; status: string };
type AR = { id: number; invoice_no: string; customer_name: string; invoice_date: string; due_date: string; total_amount: number; amount_paid: number; amount_due: number; status: string };

const STATUS_COLOR: Record<string, string> = {
  open:      "bg-blue-100 text-blue-700",
  partial:   "bg-yellow-100 text-yellow-700",
  paid:      "bg-green-100 text-green-700",
  overdue:   "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-500",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Belum Bayar", partial: "Sebagian", paid: "Lunas", overdue: "Jatuh Tempo", cancelled: "Dibatalkan",
};

const formatRp = (val: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);

const getDaysLeft = (dueDateStr: string) => {
  const diff = Math.floor((new Date(dueDateStr).getTime() - Date.now()) / 86400000);
  return diff;
};

export function KeuanganClient({
  accountsPayable: initialAPs,
  accountsReceivable: initialARs,
  suppliers,
  apAging,
}: {
  accountsPayable: AP[];
  accountsReceivable: AR[];
  suppliers: { id: number; name: string }[];
  apAging: { current: number; overdue: number };
}) {
  const [aps, setAps] = useState(initialAPs);
  const [ars, setArs] = useState(initialARs);
  const [loading, setLoading] = useState(false);

  // Payment dialog AP
  const [apPayDialog, setApPayDialog] = useState<AP | null>(null);
  const [apPayAmount, setApPayAmount] = useState("");
  const [apPayMethod, setApPayMethod] = useState<"cash" | "transfer">("transfer");

  // Payment dialog AR
  const [arPayDialog, setArPayDialog] = useState<AR | null>(null);
  const [arPayAmount, setArPayAmount] = useState("");
  const [arPayMethod, setArPayMethod] = useState<"cash" | "transfer">("transfer");

  const totalAP = aps.filter((a: any) => a.status !== "paid").reduce((s: any, a: any) => s + a.amount_due, 0);
  const totalAR = ars.filter((a: any) => a.status !== "paid").reduce((s: any, a: any) => s + a.amount_due, 0);
  const overdueAPs = aps.filter((a: any) => getDaysLeft(a.due_date) < 0 && a.status !== "paid").length;

  const handlePayAP = async () => {
    if (!apPayDialog) return;
    const amount = parseFloat(apPayAmount);
    if (!amount || amount <= 0) return toast.error("Nominal pembayaran tidak valid.");
    setLoading(true);
    try {
      const notes = `Dibayar via ${apPayMethod === 'cash' ? 'Cash/Tunai' : 'Transfer Bank'}`;
      const res = await recordAPPayment(BigInt(apPayDialog.id), amount, new Date(), notes);
      if (res.success) {
        toast.success(`Pembayaran AP berhasil dicatat via ${apPayMethod.toUpperCase()}.`);
        setApPayDialog(null);
        setAps((prev) => prev.map((a: any) => a.id === apPayDialog.id ? {
          ...a, amount_paid: a.amount_paid + amount, amount_due: Math.max(0, a.amount_due - amount),
          status: a.amount_due - amount <= 0 ? "paid" : "partial",
        } : a));
      } else { toast.error((res as any).error ?? "Gagal."); }
    } finally { setLoading(false); }
  };

  const handlePayAR = async () => {
    if (!arPayDialog) return;
    const amount = parseFloat(arPayAmount);
    if (!amount || amount <= 0) return toast.error("Nominal pembayaran tidak valid.");
    setLoading(true);
    try {
      const notes = `Diterima via ${arPayMethod === 'cash' ? 'Cash/Tunai' : 'Transfer Bank'}`;
      const res = await recordARPayment(BigInt(arPayDialog.id), amount, new Date(), notes);
      if (res.success) {
        toast.success(`Pembayaran AR berhasil dicatat via ${arPayMethod.toUpperCase()}.`);
        setArPayDialog(null);
        setArs((prev) => prev.map((a: any) => a.id === arPayDialog.id ? {
          ...a, amount_paid: a.amount_paid + amount, amount_due: Math.max(0, a.amount_due - amount),
          status: a.amount_due - amount <= 0 ? "paid" : "partial",
        } : a));
      } else { toast.error((res as any).error ?? "Gagal."); }
    } finally { setLoading(false); }
  };

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-red-100">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg"><TrendingDown className="h-5 w-5 text-red-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Total Hutang Dagang (AP)</p>
              <p className="text-lg font-bold text-red-600">{formatRp(totalAP)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-100">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg"><TrendingUp className="h-5 w-5 text-green-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Total Piutang Dagang (AR)</p>
              <p className="text-lg font-bold text-green-600">{formatRp(totalAR)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={overdueAPs > 0 ? "border-red-200 bg-red-50/30" : "border-slate-100"}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${overdueAPs > 0 ? "bg-red-100" : "bg-slate-100"}`}>
              <AlertTriangle className={`h-5 w-5 ${overdueAPs > 0 ? "text-red-600" : "text-slate-400"}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">AP Jatuh Tempo</p>
              <p className={`text-2xl font-bold ${overdueAPs > 0 ? "text-red-600" : ""}`}>{overdueAPs}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="ap">
        <TabsList>
          <TabsTrigger value="ap"><TrendingDown className="h-4 w-4 mr-2 text-red-500" />Hutang Dagang (AP)</TabsTrigger>
          <TabsTrigger value="ar"><TrendingUp className="h-4 w-4 mr-2 text-green-500" />Piutang Dagang (AR)</TabsTrigger>
        </TabsList>

        {/* AP Tab */}
        <TabsContent value="ap">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Daftar Hutang Dagang</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Invoice</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Tgl Invoice</TableHead>
                    <TableHead>Jatuh Tempo</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Sisa</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aps.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Belum ada hutang dagang.</TableCell></TableRow>
                  )}
                  {aps.map((ap: any) => {
                    const daysLeft = getDaysLeft(ap.due_date);
                    return (
                      <TableRow key={ap.id} className={daysLeft < 0 && ap.status !== "paid" ? "bg-red-50/30" : ""}>
                        <TableCell className="font-mono text-sm">{ap.invoice_no}</TableCell>
                        <TableCell className="font-medium">{ap.supplier_name}</TableCell>
                        <TableCell className="text-sm">{ap.invoice_date}</TableCell>
                        <TableCell className="text-sm">
                          <span className={daysLeft < 0 && ap.status !== "paid" ? "text-red-600 font-semibold" : ""}>
                            {ap.due_date}
                            {daysLeft < 0 && ap.status !== "paid" && ` (${Math.abs(daysLeft)}h terlambat)`}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{formatRp(ap.total_amount)}</TableCell>
                        <TableCell className="text-right font-semibold text-red-600">{formatRp(ap.amount_due)}</TableCell>
                        <TableCell className="text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[ap.status] ?? "bg-slate-100"}`}>
                            {STATUS_LABEL[ap.status] ?? ap.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {ap.status !== "paid" && (
                            <Button size="sm" variant="outline" className="text-blue-600 border-blue-200"
                              onClick={() => { setApPayDialog(ap); setApPayAmount(String(ap.amount_due)); }}>
                              <DollarSign className="h-3 w-3 mr-1" /> Bayar
                            </Button>
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

        {/* AR Tab */}
        <TabsContent value="ar">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Daftar Piutang Dagang</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Invoice</TableHead>
                    <TableHead>Pelanggan</TableHead>
                    <TableHead>Tgl Invoice</TableHead>
                    <TableHead>Jatuh Tempo</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Sisa</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ars.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Belum ada piutang dagang.</TableCell></TableRow>
                  )}
                  {ars.map((ar: any) => {
                    const daysLeft = getDaysLeft(ar.due_date);
                    return (
                      <TableRow key={ar.id} className={daysLeft < 0 && ar.status !== "paid" ? "bg-yellow-50/30" : ""}>
                        <TableCell className="font-mono text-sm">{ar.invoice_no}</TableCell>
                        <TableCell className="font-medium">{ar.customer_name}</TableCell>
                        <TableCell className="text-sm">{ar.invoice_date}</TableCell>
                        <TableCell className="text-sm">
                          <span className={daysLeft < 0 && ar.status !== "paid" ? "text-orange-600 font-semibold" : ""}>
                            {ar.due_date}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{formatRp(ar.total_amount)}</TableCell>
                        <TableCell className="text-right font-semibold text-green-700">{formatRp(ar.amount_due)}</TableCell>
                        <TableCell className="text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[ar.status] ?? "bg-slate-100"}`}>
                            {STATUS_LABEL[ar.status] ?? ar.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {ar.status !== "paid" && (
                            <Button size="sm" variant="outline" className="text-green-600 border-green-200"
                              onClick={() => { setArPayDialog(ar); setArPayAmount(String(ar.amount_due)); }}>
                              <DollarSign className="h-3 w-3 mr-1" /> Terima
                            </Button>
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
      </Tabs>

      {/* Pay AP Dialog */}
      <Dialog open={!!apPayDialog} onOpenChange={(o) => !o && setApPayDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Bayar Hutang Dagang</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Invoice: <span className="font-mono font-semibold">{apPayDialog?.invoice_no}</span> — {apPayDialog?.supplier_name}
            </p>
            <p className="text-sm">Sisa Tagihan: <span className="font-bold text-red-600">{formatRp(apPayDialog?.amount_due ?? 0)}</span></p>
            <div className="space-y-1">
              <Label>Metode Pembayaran</Label>
              <Select value={apPayMethod} onValueChange={(val: any) => setApPayMethod(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Metode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transfer">Transfer Bank</SelectItem>
                  <SelectItem value="cash">Cash / Tunai</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Nominal Pembayaran (Rp)</Label>
              <Input type="number" value={apPayAmount} onChange={(e) => setApPayAmount(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApPayDialog(null)}>Batal</Button>
            <Button onClick={handlePayAP} disabled={loading}>{loading ? "Memproses..." : "Konfirmasi Bayar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay AR Dialog */}
      <Dialog open={!!arPayDialog} onOpenChange={(o) => !o && setArPayDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Terima Pembayaran Piutang</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Invoice: <span className="font-mono font-semibold">{arPayDialog?.invoice_no}</span> — {arPayDialog?.customer_name}
            </p>
            <p className="text-sm">Sisa Piutang: <span className="font-bold text-green-600">{formatRp(arPayDialog?.amount_due ?? 0)}</span></p>
            <div className="space-y-1">
              <Label>Metode Pembayaran</Label>
              <Select value={arPayMethod} onValueChange={(val: any) => setArPayMethod(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Metode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transfer">Transfer Bank</SelectItem>
                  <SelectItem value="cash">Cash / Tunai</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Nominal Diterima (Rp)</Label>
              <Input type="number" value={arPayAmount} onChange={(e) => setArPayAmount(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArPayDialog(null)}>Batal</Button>
            <Button onClick={handlePayAR} disabled={loading} className="bg-green-600 hover:bg-green-700">
              {loading ? "Memproses..." : "Konfirmasi Terima"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
