// Removed loadEnvConfig import as Prisma reads .env automatically


import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const coas = await prisma.chart_of_accounts.findMany({
    orderBy: { code: "asc" }
  })
  
  console.log("=== ALL COA ACCOUNTS IN DATABASE ===")
  for (const c of coas) {
    console.log(`ID: ${c.id} | UnitID: ${c.unit_id} | Code: ${c.code} | Name: ${c.name} | Type: ${c.type} | Normal: ${c.normal_balance} | Active: ${c.is_active}`)
  }
}

main()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect())
