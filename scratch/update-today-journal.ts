import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const targetJournalId = 9
  const correctAmount = 123757000 // new correct sum of today's payments (123757000)
  
  console.log(`Updating Journal Entry ID: ${targetJournalId} to correct amount: ${correctAmount}`)

  const entry = await prisma.journal_entries.findUnique({
    where: { id: BigInt(targetJournalId) },
    include: { journal_lines: true }
  })

  if (!entry) {
    console.log(`Journal entry with ID ${targetJournalId} not found!`)
    return
  }

  await prisma.$transaction(async (tx) => {
    // 1. Update lines
    for (const line of entry.journal_lines) {
      if (Number(line.debit) > 0) {
        await tx.journal_lines.update({
          where: { id: line.id },
          data: { debit: correctAmount }
        })
        console.log(`  - Updated line ${line.id} (Debit) to ${correctAmount}`)
      } else if (Number(line.credit) > 0) {
        await tx.journal_lines.update({
          where: { id: line.id },
          data: { credit: correctAmount }
        })
        console.log(`  - Updated line ${line.id} (Credit) to ${correctAmount}`)
      }
    }
  })

  console.log("Journal entry successfully updated!")
}

main().catch(console.error).finally(() => prisma.$disconnect())
