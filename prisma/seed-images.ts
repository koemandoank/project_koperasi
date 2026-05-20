/**
 * Script: seed-images.ts
 * Update image_path pada 12 produk dummy sesuai gambar yang sudah digenerate
 * Run: npx ts-node prisma/seed-images.ts
 */
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const imageMap: { sku: string; image_path: string }[] = [
  { sku: 'P-001', image_path: '/uploads/products/p-001-beras-5kg.png' },
  { sku: 'P-002', image_path: '/uploads/products/p-002-gula-pasir.png' },
  { sku: 'P-003', image_path: '/uploads/products/p-003-minyak-goreng.png' },
  { sku: 'P-004', image_path: '/uploads/products/p-004-tepung-terigu.png' },
  { sku: 'P-005', image_path: '/uploads/products/p-005-sabun-mandi.png' },
  { sku: 'P-006', image_path: '/uploads/products/p-006-sampo-sachet.png' },
  { sku: 'P-007', image_path: '/uploads/products/p-007-detergen.png' },
  { sku: 'P-008', image_path: '/uploads/products/p-008-kopi-sachet.png' },
  { sku: 'P-009', image_path: '/uploads/products/p-009-mie-instan.png' },
  { sku: 'P-010', image_path: '/uploads/products/p-010-baterai.png' },
  { sku: 'P-011', image_path: '/uploads/products/p-011-headset.png' },
  { sku: 'P-012', image_path: '/uploads/products/p-012-keripik-singkong.png' },
]

async function main() {
  console.log('🖼️  Updating product images...')
  for (const { sku, image_path } of imageMap) {
    const result = await prisma.products.updateMany({
      where: { sku },
      data: { image_path },
    })
    console.log(`  ${result.count > 0 ? '✅' : '⚠️ '} ${sku} → ${image_path} (${result.count} row updated)`)
  }
  console.log('Done.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
