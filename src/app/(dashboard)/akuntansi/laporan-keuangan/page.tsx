import { getNeraca, getLabaRugi } from "@/lib/actions/laporan-keuangan"
import { LaporanKeuanganClient } from "./laporan-keuangan-client"

export default async function LaporanKeuanganPage() {
  const currentYear = new Date().getFullYear()
  
  let initialNeraca = null
  let initialLabaRugi = null
  
  try {
    initialNeraca = await getNeraca(currentYear)
    initialLabaRugi = await getLabaRugi(currentYear)
  } catch (error) {
    console.error("Error loading financial reports page:", error)
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Laporan Keuangan RAT</h1>
        <p className="text-muted-foreground">
          Laporan Neraca Standar (Double-Entry) dan Perhitungan Hasil Usaha (PHU / Laba Rugi) untuk pertanggungjawaban RAT.
        </p>
      </div>

      <LaporanKeuanganClient 
        initialNeraca={initialNeraca} 
        initialLabaRugi={initialLabaRugi} 
        initialYear={currentYear} 
      />
    </div>
  )
}
