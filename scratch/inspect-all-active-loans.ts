import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("=== INSPECTING ALL ACTIVE LOANS IN DATABASE ===")
  const activeLoans = await prisma.loans.findMany({
    include: {
      members: { select: { full_name: true } },
      loan_schedules: {
        orderBy: { installment_no: 'asc' }
      },
      loan_payments: true
    }
  })

  console.log(`Found ${activeLoans.length} total loans in database.`)

  for (const l of activeLoans) {
    console.log(`\n--------------------------------------------------`)
    console.log(`Loan No: ${l.loan_no} | ID: ${l.id}`)
    console.log(`Member: ${l.members?.full_name} | Member ID: ${l.member_id}`)
    console.log(`Status: ${l.status} | Repayment Method: ${l.repayment_method}`)
    console.log(`Principal: Rp ${Number(l.principal).toLocaleString('id-ID')}`)
    console.log(`Outstanding: Rp ${Number(l.outstanding_principal).toLocaleString('id-ID')}`)
    console.log(`Total Paid: Rp ${Number(l.total_paid).toLocaleString('id-ID')}`)
    console.log(`Schedules Count: ${l.loan_schedules.length}`)
    
    const paidSchedules = l.loan_schedules.filter(s => s.status === 'paid')
    const unpaidSchedules = l.loan_schedules.filter(s => s.status !== 'paid')
    
    console.log(`Paid Installments: ${paidSchedules.length} | Unpaid Installments: ${unpaidSchedules.length}`)
    console.log(`Payments Count in loan_payments: ${l.loan_payments.length}`)
    
    if (l.loan_schedules.length > 0) {
      console.log(`Schedule installment details:`)
      for (const s of l.loan_schedules.slice(0, 5)) {
        console.log(`  - Installment #${s.installment_no} | Due: ${s.due_date.toISOString().split('T')[0]} | Status: ${s.status} | Paid: Rp ${(Number(s.principal_paid) + Number(s.interest_paid)).toLocaleString('id-ID')}`)
      }
      if (l.loan_schedules.length > 5) {
        console.log(`  ... [truncated ${l.loan_schedules.length - 5} more schedules]`)
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
