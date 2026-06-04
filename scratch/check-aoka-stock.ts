import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("=== ROTI AOKA (ID 25) STOCK BALANCES ===")
  const balances = await prisma.stock_balances.findMany({
    where: { product_id: BigInt(25) }
  })
  balances.forEach(b => {
    console.log(`Location ID: ${b.location_id} | Qty On Hand: ${b.qty_on_hand} | Qty Reserved: ${b.qty_reserved} | Qty Available: ${b.qty_available}`)
  })

  console.log("\n=== ROTI AOKA (ID 25) CONSIGNMENT ITEMS ===")
  const consignment = await prisma.consignment_items.findMany({
    where: { product_id: BigInt(25) }
  })
  consignment.forEach(c => {
    console.log(`ID: ${c.id} | Received: ${c.qty_received} | Sold: ${c.qty_sold} | Returned: ${c.qty_returned}`)
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())
