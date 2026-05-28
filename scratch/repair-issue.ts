import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const dryRun = process.argv.includes("--commit") ? false : true
  console.log(`=======================================================================`)
  console.log(`=== RUNNING DATABASE REPAIR SCRIPT (DRY RUN: ${dryRun}) ===`)
  console.log(`=======================================================================\n`)

  // ───────────────────────────────────────────────────────────────────────────
  // PART 1: CREATE MISSING DISBURSEMENT JOURNAL ENTRIES (SCAN 10)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("--- PART 1: Repairing Ledger Discrepancies by creating missing disbursement journals ---")
  const allLoans = await prisma.loans.findMany({
    include: {
      members: true
    }
  })

  let createdJournals = 0
  for (const loan of allLoans) {
    // Check if disbursement journal already exists
    const entryNo = `TX-DISB-${loan.loan_no}`
    const exists = await prisma.journal_entries.findUnique({
      where: { entry_no: entryNo }
    })

    if (exists) {
      console.log(`  Loan ${loan.loan_no}: Disbursement journal already exists. Skipping.`)
      continue
    }

    const principal = Number(loan.principal)
    console.log(`  Loan ${loan.loan_no} (${loan.members.full_name}): Missing disbursement journal of Rp ${principal.toLocaleString("id-ID")}.`)

    if (!dryRun) {
      await prisma.$transaction(async (tx) => {
        // Create journal entry
        const entry = await tx.journal_entries.create({
          data: {
            unit_id: BigInt(1), // Default Unit
            entry_no: entryNo,
            entry_date: loan.disbursed_at,
            description: `Pencairan Pinjaman ${loan.loan_no} — ${loan.members.full_name}`,
            reference: loan.loan_no,
            source: "loan",
            is_posted: true,
            posted_by: BigInt(1),
            posted_at: new Date()
          }
        })

        // Debit Piutang Pinjaman Anggota (COA 10201 - Account ID 15)
        await tx.journal_lines.create({
          data: {
            journal_id: entry.id,
            account_id: BigInt(15),
            debit: loan.principal,
            credit: 0,
            description: `Pencairan Pinjaman ${loan.loan_no}`
          }
        })

        // Credit Bank Mandiri (Koperasi) (COA 10102 - Account ID 2)
        await tx.journal_lines.create({
          data: {
            journal_id: entry.id,
            account_id: BigInt(2),
            debit: 0,
            credit: loan.principal,
            description: `Pencairan Pinjaman ${loan.loan_no}`
          }
        })
      })
      console.log(`    ✅ Created disbursement journal entry: ${entryNo}`)
    }
    createdJournals++
  }
  console.log(`  Total disbursement journals processed: ${createdJournals}\n`)

  // ───────────────────────────────────────────────────────────────────────────
  // PART 2: INITIALIZE MISSING SIMPANAN POKOK (SCAN 8)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("--- PART 2: Initializing missing Simpanan Pokok (SP) for system/admin members ---")
  const spType = await prisma.saving_types.findFirst({ where: { code: "SP" } })
  
  if (!spType) {
    console.log("Error: Simpanan Pokok (SP) type not found in database.\n")
  } else {
    const adminNiks = ["ADM001", "SAD001", "KAS001", "PEN001", "KET001"]
    const adminMembers = await prisma.member.findMany({
      where: { nik: { in: adminNiks } },
      include: { savings: { where: { saving_type_id: spType.id } } }
    })

    let initializedSp = 0
    for (const member of adminMembers) {
      const hasSp = member.savings.length > 0 && Number(member.savings[0].balance) > 0
      if (hasSp) {
        console.log(`  Member ${member.full_name} (${member.nik}): Simpanan Pokok already initialized. Skipping.`)
        continue
      }

      console.log(`  Member ${member.full_name} (${member.nik}): Missing Simpanan Pokok. Initializing with Rp 300.000.`)

      if (!dryRun) {
        await prisma.$transaction(async (tx) => {
          let savingsId: bigint

          if (member.savings.length === 0) {
            const savings = await tx.savings.create({
              data: {
                member_id: member.id,
                saving_type_id: spType.id,
                balance: 300000,
                total_deposit: 300000,
                total_withdraw: 0
              }
            })
            savingsId = savings.id
          } else {
            const s = member.savings[0]
            await tx.savings.update({
              where: { id: s.id },
              data: {
                balance: 300000,
                total_deposit: 300000
              }
            })
            savingsId = s.id
          }

          // Create transaction record
          await tx.saving_transactions.create({
            data: {
              savings_id: savingsId,
              member_id: member.id,
              type: "deposit",
              amount: 300000,
              balance_before: 0,
              balance_after: 300000,
              reference_no: `TX-SP-INIT-${member.nik}`,
              note: "Inisialisasi Simpanan Pokok Anggota",
              transaction_at: member.join_date,
              processed_by: BigInt(1)
            }
          })
        })
        console.log(`    ✅ Initialized Simpanan Pokok for ${member.full_name}`)
      }
      initializedSp++
    }
    console.log(`  Total Simpanan Pokok processed: ${initializedSp}\n`)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PART 3: FIX SALSABILA PUTRI DUPLICATE ACTIVE LOANS (SCAN 6)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("--- PART 3: Fixing Salsabila Putri duplicate active loans ---")
  const salsaLoan = await prisma.loans.findUnique({
    where: { loan_no: "L-202605-0051" },
    include: { loan_applications: true }
  })

  if (salsaLoan) {
    console.log(`  Loan L-202605-0051 found. Current product ID: ${salsaLoan.loan_applications.loan_product_id}`)
    
    // We change the loan product to LP-003 (Pinjaman Kilat, ID 1) to resolve duplicate LP-002
    if (!dryRun) {
      await prisma.loan_applications.update({
        where: { id: salsaLoan.application_id },
        data: {
          loan_product_id: BigInt(1), // LP-003
          updated_at: new Date()
        }
      })
      console.log(`    ✅ Successfully updated L-202605-0051 application to LP-003 (Pinjaman Kilat)`)
    } else {
      console.log(`    (Dry Run) Would update application ${salsaLoan.application_id} product to ID 1 (LP-003)`)
    }
  } else {
    console.log("  Warning: Loan L-202605-0051 not found.")
  }
  console.log()

  console.log(`=======================================================================`)
  console.log(`=== PROCESS COMPLETED (Dry Run: ${dryRun}) ===`)
  console.log(`=======================================================================`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
