import { getMonthlyDeductionReport } from "@/lib/actions/reports"
import { ReportClient } from "./report-client"
import { getReportTemplateConfig } from "@/lib/actions/settings"
import { getPendingPayrollBatches } from "@/lib/actions/payroll"
import { PayrollDraftBanner } from "./payroll-draft-banner"

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
  const pendingDraftsRaw = await getPendingPayrollBatches()
  // Serialisasi: BigInt & Decimal dari Prisma tidak bisa langsung dikirim
  // dari Server Component ke Client Component, harus dikonversi dulu.
  const pendingDrafts = pendingDraftsRaw.map((d: any) => ({
    id: d.id.toString(),
    period_code: d.period_code,
    eligible_members: d.eligible_members,
    sw_total_estimate: Number(d.sw_total_estimate),
    loan_schedule_count: d.loan_schedule_count,
    loan_total_estimate: Number(d.loan_total_estimate),
    generated_by: d.generated_by,
  }))

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Laporan Potongan Gaji</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {from && to ? `Periode: ${from} s/d ${to}` : "Periode: Bulan Ini"}
          {" · "} Mencakup: Cicilan Pinjaman (Uang / Barang / Kilat), Bayar Tempo, Simpanan Wajib, Simpanan Salary Cut
        </p>
      </div>

      <PayrollDraftBanner drafts={pendingDrafts} />

      <ReportClient data={data} from={from} to={to} q={q} templateConfig={templateConfig} />
    </div>
  )
}
