"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShoppingCart, TrendingUp, AlertCircle, XOctagon, Package, BellRing, CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { requestRestock } from "@/lib/actions/stock-alerts"
import { toast } from "sonner"

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
        <div className="h-4 w-4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-28 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse mb-1" />
        <div className="h-3 w-36 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
      </CardContent>
    </Card>
  )
}

function EmptyState({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
        <Icon className="h-6 w-6 text-zinc-400" />
      </div>
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{title}</p>
      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">{description}</p>
    </div>
  )
}

export function KasirDashboard({ data, companyName = "Koperasi" }: { data: any; companyName?: string }) {
  const [loadingItems, setLoadingItems] = useState<Record<number, boolean>>({})

  const handleRequestRestock = async (productId: number) => {
    setLoadingItems(prev => ({ ...prev, [productId]: true }))
    try {
      const res = await requestRestock(productId)
      if (res.success) {
        toast.success(res.message)
      } else {
        toast.error(res.message)
      }
    } catch {
      toast.error("Gagal mengirim permintaan restock")
    } finally {
      setLoadingItems(prev => ({ ...prev, [productId]: false }))
    }
  }

  // Loading state
  if (!data) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-1">
          <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
          <div className="h-4 w-36 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse mt-1" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <div className="h-5 w-48 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1,2,3].map(i => <div key={i} className="h-12 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />)}
              </div>
            </CardContent>
          </Card>
          <Card className="col-span-3">
            <CardHeader>
              <div className="h-5 w-36 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1,2,3].map(i => <div key={i} className="h-12 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />)}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight font-heading">{companyName}</h1>
        <p className="text-sm text-muted-foreground font-medium">Dashboard Kasir (POS)</p>
      </div>
      
      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Penjualan Hari Ini</CardTitle>
            <ShoppingCart className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading tracking-tight">
              Rp {data.dailySales?.toLocaleString("id-ID") ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Dari {data.transactionsCount ?? 0} transaksi hari ini
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-info">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Kasir</CardTitle>
            <TrendingUp className="h-4 w-4 text-info" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading tracking-tight">
              Rp {data.cashierBalance?.toLocaleString("id-ID") ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pembayaran tunai laci hari ini
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-warning">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Peringatan Stok</CardTitle>
            <AlertCircle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading tracking-tight text-warning">
              {data.inventoryAlerts ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Barang mencapai batas minimum
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-destructive">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Transaksi Batal</CardTitle>
            <XOctagon className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading tracking-tight">
              {data.voidRefundLogs ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Transaksi batal / refund hari ini
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Package className="h-4 w-4 text-primary" />
              Top 5 Produk Terlaris
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topProducts && data.topProducts.length > 0 ? (
              <div className="space-y-5">
                {data.topProducts.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={[
                        "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                        i === 0 ? "bg-primary text-primary-foreground" :
                        i === 1 ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300" :
                        i === 2 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                        "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                      ].join(" ")}>
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.qty} terjual</p>
                      </div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums">
                      Rp {item.revenue?.toLocaleString("id-ID") ?? 0}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Package} title="Belum ada transaksi" description="Transaksi hari ini akan muncul di sini" />
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Stok Menipis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.lowStockItems && data.lowStockItems.length > 0 ? (
              <div className="space-y-3">
                {data.lowStockItems.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3 last:border-0 last:pb-0">
                    <div className="min-w-0 flex-1 mr-2">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Sisa: <span className="text-destructive font-bold tabular-nums">{item.stock}</span>
                        <span className="text-zinc-400"> / Min: {item.min_stock}</span>
                      </p>
                    </div>
                    {item.po_status ? (
                      <span className="shrink-0 flex items-center text-[10px] text-info bg-info/10 border border-info/20 px-2 py-1 rounded-lg gap-1 font-medium whitespace-nowrap">
                        <CheckCircle2 className="h-3 w-3" />
                        {item.po_status === "draft" ? "PO Draft" :
                         item.po_status === "approved" ? "PO Disetujui" :
                         item.po_status === "processed" ? "PO Diproses" : "In PO"}
                      </span>
                    ) : item.restock_requested ? (
                      <span className="shrink-0 flex items-center text-[10px] text-primary bg-primary/10 px-2 py-1 rounded-lg gap-1 font-medium whitespace-nowrap">
                        <CheckCircle2 className="h-3 w-3" /> Diajukan
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] gap-1 shrink-0 px-2.5"
                        disabled={loadingItems[item.id]}
                        onClick={() => handleRequestRestock(item.id)}
                      >
                        {loadingItems[item.id] ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <BellRing className="h-3 w-3" />
                        )}
                        Ajukan
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={CheckCircle2} title="Stok aman" description="Semua produk dalam batas normal" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
