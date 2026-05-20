"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Settings, Plus, Edit, Loader2, Users, Info } from "lucide-react";
import { toast } from "sonner";
import { createSavingType, updateSavingType, toggleSavingTypeStatus, type SavingTypeData } from "@/lib/actions/saving-types";
import { useRouter } from "next/navigation";

const formatRp = (v: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(v);

type FormState = {
  code: string;
  name: string;
  is_mandatory: boolean;
  min_amount: string;
  monthly_amount: string;
  is_withdrawable: boolean;
  description: string;
};

const EMPTY_FORM: FormState = {
  code: "",
  name: "",
  is_mandatory: true,
  min_amount: "0",
  monthly_amount: "0",
  is_withdrawable: false,
  description: "",
};

/**
 * Modal untuk manajemen jenis simpanan (saving_types).
 * Hanya tampil di halaman admin/pengurus.
 * Simpanan Sukarela (is_mandatory=false) tidak memiliki jumlah bulanan wajib.
 */
export function SavingTypesModal({ initialTypes }: { initialTypes: SavingTypeData[] }) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SavingTypeData | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [types, setTypes] = useState<SavingTypeData[]>(initialTypes);
  const router = useRouter();

  // Sync types with server props after a router.refresh()
  useEffect(() => {
    setTypes(initialTypes);
  }, [initialTypes]);

  const setField = (k: keyof FormState, v: string | boolean) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const openEdit = (t: SavingTypeData) => {
    setEditTarget(t);
    setForm({
      code: t.code,
      name: t.name,
      is_mandatory: t.is_mandatory,
      min_amount: String(t.min_amount),
      monthly_amount: String(t.monthly_amount),
      is_withdrawable: t.is_withdrawable,
      description: t.description || "",
    });
    setEditOpen(true);
  };

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setAddOpen(true);
  };

  const handleSave = async (isEdit: boolean) => {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        is_mandatory: form.is_mandatory,
        min_amount: parseFloat(form.min_amount) || 0,
        monthly_amount: form.is_mandatory ? (parseFloat(form.monthly_amount) || 0) : 0,
        is_withdrawable: form.is_withdrawable,
        description: form.description,
      };

      const res = isEdit && editTarget
        ? await updateSavingType(editTarget.id, payload)
        : await createSavingType({ ...payload, code: form.code });

      if (res.success) {
        toast.success(isEdit ? "Jenis simpanan diperbarui!" : "Jenis simpanan baru berhasil ditambahkan!");
        setEditOpen(false);
        setAddOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || "Gagal menyimpan");
      }
    } catch {
      toast.error("Terjadi kesalahan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: number, currentActive: boolean) => {
    const optimistic = types.map((t) =>
      t.id === id ? { ...t, is_active: !currentActive } : t
    );
    setTypes(optimistic);
    const res = await toggleSavingTypeStatus(id, !currentActive);
    if (res.success) {
      toast.success(!currentActive ? "Jenis simpanan diaktifkan" : "Jenis simpanan dinonaktifkan");
      router.refresh();
    } else {
      setTypes(initialTypes); // rollback
      toast.error(res.error || "Gagal mengubah status");
    }
  };

  const renderForm = (isEdit: boolean) => (
    <div className="space-y-4 pt-2">
      {/* Kode — hanya bisa di-set saat tambah baru */}
      {!isEdit && (
        <div className="space-y-1">
          <Label>Kode Singkat <span className="text-red-500">*</span></Label>
          <Input
            value={form.code}
            onChange={(e) => setField("code", e.target.value.toUpperCase())}
            placeholder="Contoh: SW, SP, SD"
            maxLength={10}
            className="font-mono uppercase"
          />
          <p className="text-xs text-muted-foreground">Kode unik, maks 10 karakter, tidak bisa diubah setelah dibuat.</p>
        </div>
      )}

      <div className="space-y-1">
        <Label>Nama Jenis Simpanan <span className="text-red-500">*</span></Label>
        <Input
          value={form.name}
          onChange={(e) => setField("name", e.target.value)}
          placeholder="Contoh: Simpanan Wajib Bulanan"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Min. Saldo (Rp)</Label>
          <Input
            type="number"
            value={form.min_amount}
            onChange={(e) => setField("min_amount", e.target.value)}
            min={0}
          />
          <p className="text-xs text-muted-foreground">Saldo minimum rekening ini boleh dimiliki.</p>
        </div>
        <div className="space-y-1">
          <Label>Jumlah Setoran Wajib Bulanan (Rp)</Label>
          <Input
            type="number"
            value={form.monthly_amount}
            onChange={(e) => setField("monthly_amount", e.target.value)}
            min={0}
            disabled={!form.is_mandatory}
          />
          {!form.is_mandatory && (
            <p className="text-xs text-amber-600">Simpanan sukarela tidak memiliki jumlah wajib.</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 p-3 bg-slate-50 rounded-lg border">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-semibold">Wajib (Mandatory)</Label>
            <p className="text-xs text-muted-foreground">Anggota wajib memiliki dan menyetor rutin.</p>
          </div>
          <Switch
            checked={form.is_mandatory}
            onCheckedChange={(v) => setField("is_mandatory", v)}
          />
        </div>
        <div className="flex items-center justify-between border-t pt-3">
          <div>
            <Label className="text-sm font-semibold">Bisa Ditarik</Label>
            <p className="text-xs text-muted-foreground">Anggota diizinkan menarik simpanan ini.</p>
          </div>
          <Switch
            checked={form.is_withdrawable}
            onCheckedChange={(v) => setField("is_withdrawable", v)}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Keterangan (Opsional)</Label>
        <Input
          value={form.description}
          onChange={(e) => setField("description", e.target.value)}
          placeholder="Contoh: Simpanan pokok keanggotaan koperasi"
        />
      </div>

      <Button
        className="w-full gap-2"
        onClick={() => handleSave(isEdit)}
        disabled={saving || !form.name.trim() || (!isEdit && !form.code.trim())}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {saving ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Tambah Jenis Simpanan"}
      </Button>
    </div>
  );

  return (
    <>
      {/* Tombol Trigger */}
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <Settings className="h-4 w-4" />
        Pengaturan Simpanan
      </Button>

      {/* Modal Utama — Tabel Jenis Simpanan */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pengaturan Jenis Simpanan</DialogTitle>
          </DialogHeader>

          <div className="flex justify-between items-center py-2">
            <p className="text-sm text-muted-foreground">
              Atur nominal, ketentuan, dan status tiap jenis simpanan anggota.
            </p>
            <Button size="sm" className="gap-2" onClick={openAdd}>
              <Plus className="h-4 w-4" />
              Tambah Jenis Baru
            </Button>
          </div>

          <div className="border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama Jenis Simpanan</TableHead>
                  <TableHead className="text-right">Min. Saldo</TableHead>
                  <TableHead className="text-right">Setoran Bulanan</TableHead>
                  <TableHead className="text-center">Anggota</TableHead>
                  <TableHead className="text-center">Sifat</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map((t) => (
                  <TableRow key={t.id} className={!t.is_active ? "opacity-50" : ""}>
                    <TableCell>
                      <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-sm">
                        {t.code}
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{t.name}</p>
                      {t.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">{formatRp(t.min_amount)}</TableCell>
                    <TableCell className="text-right">
                      {t.is_mandatory ? (
                        <span className="font-semibold text-emerald-700">{formatRp(t.monthly_amount)}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Sukarela</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1 text-sm">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        {t.member_count}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Badge variant={t.is_mandatory ? "default" : "secondary"} className="text-xs">
                          {t.is_mandatory ? "Wajib" : "Sukarela"}
                        </Badge>
                        {t.is_withdrawable && (
                          <Badge variant="outline" className="text-xs text-blue-600 border-blue-200">
                            Bisa Tarik
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={t.is_active}
                        onCheckedChange={() => handleToggle(t.id, t.is_active)}
                        aria-label={`Toggle status ${t.name}`}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1"
                        onClick={() => openEdit(t)}
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mt-2">
            <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              Jenis simpanan <strong>Sukarela</strong> tidak memiliki setoran bulanan wajib. Perubahan jumlah setoran hanya berlaku untuk data anggota yang baru masuk setelah pengaturan disimpan.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sub-Modal Edit */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              Edit Jenis Simpanan —{" "}
              <span className="font-mono text-blue-700">{editTarget?.code}</span>
            </DialogTitle>
          </DialogHeader>
          {renderForm(true)}
        </DialogContent>
      </Dialog>

      {/* Sub-Modal Tambah Baru */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Tambah Jenis Simpanan Baru</DialogTitle>
          </DialogHeader>
          {renderForm(false)}
        </DialogContent>
      </Dialog>
    </>
  );
}
