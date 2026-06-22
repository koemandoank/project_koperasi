import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("=======================================================================")
  console.log("=== MERGING DUPLICATE CHART OF ACCOUNTS (COA) ===")
  console.log("=======================================================================\n")

  // Find all accounts
  const allAccounts = await prisma.chart_of_accounts.findMany({
    orderBy: { id: "asc" }
  })

  // Group by code
  const byCode = new Map<string, typeof allAccounts>()
  for (const acc of allAccounts) {
    if (!byCode.has(acc.code)) {
      byCode.set(acc.code, [])
    }
    byCode.get(acc.code)!.push(acc)
  }

  let totalMerged = 0

  for (const [code, accs] of byCode.entries()) {
    if (accs.length > 1) {
      const primary = accs[0]
      const duplicates = accs.slice(1)
      const duplicateIds = duplicates.map(d => d.id)

      console.log(`Code [${code}]: Keeping ID ${primary.id} (${primary.name})`)
      console.log(`  Merging duplicate IDs: ${duplicateIds.join(", ")}`)

      await prisma.$transaction([
        // 1. Update journal lines pointing to duplicate account IDs to point to the primary
        prisma.journal_lines.updateMany({
          where: { account_id: { in: duplicateIds } },
          data: { account_id: primary.id }
        }),
        // 2. Update parent_id of any accounts pointing to duplicates to point to the primary
        prisma.chart_of_accounts.updateMany({
          where: { parent_id: { in: duplicateIds } },
          data: { parent_id: primary.id }
        }),
        // 3. Delete the duplicate account records
        prisma.chart_of_accounts.deleteMany({
          where: { id: { in: duplicateIds } }
        })
      ])

      console.log(`  ✅ Successfully merged duplicate accounts for code ${code}.\n`)
      totalMerged += duplicates.length
    }
  }

  // Clear caches
  try {
    await prisma.cache.deleteMany({
      where: {
        key: { in: ["stats:admin", "stats:koperasi", "members:stats"] }
      }
    })
    console.log("✅ Cache cleared.\n")
  } catch (_) {}

  console.log(`=== PROCESS COMPLETED. Total duplicate COA records merged: ${totalMerged} ===`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
