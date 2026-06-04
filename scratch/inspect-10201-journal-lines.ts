import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("=== COA 10201 JOURNAL LINES IN DETAIL ===")
  const coa = await prisma.chart_of_accounts.findFirst({
    where: { code: "10201" }
  })
  if (!coa) {
    console.error("COA 10201 not found")
    return
  }

  const lines = await prisma.journal_lines.findMany({
    where: { account_id: coa.id },
    include: { journal_entries: true }
  })

  let totalDebit = 0
  let totalCredit = 0

  for (const line of lines) {
    const debitVal = Number(line.debit)
    const creditVal = Number(line.credit)
    totalDebit += debitVal
    totalCredit += creditVal
    console.log(`Journal Entry: ${line.journal_entries.entry_no} | Date: ${line.journal_entries.entry_date.toISOString().split("T")[0]}`)
    console.log(`  Desc: ${line.journal_entries.description}`)
    console.log(`  Line Desc: ${line.description}`)
    console.log(`  Debit: Rp ${debitVal.toLocaleString("id-ID")} | Credit: Rp ${creditVal.toLocaleString("id-ID")}`)
  }

  const netBalance = totalDebit - totalCredit
  console.log(`\nSummary:`)
  console.log(`Total Debit : Rp ${totalDebit.toLocaleString("id-ID")}`)
  console.log(`Total Credit: Rp ${totalCredit.toLocaleString("id-ID")}`)
  console.log(`Net Balance : Rp ${netBalance.toLocaleString("id-ID")} (Debit - Credit)`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
