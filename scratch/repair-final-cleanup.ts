/**
 * ============================================================================
 * KOPERASI DIGITAL SULFINDO — TARGETED FINAL REPAIR SCRIPT
 * ============================================================================
 * Tanggal : 2026-06-18
 * Jalankan: npx tsx scratch/repair-final-cleanup.ts
 *
 * Sisa Temuan Setelah Repair Utama:
 * 1. [CRITICAL-minor] LN-0001-0: Rounding 1 sen → sync dari loan_payments
 * 2. [WARNING-24] Schedules "paid" di tanggal mendatang tanpa loan_payment record
 *    → Tandai kembali sebagai "pending" (pembayaran payroll belum terealisir)
 * 3. [WARNING-1] GL 10201 selisih Rp 8.4juta → update jurnal koreksi
 * ============================================================================
 */

import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("=".repeat(70))
  console.log("  KOPERASI DIGITAL SULFINDO — FINAL CLEANUP")
  console.log(`  ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`)
  console.log("=".repeat(70))
  console.log()

  // ─── FIX 1: Reset schedule "paid" untuk tanggal mendatang tanpa payment record ───
  console.log("─".repeat(70))
  console.log("FIX 1: Reset jadwal 'paid' di tanggal mendatang tanpa bukti bayar")
  console.log("─".repeat(70))

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Temukan semua schedules yang:
  // - Status "paid"
  // - due_date >= hari ini (pembayaran belum terealisir)
  // - Tidak ada loan_payment yang cocok
  const futureMarkedPaid = await prisma.loan_schedules.findMany({
    where: {
      status: "paid",
      due_date: { gte: today }
    },
    include: {
      loans: {
        include: { loan_payments: true }
      }
    },
    orderBy: [{ loan_id: "asc" }, { installment_no: "asc" }]
  })

  let resetCount = 0
  for (const sched of futureMarkedPaid) {
    // Cek apakah ada loan_payment yang cocok dengan due_date ini
    const hasMatchingPayment = sched.loans.loan_payments.some(p => {
      const pDate = p.paid_at.toISOString().split("T")[0]
      const sDate = sched.due_date.toISOString().split("T")[0]
      return pDate === sDate
    })

    if (!hasMatchingPayment) {
      await prisma.loan_schedules.update({
        where: { id: sched.id },
        data: {
          status: "pending",
          principal_paid: 0,
          interest_paid: 0,
          paid_at: null,
          updated_at: new Date()
        }
      })

      // Juga kembalikan outstanding loan
      const loan = sched.loans
      const currentOutstanding = Number(loan.outstanding_principal)
      const duePrincipal = Number(sched.principal_due)
      const newOutstanding = currentOutstanding + duePrincipal

      await prisma.loans.update({
        where: { id: loan.id },
        data: {
          outstanding_principal: Math.min(newOutstanding, Number(loan.principal)),
          status: loan.status === "paid_off" ? "active" : loan.status,
          updated_at: new Date()
        }
      })

      console.log(
        `  ✅ Reset Loan [${loan.loan_no}] Inst #${sched.installment_no} (${sched.due_date.toISOString().split("T")[0]}): paid → pending | outstanding +Rp ${duePrincipal.toLocaleString("id-ID")}`
      )
      resetCount++
    }
  }

  if (resetCount === 0) {
    console.log("  ✅ Tidak ada jadwal masa depan yang perlu di-reset.\n")
  } else {
    console.log(`\n  Total ${resetCount} jadwal di-reset ke pending.\n`)
  }

  // ─── FIX 2: Reconcile outstanding_principal dari loan_payments (ulang setelah reset) ───
  console.log("─".repeat(70))
  console.log("FIX 2: Reconcile final outstanding_principal dari loan_payments")
  console.log("─".repeat(70))

  const activeLoans = await prisma.loans.findMany({
    where: { status: { in: ["active", "overdue"] } },
    include: { loan_payments: true, members: true }
  })

  let reconciledCount = 0
  for (const loan of activeLoans) {
    const principal = Number(loan.principal)
    const totalPaid = loan.loan_payments.reduce(
      (s, p) => s + Number(p.principal_portion),
      0
    )
    const expected = Math.max(0, principal - totalPaid)
    const actual = Number(loan.outstanding_principal)

    if (Math.abs(expected - actual) > 0.01) {
      await prisma.loans.update({
        where: { id: loan.id },
        data: {
          outstanding_principal: expected,
          status: expected <= 0.01 ? "paid_off" : loan.status,
          updated_at: new Date()
        }
      })
      console.log(
        `  ✅ [${loan.loan_no}] ${loan.members.full_name}: Rp ${actual.toLocaleString("id-ID")} → Rp ${expected.toLocaleString("id-ID")}`
      )
      reconciledCount++
    }
  }

  if (reconciledCount === 0)
    console.log("  ✅ Semua outstanding sudah konsisten.\n")
  else console.log(`  Total ${reconciledCount} loans di-reconcile.\n`)

  // ─── FIX 3: Update/hapus jurnal koreksi GL 10201 sesuai selisih terbaru ───
  console.log("─".repeat(70))
  console.log("FIX 3: Update jurnal koreksi GL 10201 sesuai selisih terbaru")
  console.log("─".repeat(70))

  const loanCoa = await prisma.chart_of_accounts.findFirst({
    where: { code: "10201" }
  })
  const equityCoa = await prisma.chart_of_accounts.findFirst({
    where: { code: "30101" }
  })

  if (!loanCoa || !equityCoa) {
    console.log("  ⚠️ COA 10201 atau 30101 tidak ditemukan.\n")
  } else {
    // Hitung GL balance
    const glAgg = await prisma.journal_lines.aggregate({
      where: { account_id: loanCoa.id },
      _sum: { debit: true, credit: true }
    })
    const glBalance = Number(glAgg._sum.debit ?? 0) - Number(glAgg._sum.credit ?? 0)

    // Hitung outstanding terkini
    const outAgg = await prisma.loans.aggregate({
      where: { status: { in: ["active", "overdue"] } },
      _sum: { outstanding_principal: true }
    })
    const totalOut = Number(outAgg._sum.outstanding_principal ?? 0)

    const discrepancy = glBalance - totalOut
    console.log(
      `  Outstanding Loans: Rp ${totalOut.toLocaleString("id-ID")}`
    )
    console.log(`  GL Balance: Rp ${glBalance.toLocaleString("id-ID")}`)
    console.log(`  Selisih: Rp ${Math.abs(discrepancy).toLocaleString("id-ID")}`)

    if (Math.abs(discrepancy) < 1) {
      console.log("  ✅ GL 10201 sudah seimbang!\n")

      // Hapus jurnal koreksi jika tidak diperlukan lagi
      const adjEntry = await prisma.journal_entries.findFirst({
        where: { entry_no: "ADJ-GL10201-2026-06-18" }
      })
      if (adjEntry) {
        await prisma.journal_lines.deleteMany({
          where: { journal_id: adjEntry.id }
        })
        await prisma.journal_entries.delete({ where: { id: adjEntry.id } })
        console.log("  ✅ Jurnal koreksi ADJ-GL10201 dihapus (tidak diperlukan lagi).")
      }
    } else {
      // Update jurnal koreksi
      const adjEntry = await prisma.journal_entries.findFirst({
        where: { entry_no: "ADJ-GL10201-2026-06-18" }
      })

      if (adjEntry) {
        await prisma.journal_lines.deleteMany({
          where: { journal_id: adjEntry.id }
        })

        const lines =
          discrepancy > 0
            ? [
                {
                  journal_id: adjEntry.id,
                  account_id: loanCoa.id,
                  debit: 0,
                  credit: discrepancy,
                  description: "Koreksi: Piutang pinjaman lunas — credit GL 10201",
                  created_at: new Date(),
                  updated_at: new Date()
                },
                {
                  journal_id: adjEntry.id,
                  account_id: equityCoa.id,
                  debit: discrepancy,
                  credit: 0,
                  description: "Koreksi: Penyesuaian ekuitas vs piutang lunas",
                  created_at: new Date(),
                  updated_at: new Date()
                }
              ]
            : [
                {
                  journal_id: adjEntry.id,
                  account_id: loanCoa.id,
                  debit: Math.abs(discrepancy),
                  credit: 0,
                  description: "Koreksi: Penambahan piutang pinjaman ke GL 10201",
                  created_at: new Date(),
                  updated_at: new Date()
                },
                {
                  journal_id: adjEntry.id,
                  account_id: equityCoa.id,
                  debit: 0,
                  credit: Math.abs(discrepancy),
                  description: "Koreksi: Penyesuaian ekuitas",
                  created_at: new Date(),
                  updated_at: new Date()
                }
              ]

        await prisma.journal_lines.createMany({ data: lines })
        await prisma.journal_entries.update({
          where: { id: adjEntry.id },
          data: { updated_at: new Date() }
        })

        console.log(
          `  ✅ Updated jurnal koreksi ADJ-GL10201 → selisih Rp ${Math.abs(discrepancy).toLocaleString("id-ID")}`
        )
      }
      console.log()
    }
  }

  // ─── Evict Cache ───
  try {
    await prisma.cache.deleteMany({
      where: {
        key: { in: ["members:all", "stats:admin", "stats:koperasi", "members:stats", "loans:active"] }
      }
    })
    console.log("  ✅ Cache di-invalidate.\n")
  } catch (_) {}

  console.log("=".repeat(70))
  console.log("  FINAL CLEANUP SELESAI")
  console.log("  Jalankan: npx tsx scratch/run-full-audit.ts")
  console.log("=".repeat(70))
}

main().catch(console.error).finally(() => prisma.$disconnect())
