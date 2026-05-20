"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CreditCard, DollarSign, Wallet, TrendingUp, ShoppingBag, Package, Users, UserMinus, UserCheck, Activity, CheckCircle, AlertCircle, Send } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { Button } from "@/components/ui/button"
import { generatePdfHeader } from "@/lib/report-helpers"
import { FloatingPromotions } from "./floating-promotions"

const formatRp = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)

export function MemberDashboard({ data }: { data: any }) {
  const { simpanan, pinjaman, orders, stats, loyalty, promotions = [] } = data
  const memberName = simpanan?.member_name || pinjaman?.member_name || "Anggota"
  const memberCode = simpanan?.member_code || ""

  const activeLoan = pinjaman?.loans?.find((l: any) => l.status === "active")
  const remainingInstallments = activeLoan?.loan_schedules?.filter((s: any) => s.status !== "paid").length ?? 0
  const allLoans = pinjaman?.loans || []
  
  // Paylater Debts
  const paylaterDebts = pinjaman?.paylater_debts || []
  const totalPaylater = paylaterDebts.reduce((sum: number, debt: any) => sum + debt.amount, 0)
  
  const [showLoanHistory, setShowLoanHistory] = useState(false)
  const [selectedLoanId, setSelectedLoanId] = useState<number | null>(null)
  const [statsPeriod, setStatsPeriod] = useState<"weekly"|"monthly"|"yearly">("monthly")
  const [financialData, setFinancialData] = useState<any>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const forceDashboard = searchParams.get("forceDashboard") === "true"

  useEffect(() => {
    if (typeof window === "undefined") return

    if (window.innerWidth < 768 && !forceDashboard) {
      router.replace("/dashboard/home")
    }
  }, [router, forceDashboard])

  // Fetch Real-time Global Stats
  useEffect(() => {
    if (data.dashboardConfig?.show_financial_stats) {
      setLoadingStats(true)
      import("@/lib/actions/global-financial-stats").then(({ getGlobalFinancialStats }) => {
        getGlobalFinancialStats(statsPeriod).then(res => {
          setFinancialData(res)
          setLoadingStats(false)
        }).catch(err => {
          console.error(err)
          setLoadingStats(false)
        })
      })
    }
  }, [statsPeriod, data.dashboardConfig?.show_financial_stats])

  // Show approval notifications for recently approved loans
  const recentApprovals = pinjaman?.applications?.filter((app: any) => app.status === "approved") || []

  const handleDownloadSimpanan = () => {
    const doc = new jsPDF()
    const startYHeader = generatePdfHeader(doc, `Slip Simpanan - ${memberName} (${memberCode})`)
    
    doc.setFontSize(12)
    doc.text(`Total Saldo: ${formatRp(simpanan?.totalBalance || 0)}`, 14, startYHeader)
    
    if (simpanan?.transactions && simpanan.transactions.length > 0) {
      const tableData = simpanan.transactions.slice(0, 50).map((t: any, i: number) => [
        i + 1,
        new Date(t.transaction_at).toLocaleDateString('id-ID'),
        t.saving_name,
        t.type === 'deposit' ? 'Setoran' : 'Penarikan',
        formatRp(t.amount),
        formatRp(t.balance_after)
      ])
      
      // @ts-ignore
      autoTable(doc, {
        startY: startYHeader + 10,
        head: [['No', 'Tanggal', 'Jenis', 'Tipe', 'Jumlah', 'Saldo']],
        body: tableData,
      })
    } else {
      doc.text("Belum ada riwayat transaksi.", 14, startYHeader + 10)
    }
    
    doc.save(`Slip_Simpanan_${memberCode}.pdf`)
  }

  const handleDownloadPinjaman = () => {
    const doc = new jsPDF()
    const startYHeader = generatePdfHeader(doc, `Rincian Pinjaman - ${memberName} (${memberCode})`)
    
    let startY = startYHeader;
    
    if (allLoans.length === 0 && totalPaylater === 0) {
      doc.setFontSize(12)
      doc.text("Tidak ada tanggungan pinjaman aktif.", 14, startY)
    } else {
      if (activeLoan) {
        doc.setFontSize(14)
        doc.text("Pinjaman Aktif", 14, startY)
        doc.setFontSize(11)
        doc.text(`No. Pinjaman: ${activeLoan.loan_no}`, 14, startY + 8)
        doc.text(`Sisa Pokok: ${formatRp(activeLoan.outstanding)}`, 14, startY + 14)
        doc.text(`Cicilan per Bulan: ${formatRp(activeLoan.monthly_installment)}`, 14, startY + 20)
        
        const tableData = activeLoan.loan_schedules?.map((s: any, i: number) => [
          s.installment_no,
          new Date(s.due_date).toLocaleDateString('id-ID'),
          formatRp(Number(s.principal_due)),
          formatRp(Number(s.interest_due)),
          formatRp(Number(s.total_due)),
          s.status === 'paid' ? 'Lunas' : s.status === 'pending' ? 'Menunggu' : s.status
        ]) || []
        
        // @ts-ignore
        autoTable(doc, {
          startY: startY + 25,
          head: [['Cicilan Ke', 'Jatuh Tempo', 'Pokok', 'Bunga', 'Total', 'Status']],
          body: tableData,
        })
        
        // @ts-ignore
        startY = (doc as any).lastAutoTable.finalY + 15
      }
      
      if (totalPaylater > 0) {
        doc.setFontSize(14)
        doc.text("Tagihan Paylater Belum Lunas", 14, startY)
        
        const tableData = paylaterDebts.map((d: any, i: number) => [
          i + 1,
          d.order_no,
          d.ordered_at,
          formatRp(d.amount)
        ])
        
        // @ts-ignore
        autoTable(doc, {
          startY: startY + 8,
          head: [['No', 'Order No', 'Tanggal', 'Total']],
          body: tableData,
        })
      }
    }
    
    doc.save(`Rincian_Pinjaman_${memberCode}.pdf`)
  }

  return (
    <>
      <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Hai, {memberName}!</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">Ringkasan aktivitas simpanan, pinjaman, dan belanja Anda di koperasi.</p>
        {memberCode && <Badge variant="outline" className="mt-2 text-xs">ID: {memberCode}</Badge>}
      </div>
      
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-100">Total Simpanan</CardTitle>
            <Wallet className="h-5 w-5 opacity-80" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">{formatRp(simpanan?.totalBalance || 0)}</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowLoanHistory(true)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sisa Pinjaman Aktif</CardTitle>
            <CreditCard className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {activeLoan || totalPaylater > 0 ? (
              <>
                <div className="text-xl md:text-2xl font-bold text-red-500">
                  {formatRp((activeLoan?.outstanding || 0) + totalPaylater)}
                </div>
                <div className="mt-2 space-y-1">
                  {activeLoan && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Cicilan Pinjaman:</span>
                      <span className="font-medium">{formatRp(activeLoan.monthly_installment)}/bln</span>
                    </div>
                  )}
                  {totalPaylater > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Tagihan Paylater:</span>
                      <span className="font-medium text-amber-600">{formatRp(totalPaylater)}</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-blue-600 mt-2">Klik untuk lihat riwayat</p>
              </>
            ) : (
              <>
                <div className="text-lg md:text-xl font-bold text-slate-400">Tidak ada tanggungan</div>
                <p className="text-xs text-blue-600 mt-1">Klik untuk lihat histori pinjaman</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Belanja (Toko)</CardTitle>
            <ShoppingBag className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-amber-600">
              {formatRp(orders?.reduce((sum: number, o: any) => sum + o.grand_total, 0) || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{orders?.length || 0} transaksi bulan ini</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Poin Loyalitas</CardTitle>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-green-600">
              {loyalty && loyalty.length > 0 ? loyalty[0].points_available : 0} Pts
            </div>
            {loyalty && loyalty.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">Level: {loyalty[0].level}</p>
            )}
          </CardContent>
        </Card>
      </div>
      
      <div className="mt-4 flex flex-col gap-2 md:flex-row md:gap-4">
        <Button onClick={handleDownloadSimpanan} variant="outline" className="h-10 px-4 py-2 w-full md:w-auto text-sm font-medium">
          <Send className="mr-2 h-4 w-4" /> Download Slip Simpanan
        </Button>
        <Button onClick={handleDownloadPinjaman} className="h-10 px-4 py-2 w-full md:w-auto text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90">
          <Send className="mr-2 h-4 w-4" /> Rincian Pinjaman
        </Button>
      </div>

      {/* STATISTIK KOPERASI (Global) */}
      <div className="mt-4 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <h2 className="text-xl font-bold tracking-tight">Statistik Koperasi (Global)</h2>
          {data.dashboardConfig?.show_financial_stats && (
            <div className="flex bg-white rounded-full p-1 border shadow-sm self-stretch sm:self-auto">
              {(data.dashboardConfig?.filters?.weekly ?? true) && (
                <button 
                  onClick={() => setStatsPeriod('weekly')}
                  className={`flex-1 sm:flex-none px-3 py-1 text-xs font-medium rounded-full transition-colors ${statsPeriod === 'weekly' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Mingguan
                </button>
              )}
              {(data.dashboardConfig?.filters?.monthly ?? true) && (
                <button 
                  onClick={() => setStatsPeriod('monthly')}
                  className={`flex-1 sm:flex-none px-3 py-1 text-xs font-medium rounded-full transition-colors ${statsPeriod === 'monthly' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Bulanan
                </button>
              )}
              {(data.dashboardConfig?.filters?.yearly ?? true) && (
                <button 
                  onClick={() => setStatsPeriod('yearly')}
                  className={`flex-1 sm:flex-none px-3 py-1 text-xs font-medium rounded-full transition-colors ${statsPeriod === 'yearly' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Tahunan
                </button>
              )}
            </div>
          )}
        </div>

        {data.dashboardConfig?.show_financial_stats && (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 mb-4">
            {(data.dashboardConfig?.modules?.keuntungan ?? true) && (
              <Card className="bg-emerald-50 border-emerald-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-emerald-800">Keuntungan (SHU)</CardTitle>
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-emerald-700">
                    {loadingStats || !financialData ? "Memuat..." : formatRp(financialData.keuntunganSHU)}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {(data.dashboardConfig?.modules?.transaksi ?? true) && (
              <Card className="bg-indigo-50 border-indigo-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-indigo-800">Total Transaksi</CardTitle>
                  <Activity className="h-4 w-4 text-indigo-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-indigo-700">
                    {loadingStats || !financialData ? "Memuat..." : financialData.totalTransaksi.toLocaleString('id-ID')}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {(data.dashboardConfig?.modules?.pengeluaran ?? true) && (
              <Card className="bg-rose-50 border-rose-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-rose-800">Pengeluaran Operasional</CardTitle>
                  <CreditCard className="h-4 w-4 text-rose-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-rose-700">
                    {loadingStats || !financialData ? "Memuat..." : formatRp(financialData.pengeluaranOperasional)}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {(data.dashboardConfig?.modules?.saldo ?? true) && (
              <Card className="bg-blue-50 border-blue-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-blue-800">Saldo Kas Koperasi</CardTitle>
                  <Wallet className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-blue-700">
                    {loadingStats || !financialData ? "Memuat..." : formatRp(financialData.saldoKas)}
                  </div>
                </CardContent>
              </Card>
            )}

            {(data.dashboardConfig?.modules?.keuntungan_toko ?? true) && (
              <Card className="bg-emerald-50 border-emerald-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-emerald-800">Keuntungan Toko Koperasi</CardTitle>
                  <ShoppingBag className="h-4 w-4 text-emerald-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-emerald-700">
                    {loadingStats || !financialData ? "Memuat..." : formatRp(financialData.keuntunganToko)}
                  </div>
                </CardContent>
              </Card>
            )}

            {(data.dashboardConfig?.modules?.keuntungan_sp ?? true) && (
              <Card className="bg-emerald-50 border-emerald-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-emerald-800">Laba Simpan Pinjam</CardTitle>
                  <CreditCard className="h-4 w-4 text-emerald-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-emerald-700">
                    {loadingStats || !financialData ? "Memuat..." : formatRp(financialData.keuntunganSP)}
                  </div>
                </CardContent>
              </Card>
            )}

            {(data.dashboardConfig?.modules?.pengeluaran_toko ?? true) && (
              <Card className="bg-rose-50 border-rose-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-rose-800">Pengeluaran Toko Koperasi</CardTitle>
                  <Package className="h-4 w-4 text-rose-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-rose-700">
                    {loadingStats || !financialData ? "Memuat..." : formatRp(financialData.pengeluaranToko)}
                  </div>
                </CardContent>
              </Card>
            )}

            {(data.dashboardConfig?.modules?.pengeluaran_sp ?? true) && (
              <Card className="bg-rose-50 border-rose-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-rose-800">Pengeluaran Simpan Pinjam</CardTitle>
                  <Send className="h-4 w-4 text-rose-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-rose-700">
                    {loadingStats || !financialData ? "Memuat..." : formatRp(financialData.pengeluaranSP)}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-slate-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Anggota Aktif</CardTitle>
              <UserCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800">{stats?.members?.active || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pensiun / Non-Aktif</CardTitle>
              <UserMinus className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800">{stats?.members?.inactive || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Mengundurkan Diri</CardTitle>
              <UserMinus className="h-4 w-4 text-red-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800">{stats?.members?.suspended || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-50 border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-800">Total Seluruh Anggota</CardTitle>
              <Users className="h-4 w-4 text-slate-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{stats?.members?.total || 0}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Riwayat Mutasi Simpanan</CardTitle>
          </CardHeader>
          <CardContent>
            {(!simpanan?.transactions || simpanan.transactions.length === 0) ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Belum ada mutasi simpanan.</p>
            ) : (
              <div className="space-y-4">
                {simpanan.transactions.slice(0, 5).map((t: any) => (
                  <div key={t.id} className="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm font-semibold">{t.saving_name}</p>
                      <p className="text-xs text-muted-foreground">{new Date(t.transaction_at).toLocaleDateString('id-ID')}</p>
                    </div>
                    <div className={`font-bold text-sm ${t.type === 'deposit' ? 'text-green-600' : 'text-red-500'}`}>
                      {t.type === 'deposit' ? '+' : '-'}{formatRp(t.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Riwayat Belanja Terakhir</CardTitle>
          </CardHeader>
          <CardContent>
            {(!orders || orders.length === 0) ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Belum ada riwayat belanja.</p>
            ) : (
              <div className="space-y-4">
                {orders.slice(0, 5).map((o: any) => (
                  <div key={o.id} className="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0">
                    <div className="flex gap-3 items-center">
                      <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                        <Package className="h-4 w-4 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{o.order_no}</p>
                        <p className="text-xs text-muted-foreground">{new Date(o.ordered_at).toLocaleDateString('id-ID')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">{formatRp(o.grand_total)}</p>
                      <Badge variant="outline" className="text-[10px] mt-0.5">{o.payment_method.toUpperCase()}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal Riwayat Pinjaman */}
      <Dialog open={showLoanHistory} onOpenChange={setShowLoanHistory}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Riwayat & Detail Pinjaman Anda</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Notifikasi Approval & Dana Transfer */}
            {recentApprovals.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Pemberitahuan Pinjaman</h3>
                {recentApprovals.map((app: any) => (
                  <div key={app.id} className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm text-green-900">Pinjaman Disetujui ✓</p>
                      <p className="text-sm text-green-800 mt-1">
                        Pengajuan pinjaman {app.product_name} sebesar {formatRp(app.amount_requested)} telah <strong>DISETUJUI</strong> oleh pengurus/admin.
                      </p>
                      <p className="text-xs text-green-700 mt-2">
                        💰 <strong>Dana telah ditransfer ke rekening Anda.</strong> Silakan cek saldo simpanan atau konfirmasi dengan kasir.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Daftar Semua Pinjaman */}
            {allLoans.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Anda belum pernah mengajukan pinjaman.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Daftar Pinjaman</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {allLoans.map((loan: any) => (
                    <div 
                      key={loan.id}
                      onClick={() => setSelectedLoanId(selectedLoanId === loan.id ? null : loan.id)}
                      className="border rounded-lg p-3 cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-mono font-semibold text-sm">{loan.loan_no}</p>
                          <p className="text-xs text-muted-foreground">Pokok: {formatRp(loan.principal)} | Metode: {loan.repayment_method === "salary_cut" ? "Potong Gaji" : "Tunai"}</p>
                          <Link 
                            href={`/pinjaman/transaksi/${loan.id}`}
                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Lihat Jadwal Transaksi Lengkap →
                          </Link>
                        </div>
                        <Badge className={
                          loan.status === "active" ? "bg-green-100 text-green-700" :
                          loan.status === "paid_off" ? "bg-slate-100 text-slate-700" :
                          loan.status === "overdue" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                        }>
                          {loan.status === "active" ? "Aktif" : loan.status === "paid_off" ? "Lunas" : loan.status === "overdue" ? "Terlambat" : loan.status}
                        </Badge>
                      </div>
                      
                      {/* Jadwal Cicilan (Expand) */}
                      {selectedLoanId === loan.id && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-xs font-semibold mb-3">Jadwal Cicilan:</p>
                          <div className="max-h-48 overflow-y-auto border rounded">
                            <Table className="text-xs">
                              <TableHeader>
                                <TableRow className="bg-slate-50">
                                  <TableHead className="h-8">Tgl Jatuh Tempo</TableHead>
                                  <TableHead className="h-8">Pokok</TableHead>
                                  <TableHead className="h-8">Bunga</TableHead>
                                  <TableHead className="h-8">Total</TableHead>
                                  <TableHead className="h-8">Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {loan.loan_schedules?.map((schedule: any) => (
                                  <TableRow key={schedule.id} className="border-t">
                                    <TableCell className="py-2">{new Date(schedule.due_date).toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' })}</TableCell>
                                    <TableCell className="py-2">{formatRp(Number(schedule.principal_payment))}</TableCell>
                                    <TableCell className="py-2">{formatRp(Number(schedule.interest_payment))}</TableCell>
                                    <TableCell className="py-2">{formatRp(Number(schedule.total_payment))}</TableCell>
                                    <TableCell className="py-2">
                                      <Badge variant="outline" className="text-[10px]">
                                        {schedule.status === 'paid' ? 'Lunas' : schedule.status === 'pending' ? 'Menunggu' : schedule.status === 'overdue' ? 'Terlambat' : schedule.status}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                )) || <TableRow><TableCell colSpan={5} className="text-center py-2 text-muted-foreground">Belum ada jadwal cicilan</TableCell></TableRow>}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      </div>
      
      {/* Modul Promosi Mengambang Khusus PC */}
      <FloatingPromotions promotions={promotions} />
    </>
  )
}
