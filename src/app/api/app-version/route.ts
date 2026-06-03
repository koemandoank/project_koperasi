import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    latestVersion: "3.3.5",
    minRequiredVersion: "3.0.0",
    downloadUrl: "/koperasi-sulfindo.apk",
    releaseNotes: "Pembaruan performa, relokasi menu Potongan Gaji ke Keuangan, sinkronisasi navigasi mobile, dan perbaikan batas waktu batch payroll.",
  })
}
