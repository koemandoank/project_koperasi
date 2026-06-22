import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1)

  console.log(`Date range: ${todayStart.toISOString()} - ${todayEnd.toISOString()}`)

  // 1. From loan_payments
  const lp = await prisma.loan_payments.aggregate({
    where: { paid_at: { gte: todayStart, lte: todayEnd } },
    _sum: { amount_paid: true }
  })
  console.log(`loan_payments sum: ${Number(lp._sum.amount_paid || 0)}`)

  // 2. From loan_schedules
  const ls = await prisma.loan_schedules.aggregate({
    where: {
      status: "paid",
      paid_at: { gte: todayStart, lte: todayEnd }
    },
    _sum: {
      principal_paid: true,
      interest_paid: true,
      penalty_paid: true
    }
  })
  
  const totalPrincipal = Number(ls._sum.principal_paid || 0)
  const totalInterest = Number(ls._sum.interest_paid || 0)
  const totalPenalty = Number(ls._sum.penalty_paid || 0)
  const totalLs = totalPrincipal + totalInterest + totalPenalty

  console.log(`loan_schedules sum: ${totalLs} (Principal: ${totalPrincipal}, Interest: ${totalInterest}, Penalty: ${totalPenalty})`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
