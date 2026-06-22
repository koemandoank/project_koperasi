import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("=== INSPECTING ALL SYSTEM TRANSACTIONS IN MAY 2026 ===")

  // 1. Simpanan Wajib
  const savings = await prisma.saving_transactions.aggregate({
    where: {
      type: "salary_cut",
      transaction_at: { gte: new Date("2026-05-01"), lte: new Date("2026-05-31") }
    },
    _sum: { amount: true },
    _count: { id: true }
  })
  console.log("Simpanan Wajib (salary_cut) in May 2026:", {
    count: savings._count.id,
    sum: Number(savings._sum.amount ?? 0)
  })

  // 2. Loan Payments
  const loans = await prisma.loan_payments.aggregate({
    where: {
      payment_method: "salary_cut",
      paid_at: { gte: new Date("2026-05-01"), lte: new Date("2026-05-31") }
    },
    _sum: {
      amount_paid: true,
      principal_portion: true,
      interest_portion: true
    },
    _count: { id: true }
  })
  console.log("Loan Payments (salary_cut) in May 2026:", {
    count: loans._count.id,
    sumAmount: Number(loans._sum.amount_paid ?? 0),
    sumPrincipal: Number(loans._sum.principal_portion ?? 0),
    sumInterest: Number(loans._sum.interest_portion ?? 0)
  })

  // 3. What is the total sum in the database?
  const totalDbSum = Number(savings._sum.amount ?? 0) + Number(loans._sum.amount_paid ?? 0)
  console.log("Total sum of salary_cut in DB:", totalDbSum)

  // 4. Let's inspect the journal entry lines again
  const journals = await prisma.journal_entries.findMany({
    where: {
      entry_date: { gte: new Date("2026-05-01"), lte: new Date("2026-05-31") }
    },
    include: {
      journal_lines: {
        include: { chart_of_accounts: true }
      }
    }
  })
  console.log(`\nFound ${journals.length} journal entries in May 2026.`)
  for (const j of journals) {
    console.log(`\nJournal ID: ${j.id} | Entry No: ${j.entry_no} | Date: ${j.entry_date.toISOString().split("T")[0]} | Ref: ${j.reference} | Desc: ${j.description}`)
    for (const l of j.journal_lines) {
      console.log(`  - COA: ${l.chart_of_accounts.code} ${l.chart_of_accounts.name} | Debit: ${l.debit} | Credit: ${l.credit}`)
    }
  }
}

main()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect())
