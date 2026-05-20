"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { createLoanProduct, updateLoanProduct } from "@/lib/actions/loan-products"
import { toast } from "sonner"
import { Plus } from "lucide-react"

const EMPTY_FORM = {
  code: "", name: "", interest_rate: "", interest_method: "flat",
  max_tenor: "", max_amount: "", min_amount: "500000",
  admin_fee_pct: "0", penalty_pct: "0",
  requires_guarantor: false, requirements: ""
}

export function LoanProductForm({ productToEdit = null, trigger }: { 
  productToEdit?: { 
    id: number; code: string; name: string; interest_rate: number; 
    interest_method: string; max_tenor: number; max_amount: number; 
    min_amount: number; admin_fee_pct: number; penalty_pct: number; 
    requires_guarantor: boolean; requirements: string | null
  } | null, 
  trigger?: React.ReactNode 
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(productToEdit ? {
    code: productToEdit.code,
    name: productToEdit.name,
    interest_rate: String(productToEdit.interest_rate),
    interest_method: productToEdit.interest_method,
    max_tenor: String(productToEdit.max_tenor),
    max_amount: String(productToEdit.max_amount),
    min_amount: String(productToEdit.min_amount),
    admin_fee_pct: String(productToEdit.admin_fee_pct),
    penalty_pct: String(productToEdit.penalty_pct),
    requires_guarantor: productToEdit.requires_guarantor,
    requirements: productToEdit.requirements || "",
  } : EMPTY_FORM)

  const set = (k: string, v: string | boolean) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const res = productToEdit
      ? await updateLoanProduct(productToEdit.id, form)
      : await createLoanProduct(form)
    if (res.success) {
      toast.success(productToEdit ? "Produk diperbarui" : "Produk ditambahkan")
      setOpen(false)
      if (!productToEdit) setForm(EMPTY_FORM)
    } else {
      toast.error(res.error)
    }
    setLoading(false)
  }

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)} className="cursor-pointer">{trigger}</span>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Tambah Produk Pinjaman
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{productToEdit ? "Edit Produk Pinjaman" : "Tambah Produk Pinjaman"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kode Produk</Label>
                <Input required value={form.code} onChange={e => set("code", e.target.value)} placeholder="cth: KP-01" />
              </div>
              <div className="space-y-2">
                <Label>Nama Produk</Label>
                <Input required value={form.name} onChange={e => set("name", e.target.value)} placeholder="cth: Pinjaman Reguler" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bunga per Bulan (%)</Label>
                <Input type="number" step="0.01" required value={form.interest_rate} onChange={e => set("interest_rate", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Metode Bunga</Label>
                <Select value={form.interest_method} onValueChange={v => set("interest_method", v ?? "flat")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Flat</SelectItem>
                    <SelectItem value="efektif">Efektif</SelectItem>
                    <SelectItem value="anuitas">Anuitas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tenor Max (bulan)</Label>
                <Input type="number" required value={form.max_tenor} onChange={e => set("max_tenor", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Min. Pinjaman (Rp)</Label>
                <Input type="number" required value={form.min_amount} onChange={e => set("min_amount", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Max. Pinjaman (Rp)</Label>
                <Input type="number" required value={form.max_amount} onChange={e => set("max_amount", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Biaya Admin (%)</Label>
                <Input type="number" step="0.01" value={form.admin_fee_pct} onChange={e => set("admin_fee_pct", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Denda Keterlambatan (%)</Label>
                <Input type="number" step="0.01" value={form.penalty_pct} onChange={e => set("penalty_pct", e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border">
              <Switch checked={form.requires_guarantor} onCheckedChange={v => set("requires_guarantor", v)} />
              <Label>Wajib Penjamin / Guarantor</Label>
            </div>
            <div className="space-y-2">
              <Label>Persyaratan (opsional)</Label>
              <Textarea value={form.requirements} onChange={e => set("requirements", e.target.value)} placeholder="Tuliskan persyaratan pengajuan..." rows={3} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan Produk"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
