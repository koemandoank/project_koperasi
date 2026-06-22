"use server"

import { prisma } from "@/lib/db/prisma"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DeductionDetail {
  category: "pinjaman_uang" | "pinjaman_barang" | "pinjaman_kilat" | "paylater" | "simpanan_wajib" | "simpanan_salary_cut"
  label: string
  reference: string
  installment_no: string | number
  amount: number
}

export interface MemberDeductionRow {
  member_id: number
  nik: string
  name: string
  department: string
  total_pinjaman_uang: number
  total_pinjaman_barang: number
  total_pinjaman_kilat: number
  total_paylater: number
  total_simpanan_wajib: number
  total_simpanan_salary_cut: number
  total_deduction: number
  details: DeductionDetail[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Klasifikasi produk pinjaman berdasarkan nama/kode produk.
 * Kategori: uang | barang | kilat (default ke uang jika tidak dikenali)
 */
function classifyLoanProduct(productName: string, productCode: string): DeductionDetail["category"] {
  const name = productName.toLowerCase()
  const code = productCode.toLowerCase()

  if (name.includes("kilat") || code.includes("kilat") || code.startsWith("pkl")) {
    return "pinjaman_kilat"
  }
  if (name.includes("barang") || code.includes("barang") || code.startsWith("pbrg")) {
    return "pinjaman_barang"
  }
  return "pinjaman_uang"
}

/**
 * Bangun atau dapatkan entry map anggota.
 */
function ensureMember(
  map: Map<number, MemberDeductionRow>,
  memberId: number,
  nik: string,
  fullName: string,
  unitName: string
): MemberDeductionRow {
  if (!map.has(memberId)) {
    map.set(memberId, {
      member_id: memberId,
      nik,
      name: fullName,
      department: unitName,
      total_pinjaman_uang: 0,
      total_pinjaman_barang: 0,
      total_pinjaman_kilat: 0,
      total_paylater: 0,
      total_simpanan_wajib: 0,
      total_simpanan_salary_cut: 0,
      total_deduction: 0,
      details: [],
    })
  }
  return map.get(memberId)!
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Report Action
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ambil laporan potongan gaji per anggota untuk periode tertentu.
 * Mencakup:
 *  1. Cicilan Pinjaman Uang (salary_cut)
 *  2. Cicilan Pinjaman Barang (salary_cut)
 *  3. Cicilan Pinjaman Kilat (salary_cut)
 *  4. Pay Later (toko, belum lunas)
 *  5. Simpanan Wajib (monthly_amount dari saving_types.is_mandatory)
 *  6. Simpanan Sukarela Salary Cut (saving_transactions.type = salary_cut)
 *
 * @param from   - ISO date string tanggal awal (YYYY-MM-DD)
 * @param to     - ISO date string tanggal akhir (YYYY-MM-DD)
 * @param search - Query pencarian NIK atau nama
 */
export async function getMonthlyDeductionReport(
  from?: string,
  to?: string,
  search?: string
): Promise<MemberDeductionRow[]> {
  // Gunakan timezone Asia/Jakarta agar filter tanggal presisi
  const getWibDate = (dateStr?: string, endOfDay = false) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    // Set to WIB time (GMT+7)
    if (endOfDay) {
      date.setHours(23, 59, 59, 999);
    } else {
      date.setHours(0, 0, 0, 0);
    }
    return date;
  };

  const now = new Date();
  const startDate = getWibDate(from) ?? new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = getWibDate(to, true) ?? new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  try {
    const memberMap = new Map<number, MemberDeductionRow>()

    // ── 1–3. CICILAN PINJAMAN (salary_cut) ────────────────────────────────────
    const loanSchedules = await prisma.loan_schedules.findMany({
      where: {
        due_date: { gte: startDate, lte: endDate },
        status: { in: ["pending", "partial", "overdue"] },
        loans: { repayment_method: "salary_cut" },
      },
      include: {
        loans: {
          include: {
            loan_applications: {
              include: { loan_products: true },
            },
            members: {
              include: { units: true },
            },
          },
        },
      },
    })

    for (const schedule of loanSchedules) {
      const loan = schedule.loans
      const member = loan.members
      const product = loan.loan_applications?.loan_products

      const memberId = Number(loan.member_id)
      const amountDue =
        Number(schedule.total_due) -
        Number(schedule.principal_paid) -
        Number(schedule.interest_paid)

      if (amountDue <= 0) continue

      const row = ensureMember(
        memberMap,
        memberId,
        member.nik,
        member.full_name,
        member.units?.name ?? "-"
      )

      const category = classifyLoanProduct(
        product?.name ?? "",
        product?.code ?? ""
      )

      const categoryLabels: Record<string, string> = {
        pinjaman_uang: "Pinjaman Uang",
        pinjaman_barang: "Pinjaman Barang",
        pinjaman_kilat: "Pinjaman Kilat",
      }

      row.details.push({
        category,
        label: `${categoryLabels[category]} — Angsuran ke-${schedule.installment_no}`,
        reference: loan.loan_no,
        installment_no: schedule.installment_no,
        amount: amountDue,
      })

      if (category === "pinjaman_uang") row.total_pinjaman_uang += amountDue
      else if (category === "pinjaman_barang") row.total_pinjaman_barang += amountDue
      else if (category === "pinjaman_kilat") row.total_pinjaman_kilat += amountDue

      row.total_deduction += amountDue
    }

    // ── 4. PAY LATER ──────────────────────────────────────────────────────────
    const payLaterOrders = await prisma.orders.findMany({
      where: {
        payment_method: "paylater",
        payment_status: { in: ["unpaid", "partial"] },
        ordered_at: { lte: endDate },
      },
      include: {
        members: { include: { units: true } },
      },
    })

    for (const order of payLaterOrders) {
      if (!order.members || !order.member_id) continue

      const memberId = Number(order.member_id)
      const amount = Number(order.grand_total)

      const row = ensureMember(
        memberMap,
        memberId,
        order.members.nik,
        order.members.full_name,
        order.members.units?.name ?? "-"
      )

      row.details.push({
        category: "paylater",
        label: "Pay Later Toko",
        reference: order.order_no,
        installment_no: "-",
        amount,
      })

      row.total_paylater += amount
      row.total_deduction += amount
    }

    // ── 5. SIMPANAN WAJIB (Potongan bulanan tetap) ────────────────────────────
    // Ambil semua anggota aktif yang memiliki simpanan wajib
    const mandatorySavings = await prisma.savings.findMany({
      where: {
        saving_types: { is_mandatory: true, is_active: true },
        members: { status: "active" },
      },
      include: {
        saving_types: true,
        members: { include: { units: true } },
      },
    })

    const nowMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const historicalEndDate = endDate < nowMonthStart ? endDate : new Date(nowMonthStart.getTime() - 1)
    
    const swTransactionsMap = new Map<string, number>()
    const swTransactionsCountMap = new Map<string, number>()

    // Ambil transaksi historis MURNI dari database jika rentang waktu mencakup masa lalu
    if (startDate <= historicalEndDate) {
      const pastSwTransactions = await prisma.saving_transactions.findMany({
        where: {
          savings: { saving_types: { is_mandatory: true } },
          transaction_at: { gte: startDate, lte: historicalEndDate },
          type: { in: ['deposit', 'salary_cut'] }
        },
        include: { savings: { include: { saving_types: true } } }
      })

      for (const trx of pastSwTransactions) {
        const key = `${trx.member_id}_${trx.savings.saving_types.code}`
        swTransactionsMap.set(key, (swTransactionsMap.get(key) || 0) + Number(trx.amount))
        swTransactionsCountMap.set(key, (swTransactionsCountMap.get(key) || 0) + 1)
      }
    }

    for (const saving of mandatorySavings) {
      const typeCode = saving.saving_types.code
      const joinDate = saving.members.join_date
      const monthlyAmount = Number(saving.saving_types.monthly_amount)
      const memberId = Number(saving.member_id)
      
      let projectedMonths = 0

      // Proyeksi (hanya untuk bulan berjalan dan masa depan)
      if (typeCode === "SP") {
        if (joinDate && joinDate >= startDate && joinDate <= endDate && joinDate >= nowMonthStart) {
          projectedMonths = 1
        }
      } else {
        let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
        const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
        
        while (current <= end) {
          if (current >= nowMonthStart) {
            const currentMonthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59)
            if (!joinDate || joinDate <= currentMonthEnd) {
              projectedMonths++
            }
          }
          current.setMonth(current.getMonth() + 1)
        }
      }

      const pastKey = `${memberId}_${typeCode}`
      const pastActualAmount = swTransactionsMap.get(pastKey) || 0
      const pastCount = swTransactionsCountMap.get(pastKey) || 0

      const projectedAmount = monthlyAmount * projectedMonths
      const totalAmount = pastActualAmount + projectedAmount
      const totalMonthsCount = pastCount + projectedMonths

      if (totalAmount <= 0) continue

      const row = ensureMember(
        memberMap,
        memberId,
        saving.members.nik,
        saving.members.full_name,
        saving.members.units?.name ?? "-"
      )

      row.details.push({
        category: "simpanan_wajib",
        label: `Simpanan Wajib — ${saving.saving_types.name} (${totalMonthsCount} bln)`,
        reference: saving.saving_types.code,
        installment_no: "-",
        amount: totalAmount,
      })

      row.total_simpanan_wajib += totalAmount
      row.total_deduction += totalAmount
    }

    // ── 6. SIMPANAN SUKARELA SALARY CUT (opsi tambahan) ──────────────────────
    const salaryCutTrx = await prisma.saving_transactions.findMany({
      where: {
        type: "salary_cut",
        transaction_at: { gte: startDate, lte: endDate },
        savings: {
          saving_types: {
            is_mandatory: false
          }
        }
      },
      include: {
        members: { include: { units: true } },
        savings: { include: { saving_types: true } },
      },
    })

    for (const trx of salaryCutTrx) {
      const memberId = Number(trx.member_id)
      const amount = Number(trx.amount)

      const row = ensureMember(
        memberMap,
        memberId,
        trx.members.nik,
        trx.members.full_name,
        trx.members.units?.name ?? "-"
      )

      row.details.push({
        category: "simpanan_salary_cut",
        label: `Simpanan Salary Cut — ${trx.savings.saving_types.name}`,
        reference: trx.reference_no,
        installment_no: "-",
        amount,
      })

      row.total_simpanan_salary_cut += amount
      row.total_deduction += amount
    }

    // ── Filter & Sort ──────────────────────────────────────────────────────────
    let result = Array.from(memberMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    )

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.nik.toLowerCase().includes(q)
      )
    }

    return result
  } catch (error) {
    console.error("[getMonthlyDeductionReport] Error:", error)
    return []
  }
}
