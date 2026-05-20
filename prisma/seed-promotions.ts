/**
 * Script: seed-promotions.ts
 * Insert 4 dummy promotions requested by the user
 * Run: npx tsx prisma/seed-promotions.ts
 */
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const promotionsData = [
  {
    title: "MEGA DISKON 50% Akhir Bulan!",
    description: "Nikmati potongan harga hingga 50% untuk berbagai kebutuhan pokok dan sembako di Toko Koperasi. Belanja hemat, anggota untung!",
    image_url: "/uploads/promosi/promo-diskon-toko.png",
    link_url: "/toko",
    is_active: true,
    sort_order: 1,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    title: "Restock Terlaris: Rokok Dunhill Menthol",
    description: "Barang paling laku kini sudah tersedia kembali! Dapatkan Rokok Dunhill Menthol dengan harga spesial khusus anggota di mesin POS/Toko kami.",
    image_url: "/uploads/promosi/promo-dunhill-menthol.png",
    link_url: "/toko/produk",
    is_active: true,
    sort_order: 2,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    title: "Segera Hadir: Layanan PPOB Koperasi",
    description: "Pengembangan layanan loket pembayaran PPOB (Listrik, Air, Pulsa, dll) sedang berlangsung. Bersiaplah menikmati kemudahan bayar tagihan langsung dari saldo simpanan Anda!",
    image_url: "/uploads/promosi/promo-ppob-coming-soon.png",
    link_url: "",
    is_active: true,
    sort_order: 3,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    title: "Dana Pinjaman Kilat Telah Tersedia!",
    description: "Butuh dana cepat cair? Produk Pinjaman Kilat kini sudah bisa diajukan dengan proses persetujuan cepat (maksimal tenor 1 bulan). Ajukan sekarang di menu Pinjaman.",
    image_url: "/uploads/promosi/promo-pinjaman-kilat.png",
    link_url: "/pinjaman",
    is_active: true,
    sort_order: 4,
    created_at: new Date(),
    updated_at: new Date(),
  }
]

async function main() {
  console.log('🚀 Menambahkan 4 data promosi dummy...')
  
  // Empty existing promotions for a clean slate, or just add them.
  // We'll just add them to avoid deleting real ones if any exist.
  for (const promo of promotionsData) {
    await (prisma as any).promotions.create({
      data: promo
    })
    console.log(`✅ Ditambahkan: ${promo.title}`)
  }
  
  console.log('Selesai.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
