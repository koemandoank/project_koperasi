import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const products = await prisma.loan_products.findMany()
  console.log("=== LOAN PRODUCTS IN DATABASE ===")
  for (const p of products) {
    console.log(`ID: ${p.id} | Code: ${p.code} | Name: ${p.name} | Interest Method: ${p.interest_method}`)
  }

  const loans = await prisma.loans.findMany({
    include: {
      loan_applications: {
        include: {
          loan_products: true
        }
      }
    }
  })

  console.log("\n=== LOAN COUNT PER PRODUCT IN ACTIVE LOANS ===")
  const counts: Record<string, number> = {}
  for (const l of loans) {
    const prodName = l.loan_applications?.loan_products?.name || "Pinjaman Uang"
    counts[prodName] = (counts[prodName] || 0) + 1
  }
  console.log(counts)
}

main().catch(console.error).finally(() => prisma.$disconnect())
