"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { submitLoanApplication, checkLoanRuleViolationsAction } from "@/lib/actions/loans"
import { toast } from "sonner"
import { Plus } from "lucide-react"

/**
 * Member loan application form dialog component.
 * Allows members to submit loan applications, validating limits and showing violations.
 * 
 * @param {Object} props - Properties.
 * @param {any[]} props.loanProducts - List of active loan products.
 * @param {number} props.memberId - Database ID of the current member.
 * @returns {React.ReactElement} The styled loan application form button and dialog.
 */
export function MemberLoanForm({ loanProducts, memberId }: { loanProducts: any[], memberId: number }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] = useState(loanProducts[0]?.id?.toString() || "")
  const [form, setForm] = useState({
    amount_requested: "",
    tenor_months: "",
    repayment_method: "salary_cut",
    purpose: "",
    guarantor_name: "",
    guarantor_phone: "",
  })
  const [ruleViolations, setRuleViolations] = useState<string[]>([])
  const [checkingRules, setCheckingRules] = useState(false)

  const checkRules = async (productId: string, amountStr: string) => {
    if (!productId) return
    setCheckingRules(true)
    try {
      const amt = Number(amountStr) || 0
      const res = await checkLoanRuleViolationsAction(Number(productId), amt)
      if (res.success) {
        setRuleViolations(res.violations)
      } else {
        setRuleViolations([])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setCheckingRules(false)
    }
  }

  useEffect(() => {
    if (open && selectedProduct) {
      const timer = setTimeout(() => {
        checkRules(selectedProduct, form.amount_requested)
      }, 300)
      return () => clearTimeout(timer)
    } else {
      setRuleViolations([])
    }
  }, [open, selectedProduct, form.amount_requested])

  const product = loanProducts.find((p: any) => p.id.toString() === selectedProduct)
  const formatRp = (v: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      setError(null)
    }
  }

  const handleProductChange = (productId: string) => {
    setSelectedProduct(productId)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!selectedProduct) {
      setError("Pilih produk pinjaman")
      return toast.error("Pilih produk pinjaman")
    }
    
    const amount = Number(form.amount_requested)
    const tenor = parseInt(form.tenor_months)
    
    if (product) {
      if (amount < product.min_amount) {
        setError(`Minimal pinjaman adalah ${formatRp(product.min_amount)}`)
        return toast.error(`Minimal pinjaman adalah ${formatRp(product.min_amount)}`)
      }
      if (amount > product.max_amount) {
        setError(`Maksimal pinjaman adalah ${formatRp(product.max_amount)}`)
        return toast.error(`Maksimal pinjaman adalah ${formatRp(product.max_amount)}`)
      }
      if (tenor < 1) {
        setError("Tenor minimal adalah 1 bulan")
        return toast.error("Tenor minimal adalah 1 bulan")
      }
      if (tenor > product.max_tenor) {
        setError(`Tenor maksimal adalah ${product.max_tenor} bulan`)
        return toast.error(`Tenor maksimal adalah ${product.max_tenor} bulan`)
      }
    }

    setLoading(true)
    try {
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
        setError(null)
      } else {
        toast.error(res.error)
        setError(res.error || "Gagal mengajukan pinjaman.")
      }
    } catch (err) {
      console.error("Failed to submit loan application:", err)
      setError("Terjadi kesalahan sistem saat memproses pengajuan Anda.")
      toast.error("Terjadi kesalahan sistem saat memproses pengajuan Anda.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button onClick={() => handleOpenChange(true)} className="gap-2">
        <Plus className="h-4 w-4" /> Ajukan Pinjaman
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Formulir Pengajuan Pinjaman</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-3">
              <Label className="text-base">Pilih Produk Pinjaman</Label>
              <RadioGroup value={selectedProduct} onValueChange={handleProductChange} className="grid grid-cols-1 gap-3">
                {loanProducts.map((p: any) => (
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
            
            {ruleViolations.length > 0 && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border-2 border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-300 rounded-xl text-sm space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2 font-bold text-red-950 dark:text-red-400">
                  <span className="text-lg">🚨</span>
                  <span>PERINGATAN ATURAN PINJAMAN:</span>
                </div>
                <ul className="list-disc pl-5 space-y-1 font-semibold text-red-800 dark:text-red-300">
                  {ruleViolations.map((v: any, i: any) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
                <p className="text-xs text-red-700 dark:text-red-400 italic font-semibold mt-1">
                  * Pengajuan ini akan otomatis ditolak oleh sistem karena melanggar aturan di atas.
                </p>
              </div>
            )}
            
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 rounded-xl text-sm flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
                <span className="text-base mt-0.5">⚠️</span>
                <div className="flex-1 font-medium">{error}</div>
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
