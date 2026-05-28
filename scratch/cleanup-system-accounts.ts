import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

const systemNiks = ["ADM001", "SAD001", "KAS001", "PEN001", "KET001"]

async function main() {
  console.log("=== INSPECTING AND CLEANING SYSTEM ACCOUNT SAVINGS ===")

  // Find the members
  const members = await prisma.member.findMany({
    where: { nik: { in: systemNiks } },
    include: {
      savings: {
        include: { saving_types: true }
      },
      saving_transactions: true
    }
  })

  for (const m of members) {
    console.log(`\nMember: ${m.full_name} (${m.nik})`)
    console.log(`  Savings count: ${m.savings.length}`)
    for (const s of m.savings) {
      console.log(`    - ID: ${s.id} | Type: ${s.saving_types.code} | Balance: Rp ${Number(s.balance).toLocaleString("id-ID")}`)
    }
    console.log(`  Transactions count: ${m.saving_transactions.length}`)
    for (const t of m.saving_transactions) {
      console.log(`    - ID: ${t.id} | Ref: ${t.reference_no} | Type: ${t.type} | Amount: Rp ${Number(t.amount).toLocaleString("id-ID")}`)
    }
  }

  // Perform cleanup
  console.log("\n--- CLEANING UP INITIALIZED SP RECORDS ---")
  const spType = await prisma.saving_types.findFirst({ where: { code: "SP" } })
  if (!spType) {
    console.error("SP Type not found")
    return
  }

  for (const m of members) {
    // 1. Delete transactions
    const deletedTxs = await prisma.saving_transactions.deleteMany({
      where: {
        member_id: m.id,
        reference_no: { startsWith: `TX-SP-INIT-` }
      }
    })
    console.log(`  ${m.full_name}: Deleted ${deletedTxs.count} initialized transactions`)

    // 2. Delete savings records of type SP
    const deletedSavings = await prisma.savings.deleteMany({
      where: {
        member_id: m.id,
        saving_type_id: spType.id
      }
    })
    console.log(`  ${m.full_name}: Deleted ${deletedSavings.count} SP savings records`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
