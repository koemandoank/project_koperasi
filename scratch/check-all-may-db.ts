import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("=== INSPECTING ALL SYSTEM TRANSACTION METHODS IN MAY 2026 ===")

  // 1. All Saving Transactions in May 2026
  const savings = await prisma.saving_transactions.groupBy({
    by: ["type"],
    where: {
      transaction_at: { gte: new Date("2026-05-01"), lte: new Date("2026-05-31") }
    },
    _sum: { amount: true },
    _count: { id: true }
  })
  console.log("Savings Transactions by Type in May 2026:")
  console.log(savings)

  // 2. All Loan Payments in May 2026
  const loans = await prisma.loan_payments.groupBy({
    by: ["payment_method"],
    where: {
      paid_at: { gte: new Date("2026-05-01"), lte: new Date("2026-05-31") }
    },
    _sum: { amount_paid: true },
    _count: { id: true }
  })
  console.log("Loan Payments by Method in May 2026:")
  console.log(loans)
  
  // 3. Let's find if there are any other cash register orders
  const orders = await prisma.orders.aggregate({
    where: {
      payment_status: "paid",
      paid_at: { gte: new Date("2026-05-01"), lte: new Date("2026-05-31") }
    },
    _sum: { grand_total: true },
    _count: { id: true }
  })
  console.log("Toko POS Paid Orders in May 2026:", {
    count: orders._count.id,
    sum: Number(orders._sum.grand_total ?? 0)
  })
}

main()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect())
