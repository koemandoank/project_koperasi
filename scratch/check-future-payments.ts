import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const cutOffDate = new Date("2026-05-31T23:59:59")
  
  // Find all loan payments where the associated schedule due date is after May 31, 2026
  const futurePayments = await prisma.loan_payments.findMany({
    where: {
      loan_schedules: {
        due_date: { gt: cutOffDate }
      }
    },
    include: {
      loans: {
        include: {
          members: true
        }
      },
      loan_schedules: true
    }
  })

  console.log(`Found ${futurePayments.length} future payments (due after May 2026):`)
  for (const p of futurePayments) {
    console.log(`Payment ID: ${p.id} | Payment No: ${p.payment_no} | Member: ${p.loans.members.full_name} | Loan No: ${p.loans.loan_no}`)
    console.log(`  - Amount Paid: ${p.amount_paid} | Principal Portion: ${p.principal_portion} | Interest Portion: ${p.interest_portion}`)
    console.log(`  - Schedule ID: ${p.schedule_id} | Installment No: ${p.loan_schedules?.installment_no} | Due Date: ${p.loan_schedules?.due_date.toISOString().split("T")[0]}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
