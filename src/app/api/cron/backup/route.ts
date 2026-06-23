import { NextRequest, NextResponse } from "next/server";
import { getBackupConfig } from "@/lib/backup/config";
import { runBackup } from "@/lib/backup/runner";
import { shouldRunScheduledBackup } from "@/lib/backup/schedule";

function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.BACKUP_CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const querySecret = request.nextUrl.searchParams.get("secret");
  return querySecret === secret;
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = request.nextUrl.searchParams.get("force") === "1";
  const config = await getBackupConfig();

  if (!force && !shouldRunScheduledBackup(config)) {
    return NextResponse.json({
      skipped: true,
      message: "Belum waktunya backup terjadwal",
      enabled: config.enabled,
      scheduleTime: config.scheduleTime,
      scheduleDays: config.scheduleDays,
    });
  }

  const result = await runBackup(force ? "cron" : "schedule");
  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
