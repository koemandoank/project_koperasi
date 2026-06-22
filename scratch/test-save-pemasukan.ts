import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findFirst()
  if (!user) {
    console.log("No user found!")
    return
  }
  
  const unit = await prisma.unit.findFirst()
  if (!unit) {
    console.log("No unit found!")
    return
  }

  const account = await prisma.chart_of_accounts.findFirst({
    where: { type: "asset" }
  })
  
  const category = await prisma.chart_of_accounts.findFirst({
    where: { type: "revenue" }
  })

  if (!account || !category) {
    console.log(`COA not found! Account (asset): ${account?.name}, Category (revenue): ${category?.name}`)
    return
  }

  console.log(`Using User: ${user.username} (ID: ${user.id})`)
  console.log(`Using Unit: ${unit.name} (ID: ${unit.id})`)
  console.log(`Using Account: ${account.name} (ID: ${account.id})`)
  console.log(`Using Category: ${category.name} (ID: ${category.id})`)

  const dateParsed = new Date()
  const entryNo = `TX-${Date.now()}-TEST`
  const txDescription = `Test Pemasukan via ${account.name}`

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the Journal Entry
      const entry = await tx.journal_entries.create({
        data: {
          unit_id: unit.id,
          entry_no: entryNo,
          entry_date: dateParsed,
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
          account_id: account.id,
          debit: 100000,
          credit: 0,
          description: `Penerimaan via ${account.name}`,
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
          credit: 100000,
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
    console.error("Transaction failed with error:", error)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
