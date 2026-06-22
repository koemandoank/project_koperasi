import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("=======================================================================")
  console.log("=== FIXING HISTORICAL SCHEDULE PAYMENT MISMATCHES ===")
  console.log("=======================================================================\n")

  // Find all schedules marked paid
  const paidSchedules = await prisma.loan_schedules.findMany({
    where: { status: "paid" },
    include: {
      loans: {
        include: {
          members: true
        }
      },
      loan_payments: true
    }
  })

  console.log(`Found ${paidSchedules.length} schedules marked 'paid'. Checking for missing payments...`)

  let paymentsCreated = 0

  for (const s of paidSchedules) {
    if (s.loan_payments.length === 0) {
      const loan = s.loans
      const principalPaid = Number(s.principal_paid) || Number(s.principal_due)
      const interestPaid = Number(s.interest_paid) || Number(s.interest_due)
      const amountPaid = principalPaid + interestPaid
      const paymentDate = s.paid_at || s.due_date || new Date()

      // Double check if there's any other payment on the exact same date to be safe
      const dateStr = paymentDate.toISOString().split("T")[0]
      const duplicateCheck = await prisma.loan_payments.findFirst({
        where: {
          loan_id: loan.id,
          paid_at: {
            gte: new Date(`${dateStr}T00:00:00Z`),
            lte: new Date(`${dateStr}T23:59:59Z`)
          }
        }
      })

      if (!duplicateCheck) {
        await prisma.loan_payments.create({
          data: {
            loan_id: loan.id,
            schedule_id: s.id,
            payment_no: `PAY-HIST-${loan.loan_no}-INST-${s.installment_no}-${Math.floor(Math.random() * 1000)}`,
            amount_paid: amountPaid,
            principal_portion: principalPaid,
            interest_portion: interestPaid,
            penalty_amount: 0,
            payment_method: 'salary_cut',
            reference: 'HISTORICAL-RECONCILIATION',
            processed_by: BigInt(1),
            paid_at: paymentDate,
            note: `Pembayaran Angsuran ke-${s.installment_no} (Rekonsiliasi Historis)`,
            created_at: paymentDate,
            updated_at: paymentDate
          }
        })
        console.log(`  ✅ Created missing payment for Loan ${loan.loan_no} Inst #${s.installment_no} on ${dateStr}`)
        paymentsCreated++
      }
    }
  }

  console.log(`\nReconciliation completed! Created ${paymentsCreated} missing loan payment entries.`)

  // Evict cache to be safe
  await prisma.cache.deleteMany({
    where: {
      key: { in: ["members:all", "stats:admin", "stats:koperasi", "members:stats"] }
    }
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())
