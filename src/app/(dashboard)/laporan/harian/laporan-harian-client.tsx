"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Banknote, CreditCard, QrCode, ShoppingBag, TrendingUp, Calendar, Search, Filter, Download, FileText } from "lucide-react"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import ExcelJS from "exceljs"
import { saveAs } from "file-saver"
import { generatePdfHeader, generatePdfFooter, generateExcelHeader, generateExcelFooter } from "@/lib/report-helpers"

const formatRp = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

const PAYMENT_LABEL: Record<string, { label: string; icon: any; cls: string }> = {
  cash:     { label: "Tunai",    icon: Banknote,   cls: "bg-green-100 text-green-700" },
  paylater: { label: "Bayar Tempo", icon: CreditCard,  cls: "bg-amber-100 text-amber-700" },
  qris:     { label: "QRIS",    icon: QrCode,      cls: "bg-blue-100 text-blue-700" },
  transfer: { label: "Transfer", icon: Banknote,   cls: "bg-purple-100 text-purple-700" },
}

export function LaporanHarianClient({ data, from, to, q, templateConfig }: { data: any; from: string; to: string; q: string; templateConfig?: any }) {
  const router = useRouter()
  
  const [search, setSearch] = useState(q)
  const [dateFrom, setDateFrom] = useState(from || new Date().toISOString().split("T")[0])
  const [dateTo, setDateTo] = useState(to || new Date().toISOString().split("T")[0])

  const handleFilter = () => {
    const params = new URLSearchParams()
    if (search) params.set("q", search)
    if (dateFrom) params.set("from", dateFrom)
    if (dateTo) params.set("to", dateTo)
    
    router.push(`?${params.toString()}`)
  }

  const setPresetDate = (preset: "hari" | "minggu" | "bulan") => {
    const now = new Date()
    let start = new Date()
    let end = new Date()
    
    if (preset === "hari") {
      // today
    } else if (preset === "minggu") {
      start.setDate(now.getDate() - now.getDay())
    } else if (preset === "bulan") {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    }

    const fmt = (d: Date) => {
      const pad = (n: number) => n.toString().padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    }

    setDateFrom(fmt(start))
    setDateTo(fmt(end))
    
    const params = new URLSearchParams()
    if (search) params.set("q", search)
    params.set("from", fmt(start))
    params.set("to", fmt(end))
    
    router.push(`?${params.toString()}`)
  }

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet("Transaksi POS")

    worksheet.columns = [
      { header: 'No. Transaksi', key: 'order_no', width: 20 },
      { header: 'Pelanggan', key: 'member', width: 30 },
      { header: 'Pembayaran', key: 'pm', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Total (Rp)', key: 'total', width: 18 },
      { header: 'Tanggal Waktu', key: 'time', width: 25 },
    ]

    const startRow = generateExcelHeader(worksheet, "LAPORAN HARIAN TRANSAKSI TOKO", data.tanggal, 6, templateConfig)

    const headerRow = worksheet.getRow(startRow)
    headerRow.values = ['No. Transaksi', 'Pelanggan', 'Pembayaran', 'Status', 'Total (Rp)', 'Tanggal Waktu']
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2980B9' } }
      cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }
    })

    let currentRow = startRow + 1;
    data.orders.forEach((o: any) => {
      const pm = PAYMENT_LABEL[o.payment_method] || { label: o.payment_method }
      const status = o.payment_status === "paid" ? "Lunas" : "Belum Lunas"
      
      const dataRow = worksheet.getRow(currentRow)
      dataRow.values = {
        order_no: o.order_no,
        member: o.member_name,
        pm: pm.label,
        status: status,
        total: o.grand_total,
        time: `${new Date(o.ordered_at).toLocaleDateString('id-ID')} ${formatTime(o.ordered_at)}`
      }
      
      dataRow.getCell('total').numFmt = '"Rp"#,##0.00;[Red]-"Rp"#,##0.00'
      dataRow.eachCell(cell => cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} })
      currentRow++
    })

    // Summary at the bottom
    currentRow += 2;
    worksheet.getCell(`A${currentRow}`).value = "RINGKASAN"
    worksheet.getCell(`A${currentRow}`).font = { bold: true }
    
    worksheet.getCell(`A${currentRow+1}`).value = "Total Transaksi:"
    worksheet.getCell(`B${currentRow+1}`).value = data.totalTransaksi
    
    worksheet.getCell(`A${currentRow+2}`).value = "Total Pendapatan:"
    worksheet.getCell(`B${currentRow+2}`).value = data.totalPendapatan
    worksheet.getCell(`B${currentRow+2}`).numFmt = '"Rp"#,##0.00'
    
    worksheet.getCell(`A${currentRow+3}`).value = "Tunai:"
    worksheet.getCell(`B${currentRow+3}`).value = data.totalTunai
    worksheet.getCell(`B${currentRow+3}`).numFmt = '"Rp"#,##0.00'

    worksheet.getCell(`A${currentRow+4}`).value = "Bayar Tempo:"
    worksheet.getCell(`B${currentRow+4}`).value = data.totalPaylater
    worksheet.getCell(`B${currentRow+4}`).numFmt = '"Rp"#,##0.00'

    worksheet.getCell(`A${currentRow+5}`).value = "QRIS:"
    worksheet.getCell(`B${currentRow+5}`).value = data.totalQris
    worksheet.getCell(`B${currentRow+5}`).numFmt = '"Rp"#,##0.00'

    const lastFooterRow = generateExcelFooter(worksheet, currentRow + 6, 6, templateConfig)

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    saveAs(blob, `Laporan_Harian_Toko_${dateFrom}.xlsx`)
  }

  const handleExportPDF = () => {
    const doc = new jsPDF()
    const startY = generatePdfHeader(doc, "LAPORAN HARIAN TRANSAKSI TOKO", data.tanggal, templateConfig)
    
    const tableData = data.orders.map((o: any) => {
      const pm = PAYMENT_LABEL[o.payment_method] || { label: o.payment_method }
      return [
        o.order_no,
        o.member_name,
        pm.label,
        o.payment_status === "paid" ? "Lunas" : "Belum",
        formatRp(o.grand_total),
        `${new Date(o.ordered_at).toLocaleDateString('id-ID')} ${formatTime(o.ordered_at)}`
      ]
    })

    autoTable(doc, {
      startY: startY,
      head: [['No. Transaksi', 'Pelanggan', 'Bayar', 'Status', 'Total', 'Waktu']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
    })

    const finalY = (doc as any).lastAutoTable.finalY + 10
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.text("RINGKASAN", 14, finalY)
    doc.setFont("helvetica", "normal")
    doc.text(`Total Transaksi: ${data.totalTransaksi}`, 14, finalY + 6)
    doc.text(`Total Pendapatan: ${formatRp(data.totalPendapatan)}`, 14, finalY + 12)
    doc.text(`Tunai: ${formatRp(data.totalTunai)}  |  Bayar Tempo: ${formatRp(data.totalPaylater)}  |  QRIS: ${formatRp(data.totalQris)}`, 14, finalY + 18)

    generatePdfFooter(doc, finalY + 24, templateConfig)

    doc.save(`Laporan_Harian_Toko_${dateFrom}.pdf`)
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-card p-4 rounded-xl border shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Filter Laporan Transaksi POS</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <span className="text-xs font-medium">Pencarian NIK / Nama</span>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Cari..." 
                className="pl-9" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <span className="text-xs font-medium">Dari Tanggal</span>
            <Input 
              type="date" 
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          
          <div className="space-y-1.5">
            <span className="text-xs font-medium">Sampai Tanggal</span>
            <Input 
              type="date" 
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          
          <div className="flex items-end gap-2">
            <Button onClick={handleFilter} className="w-full">Terapkan Filter</Button>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <span className="text-xs text-muted-foreground flex items-center mr-2">Pilih Cepat:</span>
          <Button variant="outline" size="sm" onClick={() => setPresetDate("hari")} className="h-8 text-xs">Hari Ini</Button>
          <Button variant="outline" size="sm" onClick={() => setPresetDate("minggu")} className="h-8 text-xs">Minggu Ini</Button>
          <Button variant="outline" size="sm" onClick={() => setPresetDate("bulan")} className="h-8 text-xs">Bulan Ini</Button>
        </div>
      </div>

      <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border">
        <div className="text-sm text-muted-foreground">
          Laporan periode: <strong className="text-foreground">{data.tanggal}</strong>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportExcel} className="bg-green-600 hover:bg-green-700 h-9 px-3 text-xs">
            <Download className="mr-2 h-4 w-4" /> Excel
          </Button>
          <Button onClick={handleExportPDF} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 h-9 px-3 text-xs">
            <FileText className="mr-2 h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <ShoppingBag className="h-8 w-8 text-blue-500 bg-blue-50 rounded-lg p-1.5" />
              <div>
                <p className="text-xs text-muted-foreground">Total Transaksi</p>
                <p className="text-2xl font-bold">{data.totalTransaksi}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-green-500 bg-green-50 rounded-lg p-1.5" />
              <div>
                <p className="text-xs text-muted-foreground">Total Pendapatan</p>
                <p className="text-xl font-bold">{formatRp(data.totalPendapatan)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <CreditCard className="h-8 w-8 text-amber-500 bg-amber-50 rounded-lg p-1.5" />
              <div>
                <p className="text-xs text-muted-foreground">Bayar Tempo</p>
                <p className="text-xl font-bold">{formatRp(data.totalPaylater)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <QrCode className="h-8 w-8 text-purple-500 bg-purple-50 rounded-lg p-1.5" />
              <div>
                <p className="text-xs text-muted-foreground">QRIS</p>
                <p className="text-xl font-bold">{formatRp(data.totalQris)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Transaksi</TableHead>
              <TableHead>Pelanggan</TableHead>
              <TableHead className="text-center">Item</TableHead>
              <TableHead>Pembayaran</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Tanggal Waktu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  Tidak ada transaksi pada periode/filter ini.
                </TableCell>
              </TableRow>
            )}
            {data.orders.map((o: any) => {
              const pm = PAYMENT_LABEL[o.payment_method] || { label: o.payment_method, icon: Banknote, cls: "bg-slate-100" }
              const Icon = pm.icon
              return (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs font-semibold">{o.order_no}</TableCell>
                  <TableCell>{o.member_name}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{o.item_count} item</Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1 w-fit ${pm.cls}`}>
                      <Icon className="h-3 w-3" /> {pm.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={o.payment_status === "paid" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}>
                      {o.payment_status === "paid" ? "Lunas" : "Belum Lunas"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{formatRp(o.grand_total)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(o.ordered_at).toLocaleDateString('id-ID')} {formatTime(o.ordered_at)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Recap */}
      {data.orders.length > 0 && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-100">
          <CardContent className="pt-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">Tunai</p>
                <p className="font-bold text-green-700">{formatRp(data.totalTunai)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">QRIS</p>
                <p className="font-bold text-blue-700">{formatRp(data.totalQris)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bayar Tempo (Tagihan)</p>
                <p className="font-bold text-amber-700">{formatRp(data.totalPaylater)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
