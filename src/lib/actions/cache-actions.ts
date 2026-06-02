"use server"

import { clearAllCache, deleteCache, getCacheStats } from "@/lib/cache";
import { verifySessionAndRole } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/actions/log-audit";
import { revalidatePath } from "next/cache";

export async function clearAllCacheAction() {
  try {
    await verifySessionAndRole(["superadmin", "admin"]);
    
    const result = await clearAllCache();
    
    await logAudit({
      action: "DELETE",
      modelType: "cache",
      modelId: null,
      oldValues: { note: "Menghapus seluruh cache aplikasi" },
      newValues: { count: result.count }
    });
    
    revalidatePath("/pengaturan/cache");
    return { success: true, count: result.count };
  } catch (error: any) {
    console.error("clearAllCacheAction error:", error);
    return { success: false, error: error?.message || "Gagal membersihkan cache" };
  }
}

export async function deleteCacheKeyAction(key: string) {
  try {
    await verifySessionAndRole(["superadmin", "admin"]);
    
    await deleteCache(key);
    
    await logAudit({
      action: "DELETE",
      modelType: "cache",
      modelId: null,
      oldValues: { key },
      newValues: { note: `Menghapus cache key ${key}` }
    });
    
    revalidatePath("/pengaturan/cache");
    return { success: true };
  } catch (error: any) {
    console.error("deleteCacheKeyAction error:", error);
    return { success: false, error: error?.message || "Gagal menghapus cache key" };
  }
}

export async function getCacheStatsAction() {
  try {
    await verifySessionAndRole(["superadmin", "admin", "pengurus"]);
    const stats = await getCacheStats();
    return { success: true, data: stats };
  } catch (error: any) {
    console.error("getCacheStatsAction error:", error);
    return { success: false, error: error?.message || "Gagal mengambil statistik cache" };
  }
}
