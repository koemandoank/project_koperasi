import { LaporanAnalitikClient } from './laporan-analitik-client'

export const metadata = {
  title: 'Analitik & P&L Toko | Koperasi Sulfindo',
  description: 'Laporan keuntungan, margin, dan analisis produk toko',
}

export default function LaporanAnalitikPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Laporan Analitik & Keuntungan Toko</h1>
        <p className="text-muted-foreground mt-1">
          P&L, laba kotor, margin keuntungan, analisis produk, dan perbandingan modal vs penjualan.
        </p>
      </div>
      <LaporanAnalitikClient />
    </div>
  )
}
