import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("=== CHECKING FOR MEMBERS WITH MULTIPLE ACTIVE LOANS ===")

  // Find all members who have more than 1 active loan
  const members = await prisma.member.findMany({
    include: {
      loans: {
        where: { status: "active" },
        include: {
          loan_applications: {
            include: { loan_products: true }
          }
        }
      }
    }
  })

  const duplicateMembers = members.filter(m => m.loans.length > 1)
  console.log(`Found ${duplicateMembers.length} members with more than 1 active loan:`)
  
  for (const m of duplicateMembers) {
    console.log(`\nMember: ${m.full_name} (${m.nik}) | Active Loans Count: ${m.loans.length}`)
    for (const loan of m.loans) {
      console.log(`  - Loan ID: ${loan.id} | Loan No: ${loan.loan_no} | Principal: Rp ${Number(loan.principal).toLocaleString("id-ID")} | Disbursed: ${loan.disbursed_at ? loan.disbursed_at.toISOString().split('T')[0] : "-"} | Product: ${loan.loan_applications?.loan_products?.name} (${loan.loan_applications?.loan_products?.code})`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
