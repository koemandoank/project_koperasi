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
import { Search, Eye, Download, Users, Briefcase, Calculator, Layers, FileSpreadsheet, FileText } from "lucide-react"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import ExcelJS from "exceljs"
import { saveAs } from "file-saver"
import { generatePdfHeader, generatePdfFooter, generateExcelHeader, generateExcelFooter } from "@/lib/report-helpers"

interface Props {
  initialReport: ShuProjectionReport | null;
  initialYear: number;
  templateConfig?: any;
}

interface Totals {
  savings: number;
  belanja: number;
  bunga: number;
  shu: number;
}

/**
 * Menghitung total simpanan, belanja, bunga, dan SHU dari list anggota.
 * 
 * @param {MemberShuProjection[]} members - Daftar anggota terproyeksi
 * @returns {Totals} Objek total akumulasi
 */
function calculateTotals(members: MemberShuProjection[]): Totals {
  return members.reduce(
    (acc, m) => {
      acc.savings += m.savingsBalance;
      acc.belanja += m.belanjaPaid;
      acc.bunga += m.bungaPaid;
      acc.shu += m.totalShu;
      return acc;
    },
    { savings: 0, belanja: 0, bunga: 0, shu: 0 }
  );
}

/**
 * Memetakan daftar anggota menjadi baris-baris data untuk PDF.
 * 
 * @param {MemberShuProjection[]} members - Daftar anggota
 * @returns {string[][]} Array baris data untuk PDF
 */
function getPDFRows(members: MemberShuProjection[]): string[][] {
  return members.map((m, idx) => [
    (idx + 1).toString(),
    m.memberNo,
    m.memberName,
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(m.savingsBalance),
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(m.belanjaPaid),
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(m.bungaPaid),
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(m.totalShu)
  ]);
}

export function PartisipasiClient({ initialReport, initialYear, templateConfig }: Props) {
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

  /**
   * Mengekspor data partisipasi anggota ke format PDF premium.
   * 
   * @returns {Promise<void>}
   * @throws {Error} Jika proses pembuatan PDF gagal
   */
  const handleExportPDF = async (): Promise<void> => {
    if (!report) {
      toast.error("Data partisipasi tidak tersedia.")
      return
    }

    try {
      const doc = new jsPDF()
      const title = "LAPORAN PARTISIPASI DAN DISTRIBUSI SHU RAT ANGGOTA"
      const subtitle = `Tahun Buku ${year}`
      const startY = generatePdfHeader(doc, title, subtitle, templateConfig)

      doc.setFontSize(11)
      doc.setFont("helvetica", "bold")
      doc.text("BUKU PEMBANTU PARTISIPASI SHU RAT ANGGOTA", 14, startY)

      const rows = getPDFRows(filteredMembers)
      const totals = calculateTotals(filteredMembers)

      rows.push([
        "",
        "TOTAL",
        "SELURUH ANGGOTA",
        formatCurrency(totals.savings),
        formatCurrency(totals.belanja),
        formatCurrency(totals.bunga),
        formatCurrency(totals.shu)
      ])

      autoTable(doc, {
        startY: startY + 4,
        head: [['No', 'No. Anggota', 'Nama Anggota', 'Simpanan Modal', 'Partisipasi Belanja', 'Jasa Bunga', 'Total SHU']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 25, halign: 'center' },
          2: { cellWidth: 45 },
          3: { cellWidth: 28, halign: 'right' },
          4: { cellWidth: 28, halign: 'right' },
          5: { cellWidth: 28, halign: 'right' },
          6: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
        },
        styles: { fontSize: 8 },
        didParseCell: (data) => {
          if (data.row.index === rows.length - 1) {
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.fillColor = [241, 245, 249]
          }
        }
      })

      const finalY = (doc as any).lastAutoTable.finalY
      generatePdfFooter(doc, finalY, templateConfig)

      doc.save(`Laporan_Partisipasi_RAT_${year}.pdf`)
      toast.success("Laporan PDF berhasil diexport.")
    } catch (error) {
      console.error("Gagal mengekspor PDF:", error)
      toast.error("Terjadi kesalahan saat memproses ekspor PDF.")
    }
  }

  /**
   * Mengekspor data partisipasi anggota ke format Excel premium (XLSX).
   * 
   * @returns {Promise<void>}
   * @throws {Error} Jika proses pembuatan Excel gagal
   */
  const handleExportExcel = async (): Promise<void> => {
    if (!report) {
      toast.error("Data partisipasi tidak tersedia.")
      return
    }

    try {
      const workbook = new ExcelJS.Workbook()
      const ws = workbook.addWorksheet("Partisipasi RAT Anggota")
      ws.views = [{ showGridLines: true }]

      ws.columns = [
        { key: 'A', width: 6 },
        { key: 'B', width: 15 },
        { key: 'C', width: 25 },
        { key: 'D', width: 20 },
        { key: 'E', width: 20 },
        { key: 'F', width: 20 },
        { key: 'G', width: 20 }
      ]

      const title = "LAPORAN PARTISIPASI DAN DISTRIBUSI SHU RAT ANGGOTA"
      const subtitle = `Tahun Buku ${year}`
      const startRow = generateExcelHeader(ws, title, subtitle, 7, templateConfig)
      let currentRow = startRow

      ws.mergeCells(`A${currentRow}:G${currentRow}`)
      ws.getCell(`A${currentRow}`).value = "BUKU PEMBANTU PARTISIPASI SHU RAT ANGGOTA"
      ws.getCell(`A${currentRow}`).font = { bold: true, size: 12 }
      currentRow += 2

      const headerRow = ws.getRow(currentRow)
      headerRow.values = ['No', 'No. Anggota', 'Nama Anggota', 'Simpanan Modal', 'Partisipasi Belanja', 'Jasa Bunga', 'Total SHU']
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }
      })
      headerRow.height = 25
      currentRow++

      filteredMembers.forEach((m, idx) => {
        const row = ws.getRow(currentRow)
        row.values = [idx + 1, m.memberNo, m.memberName, m.savingsBalance, m.belanjaPaid, m.bungaPaid, m.totalShu]
        row.getCell(1).alignment = { horizontal: 'center' }
        row.getCell(2).alignment = { horizontal: 'center' }
        row.getCell(4).numFmt = '#,##0'
        row.getCell(5).numFmt = '#,##0'
        row.getCell(6).numFmt = '#,##0'
        row.getCell(7).numFmt = '#,##0'
        row.getCell(7).font = { bold: true }

        row.eachCell((cell) => {
          cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }
        })
        row.height = 20
        currentRow++
      })

      const totals = calculateTotals(filteredMembers)
      const totalRow = ws.getRow(currentRow)
      totalRow.values = ["", "", "TOTAL SELURUH ANGGOTA", totals.savings, totals.belanja, totals.bunga, totals.shu]
      totalRow.font = { bold: true }
      totalRow.getCell(4).numFmt = '#,##0'
      totalRow.getCell(5).numFmt = '#,##0'
      totalRow.getCell(6).numFmt = '#,##0'
      totalRow.getCell(7).numFmt = '#,##0'

      totalRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }
      })
      totalRow.height = 22
      currentRow += 2

      generateExcelFooter(ws, currentRow, 7, templateConfig)

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      saveAs(blob, `Laporan_Partisipasi_RAT_${year}.xlsx`)
      toast.success("Laporan Excel berhasil diexport.")
    } catch (error) {
      console.error("Gagal mengekspor Excel:", error)
      toast.error("Terjadi kesalahan saat memproses ekspor Excel.")
    }
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

          <Button 
            onClick={handleExportExcel} 
            disabled={loading || !report} 
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-4 text-xs font-semibold flex items-center gap-2 shadow-sm"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Ekspor Excel
          </Button>

          <Button 
            onClick={handleExportPDF} 
            disabled={loading || !report} 
            variant="outline" 
            className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl h-10 px-4 text-xs font-semibold flex items-center gap-2 shadow-sm"
          >
            <FileText className="h-4 w-4" />
            Ekspor PDF
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
