'use server'

import { prisma } from '@/lib/db/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/actions/log-audit'
import type {
  cash_register_sessions,
  orders,
  order_payments,
  order_returns,
} from '@prisma/client'

// ============================================
// CASH REGISTER SESSION MANAGEMENT
// ============================================

export async function createCashRegisterSession(
  registerId: bigint,
  openingBalance: number,
  notes?: string
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    // Gunakan hanya tanggal (tanpa waktu) agar sesuai tipe @db.Date
    const now = new Date()
    const session_date = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const cashSession = await prisma.cash_register_sessions.create({
      data: {
        cash_register_id: registerId,
        session_date,
        opened_by: BigInt(session.user.id),
        opening_balance: openingBalance,
        status: 'open',
        notes,
        opened_at: now,
      },
      include: { cash_registers: true },
    })

    revalidatePath('/toko/kasir')
    revalidatePath('/toko/kasir/sesi')

    await logAudit({
      action: 'CREATE',
      modelType: 'cash_register_sessions',
      modelId: Number(cashSession.id),
      newValues: {
        event: 'BUKA_KASIR',
        opening_balance: openingBalance,
        session_date: session_date.toISOString().slice(0, 10),
        register: cashSession.cash_registers?.register_name ?? null,
        register_no: cashSession.cash_registers?.register_no ?? null,
      },
    })

    return { success: true, data: cashSession }
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return { success: false, error: 'Sesi untuk kasir ini sudah ada hari ini. Tutup sesi sebelumnya terlebih dahulu.' }
    }
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create session' }
  }
}

export async function closeCashRegisterSession(
  sessionId: bigint,
  closingBalance: number
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    // Get session to calculate expected balance
    const cashSession = await prisma.cash_register_sessions.findUnique({
      where: { id: sessionId },
      include: {
        cash_registers: true,
      },
    })

    if (!cashSession) throw new Error('Session not found')

    // Calculate total cash transactions for the session date
    const startOfDay = new Date(cashSession.session_date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(cashSession.session_date)
    endOfDay.setHours(23, 59, 59, 999)

    const transactions = await prisma.orders.aggregate({
      where: {
        unit_id: cashSession.cash_registers.unit_id,
        ordered_at: { gte: startOfDay, lte: endOfDay },
        payment_method: { in: ['cash', 'qris'] as any },
        payment_status: 'paid',
      },
      _sum: {
        grand_total: true,
      },
    })

    const expectedBalance =
      Number(cashSession.opening_balance) + Number(transactions._sum?.grand_total ?? 0)
    const difference = closingBalance - expectedBalance

    const updated = await prisma.cash_register_sessions.update({
      where: { id: sessionId },
      data: {
        closed_by: BigInt(session.user.id),
        closing_balance: closingBalance,
        expected_balance: expectedBalance,
        difference,
        status: 'closed',
        closed_at: new Date(),
      },
    })

    revalidatePath('/toko/kasir')
    revalidatePath('/toko/kasir/sesi')

    await logAudit({
      action: 'UPDATE',
      modelType: 'cash_register_sessions',
      modelId: Number(sessionId),
      oldValues: { status: 'open', opening_balance: Number(cashSession.opening_balance) },
      newValues: {
        event: 'TUTUP_KASIR',
        closing_balance: closingBalance,
        expected_balance: expectedBalance,
        difference,
        status: 'closed',
        register: cashSession.cash_registers?.register_name ?? null,
        register_no: cashSession.cash_registers?.register_no ?? null,
      },
    })

    return { success: true, data: updated }
  } catch (error: any) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to close session' }
  }
}

export async function getCashRegisterSessions(
  registerId: bigint,
  limit: number = 20
) {
  try {
    const sessions = await prisma.cash_register_sessions.findMany({
      where: { cash_register_id: registerId },
      orderBy: { session_date: 'desc' },
      take: limit,
      include: { cash_registers: true },
    })

    // Resolve usernames
    const userIds = [...new Set([
      ...sessions.map((s: any) => s.opened_by),
      ...sessions.filter((s: any) => s.closed_by).map((s: any) => s.closed_by!),
    ])]
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true },
    })
    const userMap = new Map(users.map((u: any) => [u.id.toString(), u.username]))

    return {
      success: true,
      data: sessions.map((s: any) => ({
        ...s,
        id:              Number(s.id),
        opening_balance: Number(s.opening_balance),
        closing_balance: s.closing_balance ? Number(s.closing_balance) : null,
        expected_balance: s.expected_balance ? Number(s.expected_balance) : null,
        difference:      s.difference ? Number(s.difference) : null,
        opened_by_name:  userMap.get(s.opened_by.toString()) ?? '-',
        closed_by_name:  s.closed_by ? (userMap.get(s.closed_by.toString()) ?? '-') : null,
        register_name:   s.cash_registers.register_name,
      })),
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch sessions' }
  }
}

/**
 * Ambil status sesi kasir hari ini untuk semua cash_registers yang aktif.
 * Digunakan oleh halaman sesi kasir sebagai entry gate.
 */
export async function getCashRegisterStatus() {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    const registers = await prisma.cash_registers.findMany({
      where: { is_active: true },
      include: {
        cash_register_sessions: {
          where: { status: 'open' },
          orderBy: { opened_at: 'desc' },
          take: 1,
        },
      },
      orderBy: { register_no: 'asc' },
    })

    // Resolve opener usernames
    const openerIds = registers
      .flatMap((r: any) => r.cash_register_sessions)
      .map((s: any) => s.opened_by)
    const openers = openerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: openerIds } },
          select: { id: true, username: true },
        })
      : []
    const openerMap = new Map(openers.map((u: any) => [u.id.toString(), u.username]))

    const result = registers.map((r: any) => {
      const activeSession = r.cash_register_sessions[0] ?? null
      return {
        id:             Number(r.id),
        register_no:    r.register_no,
        register_name:  r.register_name,
        location:       r.location ?? '-',
        is_active:      r.is_active,
        active_session: activeSession
          ? {
              id:              Number(activeSession.id),
              opened_at:       activeSession.opened_at.toISOString(),
              opening_balance: Number(activeSession.opening_balance),
              opened_by:       openerMap.get(activeSession.opened_by.toString()) ?? '-',
            }
          : null,
      }
    })

    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to get status' }
  }
}

/**
 * Rekap ringkasan transaksi untuk keperluan tutup kasir.
 * Menghitung total penjualan, total cash, paylater, dan jumlah transaksi.
 *
 * @param sessionId - ID sesi yang akan ditutup
 */
export async function getSessionSummary(sessionId: number) {
  try {
    const cashSession = await prisma.cash_register_sessions.findUnique({
      where: { id: BigInt(sessionId) },
      include: { cash_registers: true },
    })

    if (!cashSession) return { success: false, error: 'Sesi tidak ditemukan' }

    // Resolve opener username
    const opener = await prisma.user.findUnique({
      where: { id: cashSession.opened_by },
      select: { username: true },
    })

    const startOfDay = new Date(cashSession.session_date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(cashSession.session_date)
    endOfDay.setHours(23, 59, 59, 999)

    const unitId = cashSession.cash_registers.unit_id

    const [orders, returns] = await Promise.all([
      prisma.orders.findMany({
        where: {
          unit_id:        unitId,
          ordered_at:     { gte: startOfDay, lte: endOfDay },
          payment_status: 'paid',
        },
        select: {
          id: true, order_no: true, grand_total: true,
          payment_method: true, ordered_at: true,
        },
      }),
      prisma.order_returns.findMany({
        where: {
          created_at: { gte: startOfDay, lte: endOfDay },
          orders: { unit_id: unitId },
        },
        select: { refund_amount: true },
      }),
    ])

    const totalSales      = orders.reduce((s: any, o: any) => s + Number(o.grand_total), 0)
    const totalRefunds    = returns.reduce((s: any, r: any) => s + Number(r.refund_amount), 0)
    const totalCash       = orders.filter((o: any) => o.payment_method === 'cash').reduce((s: any, o: any) => s + Number(o.grand_total), 0)
    const totalQris       = orders.filter((o: any) => o.payment_method === 'qris').reduce((s: any, o: any) => s + Number(o.grand_total), 0)
    const totalTransfer   = orders.filter((o: any) => o.payment_method === 'transfer').reduce((s: any, o: any) => s + Number(o.grand_total), 0)
    const totalPaylater   = orders.filter((o: any) => o.payment_method === 'paylater').reduce((s: any, o: any) => s + Number(o.grand_total), 0)
    const expectedBalance = Number(cashSession.opening_balance) + totalCash + totalQris

    return {
      success: true,
      data: {
        session_id:         Number(cashSession.id),
        session_date:       cashSession.session_date.toISOString().slice(0, 10),
        opened_at:          cashSession.opened_at.toISOString(),
        opened_by:          opener?.username ?? '-',
        register_name:      cashSession.cash_registers.register_name,
        register_no:        cashSession.cash_registers.register_no,
        opening_balance:    Number(cashSession.opening_balance),
        expected_balance:   expectedBalance,
        total_transactions: orders.length,
        total_sales:        totalSales,
        total_refunds:      totalRefunds,
        net_sales:          totalSales - totalRefunds,
        breakdown: {
          cash:     totalCash,
          qris:     totalQris,
          transfer: totalTransfer,
          paylater: totalPaylater,
        },
        orders: orders.map((o: any) => ({
          id:             Number(o.id),
          order_no:       o.order_no,
          grand_total:    Number(o.grand_total),
          payment_method: o.payment_method,
          ordered_at:     o.ordered_at.toISOString(),
        })),
      },
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to get summary' }
  }
}

// ============================================
// MULTI-PAYMENT PROCESSING
// ============================================

export async function processMultiPaymentOrder(
  orderId: bigint,
  payments: Array<{
    method: 'cash' | 'debit_card' | 'credit_card' | 'qris' | 'transfer'
    amount: number
    referenceNo?: string
  }>
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    const order = await prisma.orders.findUnique({
      where: { id: orderId },
    })

    if (!order) throw new Error('Order not found')

    // Validate total payments match grand total
    const totalPayments = payments.reduce((sum: any, p: any) => sum + p.amount, 0)
    if (totalPayments !== Number(order.grand_total)) {
      throw new Error(
        `Payment total (${totalPayments}) does not match order total (${order.grand_total})`
      )
    }

    // Create payment records for each method
    const paymentRecords = await Promise.all(
      payments.map((p: any) =>
        prisma.order_payments.create({
          data: {
            order_id: orderId,
            payment_method: p.method as any,
            amount: p.amount,
            reference_no: p.referenceNo,
            payment_status: 'captured',
            paid_at: new Date(),
          },
        })
      )
    )

    // Update order status
    const updatedOrder = await prisma.orders.update({
      where: { id: orderId },
      data: {
        payment_status: 'paid',
        paid_at: new Date(),
      },
      include: {
        order_items: true,
        order_payments: true,
      },
    })

    revalidatePath('/dashboard/toko/kasir')

    await logAudit({
      action: 'CREATE',
      modelType: 'order_payments',
      modelId: Number(orderId),
      newValues: {
        order_id: Number(orderId),
        methods: payments.map((p: any) => p.method),
        total: payments.reduce((s: any, p: any) => s + p.amount, 0),
        payment_count: payments.length,
      },
    })

    return { success: true, data: { order: updatedOrder, payments: paymentRecords } }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process payment',
    }
  }
}

export async function getOrderPayments(orderId: bigint) {
  try {
    const payments = await prisma.order_payments.findMany({
      where: { order_id: orderId },
      orderBy: { created_at: 'desc' },
    })

    return { success: true, data: payments }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch payments',
    }
  }
}

// ============================================
// ORDER RETURNS & REFUNDS
// ============================================

export async function createOrderReturn(
  orderId: bigint,
  reason: string,
  refundMethod: 'cash' | 'original_payment' | 'store_credit' | 'gift_card'
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    const order = await prisma.orders.findUnique({
      where: { id: orderId },
    })

    if (!order) throw new Error('Order not found')

    // Generate return number
    const returnNo = `RET-${Date.now()}`

    const orderReturn = await prisma.order_returns.create({
      data: {
        order_id: orderId,
        return_no: returnNo,
        reason,
        refund_amount: Number(order.grand_total),
        refund_method: refundMethod,
        return_status: 'pending',
        processed_by: BigInt(session.user.id),
      },
      include: {
        orders: true,
      },
    })

    revalidatePath('/dashboard/toko/kasir')

    await logAudit({
      action: 'CREATE',
      modelType: 'order_returns',
      modelId: Number(orderReturn.id),
      newValues: {
        return_no: returnNo,
        order_no: (order as any).order_no,
        refund_amount: Number(order.grand_total),
        refund_method: refundMethod,
        reason,
      },
    })

    return { success: true, data: orderReturn }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create return',
    }
  }
}

export async function approveOrderReturn(returnId: bigint) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    const updated = await prisma.order_returns.update({
      where: { id: returnId },
      data: {
        return_status: 'approved',
        approved_at: new Date(),
      },
      include: {
        orders: true,
      },
    })

    revalidatePath('/dashboard/toko/kasir')

    await logAudit({
      action: 'APPROVE',
      modelType: 'order_returns',
      modelId: Number(returnId),
      oldValues: { return_status: 'pending' },
      newValues: { return_status: 'approved', return_no: (updated as any).return_no, refund_amount: Number((updated as any).refund_amount) },
    })

    return { success: true, data: updated }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve return',
    }
  }
}

export async function getOrderReturns(
  orderId?: bigint,
  limit: number = 20
) {
  try {
    const returns = await prisma.order_returns.findMany({
      where: orderId ? { order_id: orderId } : {},
      orderBy: { created_at: 'desc' },
      take: limit,
      include: {
        orders: true,
      },
    })

    return { success: true, data: returns }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch returns',
    }
  }
}

// ============================================
// POS TRANSACTION REPORTING
// ============================================

export async function getPOSTransactionSummary(
  sessionDate: Date,
  unitId?: bigint
) {
  try {
    const startDate = new Date(sessionDate)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(sessionDate)
    endDate.setHours(23, 59, 59, 999)

    const transactions = await prisma.orders.groupBy({
      by: ['payment_method', 'payment_status'],
      where: {
        ordered_at: {
          gte: startDate,
          lte: endDate,
        },
        ...(unitId && { unit_id: unitId }),
      },
      _sum: {
        grand_total: true,
      },
      _count: true,
    })

    const totalSales = transactions.reduce((sum: any, t: any) => sum + Number(t._sum.grand_total ?? 0),
      0
    )

    return {
      success: true,
      data: {
        transactions,
        totalSales,
        transactionCount: transactions.reduce((sum: any, t: any) => sum + t._count, 0),
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch summary',
    }
  }
}
