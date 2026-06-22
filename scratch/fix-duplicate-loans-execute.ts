import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const dryRun = process.argv.includes("--commit") ? false : true
  console.log(`=== EXECUTING DATABASE LOAN CORRECTION (DRY RUN: ${dryRun}) ===\n`)

  const loanNos = [
    "LN-2603-01", "LN-2603-03", "LN-2603-05", "LN-2603-07",
    "LN-2603-09", "LN-2603-11", "LN-2603-13", "LN-2603-15",
    "LN-2603-17", "LN-2603-19"
  ]

  // 1. Process the 10 historical duplicate loans
  console.log("--- PART 1: Restoring and converting the 10 LN-2603-xx loans to LP-002 (Pinjaman Uang) ---")
  for (const loanNo of loanNos) {
    const loan = await prisma.loans.findUnique({
      where: { loan_no: loanNo },
      include: {
        loan_applications: true,
        loan_schedules: { orderBy: { installment_no: "asc" } }
      }
    })

    if (!loan) {
      console.log(`Warning: Loan ${loanNo} not found in database.`)
      continue
    }

    const principal = Number(loan.principal)
    const monthlyInst = Number(loan.monthly_installment)
    const tenor = loan.tenor_months

    // We assume 2 months paid (April and May) since the loan was disbursed in March 2026.
    const principalPaid = (principal / tenor) * 2
    const targetOutstanding = principal - principalPaid
    const targetTotalPaid = monthlyInst * 2

    console.log(`\nLoan: ${loan.loan_no} | Member ID: ${loan.member_id}`)
    console.log(`  Current Status: ${loan.status} | Product ID: ${loan.loan_applications.loan_product_id}`)
    console.log(`  Outstanding Principal: Rp ${Number(loan.outstanding_principal).toLocaleString("id-ID")} -> Rp ${targetOutstanding.toLocaleString("id-ID")}`)
    console.log(`  Total Paid: Rp ${Number(loan.total_paid).toLocaleString("id-ID")} -> Rp ${targetTotalPaid.toLocaleString("id-ID")}`)
    console.log(`  Tenor: ${tenor} months | Principal: Rp ${principal.toLocaleString("id-ID")}`)

    if (!dryRun) {
      await prisma.$transaction([
        // 1. Update loan record
        prisma.loans.update({
          where: { id: loan.id },
          data: {
            status: "active",
            outstanding_principal: targetOutstanding,
            total_paid: targetTotalPaid,
            updated_at: new Date()
          }
        }),
        // 2. Update loan application product to LP-002 (Product ID 2)
        prisma.loan_applications.update({
          where: { id: loan.application_id },
          data: {
            loan_product_id: BigInt(2),
            updated_at: new Date()
          }
        }),
        // 3. Mark installments 1 and 2 as paid
        prisma.loan_schedules.updateMany({
          where: {
            loan_id: loan.id,
            installment_no: { lte: 2 }
          },
          data: {
            status: "paid",
            principal_paid: principal / tenor,
            interest_paid: monthlyInst - (principal / tenor),
            updated_at: new Date()
          }
        }),
        // 4. Mark installments 3 to 6 as pending
        prisma.loan_schedules.updateMany({
          where: {
            loan_id: loan.id,
            installment_no: { gte: 3 }
          },
          data: {
            status: "pending",
            paid_at: null,
            principal_paid: 0,
            interest_paid: 0,
            updated_at: new Date()
          }
        })
      ])
      console.log(`  ✅ Successfully updated ${loan.loan_no} to active LP-002.`)
    }
  }

  // 2. Process Salsabila Putri's active duplicate L-202605-0051 loan
  console.log("\n--- PART 2: Changing Salsabila Putri's active L-202605-0051 loan to LP-002 ---")
  const activeSalsaLoan = await prisma.loans.findUnique({
    where: { loan_no: "L-202605-0051" },
    include: { loan_applications: true }
  })

  if (activeSalsaLoan) {
    console.log(`Loan L-202605-0051 found. Current product ID: ${activeSalsaLoan.loan_applications.loan_product_id}`)
    if (!dryRun) {
      await prisma.loan_applications.update({
        where: { id: activeSalsaLoan.application_id },
        data: {
          loan_product_id: BigInt(2),
          updated_at: new Date()
        }
      })
      console.log(`  ✅ Successfully updated L-202605-0051 to LP-002.`)
    } else {
      console.log(`  (Dry Run) Would update application ${activeSalsaLoan.application_id} product to ID 2 (LP-002)`)
    }
  } else {
    console.log("Warning: Loan L-202605-0051 not found.")
  }

  console.log(`\n=== PROCESS COMPLETED (Dry Run: ${dryRun}) ===`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
