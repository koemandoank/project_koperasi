import React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress" // Wait, does progress exist? We can build a premium custom HTML/CSS progress bar to be safe and avoid component dependency issues!
import { Calculator, Wallet, AlertCircle, FileSpreadsheet, Plus } from "lucide-react"

/**
 * AnggaranPage - Budgeting Module Placeholder Screen
 * 
 * Merender dashboard manajemen anggaran koperasi dengan visualisasi progres penggunaan 
 * anggaran, kartu pos anggaran, dan ringkasan kepatuhan keuangan.
 */
export default function AnggaranPage() {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { 
      style: 'currency', 
      currency: 'IDR', 
      maximumFractionDigits: 0 
    }).format(val)
  }

  const budgets = [
    { name: "Operasional Kantor & IT", allocated: 75000000, used: 28450000, color: "bg-indigo-650" },
    { name: "Pengadaan Barang Dagangan (Toko)", allocated: 250000000, used: 189200000, color: "bg-emerald-600" },
    { name: "Gaji & Kompensasi Karyawan", allocated: 120000000, used: 45000000, color: "bg-blue-600" },
    { name: "Pemeliharaan Gedung & Aset", allocated: 35000000, used: 31200000, color: "bg-amber-500" },
    { name: "Dana Cadangan & Darurat", allocated: 50000000, used: 5000000, color: "bg-teal-600" },
  ]

  const totalAllocated = budgets.reduce((s, b) => s + b.allocated, 0)
  const totalUsed = budgets.reduce((s, b) => s + b.used, 0)
  const totalRemaining = totalAllocated - totalUsed
  const overallUsagePct = Math.round((totalUsed / totalAllocated) * 100)

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
            Manajemen Anggaran
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Pantau alokasi, penggunaan, dan sisa pagu anggaran divisi koperasi secara berkala.
          </p>
        </div>
        
        <button className="h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-750 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 self-start md:self-auto">
          <Plus className="h-4.5 w-4.5" />
          Buat Pos Anggaran
        </button>
      </div>

      {/* Stats Summary Rows */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <Card className="border border-slate-100 dark:border-slate-900 shadow-md rounded-2xl bg-white dark:bg-slate-950 p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Pagu Alokasi</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1.5">
                {formatCurrency(totalAllocated)}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Calculator className="h-5 w-5" />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3 font-medium">Periode Tahun Buku 2026</p>
        </Card>

        <Card className="border border-slate-100 dark:border-slate-900 shadow-md rounded-2xl bg-white dark:bg-slate-950 p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Realisasi Anggaran</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1.5">
                {formatCurrency(totalUsed)}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-3">
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">
              {overallUsagePct}% Terpakai
            </span>
          </div>
        </Card>

        <Card className="border border-slate-100 dark:border-slate-900 shadow-md rounded-2xl bg-white dark:bg-slate-950 p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sisa Pagu Bersih</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1.5">
                {formatCurrency(totalRemaining)}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3 font-medium">Batas toleransi deviasi &lt; 5%</p>
        </Card>

      </div>

      {/* Alert Warning Box */}
      <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/60 dark:border-amber-900/30 rounded-2xl p-4 flex gap-3 items-start">
        <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-bold text-amber-800 dark:text-amber-400">Perhatian Kepatuhan Keuangan</p>
          <p className="text-amber-700/85 dark:text-slate-400 mt-0.5">
            Pos anggaran <strong>Pemeliharaan Gedung & Aset</strong> telah melewati batas ambang aman kuota terpakai (89.1%). Silakan ajukan persetujuan perubahan anggaran jika terdapat rencana transaksi pengeluaran baru pada pos tersebut.
          </p>
        </div>
      </div>

      {/* Grid of Budget Cards */}
      <div className="space-y-4">
        <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-200 tracking-tight">Pos Anggaran Aktif</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {budgets.map((b, i) => {
            const pct = Math.round((b.used / b.allocated) * 100)
            return (
              <Card key={i} className="border border-slate-200/60 dark:border-slate-800 shadow-md rounded-2xl bg-white dark:bg-slate-950 p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-base text-slate-850 dark:text-slate-100">{b.name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Kode Rekening: 501.0{i + 3}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    pct >= 85 
                      ? "bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-455" 
                      : pct >= 60 
                        ? "bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-455" 
                        : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-455"
                  }`}>
                    {pct}% Terpakai
                  </span>
                </div>

                {/* Custom Progress Bar */}
                <div className="space-y-1.5">
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-850 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        pct >= 85 ? "bg-rose-500" : pct >= 60 ? "bg-amber-500" : b.color
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Terpakai: {formatCurrency(b.used)}</span>
                    <span>Pagu: {formatCurrency(b.allocated)}</span>
                  </div>
                </div>

                <div className="flex justify-between text-[11px] text-slate-450 border-t border-slate-50 dark:border-slate-900 pt-3 mt-1.5 font-medium">
                  <span>Sisa Saldo: {formatCurrency(b.allocated - b.used)}</span>
                  <button className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
                    Lihat Rincian &rarr;
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

    </div>
  )
}
