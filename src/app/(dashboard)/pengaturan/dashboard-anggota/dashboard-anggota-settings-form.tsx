"use client"

import { useState } from "react"
import { setMemberDashboardConfig } from "@/lib/actions/settings"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { BarChart3 } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"

export function DashboardAnggotaSettingsForm({ initialConfig }: { initialConfig: any }) {
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState({
    show_financial_stats: initialConfig?.show_financial_stats || false,
    filters: {
      weekly: initialConfig?.filters?.weekly ?? true,
      monthly: initialConfig?.filters?.monthly ?? true,
      yearly: initialConfig?.filters?.yearly ?? true,
    },
    modules: {
      keuntungan: initialConfig?.modules?.keuntungan ?? true,
      transaksi: initialConfig?.modules?.transaksi ?? true,
      pengeluaran: initialConfig?.modules?.pengeluaran ?? true,
      saldo: initialConfig?.modules?.saldo ?? true,
      keuntungan_toko: initialConfig?.modules?.keuntungan_toko ?? true,
      keuntungan_sp: initialConfig?.modules?.keuntungan_sp ?? true,
      pengeluaran_toko: initialConfig?.modules?.pengeluaran_toko ?? true,
      pengeluaran_sp: initialConfig?.modules?.pengeluaran_sp ?? true,
    }
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    
    const result = await setMemberDashboardConfig(config)
    
    if (result.success) {
      toast.success("Pengaturan berhasil disimpan!")
    } else {
      toast.error(result.error || "Gagal menyimpan pengaturan")
    }
    
    setLoading(false)
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-500" />
          Statistik & Laporan Koperasi
        </CardTitle>
        <CardDescription>
          Konfigurasi visibilitas data keuangan global koperasi untuk seluruh anggota.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-row items-center justify-between rounded-lg border p-4 bg-slate-50 dark:bg-slate-900/50">
            <div className="space-y-0.5">
              <Label className="text-base font-semibold text-slate-800 dark:text-slate-200">Tampilkan Statistik Keuangan Global</Label>
              <p className="text-sm text-muted-foreground">
                Aktifkan modul ini untuk menampilkan data finansial koperasi kepada anggota di dashboard mereka.
              </p>
            </div>
            <Switch 
              checked={config.show_financial_stats} 
              onCheckedChange={(v) => setConfig({ ...config, show_financial_stats: v })} 
            />
          </div>

          {config.show_financial_stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 pl-2 border-l-2 border-indigo-100 dark:border-indigo-900 ml-4">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Pilihan Filter Waktu</h3>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="f_weekly" 
                    checked={config.filters.weekly} 
                    onCheckedChange={(v) => setConfig({...config, filters: {...config.filters, weekly: !!v}})} 
                  />
                  <Label htmlFor="f_weekly" className="text-sm font-normal">Mingguan (Per Minggu)</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="f_monthly" 
                    checked={config.filters.monthly} 
                    onCheckedChange={(v) => setConfig({...config, filters: {...config.filters, monthly: !!v}})} 
                  />
                  <Label htmlFor="f_monthly" className="text-sm font-normal">Bulanan (Per Bulan)</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="f_yearly" 
                    checked={config.filters.yearly} 
                    onCheckedChange={(v) => setConfig({...config, filters: {...config.filters, yearly: !!v}})} 
                  />
                  <Label htmlFor="f_yearly" className="text-sm font-normal">Tahunan (Per Tahun)</Label>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Pilihan Modul Data</h3>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="m_keuntungan" 
                    checked={config.modules.keuntungan} 
                    onCheckedChange={(v) => setConfig({...config, modules: {...config.modules, keuntungan: !!v}})} 
                  />
                  <Label htmlFor="m_keuntungan" className="text-sm font-normal">Keuntungan (SHU)</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="m_transaksi" 
                    checked={config.modules.transaksi} 
                    onCheckedChange={(v) => setConfig({...config, modules: {...config.modules, transaksi: !!v}})} 
                  />
                  <Label htmlFor="m_transaksi" className="text-sm font-normal">Total Transaksi</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="m_pengeluaran" 
                    checked={config.modules.pengeluaran} 
                    onCheckedChange={(v) => setConfig({...config, modules: {...config.modules, pengeluaran: !!v}})} 
                  />
                  <Label htmlFor="m_pengeluaran" className="text-sm font-normal">Pengeluaran</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="m_saldo" 
                    checked={config.modules.saldo} 
                    onCheckedChange={(v) => setConfig({...config, modules: {...config.modules, saldo: !!v}})} 
                  />
                  <Label htmlFor="m_saldo" className="text-sm font-normal">Saldo Kas Koperasi</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="m_keuntungan_toko" 
                    checked={config.modules.keuntungan_toko ?? true} 
                    onCheckedChange={(v) => setConfig({...config, modules: {...config.modules, keuntungan_toko: !!v}})} 
                  />
                  <Label htmlFor="m_keuntungan_toko" className="text-sm font-normal">Keuntungan Toko Koperasi</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="m_keuntungan_sp" 
                    checked={config.modules.keuntungan_sp ?? true} 
                    onCheckedChange={(v) => setConfig({...config, modules: {...config.modules, keuntungan_sp: !!v}})} 
                  />
                  <Label htmlFor="m_keuntungan_sp" className="text-sm font-normal">Keuntungan Simpan Pinjam</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="m_pengeluaran_toko" 
                    checked={config.modules.pengeluaran_toko ?? true} 
                    onCheckedChange={(v) => setConfig({...config, modules: {...config.modules, pengeluaran_toko: !!v}})} 
                  />
                  <Label htmlFor="m_pengeluaran_toko" className="text-sm font-normal">Pengeluaran Toko Koperasi</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="m_pengeluaran_sp" 
                    checked={config.modules.pengeluaran_sp ?? true} 
                    onCheckedChange={(v) => setConfig({...config, modules: {...config.modules, pengeluaran_sp: !!v}})} 
                  />
                  <Label htmlFor="m_pengeluaran_sp" className="text-sm font-normal">Pengeluaran Simpan Pinjam</Label>
                </div>
              </div>
            </div>
          )}
          
          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading ? "Menyimpan..." : "Simpan Pengaturan"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
