"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createStockTransferOrder } from "@/lib/actions/inventory";



type LocationOption = { id: number; location_name: string; location_code: string };

type ProductRow = {
  productId: string; // user input
  qtyRequested: number;
};

export function TransferStockPanel({
  locations,
  defaultFromLocationId,
}: {
  locations: LocationOption[];
  defaultFromLocationId?: number;
}) {
  const [fromLocationId, setFromLocationId] = useState<string>(
    String(defaultFromLocationId ?? locations[0]?.id ?? "")
  );
  const [toLocationId, setToLocationId] = useState<string>(
    String(locations[1]?.id ?? locations[0]?.id ?? "")
  );


  const [notes, setNotes] = useState<string>("");

  const [rows, setRows] = useState<ProductRow[]>([
    { productId: "", qtyRequested: 1 },
  ]);

  const canSubmit = useMemo(() => {
    const f = Number(fromLocationId);
    const t = Number(toLocationId);
    if (!Number.isFinite(f) || !Number.isFinite(t) || f <= 0 || t <= 0) return false;
    if (f === t) return false;
    if (!rows.some((r) => r.productId.trim().length > 0 && r.qtyRequested > 0)) return false;
    return true;
  }, [fromLocationId, toLocationId, rows]);

  async function handleCreate() {
    try {
      if (!canSubmit) return;

      const items = rows
        .filter((r) => r.productId.trim() && r.qtyRequested > 0)
        .map((r) => ({
          productId: BigInt(r.productId),
          qtyRequested: r.qtyRequested,
        }));

      await createStockTransferOrder(
        BigInt(fromLocationId),
        BigInt(toLocationId),
        items,
        notes || undefined
      );

      toast.success("Stock transfer created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat transfer");
    }
  }

  async function handleApprove() {
    // NOTE: panel ini belum menampilkan list transfer.
    // untuk MVP: input transferId manual.
    toast.info("Approvement requires transfer id (use action later)");
  }

  async function handleReceive() {
    toast.info("Receive requires transfer id (use action later)");
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-lg">Stock Transfer (MVP)</h3>
          <p className="text-sm text-muted-foreground">Buat transfer order antar lokasi. Approve/receive disusulkan via list.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="font-semibold text-sm">Dari Lokasi</Label>
          <select
            className="w-full h-12 border rounded-xl px-3 bg-background text-base"
            value={fromLocationId}
            onChange={(e) => setFromLocationId(e.target.value)}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.location_name} ({l.location_code})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label className="font-semibold text-sm">Ke Lokasi</Label>
          <select
            className="w-full h-12 border rounded-xl px-3 bg-background text-base"
            value={toLocationId}
            onChange={(e) => setToLocationId(e.target.value)}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.location_name} ({l.location_code})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="font-semibold text-sm">Catatan (opsional)</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan transfer" className="h-12 text-base" />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="font-bold text-base">Item Transfer</Label>
          <Button
            variant="outline"
            type="button"
            className="h-11 px-4 text-sm font-semibold border-blue-200 text-blue-600 hover:bg-blue-50"
            onClick={() => setRows((prev) => [...prev, { productId: "", qtyRequested: 1 }])}
          >
            + Tambah Item
          </Button>
        </div>

        <div className="space-y-3">
          {rows.map((r, idx) => (
            <div key={idx} className="bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl space-y-3 md:space-y-0 md:p-0 md:bg-transparent md:border-0 md:grid md:grid-cols-3 md:gap-3 md:items-end">
              <div className="space-y-1">
                <Label className="font-semibold text-xs md:text-sm">ID Produk</Label>
                <Input
                  value={r.productId}
                  onChange={(e) =>
                    setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, productId: e.target.value } : x)))
                  }
                  placeholder="cth: 123"
                  className="h-12 text-base font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="font-semibold text-xs md:text-sm">Jumlah (Qty)</Label>
                <Input
                  type="number"
                  value={r.qtyRequested}
                  onChange={(e) =>
                    setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, qtyRequested: Number(e.target.value) } : x)))
                  }
                  className="h-12 text-base"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  type="button"
                  className="w-full h-12 font-semibold"
                  disabled={rows.length <= 1}
                  onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                >
                  Hapus Item
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Button type="button" onClick={handleCreate} disabled={!canSubmit} className="w-full h-12 text-base font-semibold">
          Kirim Transfer Order
        </Button>
      </div>
    </Card>
  );
}

