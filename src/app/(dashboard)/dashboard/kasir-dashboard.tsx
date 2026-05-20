"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShoppingCart, AlertCircle, TrendingUp, Package, XOctagon, BellRing, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { requestRestock } from "@/lib/actions/stock-alerts"
import { toast } from "sonner"

export function KasirDashboard({ data }: { data: any }) {
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
    } catch (e) {
      toast.error('Gagal mengirim permintaan restock')
    } finally {
      setLoadingItems(prev => ({ ...prev, [productId]: false }))
    }
  }

  if (!data) return <div>Loading...</div>

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard Kasir (POS)</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Sales Summary</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              Rp {data.dailySales.toLocaleString('id-ID')}
            </div>
            <p className="text-xs text-muted-foreground">Dari {data.transactionsCount} transaksi hari ini</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cashier Balance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              Rp {data.cashierBalance.toLocaleString('id-ID')}
            </div>
            <p className="text-xs text-muted-foreground">Pembayaran tunai laci hari ini</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventory Alert</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{data.inventoryAlerts}</div>
            <p className="text-xs text-muted-foreground">Barang mencapai batas minimum</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Void/Refund Logs</CardTitle>
            <XOctagon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.voidRefundLogs}</div>
            <p className="text-xs text-muted-foreground">Transaksi batal hari ini</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" /> Top 5 Produk Laku (Fast Moving)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {data.topProducts && data.topProducts.length > 0 ? (
                data.topProducts.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="bg-primary/10 w-8 h-8 rounded-full flex items-center justify-center font-bold text-primary">
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">{item.qty} terjual</p>
                      </div>
                    </div>
                    <div className="font-medium">
                      Rp {item.revenue.toLocaleString('id-ID')}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Belum ada transaksi hari ini
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" /> Stok Menipis (Butuh Restock)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.lowStockItems && data.lowStockItems.length > 0 ? (
                data.lowStockItems.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                    <div>
                      <p className="font-medium text-sm line-clamp-1">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Sisa: <span className="text-destructive font-bold">{item.stock}</span> (Min: {item.min_stock})
                      </p>
                    </div>
                    {item.po_status ? (
                      <span className="flex items-center text-xs text-blue-600 bg-blue-50 border border-blue-200 px-2 py-1 rounded gap-1 font-medium">
                        <CheckCircle2 className="h-3 w-3" /> 
                        {item.po_status === 'draft' ? 'PO Draft' : 
                         item.po_status === 'approved' ? 'PO Disetujui' : 
                         item.po_status === 'processed' ? 'PO Diproses' : 'In PO'}
                      </span>
                    ) : item.restock_requested ? (
                      <span className="flex items-center text-xs text-green-600 bg-green-50 px-2 py-1 rounded gap-1 font-medium">
                        <CheckCircle2 className="h-3 w-3" /> Diajukan
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1"
                        disabled={loadingItems[item.id]}
                        onClick={() => handleRequestRestock(item.id)}
                      >
                        <BellRing className="h-3 w-3" /> Ajukan
                      </Button>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8 text-sm">
                  Semua stok produk aman
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
