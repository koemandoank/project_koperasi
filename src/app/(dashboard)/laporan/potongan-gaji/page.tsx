import { getMonthlyDeductionReport } from "@/lib/actions/reports"
import { ReportClient } from "./report-client"
import { getReportTemplateConfig } from "@/lib/actions/settings"

export default async function PotonganGajiPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; q?: string }
}) {
  // Next.js 15: searchParams is a Promise
  const sp = await searchParams
  const from = sp?.from || ""
  const to = sp?.to || ""
  const q = sp?.q || ""

  const data = await getMonthlyDeductionReport(from, to, q)
  const templateConfig = await getReportTemplateConfig()

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Laporan Potongan Gaji</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {from && to ? `Periode: ${from} s/d ${to}` : "Periode: Bulan Ini"}
          {" · "} Mencakup: Cicilan Pinjaman (Uang / Barang / Kilat), Pay Later, Simpanan Wajib, Simpanan Salary Cut
        </p>
      </div>

      <ReportClient data={data} from={from} to={to} q={q} templateConfig={templateConfig} />
    </div>
  )
}
