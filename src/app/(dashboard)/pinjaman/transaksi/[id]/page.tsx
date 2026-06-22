"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { getLoanTransaction } from "@/lib/actions/loans"

const formatRp = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)

interface LoanData {
  id: number
  loan_no: string
  principal: number
  outstanding: number
  monthly_installment: number
  tenor_months: number
  status: string
  repayment_method: string
  product: {
    name: string
    code: string
    interest_rate: number
    max_tenor: number
  } | null
  loan_schedules: any[]
}

export default function LoanTransactionPage() {
  const params = useParams()
  const loanId = params.id as string
  const [loan, setLoan] = useState<LoanData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLoan = async () => {
      try {
        const res = await getLoanTransaction(Number(loanId))
        if (res.success && res.data) {
          setLoan(res.data)
        }
      } catch (error) {
        console.error("Error fetching loan:", error)
      } finally {
        setLoading(false)
      }
    }

    if (loanId) fetchLoan()
  }, [loanId])

  if (loading) return <div className="p-6">Loading...</div>
  if (!loan) return <div className="p-6">Pinjaman tidak ditemukan.</div>

  // Calculate amortization schedule
  const principal = loan.principal
  const tenor = loan.tenor_months
  const interestRate = loan.product?.interest_rate || 0
  const monthlyPrincipal = principal / tenor
  const monthlyInterest = principal * (interestRate / 100)
  const totalMonthly = monthlyPrincipal + monthlyInterest

  const schedule = []
  let remainingPrincipal = principal

  for (let month = 0; month <= tenor; month++) {
    if (month === 0) {
      schedule.push({
        month: 0,
        principalPayment: 0,
        interestPayment: 0,
        totalPayment: 0,
        remainingPrincipal: principal
      })
    } else {
      remainingPrincipal -= monthlyPrincipal
      schedule.push({
        month,
        principalPayment: monthlyPrincipal,
        interestPayment: monthlyInterest,
        totalPayment: totalMonthly,
        remainingPrincipal: Math.max(0, remainingPrincipal)
      })
    }
  }

  // Use actual loan schedules from the API response
  const displaySchedule = loan.loan_schedules || []

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Link href="/pinjaman" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Pinjaman
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Jadwal Transaksi Pinjaman</h1>
        <p className="text-muted-foreground mt-1">Detail amortisasi dan jadwal pembayaran pinjaman Anda.</p>
      </div>

      {/* Loan Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xl text-blue-700 dark:text-blue-400">
                {loan.product?.name || "Pinjaman Uang"}
              </span>
              <Badge className={
                loan.status === "active" ? "bg-green-100 text-green-700" :
                loan.status === "paid_off" ? "bg-slate-100 text-slate-700" :
                loan.status === "overdue" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
              }>
                {loan.status === "active" ? "Aktif" : loan.status === "paid_off" ? "Lunas" : loan.status === "overdue" ? "Terlambat" : loan.status}
              </Badge>
            </div>
            <span className="text-sm font-mono text-muted-foreground">{loan.loan_no}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Plafon Pinjaman</p>
              <p className="text-lg font-semibold">{formatRp(principal)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Tenor</p>
              <p className="text-lg font-semibold">{tenor} Bulan</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Suku Bunga</p>
              <p className="text-lg font-semibold">{interestRate}% per bulan</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Metode Perhitungan</p>
              <p className="text-lg font-semibold">Bunga Flat (Tetap)</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-2">Rincian Komponen per Bulan</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Cicilan Pokok</p>
                <p className="font-semibold">{formatRp(monthlyPrincipal)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Cicilan Bunga</p>
                <p className="font-semibold">{formatRp(monthlyInterest)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Angsuran</p>
                <p className="font-semibold">{formatRp(totalMonthly)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Amortization Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Jadwal Transaksi (Amortisasi)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Menampilkan jadwal lengkap cicilan per bulan sampai lunas berdasarkan data dari sistem.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tgl Jatuh Tempo</TableHead>
                <TableHead>Cicilan Pokok</TableHead>
                <TableHead>Bunga ({interestRate}%)</TableHead>
                <TableHead>Total Angsuran</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displaySchedule.map((row: any, index: number) => {
                const dateObj = new Date(row.due_date);
                const formattedDate = dateObj.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
                return (
                  <TableRow key={row.id || index}>
                    <TableCell className="font-medium">{formattedDate}</TableCell>
                    <TableCell>{formatRp(row.principal_payment)}</TableCell>
                    <TableCell>{formatRp(row.interest_payment)}</TableCell>
                    <TableCell>{formatRp(row.total_payment)}</TableCell>
                    <TableCell>
                      <Badge className={
                        row.status === "paid" ? "bg-green-100 text-green-700" :
                        row.status === "pending" ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      }>
                        {row.status === "paid" 
                          ? (
                              (index === displaySchedule.length - 1 || loan.product?.code?.includes('PAYLATER') || loan.product?.code?.includes('KILAT') || loan.product?.name?.toLowerCase().includes('kilat')) 
                                ? "Sudah Lunas" 
                                : "Sudah Terbayarkan"
                            ) 
                          : row.status === "pending" 
                            ? "Menunggu" 
                            : "Terlambat"
                        }
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}