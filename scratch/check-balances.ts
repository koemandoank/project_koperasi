import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const aoka = await prisma.products.findFirst({ where: { sku: "P-025" } })
  if (aoka) {
    const balances = await prisma.stock_balances.findMany({
      where: { product_id: aoka.id },
      include: { warehouse_locations: true }
    })
    console.log("Roti Aoka balances:")
    balances.forEach(b => {
      console.log(`- ID: ${b.id}, Loc: ${b.warehouse_locations.location_name} (ID: ${b.location_id}), Qty: ${b.qty_on_hand}`)
    })
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
