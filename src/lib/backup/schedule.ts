import type { BackupConfig } from "./types";

const WIB_TIMEZONE = "Asia/Jakarta";

/** Ambil waktu saat ini dalam zona WIB */
export function getWIBNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: WIB_TIMEZONE }));
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map((v) => parseInt(v, 10));
  return (h || 0) * 60 + (m || 0);
}

function isSameWIBDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Cek apakah backup terjadwal harus dijalankan sekarang.
 * Window toleransi 10 menit setelah jam jadwal.
 */
export function shouldRunScheduledBackup(config: BackupConfig): boolean {
  if (!config.enabled) return false;

  const now = getWIBNow();
  const today = now.getDay() as BackupConfig["scheduleDays"][number];

  if (!config.scheduleDays.includes(today)) return false;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const scheduledMinutes = parseTimeToMinutes(config.scheduleTime);

  if (nowMinutes < scheduledMinutes || nowMinutes > scheduledMinutes + 10) {
    return false;
  }

  if (config.lastRunAt) {
    const lastRun = new Date(config.lastRunAt);
    const lastRunWIB = new Date(
      lastRun.toLocaleString("en-US", { timeZone: WIB_TIMEZONE })
    );
    if (isSameWIBDate(lastRunWIB, now)) return false;
  }

  return true;
}

export function formatScheduleSummary(config: BackupConfig): string {
  const dayNames = config.scheduleDays
    .sort((a, b) => a - b)
    .map((d) => ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"][d])
    .join(", ");

  return `${config.scheduleTime} WIB — ${dayNames}`;
}
