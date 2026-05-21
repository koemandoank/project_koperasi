"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Eye, UploadCloud } from "lucide-react"
import { createPromotion, updatePromotion, deletePromotion } from "@/lib/actions/promotions"
import { toast } from "sonner"

type Promotion = {
  id: number;
  title: string;
  description?: string | null;
  image_url: string;
  link_url?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at?: Date | null;
  updated_at?: Date | null;
};

export function PromotionsManager({ initialPromotions }: { initialPromotions: Promotion[] }) {
  const [promotions, setPromotions] = useState<Promotion[]>(initialPromotions)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    image_url: "",
    link_url: "",
    is_active: true,
    sort_order: 0,
  })
  const [uploadingImage, setUploadingImage] = useState(false)

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    setUploadingImage(true)
    const file = e.target.files[0]
    const fd = new FormData()
    fd.append("file", file)
    fd.append("folder", "koperasi/promotions")
    
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (data.url) {
        setFormData(prev => ({ ...prev, image_url: data.url }))
        toast.success("Gambar berhasil diunggah")
      } else {
        toast.error(data.error ?? "Gagal mengunggah gambar")
      }
    } catch {
      toast.error("Terjadi kesalahan saat unggah")
    }
    setUploadingImage(false)
  }

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      image_url: "",
      link_url: "",
      is_active: true,
      sort_order: 0,
    })
    setEditingPromotion(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (editingPromotion) {
        const updated = await updatePromotion(editingPromotion.id, formData)
        if (updated) {
          setPromotions(promotions.map(p => p.id === editingPromotion.id ? updated : p))
          toast.success("Promosi berhasil diperbarui")
        }
      } else {
        const created = await createPromotion(formData)
        if (created) {
          setPromotions([...promotions, created])
          toast.success("Promosi berhasil ditambahkan")
        }
      }
      setIsDialogOpen(false)
      resetForm()
    } catch (error) {
      toast.error("Terjadi kesalahan")
    }
  }

  const handleEdit = (promotion: Promotion) => {
    setEditingPromotion(promotion)
    setFormData({
      title: promotion.title,
      description: promotion.description || "",
      image_url: promotion.image_url,
      link_url: promotion.link_url || "",
      is_active: promotion.is_active,
      sort_order: promotion.sort_order,
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: number) => {
    // Diganti dengan penghapusan langsung sementara atau bisa ditambahkan konfirmasi non-blocking
    const success = await deletePromotion(id)
    if (success) {
      setPromotions(promotions.filter(p => p.id !== id))
      toast.success("Promosi berhasil dihapus")
    } else {
      toast.error("Gagal menghapus promosi")
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Daftar Promosi</CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                Tambah Promosi
              </Button>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{editingPromotion ? "Edit Promosi" : "Tambah Promosi"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="title">Judul</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Deskripsi</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="image_url">Gambar Promosi</Label>
                    <div className="flex flex-col gap-3 mt-1">
                      {formData.image_url && (
                        <div className="relative w-full h-32 bg-slate-100 rounded-md overflow-hidden border">
                          <img src={formData.image_url} alt="Preview" className="w-full h-full object-contain" />
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Input
                          id="image_url"
                          type="text"
                          value={formData.image_url}
                          onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                          placeholder="URL / Path lokal"
                          required
                          className="flex-1"
                        />
                        <div className="relative">
                          <Button type="button" variant="outline" disabled={uploadingImage} className="gap-2">
                            <UploadCloud className="h-4 w-4" />
                            {uploadingImage ? "Mengunggah..." : "Browse"}
                          </Button>
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleImageUpload}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="link_url">URL Tautan (Opsional)</Label>
                    <Input
                      id="link_url"
                      type="text"
                      value={formData.link_url}
                      onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                    <Label htmlFor="is_active">Aktif</Label>
                  </div>
                  <div>
                    <Label htmlFor="sort_order">Urutan</Label>
                    <Input
                      id="sort_order"
                      type="number"
                      value={formData.sort_order}
                      onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Batal
                    </Button>
                    <Button type="submit">
                      {editingPromotion ? "Perbarui" : "Simpan"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Judul</TableHead>
                <TableHead>Gambar</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Urutan</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promotions.map((promotion) => (
                <TableRow key={promotion.id}>
                  <TableCell className="font-medium">{promotion.title}</TableCell>
                  <TableCell>
                    <img src={promotion.image_url} alt={promotion.title} className="w-16 h-16 object-cover rounded" />
                  </TableCell>
                  <TableCell>
                    <Badge variant={promotion.is_active ? "default" : "secondary"}>
                      {promotion.is_active ? "Aktif" : "Tidak Aktif"}
                    </Badge>
                  </TableCell>
                  <TableCell>{promotion.sort_order}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(promotion)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(promotion.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {promotions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Belum ada promosi. Klik "Tambah Promosi" untuk menambah.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}