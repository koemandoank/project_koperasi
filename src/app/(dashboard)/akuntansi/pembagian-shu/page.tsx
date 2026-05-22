import { getSHUProjection } from "@/lib/actions/shu-calculation"
import { PembagianShuClient } from "./pembagian-shu-client"

export default async function PembagianShuPage() {
  const currentYear = new Date().getFullYear()

  let initialReport = null
  try {
    initialReport = await getSHUProjection(currentYear)
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
      />
    </div>
  )
}
