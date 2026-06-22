import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function ensureCoa(
  unitId: bigint,
  code: string,
  name: string,
  type: "asset" | "revenue",
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
  console.log("=== STARTING ADMIN CLOSURES & PAYMENTS SEEDING ===")
  console.log("=======================================================================\n")

  const unit = await prisma.unit.findFirst({ where: { code: 'U-001' } })
  const unitId = unit ? unit.id : BigInt(1)

  const cashier = await prisma.user.findFirst({
    where: { role: { in: ['superadmin', 'admin', 'kasir'] } }
  })
  const cashierId = cashier ? cashier.id : BigInt(1)

  // 1. SEED CASH REGISTER SESSIONS FOR ALL POS TRANSACTION DATES
  console.log("--- STEP 1: Seeding cash_register_sessions for all POS order dates ---")
  const orders = await prisma.orders.findMany({
    select: {
      id: true,
      ordered_at: true,
      grand_total: true,
      payment_method: true
    }
  })

  // Group cash orders by date string (YYYY-MM-DD)
  const ordersByDate: Record<string, { totalCash: number; ordersCount: number; date: Date }> = {}
  for (const o of orders) {
    const dateStr = o.ordered_at.toISOString().split("T")[0]
    if (!ordersByDate[dateStr]) {
      ordersByDate[dateStr] = { totalCash: 0, ordersCount: 0, date: o.ordered_at }
    }
    ordersByDate[dateStr].ordersCount++
    if (o.payment_method === "cash") {
      ordersByDate[dateStr].totalCash += Number(o.grand_total)
    }
  }

  let sessionsCreated = 0
  for (const dateStr in ordersByDate) {
    const sessionDateStart = new Date(dateStr)
    sessionDateStart.setHours(0, 0, 0, 0)

    const existingSession = await prisma.cash_register_sessions.findFirst({
      where: {
        cash_register_id: BigInt(1),
        session_date: sessionDateStart
      }
    })

    if (!existingSession) {
      const openTime = new Date(sessionDateStart)
      openTime.setHours(7, 30, 0, 0)
      const closeTime = new Date(sessionDateStart)
      closeTime.setHours(17, 30, 0, 0)

      const cashSales = ordersByDate[dateStr].totalCash

      await prisma.cash_register_sessions.create({
        data: {
          cash_register_id: BigInt(1),
          session_date: sessionDateStart,
          opened_by: cashierId,
          closed_by: cashierId,
          opening_balance: 100000,
          closing_balance: 100000 + cashSales,
          expected_balance: 100000 + cashSales,
          difference: 0,
          status: "closed",
          notes: "Tutup Kas Harian Otomatis (Simulasi)",
          opened_at: openTime,
          closed_at: closeTime,
          created_at: openTime,
          updated_at: closeTime
        }
      })
      sessionsCreated++
    }
  }
  console.log(`  ✅ Created ${sessionsCreated} cash register sessions for daily closures.\n`)

  // 2. PAY OFF OVERDUE LOAN SCHEDULES TO LOWER NPL
  console.log("--- STEP 2: Settling Overdue Loan Schedules (Admin Payment Inputs) ---")
  const today = new Date()
  const overdueSchedules = await prisma.loan_schedules.findMany({
    where: {
      status: { not: "paid" },
      due_date: { lt: today }
    },
    include: {
      loans: {
        include: {
          members: true
        }
      }
    }
  })

  console.log(`  Found ${overdueSchedules.length} overdue schedules to process.`)

  let schedulesSettled = 0
  for (const s of overdueSchedules) {
    const loan = s.loans
    const loanUnitId = loan.members.unit_id
    const principalPaid = Number(s.principal_due)
    const interestPaid = Number(s.interest_due)
    const amountPaid = principalPaid + interestPaid
    const paymentDate = s.due_date

    // Ensure the required COAs exist for this unit dynamically
    const kasUtama = await ensureCoa(loanUnitId, "10101", "Kas Utama", "asset", "debit")
    const coaAssetReceivable = await ensureCoa(loanUnitId, "10201", "Piutang Pinjaman Anggota", "asset", "debit")
    const coaJasaKoperasi = await ensureCoa(loanUnitId, "40101", "Jasa Koperasi", "revenue", "credit")

    const targetOutstanding = Math.max(0, Number(loan.outstanding_principal) - principalPaid)
    const targetTotalPaid = Number(loan.total_paid) + amountPaid
    const isFullyPaid = targetOutstanding <= 0.01

    await prisma.$transaction(async (tx) => {
      // A. Create clean loan payment entry
      await tx.loan_payments.create({
        data: {
          loan_id: loan.id,
          schedule_id: s.id,
          payment_no: `PAY-${loan.loan_no}-INST-${s.installment_no}`,
          amount_paid: amountPaid,
          principal_portion: principalPaid,
          interest_portion: interestPaid,
          penalty_amount: 0,
          payment_method: 'cash',
          reference: 'ADMIN-CLOSURE-INPUT',
          processed_by: cashierId,
          paid_at: paymentDate,
          note: `Pembayaran Angsuran ke-${s.installment_no} — Input Pengurus`,
          created_at: paymentDate,
          updated_at: paymentDate
        }
      })

      // B. Update schedule status to paid
      await tx.loan_schedules.update({
        where: { id: s.id },
        data: {
          status: 'paid',
          paid_at: paymentDate,
          principal_paid: principalPaid,
          interest_paid: interestPaid,
          updated_at: new Date()
        }
      })

      // C. Update parent loan totals
      await tx.loans.update({
        where: { id: loan.id },
        data: {
          outstanding_principal: targetOutstanding,
          total_paid: targetTotalPaid,
          status: isFullyPaid ? 'paid_off' : 'active',
          updated_at: new Date()
        }
      })

      // D. Create balanced journal entries for the payment
      const entryNo = `TX-PAY-${loan.loan_no}-INST-${s.installment_no}`
      const entry = await tx.journal_entries.create({
        data: {
          unit_id: loanUnitId,
          entry_no: entryNo,
          entry_date: paymentDate,
          description: `Penerimaan Kas - Angsuran Pinjaman ${loan.loan_no} ke-${s.installment_no}`,
          source: 'loan_payment',
          is_posted: true,
          posted_at: paymentDate,
          created_at: paymentDate,
          updated_at: paymentDate
        }
      })

      await tx.journal_lines.createMany({
        data: [
          {
            journal_id: entry.id,
            account_id: kasUtama.id,
            debit: amountPaid,
            credit: 0,
            description: `Penerimaan Kas Angsuran Pinjaman ${loan.loan_no}`,
            created_at: paymentDate,
            updated_at: paymentDate
          },
          {
            journal_id: entry.id,
            account_id: coaAssetReceivable.id,
            debit: 0,
            credit: principalPaid,
            description: `Pelunasan Pokok Pinjaman ${loan.loan_no}`,
            created_at: paymentDate,
            updated_at: paymentDate
          },
          {
            journal_id: entry.id,
            account_id: coaJasaKoperasi.id,
            debit: 0,
            credit: interestPaid,
            description: `Pendapatan Jasa Koperasi/Bunga ${loan.loan_no}`,
            created_at: paymentDate,
            updated_at: paymentDate
          }
        ]
      })
    })

    schedulesSettled++
  }
  console.log(`  ✅ Successfully settled ${schedulesSettled} overdue schedules and created balanced ledger records.\n`)

  // 3. EVICT DATABASE CACHES
  console.log("--- STEP 3: Evicting system statistics and members caches ---")
  const keys = ["members:all", "stats:admin", "stats:koperasi", "members:stats"]
  const result = await prisma.cache.deleteMany({
    where: {
      key: { in: keys }
    }
  })
  console.log(`  ✅ Successfully evicted ${result.count} cache keys.\n`)

  console.log("=======================================================================")
  console.log("=== ADMIN CLOSURES & PAYMENTS SEEDING COMPLETED ===")
  console.log("=======================================================================")
}

main().catch(console.error).finally(() => prisma.$disconnect())
