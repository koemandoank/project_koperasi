import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 1. Get saving types
  const types = await prisma.saving_types.findMany()
  console.log("=== SAVING TYPES ===")
  types.forEach(t => {
    console.log(`ID: ${t.id} | Code: ${t.code} | Name: ${t.name} | Monthly: ${t.monthly_amount} | Min: ${t.min_amount} | Mandatory: ${t.is_mandatory}`)
  })

  // 2. Get recent Simpanan Wajib transactions for May 2026
  const startOfMay = new Date('2026-05-01T00:00:00Z')
  const endOfMay = new Date('2026-05-31T23:59:59Z')
  const swType = types.find(t => t.code === 'SW')

  if (swType) {
    const trxList = await prisma.saving_transactions.findMany({
      where: {
        savings: {
          saving_type_id: swType.id
        },
        transaction_at: {
          gte: startOfMay,
          lte: endOfMay
        }
      },
      include: {
        savings: {
          include: {
            members: true
          }
        }
      },
      orderBy: {
        transaction_at: 'desc'
      },
      take: 10
    })

    console.log("\n=== RECENT MAY 2026 SIMPANAN WAJIB TRANSACTIONS ===")
    trxList.forEach(tx => {
      console.log(`Tx ID: ${tx.id} | Member: ${tx.savings.members.full_name} | Type: ${tx.type} | Amount: ${tx.amount} | Ref: ${tx.reference_no} | Date: ${tx.transaction_at.toISOString()}`)
    })
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
