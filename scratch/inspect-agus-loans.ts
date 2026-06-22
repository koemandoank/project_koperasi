import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("=== INSPECTING LOANS AND SCHEDULES FOR AGUS SETIAWAN ===")

  // Find member Agus Setiawan
  const member = await prisma.member.findFirst({
    where: { full_name: { contains: "Agus Setiawan" } },
    include: {
      loans: {
        include: {
          loan_applications: {
            include: { loan_products: true }
          },
          loan_schedules: {
            orderBy: { installment_no: "asc" }
          }
        }
      }
    }
  })

  if (!member) {
    console.error("Member Agus Setiawan not found.")
    return
  }

  console.log(`Member ID: ${member.id} | NIK: ${member.nik} | Name: ${member.full_name}`)
  console.log(`Total Loans: ${member.loans.length}`)

  for (const loan of member.loans) {
    console.log(`\nLoan ID: ${loan.id} | Loan No: ${loan.loan_no} | Status: ${loan.status} | Principal: Rp ${Number(loan.principal).toLocaleString("id-ID")} | Method: ${loan.repayment_method}`)
    const product = loan.loan_applications?.loan_products
    console.log(`Product: ${product?.name} (${product?.code})`)
    
    console.log("Schedules:")
    for (const s of loan.loan_schedules) {
      console.log(`  - Installment #${s.installment_no} | Due: ${s.due_date.toISOString().split("T")[0]} | Principal: ${Number(s.principal_due).toLocaleString("id-ID")} | Interest: ${Number(s.interest_due).toLocaleString("id-ID")} | Total: ${Number(s.total_due).toLocaleString("id-ID")} | Status: ${s.status} | Paid At: ${s.paid_at?.toISOString() || "-"}`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
