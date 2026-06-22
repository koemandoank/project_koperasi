import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const [savingsDeposit, savingsWithdraw, loanDisbursedAll, loanRepaid, salesAll] =
    await Promise.all([
      prisma.saving_transactions.aggregate({ _sum: { amount: true }, where: { type: "deposit" } }),
      prisma.saving_transactions.aggregate({ _sum: { amount: true }, where: { type: "withdraw" } }),
      prisma.loans.aggregate({ _sum: { principal: true } }),
      prisma.loan_schedules.aggregate({
        _sum: { principal_paid: true, interest_paid: true, penalty_paid: true }
      }),
      prisma.orders.aggregate({ _sum: { grand_total: true }, where: { payment_status: "paid" } }),
    ])

  const netSavings    = Number(savingsDeposit._sum.amount || 0) - Number(savingsWithdraw._sum.amount || 0)
  const totalDisbursed = Number(loanDisbursedAll._sum.principal || 0)
  const totalRepaid   = Number(loanRepaid._sum.principal_paid || 0)
                      + Number(loanRepaid._sum.interest_paid || 0)
                      + Number(loanRepaid._sum.penalty_paid || 0)
  const totalSalesAll = Number(salesAll._sum.grand_total || 0)

  const fallbackKas = netSavings + totalRepaid + totalSalesAll - totalDisbursed
  console.log("=== OPERATIONAL SUB-LEDGER BALANCES ===")
  console.log(`Net Savings (Deposits - Withdrawals): ${netSavings}`)
  console.log(`Total Loans Disbursed: ${totalDisbursed}`)
  console.log(`Total Loan Repayments (Principal + Interest + Penalties): ${totalRepaid}`)
  console.log(`Total Store Sales (Paid Orders): ${totalSalesAll}`)
  console.log(`Calculated Fallback Cash & Bank: ${fallbackKas}`)
}

main().finally(() => prisma.$disconnect())
