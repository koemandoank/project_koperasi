export const BACKUP_CONFIG_KEY = "backup_config";
export const BACKUP_HISTORY_KEY = "backup_history";
export const DEFAULT_DRIVE_FOLDER_ID = "1O_wkWPIKPsvZwOEwa3dH4QU2yftUfYUT";

export type BackupDay = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Minggu, 1=Senin, ...

export type BackupConfig = {
  enabled: boolean;
  scheduleTime: string; // HH:mm format, WIB
  scheduleDays: BackupDay[];
  googleDriveFolderId: string;
  backupDatabase: boolean;
  backupSettings: boolean;
  lastRunAt: string | null;
  lastRunStatus: "success" | "error" | null;
  lastRunMessage: string | null;
};

export type BackupHistoryEntry = {
  id: string;
  startedAt: string;
  finishedAt: string;
  status: "success" | "error";
  message: string;
  files: Array<{
    name: string;
    driveFileId?: string;
    sizeBytes: number;
  }>;
  triggeredBy: "manual" | "schedule" | "cron";
};

export type BackupRunResult = {
  success: boolean;
  message: string;
  files: BackupHistoryEntry["files"];
};

export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  enabled: true,
  scheduleTime: "23:50",
  scheduleDays: [1, 2, 3, 4, 5, 6],
  googleDriveFolderId: DEFAULT_DRIVE_FOLDER_ID,
  backupDatabase: true,
  backupSettings: true,
  lastRunAt: null,
  lastRunStatus: null,
  lastRunMessage: null,
};

export const DAY_LABELS: Record<BackupDay, string> = {
  0: "Minggu",
  1: "Senin",
  2: "Selasa",
  3: "Rabu",
  4: "Kamis",
  5: "Jumat",
  6: "Sabtu",
};
