"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { DollarSign, Users, Activity, FileCheck } from "lucide-react"
import { RestockNotificationWidget } from "@/components/shared/restock-notification-widget"

type Supplier = { id: number; supplier_name: string }
type RestockItem = {
  id: number; name: string; sku: string; stock: number
  min_stock: number; purchase_price: number; category: string
}

export function PengurusDashboard({ data, suppliers, companyName = "Koperasi" }: { data: any; suppliers: Supplier[]; companyName?: string }) {
  if (!data) return <div>Loading...</div>

  const restockAlerts: RestockItem[] = data.restockAlerts ?? []

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">{companyName}</h1>
        <p className="text-sm text-muted-foreground font-medium">Dashboard Administrator / Pengurus</p>
      </div>
      
      {/* RESTOCK NOTIFICATION WIDGET */}
      <RestockNotificationWidget restockAlerts={restockAlerts} suppliers={suppliers} />

      {/* SUMMARY STATS */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Laba / Rugi Berjalan</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              Rp {data.currentSHU.toLocaleString('id-ID')}
            </div>
            <p className="text-xs text-muted-foreground">SHU Projection</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Asset Liquidity</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              Rp {data.assetLiquidity.toLocaleString('id-ID')}
            </div>
            <p className="text-xs text-muted-foreground">Total saldo kas &amp; bank</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Statistik Anggota</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.memberStats.active} Aktif</div>
            <p className="text-xs text-muted-foreground">
              +{data.memberStats.newThisMonth} anggota baru bulan ini (Total: {data.memberStats.total})
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approval Center</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.pendingApprovals.total}</div>
            <p className="text-xs text-muted-foreground">
              {data.pendingApprovals.loans} Pinjaman | {data.pendingApprovals.stockAdjustments} Stok
            </p>
          </CardContent>
        </Card>
      </div>

      {/* SHU CHART */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-7">
          <CardHeader>
            <CardTitle>Distribusi Laba / SHU (5 Tahun Terakhir)</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.shuHistory}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => `Rp ${(value/1000000).toFixed(0)}M`} />
                  <Tooltip formatter={(value) => [`Rp ${Number(value).toLocaleString('id-ID')}`, 'SHU']} />
                  <Bar dataKey="amount" fill="currentColor" className="fill-primary" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
