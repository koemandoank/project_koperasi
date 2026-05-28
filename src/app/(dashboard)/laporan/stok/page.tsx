import { Metadata } from 'next'
import { Suspense } from 'react'
import { LaporanStokClient } from './laporan-stok-client'
import { prisma } from '@/lib/db/prisma'

export const metadata: Metadata = {
  title: 'Riwayat Stok | Koperasi Sulfindo',
  description: 'Laporan riwayat pergerakan keluar masuk barang (Stock Movements)',
}

export default async function LaporanStokPage() {
  const products = await prisma.products.findMany({
    select: { id: true, name: true, sku: true },
    orderBy: { name: 'asc' }
  })

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Riwayat Keluar Masuk Barang</h2>
      </div>
      <Suspense fallback={<div>Loading...</div>}>
        <LaporanStokClient products={products.map((p: any) => ({ ...p, id: Number(p.id) }))} />
      </Suspense>
    </div>
  )
}
