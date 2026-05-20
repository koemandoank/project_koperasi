"use client"

/**
 * MemberForm — Add / Edit Member (Mobile Drawer)
 *
 * Opens as a Bottom Sheet Drawer on mobile instead of a centered Dialog.
 * All form logic, state, useEffect, and Server Action calls are preserved.
 *
 * @param units - Available unit/location options
 * @param memberToEdit - If provided, form renders in edit mode
 * @param trigger - Optional custom trigger element; defaults to "+ Tambah Anggota" button
 */

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
} from "@/components/ui/drawer"
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
  units: any[]
  memberToEdit?: any
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

  /**
   * Handles form submission — creates or updates a member.
   * If unit_id is "new", creates a new unit first.
   *
   * @param e - Form submit event
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      let finalUnitId = formData.unit_id

      if (finalUnitId === "new") {
        if (!newUnitName.trim()) {
          toast.error("Nama lokasi baru harus diisi")
          setLoading(false)
          return
        }
        const unitRes = await createUnit(newUnitName.trim())
        if (unitRes.success && unitRes.id) {
          finalUnitId = unitRes.id.toString()
        } else {
          toast.error(unitRes.error || "Gagal membuat lokasi baru")
          setLoading(false)
          return
        }
      }

      const payload = { ...formData, unit_id: finalUnitId }
      const action = memberToEdit ? updateMember(memberToEdit.id, payload) : createMember(payload)
      const res = await action

      if (res.success) {
        toast.success(memberToEdit ? "Anggota diperbarui" : "Anggota ditambahkan")
        setOpen(false)
        setTimeout(() => window.location.reload(), 500)
      } else {
        toast.error(res.error)
      }
    } catch {
      toast.error("Terjadi kesalahan sistem")
    }
    setLoading(false)
  }

  return (
    <>
      {/* Trigger */}
      {trigger && React.isValidElement(trigger)
        ? React.cloneElement(trigger, { onClick: () => setOpen(true) } as any)
        : (
          <Button onClick={() => setOpen(true)} className="h-12">
            <Plus className="mr-2 h-5 w-5" /> Tambah Anggota
          </Button>
        )
      }

      {/* Bottom Sheet Drawer */}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent showClose>
          <DrawerHeader>
            <DrawerTitle>
              {memberToEdit ? "Edit Anggota" : "Tambah Anggota Baru"}
            </DrawerTitle>
          </DrawerHeader>

          <DrawerBody>
            <form onSubmit={handleSubmit} id="member-form" className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">NIK</Label>
                <Input
                  required
                  className="h-12 text-base"
                  value={formData.nik}
                  onChange={e => setFormData({ ...formData, nik: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Nama Lengkap</Label>
                <Input
                  required
                  className="h-12 text-base"
                  value={formData.full_name}
                  onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Email</Label>
                  <Input
                    type="email"
                    required
                    className="h-12 text-base"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">No. HP</Label>
                  <Input
                    className="h-12 text-base"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Unit / Dept / Lokasi</Label>
                <Select
                  value={formData.unit_id}
                  onValueChange={v => setFormData({ ...formData, unit_id: v })}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Pilih lokasi kerja">
                      {formData.unit_id === "new"
                        ? "+ Tambah Lokasi Baru..."
                        : (formData.unit_id ? units.find(u => u.id.toString() === formData.unit_id)?.name : "Pilih lokasi kerja")
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {units.map(u => (
                      <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                    ))}
                    <SelectItem value="new" className="text-blue-600 font-medium border-t mt-1 pt-2">
                      + Tambah Lokasi Baru...
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.unit_id === "new" && (
                <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/50 animate-in fade-in slide-in-from-top-2">
                  <Label className="text-blue-700 dark:text-blue-400 text-sm font-semibold">Nama Lokasi Baru</Label>
                  <Input
                    required
                    placeholder="Masukkan nama lokasi (contoh: PLTU Plant)"
                    value={newUnitName}
                    onChange={e => setNewUnitName(e.target.value)}
                    autoFocus
                    className="h-12 text-base"
                  />
                </div>
              )}

              <div className="space-y-3 pt-2 border-t">
                <Label className="text-base font-semibold">Hak Akses (Role)</Label>
                <RadioGroup
                  value={formData.role}
                  onValueChange={v => setFormData({ ...formData, role: v })}
                  className="grid grid-cols-2 gap-3"
                >
                  {[
                    { value: "anggota",    label: "Anggota Biasa" },
                    { value: "kasir",      label: "Kasir Toko" },
                    { value: "pengurus",   label: "Pengurus" },
                    { value: "admin",      label: "Admin" },
                    { value: "superadmin", label: "Superadmin", danger: true },
                  ].map(({ value, label, danger }) => (
                    <div
                      key={value}
                      className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 active:bg-slate-50 cursor-pointer"
                      onClick={() => setFormData({ ...formData, role: value })}
                    >
                      <RadioGroupItem
                        value={value}
                        id={`r-${value}-${memberToEdit?.id || 'new'}`}
                      />
                      <Label
                        htmlFor={`r-${value}-${memberToEdit?.id || 'new'}`}
                        className={`cursor-pointer text-sm font-medium ${danger ? "text-destructive" : ""}`}
                      >
                        {label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </form>
          </DrawerBody>

          <DrawerFooter>
            <Button
              type="submit"
              form="member-form"
              className="w-full h-12 text-base font-semibold"
              disabled={loading}
            >
              {loading ? "Menyimpan..." : "Simpan"}
            </Button>
            <Button
              variant="ghost"
              className="w-full h-12"
              onClick={() => setOpen(false)}
            >
              Batal
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  )
}
