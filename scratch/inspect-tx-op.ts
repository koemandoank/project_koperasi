import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("=== INSPECT TX-OP-2026-0001 ===")
  const entry = await prisma.journal_entries.findUnique({
    where: { entry_no: "TX-OP-2026-0001" },
    include: {
      journal_lines: {
        include: { chart_of_accounts: true }
      }
    }
  })
  if (!entry) {
    console.error("Entry TX-OP-2026-0001 not found")
    return
  }

  console.log(`Journal Entry: ${entry.entry_no}`)
  for (const line of entry.journal_lines) {
    console.log(`Line ID: ${line.id} | Account: ${line.chart_of_accounts.code} (${line.chart_of_accounts.name}) | Debit: ${line.debit} | Credit: ${line.credit}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
