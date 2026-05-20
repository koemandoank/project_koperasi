"use client";

import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Box, MapPin, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type AnyRecord = Record<string, any>;

export default function InventarisClient() {
  const [loading, startTransition] = useTransition();
  const [readModel, setReadModel] = useState<AnyRecord | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);

  const fetchData = () => {
    startTransition(async () => {
      const mod = await import("@/lib/actions/inventory-ui");
      const res = await mod.getInventarisReadModels();
      if (res?.success) setReadModel(res.data);
      else setReadModel(null);
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatRp = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <RotateCcw className="h-4 w-4 animate-spin" />
        Memuat data inventaris...
      </div>
    );
  }

  if (!readModel) {
    return (
      <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-xl">
        Data inventaris belum tersedia. Pastikan ada warehouse location yang aktif.
      </div>
    );
  }

  const { locations, reorderPoints, balances } = readModel;

  // Filter balances by selected location
  const filteredBalances = selectedLocation
    ? (balances ?? []).filter((b: any) => b.location_id === selectedLocation)
    : (balances ?? []);

  // Reorder alerts: reorder points where product stock <= reorder_point
  const alerts = (reorderPoints ?? []).filter((r: any) => {
    const productStock = r.product?.stock ?? 0;
    return productStock <= (r.reorder_point ?? 0);
  });

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-blue-100">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <MapPin className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Lokasi</p>
              <p className="text-2xl font-bold">{locations?.length ?? 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-100">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Box className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Record Stok</p>
              <p className="text-2xl font-bold">{balances?.length ?? 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className={alerts.length > 0 ? "border-red-200 bg-red-50/50" : "border-slate-100"}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${alerts.length > 0 ? "bg-red-100" : "bg-slate-100"}`}>
              <AlertTriangle className={`h-5 w-5 ${alerts.length > 0 ? "text-red-600" : "text-slate-400"}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reorder Alerts</p>
              <p className={`text-2xl font-bold ${alerts.length > 0 ? "text-red-600" : ""}`}>{alerts.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reorder Alerts */}
      {alerts.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="pb-3 px-4 md:px-6">
            <CardTitle className="text-base text-red-700 flex items-center gap-2 font-bold">
              <AlertTriangle className="h-4 w-4" />
              Peringatan Stok Menipis ({alerts.length} barang)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Barang</TableHead>
                    <TableHead className="text-center">Stok Sistem</TableHead>
                    <TableHead className="text-center">Reorder Point</TableHead>
                    <TableHead className="text-center">Reorder Qty</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map((r: any) => (
                    <TableRow key={r.id} className="bg-red-50/30">
                      <TableCell className="font-medium">{r.product?.name ?? "-"}</TableCell>
                      <TableCell className="text-center font-bold text-red-600">{r.product?.stock ?? 0}</TableCell>
                      <TableCell className="text-center">{r.reorder_point}</TableCell>
                      <TableCell className="text-center">{r.reorder_qty}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="destructive">Segera Pesan</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card Feed View */}
            <div className="block md:hidden divide-y divide-red-100/50">
              {alerts.map((r: any) => (
                <div key={r.id} className="p-4 space-y-3 bg-red-50/10">
                  <div className="flex justify-between items-start gap-2">
                    <p className="font-bold text-sm text-red-950">{r.product?.name ?? "-"}</p>
                    <Badge variant="destructive" className="text-[10px] shrink-0 font-semibold">Segera Pesan</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-white dark:bg-slate-900 border border-red-100 rounded-xl p-2">
                      <p className="text-slate-400 text-[10px]">Stok</p>
                      <p className="font-extrabold text-red-650 text-sm">{r.product?.stock ?? 0}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 border border-red-15/10 rounded-xl p-2">
                      <p className="text-slate-400 text-[10px]">Min (RP)</p>
                      <p className="font-semibold text-slate-700 dark:text-slate-350">{r.reorder_point}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 border border-red-15/10 rounded-xl p-2">
                      <p className="text-slate-400 text-[10px]">Pesan Qty</p>
                      <p className="font-semibold text-slate-700 dark:text-slate-355">{r.reorder_qty}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stock Balances Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base">Saldo Stok per Lokasi</CardTitle>
            <div className="flex items-center gap-2">
              <select
                className="border rounded-md p-1.5 text-sm bg-background"
                value={selectedLocation ?? ""}
                onChange={(e) => setSelectedLocation(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Semua Lokasi</option>
                {(locations ?? []).map((l: any) => (
                  <option key={l.id} value={l.id}>
                    {l.location_name} ({l.location_code})
                  </option>
                ))}
              </select>
              <Button variant="outline" size="sm" onClick={fetchData}>
                <RotateCcw className="h-3 w-3 mr-1" /> Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredBalances.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              Belum ada data saldo stok untuk lokasi ini.
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Barang</TableHead>
                      <TableHead>Lokasi</TableHead>
                      <TableHead className="text-center">On Hand</TableHead>
                      <TableHead className="text-center">Reserved</TableHead>
                      <TableHead className="text-center">Available</TableHead>
                      <TableHead className="text-right">Nilai HPP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBalances.map((b: any) => {
                      const isLow = b.qty_on_hand <= (b.products?.min_stock ?? 0);
                      return (
                        <TableRow key={b.id} className={isLow ? "bg-yellow-50/30" : ""}>
                          <TableCell className="font-medium">{b.products?.name ?? "-"}</TableCell>
                          <TableCell className="text-xs text-slate-400">
                            {b.warehouse_locations?.location_name ?? "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={isLow ? "text-orange-600 font-semibold" : ""}>{b.qty_on_hand ?? 0}</span>
                          </TableCell>
                          <TableCell className="text-center text-slate-400">{b.qty_reserved ?? 0}</TableCell>
                          <TableCell className="text-center font-semibold">
                            {(b.qty_on_hand ?? 0) - (b.qty_reserved ?? 0)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {b.products?.purchase_price ? formatRp(Number(b.products.purchase_price) * (b.qty_on_hand ?? 0)) : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card Feed View */}
              <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {filteredBalances.map((b: any) => {
                  const isLow = b.qty_on_hand <= (b.products?.min_stock ?? 0);
                  const available = (b.qty_on_hand ?? 0) - (b.qty_reserved ?? 0);
                  return (
                    <div key={b.id} className={`p-4 space-y-3 ${isLow ? "bg-amber-50/20" : ""}`}>
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="font-bold text-base text-slate-900 dark:text-slate-50">{b.products?.name ?? "-"}</p>
                          <p className="text-xs text-slate-400 mt-0.5">Lokasi: {b.warehouse_locations?.location_name ?? "-"}</p>
                        </div>
                        {isLow && <Badge className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/50 text-[10px] font-semibold shrink-0">Stok Menipis</Badge>}
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl p-2">
                          <p className="text-slate-400 text-[10px]">On Hand</p>
                          <p className="font-bold text-slate-800 dark:text-slate-200">{b.qty_on_hand ?? 0}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl p-2">
                          <p className="text-slate-400 text-[10px]">Dipesan</p>
                          <p className="font-bold text-slate-400">{b.qty_reserved ?? 0}</p>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/30 rounded-xl p-2">
                          <p className="text-slate-400 text-[10px]">Tersedia</p>
                          <p className="font-extrabold text-blue-600 dark:text-blue-450">{available}</p>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs border-t border-slate-50 dark:border-slate-800/30 pt-2.5">
                        <span className="text-slate-400">Total Estimasi HPP</span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-200">
                          {b.products?.purchase_price ? formatRp(Number(b.products.purchase_price) * (b.qty_on_hand ?? 0)) : "-"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
