import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const targetDate = new Date("2026-05-25")
  const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1)

  console.log("=== INSPECTING MAY 2026 PAYROLL RUN BREAKDOWN ===")

  // 1. Saving Transactions (Simpanan Wajib)
  const savingsTxs = await prisma.saving_transactions.findMany({
    where: {
      type: "salary_cut",
      transaction_at: { gte: startOfDay, lte: endOfDay }
    }
  })
  
  const totalSavings = savingsTxs.reduce((sum, tx) => sum + Number(tx.amount), 0)
  console.log(`\nFound ${savingsTxs.length} savings transactions.`)
  console.log("Total Simpanan Wajib Collected:", totalSavings)

  // 2. Loan Payments
  const loanPayments = await prisma.loan_payments.findMany({
    where: {
      payment_method: "salary_cut",
      paid_at: { gte: startOfDay, lte: endOfDay }
    }
  })

  const totalLoanPayments = loanPayments.reduce((sum, p) => sum + Number(p.amount_paid), 0)
  const totalPrincipalPaid = loanPayments.reduce((sum, p) => sum + Number(p.principal_portion), 0)
  const totalInterestPaid = loanPayments.reduce((sum, p) => sum + Number(p.interest_portion), 0)
  const totalPenaltyPaid = loanPayments.reduce((sum, p) => sum + Number(p.penalty_amount), 0)

  console.log(`\nFound ${loanPayments.length} loan payment transactions.`)
  console.log("Total Loan Repayments Collected:", totalLoanPayments)
  console.log("  - Principal Portion:", totalPrincipalPaid)
  console.log("  - Interest Portion:", totalInterestPaid)
  console.log("  - Penalty Portion:", totalPenaltyPaid)

  const overallSum = totalSavings + totalLoanPayments
  console.log(`\nSum of Savings + Loan Payments: ${overallSum}`)
  console.log(`Difference from General Ledger (123,757,000): ${123757000 - overallSum}`)
}

main()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect())
