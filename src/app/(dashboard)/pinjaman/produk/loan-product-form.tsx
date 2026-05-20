"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody, DrawerFooter } from "@/components/ui/drawer"
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
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent showClose>
          <DrawerHeader>
            <DrawerTitle>{productToEdit ? "Edit Produk Pinjaman" : "Tambah Produk Pinjaman"}</DrawerTitle>
          </DrawerHeader>
          <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <DrawerBody className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="font-semibold text-sm">Kode Produk <span className="text-red-500">*</span></Label>
                  <Input required value={form.code} onChange={e => set("code", e.target.value)} placeholder="cth: KP-01" className="h-12 text-base font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="font-semibold text-sm">Nama Produk <span className="text-red-500">*</span></Label>
                  <Input required value={form.name} onChange={e => set("name", e.target.value)} placeholder="cth: Pinjaman Reguler" className="h-12 text-base" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="font-semibold text-sm">Bunga per Bulan (%) <span className="text-red-500">*</span></Label>
                  <Input type="number" step="0.01" required value={form.interest_rate} onChange={e => set("interest_rate", e.target.value)} className="h-12" />
                </div>
                <div className="space-y-1">
                  <Label className="font-semibold text-sm">Metode Bunga</Label>
                  <Select value={form.interest_method} onValueChange={v => set("interest_method", v ?? "flat")}>
                    <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Flat</SelectItem>
                      <SelectItem value="efektif">Efektif</SelectItem>
                      <SelectItem value="anuitas">Anuitas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="font-semibold text-sm">Tenor Max (bln)</Label>
                  <Input type="number" required value={form.max_tenor} onChange={e => set("max_tenor", e.target.value)} className="h-12" />
                </div>
                <div className="space-y-1">
                  <Label className="font-semibold text-sm">Min (Rp)</Label>
                  <Input type="number" required value={form.min_amount} onChange={e => set("min_amount", e.target.value)} className="h-12" />
                </div>
                <div className="space-y-1">
                  <Label className="font-semibold text-sm">Max (Rp)</Label>
                  <Input type="number" required value={form.max_amount} onChange={e => set("max_amount", e.target.value)} className="h-12" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="font-semibold text-sm">Biaya Admin (%)</Label>
                  <Input type="number" step="0.01" value={form.admin_fee_pct} onChange={e => set("admin_fee_pct", e.target.value)} className="h-12" />
                </div>
                <div className="space-y-1">
                  <Label className="font-semibold text-sm">Denda (%)</Label>
                  <Input type="number" step="0.01" value={form.penalty_pct} onChange={e => set("penalty_pct", e.target.value)} className="h-12" />
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border">
                <div>
                  <p className="text-sm font-semibold">Wajib Penjamin</p>
                  <p className="text-xs text-slate-400">Memerlukan persetujuan penjamin.</p>
                </div>
                <Switch checked={form.requires_guarantor} onCheckedChange={v => set("requires_guarantor", v)} />
              </div>
              <div className="space-y-1">
                <Label className="font-semibold text-sm">Persyaratan (opsional)</Label>
                <Textarea value={form.requirements} onChange={e => set("requirements", e.target.value)} placeholder="Tuliskan persyaratan pengajuan..." rows={3} className="text-base" />
              </div>
            </DrawerBody>
            <DrawerFooter>
              <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
                {loading ? "Menyimpan..." : "Simpan Produk"}
              </Button>
              <Button type="button" variant="ghost" className="w-full h-12" onClick={() => setOpen(false)}>Batal</Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    </>
  )
}
