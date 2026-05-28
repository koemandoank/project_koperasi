import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const accounts = await prisma.chart_of_accounts.findMany({
    where: {
      name: { contains: "PAYROLL" }
    }
  })

  console.log(`Found ${accounts.length} accounts matching PAYROLL:`)
  for (const a of accounts) {
    console.log(`ID: ${a.id} | Code: ${a.code} | Name: ${a.name} | Type: ${a.type} | Active: ${a.is_active}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
