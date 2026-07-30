import { getSHUProjection } from "@/lib/actions/shu-calculation"
import { getReportTemplateConfig } from "@/lib/actions/settings"
import { PartisipasiClient } from "./partisipasi-client"

// FIX (28 Jul 2026): sama seperti pembagian-shu, halaman ini juga panggil
// getSHUProjection() yang berat untuk data skala besar - pindah ke request-time.
export const dynamic = "force-dynamic"

export default async function PartisipasiAnggotaPage() {
  const currentYear = new Date().getFullYear()

  let initialReport = null
  let templateConfig = null
  try {
    initialReport = await getSHUProjection(currentYear)
    templateConfig = await getReportTemplateConfig()
  } catch (error) {
    console.error("Error loading member participation page:", error)
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Buku Pembantu RAT & Partisipasi Anggota</h1>
        <p className="text-muted-foreground">
          Buku bantu terintegrasi yang menyajikan ringkasan modal simpanan, kontribusi pembiayaan, belanja, serta penerimaan SHU per anggota.
        </p>
      </div>

      <PartisipasiClient 
        initialReport={initialReport} 
        initialYear={currentYear} 
        templateConfig={templateConfig}
      />
    </div>
  )
}
