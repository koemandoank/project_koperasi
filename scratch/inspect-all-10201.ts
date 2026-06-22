import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const coas = await prisma.chart_of_accounts.findMany({
    where: { code: "10201" }
  })
  
  console.log("=== INSPECTING ALL 10201 COA ACCOUNTS ===")
  for (const coa of coas) {
    const lines = await prisma.journal_lines.findMany({
      where: { account_id: coa.id },
      include: { journal_entries: true }
    })
    
    let totalDebit = 0
    let totalCredit = 0
    console.log(`\nCOA ID: ${coa.id} | Name: ${coa.name}`)
    console.log(`Lines count: ${lines.length}`)
    for (const l of lines) {
      totalDebit += Number(l.debit)
      totalCredit += Number(l.credit)
      console.log(`  Entry: ${l.journal_entries.entry_no} | Debit: Rp ${Number(l.debit).toLocaleString("id-ID")} | Credit: Rp ${Number(l.credit).toLocaleString("id-ID")} | Desc: ${l.description}`)
    }
    console.log(`  Net: Rp ${(totalDebit - totalCredit).toLocaleString("id-ID")}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
