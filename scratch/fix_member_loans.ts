import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log("=== STARTING LOAN STATUS ADJUSTMENT (May Paid Only) ===")

  // 1. Adjust Salsabila Putri (LN-0015-0)
  // Principal: 12.000.000, Tenor: 12, installment: 1.180.000 (Principal per month: 1.000.000, Interest: 180.000)
  // If only 1 month paid: Outstanding = 11.000.000, Total Paid = 1.180.000
  console.log("\nAdjusting Salsabila Putri (LN-0015-0)...")
  const loan15 = await prisma.loans.findFirst({ where: { loan_no: 'LN-0015-0' } })
  if (loan15) {
    await prisma.$transaction([
      prisma.loans.update({
        where: { id: loan15.id },
        data: {
          outstanding_principal: 11000000,
          total_paid: 1180000
        }
      }),
      prisma.loan_schedules.updateMany({
        where: {
          loan_id: loan15.id,
          installment_no: { in: [2, 3] }
        },
        data: {
          principal_paid: 0,
          interest_paid: 0,
          status: 'pending',
          paid_at: null
        }
      })
    ])
    console.log("Success: Reverted installments #2 and #3 to pending, set outstanding principal to Rp 11.000.000.")
  } else {
    console.log("Loan LN-0015-0 not found.")
  }

  // 2. Adjust Agus Setiawan (LN-0017-0)
  // Principal: 13.000.000, Tenor: 12, installment: 1.278.333.33 (Principal: 1.083.333.33, Interest: 195.000)
  // If only 1 month paid: Outstanding = 11.916.666.67, Total Paid = 1.278.333.33
  console.log("\nAdjusting Agus Setiawan (LN-0017-0)...")
  const loan17 = await prisma.loans.findFirst({ where: { loan_no: 'LN-0017-0' } })
  if (loan17) {
    await prisma.$transaction([
      prisma.loans.update({
        where: { id: loan17.id },
        data: {
          outstanding_principal: 11916666.67,
          total_paid: 1278333.33
        }
      }),
      prisma.loan_schedules.updateMany({
        where: {
          loan_id: loan17.id,
          installment_no: { in: [2, 3] }
        },
        data: {
          principal_paid: 0,
          interest_paid: 0,
          status: 'pending',
          paid_at: null
        }
      })
    ])
    console.log("Success: Reverted installments #2 and #3 to pending, set outstanding principal to Rp 11.916.667.")
  } else {
    console.log("Loan LN-0017-0 not found.")
  }

  console.log("\n=== ADJUSTMENT SUCCESSFUL ===")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
