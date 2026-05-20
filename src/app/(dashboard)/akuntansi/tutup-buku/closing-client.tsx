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
      <Card className="border border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg font-bold">Proses Tutup Buku</CardTitle>
          <CardDescription>Pilih periode bulan dan tahun.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0 md:pt-0 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Bulan</label>
              <Select value={month} onValueChange={(value) => setMonth(value || month)}>
                <SelectTrigger className="h-12 text-base rounded-xl">
                  <SelectValue placeholder="Bulan" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m, i) => (
                    <SelectItem key={i} value={(i + 1).toString()}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Tahun</label>
              <Select value={year} onValueChange={(value) => value ? setYear(value) : null}>
                <SelectTrigger className="h-12 text-base rounded-xl">
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
            className="w-full h-12 rounded-xl text-base font-semibold" 
            onClick={handleCloseMonth}
            disabled={loading}
          >
            <Lock className="mr-2 h-5 w-5" /> 
            {loading ? "Memproses..." : "Tutup Buku"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg font-bold">Riwayat Tutup Buku</CardTitle>
          <CardDescription>Daftar bulan yang sudah dikunci beserta ringkasan keuangannya.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 md:p-6 md:pt-0">
          {/* Desktop Table View */}
          <div className="hidden md:block">
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
                    <TableCell colSpan={4} className="text-center text-slate-400 py-4">Belum ada riwayat tutup buku.</TableCell>
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
          </div>

          {/* Mobile Card Feed View */}
          <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {closures.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                Belum ada riwayat tutup buku.
              </div>
            ) : (
              closures.map(c => (
                <div key={c.id} className="p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-base text-slate-900 dark:text-slate-50">{months[c.month - 1]} {c.year}</span>
                    <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-650 px-2 py-0.5 rounded-full font-semibold">Terkunci</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl p-2.5">
                      <p className="text-slate-400 text-[10px]">Total Pendapatan</p>
                      <p className="font-bold text-green-600 mt-0.5">{formatCurrency(c.total_revenue)}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl p-2.5">
                      <p className="text-slate-400 text-[10px]">Total Pengeluaran</p>
                      <p className="font-bold text-red-650 mt-0.5">{formatCurrency(c.total_expense)}</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs border-t border-slate-50 dark:border-slate-800/35 pt-2.5 mt-1">
                    <span className="text-slate-400">SHU Sementara</span>
                    <span className="font-extrabold text-blue-600 dark:text-blue-450 text-sm">{formatCurrency(c.net_income)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
