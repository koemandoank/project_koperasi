import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const loans = await prisma.loans.findMany({
    include: {
      loan_payments: true,
      loan_schedules: { orderBy: { installment_no: "asc" } }
    }
  })

  console.log("=== Loan Outstanding vs Payments & Schedules ===")
  for (const l of loans) {
    const totalPaymentsPrincipal = l.loan_payments.reduce((sum, p) => sum + Number(p.principal_portion), 0)
    const expectedOutstanding = Number(l.principal) - totalPaymentsPrincipal
    const actualOutstanding = Number(l.outstanding_principal)
    const diff = Math.abs(expectedOutstanding - actualOutstanding)
    if (diff > 0.01) {
      console.log(`Loan ${l.loan_no}: Principal: Rp ${l.principal} | Total Payments Principal: Rp ${totalPaymentsPrincipal} | Expected Outstanding: Rp ${expectedOutstanding} | Actual Outstanding: Rp ${actualOutstanding} | Diff: Rp ${diff}`)
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
