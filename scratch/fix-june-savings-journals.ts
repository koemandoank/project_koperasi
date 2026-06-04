import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function ensureCoa(
  unitId: bigint,
  code: string,
  name: string,
  type: "asset" | "liability",
  normalBalance: "debit" | "credit"
) {
  let coa = await prisma.chart_of_accounts.findFirst({
    where: { unit_id: unitId, code: code }
  })
  if (!coa) {
    coa = await prisma.chart_of_accounts.create({
      data: {
        unit_id: unitId,
        code,
        name,
        type,
        normal_balance: normalBalance,
        level: 1,
        is_header: false,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    })
    console.log(`  [COA] Created missing account ${code} - ${name} for Unit ${unitId}`)
  }
  return coa
}

async function main() {
  console.log("=======================================================================")
  console.log("=== FIXING JUNE SAVINGS TRANSACTIONS JOURNAL ENTRIES ===")
  console.log("=======================================================================\n")

  const monthStart = new Date("2026-06-01T00:00:00Z")
  const deposits = await prisma.saving_transactions.findMany({
    where: {
      type: "deposit",
      created_at: { gte: monthStart }
    },
    include: {
      members: true,
      savings: { include: { saving_types: true } }
    }
  })

  console.log(`Found ${deposits.length} deposits to process...`)

  let journalsCreated = 0

  for (const d of deposits) {
    const member = d.members
    const unitId = member.unit_id
    const amount = Number(d.amount)
    const txDate = d.created_at || new Date()

    const entryNo = `TX-DEP-SS-${d.id}`

    // Check if journal entry already exists
    const existing = await prisma.journal_entries.findUnique({
      where: { entry_no: entryNo }
    })

    if (!existing) {
      // Determine the correct liability/equity COA for this saving type
      const savingCode = d.savings.saving_types.code
      let targetCoaCode = "20101" // Default to Sukarela
      let targetCoaName = "Simpanan Sukarela Anggota"
      let targetCoaType: "liability" | "asset" = "liability"

      if (savingCode === "SW") {
        targetCoaCode = "20102"
        targetCoaName = "Simpanan Wajib Anggota"
      } else if (savingCode === "SP") {
        // Simpanan Pokok uses Modal/Equity (30101) or standard Pokok liability
        targetCoaCode = "30101"
        targetCoaName = "Modal Awal Pendirian Koperasi"
        targetCoaType = "liability" // Set type to liability/equity
      }

      // Ensure the required COAs exist for this unit dynamically
      const kasUtama = await ensureCoa(unitId, "10101", "Kas Utama", "asset", "debit")
      const savingsCoa = await ensureCoa(unitId, targetCoaCode, targetCoaName, targetCoaType, "credit")

      await prisma.$transaction(async (tx) => {
        // Create journal entry
        const entry = await tx.journal_entries.create({
          data: {
            unit_id: unitId,
            entry_no: entryNo,
            entry_date: txDate,
            description: `Penerimaan Kas - Setoran ${d.savings.saving_types.name} ${member.full_name}`,
            source: 'saving',
            is_posted: true,
            posted_at: txDate,
            created_at: txDate,
            updated_at: txDate
          }
        })

        // Create journal lines
        await tx.journal_lines.createMany({
          data: [
            {
              journal_id: entry.id,
              account_id: kasUtama.id,
              debit: amount,
              credit: 0,
              description: `Penerimaan Setoran Simpanan ${member.full_name}`,
              created_at: txDate,
              updated_at: txDate
            },
            {
              journal_id: entry.id,
              account_id: savingsCoa.id,
              debit: 0,
              credit: amount,
              description: `Setoran Simpanan ${member.full_name}`,
              created_at: txDate,
              updated_at: txDate
            }
          ]
        })
      })

      console.log(`  ✅ Created journal entries for deposit transaction ID ${d.id} (Member: ${member.full_name})`)
      journalsCreated++
    }
  }

  console.log(`\nReconciliation completed! Created ${journalsCreated} saving journal entries.`)

  // Evict cache to be safe
  await prisma.cache.deleteMany({
    where: {
      key: { in: ["members:all", "stats:admin", "stats:koperasi", "members:stats"] }
    }
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())
