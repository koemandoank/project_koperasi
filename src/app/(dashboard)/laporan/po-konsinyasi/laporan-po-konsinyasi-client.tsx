'use client'

import React, { useState, useTransition, Fragment } from 'react'
import { getPOReport, getConsignmentReport } from '@/lib/actions/laporan-po-konsinyasi'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, Filter, FileText, Package, TrendingUp, ChevronDown, ChevronRight, Download } from 'lucide-react'
import { toast } from 'sonner'
import { ReportTemplateConfig } from '@/lib/actions/settings'
import {
  generateExcelHeader,
  generateExcelFooter,
  generatePdfHeader,
  generatePdfFooter
} from '@/lib/report-helpers'

type PORow = Awaited<ReturnType<typeof getPOReport>>[number]
type ConsignmentRow = Awaited<ReturnType<typeof getConsignmentReport>>[number]

const STATUS_PO: Record<string, string> = {
  draft: 'Draft', ordered: 'Dikirim', received: 'Diterima', cancelled: 'Dibatalkan'
}
const STATUS_CONSIGNMENT: Record<string, string> = {
  active: 'Aktif', returned: 'Diretur', settled: 'Diselesaikan'
}

const PRESET_RANGES = [
  { label: 'Hari Ini',    days: 0 },
  { label: '7 Hari',     days: 7 },
  { label: '30 Hari',    days: 30 },
  { label: '3 Bulan',    days: 90 },
]

function getPresetDates(days: number) {
  const to = new Date()
  const from = new Date()
  if (days > 0) from.setDate(from.getDate() - days)
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  return { from: fmt(from), to: fmt(to) }
}

interface Props {
  suppliers: { id: number; supplier_name: string }[]
  products:  { id: number; name: string; sku: string }[]
  templateConfig?: ReportTemplateConfig
}

export default function LaporanPOKonsinyasiClient({ suppliers, products, templateConfig }: Props) {
  const [isPending, startTransition] = useTransition()

  // Filter state
  const [dateFrom,    setDateFrom]    = useState('')
  const [dateTo,      setDateTo]      = useState('')
  const [supplierId,  setSupplierId]  = useState('all')
  const [productId,   setProductId]   = useState('all')
  const [reportType,  setReportType]  = useState('all') // 'all', 'po', 'konsinyasi'
  const [statusPO,    setStatusPO]    = useState('all')
  const [statusCon,   setStatusCon]   = useState('all')

  // Data state
  const [poData,   setPOData]   = useState<PORow[]>([])
  const [conData,  setConData]  = useState<ConsignmentRow[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  // Expanded PO row
  const [expandedPO, setExpandedPO] = useState<number | null>(null)

  function applyPreset(days: number) {
    const { from, to } = getPresetDates(days)
    setDateFrom(from)
    setDateTo(to)
  }

  function buildFilter() {
    return {
      dateFrom:   dateFrom || undefined,
      dateTo:     dateTo   || undefined,
      supplierId: supplierId !== 'all' ? Number(supplierId) : undefined,
      productId:  productId  !== 'all' ? Number(productId)  : undefined,
    }
  }

  function handleSearch() {
    startTransition(async () => {
      try {
        const base = buildFilter()
        
        let po: PORow[] = []
        let con: ConsignmentRow[] = []

        if (reportType === 'all' || reportType === 'po') {
          po = await getPOReport({ ...base, status: statusPO !== 'all' ? statusPO : undefined })
        }
        if (reportType === 'all' || reportType === 'konsinyasi') {
          con = await getConsignmentReport({ ...base, status: statusCon !== 'all' ? statusCon : undefined })
        }
        
        setPOData(po)
        setConData(con)
        setHasSearched(true)
      } catch (e: any) {
        toast.error(e?.message ?? 'Gagal memuat laporan')
      }
    })
  }

  // ── EXPORT FUNCTIONS ──
  const exportExcel = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default
      const workbook = new ExcelJS.Workbook()
      const datePeriodStr = `Dicetak: ${new Date().toLocaleString('id-ID')}`
      
      if (reportType === 'all' || reportType === 'po') {
        const wsPO = workbook.addWorksheet('Purchase Order')
        
        wsPO.getColumn(1).width = 20
        wsPO.getColumn(2).width = 15
        wsPO.getColumn(3).width = 30
        wsPO.getColumn(4).width = 18
        wsPO.getColumn(5).width = 15
        wsPO.getColumn(6).width = 18
        wsPO.getColumn(7).width = 20

        const startRow = generateExcelHeader(
          wsPO,
          'LAPORAN PURCHASE ORDER (PO)',
          datePeriodStr,
          7,
          templateConfig
        )

        // Header Styling
        const headerRow = wsPO.getRow(startRow)
        headerRow.values = ['No. PO', 'Tgl PO', 'Supplier', 'Total Amount', 'Status', '', '']
        wsPO.mergeCells(headerRow.number, 5, headerRow.number, 7)
        for (let i = 1; i <= 7; i++) {
          const cell = headerRow.getCell(i)
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } }
          cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }
          cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }
        }
        headerRow.height = 24

        let currentRow = startRow + 1

        poData.forEach(po => {
          const row = wsPO.getRow(currentRow)
          row.values = [po.po_no, po.po_date, po.supplier_name, po.total_amount, STATUS_PO[po.status] || po.status, '', '']
          wsPO.mergeCells(row.number, 5, row.number, 7)
          row.getCell(4).numFmt = '"Rp"#,##0.00'
          for (let i = 1; i <= 7; i++) {
            row.getCell(i).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }
          }
          currentRow++
          
          const itemHeader = wsPO.getRow(currentRow)
          itemHeader.values = ['', 'SKU', 'Produk', 'Qty Pesan', 'Qty Terima', 'Harga', 'Total']
          for (let i = 2; i <= 7; i++) {
            const cell = itemHeader.getCell(i)
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }
            cell.font = { bold: true }
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }
            if (i >= 4) cell.alignment = { horizontal: 'right' }
          }
          currentRow++

          po.items.forEach(item => {
            const iRow = wsPO.getRow(currentRow)
            iRow.values = ['', item.product_sku, item.product_name, item.qty_ordered, item.qty_received, item.unit_price, item.total_price]
            iRow.getCell(6).numFmt = '"Rp"#,##0.00'
            iRow.getCell(7).numFmt = '"Rp"#,##0.00'
            for (let i = 2; i <= 7; i++) {
              iRow.getCell(i).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }
            }
            currentRow++
          })
          
          wsPO.getRow(currentRow).values = [] // blank row separator
          currentRow++
        })

        generateExcelFooter(wsPO, currentRow, 7, templateConfig)
      }

      if (reportType === 'all' || reportType === 'konsinyasi') {
        const wsCon = workbook.addWorksheet('Konsinyasi')
        
        wsCon.getColumn(1).width = 15
        wsCon.getColumn(2).width = 15
        wsCon.getColumn(3).width = 30
        wsCon.getColumn(4).width = 25
        wsCon.getColumn(5).width = 12
        wsCon.getColumn(6).width = 12
        wsCon.getColumn(7).width = 12
        wsCon.getColumn(8).width = 18
        wsCon.getColumn(9).width = 18
        wsCon.getColumn(10).width = 18
        wsCon.getColumn(11).width = 15
        wsCon.getColumn(12).width = 25

        const startRow = generateExcelHeader(
          wsCon,
          'LAPORAN KONSINYASI (TITIP JUAL)',
          datePeriodStr,
          12,
          templateConfig
        )

        const headerRow = wsCon.getRow(startRow)
        headerRow.values = ['Tgl Masuk', 'SKU', 'Produk', 'Supplier', 'Diterima', 'Terjual', 'Sisa', 'HPP/Unit', 'Tagihan', 'Margin', 'Status', 'Retur']
        headerRow.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } }
          cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }
          cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }
        })
        headerRow.height = 24

        let currentRow = startRow + 1

        conData.forEach(c => {
          const row = wsCon.getRow(currentRow)
          row.values = [
            c.consignment_date, c.product_sku, c.product_name, c.supplier_name,
            c.qty_received, c.qty_sold, c.qty_remaining, c.unit_price, c.total_payable, c.margin,
            STATUS_CONSIGNMENT[c.status] || c.status, c.return_reason || '-'
          ]
          row.getCell(8).numFmt = '"Rp"#,##0.00'
          row.getCell(9).numFmt = '"Rp"#,##0.00'
          row.getCell(10).numFmt = '"Rp"#,##0.00'
          row.eachCell(cell => {
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }
          })
          currentRow++
        })

        generateExcelFooter(wsCon, currentRow, 12, templateConfig)
      }

      const buf = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Laporan_PO_Konsinyasi_${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      toast.error('Gagal export Excel')
    }
  }

  const exportPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF()
      const datePeriodStr = `Dicetak: ${new Date().toLocaleString('id-ID')}`

      let startY = generatePdfHeader(doc, 'LAPORAN PURCHASE ORDER & KONSINYASI', datePeriodStr, templateConfig)

      if (reportType === 'all' || reportType === 'po') {
        doc.setFontSize(11)
        doc.setFont("helvetica", "bold")
        doc.text('Data Purchase Order', 14, startY)
        const poRows: any[] = []
        poData.forEach(po => {
          poRows.push([po.po_no, po.po_date, po.supplier_name, formatCurrency(po.total_amount), STATUS_PO[po.status] || po.status])
        })
        autoTable(doc, {
          startY: startY + 4,
          head: [['No. PO', 'Tgl PO', 'Supplier', 'Total', 'Status']],
          body: poRows,
          theme: 'striped',
          headStyles: { fillColor: [31, 78, 120] }
        })
        startY = (doc as any).lastAutoTable.finalY + 12
      }

      if (reportType === 'all' || reportType === 'konsinyasi') {
        if (startY > 230) { doc.addPage(); startY = 20 }
        doc.setFontSize(11)
        doc.setFont("helvetica", "bold")
        doc.text('Data Konsinyasi (Titip Jual)', 14, startY)
        const conRows: any[] = []
        conData.forEach(c => {
          conRows.push([
            c.consignment_date, c.product_name, c.supplier_name,
            c.qty_received.toString(), c.qty_sold.toString(), c.qty_remaining.toString(),
            formatCurrency(c.total_payable), STATUS_CONSIGNMENT[c.status] || c.status
          ])
        })
        autoTable(doc, {
          startY: startY + 4,
          head: [['Tgl', 'Produk', 'Supplier', 'Terima', 'Laku', 'Sisa', 'Tagihan', 'Status']],
          body: conRows,
          styles: { fontSize: 8 },
          theme: 'striped',
          headStyles: { fillColor: [31, 78, 120] }
        })
        startY = (doc as any).lastAutoTable.finalY + 12
      }

      generatePdfFooter(doc, startY, templateConfig)

      doc.save(`Laporan_PO_Konsinyasi_${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (error) {
      toast.error('Gagal export PDF')
    }
  }

  // ── Summary calculations
  const poSummary = {
    total: poData.length,
    totalAmount: poData.reduce((s, r) => s + r.total_amount, 0),
    totalItems: poData.reduce((s, r) => s + r.items.reduce((si, i) => si + i.qty_ordered, 0), 0),
  }
  const conSummary = {
    total: conData.length,
    totalSold: conData.reduce((s, r) => s + r.qty_sold, 0),
    totalSoldValue: conData.reduce((s, r) => s + r.total_sold_value, 0),
    totalPayable: conData.reduce((s, r) => s + r.total_payable, 0),
    totalMargin: conData.reduce((s, r) => s + r.margin, 0),
  }

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      draft: 'secondary', ordered: 'default', received: 'default',
      cancelled: 'destructive', active: 'default', returned: 'secondary', settled: 'default',
    }
    return <Badge variant={(map[s] ?? 'secondary') as any}>{STATUS_PO[s] ?? STATUS_CONSIGNMENT[s] ?? s}</Badge>
  }

  return (
    <div className="space-y-6">

      {/* ── Filter Panel */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4 text-indigo-500" /> Filter Laporan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Preset range */}
          <div className="flex flex-wrap gap-2">
            {PRESET_RANGES.map(p => (
              <Button key={p.label} variant="outline" size="sm"
                onClick={() => applyPreset(p.days)}
              >
                {p.label}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date From */}
            <div className="space-y-1">
              <Label className="text-xs">Dari Tanggal</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            {/* Date To */}
            <div className="space-y-1">
              <Label className="text-xs">Sampai Tanggal</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Jenis Laporan</Label>
              <Select value={reportType} onValueChange={v => setReportType(v ?? "all")}>
                <SelectTrigger><SelectValue placeholder="Pilih Jenis" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua (PO & Konsinyasi)</SelectItem>
                  <SelectItem value="po">PO Saja</SelectItem>
                  <SelectItem value="konsinyasi">Konsinyasi Saja</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Supplier */}
            <div className="space-y-1">
              <Label className="text-xs">Supplier</Label>
              <Select value={supplierId} onValueChange={v => setSupplierId(v ?? "all")}>
                <SelectTrigger><SelectValue placeholder="Semua Supplier" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Supplier</SelectItem>
                  {suppliers.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.supplier_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Product */}
            <div className="space-y-1">
              <Label className="text-xs">Produk</Label>
              <Select value={productId} onValueChange={v => setProductId(v ?? "all")}>
                <SelectTrigger><SelectValue placeholder="Semua Produk" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Produk</SelectItem>
                  {products.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <Button onClick={handleSearch} disabled={isPending} className="flex-1 gap-2">
              <Search className="h-4 w-4" />
              {isPending ? 'Memuat...' : 'Tampilkan Laporan'}
            </Button>
            {hasSearched && (
              <>
                <Button variant="outline" onClick={exportExcel} className="gap-2 text-green-700 hover:text-green-800 hover:bg-green-50 border-green-200">
                  <Download className="h-4 w-4" /> Excel
                </Button>
                <Button variant="outline" onClick={exportPDF} className="gap-2 text-red-700 hover:text-red-800 hover:bg-red-50 border-red-200">
                  <Download className="h-4 w-4" /> PDF
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Results */}
      {hasSearched && (
        <Tabs key={reportType} defaultValue={reportType === 'konsinyasi' ? 'konsinyasi' : 'po'}>
          {reportType === 'all' && (
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="po" className="gap-2">
                <FileText className="h-4 w-4" /> Purchase Order ({poData.length})
              </TabsTrigger>
              <TabsTrigger value="konsinyasi" className="gap-2">
                <Package className="h-4 w-4" /> Konsinyasi ({conData.length})
              </TabsTrigger>
            </TabsList>
          )}

          {/* ─── PO TAB ─── */}
          {(reportType === 'all' || reportType === 'po') && (
            <TabsContent value="po" className={reportType === 'all' ? "space-y-4" : "space-y-4 mt-0"}>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card><CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Total PO</p>
                <p className="text-2xl font-bold">{poSummary.total}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Total Item Dipesan</p>
                <p className="text-2xl font-bold">{poSummary.totalItems}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Total Nilai PO</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(poSummary.totalAmount)}</p>
              </CardContent></Card>
            </div>

            {/* Status filter */}
            <div className="flex gap-2 items-center">
              <Label className="text-xs shrink-0">Status PO:</Label>
              {['all', 'draft', 'ordered', 'received', 'cancelled'].map(s => (
                <Button key={s} size="sm"
                  variant={statusPO === s ? 'default' : 'outline'}
                  onClick={() => setStatusPO(s)}
                  className="text-xs h-7"
                >
                  {s === 'all' ? 'Semua' : STATUS_PO[s]}
                </Button>
              ))}
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>No. PO</TableHead>
                      <TableHead>Tgl PO</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>GR</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {poData.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Tidak ada data PO untuk filter ini.</TableCell></TableRow>
                    )}
                    {poData.map(po => (
                      <Fragment key={po.id}>
                        <TableRow className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setExpandedPO(expandedPO === po.id ? null : po.id)}
                        >
                          <TableCell>
                            {expandedPO === po.id
                              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            }
                          </TableCell>
                          <TableCell className="font-mono text-sm font-semibold">{po.po_no}</TableCell>
                          <TableCell>{po.po_date}</TableCell>
                          <TableCell>{po.supplier_name}</TableCell>
                          <TableCell>{po.items.length} produk</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(po.total_amount)}</TableCell>
                          <TableCell>
                            {po.good_receipts.length > 0
                              ? <Badge variant="default">{po.good_receipts.length} GR</Badge>
                              : <Badge variant="secondary">Belum ada</Badge>
                            }
                          </TableCell>
                          <TableCell>{statusBadge(po.status)}</TableCell>
                        </TableRow>
                        {expandedPO === po.id && (
                          <TableRow key={`${po.id}-detail`}>
                            <TableCell colSpan={8} className="bg-muted/30 p-0">
                              <div className="p-4">
                                <p className="text-xs font-semibold text-muted-foreground mb-2">Detail Item PO</p>
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-xs text-muted-foreground border-b">
                                      <th className="text-left pb-1">SKU</th>
                                      <th className="text-left pb-1">Produk</th>
                                      <th className="text-right pb-1">Qty Pesan</th>
                                      <th className="text-right pb-1">Qty Terima</th>
                                      <th className="text-right pb-1">Harga</th>
                                      <th className="text-right pb-1">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {po.items.map(item => (
                                      <tr key={item.id} className="border-b last:border-0">
                                        <td className="py-1 font-mono text-xs text-muted-foreground">{item.product_sku}</td>
                                        <td className="py-1">{item.product_name}</td>
                                        <td className="py-1 text-right">{item.qty_ordered}</td>
                                        <td className="py-1 text-right">{item.qty_received}</td>
                                        <td className="py-1 text-right">{formatCurrency(item.unit_price)}</td>
                                        <td className="py-1 text-right font-semibold">{formatCurrency(item.total_price)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            </TabsContent>
          )}

          {/* ─── KONSINYASI TAB ─── */}
          {(reportType === 'all' || reportType === 'konsinyasi') && (
            <TabsContent value="konsinyasi" className={reportType === 'all' ? "space-y-4" : "space-y-4 mt-0"}>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card><CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Total Entri</p>
                <p className="text-2xl font-bold">{conSummary.total}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Total Terjual</p>
                <p className="text-2xl font-bold">{conSummary.totalSold} unit</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Total Tagihan Supplier</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(conSummary.totalPayable)}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3 text-green-500" /> Margin Toko</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(conSummary.totalMargin)}</p>
              </CardContent></Card>
            </div>

            {/* Status filter */}
            <div className="flex gap-2 items-center">
              <Label className="text-xs shrink-0">Status:</Label>
              {['all', 'active', 'returned', 'settled'].map(s => (
                <Button key={s} size="sm"
                  variant={statusCon === s ? 'default' : 'outline'}
                  onClick={() => setStatusCon(s)}
                  className="text-xs h-7"
                >
                  {s === 'all' ? 'Semua' : STATUS_CONSIGNMENT[s]}
                </Button>
              ))}
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tgl Masuk</TableHead>
                      <TableHead>Produk</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead className="text-right">Diterima</TableHead>
                      <TableHead className="text-right">Terjual</TableHead>
                      <TableHead className="text-right">Sisa</TableHead>
                      <TableHead className="text-right">HPP/Unit</TableHead>
                      <TableHead className="text-right">Total Tagihan</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Alasan Retur</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conData.length === 0 && (
                      <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Tidak ada data konsinyasi untuk filter ini.</TableCell></TableRow>
                    )}
                    {conData.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="text-sm">{c.consignment_date}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{c.product_name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{c.product_sku}</p>
                          </div>
                        </TableCell>
                        <TableCell>{c.supplier_name}</TableCell>
                        <TableCell className="text-right">{c.qty_received}</TableCell>
                        <TableCell className="text-right font-semibold">{c.qty_sold}</TableCell>
                        <TableCell className="text-right">{c.qty_remaining}</TableCell>
                        <TableCell className="text-right">{formatCurrency(c.unit_price)}</TableCell>
                        <TableCell className="text-right text-red-600 font-semibold">{formatCurrency(c.total_payable)}</TableCell>
                        <TableCell className="text-right text-green-600 font-semibold">{formatCurrency(c.margin)}</TableCell>
                        <TableCell>{statusBadge(c.status)}</TableCell>
                        <TableCell>
                          {c.return_reason ? (
                            <div className="text-xs text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 max-w-[140px]">
                              {c.return_reason}
                              {c.return_date && <span className="block text-muted-foreground">{c.return_date}</span>}
                            </div>
                          ) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            </TabsContent>
          )}
        </Tabs>
      )}

      {!hasSearched && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <FileText className="h-12 w-12 mb-3 opacity-20" />
          <p className="text-sm">Pilih filter lalu klik <strong>Tampilkan Laporan</strong></p>
        </div>
      )}
    </div>
  )
}
