"use client"

import React, { useState, useEffect, useId } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createProduct, updateProduct } from "@/lib/actions/products"
import { toast } from "sonner"
import { Plus, Upload, Image as ImageIcon } from "lucide-react"
import Image from "next/image"

export function ProductForm({ 
  units,
  categories, 
  productToEdit = null, 
  trigger 
}: { 
  units: any[], 
  categories: any[],
  productToEdit?: any,
  trigger?: React.ReactNode 
}) {
  const uniqueUploadId = useId()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    sku: productToEdit?.sku || "",
    name: productToEdit?.name || "",
    purchase_price: productToEdit?.purchase_price || "",
    price: productToEdit?.price || "",
    member_price: productToEdit?.member_price || "",
    stock: productToEdit?.stock || "",
    unit_measure: productToEdit?.unit_measure || "pcs",
    category_id: productToEdit?.category_id?.toString() || (categories.length > 0 ? categories[0].id.toString() : ""),
    unit_id: productToEdit?.unit_id?.toString() || (units.length > 0 ? units[0].id.toString() : ""),
    image_path: productToEdit?.image_path || "",
  })
  const [imagePreview, setImagePreview] = useState(productToEdit?.image_path || "")
  const [uploadingImage, setUploadingImage] = useState(false)

  // Reset data saat dialog dibuka untuk mode Edit
  useEffect(() => {
    if (open && productToEdit) {
      setFormData({
        sku: productToEdit.sku || "",
        name: productToEdit.name || "",
        purchase_price: productToEdit.purchase_price || "",
        price: productToEdit.price || "",
        member_price: productToEdit.member_price || "",
        stock: productToEdit.stock || "",
        unit_measure: productToEdit.unit_measure || "pcs",
        category_id: productToEdit.category_id?.toString() || (categories.length > 0 ? categories[0].id.toString() : ""),
        unit_id: productToEdit.unit_id?.toString() || (units.length > 0 ? units[0].id.toString() : ""),
        image_path: productToEdit.image_path || "",
      })
      setImagePreview(productToEdit.image_path || "")
    } else if (open && !productToEdit) {
      setFormData({
        sku: "", name: "", purchase_price: "", price: "", member_price: "",
        stock: "", unit_measure: "pcs", 
        category_id: categories.length > 0 ? categories[0].id.toString() : "",
        unit_id: units.length > 0 ? units[0].id.toString() : "",
        image_path: ""
      })
      setImagePreview("")
    }
  }, [open, productToEdit, categories, units])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) return toast.error("Hanya file gambar yang diperbolehkan")
    if (file.size > 5 * 1024 * 1024) return toast.error("Ukuran gambar maksimal 5MB")

    setUploadingImage(true)
    const fd = new FormData()
    fd.append("file", file)
    const res = await fetch("/api/upload", { method: "POST", body: fd })
    const data = await res.json()
    if (data.url) {
      setFormData(prev => ({ ...prev, image_path: data.url }))
      setImagePreview(data.url)
      toast.success("Gambar berhasil diupload")
    } else {
      toast.error("Upload gambar gagal")
    }
    setUploadingImage(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      // transform numbers
      const payload = {
        ...formData,
        purchase_price: Number(formData.purchase_price),
        price: Number(formData.price),
        member_price: formData.member_price ? Number(formData.member_price) : null,
        stock: Number(formData.stock)
      }

      const action = productToEdit ? updateProduct(productToEdit.id, payload) : createProduct(payload)
      const res = await action
      
      if (res.success) {
        toast.success(productToEdit ? "Barang diperbarui" : "Barang ditambahkan")
        setOpen(false)
      } else {
        toast.error(res.error)
      }
    } catch (err) {
      toast.error("Terjadi kesalahan sistem")
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && React.isValidElement(trigger)
        ? React.cloneElement(trigger, {
            onClick: () => setOpen(true),
          } as any)
        : (
            <DialogTrigger render={<Button />}>
              <Plus className="mr-2 h-4 w-4" /> Tambah Barang
            </DialogTrigger>
          )}
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{productToEdit ? "Edit Barang" : "Tambah Barang POS"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Foto Barang</Label>
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-900 shrink-0">
                {imagePreview ? (
                  <img src={imagePreview} alt="preview" className="object-cover rounded-lg w-full h-full" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-slate-300" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={uploadingImage}
                  onClick={() => document.getElementById(uniqueUploadId)?.click()}
                >
                  <Upload className="h-4 w-4" />
                  {uploadingImage ? "Mengupload..." : "Pilih Gambar"}
                </Button>
                <input
                  id={uniqueUploadId}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>
              <p className="text-xs text-muted-foreground">Max 5MB. JPG, PNG, WEBP.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>SKU / Kode Barang</Label>
              <Input placeholder="Auto generate jika kosong" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Nama Barang</Label>
              <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={formData.category_id} onValueChange={v => setFormData({...formData, category_id: v})}>
                <SelectTrigger><SelectValue placeholder="Kategori" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Stok Awal</Label>
              <div className="flex gap-2">
                <Input type="number" required value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} />
                <Input className="w-20" placeholder="pcs" value={formData.unit_measure} onChange={e => setFormData({...formData, unit_measure: e.target.value})} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Harga Beli (Modal)</Label>
            <Input type="number" required value={formData.purchase_price} onChange={e => setFormData({...formData, purchase_price: e.target.value})} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Harga Jual (Umum)</Label>
              <Input type="number" required value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Harga Spesial Anggota</Label>
              <Input type="number" placeholder="Kosongkan jika sama" value={formData.member_price} onChange={e => setFormData({...formData, member_price: e.target.value})} />
            </div>
          </div>
          
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Menyimpan..." : "Simpan Barang"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
