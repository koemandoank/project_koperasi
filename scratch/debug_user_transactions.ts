import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "mysql://root:@127.0.0.1:3306/koperasi_digital"
    }
  }
})

async function main() {
  console.log("=== EXAMINING MAY 2026 SIMPANAN WAJIB TRANSACTIONS ===")

  const swType = await prisma.saving_types.findFirst({
    where: { code: 'SW' }
  })

  if (!swType) {
    console.error("Saving type SW not found.")
    return
  }

  const startOfMay = new Date('2026-05-01T00:00:00Z')
  const endOfMay = new Date('2026-05-31T23:59:59Z')

  const transactions = await prisma.saving_transactions.findMany({
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
      transaction_at: 'asc'
    }
  })

  console.log(`Total SW transactions in May 2026: ${transactions.length}`)
  
  transactions.forEach((tx) => {
    console.log(`Member: ${tx.savings.members.full_name} (${tx.savings.members.member_code}) | Type: ${tx.type} | Amount: ${tx.amount} | Ref: ${tx.reference_no} | Date: ${tx.transaction_at.toISOString()}`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
