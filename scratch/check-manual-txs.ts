import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const entries = await prisma.journal_entries.findMany({
    where: { source: "manual" },
    include: {
      journal_lines: {
        include: { chart_of_accounts: true }
      }
    },
    orderBy: { entry_date: "desc" },
    take: 10
  })

  console.log(`Found ${entries.length} manual journal entries:`)
  for (const e of entries) {
    console.log(`ID: ${e.id} | Entry No: ${e.entry_no} | Date: ${e.entry_date.toISOString().split("T")[0]} | Description: ${e.description}`)
    for (const l of e.journal_lines) {
      console.log(`  - Line ID: ${l.id} | Account: ${l.chart_of_accounts.name} (Code: ${l.chart_of_accounts.code}, Type: ${l.chart_of_accounts.type}) | Debit: ${l.debit} | Credit: ${l.credit}`)
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
