import { getReportTemplateConfig } from "@/lib/actions/settings"
import { checkRole } from "@/lib/auth-helpers"
import { KopSuratClient } from "./kop-surat-client"

export default async function KopSuratPage() {
  await checkRole(["superadmin", "admin", "pengurus"])
  const config = await getReportTemplateConfig()

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Kop & TTD Laporan</h1>
          <p className="text-sm text-slate-500">Sesuaikan logo, informasi Kop Surat resmi, serta pejabat penanda tangan pada semua dokumen PDF dan Excel koperasi.</p>
        </div>
        <KopSuratClient initialConfig={config} />
      </div>
    </div>
  )
}
