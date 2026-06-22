import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const today = new Date()
  const unpaidSchedules = await prisma.loan_schedules.findMany({
    where: {
      status: { not: "paid" },
      due_date: { lt: today }
    },
    include: {
      loans: {
        select: {
          loan_no: true,
          status: true,
          members: { select: { full_name: true } }
        }
      }
    }
  })

  console.log(`Found ${unpaidSchedules.length} unpaid schedules past due date:`)
  for (const s of unpaidSchedules) {
    console.log(`Loan: ${s.loans.loan_no} (${s.loans.members?.full_name}) | Installment #${s.installment_no} | Due: ${s.due_date.toISOString().split('T')[0]} | Status: ${s.status} | Total Due: ${s.total_due}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
