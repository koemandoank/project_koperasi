"use server"

import { prisma } from "@/lib/db/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { logAudit } from "@/lib/actions/log-audit"

/**
 * Catat pembayaran cicilan pinjaman secara manual.
 * Dipanggil oleh kasir/pengurus saat anggota membayar cicilan tunai/transfer.
 *
 * @param loanId       - ID pinjaman aktif
 * @param scheduleId   - ID jadwal cicilan yang dibayar (opsional, jika tidak diketahui = null)
 * @param amountPaid   - Total uang yang dibayar
 * @param paymentMethod - Metode pembayaran: cash | salary_cut | saving_deduct | transfer
 * @param reference    - Nomor referensi / bukti transfer (opsional)
 * @param penaltyAmount - Denda keterlambatan (default 0)
 * @param note         - Catatan tambahan (opsional)
 * @returns { success, data } | { success: false, error }
 */
export async function recordLoanPayment({
  loanId,
  scheduleId,
  amountPaid,
  paymentMethod,
  reference,
  penaltyAmount = 0,
  note,
}: {
  loanId: number
  scheduleId?: number
  amountPaid: number
  paymentMethod: "cash" | "salary_cut" | "saving_deduct" | "transfer"
  reference?: string
  penaltyAmount?: number
  note?: string
}) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: "Tidak terautentikasi" }

    // Validasi pinjaman aktif
    const loan = await prisma.loans.findUnique({
      where: { id: BigInt(loanId) },
      include: {
        members: { select: { full_name: true, nik: true, member_code: true } },
        loan_applications: { include: { loan_products: true } },
      },
    })

    if (!loan) return { success: false, error: "Pinjaman tidak ditemukan" }
    if (loan.status !== "active") {
      return { success: false, error: `Pinjaman sudah berstatus '${loan.status}', tidak dapat menerima pembayaran` }
    }

    // Hitung porsi pokok & bunga dari pembayaran
    const monthlyInstallment = Number(loan.monthly_installment)
    const interestRate       = Number(loan.interest_rate)
    const outstanding        = Number(loan.outstanding_principal)

    // Flat interest: bunga tetap per bulan
    const interestPortion  = Number(loan.loan_applications?.loan_products?.interest_method) === 1
      ? (outstanding * interestRate) / 100
      : monthlyInstallment - (outstanding / loan.tenor_months)

    const principalPortion = amountPaid - interestPortion - penaltyAmount

    // Generate nomor pembayaran unik
    const count     = await prisma.loan_payments.count()
    const paymentNo = `PAY-${Date.now()}-${String(count + 1).padStart(4, "0")}`

    // Buat record payment + update outstanding dalam transaksi
    const [payment] = await prisma.$transaction([
      // Catat pembayaran
      prisma.loan_payments.create({
        data: {
          loan_id:           BigInt(loanId),
          schedule_id:       scheduleId ? BigInt(scheduleId) : null,
          payment_no:        paymentNo,
          amount_paid:       amountPaid,
          principal_portion: Math.max(0, principalPortion),
          interest_portion:  Math.max(0, interestPortion),
          penalty_amount:    penaltyAmount,
          payment_method:    paymentMethod as any,
          reference:         reference ?? null,
          processed_by:      BigInt(session.user.id),
          paid_at:           new Date(),
          note:              note ?? null,
        },
      }),

      // Update outstanding pinjaman
      prisma.loans.update({
        where: { id: BigInt(loanId) },
        data: {
          outstanding_principal: { decrement: Math.max(0, principalPortion) },
          total_paid:            { increment: amountPaid },
        },
      }),

      // Update status jadwal jika scheduleId ada
      ...(scheduleId
        ? [prisma.loan_schedules.update({
            where: { id: BigInt(scheduleId) },
            data: { status: "paid", paid_at: new Date() },
          })]
        : []),
    ])

    // Cek apakah pinjaman lunas setelah pembayaran ini
    const updatedLoan = await prisma.loans.findUnique({
      where: { id: BigInt(loanId) },
      select: { outstanding_principal: true },
    })
    if (updatedLoan && Number(updatedLoan.outstanding_principal) <= 0) {
      await prisma.loans.update({
        where: { id: BigInt(loanId) },
        data: { status: "closed" as any },
      })
    }

    await logAudit({
      action: "CREATE",
      modelType: "loan_payments",
      modelId: Number(payment.id),
      newValues: {
        payment_no:        paymentNo,
        loan_id:           loanId,
        loan_no:           loan.loan_no,
        member_name:       loan.members?.full_name ?? null,
        member_nik:        loan.members?.nik ?? null,
        amount_paid:       amountPaid,
        principal_portion: Math.max(0, principalPortion),
        interest_portion:  Math.max(0, interestPortion),
        penalty_amount:    penaltyAmount,
        payment_method:    paymentMethod,
        reference:         reference ?? null,
      },
    })

    revalidatePath("/pinjaman")
    revalidatePath("/dashboard")
    return { success: true, data: payment }
  } catch (error: any) {
    console.error("[recordLoanPayment] Error:", error)
    if (error?.code === "P2002") {
      return { success: false, error: "Nomor pembayaran duplikat, silakan coba lagi." }
    }
    return { success: false, error: "Gagal mencatat pembayaran cicilan." }
  }
}

/**
 * Ambil riwayat pembayaran cicilan untuk satu pinjaman.
 *
 * @param loanId - ID pinjaman
 * @returns Daftar loan_payments terurut terbaru
 */
export async function getLoanPayments(loanId: number) {
  try {
    const payments = await prisma.loan_payments.findMany({
      where: { loan_id: BigInt(loanId) },
      include: {
        users: { select: { username: true } },
        loan_schedules: { select: { installment_no: true, due_date: true } },
      },
      orderBy: { paid_at: "desc" },
    })

    return payments.map((p) => ({
      id:                Number(p.id),
      payment_no:        p.payment_no,
      amount_paid:       Number(p.amount_paid),
      principal_portion: Number(p.principal_portion),
      interest_portion:  Number(p.interest_portion),
      penalty_amount:    Number(p.penalty_amount),
      payment_method:    p.payment_method,
      reference:         p.reference,
      note:              p.note,
      paid_at:           p.paid_at.toISOString(),
      processed_by:      p.users?.username ?? null,
      installment_no:    p.loan_schedules?.installment_no ?? null,
      due_date:          p.loan_schedules?.due_date?.toISOString() ?? null,
    }))
  } catch (error) {
    console.error("[getLoanPayments] Error:", error)
    return []
  }
}
