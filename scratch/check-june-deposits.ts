import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const monthStart = new Date("2026-06-01T00:00:00Z")
  const deposits = await prisma.saving_transactions.findMany({
    where: {
      type: "deposit",
      created_at: { gte: monthStart }
    },
    include: {
      members: { select: { full_name: true, member_code: true } },
      savings: { include: { saving_types: true } }
    }
  })

  console.log(`Found ${deposits.length} deposits in June 2026:`)
  for (const d of deposits) {
    console.log(`ID: ${d.id} | Member: ${d.members.full_name} (${d.members.member_code}) | Type: ${d.savings.saving_types.name} | Amount: ${d.amount} | Date: ${d.created_at}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
