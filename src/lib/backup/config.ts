import { getCache, setCache } from "@/lib/cache";
import {
  BACKUP_CONFIG_KEY,
  BACKUP_HISTORY_KEY,
  DEFAULT_BACKUP_CONFIG,
  type BackupConfig,
  type BackupHistoryEntry,
} from "./types";

const CONFIG_TTL = 60 * 60 * 24 * 365 * 10; // 10 tahun — config permanen
const HISTORY_TTL = CONFIG_TTL;
const MAX_HISTORY = 30;

export async function getBackupConfig(): Promise<BackupConfig> {
  const stored = await getCache<BackupConfig>(BACKUP_CONFIG_KEY);
  if (!stored) return { ...DEFAULT_BACKUP_CONFIG };
  return { ...DEFAULT_BACKUP_CONFIG, ...stored };
}

export async function saveBackupConfig(config: BackupConfig): Promise<void> {
  await setCache(BACKUP_CONFIG_KEY, config, CONFIG_TTL);
}

export async function getBackupHistory(): Promise<BackupHistoryEntry[]> {
  const history = await getCache<BackupHistoryEntry[]>(BACKUP_HISTORY_KEY);
  return history ?? [];
}

export async function appendBackupHistory(entry: BackupHistoryEntry): Promise<void> {
  const history = await getBackupHistory();
  const next = [entry, ...history].slice(0, MAX_HISTORY);
  await setCache(BACKUP_HISTORY_KEY, next, HISTORY_TTL);
}

export async function updateBackupLastRun(
  status: "success" | "error",
  message: string
): Promise<void> {
  const config = await getBackupConfig();
  config.lastRunAt = new Date().toISOString();
  config.lastRunStatus = status;
  config.lastRunMessage = message;
  await saveBackupConfig(config);
}
