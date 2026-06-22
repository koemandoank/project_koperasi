import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const items = await prisma.consignment_items.findMany({
    include: {
      products: {
        include: {
          stock_balances: true
        }
      }
    }
  })

  console.log("=== CONSIGNMENT ITEMS STOCK DETAIL ===")
  for (const item of items) {
    const prod = item.products
    if (!prod) continue
    console.log(`\nItem ID: ${item.id} | SKU: ${prod.sku} | Name: ${prod.name}`)
    console.log(`  Consignment: Received=${item.qty_received}, Sold=${item.qty_sold}, Returned=${item.qty_returned} | Net=${item.qty_received - item.qty_sold - item.qty_returned}`)
    console.log(`  Product Global Stock: ${prod.stock}`)
    console.log(`  Stock Balances:`)
    prod.stock_balances.forEach(b => {
      console.log(`    Location ID ${b.location_id}: qty_on_hand=${b.qty_on_hand}, qty_available=${b.qty_available}`)
    })
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
