import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const coas = await prisma.chart_of_accounts.findMany()
  console.log("=== ALL CHART OF ACCOUNTS ===")
  coas.forEach(c => {
    console.log(`${c.id}: ${c.code} - ${c.name} (${c.type}, normal: ${c.normal_balance})`)
  })
}

main().finally(() => prisma.$disconnect())
