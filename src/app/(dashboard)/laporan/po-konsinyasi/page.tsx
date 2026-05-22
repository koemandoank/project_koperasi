import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getSuppliersForFilter, getProductsForFilter } from '@/lib/actions/laporan-po-konsinyasi'
import { getReportTemplateConfig } from '@/lib/actions/settings'
import LaporanPOKonsinyasiClient from './laporan-po-konsinyasi-client'

export const metadata = { title: 'Laporan PO & Konsinyasi | Koperasi' }

const ALLOWED_ROLES = ['superadmin', 'admin', 'pengurus'] as const

export default async function LaporanPOKonsinyasiPage() {
  const session = await auth()
  const role = session?.user?.role ?? 'anggota'

  if (!ALLOWED_ROLES.includes(role as any)) {
    redirect('/dashboard')
  }

  const [suppliers, products, templateConfig] = await Promise.all([
    getSuppliersForFilter(),
    getProductsForFilter(),
    getReportTemplateConfig()
  ])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Laporan PO & Konsinyasi</h1>
        <p className="text-muted-foreground mt-1">
          Pantau seluruh aktivitas pembelian dan titip jual berdasarkan periode, supplier, atau produk.
        </p>
      </div>

      <LaporanPOKonsinyasiClient suppliers={suppliers} products={products} templateConfig={templateConfig} />
    </div>
  )
}

