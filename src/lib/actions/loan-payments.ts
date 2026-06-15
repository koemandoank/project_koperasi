"use server"

import { prisma } from "@/lib/db/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { logAudit } from "@/lib/actions/log-audit"
import { checkRole } from "@/lib/auth-helpers"

/**
 * Catat pembayaran cicilan pinjaman secara manual.
 * Dipanggil oleh kasir/pengurus saat anggota membayar cicilan tunai/transfer.
 *
 * @param {Object} params - Objek parameter transaksi pembayaran
 * @param {number} params.loanId - ID pinjaman aktif
 * @param {number} [params.scheduleId] - ID jadwal cicilan yang dibayar
 * @param {number} params.amountPaid - Total uang yang dibayar
 * @param {"cash" | "salary_cut" | "saving_deduct" | "transfer"} params.paymentMethod - Metode pembayaran
 * @param {string} [params.reference] - Nomor referensi / bukti transfer (opsional)
 * @param {number} [params.penaltyAmount] - Denda keterlambatan (default 0)
 * @param {string} [params.note] - Catatan tambahan (opsional)
 * @returns {Promise<{ success: boolean, data?: any, error?: string }>} Status sukses beserta data transaksi atau pesan error
 * @throws {Error} Mengembalikan error jika terjadi kesalahan transaksi database
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

    checkRole(session, ["superadmin", "admin", "pengurus", "kasir"])

    // Validasi pinjaman aktif
    const loan = await prisma.loans.findUnique({
      where: { id: BigInt(loanId) },
      include: {
        members: { select: { full_name: true, nik: true, member_code: true } },
        loan_applications: { include: { loan_products: true } },
      },
    })

    if (!loan) return { success: false, error: "Pinjaman tidak ditemukan" }

    /** Status yang diperbolehkan menerima pembayaran cicilan */
    const PAYABLE_LOAN_STATUSES = ["active", "overdue"] as const
    if (!(PAYABLE_LOAN_STATUSES as readonly string[]).includes(loan.status)) {
      return { success: false, error: `Pinjaman berstatus '${loan.status}' tidak dapat menerima pembayaran.` }
    }

    // Hitung porsi pokok & bunga dari pembayaran
    const monthlyInstallment = Number(loan.monthly_installment)
    const interestRate       = Number(loan.interest_rate)
    const outstanding        = Number(loan.outstanding_principal)

    let interestPortion = 0
    let principalPortion = 0

    if (scheduleId) {
      const schedule = await prisma.loan_schedules.findUnique({
        where: { id: BigInt(scheduleId) },
      })
      if (schedule) {
        interestPortion = Number(schedule.interest_due)
        principalPortion = amountPaid - interestPortion - penaltyAmount
      }
    }

    if (!scheduleId || interestPortion === 0) {
      // Flat interest: bunga tetap per bulan berdasarkan plafon awal (loan.principal)
      interestPortion = Number(loan.loan_applications?.loan_products?.interest_method) === 1
        ? (Number(loan.principal) * interestRate) / 100
        : monthlyInstallment - (Number(loan.principal) / loan.tenor_months)
      
      principalPortion = amountPaid - interestPortion - penaltyAmount
    }

    // Pastikan principalPortion tidak melebihi sisa outstanding agar tidak melanggar check constraint chk_loans_outstanding
    const safePrincipalPortion = Math.min(outstanding, Math.max(0, principalPortion))

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
          principal_portion: safePrincipalPortion,
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
          outstanding_principal: { decrement: safePrincipalPortion },
          total_paid:            { increment: amountPaid },
        },
      }),

      // Update status jadwal jika scheduleId ada
      ...(scheduleId
        ? [prisma.loan_schedules.update({
            where: { id: BigInt(scheduleId) },
            data: {
              status: "paid",
              paid_at: new Date(),
              principal_paid: safePrincipalPortion,
              interest_paid: Math.max(0, interestPortion),
              penalty_paid: penaltyAmount,
            },
          })]
        : []),
    ])

    // Cek status pinjaman setelah pembayaran
    const updatedLoan = await prisma.loans.findUnique({
      where: { id: BigInt(loanId) },
      select: { outstanding_principal: true, status: true },
    })

    if (updatedLoan) {
      const remaining = Number(updatedLoan.outstanding_principal)
      if (remaining <= 0) {
        // Pinjaman lunas
        await prisma.loans.update({
          where: { id: BigInt(loanId) },
          data: { status: "paid_off" },
        })
      } else if (updatedLoan.status === "overdue") {
        // Bayar cicilan overdue → kembali aktif, belum lunas
        await prisma.loans.update({
          where: { id: BigInt(loanId) },
          data: { status: "active" },
        })
      }
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
        principal_portion: safePrincipalPortion,
        interest_portion:  Math.max(0, interestPortion),
        penalty_amount:    penaltyAmount,
        payment_method:    paymentMethod,
        reference:         reference ?? null,
      },
    })

    revalidatePath("/pinjaman")
    revalidatePath("/dashboard")

    // Serialize Decimal/BigInt fields agar aman dikirim ke Client Component
    return {
      success: true,
      data: {
        id:                Number(payment.id),
        payment_no:        payment.payment_no,
        amount_paid:       Number(payment.amount_paid),
        principal_portion: Number(payment.principal_portion),
        interest_portion:  Number(payment.interest_portion),
        penalty_amount:    Number(payment.penalty_amount),
        payment_method:    payment.payment_method,
        reference:         payment.reference ?? null,
        note:              payment.note ?? null,
        paid_at:           payment.paid_at.toISOString(),
      },
    }
  } catch (error: any) {
    console.error("[recordLoanPayment] Error:", error)
    if (error?.code === "P2002") {
      return { success: false, error: "Nomor pembayaran duplikat, silakan coba lagi." }
    }
    return { success: false, error: `Gagal mencatat pembayaran cicilan: ${error?.message || error}` }
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
    const session = await auth()
    if (!session?.user?.id) return []

    // Fetch the loan first to check ownership
    const loan = await prisma.loans.findUnique({
      where: { id: BigInt(loanId) },
      select: { member_id: true }
    })
    if (!loan) return []

    // If role is anggota, verify that the loan belongs to this member
    if (session.user.role === "anggota") {
      const user = await prisma.user.findUnique({
        where: { id: BigInt(session.user.id) },
        select: { member_id: true }
      })
      if (!user?.member_id || user.member_id !== loan.member_id) {
        return [] // BOLA protection: user cannot access other members' loan payment records
      }
    }

    const payments = await prisma.loan_payments.findMany({
      where: { loan_id: BigInt(loanId) },
      include: {
        users: { select: { username: true } },
        loan_schedules: { select: { installment_no: true, due_date: true } },
      },
      orderBy: { paid_at: "desc" },
    })

    return payments.map((p: any) => ({
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
