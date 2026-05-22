"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { saveReportTemplateConfig, ReportTemplateConfig } from "@/lib/actions/settings"
import { toast } from "sonner"
import { Printer, Upload, Image as ImageIcon, Save, CheckCircle, RefreshCcw } from "lucide-react"

interface Props {
  initialConfig: ReportTemplateConfig;
}

export function KopSuratClient({ initialConfig }: Props) {
  const [loading, setLoading] = useState(false)
  const [logo, setLogo] = useState<string>(initialConfig.logo_base64 || "")
  const [name, setName] = useState<string>(initialConfig.company_name)
  const [tagline, setTagline] = useState<string>(initialConfig.company_tagline || "")
  const [address, setAddress] = useState<string>(initialConfig.company_address || "")
  const [phone, setPhone] = useState<string>(initialConfig.company_phone || "")

  const [location, setLocation] = useState<string>(initialConfig.footer_location || "Serang")
  const [dateType, setDateType] = useState<"auto" | "custom">(initialConfig.footer_date_type)
  const [customDate, setCustomDate] = useState<string>(initialConfig.footer_custom_date || "")
  
  const [leftTitle, setLeftTitle] = useState<string>(initialConfig.footer_left_title || "Bendahara")
  const [leftName, setLeftName] = useState<string>(initialConfig.footer_left_name || "")
  const [rightTitle, setRightTitle] = useState<string>(initialConfig.footer_right_title || "Ketua Koperasi")
  const [rightName, setRightName] = useState<string>(initialConfig.footer_right_name || "")

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar.")
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        // Downscale image to max size of 150px (optimized size for reports)
        const canvas = document.createElement("canvas")
        const maxSize = 150
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width
            width = maxSize
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height
            height = maxSize
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        ctx?.drawImage(img, 0, 0, width, height)

        // Convert scaled image to base64 jpeg
        const base64 = canvas.toDataURL("image/jpeg", 0.85)
        setLogo(base64)
        toast.success("Logo berhasil dimuat dan dioptimalkan!")
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleResetLogo = () => {
    setLogo("")
    toast.info("Menggunakan logo default koperasi.")
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Nama Koperasi wajib diisi.")
      return
    }

    setLoading(true)
    try {
      const result = await saveReportTemplateConfig({
        logo_base64: logo || undefined,
        company_name: name,
        company_tagline: tagline,
        company_address: address,
        company_phone: phone,
        footer_location: location,
        footer_date_type: dateType,
        footer_custom_date: dateType === "custom" ? customDate : undefined,
        footer_left_title: leftTitle,
        footer_left_name: leftName,
        footer_right_title: rightTitle,
        footer_right_name: rightName,
      })

      if (result.success) {
        toast.success("Konfigurasi laporan resmi berhasil disimpan!")
      } else {
        toast.error(result.error || "Gagal menyimpan konfigurasi.")
      }
    } catch (error) {
      console.error(error)
      toast.error("Gagal terhubung dengan server.")
    } finally {
      setLoading(false)
    }
  }

  // Generate dynamic date preview string
  const getPreviewDate = () => {
    if (dateType === "custom") {
      return customDate || "(Tanggal Kustom)"
    }
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
    return new Date().toLocaleDateString('id-ID', options)
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_400px]">
      {/* Kolom Kiri: Form Panel */}
      <div className="space-y-6">
        <Card className="border border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 p-4 md:p-6 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="bg-indigo-50 dark:bg-indigo-950/60 p-2 rounded-xl text-indigo-600 dark:text-indigo-400">
                <Printer className="h-5 w-5" />
              </span>
              Detail Kop Surat (Header)
            </CardTitle>
            <CardDescription>Informasi primer Koperasi yang tercetak di bagian teratas seluruh laporan.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Koperasi</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Koperasi Sulfindo" className="rounded-xl h-10" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-xs font-bold text-slate-500 uppercase tracking-wider">No. Telepon / Fax</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(0254) 123456" className="rounded-xl h-10" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tagline" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Slogan / Tagline Koperasi</Label>
              <Input id="tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Maju Bersama Sejahtera Bersama" className="rounded-xl h-10" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Alamat Lengkap</Label>
              <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Jl. Raya Serang Km. 80, Cilegon, Banten" className="rounded-xl h-10" />
            </div>

            {/* Logo Upload Panel */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Logo Kop Surat</span>
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="h-16 w-16 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0">
                  {logo ? (
                    <img src={logo} alt="Preview Logo" className="h-full w-full object-contain p-1" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-slate-300" />
                  )}
                </div>
                <div className="flex-1 space-y-2 text-center sm:text-left">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-350">Upload logo resmi dengan latar putih transparan atau solid.</div>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <Button variant="outline" size="sm" className="relative rounded-lg text-xs h-8">
                      <Upload className="mr-1.5 h-3.5 w-3.5 text-indigo-500" />
                      Pilih Logo Gambar
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 opacity-0 cursor-pointer w-full" />
                    </Button>
                    {logo && (
                      <Button variant="ghost" size="sm" onClick={handleResetLogo} className="text-red-500 hover:text-red-600 rounded-lg text-xs h-8">
                        <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
                        Gunakan Default
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detail Footer & Tanda Tangan */}
        <Card className="border border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 p-4 md:p-6 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="bg-emerald-50 dark:bg-emerald-950/60 p-2 rounded-xl text-emerald-600 dark:text-emerald-450">
                <CheckCircle className="h-5 w-5" />
              </span>
              Seksi Tanda Tangan (Footer)
            </CardTitle>
            <CardDescription>Pejabat resmi penanda tangan dan format tanggal di bagian bawah dokumen ekspor.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6 space-y-6">
            {/* Lokasi & Tanggal */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="location" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kota Lokasi TTD</Label>
                <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Serang" className="rounded-xl h-10" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateType" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Format Tanggal</Label>
                <Select value={dateType} onValueChange={(val: any) => setDateType(val)}>
                  <SelectTrigger id="dateType" className="rounded-xl h-10">
                    <SelectValue placeholder="Pilih Format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Hari Ekspor (Otomatis)</SelectItem>
                    <SelectItem value="custom">Kustom (Ketik Manual)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="customDate" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tanggal Kustom</Label>
                <Input 
                  id="customDate" 
                  value={customDate} 
                  onChange={(e) => setCustomDate(e.target.value)} 
                  placeholder="22 Mei 2026" 
                  disabled={dateType !== "custom"}
                  className="rounded-xl h-10"
                />
              </div>
            </div>

            {/* Pejabat TTD */}
            <div className="grid gap-4 md:grid-cols-2 border-t pt-4 border-slate-100 dark:border-slate-800">
              {/* TTD Kiri */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Tanda Tangan Kiri (Custom)</h4>
                <div className="space-y-2">
                  <Label htmlFor="leftTitle" className="text-xs text-slate-400">Jabatan TTD Kiri</Label>
                  <Input id="leftTitle" value={leftTitle} onChange={(e) => setLeftTitle(e.target.value)} placeholder="Bendahara" className="rounded-xl h-10" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leftName" className="text-xs text-slate-400">Nama Lengkap & Gelar</Label>
                  <Input id="leftName" value={leftName} onChange={(e) => setLeftName(e.target.value)} placeholder="Ahmad Yani, S.E." className="rounded-xl h-10" />
                </div>
              </div>

              {/* TTD Kanan */}
              <div className="space-y-3 border-l md:pl-4 border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-450 uppercase tracking-wider">Tanda Tangan Kanan (Ketua)</h4>
                <div className="space-y-2">
                  <Label htmlFor="rightTitle" className="text-xs text-slate-400">Jabatan TTD Kanan</Label>
                  <Input id="rightTitle" value={rightTitle} onChange={(e) => setRightTitle(e.target.value)} placeholder="Ketua Koperasi" className="rounded-xl h-10" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rightName" className="text-xs text-slate-400">Nama Lengkap & Gelar</Label>
                  <Input id="rightName" value={rightName} onChange={(e) => setRightName(e.target.value)} placeholder="Budi Santoso, M.B.A." className="rounded-xl h-10" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <Button onClick={handleSave} disabled={loading} className="w-full bg-slate-800 hover:bg-slate-900 dark:bg-indigo-600 dark:hover:bg-indigo-700 h-11 text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-md">
          <Save className="h-4 w-4" />
          {loading ? "Menyimpan Konfigurasi..." : "Simpan Pengaturan Kop & TTD Laporan"}
        </Button>
      </div>

      {/* Kolom Kanan: Visual Live Preview Block */}
      <div className="space-y-6">
        <div className="sticky top-6">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Pratinjau Cetak Real-Time</span>
          
          <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg relative min-h-[480px] flex flex-col justify-between overflow-hidden text-slate-800">
            {/* Header Kop */}
            <div className="space-y-3 pb-3 border-b-2 border-slate-800">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-slate-100 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {logo ? (
                    <img src={logo} alt="Logo" className="h-full w-full object-contain p-0.5" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-slate-400" />
                  )}
                </div>
                <div className="space-y-0.5 min-w-0 flex-1">
                  <h4 className="text-sm font-bold truncate tracking-tight uppercase">{name || "NAMA KOPERASI"}</h4>
                  <p className="text-[9px] text-slate-500 truncate leading-none">{tagline || "Slogan / Tagline Koperasi"}</p>
                  <p className="text-[9px] text-slate-400 truncate leading-none">{address || "Alamat lengkap Koperasi"}</p>
                  {phone && <p className="text-[9px] text-slate-400 leading-none">Telp: {phone}</p>}
                </div>
              </div>
            </div>

            {/* Dummy Content */}
            <div className="my-6 space-y-4 flex-1">
              <div className="h-3 w-1/3 bg-slate-200 rounded mx-auto"></div>
              <div className="space-y-2">
                <div className="h-2 w-full bg-slate-100 rounded"></div>
                <div className="h-2 w-full bg-slate-100 rounded"></div>
                <div className="h-2 w-4/5 bg-slate-100 rounded"></div>
              </div>
              <div className="border border-slate-100 rounded-lg p-3 space-y-2">
                <div className="flex justify-between">
                  <div className="h-2.5 w-1/3 bg-slate-200 rounded"></div>
                  <div className="h-2.5 w-1/4 bg-slate-200 rounded"></div>
                </div>
                <div className="h-px bg-slate-100 w-full"></div>
                <div className="flex justify-between">
                  <div className="h-2.5 w-1/2 bg-slate-200 rounded"></div>
                  <div className="h-2.5 w-1/5 bg-slate-200 rounded"></div>
                </div>
              </div>
            </div>

            {/* Footer Signatures */}
            <div className="space-y-4 text-center mt-auto">
              <div className="text-[10px] text-slate-400 text-right mr-4 font-medium">
                {location}, {getPreviewDate()}
              </div>
              
              <div className="grid grid-cols-2 text-[10px] gap-2 pt-1">
                {/* Left Side */}
                <div className="space-y-8">
                  <span className="font-semibold text-slate-500 block leading-tight">{leftTitle || "Jabatan Kiri"}</span>
                  <span className="font-bold underline text-slate-800 dark:text-slate-200 block truncate">{leftName || "Nama Pejabat Kiri"}</span>
                </div>

                {/* Right Side */}
                <div className="space-y-8">
                  <span className="font-semibold text-slate-500 block leading-tight">{rightTitle || "Jabatan Kanan"}</span>
                  <span className="font-bold underline text-slate-800 dark:text-slate-200 block truncate">{rightName || "Nama Pejabat Kanan"}</span>
                </div>
              </div>
            </div>

            {/* Printable Frame Effect */}
            <div className="absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 border-indigo-500/30"></div>
            <div className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-indigo-500/30"></div>
          </div>
        </div>
      </div>
    </div>
  )
}
