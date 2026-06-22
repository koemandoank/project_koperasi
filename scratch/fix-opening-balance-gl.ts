import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("=== FIXING OPENING BALANCE GL ENTRY (TX-OP-2026-0001) ===")
  
  // Update line 69 (10201) to 125883333.33
  const line69 = await prisma.journal_lines.update({
    where: { id: BigInt(69) },
    data: {
      debit: 125883333.33,
      updated_at: new Date()
    }
  })
  console.log(`Updated Line 69 (COA 10201) debit to: ${line69.debit}`)

  // Update line 70 (30101) to 1125883333.33
  const line70 = await prisma.journal_lines.update({
    where: { id: BigInt(70) },
    data: {
      credit: 1125883333.33,
      updated_at: new Date()
    }
  })
  console.log(`Updated Line 70 (COA 30101) credit to: ${line70.credit}`)

  console.log("=== GL Opening Balance Correction Completed successfully! ===")
}

main().catch(console.error).finally(() => prisma.$disconnect())
