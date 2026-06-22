import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const cutOffDate = new Date("2026-05-31T23:59:59")
  
  // Find all loan payments where the associated schedule due date is after May 31, 2026
  const targetPayments = await prisma.loan_payments.findMany({
    where: {
      loan_schedules: {
        due_date: { gt: cutOffDate }
      }
    },
    include: {
      loans: true,
      loan_schedules: true
    }
  })

  console.log(`Found ${targetPayments.length} payments to rollback and delete.`)

  if (targetPayments.length === 0) {
    console.log("No future payments to rollback.")
    return
  }

  let successCount = 0
  let failCount = 0

  for (const p of targetPayments) {
    console.log(`Processing rollback for Payment ID: ${p.id} (No: ${p.payment_no})`)
    console.log(`  - Loan ID: ${p.loan_id} (No: ${p.loans.loan_no}) | Amount: ${p.amount_paid}`)
    console.log(`  - Schedule ID: ${p.schedule_id} | Installment: ${p.loan_schedules?.installment_no} | Due Date: ${p.loan_schedules?.due_date.toISOString().split("T")[0]}`)

    const principalToRestore = Number(p.principal_portion)
    const amountToSubtract = Number(p.amount_paid)

    try {
      // Execute each payment rollback in a small transaction to ensure consistency per-loan
      await prisma.$transaction(async (tx) => {
        // 1. Rollback the outstanding principal and total paid in loans table
        await tx.loans.update({
          where: { id: p.loan_id },
          data: {
            outstanding_principal: { increment: principalToRestore },
            total_paid: { decrement: amountToSubtract },
            // Restore status to active
            status: "active"
          }
        })

        // 2. Rollback the schedule status and paid values in loan_schedules
        if (p.schedule_id) {
          await tx.loan_schedules.update({
            where: { id: p.schedule_id },
            data: {
              status: "pending",
              paid_at: null,
              principal_paid: 0,
              interest_paid: 0,
              penalty_paid: 0
            }
          })
        }

        // 3. Delete the loan payment record
        await tx.loan_payments.delete({
          where: { id: p.id }
        })
      })

      console.log(`  -> Rollback and deletion complete for Payment ID: ${p.id}`)
      successCount++
    } catch (err) {
      console.error(`  -> Failed rollback for Payment ID: ${p.id}. Error:`, err)
      failCount++
    }
  }

  console.log(`Rollback completed. Success: ${successCount}, Failed: ${failCount}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
