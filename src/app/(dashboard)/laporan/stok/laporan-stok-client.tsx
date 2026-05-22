'use client'

import { useState, useTransition } from 'react'
import { getStockMovements } from '@/lib/actions/laporan-stok'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Search, FileSpreadsheet, TrendingUp, TrendingDown, ArrowLeftRight, RotateCcw, Truck } from 'lucide-react'
import { toast } from 'sonner'

type Product = { id: number; name: string; sku: string }
type MovementRow = Awaited<ReturnType<typeof getStockMovements>>[number]

const TYPE_LABELS: Record<string, string> = {
  in:         'Masuk',
  out:        'Keluar',
  adjustment: 'Penyesuaian',
  return:     'Retur',
  transfer:   'Transfer',
}

const TYPE_BADGE: Record<string, string> = {
  in:         'bg-green-100 text-green-700 border-green-200',
  out:        'bg-red-100 text-red-700 border-red-200',
  adjustment: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  return:     'bg-blue-100 text-blue-700 border-blue-200',
  transfer:   'bg-purple-100 text-purple-700 border-purple-200',
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  in:         <TrendingUp className="h-3 w-3" />,
  out:        <TrendingDown className="h-3 w-3" />,
  adjustment: <ArrowLeftRight className="h-3 w-3" />,
  return:     <RotateCcw className="h-3 w-3" />,
  transfer:   <Truck className="h-3 w-3" />,
}

import React from 'react'

export function LaporanStokClient({ products }: { products: Product[] }) {
  const [isPending, startTransition] = useTransition()
  const [data, setData] = useState<MovementRow[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate,   setEndDate]   = useState(new Date().toISOString().split('T')[0])
  const [productId, setProductId] = useState<string>('all')
  const [type, setType]           = useState<string>('all')

  const handleSearch = () => {
    if (!startDate || !endDate) {
      toast.error('Tanggal mulai dan akhir harus diisi')
      return
    }
    startTransition(async () => {
      const res = await getStockMovements({
        startDate,
        endDate,
        productId: productId !== 'all' ? Number(productId) : undefined,
        type:      type !== 'all' ? type : undefined,
      })
      setData(res)
      setHasSearched(true)
    })
  }

  const exportExcel = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default
      const workbook = new ExcelJS.Workbook()
      const ws = workbook.addWorksheet('Riwayat Stok')

      ws.addRow(['Laporan Riwayat Keluar Masuk Barang (Stok)'])
      ws.addRow([`Periode: ${startDate} s/d ${endDate}`])
      ws.addRow([`Dicetak pada: ${new Date().toLocaleString('id-ID')}`])
      ws.addRow([])

      ws.getCell('A1').font = { size: 14, bold: true }
      ws.getCell('A2').font = { size: 10, italic: true }

      const header = ws.addRow(['Waktu', 'SKU', 'Produk', 'Jenis', 'Qty', 'Stok Sebelum', 'Stok Sesudah', 'Referensi', 'Keterangan', 'Petugas'])
      const DARK_BLUE = 'FF1F4E78'
      for (let i = 1; i <= 10; i++) {
        const cell = header.getCell(i)
        cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BLUE } }
        cell.font   = { color: { argb: 'FFFFFFFF' }, bold: true }
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }
      }

      ws.getColumn(1).width = 22
      ws.getColumn(2).width = 14
      ws.getColumn(3).width = 30
      ws.getColumn(4).width = 14
      ws.getColumn(5).width = 8
      ws.getColumn(6).width = 14
      ws.getColumn(7).width = 14
      ws.getColumn(8).width = 25
      ws.getColumn(9).width = 30
      ws.getColumn(10).width = 20

      data.forEach((m, index) => {
        const row = ws.addRow([
          new Date(m.created_at).toLocaleString('id-ID'),
          m.product_sku,
          m.product_name,
          TYPE_LABELS[m.type] || m.type,
          m.quantity,
          m.stock_before,
          m.stock_after,
          m.reference,
          m.notes,
          m.created_by,
        ])

        // Alternate row colors for readability
        const bgColor = index % 2 === 0 ? 'FFFAFAFA' : 'FFFFFFFF'
        for (let i = 1; i <= 10; i++) {
          const cell = row.getCell(i)
          cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
          cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }
        }

        // Colour Qty cell based on type and quantity sign
        if (m.type === 'in' || m.type === 'return' || (m.type === 'adjustment' && m.quantity >= 0)) {
          row.getCell(5).font = { color: { argb: 'FF16A34A' }, bold: true }
        } else if (m.type === 'out' || (m.type === 'adjustment' && m.quantity < 0)) {
          row.getCell(5).font = { color: { argb: 'FFDC2626' }, bold: true }
        }
      })

      const buf  = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url  = window.URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `Riwayat_Stok_${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error('Gagal mengekspor Excel')
    }
  }

  // Summary
  const totalIn  = data
    .filter(m => m.type === 'in' || m.type === 'return' || (m.type === 'adjustment' && m.quantity > 0))
    .reduce((s, m) => s + Math.abs(m.quantity), 0)
  const totalOut = data
    .filter(m => m.type === 'out' || (m.type === 'adjustment' && m.quantity < 0))
    .reduce((s, m) => s + Math.abs(m.quantity), 0)

  return (
    <div className="space-y-4">
      {/* FILTER */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Laporan</CardTitle>
          <CardDescription>Pilih kriteria untuk menampilkan histori pergerakan stok</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Tgl Mulai</Label>
              <Input id="start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">Tgl Akhir</Label>
              <Input id="end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-select">Produk</Label>
              <Select value={productId} onValueChange={(v) => setProductId(v ?? 'all')}>
                <SelectTrigger id="product-select"><SelectValue placeholder="Semua Produk" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Produk</SelectItem>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.sku} – {p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="type-select">Jenis Mutasi</Label>
              <Select value={type} onValueChange={(v) => setType(v ?? 'all')}>
                <SelectTrigger id="type-select"><SelectValue placeholder="Semua Jenis" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Jenis</SelectItem>
                  <SelectItem value="in">Masuk (IN)</SelectItem>
                  <SelectItem value="out">Keluar (OUT)</SelectItem>
                  <SelectItem value="return">Retur</SelectItem>
                  <SelectItem value="adjustment">Penyesuaian</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={handleSearch} disabled={isPending} className="flex-1 gap-2">
              <Search className="h-4 w-4" />
              {isPending ? 'Memuat Data...' : 'Tampilkan Laporan'}
            </Button>
            {hasSearched && data.length > 0 && (
              <Button onClick={exportExcel} variant="outline" className="gap-2 text-green-700 hover:text-green-800 hover:bg-green-50 border-green-200">
                <FileSpreadsheet className="h-4 w-4" /> Export Excel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* SUMMARY CARDS */}
      {hasSearched && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Transaksi</p>
              <p className="text-2xl font-bold">{data.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Masuk</p>
              <p className="text-2xl font-bold text-green-600">+{totalIn}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Keluar</p>
              <p className="text-2xl font-bold text-red-600">-{totalOut}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Nett Perubahan</p>
              <p className={`text-2xl font-bold ${totalIn - totalOut >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalIn - totalOut >= 0 ? '+' : ''}{totalIn - totalOut}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TABLE */}
      {hasSearched && (
        <Card>
          <CardHeader>
            <CardTitle>Detail Mutasi Stok ({data.length} Record)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[170px]">Waktu</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Produk</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Stok Sblm</TableHead>
                    <TableHead className="text-right">Stok Ssdh</TableHead>
                    <TableHead>Referensi</TableHead>
                    <TableHead>Petugas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        Tidak ada data mutasi stok untuk periode dan filter ini.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.map(m => (
                      <TableRow key={m.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {new Date(m.created_at).toLocaleString('id-ID')}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{m.product_sku}</TableCell>
                        <TableCell className="max-w-[180px] truncate" title={m.product_name}>{m.product_name}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium ${TYPE_BADGE[m.type] || 'bg-gray-100 text-gray-700'}`}>
                            {TYPE_ICONS[m.type]}
                            {TYPE_LABELS[m.type] || m.type}
                          </span>
                        </TableCell>
                        <TableCell className={`text-right font-bold ${
                          m.type === 'out' || (m.type === 'adjustment' && m.quantity < 0)
                            ? 'text-red-600'
                            : 'text-green-600'
                        }`}>
                          {m.type === 'out'
                            ? `-${m.quantity}`
                            : m.type === 'adjustment' && m.quantity < 0
                              ? m.quantity
                              : `+${m.quantity}`
                          }
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{m.stock_before}</TableCell>
                        <TableCell className="text-right font-medium">{m.stock_after}</TableCell>
                        <TableCell>
                          <div className="max-w-[200px]">
                            <p className="text-xs font-medium truncate" title={m.reference}>{m.reference}</p>
                            {m.notes !== '-' && (
                              <p className="text-xs text-muted-foreground truncate" title={m.notes}>{m.notes}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{m.created_by}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
