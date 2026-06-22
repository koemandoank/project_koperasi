import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log("=== RESETTING ALL ACTIVE LOANS TO 1 MONTH PAID ONLY ===")

  // 1. Get all active loans
  const activeLoans = await prisma.loans.findMany({
    where: { status: 'active' },
    include: {
      loan_schedules: {
        orderBy: { installment_no: 'asc' }
      }
    }
  })

  console.log(`Found ${activeLoans.length} active loans.`)

  let updatedCount = 0

  for (const loan of activeLoans) {
    const tenor = loan.tenor_months
    if (tenor <= 1) {
      console.log(`Skipping Loan ${loan.loan_no} (Tenor is ${tenor} month(s))`)
      continue
    }

    const principal = Number(loan.principal)
    const ppMonth = principal / tenor
    const monthly = Number(loan.monthly_installment)

    // Recalculate outstanding principal and total paid for 1 month paid
    const targetOutstanding = principal - ppMonth
    const targetTotalPaid = monthly

    console.log(`Adjusting Loan ${loan.loan_no}:`)
    console.log(`  - Member ID: ${loan.member_id}`)
    console.log(`  - Outstanding: ${loan.outstanding_principal} -> ${targetOutstanding}`)
    console.log(`  - Total Paid: ${loan.total_paid} -> ${targetTotalPaid}`)

    await prisma.$transaction([
      // Update loan record
      prisma.loans.update({
        where: { id: loan.id },
        data: {
          outstanding_principal: targetOutstanding,
          total_paid: targetTotalPaid
        }
      }),
      // Ensure installment 1 is paid
      prisma.loan_schedules.updateMany({
        where: {
          loan_id: loan.id,
          installment_no: 1
        },
        data: {
          principal_paid: ppMonth,
          interest_paid: monthly - ppMonth,
          status: 'paid',
          paid_at: loan.first_due_date
        }
      }),
      // Revert installments 2 and onwards to pending
      prisma.loan_schedules.updateMany({
        where: {
          loan_id: loan.id,
          installment_no: { gte: 2 }
        },
        data: {
          principal_paid: 0,
          interest_paid: 0,
          status: 'pending',
          paid_at: null
        }
      })
    ])

    updatedCount++
  }

  console.log(`\n=== SUCCESSFULLY ADJUSTED ${updatedCount} ACTIVE LOANS ===`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
