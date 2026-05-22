"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getNeraca, getLabaRugi } from "@/lib/actions/laporan-keuangan"
import { NeracaReport, LabaRugiReport } from "@/lib/types/laporan-keuangan.types"
import { toast } from "sonner"
import { Printer, Scale, TrendingUp, DollarSign, BookOpen, AlertTriangle } from "lucide-react"

interface Props {
  initialNeraca: NeracaReport | null;
  initialLabaRugi: LabaRugiReport | null;
  initialYear: number;
}

export function LaporanKeuanganClient({ initialNeraca, initialLabaRugi, initialYear }: Props) {
  const [year, setYear] = useState(initialYear.toString())
  const [neraca, setNeraca] = useState<NeracaReport | null>(initialNeraca)
  const [labaRugi, setLabaRugi] = useState<LabaRugiReport | null>(initialLabaRugi)
  const [loading, setLoading] = useState(false)

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val)

  const handleYearChange = async (selectedYear: string | null) => {
    if (!selectedYear) return
    setYear(selectedYear)
    setLoading(true)
    try {
      const y = parseInt(selectedYear)
      const nData = await getNeraca(y)
      const lrData = await getLabaRugi(y)
      setNeraca(nData)
      setLabaRugi(lrData)
      toast.success(`Data tahun ${selectedYear} berhasil dimuat.`)
    } catch (error) {
      console.error(error)
      toast.error("Gagal memuat data laporan keuangan.")
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString())

  return (
    <div className="space-y-6 print:space-y-4 print:p-0">
      {/* Kontrol & Seleksi Tahun */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-indigo-500" />
          <span className="font-semibold text-sm text-slate-600 dark:text-slate-300">Tahun Buku Laporan:</span>
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

        <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl flex items-center gap-2">
          <Printer className="h-4 w-4" />
          Cetak Laporan Keuangan
        </Button>
      </div>

      {loading && (
        <div className="text-center py-12 text-slate-400 font-medium animate-pulse">
          Mengkalkulasi Laporan Keuangan Standard...
        </div>
      )}

      {!loading && neraca && labaRugi && (
        <Tabs defaultValue="neraca" className="w-full space-y-6">
          <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl h-11 w-full sm:w-auto flex print:hidden">
            <TabsTrigger value="neraca" className="rounded-lg font-medium flex items-center gap-2 px-6 h-9">
              <Scale className="h-4 w-4" />
              Neraca (Balance Sheet)
            </TabsTrigger>
            <TabsTrigger value="labarugi" className="rounded-lg font-medium flex items-center gap-2 px-6 h-9">
              <TrendingUp className="h-4 w-4" />
              Laba Rugi (Perhitungan Hasil Usaha)
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: NERACA */}
          <TabsContent value="neraca" className="space-y-6">
            {/* Indikator Balance Sheet */}
            <div className="print:hidden">
              {neraca.variance === 0 ? (
                <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 p-4 rounded-xl">
                  <Badge variant="outline" className="bg-emerald-500 text-white border-0 font-bold px-3 py-1">Balanced</Badge>
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                    Sistem mendeteksi bahwa Persamaan Dasar Akuntansi seimbang (Asset = Kewajiban + Ekuitas). Deviasi: Rp 0.00
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 p-4 rounded-xl">
                  <Badge variant="destructive" className="font-bold px-3 py-1">Imbalanced</Badge>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Terdapat deviasi balance sebesar {formatCurrency(neraca.variance)}. Silakan cek transaksi manual.
                  </p>
                </div>
              )}
            </div>

            <div className="grid gap-6 md:grid-cols-2 print:grid-cols-2">
              {/* Kolom Kiri: Aset */}
              <Card className="border border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl">
                <CardHeader className="bg-slate-50 dark:bg-slate-900 rounded-t-2xl p-4 md:p-6 border-b border-slate-100 dark:border-slate-850">
                  <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <span className="bg-indigo-100 dark:bg-indigo-950 text-indigo-600 p-1.5 rounded-lg"><DollarSign className="h-4 w-4" /></span>
                    1. ASET (AKTIVA)
                  </CardTitle>
                  <CardDescription>Rincian kekayaan dan sumber daya ekonomi koperasi.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6 space-y-6">
                  {/* Aset Lancar */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-extrabold tracking-wider text-slate-400">ASET LANCAR</h3>
                    <Table>
                      <TableBody>
                        {neraca.assets.currentAssets.map((item) => (
                          <TableRow key={item.id} className="hover:bg-slate-50/50">
                            <TableCell className="py-2.5 font-medium text-slate-600 dark:text-slate-350">{item.code} - {item.name}</TableCell>
                            <TableCell className="py-2.5 text-right font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(item.balance)}</TableCell>
                          </TableRow>
                        ))}
                        {neraca.assets.currentAssets.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center py-4 text-slate-400">Tidak ada data aset lancar.</TableCell>
                          </TableRow>
                        )}
                        <TableRow className="bg-indigo-50/30 dark:bg-indigo-950/20 font-bold border-t border-indigo-100/50">
                          <TableCell className="py-3 text-indigo-700 dark:text-indigo-400">Total Aset Lancar</TableCell>
                          <TableCell className="py-3 text-right text-indigo-700 dark:text-indigo-400">{formatCurrency(neraca.assets.totalCurrentAssets)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {/* Aset Tetap */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-extrabold tracking-wider text-slate-400">ASET TETAP</h3>
                    <Table>
                      <TableBody>
                        {neraca.assets.fixedAssets.map((item) => (
                          <TableRow key={item.id} className="hover:bg-slate-50/50">
                            <TableCell className="py-2.5 font-medium text-slate-600 dark:text-slate-350">{item.code} - {item.name}</TableCell>
                            <TableCell className="py-2.5 text-right font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(item.balance)}</TableCell>
                          </TableRow>
                        ))}
                        {neraca.assets.fixedAssets.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center py-4 text-slate-400">Tidak ada data aset tetap.</TableCell>
                          </TableRow>
                        )}
                        <TableRow className="bg-indigo-50/30 dark:bg-indigo-950/20 font-bold border-t border-indigo-100/50">
                          <TableCell className="py-3 text-indigo-700 dark:text-indigo-400">Total Aset Tetap</TableCell>
                          <TableCell className="py-3 text-right text-indigo-700 dark:text-indigo-400">{formatCurrency(neraca.assets.totalFixedAssets)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  <div className="bg-indigo-600 text-white rounded-xl p-4 flex justify-between items-center shadow-sm">
                    <span className="font-extrabold text-base">TOTAL ASET</span>
                    <span className="font-extrabold text-lg">{formatCurrency(neraca.assets.totalAssets)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Kolom Kanan: Kewajiban & Ekuitas */}
              <div className="space-y-6">
                {/* Kewajiban Card */}
                <Card className="border border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl">
                  <CardHeader className="bg-slate-50 dark:bg-slate-900 rounded-t-2xl p-4 md:p-6 border-b border-slate-100 dark:border-slate-850">
                    <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <span className="bg-amber-100 dark:bg-amber-950/50 text-amber-600 p-1.5 rounded-lg"><Scale className="h-4 w-4" /></span>
                      2. KEWAJIBAN (PASIVA)
                    </CardTitle>
                    <CardDescription>Kewajiban jangka pendek dan panjang koperasi kepada pihak ketiga.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 md:p-6 space-y-4">
                    <Table>
                      <TableBody>
                        <TableRow className="font-extrabold text-slate-400 border-0"><TableCell className="py-1 px-2" colSpan={2}>KEWAJIBAN JANGKA PENDEK</TableCell></TableRow>
                        {neraca.liabilities.currentLiabilities.map((item) => (
                          <TableRow key={item.id} className="hover:bg-slate-50/50 border-0">
                            <TableCell className="py-2 font-medium text-slate-600 dark:text-slate-350">{item.code} - {item.name}</TableCell>
                            <TableCell className="py-2 text-right font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(item.balance)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-extrabold text-slate-400 border-0 pt-4"><TableCell className="py-1 px-2" colSpan={2}>KEWAJIBAN JANGKA PANJANG</TableCell></TableRow>
                        {neraca.liabilities.longTermLiabilities.map((item) => (
                          <TableRow key={item.id} className="hover:bg-slate-50/50 border-0">
                            <TableCell className="py-2 font-medium text-slate-600 dark:text-slate-350">{item.code} - {item.name}</TableCell>
                            <TableCell className="py-2 text-right font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(item.balance)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-amber-50/30 dark:bg-amber-950/20 font-bold border-t border-amber-100/50">
                          <TableCell className="py-3 text-amber-700 dark:text-amber-500">Total Kewajiban</TableCell>
                          <TableCell className="py-3 text-right text-amber-700 dark:text-amber-500">{formatCurrency(neraca.liabilities.totalLiabilities)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Ekuitas Card */}
                <Card className="border border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl">
                  <CardHeader className="bg-slate-50 dark:bg-slate-900 rounded-t-2xl p-4 md:p-6 border-b border-slate-100 dark:border-slate-850">
                    <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <span className="bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 p-1.5 rounded-lg"><TrendingUp className="h-4 w-4" /></span>
                      3. EKUITAS (MODAL SENDIRI)
                    </CardTitle>
                    <CardDescription>Simpanan modal pokok, modal wajib, cadangan koperasi, dan SHU berjalan.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 md:p-6 space-y-4">
                    <Table>
                      <TableBody>
                        <TableRow className="font-extrabold text-slate-400 border-0"><TableCell className="py-1 px-2" colSpan={2}>SIMPANAN EKUITAS ANGGOTA</TableCell></TableRow>
                        {neraca.equity.memberSavings.map((item) => (
                          <TableRow key={item.id} className="hover:bg-slate-50/50 border-0">
                            <TableCell className="py-2 font-medium text-slate-600 dark:text-slate-350">{item.code} - {item.name}</TableCell>
                            <TableCell className="py-2 text-right font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(item.balance)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-extrabold text-slate-400 border-0"><TableCell className="py-1 px-2" colSpan={2}>DANA CADANGAN & LAINNYA</TableCell></TableRow>
                        {neraca.equity.reservesAndOthers.map((item) => (
                          <TableRow key={item.id} className="hover:bg-slate-50/50 border-0">
                            <TableCell className="py-2 font-medium text-slate-600 dark:text-slate-350">{item.code} - {item.name}</TableCell>
                            <TableCell className="py-2 text-right font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(item.balance)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="hover:bg-slate-50/50 border-0">
                          <TableCell className="py-2 font-semibold text-emerald-700 dark:text-emerald-450 italic">SHU Bersih Tahun Berjalan</TableCell>
                          <TableCell className="py-2 text-right font-bold text-emerald-700 dark:text-emerald-450">{formatCurrency(neraca.equity.currentShu)}</TableCell>
                        </TableRow>
                        <TableRow className="bg-emerald-50/30 dark:bg-emerald-950/20 font-bold border-t border-emerald-100/50">
                          <TableCell className="py-3 text-emerald-700 dark:text-emerald-500">Total Ekuitas</TableCell>
                          <TableCell className="py-3 text-right text-emerald-700 dark:text-emerald-500">{formatCurrency(neraca.equity.totalEquity)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>

                    <div className="bg-slate-800 text-white rounded-xl p-4 flex justify-between items-center shadow-sm dark:bg-slate-950">
                      <span className="font-extrabold text-base">TOTAL PASIVA (KEWAJIBAN & EKUITAS)</span>
                      <span className="font-extrabold text-lg">{formatCurrency(neraca.totalLiabilitiesAndEquity)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: LABA RUGI (PHU) */}
          <TabsContent value="labarugi">
            <Card className="border border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl max-w-4xl mx-auto">
              <CardHeader className="bg-slate-50 dark:bg-slate-900 rounded-t-2xl p-4 md:p-6 border-b border-slate-100 dark:border-slate-850">
                <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span className="bg-indigo-100 dark:bg-indigo-950 text-indigo-600 p-1.5 rounded-lg"><TrendingUp className="h-4 w-4" /></span>
                  PERHITUNGAN HASIL USAHA (PHU / LABA RUGI)
                </CardTitle>
                <CardDescription>Rincian pendapatan operasional koperasi, HPP, beban operasional, dan SHU bersih.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 space-y-6">
                {/* 1. PENDAPATAN */}
                <div className="space-y-3">
                  <h3 className="text-sm font-extrabold tracking-wider text-indigo-500">I. PENDAPATAN OPERASIONAL</h3>
                  <Table>
                    <TableBody>
                      <TableRow className="hover:bg-slate-50/50 border-0">
                        <TableCell className="py-2.5 font-medium text-slate-700 dark:text-slate-300 pl-4">Partisipasi Toko Waserda (POS & Online)</TableCell>
                        <TableCell className="py-2.5 text-right font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(labaRugi.revenue.storeRevenue)}</TableCell>
                      </TableRow>
                      <TableRow className="hover:bg-slate-50/50 border-0">
                        <TableCell className="py-2.5 font-medium text-slate-700 dark:text-slate-300 pl-4">Pendapatan Bunga Jasa Pinjaman Anggota</TableCell>
                        <TableCell className="py-2.5 text-right font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(labaRugi.revenue.loanInterestRevenue)}</TableCell>
                      </TableRow>
                      <TableRow className="hover:bg-slate-50/50 border-0">
                        <TableCell className="py-2.5 font-medium text-slate-700 dark:text-slate-300 pl-4">Pendapatan Denda Keterlambatan Pinjaman</TableCell>
                        <TableCell className="py-2.5 text-right font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(labaRugi.revenue.loanPenaltyRevenue)}</TableCell>
                      </TableRow>
                      <TableRow className="hover:bg-slate-50/50 border-0">
                        <TableCell className="py-2.5 font-medium text-slate-700 dark:text-slate-300 pl-4">Pendapatan Operasional Lainnya (Jurnal Umum)</TableCell>
                        <TableCell className="py-2.5 text-right font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(labaRugi.revenue.otherRevenue)}</TableCell>
                      </TableRow>
                      <TableRow className="bg-indigo-50/30 dark:bg-indigo-950/20 font-bold border-t border-indigo-100/50">
                        <TableCell className="py-3 text-indigo-700 dark:text-indigo-400">Total Pendapatan Kotor</TableCell>
                        <TableCell className="py-3 text-right text-indigo-700 dark:text-indigo-400">{formatCurrency(labaRugi.revenue.totalRevenue)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* 2. HPP */}
                <div className="space-y-3">
                  <h3 className="text-sm font-extrabold tracking-wider text-red-500">II. HARGA POKOK PENJUALAN (HPP)</h3>
                  <Table>
                    <TableBody>
                      <TableRow className="hover:bg-slate-50/50 border-0">
                        <TableCell className="py-2.5 font-medium text-slate-700 dark:text-slate-300 pl-4">HPP Toko Waserda (Harga Beli Produk Terjual)</TableCell>
                        <TableCell className="py-2.5 text-right font-semibold text-slate-800 dark:text-slate-100">({formatCurrency(labaRugi.cogs.storeCogs)})</TableCell>
                      </TableRow>
                      <TableRow className="bg-red-50/30 dark:bg-red-950/20 font-bold border-t border-red-100/50">
                        <TableCell className="py-3 text-red-700 dark:text-red-400">Total HPP</TableCell>
                        <TableCell className="py-3 text-right text-red-700 dark:text-red-400">({formatCurrency(labaRugi.cogs.totalCogs)})</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* LABA KOTOR */}
                <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-xl p-4 flex justify-between items-center font-bold text-slate-800 dark:text-slate-100 border border-indigo-100 dark:border-indigo-900">
                  <span>III. SISA HASIL USAHA KOTOR (LABA KOTOR)</span>
                  <span>{formatCurrency(labaRugi.grossProfit)}</span>
                </div>

                {/* 3. BEBAN OPERASIONAL */}
                <div className="space-y-3">
                  <h3 className="text-sm font-extrabold tracking-wider text-amber-500">IV. BEBAN OPERASIONAL KOPERASI</h3>
                  <Table>
                    <TableBody>
                      {labaRugi.expenses.operationalExpenses.map((item) => (
                        <TableRow key={item.id} className="hover:bg-slate-50/50 border-0">
                          <TableCell className="py-2.5 font-medium text-slate-700 dark:text-slate-300 pl-4">{item.code} - {item.name}</TableCell>
                          <TableCell className="py-2.5 text-right font-semibold text-slate-800 dark:text-slate-100">({formatCurrency(item.balance)})</TableCell>
                        </TableRow>
                      ))}
                      {labaRugi.expenses.operationalExpenses.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center py-4 text-slate-400">Tidak ada beban operasional tercatat.</TableCell>
                        </TableRow>
                      )}
                      <TableRow className="bg-amber-50/30 dark:bg-amber-950/20 font-bold border-t border-amber-100/50">
                        <TableCell className="py-3 text-amber-700 dark:text-amber-500">Total Beban Operasional</TableCell>
                        <TableCell className="py-3 text-right text-amber-700 dark:text-amber-500">({formatCurrency(labaRugi.expenses.totalExpenses)})</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* SHU BERSIH */}
                <div className="bg-emerald-600 text-white rounded-xl p-4 flex justify-between items-center shadow-md">
                  <span className="font-extrabold text-base">V. SISA HASIL USAHA BERSIH (SHU AKHIR RAT)</span>
                  <span className="font-extrabold text-xl">{formatCurrency(labaRugi.netShu)}</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
