import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("=== RECENT JOURNAL ENTRIES ===")
  const entries = await prisma.journal_entries.findMany({
    take: 20,
    orderBy: { entry_date: "desc" },
    include: {
      journal_lines: {
        include: { chart_of_accounts: true }
      }
    }
  })

  for (const entry of entries) {
    console.log(`\nEntry: ${entry.entry_no} | Date: ${entry.entry_date.toISOString().split("T")[0]} | Ref: ${entry.reference} | Desc: ${entry.description}`)
    for (const l of entry.journal_lines) {
      console.log(`  - Account: ${l.chart_of_accounts.code} - ${l.chart_of_accounts.name} | Debit: Rp ${Number(l.debit).toLocaleString("id-ID")} | Credit: Rp ${Number(l.credit).toLocaleString("id-ID")}`)
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
