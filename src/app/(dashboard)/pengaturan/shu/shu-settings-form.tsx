"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Save, Loader2, Info, ShieldAlert, CheckCircle2, XCircle } from "lucide-react";
import {
  type ShuConfig,
  type AlokasiFeksi,
  DEFAULT_SHU_CONFIG,
  validateShuConfig,
  SHU_CONFIG_ALLOWED_ROLES,
} from "@/lib/types/shu-config.types";

const formatRp = (v: number) => `${v.toFixed(1)}%`;

const ALOKASI_META: Record<string, { label: string; law: string; min?: number }> = {
  cadangan:          { label: "Dana Cadangan",              law: "Ps.45 ayat (2a)", min: 20 },
  jasa_anggota:      { label: "Total Jasa Anggota",         law: "Ps.45 ayat (2b)" },
  pengurus:          { label: "Honorarium Pengurus & Pengawas", law: "Ps.45 ayat (2c)" },
  ketua:             { label: "Honorarium Ketua Koperasi",  law: "Ps.45 ayat (2c-k)" },
  pegawai:           { label: "Tunjangan Karyawan/Pegawai", law: "Ps.45 ayat (2d)" },
  pendidikan:        { label: "Dana Pendidikan Koperasi",   law: "Ps.45 ayat (2e)" },
  sosial_pembangunan:{ label: "Dana Sosial & Pembangunan Daerah", law: "Ps.45 ayat (2f-g)" },
};

const PIE_COLORS = ["bg-blue-500", "bg-indigo-500", "bg-violet-500", "bg-purple-500", "bg-fuchsia-500", "bg-pink-500", "bg-amber-500"];

function TotalBar({ current, label }: { current: number; label: string }) {
  const valid = Math.abs(current - 100) < 0.01;
  return (
    <div className={`p-3 rounded-lg flex items-center justify-between font-bold text-sm border ${valid ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
      <span className="flex items-center gap-2">
        {valid ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        {label}
      </span>
      <span className="text-base">{formatRp(current)} {valid ? "✓" : "✗"}</span>
    </div>
  );
}

function PctInput({ value, onChange, min }: { value: number; onChange: (v: number) => void; min?: number }) {
  const isWarning = min !== undefined && value < min;
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number" step="0.5" min="0" max="100"
        className={`h-8 text-sm w-24 ${isWarning ? "border-red-400 focus:ring-red-400" : ""}`}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
      />
      <span className="text-sm font-semibold text-slate-500">%</span>
      {isWarning && <span className="text-xs text-red-600 font-medium">min {min}%</span>}
    </div>
  );
}

/**
 * Form konfigurasi parameter SHU — multi-tab (5 seksi A-E).
 * Hanya superadmin & ketua yang bisa save; role lain read-only.
 */
export function ShuConfigForm({
  initialConfig,
  userRole,
}: {
  initialConfig: ShuConfig;
  userRole: string;
}) {
  const [cfg, setCfg] = useState<ShuConfig>(initialConfig);
  const [isPending, startTransition] = useTransition();

  const canEdit = (SHU_CONFIG_ALLOWED_ROLES as readonly string[]).includes(userRole);

  const setAlokasi = (k: keyof AlokasiFeksi, v: number) =>
    setCfg(p => ({ ...p, alokasi: { ...p.alokasi, [k]: v } }));

  const totalAlokasi = Object.values(cfg.alokasi).reduce((a: any, b: any) => a + b, 0);
  const totalBobotJasa = cfg.jasa_anggota_bobot.modal + cfg.jasa_anggota_bobot.usaha;
  const totalBobotUnit = cfg.bobot_unit.simpan_pinjam + cfg.bobot_unit.toko;

  const validationError = validateShuConfig(cfg);
  const isAllValid = validationError === null;

  const handleSave = () => {
    if (!canEdit) return;
    if (!isAllValid) { toast.error(validationError!); return; }

    startTransition(async () => {
      try {
        const res = await fetch("/api/shu-config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cfg),
        });
        const json = await res.json() as { success?: boolean; error?: string };
        if (json.success) {
          toast.success("Konfigurasi SHU berhasil disimpan dan dicatat di audit log!");
        } else {
          toast.error(json.error || "Gagal menyimpan konfigurasi SHU.");
        }
      } catch {
        toast.error("Terjadi kesalahan jaringan. Coba lagi.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* RBAC Banner */}
      {!canEdit && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            Anda login sebagai <strong>{userRole}</strong>. Konfigurasi ini hanya bisa diubah oleh <strong>Superadmin</strong> atau <strong>Ketua Koperasi</strong>.
          </p>
        </div>
      )}

      {/* UU Reference */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold">Dasar Hukum: UU No. 25 Tahun 1992 Pasal 45</p>
          <p className="text-blue-600 mt-0.5">SHU setelah dikurangi dana cadangan dibagikan kepada anggota sebanding dengan jasa usaha masing-masing anggota dengan koperasi.</p>
        </div>
      </div>

      <Tabs defaultValue="alokasi">
        <TabsList className="grid grid-cols-2 md:grid-cols-6 h-auto gap-1 bg-slate-100 p-1">
          <TabsTrigger value="alokasi" className="text-xs py-2">A. Alokasi SHU</TabsTrigger>
          <TabsTrigger value="bobot_jasa" className="text-xs py-2">B. Bobot Jasa</TabsTrigger>
          <TabsTrigger value="bobot_unit" className="text-xs py-2">C. Bobot Unit</TabsTrigger>
          <TabsTrigger value="formula_modal" className="text-xs py-2">D. Formula Modal</TabsTrigger>
          <TabsTrigger value="formula_usaha" className="text-xs py-2">E. Formula Usaha</TabsTrigger>
          <TabsTrigger value="zakat_csr" className="text-xs py-2">F. Zakat & CSR</TabsTrigger>
        </TabsList>

        {/* ===== TAB A: ALOKASI SHU ===== */}
        <TabsContent value="alokasi">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">A. Alokasi Persentase SHU</CardTitle>
              <CardDescription>Total alokasi harus tepat 100%. Dana cadangan minimal 20% (wajib UU).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Progress bar */}
              <div className="overflow-hidden rounded-full h-4 flex border">
                {(Object.keys(cfg.alokasi) as (keyof AlokasiFeksi)[]).map((k, i) => (
                  <div key={k} className={`${PIE_COLORS[i]} transition-all duration-300`}
                    style={{ width: `${((cfg.alokasi as Record<string, number>)[k] / Math.max(totalAlokasi, 0.01)) * 100}%` }}
                    title={`${ALOKASI_META[k].label}: ${(cfg.alokasi as Record<string, number>)[k]}%`}
                  />
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(Object.keys(cfg.alokasi) as (keyof AlokasiFeksi)[]).map((k: any) => (
                  <div key={k} className="p-3 border rounded-lg bg-slate-50/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="font-semibold text-sm">{ALOKASI_META[k].label}</Label>
                      <Badge variant="outline" className="text-xs font-mono">{ALOKASI_META[k].law}</Badge>
                    </div>
                    <PctInput
                      value={(cfg.alokasi as Record<string, number>)[k]}
                      onChange={v => setAlokasi(k, v)}
                      min={ALOKASI_META[k].min}
                    />
                  </div>
                ))}
              </div>

              <TotalBar current={totalAlokasi} label="Total Alokasi SHU" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== TAB B: BOBOT JASA ANGGOTA ===== */}
        <TabsContent value="bobot_jasa">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">B. Pembobotan Alokasi Jasa Anggota</CardTitle>
              <CardDescription>
                Pecahan dari {formatRp(cfg.alokasi.jasa_anggota)} Total Jasa Anggota (Seksi A). Total harus 100%.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: "modal" as const, label: "Porsi Jasa Modal (Simpanan)", desc: "Dihitung berdasarkan saldo simpanan anggota" },
                { key: "usaha" as const, label: "Porsi Jasa Usaha (Transaksi)", desc: "Dihitung berdasarkan aktivitas transaksi anggota" },
              ].map(({ key, label, desc }) => (
                <div key={key} className="p-4 border rounded-lg space-y-2">
                  <Label className="font-semibold">{label}</Label>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                  <PctInput
                    value={cfg.jasa_anggota_bobot[key]}
                    onChange={v => setCfg(p => ({ ...p, jasa_anggota_bobot: { ...p.jasa_anggota_bobot, [key]: v } }))}
                  />
                  <p className="text-xs text-blue-700 font-medium">
                    ≈ {formatRp(cfg.alokasi.jasa_anggota * cfg.jasa_anggota_bobot[key] / 100)} dari total SHU
                  </p>
                </div>
              ))}
              <TotalBar current={totalBobotJasa} label="Total Bobot Jasa Anggota" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== TAB C: BOBOT UNIT ===== */}
        <TabsContent value="bobot_unit">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">C. Bobot Kontribusi Unit Bisnis</CardTitle>
              <CardDescription>Menentukan proporsi jasa usaha per unit. Total harus 100%.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: "simpan_pinjam" as const, label: "Unit Simpan Pinjam (USP)", desc: "Proporsi SHU dari kegiatan perkreditan anggota" },
                { key: "toko" as const, label: "Unit Toko/Waserda", desc: "Proporsi SHU dari kegiatan jual beli barang anggota" },
              ].map(({ key, label, desc }) => (
                <div key={key} className="p-4 border rounded-lg space-y-2">
                  <Label className="font-semibold">{label}</Label>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                  <PctInput
                    value={cfg.bobot_unit[key]}
                    onChange={v => setCfg(p => ({ ...p, bobot_unit: { ...p.bobot_unit, [key]: v } }))}
                  />
                </div>
              ))}
              <TotalBar current={totalBobotUnit} label="Total Bobot Unit Bisnis" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== TAB D: FORMULA JASA MODAL ===== */}
        <TabsContent value="formula_modal">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">D. Formula Perhitungan Jasa Modal (Simpanan)</CardTitle>
              <CardDescription>Konfigurasi komponen simpanan dan metode cut-off saldo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="font-semibold">Komponen Simpanan yang Dihitung</Label>
                {(["pokok", "wajib", "sukarela_berjangka"] as const).map((k) => {
                  const labels: Record<string, string> = { pokok: "Simpanan Pokok", wajib: "Simpanan Wajib", sukarela_berjangka: "Simpanan Sukarela Berjangka (Deposito)" };
                  const checked = cfg.formula_jasa_modal.komponen_simpanan.includes(k);
                  return (
                    <div key={k} className="flex items-center gap-3 p-3 border rounded-lg">
                      <Checkbox
                        id={`simpanan-${k}`}
                        checked={checked}
                        disabled={!canEdit}
                        onCheckedChange={v => {
                          const list = v
                            ? [...cfg.formula_jasa_modal.komponen_simpanan, k]
                            : cfg.formula_jasa_modal.komponen_simpanan.filter((x: any) => x !== k);
                          setCfg(p => ({ ...p, formula_jasa_modal: { ...p.formula_jasa_modal, komponen_simpanan: list } }));
                        }}
                      />
                      <Label htmlFor={`simpanan-${k}`} className="cursor-pointer">{labels[k]}</Label>
                    </div>
                  );
                })}
                {cfg.formula_jasa_modal.komponen_simpanan.length === 0 && (
                  <p className="text-xs text-red-600 font-medium">⚠ Minimal satu komponen simpanan harus dipilih.</p>
                )}
              </div>

              <div className="space-y-3">
                <Label className="font-semibold">Metode Cut-off Penentuan Saldo</Label>
                <RadioGroup
                  value={cfg.formula_jasa_modal.metode_cutoff}
                  disabled={!canEdit}
                  onValueChange={v => setCfg(p => ({ ...p, formula_jasa_modal: { ...p.formula_jasa_modal, metode_cutoff: v as "rata_rata_bulanan" | "saldo_akhir_tahun" } }))}
                >
                  <div className="p-3 border rounded-lg flex items-start gap-3">
                    <RadioGroupItem value="rata_rata_bulanan" id="cutoff-avg" className="mt-0.5" />
                    <Label htmlFor="cutoff-avg" className="cursor-pointer">
                      <span className="font-medium">Rata-rata Saldo Bulanan</span>
                      <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Recommended</span>
                      <p className="text-xs text-muted-foreground mt-0.5">Lebih adil — anggota yang menabung konsisten sepanjang tahun mendapat porsi lebih besar.</p>
                    </Label>
                  </div>
                  <div className="p-3 border rounded-lg flex items-start gap-3">
                    <RadioGroupItem value="saldo_akhir_tahun" id="cutoff-year" className="mt-0.5" />
                    <Label htmlFor="cutoff-year" className="cursor-pointer">
                      <span className="font-medium">Saldo Akhir Tahun (Per 31 Desember)</span>
                      <p className="text-xs text-muted-foreground mt-0.5">Lebih sederhana dalam kalkulasi, namun kurang mencerminkan kontribusi sepanjang tahun.</p>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== TAB E: FORMULA JASA USAHA ===== */}
        <TabsContent value="formula_usaha">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">E. Formula Perhitungan Jasa Usaha (Transaksi)</CardTitle>
              <CardDescription>Basis kalkulasi kontribusi anggota per unit bisnis.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basis SP */}
              <div className="space-y-3">
                <Label className="font-semibold">Basis Perhitungan — Unit Simpan Pinjam</Label>
                <RadioGroup
                  value={cfg.formula_jasa_usaha.basis_sp}
                  disabled={!canEdit}
                  onValueChange={v => setCfg(p => ({ ...p, formula_jasa_usaha: { ...p.formula_jasa_usaha, basis_sp: v as "pendapatan_bunga" | "nominal_pokok" } }))}
                >
                  <div className="p-3 border rounded-lg flex items-start gap-3">
                    <RadioGroupItem value="pendapatan_bunga" id="sp-bunga" className="mt-0.5" />
                    <Label htmlFor="sp-bunga" className="cursor-pointer">
                      <span className="font-medium">Total Pendapatan Bunga/Jasa Pinjaman Terbayar</span>
                      <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Recommended</span>
                      <p className="text-xs text-muted-foreground mt-0.5">Dihitung dari bunga yang benar-benar sudah dibayar anggota ke koperasi pada tahun berjalan.</p>
                    </Label>
                  </div>
                  <div className="p-3 border rounded-lg flex items-start gap-3">
                    <RadioGroupItem value="nominal_pokok" id="sp-pokok" className="mt-0.5" />
                    <Label htmlFor="sp-pokok" className="cursor-pointer">
                      <span className="font-medium">Total Nominal Pokok Realisasi Pinjaman</span>
                      <p className="text-xs text-muted-foreground mt-0.5">Dihitung dari plafon pinjaman yang diambil anggota pada tahun berjalan (tanpa memperhitungkan bunga).</p>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Basis Toko */}
              <div className="space-y-3">
                <Label className="font-semibold">Basis Perhitungan — Unit Toko/Waserda</Label>
                <RadioGroup
                  value={cfg.formula_jasa_usaha.basis_toko}
                  disabled={!canEdit}
                  onValueChange={v => setCfg(p => ({ ...p, formula_jasa_usaha: { ...p.formula_jasa_usaha, basis_toko: v as "profit_margin" | "omset_gross" } }))}
                >
                  <div className="p-3 border rounded-lg flex items-start gap-3">
                    <RadioGroupItem value="profit_margin" id="toko-margin" className="mt-0.5" />
                    <Label htmlFor="toko-margin" className="cursor-pointer">
                      <span className="font-medium">Profit Margin / Keuntungan Bersih dari Belanja Anggota</span>
                      <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Recommended</span>
                      <p className="text-xs text-muted-foreground mt-0.5">Mencerminkan kontribusi nyata — anggota yang membeli barang dengan margin lebih besar berkontribusi lebih.</p>
                    </Label>
                  </div>
                  <div className="p-3 border rounded-lg flex items-start gap-3">
                    <RadioGroupItem value="omset_gross" id="toko-omset" className="mt-0.5" />
                    <Label htmlFor="toko-omset" className="cursor-pointer">
                      <span className="font-medium">Omset / Total Nilai Belanja Gross Anggota</span>
                      <p className="text-xs text-muted-foreground mt-0.5">Lebih sederhana — dihitung dari total nilai transaksi belanja anggota tanpa mempertimbangkan margin.</p>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* ===== TAB F: ZAKAT & CSR ===== */}
        <TabsContent value="zakat_csr">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">F. Alokasi Zakat & CSR Koperasi</CardTitle>
              <CardDescription>
                Pemotongan langsung dari SHU Bersih sebelum didistribusikan ke anggota sesuai dengan prinsip Koperasi Syariah/Karyawan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 border rounded-lg bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-semibold text-sm">Persentase Zakat (%)</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Biasanya 2.5% dari SHU Bersih.</p>
                  </div>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    className="h-9 w-28 text-right"
                    disabled={!canEdit}
                    value={cfg.zakat_rate ?? 0}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setCfg((p) => ({ ...p, zakat_rate: val }));
                    }}
                  />
                </div>
              </div>

              <div className="p-4 border rounded-lg bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-semibold text-sm">Persentase CSR / Dana Sosial Keagamaan (%)</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Untuk alokasi tanggung jawab sosial kemasyarakatan.</p>
                  </div>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    className="h-9 w-28 text-right"
                    disabled={!canEdit}
                    value={cfg.csr_rate ?? 0}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setCfg((p) => ({ ...p, csr_rate: val }));
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      {canEdit && (
        <Button
          size="lg"
          className="w-full gap-2"
          onClick={handleSave}
          disabled={isPending || !isAllValid}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isPending ? "Menyimpan & Mencatat Audit Log..." : "Simpan Konfigurasi SHU"}
        </Button>
      )}

      {!isAllValid && canEdit && (
        <p className="text-sm text-red-600 text-center font-medium">⚠ {validationError}</p>
      )}
    </div>
  );
}
