import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const unit = await prisma.unit.findFirst()
  if (!unit) {
    console.log("No unit found")
    return
  }
  const unitId = unit.id

  const allCoa = await prisma.chart_of_accounts.findMany({
    where: { unit_id: unitId, is_active: true },
    orderBy: { code: "asc" }
  })

  const mapped = allCoa.map(c => ({
    id: Number(c.id),
    code: c.code,
    name: c.name,
    type: c.type,
    normal_balance: c.normal_balance
  }))

  const accounts = mapped.filter(a => a.type === "asset" && !a.code.startsWith("12"))
  const categoriesExpense = mapped.filter(a => a.type === "expense")
  const categoriesIncome = mapped.filter(a => a.type === "revenue")

  console.log("Accounts (Assets):", accounts.length)
  accounts.forEach(a => console.log(`  - ${a.code}: ${a.name}`))
  console.log("Categories Expense (Expense):", categoriesExpense.length)
  categoriesExpense.forEach(a => console.log(`  - ${a.code}: ${a.name}`))
  console.log("Categories Income (Revenue):", categoriesIncome.length)
  categoriesIncome.forEach(a => console.log(`  - ${a.code}: ${a.name}`))
}

main().catch(console.error).finally(() => prisma.$disconnect())
