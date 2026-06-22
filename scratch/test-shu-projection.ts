// Removed loadEnvConfig import


import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const year = 2026
  const startDate = new Date(year, 0, 1)
  const endDate = new Date(year, 11, 31, 23, 59, 59)

  console.log("=== SIMULATING SHU CORRECTED LABA RUGI ===")

  // 1. Toko POS Sales
  const storeSales = await prisma.orders.aggregate({
    where: {
      payment_status: "paid",
      paid_at: { gte: startDate, lte: endDate }
    },
    _sum: { grand_total: true }
  })
  const storeRevenue = Number(storeSales._sum.grand_total ?? 0)

  // 2. Interest
  const loanInterest = await prisma.loan_schedules.aggregate({
    where: {
      status: "paid",
      paid_at: { gte: startDate, lte: endDate }
    },
    _sum: { interest_paid: true }
  })
  const interestRevenue = Number(loanInterest._sum.interest_paid ?? 0)

  // 3. Penalty
  const loanPenalty = await prisma.loan_schedules.aggregate({
    where: {
      status: "paid",
      paid_at: { gte: startDate, lte: endDate }
    },
    _sum: { penalty_paid: true }
  })
  const penaltyRevenue = Number(loanPenalty._sum.penalty_paid ?? 0)

  // 4. Other Revenue from Journal Lines (Excluding 40101, 40102, 40104)
  const otherRevenueAgg = await prisma.journal_lines.aggregate({
    where: {
      journal_entries: {
        is_posted: true,
        entry_date: { gte: startDate, lte: endDate }
      },
      chart_of_accounts: {
        type: "revenue",
        code: { notIn: ["40101", "40102", "40104"] }
      }
    },
    _sum: { debit: true, credit: true }
  })
  const otherRevenue = Number(otherRevenueAgg._sum.credit ?? 0) - Number(otherRevenueAgg._sum.debit ?? 0)

  console.log("Store Revenue:", storeRevenue)
  console.log("Interest Revenue:", interestRevenue)
  console.log("Penalty Revenue:", penaltyRevenue)
  console.log("Other Journal Revenue (Corrected):", otherRevenue)

  const totalRevenue = storeRevenue + interestRevenue + penaltyRevenue + otherRevenue
  console.log("Total Revenue (Corrected):", totalRevenue)

  // COGS
  const paidOrders = await prisma.orders.findMany({
    where: {
      payment_status: "paid",
      paid_at: { gte: startDate, lte: endDate }
    },
    include: {
      order_items: { select: { qty: true, purchase_price: true } }
    }
  })
  let storeCogs = 0
  for (const o of paidOrders) {
    for (const item of o.order_items) {
      storeCogs += item.qty * Number(item.purchase_price ?? 0)
    }
  }
  const grossProfit = totalRevenue - storeCogs
  console.log("Store COGS:", storeCogs)
  console.log("Gross Profit:", grossProfit)

  // Expenses
  const expensesAgg = await prisma.journal_lines.aggregate({
    where: {
      journal_entries: {
        is_posted: true,
        entry_date: { gte: startDate, lte: endDate }
      },
      chart_of_accounts: { type: "expense" }
    },
    _sum: { debit: true, credit: true }
  })
  const totalExpenses = Number(expensesAgg._sum.debit ?? 0) - Number(expensesAgg._sum.credit ?? 0)
  console.log("Total Expenses:", totalExpenses)

  const netShu = grossProfit - totalExpenses
  console.log("\n>>> Corrected Net SHU for 2026:", netShu)
}

main()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect())
