import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const coas = await prisma.chart_of_accounts.findMany({ where: { code: "10201" } })
  console.log(`Found ${coas.length} COA records with code 10201:`)
  for (const c of coas) {
    console.log(`ID: ${c.id} | Unit ID: ${c.unit_id} | Name: ${c.name}`)
  }

  const coaIds = coas.map(c => c.id)
  const lines = await prisma.journal_lines.findMany({
    where: { account_id: { in: coaIds } },
    include: { journal_entries: true, chart_of_accounts: true }
  })

  console.log(`\n=== ALL JOURNAL LINES FOR COA 10201 (Count: ${lines.length}) ===`)
  let totalDebit = 0
  let totalCredit = 0
  for (const line of lines) {
    const d = Number(line.debit)
    const c = Number(line.credit)
    totalDebit += d
    totalCredit += c
    console.log(`  COA ID: ${line.account_id} (Unit: ${line.chart_of_accounts.unit_id}) | Date: ${line.journal_entries.entry_date.toISOString().split("T")[0]} | Entry: ${line.journal_entries.entry_no} | Desc: ${line.journal_entries.description}`)
    console.log(`    Debit: Rp ${d.toLocaleString("id-ID")} | Credit: Rp ${c.toLocaleString("id-ID")}`)
  }
  console.log(`\n  Total Debit: Rp ${totalDebit.toLocaleString("id-ID")}`)
  console.log(`  Total Credit: Rp ${totalCredit.toLocaleString("id-ID")}`)
  console.log(`  GL Balance: Rp ${(totalDebit - totalCredit).toLocaleString("id-ID")}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
