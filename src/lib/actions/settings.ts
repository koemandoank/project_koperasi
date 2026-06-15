"use server";

import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/actions/log-audit";
import { verifySessionAndRole } from "@/lib/auth-helpers";

type AppSettings = {
  id: number;
  company_name: string;
  address?: string | null;
  phone?: string | null;
  logo_url?: string | null;
};

/** Deteksi error tabel belum ada di DB */
function isMissingTableError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /app_settings\b.*(does not exist|Unknown table|doesn't exist|not exist)/i.test(msg);
}

/** Deteksi error koneksi DB unreachable / timeout */
function isConnectionError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /Can't reach database|Connection refused|ECONNREFUSED|ETIMEDOUT|P1001|P1008|P1017/i.test(msg);
}

/**
 * Ambil konfigurasi umum aplikasi dari tabel app_settings.
 * Di-wrap dengan React `cache()` agar hanya 1 DB query per request,
 * meski dipanggil dari generateMetadata() dan layout() secara terpisah.
 *
 * @returns {Promise<AppSettings | null>} Settings atau null jika DB tidak tersedia
 */
export const getAppSettings = cache(async (): Promise<AppSettings | null> => {
  try {
    const settings = await (prisma as any).app_settings?.findFirst?.();

    if (!settings) {
      // Tabel ada tapi kosong — buat baris default
      const created = await (prisma as any).app_settings.create({
        data: {
          company_name: "Koperasi Sulfindo",
          logo_url: "/koperasi.png",
        },
      });

      return {
        ...created,
        id: Number(created.id),
      };
    }

    return {
      ...settings,
      id: Number(settings.id),
    };
  } catch (error) {
    if (isMissingTableError(error)) {
      console.warn("[settings] app_settings table belum ada, pakai fallback.", error);
      return null;
    }

    if (isConnectionError(error)) {
      // DB unreachable — jangan crash, kembalikan null agar UI pakai fallback
      console.warn("[settings] DB tidak dapat dijangkau, pakai fallback settings.");
      return null;
    }

    console.error("[settings] Gagal fetch app_settings:", error);
    return null;
  }
});

export async function updateAppSettings(data: {
  company_name: string;
  address?: string;
  phone?: string;
  logo_url?: string;
}) {
  try {
    await verifySessionAndRole(["superadmin", "ketua"]);
    
    const settings = await (prisma as any).app_settings?.findFirst?.();
    const oldData = settings
      ? { company_name: settings.company_name, address: settings.address, phone: settings.phone, logo_url: settings.logo_url }
      : null;

    if (settings) {
      await (prisma as any).app_settings.update({ where: { id: settings.id }, data });
    } else {
      await (prisma as any).app_settings.create({ data });
    }

    await logAudit({
      action: "UPDATE",
      modelType: "app_settings",
      modelId: settings ? Number(settings.id) : null,
      oldValues: oldData ?? {},
      newValues: data as Record<string, unknown>,
    });

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    if (isMissingTableError(error)) return { success: false, error: "app_settings table missing" };
    console.error("Failed to update app settings:", error);
    return { success: false, error: "Failed to update settings" };
  }
}

/**
 * Konfigurasi Dashboard Anggota
 */
const MEMBER_DASHBOARD_KEY = "member_dashboard_stats"

export async function getMemberDashboardConfig() {
  try {
    const c = await prisma.cache.findUnique({ where: { key: MEMBER_DASHBOARD_KEY } })
    if (!c) return { show_financial_stats: true }
    return JSON.parse(c.value)
  } catch (err) {
    return { show_financial_stats: true }
  }
}

export async function setMemberDashboardConfig(config: { show_financial_stats: boolean }) {
  try {
    await verifySessionAndRole(["superadmin", "admin", "pengurus"])
    await prisma.cache.upsert({
      where: { key: MEMBER_DASHBOARD_KEY },
      update: { value: JSON.stringify(config), expiration: 2147483647 },
      create: { key: MEMBER_DASHBOARD_KEY, value: JSON.stringify(config), expiration: 2147483647 }
    })
    
    await logAudit({
      action: "UPDATE",
      modelType: "cache",
      modelId: null,
      oldValues: {},
      newValues: config as Record<string, unknown>,
    })

    revalidatePath("/")
    revalidatePath("/dashboard/home")
    
    return { success: true }
  } catch (err) {
    console.error(err)
    return { success: false, error: "Gagal menyimpan pengaturan dashboard anggota" }
  }
}

/** Tipe data untuk konfigurasi Kop Surat & TTD Laporan */
export interface ReportTemplateConfig {
  logo_base64?: string;
  company_name: string;
  company_tagline?: string;
  company_address?: string;
  company_phone?: string;
  footer_location?: string;
  footer_date_type: "auto" | "custom";
  footer_custom_date?: string;
  footer_left_title?: string;
  footer_left_name?: string;
  footer_right_title?: string;
  footer_right_name?: string;
}

/** Key untuk report template settings di cache */
const REPORT_TEMPLATE_KEY = "report_template_config";

/**
 * Menyediakan konfigurasi default Kop Surat dan Footer TTD jika belum di-set di DB.
 * 
 * @returns {ReportTemplateConfig} Konfigurasi default standar
 */
function getReportTemplateDefaults(): ReportTemplateConfig {
  return {
    company_name: "KOEMAN-PROJECT",
    company_tagline: "Project Koperasi Sulfindo Goes To Digital",
    company_address: "Jl. Raya Serang Km. 80, Cilegon, Banten",
    company_phone: "(0254) 123456",
    footer_location: "Serang",
    footer_date_type: "auto",
    footer_left_title: "Bendahara",
    footer_left_name: "......................",
    footer_right_title: "Ketua Koperasi",
    footer_right_name: "......................"
  };
}

/**
 * Mendapatkan konfigurasi Kop Surat dan Tanda Tangan Laporan dari cache database.
 * Jika tidak ditemukan, akan mengembalikan nilai default standar koperasi.
 * 
 * @returns {Promise<ReportTemplateConfig>} Konfigurasi template laporan
 * @throws {Error} Jika terjadi kesalahan pada operasi database
 */
export async function getReportTemplateConfig(): Promise<ReportTemplateConfig> {
  try {
    const data = await prisma.cache.findUnique({ where: { key: REPORT_TEMPLATE_KEY } });
    if (!data) return getReportTemplateDefaults();
    return JSON.parse(data.value) as ReportTemplateConfig;
  } catch (error) {
    console.error("[settings] Gagal mengambil report_template_config:", error);
    return getReportTemplateDefaults();
  }
}

/**
 * Menyimpan konfigurasi Kop Surat dan Tanda Tangan Laporan ke dalam tabel cache.
 * Memerlukan otorisasi peran superadmin, admin, atau pengurus.
 * 
 * @param {ReportTemplateConfig} config - Objek konfigurasi yang akan disimpan
 * @returns {Promise<{ success: boolean; error?: string }>} Hasil operasi penyimpanan
 * @throws {Error} Jika database gagal menulis data atau otorisasi gagal
 */
export async function saveReportTemplateConfig(
  config: ReportTemplateConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    await verifySessionAndRole(["superadmin", "admin", "pengurus"]);
    
    if (!config.company_name) {
      return { success: false, error: "Nama Koperasi tidak boleh kosong" };
    }

    const value = JSON.stringify(config);
    await prisma.cache.upsert({
      where: { key: REPORT_TEMPLATE_KEY },
      update: { value, expiration: 2147483647 },
      create: { key: REPORT_TEMPLATE_KEY, value, expiration: 2147483647 }
    });

    await logAudit({
      action: "UPDATE",
      modelType: "cache",
      modelId: null,
      oldValues: {},
      newValues: config as unknown as Record<string, unknown>,
    });

    revalidatePath("/", "layout");
    revalidatePath("/pengaturan/kop-surat");
    
    return { success: true };
  } catch (error: any) {
    console.error("[settings] Gagal menyimpan report_template_config:", error);
    return { success: false, error: error?.message || "Gagal menyimpan konfigurasi" };
  }
}

