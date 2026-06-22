import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("=== CHECKING FOR SAME-PRODUCT MULTIPLE ACTIVE LOANS ===")
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

  let found = false
  for (const m of members) {
    // Group active loans by product code
    const byProduct: any = {}
    for (const l of m.loans) {
      const code = l.loan_applications?.loan_products?.code || "UNKNOWN"
      if (!byProduct[code]) {
        byProduct[code] = []
      }
      byProduct[code].push(l)
    }

    for (const code in byProduct) {
      if (byProduct[code].length > 1) {
        found = true
        console.log(`\nMember: ${m.full_name} (${m.nik}) has ${byProduct[code].length} active loans for ${code}:`)
        for (const l of byProduct[code]) {
          console.log(`  - Loan ID: ${l.id} | Loan No: ${l.loan_no} | Principal: Rp ${Number(l.principal).toLocaleString("id-ID")} | Disbursed: ${l.disbursed_at.toISOString().split("T")[0]}`)
        }
      }
    }
  }

  if (!found) {
    console.log("No members found with multiple active loans of the SAME product.")
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
