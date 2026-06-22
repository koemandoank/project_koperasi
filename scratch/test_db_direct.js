const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

async function main() {
  const startDate = "2026-05-01"
  const endDate = "2026-05-31"

  const start = new Date(startDate)
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)

  console.log("=== CHECKING STOCK MOVEMENTS DIRECTLY ===")
  console.log(`Start date: ${start.toISOString()}`)
  console.log(`End date: ${end.toISOString()}`)

  // Get movements count in range
  const totalInMei = await prisma.stock_movements.count({
    where: {
      created_at: { gte: start, lte: end }
    }
  })
  console.log(`Total movements in May 2026 range: ${totalInMei}`)

  // Get movements by type in range
  const typeCounts = await prisma.stock_movements.groupBy({
    by: ['type'],
    where: {
      created_at: { gte: start, lte: end }
    },
    _count: { id: true }
  })
  console.log("Movement types in range:")
  console.log(typeCounts)

  // Get details of some 'in' movements
  const inMovements = await prisma.stock_movements.findMany({
    where: {
      type: "in",
      created_at: { gte: start, lte: end }
    },
    include: {
      products: true
    },
    take: 5
  })
  console.log("Sample 'in' movements in range:")
  inMovements.forEach(m => {
    console.log(`- Product: ${m.products.name}, Qty: ${m.qty}, Price: ${m.products.purchase_price}, Date: ${m.created_at.toISOString()}`)
  })
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
