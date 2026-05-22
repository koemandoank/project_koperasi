"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getNeraca, getLabaRugi } from "@/lib/actions/laporan-keuangan"
import { getArusKas, ArusKasReport } from "@/lib/actions/laporan-arus-kas"
import { getPerubahanEkuitas, PerubahanEkuitasReport } from "@/lib/actions/laporan-perubahan-ekuitas"
import { NeracaReport, LabaRugiReport } from "@/lib/types/laporan-keuangan.types"
import { toast } from "sonner"
import { Printer, Scale, TrendingUp, DollarSign, BookOpen, AlertTriangle, Download, FileText, Droplets, BarChart3 } from "lucide-react"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import ExcelJS from "exceljs"
import { saveAs } from "file-saver"
import { generatePdfHeader, generatePdfFooter, generateExcelHeader, generateExcelFooter, KOPERASI_NAME, KOPERASI_TAGLINE, KOPERASI_ADDRESS } from "@/lib/report-helpers"
import { KOPERASI_LOGO_BASE64 } from "@/lib/report-logo"

interface Props {
  initialNeraca: NeracaReport | null;
  initialLabaRugi: LabaRugiReport | null;
  initialArusKas: ArusKasReport | null;
  initialPerubahanEkuitas: PerubahanEkuitasReport | null;
  initialYear: number;
  templateConfig?: any;
}

export function LaporanKeuanganClient({ initialNeraca, initialLabaRugi, initialArusKas, initialPerubahanEkuitas, initialYear, templateConfig }: Props) {
  const [year, setYear] = useState(initialYear.toString())
  const [neraca, setNeraca] = useState<NeracaReport | null>(initialNeraca)
  const [labaRugi, setLabaRugi] = useState<LabaRugiReport | null>(initialLabaRugi)
  const [arusKas, setArusKas] = useState<ArusKasReport | null>(initialArusKas)
  const [perubahanEkuitas, setPerubahanEkuitas] = useState<PerubahanEkuitasReport | null>(initialPerubahanEkuitas)
  const [loading, setLoading] = useState(false)

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val)

  const handleYearChange = async (selectedYear: string | null) => {
    if (!selectedYear) return
    setYear(selectedYear)
    setLoading(true)
    try {
      const y = parseInt(selectedYear)
      const [nData, lrData, akData, ekData] = await Promise.all([
        getNeraca(y),
        getLabaRugi(y),
        getArusKas(y),
        getPerubahanEkuitas(y),
      ])
      setNeraca(nData)
      setLabaRugi(lrData)
      setArusKas(akData)
      setPerubahanEkuitas(ekData)
      toast.success(`Data laporan keuangan tahun ${selectedYear} berhasil dimuat.`)
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

  /**
   * Mengekspor Laporan Keuangan (Neraca & Laba Rugi) ke format PDF premium.
   * Menggunakan template Kop Surat dan TTD ganda resmi dari pengaturan.
   */
  const handleExportPDF = async () => {
    if (!neraca || !labaRugi) {
      toast.error("Data laporan tidak tersedia untuk di-export.")
      return
    }

    try {
      const doc = new jsPDF()
      
      // HALAMAN 1: NERACA (BALANCE SHEET)
      const startY1 = generatePdfHeader(doc, "LAPORAN NERACA STANDAR RAT", `Tahun Buku ${year}`, templateConfig)
      
      const neracaRows = [
        // ASET
        [{ content: '1. ASET (AKTIVA)', colSpan: 2, styles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' } }],
        [{ content: 'ASET LANCAR', colSpan: 2, styles: { fontStyle: 'bold', textColor: [100, 116, 139] } }],
        ...neraca.assets.currentAssets.map(item => [
          `${item.code} - ${item.name}`,
          formatCurrency(item.balance)
        ]),
        [{ content: 'Total Aset Lancar', styles: { fontStyle: 'bold' } }, { content: formatCurrency(neraca.assets.totalCurrentAssets), styles: { fontStyle: 'bold' } }],
        
        [{ content: 'ASET TETAP', colSpan: 2, styles: { fontStyle: 'bold', textColor: [100, 116, 139] } }],
        ...neraca.assets.fixedAssets.map(item => [
          `${item.code} - ${item.name}`,
          formatCurrency(item.balance)
        ]),
        [{ content: 'Total Aset Tetap', styles: { fontStyle: 'bold' } }, { content: formatCurrency(neraca.assets.totalFixedAssets), styles: { fontStyle: 'bold' } }],
        
        [{ content: 'TOTAL ASET', styles: { fontStyle: 'bold', fillColor: [238, 242, 255], textColor: [79, 70, 229] } }, { content: formatCurrency(neraca.assets.totalAssets), styles: { fontStyle: 'bold', fillColor: [238, 242, 255], textColor: [79, 70, 229] } }],

        // KEWAJIBAN
        [{ content: '2. KEWAJIBAN (PASIVA)', colSpan: 2, styles: { fillColor: [217, 119, 6], textColor: [255, 255, 255], fontStyle: 'bold' } }],
        [{ content: 'KEWAJIBAN JANGKA PENDEK', colSpan: 2, styles: { fontStyle: 'bold', textColor: [100, 116, 139] } }],
        ...neraca.liabilities.currentLiabilities.map(item => [
          `${item.code} - ${item.name}`,
          formatCurrency(item.balance)
        ]),
        [{ content: 'KEWAJIBAN JANGKA PANJANG', colSpan: 2, styles: { fontStyle: 'bold', textColor: [100, 116, 139] } }],
        ...neraca.liabilities.longTermLiabilities.map(item => [
          `${item.code} - ${item.name}`,
          formatCurrency(item.balance)
        ]),
        [{ content: 'Total Kewajiban', styles: { fontStyle: 'bold' } }, { content: formatCurrency(neraca.liabilities.totalLiabilities), styles: { fontStyle: 'bold' } }],

        // EKUITAS
        [{ content: '3. EKUITAS (MODAL SENDIRI)', colSpan: 2, styles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontStyle: 'bold' } }],
        [{ content: 'SIMPANAN EKUITAS ANGGOTA', colSpan: 2, styles: { fontStyle: 'bold', textColor: [100, 116, 139] } }],
        ...neraca.equity.memberSavings.map(item => [
          `${item.code} - ${item.name}`,
          formatCurrency(item.balance)
        ]),
        [{ content: 'DANA CADANGAN & LAINNYA', colSpan: 2, styles: { fontStyle: 'bold', textColor: [100, 116, 139] } }],
        ...neraca.equity.reservesAndOthers.map(item => [
          `${item.code} - ${item.name}`,
          formatCurrency(item.balance)
        ]),
        ['SHU Bersih Tahun Berjalan', formatCurrency(neraca.equity.currentShu)],
        [{ content: 'Total Ekuitas', styles: { fontStyle: 'bold' } }, { content: formatCurrency(neraca.equity.totalEquity), styles: { fontStyle: 'bold' } }],
        
        [{ content: 'TOTAL PASIVA (KEWAJIBAN & EKUITAS)', styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [15, 23, 42] } }, { content: formatCurrency(neraca.totalLiabilitiesAndEquity), styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [15, 23, 42] } }]
      ]

      autoTable(doc, {
        startY: startY1,
        head: [['Uraian Rekening Akuntansi', 'Saldo Akhir']],
        body: neracaRows as any,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
        columnStyles: {
          0: { cellWidth: 130 },
          1: { cellWidth: 50, halign: 'right' }
        },
        styles: { fontSize: 9 }
      })

      const finalY1 = (doc as any).lastAutoTable.finalY
      generatePdfFooter(doc, finalY1, templateConfig)

      // HALAMAN 2: PHU / LABA RUGI
      doc.addPage()
      const startY2 = generatePdfHeader(doc, "PERHITUNGAN HASIL USAHA (PHU)", `Tahun Buku ${year}`, templateConfig)
      
      const labaRugiRows = [
        [{ content: 'I. PENDAPATAN OPERASIONAL KOPERASI', colSpan: 2, styles: { fontStyle: 'bold', textColor: [79, 70, 229] } }],
        ['Partisipasi Toko Waserda (POS & Online)', formatCurrency(labaRugi.revenue.storeRevenue)],
        ['Pendapatan Bunga Jasa Pinjaman Anggota', formatCurrency(labaRugi.revenue.loanInterestRevenue)],
        ['Pendapatan Denda Keterlambatan Pinjaman', formatCurrency(labaRugi.revenue.loanPenaltyRevenue)],
        ['Pendapatan Operasional Lainnya (Jurnal Umum)', formatCurrency(labaRugi.revenue.otherRevenue)],
        [{ content: 'Total Pendapatan Kotor', styles: { fontStyle: 'bold' } }, { content: formatCurrency(labaRugi.revenue.totalRevenue), styles: { fontStyle: 'bold' } }],

        [{ content: 'II. HARGA POKOK PENJUALAN (HPP)', colSpan: 2, styles: { fontStyle: 'bold', textColor: [220, 38, 38] } }],
        ['HPP Toko Waserda (Harga Beli Produk Terjual)', `(${formatCurrency(labaRugi.cogs.storeCogs)})`],
        [{ content: 'Total HPP', styles: { fontStyle: 'bold' } }, { content: `(${formatCurrency(labaRugi.cogs.totalCogs)})`, styles: { fontStyle: 'bold' } }],

        [{ content: 'III. SISA HASIL USAHA KOTOR (LABA KOTOR)', styles: { fontStyle: 'bold', fillColor: [238, 242, 255] } }, { content: formatCurrency(labaRugi.grossProfit), styles: { fontStyle: 'bold', fillColor: [238, 242, 255] } }],

        [{ content: 'IV. BEBAN OPERASIONAL KOPERASI', colSpan: 2, styles: { fontStyle: 'bold', textColor: [217, 119, 6] } }],
        ...labaRugi.expenses.operationalExpenses.map(item => [
          `${item.code} - ${item.name}`,
          `(${formatCurrency(item.balance)})`
        ]),
        [{ content: 'Total Beban Operasional', styles: { fontStyle: 'bold' } }, { content: `(${formatCurrency(labaRugi.expenses.totalExpenses)})`, styles: { fontStyle: 'bold' } }],

        [{ content: 'V. SISA HASIL USAHA BERSIH (SHU AKHIR RAT)', styles: { fontStyle: 'bold', fillColor: [209, 250, 229], textColor: [5, 150, 105] } }, { content: formatCurrency(labaRugi.netShu), styles: { fontStyle: 'bold', fillColor: [209, 250, 229], textColor: [5, 150, 105] } }]
      ]

      autoTable(doc, {
        startY: startY2,
        head: [['Deskripsi Pendapatan / Biaya', 'Jumlah']],
        body: labaRugiRows as any,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
        columnStyles: {
          0: { cellWidth: 130 },
          1: { cellWidth: 50, halign: 'right' }
        },
        styles: { fontSize: 9 }
      })

      const finalY2 = (doc as any).lastAutoTable.finalY
      generatePdfFooter(doc, finalY2, templateConfig)

      doc.save(`Laporan_Keuangan_RAT_${year}.pdf`)
      toast.success("Laporan Keuangan PDF berhasil diexport.")
    } catch (error) {
      console.error("Gagal export PDF:", error)
      toast.error("Terjadi kesalahan saat memproses PDF.")
    }
  }

  /**
   * Mengekspor Laporan Keuangan (Neraca & Laba Rugi) ke format Excel (XLSX) multi-sheet.
   * Sheet 1: Neraca, Sheet 2: Laba Rugi (PHU), lengkap dengan Kop Surat dan TTD ganda.
   */
  const handleExportExcel = async () => {
    if (!neraca || !labaRugi) {
      toast.error("Data laporan tidak tersedia untuk di-export.")
      return
    }

    try {
      const workbook = new ExcelJS.Workbook()
      
      // ==========================================
      // SHEET 1: NERACA
      // ==========================================
      const wsNeraca = workbook.addWorksheet("Neraca RAT")
      wsNeraca.views = [{ showGridLines: true }]
      
      // Lebar kolom
      wsNeraca.columns = [
        { key: 'A', width: 45 },
        { key: 'B', width: 12 },
        { key: 'C', width: 12 },
        { key: 'D', width: 12 },
        { key: 'E', width: 22 }
      ]

      const startRowN = generateExcelHeader(wsNeraca, "LAPORAN NERACA RAT STANDAR", `Tahun Buku ${year}`, 5, templateConfig)
      let currentN = startRowN

      // Header table
      wsNeraca.getRow(currentN).values = ['Uraian Rekening Akuntansi', '', '', '', 'Saldo Akhir (Rupiah)']
      wsNeraca.mergeCells(`A${currentN}:D${currentN}`)
      wsNeraca.getCell(`A${currentN}`).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      wsNeraca.getCell(`E${currentN}`).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      wsNeraca.getCell(`A${currentN}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
      wsNeraca.getCell(`E${currentN}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
      wsNeraca.getCell(`A${currentN}`).alignment = { vertical: 'middle' }
      wsNeraca.getCell(`E${currentN}`).alignment = { horizontal: 'right', vertical: 'middle' }
      wsNeraca.getRow(currentN).height = 24
      currentN++

      // Helpers local
      const addExcelSectionHeader = (ws: ExcelJS.Worksheet, rowIdx: number, title: string, color: string) => {
        ws.mergeCells(`A${rowIdx}:E${rowIdx}`)
        const cell = ws.getCell(`A${rowIdx}`)
        cell.value = title
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }
        cell.alignment = { vertical: 'middle' }
        ws.getRow(rowIdx).height = 24
      }

      const addExcelSubHeader = (ws: ExcelJS.Worksheet, rowIdx: number, title: string) => {
        ws.mergeCells(`A${rowIdx}:E${rowIdx}`)
        const cell = ws.getCell(`A${rowIdx}`)
        cell.value = title
        cell.font = { bold: true, color: { argb: 'FF475569' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
        cell.alignment = { vertical: 'middle' }
        ws.getRow(rowIdx).height = 20
      }

      const addExcelRow = (ws: ExcelJS.Worksheet, rowIdx: number, col1: string, col2: string | number, isBold: boolean = false, highlightColor?: string) => {
        ws.getCell(`A${rowIdx}`).value = col1
        ws.getCell(`E${rowIdx}`).value = col2
        
        ws.getCell(`A${rowIdx}`).alignment = { horizontal: 'left', vertical: 'middle' }
        ws.getCell(`E${rowIdx}`).alignment = { horizontal: 'right', vertical: 'middle' }
        
        const font = { bold: isBold }
        ws.getCell(`A${rowIdx}`).font = font
        ws.getCell(`E${rowIdx}`).font = font
        
        if (typeof col2 === 'number') {
          ws.getCell(`E${rowIdx}`).numFmt = '#,##0'
        }

        if (highlightColor) {
          ws.mergeCells(`A${rowIdx}:D${rowIdx}`)
          ws.getCell(`A${rowIdx}`).value = col1
          ws.getRow(rowIdx).eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: highlightColor } }
          })
        }

        ws.getRow(rowIdx).height = 20
      }

      // Tulis ASET
      addExcelSectionHeader(wsNeraca, currentN, "1. ASET (AKTIVA)", "FF4F46E5")
      currentN++
      
      addExcelSubHeader(wsNeraca, currentN, "ASET LANCAR")
      currentN++
      
      neraca.assets.currentAssets.forEach(item => {
        addExcelRow(wsNeraca, currentN, `${item.code} - ${item.name}`, item.balance)
        currentN++
      })
      
      addExcelRow(wsNeraca, currentN, "Total Aset Lancar", neraca.assets.totalCurrentAssets, true)
      currentN++

      addExcelSubHeader(wsNeraca, currentN, "ASET TETAP")
      currentN++
      
      neraca.assets.fixedAssets.forEach(item => {
        addExcelRow(wsNeraca, currentN, `${item.code} - ${item.name}`, item.balance)
        currentN++
      })
      
      addExcelRow(wsNeraca, currentN, "Total Aset Tetap", neraca.assets.totalFixedAssets, true)
      currentN++

      addExcelRow(wsNeraca, currentN, "TOTAL ASET", neraca.assets.totalAssets, true, "FFEEF2FF")
      currentN++

      // Tulis KEWAJIBAN
      addExcelSectionHeader(wsNeraca, currentN, "2. KEWAJIBAN (PASIVA)", "FFD97706")
      currentN++
      
      addExcelSubHeader(wsNeraca, currentN, "KEWAJIBAN JANGKA PENDEK")
      currentN++
      neraca.liabilities.currentLiabilities.forEach(item => {
        addExcelRow(wsNeraca, currentN, `${item.code} - ${item.name}`, item.balance)
        currentN++
      })

      addExcelSubHeader(wsNeraca, currentN, "KEWAJIBAN JANGKA PANJANG")
      currentN++
      neraca.liabilities.longTermLiabilities.forEach(item => {
        addExcelRow(wsNeraca, currentN, `${item.code} - ${item.name}`, item.balance)
        currentN++
      })

      addExcelRow(wsNeraca, currentN, "Total Kewajiban", neraca.liabilities.totalLiabilities, true)
      currentN++

      // Tulis EKUITAS
      addExcelSectionHeader(wsNeraca, currentN, "3. EKUITAS (MODAL SENDIRI)", "FF059669")
      currentN++
      
      addExcelSubHeader(wsNeraca, currentN, "SIMPANAN EKUITAS ANGGOTA")
      currentN++
      neraca.equity.memberSavings.forEach(item => {
        addExcelRow(wsNeraca, currentN, `${item.code} - ${item.name}`, item.balance)
        currentN++
      })

      addExcelSubHeader(wsNeraca, currentN, "DANA CADANGAN & LAINNYA")
      currentN++
      neraca.equity.reservesAndOthers.forEach(item => {
        addExcelRow(wsNeraca, currentN, `${item.code} - ${item.name}`, item.balance)
        currentN++
      })

      addExcelRow(wsNeraca, currentN, "SHU Bersih Tahun Berjalan", neraca.equity.currentShu, true)
      currentN++

      addExcelRow(wsNeraca, currentN, "Total Ekuitas", neraca.equity.totalEquity, true)
      currentN++

      addExcelRow(wsNeraca, currentN, "TOTAL PASIVA (KEWAJIBAN & EKUITAS)", neraca.totalLiabilitiesAndEquity, true, "FFF1F5F9")
      currentN++

      // Add TTD Footer Neraca
      generateExcelFooter(wsNeraca, currentN, 5, templateConfig)

      // ==========================================
      // SHEET 2: LABA RUGI (PHU)
      // ==========================================
      const wsPHU = workbook.addWorksheet("PHU - Laba Rugi")
      wsPHU.views = [{ showGridLines: true }]
      
      wsPHU.columns = [
        { key: 'A', width: 45 },
        { key: 'B', width: 12 },
        { key: 'C', width: 12 },
        { key: 'D', width: 12 },
        { key: 'E', width: 22 }
      ]

      const startRowP = generateExcelHeader(wsPHU, "PERHITUNGAN HASIL USAHA (PHU)", `Tahun Buku ${year}`, 5, templateConfig)
      let currentP = startRowP

      // Header table
      wsPHU.getRow(currentP).values = ['Deskripsi Pendapatan / Biaya', '', '', '', 'Jumlah (Rupiah)']
      wsPHU.mergeCells(`A${currentP}:D${currentP}`)
      wsPHU.getCell(`A${currentP}`).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      wsPHU.getCell(`E${currentP}`).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      wsPHU.getCell(`A${currentP}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
      wsPHU.getCell(`E${currentP}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
      wsPHU.getCell(`A${currentP}`).alignment = { vertical: 'middle' }
      wsPHU.getCell(`E${currentP}`).alignment = { horizontal: 'right', vertical: 'middle' }
      wsPHU.getRow(currentP).height = 24
      currentP++

      // I. PENDAPATAN
      addExcelSectionHeader(wsPHU, currentP, "I. PENDAPATAN OPERASIONAL KOPERASI", "FF4F46E5")
      currentP++
      addExcelRow(wsPHU, currentP, "Partisipasi Toko Waserda (POS & Online)", labaRugi.revenue.storeRevenue)
      currentP++
      addExcelRow(wsPHU, currentP, "Pendapatan Bunga Jasa Pinjaman Anggota", labaRugi.revenue.loanInterestRevenue)
      currentP++
      addExcelRow(wsPHU, currentP, "Pendapatan Denda Keterlambatan Pinjaman", labaRugi.revenue.loanPenaltyRevenue)
      currentP++
      addExcelRow(wsPHU, currentP, "Pendapatan Operasional Lainnya (Jurnal Umum)", labaRugi.revenue.otherRevenue)
      currentP++
      addExcelRow(wsPHU, currentP, "Total Pendapatan Kotor", labaRugi.revenue.totalRevenue, true)
      currentP++

      // II. HPP
      addExcelSectionHeader(wsPHU, currentP, "II. HARGA POKOK PENJUALAN (HPP)", "FFDC2626")
      currentP++
      addExcelRow(wsPHU, currentP, "HPP Toko Waserda (Harga Beli Produk Terjual)", -labaRugi.cogs.storeCogs)
      currentP++
      addExcelRow(wsPHU, currentP, "Total HPP", -labaRugi.cogs.totalCogs, true)
      currentP++

      // III. LABA KOTOR
      addExcelRow(wsPHU, currentP, "III. SISA HASIL USAHA KOTOR (LABA KOTOR)", labaRugi.grossProfit, true, "FFEEF2FF")
      currentP++

      // IV. BEBAN
      addExcelSectionHeader(wsPHU, currentP, "IV. BEBAN OPERASIONAL KOPERASI", "FFD97706")
      currentP++
      labaRugi.expenses.operationalExpenses.forEach(item => {
        addExcelRow(wsPHU, currentP, `${item.code} - ${item.name}`, -item.balance)
        currentP++
      })
      addExcelRow(wsPHU, currentP, "Total Beban Operasional", -labaRugi.expenses.totalExpenses, true)
      currentP++

      // V. SHU BERSIH
      addExcelRow(wsPHU, currentP, "V. SISA HASIL USAHA BERSIH (SHU AKHIR)", labaRugi.netShu, true, "FFD1FAE5")
      currentP++

      // Add TTD Footer PHU
      generateExcelFooter(wsPHU, currentP, 5, templateConfig)

      // Generate File Buffer
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      saveAs(blob, `Laporan_Keuangan_RAT_${year}.xlsx`)
      toast.success("Laporan Keuangan Excel berhasil diexport.")
    } catch (error) {
      console.error("Gagal export Excel:", error)
      toast.error("Terjadi kesalahan saat memproses Excel.")
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString())

  const name = templateConfig?.company_name || KOPERASI_NAME
  const tagline = templateConfig?.company_tagline || KOPERASI_TAGLINE
  const address = templateConfig?.company_address || KOPERASI_ADDRESS
  const phone = templateConfig?.company_phone || ""
  const logo = templateConfig?.logo_base64 || KOPERASI_LOGO_BASE64

  const loc = templateConfig?.footer_location || "Serang"
  let dateStr = ""
  if (templateConfig?.footer_date_type === "custom") {
    dateStr = templateConfig?.footer_custom_date || ""
  } else {
    const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }
    dateStr = new Date().toLocaleDateString("id-ID", options)
  }
  const fullDate = dateStr ? `${loc}, ${dateStr}` : loc

  const leftTitle = templateConfig?.footer_left_title || "Bendahara"
  const leftName = templateConfig?.footer_left_name || "......................"
  const rightTitle = templateConfig?.footer_right_title || "Ketua Koperasi"
  const rightName = templateConfig?.footer_right_name || "......................"

  return (
    <>
      <div className="space-y-6 print:hidden">
        {/* Kontrol & Seleksi Tahun */}
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
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

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleExportExcel} disabled={loading || !neraca || !labaRugi} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-4 text-xs font-semibold flex items-center gap-2 shadow-sm">
              <Download className="h-4 w-4" /> Export Excel
            </Button>
            <Button onClick={handleExportPDF} disabled={loading || !neraca || !labaRugi} variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl h-10 px-4 text-xs font-semibold flex items-center gap-2 shadow-sm">
              <FileText className="h-4 w-4" /> Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl h-10 flex items-center gap-2">
              <Printer className="h-4 w-4" />
              Cetak Laporan Keuangan
            </Button>
          </div>
        </div>

        {loading && (
          <div className="text-center py-12 text-slate-400 font-medium animate-pulse">
            Mengkalkulasi Laporan Keuangan Standard...
          </div>
        )}

        {!loading && neraca && labaRugi && (
          <Tabs defaultValue="neraca" className="w-full space-y-6">
            <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl h-auto w-full flex flex-wrap gap-1">
              <TabsTrigger value="neraca" className="rounded-lg font-medium flex items-center gap-2 px-4 h-9">
                <Scale className="h-4 w-4" />
                Neraca
              </TabsTrigger>
              <TabsTrigger value="labarugi" className="rounded-lg font-medium flex items-center gap-2 px-4 h-9">
                <TrendingUp className="h-4 w-4" />
                Laba Rugi (PHU)
              </TabsTrigger>
              <TabsTrigger value="aruskas" className="rounded-lg font-medium flex items-center gap-2 px-4 h-9">
                <Droplets className="h-4 w-4" />
                Arus Kas
              </TabsTrigger>
              <TabsTrigger value="perubahanekuitas" className="rounded-lg font-medium flex items-center gap-2 px-4 h-9">
                <BarChart3 className="h-4 w-4" />
                Perubahan Ekuitas
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: NERACA */}
            <TabsContent value="neraca" className="space-y-6">
              {/* Indikator Balance Sheet */}
              <div>
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

              <div className="grid gap-6 md:grid-cols-2">
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
                      {/* Kewajiban Jangka Pendek */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-extrabold tracking-wider text-slate-400">KEWAJIBAN JANGKA PENDEK</h3>
                        <Table>
                          <TableBody>
                            {neraca.liabilities.currentLiabilities.map((item) => (
                              <TableRow key={item.id} className="hover:bg-slate-50/50 border-0">
                                <TableCell className="py-2.5 font-medium text-slate-600 dark:text-slate-350">{item.code} - {item.name}</TableCell>
                                <TableCell className="py-2.5 text-right font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(item.balance)}</TableCell>
                              </TableRow>
                            ))}
                            {neraca.liabilities.currentLiabilities.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={2} className="text-center py-4 text-slate-400">Tidak ada kewajiban jangka pendek.</TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Kewajiban Jangka Panjang */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-extrabold tracking-wider text-slate-400">KEWAJIBAN JANGKA PANJANG</h3>
                        <Table>
                          <TableBody>
                            {neraca.liabilities.longTermLiabilities.map((item) => (
                              <TableRow key={item.id} className="hover:bg-slate-50/50 border-0">
                                <TableCell className="py-2.5 font-medium text-slate-600 dark:text-slate-350">{item.code} - {item.name}</TableCell>
                                <TableCell className="py-2.5 text-right font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(item.balance)}</TableCell>
                              </TableRow>
                            ))}
                            {neraca.liabilities.longTermLiabilities.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={2} className="text-center py-4 text-slate-400">Tidak ada kewajiban jangka panjang.</TableCell>
                              </TableRow>
                            )}
                            <TableRow className="bg-amber-50/30 dark:bg-amber-950/20 font-bold border-t border-amber-100/50">
                              <TableCell className="py-3 text-amber-700 dark:text-amber-500">Total Kewajiban</TableCell>
                              <TableCell className="py-3 text-right text-amber-700 dark:text-amber-500">{formatCurrency(neraca.liabilities.totalLiabilities)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Ekuitas Card */}
                  <Card className="border border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl">
                    <CardHeader className="bg-slate-50 dark:bg-slate-900 rounded-t-2xl p-4 md:p-6 border-b border-slate-100 dark:border-slate-850">
                      <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <span className="bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 p-1.5 rounded-lg"><Scale className="h-4 w-4" /></span>
                        3. EKUITAS (MODAL SENDIRI)
                      </CardTitle>
                      <CardDescription>Hak pemilik atas kekayaan bersih koperasi.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 md:p-6 space-y-4">
                      {/* Simpanan Ekuitas */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-extrabold tracking-wider text-slate-400">SIMPANAN EKUITAS ANGGOTA</h3>
                        <Table>
                          <TableBody>
                            {neraca.equity.memberSavings.map((item) => (
                              <TableRow key={item.id} className="hover:bg-slate-50/50 border-0">
                                <TableCell className="py-2.5 font-medium text-slate-600 dark:text-slate-350">{item.code} - {item.name}</TableCell>
                                <TableCell className="py-2.5 text-right font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(item.balance)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Cadangan & Lainnya */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-extrabold tracking-wider text-slate-400">DANA CADANGAN & LAINNYA</h3>
                        <Table>
                          <TableBody>
                            {neraca.equity.reservesAndOthers.map((item) => (
                              <TableRow key={item.id} className="hover:bg-slate-50/50 border-0">
                                <TableCell className="py-2.5 font-medium text-slate-600 dark:text-slate-350">{item.code} - {item.name}</TableCell>
                                <TableCell className="py-2.5 text-right font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(item.balance)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="hover:bg-slate-50/50 border-0">
                              <TableCell className="py-2.5 font-medium text-slate-600 dark:text-slate-350 italic">SHU Bersih Tahun Berjalan</TableCell>
                              <TableCell className="py-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(neraca.equity.currentShu)}</TableCell>
                            </TableRow>
                            <TableRow className="bg-emerald-50/30 dark:bg-emerald-950/20 font-bold border-t border-emerald-100/50">
                              <TableCell className="py-3 text-emerald-700 dark:text-emerald-400">Total Ekuitas</TableCell>
                              <TableCell className="py-3 text-right text-emerald-700 dark:text-emerald-400">{formatCurrency(neraca.equity.totalEquity)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>

                      <div className="bg-slate-800 text-white rounded-xl p-4 flex justify-between items-center shadow-sm">
                        <span className="font-extrabold text-base">TOTAL PASIVA (KEWAJIBAN & EKUITAS)</span>
                        <span className="font-extrabold text-lg">{formatCurrency(neraca.totalLiabilitiesAndEquity)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: LABA RUGI / PHU */}
            <TabsContent value="labarugi" className="space-y-6">
              <Card className="border border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl">
                <CardHeader className="bg-slate-50 dark:bg-slate-900 rounded-t-2xl p-4 md:p-6 border-b border-slate-100 dark:border-slate-850">
                  <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <span className="bg-indigo-100 dark:bg-indigo-950 text-indigo-600 p-1.5 rounded-lg"><TrendingUp className="h-4 w-4" /></span>
                    PERHITUNGAN HASIL USAHA (PHU)
                  </CardTitle>
                  <CardDescription>Rincian pendapatan operasional dan beban usaha koperasi untuk penentuan SHU bersih.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6 space-y-6">
                  {/* 1. PENDAPATAN OPERASIONAL */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-extrabold tracking-wider text-indigo-500">I. PENDAPATAN OPERASIONAL KOPERASI</h3>
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

            {/* TAB 3: LAPORAN ARUS KAS */}
            <TabsContent value="aruskas" className="space-y-6">
              {arusKas ? (
                <>
                  {/* Ringkasan Kas */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card className="border border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
                      <CardContent className="p-5">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Kas Awal Periode</p>
                        <p className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{formatCurrency(arusKas.kasAwal)}</p>
                        <p className="text-xs text-slate-400 mt-1">Saldo per 1 Jan {arusKas.year}</p>
                      </CardContent>
                    </Card>
                    <Card className={`border shadow-sm rounded-2xl bg-gradient-to-br ${ arusKas.kenaikanKasBersih >= 0 ? 'from-emerald-50 to-white border-emerald-100 dark:from-emerald-950/30 dark:border-emerald-900' : 'from-rose-50 to-white border-rose-100 dark:from-rose-950/30 dark:border-rose-900' }`}>
                      <CardContent className="p-5">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Kenaikan/(Penurunan) Kas</p>
                        <p className={`text-xl font-extrabold ${ arusKas.kenaikanKasBersih >= 0 ? 'text-emerald-600' : 'text-rose-600' }`}>{formatCurrency(arusKas.kenaikanKasBersih)}</p>
                        <p className="text-xs text-slate-400 mt-1">Net 3 Aktivitas</p>
                      </CardContent>
                    </Card>
                    <Card className="border border-indigo-100 dark:border-indigo-900 shadow-sm rounded-2xl bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/30">
                      <CardContent className="p-5">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Kas Akhir Periode</p>
                        <p className="text-xl font-extrabold text-indigo-700 dark:text-indigo-400">{formatCurrency(arusKas.kasAkhir)}</p>
                        <p className="text-xs text-slate-400 mt-1">Estimasi per 31 Des {arusKas.year}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* 3 Kartu Aktivitas */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Aktivitas Operasional */}
                    <Card className="border border-blue-100 dark:border-blue-900 shadow-sm rounded-2xl">
                      <CardHeader className="bg-blue-50 dark:bg-blue-950/30 rounded-t-2xl p-4 border-b border-blue-100 dark:border-blue-900">
                        <CardTitle className="text-sm font-bold text-blue-800 dark:text-blue-300">I. Aktivitas Operasional</CardTitle>
                        <CardDescription className="text-xs">Arus kas dari kegiatan usaha utama koperasi</CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex justify-between text-sm py-1.5 border-b border-slate-100">
                          <span className="text-slate-600 dark:text-slate-400">Penerimaan Penjualan Tunai</span>
                          <span className="font-semibold text-emerald-600">+{formatCurrency(arusKas.operasional.penerimaanKasPenjualan)}</span>
                        </div>
                        <div className="flex justify-between text-sm py-1.5 border-b border-slate-100">
                          <span className="text-slate-600 dark:text-slate-400">Penerimaan Penjualan Kredit</span>
                          <span className="font-semibold text-emerald-600">+{formatCurrency(arusKas.operasional.penerimaanKreditPenjualan)}</span>
                        </div>
                        <div className="flex justify-between text-sm py-1.5 border-b border-slate-100">
                          <span className="text-slate-600 dark:text-slate-400">Penerimaan Bunga Pinjaman</span>
                          <span className="font-semibold text-emerald-600">+{formatCurrency(arusKas.operasional.penerimaanBungaPinjaman)}</span>
                        </div>
                        <div className="flex justify-between text-sm py-1.5 border-b border-slate-100">
                          <span className="text-slate-600 dark:text-slate-400">Penerimaan Denda</span>
                          <span className="font-semibold text-emerald-600">+{formatCurrency(arusKas.operasional.penerimaanDendaPinjaman)}</span>
                        </div>
                        <div className="flex justify-between text-sm py-1.5 border-b border-slate-100">
                          <span className="text-slate-600 dark:text-slate-400">Pembayaran ke Supplier</span>
                          <span className="font-semibold text-rose-600">({formatCurrency(arusKas.operasional.pembayaranKeSupplier)})</span>
                        </div>
                        <div className="flex justify-between text-sm py-1.5 border-b border-slate-100">
                          <span className="text-slate-600 dark:text-slate-400">Beban Operasional Lainnya</span>
                          <span className="font-semibold text-rose-600">({formatCurrency(arusKas.operasional.bebanOperasionalLainnya)})</span>
                        </div>
                        <div className={`flex justify-between text-sm font-bold py-2 rounded-lg px-2 mt-1 ${ arusKas.operasional.kasNetOperasional >= 0 ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700' }`}>
                          <span>Net Kas Operasional</span>
                          <span>{formatCurrency(arusKas.operasional.kasNetOperasional)}</span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Aktivitas Investasi */}
                    <Card className="border border-amber-100 dark:border-amber-900 shadow-sm rounded-2xl">
                      <CardHeader className="bg-amber-50 dark:bg-amber-950/30 rounded-t-2xl p-4 border-b border-amber-100 dark:border-amber-900">
                        <CardTitle className="text-sm font-bold text-amber-800 dark:text-amber-300">II. Aktivitas Investasi</CardTitle>
                        <CardDescription className="text-xs">Arus kas dari pembelian dan penjualan aset jangka panjang</CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex justify-between text-sm py-1.5 border-b border-slate-100">
                          <span className="text-slate-600 dark:text-slate-400">Pembelian Aset Tetap</span>
                          <span className="font-semibold text-rose-600">({formatCurrency(arusKas.investasi.pembelianAsetTetap)})</span>
                        </div>
                        <div className="flex justify-between text-sm py-1.5 border-b border-slate-100">
                          <span className="text-slate-600 dark:text-slate-400">Pelepasan/Penjualan Aset</span>
                          <span className="font-semibold text-emerald-600">+{formatCurrency(arusKas.investasi.pelepasanAsetTetap)}</span>
                        </div>
                        <div className={`flex justify-between text-sm font-bold py-2 rounded-lg px-2 mt-1 ${ arusKas.investasi.kasNetInvestasi >= 0 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700' }`}>
                          <span>Net Kas Investasi</span>
                          <span>{formatCurrency(arusKas.investasi.kasNetInvestasi)}</span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Aktivitas Pendanaan */}
                    <Card className="border border-emerald-100 dark:border-emerald-900 shadow-sm rounded-2xl">
                      <CardHeader className="bg-emerald-50 dark:bg-emerald-950/30 rounded-t-2xl p-4 border-b border-emerald-100 dark:border-emerald-900">
                        <CardTitle className="text-sm font-bold text-emerald-800 dark:text-emerald-300">III. Aktivitas Pendanaan</CardTitle>
                        <CardDescription className="text-xs">Arus kas dari simpanan dan pinjaman anggota</CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex justify-between text-sm py-1.5 border-b border-slate-100">
                          <span className="text-slate-600 dark:text-slate-400">Simpanan Pokok Diterima</span>
                          <span className="font-semibold text-emerald-600">+{formatCurrency(arusKas.pendanaan.penerimaanSimpananPokok)}</span>
                        </div>
                        <div className="flex justify-between text-sm py-1.5 border-b border-slate-100">
                          <span className="text-slate-600 dark:text-slate-400">Simpanan Wajib Diterima</span>
                          <span className="font-semibold text-emerald-600">+{formatCurrency(arusKas.pendanaan.penerimaanSimpananWajib)}</span>
                        </div>
                        <div className="flex justify-between text-sm py-1.5 border-b border-slate-100">
                          <span className="text-slate-600 dark:text-slate-400">Simpanan Sukarela Diterima</span>
                          <span className="font-semibold text-emerald-600">+{formatCurrency(arusKas.pendanaan.penerimaanSimpananSukarela)}</span>
                        </div>
                        <div className="flex justify-between text-sm py-1.5 border-b border-slate-100">
                          <span className="text-slate-600 dark:text-slate-400">Penarikan Simpanan</span>
                          <span className="font-semibold text-rose-600">({formatCurrency(arusKas.pendanaan.penarikanSimpanan)})</span>
                        </div>
                        <div className="flex justify-between text-sm py-1.5 border-b border-slate-100">
                          <span className="text-slate-600 dark:text-slate-400">Pinjaman Baru Dicairkan</span>
                          <span className="font-semibold text-rose-600">({formatCurrency(arusKas.pendanaan.pencairanPinjaman)})</span>
                        </div>
                        <div className="flex justify-between text-sm py-1.5 border-b border-slate-100">
                          <span className="text-slate-600 dark:text-slate-400">Angsuran Pokok Diterima</span>
                          <span className="font-semibold text-emerald-600">+{formatCurrency(arusKas.pendanaan.angsuranPokokDiterima)}</span>
                        </div>
                        <div className={`flex justify-between text-sm font-bold py-2 rounded-lg px-2 mt-1 ${ arusKas.pendanaan.kasNetPendanaan >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700' }`}>
                          <span>Net Kas Pendanaan</span>
                          <span>{formatCurrency(arusKas.pendanaan.kasNetPendanaan)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-slate-400">Data arus kas tidak tersedia. Silakan coba muat ulang.</div>
              )}
            </TabsContent>

            {/* TAB 4: LAPORAN PERUBAHAN EKUITAS */}
            <TabsContent value="perubahanekuitas" className="space-y-6">
              {perubahanEkuitas ? (
                <Card className="border border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl">
                  <CardHeader className="bg-slate-50 dark:bg-slate-900 rounded-t-2xl p-4 md:p-6 border-b border-slate-100 dark:border-slate-850">
                    <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <span className="bg-violet-100 dark:bg-violet-950 text-violet-600 p-1.5 rounded-lg"><BarChart3 className="h-4 w-4" /></span>
                      LAPORAN PERUBAHAN EKUITAS
                    </CardTitle>
                    <CardDescription>Mutasi modal koperasi sepanjang Tahun Buku {perubahanEkuitas.year} sesuai SAK ETAP.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 md:p-6 space-y-6">
                    {/* Modal Awal */}
                    <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-4">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Modal Awal (1 Januari {perubahanEkuitas.year})</span>
                      <span className="font-extrabold text-slate-900 dark:text-slate-100 text-lg">{formatCurrency(perubahanEkuitas.modalAwal)}</span>
                    </div>

                    {/* Penambahan */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-extrabold tracking-wider text-emerald-600">PENAMBAHAN EKUITAS</h3>
                      <Table>
                        <TableBody>
                          {perubahanEkuitas.penambahan.items.map((item, i) => (
                            <TableRow key={i} className="hover:bg-slate-50/50 border-0">
                              <TableCell className="py-2.5 font-medium text-slate-700 dark:text-slate-300 pl-4">{item.keterangan}</TableCell>
                              <TableCell className="py-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">+{formatCurrency(item.jumlah)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-emerald-50/30 dark:bg-emerald-950/20 font-bold border-t border-emerald-100/50">
                            <TableCell className="py-3 text-emerald-700 dark:text-emerald-400">Total Penambahan</TableCell>
                            <TableCell className="py-3 text-right text-emerald-700 dark:text-emerald-400">+{formatCurrency(perubahanEkuitas.penambahan.total)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pengurangan */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-extrabold tracking-wider text-rose-500">PENGURANGAN EKUITAS</h3>
                      <Table>
                        <TableBody>
                          {perubahanEkuitas.pengurangan.items.map((item, i) => (
                            <TableRow key={i} className="hover:bg-slate-50/50 border-0">
                              <TableCell className="py-2.5 font-medium text-slate-700 dark:text-slate-300 pl-4">{item.keterangan}</TableCell>
                              <TableCell className="py-2.5 text-right font-semibold text-rose-600 dark:text-rose-400">({formatCurrency(item.jumlah)})</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-rose-50/30 dark:bg-rose-950/20 font-bold border-t border-rose-100/50">
                            <TableCell className="py-3 text-rose-700 dark:text-rose-400">Total Pengurangan</TableCell>
                            <TableCell className="py-3 text-right text-rose-700 dark:text-rose-400">({formatCurrency(perubahanEkuitas.pengurangan.total)})</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    {/* Modal Akhir */}
                    <div className="bg-violet-600 text-white rounded-xl p-4 flex justify-between items-center shadow-md">
                      <div>
                        <span className="font-extrabold text-base">MODAL AKHIR (31 Desember {perubahanEkuitas.year})</span>
                        <p className="text-xs text-violet-200 mt-0.5">Termasuk SHU Berjalan {formatCurrency(perubahanEkuitas.shuBerjalan)}</p>
                      </div>
                      <span className="font-extrabold text-xl">{formatCurrency(perubahanEkuitas.modalAkhir)}</span>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="text-center py-12 text-slate-400">Data perubahan ekuitas tidak tersedia. Silakan coba muat ulang.</div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* PRINT-ONLY VERSION FOR DIRECT PRINT (CETAK LANGSUNG) */}
      {!loading && neraca && labaRugi && (
        <div className="hidden print:block font-sans text-black p-6 bg-white w-full text-[11px] leading-relaxed" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
          {/* HALAMAN 1: NERACA */}
          <div style={{ pageBreakAfter: "always", breakAfter: "page" }} className="space-y-6">
            {/* Kop Surat */}
            <div className="border-b-[1.5px] border-slate-800 pb-3 mb-4 flex items-center gap-5">
              {logo && (
                <img src={logo} alt="Logo" className="h-16 w-16 object-contain" />
              )}
              <div className="flex-1 text-left">
                <h1 className="text-base font-bold uppercase tracking-tight text-slate-900 leading-tight">{name}</h1>
                <p className="text-[11px] font-medium text-slate-700 leading-tight">{tagline}</p>
                <p className="text-[10px] text-slate-500 leading-tight">{address} {phone ? `| Telp: ${phone}` : ""}</p>
              </div>
            </div>

            {/* Judul Laporan */}
            <div className="text-center my-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">LAPORAN NERACA STANDAR RAT</h2>
              <p className="text-[11px] text-slate-700 mt-0.5">Tahun Buku {year}</p>
            </div>

            {/* Tabel Neraca */}
            <table className="w-full border-collapse border border-slate-300 text-[11px] my-3">
              <thead>
                <tr className="bg-slate-800 text-white font-bold border-b border-slate-300">
                  <th className="border border-slate-300 p-2 text-left w-[70%]">Uraian Rekening Akuntansi</th>
                  <th className="border border-slate-300 p-2 text-right w-[30%]">Saldo Akhir</th>
                </tr>
              </thead>
              <tbody>
                {/* ASET */}
                <tr className="bg-indigo-600 text-white font-bold border-b border-slate-300">
                  <td colSpan={2} className="border border-slate-300 px-3 py-1.5 text-left uppercase">1. ASET (AKTIVA)</td>
                </tr>
                <tr className="bg-transparent font-bold">
                  <td colSpan={2} className="border border-slate-300 px-4 py-1.5 text-left text-slate-500">ASET LANCAR</td>
                </tr>
                {neraca.assets.currentAssets.map(item => (
                  <tr key={item.id} className="border-b border-slate-300">
                    <td className="border border-slate-300 px-5 py-1 text-left text-slate-800">{item.code} - {item.name}</td>
                    <td className="border border-slate-300 px-3 py-1 text-right font-medium text-slate-900">{formatCurrency(item.balance)}</td>
                  </tr>
                ))}
                {neraca.assets.currentAssets.length === 0 && (
                  <tr className="border-b border-slate-300">
                    <td colSpan={2} className="border border-slate-300 text-center py-2 text-slate-500">Tidak ada data aset lancar.</td>
                  </tr>
                )}
                <tr className="font-bold bg-indigo-50/50 text-indigo-700 border-b border-slate-300">
                  <td className="border border-slate-300 px-4 py-1.5 text-left">Total Aset Lancar</td>
                  <td className="border border-slate-300 px-3 py-1.5 text-right">{formatCurrency(neraca.assets.totalCurrentAssets)}</td>
                </tr>
                <tr className="bg-transparent font-bold">
                  <td colSpan={2} className="border border-slate-300 px-4 py-1.5 text-left text-slate-500">ASET TETAP</td>
                </tr>
                {neraca.assets.fixedAssets.map(item => (
                  <tr key={item.id} className="border-b border-slate-300">
                    <td className="border border-slate-300 px-5 py-1 text-left text-slate-800">{item.code} - {item.name}</td>
                    <td className="border border-slate-300 px-3 py-1 text-right font-medium text-slate-900">{formatCurrency(item.balance)}</td>
                  </tr>
                ))}
                {neraca.assets.fixedAssets.length === 0 && (
                  <tr className="border-b border-slate-300">
                    <td colSpan={2} className="border border-slate-300 text-center py-2 text-slate-500">Tidak ada data aset tetap.</td>
                  </tr>
                )}
                <tr className="font-bold bg-indigo-50/50 text-indigo-700 border-b border-slate-300">
                  <td className="border border-slate-300 px-4 py-1.5 text-left">Total Aset Tetap</td>
                  <td className="border border-slate-300 px-3 py-1.5 text-right">{formatCurrency(neraca.assets.totalFixedAssets)}</td>
                </tr>
                <tr className="font-bold bg-indigo-100 text-indigo-900 border-b-2 border-indigo-700">
                  <td className="border border-slate-300 px-3 py-2 text-left uppercase">TOTAL ASET</td>
                  <td className="border border-slate-300 px-3 py-2 text-right">{formatCurrency(neraca.assets.totalAssets)}</td>
                </tr>

                {/* KEWAJIBAN */}
                <tr className="bg-amber-600 text-white font-bold border-b border-slate-300">
                  <td colSpan={2} className="border border-slate-300 px-3 py-1.5 text-left uppercase">2. KEWAJIBAN (PASIVA)</td>
                </tr>
                <tr className="bg-transparent font-bold">
                  <td colSpan={2} className="border border-slate-300 px-4 py-1.5 text-left text-slate-500">KEWAJIBAN JANGKA PENDEK</td>
                </tr>
                {neraca.liabilities.currentLiabilities.map(item => (
                  <tr key={item.id} className="border-b border-slate-300">
                    <td className="border border-slate-300 px-5 py-1 text-left text-slate-800">{item.code} - {item.name}</td>
                    <td className="border border-slate-300 px-3 py-1 text-right font-medium text-slate-900">{formatCurrency(item.balance)}</td>
                  </tr>
                ))}
                <tr className="bg-transparent font-bold">
                  <td colSpan={2} className="border border-slate-300 px-4 py-1.5 text-left text-slate-500">KEWAJIBAN JANGKA PANJANG</td>
                </tr>
                {neraca.liabilities.longTermLiabilities.map(item => (
                  <tr key={item.id} className="border-b border-slate-300">
                    <td className="border border-slate-300 px-5 py-1 text-left text-slate-800">{item.code} - {item.name}</td>
                    <td className="border border-slate-300 px-3 py-1 text-right font-medium text-slate-900">{formatCurrency(item.balance)}</td>
                  </tr>
                ))}
                <tr className="font-bold bg-amber-50/50 text-amber-700 border-b border-slate-300">
                  <td className="border border-slate-300 px-4 py-1.5 text-left">Total Kewajiban</td>
                  <td className="border border-slate-300 px-3 py-1.5 text-right">{formatCurrency(neraca.liabilities.totalLiabilities)}</td>
                </tr>

                {/* EKUITAS */}
                <tr className="bg-emerald-600 text-white font-bold border-b border-slate-300">
                  <td colSpan={2} className="border border-slate-300 px-3 py-1.5 text-left uppercase">3. EKUITAS (MODAL SENDIRI)</td>
                </tr>
                <tr className="bg-transparent font-bold">
                  <td colSpan={2} className="border border-slate-300 px-4 py-1.5 text-left text-slate-500">SIMPANAN EKUITAS ANGGOTA</td>
                </tr>
                {neraca.equity.memberSavings.map(item => (
                  <tr key={item.id} className="border-b border-slate-300">
                    <td className="border border-slate-300 px-5 py-1 text-left text-slate-800">{item.code} - {item.name}</td>
                    <td className="border border-slate-300 px-3 py-1 text-right font-medium text-slate-900">{formatCurrency(item.balance)}</td>
                  </tr>
                ))}
                <tr className="bg-transparent font-bold">
                  <td colSpan={2} className="border border-slate-300 px-4 py-1.5 text-left text-slate-500">DANA CADANGAN & LAINNYA</td>
                </tr>
                {neraca.equity.reservesAndOthers.map(item => (
                  <tr key={item.id} className="border-b border-slate-300">
                    <td className="border border-slate-300 px-5 py-1 text-left text-slate-800">{item.code} - {item.name}</td>
                    <td className="border border-slate-300 px-3 py-1 text-right font-medium text-slate-900">{formatCurrency(item.balance)}</td>
                  </tr>
                ))}
                <tr className="border-b border-slate-300">
                  <td className="border border-slate-300 px-5 py-1 text-left italic text-slate-800">SHU Bersih Tahun Berjalan</td>
                  <td className="border border-slate-300 px-3 py-1 text-right font-medium text-slate-900">{formatCurrency(neraca.equity.currentShu)}</td>
                </tr>
                <tr className="font-bold bg-emerald-50/50 text-emerald-700 border-b border-slate-300">
                  <td className="border border-slate-300 px-4 py-1.5 text-left">Total Ekuitas</td>
                  <td className="border border-slate-300 px-3 py-1.5 text-right">{formatCurrency(neraca.equity.totalEquity)}</td>
                </tr>
                <tr className="font-bold bg-slate-100 text-slate-900 border-b-2 border-slate-700">
                  <td className="border border-slate-300 px-3 py-2 text-left uppercase">TOTAL PASIVA (KEWAJIBAN & EKUITAS)</td>
                  <td className="border border-slate-300 px-3 py-2 text-right">{formatCurrency(neraca.totalLiabilitiesAndEquity)}</td>
                </tr>
              </tbody>
            </table>

            {/* Tanda Tangan */}
            <div className="mt-8 grid grid-cols-2 text-center text-[10px] break-inside-avoid" style={{ pageBreakInside: "avoid" }}>
              {/* Row 1: Date on the right, empty on the left */}
              <div></div>
              <div className="text-center font-medium pr-4 mb-2">
                {fullDate}
              </div>
              
              {/* Row 2: Titles & Names */}
              <div className="space-y-16">
                <p className="font-semibold text-slate-700 uppercase tracking-wider">{leftTitle}</p>
                <p className="font-bold text-slate-900">{leftName}</p>
              </div>
              <div className="space-y-16">
                <p className="font-semibold text-slate-700 uppercase tracking-wider">{rightTitle}</p>
                <p className="font-bold text-slate-900">{rightName}</p>
              </div>
            </div>
          </div>

          {/* HALAMAN 2: LABA RUGI */}
          <div className="space-y-6">
            {/* Kop Surat */}
            <div className="border-b-[1.5px] border-slate-800 pb-3 mb-4 flex items-center gap-5">
              {logo && (
                <img src={logo} alt="Logo" className="h-16 w-16 object-contain" />
              )}
              <div className="flex-1 text-left">
                <h1 className="text-base font-bold uppercase tracking-tight text-slate-900 leading-tight">{name}</h1>
                <p className="text-[11px] font-medium text-slate-700 leading-tight">{tagline}</p>
                <p className="text-[10px] text-slate-500 leading-tight">{address} {phone ? `| Telp: ${phone}` : ""}</p>
              </div>
            </div>

            {/* Judul Laporan */}
            <div className="text-center my-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">PERHITUNGAN HASIL USAHA (PHU)</h2>
              <p className="text-[11px] text-slate-700 mt-0.5">Tahun Buku {year}</p>
            </div>

            {/* Tabel Laba Rugi */}
            <table className="w-full border-collapse border border-slate-300 text-[11px] my-3">
              <thead>
                <tr className="bg-slate-800 text-white font-bold border-b border-slate-300">
                  <th className="border border-slate-300 p-2 text-left w-[70%]">Deskripsi Pendapatan / Biaya</th>
                  <th className="border border-slate-300 p-2 text-right w-[30%]">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-transparent font-bold">
                  <td colSpan={2} className="border border-slate-300 px-3 py-1.5 text-left uppercase text-indigo-600">I. PENDAPATAN OPERASIONAL KOPERASI</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="border border-slate-300 px-5 py-1 text-left text-slate-800">Partisipasi Toko Waserda (POS & Online)</td>
                  <td className="border border-slate-300 px-3 py-1 text-right font-medium text-slate-900">{formatCurrency(labaRugi.revenue.storeRevenue)}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="border border-slate-300 px-5 py-1 text-left text-slate-800">Pendapatan Bunga Jasa Pinjaman Anggota</td>
                  <td className="border border-slate-300 px-3 py-1 text-right font-medium text-slate-900">{formatCurrency(labaRugi.revenue.loanInterestRevenue)}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="border border-slate-300 px-5 py-1 text-left text-slate-800">Pendapatan Denda Keterlambatan Pinjaman</td>
                  <td className="border border-slate-300 px-3 py-1 text-right font-medium text-slate-900">{formatCurrency(labaRugi.revenue.loanPenaltyRevenue)}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="border border-slate-300 px-5 py-1 text-left text-slate-800">Pendapatan Operasional Lainnya (Jurnal Umum)</td>
                  <td className="border border-slate-300 px-3 py-1 text-right font-medium text-slate-900">{formatCurrency(labaRugi.revenue.otherRevenue)}</td>
                </tr>
                <tr className="font-bold bg-indigo-50/50 text-indigo-700 border-b border-slate-300">
                  <td className="border border-slate-300 px-4 py-1.5 text-left">Total Pendapatan Kotor</td>
                  <td className="border border-slate-300 px-3 py-1.5 text-right">{formatCurrency(labaRugi.revenue.totalRevenue)}</td>
                </tr>

                <tr className="bg-transparent font-bold">
                  <td colSpan={2} className="border border-slate-300 px-3 py-1.5 text-left uppercase text-rose-600">II. HARGA POKOK PENJUALAN (HPP)</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="border border-slate-300 px-5 py-1 text-left text-slate-800">HPP Toko Waserda (Harga Beli Produk Terjual)</td>
                  <td className="border border-slate-300 px-3 py-1 text-right font-medium text-slate-900">({formatCurrency(labaRugi.cogs.storeCogs)})</td>
                </tr>
                <tr className="font-bold bg-rose-50/50 text-rose-700 border-b border-slate-300">
                  <td className="border border-slate-300 px-4 py-1.5 text-left">Total HPP</td>
                  <td className="border border-slate-300 px-3 py-1.5 text-right">({formatCurrency(labaRugi.cogs.totalCogs)})</td>
                </tr>

                <tr className="font-bold bg-indigo-50 text-indigo-900 border-b border-slate-300">
                  <td className="border border-slate-300 px-3 py-1.5 text-left uppercase">III. SISA HASIL USAHA KOTOR (LABA KOTOR)</td>
                  <td className="border border-slate-300 px-3 py-1.5 text-right">{formatCurrency(labaRugi.grossProfit)}</td>
                </tr>

                <tr className="bg-transparent font-bold">
                  <td colSpan={2} className="border border-slate-300 px-3 py-1.5 text-left uppercase text-amber-600">IV. BEBAN OPERASIONAL KOPERASI</td>
                </tr>
                {labaRugi.expenses.operationalExpenses.map(item => (
                  <tr key={item.id} className="border-b border-slate-300">
                    <td className="border border-slate-300 px-5 py-1 text-left text-slate-800">{item.code} - {item.name}</td>
                    <td className="border border-slate-300 px-3 py-1 text-right font-medium text-slate-900">({formatCurrency(item.balance)})</td>
                  </tr>
                ))}
                {labaRugi.expenses.operationalExpenses.length === 0 && (
                  <tr className="border-b border-slate-300">
                    <td colSpan={2} className="border border-slate-300 text-center py-2 text-slate-500">Tidak ada beban operasional tercatat.</td>
                  </tr>
                )}
                <tr className="font-bold bg-amber-50/50 text-amber-700 border-b border-slate-300">
                  <td className="border border-slate-300 px-4 py-1.5 text-left">Total Beban Operasional</td>
                  <td className="border border-slate-300 px-3 py-1.5 text-right">({formatCurrency(labaRugi.expenses.totalExpenses)})</td>
                </tr>

                <tr className="font-bold bg-emerald-100 text-emerald-800 border-b-2 border-emerald-700">
                  <td className="border border-slate-300 px-3 py-2 text-left uppercase">V. SISA HASIL USAHA BERSIH (SHU AKHIR RAT)</td>
                  <td className="border border-slate-300 px-3 py-2 text-right">{formatCurrency(labaRugi.netShu)}</td>
                </tr>
              </tbody>
            </table>

            {/* Tanda Tangan */}
            <div className="mt-8 grid grid-cols-2 text-center text-[10px] break-inside-avoid" style={{ pageBreakInside: "avoid" }}>
              {/* Row 1: Date on the right, empty on the left */}
              <div></div>
              <div className="text-center font-medium pr-4 mb-2">
                {fullDate}
              </div>
              
              {/* Row 2: Titles & Names */}
              <div className="space-y-16">
                <p className="font-semibold text-slate-700 uppercase tracking-wider">{leftTitle}</p>
                <p className="font-bold text-slate-900">{leftName}</p>
              </div>
              <div className="space-y-16">
                <p className="font-semibold text-slate-700 uppercase tracking-wider">{rightTitle}</p>
                <p className="font-bold text-slate-900">{rightName}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
