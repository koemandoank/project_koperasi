import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("=== INSPECT COA 10201 RECORDS ===")
  const coas = await prisma.chart_of_accounts.findMany({
    where: { code: "10201" },
    include: { units: true }
  })
  
  for (const c of coas) {
    console.log(`COA ID: ${c.id} | Code: ${c.code} | Name: ${c.name} | Unit: ${c.units.code} - ${c.units.name}`)
    const linesSum = await prisma.journal_lines.aggregate({
      where: { account_id: c.id },
      _sum: { debit: true, credit: true }
    })
    console.log(`  Debit sum: Rp ${Number(linesSum._sum.debit ?? 0).toLocaleString("id-ID")}`)
    console.log(`  Credit sum: Rp ${Number(linesSum._sum.credit ?? 0).toLocaleString("id-ID")}`)
    console.log(`  Balance: Rp ${Number(Number(linesSum._sum.debit ?? 0) - Number(linesSum._sum.credit ?? 0)).toLocaleString("id-ID")}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
