"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getSHUProjection, ShuProjectionReport, MemberShuProjection } from "@/lib/actions/shu-calculation"
import { toast } from "sonner"
import { Search, Eye, Download, Users, Briefcase, Calculator, Layers, FileSpreadsheet } from "lucide-react"

interface Props {
  initialReport: ShuProjectionReport | null;
  initialYear: number;
}

export function PartisipasiClient({ initialReport, initialYear }: Props) {
  const [year, setYear] = useState(initialYear.toString())
  const [report, setReport] = useState<ShuProjectionReport | null>(initialReport)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedMember, setSelectedMember] = useState<MemberShuProjection | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val)

  const formatPercent = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(val)

  const handleYearChange = async (selectedYear: string | null) => {
    if (!selectedYear) return
    setYear(selectedYear)
    setLoading(true)
    try {
      const y = parseInt(selectedYear)
      const data = await getSHUProjection(y)
      setReport(data)
      toast.success(`Data partisipasi tahun ${selectedYear} berhasil dimuat.`)
    } catch (error) {
      console.error(error)
      toast.error("Gagal memuat data partisipasi.")
    } finally {
      setLoading(false)
    }
  }

  const handleInspect = (m: MemberShuProjection) => {
    setSelectedMember(m)
    setIsModalOpen(true)
  }

  const handleExportCSV = () => {
    if (!report) return

    // Bangun header dan baris CSV
    const headers = ["No Anggota", "Nama Anggota", "Simpanan Terhitung (IDR)", "Partisipasi Belanja (IDR)", "Partisipasi Bunga (IDR)", "Jasa Modal (IDR)", "Jasa Usaha (IDR)", "Total SHU Diterima (IDR)"]
    const rows = report.members.map((m) => [
      m.memberNo,
      m.memberName,
      m.savingsBalance,
      m.belanjaPaid,
      m.bungaPaid,
      m.jasaModal,
      m.jasaUsaha,
      m.totalShu,
    ])

    const csvContent = "data:text/csv;charset=utf-8," + 
      [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n")

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `Laporan_Partisipasi_RAT_${year}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("Laporan berhasil diekspor ke CSV.")
  }

  const filteredMembers = report
    ? report.members.filter(
        (m) =>
          m.memberName.toLowerCase().includes(search.toLowerCase()) ||
          m.memberNo.toLowerCase().includes(search.toLowerCase())
      )
    : []

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString())

  return (
    <div className="space-y-6">
      {/* Panel Kontrol Atas */}
      <div className="grid gap-4 md:grid-cols-[1fr_2fr] bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm items-center">
        <div className="flex items-center gap-3">
          <Calculator className="h-5 w-5 text-indigo-500" />
          <span className="font-semibold text-sm text-slate-600 dark:text-slate-300">Tahun RAT:</span>
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

        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <div className="relative w-full sm:w-[300px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Cari nama atau no anggota..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 rounded-xl"
            />
          </div>

          <Button variant="outline" size="sm" onClick={handleExportCSV} className="rounded-xl h-10 flex items-center gap-2">
            <Download className="h-4 w-4" />
            Ekspor CSV
          </Button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12 text-slate-400 font-medium animate-pulse">
          Memuat data partisipasi anggota...
        </div>
      )}

      {!loading && report && (
        <>
          {/* Ringkasan Makro Partisipasi */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl">
              <CardContent className="p-5 flex items-center gap-4">
                <span className="p-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 rounded-xl"><Users className="h-6 w-6" /></span>
                <div>
                  <p className="text-slate-400 text-xs font-semibold tracking-wider uppercase">JUMLAH ANGGOTA RAT</p>
                  <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{report.members.length} Orang</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl">
              <CardContent className="p-5 flex items-center gap-4">
                <span className="p-3 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-xl"><Briefcase className="h-6 w-6" /></span>
                <div>
                  <p className="text-slate-400 text-xs font-semibold tracking-wider uppercase">PARTISIPASI BELANJA ANGGOTA</p>
                  <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{formatCurrency(report.totalBelanjaSeluruh)}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl">
              <CardContent className="p-5 flex items-center gap-4">
                <span className="p-3 bg-amber-50 dark:bg-amber-950 text-amber-600 rounded-xl"><Layers className="h-6 w-6" /></span>
                <div>
                  <p className="text-slate-400 text-xs font-semibold tracking-wider uppercase">PARTISIPASI JASA PINJAMAN</p>
                  <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{formatCurrency(report.totalBungaSeluruh)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Buku Pembantu Table */}
          <Card className="border border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl">
            <CardHeader className="p-4 md:p-6 border-b border-slate-100 dark:border-slate-850">
              <CardTitle className="text-lg font-bold">Buku Bantu RAT Anggota</CardTitle>
              <CardDescription>Menampilkan rekapitulasi data partisipasi usaha dan hak SHU tahun {year}.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Anggota</TableHead>
                      <TableHead className="text-right">Simpanan Modal</TableHead>
                      <TableHead className="text-right">Partisipasi Belanja</TableHead>
                      <TableHead className="text-right">Partisipasi Jasa Bunga</TableHead>
                      <TableHead className="text-right font-bold text-indigo-600 dark:text-indigo-400">Total SHU Diterima</TableHead>
                      <TableHead className="text-center">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-slate-400 py-8">
                          Tidak menemukan data anggota yang dicari.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMembers.map((m) => (
                        <TableRow key={m.memberId} className="hover:bg-slate-50/50">
                          <TableCell className="font-medium py-3.5">
                            <div className="font-bold text-slate-800 dark:text-slate-150">{m.memberName}</div>
                            <span className="text-xs text-slate-400 font-semibold">{m.memberNo}</span>
                          </TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(m.savingsBalance)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(m.belanjaPaid)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(m.bungaPaid)}</TableCell>
                          <TableCell className="text-right font-extrabold text-indigo-600 dark:text-indigo-400">{formatCurrency(m.totalShu)}</TableCell>
                          <TableCell className="text-center py-3.5">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleInspect(m)}
                              className="h-8 w-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg dark:hover:bg-indigo-950/30"
                            >
                              <Eye className="h-4.5 w-4.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Modal Detail Partisipasi Anggota */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
              Detail Audit RAT Anggota
            </DialogTitle>
            <DialogDescription>
              Formulir pertanggungjawaban kontribusi simpan pinjam dan belanja toko untuk RAT.
            </DialogDescription>
          </DialogHeader>

          {selectedMember && (
            <div className="space-y-4 pt-4 text-sm">
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl space-y-1">
                <span className="text-slate-400 text-xs font-semibold">NAMA LENGKAP ANGGOTA</span>
                <p className="font-extrabold text-slate-800 dark:text-slate-100 text-base">{selectedMember.memberName}</p>
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">{selectedMember.memberNo}</span>
              </div>

              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">1. KONTRIBUSI MODAL</h4>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 font-medium">Simpanan Wajib & Pokok Terhitung</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{formatCurrency(selectedMember.savingsBalance)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 font-medium">Bobot Jasa Modal Anggota</span>
                  <span className="font-bold text-amber-600">{formatPercent(selectedMember.savingsWeight)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-indigo-600 font-bold">Hak Jasa Modal RAT</span>
                  <span className="font-extrabold text-amber-600">{formatCurrency(selectedMember.jasaModal)}</span>
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">2. KONTRIBUSI AKTIVITAS USAHA</h4>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 font-medium">Partisipasi Belanja Waserda</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{formatCurrency(selectedMember.belanjaPaid)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 font-medium">Partisipasi Bunga Pinjaman</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{formatCurrency(selectedMember.bungaPaid)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 font-medium">Bobot Partisipasi Usaha</span>
                  <span className="font-bold text-cyan-600">{formatPercent(selectedMember.activityWeight)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-indigo-600 font-bold">Hak Jasa Usaha RAT</span>
                  <span className="font-extrabold text-cyan-600">{formatCurrency(selectedMember.jasaUsaha)}</span>
                </div>
              </div>

              <div className="bg-indigo-600 text-white p-4 rounded-xl flex justify-between items-center shadow-md font-bold mt-4">
                <span>TOTAL SHU DITERIMA</span>
                <span className="text-lg">{formatCurrency(selectedMember.totalShu)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
