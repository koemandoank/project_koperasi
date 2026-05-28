import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const loanNos = [
    "LN-2603-01", "LN-2603-03", "LN-2603-05", "LN-2603-07",
    "LN-2603-09", "LN-2603-11", "LN-2603-13", "LN-2603-15",
    "LN-2603-17", "LN-2603-19"
  ]

  console.log("=== INSPECTING THE 10 LN-2603 LOANS ===")
  const loans = await prisma.loans.findMany({
    where: { loan_no: { in: loanNos } },
    include: {
      members: { select: { full_name: true, nik: true } },
      loan_schedules: { orderBy: { installment_no: "asc" } }
    }
  })

  for (const l of loans) {
    console.log(`\nLoan: ${l.loan_no} | Member: ${l.members.full_name} (${l.members.nik}) | Status: ${l.status}`)
    console.log(`  Principal: Rp ${Number(l.principal).toLocaleString("id-ID")} | Outstanding: Rp ${Number(l.outstanding_principal).toLocaleString("id-ID")} | Total Paid: Rp ${Number(l.total_paid).toLocaleString("id-ID")}`)
    console.log(`  Disbursed At: ${l.disbursed_at.toISOString().split("T")[0]}`)
    console.log(`  Tenor: ${l.tenor_months} months`)
    console.log(`  Schedules (${l.loan_schedules.length}):`)
    l.loan_schedules.forEach(s => {
      console.log(`    - Inst #${s.installment_no} | Due: ${s.due_date.toISOString().split("T")[0]} | Status: ${s.status} | Principal Due: Rp ${Number(s.principal_due).toLocaleString("id-ID")} | Paid: Rp ${(Number(s.principal_paid) + Number(s.interest_paid)).toLocaleString("id-ID")}`)
    })
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
