import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("=== ALL ACTIVE LOANS FOR ALL MEMBERS ===")
  const activeLoans = await prisma.loans.findMany({
    where: { status: "active" },
    include: {
      members: true,
      loan_applications: {
        include: { loan_products: true }
      }
    },
    orderBy: { member_id: "asc" }
  })

  for (const l of activeLoans) {
    console.log(`Member: ${l.members?.full_name} (${l.members?.nik})`)
    console.log(`  Loan ID: ${l.id} | Loan No: ${l.loan_no} | Principal: Rp ${Number(l.principal).toLocaleString("id-ID")} | Disbursed: ${l.disbursed_at.toISOString().split("T")[0]}`)
    console.log(`  Product ID: ${l.loan_applications?.loan_product_id} | Product Code: ${l.loan_applications?.loan_products?.code} | Product Name: ${l.loan_applications?.loan_products?.name}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
