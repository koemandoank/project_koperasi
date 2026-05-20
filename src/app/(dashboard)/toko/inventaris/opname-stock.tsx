"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createStockOpname, recordOpnameDetail, approveStockOpname } from "@/lib/actions/inventory";


type LocationOption = { id: number; location_name: string; location_code: string };

type OpnameProductRow = {
  productId: string;
  qtySystem: number;
  qtyPhysical: number;
  notes: string;
};

export function OpnameStockPanel({ locations }: { locations: LocationOption[] }) {
  const [locationId, setLocationId] = useState<string>(String(locations[0]?.id ?? ""));

  const [opnameDate, setOpnameDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState<string>("");

  const [rows, setRows] = useState<OpnameProductRow[]>([
    { productId: "", qtySystem: 0, qtyPhysical: 0, notes: "" },
  ]);

  const canCreate = useMemo(() => {
    const lid = Number(locationId);
    if (!Number.isFinite(lid) || lid <= 0) return false;
    const any = rows.some((r) => r.productId.trim() && r.qtyPhysical >= 0 && r.qtySystem >= 0);
    return any;
  }, [locationId, rows]);

  async function handleCreateDraftAndRecord() {
    if (!canCreate) return;

    try {
      const lid = BigInt(locationId);
      const date = new Date(opnameDate);

      const created = await createStockOpname(date, lid, notes || undefined);
      if (!created?.success || !created?.data) throw new Error(created?.error ?? "Gagal create opname");

      const opnameId = created.data.id as bigint;

      for (const r of rows) {
        if (!r.productId.trim()) continue;
        await recordOpnameDetail(
          opnameId,
          BigInt(r.productId),
          Number(r.qtySystem),
          Number(r.qtyPhysical),
          r.notes || undefined
        );
      }

      toast.success("Stock opname draft created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat opname");
    }
  }

  async function handleApproveManual(opnameId: string) {
    try {
      const id = BigInt(opnameId);
      await approveStockOpname(id);
      toast.success("Stock opname approved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal approve");
    }
  }

  const [approveId, setApproveId] = useState<string>("");

  return (
    <Card className="p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-lg">Stock Opname (MVP)</h3>
        <p className="text-sm text-muted-foreground">Create opname draft + record detail. Approve via manual opnameId.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="font-semibold text-sm">Lokasi</Label>
          <select
            className="w-full h-12 border rounded-xl px-3 bg-background text-base"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.location_name} ({l.location_code})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label className="font-semibold text-sm">Tanggal Opname</Label>
          <Input type="date" value={opnameDate} onChange={(e) => setOpnameDate(e.target.value)} className="h-12 text-base" />
        </div>

        <div className="space-y-1">
          <Label className="font-semibold text-sm">Catatan (opsional)</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Tulis catatan di sini..." className="h-12 text-base" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="font-bold text-base">Daftar Item Barang</Label>
          <Button
            variant="outline"
            type="button"
            className="h-11 px-4 text-sm font-semibold border-blue-200 text-blue-600 hover:bg-blue-50"
            onClick={() =>
              setRows((prev) => [
                ...prev,
                { productId: "", qtySystem: 0, qtyPhysical: 0, notes: "" },
              ])
            }
          >
            + Tambah Item
          </Button>
        </div>

        <div className="space-y-4">
          {rows.map((r, idx) => (
            <div key={idx} className="bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl space-y-3 md:space-y-0 md:p-0 md:bg-transparent md:border-0 md:grid md:grid-cols-4 md:gap-3 md:items-end">
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
                <Label className="font-semibold text-xs md:text-sm">Stok Sistem</Label>
                <Input
                  type="number"
                  value={r.qtySystem}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, qtySystem: Number(e.target.value) } : x))
                    )
                  }
                  className="h-12 text-base"
                />
              </div>
              <div className="space-y-1">
                <Label className="font-semibold text-xs md:text-sm">Stok Fisik</Label>
                <Input
                  type="number"
                  value={r.qtyPhysical}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, qtyPhysical: Number(e.target.value) } : x))
                    )
                  }
                  className="h-12 text-base"
                />
              </div>
              <div className="space-y-1">
                <Label className="font-semibold text-xs md:text-sm">Keterangan / Selisih</Label>
                <div className="flex gap-2">
                  <Input
                    value={r.notes}
                    onChange={(e) =>
                      setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, notes: e.target.value } : x)))
                    }
                    placeholder="opsional"
                    className="h-12 text-base flex-1"
                  />
                  <Button
                    variant="destructive"
                    type="button"
                    className="h-12 px-4 shrink-0 font-semibold"
                    disabled={rows.length <= 1}
                    onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" onClick={handleCreateDraftAndRecord} disabled={!canCreate} className="w-full h-12 text-base font-semibold">
          Buat Draft Opname + Catat Item
        </Button>
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Approve (Manual opnameId)</h4>
        <div className="flex gap-2 mt-2">
          <Input value={approveId} onChange={(e) => setApproveId(e.target.value)} placeholder="Masukkan ID Opname..." className="h-12 text-base" />
          <Button type="button" disabled={!approveId.trim()} onClick={() => handleApproveManual(approveId)} className="h-12 px-6 font-semibold shrink-0">
            Setujui
          </Button>
        </div>
      </div>
    </Card>
  );
}

