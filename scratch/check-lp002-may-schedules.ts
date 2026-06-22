import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  // Check active LP-002 loans and their schedules for May 2026
  const startDate = new Date("2026-05-01")
  const endDate = new Date("2026-05-31T23:59:59.999Z")

  console.log("=== ACTIVE LP-002 LOANS AND MAY 2026 SCHEDULES ===\n")

  const activeLP002 = await prisma.loans.findMany({
    where: {
      status: "active",
      repayment_method: "salary_cut",
      loan_applications: { loan_products: { code: "LP-002" } }
    },
    include: {
      members: { select: { full_name: true, nik: true } },
      loan_schedules: { orderBy: { installment_no: "asc" } }
    }
  })

  console.log(`Found ${activeLP002.length} active LP-002 loans with salary_cut\n`)

  for (const loan of activeLP002) {
    console.log(`Loan: ${loan.loan_no} | Member: ${loan.members.full_name} (${loan.members.nik})`)
    const maySchedules = loan.loan_schedules.filter(s => {
      const dueDate = new Date(s.due_date)
      const paidAt = s.paid_at ? new Date(s.paid_at) : null
      const dueInMay = dueDate >= startDate && dueDate <= endDate
      const paidInMay = paidAt ? paidAt >= startDate && paidAt <= endDate : false
      return dueInMay || paidInMay
    })

    if (maySchedules.length === 0) {
      console.log("  ⚠️  NO schedules found for May 2026!")
    }
    for (const s of maySchedules) {
      console.log(`  Schedule #${s.installment_no} | Due: ${s.due_date.toISOString().split("T")[0]} | Status: ${s.status} | Paid At: ${s.paid_at?.toISOString() ?? "-"} | Principal Due: ${Number(s.principal_due).toLocaleString("id-ID")} | Interest Due: ${Number(s.interest_due).toLocaleString("id-ID")}`)
    }
    
    // Also show ALL schedules
    console.log(`  All ${loan.loan_schedules.length} schedules:`)
    for (const s of loan.loan_schedules) {
      console.log(`    #${s.installment_no} | Due: ${s.due_date.toISOString().split("T")[0]} | Status: ${s.status} | Paid At: ${s.paid_at?.toISOString() ?? "-"}`)
    }
    console.log()
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
