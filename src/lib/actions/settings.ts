"use server";

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

function isMissingTableError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  // Prisma MySQL missing table typically contains: "does not exist in the current database" / "Unknown table"
  return /app_settings\b.*(does not exist|Unknown table|doesn't exist|not exist)/i.test(msg);
}

export async function getAppSettings(): Promise<AppSettings | null> {
  try {
    const settings = await (prisma as any).app_settings?.findFirst?.();

    if (!settings) {
      // If table exists but empty, create a default row.
      const created = await (prisma as any).app_settings.create({
        data: {
          company_name: "Koperasi Digital",
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
      // Critical for login: do not block authentication if app_settings table isn't migrated yet.
      // Return null so UI can render fallback values.
      console.warn("app_settings table missing; returning null settings.", error);
      return null;
    }

    console.error("Failed to fetch app settings:", error);
    return null;
  }
}

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

/** Key untuk SHU settings di app_settings — disimpan sebagai JSON di kolom `shu_config` */
const SHU_SETTINGS_KEY = "shu_config"

/**
 * Simpan konfigurasi distribusi SHU ke app_settings.
 * @param values - Objek distribusi SHU (key → persen)
 */
export async function saveShuSettings(
  values: Record<string, number>
): Promise<{ success: boolean; error?: string }> {
  try {
    await verifySessionAndRole(["superadmin", "ketua"]);
    const jsonValue = JSON.stringify(values)
    const settings = await (prisma as any).app_settings?.findFirst?.()
    const oldShu = settings?.shu_config ? JSON.parse(settings.shu_config) : null

    if (settings) {
      await (prisma as any).app_settings.update({ where: { id: settings.id }, data: { shu_config: jsonValue } })
    } else {
      await (prisma as any).app_settings.create({ data: { company_name: "Koperasi Digital", shu_config: jsonValue } })
    }

    await logAudit({
      action: "UPDATE",
      modelType: "shu_config",
      modelId: settings ? Number(settings.id) : null,
      oldValues: oldShu ?? {},
      newValues: values as Record<string, unknown>,
    })

    revalidatePath("/pengaturan/shu")
    return { success: true }
  } catch (error) {
    console.error("saveShuSettings error:", error)
    return { success: false, error: "Gagal menyimpan konfigurasi SHU." }
  }
}

export async function getShuSettings(): Promise<Record<string, number> | null> {
  try {
    const settings = await (prisma as any).app_settings?.findFirst?.()
    if (!settings?.shu_config) return null
    return JSON.parse(settings.shu_config) as Record<string, number>
  } catch (error) {
    console.error("getShuSettings error:", error)
    return null
  }
}

/**
 * Konfigurasi Dashboard Anggota
 */
const MEMBER_DASHBOARD_KEY = "member_dashboard_stats"

export async function getMemberDashboardConfig() {
  try {
    const c = await prisma.cache.findUnique({ where: { key: MEMBER_DASHBOARD_KEY } })
    if (!c) return { show_financial_stats: false }
    return JSON.parse(c.value)
  } catch (err) {
    return { show_financial_stats: false }
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
