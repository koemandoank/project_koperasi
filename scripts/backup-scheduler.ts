/**
 * Scheduler backup — jalankan sebagai proses terpisah atau via Windows Task Scheduler.
 *
 * Contoh (setiap menit):
 *   npx tsx scripts/backup-scheduler.ts
 *
 * Atau panggil langsung endpoint cron:
 *   curl "http://localhost:3000/api/cron/backup?secret=YOUR_SECRET"
 */

const BASE_URL = process.env.BACKUP_BASE_URL || "http://localhost:3000";
const CRON_SECRET = process.env.BACKUP_CRON_SECRET;

async function tick() {
  if (!CRON_SECRET) {
    console.error("[backup-scheduler] BACKUP_CRON_SECRET belum di-set di .env");
    process.exit(1);
  }

  const url = `${BASE_URL}/api/cron/backup?secret=${encodeURIComponent(CRON_SECRET)}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const time = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
    if (data.skipped) {
      console.log(`[${time} WIB] dilewati — ${data.message}`);
    } else if (data.success) {
      console.log(`[${time} WIB] backup berhasil — ${data.message}`);
    } else {
      console.error(`[${time} WIB] backup gagal — ${data.message}`);
    }
  } catch (err) {
    console.error("[backup-scheduler] error:", err);
  }
}

console.log("[backup-scheduler] memulai — cek setiap 60 detik");
void tick();
setInterval(tick, 60_000);
