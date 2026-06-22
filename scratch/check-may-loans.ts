import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("=== INSPECTING MAY 2026 DISBURSED LOANS ===")
  const loans = await prisma.loans.findMany({
    where: {
      disbursed_at: {
        gte: new Date("2026-05-01T00:00:00Z"),
        lte: new Date("2026-05-31T23:59:59Z")
      }
    },
    include: {
      members: true,
      loan_applications: {
        include: { loan_products: true }
      }
    }
  })

  for (const l of loans) {
    console.log(`Loan No: ${l.loan_no} | Member: ${l.members?.full_name} (${l.members?.nik})`)
    console.log(`  Principal: Rp ${Number(l.principal).toLocaleString("id-ID")} | Tenor: ${l.tenor_months} months`)
    console.log(`  Disbursed At: ${l.disbursed_at.toISOString().split("T")[0]}`)
    console.log(`  Product Code: ${l.loan_applications?.loan_products?.code} | Name: ${l.loan_applications?.loan_products?.name}`)
    console.log(`  Purpose: ${l.loan_applications?.purpose}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
