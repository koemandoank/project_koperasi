"use server"

import { prisma } from "@/lib/db/prisma"
import { auth } from "@/auth"

/** Simpanan summary untuk anggota yang login */
export async function getMySimpanan() {
  try {
    const session = await auth()
    if (!session?.user?.id) return null

    const user = await prisma.user.findUnique({
      where: { id: BigInt(session.user.id) },
      include: {
        members: {
          include: {
            savings: {
              include: { saving_types: true, saving_transactions: { orderBy: { transaction_at: "desc" }, take: 1 } }
            }
          }
        }
      }
    })

    if (!user?.members) return null
    const member = user.members

    const transactions = await prisma.saving_transactions.findMany({
      where: { member_id: member.id },
      orderBy: { transaction_at: "desc" },
      take: 20,
      include: { savings: { include: { saving_types: true } } }
    })

    return {
      member_name: member.full_name,
      member_code: member.member_code,
      savings: member.savings.map(s => ({
        id: Number(s.id),
        type_code: s.saving_types?.code || "-",
        type_name: s.saving_types?.name || "-",
        balance: Number(s.balance),
        total_deposit: Number(s.total_deposit),
        total_withdraw: Number(s.total_withdraw),
        last_transaction: s.saving_transactions[0]?.transaction_at?.toISOString() || null,
      })),
      totalBalance: member.savings.reduce((sum, s) => sum + Number(s.balance), 0),
      transactions: transactions.map(t => ({
        id: Number(t.id),
        type: t.type,
        amount: Number(t.amount),
        balance_after: Number(t.balance_after),
        note: t.note || "",
        reference_no: t.reference_no,
        transaction_at: t.transaction_at.toISOString(),
        saving_name: t.savings?.saving_types?.name || "-",
      }))
    }
  } catch (error) {
    console.error("getMySimpanan error:", error)
    return null
  }
}

/** Pinjaman aktif untuk anggota yang login */
export async function getMyPinjaman() {
  try {
    const session = await auth()
    if (!session?.user?.id) return null

    const user = await prisma.user.findUnique({
      where: { id: BigInt(session.user.id) },
      include: {
        members: {
          include: {
            loans: {
              include: { 
                loan_schedules: { orderBy: { due_date: "asc" } },
                loan_applications: { include: { loan_products: true } }
              },
              orderBy: { created_at: "desc" }
            },
            loan_applications: {
              include: { loan_products: true },
              orderBy: { created_at: "desc" },
              take: 5
            }
          }
        }
      }
    })

    if (!user?.members) return null
    const member = user.members

    const paylaterOrders = await prisma.orders.findMany({
      where: {
        member_id: member.id,
        payment_method: "paylater",
        payment_status: "unpaid"
      },
      orderBy: { ordered_at: "desc" }
    })

    return {
      member_name: member.full_name,
      member_id: Number(member.id),
      paylater_debts: paylaterOrders.map(o => ({
        id: Number(o.id),
        order_no: o.order_no,
        amount: Number(o.grand_total),
        ordered_at: o.ordered_at.toISOString().split("T")[0]
      })),
      loans: member.loans.map(l => ({
        id: Number(l.id),
        loan_no: l.loan_no,
        principal: Number(l.principal),
        outstanding: Number(l.outstanding_principal),
        monthly_installment: Number(l.monthly_installment),
        tenor_months: l.tenor_months,
        disbursed_at: l.disbursed_at.toISOString().split("T")[0],
        last_due_date: l.last_due_date.toISOString().split("T")[0],
        status: l.status,
        repayment_method: l.repayment_method,
        product: l.loan_applications?.loan_products ? {
          name: l.loan_applications.loan_products.name,
          code: l.loan_applications.loan_products.code,
          interest_rate: Number(l.loan_applications.loan_products.interest_rate),
          max_tenor: l.loan_applications.loan_products.max_tenor,
        } : null,
        next_due: l.loan_schedules.find(s => s.status === "pending")?.due_date?.toISOString().split("T")[0] || null,
        loan_schedules: l.loan_schedules.map(s => ({
          id: Number(s.id),
          installment_no: s.installment_no,
          due_date: s.due_date,
          principal_due: Number(s.principal_due),
          interest_due: Number(s.interest_due),
          total_due: Number(s.total_due),
          principal_paid: Number(s.principal_paid),
          interest_paid: Number(s.interest_paid),
          status: s.status,
        })),
      })),
      applications: member.loan_applications.map(a => ({
        id: Number(a.id),
        application_no: a.application_no,
        product_name: a.loan_products.name,
        amount_requested: Number(a.amount_requested),
        tenor_months: a.tenor_months,
        status: a.status,
        submitted_at: a.submitted_at?.toISOString() || null,
      }))
    }
  } catch (error) {
    console.error("getMyPinjaman error:", error)
    return null
  }
}

/** Riwayat belanja anggota di toko */
export async function getMyOrders() {
  try {
    const session = await auth()
    if (!session?.user?.id) return []

    const user = await prisma.user.findUnique({
      where: { id: BigInt(session.user.id) },
      include: { members: true }
    })
    if (!user?.members) return []

    const orders = await prisma.orders.findMany({
      where: { member_id: user.members.id },
      include: { order_items: true },
      orderBy: { ordered_at: "desc" },
      take: 30
    })

    return orders.map(o => ({
      id: Number(o.id),
      order_no: o.order_no,
      grand_total: Number(o.grand_total),
      payment_method: o.payment_method,
      payment_status: o.payment_status,
      order_status: o.order_status,
      channel: o.channel,
      note: o.note || "",
      delivery_address: o.delivery_address || "",
      ordered_at: o.ordered_at.toISOString(),
      item_count: o.order_items.length,
    }))
  } catch (error) {
    console.error("getMyOrders error:", error)
    return []
  }
}

/** Notifikasi untuk admin/pengurus: pinjaman menunggu */
export async function getNotifications(role: string) {
  try {
    const results: { type: string; message: string; count: number; href: string }[] = []

    const showLoanNotif = ["superadmin", "admin", "pengurus"].includes(role)
    const showOrderNotif = ["superadmin", "admin", "pengurus", "kasir"].includes(role)

    if (showLoanNotif) {
      const pendingLoans = await prisma.loan_applications.count({ where: { status: "pending" } })
      if (pendingLoans > 0) {
        results.push({
          type: "loan",
          message: `${pendingLoans} pengajuan pinjaman menunggu review`,
          count: pendingLoans,
          href: "/pinjaman/approval"
        })
      }
    }

    if (showOrderNotif) {
      const unpaidOrders = await prisma.orders.count({
        where: { order_status: "pending", channel: "online" }
      })
      if (unpaidOrders > 0) {
        results.push({
          type: "order",
          message: `${unpaidOrders} pesanan online menunggu proses`,
          count: unpaidOrders,
          href: "/toko/pesanan"
        })
      }
    }

    return results
  } catch (error) {
    console.error("getNotifications error:", error)
    return []
  }
}

/** Loyalty Points untuk Anggota */
export async function getMyLoyalty() {
  try {
    const session = await auth()
    if (!session?.user?.id) return null

    const user = await prisma.user.findUnique({
      where: { id: BigInt(session.user.id) },
      include: { members: true }
    })
    
    if (!user?.members) return null

    const memberships = await prisma.loyalty_memberships.findMany({
      where: { member_id: user.members.id },
      include: { loyalty_programs: true }
    })

    return memberships.map(m => ({
      id: Number(m.id),
      program_name: m.loyalty_programs.program_name,
      level: m.membership_level,
      points_available: Number(m.points_available),
      total_points: Number(m.total_points),
      points_used: Number(m.points_used)
    }))
  } catch (error) {
    console.error("getMyLoyalty error:", error)
    return null
  }
}
