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
        <div className="space-y-2">
          <Label>Location</Label>
          <select
            className="w-full border rounded-md p-2 bg-background"
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

        <div className="space-y-2">
          <Label>Opname Date</Label>
          <Input type="date" value={opnameDate} onChange={(e) => setOpnameDate(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Notes (optional)</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Items</Label>
          <Button
            variant="outline"
            type="button"
            onClick={() =>
              setRows((prev) => [
                ...prev,
                { productId: "", qtySystem: 0, qtyPhysical: 0, notes: "" },
              ])
            }
          >
            + Add
          </Button>
        </div>

        <div className="space-y-3">
          {rows.map((r, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="space-y-2">
                <Label>Product ID</Label>
                <Input
                  value={r.productId}
                  onChange={(e) =>
                    setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, productId: e.target.value } : x)))
                  }
                  placeholder="mis: 123"
                />
              </div>
              <div className="space-y-2">
                <Label>Qty System</Label>
                <Input
                  type="number"
                  value={r.qtySystem}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, qtySystem: Number(e.target.value) } : x))
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Qty Physical</Label>
                <Input
                  type="number"
                  value={r.qtyPhysical}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, qtyPhysical: Number(e.target.value) } : x))
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={r.notes}
                  onChange={(e) =>
                    setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, notes: e.target.value } : x)))
                  }
                  placeholder="opsional"
                />
                <Button
                  variant="destructive"
                  type="button"
                  disabled={rows.length <= 1}
                  onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" onClick={handleCreateDraftAndRecord} disabled={!canCreate}>
          Create Draft + Record
        </Button>
      </div>

      <div className="pt-2 border-t">
        <h4 className="font-semibold">Approve (Manual opnameId)</h4>
        <div className="flex items-center gap-2 mt-2">
          <Input value={approveId} onChange={(e) => setApproveId(e.target.value)} placeholder="opnameId" />
          <Button type="button" disabled={!approveId.trim()} onClick={() => handleApproveManual(approveId)}>
            Approve
          </Button>
        </div>
      </div>
    </Card>
  );
}

