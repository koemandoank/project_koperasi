import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const accounts = await prisma.chart_of_accounts.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      type: true
    }
  })
  console.log("CHART OF ACCOUNTS:")
  accounts.forEach(a => {
    console.log(`ID: ${a.id}, Code: ${a.code}, Name: ${a.name}, Type: ${a.type}`)
  })
}

main().catch(console.error)
