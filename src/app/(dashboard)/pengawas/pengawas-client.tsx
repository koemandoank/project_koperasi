"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getFinancialRatios, getLoanCollectibility, FinancialRatios, LoanCollectibilityReport } from "@/lib/actions/pengawas"
import { toast } from "sonner"
import {
  ShieldCheck, TrendingUp, AlertTriangle, CheckCircle, XCircle,
  Banknote, BarChart3, Users, RefreshCw
} from "lucide-react"
import { Button } from "@/components/ui/button"

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  initialRatios: FinancialRatios | null
  initialCollectibility: LoanCollectibilityReport | null
  initialYear: number
  templateConfig?: any
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val)

const formatPercent = (val: number) =>
  `${val.toFixed(2)}%`

type HealthStatus = "sehat" | "cukup" | "rendah" | "tinggi" | "buruk"

const healthConfig: Record<HealthStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  sehat: { label: "SEHAT", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800", icon: CheckCircle },
  cukup: { label: "CUKUP", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800", icon: AlertTriangle },
  rendah: { label: "RENDAH", color: "text-rose-700 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800", icon: XCircle },
  tinggi: { label: "TINGGI", color: "text-rose-700 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800", icon: XCircle },
  buruk: { label: "BURUK", color: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800", icon: XCircle },
}

const collectibilityColor: Record<string, string> = {
  "Lancar": "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  "Kurang Lancar": "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  "Diragukan": "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400",
  "Macet": "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400",
}

// ─────────────────────────────────────────────────────────────────────────────
// RASIO CARD COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface RatioCardProps {
  title: string
  value: string
  description: string
  benchmark: string
  health: HealthStatus
  icon: React.ElementType
  detail1?: string
  detail2?: string
}

function RatioCard({ title, value, description, benchmark, health, icon: Icon, detail1, detail2 }: RatioCardProps) {
  const cfg = healthConfig[health]
  const HealthIcon = cfg.icon

  return (
    <Card className={`border shadow-sm rounded-2xl ${cfg.bg}`}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/50 shadow-sm">
              <Icon className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
              <p className={`text-2xl font-extrabold ${cfg.color}`}>{value}</p>
            </div>
          </div>
          <div className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-white/60 dark:bg-slate-900/40 ${cfg.color}`}>
            <HealthIcon className="h-3.5 w-3.5" />
            {cfg.label}
          </div>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400">{description}</p>
        <div className="bg-white/60 dark:bg-slate-900/30 rounded-lg p-2 space-y-1 text-xs">
          <p className="text-slate-500 font-medium">Benchmark: <span className="text-slate-700 dark:text-slate-300">{benchmark}</span></p>
          {detail1 && <p className="text-slate-500">{detail1}</p>}
          {detail2 && <p className="text-slate-500">{detail2}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CLIENT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Client component untuk Portal Pengawas Koperasi.
 * Menampilkan 4 rasio keuangan utama dan tabel kolektibilitas pinjaman.
 *
 * @param {Props} props - Props dari server page
 * @returns {JSX.Element} Dashboard pengawas
 */
export function PengawasClient({ initialRatios, initialCollectibility, initialYear, templateConfig }: Props) {
  const [year, setYear] = useState(initialYear.toString())
  const [ratios, setRatios] = useState<FinancialRatios | null>(initialRatios)
  const [collectibility, setCollectibility] = useState<LoanCollectibilityReport | null>(initialCollectibility)
  const [loading, setLoading] = useState(false)

  const handleYearChange = async (selectedYear: string | null) => {
    if (!selectedYear) return
    setYear(selectedYear)
    setLoading(true)
    try {
      const y = parseInt(selectedYear)
      const [rData, cData] = await Promise.all([
        getFinancialRatios(y),
        getLoanCollectibility(),
      ])
      setRatios(rData)
      setCollectibility(cData)
      toast.success(`Data pengawas tahun ${selectedYear} berhasil dimuat.`)
    } catch (error) {
      console.error(error)
      toast.error("Gagal memuat data analisis keuangan.")
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshCollectibility = async () => {
    setLoading(true)
    try {
      const cData = await getLoanCollectibility()
      setCollectibility(cData)
      toast.success("Data kolektibilitas pinjaman diperbarui.")
    } catch (error) {
      console.error(error)
      toast.error("Gagal memperbarui kolektibilitas.")
    } finally {
      setLoading(false)
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString())

  return (
    <div className="space-y-6">
      {/* Kontrol */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-violet-500" />
          <span className="font-semibold text-sm text-slate-600 dark:text-slate-300">Tahun Analisis:</span>
          <Select value={year} onValueChange={handleYearChange} disabled={loading}>
            <SelectTrigger className="w-[120px] rounded-xl h-10">
              <SelectValue placeholder="Pilih Tahun" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          onClick={handleRefreshCollectibility}
          disabled={loading}
          className="rounded-xl h-10 flex items-center gap-2 text-sm"
          id="refresh-collectibility-btn"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Perbarui Kolektibilitas
        </Button>
      </div>

      {/* 4 Kartu Rasio */}
      {ratios && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <RatioCard
              title="Current Ratio"
              value={formatPercent(ratios.currentRatio)}
              description="Kemampuan koperasi memenuhi kewajiban jangka pendek dari aset lancar."
              benchmark="≥ 200% = Sehat"
              health={ratios.health.currentRatio}
              icon={BarChart3}
              detail1={`Aset Lancar: ${formatCurrency(ratios.totalAsetLancar)}`}
              detail2={`Kwjb. Lancar: ${formatCurrency(ratios.totalKewajibanLancar)}`}
            />
            <RatioCard
              title="DER (Solvabilitas)"
              value={formatPercent(ratios.derRatio)}
              description="Rasio total utang terhadap total ekuitas. Semakin rendah semakin sehat."
              benchmark="< 100% = Sehat"
              health={ratios.health.derRatio}
              icon={Banknote}
              detail1={`Total Kwjb: ${formatCurrency(ratios.totalKewajiban)}`}
              detail2={`Total Ekuitas: ${formatCurrency(ratios.totalEkuitas)}`}
            />
            <RatioCard
              title="NPL (Non-Performing Loan)"
              value={formatPercent(ratios.nplRatio)}
              description="Persentase pinjaman bermasalah (terlambat) dari total pinjaman aktif."
              benchmark="< 5% = Sehat"
              health={ratios.health.nplRatio}
              icon={AlertTriangle}
              detail1={`Total NPL: ${formatCurrency(ratios.totalPinjamanNPL)}`}
              detail2={`Total Pinjaman Aktif: ${formatCurrency(ratios.totalPinjamanAktif)}`}
            />
            <RatioCard
              title="ROE (Return on Equity)"
              value={formatPercent(ratios.roeRatio)}
              description="Tingkat pengembalian SHU bersih terhadap total ekuitas/modal koperasi."
              benchmark="≥ 10% = Sehat"
              health={ratios.health.roeRatio}
              icon={TrendingUp}
              detail1={`SHU Bersih: ${formatCurrency(ratios.shuBersih)}`}
              detail2={`Total Ekuitas: ${formatCurrency(ratios.totalEkuitas)}`}
            />
          </div>

          {/* Ringkasan Keuangan */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Aset Lancar", value: formatCurrency(ratios.totalAsetLancar), color: "text-indigo-600" },
              { label: "Total Kewajiban", value: formatCurrency(ratios.totalKewajiban), color: "text-amber-600" },
              { label: "Total Ekuitas", value: formatCurrency(ratios.totalEkuitas), color: "text-emerald-600" },
              { label: "SHU Bersih Tahun Ini", value: formatCurrency(ratios.shuBersih), color: "text-violet-600" },
            ].map((item) => (
              <Card key={item.label} className="border border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">{item.label}</p>
                  <p className={`text-base font-extrabold mt-1 ${item.color}`}>{item.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Tabel Kolektibilitas */}
      {collectibility && (
        <Card className="border border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl">
          <CardHeader className="bg-slate-50 dark:bg-slate-900 rounded-t-2xl p-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span className="bg-rose-100 dark:bg-rose-950 text-rose-600 p-1.5 rounded-lg">
                    <Users className="h-4 w-4" />
                  </span>
                  Analisis Kolektibilitas Pinjaman
                </CardTitle>
                <CardDescription>
                  Klasifikasi DPD (Days Past Due) seluruh pinjaman aktif · Total: {collectibility.total} debitur
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: `Lancar (${collectibility.lancar})`, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400" },
                  { label: `Kurang Lancar (${collectibility.kurangLancar})`, color: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400" },
                  { label: `Diragukan (${collectibility.diragukan})`, color: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400" },
                  { label: `Macet (${collectibility.macet})`, color: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400" },
                ].map((b) => (
                  <Badge key={b.label} className={`${b.color} border-0 font-semibold text-xs px-3 py-1`}>{b.label}</Badge>
                ))}
              </div>
            </div>

            {/* Ringkasan Nilai per Kategori */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              {[
                { label: "Nilai Lancar", value: collectibility.totalNilaiLancar, color: "text-emerald-600" },
                { label: "Nilai Kurang Lancar", value: collectibility.totalNilaiKurangLancar, color: "text-amber-600" },
                { label: "Nilai Diragukan", value: collectibility.totalNilaiDiragukan, color: "text-orange-600" },
                { label: "Nilai Macet (NPL)", value: collectibility.totalNilaiMacet, color: "text-rose-600" },
              ].map((s) => (
                <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
                  <p className="text-xs text-slate-400 font-medium">{s.label}</p>
                  <p className={`text-sm font-extrabold ${s.color}`}>{formatCurrency(s.value)}</p>
                </div>
              ))}
            </div>
          </CardHeader>

          <CardContent className="p-0 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-900">
                  <TableHead className="px-4 py-3 font-bold text-xs uppercase tracking-wider">No. Pinjaman</TableHead>
                  <TableHead className="px-4 py-3 font-bold text-xs uppercase tracking-wider">Anggota</TableHead>
                  <TableHead className="px-4 py-3 font-bold text-xs uppercase tracking-wider text-right">Outstanding</TableHead>
                  <TableHead className="px-4 py-3 font-bold text-xs uppercase tracking-wider text-right">Total Overdue</TableHead>
                  <TableHead className="px-4 py-3 font-bold text-xs uppercase tracking-wider text-center">DPD (Hari)</TableHead>
                  <TableHead className="px-4 py-3 font-bold text-xs uppercase tracking-wider text-center">Kolektibilitas</TableHead>
                  <TableHead className="px-4 py-3 font-bold text-xs uppercase tracking-wider text-center">Angsuran Telat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collectibility.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                      Tidak ada pinjaman aktif saat ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  collectibility.items.map((item) => (
                    <TableRow
                      key={item.loanId}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/50 ${item.kategori === "Macet" ? "bg-rose-50/20 dark:bg-rose-950/10" : ""}`}
                    >
                      <TableCell className="px-4 py-3 font-mono text-xs font-medium text-slate-700 dark:text-slate-300">{item.loanNo}</TableCell>
                      <TableCell className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{item.memberName}</p>
                          <p className="text-xs text-slate-400">{item.memberCode}</p>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(item.outstandingPrincipal)}</TableCell>
                      <TableCell className="px-4 py-3 text-right font-semibold text-rose-600 dark:text-rose-400">
                        {item.totalOverdue > 0 ? formatCurrency(item.totalOverdue) : <span className="text-slate-400">-</span>}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-center">
                        {item.dpd === 0 ? (
                          <span className="text-emerald-600 font-bold">0</span>
                        ) : (
                          <span className={`font-bold ${item.dpd > 180 ? "text-rose-600" : item.dpd > 90 ? "text-orange-500" : "text-amber-600"}`}>
                            {item.dpd}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-center">
                        <Badge className={`${collectibilityColor[item.kategori]} border-0 font-semibold text-xs`}>
                          {item.kategori}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-center text-sm text-slate-600 dark:text-slate-400">
                        {item.overdueInstallments > 0 ? (
                          <span className="font-bold text-rose-500">{item.overdueInstallments} angsuran</span>
                        ) : (
                          <span className="text-emerald-500">Tepat waktu</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {!ratios && !collectibility && (
        <div className="text-center py-16 text-slate-400">
          <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Data pengawas tidak tersedia. Periksa koneksi database.</p>
        </div>
      )}
    </div>
  )
}
