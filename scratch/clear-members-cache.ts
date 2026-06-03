import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("=== CLEARING MEMBERS & STATS DATABASE CACHE ===")
  const keys = ["members:all", "stats:admin", "stats:koperasi"]
  const result = await prisma.cache.deleteMany({
    where: {
      key: { in: keys }
    }
  })
  console.log(`Successfully deleted ${result.count} cache keys from the database cache table.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
