import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const types = await prisma.saving_types.findMany()
  types.forEach(t => {
    console.log(`ID: ${t.id} | Code: ${t.code} | Name: ${t.name} | Mandatory: ${t.is_mandatory} | Monthly Amount: ${t.monthly_amount}`)
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())
