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

const formatRp = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Tunai', paylater: 'Paylater', qris: 'QRIS',
  saving_deduct: 'Potong Simpanan', transfer: 'Transfer', all: 'Semua',
}

const PRESETS = [
  { label: 'Hari Ini',   days: 0 },
  { label: '7 Hari',     days: 7 },
  { label: '30 Hari',    days: 30 },
  { label: 'Bulan Ini',  days: -1 },
  { label: 'Tahun Ini',  days: -2 },
]

function getPresetDates(days: number): { start: string; end: string } {
  const today = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  if (days === 0) return { start: fmt(today), end: fmt(today) }
  if (days === -1) {
    return { start: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), end: fmt(today) }
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

export function LaporanAnalitikClient() {
  const now = new Date()
  const [startDate, setStartDate]     = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0])
  const [endDate, setEndDate]         = useState(now.toISOString().split('T')[0])
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

    membersList.forEach(m => {
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

    detailRows.forEach(r => {
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
      list = list.filter(item => item.crdJual > 0 || item.casJual > 0)
    }

    if (sembakoSearch.trim() !== '') {
      const q = sembakoSearch.toLowerCase()
      list = list.filter(item => 
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
      list = list.filter(item => item.total_deduction > 0)
    }

    if (potonganSearch.trim() !== '') {
      const q = potonganSearch.toLowerCase()
      list = list.filter(item => 
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
      list = list.filter(item => 
        item.stockAwal > 0 || 
        item.pembelian > 0 || 
        item.totPenjualan > 0 || 
        item.stockAkhir > 0 || 
        item.qtyRetur > 0 || 
        (item.stockOpname !== null && item.stockOpname > 0)
      )
    }

    if (stockSearch.trim() !== '') {
      const q = stockSearch.toLowerCase()
      list = list.filter(item => 
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

      // ── Sheet 1: Ringkasan ──────────────────────────
      const ws1 = wb.addWorksheet('Ringkasan P&L')
      ws1.addRow(['Laporan Analitik & Keuntungan Toko'])
      ws1.addRow([`Periode: ${startDate} s/d ${endDate}`])
      ws1.addRow([`Metode: ${PAYMENT_LABELS[payMethod] ?? payMethod} | Dicetak: ${new Date().toLocaleString('id-ID')}`])
      ws1.addRow([])
      ws1.getCell('A1').font = { size: 14, bold: true }

      const h1 = ws1.addRow(['Indikator', 'Nilai'])
      h1.eachCell(c => { c.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FF1F4E78'} }; c.font = { color:{argb:'FFFFFFFF'}, bold:true }; c.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} } })
      const rows1 = [
        ['Omzet (Penjualan)', data.summary.omzet],
        ['Modal Pembelian (HPP)', data.summary.cogs],
        ['Laba Kotor', data.summary.gross_profit],
        ['Margin Kotor (%)', `${data.summary.margin_pct}%`],
        ['Jumlah Transaksi', data.summary.transaction_count],
        ['Rata-rata Transaksi', data.summary.avg_transaction],
      ]
      rows1.forEach(([k, v], i) => {
        const r = ws1.addRow([k, v])
        if (typeof v === 'number' && i !== 3 && i !== 4) r.getCell(2).numFmt = '"Rp"#,##0'
        r.eachCell(c => { c.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} } })
      })
      ws1.getColumn(1).width = 30; ws1.getColumn(2).width = 22

      // ── Sheet 2: Per Produk ─────────────────────────
      const ws2 = wb.addWorksheet('Keuntungan per Produk')
      ws2.addRow(['Laporan Keuntungan per Produk'])
      ws2.addRow([`Periode: ${startDate} s/d ${endDate}`])
      ws2.addRow([])
      ws2.getCell('A1').font = { size: 13, bold: true }

      const h2 = ws2.addRow(['#','Produk','Qty Terjual','Omzet','Modal (HPP)','Laba Kotor','Margin %'])
      h2.eachCell(c => { c.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FF1F4E78'} }; c.font = { color:{argb:'FFFFFFFF'}, bold:true }; c.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} } })
      ;[1,2,3,4,5,6,7].forEach(i => { ws2.getColumn(i).width = [5,35,12,18,18,18,12][i-1] })

      data.topProducts.forEach((p, idx) => {
        const r = ws2.addRow([idx+1, p.product_name, p.total_qty, p.total_revenue, p.total_cogs, p.gross_profit, `${p.margin_pct}%`])
        ;[4,5,6].forEach(i => r.getCell(i).numFmt = '"Rp"#,##0')
        if (p.gross_profit < 0) r.getCell(6).font = { color:{argb:'FFDC2626'}, bold:true }
        r.eachCell(c => { c.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} } })
      })

      // ── Sheet 3: Per Metode Bayar ───────────────────
      const ws3 = wb.addWorksheet('Per Metode Bayar')
      const h3 = ws3.addRow(['Metode Pembayaran','Jumlah Transaksi','Total Omzet'])
      h3.eachCell(c => { c.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FF1F4E78'} }; c.font = { color:{argb:'FFFFFFFF'}, bold:true }; c.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} } })
      ws3.getColumn(1).width = 25; ws3.getColumn(2).width = 20; ws3.getColumn(3).width = 22
      data.byPaymentMethod.forEach(m => {
        const r = ws3.addRow([PAYMENT_LABELS[m.method]??m.method, m.count, m.total])
        r.getCell(3).numFmt = '"Rp"#,##0'
        r.eachCell(c => { c.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} } })
      })

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
      const doc = new jsPDF({ orientation: 'landscape' })
      doc.setFontSize(16); doc.setFont('helvetica','bold')
      doc.text('Laporan Analitik & Keuntungan Toko', 14, 16)
      doc.setFontSize(10); doc.setFont('helvetica','normal')
      doc.text(`Periode: ${startDate} s/d ${endDate} | Metode: ${PAYMENT_LABELS[payMethod]??payMethod}`, 14, 23)
      doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, 14, 29)

      // Summary table
      autoTable(doc, {
        startY: 34,
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
      doc.setFont('helvetica','bold'); doc.setFontSize(12)
      doc.text('Keuntungan per Produk', 14, y)
      autoTable(doc, {
        startY: y + 4,
        head: [['#','Produk','Qty','Omzet','Modal','Laba Kotor','Margin']],
        body: data.topProducts.map((p,i) => [
          i+1, p.product_name, p.total_qty,
          formatRp(p.total_revenue), formatRp(p.total_cogs), formatRp(p.gross_profit), `${p.margin_pct}%`
        ]),
        headStyles: { fillColor: [31,78,120] },
        columnStyles: { 3:{halign:'right'}, 4:{halign:'right'}, 5:{halign:'right'}, 6:{halign:'center'} },
        margin: { left: 14 },
      })
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
      colWidthsDetail.forEach((w, i) => { wsDetail.getColumn(i + 1).width = w })

      wsDetail.mergeCells('A1:C1')
      const r1 = wsDetail.getCell('A1')
      r1.value = 'PT SULFINDO ADIUSAHA'; r1.font = { bold: true, size: 12 }

      wsDetail.mergeCells('A2:C2')
      wsDetail.getCell('A2').value = 'DATA TRANSAKSI KASIR'
      wsDetail.getCell('A2').font = { bold: true }

      const startD  = new Date(startDate)
      const bulanNm = startD.toLocaleDateString('id-ID', { month: 'long' }).toUpperCase()
      const tahun   = startD.getFullYear()

      wsDetail.getCell('B3').value = 'BULAN';   wsDetail.getCell('B3').font = { bold: true }
      wsDetail.getCell('D3').value = bulanNm;   wsDetail.getCell('D3').font = { bold: true }
      wsDetail.getCell('F3').value = tahun;     wsDetail.getCell('F3').font = { bold: true }

      const totalQty   = rows.reduce((s, r) => s + r.qty, 0)
      const totalJual  = rows.reduce((s, r) => s + r.tot_harga_jual, 0)
      const totalHJual = rows.reduce((s, r) => s + r.tot_harga_jual, 0)
      const totalHPP   = rows.reduce((s, r) => s + r.harga_pokok, 0)
      const totalTHPP  = rows.reduce((s, r) => s + r.tot_harga_pokok, 0)
      const totalLaba  = rows.reduce((s, r) => s + r.laba, 0)

      const BLUE = 'FF1F4E78'; const WHITE = 'FFFFFFFF'
      ;[{ col: 'G', v: 'TOTAL' }, { col: 'H', v: totalQty }, { col: 'I', v: totalJual },
        { col: 'J', v: totalHJual }, { col: 'K', v: totalHPP }, { col: 'L', v: totalTHPP }, { col: 'M', v: totalLaba }
      ].forEach(({ col, v }) => {
        const c = wsDetail.getCell(`${col}3`)
        c.value = v; c.font = { bold: true, color: { argb: WHITE } }
        c.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        c.alignment = { horizontal: 'center' }
        c.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} }
        if (typeof v === 'number' && col !== 'H') c.numFmt = '#,##0'
      })

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

      rows.forEach((r, idx) => {
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

      const totRow = wsDetail.addRow(['', 'TOTAL', '', '', '', '', '',
        totalQty, totalJual, totalHJual, totalHPP, totalTHPP, totalLaba])
      totRow.eachCell((c, cn) => {
        c.font   = { bold: true, color: { argb: WHITE } }
        c.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        c.border = { top:{style:'medium'}, left:{style:'thin'}, bottom:{style:'medium'}, right:{style:'thin'} }
        if (cn >= 8) c.numFmt = '#,##0'
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
        ;[5,12,16,18,18,18].forEach((w,i) => wsWeek.getColumn(i+2).width = w)

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
          ;['No','Week','Tanggal','Harga Pokok','Harga Jual','Laba'].forEach((h,i) => {
            const c = hRow.getCell(i+2)
            c.value = h; c.font = { bold:true }; Object.assign(c, center, border1)
            c.fill  = { type:'pattern', pattern:'solid', fgColor:{argb:'FFD9E1F2'} }
          })
          let rowIdx = startRow + 2
          let totHPP = 0, totJual = 0
          dates.forEach((d, idx) => {
            const entry  = dayMap.get(d)!
            const hpp    = isCash ? entry.hppCash  : entry.hppKredit
            const jual   = isCash ? entry.jualCash : entry.jualKredit
            const laba   = jual - hpp
            totHPP += hpp; totJual += jual
            const dt      = parseTanggal(d)
            const r       = wsWeek.getRow(rowIdx++)
            ;[idx+1, DAY_ID_LOCAL[dt.getDay()], d, hpp > 0 ? hpp : '-', jual > 0 ? jual : '-', laba !== 0 ? laba : '-'].forEach((v,i) => {
              const c = r.getCell(i+2); c.value = v; Object.assign(c, border1)
              if (i >= 3 && typeof v === 'number') { c.numFmt = '#,##0'; Object.assign(c, right) }
              else Object.assign(c, center)
            })
          })
          const tot = wsWeek.getRow(rowIdx)
          tot.getCell(3).value = 'JUMLAH'; tot.getCell(3).font = { bold:true }
          ;[2,3,4].forEach(i => Object.assign(tot.getCell(i), border1))
          ;[totHPP, totJual, totJual-totHPP].forEach((v,i) => {
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

      ;[5, 16, 32, 6, 8, 18, 18, 18, 18, 18].forEach((w, i) => {
        wsSembako.getColumn(i + 1).width = w
      })

      wsSembako.getCell('A1').value = 'PT. SULFINDO ADIUSAHA'
      wsSembako.getCell('A1').font = { bold: true, size: 12 }
      wsSembako.getCell('A2').value = 'REKAP TRANSAKSI PENJUALAN SEMBAKO (PAYLATER VS CASH)'
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

      allMembers.forEach(m => {
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

      wsSembako.addRow([])
      const shRow = wsSembako.addRow(sembakoHeaders)
      wsSembako.getRow(5).height = 36

      shRow.eachCell((c) => {
        c.font = { bold: true, color: { argb: WHITE }, size: 9 }
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
      })

      let totalCrdJual = 0
      let totalCasJual = 0
      let totalCrdPokok = 0
      let totalCasPokok = 0
      let totalCrdLaba = 0

      sembakoList.forEach((item, index) => {
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

        totalCrdJual += item.crdJual
        totalCasJual += item.casJual
        totalCrdPokok += item.crdPokok
        totalCasPokok += item.casPokok
        totalCrdLaba += item.crdLaba

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
        '', 'TOTAL', '', '', '',
        totalCrdJual, totalCasJual, totalCrdPokok, totalCasPokok, totalCrdLaba
      ])
      
      sembakoTotRow.eachCell((c, colNum) => {
        c.font = { bold: true, color: { argb: WHITE } }
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        c.border = { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } }
        
        if (colNum === 2) {
          c.alignment = { horizontal: 'left', vertical: 'middle' }
        } else if (colNum >= 6) {
          c.alignment = { horizontal: 'right', vertical: 'middle' }
          c.numFmt = '#,##0'
        }
      })

      // ───────────────────────────────────────────────────────────
      // TAB 4: POTONGAN GAJI
      // ───────────────────────────────────────────────────────────
      const wsPotongan = wb.addWorksheet('Potongan Gaji')
      wsPotongan.views = [{ state: 'frozen', xSplit: 0, ySplit: 5 }]

      const colWidthsPotongan = [5, 16, 32, 6, 8, 14, 14, 14, 14, 12, 12, 14, 12, 14, 12, 14, 16]
      colWidthsPotongan.forEach((w, i) => {
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

      wsPotongan.addRow([])
      const phRow = wsPotongan.addRow(potonganHeaders)
      wsPotongan.getRow(5).height = 36

      phRow.eachCell((c) => {
        c.font = { bold: true, color: { argb: WHITE }, size: 9 }
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
      })

      let tSimpPokok = 0, tSimpWajib = 0, tSimpSukarela = 0
      let tPUang = 0, tAdmPU = 0, tBTrsf = 0
      let tPKhusus = 0, tAdmPKhs = 0
      let tPBarang = 0, tAdmPBrg = 0
      let tKreditSbk = 0, tTotal = 0

      deductions.forEach((item, index) => {
        const com2Val = (item.department || 'SAU').replace(/^U-/, '')
        const simpPokok = item.details.filter(d => d.reference === 'SP').reduce((sum, d) => sum + d.amount, 0)
        const simpWajib = item.details.filter(d => d.reference === 'SW' || (d.category === 'simpanan_wajib' && d.reference !== 'SP')).reduce((sum, d) => sum + d.amount, 0)
        const simpSukarela = item.total_simpanan_salary_cut
        const pUang = item.total_pinjaman_uang
        const admPU = 0
        const bTrsf = 0
        const pKhusus = item.total_pinjaman_kilat
        const admPKhs = 0
        const pBarang = item.total_pinjaman_barang
        const admPBrg = 0
        const kreditSbk = item.total_paylater
        const total = simpPokok + simpWajib + simpSukarela + pUang + admPU + bTrsf + pKhusus + admPKhs + pBarang + admPBrg + kreditSbk

        tSimpPokok += simpPokok
        tSimpWajib += simpWajib
        tSimpSukarela += simpSukarela
        tPUang += pUang
        tPKhusus += pKhusus
        tPBarang += pBarang
        tKreditSbk += kreditSbk
        tTotal += total

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
        '', 'TOTAL', '', '', '',
        tSimpPokok, tSimpWajib, tSimpSukarela,
        tPUang, tAdmPU, tBTrsf, tPKhusus, tAdmPKhs,
        tPBarang, tAdmPBrg, tKreditSbk, tTotal
      ])
      
      potonganTotRow.eachCell((c, colNum) => {
        c.font = { bold: true, color: { argb: WHITE } }
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        c.border = { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } }
        
        if (colNum === 2) {
          c.alignment = { horizontal: 'left', vertical: 'middle' }
        } else if (colNum >= 6) {
          c.alignment = { horizontal: 'right', vertical: 'middle' }
          c.numFmt = '#,##0'
        }
      })

      // ───────────────────────────────────────────────────────────
      // TAB 5: MONITORING STOCKS (STOCK OPNAME)
      // ───────────────────────────────────────────────────────────
      const wsStock = wb.addWorksheet('Monitoring Stocks')
      wsStock.views = [{ state: 'frozen', xSplit: 0, ySplit: 5 }]

      const colWidthsStock = [5, 14, 32, 14, 14, 12, 12, 12, 12, 12, 14, 14, 14, 14]
      colWidthsStock.forEach((w, i) => {
        wsStock.getColumn(i + 1).width = w
      })

      wsStock.getCell('A1').value = 'PT. SULFINDO ADIUSAHA'
      wsStock.getCell('A1').font = { bold: true, size: 12 }
      wsStock.getCell('A2').value = 'MONITORING STOCKS (STOCK OPNAME)'
      wsStock.getCell('A2').font = { bold: true, size: 13 }
      wsStock.getCell('A3').value = `PERIODE: ${startDate} S/D ${endDate}`
      wsStock.getCell('A3').font = { bold: true }

      const stockHeaders = [
        'NO', 'KODE BRG', 'NAMA BARANG', 'STOCK AWAL', 'PEMBELIAN',
        'PENJUALAN M1', 'PENJUALAN M2', 'PENJUALAN M3', 'PENJUALAN M4', 'PENJUALAN M5',
        'TOT PENJUALAN', 'STOCK AKHIR', 'STOCK OPNAME', 'QTY RETUR'
      ]

      wsStock.addRow([])
      const shRowStock = wsStock.addRow(stockHeaders)
      wsStock.getRow(5).height = 36

      shRowStock.eachCell((c) => {
        c.font = { bold: true, color: { argb: WHITE }, size: 9 }
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
      })

      let tStockAwal = 0, tPembelian = 0
      let tM1 = 0, tM2 = 0, tM3 = 0, tM4 = 0, tM5 = 0
      let tTotPenjualan = 0, tStockAkhir = 0
      let tStockOpname = 0, tQtyRetur = 0

      stocks.forEach((item, index) => {
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
              c.numFmt = '#,##0'
            }
          }
        })
      })

      const stockTotRow = wsStock.addRow([
        '', 'TOTAL', '',
        tStockAwal, tPembelian,
        tM1, tM2, tM3, tM4, tM5,
        tTotPenjualan, tStockAkhir,
        tStockOpname || '-', tQtyRetur
      ])
      
      stockTotRow.eachCell((c, colNum) => {
        c.font = { bold: true, color: { argb: WHITE } }
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        c.border = { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } }
        
        if (colNum === 2) {
          c.alignment = { horizontal: 'left', vertical: 'middle' }
        } else if (colNum >= 4) {
          c.alignment = { horizontal: 'right', vertical: 'middle' }
          if (c.value !== '-') c.numFmt = '#,##0'
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
      colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w })

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

      ws.getCell('B3').value = 'BULAN';   ws.getCell('B3').font = { bold: true }
      ws.getCell('D3').value = bulanNm;   ws.getCell('D3').font = { bold: true }
      ws.getCell('F3').value = tahun;     ws.getCell('F3').font = { bold: true }

      // TOTAL values (right side of row 3)
      const totalQty   = rows.reduce((s, r) => s + r.qty, 0)
      const totalJual  = rows.reduce((s, r) => s + r.tot_harga_jual, 0)
      const totalHJual = rows.reduce((s, r) => s + r.tot_harga_jual, 0)
      const totalHPP   = rows.reduce((s, r) => s + r.harga_pokok, 0)
      const totalTHPP  = rows.reduce((s, r) => s + r.tot_harga_pokok, 0)
      const totalLaba  = rows.reduce((s, r) => s + r.laba, 0)

      const BLUE = 'FF1F4E78'; const WHITE = 'FFFFFFFF'; const YELLOW = 'FFFFFF00'
      ;[{ col: 'G', v: 'TOTAL' }, { col: 'H', v: totalQty }, { col: 'I', v: totalJual },
        { col: 'J', v: totalHJual }, { col: 'K', v: totalHPP }, { col: 'L', v: totalTHPP }, { col: 'M', v: totalLaba }
      ].forEach(({ col, v }) => {
        const c = ws.getCell(`${col}3`)
        c.value = v; c.font = { bold: true, color: { argb: WHITE } }
        c.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        c.alignment = { horizontal: 'center' }
        c.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} }
        if (typeof v === 'number' && col !== 'H') c.numFmt = '#,##0'
      })

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
      rows.forEach((r, idx) => {
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
      const totRow = ws.addRow(['', 'TOTAL', '', '', '', '', '',
        totalQty, totalJual, totalHJual, totalHPP, totalTHPP, totalLaba])
      totRow.eachCell((c, cn) => {
        c.font   = { bold: true, color: { argb: WHITE } }
        c.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        c.border = { top:{style:'medium'}, left:{style:'thin'}, bottom:{style:'medium'}, right:{style:'thin'} }
        if (cn >= 9) c.numFmt = '#,##0'
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
        dayMap = new Map(mingguData.rows.map(r => [r.tanggal, {
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
        ;[5,12,16,18,18,18].forEach((w,i) => ws.getColumn(i+2).width = w)

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
          ;['No','Week','Tanggal','Harga Pokok','Harga Jual','Laba'].forEach((h,i) => {
            const c = hRow.getCell(i+2)
            c.value = h; c.font = { bold:true }; Object.assign(c, center, border1)
            c.fill  = { type:'pattern', pattern:'solid', fgColor:{argb:'FFD9E1F2'} }
          })
          let rowIdx = startRow + 2
          let totHPP = 0, totJual = 0
          dates.forEach((d, idx) => {
            const entry  = dayMap.get(d)!
            const hpp    = isCash ? entry.hppCash  : entry.hppKredit
            const jual   = isCash ? entry.jualCash : entry.jualKredit
            const laba   = jual - hpp
            totHPP += hpp; totJual += jual
            const dt      = parseTanggal(d)
            const r       = ws.getRow(rowIdx++)
            ;[idx+1, DAY_ID_LOCAL[dt.getDay()], d, hpp > 0 ? hpp : '-', jual > 0 ? jual : '-', laba !== 0 ? laba : '-'].forEach((v,i) => {
              const c = r.getCell(i+2); c.value = v; Object.assign(c, border1)
              if (i >= 3 && typeof v === 'number') { c.numFmt = '#,##0'; Object.assign(c, right) }
              else Object.assign(c, center)
            })
          })
          // JUMLAH row
          const tot = ws.getRow(rowIdx)
          tot.getCell(3).value = 'JUMLAH'; tot.getCell(3).font = { bold:true }
          ;[2,3,4].forEach(i => Object.assign(tot.getCell(i), border1))
          ;[totHPP, totJual, totJual-totHPP].forEach((v,i) => {
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
      {/* ── FILTER PANEL ─────────────────────────────── */}
      <Card>
        <CardHeader><CardTitle>Filter Laporan</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Preset buttons */}
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <Button key={p.label} size="sm" variant="outline" onClick={() => applyPreset(p.days)}
                className="h-8 text-xs">{p.label}</Button>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Tgl Mulai</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tgl Akhir</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Metode Pembayaran</Label>
              <Select value={payMethod} onValueChange={(v) => setPayMethod(v ?? 'all')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['all','cash','qris','paylater','transfer','saving_deduct'].map(m => (
                    <SelectItem key={m} value={m}>{PAYMENT_LABELS[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleSearch} disabled={isPending} className="w-full gap-2">
                <Search className="h-4 w-4" />
                {isPending ? 'Memuat...' : 'Tampilkan'}
              </Button>
            </div>
          </div>
          {hasSearched && data && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={exportExcel} variant="outline" size="sm" className="gap-2 text-green-700 border-green-200 hover:bg-green-50">
                <FileSpreadsheet className="h-4 w-4" /> Export Excel (Ringkasan)
              </Button>
              <Button onClick={exportPDF} variant="outline" size="sm" className="gap-2 text-red-700 border-red-200 hover:bg-red-50">
                <FileText className="h-4 w-4" /> Export PDF
              </Button>
              <Button onClick={exportKasirExcel} variant="outline" size="sm" className="gap-2 text-blue-700 border-blue-200 hover:bg-blue-50">
                <FileSpreadsheet className="h-4 w-4" /> Export Transaksi Kasir (Detail)
              </Button>
              <Button onClick={() => exportMingguanExcel('mingguan')} variant="outline" size="sm" className="gap-2 text-purple-700 border-purple-200 hover:bg-purple-50">
                <FileSpreadsheet className="h-4 w-4" /> Export Laporan Mingguan
              </Button>
              <Button onClick={exportMultiTabExcel} variant="outline" size="sm" className="gap-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50 font-semibold shadow-sm">
                <FileSpreadsheet className="h-4 w-4" /> Export Terpadu (Multi-Tab)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>


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
                {data.byPaymentMethod.map(m => {
                  const totalAll = data.byPaymentMethod.reduce((s,x) => s+x.total, 0)
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

          {/* ── TABBED SECTION: Data Transaksi + Laporan Mingguan ── */}
          {(detailRows.length > 0 || true) && (
            <Card>
              {/* Tab header */}
              <div className="flex border-b">
                <button
                  onClick={() => setActiveTab('kasir')}
                  className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === 'kasir'
                      ? 'border-blue-600 text-blue-700 bg-white'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-slate-50'
                  }`}
                >
                  📋 Data Transaksi Kasir
                  {detailRows.length > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-700 font-bold">
                      {detailRows.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('mingguan')}
                  className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === 'mingguan'
                      ? 'border-purple-600 text-purple-700 bg-white'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-slate-50'
                  }`}
                >
                  📅 Laporan Mingguan
                  {mingguData && (
                    <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] bg-purple-100 text-purple-700 font-bold">
                      ✓
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('sembako')}
                  className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === 'sembako'
                      ? 'border-emerald-600 text-emerald-700 bg-white'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-slate-50'
                  }`}
                >
                  🌾 Rekap Sembako Anggota
                  {sembakoRows.length > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-700 font-bold">
                      {sembakoRows.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('potongan')}
                  className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === 'potongan'
                      ? 'border-red-600 text-red-700 bg-white'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-slate-50'
                  }`}
                >
                  ✂️ Potongan Gaji
                  {filteredDeductions.length > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] bg-red-100 text-red-700 font-bold">
                      {filteredDeductions.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('stok')}
                  className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === 'stok'
                      ? 'border-indigo-600 text-indigo-700 bg-white'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-slate-50'
                  }`}
                >
                  📦 Monitoring Stocks
                  {filteredStocks.length > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-100 text-indigo-700 font-bold">
                      {filteredStocks.length}
                    </span>
                  )}
                </button>
              </div>

              {/* ── TAB: Data Transaksi Kasir ─────────────────── */}
              {activeTab === 'kasir' && (
                <div>
                  {detailRows.length > 0 ? (
                    <>
                      <div className="flex items-center gap-6 px-4 py-2 bg-[#1F4E78] text-white text-xs font-bold">
                        <span>BULAN: {new Date(startDate).toLocaleDateString('id-ID',{month:'long',year:'numeric'}).toUpperCase()}</span>
                        <span className="ml-auto flex gap-6">
                          <span>TOTAL QTY: {detailRows.reduce((s,r)=>s+r.qty,0)}</span>
                          <span>TOTAL JUAL: {formatRp(detailRows.reduce((s,r)=>s+r.tot_harga_jual,0))}</span>
                          <span>TOTAL HPP: {formatRp(detailRows.reduce((s,r)=>s+r.tot_harga_pokok,0))}</span>
                          <span>TOTAL LABA: {formatRp(detailRows.reduce((s,r)=>s+r.laba,0))}</span>
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-[#1F4E78] text-white">
                              {['NO','TANGGAL','MINGGU','BAYAR','NIK','NAMA ANGGOTA','NAMA BARANG',
                                'QTY','HARGA JUAL','TOT HARGA JUAL','HARGA POKOK','TOT HARGA POKOK','LABA'
                              ].map(h => (
                                <th key={h} className="px-2 py-2 text-center font-bold border border-[#163d5e] whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {detailRows.map((r, idx) => (
                              <tr key={r.no} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                <td className="px-2 py-1 text-center border border-gray-200">{r.no}</td>
                                <td className="px-2 py-1 text-center border border-gray-200 whitespace-nowrap">{r.tanggal}</td>
                                <td className="px-2 py-1 text-center border border-gray-200">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">{r.minggu}</span>
                                </td>
                                <td className="px-2 py-1 text-center border border-gray-200">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    r.bayar==='CAS' ? 'bg-green-100 text-green-700' :
                                    r.bayar==='PAY' ? 'bg-orange-100 text-orange-700' :
                                    r.bayar==='QRS' ? 'bg-purple-100 text-purple-700' :
                                    'bg-gray-100 text-gray-600'
                                  }`}>{r.bayar}</span>
                                </td>
                                <td className="px-2 py-1 border border-gray-200 font-mono">{r.nik}</td>
                                <td className="px-2 py-1 border border-gray-200 max-w-[140px] truncate" title={r.nama_anggota}>{r.nama_anggota}</td>
                                <td className="px-2 py-1 border border-gray-200 max-w-[180px] truncate" title={r.nama_barang}>{r.nama_barang}</td>
                                <td className="px-2 py-1 text-center border border-gray-200 font-bold">{r.qty}</td>
                                <td className="px-2 py-1 text-right border border-gray-200">{r.harga_jual.toLocaleString('id-ID')}</td>
                                <td className="px-2 py-1 text-right border border-gray-200 text-blue-700 font-medium">{r.tot_harga_jual.toLocaleString('id-ID')}</td>
                                <td className="px-2 py-1 text-right border border-gray-200 text-orange-700">{r.harga_pokok.toLocaleString('id-ID')}</td>
                                <td className="px-2 py-1 text-right border border-gray-200 text-orange-700">{r.tot_harga_pokok.toLocaleString('id-ID')}</td>
                                <td className={`px-2 py-1 text-right border border-gray-200 font-bold ${r.laba >= 0 ? 'text-green-700' : 'text-red-600'}`}>{r.laba.toLocaleString('id-ID')}</td>
                              </tr>
                            ))}
                            <tr className="bg-[#1F4E78] text-white font-bold">
                              <td colSpan={7} className="px-3 py-2 text-center border border-[#163d5e]">TOTAL</td>
                              <td className="px-2 py-2 text-center border border-[#163d5e]">{detailRows.reduce((s,r)=>s+r.qty,0)}</td>
                              <td className="px-2 py-2 text-right border border-[#163d5e]">{detailRows.reduce((s,r)=>s+r.harga_jual,0).toLocaleString('id-ID')}</td>
                              <td className="px-2 py-2 text-right border border-[#163d5e]">{detailRows.reduce((s,r)=>s+r.tot_harga_jual,0).toLocaleString('id-ID')}</td>
                              <td className="px-2 py-2 text-right border border-[#163d5e]">{detailRows.reduce((s,r)=>s+r.harga_pokok,0).toLocaleString('id-ID')}</td>
                              <td className="px-2 py-2 text-right border border-[#163d5e]">{detailRows.reduce((s,r)=>s+r.tot_harga_pokok,0).toLocaleString('id-ID')}</td>
                              <td className="px-2 py-2 text-right border border-[#163d5e]">{detailRows.reduce((s,r)=>s+r.laba,0).toLocaleString('id-ID')}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="py-16 text-center text-muted-foreground text-sm">
                      Klik <strong>Tampilkan</strong> pada filter di atas untuk memuat data transaksi.
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: Laporan Mingguan ──────────────────── */}
              {activeTab === 'mingguan' && (
                <div className="p-4 space-y-4">
                  {/* Filter Mingguan */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Tahun</Label>
                      <Select value={String(mTahun)} onValueChange={v => setMTahun(Number(v ?? new Date().getFullYear()))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Bulan</Label>
                      <Select value={String(mBulan)} onValueChange={v => setMBulan(Number(v ?? 1))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {BULAN_NAMES.slice(1).map((b,i) => <SelectItem key={i+1} value={String(i+1)}>{b}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Minggu Ke</Label>
                      <Select value={String(mMinggu)} onValueChange={v => setMMinggu(Number(v ?? 1))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1,2,3,4,5].map(w => <SelectItem key={w} value={String(w)}>Minggu {WEEK_ROMAN[w]} (tgl {(w-1)*7+1}–{Math.min(w*7,31)})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end gap-2">
                      <Button onClick={handleSearchMingguan} disabled={mingguPending} className="flex-1 gap-2">
                        <Search className="h-4 w-4" />
                        {mingguPending ? 'Memuat...' : 'Tampilkan'}
                      </Button>
                      {mingguData && (
                        <Button onClick={() => exportMingguanExcel('mingguan')} variant="outline" size="icon"
                          className="text-purple-700 border-purple-200 hover:bg-purple-50 shrink-0" title="Export Excel">
                          <FileSpreadsheet className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {mingguData ? (() => {
                    const mg = mingguData
                    const fmtN = (n: number) => n > 0 ? n.toLocaleString('id-ID') : '-'
                    const SectionTbl = ({ label, isCash, totHPP, totJual, totLaba }: {
                      label: string; isCash: boolean; totHPP: number; totJual: number; totLaba: number
                    }) => (
                      <div>
                        <p className={`text-xs font-bold mb-1 ${isCash ? 'text-blue-800' : 'text-red-700'}`}>{label}</p>
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100">
                              {['No','Week','Tanggal','Harga Pokok','Harga Jual','Laba'].map(h => (
                                <th key={h} className="px-2 py-1.5 text-center border border-gray-300 font-bold whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {mg.rows.map((r, i) => {
                              const hpp  = isCash ? r.hppCash  : r.hppKredit
                              const jual = isCash ? r.jualCash : r.jualKredit
                              const laba = isCash ? r.labaCash : r.labaKredit
                              return (
                                <tr key={r.tanggal} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  <td className="px-2 py-1 text-center border border-gray-200">{i+1}</td>
                                  <td className="px-2 py-1 text-center border border-gray-200">{r.dayName}</td>
                                  <td className="px-2 py-1 text-center border border-gray-200">{r.tanggal}</td>
                                  <td className="px-2 py-1 text-right border border-gray-200">{fmtN(hpp)}</td>
                                  <td className="px-2 py-1 text-right border border-gray-200 text-blue-700">{fmtN(jual)}</td>
                                  <td className={`px-2 py-1 text-right border border-gray-200 font-bold ${laba > 0 ? 'text-green-700' : laba < 0 ? 'text-red-600' : ''}`}>{fmtN(laba)}</td>
                                </tr>
                              )
                            })}
                            <tr className="bg-slate-200 font-bold">
                              <td colSpan={3} className="px-2 py-1.5 text-center border border-gray-300">JUMLAH</td>
                              <td className="px-2 py-1.5 text-right border border-gray-300">{fmtN(totHPP)}</td>
                              <td className="px-2 py-1.5 text-right border border-gray-300 text-blue-700">{fmtN(totJual)}</td>
                              <td className={`px-2 py-1.5 text-right border border-gray-300 ${totLaba >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtN(totLaba)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )
                    return (
                      <div className="space-y-4">
                        <p className="text-xs text-muted-foreground font-medium">
                          Minggu {WEEK_ROMAN[mMinggu]} — {BULAN_NAMES[mBulan]} {mTahun}
                        </p>
                        <SectionTbl label="PENJUALAN CASH (Tunai / QRIS / Transfer)"
                          isCash={true} totHPP={mg.totCashHpp} totJual={mg.totCashJual} totLaba={mg.totCashLaba} />
                        <SectionTbl label="PENJUALAN KREDIT (Paylater / Potong Simpanan)"
                          isCash={false} totHPP={mg.totKrdHpp} totJual={mg.totKrdJual} totLaba={mg.totKrdLaba} />
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <tbody>
                              <tr className="border-b"><td className="px-4 py-2 font-medium">Total Harga Pokok</td><td className="px-4 py-2 text-right font-bold">{mg.grandHpp.toLocaleString('id-ID')}</td><td className="px-3 py-2 text-muted-foreground text-xs">IDR</td></tr>
                              <tr className="border-b"><td className="px-4 py-2 font-medium">Total Harga Jual</td><td className="px-4 py-2 text-right font-bold text-blue-700">{mg.grandJual.toLocaleString('id-ID')}</td><td className="px-3 py-2 text-muted-foreground text-xs">IDR</td></tr>
                              <tr className="bg-yellow-50"><td className="px-4 py-2 font-bold">Keuntungan</td>
                                <td className={`px-4 py-2 text-right font-bold text-lg border border-yellow-400 rounded ${mg.grandLaba >= 0 ? 'text-green-700' : 'text-red-600'}`}>{mg.grandLaba.toLocaleString('id-ID')}</td>
                                <td className="px-3 py-2 text-muted-foreground text-xs">IDR</td></tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })() : (
                    <div className="py-16 text-center text-muted-foreground text-sm">
                      Pilih Tahun, Bulan, dan Minggu lalu klik <strong>Tampilkan</strong>.
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: Rekap Sembako Anggota ─────────────────── */}
              {activeTab === 'sembako' && (
                <div className="p-4 space-y-4">
                  {/* Controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-3 rounded-lg border">
                    <div className="flex items-center gap-2 flex-1 max-w-sm">
                      <Label className="text-xs shrink-0">Cari Anggota:</Label>
                      <Input
                        placeholder="Nama atau NIK..."
                        value={sembakoSearch}
                        onChange={e => setSembakoSearch(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="onlyActiveSembako"
                        checked={onlyActiveSembako}
                        onChange={e => setOnlyActiveSembako(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <Label htmlFor="onlyActiveSembako" className="text-xs cursor-pointer select-none">
                        Hanya tampilkan anggota dengan transaksi sembako
                      </Label>
                    </div>
                  </div>

                  {/* Table */}
                  {sembakoRows.length > 0 ? (
                    <>
                      <div className="flex items-center gap-6 px-4 py-2 bg-emerald-800 text-white text-xs font-bold rounded-t">
                        <span>PERIODE: {startDate} S/D {endDate}</span>
                        <span className="ml-auto">TOTAL ANGGOTA TAMPIL: {sembakoRows.length}</span>
                      </div>
                      <div className="overflow-x-auto border rounded-b">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-emerald-800 text-white font-bold">
                              <th className="px-2 py-2 text-center border border-emerald-900 whitespace-nowrap">NO</th>
                              <th className="px-2 py-2 text-left border border-emerald-900 whitespace-nowrap">NIK</th>
                              <th className="px-2 py-2 text-left border border-emerald-900 whitespace-nowrap">NAMA</th>
                              <th className="px-2 py-2 text-center border border-emerald-900 whitespace-nowrap">COM 1</th>
                              <th className="px-2 py-2 text-center border border-emerald-900 whitespace-nowrap">COM 2</th>
                              <th className="px-2 py-2 text-right border border-emerald-900 whitespace-nowrap">P-SBK CRD JUAL</th>
                              <th className="px-2 py-2 text-right border border-emerald-900 whitespace-nowrap">P-SBK CAS JUAL</th>
                              <th className="px-2 py-2 text-right border border-emerald-900 whitespace-nowrap">P-SBK CRD POKOK</th>
                              <th className="px-2 py-2 text-right border border-emerald-900 whitespace-nowrap">P-SBK CAS POKOK</th>
                              <th className="px-2 py-2 text-right border border-emerald-900 whitespace-nowrap">P-SBK CRD LABA</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sembakoRows.map((r, idx) => (
                              <tr key={r.nik} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white hover:bg-slate-100'}>
                                <td className="px-2 py-1.5 text-center border border-gray-200">{idx + 1}</td>
                                <td className="px-2 py-1.5 border border-gray-200 font-mono">{r.nik}</td>
                                <td className="px-2 py-1.5 border border-gray-200 font-medium whitespace-nowrap">{r.nama}</td>
                                <td className="px-2 py-1.5 text-center border border-gray-200">{r.com1}</td>
                                <td className="px-2 py-1.5 text-center border border-gray-200 font-bold text-gray-600">{r.com2}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200 font-medium text-emerald-700">{r.crdJual > 0 ? r.crdJual.toLocaleString('id-ID') : '-'}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200 text-gray-700">{r.casJual > 0 ? r.casJual.toLocaleString('id-ID') : '-'}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200 text-orange-700">{r.crdPokok > 0 ? r.crdPokok.toLocaleString('id-ID') : '-'}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200 text-gray-600">{r.casPokok > 0 ? r.casPokok.toLocaleString('id-ID') : '-'}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200 font-bold text-teal-700">{r.crdLaba > 0 ? r.crdLaba.toLocaleString('id-ID') : '-'}</td>
                              </tr>
                            ))}
                            <tr className="bg-emerald-800 text-white font-bold">
                              <td colSpan={5} className="px-3 py-2 text-center border border-emerald-900">TOTAL</td>
                              <td className="px-2 py-2 text-right border border-emerald-900">{sembakoRows.reduce((s,r)=>s+r.crdJual,0).toLocaleString('id-ID')}</td>
                              <td className="px-2 py-2 text-right border border-emerald-900">{sembakoRows.reduce((s,r)=>s+r.casJual,0).toLocaleString('id-ID')}</td>
                              <td className="px-2 py-2 text-right border border-emerald-900">{sembakoRows.reduce((s,r)=>s+r.crdPokok,0).toLocaleString('id-ID')}</td>
                              <td className="px-2 py-2 text-right border border-emerald-900">{sembakoRows.reduce((s,r)=>s+r.casPokok,0).toLocaleString('id-ID')}</td>
                              <td className="px-2 py-2 text-right border border-emerald-900">{sembakoRows.reduce((s,r)=>s+r.crdLaba,0).toLocaleString('id-ID')}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="py-16 text-center text-muted-foreground text-sm border rounded-lg">
                      Tidak ada data transaksi sembako anggota untuk kriteria pencarian ini.
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: Potongan Gaji ─────────────────── */}
              {activeTab === 'potongan' && (
                <div className="p-4 space-y-4">
                  {/* Controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-3 rounded-lg border">
                    <div className="flex items-center gap-2 flex-1 max-w-sm">
                      <Label className="text-xs shrink-0">Cari Karyawan:</Label>
                      <Input
                        placeholder="Nama, NIK, Departemen..."
                        value={potonganSearch}
                        onChange={e => setPotonganSearch(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="onlyActivePotongan"
                        checked={onlyActivePotongan}
                        onChange={e => setOnlyActivePotongan(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <Label htmlFor="onlyActivePotongan" className="text-xs cursor-pointer select-none">
                        Hanya tampilkan karyawan dengan potongan gaji
                      </Label>
                    </div>
                  </div>

                  {/* Table */}
                  {filteredDeductions.length > 0 ? (
                    <>
                      <div className="flex items-center gap-6 px-4 py-2 bg-red-800 text-white text-xs font-bold rounded-t">
                        <span>PERIODE: {startDate} S/D {endDate}</span>
                        <span className="ml-auto">TOTAL KARYAWAN TAMPIL: {filteredDeductions.length}</span>
                      </div>
                      <div className="overflow-x-auto border rounded-b">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-red-800 text-white font-bold text-center">
                              <th className="px-2 py-2 border border-red-950 whitespace-nowrap" rowSpan={2}>NO</th>
                              <th className="px-2 py-2 border border-red-950 whitespace-nowrap" rowSpan={2}>NIK</th>
                              <th className="px-2 py-2 border border-red-950 whitespace-nowrap text-left" rowSpan={2}>NAMA</th>
                              <th className="px-2 py-1 border border-red-950 whitespace-nowrap" colSpan={2}>COM</th>
                              <th className="px-2 py-1 border border-red-950 whitespace-nowrap" colSpan={3}>SIMPANAN</th>
                              <th className="px-2 py-1 border border-red-950 whitespace-nowrap" colSpan={3}>PINJAMAN UANG</th>
                              <th className="px-2 py-1 border border-red-950 whitespace-nowrap" colSpan={2}>P-KHS</th>
                              <th className="px-2 py-1 border border-red-950 whitespace-nowrap" colSpan={2}>P-BRG</th>
                              <th className="px-2 py-2 border border-red-950 whitespace-nowrap" rowSpan={2}>KREDIT SBK</th>
                              <th className="px-2 py-2 border border-red-950 whitespace-nowrap" rowSpan={2}>TOTAL</th>
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
                            {filteredDeductions.map((item, idx) => {
                              const com2Val = (item.department || 'SAU').replace(/^U-/, '')
                              const simpPokok = item.details.filter(d => d.reference === 'SP').reduce((sum, d) => sum + d.amount, 0)
                              const simpWajib = item.details.filter(d => d.reference === 'SW' || (d.category === 'simpanan_wajib' && d.reference !== 'SP')).reduce((sum, d) => sum + d.amount, 0)
                              const simpSukarela = item.total_simpanan_salary_cut
                              const pUang = item.total_pinjaman_uang
                              const admPU = 0
                              const bTrsf = 0
                              const pKhusus = item.total_pinjaman_kilat
                              const admPKhs = 0
                              const pBarang = item.total_pinjaman_barang
                              const admPBrg = 0
                              const kreditSbk = item.total_paylater
                              const total = simpPokok + simpWajib + simpSukarela + pUang + admPU + bTrsf + pKhusus + admPKhs + pBarang + admPBrg + kreditSbk

                              return (
                                <tr key={item.nik} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white hover:bg-slate-100'}>
                                  <td className="px-2 py-1.5 text-center border border-gray-200">{idx + 1}</td>
                                  <td className="px-2 py-1.5 border border-gray-200 font-mono">{item.nik}</td>
                                  <td className="px-2 py-1.5 border border-gray-200 font-medium whitespace-nowrap">{item.name}</td>
                                  <td className="px-2 py-1.5 text-center border border-gray-200">1</td>
                                  <td className="px-2 py-1.5 text-center border border-gray-200 font-bold text-gray-600">{com2Val}</td>
                                  <td className="px-2 py-1.5 text-right border border-gray-200">{simpPokok > 0 ? simpPokok.toLocaleString('id-ID') : '-'}</td>
                                  <td className="px-2 py-1.5 text-right border border-gray-200 text-gray-700">{simpWajib > 0 ? simpWajib.toLocaleString('id-ID') : '-'}</td>
                                  <td className="px-2 py-1.5 text-right border border-gray-200 text-gray-600">{simpSukarela > 0 ? simpSukarela.toLocaleString('id-ID') : '-'}</td>
                                  <td className="px-2 py-1.5 text-right border border-gray-200 text-blue-700">{pUang > 0 ? pUang.toLocaleString('id-ID') : '-'}</td>
                                  <td className="px-2 py-1.5 text-right border border-gray-200 text-gray-400">-</td>
                                  <td className="px-2 py-1.5 text-right border border-gray-200 text-gray-400">-</td>
                                  <td className="px-2 py-1.5 text-right border border-gray-200 text-indigo-700">{pKhusus > 0 ? pKhusus.toLocaleString('id-ID') : '-'}</td>
                                  <td className="px-2 py-1.5 text-right border border-gray-200 text-gray-400">-</td>
                                  <td className="px-2 py-1.5 text-right border border-gray-200 text-amber-700">{pBarang > 0 ? pBarang.toLocaleString('id-ID') : '-'}</td>
                                  <td className="px-2 py-1.5 text-right border border-gray-200 text-gray-400">-</td>
                                  <td className="px-2 py-1.5 text-right border border-gray-200 font-medium text-emerald-700">{kreditSbk > 0 ? kreditSbk.toLocaleString('id-ID') : '-'}</td>
                                  <td className="px-2 py-1.5 text-right border border-gray-200 font-bold text-red-700">{total > 0 ? total.toLocaleString('id-ID') : '-'}</td>
                                </tr>
                              )
                            })}
                            <tr className="bg-red-800 text-white font-bold">
                              <td colSpan={5} className="px-3 py-2 text-center border border-red-950">TOTAL</td>
                              <td className="px-2 py-2 text-right border border-red-950">
                                {filteredDeductions.reduce((s, item) => s + item.details.filter(d => d.reference === 'SP').reduce((sum, d) => sum + d.amount, 0), 0).toLocaleString('id-ID')}
                              </td>
                              <td className="px-2 py-2 text-right border border-red-950">
                                {filteredDeductions.reduce((s, item) => s + item.details.filter(d => d.reference === 'SW' || (d.category === 'simpanan_wajib' && d.reference !== 'SP')).reduce((sum, d) => sum + d.amount, 0), 0).toLocaleString('id-ID')}
                              </td>
                              <td className="px-2 py-2 text-right border border-red-950">
                                {filteredDeductions.reduce((s, item) => s + item.total_simpanan_salary_cut, 0).toLocaleString('id-ID')}
                              </td>
                              <td className="px-2 py-2 text-right border border-red-950">
                                {filteredDeductions.reduce((s, item) => s + item.total_pinjaman_uang, 0).toLocaleString('id-ID')}
                              </td>
                              <td className="px-2 py-2 text-right border border-red-950">-</td>
                              <td className="px-2 py-2 text-right border border-red-950">-</td>
                              <td className="px-2 py-2 text-right border border-red-950">
                                {filteredDeductions.reduce((s, item) => s + item.total_pinjaman_kilat, 0).toLocaleString('id-ID')}
                              </td>
                              <td className="px-2 py-2 text-right border border-red-950">-</td>
                              <td className="px-2 py-2 text-right border border-red-950">
                                {filteredDeductions.reduce((s, item) => s + item.total_pinjaman_barang, 0).toLocaleString('id-ID')}
                              </td>
                              <td className="px-2 py-2 text-right border border-red-950">-</td>
                              <td className="px-2 py-2 text-right border border-red-950">
                                {filteredDeductions.reduce((s, item) => s + item.total_paylater, 0).toLocaleString('id-ID')}
                              </td>
                              <td className="px-2 py-2 text-right border border-red-950">
                                {filteredDeductions.reduce((s, item) => {
                                  const simpPokok = item.details.filter(d => d.reference === 'SP').reduce((sum, d) => sum + d.amount, 0)
                                  const simpWajib = item.details.filter(d => d.reference === 'SW' || (d.category === 'simpanan_wajib' && d.reference !== 'SP')).reduce((sum, d) => sum + d.amount, 0)
                                  const simpSukarela = item.total_simpanan_salary_cut
                                  const pUang = item.total_pinjaman_uang
                                  const pKhusus = item.total_pinjaman_kilat
                                  const pBarang = item.total_pinjaman_barang
                                  const kreditSbk = item.total_paylater
                                  return s + simpPokok + simpWajib + simpSukarela + pUang + pKhusus + pBarang + kreditSbk
                                }, 0).toLocaleString('id-ID')}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="py-16 text-center text-muted-foreground text-sm border rounded-lg">
                      Tidak ada data potongan gaji karyawan untuk kriteria pencarian ini.
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: Monitoring Stocks ─────────────────── */}
              {activeTab === 'stok' && (
                <div className="p-4 space-y-4">
                  {/* Controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-3 rounded-lg border">
                    <div className="flex items-center gap-2 flex-1 max-w-sm">
                      <Label className="text-xs shrink-0">Cari Produk:</Label>
                      <Input
                        placeholder="Nama atau SKU..."
                        value={stockSearch}
                        onChange={e => setStockSearch(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="onlyActiveStock"
                        checked={onlyActiveStock}
                        onChange={e => setOnlyActiveStock(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <Label htmlFor="onlyActiveStock" className="text-xs cursor-pointer select-none">
                        Hanya tampilkan produk dengan pergerakan / stok aktif
                      </Label>
                    </div>
                  </div>

                  {/* Table */}
                  {filteredStocks.length > 0 ? (
                    <>
                      <div className="flex items-center gap-6 px-4 py-2 bg-indigo-800 text-white text-xs font-bold rounded-t">
                        <span>PERIODE: {startDate} S/D {endDate}</span>
                        <span className="ml-auto">TOTAL PRODUK TAMPIL: {filteredStocks.length}</span>
                      </div>
                      <div className="overflow-x-auto border rounded-b">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-indigo-800 text-white font-bold text-center">
                              <th className="px-2 py-2 border border-indigo-950 whitespace-nowrap" rowSpan={2}>NO</th>
                              <th className="px-2 py-2 border border-indigo-950 whitespace-nowrap font-mono" rowSpan={2}>KODE BRG</th>
                              <th className="px-2 py-2 border border-indigo-950 whitespace-nowrap text-left" rowSpan={2}>NAMA BARANG</th>
                              <th className="px-2 py-2 border border-indigo-950 whitespace-nowrap" rowSpan={2}>STOCK AWAL</th>
                              <th className="px-2 py-2 border border-indigo-950 whitespace-nowrap" rowSpan={2}>PEMBELIAN</th>
                              <th className="px-2 py-1 border border-indigo-950 whitespace-nowrap" colSpan={5}>PENJUALAN</th>
                              <th className="px-2 py-2 border border-indigo-950 whitespace-nowrap" rowSpan={2}>TOT PENJUALAN</th>
                              <th className="px-2 py-2 border border-indigo-950 whitespace-nowrap" rowSpan={2}>STOCK AKHIR</th>
                              <th className="px-2 py-2 border border-indigo-950 whitespace-nowrap font-bold text-amber-200" rowSpan={2}>STOCK OPNAME</th>
                              <th className="px-2 py-2 border border-indigo-950 whitespace-nowrap" rowSpan={2}>QTY RETUR</th>
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
                            {filteredStocks.map((item, idx) => (
                              <tr key={item.productId} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white hover:bg-slate-100'}>
                                <td className="px-2 py-1.5 text-center border border-gray-200">{idx + 1}</td>
                                <td className="px-2 py-1.5 border border-gray-200 font-mono text-gray-600">{item.sku}</td>
                                <td className="px-2 py-1.5 border border-gray-200 font-medium whitespace-nowrap">{item.name}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200 font-semibold">{item.stockAwal.toLocaleString('id-ID')}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200 text-green-700 font-medium">{item.pembelian > 0 ? item.pembelian.toLocaleString('id-ID') : '-'}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200">{item.m1 > 0 ? item.m1.toLocaleString('id-ID') : '-'}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200">{item.m2 > 0 ? item.m2.toLocaleString('id-ID') : '-'}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200">{item.m3 > 0 ? item.m3.toLocaleString('id-ID') : '-'}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200">{item.m4 > 0 ? item.m4.toLocaleString('id-ID') : '-'}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200">{item.m5 > 0 ? item.m5.toLocaleString('id-ID') : '-'}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200 font-medium text-blue-700">{item.totPenjualan > 0 ? item.totPenjualan.toLocaleString('id-ID') : '-'}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200 font-semibold text-slate-800">{item.stockAkhir.toLocaleString('id-ID')}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200 font-bold text-amber-800 bg-amber-50">{item.stockOpname !== null ? item.stockOpname.toLocaleString('id-ID') : '-'}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-200 text-red-600">{item.qtyRetur > 0 ? item.qtyRetur.toLocaleString('id-ID') : '-'}</td>
                              </tr>
                            ))}
                            <tr className="bg-indigo-800 text-white font-bold text-right">
                              <td colSpan={3} className="px-3 py-2 text-center border border-indigo-950">TOTAL</td>
                              <td className="px-2 py-2 border border-indigo-950">{filteredStocks.reduce((s,r)=>s+r.stockAwal,0).toLocaleString('id-ID')}</td>
                              <td className="px-2 py-2 border border-indigo-950">{filteredStocks.reduce((s,r)=>s+r.pembelian,0).toLocaleString('id-ID')}</td>
                              <td className="px-2 py-2 border border-indigo-950">{filteredStocks.reduce((s,r)=>s+r.m1,0).toLocaleString('id-ID')}</td>
                              <td className="px-2 py-2 border border-indigo-950">{filteredStocks.reduce((s,r)=>s+r.m2,0).toLocaleString('id-ID')}</td>
                              <td className="px-2 py-2 border border-indigo-950">{filteredStocks.reduce((s,r)=>s+r.m3,0).toLocaleString('id-ID')}</td>
                              <td className="px-2 py-2 border border-indigo-950">{filteredStocks.reduce((s,r)=>s+r.m4,0).toLocaleString('id-ID')}</td>
                              <td className="px-2 py-2 border border-indigo-950">{filteredStocks.reduce((s,r)=>s+r.m5,0).toLocaleString('id-ID')}</td>
                              <td className="px-2 py-2 border border-indigo-950">{filteredStocks.reduce((s,r)=>s+r.totPenjualan,0).toLocaleString('id-ID')}</td>
                              <td className="px-2 py-2 border border-indigo-950">{filteredStocks.reduce((s,r)=>s+r.stockAkhir,0).toLocaleString('id-ID')}</td>
                              <td className="px-2 py-2 border border-indigo-950">{filteredStocks.reduce((s,r)=>s+(r.stockOpname||0),0).toLocaleString('id-ID')}</td>
                              <td className="px-2 py-2 border border-indigo-950">{filteredStocks.reduce((s,r)=>s+r.qtyRetur,0).toLocaleString('id-ID')}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="py-16 text-center text-muted-foreground text-sm border rounded-lg">
                      Tidak ada data monitoring stok produk untuk kriteria pencarian ini.
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* ── SLOW MOVING ─────────────────────────────── */}

          {data.slowMoving.length > 0 && (
            <Card className="border-orange-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  Barang Slow Moving (belum terjual pada periode ini)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produk</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead className="text-right">Stok</TableHead>
                      <TableHead className="text-right">HPP/Unit</TableHead>
                      <TableHead className="text-right">Nilai Stok Tertahan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.slowMoving.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{p.category}</TableCell>
                        <TableCell className="text-right font-bold">{p.stock}</TableCell>
                        <TableCell className="text-right">{formatRp(p.purchase_price)}</TableCell>
                        <TableCell className="text-right font-semibold text-orange-700">{formatRp(p.stock_value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {data.topProducts.length === 0 && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Tidak ada data penjualan pada periode dan filter yang dipilih.</CardContent></Card>
          )}
        </>
      )}
    </div>
  )
}
