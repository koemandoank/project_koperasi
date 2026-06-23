"use server";

import { revalidatePath } from "next/cache";
import { checkRole } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/actions/log-audit";
import {
  getBackupConfig,
  getBackupHistory,
  saveBackupConfig,
} from "@/lib/backup/config";
import { isGoogleDriveConfigured } from "@/lib/backup/google-drive";
import { runBackup } from "@/lib/backup/runner";
import { formatScheduleSummary } from "@/lib/backup/schedule";
import {
  DEFAULT_BACKUP_CONFIG,
  type BackupConfig,
  type BackupDay,
} from "@/lib/backup/types";

export type BackupPageData = {
  config: BackupConfig;
  history: Awaited<ReturnType<typeof getBackupHistory>>;
  driveConfigured: boolean;
  scheduleSummary: string;
};

export async function getBackupPageData(): Promise<BackupPageData> {
  await checkRole(["superadmin", "admin"]);
  const config = await getBackupConfig();
  const history = await getBackupHistory();
  return {
    config,
    history,
    driveConfigured: isGoogleDriveConfigured(),
    scheduleSummary: formatScheduleSummary(config),
  };
}

export async function updateBackupConfigAction(data: {
  enabled: boolean;
  scheduleTime: string;
  scheduleDays: BackupDay[];
  googleDriveFolderId: string;
  backupDatabase: boolean;
  backupSettings: boolean;
}) {
  try {
    await checkRole(["superadmin", "admin"]);

    if (!/^\d{2}:\d{2}$/.test(data.scheduleTime)) {
      return { success: false, error: "Format jam harus HH:mm (contoh: 23:50)" };
    }

    if (data.scheduleDays.length === 0) {
      return { success: false, error: "Pilih minimal satu hari jadwal backup" };
    }

    if (!data.googleDriveFolderId.trim()) {
      return { success: false, error: "Folder ID Google Drive wajib diisi" };
    }

    const current = await getBackupConfig();
    const next: BackupConfig = {
      ...DEFAULT_BACKUP_CONFIG,
      ...current,
      enabled: data.enabled,
      scheduleTime: data.scheduleTime,
      scheduleDays: data.scheduleDays,
      googleDriveFolderId: data.googleDriveFolderId.trim(),
      backupDatabase: data.backupDatabase,
      backupSettings: data.backupSettings,
    };

    await saveBackupConfig(next);

    await logAudit({
      action: "UPDATE",
      modelType: "backup_config",
      modelId: null,
      oldValues: current,
      newValues: next,
    });

    revalidatePath("/pengaturan/backup");
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Gagal menyimpan pengaturan backup";
    return { success: false, error: msg };
  }
}

export async function runBackupNowAction() {
  try {
    await checkRole(["superadmin", "admin"]);
    const result = await runBackup("manual");

    await logAudit({
      action: "CREATE",
      modelType: "backup",
      modelId: null,
      oldValues: null,
      newValues: {
        status: result.success ? "success" : "error",
        message: result.message,
        files: result.files.map((f) => f.name),
      },
    });

    revalidatePath("/pengaturan/backup");
    return result;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Gagal menjalankan backup";
    return { success: false, message: msg, files: [] };
  }
}
