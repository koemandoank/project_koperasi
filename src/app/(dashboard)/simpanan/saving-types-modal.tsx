"use client";

import { useState, useEffect } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

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

  const renderForm = (isEdit: boolean, formId: string) => (
    <DrawerBody>
      <div className="space-y-4">
        {!isEdit && (
          <div className="space-y-1">
            <Label className="font-semibold text-sm">Kode Singkat <span className="text-red-500">*</span></Label>
            <Input
              value={form.code}
              onChange={(e) => setField("code", e.target.value.toUpperCase())}
              placeholder="Contoh: SW, SP, SD"
              maxLength={10}
              className="h-12 font-mono uppercase text-base"
            />
            <p className="text-xs text-slate-400">Kode unik, maks 10 karakter, tidak bisa diubah setelah dibuat.</p>
          </div>
        )}

        <div className="space-y-1">
          <Label className="font-semibold text-sm">Nama Jenis Simpanan <span className="text-red-500">*</span></Label>
          <Input
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder="Contoh: Simpanan Wajib Bulanan"
            className="h-12 text-base"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="font-semibold text-sm">Min. Saldo (Rp)</Label>
            <Input type="number" value={form.min_amount} onChange={(e) => setField("min_amount", e.target.value)} min={0} className="h-12" />
          </div>
          <div className="space-y-1">
            <Label className="font-semibold text-sm">Setoran Bulanan (Rp)</Label>
            <Input type="number" value={form.monthly_amount} onChange={(e) => setField("monthly_amount", e.target.value)} min={0} disabled={!form.is_mandatory} className="h-12" />
            {!form.is_mandatory && <p className="text-xs text-amber-600">Simpanan sukarela tidak wajib.</p>}
          </div>
        </div>

        <div className="flex flex-col gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Wajib (Mandatory)</p>
              <p className="text-xs text-slate-400">Anggota wajib menyetor rutin.</p>
            </div>
            <Switch checked={form.is_mandatory} onCheckedChange={(v) => setField("is_mandatory", v)} />
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            <div>
              <p className="text-sm font-semibold">Bisa Ditarik</p>
              <p className="text-xs text-slate-400">Anggota bisa menarik simpanan ini.</p>
            </div>
            <Switch checked={form.is_withdrawable} onCheckedChange={(v) => setField("is_withdrawable", v)} />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="font-semibold text-sm">Keterangan (Opsional)</Label>
          <Input value={form.description} onChange={(e) => setField("description", e.target.value)} placeholder="Contoh: Simpanan pokok keanggotaan" className="h-12 text-base" />
        </div>
      </div>
    </DrawerBody>
  );

  return (
    <>
      {/* Trigger Button */}
      <Button variant="outline" className="h-12 gap-2" onClick={() => setOpen(true)}>
        <Settings className="h-4 w-4" />
        Pengaturan Simpanan
      </Button>

      {/* ── Main Drawer — Saving Types List ── */}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent showClose>
          <DrawerHeader>
            <DrawerTitle>Pengaturan Jenis Simpanan</DrawerTitle>
          </DrawerHeader>

          <DrawerBody>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-slate-400">Atur nominal dan ketentuan tiap jenis simpanan.</p>
              <Button size="sm" className="h-10 gap-2" onClick={openAdd}>
                <Plus className="h-4 w-4" /> Tambah Baru
              </Button>
            </div>

            {/* Card list replacing table */}
            <div className="space-y-3">
              {types.map((t) => (
                <div
                  key={t.id}
                  className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-3 ${
                    !t.is_active ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-blue-700 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded text-sm">{t.code}</span>
                        <Badge variant={t.is_mandatory ? "default" : "secondary"} className="text-xs">{t.is_mandatory ? "Wajib" : "Sukarela"}</Badge>
                        {t.is_withdrawable && <Badge variant="outline" className="text-xs text-blue-600">Bisa Tarik</Badge>}
                      </div>
                      <p className="font-semibold text-base">{t.name}</p>
                      {t.description && <p className="text-xs text-slate-400 mt-0.5">{t.description}</p>}
                    </div>
                    <Switch checked={t.is_active} onCheckedChange={() => handleToggle(t.id, t.is_active)} aria-label={`Toggle ${t.name}`} />
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-slate-400">Anggota</p>
                      <p className="font-semibold flex items-center gap-1"><Users className="h-3 w-3 text-slate-300" />{t.member_count}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Min. Saldo</p>
                      <p className="font-semibold">{formatRp(t.min_amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Setoran/Bulan</p>
                      <p className={`font-semibold ${t.is_mandatory ? "text-emerald-700" : "text-slate-400 italic text-xs"}`}>
                        {t.is_mandatory ? formatRp(t.monthly_amount) : "Sukarela"}
                      </p>
                    </div>
                  </div>

                  <Button size="sm" variant="ghost" className="w-full h-10 gap-2" onClick={() => openEdit(t)}>
                    <Edit className="h-3.5 w-3.5" /> Edit Jenis Simpanan
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl mt-4">
              <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                Jenis simpanan <strong>Sukarela</strong> tidak memiliki setoran bulanan wajib.
              </p>
            </div>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* ── Edit Drawer ── */}
      <Drawer open={editOpen} onOpenChange={setEditOpen}>
        <DrawerContent showClose>
          <DrawerHeader>
            <DrawerTitle>Edit — <span className="font-mono text-blue-600">{editTarget?.code}</span></DrawerTitle>
          </DrawerHeader>
          {renderForm(true, "edit-form")}
          <DrawerFooter>
            <Button className="w-full h-12" onClick={() => handleSave(true)} disabled={saving || !form.name.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
            <Button variant="ghost" className="w-full h-12" onClick={() => setEditOpen(false)}>Batal</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* ── Add New Drawer ── */}
      <Drawer open={addOpen} onOpenChange={setAddOpen}>
        <DrawerContent showClose>
          <DrawerHeader>
            <DrawerTitle>Tambah Jenis Simpanan Baru</DrawerTitle>
          </DrawerHeader>
          {renderForm(false, "add-form")}
          <DrawerFooter>
            <Button className="w-full h-12" onClick={() => handleSave(false)} disabled={saving || !form.name.trim() || !form.code.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {saving ? "Menyimpan..." : "Tambah Jenis Simpanan"}
            </Button>
            <Button variant="ghost" className="w-full h-12" onClick={() => setAddOpen(false)}>Batal</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
