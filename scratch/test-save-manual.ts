import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const bank = await prisma.chart_of_accounts.findFirst({
    where: { name: { contains: "Mandiri" } }
  })
  
  const category = await prisma.chart_of_accounts.findFirst({
    where: { name: { contains: "PAYROLL" } }
  })

  if (!bank || !category) {
    console.log(`Failed to find Bank or Category! Bank: ${bank?.name}, Category: ${category?.name}`)
    return
  }

  console.log(`Simulating transaction:`)
  console.log(`Bank: ${bank.name} (ID: ${bank.id})`)
  console.log(`Category: ${category.name} (ID: ${category.id})`)

  // We need to run within auth, so let's mock/test by running the internal logic of createManualTransaction
  // since we don't have auth session in CLI. Let's inspect the logic:
  const unit = await prisma.unit.findFirst()
  if (!unit) {
    console.log("No unit found")
    return
  }
  const user = await prisma.user.findFirst()
  if (!user) {
    console.log("No user found")
    return
  }

  const dateStr = "20260525"
  const randomSuffix = "9999"
  const entryNo = `TX-${dateStr}-${randomSuffix}`
  const txDescription = "Pembayaran potongan Gaji karyawan"

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the Journal Entry
      const entry = await tx.journal_entries.create({
        data: {
          unit_id: unit.id,
          entry_no: entryNo,
          entry_date: new Date("2026-05-25"),
          description: txDescription,
          reference: category.name,
          source: "manual",
          posted_by: user.id,
          posted_at: new Date(),
          is_posted: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      })

      // 2. Create the Ledger Lines (Pemasukan)
      // Debit (Asset)
      await tx.journal_lines.create({
        data: {
          journal_id: entry.id,
          account_id: bank.id,
          debit: 500000,
          credit: 0,
          description: `Penerimaan via ${bank.name}`,
          created_at: new Date(),
          updated_at: new Date()
        }
      })

      // Credit (Revenue)
      await tx.journal_lines.create({
        data: {
          journal_id: entry.id,
          account_id: category.id,
          debit: 0,
          credit: 500000,
          description: `Penerimaan ${category.name}`,
          created_at: new Date(),
          updated_at: new Date()
        }
      })
      
      return entry
    })

    console.log("Transaction saved successfully! Entry ID:", result.id)

    // Clean up
    await prisma.journal_lines.deleteMany({
      where: { journal_id: result.id }
    })
    await prisma.journal_entries.delete({
      where: { id: result.id }
    })
    console.log("Cleaned up test entry successfully.")
  } catch (error) {
    console.error("Simulation failed with error:", error)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
