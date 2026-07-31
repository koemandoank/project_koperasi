"use server"

import { prisma } from "@/lib/db/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { logAudit } from "@/lib/actions/log-audit"
import { checkRole } from "@/lib/auth-helpers"

interface PayrollBatchResult {
  success: boolean
  savingsCount: number
  savingsAmount: number
  loansCount: number
  loansAmount: number
  error?: string
}

const SYSTEM_NIK_PREFIXES = ["ADM", "SAD", "KAS", "PEN", "KET"]
function isSystemAccount(nik: string) {
  return SYSTEM_NIK_PREFIXES.some((p) => nik.startsWith(p))
}

/**
 * FITUR: Cron Payroll Hibrida (28 Jul 2026)
 *
 * Cron (`/api/cron/payroll`) TIDAK langsung mengeksekusi potongan gaji.
 * Cron hanya memanggil fungsi ini untuk menghitung PREVIEW (read-only, tidak
 * menulis apa pun ke savings/loan_schedules/journal) lalu menyimpannya sebagai
 * baris `payroll_batches` berstatus "draft". Pengurus HARUS approve manual
 * lewat UI (`approvePayrollBatch`) sebelum benar-benar diproses/diposting.
 * Ini supaya ada jejak akuntabilitas pengurus (tidak murni auto-posting tanpa
 * tinjauan manusia), sekaligus tetap dapat kenyamanan waktu otomatis.
 */
export async function previewPayrollBatch(periodStart: Date, periodEnd: Date) {
  const swType = await prisma.saving_types.findFirst({ where: { code: "SW" } })
  if (!swType) throw new Error("Tipe Simpanan Wajib (SW) tidak ditemukan di database.")
  const swAmount = Number(swType.monthly_amount)

  const activeMembers = await prisma.member.findMany({
    where: { status: "active" },
    include: { savings: { where: { saving_type_id: swType.id } } },
  })
  const eligibleMemberIds = activeMembers
    .filter((m: any) => !isSystemAccount(m.nik) && m.savings.length > 0)
    .map((m: any) => m.id)

  const existingTrxThisMonth = await prisma.saving_transactions.findMany({
    where: {
      member_id: { in: eligibleMemberIds },
      savings: { saving_type_id: swType.id },
      transaction_at: { gte: periodStart, lte: periodEnd },
      type: "salary_cut",
    },
    select: { member_id: true },
  })
  const alreadyPaidMemberIds = new Set(existingTrxThisMonth.map((t: any) => t.member_id.toString()))
  const eligibleCount = eligibleMemberIds.filter((id: bigint) => !alreadyPaidMemberIds.has(id.toString())).length

  const pendingSchedules = await prisma.loan_schedules.findMany({
    where: {
      due_date: { gte: periodStart, lte: periodEnd },
      status: { in: ["pending", "partial", "overdue"] },
      loans: { repayment_method: "salary_cut", status: "active" },
    },
    select: { total_due: true, principal_paid: true, interest_paid: true },
  })
  const loanTotalEstimate = pendingSchedules.reduce((sum: number, s: any) => {
    const remaining = Number(s.total_due) - Number(s.principal_paid) - Number(s.interest_paid)
    return sum + Math.max(0, remaining)
  }, 0)

  return {
    eligibleMembers: eligibleCount,
    swTotalEstimate: swAmount * eligibleCount,
    loanScheduleCount: pendingSchedules.length,
    loanTotalEstimate,
  }
}

/**
 * Dipanggil endpoint cron. Membuat draft `payroll_batches` untuk periode
 * tertentu kalau belum ada. TIDAK menyentuh savings/loan_schedules/journal.
 */
export async function generatePayrollDraft(periodStart: Date, periodEnd: Date) {
  const periodCode = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}`

  const existing = await prisma.payroll_batches.findUnique({ where: { period_code: periodCode } })
  if (existing) {
    return { created: false, reason: "Draft/batch untuk periode ini sudah ada.", batch: existing }
  }

  const preview = await previewPayrollBatch(periodStart, periodEnd)

  if (preview.eligibleMembers === 0 && preview.loanScheduleCount === 0) {
    return { created: false, reason: "Tidak ada anggota/pinjaman yang perlu dipotong periode ini." }
  }

  const batch = await prisma.payroll_batches.create({
    data: {
      period_code: periodCode,
      period_start: periodStart,
      period_end: periodEnd,
      status: "draft",
      eligible_members: preview.eligibleMembers,
      sw_total_estimate: preview.swTotalEstimate,
      loan_schedule_count: preview.loanScheduleCount,
      loan_total_estimate: preview.loanTotalEstimate,
      generated_by: "cron",
    },
  })

  revalidatePath("/laporan/potongan-gaji")
  return { created: true, batch }
}

/** Draft yang menunggu persetujuan pengurus, untuk ditampilkan di UI. */
export async function getPendingPayrollBatches() {
  return prisma.payroll_batches.findMany({
    where: { status: "draft" },
    orderBy: { period_code: "desc" },
  })
}

/** Pengurus approve draft -> baru benar-benar dieksekusi (posting nyata). */
export async function approvePayrollBatch(batchId: number) {
  const session = await checkRole(["superadmin", "ketua", "pengurus", "admin"])

  const batch = await prisma.payroll_batches.findUnique({ where: { id: BigInt(batchId) } })
  if (!batch) return { success: false, error: "Draft tidak ditemukan." }
  if (batch.status !== "draft") return { success: false, error: "Draft ini sudah diproses/ditolak sebelumnya." }

  const from = batch.period_start.toISOString().slice(0, 10)
  const to = batch.period_end.toISOString().slice(0, 10)

  const result = await processMonthlyPayrollBatch({ from, to })

  await prisma.payroll_batches.update({
    where: { id: batch.id },
    data: {
      status: result.success ? "processed" : "draft", // tetap draft kalau gagal, biar bisa dicoba lagi
      reviewed_by: BigInt(session.user.id),
      reviewed_at: new Date(),
      savings_count: result.savingsCount,
      savings_amount: result.savingsAmount,
      loans_count: result.loansCount,
      loans_amount: result.loansAmount,
    },
  })

  revalidatePath("/laporan/potongan-gaji")
  return result
}

/** Pengurus menolak draft (misal: data payroll perusahaan belum final bulan ini). */
export async function rejectPayrollBatch(batchId: number, reason: string) {
  const session = await checkRole(["superadmin", "ketua", "pengurus", "admin"])

  const batch = await prisma.payroll_batches.findUnique({ where: { id: BigInt(batchId) } })
  if (!batch) return { success: false, error: "Draft tidak ditemukan." }
  if (batch.status !== "draft") return { success: false, error: "Draft ini sudah diproses/ditolak sebelumnya." }

  await prisma.payroll_batches.update({
    where: { id: batch.id },
    data: {
      status: "rejected",
      reviewed_by: BigInt(session.user.id),
      reviewed_at: new Date(),
      reject_reason: reason,
    },
  })

  revalidatePath("/laporan/potongan-gaji")
  return { success: true }
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
    const session = await checkRole(["superadmin", "ketua", "pengurus", "admin"])
    const userId = session.user.id

    const startDate = new Date(`${from}T00:00:00+07:00`)
    const endDate = new Date(`${to}T23:59:59.999+07:00`)

    // Format label periode untuk referensi transaksi (misal: "202605" untuk Mei 2026)
    const periodCode = `${startDate.getFullYear()}${(startDate.getMonth() + 1).toString().padStart(2, "0")}`

    // 2. Ambil Saving Type Simpanan Wajib (SW) dengan proteksi kegagalan koneksi (stale pool)
    let swType = null
    try {
      swType = await prisma.saving_types.findFirst({
        where: { code: "SW" }
      })
    } catch (dbErr: any) {
      console.warn("[Payroll Batch] Mendeteksi kegagalan koneksi awal (stale pool), mencoba menghubungkan kembali...", dbErr?.message)
      try {
        await prisma.$disconnect()
        await prisma.$connect()
        swType = await prisma.saving_types.findFirst({
          where: { code: "SW" }
        })
      } catch (retryErr) {
        console.error("[Payroll Batch] Gagal menghubungkan kembali:", retryErr)
        return {
          success: false,
          savingsCount: 0,
          savingsAmount: 0,
          loansCount: 0,
          loansAmount: 0,
          error: "Koneksi database terputus. Silakan muat ulang halaman (refresh) dan coba lagi."
        }
      }
    }

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

    // PERF FIX (28 Jul 2026): sebelumnya cek "sudah dipotong bulan ini?" dilakukan
    // dengan query findFirst SATU-SATU per anggota (N query untuk N anggota).
    // Dengan 120+ anggota aktif, ini jadi lambat & berisiko exhaust connection pool
    // di luar transaksi. Diganti 1 query bulk untuk SEMUA anggota sekaligus.
    const eligibleMemberIds = activeMembers
      .filter((m: any) => {
        const isSystemAccount =
          m.nik.startsWith("ADM") || m.nik.startsWith("SAD") ||
          m.nik.startsWith("KAS") || m.nik.startsWith("PEN") || m.nik.startsWith("KET")
        return !isSystemAccount && m.savings.length > 0
      })
      .map((m: any) => m.id)

    const existingTrxThisMonth = await prisma.saving_transactions.findMany({
      where: {
        member_id: { in: eligibleMemberIds },
        savings: { saving_type_id: swType.id },
        transaction_at: { gte: startDate, lte: endDate },
        type: "salary_cut"
      },
      select: { member_id: true }
    })
    const alreadyPaidMemberIds = new Set(existingTrxThisMonth.map((t: any) => t.member_id.toString()))

    const membersNeedingSw = activeMembers.filter((m: any) => {
      const isSystemAccount =
        m.nik.startsWith("ADM") || m.nik.startsWith("SAD") ||
        m.nik.startsWith("KAS") || m.nik.startsWith("PEN") || m.nik.startsWith("KET")
      return !isSystemAccount && m.savings.length > 0 && !alreadyPaidMemberIds.has(m.id.toString())
    })

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
    const result = await prisma.$transaction(async (tx: any) => {
      let savingsCount = 0
      let savingsAmount = 0
      let loansCount = 0
      let loansAmount = 0

      // A. Proses Simpanan Wajib Massal
      const payrollDate = new Date(startDate.getFullYear(), startDate.getMonth(), 25, 10, 0, 0) // Kunci ke tanggal 25 pukul 10:00 pagi

      // PERF FIX (28 Jul 2026): sebelumnya loop per-anggota dengan 2 query masing2
      // (create + update) = 2xN query SEQUENTIAL di dalam SATU koneksi transaksi.
      // Dengan 120+ anggota & timeout transaksi cuma 30 detik, ini berisiko timeout
      // total (seluruh transaksi rollback). Diganti: 1x createMany utk semua baris
      // transaksi + 1x updateMany utk semua saldo (increment sama rata, tidak perlu
      // hitung balance_after individual utk update saldo karena pakai {increment}).
      if (membersNeedingSw.length > 0) {
        const swTxRows = membersNeedingSw.map((member: any) => {
          const savingsRecord = member.savings[0]
          const balanceBefore = Number(savingsRecord.balance)
          const balanceAfter = balanceBefore + swAmount
          return {
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
            updated_at:     payrollDate,
          }
        })

        await tx.saving_transactions.createMany({ data: swTxRows })

        const savingsIds = membersNeedingSw.map((member: any) => member.savings[0].id)
        await tx.savings.updateMany({
          where: { id: { in: savingsIds } },
          data: {
            balance:       { increment: swAmount },
            total_deposit: { increment: swAmount },
            updated_at:    new Date(),
          },
        })

        savingsCount = membersNeedingSw.length
        savingsAmount = swAmount * membersNeedingSw.length
      }

      // B. Proses Angsuran Pinjaman Massal
      let totalPrincipal = 0
      let totalInterest = 0

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
        totalPrincipal += safePrincipalPortion
        totalInterest += interestPortion
      }

      // C. Otomatisasi Posting ke Buku Besar (General Ledger)
      const totalCollected = savingsAmount + totalPrincipal + totalInterest

      if (totalCollected > 0) {
        const unit = await tx.unit.findFirst()
        const unitId = unit ? unit.id : BigInt(1)

        // Helper untuk memastikan COA exist
        const getOrCreateCoa = async (code: string, name: string, type: "asset" | "liability" | "equity" | "revenue" | "expense", normal_balance: "debit" | "credit") => {
          let account = await tx.chart_of_accounts.findFirst({
            where: { unit_id: unitId, code: code }
          })
          if (!account) {
            account = await tx.chart_of_accounts.create({
              data: {
                unit_id: unitId,
                code,
                name,
                type,
                normal_balance,
                level: 1,
                is_header: false,
                is_active: true,
                created_at: new Date(),
                updated_at: new Date()
              }
            })
          }
          return account
        }

        const coaAssetReceivable = await getOrCreateCoa("10201", "Piutang Pinjaman Anggota", "asset", "debit")
        const coaLiabilitySw = await getOrCreateCoa("20102", "Simpanan Wajib Anggota", "liability", "credit")
        
        const coaBankMandiri = await tx.chart_of_accounts.findFirst({ where: { unit_id: unitId, code: "10104" } }) 
          || await tx.chart_of_accounts.findFirst({ where: { unit_id: unitId, code: "10102" } })
          || await tx.chart_of_accounts.findFirst({ where: { unit_id: unitId, type: "asset" } })

        const coaJasaKoperasi = await tx.chart_of_accounts.findFirst({ where: { unit_id: unitId, code: "40101" } })
          || await tx.chart_of_accounts.findFirst({ where: { unit_id: unitId, type: "revenue" } })

        if (coaBankMandiri && coaJasaKoperasi) {
          const entryNo = `TX-PAYROLL-${periodCode}`

          // Bersihkan entri lama jika sudah ada (retry safety)
          const existingEntry = await tx.journal_entries.findUnique({
            where: { entry_no: entryNo }
          })
          if (existingEntry) {
            await tx.journal_lines.deleteMany({
              where: { journal_id: existingEntry.id }
            })
            await tx.journal_entries.delete({
              where: { id: existingEntry.id }
            })
          }

          // Buat entri jurnal baru
          const journalEntry = await tx.journal_entries.create({
            data: {
              unit_id: unitId,
              entry_no: entryNo,
              entry_date: payrollDate,
              description: `Otomatis: Penerimaan Potongan Gaji Massal — Periode ${periodCode}`,
              reference: `PAYROLL-${periodCode}`,
              source: "loan_payment",
              is_posted: true,
              posted_by: BigInt(userId),
              posted_at: new Date(),
              created_at: new Date(),
              updated_at: new Date()
            }
          })

          // Tambahkan baris jurnal ledger
          // DEBIT: Bank
          await tx.journal_lines.create({
            data: {
              journal_id: journalEntry.id,
              account_id: coaBankMandiri.id,
              debit: totalCollected,
              credit: 0,
              description: `Penerimaan Kas Potongan Gaji Massal — Periode ${periodCode}`,
              created_at: new Date(),
              updated_at: new Date()
            }
          })

          // KREDIT: Simpanan Wajib (jika ada)
          if (savingsAmount > 0) {
            await tx.journal_lines.create({
              data: {
                journal_id: journalEntry.id,
                account_id: coaLiabilitySw.id,
                debit: 0,
                credit: savingsAmount,
                description: `Setoran Simpanan Wajib Massal Anggota — Periode ${periodCode}`,
                created_at: new Date(),
                updated_at: new Date()
              }
            })
          }

          // KREDIT: Piutang Pinjaman Anggota (jika ada)
          if (totalPrincipal > 0) {
            await tx.journal_lines.create({
              data: {
                journal_id: journalEntry.id,
                account_id: coaAssetReceivable.id,
                debit: 0,
                credit: totalPrincipal,
                description: `Pelunasan Pokok Pinjaman Anggota Massal — Periode ${periodCode}`,
                created_at: new Date(),
                updated_at: new Date()
              }
            })
          }

          // KREDIT: Pendapatan Bunga Jasa Koperasi (jika ada)
          if (totalInterest > 0) {
            await tx.journal_lines.create({
              data: {
                journal_id: journalEntry.id,
                account_id: coaJasaKoperasi.id,
                debit: 0,
                credit: totalInterest,
                description: `Pendapatan Jasa Koperasi (Bunga) Massal — Periode ${periodCode}`,
                created_at: new Date(),
                updated_at: new Date()
              }
            })
          }
        }
      }

      return {
        success: true,
        savingsCount,
        savingsAmount,
        loansCount,
        loansAmount
      }
    }, {
      maxWait: 15000,
      timeout: 30000
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
