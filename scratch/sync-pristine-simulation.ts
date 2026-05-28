import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log("=======================================================================")
  console.log("=== STARTING HISTORICAL ALIGNMENT & SYNC FOR PRISTINE SIMULATION STATE ===")
  console.log("=======================================================================\n")

  const startOfMay = new Date('2026-05-01T00:00:00Z')
  const endOfMay = new Date('2026-05-31T23:59:59Z')

  // ───────────────────────────────────────────────────────────────────────────
  // PART 1: RESETTING SAVINGS TRANSACTIONS FOR MAY 2026
  // ───────────────────────────────────────────────────────────────────────────
  console.log("--- PART 1: Resetting May 2026 Simpanan Wajib (SW) to Unpaid ---")
  
  const swType = await prisma.saving_types.findFirst({
    where: { code: 'SW' }
  })

  if (swType) {
    const maySwTransactions = await prisma.saving_transactions.findMany({
      where: {
        savings: { saving_type_id: swType.id },
        transaction_at: { gte: startOfMay, lte: endOfMay },
        type: 'salary_cut'
      }
    })

    console.log(`Found ${maySwTransactions.length} existing May 2026 SW transactions in database.`)

    let savingsAdjusted = 0
    for (const trx of maySwTransactions) {
      const amount = Number(trx.amount)
      await prisma.$transaction([
        prisma.savings.update({
          where: { id: trx.savings_id },
          data: {
            balance: { decrement: amount },
            total_deposit: { decrement: amount }
          }
        }),
        prisma.saving_transactions.delete({ where: { id: trx.id } })
      ])
      savingsAdjusted++
    }
    console.log(`Successfully reverted ${savingsAdjusted} member savings accounts to unpaid for May 2026.\n`)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PART 2: PERFECT HISTORICAL LOANS SYNC
  // ───────────────────────────────────────────────────────────────────────────
  console.log("--- PART 2: Aligning historical schedules to exactly May 2026 ---")

  const allLoans = await prisma.loans.findMany({
    where: { status: { in: ['active', 'paid_off'] } },
    include: {
      loan_schedules: {
        orderBy: { installment_no: 'asc' }
      },
      members: { select: { full_name: true } }
    }
  })

  console.log(`Found ${allLoans.length} total loans to process.`)

  let activeLoansReset = 0

  for (const loan of allLoans) {
    if (loan.loan_schedules.length === 0) continue

    // Separate schedules: before May 2026 (historical) vs May 2026 onwards (current/future)
    const historicalSchedules = loan.loan_schedules.filter(s => new Date(s.due_date) < startOfMay)
    const currentFutureSchedules = loan.loan_schedules.filter(s => new Date(s.due_date) >= startOfMay)

    // Skip paid off loans that are genuinely paid off and have no future schedules
    if (loan.status === 'paid_off' && currentFutureSchedules.length === 0) {
      console.log(`Skipping genuine paid off Loan ${loan.loan_no} (${loan.members?.full_name})`)
      continue
    }

    console.log(`Aligning Loan ${loan.loan_no} (${loan.members?.full_name}):`)
    console.log(`  * Historical Installments (to be marked PAID): [${historicalSchedules.map(s => s.installment_no).join(', ') || 'none'}]`)
    console.log(`  * May 2026 & Future Installments (to be marked PENDING): [${currentFutureSchedules.map(s => s.installment_no).join(', ') || 'none'}]`)

    await prisma.$transaction(async (tx) => {
      // 1. Delete all existing payments for this loan to clear duplicates and messy state
      await tx.loan_payments.deleteMany({
        where: { loan_id: loan.id }
      })

      let totalPrincipalPaid = 0
      let totalInterestPaid = 0
      let totalAmountPaid = 0

      // 2. Update historical schedules to PAID and create clean payments
      for (const sch of historicalSchedules) {
        const principalDue = Number(sch.principal_due)
        const interestDue = Number(sch.interest_due)
        const totalDue = Number(sch.total_due)

        totalPrincipalPaid += principalDue
        totalInterestPaid += interestDue
        totalAmountPaid += totalDue

        await tx.loan_schedules.update({
          where: { id: sch.id },
          data: {
            status: 'paid',
            paid_at: sch.due_date,
            principal_paid: principalDue,
            interest_paid: interestDue,
            updated_at: new Date()
          }
        })

        // Create clean historical payment record
        await tx.loan_payments.create({
          data: {
            loan_id: loan.id,
            schedule_id: sch.id,
            payment_no: `PAY-HIST-${loan.loan_no}-${sch.installment_no}`,
            amount_paid: totalDue,
            principal_portion: principalDue,
            interest_portion: interestDue,
            penalty_amount: 0,
            payment_method: 'salary_cut',
            reference: `HISTORICAL-SEED-${sch.installment_no}`,
            processed_by: BigInt(1), // Admin
            paid_at: sch.due_date,
            note: `Pembayaran Angsuran ke-${sch.installment_no} (Historis)`,
            created_at: sch.due_date,
            updated_at: sch.due_date
          }
        })
      }

      // 3. Reset May 2026 & Future schedules to PENDING
      for (const sch of currentFutureSchedules) {
        await tx.loan_schedules.update({
          where: { id: sch.id },
          data: {
            status: 'pending',
            paid_at: null,
            principal_paid: 0,
            interest_paid: 0,
            updated_at: new Date()
          }
        })
      }

      // 4. Recalculate parent outstanding principal & total paid
      const principal = Number(loan.principal)
      const targetOutstanding = Math.max(0, principal - totalPrincipalPaid)
      const targetTotalPaid = totalAmountPaid

      // Determine correct status: if outstanding is 0, it's paid off, otherwise active
      const targetStatus = targetOutstanding <= 0 ? 'paid_off' : 'active'

      console.log(`  -> Calculated Outstanding: Rp ${targetOutstanding.toLocaleString('id-ID')} | Total Paid: Rp ${targetTotalPaid.toLocaleString('id-ID')} | Status: ${targetStatus}`)

      await tx.loans.update({
        where: { id: loan.id },
        data: {
          outstanding_principal: targetOutstanding,
          total_paid: targetTotalPaid,
          status: targetStatus,
          updated_at: new Date()
        }
      })
    })

    activeLoansReset++
  }

  console.log("\n=======================================================================")
  console.log("=== SIMULATION HISTORICAL SYNC ALIGNMENT COMPLETED SUCCESSFULLY ===")
  console.log(`- Total aligned active/paid_off loans processed: ${activeLoansReset}`)
  console.log("=======================================================================")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
