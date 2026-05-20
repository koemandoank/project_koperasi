"use client"

import { useState } from "react"
import { updateAppSettings } from "@/lib/actions/settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

export function SettingsForm({ initialData }: { initialData: any }) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    company_name: initialData?.company_name || "",
    address: initialData?.address || "",
    phone: initialData?.phone || "",
    logo_url: initialData?.logo_url || "",
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    
    const result = await updateAppSettings(formData)
    
    if (result.success) {
      toast.success("Pengaturan berhasil disimpan!")
    } else {
      toast.error(result.error || "Gagal menyimpan pengaturan")
    }
    
    setLoading(false)
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Profil Koperasi</CardTitle>
        <CardDescription>Kelola informasi dasar dan branding koperasi Anda.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company_name">Nama Koperasi</Label>
            <Input 
              id="company_name" 
              value={formData.company_name}
              onChange={(e) => setFormData({...formData, company_name: e.target.value})}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="address">Alamat</Label>
            <Input 
              id="address" 
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone">No. Telepon</Label>
            <Input 
              id="phone" 
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="logo_url">URL Logo</Label>
            <Input 
              id="logo_url" 
              value={formData.logo_url}
              onChange={(e) => setFormData({...formData, logo_url: e.target.value})}
              placeholder="/koperasi.png"
            />
            <p className="text-xs text-muted-foreground">Isi dengan path relatif (contoh: /koperasi.png) atau URL eksternal gambar.</p>
          </div>
          
          <Button type="submit" disabled={loading}>
            {loading ? "Menyimpan..." : "Simpan Pengaturan"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
