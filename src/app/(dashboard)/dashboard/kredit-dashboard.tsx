"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CreditCard, AlertTriangle, Wallet, FileText, TrendingUp } from "lucide-react"

export function KreditDashboard({ data, companyName = "Koperasi" }: { data: any; companyName?: string }) {
  if (!data) return <div>Loading...</div>

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">{companyName}</h1>
        <p className="text-sm text-muted-foreground font-medium">Dashboard Admin Kredit (Simpan Pinjam)</p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Loan Outstanding</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              Rp {data.loanOutstanding.toLocaleString('id-ID')}
            </div>
            <p className="text-xs text-muted-foreground">Dana dipinjamkan</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">NPL (Kredit Macet)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              Rp {data.nplAmount.toLocaleString('id-ID')}
            </div>
            <p className="text-xs text-muted-foreground">Nilai tagihan tertunggak</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Collection</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              Rp {data.todayCollectionTotal.toLocaleString('id-ID')}
            </div>
            <p className="text-xs text-muted-foreground">
              Dari {data.todayCollectionsCount} tagihan hari ini
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Applications</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.pendingApplications}</div>
            <p className="text-xs text-muted-foreground">Pengajuan butuh verifikasi</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Pertumbuhan Simpanan (Bulan Ini)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <TrendingUp className="h-10 w-10 text-primary" />
              <div>
                <div className="text-4xl font-bold">Rp {data.savingsGrowth.toLocaleString('id-ID')}</div>
                <p className="text-muted-foreground">Simpanan Pokok, Wajib, Sukarela masuk</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
