import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("=== STOCK MOVEMENTS SUMMARY ===")
  const movements = await prisma.stock_movements.findMany({
    orderBy: { id: "desc" },
    take: 10
  })
  console.log(`Total movements: ${await prisma.stock_movements.count()}`)
  console.log("Latest movements:")
  movements.forEach(m => {
    console.log(`- ID: ${m.id}, Product ID: ${m.product_id}, Type: ${m.type}, Qty: ${m.qty}, Date: ${m.created_at?.toISOString() ?? "null"}, Ref: ${m.reference}`)
  })

  console.log("\n=== MOVEMENT TYPES COUNT ===")
  const typeCounts = await prisma.stock_movements.groupBy({
    by: ['type'],
    _count: { id: true }
  })
  console.log(typeCounts)

  console.log("\n=== ORDERS SUMMARY ===")
  const ordersCount = await prisma.orders.count()
  console.log(`Total orders: ${ordersCount}`)
  const orderItemsCount = await prisma.order_items.count()
  console.log(`Total order items: ${orderItemsCount}`)

  console.log("\n=== STOCK OPNAME SUMMARY ===")
  const opnames = await prisma.stock_opname.findMany({
    take: 5,
    include: {
      opname_details: true
    }
  })
  console.log(`Total opnames: ${await prisma.stock_opname.count()}`)
  opnames.forEach(o => {
    console.log(`- ID: ${o.id}, Date: ${o.opname_date.toISOString()}, Status: ${o.status}, Details Count: ${o.opname_details.length}`)
  })
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
