import { getSHUProjection } from "@/lib/actions/shu-calculation"
import { getReportTemplateConfig } from "@/lib/actions/settings"
import { PembagianShuClient } from "./pembagian-shu-client"

// FIX (28 Jul 2026): halaman ini menghitung proyeksi SHU utk SEMUA anggota aktif
// secara sequential (N+1 query per anggota). Dengan data skala besar (120+ anggota),
// perhitungan ini melebihi 60 detik batas Next.js static generation saat build,
// menyebabkan build Vercel gagal total. force-dynamic memindah eksekusi ke saat
// request (serverless function, timeout jauh lebih longgar), bukan saat build.
export const dynamic = "force-dynamic"

export default async function PembagianShuPage() {
  const currentYear = new Date().getFullYear()

  let initialReport = null
  let templateConfig = null
  try {
    initialReport = await getSHUProjection(currentYear)
    templateConfig = await getReportTemplateConfig()
  } catch (error) {
    console.error("Error loading SHU projection page:", error)
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pembagian SHU RAT massal</h1>
        <p className="text-muted-foreground">
          Kalkulasi real-time porsi Jasa Modal & Jasa Usaha per anggota sesuai UU Koperasi, serta posting massal ke Simpanan Sukarela.
        </p>
      </div>

      <PembagianShuClient 
        initialReport={initialReport} 
        initialYear={currentYear} 
        templateConfig={templateConfig}
      />
    </div>
  )
}
