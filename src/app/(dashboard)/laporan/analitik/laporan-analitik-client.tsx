'use client'

import React, { useState, useTransition, useMemo } from 'react'
import { getAnalyticsData, type AnalyticsResult } from '@/lib/actions/laporan-analitik'
import { getTransaksiKasirDetail, type TransaksiKasirRow } from '@/lib/actions/laporan-transaksi-kasir'
import { getLaporanMingguanData, type MingguanResult } from '@/lib/actions/laporan-mingguan'
import { getMembers } from '@/lib/actions/members'
import { getMonthlyDeductionReport, type MemberDeductionRow } from '@/lib/actions/reports'
import { getStockMovements, getMonitoringStockReport } from '@/lib/actions/laporan-stok'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, FileSpreadsheet, FileText, TrendingUp, TrendingDown, DollarSign, Percent, ShoppingBag, PackageOpen, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { ReportTemplateConfig } from '@/lib/actions/settings'
import {
  generateExcelHeader,
  generateExcelFooter,
  generatePdfHeader,
  generatePdfFooter
} from '@/lib/report-helpers'

const formatRp = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Tunai', paylater: 'Bayar Tempo', qris: 'QRIS',
  saving_deduct: 'Potong Simpanan', transfer: 'Transfer', all: 'Semua',
}

const MONTH_OPTIONS = [
  { label: 'Januari', value: '1' },
  { label: 'Februari', value: '2' },
  { label: 'Maret', value: '3' },
  { label: 'April', value: '4' },
  { label: 'Mei', value: '5' },
  { label: 'Juni', value: '6' },
  { label: 'Juli', value: '7' },
  { label: 'Agustus', value: '8' },
  { label: 'September', value: '9' },
  { label: 'Oktober', value: '10' },
  { label: 'November', value: '11' },
  { label: 'Desember', value: '12' },
]

const YEAR_OPTIONS = ['2024', '2025', '2026', '2027', '2028']

const PRESETS = [
  { label: 'Hari Ini',   days: 0 },
  { label: '7 Hari',     days: 7 },
  { label: '30 Hari',    days: 30 },
  { label: 'Bulan Ini',  days: -1 },
  { label: 'Tahun Ini',  days: -2 },
]

function getPresetDates(days: number): { start: string; end: string } {
  const today = new Date()
  const fmt = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  if (days === 0) return { start: fmt(today), end: fmt(today) }
  if (days === -1) {
    return {
      start: fmt(new Date(today.getFullYear(), today.getMonth(), 1)),
      end: fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0))
    }
  }
  if (days === -2) {
    return { start: fmt(new Date(today.getFullYear(), 0, 1)), end: fmt(today) }
  }
  const start = new Date(today); start.setDate(today.getDate() - days)
  return { start: fmt(start), end: fmt(today) }
}

function MarginBadge({ pct }: { pct: number }) {
  const cls = pct >= 20 ? 'bg-green-100 text-green-700' : pct >= 10 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
  return <Badge className={`${cls} border-0`}>{pct}%</Badge>
}

// Month abbreviation → zero-padded number
const MONTH_MAP: Record<string,string> = {
  Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',
  Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12',
}
const BULAN_NAMES = ['','Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember']
const WEEK_ROMAN: Record<number,string> = {1:'I',2:'II',3:'III',4:'IV',5:'V'}

/** Parse "DD-Mon-YY" → Date */
function parseTanggal(s: string): Date {
  const [d, m, y] = s.split('-')
  return new Date(`20${y}-${MONTH_MAP[m] ?? '01'}-${d.padStart(2,'0')}`)
}

export function LaporanAnalitikClient({ templateConfig }: { templateConfig?: ReportTemplateConfig }) {
  const now = new Date()
  const [startDate, setStartDate]     = useState(`${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-01`)
  const [endDate, setEndDate]         = useState(`${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`)
  const [selectedMonth, setSelectedMonth] = useState<string>(String(now.getMonth() + 1))
  const [selectedYear, setSelectedYear]   = useState<string>(String(now.getFullYear()))
  const [payMethod, setPayMethod]     = useState('all')
  const [data, setData]               = useState<AnalyticsResult | null>(null)
  const [detailRows, setDetailRows]   = useState<TransaksiKasirRow[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [isPending, startTransition]  = useTransition()

  // ── Laporan Mingguan state ──────────────────────────────────
  const [mTahun, setMTahun]           = useState(now.getFullYear())
  const [mBulan, setMBulan]           = useState(now.getMonth() + 1)  // 1-12
  const [mMinggu, setMMinggu]         = useState(Math.ceil(now.getDate() / 7))
  const [mingguData, setMingguData]   = useState<MingguanResult | null>(null)
  const [mingguPending, startMingguTransition] = useTransition()
  const [activeTab, setActiveTab]     = useState<'kasir' | 'mingguan' | 'sembako' | 'potongan' | 'stok'>('kasir')
  const [membersList, setMembersList] = useState<any[]>([])
  const [sembakoSearch, setSembakoSearch] = useState('')
  const [onlyActiveSembako, setOnlyActiveSembako] = useState(true)

  // Potongan Gaji states
  const [deductionRows, setDeductionRows] = useState<MemberDeductionRow[]>([])
  const [potonganSearch, setPotonganSearch] = useState('')
  const [onlyActivePotongan, setOnlyActivePotongan] = useState(true)

  // Stock Opname states
  const [monitoringStockRows, setMonitoringStockRows] = useState<any[]>([])
  const [stockSearch, setStockSearch] = useState('')
  const [onlyActiveStock, setOnlyActiveStock] = useState(true)


  const applyPreset = (days: number) => {
    const { start, end } = getPresetDates(days)
    setStartDate(start); setEndDate(end)
    
    // Sinkronkan ke dropdown bulan & tahun berdasarkan start date
    const d = new Date(start)
    setSelectedMonth(String(d.getMonth() + 1))
    setSelectedYear(String(d.getFullYear()))
  }

  /**
   * Mengatur rentang tanggal (startDate & endDate) berdasarkan bulan dan tahun terpilih.
   * 
   * @param {string} month - Bulan terpilih (1-12)
   * @param {string} year - Tahun terpilih (e.g. '2026')
   */
  const handleMonthYearChange = (month: string, year: string) => {
    setSelectedMonth(month)
    setSelectedYear(year)
    const m = parseInt(month, 10) - 1
    const y = parseInt(year, 10)
    
    const fmt = (d: Date) => {
      const pad = (n: number) => n.toString().padStart(2, "0")
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    }
    const firstDay = new Date(y, m, 1)
    const lastDay = new Date(y, m + 1, 0)
    
    setStartDate(fmt(firstDay))
    setEndDate(fmt(lastDay))
  }

  const handleSearch = () => {
    startTransition(async () => {
      try {
        const [result, detail, members, deductions, stocks] = await Promise.all([
          getAnalyticsData({ startDate, endDate, paymentMethod: payMethod }),
          getTransaksiKasirDetail({ startDate, endDate, paymentMethod: payMethod }),
          getMembers(),
          getMonthlyDeductionReport(startDate, endDate),
          getMonitoringStockReport({ startDate, endDate })
        ])
        setData(result)
        setDetailRows(detail)
        setMembersList(members)
        setDeductionRows(deductions)
        setMonitoringStockRows(stocks)
        setHasSearched(true)
      } catch { toast.error('Gagal memuat data analitik') }
    })
  }

  const sembakoRows = useMemo(() => {
    if (!detailRows || !membersList) return []
    const sembakoMap = new Map<string, {
      nik: string
      nama: string
      com1: string
      com2: string
      crdJual: number
      casJual: number
      crdPokok: number
      casPokok: number
      crdLaba: number
    }>()

    membersList.forEach((m: any) => {
      if (m.status === 'active') {
        const com2Val = (m.unit_code || 'U-001').replace(/^U-/, '')
        sembakoMap.set(m.nik, {
          nik: m.nik,
          nama: m.full_name,
          com1: '1',
          com2: com2Val,
          crdJual: 0,
          casJual: 0,
          crdPokok: 0,
          casPokok: 0,
          crdLaba: 0,
        })
      }
    })

    detailRows.forEach((r: any) => {
      if (r.category_slug !== 'sembako') return

      let entry = sembakoMap.get(r.nik)
      if (!entry) {
        entry = {
          nik: r.nik,
          nama: r.nama_anggota,
          com1: '1',
          com2: (r.unit_code || 'U-001').replace(/^U-/, ''),
          crdJual: 0,
          casJual: 0,
          crdPokok: 0,
          casPokok: 0,
          crdLaba: 0,
        }
        sembakoMap.set(r.nik, entry)
      }

      const isCash = r.bayar === 'CAS' || r.bayar === 'QRS' || r.bayar === 'TRF'
      if (isCash) {
        entry.casJual += r.tot_harga_jual
        entry.casPokok += r.tot_harga_pokok
      } else {
        entry.crdJual += r.tot_harga_jual
        entry.crdPokok += r.tot_harga_pokok
        entry.crdLaba += r.laba
      }
    })

    let list = Array.from(sembakoMap.values())

    if (onlyActiveSembako) {
      list = list.filter((item: any) => item.crdJual > 0 || item.casJual > 0)
    }

    if (sembakoSearch.trim() !== '') {
      const q = sembakoSearch.toLowerCase()
      list = list.filter((item: any) => 
        item.nama.toLowerCase().includes(q) || 
        item.nik.toLowerCase().includes(q)
      )
    }

    return list.sort((a, b) => a.nama.localeCompare(b.nama))
  }, [detailRows, membersList, onlyActiveSembako, sembakoSearch])

  const filteredDeductions = useMemo(() => {
    if (!deductionRows) return []
    let list = [...deductionRows]

    if (onlyActivePotongan) {
      // Show only members with actual deductions
      list = list.filter((item: any) => item.total_deduction > 0)
    }

    if (potonganSearch.trim() !== '') {
      const q = potonganSearch.toLowerCase()
      list = list.filter((item: any) => 
        item.name.toLowerCase().includes(q) || 
        item.nik.toLowerCase().includes(q) ||
        item.department.toLowerCase().includes(q)
      )
    }

    return list
  }, [deductionRows, onlyActivePotongan, potonganSearch])

  const filteredStocks = useMemo(() => {
    if (!monitoringStockRows) return []
    let list = [...monitoringStockRows]

    if (onlyActiveStock) {
      // Show only products with activity or current stock
      list = list.filter((item: any) => 
        item.stockAwal > 0 || 
        item.pembelian > 0 || 
        item.totPenjualan > 0 || 
        item.stockAkhir > 0 || 
        item.qtyRetur > 0 || 
        Math.abs(item.penyesuaian || 0) > 0 ||
        (item.stockOpname !== null && item.stockOpname > 0)
      )
    }

    if (stockSearch.trim() !== '') {
      const q = stockSearch.toLowerCase()
      list = list.filter((item: any) => 
        item.name.toLowerCase().includes(q) || 
        item.sku.toLowerCase().includes(q)
      )
    }

    return list
  }, [monitoringStockRows, onlyActiveStock, stockSearch])

  const exportExcel = async () => {
    if (!data) return
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      const datePeriodStr = `${startDate} s/d ${endDate}`

      // ── Sheet 1: Ringkasan ──────────────────────────
      const ws1 = wb.addWorksheet('Ringkasan P&L')
      ws1.getColumn(1).width = 30
      ws1.getColumn(2).width = 22

      const startRow1 = generateExcelHeader(
        ws1,
        'LAPORAN ANALITIK & KEUNTUNGAN TOKO',
        `Periode: ${datePeriodStr} | Metode: ${PAYMENT_LABELS[payMethod] ?? payMethod}`,
        3,
        templateConfig
      )

      const h1 = ws1.getRow(startRow1)
      h1.values = ['Indikator', 'Nilai']
      h1.eachCell(c => { c.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FF1F4E78'} }; c.font = { color:{argb:'FFFFFFFF'}, bold:true }; c.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} } })
      
      const rows1 = [
        ['Omzet (Penjualan)', data.summary.omzet],
        ['Modal Pembelian (HPP)', data.summary.cogs],
        ['Laba Kotor', data.summary.gross_profit],
        ['Margin Kotor (%)', `${data.summary.margin_pct}%`],
        ['Jumlah Transaksi', data.summary.transaction_count],
        ['Rata-rata Transaksi', data.summary.avg_transaction],
      ]

      let currentRow1 = startRow1 + 1
      rows1.forEach(([k, v], i) => {
        const r = ws1.getRow(currentRow1)
        r.values = [k, v]
        if (typeof v === 'number' && i !== 3 && i !== 4) r.getCell(2).numFmt = '"Rp"#,##0'
        r.eachCell(c => { c.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} } })
        currentRow1++
      })

      generateExcelFooter(ws1, currentRow1, 3, templateConfig)

      // ── Sheet 2: Per Produk ─────────────────────────
      const ws2 = wb.addWorksheet('Keuntungan per Produk')
      ws2.getColumn(1).width = 5
      ws2.getColumn(2).width = 35
      ws2.getColumn(3).width = 12
      ws2.getColumn(4).width = 18
      ws2.getColumn(5).width = 18
      ws2.getColumn(6).width = 18
      ws2.getColumn(7).width = 12

      const startRow2 = generateExcelHeader(
        ws2,
        'LAPORAN KEUNTUNGAN PER PRODUK',
        `Periode: ${datePeriodStr}`,
        7,
        templateConfig
      )

      const h2 = ws2.getRow(startRow2)
      h2.values = ['#','Produk','Qty Terjual','Omzet','Modal (HPP)','Laba Kotor','Margin %']
      h2.eachCell(c => { c.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FF1F4E78'} }; c.font = { color:{argb:'FFFFFFFF'}, bold:true }; c.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} } })
      
      let currentRow2 = startRow2 + 1
      data.topProducts.forEach((p: any, idx: any) => {
        const r = ws2.getRow(currentRow2)
        r.values = [idx+1, p.product_name, p.total_qty, p.total_revenue, p.total_cogs, p.gross_profit, `${p.margin_pct}%`]
        ;[4,5,6].forEach((i: any) => r.getCell(i).numFmt = '"Rp"#,##0')
        if (p.gross_profit < 0) r.getCell(6).font = { color:{argb:'FFDC2626'}, bold:true }
        r.eachCell(c => { c.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} } })
        currentRow2++
      })

      generateExcelFooter(ws2, currentRow2, 7, templateConfig)

      // ── Sheet 3: Per Metode Bayar ───────────────────
      const ws3 = wb.addWorksheet('Per Metode Bayar')
      ws3.getColumn(1).width = 25
      ws3.getColumn(2).width = 20
      ws3.getColumn(3).width = 22

      const startRow3 = generateExcelHeader(
        ws3,
        'LAPORAN OMZET PER METODE BAYAR',
        `Periode: ${datePeriodStr}`,
        3,
        templateConfig
      )

      const h3 = ws3.getRow(startRow3)
      h3.values = ['Metode Pembayaran','Jumlah Transaksi','Total Omzet']
      h3.eachCell(c => { c.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FF1F4E78'} }; c.font = { color:{argb:'FFFFFFFF'}, bold:true }; c.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} } })
      
      let currentRow3 = startRow3 + 1
      data.byPaymentMethod.forEach((m: any) => {
        const r = ws3.getRow(currentRow3)
        r.values = [PAYMENT_LABELS[m.method]??m.method, m.count, m.total]
        r.getCell(3).numFmt = '"Rp"#,##0'
        r.eachCell(c => { c.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} } })
        currentRow3++
      })

      generateExcelFooter(ws3, currentRow3, 3, templateConfig)

      const buf = await wb.xlsx.writeBuffer()
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}))
      a.download = `Analitik_${startDate}_${endDate}.xlsx`; a.click()
    } catch { toast.error('Gagal export Excel') }
  }

  const exportPDF = async () => {
    if (!data) return
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF()
      const datePeriodStr = `${startDate} s/d ${endDate}`

      let startY = generatePdfHeader(
        doc,
        'LAPORAN ANALITIK & KEUNTUNGAN TOKO',
        `Periode: ${datePeriodStr} | Metode: ${PAYMENT_LABELS[payMethod] ?? payMethod}`,
        templateConfig
      )

      // Summary table
      autoTable(doc, {
        startY: startY,
        head: [['Indikator','Nilai']],
        body: [
          ['Omzet (Penjualan)', formatRp(data.summary.omzet)],
          ['Modal Pembelian (HPP)', formatRp(data.summary.cogs)],
          ['Laba Kotor', formatRp(data.summary.gross_profit)],
          ['Margin Kotor', `${data.summary.margin_pct}%`],
          ['Jumlah Transaksi', String(data.summary.transaction_count)],
        ],
        headStyles: { fillColor: [31,78,120], fontStyle:'bold' },
        columnStyles: { 1: { halign: 'right' } },
        margin: { left: 14 }, tableWidth: 120,
      })

      // Products table
      const y = (doc as any).lastAutoTable.finalY + 10
      if (y > 230) {
        doc.addPage()
        startY = 20
      } else {
        startY = y
      }

      doc.setFont('helvetica','bold'); doc.setFontSize(11)
      doc.text('Keuntungan per Produk', 14, startY)
      autoTable(doc, {
        startY: startY + 4,
        head: [['#','Produk','Qty','Omzet','Modal','Laba Kotor','Margin']],
        body: data.topProducts.map((p: any, i: any) => [
          i+1, p.product_name, p.total_qty,
          formatRp(p.total_revenue), formatRp(p.total_cogs), formatRp(p.gross_profit), `${p.margin_pct}%`
        ]),
        headStyles: { fillColor: [31,78,120] },
        columnStyles: { 3:{halign:'right'}, 4:{halign:'right'}, 5:{halign:'right'}, 6:{halign:'center'} },
        margin: { left: 14 },
      })

      const finalY = (doc as any).lastAutoTable.finalY + 12
      generatePdfFooter(doc, finalY, templateConfig)

      doc.save(`Analitik_${startDate}_${endDate}.pdf`)
    } catch { toast.error('Gagal export PDF') }
  }

  /**
   * Mengambil data transaksi, anggota, potongan gaji, dan monitoring stok secara asinkron,
   * kemudian menyusun dan mengekspor workbook Excel multi-tab terpadu.
   *
   * @async
   * @function exportMultiTabExcel
   * @returns {Promise<void>} Resolves ketika pengunduhan berkas Excel dimulai.
   * @throws {Error} Dilempar ketika pengambilan data atau penulisan berkas Excel gagal.
   */
  const exportMultiTabExcel = async () => {
    try {
      toast.info('Mengambil data transaksi terpadu...')
      const [rows, allMembers, deductions, stocks] = await Promise.all([
        getTransaksiKasirDetail({ startDate, endDate, paymentMethod: payMethod }),
        getMembers(),
        getMonthlyDeductionReport(startDate, endDate),
        getMonitoringStockReport({ startDate, endDate })
      ])

      if (rows.length === 0 && deductions.length === 0 && stocks.length === 0) {
        toast.error('Tidak ada data untuk periode ini')
        return
      }

      toast.info('Membuat file Excel Multi-Tab...')
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()

      // ───────────────────────────────────────────────────────────
      // TAB 1: DATA TRANSAKSI KASIR (DETAIL)
      // ───────────────────────────────────────────────────────────
      const wsDetail = wb.addWorksheet('Detail Transaksi')
      const colWidthsDetail = [5, 14, 6, 6, 18, 22, 28, 6, 16, 16, 16, 16, 14]
      colWidthsDetail.forEach((w: any, i: any) => { wsDetail.getColumn(i + 1).width = w })

      wsDetail.mergeCells('A1:C1')
      const r1 = wsDetail.getCell('A1')
      r1.value = 'PT SULFINDO ADIUSAHA'; r1.font = { bold: true, size: 12 }

      wsDetail.mergeCells('A2:C2')
      wsDetail.getCell('A2').value = 'DATA TRANSAKSI KASIR'
      wsDetail.getCell('A2').font = { bold: true }

      const startD  = new Date(startDate)
      const bulanNm = startD.toLocaleDateString('id-ID', { month: 'long' }).toUpperCase()
      const tahun   = startD.getFullYear()

      const totalQty   = rows.reduce((s: any, r: any) => s + r.qty, 0)
      const totalJual  = rows.reduce((s: any, r: any) => s + r.harga_jual, 0)
      const totalHJual = rows.reduce((s: any, r: any) => s + r.tot_harga_jual, 0)
      const totalHPP   = rows.reduce((s: any, r: any) => s + r.harga_pokok, 0)
      const totalTHPP  = rows.reduce((s: any, r: any) => s + r.tot_harga_pokok, 0)
      const totalLaba  = rows.reduce((s: any, r: any) => s + r.laba, 0)

      const BLUE = 'FF1F4E78'; const WHITE = 'FFFFFFFF'

      // Merged A3:G3 for Bulan info matching the UI bar
      wsDetail.mergeCells('A3:G3')
      const leftCell = wsDetail.getCell('A3')
      leftCell.value = `BULAN: ${bulanNm} ${tahun}`
      leftCell.font = { bold: true, color: { argb: WHITE }, size: 10 }
      leftCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
      leftCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      leftCell.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} }

      for (let colNum = 2; colNum <= 7; colNum++) {
        const c = wsDetail.getCell(3, colNum)
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        c.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} }
      }

      // Merged H3:M3 for Totals matching the UI bar
      wsDetail.mergeCells('H3:M3')
      const rightCell = wsDetail.getCell('H3')
      rightCell.value = `TOTAL QTY: ${totalQty}   TOTAL JUAL: Rp ${totalHJual.toLocaleString('id-ID')}   TOTAL HPP: Rp ${totalTHPP.toLocaleString('id-ID')}   TOTAL LABA: Rp ${totalLaba.toLocaleString('id-ID')}`
      rightCell.font = { bold: true, color: { argb: WHITE }, size: 10 }
      rightCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
      rightCell.alignment = { horizontal: 'right', vertical: 'middle' }
      rightCell.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} }

      for (let colNum = 9; colNum <= 13; colNum++) {
        const c = wsDetail.getCell(3, colNum)
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        c.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} }
      }

      const headers = ['NO','TANGGAL','MINGGU','BAYAR','NIK','NAMA ANGGOTA','NAMA BARANG',
        'QTY','HARGA JUAL','TOT HARGA JUAL','HARGA POKOK','TOT HARGA POKOK','LABA']
      const hRow = wsDetail.addRow(headers)
      hRow.eachCell(c => {
        c.font      = { bold: true, color: { argb: WHITE } }
        c.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        c.alignment = { horizontal: 'center', wrapText: true }
        c.border    = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} }
      })
      hRow.height = 30

      rows.forEach((r: any, idx: any) => {
        const dataRow = wsDetail.addRow([
          r.no, r.tanggal, r.minggu, r.bayar, r.nik, r.nama_anggota, r.nama_barang,
          r.qty, r.harga_jual, r.tot_harga_jual, r.harga_pokok, r.tot_harga_pokok, r.laba
        ])
        const bgColor = idx % 2 === 0 ? 'FFF5F5F5' : 'FFFFFFFF'
        dataRow.eachCell((c, colNum) => {
          c.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
          c.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} }
          c.alignment = { horizontal: colNum > 7 ? 'right' : colNum === 1 ? 'center' : 'left' }
          if (colNum >= 8) c.numFmt = '#,##0'
        })
        const labaCell = dataRow.getCell(13)
        if (r.laba < 0) labaCell.font = { color: { argb: 'FFDC2626' }, bold: true }
        else labaCell.font = { color: { argb: 'FF16A34A' }, bold: true }
      })

      const totRow = wsDetail.addRow(['TOTAL', '', '', '', '', '', '',
        totalQty, totalJual, totalHJual, totalHPP, totalTHPP, totalLaba])
      const rowNum = totRow.number
      wsDetail.mergeCells(`A${rowNum}:G${rowNum}`)
      totRow.eachCell((c, cn) => {
        c.font   = { bold: true, color: { argb: WHITE } }
        c.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        c.border = { top:{style:'medium'}, left:{style:'thin'}, bottom:{style:'medium'}, right:{style:'thin'} }
        if (cn >= 8) {
          c.alignment = { horizontal: cn === 8 ? 'center' : 'right' }
          c.numFmt = '#,##0'
        } else {
          c.alignment = { horizontal: 'center' }
        }
      })
      wsDetail.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }]

      // ───────────────────────────────────────────────────────────
      // TAB 2: LAPORAN MINGGUAN
      // ───────────────────────────────────────────────────────────
      type DayData = { tanggal: string; hppCash: number; jualCash: number; hppKredit: number; jualKredit: number }
      const dayMap = new Map<string, DayData>()
      for (const r of rows) {
        const prev = dayMap.get(r.tanggal) ?? { tanggal: r.tanggal, hppCash: 0, jualCash: 0, hppKredit: 0, jualKredit: 0 }
        const isCash = r.bayar === 'CAS' || r.bayar === 'QRS' || r.bayar === 'TRF'
        if (isCash) {
          prev.hppCash += r.tot_harga_pokok
          prev.jualCash += r.tot_harga_jual
        } else {
          prev.hppKredit += r.tot_harga_pokok
          prev.jualKredit += r.tot_harga_jual
        }
        dayMap.set(r.tanggal, prev)
      }

      const allDates = Array.from(dayMap.keys()).sort((a, b) => {
        const pa = parseTanggal(a), pb = parseTanggal(b)
        return pa.getTime() - pb.getTime()
      })

      const weekGroups = new Map<string, string[]>()
      for (const d of allDates) {
        const dt  = parseTanggal(d)
        const wom = Math.ceil(dt.getDate() / 7)
        const key = `${dt.getFullYear()}-${dt.getMonth()+1}-W${wom}`
        const arr = weekGroups.get(key) ?? []; arr.push(d); weekGroups.set(key, arr)
      }

      const DAY_ID_LOCAL = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']
      let weekSheetNo = 1

      for (const [, dates] of weekGroups) {
        const firstDate  = parseTanggal(dates[0])
        const weekOfMonth = Math.ceil(firstDate.getDate() / 7)
        const bulanLabel  = (BULAN_NAMES[firstDate.getMonth() + 1] ?? '').toUpperCase()
        const RED = 'FFCC0000', YELLOW = 'FFFFE699'
        const center = { alignment: { horizontal:'center' as const, vertical:'middle' as const } }
        const right  = { alignment: { horizontal:'right' as const } }
        const border1 = { border: { top:{style:'thin' as const}, left:{style:'thin' as const}, bottom:{style:'thin' as const}, right:{style:'thin' as const} } }

        const wsWeek = wb.addWorksheet(`Rekap Minggu ${weekSheetNo++}`)
        ;[5,12,16,18,18,18].forEach((w: any, i: any) => wsWeek.getColumn(i+2).width = w)

        wsWeek.getCell('B1').value = 'PT. Sulfindo Adiusaha'; wsWeek.getCell('B1').font = { bold:true }
        
        wsWeek.mergeCells('B3:G3')
        const rTitle = wsWeek.getCell('B3')
        rTitle.value = 'LAPORAN MINGGUAN PENJUALAN BARANG'
        rTitle.font  = { bold:true, size:13 }; Object.assign(rTitle, center)
        wsWeek.getRow(3).height = 22

        wsWeek.getCell('B5').value = 'MINGGU KE -:'; wsWeek.getCell('B5').font = { bold:true }
        wsWeek.getCell('C5').value = WEEK_ROMAN[weekOfMonth] ?? String(weekOfMonth)
        wsWeek.getCell('G5').value = bulanLabel; wsWeek.getCell('G5').font = { bold:true }

        const writeSection = (startRow: number, label: string, isCash: boolean) => {
          wsWeek.getCell(`B${startRow}`).value = label
          wsWeek.getCell(`B${startRow}`).font  = { bold:true, color:{ argb: isCash ? '00000099' : RED } }
          const hRow = wsWeek.getRow(startRow+1)
          ;['No','Week','Tanggal','Harga Pokok','Harga Jual','Laba'].forEach((h: any, i: any) => {
            const c = hRow.getCell(i+2)
            c.value = h; c.font = { bold:true }; Object.assign(c, center, border1)
            c.fill  = { type:'pattern', pattern:'solid', fgColor:{argb:'FFD9E1F2'} }
          })
          let rowIdx = startRow + 2
          let totHPP = 0, totJual = 0
          dates.forEach((d: any, idx: any) => {
            const entry  = dayMap.get(d)!
            const hpp    = isCash ? entry.hppCash  : entry.hppKredit
            const jual   = isCash ? entry.jualCash : entry.jualKredit
            const laba   = jual - hpp
            totHPP += hpp; totJual += jual
            const dt      = parseTanggal(d)
            const r       = wsWeek.getRow(rowIdx++)
            ;[idx+1, DAY_ID_LOCAL[dt.getDay()], d, hpp > 0 ? hpp : '-', jual > 0 ? jual : '-', laba !== 0 ? laba : '-'].forEach((v: any, i: any) => {
              const c = r.getCell(i+2); c.value = v; Object.assign(c, border1)
              if (i >= 3 && typeof v === 'number') { c.numFmt = '#,##0'; Object.assign(c, right) }
              else Object.assign(c, center)
            })
          })
          const tot = wsWeek.getRow(rowIdx)
          tot.getCell(3).value = 'JUMLAH'; tot.getCell(3).font = { bold:true }
          ;[2,3,4].forEach((i: any) => Object.assign(tot.getCell(i), border1))
          ;[totHPP, totJual, totJual-totHPP].forEach((v: any, i: any) => {
            const c = tot.getCell(i+5)
            c.value = v; c.numFmt = '#,##0'; c.font = { bold:true }; Object.assign(c, right, border1)
          })
          return { totHPP, totJual }
        }

        const cashR   = writeSection(7, 'PENJUALAN CASH',   true)
        const kreditR = writeSection(7 + dates.length + 4, 'PENJUALAN KREDIT', false)

        const grStart  = 7 + dates.length + 4 + dates.length + 4
        const grandHPP = cashR.totHPP + kreditR.totHPP
        const grandJual= cashR.totJual + kreditR.totJual
        const grandLaba= grandJual - grandHPP

        ;[['Total Harga Pokok', grandHPP], ['Total Harga Jual', grandJual], ['Keuntungan', grandLaba]].forEach(([l,v], i) => {
          const r = wsWeek.getRow(grStart + i)
          r.getCell(2).value = l as string; r.getCell(2).font = { bold: i === 2 }
          const vc = r.getCell(4); vc.value = v as number; vc.numFmt = '#,##0'; Object.assign(vc, right)
          r.getCell(5).value = 'IDR'
          if (i === 2) {
            vc.border = { top:{style:'medium'}, left:{style:'medium'}, bottom:{style:'medium'}, right:{style:'medium'} }
            vc.fill = { type:'pattern', pattern:'solid', fgColor:{argb:YELLOW} }
            vc.font = { bold:true }
          }
        })

        const sigRow = grStart + 6
        wsWeek.getCell(`B${sigRow}`).value   = 'Dibuat Oleh,'
        wsWeek.getCell(`G${sigRow}`).value   = 'Diperiksa Oleh,'
        wsWeek.getCell(`B${sigRow+4}`).value = '________________'
        wsWeek.getCell(`G${sigRow+4}`).value = '________________'
      }

      // ───────────────────────────────────────────────────────────
      // TAB 3: REKAP SEMBAKO ANGGOTA (FORMAT GAMBAR)
      // ───────────────────────────────────────────────────────────
      const wsSembako = wb.addWorksheet('Rekap Sembako')
      wsSembako.views = [{ state: 'frozen', xSplit: 0, ySplit: 5 }]

      ;[5, 16, 32, 6, 8, 18, 18, 18, 18, 18].forEach((w: any, i: any) => {
        wsSembako.getColumn(i + 1).width = w
      })

      wsSembako.getCell('A1').value = 'PT. SULFINDO ADIUSAHA'
      wsSembako.getCell('A1').font = { bold: true, size: 12 }
      wsSembako.getCell('A2').value = 'REKAP TRANSAKSI PENJUALAN SEMBAKO (BAYAR TEMPO VS CASH)'
      wsSembako.getCell('A2').font = { bold: true, size: 13 }
      wsSembako.getCell('A3').value = `PERIODE: ${startDate} S/D ${endDate}`
      wsSembako.getCell('A3').font = { bold: true }

      type SembakoRecord = {
        nik: string
        nama: string
        com1: string
        com2: string
        crdJual: number
        casJual: number
        crdPokok: number
        casPokok: number
        crdLaba: number
      }

      const sembakoMap = new Map<string, SembakoRecord>()

      allMembers.forEach((m: any) => {
        if (m.status === 'active') {
          const com2Val = (m.unit_code || 'U-001').replace(/^U-/, '')
          sembakoMap.set(m.nik, {
            nik: m.nik,
            nama: m.full_name,
            com1: '1',
            com2: com2Val,
            crdJual: 0,
            casJual: 0,
            crdPokok: 0,
            casPokok: 0,
            crdLaba: 0,
          })
        }
      })

      for (const r of rows) {
        if (r.category_slug !== 'sembako') continue

        let entry = sembakoMap.get(r.nik)
        if (!entry) {
          entry = {
            nik: r.nik,
            nama: r.nama_anggota,
            com1: '1',
            com2: (r.unit_code || 'U-001').replace(/^U-/, ''),
            crdJual: 0,
            casJual: 0,
            crdPokok: 0,
            casPokok: 0,
            crdLaba: 0,
          }
          sembakoMap.set(r.nik, entry)
        }

        const isCash = r.bayar === 'CAS' || r.bayar === 'QRS' || r.bayar === 'TRF'
        if (isCash) {
          entry.casJual += r.tot_harga_jual
          entry.casPokok += r.tot_harga_pokok
        } else {
          entry.crdJual += r.tot_harga_jual
          entry.crdPokok += r.tot_harga_pokok
          entry.crdLaba += r.laba
        }
      }

      const sembakoList = Array.from(sembakoMap.values()).sort((a, b) => a.nama.localeCompare(b.nama))

      const sembakoHeaders = [
        'NO', 'NIK', 'NAMA', 'COM', 'COM',
        'P-SBK CRD\nHARGA JUAL', 'P-SBK CAS\nHARGA JUAL',
        'P-SBK CRD\nHARGA POKOK', 'P-SBK CAS\nHARGA POKOK',
        'P-SBK CRD\nLABA'
      ]

      let totalCrdJual = 0
      let totalCasJual = 0
      let totalCrdPokok = 0
      let totalCasPokok = 0
      let totalCrdLaba = 0

      sembakoList.forEach((item: any) => {
        totalCrdJual += item.crdJual
        totalCasJual += item.casJual
        totalCrdPokok += item.crdPokok
        totalCasPokok += item.casPokok
        totalCrdLaba += item.crdLaba
      })

      // Merged A4:E4 for Periode info matching the UI bar
      wsSembako.mergeCells('A4:E4')
      const leftCellSbk = wsSembako.getCell('A4')
      leftCellSbk.value = `PERIODE: ${startDate} S/D ${endDate}`
      leftCellSbk.font = { bold: true, color: { argb: WHITE }, size: 9 }
      leftCellSbk.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
      leftCellSbk.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      leftCellSbk.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} }

      for (let colNum = 2; colNum <= 5; colNum++) {
        const c = wsSembako.getCell(4, colNum)
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        c.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} }
      }

      // Merged F4:J4 for Totals matching the UI bar
      wsSembako.mergeCells('F4:J4')
      const rightCellSbk = wsSembako.getCell('F4')
      rightCellSbk.value = `TOTAL CRD JUAL: Rp ${totalCrdJual.toLocaleString('id-ID')}   TOTAL CAS JUAL: Rp ${totalCasJual.toLocaleString('id-ID')}   TOTAL LABA: Rp ${totalCrdLaba.toLocaleString('id-ID')}`
      rightCellSbk.font = { bold: true, color: { argb: WHITE }, size: 9 }
      rightCellSbk.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
      rightCellSbk.alignment = { horizontal: 'right', vertical: 'middle' }
      rightCellSbk.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} }

      for (let colNum = 7; colNum <= 10; colNum++) {
        const c = wsSembako.getCell(4, colNum)
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        c.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} }
      }

      const shRow = wsSembako.addRow(sembakoHeaders)
      wsSembako.getRow(5).height = 36

      shRow.eachCell((c) => {
        c.font = { bold: true, color: { argb: WHITE }, size: 9 }
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
      })

      sembakoList.forEach((item: any, index: any) => {
        const rowData = [
          index + 1,
          item.nik,
          item.nama,
          item.com1,
          item.com2,
          item.crdJual,
          item.casJual,
          item.crdPokok,
          item.casPokok,
          item.crdLaba
        ]

        const r = wsSembako.addRow(rowData)
        const isAlternate = index % 2 === 0
        const rowBg = isAlternate ? 'FFF9F9F9' : 'FFFFFFFF'

        r.eachCell((c, colNum) => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } }
          c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
          
          if (colNum === 1 || colNum === 4 || colNum === 5) {
            c.alignment = { horizontal: 'center', vertical: 'middle' }
          } else if (colNum === 2 || colNum === 3) {
            c.alignment = { horizontal: 'left', vertical: 'middle' }
          } else {
            c.alignment = { horizontal: 'right', vertical: 'middle' }
            c.numFmt = '#,##0'
          }
        })
      })

      const sembakoTotRow = wsSembako.addRow([
        'TOTAL', '', '', '', '',
        totalCrdJual, totalCasJual, totalCrdPokok, totalCasPokok, totalCrdLaba
      ])
      const rowNumSbk = sembakoTotRow.number
      wsSembako.mergeCells(`A${rowNumSbk}:E${rowNumSbk}`)
      sembakoTotRow.eachCell((c, colNum) => {
        c.font = { bold: true, color: { argb: WHITE } }
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        c.border = { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } }
        
        if (colNum >= 6) {
          c.alignment = { horizontal: 'right', vertical: 'middle' }
          c.numFmt = '#,##0'
        } else {
          c.alignment = { horizontal: 'center', vertical: 'middle' }
        }
      })

      // ───────────────────────────────────────────────────────────
      // TAB 4: POTONGAN GAJI
      // ───────────────────────────────────────────────────────────
      const wsPotongan = wb.addWorksheet('Potongan Gaji')
      wsPotongan.views = [{ state: 'frozen', xSplit: 0, ySplit: 5 }]

      const colWidthsPotongan = [5, 16, 32, 6, 8, 14, 14, 14, 14, 12, 12, 14, 12, 14, 12, 14, 16]
      colWidthsPotongan.forEach((w: any, i: any) => {
        wsPotongan.getColumn(i + 1).width = w
      })

      wsPotongan.getCell('A1').value = 'PT. SULFINDO ADIUSAHA'
      wsPotongan.getCell('A1').font = { bold: true, size: 12 }
      wsPotongan.getCell('A2').value = 'LAPORAN REKAPITULASI POTONGAN GAJI KARYAWAN'
      wsPotongan.getCell('A2').font = { bold: true, size: 13 }
      wsPotongan.getCell('A3').value = `PERIODE: ${startDate} S/D ${endDate}`
      wsPotongan.getCell('A3').font = { bold: true }

      const potonganHeaders = [
        'NO', 'NIK', 'NAMA', 'COM', 'COM',
        'SIMP POKOK', 'SIMP WAJIB', 'SIMP SUKARELA',
        'P-UANG', 'ADM. P-U', 'B-TRSF', 'P-KHUSUS', 'ADM P-KHS',
        'P-BARANG', 'ADM. P-BRG', 'KREDIT SBK', 'TOTAL'
      ]

      let tSimpPokok = 0, tSimpWajib = 0, tSimpSukarela = 0
      let tPUang = 0, tAdmPU = 0, tBTrsf = 0
      let tPKhusus = 0, tAdmPKhs = 0
      let tPBarang = 0, tAdmPBrg = 0
      let tKreditSbk = 0, tTotal = 0

      deductions.forEach((item: any) => {
        const simpPokok = item.details.filter((d: any) => d.reference === 'SP').reduce((sum: any, d: any) => sum + d.amount, 0)
        const simpWajib = item.details.filter((d: any) => d.reference === 'SW' || (d.category === 'simpanan_wajib' && d.reference !== 'SP')).reduce((sum: any, d: any) => sum + d.amount, 0)
        const simpSukarela = item.total_simpanan_salary_cut
        const pUang = item.total_pinjaman_uang
        const admPU = item.total_pinjaman_uang_interest ?? 0
        const bTrsf = item.total_pinjaman_uang_transfer ?? 0
        const pKhusus = item.total_pinjaman_kilat
        const admPKhs = item.total_pinjaman_kilat_interest ?? 0
        const pBarang = item.total_pinjaman_barang
        const admPBrg = item.total_pinjaman_barang_interest ?? 0
        const kreditSbk = item.total_paylater
        const total = simpPokok + simpWajib + simpSukarela + pUang + admPU + bTrsf + pKhusus + admPKhs + pBarang + admPBrg + kreditSbk

        tSimpPokok += simpPokok
        tSimpWajib += simpWajib
        tSimpSukarela += simpSukarela
        tPUang += pUang
        tAdmPU += admPU
        tBTrsf += bTrsf
        tPKhusus += pKhusus
        tAdmPKhs += admPKhs
        tPBarang += pBarang
        tAdmPBrg += admPBrg
        tKreditSbk += kreditSbk
        tTotal += total
      })

      // Merged A4:E4 for Periode info matching the UI bar
      wsPotongan.mergeCells('A4:E4')
      const leftCellPot = wsPotongan.getCell('A4')
      leftCellPot.value = `PERIODE: ${startDate} S/D ${endDate}`
      leftCellPot.font = { bold: true, color: { argb: WHITE }, size: 9 }
      leftCellPot.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
      leftCellPot.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      leftCellPot.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} }

      for (let colNum = 2; colNum <= 5; colNum++) {
        const c = wsPotongan.getCell(4, colNum)
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        c.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} }
      }

      // Merged F4:Q4 for Totals matching the UI bar
      wsPotongan.mergeCells('F4:Q4')
      const rightCellPot = wsPotongan.getCell('F4')
      rightCellPot.value = `TOTAL POTONGAN: Rp ${tTotal.toLocaleString('id-ID')}   SIMP POKOK: Rp ${tSimpPokok.toLocaleString('id-ID')}   SIMP WAJIB: Rp ${tSimpWajib.toLocaleString('id-ID')}   SIMP SUKARELA: Rp ${tSimpSukarela.toLocaleString('id-ID')}`
      rightCellPot.font = { bold: true, color: { argb: WHITE }, size: 9 }
      rightCellPot.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
      rightCellPot.alignment = { horizontal: 'right', vertical: 'middle' }
      rightCellPot.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} }

      for (let colNum = 7; colNum <= 17; colNum++) {
        const c = wsPotongan.getCell(4, colNum)
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        c.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} }
      }

      const phRow = wsPotongan.addRow(potonganHeaders)
      wsPotongan.getRow(5).height = 36

      phRow.eachCell((c) => {
        c.font = { bold: true, color: { argb: WHITE }, size: 9 }
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
      })

      deductions.forEach((item: any, index: any) => {
        const com2Val = (item.department || 'SAU').replace(/^U-/, '')
        const simpPokok = item.details.filter((d: any) => d.reference === 'SP').reduce((sum: any, d: any) => sum + d.amount, 0)
        const simpWajib = item.details.filter((d: any) => d.reference === 'SW' || (d.category === 'simpanan_wajib' && d.reference !== 'SP')).reduce((sum: any, d: any) => sum + d.amount, 0)
        const simpSukarela = item.total_simpanan_salary_cut
        const pUang = item.total_pinjaman_uang
        const admPU = item.total_pinjaman_uang_interest ?? 0
        const bTrsf = item.total_pinjaman_uang_transfer ?? 0
        const pKhusus = item.total_pinjaman_kilat
        const admPKhs = item.total_pinjaman_kilat_interest ?? 0
        const pBarang = item.total_pinjaman_barang
        const admPBrg = item.total_pinjaman_barang_interest ?? 0
        const kreditSbk = item.total_paylater
        const total = simpPokok + simpWajib + simpSukarela + pUang + admPU + bTrsf + pKhusus + admPKhs + pBarang + admPBrg + kreditSbk

        const rowData = [
          index + 1,
          item.nik,
          item.name,
          '1',
          com2Val,
          simpPokok || '-',
          simpWajib || '-',
          simpSukarela || '-',
          pUang || '-',
          admPU || '-',
          bTrsf || '-',
          pKhusus || '-',
          admPKhs || '-',
          pBarang || '-',
          admPBrg || '-',
          kreditSbk || '-',
          total || '-'
        ]

        const r = wsPotongan.addRow(rowData)
        const isAlternate = index % 2 === 0
        const rowBg = isAlternate ? 'FFF9F9F9' : 'FFFFFFFF'

        r.eachCell((c, colNum) => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } }
          c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
          
          if (colNum === 1 || colNum === 4 || colNum === 5) {
            c.alignment = { horizontal: 'center', vertical: 'middle' }
          } else if (colNum === 2 || colNum === 3) {
            c.alignment = { horizontal: 'left', vertical: 'middle' }
          } else {
            c.alignment = { horizontal: 'right', vertical: 'middle' }
            if (typeof c.value === 'number') {
              c.numFmt = '#,##0'
            }
          }
        })
      })

      const potonganTotRow = wsPotongan.addRow([
        'TOTAL', '', '', '', '',
        tSimpPokok, tSimpWajib, tSimpSukarela,
        tPUang, tAdmPU, tBTrsf, tPKhusus, tAdmPKhs,
        tPBarang, tAdmPBrg, tKreditSbk, tTotal
      ])
      const rowNumPot = potonganTotRow.number
      wsPotongan.mergeCells(`A${rowNumPot}:E${rowNumPot}`)
      potonganTotRow.eachCell((c, colNum) => {
        c.font = { bold: true, color: { argb: WHITE } }
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        c.border = { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } }
        
        if (colNum >= 6) {
          c.alignment = { horizontal: 'right', vertical: 'middle' }
          c.numFmt = '#,##0'
        } else {
          c.alignment = { horizontal: 'center', vertical: 'middle' }
        }
      })

      // ───────────────────────────────────────────────────────────
      // TAB 5: MONITORING STOCKS (STOCK OPNAME)
      // ───────────────────────────────────────────────────────────
      const wsStock = wb.addWorksheet('Monitoring Stocks')
      wsStock.views = [{ state: 'frozen', xSplit: 0, ySplit: 5 }]

      const colWidthsStock = [5, 14, 32, 14, 14, 12, 12, 12, 12, 12, 14, 14, 14, 14, 14]
      colWidthsStock.forEach((w: any, i: any) => {
        wsStock.getColumn(i + 1).width = w
      })

      wsStock.getCell('A1').value = 'PT. SULFINDO ADIUSAHA'
      wsStock.getCell('A1').font = { bold: true, size: 12 }
      wsStock.getCell('A2').value = 'MONITORING FINANCIAL STOCKS (STOCK OPNAME)'
      wsStock.getCell('A2').font = { bold: true, size: 13 }
      wsStock.getCell('A3').value = `PERIODE: ${startDate} S/D ${endDate} (Dalam Rupiah)`
      wsStock.getCell('A3').font = { bold: true }

      const stockHeaders = [
        'NO', 'KODE BRG', 'NAMA BARANG', 'STOCK AWAL (Rp)', 'PEMBELIAN (Rp)',
        'PENJUALAN M1 (Rp)', 'PENJUALAN M2 (Rp)', 'PENJUALAN M3 (Rp)', 'PENJUALAN M4 (Rp)', 'PENJUALAN M5 (Rp)',
        'TOT PENJUALAN (Rp)', 'STOCK AKHIR (Rp)', 'PENYESUAIAN (Rp)', 'STOCK OPNAME (Rp)', 'RETUR (Rp)'
      ]

      let tStockAwal = 0, tPembelian = 0
      let tM1 = 0, tM2 = 0, tM3 = 0, tM4 = 0, tM5 = 0
      let tTotPenjualan = 0, tStockAkhir = 0
      let tStockOpname = 0, tQtyRetur = 0, tPenyesuaian = 0

      stocks.forEach((item: any) => {
        tStockAwal += item.stockAwal
        tPembelian += item.pembelian
        tM1 += item.m1
        tM2 += item.m2
        tM3 += item.m3
        tM4 += item.m4
        tM5 += item.m5
        tTotPenjualan += item.totPenjualan
        tStockAkhir += item.stockAkhir
        tStockOpname += item.stockOpname || 0
        tQtyRetur += item.qtyRetur
        tPenyesuaian += item.penyesuaian || 0
      })

      // Merged A4:C4 for Periode info matching the UI bar
      wsStock.mergeCells('A4:C4')
      const leftCellStock = wsStock.getCell('A4')
      leftCellStock.value = `PERIODE: ${startDate} S/D ${endDate} (Dalam Rupiah)`
      leftCellStock.font = { bold: true, color: { argb: WHITE }, size: 9 }
      leftCellStock.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
      leftCellStock.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      leftCellStock.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} }

      for (let colNum = 2; colNum <= 3; colNum++) {
        const c = wsStock.getCell(4, colNum)
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        c.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} }
      }

      // Merged D4:O4 for Totals matching the UI bar
      wsStock.mergeCells('D4:O4')
      const rightCellStock = wsStock.getCell('D4')
      rightCellStock.value = `TOTAL STOCK AWAL: Rp ${tStockAwal.toLocaleString('id-ID')}   TOTAL PEMBELIAN: Rp ${tPembelian.toLocaleString('id-ID')}   TOTAL PENJUALAN: Rp ${tTotPenjualan.toLocaleString('id-ID')}   TOTAL RETUR: Rp ${tQtyRetur.toLocaleString('id-ID')}`
      rightCellStock.font = { bold: true, color: { argb: WHITE }, size: 9 }
      rightCellStock.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
      rightCellStock.alignment = { horizontal: 'right', vertical: 'middle' }
      rightCellStock.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} }

      for (let colNum = 5; colNum <= 15; colNum++) {
        const c = wsStock.getCell(4, colNum)
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        c.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} }
      }

      const shRowStock = wsStock.addRow(stockHeaders)
      wsStock.getRow(5).height = 36

      shRowStock.eachCell((c) => {
        c.font = { bold: true, color: { argb: WHITE }, size: 9 }
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
      })

      stocks.forEach((item: any, index: any) => {
        const rowData = [
          index + 1,
          item.sku,
          item.name,
          item.stockAwal,
          item.pembelian,
          item.m1 || '-',
          item.m2 || '-',
          item.m3 || '-',
          item.m4 || '-',
          item.m5 || '-',
          item.totPenjualan || '-',
          item.stockAkhir,
          item.penyesuaian,
          item.stockOpname !== null ? item.stockOpname : '-',
          item.qtyRetur || '-'
        ]

        const r = wsStock.addRow(rowData)
        const isAlternate = index % 2 === 0
        const rowBg = isAlternate ? 'FFF9F9F9' : 'FFFFFFFF'

        r.eachCell((c, colNum) => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } }
          c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
          
          if (colNum === 1 || colNum === 2) {
            c.alignment = { horizontal: 'center', vertical: 'middle' }
          } else if (colNum === 3) {
            c.alignment = { horizontal: 'left', vertical: 'middle' }
          } else {
            c.alignment = { horizontal: 'right', vertical: 'middle' }
            if (typeof c.value === 'number') {
              c.numFmt = '"Rp"#,##0'
            }
          }
        })
      })

      const stockTotRow = wsStock.addRow([
        'TOTAL', '', '',
        tStockAwal, tPembelian,
        tM1, tM2, tM3, tM4, tM5,
        tTotPenjualan, tStockAkhir,
        tPenyesuaian,
        tStockOpname || '-', tQtyRetur
      ])
      const rowNumStock = stockTotRow.number
      wsStock.mergeCells(`A${rowNumStock}:C${rowNumStock}`)
      stockTotRow.eachCell((c, colNum) => {
        c.font = { bold: true, color: { argb: WHITE } }
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        c.border = { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } }
        
        if (colNum >= 4) {
          c.alignment = { horizontal: 'right', vertical: 'middle' }
          if (typeof c.value === 'number') c.numFmt = '"Rp"#,##0'
        } else {
          c.alignment = { horizontal: 'center', vertical: 'middle' }
        }
      })

      // ───────────────────────────────────────────────────────────
      // WRITE AND DOWNLOAD
      // ───────────────────────────────────────────────────────────
      const buf = await wb.xlsx.writeBuffer()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      a.download = `Laporan_Terpadu_Toko_${bulanNm}_${tahun}.xlsx`
      a.click()
      toast.success('Laporan Terpadu (Multi-Tab) berhasil diexport')
    } catch (e) {
      console.error(e)
      toast.error('Gagal export Laporan Terpadu')
    }
  }

  const exportKasirExcel = async () => {
    try {
      toast.info('Mengambil data transaksi...')
      const rows = await getTransaksiKasirDetail({ startDate, endDate, paymentMethod: payMethod })
      if (rows.length === 0) { toast.error('Tidak ada data untuk periode ini'); return }

      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Data Transaksi Kasir')

      // ── Column widths ─────────────────────────────────────────
      const colWidths = [5, 14, 6, 6, 18, 22, 28, 6, 16, 16, 16, 16, 14]
      colWidths.forEach((w: any, i: any) => { ws.getColumn(i + 1).width = w })

      // ── ROW 1: Koperasi name ──────────────────────────────────
      ws.mergeCells('A1:C1')
      const r1 = ws.getCell('A1')
      r1.value = 'PT SULFINDO ADIUSAHA'; r1.font = { bold: true, size: 12 }

      // ── ROW 2: Report type ────────────────────────────────────
      ws.mergeCells('A2:C2')
      ws.getCell('A2').value = 'DATA TRANSAKSI KASIR'
      ws.getCell('A2').font = { bold: true }

      // ── ROW 3: Period + TOTAL header row ──────────────────────
      const startD  = new Date(startDate)
      const bulanNm = startD.toLocaleDateString('id-ID', { month: 'long' }).toUpperCase()
      const tahun   = startD.getFullYear()

      // TOTAL values (right side of row 3)
      const totalQty   = rows.reduce((s: any, r: any) => s + r.qty, 0)
      const totalJual  = rows.reduce((s: any, r: any) => s + r.harga_jual, 0)
      const totalHJual = rows.reduce((s: any, r: any) => s + r.tot_harga_jual, 0)
      const totalHPP   = rows.reduce((s: any, r: any) => s + r.harga_pokok, 0)
      const totalTHPP  = rows.reduce((s: any, r: any) => s + r.tot_harga_pokok, 0)
      const totalLaba  = rows.reduce((s: any, r: any) => s + r.laba, 0)

      const BLUE = 'FF1F4E78'; const WHITE = 'FFFFFFFF'

      // Merged A3:G3 for Bulan info matching the UI bar
      ws.mergeCells('A3:G3')
      const leftCell = ws.getCell('A3')
      leftCell.value = `BULAN: ${bulanNm} ${tahun}`
      leftCell.font = { bold: true, color: { argb: WHITE }, size: 10 }
      leftCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
      leftCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      leftCell.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} }

      for (let colNum = 2; colNum <= 7; colNum++) {
        const c = ws.getCell(3, colNum)
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        c.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} }
      }

      // Merged H3:M3 for Totals matching the UI bar
      ws.mergeCells('H3:M3')
      const rightCell = ws.getCell('H3')
      rightCell.value = `TOTAL QTY: ${totalQty}   TOTAL JUAL: Rp ${totalHJual.toLocaleString('id-ID')}   TOTAL HPP: Rp ${totalTHPP.toLocaleString('id-ID')}   TOTAL LABA: Rp ${totalLaba.toLocaleString('id-ID')}`
      rightCell.font = { bold: true, color: { argb: WHITE }, size: 10 }
      rightCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
      rightCell.alignment = { horizontal: 'right', vertical: 'middle' }
      rightCell.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} }

      for (let colNum = 9; colNum <= 13; colNum++) {
        const c = ws.getCell(3, colNum)
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        c.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} }
      }

      // ── ROW 4: Column headers ─────────────────────────────────
      const headers = ['NO','TANGGAL','MINGGU','BAYAR','NIK','NAMA ANGGOTA','NAMA BARANG',
        'QTY','HARGA JUAL','TOT HARGA JUAL','HARGA POKOK','TOT HARGA POKOK','LABA']
      const hRow = ws.addRow(headers)  // row 4
      hRow.eachCell(c => {
        c.font      = { bold: true, color: { argb: WHITE } }
        c.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        c.alignment = { horizontal: 'center', wrapText: true }
        c.border    = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} }
      })
      hRow.height = 30

      // ── DATA ROWS ─────────────────────────────────────────────
      rows.forEach((r: any, idx: any) => {
        const dataRow = ws.addRow([
          r.no, r.tanggal, r.minggu, r.bayar, r.nik, r.nama_anggota, r.nama_barang,
          r.qty, r.harga_jual, r.tot_harga_jual, r.harga_pokok, r.tot_harga_pokok, r.laba
        ])
        const bgColor = idx % 2 === 0 ? 'FFF5F5F5' : 'FFFFFFFF'
        dataRow.eachCell((c, colNum) => {
          c.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
          c.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} }
          c.alignment = { horizontal: colNum > 7 ? 'right' : colNum === 1 ? 'center' : 'left' }
          if (colNum >= 9) c.numFmt = '#,##0'  // numeric cols
        })
        // Laba color
        const labaCell = dataRow.getCell(13)
        if (r.laba < 0) labaCell.font = { color: { argb: 'FFDC2626' }, bold: true }
        else labaCell.font = { color: { argb: 'FF16A34A' }, bold: true }
      })

      // ── TOTAL ROW at bottom ───────────────────────────────────
      const totRow = ws.addRow(['TOTAL', '', '', '', '', '', '',
        totalQty, totalJual, totalHJual, totalHPP, totalTHPP, totalLaba])
      const rowNum = totRow.number
      ws.mergeCells(`A${rowNum}:G${rowNum}`)
      totRow.eachCell((c, cn) => {
        c.font   = { bold: true, color: { argb: WHITE } }
        c.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        c.border = { top:{style:'medium'}, left:{style:'thin'}, bottom:{style:'medium'}, right:{style:'thin'} }
        if (cn >= 8) {
          c.alignment = { horizontal: cn === 8 ? 'center' : 'right' }
          c.numFmt = '#,##0'
        } else {
          c.alignment = { horizontal: 'center' }
        }
      })

      // Freeze header rows
      ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }]

      const buf = await wb.xlsx.writeBuffer()
      const a   = document.createElement('a')
      a.href     = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      a.download = `Transaksi_Kasir_${bulanNm}_${tahun}.xlsx`
      a.click()
      toast.success(`Export selesai: ${rows.length} baris`)
    } catch (e) { console.error(e); toast.error('Gagal export transaksi kasir') }
  }

  // ── Search Laporan Mingguan ──────────────────────────────────────────
  const handleSearchMingguan = () => {
    startMingguTransition(async () => {
      try {
        const result = await getLaporanMingguanData({ year: mTahun, month: mBulan, weekOf: mMinggu })
        setMingguData(result)
      } catch { toast.error('Gagal memuat laporan mingguan') }
    })
  }

  // ── Export Laporan Mingguan Excel ────────────────────────────────────
  const exportMingguanExcel = async (source: 'detail' | 'mingguan' = 'mingguan') => {
    // Use dedicated mingguData if available, else fall back to detailRows
    if (source === 'mingguan' && !mingguData) { toast.error('Tampilkan Laporan Mingguan terlebih dahulu'); return }
    if (source === 'detail'  && detailRows.length === 0) { toast.error('Tampilkan laporan terlebih dahulu'); return }
    try {
      // Build dayMap from detailRows (for "detail" source) or from mingguData rows
      type DayData = { tanggal: string; hppCash: number; jualCash: number; hppKredit: number; jualKredit: number }
      let dayMap: Map<string, DayData>
      let sheetLabel: string

      if (source === 'mingguan' && mingguData) {
        dayMap = new Map(mingguData.rows.map((r: any) => [r.tanggal, {
          tanggal: r.tanggal, hppCash: r.hppCash, jualCash: r.jualCash,
          hppKredit: r.hppKredit, jualKredit: r.jualKredit,
        }]))
        sheetLabel = `${BULAN_NAMES[mBulan]}_${mTahun}_M${mMinggu}`
      } else {
        // Build from detailRows grouped by date
        dayMap = new Map()
        for (const r of detailRows) {
          const prev = dayMap.get(r.tanggal) ?? { tanggal: r.tanggal, hppCash:0, jualCash:0, hppKredit:0, jualKredit:0 }
          const isCash = r.bayar === 'CAS' || r.bayar === 'QRS' || r.bayar === 'TRF'
          if (isCash) { prev.hppCash += r.tot_harga_pokok; prev.jualCash += r.tot_harga_jual }
          else        { prev.hppKredit += r.tot_harga_pokok; prev.jualKredit += r.tot_harga_jual }
          dayMap.set(r.tanggal, prev)
        }
        sheetLabel = `${startDate}_${endDate}`
      }

      // Sort dates
      const allDates = Array.from(dayMap.keys()).sort((a, b) => {
        const pa = parseTanggal(a), pb = parseTanggal(b)
        return pa.getTime() - pb.getTime()
      })

      // Group into week-of-month buckets
      const weekGroups = new Map<string, string[]>()
      for (const d of allDates) {
        const dt  = parseTanggal(d)
        const wom = Math.ceil(dt.getDate() / 7)
        const key = `${dt.getFullYear()}-${dt.getMonth()+1}-W${wom}`
        const arr = weekGroups.get(key) ?? []; arr.push(d); weekGroups.set(key, arr)
      }

      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      const DAY_ID_LOCAL = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']
      let sheetNo = 1

      for (const [, dates] of weekGroups) {
        const firstDate  = parseTanggal(dates[0])
        const weekOfMonth = Math.ceil(firstDate.getDate() / 7)
        const bulanLabel  = (BULAN_NAMES[firstDate.getMonth() + 1] ?? '').toUpperCase()
        const RED = 'FFCC0000', YELLOW = 'FFFFE699'
        const center = { alignment: { horizontal:'center' as const, vertical:'middle' as const } }
        const right  = { alignment: { horizontal:'right' as const } }
        const border1 = { border: { top:{style:'thin' as const}, left:{style:'thin' as const}, bottom:{style:'thin' as const}, right:{style:'thin' as const} } }

        const ws = wb.addWorksheet(`Minggu ${sheetNo++}`)
        ;[5,12,16,18,18,18].forEach((w: any, i: any) => ws.getColumn(i+2).width = w)

        // R1 company
        ws.getCell('B1').value = 'PT. Sulfindo Adiusaha'; ws.getCell('B1').font = { bold:true }
        // R3 title
        ws.mergeCells('B3:G3')
        const rTitle = ws.getCell('B3')
        rTitle.value = 'LAPORAN MINGGUAN PENJUALAN BARANG'
        rTitle.font  = { bold:true, size:13 }; Object.assign(rTitle, center)
        ws.getRow(3).height = 22
        // R5 minggu + bulan
        ws.getCell('B5').value = 'MINGGU KE -:'; ws.getCell('B5').font = { bold:true }
        ws.getCell('C5').value = WEEK_ROMAN[weekOfMonth] ?? String(weekOfMonth)
        ws.getCell('G5').value = bulanLabel; ws.getCell('G5').font = { bold:true }

        const writeSection = (startRow: number, label: string, isCash: boolean) => {
          ws.getCell(`B${startRow}`).value = label
          ws.getCell(`B${startRow}`).font  = { bold:true, color:{ argb: isCash ? '00000099' : RED } }
          // header
          const hRow = ws.getRow(startRow+1)
          ;['No','Week','Tanggal','Harga Pokok','Harga Jual','Laba'].forEach((h: any, i: any) => {
            const c = hRow.getCell(i+2)
            c.value = h; c.font = { bold:true }; Object.assign(c, center, border1)
            c.fill  = { type:'pattern', pattern:'solid', fgColor:{argb:'FFD9E1F2'} }
          })
          let rowIdx = startRow + 2
          let totHPP = 0, totJual = 0
          dates.forEach((d: any, idx: any) => {
            const entry  = dayMap.get(d)!
            const hpp    = isCash ? entry.hppCash  : entry.hppKredit
            const jual   = isCash ? entry.jualCash : entry.jualKredit
            const laba   = jual - hpp
            totHPP += hpp; totJual += jual
            const dt      = parseTanggal(d)
            const r       = ws.getRow(rowIdx++)
            ;[idx+1, DAY_ID_LOCAL[dt.getDay()], d, hpp > 0 ? hpp : '-', jual > 0 ? jual : '-', laba !== 0 ? laba : '-'].forEach((v: any, i: any) => {
              const c = r.getCell(i+2); c.value = v; Object.assign(c, border1)
              if (i >= 3 && typeof v === 'number') { c.numFmt = '#,##0'; Object.assign(c, right) }
              else Object.assign(c, center)
            })
          })
          // JUMLAH row
          const tot = ws.getRow(rowIdx)
          tot.getCell(3).value = 'JUMLAH'; tot.getCell(3).font = { bold:true }
          ;[2,3,4].forEach((i: any) => Object.assign(tot.getCell(i), border1))
          ;[totHPP, totJual, totJual-totHPP].forEach((v: any, i: any) => {
            const c = tot.getCell(i+5)
            c.value = v; c.numFmt = '#,##0'; c.font = { bold:true }; Object.assign(c, right, border1)
          })
          return { totHPP, totJual }
        }

        const cashR   = writeSection(7, 'PENJUALAN CASH',   true)
        const kreditR = writeSection(7 + dates.length + 4, 'PENJUALAN KREDIT', false)

        const grStart  = 7 + dates.length + 4 + dates.length + 4
        const grandHPP = cashR.totHPP + kreditR.totHPP
        const grandJual= cashR.totJual + kreditR.totJual
        const grandLaba= grandJual - grandHPP

        ;[['Total Harga Pokok', grandHPP], ['Total Harga Jual', grandJual], ['Keuntungan', grandLaba]].forEach(([l,v], i) => {
          const r = ws.getRow(grStart + i)
          r.getCell(2).value = l as string; r.getCell(2).font = { bold: i === 2 }
          const vc = r.getCell(4); vc.value = v as number; vc.numFmt = '#,##0'; Object.assign(vc, right)
          r.getCell(5).value = 'IDR'
          if (i === 2) {
            vc.border = { top:{style:'medium'}, left:{style:'medium'}, bottom:{style:'medium'}, right:{style:'medium'} }
            vc.fill = { type:'pattern', pattern:'solid', fgColor:{argb:YELLOW} }
            vc.font = { bold:true }
          }
        })

        const sigRow = grStart + 6
        ws.getCell(`B${sigRow}`).value   = 'Dibuat Oleh,'
        ws.getCell(`G${sigRow}`).value   = 'Diperiksa Oleh,'
        ws.getCell(`B${sigRow+4}`).value = '________________'
        ws.getCell(`G${sigRow+4}`).value = '________________'
      }

      const buf = await wb.xlsx.writeBuffer()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      a.download = `Laporan_Mingguan_${sheetLabel}.xlsx`
      a.click()
      toast.success('Laporan Mingguan berhasil diexport')
    } catch(e) { console.error(e); toast.error('Gagal export Laporan Mingguan') }
  }



  return (
    <div className="space-y-4">
      {/* Filter Laporan dipindahkan ke masing-masing tab UI */}


      {hasSearched && data && (

        <>
          {/* ── SUMMARY CARDS ──────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-blue-100">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1"><ShoppingBag className="h-4 w-4 text-blue-600" /><p className="text-xs text-muted-foreground">Omzet (Penjualan)</p></div>
                <p className="text-xl font-bold text-blue-700">{formatRp(data.summary.omzet)}</p>
                <p className="text-xs text-muted-foreground mt-1">{data.summary.transaction_count} transaksi</p>
              </CardContent>
            </Card>
            <Card className="border-orange-100">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1"><PackageOpen className="h-4 w-4 text-orange-600" /><p className="text-xs text-muted-foreground">Modal Pembelian (HPP)</p></div>
                <p className="text-xl font-bold text-orange-700">{formatRp(data.summary.cogs)}</p>
                <p className="text-xs text-muted-foreground mt-1">Rata-rata: {formatRp(data.summary.avg_transaction)}/trx</p>
              </CardContent>
            </Card>
            <Card className={`${data.summary.gross_profit >= 0 ? 'border-green-100' : 'border-red-100'}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1"><DollarSign className="h-4 w-4 text-green-600" /><p className="text-xs text-muted-foreground">Laba Kotor</p></div>
                <p className={`text-xl font-bold ${data.summary.gross_profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatRp(data.summary.gross_profit)}</p>
                <div className="flex items-center gap-1 mt-1">
                  {data.summary.gross_profit >= 0 ? <TrendingUp className="h-3 w-3 text-green-500" /> : <TrendingDown className="h-3 w-3 text-red-500" />}
                </div>
              </CardContent>
            </Card>
            <Card className={`${data.summary.margin_pct >= 20 ? 'border-emerald-200' : data.summary.margin_pct >= 10 ? 'border-yellow-200' : 'border-red-200'}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1"><Percent className="h-4 w-4 text-purple-600" /><p className="text-xs text-muted-foreground">Margin Kotor</p></div>
                <p className={`text-xl font-bold ${data.summary.margin_pct >= 20 ? 'text-emerald-700' : data.summary.margin_pct >= 10 ? 'text-yellow-700' : 'text-red-600'}`}>{data.summary.margin_pct}%</p>
                <p className="text-xs text-muted-foreground mt-1">dari total penjualan</p>
              </CardContent>
            </Card>
          </div>

          {/* ── METODE PEMBAYARAN ──────────────────────── */}
          {data.byPaymentMethod.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Penjualan per Metode Pembayaran</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {data.byPaymentMethod.map((m: any) => {
                  const totalAll = data.byPaymentMethod.reduce((s: any, x: any) => s+x.total, 0)
                  const pct = totalAll > 0 ? Math.round((m.total/totalAll)*100) : 0
                  return (
                    <div key={m.method} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{PAYMENT_LABELS[m.method]??m.method}</span>
                        <span className="text-muted-foreground">{m.count} trx · {formatRp(m.total)} ({pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{width:`${pct}%`}} />
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ── TABBED SECTION: Data Transaksi + Laporan Mingguan ── */}
      <Card>
        {/* Tab header */}
        <div className="flex border-b overflow-x-auto whitespace-nowrap scrollbar-none">
          <button
            onClick={() => setActiveTab('kasir')}
            className={`px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
              activeTab === 'kasir'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-slate-50'
            }`}
          >
            📋 Data Transaksi Kasir
            {hasSearched && detailRows.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-700 font-bold">
                {detailRows.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('mingguan')}
            className={`px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
              activeTab === 'mingguan'
                ? 'border-purple-600 text-purple-700 bg-white'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-slate-50'
            }`}
          >
            📅 Laporan Mingguan
            {mingguData && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-100 text-purple-700 font-bold">
                ✓
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('sembako')}
            className={`px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
              activeTab === 'sembako'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-slate-50'
            }`}
          >
            🌾 Rekap Sembako Anggota
            {hasSearched && sembakoRows.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-700 font-bold">
                {sembakoRows.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('potongan')}
            className={`px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
              activeTab === 'potongan'
                ? 'border-red-600 text-red-700 bg-white'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-slate-50'
            }`}
          >
            ✂️ Potongan Gaji
            {hasSearched && filteredDeductions.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-red-100 text-red-700 font-bold">
                {filteredDeductions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('stok')}
            className={`px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
              activeTab === 'stok'
                ? 'border-indigo-600 text-indigo-700 bg-white'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-slate-50'
            }`}
          >
            📦 Monitoring Stocks
            {hasSearched && filteredStocks.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-100 text-indigo-700 font-bold">
                {filteredStocks.length}
              </span>
            )}
          </button>
        </div>

        {/* ── TAB: Data Transaksi Kasir ─────────────────── */}
        {activeTab === 'kasir' && (
          <div className="p-4 space-y-4 font-sans">
            {/* Local Filter Card */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4 shadow-sm">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs font-semibold text-slate-500 mr-2">PRESET TANGGAL:</span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((p: any) => (
                    <Button key={p.label} size="sm" variant="outline" onClick={() => applyPreset(p.days)}
                      className="h-8 text-[11px] px-3 py-1 rounded-lg font-semibold">{p.label}</Button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">PILIHAN BULAN</Label>
                  <Select value={selectedMonth} onValueChange={(v) => handleMonthYearChange(v ?? '1', selectedYear)}>
                    <SelectTrigger className="h-12 text-base rounded-xl bg-white dark:bg-slate-900"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTH_OPTIONS.map((m: any) => (
                        <SelectItem key={m.value} value={m.value} className="text-sm">{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">PILIHAN TAHUN</Label>
                  <Select value={selectedYear} onValueChange={(v) => handleMonthYearChange(selectedMonth, v ?? '2026')}>
                    <SelectTrigger className="h-12 text-base rounded-xl bg-white dark:bg-slate-900"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {YEAR_OPTIONS.map((y: any) => (
                        <SelectItem key={y} value={y} className="text-sm">{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">METODE PEMBAYARAN</Label>
                  <Select value={payMethod} onValueChange={(v) => setPayMethod(v ?? 'all')}>
                    <SelectTrigger className="h-12 text-base rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['all','cash','qris','paylater','transfer','saving_deduct'].map((m: any) => (
                        <SelectItem key={m} value={m} className="text-sm">{PAYMENT_LABELS[m]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Button onClick={handleSearch} disabled={isPending} className="w-full h-12 text-base rounded-xl gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold shadow-sm">
                    <Search className="h-4 w-4" />
                    {isPending ? 'Memuat...' : 'Tampilkan'}
                  </Button>
                </div>
              </div>

              {hasSearched && data && (
                <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <Button onClick={exportExcel} variant="outline" size="sm" className="h-11 px-4 text-xs font-semibold rounded-xl gap-1.5 text-green-700 border-green-200 hover:bg-green-50">
                    <FileSpreadsheet className="h-4 w-4" /> Export Excel (Ringkasan)
                  </Button>
                  <Button onClick={exportPDF} variant="outline" size="sm" className="h-11 px-4 text-xs font-semibold rounded-xl gap-1.5 text-red-700 border-red-200 hover:bg-red-50">
                    <FileText className="h-4 w-4" /> Export PDF
                  </Button>
                  <Button onClick={exportKasirExcel} variant="outline" size="sm" className="h-11 px-4 text-xs font-semibold rounded-xl gap-1.5 text-blue-700 border-blue-200 hover:bg-blue-50">
                    <FileSpreadsheet className="h-4 w-4" /> Export Transaksi Kasir (Detail)
                  </Button>
                  <Button onClick={exportMultiTabExcel} variant="outline" size="sm" className="h-11 px-4 text-xs font-semibold rounded-xl gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50 shadow-sm">
                    <FileSpreadsheet className="h-4 w-4" /> Export Terpadu (Multi-Tab)
                  </Button>
                </div>
              )}
            </div>

            {!hasSearched ? (
              <div className="py-16 text-center text-slate-400 text-sm border border-slate-100 rounded-2xl bg-white dark:bg-slate-900">
                Silakan tentukan filter tanggal dan klik <strong className="text-blue-700 dark:text-blue-400">Tampilkan</strong> untuk memuat data transaksi kasir.
              </div>
            ) : detailRows.length > 0 ? (
              <>
                {/* Desktop View */}
                <div className="hidden md:block">
                  <div className="flex items-center gap-6 px-4 py-2.5 bg-[#1F4E78] text-white text-xs font-bold rounded-t-xl">
                    <span>BULAN: {new Date(startDate).toLocaleDateString('id-ID',{month:'long',year:'numeric'}).toUpperCase()}</span>
                    <span className="ml-auto flex gap-6">
                      <span>TOTAL QTY: {detailRows.reduce((s: any, r: any) =>s+r.qty,0)}</span>
                      <span>TOTAL JUAL: {formatRp(detailRows.reduce((s: any, r: any) =>s+r.tot_harga_jual,0))}</span>
                      <span>TOTAL HPP: {formatRp(detailRows.reduce((s: any, r: any) =>s+r.tot_harga_pokok,0))}</span>
                      <span>TOTAL LABA: {formatRp(detailRows.reduce((s: any, r: any) =>s+r.laba,0))}</span>
                    </span>
                  </div>
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-b-xl">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#1F4E78] text-white">
                          {['NO','TANGGAL','MINGGU','BAYAR','NIK','NAMA ANGGOTA','NAMA BARANG',
                            'QTY','HARGA JUAL','TOT HARGA JUAL','HARGA POKOK','TOT HARGA POKOK','LABA'
                          ].map((h: any) => (
                            <th key={h} className="px-2 py-2.5 text-center font-bold border border-[#163d5e] whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {detailRows.map((r: any, idx: any) => (
                          <tr key={r.no} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="px-2 py-1.5 text-center border border-gray-200">{r.no}</td>
                            <td className="px-2 py-1.5 text-center border border-gray-200 whitespace-nowrap">{r.tanggal}</td>
                            <td className="px-2 py-1.5 text-center border border-gray-200">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">{r.minggu}</span>
                            </td>
                            <td className="px-2 py-1.5 text-center border border-gray-200">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                r.bayar==='CAS' ? 'bg-green-100 text-green-700' :
                                r.bayar==='PAY' ? 'bg-orange-100 text-orange-700' :
                                r.bayar==='QRS' ? 'bg-purple-100 text-purple-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>{r.bayar}</span>
                            </td>
                            <td className="px-2 py-1.5 border border-gray-200 font-mono">{r.nik}</td>
                            <td className="px-2 py-1.5 border border-gray-200 max-w-[140px] truncate" title={r.nama_anggota}>{r.nama_anggota}</td>
                            <td className="px-2 py-1.5 border border-gray-200 max-w-[180px] truncate" title={r.nama_barang}>{r.nama_barang}</td>
                            <td className="px-2 py-1.5 text-center border border-gray-200 font-bold">{r.qty}</td>
                            <td className="px-2 py-1.5 text-right border border-gray-200">{r.harga_jual.toLocaleString('id-ID')}</td>
                            <td className="px-2 py-1.5 text-right border border-gray-200 text-blue-700 font-medium">{r.tot_harga_jual.toLocaleString('id-ID')}</td>
                            <td className="px-2 py-1.5 text-right border border-gray-200 text-orange-700">{r.harga_pokok.toLocaleString('id-ID')}</td>
                            <td className="px-2 py-1.5 text-right border border-gray-200 text-orange-700">{r.tot_harga_pokok.toLocaleString('id-ID')}</td>
                            <td className={`px-2 py-1.5 text-right border border-gray-200 font-bold ${r.laba >= 0 ? 'text-green-700' : 'text-red-650'}`}>{r.laba.toLocaleString('id-ID')}</td>
                          </tr>
                        ))}
                        <tr className="bg-[#1F4E78] text-white font-bold">
                          <td colSpan={7} className="px-3 py-2.5 text-center border border-[#163d5e]">TOTAL</td>
                          <td className="px-2 py-2.5 text-center border border-[#163d5e]">{detailRows.reduce((s: any, r: any) =>s+r.qty,0)}</td>
                          <td className="px-2 py-2.5 text-right border border-[#163d5e]">{detailRows.reduce((s: any, r: any) =>s+r.harga_jual,0).toLocaleString('id-ID')}</td>
                          <td className="px-2 py-2.5 text-right border border-[#163d5e]">{detailRows.reduce((s: any, r: any) =>s+r.tot_harga_jual,0).toLocaleString('id-ID')}</td>
                          <td className="px-2 py-2.5 text-right border border-[#163d5e]">{detailRows.reduce((s: any, r: any) =>s+r.harga_pokok,0).toLocaleString('id-ID')}</td>
                          <td className="px-2 py-2.5 text-right border border-[#163d5e]">{detailRows.reduce((s: any, r: any) =>s+r.tot_harga_pokok,0).toLocaleString('id-ID')}</td>
                          <td className="px-2 py-2.5 text-right border border-[#163d5e]">{detailRows.reduce((s: any, r: any) =>s+r.laba,0).toLocaleString('id-ID')}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile View */}
                <div className="block md:hidden space-y-3">
                  {detailRows.map((r: any) => (
                    <div key={r.no} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-base text-slate-900 dark:text-slate-100 truncate">{r.nama_barang}</p>
                          <p className="text-xs text-slate-400 mt-0.5 truncate">Pembeli: {r.nama_anggota} ({r.nik})</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                          r.bayar==='CAS' ? 'bg-green-100 text-green-700' :
                          r.bayar==='PAY' ? 'bg-orange-100 text-orange-700' :
                          r.bayar==='QRS' ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{r.bayar}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800/40 rounded-xl p-2">
                          <p className="text-slate-400 text-[10px]">Qty</p>
                          <p className="font-bold text-slate-800 dark:text-slate-200">{r.qty} pcs</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800/40 rounded-xl p-2">
                          <p className="text-slate-400 text-[10px]">Harga Jual</p>
                          <p className="font-bold text-slate-800 dark:text-slate-200">{r.harga_jual.toLocaleString('id-ID')}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800/40 rounded-xl p-2">
                          <p className="text-slate-400 text-[10px]">HPP/Unit</p>
                          <p className="font-bold text-slate-500">{r.harga_pokok.toLocaleString('id-ID')}</p>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs border-t border-slate-50 dark:border-slate-800/30 pt-2.5 mt-1">
                        <div className="text-[11px] text-slate-400">
                          No: {r.no} • Minggu: {r.minggu} • {r.tanggal}
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400">Laba Transaksi</p>
                          <p className={`font-extrabold text-sm ${r.laba >= 0 ? 'text-green-600' : 'text-red-650'}`}>{formatRp(r.laba)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-16 text-center text-slate-400 text-sm border border-slate-100 rounded-2xl bg-white dark:bg-slate-900">
                Tidak ada data transaksi kasir untuk kriteria pencarian ini.
              </div>
            )}
          </div>
        )}

              {/* ── TAB: Laporan Mingguan ──────────────────── */}
              {activeTab === 'mingguan' && (
                <div className="p-4 space-y-4">
                  {/* Filter Mingguan */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4 shadow-sm">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-650 dark:text-slate-400">TAHUN</Label>
                        <Select value={String(mTahun)} onValueChange={v => setMTahun(Number(v ?? new Date().getFullYear()))}>
                          <SelectTrigger className="h-12 text-base rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {[2024, 2025, 2026, 2027].map((y: any) => <SelectItem key={y} value={String(y)} className="text-sm">{y}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-650 dark:text-slate-400">BULAN</Label>
                        <Select value={String(mBulan)} onValueChange={v => setMBulan(Number(v ?? 1))}>
                          <SelectTrigger className="h-12 text-base rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {BULAN_NAMES.slice(1).map((b: any, i: any) => <SelectItem key={i+1} value={String(i+1)} className="text-sm">{b}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-650 dark:text-slate-400">MINGGU KE</Label>
                        <Select value={String(mMinggu)} onValueChange={v => setMMinggu(Number(v ?? 1))}>
                          <SelectTrigger className="h-12 text-base rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {[1,2,3,4,5].map((w: any) => <SelectItem key={w} value={String(w)} className="text-sm">Minggu {WEEK_ROMAN[w]} (tgl {(w-1)*7+1}–{Math.min(w*7,31)})</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleSearchMingguan} disabled={mingguPending} className="w-full h-12 text-base rounded-xl gap-2 bg-purple-700 hover:bg-purple-800 text-white font-semibold shadow-sm">
                          <Search className="h-4 w-4" />
                          {mingguPending ? 'Memuat...' : 'Tampilkan'}
                        </Button>
                      </div>
                    </div>
                    {mingguData && (
                      <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                        <Button onClick={() => exportMingguanExcel('mingguan')} variant="outline" size="sm" className="h-11 px-4 text-xs font-semibold rounded-xl gap-1.5 text-purple-700 border-purple-200 hover:bg-purple-50">
                          <FileSpreadsheet className="h-4 w-4" /> Export Laporan Mingguan
                        </Button>
                      </div>
                    )}
                  </div>

                  {mingguData ? (() => {
                    const mg = mingguData
                    const fmtN = (n: number) => n > 0 ? n.toLocaleString('id-ID') : '-'
                    const SectionTbl = ({ label, isCash, totHPP, totJual, totLaba }: {
                      label: string; isCash: boolean; totHPP: number; totJual: number; totLaba: number
                    }) => (
                      <div className="space-y-2">
                        <p className={`text-sm font-bold ${isCash ? 'text-blue-800 dark:text-blue-400' : 'text-red-700 dark:text-red-405'}`}>{label}</p>
                        
                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-150 text-slate-700 dark:bg-slate-850 dark:text-slate-300">
                                {['No','Week','Tanggal','Harga Pokok','Harga Jual','Laba'].map((h: any) => (
                                  <th key={h} className="px-2 py-2 text-center border border-gray-200 dark:border-gray-800 font-bold whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {mg.rows.map((r: any, i: any) => {
                                const hpp  = isCash ? r.hppCash  : r.hppKredit
                                const jual = isCash ? r.jualCash : r.jualKredit
                                const laba = isCash ? r.labaCash : r.labaKredit
                                return (
                                  <tr key={r.tanggal} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-2 py-1.5 text-center border border-gray-200">{i+1}</td>
                                    <td className="px-2 py-1.5 text-center border border-gray-200">{r.dayName}</td>
                                    <td className="px-2 py-1.5 text-center border border-gray-200">{r.tanggal}</td>
                                    <td className="px-2 py-1.5 text-right border border-gray-200">{fmtN(hpp)}</td>
                                    <td className="px-2 py-1.5 text-right border border-gray-200 text-blue-700 font-medium">{fmtN(jual)}</td>
                                    <td className={`px-2 py-1.5 text-right border border-gray-200 font-bold ${laba > 0 ? 'text-green-700' : laba < 0 ? 'text-red-650' : ''}`}>{fmtN(laba)}</td>
                                  </tr>
                                )
                              })}
                              <tr className="bg-slate-200 dark:bg-slate-800 font-bold">
                                <td colSpan={3} className="px-2 py-2 text-center border border-gray-250">JUMLAH</td>
                                <td className="px-2 py-2 text-right border border-gray-250">{fmtN(totHPP)}</td>
                                <td className="px-2 py-2 text-right border border-gray-250 text-blue-700">{fmtN(totJual)}</td>
                                <td className={`px-2 py-2 text-right border border-gray-250 ${totLaba >= 0 ? 'text-green-700' : 'text-red-650'}`}>{fmtN(totLaba)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile List View */}
                        <div className="block md:hidden space-y-2.5">
                          {mg.rows.map((r: any, i: any) => {
                            const hpp  = isCash ? r.hppCash  : r.hppKredit
                            const jual = isCash ? r.jualCash : r.jualKredit
                            const laba = isCash ? r.labaCash : r.labaKredit
                            return (
                              <div key={r.tanggal} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-2xl shadow-xs space-y-2">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="font-bold text-slate-800 dark:text-slate-200">{r.dayName}, {r.tanggal}</span>
                                  <span className="text-[10px] text-slate-450">Baris #{i+1}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                                  <div className="bg-slate-50 dark:bg-slate-850 p-1.5 rounded-lg">
                                    <p className="text-slate-405 text-[9px]">Harga Pokok</p>
                                    <p className="font-semibold text-slate-700 dark:text-slate-300">{fmtN(hpp)}</p>
                                  </div>
                                  <div className="bg-slate-50 dark:bg-slate-850 p-1.5 rounded-lg">
                                    <p className="text-slate-405 text-[9px]">Harga Jual</p>
                                    <p className="font-semibold text-blue-750 dark:text-blue-300">{fmtN(jual)}</p>
                                  </div>
                                  <div className="bg-slate-50 dark:bg-slate-850 p-1.5 rounded-lg">
                                    <p className="text-slate-405 text-[9px]">Laba</p>
                                    <p className={`font-bold ${laba > 0 ? 'text-green-600' : laba < 0 ? 'text-red-650' : 'text-slate-400'}`}>{fmtN(laba)}</p>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                          
                          {/* Mini Summary Card for Mobile Section */}
                          <div className="bg-slate-100 dark:bg-slate-850 p-3.5 rounded-2xl text-xs space-y-1.5 font-bold">
                            <p className="text-[10px] text-slate-500 uppercase">SUBTOTAL {label}</p>
                            <div className="flex justify-between">
                              <span className="text-slate-600 dark:text-slate-400">Total HPP:</span>
                              <span>{fmtN(totHPP)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-650 dark:text-slate-400">Total Jual:</span>
                              <span className="text-blue-700">{fmtN(totJual)}</span>
                            </div>
                            <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1">
                              <span className="text-slate-650 dark:text-slate-400">Total Laba:</span>
                              <span className={totLaba >= 0 ? 'text-green-600' : 'text-red-655'}>{fmtN(totLaba)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                    return (
                      <div className="space-y-6">
                        <p className="text-xs text-slate-500 font-semibold px-1">
                          Periode: Minggu {WEEK_ROMAN[mMinggu]} — {BULAN_NAMES[mBulan]} {mTahun}
                        </p>
                        <SectionTbl label="PENJUALAN CASH (Tunai / QRIS / Transfer)"
                          isCash={true} totHPP={mg.totCashHpp} totJual={mg.totCashJual} totLaba={mg.totCashLaba} />
                        <SectionTbl label="PENJUALAN KREDIT (Bayar Tempo / Potong Simpanan)"
                          isCash={false} totHPP={mg.totKrdHpp} totJual={mg.totKrdJual} totLaba={mg.totKrdLaba} />
                        
                        <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                          <table className="w-full text-xs">
                            <tbody>
                              <tr className="border-b border-slate-100 dark:border-slate-800">
                                <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Total Harga Pokok (Grand HPP)</td>
                                <td className="px-4 py-3 text-right font-black text-slate-900 dark:text-white">{mg.grandHpp.toLocaleString('id-ID')}</td>
                                <td className="px-3 py-3 text-slate-400 text-[10px] w-12 text-center">IDR</td>
                              </tr>
                              <tr className="border-b border-slate-100 dark:border-slate-800">
                                <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Total Harga Jual (Grand Jual)</td>
                                <td className="px-4 py-3 text-right font-black text-blue-700 dark:text-blue-400">{mg.grandJual.toLocaleString('id-ID')}</td>
                                <td className="px-3 py-3 text-slate-400 text-[10px] w-12 text-center">IDR</td>
                              </tr>
                              <tr className="bg-yellow-50/60 dark:bg-yellow-950/20">
                                <td className="px-4 py-4 font-extrabold text-slate-900 dark:text-slate-100 text-sm">Keuntungan Bersih (Laba)</td>
                                <td className={`px-4 py-4 text-right font-black text-xl ${mg.grandLaba >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-650 dark:text-red-400'}`}>
                                  {mg.grandLaba.toLocaleString('id-ID')}
                                </td>
                                <td className="px-3 py-4 text-slate-500 font-bold text-xs w-12 text-center">IDR</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })() : (
                    <div className="py-16 text-center text-slate-400 text-sm border border-slate-100 rounded-2xl bg-white dark:bg-slate-900">
                      Pilih Tahun, Bulan, dan Minggu lalu klik <strong className="text-purple-750 dark:text-purple-400">Tampilkan</strong>.
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: Rekap Sembako Anggota ─────────────────── */}
              {activeTab === 'sembako' && (
                <div className="p-4 space-y-4">
                  {/* Local Filter Card */}
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4 shadow-sm">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-xs font-semibold text-slate-500 mr-2">PRESET TANGGAL:</span>
                      {PRESETS.map((p: any) => (
                        <Button key={p.label} size="sm" variant="outline" onClick={() => applyPreset(p.days)}
                          className="h-7 text-[11px] px-2.5 py-0.5">{p.label}</Button>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-650 dark:text-slate-400">PILIHAN BULAN</Label>
                        <Select value={selectedMonth} onValueChange={(v) => handleMonthYearChange(v ?? '1', selectedYear)}>
                          <SelectTrigger className="h-12 text-base rounded-xl bg-white dark:bg-slate-900"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {MONTH_OPTIONS.map((m: any) => (
                              <SelectItem key={m.value} value={m.value} className="text-sm">{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-650 dark:text-slate-400">PILIHAN TAHUN</Label>
                        <Select value={selectedYear} onValueChange={(v) => handleMonthYearChange(selectedMonth, v ?? '2026')}>
                          <SelectTrigger className="h-12 text-base rounded-xl bg-white dark:bg-slate-900"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {YEAR_OPTIONS.map((y: any) => (
                              <SelectItem key={y} value={y} className="text-sm">{y}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-650 dark:text-slate-400">METODE PEMBAYARAN</Label>
                        <Select value={payMethod} onValueChange={(v) => setPayMethod(v ?? 'all')}>
                          <SelectTrigger className="h-12 text-base rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['all','cash','qris','paylater','transfer','saving_deduct'].map((m: any) => (
                              <SelectItem key={m} value={m} className="text-sm">{PAYMENT_LABELS[m]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Button onClick={handleSearch} disabled={isPending} className="w-full h-12 text-base rounded-xl gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-sm">
                          <Search className="h-4 w-4" />
                          {isPending ? 'Memuat...' : 'Tampilkan'}
                        </Button>
                      </div>
                    </div>

                    {hasSearched && data && (
                      <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                        <Button onClick={exportMultiTabExcel} variant="outline" size="sm" className="h-11 px-4 text-xs font-semibold rounded-xl gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                          <FileSpreadsheet className="h-4 w-4" /> Export Rekap Sembako (Excel Terpadu)
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Sembako Local Search and Options */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-100 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-150 dark:border-slate-800">
                    <div className="flex items-center gap-2 flex-1 max-w-sm">
                      <Label className="text-xs shrink-0 font-semibold text-slate-650 dark:text-slate-400">Cari Anggota:</Label>
                      <Input
                        placeholder="Nama atau NIK..."
                        value={sembakoSearch}
                        onChange={e => setSembakoSearch(e.target.value)}
                        className="h-11 text-base bg-white dark:bg-slate-900 rounded-xl"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="onlyActiveSembako"
                        checked={onlyActiveSembako}
                        onChange={e => setOnlyActiveSembako(e.target.checked)}
                        className="h-5 w-5 rounded-lg border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <Label htmlFor="onlyActiveSembako" className="text-xs cursor-pointer select-none font-semibold text-slate-650 dark:text-slate-450">
                        Hanya tampilkan anggota dengan transaksi sembako
                      </Label>
                    </div>
                  </div>

                  {!hasSearched ? (
                    <div className="py-16 text-center text-slate-400 text-sm border border-slate-100 rounded-2xl bg-white dark:bg-slate-900">
                      Silakan tentukan filter tanggal dan klik <strong className="text-emerald-700 dark:text-emerald-400">Tampilkan</strong> untuk memuat rekap sembako anggota.
                    </div>
                  ) : sembakoRows.length > 0 ? (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3 bg-emerald-800 text-white text-xs font-bold rounded-t-2xl">
                        <span>PERIODE: {startDate} S/D {endDate}</span>
                        <span className="sm:ml-auto">TOTAL ANGGOTA TAMPIL: {sembakoRows.length}</span>
                      </div>
                      
                      {/* Desktop View Table */}
                      <div className="hidden md:block overflow-x-auto border border-t-0 rounded-b-2xl border-slate-200 dark:border-slate-800">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-emerald-800 text-white font-bold">
                              <th className="px-2 py-2.5 text-center border border-emerald-900 whitespace-nowrap">NO</th>
                              <th className="px-2 py-2.5 text-left border border-emerald-900 whitespace-nowrap">NIK</th>
                              <th className="px-2 py-2.5 text-left border border-emerald-900 whitespace-nowrap">NAMA</th>
                              <th className="px-2 py-2.5 text-center border border-emerald-900 whitespace-nowrap">COM 1</th>
                              <th className="px-2 py-2.5 text-center border border-emerald-900 whitespace-nowrap">COM 2</th>
                              <th className="px-2 py-2.5 text-right border border-emerald-900 whitespace-nowrap">P-SBK CRD JUAL</th>
                              <th className="px-2 py-2.5 text-right border border-emerald-900 whitespace-nowrap">P-SBK CAS JUAL</th>
                              <th className="px-2 py-2.5 text-right border border-emerald-900 whitespace-nowrap">P-SBK CRD POKOK</th>
                              <th className="px-2 py-2.5 text-right border border-emerald-900 whitespace-nowrap">P-SBK CAS POKOK</th>
                              <th className="px-2 py-2.5 text-right border border-emerald-900 whitespace-nowrap">P-SBK CRD LABA</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sembakoRows.map((r: any, idx: any) => (
                              <tr key={r.nik} className={idx % 2 === 0 ? 'bg-gray-50 dark:bg-slate-900/40' : 'bg-white dark:bg-slate-900 hover:bg-slate-100'}>
                                <td className="px-2 py-1.5 text-center border border-gray-200 dark:border-gray-800">{idx + 1}</td>
                                <td className="px-2 py-1.5 border border-gray-200 dark:border-gray-800 font-mono">{r.nik}</td>
                                <td className="px-2 py-1.5 border border-gray-200 dark:border-gray-800 font-medium whitespace-nowrap">{r.nama}</td>
                                <td className="px-2 py-1.5 text-center border border-gray-200 dark:border-gray-800">{r.com1}</td>
                                <td className="px-2 py-1.5 text-center border border-gray-200 dark:border-gray-800 font-bold text-gray-600 dark:text-gray-400">{r.com2}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 font-medium text-emerald-700 dark:text-emerald-400">{r.crdJual > 0 ? r.crdJual.toLocaleString('id-ID') : '-'}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300">{r.casJual > 0 ? r.casJual.toLocaleString('id-ID') : '-'}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 text-orange-700 dark:text-orange-400">{r.crdPokok > 0 ? r.crdPokok.toLocaleString('id-ID') : '-'}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400">{r.casPokok > 0 ? r.casPokok.toLocaleString('id-ID') : '-'}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 font-bold text-teal-700 dark:text-teal-400">{r.crdLaba > 0 ? r.crdLaba.toLocaleString('id-ID') : '-'}</td>
                              </tr>
                            ))}
                            <tr className="bg-emerald-800 text-white font-bold">
                              <td colSpan={5} className="px-3 py-2.5 text-center border border-emerald-900">TOTAL</td>
                              <td className="px-2 py-2.5 text-right border border-emerald-900">{sembakoRows.reduce((s: any, r: any) =>s+r.crdJual,0).toLocaleString('id-ID')}</td>
                              <td className="px-2 py-2.5 text-right border border-emerald-900">{sembakoRows.reduce((s: any, r: any) =>s+r.casJual,0).toLocaleString('id-ID')}</td>
                              <td className="px-2 py-2.5 text-right border border-emerald-900">{sembakoRows.reduce((s: any, r: any) =>s+r.crdPokok,0).toLocaleString('id-ID')}</td>
                              <td className="px-2 py-2.5 text-right border border-emerald-900">{sembakoRows.reduce((s: any, r: any) =>s+r.casPokok,0).toLocaleString('id-ID')}</td>
                              <td className="px-2 py-2.5 text-right border border-emerald-900">{sembakoRows.reduce((s: any, r: any) =>s+r.crdLaba,0).toLocaleString('id-ID')}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Card Feed View */}
                      <div className="block md:hidden space-y-3 mt-2">
                        {/* Summary Sticky Card */}
                        <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl shadow-md">
                          <p className="text-xs font-bold text-slate-400 uppercase mb-3">AKUMULASI REKAP SEMBAKO</p>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <p className="text-slate-400">Total Kredit Jual</p>
                              <p className="text-base font-black text-emerald-450">{formatRp(sembakoRows.reduce((s: any, r: any) =>s+r.crdJual,0))}</p>
                            </div>
                            <div>
                              <p className="text-slate-400">Total Cash Jual</p>
                              <p className="text-base font-black text-blue-450">{formatRp(sembakoRows.reduce((s: any, r: any) =>s+r.casJual,0))}</p>
                            </div>
                            <div>
                              <p className="text-slate-400">Total HPP Kredit</p>
                              <p className="text-base font-black text-amber-500">{formatRp(sembakoRows.reduce((s: any, r: any) =>s+r.crdPokok,0))}</p>
                            </div>
                            <div>
                              <p className="text-slate-400">Total Laba Kredit</p>
                              <p className="text-base font-black text-teal-400">{formatRp(sembakoRows.reduce((s: any, r: any) =>s+r.crdLaba,0))}</p>
                            </div>
                          </div>
                        </div>

                        {sembakoRows.map((r: any, idx: any) => (
                          <div key={r.nik} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-3">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-base text-slate-900 dark:text-slate-100 truncate">{r.nama}</p>
                                <p className="text-xs text-slate-400 mt-0.5 truncate">NIK: {r.nik} • {r.com1} • {r.com2}</p>
                              </div>
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500">#{idx + 1}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/40">
                                <p className="text-[10px] text-slate-450 font-bold mb-1">TRANSAKSI KREDIT</p>
                                <div className="space-y-0.5">
                                  <div className="flex justify-between">
                                    <span className="text-[10px] text-slate-400">Jual:</span>
                                    <span className="font-bold text-emerald-600">{r.crdJual > 0 ? formatRp(r.crdJual) : '-'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-[10px] text-slate-400">Pokok:</span>
                                    <span className="font-semibold text-slate-600">{r.crdPokok > 0 ? formatRp(r.crdPokok) : '-'}</span>
                                  </div>
                                  <div className="flex justify-between border-t border-slate-100 dark:border-slate-800/50 pt-1 mt-1 font-extrabold">
                                    <span className="text-[10px] text-slate-400">Laba:</span>
                                    <span className="text-teal-650">{r.crdLaba > 0 ? formatRp(r.crdLaba) : '-'}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/40">
                                <p className="text-[10px] text-slate-455 font-bold mb-1">TRANSAKSI CASH</p>
                                <div className="space-y-0.5">
                                  <div className="flex justify-between">
                                    <span className="text-[10px] text-slate-455">Jual:</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{r.casJual > 0 ? formatRp(r.casJual) : '-'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-[10px] text-slate-455">Pokok:</span>
                                    <span className="font-semibold text-slate-500">{r.casPokok > 0 ? formatRp(r.casPokok) : '-'}</span>
                                  </div>
                                  <div className="flex justify-between border-t border-slate-100 dark:border-slate-800/50 pt-1 mt-1">
                                    <span className="text-[10px] text-slate-455">Laba:</span>
                                    <span className="font-bold text-slate-500">{r.casJual - r.casPokok > 0 ? formatRp(r.casJual - r.casPokok) : '-'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="py-16 text-center text-slate-400 text-sm border border-slate-100 rounded-2xl bg-white dark:bg-slate-900">
                      Tidak ada data rekap sembako anggota untuk kriteria pencarian ini.
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'potongan' && (
                <div className="p-4 space-y-4">
                  {/* Local Filter Card */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4 shadow-sm">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-xs font-semibold text-slate-550 dark:text-slate-450 mr-2">PRESET TANGGAL:</span>
                      {PRESETS.map((p: any) => (
                        <Button key={p.label} size="sm" variant="outline" onClick={() => applyPreset(p.days)}
                          className="h-7 text-[11px] px-2.5 py-0.5 rounded-lg">{p.label}</Button>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-650 dark:text-slate-400">PILIHAN BULAN</Label>
                        <Select value={selectedMonth} onValueChange={(v) => handleMonthYearChange(v ?? '1', selectedYear)}>
                          <SelectTrigger className="h-12 text-base rounded-xl bg-white dark:bg-slate-900"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {MONTH_OPTIONS.map((m: any) => (
                              <SelectItem key={m.value} value={m.value} className="text-sm">{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-650 dark:text-slate-400">PILIHAN TAHUN</Label>
                        <Select value={selectedYear} onValueChange={(v) => handleMonthYearChange(selectedMonth, v ?? '2026')}>
                          <SelectTrigger className="h-12 text-base rounded-xl bg-white dark:bg-slate-900"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {YEAR_OPTIONS.map((y: any) => (
                              <SelectItem key={y} value={y} className="text-sm">{y}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-650 dark:text-slate-400">METODE PEMBAYARAN</Label>
                        <Select value={payMethod} onValueChange={(v) => setPayMethod(v ?? 'all')}>
                          <SelectTrigger className="h-12 text-base rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['all','cash','qris','paylater','transfer','saving_deduct'].map((m: any) => (
                              <SelectItem key={m} value={m} className="text-sm">{PAYMENT_LABELS[m]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Button onClick={handleSearch} disabled={isPending} className="w-full h-12 text-base rounded-xl gap-2 bg-red-700 hover:bg-red-800 text-white font-semibold shadow-sm">
                          <Search className="h-4 w-4" />
                          {isPending ? 'Memuat...' : 'Tampilkan'}
                        </Button>
                      </div>
                    </div>

                    {hasSearched && data && (
                      <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                        <Button onClick={exportMultiTabExcel} variant="outline" size="sm" className="h-11 px-4 text-xs font-semibold rounded-xl gap-1.5 text-red-700 border-red-200 hover:bg-red-50">
                          <FileSpreadsheet className="h-4 w-4" /> Export Potongan Gaji (Excel Terpadu)
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Potongan Local Search and Options */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-100 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-150 dark:border-slate-800">
                    <div className="flex items-center gap-2 flex-1 max-w-sm">
                      <Label className="text-xs shrink-0 font-semibold text-slate-655 dark:text-slate-400">Cari Karyawan:</Label>
                      <Input
                        placeholder="Nama, NIK, Departemen..."
                        value={potonganSearch}
                        onChange={e => setPotonganSearch(e.target.value)}
                        className="h-11 text-base bg-white dark:bg-slate-900 rounded-xl"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="onlyActivePotongan"
                        checked={onlyActivePotongan}
                        onChange={e => setOnlyActivePotongan(e.target.checked)}
                        className="h-5 w-5 rounded-lg border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                      />
                      <Label htmlFor="onlyActivePotongan" className="text-xs cursor-pointer select-none font-semibold text-slate-650 dark:text-slate-450">
                        Hanya tampilkan karyawan dengan potongan gaji
                      </Label>
                    </div>
                  </div>

                  {!hasSearched ? (
                    <div className="py-16 text-center text-slate-400 text-sm border border-slate-100 rounded-2xl bg-white dark:bg-slate-900">
                      Silakan tentukan filter tanggal dan klik <strong className="text-red-700 dark:text-red-400">Tampilkan</strong> untuk memuat data potongan gaji karyawan.
                    </div>
                  ) : filteredDeductions.length > 0 ? (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3 bg-red-800 text-white text-xs font-bold rounded-t-2xl">
                        <span>PERIODE: {startDate} S/D {endDate}</span>
                        <span className="sm:ml-auto">TOTAL KARYAWAN TAMPIL: {filteredDeductions.length}</span>
                      </div>
                      
                      {/* Desktop Table View */}
                      <div className="hidden md:block overflow-x-auto border border-t-0 rounded-b-2xl border-slate-200 dark:border-slate-800">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-red-800 text-white font-bold text-center">
                              <th className="px-2 py-2.5 border border-red-950 whitespace-nowrap" rowSpan={2}>NO</th>
                              <th className="px-2 py-2.5 border border-red-950 whitespace-nowrap" rowSpan={2}>NIK</th>
                              <th className="px-2 py-2.5 border border-red-950 whitespace-nowrap text-left" rowSpan={2}>NAMA</th>
                              <th className="px-2 py-1 border border-red-950 whitespace-nowrap" colSpan={2}>COM</th>
                              <th className="px-2 py-1 border border-red-950 whitespace-nowrap" colSpan={3}>SIMPANAN</th>
                              <th className="px-2 py-1 border border-red-950 whitespace-nowrap" colSpan={3}>PINJAMAN UANG</th>
                              <th className="px-2 py-1 border border-red-950 whitespace-nowrap" colSpan={2}>P-KHS</th>
                              <th className="px-2 py-1 border border-red-950 whitespace-nowrap" colSpan={2}>P-BRG</th>
                              <th className="px-2 py-2.5 border border-red-950 whitespace-nowrap" rowSpan={2}>KREDIT SBK</th>
                              <th className="px-2 py-2.5 border border-red-950 whitespace-nowrap" rowSpan={2}>TOTAL</th>
                            </tr>
                            <tr className="bg-red-900 text-white text-[10px] font-bold">
                              <th className="px-1 py-1 border border-red-950">1</th>
                              <th className="px-1 py-1 border border-red-950">2</th>
                              <th className="px-1 py-1 border border-red-950">POKOK</th>
                              <th className="px-1 py-1 border border-red-950">WAJIB</th>
                              <th className="px-1 py-1 border border-red-950">SUKARELA</th>
                              <th className="px-1 py-1 border border-red-950">P-UANG</th>
                              <th className="px-1 py-1 border border-red-950">ADM</th>
                              <th className="px-1 py-1 border border-red-950">B-TRSF</th>
                              <th className="px-1 py-1 border border-red-950">KILAT</th>
                              <th className="px-1 py-1 border border-red-950">ADM</th>
                              <th className="px-1 py-1 border border-red-950">BARANG</th>
                              <th className="px-1 py-1 border border-red-950">ADM</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredDeductions.map((item: any, idx: any) => {
                              const com2Val = (item.department || 'SAU').replace(/^U-/, '')
                              const simpPokok = item.details.filter((d: any) => d.reference === 'SP').reduce((sum: any, d: any) => sum + d.amount, 0)
                              const simpWajib = item.details.filter((d: any) => d.reference === 'SW' || (d.category === 'simpanan_wajib' && d.reference !== 'SP')).reduce((sum: any, d: any) => sum + d.amount, 0)
                              const simpSukarela = item.total_simpanan_salary_cut
                              const pUang = item.total_pinjaman_uang
                              const admPU = item.total_pinjaman_uang_interest ?? 0
                              const bTrsf = item.total_pinjaman_uang_transfer ?? 0
                              const pKhusus = item.total_pinjaman_kilat
                              const admPKhs = item.total_pinjaman_kilat_interest ?? 0
                              const pBarang = item.total_pinjaman_barang
                              const admPBrg = item.total_pinjaman_barang_interest ?? 0
                              const kreditSbk = item.total_paylater
                              const total = simpPokok + simpWajib + simpSukarela + pUang + admPU + bTrsf + pKhusus + admPKhs + pBarang + admPBrg + kreditSbk

                              return (
                                <tr key={item.nik} className={idx % 2 === 0 ? 'bg-gray-50 dark:bg-slate-900/40' : 'bg-white dark:bg-slate-900 hover:bg-slate-100'}>
                                  <td className="px-2 py-1.5 text-center border border-gray-200 dark:border-gray-800">{idx + 1}</td>
                                  <td className="px-2 py-1.5 border border-gray-200 dark:border-gray-800 font-mono">{item.nik}</td>
                                  <td className="px-2 py-1.5 border border-gray-200 dark:border-gray-800 font-medium whitespace-nowrap">{item.name}</td>
                                  <td className="px-2 py-1.5 text-center border border-gray-200 dark:border-gray-800">1</td>
                                  <td className="px-2 py-1.5 text-center border border-gray-200 dark:border-gray-800 font-bold text-gray-600 dark:text-gray-400">{com2Val}</td>
                                  <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800">{simpPokok > 0 ? simpPokok.toLocaleString('id-ID') : '-'}</td>
                                  <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300">{simpWajib > 0 ? simpWajib.toLocaleString('id-ID') : '-'}</td>
                                  <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-405">{simpSukarela > 0 ? simpSukarela.toLocaleString('id-ID') : '-'}</td>
                                                                     <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 text-blue-700 dark:text-blue-400">{pUang > 0 ? pUang.toLocaleString('id-ID') : '-'}</td>
                                   <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 text-slate-600 dark:text-slate-400">{admPU > 0 ? admPU.toLocaleString('id-ID') : '-'}</td>
                                   <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 text-slate-600 dark:text-slate-400">{bTrsf > 0 ? bTrsf.toLocaleString('id-ID') : '-'}</td>
                                   <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 text-indigo-700 dark:text-indigo-400">{pKhusus > 0 ? pKhusus.toLocaleString('id-ID') : '-'}</td>
                                   <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 text-slate-600 dark:text-slate-400">{admPKhs > 0 ? admPKhs.toLocaleString('id-ID') : '-'}</td>
                                   <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 text-amber-700 dark:text-amber-400">{pBarang > 0 ? pBarang.toLocaleString('id-ID') : '-'}</td>
                                   <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 text-slate-600 dark:text-slate-400">{admPBrg > 0 ? admPBrg.toLocaleString('id-ID') : '-'}</td>
                                  <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 font-medium text-emerald-700 dark:text-emerald-400">{kreditSbk > 0 ? kreditSbk.toLocaleString('id-ID') : '-'}</td>
                                  <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 font-bold text-red-700 dark:text-red-400">{total > 0 ? total.toLocaleString('id-ID') : '-'}</td>
                                </tr>
                              )
                            })}
                            <tr className="bg-red-800 text-white font-bold">
                              <td colSpan={5} className="px-3 py-2.5 text-center border border-red-950">TOTAL</td>
                              <td className="px-2 py-2.5 text-right border border-red-950">
                                {filteredDeductions.reduce((s: any, item: any) => s + item.details.filter((d: any) => d.reference === 'SP').reduce((sum: any, d: any) => sum + d.amount, 0), 0).toLocaleString('id-ID')}
                              </td>
                              <td className="px-2 py-2.5 text-right border border-red-950">
                                {filteredDeductions.reduce((s: any, item: any) => s + item.details.filter((d: any) => d.reference === 'SW' || (d.category === 'simpanan_wajib' && d.reference !== 'SP')).reduce((sum: any, d: any) => sum + d.amount, 0), 0).toLocaleString('id-ID')}
                              </td>
                              <td className="px-2 py-2.5 text-right border border-red-950">
                                {filteredDeductions.reduce((s: any, item: any) => s + item.total_simpanan_salary_cut, 0).toLocaleString('id-ID')}
                              </td>
                              <td className="px-2 py-2.5 text-right border border-red-950">
                                {filteredDeductions.reduce((s: any, item: any) => s + item.total_pinjaman_uang, 0).toLocaleString('id-ID')}
                              </td>
                                                            <td className="px-2 py-2.5 text-right border border-red-950">
                                {filteredDeductions.reduce((s: any, item: any) => s + (item.total_pinjaman_uang_interest ?? 0), 0).toLocaleString('id-ID')}
                              </td>
                              <td className="px-2 py-2.5 text-right border border-red-950">
                                {filteredDeductions.reduce((s: any, item: any) => s + (item.total_pinjaman_uang_transfer ?? 0), 0).toLocaleString('id-ID')}
                              </td>
                              <td className="px-2 py-2.5 text-right border border-red-950">
                                {filteredDeductions.reduce((s: any, item: any) => s + item.total_pinjaman_kilat, 0).toLocaleString('id-ID')}
                              </td>
                              <td className="px-2 py-2.5 text-right border border-red-950">
                                {filteredDeductions.reduce((s: any, item: any) => s + (item.total_pinjaman_kilat_interest ?? 0), 0).toLocaleString('id-ID')}
                              </td>
                              <td className="px-2 py-2.5 text-right border border-red-950">
                                {filteredDeductions.reduce((s: any, item: any) => s + item.total_pinjaman_barang, 0).toLocaleString('id-ID')}
                              </td>
                              <td className="px-2 py-2.5 text-right border border-red-950">
                                {filteredDeductions.reduce((s: any, item: any) => s + (item.total_pinjaman_barang_interest ?? 0), 0).toLocaleString('id-ID')}
                              </td>
                              <td className="px-2 py-2.5 text-right border border-red-950">
                                {filteredDeductions.reduce((s: any, item: any) => s + item.total_paylater, 0).toLocaleString('id-ID')}
                              </td>
                              <td className="px-2 py-2.5 text-right border border-red-950">
                                                                {filteredDeductions.reduce((s: any, item: any) => {
                                  const simpPokok = item.details.filter((d: any) => d.reference === 'SP').reduce((sum: any, d: any) => sum + d.amount, 0)
                                  const simpWajib = item.details.filter((d: any) => d.reference === 'SW' || (d.category === 'simpanan_wajib' && d.reference !== 'SP')).reduce((sum: any, d: any) => sum + d.amount, 0)
                                  const simpSukarela = item.total_simpanan_salary_cut
                                  const pUang = item.total_pinjaman_uang
                                  const admPU = item.total_pinjaman_uang_interest ?? 0
                                  const bTrsf = item.total_pinjaman_uang_transfer ?? 0
                                  const pKhusus = item.total_pinjaman_kilat
                                  const admPKhs = item.total_pinjaman_kilat_interest ?? 0
                                  const pBarang = item.total_pinjaman_barang
                                  const admPBrg = item.total_pinjaman_barang_interest ?? 0
                                  const kreditSbk = item.total_paylater
                                  return s + simpPokok + simpWajib + simpSukarela + pUang + admPU + bTrsf + pKhusus + admPKhs + pBarang + admPBrg + kreditSbk
                                }, 0).toLocaleString('id-ID')}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Card Feed View */}
                      <div className="block md:hidden space-y-3 mt-2">
                        {/* Summary Sticky Card */}
                        <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl space-y-3.5 shadow-md">
                          <p className="text-xs font-bold text-slate-405 uppercase">AKUMULASI SELURUH POTONGAN</p>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <p className="text-slate-400">Total Simpanan</p>
                              <p className="text-sm font-bold text-slate-200">
                                {formatRp(filteredDeductions.reduce((s: any, item: any) => {
                                  const simpPokok = item.details.filter((d: any) => d.reference === 'SP').reduce((sum: any, d: any) => sum + d.amount, 0)
                                  const simpWajib = item.details.filter((d: any) => d.reference === 'SW' || (d.category === 'simpanan_wajib' && d.reference !== 'SP')).reduce((sum: any, d: any) => sum + d.amount, 0)
                                  return s + simpPokok + simpWajib + item.total_simpanan_salary_cut
                                }, 0))}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-400">Total Pinjaman & Bayar Tempo</p>
                              <p className="text-sm font-bold text-slate-200">
                                {formatRp(filteredDeductions.reduce((s: any, item: any) => s + item.total_pinjaman_uang + item.total_pinjaman_kilat + item.total_pinjaman_barang + item.total_paylater, 0))}
                              </p>
                            </div>
                          </div>
                          <div className="border-t border-slate-800 pt-2 flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-400">GRAND TOTAL POTONGAN</span>
                            <span className="text-lg font-black text-red-400">
                              {formatRp(filteredDeductions.reduce((s: any, item: any) => {
                                const simpPokok = item.details.filter((d: any) => d.reference === 'SP').reduce((sum: any, d: any) => sum + d.amount, 0)
                                const simpWajib = item.details.filter((d: any) => d.reference === 'SW' || (d.category === 'simpanan_wajib' && d.reference !== 'SP')).reduce((sum: any, d: any) => sum + d.amount, 0)
                                const simpSukarela = item.total_simpanan_salary_cut
                                const pUang = item.total_pinjaman_uang
                                const pKhusus = item.total_pinjaman_kilat
                                const pBarang = item.total_pinjaman_barang
                                const kreditSbk = item.total_paylater
                                return s + simpPokok + simpWajib + simpSukarela + pUang + pKhusus + pBarang + kreditSbk
                              }, 0))}
                            </span>
                          </div>
                        </div>

                        {filteredDeductions.map((item: any, idx: any) => {
                          const com2Val = (item.department || 'SAU').replace(/^U-/, '')
                          const simpPokok = item.details.filter((d: any) => d.reference === 'SP').reduce((sum: any, d: any) => sum + d.amount, 0)
                          const simpWajib = item.details.filter((d: any) => d.reference === 'SW' || (d.category === 'simpanan_wajib' && d.reference !== 'SP')).reduce((sum: any, d: any) => sum + d.amount, 0)
                          const simpSukarela = item.total_simpanan_salary_cut
                          const pUang = item.total_pinjaman_uang
                          const pKhusus = item.total_pinjaman_kilat
                          const pBarang = item.total_pinjaman_barang
                          const kreditSbk = item.total_paylater
                          const total = simpPokok + simpWajib + simpSukarela + pUang + pKhusus + pBarang + kreditSbk

                          return (
                            <div key={item.nik} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-3.5">
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-base text-slate-900 dark:text-slate-100 truncate">{item.name}</p>
                                  <p className="text-xs text-slate-400 mt-0.5 truncate">NIK: {item.nik} • COM: 1 / {com2Val}</p>
                                </div>
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500">#{idx + 1}</span>
                              </div>

                              <div className="space-y-2 text-xs">
                                {/* Simpanan Card Section */}
                                <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded-xl border border-slate-100 dark:border-slate-800/40 space-y-1.5">
                                  <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">A. SIMPANAN KARYAWAN</p>
                                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                                    <div>
                                      <span className="text-[10px] text-slate-400 block">Pokok:</span>
                                      <span className="font-bold text-slate-700 dark:text-slate-350">{simpPokok > 0 ? formatRp(simpPokok) : '-'}</span>
                                    </div>
                                    <div>
                                      <span className="text-[10px] text-slate-400 block">Wajib:</span>
                                      <span className="font-bold text-slate-700 dark:text-slate-350">{simpWajib > 0 ? formatRp(simpWajib) : '-'}</span>
                                    </div>
                                    <div>
                                      <span className="text-[10px] text-slate-400 block">Sukarela:</span>
                                      <span className="font-bold text-slate-700 dark:text-slate-350">{simpSukarela > 0 ? formatRp(simpSukarela) : '-'}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Pinjaman Card Section */}
                                <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded-xl border border-slate-100 dark:border-slate-800/40 space-y-1.5">
                                  <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">B. PINJAMAN & BAYAR TEMPO</p>
                                  <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                                    <div className="flex justify-between border-b border-slate-200/50 pb-1">
                                      <span className="text-slate-400">Pinjam Uang:</span>
                                      <span className="font-bold text-blue-600">{pUang > 0 ? formatRp(pUang) : '-'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-200/50 pb-1">
                                      <span className="text-slate-400">Pinjam Kilat:</span>
                                      <span className="font-bold text-indigo-600">{pKhusus > 0 ? formatRp(pKhusus) : '-'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Pinjam Barang:</span>
                                      <span className="font-bold text-amber-600">{pBarang > 0 ? formatRp(pBarang) : '-'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Kredit Sembako:</span>
                                      <span className="font-bold text-emerald-600">{kreditSbk > 0 ? formatRp(kreditSbk) : '-'}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="flex justify-between items-center text-xs border-t border-slate-50 dark:border-slate-800/30 pt-2.5 mt-1">
                                <span className="text-[10px] text-slate-400 font-semibold uppercase">TOTAL POTONGAN GAJI</span>
                                <span className="font-extrabold text-sm text-red-600 dark:text-red-400">{total > 0 ? formatRp(total) : '-'}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="py-16 text-center text-slate-400 text-sm border border-slate-100 rounded-2xl bg-white dark:bg-slate-900">
                      Tidak ada data potongan gaji karyawan untuk kriteria pencarian ini.
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: Monitoring Stocks ─────────────────── */}
              {activeTab === 'stok' && (
                <div className="p-4 space-y-4">
                  {/* Local Filter Card */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4 shadow-sm">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-xs font-semibold text-slate-550 dark:text-slate-450 mr-2">PRESET TANGGAL:</span>
                      {PRESETS.map((p: any) => (
                        <Button key={p.label} size="sm" variant="outline" onClick={() => applyPreset(p.days)}
                          className="h-7 text-[11px] px-2.5 py-0.5 rounded-lg">{p.label}</Button>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-655 dark:text-slate-400">PILIHAN BULAN</Label>
                        <Select value={selectedMonth} onValueChange={(v) => handleMonthYearChange(v ?? '1', selectedYear)}>
                          <SelectTrigger className="h-12 text-base rounded-xl bg-white dark:bg-slate-900"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {MONTH_OPTIONS.map((m: any) => (
                              <SelectItem key={m.value} value={m.value} className="text-sm">{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-655 dark:text-slate-400">PILIHAN TAHUN</Label>
                        <Select value={selectedYear} onValueChange={(v) => handleMonthYearChange(selectedMonth, v ?? '2026')}>
                          <SelectTrigger className="h-12 text-base rounded-xl bg-white dark:bg-slate-900"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {YEAR_OPTIONS.map((y: any) => (
                              <SelectItem key={y} value={y} className="text-sm">{y}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-655 dark:text-slate-400">METODE PEMBAYARAN</Label>
                        <Select value={payMethod} onValueChange={(v) => setPayMethod(v ?? 'all')}>
                          <SelectTrigger className="h-12 text-base rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['all','cash','qris','paylater','transfer','saving_deduct'].map((m: any) => (
                              <SelectItem key={m} value={m} className="text-sm">{PAYMENT_LABELS[m]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Button onClick={handleSearch} disabled={isPending} className="w-full h-12 text-base rounded-xl gap-2 bg-indigo-700 hover:bg-indigo-800 text-white font-semibold shadow-sm">
                          <Search className="h-4 w-4" />
                          {isPending ? 'Memuat...' : 'Tampilkan'}
                        </Button>
                      </div>
                    </div>

                    {hasSearched && data && (
                      <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                        <Button onClick={exportMultiTabExcel} variant="outline" size="sm" className="h-11 px-4 text-xs font-semibold rounded-xl gap-1.5 text-indigo-700 border-indigo-200 hover:bg-indigo-50">
                          <FileSpreadsheet className="h-4 w-4" /> Export Monitoring Stok (Excel Terpadu)
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Stok Local Search and Options */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-100 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-150 dark:border-slate-800">
                    <div className="flex items-center gap-2 flex-1 max-w-sm">
                      <Label className="text-xs shrink-0 font-semibold text-slate-655 dark:text-slate-400">Cari Produk:</Label>
                      <Input
                        placeholder="Nama atau SKU..."
                        value={stockSearch}
                        onChange={e => setStockSearch(e.target.value)}
                        className="h-11 text-base bg-white dark:bg-slate-900 rounded-xl"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="onlyActiveStock"
                        checked={onlyActiveStock}
                        onChange={e => setOnlyActiveStock(e.target.checked)}
                        className="h-5 w-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <Label htmlFor="onlyActiveStock" className="text-xs cursor-pointer select-none font-semibold text-slate-650 dark:text-slate-450">
                        Hanya tampilkan produk dengan pergerakan / stok aktif
                      </Label>
                    </div>
                  </div>

                  {!hasSearched ? (
                    <div className="py-16 text-center text-slate-400 text-sm border border-slate-100 rounded-2xl bg-white dark:bg-slate-900">
                      Silakan tentukan filter tanggal dan klik <strong className="text-indigo-700 dark:text-indigo-400">Tampilkan</strong> untuk memuat data monitoring stok produk.
                    </div>
                  ) : filteredStocks.length > 0 ? (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3 bg-indigo-800 text-white text-xs font-bold rounded-t-2xl">
                        <span>PERIODE: {startDate} S/D {endDate} (Semua Nilai dalam Rupiah / Rp)</span>
                        <span className="sm:ml-auto">TOTAL PRODUK TAMPIL: {filteredStocks.length}</span>
                      </div>
                      
                      {/* Desktop Table View */}
                      <div className="hidden md:block overflow-x-auto border border-t-0 rounded-b-2xl border-slate-200 dark:border-slate-800">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-indigo-800 text-white font-bold text-center">
                              <th className="px-2 py-2.5 border border-indigo-950 whitespace-nowrap" rowSpan={2}>NO</th>
                              <th className="px-2 py-2.5 border border-indigo-950 whitespace-nowrap font-mono" rowSpan={2}>KODE BRG</th>
                              <th className="px-2 py-2.5 border border-indigo-950 whitespace-nowrap text-left" rowSpan={2}>NAMA BARANG</th>
                              <th className="px-2 py-2.5 border border-indigo-950 whitespace-nowrap" rowSpan={2}>STOCK AWAL</th>
                              <th className="px-2 py-2.5 border border-indigo-950 whitespace-nowrap" rowSpan={2}>PEMBELIAN</th>
                              <th className="px-2 py-1 border border-indigo-950 whitespace-nowrap" colSpan={5}>PENJUALAN</th>
                              <th className="px-2 py-2.5 border border-indigo-950 whitespace-nowrap" rowSpan={2}>TOT PENJUALAN</th>
                              <th className="px-2 py-2.5 border border-indigo-950 whitespace-nowrap" rowSpan={2}>STOCK AKHIR</th>
                              <th className="px-2 py-2.5 border border-indigo-950 whitespace-nowrap font-bold text-teal-200" rowSpan={2}>PENYESUAIAN</th>
                              <th className="px-2 py-2.5 border border-indigo-950 whitespace-nowrap font-bold text-amber-200" rowSpan={2}>STOCK OPNAME</th>
                              <th className="px-2 py-2.5 border border-indigo-950 whitespace-nowrap" rowSpan={2}>RETUR</th>
                            </tr>
                            <tr className="bg-indigo-900 text-white text-[10px] font-bold">
                              <th className="px-1 py-1 border border-indigo-950">M1</th>
                              <th className="px-1 py-1 border border-indigo-950">M2</th>
                              <th className="px-1 py-1 border border-indigo-950">M3</th>
                              <th className="px-1 py-1 border border-indigo-950">M4</th>
                              <th className="px-1 py-1 border border-indigo-950">M5</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredStocks.map((item: any, idx: any) => (
                              <tr key={item.productId} className={idx % 2 === 0 ? 'bg-gray-50 dark:bg-slate-900/40' : 'bg-white dark:bg-slate-900 hover:bg-slate-100'}>
                                <td className="px-2 py-1.5 text-center border border-gray-200 dark:border-gray-800">{idx + 1}</td>
                                <td className="px-2 py-1.5 border border-gray-200 dark:border-gray-800 font-mono text-gray-600 dark:text-gray-400">{item.sku}</td>
                                <td className="px-2 py-1.5 border border-gray-200 dark:border-gray-800 font-medium whitespace-nowrap">{item.name}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 font-semibold">{formatRp(item.stockAwal)}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 text-green-700 dark:text-green-455 font-medium">{item.pembelian > 0 ? formatRp(item.pembelian) : '-'}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800">{item.m1 > 0 ? formatRp(item.m1) : '-'}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800">{item.m2 > 0 ? formatRp(item.m2) : '-'}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800">{item.m3 > 0 ? formatRp(item.m3) : '-'}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800">{item.m4 > 0 ? formatRp(item.m4) : '-'}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800">{item.m5 > 0 ? formatRp(item.m5) : '-'}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 font-medium text-blue-700 dark:text-blue-400">{item.totPenjualan > 0 ? formatRp(item.totPenjualan) : '-'}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 font-semibold text-slate-800 dark:text-slate-200">{formatRp(item.stockAkhir)}</td>
                                <td className={`px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 font-semibold ${item.penyesuaian < 0 ? 'text-red-650 dark:text-red-400' : item.penyesuaian > 0 ? 'text-green-700 dark:text-green-455 font-bold' : 'text-slate-400 dark:text-slate-500'}`}>{item.penyesuaian !== 0 ? (item.penyesuaian > 0 ? '+' : '') + formatRp(item.penyesuaian) : '-'}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 font-bold text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20">{item.stockOpname !== null ? formatRp(item.stockOpname) : '-'}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 text-red-650 dark:text-red-400">{item.qtyRetur > 0 ? formatRp(item.qtyRetur) : '-'}</td>
                              </tr>
                            ))}
                            <tr className="bg-indigo-800 text-white font-bold text-right">
                              <td colSpan={3} className="px-3 py-2.5 text-center border border-indigo-950">TOTAL</td>
                              <td className="px-2 py-2.5 border border-indigo-950">{formatRp(filteredStocks.reduce((s: any, r: any) =>s+r.stockAwal,0))}</td>
                              <td className="px-2 py-2.5 border border-indigo-950">{formatRp(filteredStocks.reduce((s: any, r: any) =>s+r.pembelian,0))}</td>
                              <td className="px-2 py-2.5 border border-indigo-950">{formatRp(filteredStocks.reduce((s: any, r: any) =>s+r.m1,0))}</td>
                              <td className="px-2 py-2.5 border border-indigo-950">{formatRp(filteredStocks.reduce((s: any, r: any) =>s+r.m2,0))}</td>
                              <td className="px-2 py-2.5 border border-indigo-950">{formatRp(filteredStocks.reduce((s: any, r: any) =>s+r.m3,0))}</td>
                              <td className="px-2 py-2.5 border border-indigo-950">{formatRp(filteredStocks.reduce((s: any, r: any) =>s+r.m4,0))}</td>
                              <td className="px-2 py-2.5 border border-indigo-950">{formatRp(filteredStocks.reduce((s: any, r: any) =>s+r.m5,0))}</td>
                              <td className="px-2 py-2.5 border border-indigo-950">{formatRp(filteredStocks.reduce((s: any, r: any) =>s+r.totPenjualan,0))}</td>
                              <td className="px-2 py-2.5 border border-indigo-950">{formatRp(filteredStocks.reduce((s: any, r: any) =>s+r.stockAkhir,0))}</td>
                              <td className="px-2 py-2.5 border border-indigo-950">{formatRp(filteredStocks.reduce((s: any, r: any) =>s+r.penyesuaian,0))}</td>
                              <td className="px-2 py-2.5 border border-indigo-950">{formatRp(filteredStocks.reduce((s: any, r: any) =>s+(r.stockOpname||0),0))}</td>
                              <td className="px-2 py-2.5 border border-indigo-950">{formatRp(filteredStocks.reduce((s: any, r: any) =>s+r.qtyRetur,0))}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Card Feed View */}
                      <div className="block md:hidden space-y-3 mt-2">
                        {/* Summary Sticky Card */}
                        <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl space-y-3 shadow-md">
                          <p className="text-xs font-bold text-slate-400 uppercase">AKUMULASI ALUR KEUANGAN STOK</p>
                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="bg-slate-800/80 p-2 rounded-xl">
                              <p className="text-[10px] text-slate-400">Stok Awal</p>
                              <p className="font-bold text-slate-100">{formatRp(filteredStocks.reduce((s: any, r: any) =>s+r.stockAwal,0))}</p>
                            </div>
                            <div className="bg-slate-800/80 p-2 rounded-xl">
                              <p className="text-[10px] text-slate-400">Pembelian</p>
                              <p className="font-bold text-green-400">+{formatRp(filteredStocks.reduce((s: any, r: any) =>s+r.pembelian,0))}</p>
                            </div>
                            <div className="bg-slate-800/80 p-2 rounded-xl">
                              <p className="text-[10px] text-slate-400">Penjualan</p>
                              <p className="font-bold text-blue-400 font-bold">-{formatRp(filteredStocks.reduce((s: any, r: any) =>s+r.totPenjualan,0))}</p>
                            </div>
                          </div>
                        </div>

                        {filteredStocks.map((item: any, idx: any) => (
                          <div key={item.productId} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-3">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-base text-slate-900 dark:text-slate-100 truncate">{item.name}</p>
                                <p className="text-xs text-slate-400 mt-0.5 truncate">SKU: {item.sku}</p>
                              </div>
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500">#{idx + 1}</span>
                            </div>

                            <div className="grid grid-cols-4 gap-2 text-center text-xs">
                              <div className="bg-slate-50 dark:bg-slate-850 p-2 rounded-lg">
                                <span className="text-[9px] text-slate-400 block">Stok Awal</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">{formatRp(item.stockAwal)}</span>
                              </div>
                              <div className="bg-slate-50 dark:bg-slate-850 p-2 rounded-lg">
                                <span className="text-[9px] text-slate-455 block">Beli (+)</span>
                                <span className="font-bold text-green-600">+{formatRp(item.pembelian)}</span>
                              </div>
                              <div className="bg-slate-50 dark:bg-slate-850 p-2 rounded-lg">
                                <span className="text-[9px] text-slate-455 block">Jual (-)</span>
                                <span className="font-bold text-blue-600">-{formatRp(item.totPenjualan)}</span>
                              </div>
                              <div className="bg-slate-50 dark:bg-slate-850 p-2 rounded-lg">
                                <span className="text-[9px] text-slate-455 block">Stok Akhir</span>
                                <span className="font-extrabold text-slate-900 dark:text-white">{formatRp(item.stockAkhir)}</span>
                              </div>
                            </div>

                            {/* Detail Penjualan Mingguan (M1 - M5) */}
                            <div className="bg-slate-50/50 dark:bg-slate-850/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/40">
                              <p className="text-[9px] text-slate-405 font-bold mb-1.5 uppercase tracking-wider">Penjualan Mingguan</p>
                              <div className="grid grid-cols-5 gap-1 text-center text-[10px]">
                                {['M1','M2','M3','M4','M5'].map((m: any, i: any) => {
                                  const val = i === 0 ? item.m1 : i === 1 ? item.m2 : i === 2 ? item.m3 : i === 3 ? item.m4 : item.m5
                                  return (
                                    <div key={m}>
                                      <p className="text-[9px] text-slate-400">{m}</p>
                                      <p className={`font-semibold ${val > 0 ? 'text-slate-800 dark:text-slate-200 font-bold' : 'text-slate-300 dark:text-slate-700'}`}>{val > 0 ? val : '-'}</p>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>

                            <div className="flex justify-between items-center text-xs border-t border-slate-50 dark:border-slate-800/30 pt-2.5">
                              <div>
                                <span className="text-[10px] text-slate-400">Opname: </span>
                                <span className="font-bold text-amber-600">{item.stockOpname !== null ? formatRp(item.stockOpname) : '-'}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400">Adj: </span>
                                <span className={`font-bold ${item.penyesuaian < 0 ? 'text-red-600' : item.penyesuaian > 0 ? 'text-green-600' : 'text-slate-400'}`}>{item.penyesuaian !== 0 ? (item.penyesuaian > 0 ? '+' : '') + formatRp(item.penyesuaian) : '-'}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400">Retur: </span>
                                <span className="font-bold text-red-600">{item.qtyRetur > 0 ? formatRp(item.qtyRetur) : '-'}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="py-16 text-center text-slate-400 text-sm border border-slate-100 rounded-2xl bg-white dark:bg-slate-900">
                      Tidak ada data monitoring stok produk untuk kriteria pencarian ini.
                    </div>
                  )}
                </div>
              )}
            </Card>

            {hasSearched && data && (
              <>
                {/* ── SLOW MOVING ─────────────────────────────── */}

          {data.slowMoving.length > 0 && (
            <Card className="border-orange-200 dark:border-orange-950/40 rounded-2xl overflow-hidden shadow-sm">
              <CardHeader className="pb-3 bg-orange-50/50 dark:bg-orange-950/10">
                <CardTitle className="text-base flex items-center gap-2 text-orange-800 dark:text-orange-400 font-bold">
                  <AlertTriangle className="h-4.5 w-4.5 text-orange-600 dark:text-orange-400 animate-pulse" />
                  Barang Slow Moving (belum terjual pada periode ini)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* Desktop View */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50 dark:bg-slate-900/50">
                        <TableHead className="font-bold">Produk</TableHead>
                        <TableHead className="font-bold">Kategori</TableHead>
                        <TableHead className="text-right font-bold">Stok</TableHead>
                        <TableHead className="text-right font-bold">HPP/Unit</TableHead>
                        <TableHead className="text-right font-bold">Nilai Stok Tertahan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.slowMoving.map((p: any) => (
                        <TableRow key={p.id} className="hover:bg-slate-50/85">
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{p.category}</TableCell>
                          <TableCell className="text-right font-bold">{p.stock}</TableCell>
                          <TableCell className="text-right">{formatRp(p.purchase_price)}</TableCell>
                          <TableCell className="text-right font-semibold text-orange-700 dark:text-orange-400">{formatRp(p.stock_value)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile View */}
                <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800 p-4 space-y-3">
                  {data.slowMoving.map((p: any, idx: any) => (
                    <div key={p.id} className="pt-3 first:pt-0 space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">{p.name}</p>
                          <p className="text-[11px] text-slate-450 truncate">{p.category}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-950/50 text-[10px] font-bold text-orange-700 dark:text-orange-400">#{(idx + 1)}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-slate-50 dark:bg-slate-850 p-2 rounded-xl">
                          <span className="text-[9px] text-slate-400 block">Stok</span>
                          <span className="font-bold text-slate-700 dark:text-slate-350">{p.stock}</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-850 p-2 rounded-xl">
                          <span className="text-[9px] text-slate-400 block">HPP/Unit</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-350">{formatRp(p.purchase_price)}</span>
                        </div>
                        <div className="bg-orange-50 dark:bg-orange-950/20 p-2 rounded-xl border border-orange-100/50 dark:border-orange-900/30">
                          <span className="text-[9px] text-orange-700 dark:text-orange-400 block font-semibold">Stok Tertahan</span>
                          <span className="font-bold text-orange-700 dark:text-orange-400">{formatRp(p.stock_value)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {data.topProducts.length === 0 && (
            <Card className="rounded-2xl border-slate-100 dark:border-slate-800"><CardContent className="py-12 text-center text-slate-400 text-sm font-medium">Tidak ada data penjualan pada periode dan filter yang dipilih.</CardContent></Card>
          )}
        </>
      )}
    </div>
  )
}
