import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("=== ORDER STATUS DISTRIBUTION ===")
  const statuses = await prisma.orders.groupBy({
    by: ['order_status'],
    _count: { id: true }
  })
  console.log(statuses)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
