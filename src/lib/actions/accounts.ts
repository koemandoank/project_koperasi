'use server'

import { prisma } from '@/lib/db/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/actions/log-audit'

// ============================================
// ACCOUNTS PAYABLE (HUTANG DAGANG)
// ============================================

export async function createAccountsPayable(
  supplierId: bigint,
  invoiceNo: string,
  invoiceDate: Date,
  dueDate: Date,
  items: Array<{
    description: string
    qty: number
    unitPrice: number
    productId?: bigint
  }>,
  notes?: string
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    // Calculate subtotal from items
    const subtotal = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0)
    const apItems = items.map(i => ({
      description: i.description,
      qty: i.qty,
      unit_price: i.unitPrice,
      product_id: i.productId,
      line_total: i.qty * i.unitPrice,
    }))
    const taxAmount = subtotal * 0.1 // 10% PPN
    const totalAmount = subtotal + taxAmount

    const ap = await prisma.accounts_payable.create({
      data: {
        supplier_id: supplierId,
        invoice_no: invoiceNo,
        invoice_date: invoiceDate,
        due_date: dueDate,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        amount_due: totalAmount,
        status: 'open',
        notes,
        ap_details: {
          createMany: {
            data: apItems,
          },
        },
      },
      include: {
        ap_details: true,
        suppliers: true,
      },
    })

    await logAudit({
      action: 'CREATE',
      modelType: 'accounts_payable',
      modelId: Number(ap.id),
      newValues: { invoice_no: invoiceNo, supplier: (ap as any).suppliers?.name, total_amount: totalAmount, due_date: dueDate.toISOString().slice(0,10) },
    })
    revalidatePath('/dashboard/keuangan/hutang-dagang')
    return { success: true, data: ap }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create AP',
    }
  }
}

export async function getAccountsPayable(
  supplierId?: bigint,
  status?: 'open' | 'partial' | 'paid' | 'overdue' | 'cancelled'
) {
  try {
    const aps = await prisma.accounts_payable.findMany({
      where: {
        ...(supplierId && { supplier_id: supplierId }),
        ...(status && { status }),
      },
      include: {
        ap_details: true,
        suppliers: true,
      },
      orderBy: { due_date: 'asc' },
    })

    return { success: true, data: aps }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch AP',
    }
  }
}

export async function recordAPPayment(
  apId: bigint,
  amountPaid: number,
  paymentDate: Date,
  notes?: string
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    const ap = await prisma.accounts_payable.findUnique({
      where: { id: apId },
    })

    if (!ap) throw new Error('AP not found')

    const newAmountPaid = Number(ap.amount_paid) + amountPaid
    const amountDue = Number(ap.total_amount) - newAmountPaid
    const newStatus =
      amountDue <= 0
        ? 'paid'
        : amountPaid > 0
          ? 'partial'
          : 'open'

    const updated = await prisma.accounts_payable.update({
      where: { id: apId },
      data: {
        amount_paid: newAmountPaid,
        amount_due: Math.max(0, amountDue),
        status: newStatus,
        notes: notes ? (ap.notes ? `${ap.notes}\n- ${notes}` : notes) : ap.notes,
        updated_at: new Date(),
      },
      include: {
        ap_details: true,
      },
    })

    await logAudit({
      action: 'UPDATE',
      modelType: 'accounts_payable',
      modelId: Number(apId),
      oldValues: { amount_paid: Number(ap.amount_paid), status: ap.status },
      newValues: { amount_paid: newAmountPaid, amount_due: Math.max(0, amountDue), status: newStatus, payment_date: paymentDate.toISOString().slice(0,10) },
    })
    revalidatePath('/dashboard/keuangan/hutang-dagang')
    return { 
      success: true, 
      data: {
        id: Number(updated.id),
        status: updated.status,
        amount_paid: Number(updated.amount_paid),
        amount_due: Number(updated.amount_due)
      } 
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to record payment',
    }
  }
}

// ============================================
// ACCOUNTS RECEIVABLE (PIUTANG DAGANG)
// ============================================

export async function createAccountsReceivable(
  memberId: bigint | null,
  customerName: string,
  invoiceNo: string,
  invoiceDate: Date,
  dueDate: Date,
  items: Array<{
    description: string
    qty: number
    unitPrice: number
    productId?: bigint
  }>,
  creditLimit?: number,
  notes?: string
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0)
    const taxAmount = subtotal * 0.1 // 10% PPN
    const totalAmount = subtotal + taxAmount

    const ar = await prisma.accounts_receivable.create({
      data: {
        member_id: memberId,
        customer_name: customerName,
        invoice_no: invoiceNo,
        invoice_date: invoiceDate,
        due_date: dueDate,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        amount_due: totalAmount,
        credit_limit: creditLimit,
        status: 'open',
        notes,
        ar_details: {
          createMany: {
            data: items.map(i => ({
              description: i.description,
              qty: i.qty,
              unit_price: i.unitPrice,
              product_id: i.productId,
              line_total: i.qty * i.unitPrice,
            })),
          },
        },
      },
      include: {
        ar_details: true,
        members: true,
      },
    })

    await logAudit({
      action: 'CREATE',
      modelType: 'accounts_receivable',
      modelId: Number(ar.id),
      newValues: { invoice_no: invoiceNo, customer_name: customerName, total_amount: totalAmount, due_date: dueDate.toISOString().slice(0,10) },
    })
    revalidatePath('/dashboard/keuangan/piutang-dagang')
    return { success: true, data: ar }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create AR',
    }
  }
}

export async function getAccountsReceivable(
  memberId?: bigint,
  status?: 'open' | 'partial' | 'paid' | 'overdue' | 'cancelled'
) {
  try {
    const ars = await prisma.accounts_receivable.findMany({
      where: {
        ...(memberId && { member_id: memberId }),
        ...(status && { status }),
      },
      include: {
        ar_details: true,
        members: true,
      },
      orderBy: { due_date: 'asc' },
    })

    return { success: true, data: ars }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch AR',
    }
  }
}

export async function recordARPayment(
  arId: bigint,
  amountPaid: number,
  paymentDate: Date,
  notes?: string
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    const ar = await prisma.accounts_receivable.findUnique({
      where: { id: arId },
    })

    if (!ar) throw new Error('AR not found')

    const newAmountPaid = Number(ar.amount_paid) + amountPaid
    const amountDue = Number(ar.total_amount) - newAmountPaid
    const newStatus =
      amountDue <= 0
        ? 'paid'
        : amountPaid > 0
          ? 'partial'
          : 'open'

    const updated = await prisma.accounts_receivable.update({
      where: { id: arId },
      data: {
        amount_paid: newAmountPaid,
        amount_due: Math.max(0, amountDue),
        status: newStatus,
        notes: notes ? (ar.notes ? `${ar.notes}\n- ${notes}` : notes) : ar.notes,
        updated_at: new Date(),
      },
      include: {
        ar_details: true,
      },
    })

    await logAudit({
      action: 'UPDATE',
      modelType: 'accounts_receivable',
      modelId: Number(arId),
      oldValues: { amount_paid: Number(ar.amount_paid), status: ar.status },
      newValues: { amount_paid: newAmountPaid, amount_due: Math.max(0, amountDue), status: newStatus, payment_date: paymentDate.toISOString().slice(0,10) },
    })
    revalidatePath('/dashboard/keuangan/piutang-dagang')
    return { 
      success: true, 
      data: {
        id: Number(updated.id),
        status: updated.status,
        amount_paid: Number(updated.amount_paid),
        amount_due: Number(updated.amount_due)
      } 
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to record payment',
    }
  }
}

// ============================================
// AGING SCHEDULE (OVERDUE ANALYSIS)
// ============================================

export async function getAPAgingSchedule(asOfDate: Date = new Date()) {
  try {
    const aps = await prisma.accounts_payable.findMany({
      where: {
        status: { in: ['open', 'partial', 'overdue'] },
      },
      include: {
        suppliers: true,
      },
    })

    // Categorize by days overdue
    const aging = {
      current: [] as any[],
      days_1_30: [] as any[],
      days_31_60: [] as any[],
      days_61_90: [] as any[],
      days_90_plus: [] as any[],
    }

    aps.forEach((ap) => {
      const daysOverdue = Math.floor(
        (asOfDate.getTime() - ap.due_date.getTime()) / (1000 * 60 * 60 * 24)
      )

      if (daysOverdue <= 0) aging.current.push(ap)
      else if (daysOverdue <= 30) aging.days_1_30.push(ap)
      else if (daysOverdue <= 60) aging.days_31_60.push(ap)
      else if (daysOverdue <= 90) aging.days_61_90.push(ap)
      else aging.days_90_plus.push(ap)
    })

    return { success: true, data: aging }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch aging',
    }
  }
}

export async function getARAgingSchedule(asOfDate: Date = new Date()) {
  try {
    const ars = await prisma.accounts_receivable.findMany({
      where: {
        status: { in: ['open', 'partial', 'overdue'] },
      },
      include: {
        members: true,
      },
    })

    // Categorize by days overdue
    const aging = {
      current: [] as any[],
      days_1_30: [] as any[],
      days_31_60: [] as any[],
      days_61_90: [] as any[],
      days_90_plus: [] as any[],
    }

    ars.forEach((ar) => {
      const daysOverdue = Math.floor(
        (asOfDate.getTime() - ar.due_date.getTime()) / (1000 * 60 * 60 * 24)
      )

      if (daysOverdue <= 0) aging.current.push(ar)
      else if (daysOverdue <= 30) aging.days_1_30.push(ar)
      else if (daysOverdue <= 60) aging.days_31_60.push(ar)
      else if (daysOverdue <= 90) aging.days_61_90.push(ar)
      else aging.days_90_plus.push(ar)
    })

    return { success: true, data: aging }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch aging',
    }
  }
}

// ============================================
// TAX CALCULATIONS
// ============================================

export async function recordTaxCalculation(
  orderId: bigint | null,
  invoiceId: string | null,
  taxType: 'ppn' | 'pph' | 'other',
  taxPercentage: number,
  taxableAmount: number
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    const taxAmount = (taxableAmount * taxPercentage) / 100

    const tax = await prisma.tax_calculations.create({
      data: {
        order_id: orderId,
        invoice_id: invoiceId,
        tax_type: taxType,
        tax_percentage: taxPercentage,
        taxable_amount: taxableAmount,
        tax_amount: taxAmount,
      },
    })

    revalidatePath('/dashboard/keuangan')
    return { success: true, data: tax }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to record tax',
    }
  }
}
