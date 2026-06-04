import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const coas = await prisma.chart_of_accounts.findMany({
    where: {
      OR: [
        { code: { startsWith: "201" } },
        { code: { startsWith: "3" } },
        { name: { contains: "Simpanan" } }
      ]
    }
  })
  console.log("=== Savings and Equity COAs ===")
  for (const c of coas) {
    console.log(`ID: ${c.id} | Code: ${c.code} | Name: ${c.name} | Type: ${c.type} | Unit: ${c.unit_id}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
