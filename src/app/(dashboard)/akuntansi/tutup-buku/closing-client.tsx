"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { performMonthlyClosing } from "@/lib/actions/accounting"
import { toast } from "sonner"
import { Lock } from "lucide-react"

export function ClosingClient({ closures }: { closures: any[] }) {
  const now = new Date()
  const [month, setMonth] = useState((now.getMonth() + 1).toString())
  const [year, setYear] = useState(now.getFullYear().toString())
  const [loading, setLoading] = useState(false)

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)

  const handleCloseMonth = async () => {
    if (!confirm(`Tutup buku untuk periode ${month}/${year}? Transaksi tidak akan bisa diubah lagi.`)) return

    setLoading(true)
    const res = await performMonthlyClosing(parseInt(month), parseInt(year))
    if (res.success) {
      toast.success("Buku berhasil ditutup untuk periode ini.")
    } else {
      toast.error(res.error)
    }
    setLoading(false)
  }

  const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
      <Card>
        <CardHeader>
          <CardTitle>Proses Tutup Buku</CardTitle>
          <CardDescription>Pilih periode bulan dan tahun.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Bulan</label>
              <Select value={month} onValueChange={(value) => setMonth(value || month)}>
                <SelectTrigger>
                  <SelectValue placeholder="Bulan" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m, i) => (
                    <SelectItem key={i} value={(i + 1).toString()}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tahun</label>
              <Select value={year} onValueChange={(value) => value ? setYear(value) : null}>
                <SelectTrigger>
                  <SelectValue placeholder="Tahun" />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2].map(offset => {
                    const y = now.getFullYear() - offset
                    return <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button 
            className="w-full" 
            onClick={handleCloseMonth}
            disabled={loading}
          >
            <Lock className="mr-2 h-4 w-4" /> 
            {loading ? "Memproses..." : "Tutup Buku"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Tutup Buku</CardTitle>
          <CardDescription>Daftar bulan yang sudah dikunci beserta ringkasan keuangannya.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Periode</TableHead>
                <TableHead className="text-right">Total Pendapatan</TableHead>
                <TableHead className="text-right">Total Pengeluaran</TableHead>
                <TableHead className="text-right">SHU Sementara</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {closures.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-4">Belum ada riwayat tutup buku.</TableCell>
                </TableRow>
              )}
              {closures.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{months[c.month - 1]} {c.year}</TableCell>
                  <TableCell className="text-right text-green-600">{formatCurrency(c.total_revenue)}</TableCell>
                  <TableCell className="text-right text-red-600">{formatCurrency(c.total_expense)}</TableCell>
                  <TableCell className="text-right font-bold text-primary">{formatCurrency(c.net_income)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
