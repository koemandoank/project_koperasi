/**
 * Shared type definitions untuk konfigurasi parameter SHU.
 * Tidak ada "use server" — bisa diimport dari mana saja.
 */

/** Seksi A: Alokasi persentase SHU (total harus 100%) */
export type AlokasiFeksi = {
  /** Dana Cadangan — min 20% sesuai UU No.25/1992 Ps.45 */
  cadangan: number;
  /** Total Jasa Anggota — dipecah lebih lanjut di JasaAnggotaBobot */
  jasa_anggota: number;
  /** Honorarium Pengurus & Pengawas */
  pengurus: number;
  /** Honorarium Ketua Koperasi */
  ketua: number;
  /** Tunjangan Karyawan/Pegawai */
  pegawai: number;
  /** Dana Pendidikan Koperasi */
  pendidikan: number;
  /** Dana Sosial & Pembangunan Daerah Kerja */
  sosial_pembangunan: number;
};

/** Seksi B: Pembobotan alokasi jasa anggota (total harus 100%) */
export type JasaAnggotaBobot = {
  /** Porsi Jasa Modal (berdasarkan simpanan) */
  modal: number;
  /** Porsi Jasa Usaha (berdasarkan transaksi) */
  usaha: number;
};

/** Seksi C: Bobot kontribusi per unit bisnis (total harus 100%) */
export type BobotUnit = {
  /** Bobot Unit Simpan Pinjam */
  simpan_pinjam: number;
  /** Bobot Unit Penjualan/Toko (Waserda) */
  toko: number;
};

/** Seksi D: Formula perhitungan jasa modal */
export type FormulaJasaModal = {
  /** Komponen simpanan yang dihitung */
  komponen_simpanan: Array<"pokok" | "wajib" | "sukarela_berjangka">;
  /** Metode cut-off saldo */
  metode_cutoff: "rata_rata_bulanan" | "saldo_akhir_tahun";
};

/** Seksi E: Formula perhitungan jasa usaha */
export type FormulaJasaUsaha = {
  /** Basis kalkulasi Unit Simpan Pinjam */
  basis_sp: "pendapatan_bunga" | "nominal_pokok";
  /** Basis kalkulasi Unit Toko */
  basis_toko: "profit_margin" | "omset_gross";
};

import { z } from "zod";

export const ShuConfigSchema = z.object({
  alokasi: z.object({
    cadangan: z.number().min(0).max(100),
    jasa_anggota: z.number().min(0).max(100),
    pengurus: z.number().min(0).max(100),
    ketua: z.number().min(0).max(100),
    pegawai: z.number().min(0).max(100),
    pendidikan: z.number().min(0).max(100),
    sosial_pembangunan: z.number().min(0).max(100),
  }).strict(),
  jasa_anggota_bobot: z.object({
    modal: z.number().min(0).max(100),
    usaha: z.number().min(0).max(100),
  }).strict(),
  bobot_unit: z.object({
    simpan_pinjam: z.number().min(0).max(100),
    toko: z.number().min(0).max(100),
  }).strict(),
  formula_jasa_modal: z.object({
    komponen_simpanan: z.array(z.enum(["pokok", "wajib", "sukarela_berjangka"])),
    metode_cutoff: z.enum(["rata_rata_bulanan", "saldo_akhir_tahun"]),
  }).strict(),
  formula_jasa_usaha: z.object({
    basis_sp: z.enum(["pendapatan_bunga", "nominal_pokok"]),
    basis_toko: z.enum(["profit_margin", "omset_gross"]),
  }).strict(),
  zakat_rate: z.number().min(0).max(100).default(0).optional(),
  csr_rate: z.number().min(0).max(100).default(0).optional(),
}).strict();

export type ShuConfig = z.infer<typeof ShuConfigSchema>;

/** Default sesuai UU No.25/1992 */
export const DEFAULT_SHU_CONFIG: ShuConfig = {
  alokasi: {
    cadangan: 20,
    jasa_anggota: 50,
    pengurus: 5,
    ketua: 5,
    pegawai: 5,
    pendidikan: 5,
    sosial_pembangunan: 10,
  },
  jasa_anggota_bobot: { modal: 40, usaha: 60 },
  bobot_unit: { simpan_pinjam: 60, toko: 40 },
  formula_jasa_modal: {
    komponen_simpanan: ["pokok", "wajib"],
    metode_cutoff: "rata_rata_bulanan",
  },
  formula_jasa_usaha: {
    basis_sp: "pendapatan_bunga",
    basis_toko: "profit_margin",
  },
  zakat_rate: 0,
  csr_rate: 0,
};

/** Role yang diizinkan mengubah konfigurasi SHU */
export const SHU_CONFIG_ALLOWED_ROLES = ["superadmin", "ketua"] as const;

/**
 * Validasi konfigurasi SHU — 3 group total=100% + rule bisnis.
 * @returns null jika valid, string pesan error jika tidak valid.
 */
export function validateShuConfig(cfg: ShuConfig): string | null {
  const round2 = (n: number) => Math.round(n * 100) / 100;

  // A: Total alokasi harus 100%
  const totalAlokasi = round2(Object.values(cfg.alokasi).reduce((a: any, b: any) => a + b, 0));
  if (Math.abs(totalAlokasi - 100) > 0.01)
    return `Total alokasi SHU = ${totalAlokasi}%, harus tepat 100%.`;

  // A: Dana cadangan minimum 20% (UU No.25/1992 Ps.45 ayat 2a)
  if (cfg.alokasi.cadangan < 20)
    return `Dana Cadangan minimal 20% sesuai UU No.25/1992 Pasal 45. (Saat ini: ${cfg.alokasi.cadangan}%)`;

  // B: Total bobot jasa anggota harus 100%
  const totalBobot = round2(cfg.jasa_anggota_bobot.modal + cfg.jasa_anggota_bobot.usaha);
  if (Math.abs(totalBobot - 100) > 0.01)
    return `Total bobot jasa anggota = ${totalBobot}%, harus tepat 100%.`;

  // C: Total bobot unit bisnis harus 100%
  const totalUnit = round2(cfg.bobot_unit.simpan_pinjam + cfg.bobot_unit.toko);
  if (Math.abs(totalUnit - 100) > 0.01)
    return `Total bobot unit bisnis = ${totalUnit}%, harus tepat 100%.`;

  // D: Minimal satu komponen simpanan dipilih
  if (cfg.formula_jasa_modal.komponen_simpanan.length === 0)
    return "Minimal satu komponen simpanan harus dipilih untuk perhitungan Jasa Modal.";

  return null;
}

/**
 * Migrasi otomatis dari format shu_config lama (flat) ke format baru (bersarang).
 * Lama: { cadangan: 20, anggota_jasa_simpanan: 30, anggota_jasa_usaha: 25, ... }
 * Baru: { alokasi: {...}, jasa_anggota_bobot: {...}, ... }
 */
export function migrateLegacyShuConfig(raw: Record<string, unknown>): ShuConfig {
  // Deteksi format lama (flat key langsung di root)
  if ("cadangan" in raw && !("alokasi" in raw)) {
    const old = raw as Record<string, number>;
    const jasaTotal = (old.anggota_jasa_simpanan ?? 0) + (old.anggota_jasa_usaha ?? 0);
    const totalModal = jasaTotal > 0 ? old.anggota_jasa_simpanan ?? 0 : 0;
    const totalUsaha = jasaTotal > 0 ? old.anggota_jasa_usaha ?? 0 : 0;
    const pctModal = jasaTotal > 0 ? Math.round((totalModal / jasaTotal) * 100) : 40;
    const pctUsaha = 100 - pctModal;

    return {
      alokasi: {
        cadangan: old.cadangan ?? 20,
        jasa_anggota: jasaTotal > 0 ? jasaTotal : 50,
        pengurus: old.pengurus ?? 5,
        ketua: old.ketua ?? 5,
        pegawai: old.pegawai ?? 5,
        pendidikan: old.pendidikan ?? 5,
        sosial_pembangunan: (old.sosial ?? 0) + (old.pembangunan_daerah ?? 0) || 10,
      },
      jasa_anggota_bobot: { modal: pctModal, usaha: pctUsaha },
      bobot_unit: DEFAULT_SHU_CONFIG.bobot_unit,
      formula_jasa_modal: DEFAULT_SHU_CONFIG.formula_jasa_modal,
      formula_jasa_usaha: DEFAULT_SHU_CONFIG.formula_jasa_usaha,
      zakat_rate: typeof old.zakat_rate === "number" ? old.zakat_rate : 0,
      csr_rate: typeof old.csr_rate === "number" ? old.csr_rate : 0,
    };
  }

  // Format baru — merge dengan default untuk backward safety
  const rawAlokasi = (raw.alokasi ?? {}) as Record<string, unknown>;
  return {
    alokasi: {
      cadangan: typeof rawAlokasi.cadangan === "number" ? rawAlokasi.cadangan : DEFAULT_SHU_CONFIG.alokasi.cadangan,
      jasa_anggota: typeof rawAlokasi.jasa_anggota === "number" ? rawAlokasi.jasa_anggota : DEFAULT_SHU_CONFIG.alokasi.jasa_anggota,
      pengurus: typeof rawAlokasi.pengurus === "number" ? rawAlokasi.pengurus : DEFAULT_SHU_CONFIG.alokasi.pengurus,
      ketua: typeof rawAlokasi.ketua === "number" ? rawAlokasi.ketua : DEFAULT_SHU_CONFIG.alokasi.ketua,
      pegawai: typeof rawAlokasi.pegawai === "number" ? rawAlokasi.pegawai : DEFAULT_SHU_CONFIG.alokasi.pegawai,
      pendidikan: typeof rawAlokasi.pendidikan === "number" ? rawAlokasi.pendidikan : DEFAULT_SHU_CONFIG.alokasi.pendidikan,
      sosial_pembangunan: typeof rawAlokasi.sosial_pembangunan === "number" ? rawAlokasi.sosial_pembangunan : DEFAULT_SHU_CONFIG.alokasi.sosial_pembangunan,
    },
    jasa_anggota_bobot: { ...DEFAULT_SHU_CONFIG.jasa_anggota_bobot, ...(raw.jasa_anggota_bobot as JasaAnggotaBobot ?? {}) },
    bobot_unit: { ...DEFAULT_SHU_CONFIG.bobot_unit, ...(raw.bobot_unit as BobotUnit ?? {}) },
    formula_jasa_modal: { ...DEFAULT_SHU_CONFIG.formula_jasa_modal, ...(raw.formula_jasa_modal as FormulaJasaModal ?? {}) },
    formula_jasa_usaha: { ...DEFAULT_SHU_CONFIG.formula_jasa_usaha, ...(raw.formula_jasa_usaha as FormulaJasaUsaha ?? {}) },
    zakat_rate: typeof raw.zakat_rate === "number" ? raw.zakat_rate : 0,
    csr_rate: typeof raw.csr_rate === "number" ? raw.csr_rate : 0,
  };
}
