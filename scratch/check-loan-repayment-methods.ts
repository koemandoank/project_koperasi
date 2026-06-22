import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("=== CHECKING REPAYMENT METHODS BY PRODUCT CODE ===\n")

  // Get all loans with their product and repayment method
  const loans = await prisma.loans.findMany({
    include: {
      loan_applications: { include: { loan_products: true } },
      members: { select: { full_name: true, nik: true } }
    },
    orderBy: { id: "asc" }
  })

  // Group by product code
  const byProduct: Record<string, { code: string, name: string, methods: Record<string, number>, examples: string[] }> = {}

  for (const loan of loans) {
    const code = loan.loan_applications?.loan_products?.code ?? "UNKNOWN"
    const name = loan.loan_applications?.loan_products?.name ?? "UNKNOWN"
    const method = loan.repayment_method ?? "none"

    if (!byProduct[code]) {
      byProduct[code] = { code, name, methods: {}, examples: [] }
    }
    byProduct[code].methods[method] = (byProduct[code].methods[method] ?? 0) + 1
    if (byProduct[code].examples.length < 3) {
      byProduct[code].examples.push(`${loan.members.full_name} (${loan.members.nik}) | ${loan.loan_no} | method=${method} | status=${loan.status}`)
    }
  }

  for (const [code, data] of Object.entries(byProduct)) {
    console.log(`\nProduct: ${data.name} (${code})`)
    console.log(`  Repayment Methods:`, data.methods)
    console.log(`  Examples (first 3):`)
    data.examples.forEach(e => console.log(`    - ${e}`))
  }

  // Specifically check LP-002 and LP-003 salary_cut loans
  console.log("\n=== LP-002 (Pinjaman Uang) with salary_cut ===")
  const puSC = await prisma.loans.findMany({
    where: {
      repayment_method: "salary_cut",
      loan_applications: { loan_products: { code: "LP-002" } }
    },
    include: { members: { select: { full_name: true, nik: true } } }
  })
  console.log(`Count: ${puSC.length}`)
  puSC.forEach(l => console.log(`  ${l.members.full_name} (${l.members.nik}) | ${l.loan_no} | status: ${l.status}`))

  console.log("\n=== LP-003 (Pinjaman Kilat) with salary_cut ===")
  const pkSC = await prisma.loans.findMany({
    where: {
      repayment_method: "salary_cut",
      loan_applications: { loan_products: { code: "LP-003" } }
    },
    include: { members: { select: { full_name: true, nik: true } } }
  })
  console.log(`Count: ${pkSC.length}`)
  pkSC.forEach(l => console.log(`  ${l.members.full_name} (${l.members.nik}) | ${l.loan_no} | status: ${l.status}`))
}

main().catch(console.error).finally(() => prisma.$disconnect())
