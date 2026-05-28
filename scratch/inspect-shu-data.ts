import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const year = 2026
  const startDate = new Date(year, 0, 1)
  const endDate = new Date(year, 11, 31, 23, 59, 59)

  console.log(`=== AUDITING SHU CALCULATIONS FOR YEAR ${year} ===`)

  // 1. Orders Revenue
  const storeSales = await prisma.orders.aggregate({
    where: {
      payment_status: "paid",
      paid_at: { gte: startDate, lte: endDate }
    },
    _sum: { grand_total: true }
  })
  console.log("POS/Online Store Sales Revenue (from orders):", Number(storeSales._sum.grand_total ?? 0))

  // 2. Loan Interest Revenue
  const loanInterest = await prisma.loan_schedules.aggregate({
    where: {
      status: "paid",
      paid_at: { gte: startDate, lte: endDate }
    },
    _sum: { interest_paid: true }
  })
  console.log("Loan Interest Revenue (from loan_schedules):", Number(loanInterest._sum.interest_paid ?? 0))

  // 3. General Ledger Revenue Accounts
  const glRevenue = await prisma.journal_lines.findMany({
    where: {
      journal_entries: {
        is_posted: true,
        entry_date: { gte: startDate, lte: endDate }
      },
      chart_of_accounts: { type: "revenue" }
    },
    include: {
      chart_of_accounts: true,
      journal_entries: true
    }
  })

  console.log(`\nFound ${glRevenue.length} revenue journal lines.`)
  const glRevenueSum = glRevenue.reduce((sum, line) => sum + Number(line.credit) - Number(line.debit), 0)
  console.log("Total General Ledger Revenue (from journal_lines):", glRevenueSum)

  const groupedByAccount: Record<string, { code: string; name: string; balance: number }> = {}
  for (const line of glRevenue) {
    const acc = line.chart_of_accounts
    if (!groupedByAccount[acc.id.toString()]) {
      groupedByAccount[acc.id.toString()] = { code: acc.code, name: acc.name, balance: 0 }
    }
    groupedByAccount[acc.id.toString()].balance += Number(line.credit) - Number(line.debit)
  }
  console.log("Revenue by COA account:")
  console.log(groupedByAccount)

  // 4. Check if there are journal entries with source "manual" that log store sales or loan interest
  console.log("\nSample revenue journal entries:")
  for (const line of glRevenue.slice(0, 10)) {
    console.log(`- Entry No: ${line.journal_entries.entry_no} | Date: ${line.journal_entries.entry_date.toISOString().split("T")[0]} | Ref: ${line.journal_entries.reference} | Desc: ${line.journal_entries.description} | COA: ${line.chart_of_accounts.name} | Debit: ${line.debit} | Credit: ${line.credit}`)
  }

  // 5. Total Net SHU computed in app
  const storeCogs = await getStoreCogs(startDate, endDate)
  console.log("\nCalculated Store COGS:", storeCogs)

  const expenses = await prisma.journal_lines.aggregate({
    where: {
      journal_entries: {
        is_posted: true,
        entry_date: { gte: startDate, lte: endDate }
      },
      chart_of_accounts: { type: "expense" }
    },
    _sum: { debit: true, credit: true }
  })
  const totalExpenses = Number(expenses._sum.debit ?? 0) - Number(expenses._sum.credit ?? 0)
  console.log("Total General Ledger Expenses:", totalExpenses)

  const grossProfit = (Number(storeSales._sum.grand_total ?? 0) + Number(loanInterest._sum.interest_paid ?? 0) + glRevenueSum) - storeCogs
  const netShu = grossProfit - totalExpenses
  console.log("Computed Net SHU (formula used by app):", netShu)
}

async function getStoreCogs(startDate: Date, endDate: Date): Promise<number> {
  const paidOrders = await prisma.orders.findMany({
    where: {
      payment_status: "paid",
      paid_at: { gte: startDate, lte: endDate }
    },
    include: {
      order_items: {
        select: {
          qty: true,
          purchase_price: true
        }
      }
    }
  })
  let total = 0
  for (const o of paidOrders) {
    for (const item of o.order_items) {
      total += item.qty * Number(item.purchase_price ?? 0)
    }
  }
  return total
}

main()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect())
