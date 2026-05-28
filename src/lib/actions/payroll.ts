"use server"

import { prisma } from "@/lib/db/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { logAudit } from "@/lib/actions/log-audit"
import { verifySessionAndRole } from "@/lib/auth-helpers"

interface PayrollBatchResult {
  success: boolean
  savingsCount: number
  savingsAmount: number
  loansCount: number
  loansAmount: number
  error?: string
}

/**
 * Memproses pemotongan gaji (salary_cut) massal bulanan untuk:
 *  1. Simpanan Wajib anggota aktif (Rp 300.000).
 *  2. Angsuran pinjaman berjalan bertipe 'salary_cut' yang jatuh tempo di bulan terpilih.
 *
 * Seluruh eksekusi dilakukan dalam satu Prisma Transaction untuk menjamin integritas data.
 */
export async function processMonthlyPayrollBatch({
  from,
  to,
}: {
  from: string
  to: string
}): Promise<PayrollBatchResult> {
  try {
    // 1. Verifikasi peran Admin/Pengurus
    const session = await verifySessionAndRole(["superadmin", "ketua", "pengurus", "admin"])
    const userId = session.user.id

    const startDate = new Date(from)
    const endDate = new Date(to)
    endDate.setHours(23, 59, 59, 999)

    // Format label periode untuk referensi transaksi (misal: "202605" untuk Mei 2026)
    const periodCode = `${startDate.getFullYear()}${(startDate.getMonth() + 1).toString().padStart(2, "0")}`

    // 2. Ambil Saving Type Simpanan Wajib (SW)
    const swType = await prisma.saving_types.findFirst({
      where: { code: "SW" }
    })
    if (!swType) {
      return { success: false, savingsCount: 0, savingsAmount: 0, loansCount: 0, loansAmount: 0, error: "Tipe Simpanan Wajib (SW) tidak ditemukan di database." }
    }

    const swAmount = Number(swType.monthly_amount)

    // 3. Cari anggota aktif yang belum dipotong Simpanan Wajib di bulan ini
    const activeMembers = await prisma.member.findMany({
      where: { status: "active" },
      include: {
        savings: {
          where: { saving_type_id: swType.id }
        }
      }
    })

    const membersNeedingSw: typeof activeMembers = []
    for (const member of activeMembers) {
      // Periksa apakah transaksi 'salary_cut' untuk Simpanan Wajib bulan ini sudah ada
      const existingTrx = await prisma.saving_transactions.findFirst({
        where: {
          member_id: member.id,
          savings: { saving_type_id: swType.id },
          transaction_at: { gte: startDate, lte: endDate },
          type: "salary_cut"
        }
      })

      if (!existingTrx && member.savings.length > 0) {
        membersNeedingSw.push(member)
      }
    }

    // 4. Cari jadwal angsuran pinjaman (salary_cut) pending yang jatuh tempo di bulan ini
    const pendingSchedules = await prisma.loan_schedules.findMany({
      where: {
        due_date: { gte: startDate, lte: endDate },
        status: { in: ["pending", "partial", "overdue"] },
        loans: {
          repayment_method: "salary_cut",
          status: "active"
        }
      },
      include: {
        loans: true
      }
    })

    console.log(`[Payroll Batch] Processing SW for ${membersNeedingSw.length} members.`)
    console.log(`[Payroll Batch] Processing ${pendingSchedules.length} pending loan schedules.`)

    if (membersNeedingSw.length === 0 && pendingSchedules.length === 0) {
      return {
        success: true,
        savingsCount: 0,
        savingsAmount: 0,
        loansCount: 0,
        loansAmount: 0,
        error: "Seluruh potongan gaji untuk periode ini sudah selesai diproses sebelumnya."
      }
    }

    // 5. Eksekusi batch di dalam transaksi database tunggal
    const result = await prisma.$transaction(async (tx) => {
      let savingsCount = 0
      let savingsAmount = 0
      let loansCount = 0
      let loansAmount = 0

      // A. Proses Simpanan Wajib Massal
      const payrollDate = new Date(startDate.getFullYear(), startDate.getMonth(), 25, 10, 0, 0) // Kunci ke tanggal 25 pukul 10:00 pagi

      for (const member of membersNeedingSw) {
        const savingsRecord = member.savings[0]
        const balanceBefore = Number(savingsRecord.balance)
        const balanceAfter = balanceBefore + swAmount

        // 1) Buat record transaksi simpanan
        await tx.saving_transactions.create({
          data: {
            savings_id:     savingsRecord.id,
            member_id:      member.id,
            type:           "salary_cut",
            amount:         swAmount,
            balance_before: balanceBefore,
            balance_after:  balanceAfter,
            reference_no:   `PAYROLL-SW-${member.member_code}-${periodCode}`,
            note:           `Potongan Gaji Bulanan Simpanan Wajib — Periode ${periodCode}`,
            processed_by:   BigInt(userId),
            transaction_at: payrollDate,
            created_at:     payrollDate,
            updated_at:     payrollDate
          }
        })

        // 2) Update saldo utama simpanan
        await tx.savings.update({
          where: { id: savingsRecord.id },
          data: {
            balance:       balanceAfter,
            total_deposit: { increment: swAmount },
            updated_at:    new Date()
          }
        })

        savingsCount++
        savingsAmount += swAmount
      }

      // B. Proses Angsuran Pinjaman Massal
      for (const schedule of pendingSchedules) {
        const loan = schedule.loans
        const remainingAmount = Number(schedule.total_due) - Number(schedule.principal_paid) - Number(schedule.interest_paid)
        if (remainingAmount <= 0) continue

        const outstanding = Number(loan.outstanding_principal)
        const interestPortion = Math.max(0, Number(schedule.interest_due) - Number(schedule.interest_paid))
        const principalPortion = remainingAmount - interestPortion

        // Jangan melebihi sisa outstanding
        const safePrincipalPortion = Math.min(outstanding, Math.max(0, principalPortion))

        const paymentNo = `PAY-BATCH-${Date.now()}-${loan.loan_no}`

        // 1) Catat pembayaran angsuran
        await tx.loan_payments.create({
          data: {
            loan_id:           loan.id,
            schedule_id:       schedule.id,
            payment_no:        paymentNo,
            amount_paid:       remainingAmount,
            principal_portion: safePrincipalPortion,
            interest_portion:  interestPortion,
            penalty_amount:    0,
            payment_method:    "salary_cut",
            reference:         `BATCH-PAYROLL-${periodCode}`,
            processed_by:      BigInt(userId),
            paid_at:           payrollDate,
            note:              `Potongan Gaji Massal Angsuran ke-${schedule.installment_no} — Periode ${periodCode}`,
            created_at:        payrollDate,
            updated_at:        payrollDate
          }
        })

        // 2) Update status jadwal angsuran ke PAID
        await tx.loan_schedules.update({
          where: { id: schedule.id },
          data: {
            status:         "paid",
            paid_at:        payrollDate,
            principal_paid: Number(schedule.principal_due),
            interest_paid:  Number(schedule.interest_due),
            updated_at:     new Date()
          }
        })

        // 3) Update sisa saldo pinjaman
        const nextOutstanding = Math.max(0, outstanding - safePrincipalPortion)
        await tx.loans.update({
          where: { id: loan.id },
          data: {
            outstanding_principal: nextOutstanding,
            total_paid:            { increment: remainingAmount },
            status:                nextOutstanding <= 0 ? "paid_off" : loan.status,
            updated_at:            new Date()
          }
        })

        loansCount++
        loansAmount += remainingAmount
      }

      return {
        success: true,
        savingsCount,
        savingsAmount,
        loansCount,
        loansAmount
      }
    })

    // Log ke audit trail
    await logAudit({
      action: "UPDATE",
      modelType: "payroll",
      modelId: null,
      newValues: {
        periodCode,
        savingsProcessed: result.savingsCount,
        savingsAmount: result.savingsAmount,
        loansProcessed: result.loansCount,
        loansAmount: result.loansAmount,
      }
    })

    // 6. Revalidasi halaman
    revalidatePath("/laporan/potongan-gaji")
    revalidatePath("/pinjaman")
    revalidatePath("/simpanan")

    return result
  } catch (error: any) {
    console.error("processMonthlyPayrollBatch error:", error)
    return {
      success: false,
      savingsCount: 0,
      savingsAmount: 0,
      loansCount: 0,
      loansAmount: 0,
      error: error?.message || "Terjadi kesalahan fatal saat memproses potongan gaji massal."
    }
  }
}
