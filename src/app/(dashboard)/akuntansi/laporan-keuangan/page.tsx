import { getNeraca, getLabaRugi } from "@/lib/actions/laporan-keuangan"
import { getArusKas } from "@/lib/actions/laporan-arus-kas"
import { getPerubahanEkuitas } from "@/lib/actions/laporan-perubahan-ekuitas"
import { getReportTemplateConfig } from "@/lib/actions/settings"
import { LaporanKeuanganClient } from "./laporan-keuangan-client"

export default async function LaporanKeuanganPage() {
  const currentYear = new Date().getFullYear()
  
  let initialNeraca = null
  let initialLabaRugi = null
  let initialArusKas = null
  let initialPerubahanEkuitas = null
  let templateConfig = null
  
  try {
    ;[initialNeraca, initialLabaRugi, initialArusKas, initialPerubahanEkuitas, templateConfig] =
      await Promise.all([
        getNeraca(currentYear),
        getLabaRugi(currentYear),
        getArusKas(currentYear),
        getPerubahanEkuitas(currentYear),
        getReportTemplateConfig(),
      ])
  } catch (error) {
    console.error("Error loading financial reports page:", error)
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Laporan Keuangan RAT</h1>
        <p className="text-muted-foreground">
          Laporan Neraca, PHU, Arus Kas, dan Perubahan Ekuitas sesuai SAK ETAP untuk pertanggungjawaban RAT.
        </p>
      </div>

      <LaporanKeuanganClient 
        initialNeraca={initialNeraca} 
        initialLabaRugi={initialLabaRugi}
        initialArusKas={initialArusKas}
        initialPerubahanEkuitas={initialPerubahanEkuitas}
        initialYear={currentYear} 
        templateConfig={templateConfig}
      />
    </div>
  )
}

