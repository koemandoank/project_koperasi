import { PrismaClient } from '@prisma/client'

// Initializes using the active DATABASE_URL in your .env (Aiven Cloud Database)
const prisma = new PrismaClient()

async function main() {
  console.log("=== STARTING BACKFILL FOR SIMPANAN WAJIB (SW) ON ACTIVE DATABASE ===")

  // 1. Get the SW saving type
  const swType = await prisma.saving_types.findFirst({
    where: { code: 'SW' }
  })

  if (!swType) {
    console.error("Saving type 'SW' not found!")
    return
  }

  const targetAmount = 300000 // Rp 300.000
  const oldAmount = 50000     // Rp 50.000
  const diff = targetAmount - oldAmount // Rp 250.000 increment per member

  console.log(`Target Amount: Rp ${targetAmount.toLocaleString('id-ID')}`)
  console.log(`Difference to apply: +Rp ${diff.toLocaleString('id-ID')}`)

  // 2. Find all SW transactions in May 2026 that have the old amount
  const startOfMay = new Date('2026-05-01T00:00:00Z')
  const endOfMay = new Date('2026-05-31T23:59:59Z')

  const swTransactions = await prisma.saving_transactions.findMany({
    where: {
      savings: {
        saving_type_id: swType.id
      },
      transaction_at: {
        gte: startOfMay,
        lte: endOfMay
      },
      type: 'salary_cut',
      amount: oldAmount
    },
    include: {
      savings: true
    }
  })

  console.log(`Found ${swTransactions.length} transactions in May 2026 with amount Rp 50.000.`)

  if (swTransactions.length === 0) {
    console.log("No transactions to update or already updated.")
    return
  }

  // 3. Update transactions and savings balance
  let updatedCount = 0
  for (const trx of swTransactions) {
    const savingsId = trx.savings_id
    
    // We execute inside a Prisma transaction for safety
    await prisma.$transaction(async (tx) => {
      // Update transaction amount
      await tx.saving_transactions.update({
        where: { id: trx.id },
        data: {
          amount: targetAmount,
          balance_after: Number(trx.balance_before) + targetAmount
        }
      })

      // Update savings balance and total_deposit
      await tx.savings.update({
        where: { id: savingsId },
        data: {
          balance: { increment: diff },
          total_deposit: { increment: diff }
        }
      })
    })

    updatedCount++
  }

  console.log(`=== BACKFILL SUCCESSFUL ===`)
  console.log(`Successfully updated ${updatedCount} SW transactions and adjusted their respective savings balances in the active database.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
