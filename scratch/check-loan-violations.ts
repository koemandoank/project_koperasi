import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("=== CHECKING CURRENT LOAN RULES IN DATABASE ===\n")
  const settings = await prisma.app_settings.findFirst()
  if (!settings?.loan_rules) {
    console.log("No loan_rules found in app_settings. Using DEFAULT_LOAN_RULES.")
    console.log("DEFAULT: strict_single_active_loan = { enabled: true, applied_to_products: [] }")
    console.log("NOTE: applied_to_products: [] means the rule applies to NO product ID (it has to be populated)")
  } else {
    const rules = JSON.parse(settings.loan_rules)
    console.log("Current Loan Rules:\n", JSON.stringify(rules, null, 2))
  }

  console.log("\n=== MEMBERS WITH MULTIPLE ACTIVE LP-001 LOANS (VIOLATIONS) ===\n")

  // Find all members with 2+ active LP-001 loans
  const members = await prisma.member.findMany({
    include: {
      loans: {
        where: { status: "active" },
        include: {
          loan_applications: { include: { loan_products: true } }
        }
      }
    }
  })

  const violated = members.filter(m => {
    const lp001Count = m.loans.filter(l => l.loan_applications?.loan_products?.code === "LP-001").length
    return lp001Count > 1
  })

  console.log(`Found ${violated.length} members with MULTIPLE active LP-001 (Pinjaman Barang):`)
  for (const m of violated) {
    const lp001Loans = m.loans.filter(l => l.loan_applications?.loan_products?.code === "LP-001")
    console.log(`\n  Member: ${m.full_name} (${m.nik})`)
    for (const loan of lp001Loans) {
      console.log(`    - ${loan.loan_no} | Dibursed: ${loan.disbursed_at?.toISOString().split("T")[0]} | Principal: Rp ${Number(loan.principal).toLocaleString("id-ID")} | Created: ${loan.created_at?.toISOString().split("T")[0]}`)
    }
    // Identify which one is older (likely the LN-2603 seed data)
    const sorted = [...lp001Loans].sort((a, b) => {
      const aDate = a.disbursed_at ? new Date(a.disbursed_at).getTime() : 0
      const bDate = b.disbursed_at ? new Date(b.disbursed_at).getTime() : 0
      return aDate - bDate
    })
    console.log(`    ⚠️ OLDER (possibly illegal): ${sorted[0].loan_no} (${sorted[0].disbursed_at?.toISOString().split("T")[0]})`)
    console.log(`    ✅ NEWER (valid application): ${sorted[sorted.length-1].loan_no} (${sorted[sorted.length-1].disbursed_at?.toISOString().split("T")[0]})`)
  }

  // Check loan product IDs
  console.log("\n=== LOAN PRODUCT IDs ===")
  const products = await prisma.loan_products.findMany()
  for (const p of products) {
    console.log(`  ID: ${p.id} | Code: ${p.code} | Name: ${p.name}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
