import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const memberCount = await prisma.member.count()
  const maxMember = await prisma.member.findFirst({
    orderBy: { member_code: 'desc' }
  })
  const maxNik = await prisma.member.findFirst({
    orderBy: { nik: 'desc' }
  })

  console.log(`Member Count: ${memberCount}`)
  console.log(`Highest Member Code: ${maxMember?.member_code} | NIK: ${maxNik?.nik}`)

  const firstSavingTrx = await prisma.saving_transactions.findFirst({
    orderBy: { transaction_at: 'asc' }
  })
  const lastSavingTrx = await prisma.saving_transactions.findFirst({
    orderBy: { transaction_at: 'desc' }
  })
  console.log(`Saving Transactions: Min Date = ${firstSavingTrx?.transaction_at.toISOString()} | Max Date = ${lastSavingTrx?.transaction_at.toISOString()}`)

  const firstOrder = await prisma.orders.findFirst({
    orderBy: { ordered_at: 'asc' }
  })
  const lastOrder = await prisma.orders.findFirst({
    orderBy: { ordered_at: 'desc' }
  })
  console.log(`POS Orders: Min Date = ${firstOrder?.ordered_at.toISOString()} | Max Date = ${lastOrder?.ordered_at.toISOString()}`)

  const firstPpob = await prisma.ppob_transactions.findFirst({
    orderBy: { transacted_at: 'asc' }
  })
  const lastPpob = await prisma.ppob_transactions.findFirst({
    orderBy: { transacted_at: 'desc' }
  })
  console.log(`PPOB Transactions: Min Date = ${firstPpob?.transacted_at.toISOString()} | Max Date = ${lastPpob?.transacted_at.toISOString()}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
