import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const loan = await prisma.loans.findUnique({
    where: { loan_no: "LN-0005-0" },
    include: {
      members: { select: { full_name: true } },
      loan_schedules: true
    }
  })

  if (!loan) {
    console.log("Loan LN-0005-0 not found!")
    return
  }

  console.log(`Loan ID: ${loan.id}`)
  console.log(`Loan No: ${loan.loan_no}`)
  console.log(`Member: ${loan.members?.full_name}`)
  console.log(`Loan Status: ${loan.status}`)
  console.log(`Outstanding: ${loan.outstanding_principal}`)
  console.log(`Schedules count: ${loan.loan_schedules.length}`)
  
  for (const s of loan.loan_schedules) {
    console.log(`Installment #${s.installment_no} | Due: ${s.due_date.toISOString().split('T')[0]} | Status: ${s.status}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
