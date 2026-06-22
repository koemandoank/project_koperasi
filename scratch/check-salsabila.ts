import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("=== INSPECTING SALSABILA PUTRI LOANS ===")
  const member = await prisma.member.findFirst({
    where: { nik: "S0015" },
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

  if (!member) {
    console.log("Salsabila Putri not found.")
    return
  }

  console.log(`Name: ${member.full_name} (${member.nik})`)
  for (const l of member.loans) {
    console.log(`\nLoan No: ${l.loan_no} (ID: ${l.id})`)
    console.log(`  Product: ${l.loan_applications?.loan_products?.name} (ID: ${l.loan_applications?.loan_products?.id}, Code: ${l.loan_applications?.loan_products?.code})`)
    console.log(`  Principal: Rp ${Number(l.principal).toLocaleString("id-ID")}`)
    console.log(`  Outstanding: Rp ${Number(l.outstanding_principal).toLocaleString("id-ID")}`)
    console.log(`  Total Paid: Rp ${Number(l.total_paid).toLocaleString("id-ID")}`)
    console.log(`  Disbursed At: ${l.disbursed_at.toISOString().split("T")[0]}`)
    console.log(`  Status: ${l.status}`)
    console.log(`  Application ID: ${l.application_id}`)
    console.log(`  Payments count: ${l.loan_payments.length}`)
    console.log(`  Schedules status count:`)
    const statusCounts = l.loan_schedules.reduce((acc: any, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1
      return acc
    }, {})
    console.log(`    `, statusCounts)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
