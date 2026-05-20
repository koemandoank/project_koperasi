"use client"

import React, { useState, useEffect } from "react"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { createMember, updateMember, createUnit } from "@/lib/actions/members"
import { toast } from "sonner"
import { Plus } from "lucide-react"

export function MemberForm({ 
  units: initialUnits, 
  memberToEdit = null, 
  trigger 
}: { 
  units: any[], 
  memberToEdit?: any,
  trigger?: React.ReactNode 
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [units, setUnits] = useState(initialUnits)
  
  const [formData, setFormData] = useState({
    nik: memberToEdit?.nik || "",
    full_name: memberToEdit?.full_name || "",
    email: memberToEdit?.email || "",
    phone: memberToEdit?.phone || "",
    unit_id: memberToEdit?.unit_id?.toString() || (initialUnits.length > 0 ? initialUnits[0].id.toString() : ""),
    role: memberToEdit?.role || "anggota",
  })

  const [newUnitName, setNewUnitName] = useState("")

  useEffect(() => {
    if (open && memberToEdit) {
      setFormData({
        nik: memberToEdit.nik || "",
        full_name: memberToEdit.full_name || "",
        email: memberToEdit.email || "",
        phone: memberToEdit.phone || "",
        unit_id: memberToEdit.unit_id?.toString() || (units.length > 0 ? units[0].id.toString() : ""),
        role: memberToEdit.role || "anggota",
      })
      setNewUnitName("")
    } else if (open && !memberToEdit) {
      setFormData({
        nik: "", full_name: "", email: "", phone: "",
        unit_id: units.length > 0 ? units[0].id.toString() : "",
        role: "anggota",
      })
      setNewUnitName("")
    }
  }, [open, memberToEdit, units])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      let finalUnitId = formData.unit_id;
      
      // Jika user memilih untuk membuat lokasi baru
      if (finalUnitId === "new") {
        if (!newUnitName.trim()) {
          toast.error("Nama lokasi baru harus diisi");
          setLoading(false);
          return;
        }
        
        const unitRes = await createUnit(newUnitName.trim());
        if (unitRes.success && unitRes.id) {
          finalUnitId = unitRes.id.toString();
        } else {
          toast.error(unitRes.error || "Gagal membuat lokasi baru");
          setLoading(false);
          return;
        }
      }

      const payload = { ...formData, unit_id: finalUnitId };
      const action = memberToEdit ? updateMember(memberToEdit.id, payload) : createMember(payload)
      const res = await action
      
      if (res.success) {
        toast.success(memberToEdit ? "Anggota diperbarui" : "Anggota ditambahkan")
        setOpen(false)
        // Force page refresh to sync updated role and newly added unit
        setTimeout(() => window.location.reload(), 500)
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
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Tambah Anggota
            </Button>
          )}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{memberToEdit ? "Edit Anggota" : "Tambah Anggota Baru"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>NIK</Label>
            <Input required value={formData.nik} onChange={e => setFormData({...formData, nik: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>Nama Lengkap</Label>
            <Input required value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>No. HP</Label>
              <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Unit / Dept / Lokasi</Label>
            <Select value={formData.unit_id} onValueChange={v => setFormData({...formData, unit_id: v})}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih lokasi kerja">
                  {formData.unit_id === "new" 
                    ? "+ Tambah Lokasi Baru..." 
                    : (formData.unit_id ? units.find(u => u.id.toString() === formData.unit_id)?.name : "Pilih lokasi kerja")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {units.map(u => <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>)}
                <SelectItem value="new" className="text-blue-600 font-medium border-t rounded-none mt-1 pt-2">+ Tambah Lokasi Baru...</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.unit_id === "new" && (
            <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-100 dark:border-blue-900/50 animate-in fade-in slide-in-from-top-2">
              <Label className="text-blue-700 dark:text-blue-400">Nama Lokasi Baru</Label>
              <Input 
                required 
                placeholder="Masukkan nama lokasi (contoh: PLTU Plant)" 
                value={newUnitName}
                onChange={e => setNewUnitName(e.target.value)}
                autoFocus
              />
            </div>
          )}
          
          <div className="space-y-3 pt-2 border-t">
            <Label className="text-base font-semibold">Pemberian Hak Akses (Role)</Label>
            <RadioGroup value={formData.role} onValueChange={v => setFormData({...formData, role: v})} className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="anggota" id={`r1-${memberToEdit?.id || 'new'}`} />
                <Label htmlFor={`r1-${memberToEdit?.id || 'new'}`} className="cursor-pointer">Anggota Biasa</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="kasir" id={`r2-${memberToEdit?.id || 'new'}`} />
                <Label htmlFor={`r2-${memberToEdit?.id || 'new'}`} className="cursor-pointer">Kasir Toko</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pengurus" id={`r3-${memberToEdit?.id || 'new'}`} />
                <Label htmlFor={`r3-${memberToEdit?.id || 'new'}`} className="cursor-pointer">Pengurus</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="admin" id={`r4-${memberToEdit?.id || 'new'}`} />
                <Label htmlFor={`r4-${memberToEdit?.id || 'new'}`} className="cursor-pointer">Admin</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="superadmin" id={`r5-${memberToEdit?.id || 'new'}`} />
                <Label htmlFor={`r5-${memberToEdit?.id || 'new'}`} className="cursor-pointer text-destructive">Superadmin</Label>
              </div>
            </RadioGroup>
          </div>
          <Button type="submit" className="w-full mt-4" disabled={loading}>
            {loading ? "Menyimpan..." : "Simpan"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
