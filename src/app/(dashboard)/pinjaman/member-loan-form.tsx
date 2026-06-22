"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { submitLoanApplication } from "@/lib/actions/loans"
import { toast } from "sonner"
import { Plus } from "lucide-react"

export function MemberLoanForm({ loanProducts, memberId }: { loanProducts: any[], memberId: number }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(loanProducts[0]?.id?.toString() || "")
  const [form, setForm] = useState({
    amount_requested: "",
    tenor_months: "",
    repayment_method: "salary_cut",
    purpose: "",
    guarantor_name: "",
    guarantor_phone: "",
  })

  const product = loanProducts.find(p => p.id.toString() === selectedProduct)
  const formatRp = (v: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduct) return toast.error("Pilih produk pinjaman")
    
    const amount = Number(form.amount_requested)
    const tenor = parseInt(form.tenor_months)
    
    if (product) {
      if (amount < product.min_amount) {
        setLoading(false)
        return toast.error(`Minimal pinjaman adalah ${formatRp(product.min_amount)}`)
      }
      if (amount > product.max_amount) {
        setLoading(false)
        return toast.error(`Maksimal pinjaman adalah ${formatRp(product.max_amount)}`)
      }
      if (tenor < 1) {
        setLoading(false)
        return toast.error(`Tenor minimal adalah 1 bulan`)
      }
      if (tenor > product.max_tenor) {
        setLoading(false)
        return toast.error(`Tenor maksimal adalah ${product.max_tenor} bulan`)
      }
    }

    setLoading(true)
    const res = await submitLoanApplication({
      loan_product_id: Number(selectedProduct),
      amount_requested: Number(form.amount_requested),
      tenor_months: parseInt(form.tenor_months),
      repayment_method: form.repayment_method,
      purpose: form.purpose,
      guarantor_name: form.guarantor_name,
      guarantor_phone: form.guarantor_phone,
    })
    if (res.success) {
      toast.success("Pengajuan pinjaman berhasil dikirim! Menunggu review pengurus.")
      setOpen(false)
    } else {
      toast.error(res.error)
    }
    setLoading(false)
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" /> Ajukan Pinjaman
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Formulir Pengajuan Pinjaman</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-3">
              <Label className="text-base">Pilih Produk Pinjaman</Label>
              <RadioGroup value={selectedProduct} onValueChange={setSelectedProduct} className="grid grid-cols-1 gap-3">
                {loanProducts.map(p => (
                  <Label
                    key={p.id}
                    htmlFor={`loan-${p.id}`}
                    className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedProduct === p.id.toString() 
                        ? 'border-blue-600 bg-blue-50/50' 
                        : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <RadioGroupItem value={p.id.toString()} id={`loan-${p.id}`} className="mt-1" />
                    <div className="space-y-1 w-full">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-blue-900">{p.name}</span>
                        <span className="text-xs font-medium px-2 py-0.5 bg-white border rounded-full">{p.code}</span>
                      </div>
                      {p.description && (
                        <p className="text-xs text-indigo-700 italic font-medium">{p.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Min: {formatRp(p.min_amount)} | Max: {formatRp(p.max_amount)} <br/>
                        Tenor max: {p.max_tenor} bln | Bunga: {p.interest_rate}%/bln
                      </p>
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Jumlah Pinjaman (Rp)</Label>
                <Input 
                  type="number" 
                  required 
                  min={product?.min_amount} 
                  max={product?.max_amount} 
                  value={form.amount_requested} 
                  onChange={e => setForm(p => ({ ...p, amount_requested: e.target.value }))} 
                />
              </div>
              <div className="space-y-2">
                <Label>Tenor (bulan)</Label>
                <Input 
                  type="number" 
                  required 
                  min={1} 
                  max={product?.max_tenor} 
                  value={form.tenor_months} 
                  onChange={e => setForm(p => ({ ...p, tenor_months: e.target.value }))} 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Metode Pembayaran Cicilan</Label>
      <Select value={form.repayment_method} onValueChange={(v) => setForm(p => ({ ...p, repayment_method: v || p.repayment_method }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="salary_cut">Potong Gaji</SelectItem>
                  <SelectItem value="cash">Tunai</SelectItem>
                  <SelectItem value="saving_deduct">Potong Simpanan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tujuan Pinjaman</Label>
              <Textarea required value={form.purpose} onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))} rows={2} placeholder="Jelaskan tujuan penggunaan pinjaman..." />
            </div>
            {product?.requires_guarantor && (
              <div className="grid grid-cols-2 gap-4 p-3 border rounded-lg bg-amber-50">
                <div className="space-y-2">
                  <Label>Nama Penjamin</Label>
                  <Input required value={form.guarantor_name} onChange={e => setForm(p => ({ ...p, guarantor_name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>No. HP Penjamin</Label>
                  <Input required value={form.guarantor_phone} onChange={e => setForm(p => ({ ...p, guarantor_phone: e.target.value }))} />
                </div>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Mengirim Pengajuan..." : "Kirim Pengajuan Pinjaman"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
