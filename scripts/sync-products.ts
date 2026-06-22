/**
 * Script: scripts/sync-products.ts
 * Menyinkronkan daftar kategori dan produk dari database lokal ke database Vercel (Aiven Cloud)
 * Jalankan: npx tsx scripts/sync-products.ts
 */
import { PrismaClient as PrismaClientLocal } from '@prisma/client'
import { PrismaClient as PrismaClientCloud } from '@prisma/client'

// Kredensial koneksi
const LOCAL_DB_URL = "mysql://root:@127.0.0.1:3306/koperasi_digital"
const CLOUD_DB_URL = process.env.DATABASE_URL

async function main() {
  console.log('🔌 Menghubungkan ke database lokal dan cloud...')
  
  const prismaLocal = new PrismaClientLocal({
    datasources: { db: { url: LOCAL_DB_URL } }
  })
  const prismaCloud = new PrismaClientCloud({
    datasources: { db: { url: CLOUD_DB_URL } }
  })

  try {
    // 1. Ambil kategori produk dari lokal
    console.log('📥 Membaca kategori produk dari lokal...')
    const localCategories = await prismaLocal.product_categories.findMany()
    console.log(`Found ${localCategories.length} categories locally.`)

    // 2. Upsert kategori ke cloud
    console.log('📤 Menyinkronkan kategori ke cloud...')
    for (const cat of localCategories) {
      await prismaCloud.product_categories.upsert({
        where: { id: cat.id },
        update: {
          name: cat.name,
          slug: cat.slug,
          icon_url: cat.icon_url,
          is_active: cat.is_active,
          sort_order: cat.sort_order,
          updated_at: new Date()
        },
        create: {
          id: cat.id,
          parent_id: cat.parent_id,
          name: cat.name,
          slug: cat.slug,
          icon_url: cat.icon_url,
          is_active: cat.is_active,
          sort_order: cat.sort_order,
          created_at: cat.created_at || new Date(),
          updated_at: cat.updated_at || new Date()
        }
      })
    }
    console.log('✅ Sinkronisasi kategori selesai.')

    // 3. Ambil produk dari lokal
    console.log('📥 Membaca produk dari lokal...')
    const localProducts = await prismaLocal.products.findMany()
    console.log(`Found ${localProducts.length} products locally.`)

    // 4. Upsert produk ke cloud
    console.log('📤 Menyinkronkan produk ke cloud...')
    let syncedCount = 0
    for (const p of localProducts) {
      // Pastikan unit_id di cloud valid (biasanya unit Kantor Pusat)
      // Kita upsert produk berdasarkan SKU agar tidak duplikat
      await prismaCloud.products.upsert({
        where: { sku: p.sku },
        update: {
          name: p.name,
          description: p.description,
          purchase_price: p.purchase_price,
          price: p.price,
          member_price: p.member_price,
          stock: p.stock,
          min_stock: p.min_stock,
          unit_measure: p.unit_measure,
          image_path: p.image_path,
          is_active: p.is_active,
          is_online: p.is_online,
          updated_at: new Date(),
          // Ubah deleted_at menjadi null jika nilainya tahun 0 (invalid)
          deleted_at: p.deleted_at && new Date(p.deleted_at).getFullYear() > 0 ? p.deleted_at : null
        },
        create: {
          id: p.id,
          unit_id: p.unit_id,
          category_id: p.category_id,
          sku: p.sku,
          name: p.name,
          description: p.description,
          purchase_price: p.purchase_price,
          price: p.price,
          member_price: p.member_price,
          stock: p.stock,
          min_stock: p.min_stock,
          unit_measure: p.unit_measure,
          image_path: p.image_path,
          is_active: p.is_active,
          is_online: p.is_online,
          created_at: p.created_at || new Date(),
          updated_at: p.updated_at || new Date(),
          deleted_at: p.deleted_at && new Date(p.deleted_at).getFullYear() > 0 ? p.deleted_at : null
        }
      })
      syncedCount++
    }
    console.log(`✅ Sinkronisasi produk selesai. Total ${syncedCount} produk berhasil disinkronkan ke cloud.`)

  } catch (error) {
    console.error('❌ Gagal melakukan sinkronisasi:', error)
  } finally {
    await prismaLocal.$disconnect()
    await prismaCloud.$disconnect()
  }
}

main()
