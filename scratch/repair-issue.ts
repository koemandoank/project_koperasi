import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("=== RUNNING REPAIR FOR ROTI AOKA STOCK BALANCE ===")
  const aoka = await prisma.products.findFirst({
    where: { sku: "P-025" }
  })
  
  if (aoka) {
    // Delete Rak Toko Utama (ID 1) stock balance since it was a default created placeholder
    // and keep Gudang Utama (ID 2) as the source of truth with 100.
    await prisma.stock_balances.deleteMany({
      where: {
        product_id: aoka.id,
        location_id: 1 // Rak Toko Utama
      }
    })
    console.log("Deleted duplicate Rak Toko Utama stock balance for Roti Aoka.")

    // Ensure Gudang Utama (ID 2) has exactly 100
    await prisma.stock_balances.update({
      where: {
        product_id_location_id: {
          product_id: aoka.id,
          location_id: 2
        }
      },
      data: {
        qty_on_hand: 100,
        qty_available: 100
      }
    })
    console.log("Updated Gudang Utama stock balance for Roti Aoka to 100.")
  }
  console.log("=== REPAIR COMPLETE ===")
}

main().catch(console.error).finally(() => prisma.$disconnect())
