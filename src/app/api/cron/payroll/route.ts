import { NextRequest, NextResponse } from "next/server";
import { generatePayrollDraft } from "@/lib/actions/payroll";

function verifyCronSecret(request: NextRequest): boolean {
  // Vercel Cron Jobs otomatis kirim header "Authorization: Bearer $CRON_SECRET"
  // kalau env var CRON_SECRET di-set di project settings - dicek duluan.
  // BACKUP_CRON_SECRET tetap didukung untuk kompatibilitas kalau dipicu
  // scheduler eksternal (pola yang sudah dipakai /api/cron/backup).
  const authHeader = request.headers.get("authorization");
  const querySecret = request.nextUrl.searchParams.get("secret");

  const vercelSecret = process.env.CRON_SECRET;
  if (vercelSecret && (authHeader === `Bearer ${vercelSecret}` || querySecret === vercelSecret)) return true;

  const legacySecret = process.env.BACKUP_CRON_SECRET;
  if (legacySecret && (authHeader === `Bearer ${legacySecret}` || querySecret === legacySecret)) return true;

  return false;
}

function isWorkingDay(date: Date): boolean {
  const day = date.getDay(); // 0=Minggu, 6=Sabtu
  return day !== 0 && day !== 6;
}

/**
 * Cari tanggal target draft payroll bulan ini: tanggal 25 kalau hari kerja,
 * kalau tidak coba tanggal 26, kalau dua-duanya bukan hari kerja (jarang
 * terjadi, cuma mungkin kalau 25&26 sama2 weekend) mundur lagi ke hari kerja
 * berikutnya supaya tidak pernah terlewat sebulan penuh.
 */
function getTargetDraftDate(year: number, month0: number): Date {
  const day25 = new Date(year, month0, 25);
  if (isWorkingDay(day25)) return day25;
  const day26 = new Date(year, month0, 26);
  if (isWorkingDay(day26)) return day26;
  const d = new Date(day26);
  for (let i = 0; i < 5; i++) {
    d.setDate(d.getDate() + 1);
    if (isWorkingDay(d)) return d;
  }
  return day26;
}

function sameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = request.nextUrl.searchParams.get("force") === "1";
  const now = new Date();
  const targetDate = getTargetDraftDate(now.getFullYear(), now.getMonth());

  if (!force && !sameDate(now, targetDate)) {
    return NextResponse.json({
      skipped: true,
      message: "Belum waktunya generate draft payroll bulan ini.",
      today: now.toISOString().slice(0, 10),
      targetDate: targetDate.toISOString().slice(0, 10),
    });
  }

  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  try {
    const result = await generatePayrollDraft(periodStart, periodEnd);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message ?? "Gagal generate draft payroll." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
