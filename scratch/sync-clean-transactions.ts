import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log("======================================================================")
  console.log("=== STARTING FULL DATABASE TRANSACTION CLEANUP & SYNC FOR SIMULATION ===")
  console.log("======================================================================\n")

  // ───────────────────────────────────────────────────────────────────────────
  // PART 1: CLEANING UP AND RESETTING SAVINGS TRANSACTIONS FOR MAY 2026
  // ───────────────────────────────────────────────────────────────────────────
  console.log("--- PART 1: Resetting May 2026 Simpanan Wajib (SW) to Unpaid ---")
  
  const swType = await prisma.saving_types.findFirst({
    where: { code: 'SW' }
  })

  if (!swType) {
    console.error("Saving type 'SW' not found!")
    return
  }

  const startOfMay = new Date('2026-05-01T00:00:00Z')
  const endOfMay = new Date('2026-05-31T23:59:59Z')

  // Find all SW salary_cut transactions in May 2026
  const maySwTransactions = await prisma.saving_transactions.findMany({
    where: {
      savings: {
        saving_type_id: swType.id
      },
      transaction_at: {
        gte: startOfMay,
        lte: endOfMay
      },
      type: 'salary_cut'
    }
  })

  console.log(`Found ${maySwTransactions.length} existing May 2026 SW transactions in database.`)

  let savingsAdjusted = 0
  for (const trx of maySwTransactions) {
    const amount = Number(trx.amount)
    
    await prisma.$transaction([
      // Deduct savings balance & total_deposit
      prisma.savings.update({
        where: { id: trx.savings_id },
        data: {
          balance: { decrement: amount },
          total_deposit: { decrement: amount }
        }
      }),
      // Delete the transaction record
      prisma.saving_transactions.delete({
        where: { id: trx.id }
      })
    ])
    savingsAdjusted++
  }
  console.log(`Successfully reverted ${savingsAdjusted} member savings accounts to unpaid for May 2026.\n`)

  // ───────────────────────────────────────────────────────────────────────────
  // PART 2: CLEANING UP AND RESETTING LOANS TO EXACTLY 1 MONTH PAID
  // ───────────────────────────────────────────────────────────────────────────
  console.log("--- PART 2: Resetting all active loans to exactly 1 month paid only ---")

  const activeLoans = await prisma.loans.findMany({
    where: { status: 'active' },
    include: {
      loan_schedules: {
        orderBy: { installment_no: 'asc' }
      },
      members: { select: { full_name: true } }
    }
  })

  console.log(`Found ${activeLoans.length} active loans.`)

  let loansResetCount = 0

  for (const loan of activeLoans) {
    const tenor = loan.tenor_months
    if (tenor <= 1) {
      console.log(`Skipping Loan ${loan.loan_no} (Tenor is 1 month or less)`)
      continue
    }

    const principal = Number(loan.principal)
    const monthlyInstallment = Number(loan.monthly_installment)
    
    // Schedule 1 details
    const schedule1 = loan.loan_schedules.find(s => s.installment_no === 1)
    if (!schedule1) {
      console.warn(`Warning: Installment #1 not found for Loan ${loan.loan_no}. Skipping.`)
      continue
    }

    const principalPaid1 = Number(schedule1.principal_due)
    const interestPaid1 = Number(schedule1.interest_due)
    const totalPaid1 = Number(schedule1.total_due)

    // Mathematically perfect targets for 1 month paid
    const targetOutstanding = principal - principalPaid1
    const targetTotalPaid = totalPaid1

    console.log(`Resetting Loan ${loan.loan_no} (${loan.members?.full_name}):`)
    console.log(`  * Principal: Rp ${principal.toLocaleString('id-ID')}`)
    console.log(`  * Target Outstanding: Rp ${targetOutstanding.toLocaleString('id-ID')} | Target Total Paid: Rp ${targetTotalPaid.toLocaleString('id-ID')}`)

    await prisma.$transaction(async (tx) => {
      // 1. Delete all existing payments for this loan in the database to clean up duplicates
      await tx.loan_payments.deleteMany({
        where: { loan_id: loan.id }
      })

      // 2. Create exactly ONE clean payment representing Month 1 (April 2026)
      const paymentDate = loan.first_due_date || new Date('2026-04-24T10:00:00Z')
      await tx.loan_payments.create({
        data: {
          loan_id: loan.id,
          schedule_id: schedule1.id,
          payment_no: `PAY-INIT-${loan.loan_no}`,
          amount_paid: totalPaid1,
          principal_portion: principalPaid1,
          interest_portion: interestPaid1,
          penalty_amount: 0,
          payment_method: 'salary_cut',
          reference: 'INITIAL-SEED-APRIL',
          processed_by: BigInt(1), // System admin
          paid_at: paymentDate,
          note: `Pembayaran Angsuran ke-1 (Masa Lalu) — Inisialisasi Simulasi`,
          created_at: paymentDate,
          updated_at: paymentDate
        }
      })

      // 3. Ensure Schedule 1 is marked as PAID
      await tx.loan_schedules.update({
        where: { id: schedule1.id },
        data: {
          status: 'paid',
          paid_at: paymentDate,
          principal_paid: principalPaid1,
          interest_paid: interestPaid1,
          updated_at: new Date()
        }
      })

      // 4. Revert all schedules from installment 2 onwards to PENDING
      await tx.loan_schedules.updateMany({
        where: {
          loan_id: loan.id,
          installment_no: { gte: 2 }
        },
        data: {
          status: 'pending',
          paid_at: null,
          principal_paid: 0,
          interest_paid: 0,
          updated_at: new Date()
        }
      })

      // 5. Update the parent loan outstanding and total paid totals
      await tx.loans.update({
        where: { id: loan.id },
        data: {
          outstanding_principal: targetOutstanding,
          total_paid: targetTotalPaid,
          status: 'active',
          updated_at: new Date()
        }
      })
    })

    loansResetCount++
  }

  console.log("\n======================================================================")
  console.log("=== CLEANUP & SYNCHRONIZATION COMPLETED SUCCESSFULLY ===")
  console.log(`- Reverted Savings: ${savingsAdjusted} accounts`)
  console.log(`- Reset Loans & Schedules: ${loansResetCount} active loans`)
  console.log("======================================================================")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
