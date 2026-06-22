import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const loan = await prisma.loans.findFirst({
    where: { loan_no: "LN-0019-0" },
    include: {
      loan_schedules: {
        orderBy: { installment_no: 'asc' }
      },
      loan_payments: true
    }
  })

  if (!loan) {
    console.log("Loan not found!")
    return
  }

  console.log(`=== CURRENT DATABASE STATE FOR ${loan.loan_no} ===`)
  console.log(`Status: ${loan.status}`)
  console.log(`Outstanding Principal: Rp ${Number(loan.outstanding_principal).toLocaleString('id-ID')}`)
  console.log(`Total Paid: Rp ${Number(loan.total_paid).toLocaleString('id-ID')}`)
  
  console.log(`Schedules:`)
  for (const s of loan.loan_schedules) {
    console.log(`  - Installment #${s.installment_no} | Due: ${s.due_date.toISOString().split('T')[0]} | Status: ${s.status} | Principal Paid: Rp ${Number(s.principal_paid).toLocaleString('id-ID')} | Interest Paid: Rp ${Number(s.interest_paid).toLocaleString('id-ID')}`)
  }

  console.log(`Payments:`)
  for (const p of loan.loan_payments) {
    console.log(`  - Payment ID: ${p.id} | Amount: Rp ${Number(p.amount_paid).toLocaleString('id-ID')} | Paid At: ${p.paid_at.toISOString().split('T')[0]}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
