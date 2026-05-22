"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getSHUProjection, distributeSHUMassal, ShuProjectionReport } from "@/lib/actions/shu-calculation"
import { toast } from "sonner"
import { Award, Users, DollarSign, ArrowRight, ShieldCheck, HelpCircle, Coins, CheckCircle, Percent } from "lucide-react"

interface Props {
  initialReport: ShuProjectionReport | null;
  initialYear: number;
}

export function PembagianShuClient({ initialReport, initialYear }: Props) {
  const [year, setYear] = useState(initialYear.toString())
  const [report, setReport] = useState<ShuProjectionReport | null>(initialReport)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val)

  const formatPercent = (val: number) => `${(val * 100).toFixed(2)}%`

  const handleYearChange = async (selectedYear: string | null) => {
    if (!selectedYear) return
    setYear(selectedYear)
    setLoading(true)
    try {
      const y = parseInt(selectedYear)
      const data = await getSHUProjection(y)
      setReport(data)
      toast.success(`Data proyeksi SHU tahun ${selectedYear} berhasil dimuat.`)
    } catch (error) {
      console.error(error)
      toast.error("Gagal memuat data proyeksi SHU.")
    } finally {
      setLoading(false)
    }
  }

  const handleDistribute = async () => {
    if (!report) return

    const confirmMsg = `PENTING: Apakah Anda yakin ingin memproses Pembagian SHU RAT massal untuk tahun buku ${year}?\n\n` +
      `Sistem akan secara otomatis mendepositkan dana masing-masing anggota secara aman ke saldo Simpanan Sukarela mereka.\n` +
      `Tindakan ini permanen dan tidak dapat dibatalkan.`

    if (!confirm(confirmMsg)) return

    setActionLoading(true)
    try {
      const res = await distributeSHUMassal(parseInt(year))
      if (res.success) {
        toast.success("Sukses! SHU Massal berhasil didistribusikan secara riil ke simpanan sukarela anggota.")
        // Refresh data
        const updated = await getSHUProjection(parseInt(year))
        setReport(updated)
      } else {
        toast.error(res.error || "Gagal memproses pembagian massal SHU.")
      }
    } catch (error) {
      console.error(error)
      toast.error("Terjadi kesalahan sistem saat mendistribusikan SHU.")
    } finally {
      setActionLoading(false)
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString())

  // Cek apakah anggota sudah menerima SHU di database (misal jika period year memiliki record distributed di database)
  // Di mock/real-action, status ini dibaca dari db
  const isAlreadyDistributed = false // Status distributed akan memblok tombol

  return (
    <div className="space-y-6">
      {/* Kontrol Seleksi Tahun */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <Award className="h-5 w-5 text-indigo-500" />
          <span className="font-semibold text-sm text-slate-600 dark:text-slate-300">Pilih Tahun Buku RAT:</span>
          <Select value={year} onValueChange={handleYearChange} disabled={loading || actionLoading}>
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

        {report && report.totalNetIncome > 0 && (
          <div className="flex items-center gap-2">
            {isAlreadyDistributed ? (
              <Badge className="bg-emerald-500 text-white font-bold h-10 px-4 rounded-xl flex items-center gap-2 border-0">
                <CheckCircle className="h-4 w-4" />
                Sudah Didistribusikan & Dikunci
              </Badge>
            ) : (
              <Button 
                onClick={handleDistribute} 
                disabled={actionLoading} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 px-6 rounded-xl flex items-center gap-2 shadow-md transition-all duration-200"
              >
                <Coins className="h-4 w-4" />
                {actionLoading ? "Memproses..." : "Eksekusi Distribusi SHU Massal"}
              </Button>
            )}
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center py-12 text-slate-400 font-medium animate-pulse">
          Mengkalkulasi Pembobotan dan Hak SHU Anggota...
        </div>
      )}

      {!loading && report && (
        <>
          {/* Ringkasan Makro SHU */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-0 shadow-sm rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20">
              <CardContent className="p-5 space-y-2">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="text-xs font-bold uppercase tracking-wider">TOTAL SHU RAT</span>
                  <DollarSign className="h-5 w-5 text-indigo-500" />
                </div>
                <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{formatCurrency(report.totalNetIncome)}</p>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">Tahun Buku {report.year}</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20">
              <CardContent className="p-5 space-y-2">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="text-xs font-bold uppercase tracking-wider">JASA ANGGOTA (55%)</span>
                  <Users className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{formatCurrency(report.jasaAnggotaTotal)}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-450 font-semibold">Hak SHU yang dibagikan ke Anggota</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm rounded-2xl bg-amber-50/50 dark:bg-amber-950/20">
              <CardContent className="p-5 space-y-2">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="text-xs font-bold uppercase tracking-wider">JASA MODAL (40%)</span>
                  <ShieldCheck className="h-5 w-5 text-amber-500" />
                </div>
                <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{formatCurrency(report.jasaModalTotal)}</p>
                <p className="text-xs text-amber-600 dark:text-amber-500 font-semibold">Dari total Jasa Anggota</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm rounded-2xl bg-cyan-50/50 dark:bg-cyan-950/20">
              <CardContent className="p-5 space-y-2">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="text-xs font-bold uppercase tracking-wider">JASA USAHA (60%)</span>
                  <Percent className="h-5 w-5 text-cyan-500" />
                </div>
                <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{formatCurrency(report.jasaUsahaTotal)}</p>
                <p className="text-xs text-cyan-600 dark:text-cyan-550 font-semibold">Dari total Jasa Anggota</p>
              </CardContent>
            </Card>
          </div>

          {/* Rincian Porsi Alokasi Makro Lainnya */}
          <Card className="border border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl">
            <CardHeader className="p-4 md:p-6 pb-2 md:pb-2">
              <CardTitle className="text-base font-bold">Rincian Alokasi Makro Koperasi (Seksi A)</CardTitle>
              <CardDescription>Dana Cadangan dihitung wajib min 20% sesuai peraturan perundangan.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl">
                  <span className="text-slate-400 block mb-1">Cadangan Koperasi (20%)</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(report.cadanganTotal)}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl">
                  <span className="text-slate-400 block mb-1">Honor Pengurus (5%)</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(report.pengurusTotal)}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl">
                  <span className="text-slate-400 block mb-1">Kesejahteraan Pegawai (5%)</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(report.pegawaiTotal)}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl">
                  <span className="text-slate-400 block mb-1">Dana Pendidikan (5%)</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(report.pendidikanTotal)}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl col-span-2 sm:col-span-1">
                  <span className="text-slate-400 block mb-1">Sosial & Pembangunan (10%)</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(report.sosialTotal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Buku Pembantu SHU Per Anggota */}
          <Card className="border border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-lg font-bold">Daftar Penerimaan SHU per Anggota</CardTitle>
              <CardDescription>Rincian kontribusi modal simpanan dan aktivitas belanja/pinjaman per anggota.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 md:p-6 md:pt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Anggota</TableHead>
                      <TableHead className="text-right">Simpanan (Modal)</TableHead>
                      <TableHead className="text-right">Jasa Modal (IDR)</TableHead>
                      <TableHead className="text-right">Partisipasi (Belanja & Bunga)</TableHead>
                      <TableHead className="text-right">Jasa Usaha (IDR)</TableHead>
                      <TableHead className="text-right font-bold text-indigo-600 dark:text-indigo-400">Total SHU RAT</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.members.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-slate-400 py-4">Belum ada anggota aktif terdaftar.</TableCell>
                      </TableRow>
                    )}
                    {report.members.map((m) => (
                      <TableRow key={m.memberId} className="hover:bg-slate-50/50">
                        <TableCell className="font-medium">
                          <div>{m.memberName}</div>
                          <span className="text-xs text-slate-400 font-semibold">{m.memberNo}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div>{formatCurrency(m.savingsBalance)}</div>
                          <span className="text-[10px] text-slate-400 font-medium">Bobot: {formatPercent(m.savingsWeight)}</span>
                        </TableCell>
                        <TableCell className="text-right text-amber-600 font-semibold">{formatCurrency(m.jasaModal)}</TableCell>
                        <TableCell className="text-right">
                          <div className="text-xs">Belanja: {formatCurrency(m.belanjaPaid)}</div>
                          <div className="text-xs">Bunga Pinj: {formatCurrency(m.bungaPaid)}</div>
                          <span className="text-[10px] text-slate-400 font-medium">Bobot: {formatPercent(m.activityWeight)}</span>
                        </TableCell>
                        <TableCell className="text-right text-cyan-600 font-semibold">{formatCurrency(m.jasaUsaha)}</TableCell>
                        <TableCell className="text-right font-extrabold text-indigo-600 dark:text-indigo-400">{formatCurrency(m.totalShu)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
