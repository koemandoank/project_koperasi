"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Laptop, Bike, Building2, Plus, Calculator, Loader2 } from "lucide-react"
import { getFixedAssets, createFixedAsset, FixedAssetItem } from "@/lib/actions/fixed-assets"

/**
 * AsetTetapPage - Fixed Assets Dashboard Page
 * 
 * Renders a database-driven premium fixed assets management dashboard matching the user mockup.
 * Synchronizes list and additions directly with the Chart of Accounts (COA) and double-entry book keeping ledger.
 * 
 * @returns {React.JSX.Element} The rendered dashboard.
 */
export default function AsetTetapPage(): React.JSX.Element {
  const [assets, setAssets] = useState<FixedAssetItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  // Dialog state for adding assets
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [name, setName] = useState<string>("")
  const [category, setCategory] = useState<"Peralatan" | "KENDARAAN" | "BANGUNAN">("Peralatan")
  const [condition, setCondition] = useState<"BARU" | "BAIK" | "RUSAK">("BAIK")
  const [date, setDate] = useState<string>(() => new Date().toISOString().split("T")[0])
  const [cost, setCost] = useState<number>(0)
  const [saving, setSaving] = useState<boolean>(false)

  /**
   * Loads the fixed assets list from the database server actions.
   */
  const loadAssets = async () => {
    setLoading(true)
    try {
      const res = await getFixedAssets()
      if (res.success) {
        setAssets(res.assets)
      } else {
        toast.error(res.error || "Gagal memuat daftar aset.")
      }
    } catch (err: any) {
      toast.error("Terjadi kesalahan sistem saat memuat data aset.")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Load on mount
  useEffect(() => {
    loadAssets()
  }, [])

  // Calculations
  const totalValue = assets.reduce((sum, item) => sum + item.acquisitionCost, 0)
  const activeCount = assets.filter(item => item.condition !== "RUSAK").length
  const totalCount = assets.length

  /**
   * Formats numbers into standard Indonesian Rupiah currency text.
   * 
   * @param {number} val - The numeric value to format.
   * @returns {string} Formatted IDR currency text.
   */
  const formatCurrency = (val: number): string => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val)
  }

  /**
   * Helper to format raw dates into Indonesian display strings.
   * 
   * @param {string} dateStr - ISO Date string.
   * @returns {string} Readable Indo date format.
   */
  const formatDateIndo = (dateStr: string): string => {
    try {
      const months = [
        "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
        "Jul", "Agt", "Sep", "Okt", "Nov", "Des"
      ]
      const parts = dateStr.split("-")
      if (parts.length !== 3) return dateStr
      const day = parseInt(parts[2], 10)
      const monthIndex = parseInt(parts[1], 10) - 1
      const year = parts[0]
      return `${day} ${months[monthIndex]} ${year}`
    } catch {
      return dateStr
    }
  }

  /**
   * Handles the submission and database integration of a new fixed asset.
   */
  const handleAddAsset = async (): Promise<void> => {
    if (!name.trim()) {
      toast.error("Nama aset tidak boleh kosong.")
      return
    }
    if (cost <= 0) {
      toast.error("Nilai perolehan harus lebih besar dari Rp 0.")
      return
    }

    setSaving(true)
    try {
      const res = await createFixedAsset({
        name: name.trim(),
        category,
        condition,
        acquisitionCost: cost,
        acquisitionDate: date
      })

      if (res.success) {
        toast.success("Aset fisik berhasil ditambahkan dan dicatat ke jurnal akuntansi!")
        // Reset inputs
        setName("")
        setCost(0)
        setIsOpen(false)
        // Reload list from DB
        await loadAssets()
      } else {
        toast.error(res.error || "Gagal menyimpan aset.")
      }
    } catch (err: any) {
      toast.error("Gagal menambahkan aset ke database.")
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  /**
   * Returns matching icon elements based on asset category.
   * 
   * @param {string} cat - Asset category name.
   * @returns {React.ReactNode} React element representing the category icon.
   */
  const getCategoryIcon = (cat: string): React.ReactNode => {
    switch (cat) {
      case "Peralatan":
        return <Laptop className="h-5 w-5 text-red-650" />
      case "KENDARAAN":
        return <Bike className="h-5 w-5 text-red-650" />
      case "BANGUNAN":
        return <Building2 className="h-5 w-5 text-red-650" />
      default:
        return <Laptop className="h-5 w-5 text-red-650" />
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Header matching premium aesthetics with deep red button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
            Aset Tetap
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Catat dan kelola aset fisik koperasi secara tersinkronisasi database
          </p>
        </div>
        
        <Button
          onClick={() => setIsOpen(true)}
          className="h-11 px-5 rounded-xl bg-red-800 hover:bg-red-900 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 self-start sm:self-auto shrink-0"
        >
          <Plus className="h-4.5 w-4.5" />
          Tambah Aset
        </Button>
      </div>

      {/* Grid Stats Row matching visual screenshot exactly */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <Card className="border border-slate-100 dark:border-slate-900 shadow-sm rounded-2xl bg-white dark:bg-slate-950 p-5">
          <CardContent className="p-0 space-y-1">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              TOTAL NILAI ASET
            </p>
            <h3 className="text-2xl font-black text-red-800 dark:text-red-500">
              {loading ? "..." : formatCurrency(totalValue)}
            </h3>
          </CardContent>
        </Card>

        <Card className="border border-slate-100 dark:border-slate-900 shadow-sm rounded-2xl bg-white dark:bg-slate-950 p-5">
          <CardContent className="p-0 space-y-1">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              JUMLAH ASET AKTIF
            </p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">
              {loading ? "..." : activeCount} <span className="text-sm font-bold text-slate-400">items</span>
            </h3>
          </CardContent>
        </Card>

        <Card className="border border-slate-100 dark:border-slate-900 shadow-sm rounded-2xl bg-white dark:bg-slate-950 p-5">
          <CardContent className="p-0 space-y-1">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              TOTAL SEMUA
            </p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">
              {loading ? "..." : totalCount} <span className="text-sm font-bold text-slate-400">items</span>
            </h3>
          </CardContent>
        </Card>

      </div>

      {/* Asset List Rows or Loading State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-2xl">
          <Loader2 className="h-8 w-8 text-red-800 animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Sinkronisasi data dengan database...</p>
        </div>
      ) : assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-2 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-2xl">
          <p className="text-sm text-slate-500 font-bold">Belum ada aset tetap terdaftar.</p>
          <p className="text-xs text-slate-400">Silakan klik "+ Tambah Aset" untuk memulai.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="flex items-center justify-between p-4 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-2xl hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex items-center gap-4">
                {/* Soft circle matching colors */}
                <div className="h-10 w-10 rounded-full bg-red-50 dark:bg-red-950/20 flex items-center justify-center shrink-0">
                  {getCategoryIcon(asset.category)}
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {asset.name}
                    </h4>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-red-650 dark:bg-rose-950/20 dark:text-red-405"
                    )}>
                      {asset.condition}
                    </span>
                  </div>
                  
                  <p className="text-xs text-slate-400 font-medium">
                    {asset.category} · {formatDateIndo(asset.acquisitionDate)}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="font-extrabold text-sm text-red-850 dark:text-red-400">
                  {formatCurrency(asset.acquisitionCost)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Straight line depreciation explainer banner */}
      <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-red-800 dark:text-red-500" />
          <h4 className="font-bold text-sm text-slate-850 dark:text-slate-150">
            Metode Penyusutan Garis Lurus (Straight-Line Depreciation)
          </h4>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Sistem secara otomatis menghitung estimasi biaya amortisasi bulanan dengan membagi total nilai perolehan bersih dikurangi estimasi nilai residu dengan estimasi masa manfaat (tahun x 12 bulan). Jurnal penyesuaian biaya penyusutan dijalankan saat sesi **Tutup Buku** akhir periode akuntansi.
        </p>
      </div>

      {/* Dialog Form to simulate adding new assets */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 dark:text-slate-50">
              Tambah Aset Fisik Baru
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-550 dark:text-slate-400">
              Daftarkan aset tetap koperasi untuk memulai alur pencatatan depresiasi berkala.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            
            {/* Asset Name */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Nama Aset *
              </label>
              <Input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Misal: Printer Epson L3210 Kasir"
                className="h-12 rounded-xl border-slate-200 dark:border-slate-800 text-base"
                required
              />
            </div>

            {/* Grid for category & condition */}
            <div className="grid grid-cols-2 gap-4">
              
              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Kategori *
                </label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className="h-12 w-full text-base rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-100 outline-none shadow-sm appearance-none"
                  >
                    <option value="Peralatan">Peralatan</option>
                    <option value="KENDARAAN">Kendaraan</option>
                    <option value="BANGUNAN">Bangunan</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                    ▼
                  </div>
                </div>
              </div>

              {/* Condition */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Kondisi *
                </label>
                <div className="relative">
                  <select
                    value={condition}
                    onChange={e => setCondition(e.target.value as any)}
                    className="h-12 w-full text-base rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-100 outline-none shadow-sm appearance-none"
                  >
                    <option value="BARU">Baru</option>
                    <option value="BAIK">Baik</option>
                    <option value="RUSAK">Rusak</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                    ▼
                  </div>
                </div>
              </div>

            </div>

            {/* Grid for Cost & Date */}
            <div className="grid grid-cols-2 gap-4">
              
              {/* Cost */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Nilai Perolehan (Rp) *
                </label>
                <Input
                  type="number"
                  value={cost === 0 ? "" : cost}
                  onChange={e => setCost(parseInt(e.target.value, 10) || 0)}
                  placeholder="0"
                  className="h-12 rounded-xl border-slate-200 dark:border-slate-800 text-base"
                  required
                />
              </div>

              {/* Acquisition Date */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Tanggal Perolehan *
                </label>
                <Input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="h-12 rounded-xl border-slate-200 dark:border-slate-800 text-base"
                  required
                />
              </div>

            </div>

          </div>

          <DialogFooter className="flex flex-row justify-end gap-3 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="rounded-xl h-11 px-4 text-slate-600 dark:text-slate-350"
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleAddAsset}
              disabled={saving}
              className="bg-red-800 hover:bg-red-900 text-white rounded-xl h-11 px-5 font-bold shadow-md"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...
                </span>
              ) : (
                "Simpan Aset"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
