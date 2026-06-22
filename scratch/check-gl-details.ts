import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const coa = await prisma.chart_of_accounts.findFirst({ where: { code: "10201" } })
  if (!coa) {
    console.log("COA 10201 not found.")
    return
  }

  const lines = await prisma.journal_lines.findMany({
    where: { account_id: coa.id },
    include: { journal_entries: true }
  })

  console.log(`=== GL LINES FOR COA 10201 (Count: ${lines.length}) ===`)
  let totalDebit = 0
  let totalCredit = 0
  for (const line of lines) {
    const d = Number(line.debit)
    const c = Number(line.credit)
    totalDebit += d
    totalCredit += c
    console.log(`  Date: ${line.journal_entries.entry_date.toISOString().split("T")[0]} | Entry: ${line.journal_entries.entry_no} | Ref: ${line.journal_entries.reference} | Desc: ${line.journal_entries.description}`)
    console.log(`    Debit: Rp ${d.toLocaleString("id-ID")} | Credit: Rp ${c.toLocaleString("id-ID")}`)
  }
  console.log(`\n  Total Debit: Rp ${totalDebit.toLocaleString("id-ID")}`)
  console.log(`  Total Credit: Rp ${totalCredit.toLocaleString("id-ID")}`)
  console.log(`  GL Balance: Rp ${(totalDebit - totalCredit).toLocaleString("id-ID")}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
