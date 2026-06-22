import { getLaporanHarian } from "@/lib/actions/laporan-harian"
import { LaporanHarianClient } from "./laporan-harian-client"
import { getReportTemplateConfig } from "@/lib/actions/settings"

export default async function LaporanHarianPage({
  searchParams
}: {
  searchParams: Promise<{ from?: string; to?: string; q?: string }>
}) {
  const sp = await searchParams
  const from = sp?.from || ""
  const to = sp?.to || ""
  const q = sp?.q || ""

  const data = await getLaporanHarian(from, to, q)
  const templateConfig = await getReportTemplateConfig()

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Laporan Harian Toko</h1>
        <p className="text-muted-foreground">Ringkasan transaksi POS berdasarkan rentang waktu.</p>
      </div>
      <LaporanHarianClient data={data} from={from} to={to} q={q} templateConfig={templateConfig} />
    </div>
  )
}
