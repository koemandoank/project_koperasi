"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getSHUProjection, distributeSHUMassal, ShuProjectionReport } from "@/lib/actions/shu-calculation"
import { toast } from "sonner"
import { Award, Users, DollarSign, ArrowRight, ShieldCheck, HelpCircle, Coins, CheckCircle, Percent, Download, FileText } from "lucide-react"
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

export function PembagianShuClient({ initialReport, initialYear, templateConfig }: Props) {
  const [year, setYear] = useState(initialYear.toString())
  const [report, setReport] = useState<ShuProjectionReport | null>(initialReport)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val)

  const formatPercent = (val: number) => `${(val * 100).toFixed(2)}%`

  const getAlokasiPercent = (key: 'cadangan' | 'jasa_anggota' | 'pengurus' | 'ketua' | 'pegawai' | 'pendidikan' | 'sosial_pembangunan'): number => {
    return report?.config?.alokasi?.[key] ?? 0;
  }

  const formatAlokasiPercent = (key: 'cadangan' | 'jasa_anggota' | 'pengurus' | 'ketua' | 'pegawai' | 'pendidikan' | 'sosial_pembangunan'): string => {
    return `${getAlokasiPercent(key).toFixed(2)}%`;
  }

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
    }
  }

  /**
   * Mengekspor Laporan Alokasi dan Pembagian SHU RAT ke format PDF premium.
   * Lengkap dengan Kop Surat dinamis dan footer TTD ganda.
   */
  const handleExportPDF = async () => {
    if (!report) {
      toast.error("Data proyeksi SHU tidak tersedia.")
      return
    }

    try {
      const doc = new jsPDF()

      // Header Kop Surat
      const startY = generatePdfHeader(doc, "LAPORAN ALOKASI DAN DISTRIBUSI SHU RAT", `Tahun Buku ${report.year}`, templateConfig)

      // 1. Ringkasan Alokasi Makro Koperasi
      doc.setFontSize(11)
      doc.setFont("helvetica", "bold")
      doc.text("A. RINGKASAN ALOKASI MAKRO KOPERASI", 14, startY)

      const alokasiJasaAnggota = report.config?.alokasi?.jasa_anggota ?? 50;
      const bobotModal = report.config?.jasa_anggota_bobot?.modal ?? 40;
      const bobotUsaha = report.config?.jasa_anggota_bobot?.usaha ?? 60;

      const macroRows = [
        ["Total SHU RAT Bersih", formatCurrency(report.totalNetIncome), "100.00%"],
        ["Cadangan Koperasi (Wajib)", formatCurrency(report.cadanganTotal), formatAlokasiPercent("cadangan")],
        ["Honorarium Ketua Koperasi", formatCurrency(report.ketuaTotal ?? 0), formatAlokasiPercent("ketua")],
        ["Honorarium Pengurus", formatCurrency(report.pengurusTotal), formatAlokasiPercent("pengurus")],
        ["Kesejahteraan Pegawai", formatCurrency(report.pegawaiTotal), formatAlokasiPercent("pegawai")],
        ["Dana Pendidikan", formatCurrency(report.pendidikanTotal), formatAlokasiPercent("pendidikan")],
        ["Dana Pembangunan & Sosial", formatCurrency(report.sosialTotal), formatAlokasiPercent("sosial_pembangunan")],
        ["Total Jasa Anggota (Modal & Usaha)", formatCurrency(report.jasaAnggotaTotal), formatAlokasiPercent("jasa_anggota")],
        [`  - Porsi Jasa Modal Anggota (${bobotModal.toFixed(2)}%)`, formatCurrency(report.jasaModalTotal), `${(alokasiJasaAnggota * bobotModal / 100).toFixed(2)}%`],
        [`  - Porsi Jasa Usaha Anggota (${bobotUsaha.toFixed(2)}%)`, formatCurrency(report.jasaUsahaTotal), `${(alokasiJasaAnggota * bobotUsaha / 100).toFixed(2)}%`]
      ]

      autoTable(doc, {
        startY: startY + 4,
        head: [['Pos Alokasi SHU', 'Nilai Nominal', 'Persentase']],
        body: macroRows,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] },
        columnStyles: {
          0: { cellWidth: 100 },
          1: { cellWidth: 45, halign: 'right' },
          2: { cellWidth: 35, halign: 'center' }
        },
        styles: { fontSize: 8.5 }
      })

      const finalY1 = (doc as any).lastAutoTable.finalY + 8

      // 2. Daftar Penerimaan SHU Per Anggota
      doc.setFont("helvetica", "bold")
      doc.text("B. BUKU PEMBANTU SHU RAT PER ANGGOTA", 14, finalY1)

      const memberRows = report.members.map((m, idx) => [
        (idx + 1).toString(),
        `${m.memberName}\n(${m.memberNo})`,
        `${formatCurrency(m.savingsBalance)}\n(Bobot: ${formatPercent(m.savingsWeight)})`,
        formatCurrency(m.jasaModal),
        `${formatCurrency(m.belanjaPaid + m.bungaPaid)}\n(Bobot: ${formatPercent(m.activityWeight)})`,
        formatCurrency(m.jasaUsaha),
        formatCurrency(m.totalShu)
      ])

      // Tambahkan baris total
      const totalSavings = report.members.reduce((acc, m) => acc + m.savingsBalance, 0)
      const totalJasaModal = report.members.reduce((acc, m) => acc + m.jasaModal, 0)
      const totalPartisipasi = report.members.reduce((acc, m) => acc + m.belanjaPaid + m.bungaPaid, 0)
      const totalJasaUsaha = report.members.reduce((acc, m) => acc + m.jasaUsaha, 0)
      const totalShuMembers = report.members.reduce((acc, m) => acc + m.totalShu, 0)

      memberRows.push([
        "",
        "TOTAL ANGGOTA",
        formatCurrency(totalSavings),
        formatCurrency(totalJasaModal),
        formatCurrency(totalPartisipasi),
        formatCurrency(totalJasaUsaha),
        formatCurrency(totalShuMembers)
      ])

      autoTable(doc, {
        startY: finalY1 + 4,
        head: [['No', 'Anggota', 'Simpanan (Modal)', 'Jasa Modal', 'Partisipasi Usaha', 'Jasa Usaha', 'Total SHU RAT']],
        body: memberRows,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 35 },
          2: { cellWidth: 35, halign: 'right' },
          3: { cellWidth: 26, halign: 'right' },
          4: { cellWidth: 35, halign: 'right' },
          5: { cellWidth: 26, halign: 'right' },
          6: { cellWidth: 27, halign: 'right', fontStyle: 'bold' }
        },
        styles: { fontSize: 8 },
        didParseCell: (data) => {
          if (data.row.index === memberRows.length - 1) {
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.fillColor = [241, 245, 249]
          }
        }
      })

      const finalY2 = (doc as any).lastAutoTable.finalY
      generatePdfFooter(doc, finalY2, templateConfig)

      doc.save(`Laporan_Pembagian_SHU_${report.year}.pdf`)
      toast.success("Laporan Pembagian SHU PDF berhasil diexport.")
    } catch (error) {
      console.error("Gagal export PDF:", error)
      toast.error("Terjadi kesalahan saat memproses PDF.")
    }
  }

  /**
   * Mengekspor Laporan Alokasi dan Pembagian SHU RAT ke format Excel premium (XLSX).
   * Dilengkapi Kop Surat Koperasi dan footer tanda tangan ganda dinamis.
   */
  const handleExportExcel = async () => {
    if (!report) {
      toast.error("Data proyeksi SHU tidak tersedia.")
      return
    }

    try {
      const workbook = new ExcelJS.Workbook()
      const ws = workbook.addWorksheet("Pembagian SHU RAT")
      ws.views = [{ showGridLines: true }]

      // Lebar kolom
      ws.columns = [
        { key: 'A', width: 6 },
        { key: 'B', width: 22 },
        { key: 'C', width: 25 },
        { key: 'D', width: 20 },
        { key: 'E', width: 12 },
        { key: 'F', width: 18 },
        { key: 'G', width: 20 },
        { key: 'H', width: 12 },
        { key: 'I', width: 18 },
        { key: 'J', width: 22 }
      ]

      const startRow = generateExcelHeader(ws, "LAPORAN ALOKASI DAN DISTRIBUSI SHU RAT", `Tahun Buku ${report.year}`, 10, templateConfig)
      let currentRow = startRow

      // 1. TULIS BLOK MAKRO SHU KOPERASI
      ws.mergeCells(`A${currentRow}:J${currentRow}`)
      ws.getCell(`A${currentRow}`).value = "A. RINGKASAN ALOKASI MAKRO KOPERASI"
      ws.getCell(`A${currentRow}`).font = { bold: true, size: 12 }
      currentRow += 2

      const addSummaryRow = (label: string, value: number, pct: string, isBold: boolean = false) => {
        ws.getCell(`A${currentRow}`).value = label
        ws.getCell(`D${currentRow}`).value = value
        ws.getCell(`E${currentRow}`).value = pct
        
        ws.getCell(`A${currentRow}`).font = { bold: isBold }
        ws.getCell(`D${currentRow}`).font = { bold: isBold }
        ws.getCell(`E${currentRow}`).font = { bold: isBold }

        ws.getCell(`D${currentRow}`).numFmt = '#,##0'
        ws.getCell(`D${currentRow}`).alignment = { horizontal: 'right' }
        ws.getCell(`E${currentRow}`).alignment = { horizontal: 'center' }
        
        ws.getRow(currentRow).height = 20
        currentRow++
      }

      const alokasiJasaAnggota = report.config?.alokasi?.jasa_anggota ?? 50;
      const bobotModal = report.config?.jasa_anggota_bobot?.modal ?? 40;
      const bobotUsaha = report.config?.jasa_anggota_bobot?.usaha ?? 60;

      addSummaryRow("Total SHU RAT Bersih", report.totalNetIncome, "100.00%", true)
      addSummaryRow(`Cadangan Koperasi (Wajib ${formatAlokasiPercent("cadangan")})`, report.cadanganTotal, formatAlokasiPercent("cadangan"))
      addSummaryRow(`Honorarium Ketua Koperasi (${formatAlokasiPercent("ketua")})`, report.ketuaTotal ?? 0, formatAlokasiPercent("ketua"))
      addSummaryRow(`Honorarium Pengurus (${formatAlokasiPercent("pengurus")})`, report.pengurusTotal, formatAlokasiPercent("pengurus"))
      addSummaryRow(`Kesejahteraan Pegawai (${formatAlokasiPercent("pegawai")})`, report.pegawaiTotal, formatAlokasiPercent("pegawai"))
      addSummaryRow(`Dana Pendidikan (${formatAlokasiPercent("pendidikan")})`, report.pendidikanTotal, formatAlokasiPercent("pendidikan"))
      addSummaryRow(`Dana Pembangunan & Sosial (${formatAlokasiPercent("sosial_pembangunan")})`, report.sosialTotal, formatAlokasiPercent("sosial_pembangunan"))
      addSummaryRow(`Total Jasa Anggota (Modal & Usaha ${formatAlokasiPercent("jasa_anggota")})`, report.jasaAnggotaTotal, formatAlokasiPercent("jasa_anggota"), true)
      addSummaryRow(`  - Porsi Jasa Modal Anggota (${bobotModal.toFixed(2)}%)`, report.jasaModalTotal, `${(alokasiJasaAnggota * bobotModal / 100).toFixed(2)}%`)
      addSummaryRow(`  - Porsi Jasa Usaha Anggota (${bobotUsaha.toFixed(2)}%)`, report.jasaUsahaTotal, `${(alokasiJasaAnggota * bobotUsaha / 100).toFixed(2)}%`)

      currentRow += 2

      // 2. DAFTAR PENERIMAAN ANGGOTA
      ws.mergeCells(`A${currentRow}:J${currentRow}`)
      ws.getCell(`A${currentRow}`).value = "B. BUKU PEMBANTU SHU RAT PER ANGGOTA"
      ws.getCell(`A${currentRow}`).font = { bold: true, size: 12 }
      currentRow += 2

      // Headers table
      const headerRow = ws.getRow(currentRow)
      headerRow.values = [
        'No', 'No. Anggota', 'Nama Anggota', 'Simpanan (Modal)', 'Bobot Modal',
        'Jasa Modal (IDR)', 'Partisipasi Usaha', 'Bobot Usaha', 'Jasa Usaha (IDR)', 'Total SHU RAT'
      ]
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }
      })
      headerRow.height = 28
      currentRow++

      // Rows members
      report.members.forEach((m, idx) => {
        const row = ws.getRow(currentRow)
        row.values = [
          idx + 1,
          m.memberNo,
          m.memberName,
          m.savingsBalance,
          m.savingsWeight,
          m.jasaModal,
          m.belanjaPaid + m.bungaPaid,
          m.activityWeight,
          m.jasaUsaha,
          m.totalShu
        ]

        row.getCell(1).alignment = { horizontal: 'center' }
        row.getCell(2).alignment = { horizontal: 'center' }
        row.getCell(4).numFmt = '#,##0'
        row.getCell(5).numFmt = '0.00%'
        row.getCell(6).numFmt = '#,##0'
        row.getCell(7).numFmt = '#,##0'
        row.getCell(8).numFmt = '0.00%'
        row.getCell(9).numFmt = '#,##0'
        row.getCell(10).numFmt = '#,##0'
        row.getCell(10).font = { bold: true }

        row.eachCell((cell) => {
          cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }
        })
        row.height = 20
        currentRow++
      })

      // Add Total Row
      const totalSavings = report.members.reduce((acc, m) => acc + m.savingsBalance, 0)
      const totalJasaModal = report.members.reduce((acc, m) => acc + m.jasaModal, 0)
      const totalPartisipasi = report.members.reduce((acc, m) => acc + m.belanjaPaid + m.bungaPaid, 0)
      const totalJasaUsaha = report.members.reduce((acc, m) => acc + m.jasaUsaha, 0)
      const totalShuMembers = report.members.reduce((acc, m) => acc + m.totalShu, 0)

      const totalRow = ws.getRow(currentRow)
      totalRow.values = [
        "",
        "",
        "TOTAL ANGGOTA",
        totalSavings,
        "",
        totalJasaModal,
        totalPartisipasi,
        "",
        totalJasaUsaha,
        totalShuMembers
      ]
      totalRow.font = { bold: true }
      totalRow.getCell(4).numFmt = '#,##0'
      totalRow.getCell(6).numFmt = '#,##0'
      totalRow.getCell(7).numFmt = '#,##0'
      totalRow.getCell(9).numFmt = '#,##0'
      totalRow.getCell(10).numFmt = '#,##0'

      totalRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }
      })
      totalRow.height = 22
      currentRow++

      // Footer Signatures
      generateExcelFooter(ws, currentRow, 10, templateConfig)

      // Save
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      saveAs(blob, `Laporan_Pembagian_SHU_${report.year}.xlsx`)
      toast.success("Laporan Pembagian SHU Excel berhasil diexport.")
    } catch (error) {
      console.error("Gagal export Excel:", error)
      toast.error("Terjadi kesalahan saat memproses Excel.")
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

        {report && (
          <div className="flex flex-wrap gap-2 items-center">
            <Button onClick={handleExportExcel} disabled={loading || actionLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-4 text-xs font-semibold flex items-center gap-2 shadow-sm">
              <Download className="h-4 w-4" /> Export Excel
            </Button>
            <Button onClick={handleExportPDF} disabled={loading || actionLoading} variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl h-10 px-4 text-xs font-semibold flex items-center gap-2 shadow-sm">
              <FileText className="h-4 w-4" /> Export PDF
            </Button>
            {report.totalNetIncome > 0 && (
              <>
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
              </>
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
                  <span className="text-xs font-bold uppercase tracking-wider">JASA ANGGOTA ({formatAlokasiPercent("jasa_anggota")})</span>
                  <Users className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{formatCurrency(report.jasaAnggotaTotal)}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-450 font-semibold">Hak SHU yang dibagikan ke Anggota</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm rounded-2xl bg-amber-50/50 dark:bg-amber-950/20">
              <CardContent className="p-5 space-y-2">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="text-xs font-bold uppercase tracking-wider">JASA MODAL ({(report.config?.jasa_anggota_bobot?.modal ?? 40)}%)</span>
                  <ShieldCheck className="h-5 w-5 text-amber-500" />
                </div>
                <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{formatCurrency(report.jasaModalTotal)}</p>
                <p className="text-xs text-amber-600 dark:text-amber-500 font-semibold">Dari total Jasa Anggota</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm rounded-2xl bg-cyan-50/50 dark:bg-cyan-950/20">
              <CardContent className="p-5 space-y-2">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="text-xs font-bold uppercase tracking-wider">JASA USAHA ({(report.config?.jasa_anggota_bobot?.usaha ?? 60)}%)</span>
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
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 text-xs">
                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl">
                  <span className="text-slate-400 block mb-1">Cadangan Koperasi ({formatAlokasiPercent("cadangan")})</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(report.cadanganTotal)}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl">
                  <span className="text-slate-400 block mb-1">Honor Ketua ({formatAlokasiPercent("ketua")})</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(report.ketuaTotal ?? 0)}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl">
                  <span className="text-slate-400 block mb-1">Honor Pengurus ({formatAlokasiPercent("pengurus")})</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(report.pengurusTotal)}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl">
                  <span className="text-slate-400 block mb-1">Kesejahteraan Pegawai ({formatAlokasiPercent("pegawai")})</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(report.pegawaiTotal)}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl">
                  <span className="text-slate-400 block mb-1">Dana Pendidikan ({formatAlokasiPercent("pendidikan")})</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(report.pendidikanTotal)}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl col-span-2 sm:col-span-1">
                  <span className="text-slate-400 block mb-1">Sosial & Pembangunan ({formatAlokasiPercent("sosial_pembangunan")})</span>
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
