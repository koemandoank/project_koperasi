import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const startOfMay = new Date('2026-05-01T00:00:00Z')
  const endOfMay = new Date('2026-05-31T23:59:59Z')

  console.log("=== INSPECTING SAVINGS TRANSACTIONS FOR MAY 2026 ===")
  
  const txs = await prisma.saving_transactions.findMany({
    where: {
      transaction_at: {
        gte: startOfMay,
        lte: endOfMay
      }
    },
    include: {
      members: { select: { full_name: true } }
    },
    orderBy: { transaction_at: 'asc' }
  })

  console.log(`Found ${txs.length} savings transactions in May 2026.`)
  
  const memberCounts = new Map<string, number>()
  for (const t of txs) {
    const key = `${t.member_id}-${t.type}-${t.amount}`
    memberCounts.set(key, (memberCounts.get(key) || 0) + 1)
  }

  // Print first 20 transactions
  for (const t of txs.slice(0, 20)) {
    console.log(`Trx ID: ${t.id} | Member: ${t.members?.full_name} | Type: ${t.type} | Amount: Rp ${Number(t.amount).toLocaleString('id-ID')} | Ref: ${t.reference_no} | Date: ${t.transaction_at.toISOString().split('T')[0]}`)
  }
  if (txs.length > 20) {
    console.log(`... [truncated ${txs.length - 20} more transactions]`)
  }

  console.log(`\n=== DUPLICATE ANALYSIS ===`)
  let duplicateCount = 0
  for (const [key, count] of memberCounts.entries()) {
    if (count > 1) {
      console.log(`Duplicate found for Key (MemberID-Type-Amount) "${key}": ${count} times`)
      duplicateCount++
    }
  }
  if (duplicateCount === 0) {
    console.log("No duplicate savings transactions found in May 2026!")
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
