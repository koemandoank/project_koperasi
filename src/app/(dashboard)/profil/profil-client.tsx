"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Upload, User, Lock, Save } from "lucide-react"
import { getMyProfile, updatePhoto, changePassword } from "@/lib/actions/profile"
import { logout } from "@/lib/actions/auth"

/** Rejects local /uploads/ paths — only displays verified external URLs */
function isValidPhotoUrl(path: string | null | undefined): boolean {
  if (!path) return false
  if (path.startsWith("/uploads/") || path.startsWith("./")) return false
  return path.startsWith("http://") || path.startsWith("https://")
}

export function ProfilClient() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [passForm, setPassForm] = useState({ old: "", new: "", confirm: "" })
  const [passLoading, setPassLoading] = useState(false)

  useEffect(() => {
    getMyProfile().then(data => {
      setProfile(data)
      setLoading(false)
    })
  }, [])

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) return toast.error("Hanya file gambar yang diperbolehkan")
    if (file.size > 2 * 1024 * 1024) return toast.error("Max 2MB")

    setUploading(true)
    const fd = new FormData()
    fd.append("file", file)
    fd.append("folder", "koperasi/members")
    const res = await fetch("/api/upload", { method: "POST", body: fd })
    const data = await res.json()
    if (data.url) {
      const updateRes = await updatePhoto(data.url)
      if (updateRes.success) {
        setProfile((prev: any) => ({
          ...prev, 
          member: { ...prev.member, photo_path: data.url }
        }))
        toast.success("Foto profil berhasil diperbarui!")
      } else {
        toast.error(updateRes.error)
      }
    } else {
      toast.error("Gagal upload gambar")
    }
    setUploading(false)
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passForm.new !== passForm.confirm) {
      return toast.error("Password baru dan konfirmasi tidak cocok!")
    }
    if (passForm.new.length < 6) {
      return toast.error("Password minimal 6 karakter")
    }

    setPassLoading(true)
    const res = await changePassword(passForm.old, passForm.new)
    if (res.success) {
      toast.success("Password berhasil diubah!")
      setPassForm({ old: "", new: "", confirm: "" })
    } else {
      toast.error(res.error || "Gagal mengubah password")
    }
    setPassLoading(false)
  }

  if (loading) return <div className="p-6">Memuat profil...</div>
  if (!profile) return <div className="p-6">Profil tidak ditemukan.</div>

  return (
    <div className="max-w-4xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profil Akun</h1>
        <p className="text-muted-foreground">Kelola informasi personal dan keamanan akun Anda.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 border-0 shadow-md">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto h-32 w-32 rounded-full border-4 border-white shadow-lg overflow-hidden bg-slate-100 flex items-center justify-center relative mb-4">
              {isValidPhotoUrl(profile.member?.photo_path) ? (
                <img src={profile.member.photo_path} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="h-16 w-16 text-slate-300" />
              )}
            </div>
            <CardTitle>{profile.member?.full_name || profile.username}</CardTitle>
            <p className="text-sm text-blue-600 font-medium uppercase mt-1">{profile.role}</p>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {profile.member && (
              <>
                <label className="cursor-pointer inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-full text-sm font-medium transition-colors w-full">
                  <Upload className="h-4 w-4" />
                  {uploading ? "Mengupload..." : "Ganti Foto"}
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
                </label>
                <p className="text-xs text-muted-foreground mt-1">Format: JPG, PNG (Max. 2MB)</p>
              </>
            )}

            <Button
              variant="destructive"
              onClick={async () => {
                if (confirm("Apakah Anda yakin ingin keluar?")) {
                  await logout()
                }
              }}
              className="w-full rounded-full"
            >
              Keluar Sesi (Logout)
            </Button>
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informasi Akun</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-500">Username</Label>
                  <p className="font-medium mt-1">{profile.username}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Email</Label>
                  <p className="font-medium mt-1">{profile.email || "-"}</p>
                </div>
              </div>
              {profile.member && (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <Label className="text-slate-500">Nomor Induk Kependudukan (NIK)</Label>
                    <p className="font-medium mt-1">{profile.member.nik}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500">Nama Lengkap</Label>
                    <p className="font-medium mt-1">{profile.member.full_name}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lock className="h-5 w-5" /> Ganti Password
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Password Saat Ini</Label>
                  <Input 
                    type="password" required 
                    value={passForm.old} onChange={e => setPassForm({...passForm, old: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Password Baru</Label>
                    <Input 
                      type="password" required minLength={6}
                      value={passForm.new} onChange={e => setPassForm({...passForm, new: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Konfirmasi Password Baru</Label>
                    <Input 
                      type="password" required minLength={6}
                      value={passForm.confirm} onChange={e => setPassForm({...passForm, confirm: e.target.value})}
                    />
                  </div>
                </div>
                <Button type="submit" disabled={passLoading} className="w-full sm:w-auto">
                  {passLoading ? "Menyimpan..." : "Simpan Password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
