import crypto from "crypto";
import {
  appendBackupHistory,
  getBackupConfig,
  updateBackupLastRun,
} from "./config";
import { exportDatabase } from "./export-database";
import { exportSettings } from "./export-settings";
import { uploadToGoogleDrive } from "./google-drive";
import type { BackupHistoryEntry, BackupRunResult } from "./types";

function timestampLabel(): string {
  const now = new Date();
  const wib = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${wib.getFullYear()}${pad(wib.getMonth() + 1)}${pad(wib.getDate())}_${pad(wib.getHours())}${pad(wib.getMinutes())}${pad(wib.getSeconds())}`;
}

export async function runBackup(
  triggeredBy: BackupHistoryEntry["triggeredBy"] = "manual"
): Promise<BackupRunResult> {
  const startedAt = new Date().toISOString();
  const config = await getBackupConfig();
  const files: BackupHistoryEntry["files"] = [];
  const ts = timestampLabel();

  try {
    if (!config.backupDatabase && !config.backupSettings) {
      throw new Error("Pilih minimal satu jenis backup (database atau pengaturan)");
    }

    if (config.backupSettings) {
      const content = await exportSettings();
      const fileName = `settings_${ts}.json`;
      const driveId = await uploadToGoogleDrive(
        config.googleDriveFolderId,
        fileName,
        content,
        "application/json"
      );
      files.push({ name: fileName, driveFileId: driveId, sizeBytes: content.length });
    }

    if (config.backupDatabase) {
      const content = await exportDatabase();
      const fileName = `database_${ts}.sql`;
      const driveId = await uploadToGoogleDrive(
        config.googleDriveFolderId,
        fileName,
        content,
        "application/sql"
      );
      files.push({ name: fileName, driveFileId: driveId, sizeBytes: content.length });
    }

    const message = `Backup berhasil — ${files.length} file diunggah ke Google Drive`;
    await updateBackupLastRun("success", message);

    const entry: BackupHistoryEntry = {
      id: crypto.randomUUID(),
      startedAt,
      finishedAt: new Date().toISOString(),
      status: "success",
      message,
      files,
      triggeredBy,
    };
    await appendBackupHistory(entry);

    return { success: true, message, files };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Backup gagal";
    await updateBackupLastRun("error", message);

    const entry: BackupHistoryEntry = {
      id: crypto.randomUUID(),
      startedAt,
      finishedAt: new Date().toISOString(),
      status: "error",
      message,
      files,
      triggeredBy,
    };
    await appendBackupHistory(entry);

    return { success: false, message, files };
  }
}
