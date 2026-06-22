import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("=======================================================================")
  console.log("=== FIXING LOAN SCHEDULE ROUNDING DISCREPANCIES ===")
  console.log("=======================================================================\n")

  const loans = await prisma.loans.findMany({
    include: { loan_schedules: true }
  })

  let adjustedCount = 0

  for (const loan of loans) {
    const schedules = loan.loan_schedules
    if (schedules.length === 0) continue

    const principal = Number(loan.principal)
    const schedulePrincipalSum = schedules.reduce((sum, s) => sum + Number(s.principal_due), 0)
    const diff = principal - schedulePrincipalSum

    if (Math.abs(diff) > 0.001) {
      // Find the last schedule
      const lastSchedule = schedules.reduce((max, s) => s.installment_no > max.installment_no ? s : max, schedules[0])
      
      console.log(`Loan [${loan.loan_no}] has rounding diff: ${diff.toFixed(4)}`)
      console.log(`  - Adjusting Last Installment #${lastSchedule.installment_no} (ID: ${lastSchedule.id})`)
      console.log(`  - Old Principal Due: ${lastSchedule.principal_due} | Old Total Due: ${lastSchedule.total_due}`)

      const newPrincipalDue = Number(lastSchedule.principal_due) + diff
      const newTotalDue = Number(lastSchedule.total_due) + diff

      await prisma.loan_schedules.update({
        where: { id: lastSchedule.id },
        data: {
          principal_due: newPrincipalDue,
          total_due: newTotalDue,
          updated_at: new Date()
        }
      })

      console.log(`  - New Principal Due: ${newPrincipalDue.toFixed(2)} | New Total Due: ${newTotalDue.toFixed(2)}`)
      adjustedCount++
    }
  }

  console.log(`\n=======================================================================`)
  console.log(`Successfully adjusted ${adjustedCount} loans for rounding differences.`)
  console.log("=======================================================================")
}

main().catch(console.error).finally(() => prisma.$disconnect())
