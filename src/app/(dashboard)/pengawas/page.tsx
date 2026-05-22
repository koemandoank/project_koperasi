import { getFinancialRatios, getLoanCollectibility } from "@/lib/actions/pengawas"
import { getReportTemplateConfig } from "@/lib/actions/settings"
import { PengawasClient } from "./pengawas-client"

/**
 * Server page untuk Portal Pengawas Koperasi.
 * Mengambil data rasio keuangan dan kolektibilitas pinjaman secara paralel.
 *
 * @returns {JSX.Element} Halaman dashboard pengawas
 */
export default async function PengawasPage() {
  const currentYear = new Date().getFullYear()

  let ratios = null
  let collectibility = null
  let templateConfig = null

  try {
    ;[ratios, collectibility, templateConfig] = await Promise.all([
      getFinancialRatios(currentYear),
      getLoanCollectibility(),
      getReportTemplateConfig(),
    ])
  } catch (error) {
    console.error("Error loading pengawas page:", error)
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Portal Pengawas Koperasi</h1>
        <p className="text-muted-foreground">
          Dashboard analisis kesehatan keuangan, rasio koperasi, dan kolektibilitas pinjaman anggota.
        </p>
      </div>

      <PengawasClient
        initialRatios={ratios}
        initialCollectibility={collectibility}
        initialYear={currentYear}
        templateConfig={templateConfig}
      />
    </div>
  )
}
