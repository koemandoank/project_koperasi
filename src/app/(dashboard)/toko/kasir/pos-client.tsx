"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, QrCode, Banknote, UserCheck, X, Maximize, Minimize } from "lucide-react"
import { toast } from "sonner"
import { processPosCheckout } from "@/lib/actions/pos"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"

export function PosClient({ products, members, sessionActive = true }: { products: any[], members: any[], sessionActive?: boolean }) {
  const [searchQuery, setSearchQuery] = useState("")
  const [cart, setCart] = useState<any[]>([])
  const [memberSearch, setMemberSearch] = useState("")
  const [selectedMember, setSelectedMember] = useState<any | null>(null)
  const [showMemberSuggestions, setShowMemberSuggestions] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "paylater" | "qris">("cash")
  
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [qrisModalOpen, setQrisModalOpen] = useState(false)
  const [successModalOpen, setSuccessModalOpen] = useState(false)
  const [lastOrderNo, setLastOrderNo] = useState("")
  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  const filteredProducts = products.filter((p: any) => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const isMemberSelected = !!selectedMember

  const memberSuggestions = memberSearch.trim().length >= 2
    ? members.filter((m: any) =>
        m.full_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.nik.includes(memberSearch)
      ).slice(0, 8)
    : []
  
  const addToCart = (product: any) => {
    if (product.stock <= 0) return toast.error("Stok barang habis!")
    
    setCart(prev => {
      const existing = prev.find((item: any) => item.id === product.id)
      if (existing) {
        if (existing.qty >= product.stock) {
          toast.error("Melebihi stok yang tersedia!")
          return prev
        }
        return prev.map((item: any) => item.id === product.id ? { ...item, qty: item.qty + 1 } : item)
      }
      
      // Determine price based on member status
      const priceToUse = (isMemberSelected && product.member_price) ? product.member_price : product.price
      
      return [...prev, {
        id: product.id,
        name: product.name,
        price: priceToUse,
        qty: 1,
        stock: product.stock
      }]
    })
  }

  const updateQty = (id: number, delta: number) => {
    setCart(prev => prev
      .map((item: any) => {
        if (item.id !== id) return item
        const newQty = item.qty + delta
        if (newQty > item.stock) {
          toast.error("Melebihi stok yang tersedia!")
          return item
        }
        return { ...item, qty: newQty }
      })
      .filter((item: any) => item.qty > 0)
    )
  }

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter((item: any) => item.id !== id))
  }

  // Recalculate cart prices if member selection changes
  useEffect(() => {
    setCart(prev => prev.map((item: any) => {
      const product = products.find((p: any) => p.id === item.id)
      if (!product) return item
      const newPrice = (isMemberSelected && product.member_price) ? product.member_price : product.price
      return { ...item, price: newPrice }
    }))
  }, [isMemberSelected, products])

  const subtotal = cart.reduce((acc: any, item: any) => acc + (item.price * item.qty), 0)
  const discount = 0
  const grandTotal = subtotal - discount

  const handleCheckoutProcess = async () => {
    if (!sessionActive) return toast.error("Buka sesi kasir terlebih dahulu!")
    if (cart.length === 0) return toast.error("Keranjang kosong")
    if (paymentMethod === "paylater" && !isMemberSelected) {
      return toast.error("Pembayaran Bayar Tempo wajib memilih Anggota!")
    }

    setCheckoutLoading(true)
    const payload = {
      cart,
      memberId: selectedMember ? selectedMember.id : null,
      paymentMethod,
      subtotal,
      discount,
      grandTotal
    }

    const res = await processPosCheckout(payload)
    if (res.success) {
      setLastOrderNo(res.orderNo || "")
      setCart([])
      setQrisModalOpen(false)
      setSuccessModalOpen(true)
    } else {
      toast.error(res.error)
    }
    setCheckoutLoading(false)
  }

  const handlePayClick = () => {
    if (!sessionActive) return toast.error("Buka sesi kasir terlebih dahulu!")
    if (cart.length === 0) return toast.error("Keranjang kosong")
    if (paymentMethod === "paylater" && !selectedMember) {
      return toast.error("Pembayaran Bayar Tempo wajib memilih Anggota!")
    }
    
    if (paymentMethod === "qris") {
      setQrisModalOpen(true)
    } else {
      handleCheckoutProcess()
    }
  }

  const formatRp = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-[1fr_380px] lg:items-start lg:gap-4 p-0">
      {/* === PRODUCT AREA === */}
      <div className="flex flex-col gap-4 pb-52 lg:pb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Cari barang berdasarkan nama atau kode..."
            className="pl-9 bg-white dark:bg-slate-900 border-slate-200 shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        {/* Mobile: Scrollable products, Desktop: Fixed height */}
        <div className="flex-1 overflow-auto pr-2 pb-4 lg:pb-20">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map((p: any) => {
              const isLowStock = p.stock <= p.min_stock
              const activePrice = (isMemberSelected && p.member_price) ? p.member_price : p.price
              
              return (
                <Card 
                  key={p.id} 
                  className={`cursor-pointer hover:border-blue-500 transition-all ${p.stock <= 0 ? 'opacity-50 grayscale' : 'hover:shadow-md'}`}
                  onClick={() => p.stock > 0 && addToCart(p)}
                >
                  <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-lg mb-2 flex items-center justify-center text-slate-400 font-bold text-xl uppercase overflow-hidden relative">
                      {p.image_path ? (
                        <img src={p.image_path} alt={p.name} className="object-cover w-full h-full" />
                      ) : (
                        p.name.substring(0,2)
                      )}
                    </div>
                    <div className="font-semibold text-sm line-clamp-2 min-h-[40px] leading-tight">{p.name}</div>
                    <div className="font-bold text-blue-600">{formatRp(activePrice)}</div>
                    <Badge variant={p.stock > 0 ? "outline" : "destructive"} className="mt-1 text-xs">
                      Stok: {p.stock}
                    </Badge>
                  </CardContent>
                </Card>
              )
            })}
            {filteredProducts.length === 0 && (
              <div className="col-span-full py-10 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                Barang tidak ditemukan
              </div>
            )}
          </div>
        </div>
      </div>

      {/* === CART PANEL — Desktop: sticky right column | Mobile: fixed bottom-sheet === */}

      {/* Desktop cart */}
      <div className="hidden lg:flex lg:sticky lg:top-6 flex-col gap-0">
        <Card className="flex flex-col overflow-hidden rounded-xl shadow-lg border-blue-100 max-h-[calc(100vh-6rem)]">
          {/* Cart header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-white shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" /> Keranjang Belanja
              </h3>
              <button
                onClick={toggleFullscreen}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                title={isFullscreen ? "Keluar Fullscreen" : "Mode Fullscreen"}
              >
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Member search */}
          <div className="px-3 py-2 border-b bg-slate-50 dark:bg-slate-900/50 space-y-1.5 shrink-0">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Pelanggan (NIK / Nama)</label>
            {selectedMember ? (
              <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-1.5">
                <UserCheck className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-xs text-blue-800 truncate">{selectedMember.full_name}</p>
                  <p className="text-[10px] text-blue-600">NIK: {selectedMember.nik}</p>
                </div>
                <button onClick={() => { setSelectedMember(null); setMemberSearch("") }} className="text-blue-400 hover:text-red-500">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  className="bg-white h-8 text-xs"
                  placeholder="Umum (ketik NIK atau nama...)"
                  value={memberSearch}
                  onChange={e => { setMemberSearch(e.target.value); setShowMemberSuggestions(true) }}
                  onFocus={() => setShowMemberSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowMemberSuggestions(false), 150)}
                />
                {showMemberSuggestions && memberSuggestions.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
                    {memberSuggestions.map((m: any) => (
                      <button
                        key={m.id}
                        className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-xs border-b last:border-0"
                        onMouseDown={() => { setSelectedMember(m); setMemberSearch(""); setShowMemberSuggestions(false) }}
                      >
                        <p className="font-medium">{m.full_name}</p>
                        <p className="text-[10px] text-muted-foreground">NIK: {m.nik}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cart items — scrollable */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[80px]">
            {cart.length === 0 ? (
              <div className="h-24 flex flex-col items-center justify-center text-muted-foreground opacity-40 gap-2">
                <ShoppingCart className="h-8 w-8" />
                <p className="text-xs">Keranjang kosong</p>
              </div>
            ) : (
              cart.map((item: any) => (
                <div key={item.id} className="flex justify-between items-start gap-2 border-b pb-2 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs leading-tight">{item.name}</p>
                    <p className="text-[10px] text-blue-600 font-semibold">{formatRp(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="outline" size="icon" className="h-5 w-5 rounded-full" onClick={() => updateQty(item.id, -1)}>
                      <Minus className="h-2.5 w-2.5" />
                    </Button>
                    <span className="w-5 text-center text-xs font-semibold">{item.qty}</span>
                    <Button variant="outline" size="icon" className="h-5 w-5 rounded-full" onClick={() => updateQty(item.id, 1)}>
                      <Plus className="h-2.5 w-2.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-red-500" onClick={() => removeFromCart(item.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Payment + total + pay button */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t space-y-2 shrink-0">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatRp(subtotal)}</span>
            </div>
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span className="text-blue-600">{formatRp(grandTotal)}</span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <Button
                type="button" size="sm"
                variant={paymentMethod === "cash" ? "default" : "outline"}
                className={`flex-col h-auto py-1.5 gap-0.5 text-[10px] ${paymentMethod === 'cash' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                onClick={() => setPaymentMethod("cash")}
              >
                <Banknote className="h-3.5 w-3.5" />
                Tunai
              </Button>
              <Button
                type="button" size="sm"
                variant={paymentMethod === "paylater" ? "default" : "outline"}
                className={`flex-col h-auto py-1.5 gap-0.5 text-[10px] ${paymentMethod === 'paylater' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                onClick={() => setPaymentMethod("paylater")}
              >
                <CreditCard className="h-3.5 w-3.5" />
                Bayar Tempo
              </Button>
              <Button
                type="button" size="sm"
                variant={paymentMethod === "qris" ? "default" : "outline"}
                className={`flex-col h-auto py-1.5 gap-0.5 text-[10px] ${paymentMethod === 'qris' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                onClick={() => setPaymentMethod("qris")}
              >
                <QrCode className="h-3.5 w-3.5" />
                QRIS
              </Button>
            </div>

            <Button
              className="w-full h-10 text-sm font-bold bg-green-600 hover:bg-green-700 text-white disabled:opacity-60"
              onClick={handlePayClick}
              disabled={checkoutLoading || cart.length === 0 || !sessionActive}
              title={!sessionActive ? "Buka sesi kasir terlebih dahulu" : undefined}
            >
              {!sessionActive ? "⚠ Sesi Belum Dibuka" : checkoutLoading ? "Memproses..." : `Bayar ${formatRp(grandTotal)}`}
            </Button>
          </div>
        </Card>
      </div>

      {/* Mobile: fixed bottom-sheet cart */}
      <Card className="flex flex-col fixed bottom-0 left-0 right-0 lg:hidden rounded-t-2xl border-t shadow-2xl bg-white dark:bg-slate-950 z-40">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-white rounded-t-2xl">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" /> Keranjang
            {cart.length > 0 && (
              <span className="ml-auto font-normal text-xs opacity-80">
                {cart.reduce((s: any, i: any) => s + i.qty, 0)} item
              </span>
            )}
          </h3>
        </div>
        <div className="overflow-y-auto max-h-36 p-3 space-y-1.5">
          {cart.length === 0 ? (
            <p className="text-center text-muted-foreground py-3 text-xs">Keranjang kosong</p>
          ) : (
            cart.map((item: any) => (
              <div key={item.id} className="flex justify-between items-center gap-2 border-b pb-1.5 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{item.name}</p>
                  <p className="text-[10px] text-blue-600">{formatRp(item.price)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => updateQty(item.id, -1)} className="h-5 w-5 rounded-full border flex items-center justify-center hover:bg-slate-100">
                    <Minus className="h-2.5 w-2.5" />
                  </button>
                  <span className="w-4 text-center text-xs font-bold">{item.qty}</span>
                  <button onClick={() => updateQty(item.id, 1)} className="h-5 w-5 rounded-full border flex items-center justify-center hover:bg-slate-100">
                    <Plus className="h-2.5 w-2.5" />
                  </button>
                  <button onClick={() => removeFromCart(item.id)} className="ml-1 text-red-400 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        {cart.length > 0 && (
          <div className="p-3 border-t space-y-2">
            <div className="grid grid-cols-3 gap-1.5">
              {(["cash", "paylater", "qris"] as const).map((m: any) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`flex flex-col items-center py-1.5 rounded-lg border text-[10px] font-semibold gap-0.5 transition-colors ${paymentMethod === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}
                >
                  {m === "cash" && <Banknote className="h-3.5 w-3.5" />}
                  {m === "paylater" && <CreditCard className="h-3.5 w-3.5" />}
                  {m === "qris" && <QrCode className="h-3.5 w-3.5" />}
                  {m === "cash" ? "Tunai" : m === "paylater" ? "Bayar Tempo" : "QRIS"}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-bold text-sm">{formatRp(grandTotal)}</span>
              <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 font-bold"
                onClick={handlePayClick}
                disabled={checkoutLoading || !sessionActive}
              >
                {!sessionActive ? "⚠ Sesi Tutup" : checkoutLoading ? "Memproses..." : "Bayar"}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* QRIS Modal */}
      <Dialog open={qrisModalOpen} onOpenChange={setQrisModalOpen}>
        <DialogContent className="sm:max-w-md text-center flex flex-col items-center justify-center p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl mb-2 text-center">Pembayaran QRIS</DialogTitle>
            <DialogDescription className="text-center">
              Silakan scan QR Code di bawah ini dengan aplikasi M-Banking atau E-Wallet Anda.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-white p-4 rounded-xl border shadow-sm my-6">
            <QrCode className="w-48 h-48 text-slate-800" />
          </div>
          <div className="font-bold text-3xl text-blue-600 mb-6">
            {formatRp(grandTotal)}
          </div>
          <Button 
            className="w-full h-12 text-lg font-bold" 
            onClick={handleCheckoutProcess}
            disabled={checkoutLoading}
          >
            {checkoutLoading ? "Memverifikasi..." : "Simulasikan Pembayaran Berhasil"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      <Dialog open={successModalOpen} onOpenChange={setSuccessModalOpen}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <DialogTitle className="text-center text-green-600 text-2xl">Transaksi Berhasil!</DialogTitle>
          </DialogHeader>
          <div className="py-8 flex flex-col items-center justify-center">
            <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Banknote className="h-10 w-10 text-green-600" />
            </div>
            <p className="text-muted-foreground">Nomor Pesanan / Invoice:</p>
            <p className="font-mono text-xl font-bold">{lastOrderNo}</p>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setSuccessModalOpen(false)}>Selesai</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
