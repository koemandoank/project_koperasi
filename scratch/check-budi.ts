import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("=== INSPECTING BUDI SANTOSO LOANS ===")
  const member = await prisma.member.findFirst({
    where: { nik: "S0001" },
    include: {
      loans: {
        include: {
          loan_applications: {
            include: { loan_products: true }
          },
          loan_schedules: {
            orderBy: { installment_no: "asc" }
          },
          loan_payments: true
        }
      }
    }
  })

  if (!member) return

  for (const l of member.loans) {
    console.log(`\nLoan No: ${l.loan_no} | Status: ${l.status}`)
    console.log(`  Product: ${l.loan_applications?.loan_products?.name} (${l.loan_applications?.loan_products?.code})`)
    console.log(`  Principal: Rp ${Number(l.principal).toLocaleString("id-ID")}`)
    console.log(`  Outstanding: Rp ${Number(l.outstanding_principal).toLocaleString("id-ID")}`)
    console.log(`  Total Paid: Rp ${Number(l.total_paid).toLocaleString("id-ID")}`)
    console.log(`  Disbursed At: ${l.disbursed_at.toISOString().split("T")[0]}`)
    console.log(`  Tenor: ${l.tenor_months} months`)
    console.log(`  Schedules status:`)
    const statusCounts = l.loan_schedules.reduce((acc: any, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1
      return acc
    }, {})
    console.log(`    `, statusCounts)
    console.log(`  Payments:`)
    l.loan_payments.forEach(p => {
      console.log(`    - Ref: ${p.reference} | Paid: Rp ${Number(p.amount_paid).toLocaleString("id-ID")} | Date: ${p.paid_at.toISOString().split("T")[0]}`)
    })
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
