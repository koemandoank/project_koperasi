"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody, DrawerFooter } from "@/components/ui/drawer"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  ShoppingCart, Plus, Minus, Trash2, Search, ShoppingBag,
  Truck, Package, QrCode, CreditCard, Banknote, CheckCircle
} from "lucide-react"
import { createOnlineOrder } from "@/lib/actions/online-orders"
import { toast } from "sonner"

const formatRp = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)

const PM_LABEL: Record<string, string> = { cash: "Tunai", paylater: "Paylater", qris: "QRIS" }
const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  pending:    { label: "Menunggu Konfirmasi", cls: "bg-amber-100 text-amber-700" },
  confirmed:  { label: "Dikonfirmasi",        cls: "bg-blue-100 text-blue-700" },
  processing: { label: "Sedang Disiapkan",    cls: "bg-indigo-100 text-indigo-700" },
  delivered:  { label: "Selesai",             cls: "bg-green-100 text-green-700" },
  cancelled:  { label: "Dibatalkan",          cls: "bg-red-100 text-red-700" },
}

export function TokoAnggotaClient({ products, orders }: { products: any[]; orders: any[] }) {
  const [tab, setTab] = useState<"belanja" | "riwayat">("belanja")
  const [search, setSearch] = useState("")
  const [cart, setCart] = useState<any[]>([])
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "paylater" | "qris">("paylater")
  const [deliveryType, setDeliveryType] = useState<"pickup" | "delivery">("pickup")
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)
  const [successOrder, setSuccessOrder] = useState("")

  const filtered = products.filter((p: any) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const addToCart = (product: any) => {
    setCart(prev => {
      const exist = prev.find((i: any) => i.id === product.id)
      if (exist) {
        if (exist.qty >= product.stock) return toast.error("Stok habis!"), prev
        return prev.map((i: any) => i.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, qty: 1, stock: product.stock }]
    })
  }

  const updateQty = (id: number, delta: number) => {
    setCart(prev => prev.map((i: any) => {
      if (i.id !== id) return i
      const nq = i.qty + delta
      if (nq > i.stock) { toast.error("Melebihi stok"); return i }
      return nq > 0 ? { ...i, qty: nq } : i
    }).filter((i: any) => i.qty > 0))
  }

  const grandTotal = cart.reduce((s: any, i: any) => s + i.price * i.qty, 0)

  const handleCheckout = async () => {
    if (cart.length === 0) return toast.error("Keranjang kosong")
    if (deliveryType === "delivery" && !deliveryAddress.trim()) return toast.error("Isi alamat pengiriman")
    setLoading(true)
    const res = await createOnlineOrder({ cart, paymentMethod, deliveryType, deliveryAddress, note })
    if (res.success) {
      setSuccessOrder(res.orderNo || "")
      setCart([])
      setCheckoutOpen(false)
    } else {
      toast.error(res.error)
    }
    setLoading(false)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Toko Koperasi</h1>
          <p className="text-muted-foreground">Belanja kebutuhan Anda secara online.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={tab === "belanja" ? "default" : "outline"} onClick={() => setTab("belanja")}>
            <ShoppingCart className="h-4 w-4 mr-2" /> Belanja
          </Button>
          <Button variant={tab === "riwayat" ? "default" : "outline"} onClick={() => setTab("riwayat")}>
            <ShoppingBag className="h-4 w-4 mr-2" /> Riwayat ({orders.length})
          </Button>
        </div>
      </div>

      {/* SUCCESS NOTICE */}
      {successOrder && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700">
          <CheckCircle className="h-6 w-6 shrink-0" />
          <div>
            <p className="font-bold">Pesanan berhasil dibuat!</p>
            <p className="text-sm">No. Pesanan: <strong>{successOrder}</strong> — Menunggu konfirmasi kasir.</p>
          </div>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSuccessOrder("")}>×</Button>
        </div>
      )}

      {tab === "belanja" ? (
        <div className="flex flex-col lg:grid lg:grid-cols-3 lg:items-start lg:gap-6">
          {/* Produk */}
          <div className="lg:col-span-2 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Cari barang..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="pb-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {filtered.map((p: any) => (
                  <Card key={p.id} className="cursor-pointer hover:border-blue-400 hover:shadow-md transition-all" onClick={() => addToCart(p)}>
                    <CardContent className="p-3 text-center flex flex-col items-center gap-2">
                      <div className="h-16 w-16 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                        {p.image_path
                          ? <img src={p.image_path} alt={p.name} className="object-cover w-full h-full" />
                          : <span className="font-bold text-slate-300 text-xl select-none">{p.name.slice(0, 2).toUpperCase()}</span>
                        }
                      </div>
                      <p className="font-semibold text-sm line-clamp-2 leading-tight">{p.name}</p>
                      <p className="font-bold text-blue-600 text-sm">{formatRp(p.member_price || p.price)}</p>
                      <Badge variant="outline" className="text-xs">Stok: {p.stock}</Badge>
                    </CardContent>
                  </Card>
                ))}
                {filtered.length === 0 && (
                  <div className="col-span-full py-10 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                    Barang tidak ditemukan
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Cart — Mobile: bottom-sheet fixed | Desktop: sticky floating panel */}
          <div className="hidden lg:block lg:sticky lg:top-6">
            <Card className="flex flex-col shadow-lg border-blue-100 overflow-hidden rounded-xl">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-white">
                <h3 className="font-bold flex items-center gap-2 text-sm">
                  <ShoppingCart className="h-4 w-4" />
                  Keranjang
                  {cart.length > 0 && (
                    <span className="ml-auto bg-white/20 text-white text-xs font-bold rounded-full px-2 py-0.5">
                      {cart.reduce((s: any, i: any) => s + i.qty, 0)} item
                    </span>
                  )}
                </h3>
              </div>

              {/* Item list — bounded height, scrollable */}
              <div className="overflow-y-auto max-h-[40vh] p-3 space-y-2">
                {cart.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    Klik barang untuk menambah
                  </div>
                ) : (
                  cart.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-center gap-2 border-b pb-2 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{item.name}</p>
                        <p className="text-xs text-blue-600 font-semibold">{formatRp(item.price)}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => updateQty(item.id, -1)} className="h-5 w-5 rounded-full border flex items-center justify-center hover:bg-slate-100">
                          <Minus className="h-2.5 w-2.5" />
                        </button>
                        <span className="w-4 text-center text-xs font-bold">{item.qty}</span>
                        <button onClick={() => updateQty(item.id, 1)} className="h-5 w-5 rounded-full border flex items-center justify-center hover:bg-slate-100">
                          <Plus className="h-2.5 w-2.5" />
                        </button>
                        <button onClick={() => setCart(c => c.filter((i: any) => i.id !== item.id))} className="ml-1 text-red-400 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer total + checkout */}
              {cart.length > 0 && (
                <div className="p-3 border-t bg-slate-50 dark:bg-slate-900 space-y-2">
                  <div className="flex justify-between text-sm font-bold">
                    <span>Total</span>
                    <span className="text-blue-600">{formatRp(grandTotal)}</span>
                  </div>
                  <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 text-xs" onClick={() => setCheckoutOpen(true)}>
                    Pesan Sekarang
                  </Button>
                </div>
              )}
            </Card>
          </div>

          {/* Mobile: Fixed bottom-sheet cart - elevated to sit above BottomNav */}
          <Card className="flex flex-col fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 right-0 lg:hidden rounded-t-2xl border-t shadow-2xl bg-white dark:bg-slate-950 z-40">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-white rounded-t-2xl">
              <h3 className="font-bold flex items-center gap-2 text-sm">
                <ShoppingCart className="h-4 w-4" /> Keranjang
                {cart.length > 0 && <span className="ml-auto font-normal text-xs opacity-80">{cart.reduce((s: any, i: any) =>s+i.qty,0)} item</span>}
              </h3>
            </div>
            <div className="overflow-y-auto max-h-40 p-3 space-y-2">
              {cart.length === 0 ? (
                <p className="text-center text-muted-foreground py-3 text-xs">Klik barang untuk menambah</p>
              ) : (
                cart.map((item: any) => (
                  <div key={item.id} className="flex justify-between items-center gap-2 border-b pb-1.5 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.name}</p>
                      <p className="text-[10px] text-blue-600">{formatRp(item.price)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.id, -1)} className="h-8 w-8 rounded-full border flex items-center justify-center active:bg-slate-100">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-4 text-center text-xs font-bold">{item.qty}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="h-8 w-8 rounded-full border flex items-center justify-center active:bg-slate-100">
                        <Plus className="h-3 w-3" />
                      </button>
                      <button onClick={() => setCart(c => c.filter((i: any) => i.id !== item.id))} className="ml-1 p-2 text-red-400 active:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {cart.length > 0 && (
              <div className="p-3 border-t">
                <div className="flex justify-between font-bold text-sm mb-2">
                  <span>Total</span>
                  <span className="text-blue-600">{formatRp(grandTotal)}</span>
                </div>
                <Button size="sm" className="w-full h-12 bg-green-600 hover:bg-green-700" onClick={() => setCheckoutOpen(true)}>
                  Pesan Sekarang
                </Button>
              </div>
            )}
          </Card>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <Card><CardContent className="pt-10 pb-10 text-center text-muted-foreground">Belum ada riwayat pesanan.</CardContent></Card>
          ) : (
            orders.map((o: any) => {
              const sc = ORDER_STATUS[o.order_status] || ORDER_STATUS.pending
              return (
                <Card key={o.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-4 flex justify-between items-center gap-4">
                    <div className="flex-1">
                      <p className="font-mono font-semibold text-sm">{o.order_no}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{o.item_count} item • {PM_LABEL[o.payment_method]} • {new Date(o.ordered_at).toLocaleDateString('id-ID')}</p>
                      {o.note && <p className="text-xs text-slate-500 mt-1 truncate">{o.note}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatRp(o.grand_total)}</p>
                      <Badge className={`${sc.cls} mt-1 text-xs`}>{sc.label}</Badge>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      )}

      {/* Checkout Drawer */}
      <Drawer open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DrawerContent showClose>
          <DrawerHeader>
            <DrawerTitle>Konfirmasi Pesanan Online</DrawerTitle>
          </DrawerHeader>
          <DrawerBody className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase font-semibold text-muted-foreground">Metode Pengambilan</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={deliveryType === "pickup" ? "default" : "outline"}
                  onClick={() => setDeliveryType("pickup")} className="h-12 gap-2">
                  <Package className="h-4 w-4" /> Ambil / Nitip
                </Button>
                <Button type="button" variant={deliveryType === "delivery" ? "default" : "outline"}
                  onClick={() => setDeliveryType("delivery")} className="h-12 gap-2">
                  <Truck className="h-4 w-4" /> Dikirim
                </Button>
              </div>
            </div>
            {deliveryType === "delivery" && (
              <div className="space-y-2">
                <Label>Alamat Pengiriman</Label>
                <Textarea rows={2} placeholder="Tuliskan alamat lengkap..." value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} className="text-base" />
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs uppercase font-semibold text-muted-foreground">Pembayaran</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["cash", "paylater", "qris"] as const).map((m: any) => (
                  <Button key={m} type="button" variant={paymentMethod === m ? "default" : "outline"}
                    className="flex-col h-auto py-3 gap-1 active:bg-slate-100" onClick={() => setPaymentMethod(m)}>
                    {m === "cash" && <Banknote className="h-5 w-5" />}
                    {m === "paylater" && <CreditCard className="h-5 w-5" />}
                    {m === "qris" && <QrCode className="h-5 w-5" />}
                    <span className="text-[10px] uppercase font-semibold">{PM_LABEL[m]}</span>
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Catatan untuk Kasir (opsional)</Label>
              <Textarea rows={2} placeholder="Pesan tambahan, waktu pengambilan, dll..." value={note} onChange={e => setNote(e.target.value)} className="text-base" />
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-3">
              <span>Total</span>
              <span className="text-blue-600">{formatRp(grandTotal)}</span>
            </div>
          </DrawerBody>
          <DrawerFooter>
            <Button className="w-full h-12 bg-green-600 hover:bg-green-700 active:bg-green-800 text-base font-semibold" onClick={handleCheckout} disabled={loading}>
              {loading ? "Mengirim..." : "Kirim Pesanan"}
            </Button>
            <Button variant="ghost" className="w-full h-12" onClick={() => setCheckoutOpen(false)}>Batal</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
