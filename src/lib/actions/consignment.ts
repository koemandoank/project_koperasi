'use server'

import { prisma } from '@/lib/db/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/actions/log-audit'

// ============================================
// CONSIGNMENT ITEMS CLASSIFICATION
// ============================================

export async function createConsignmentItem(
  productId: number,
  supplierId: number,
  qtyReceived: number,
  unitPrice: number,
  consignmentDate: Date
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    // Create consignment_items (no unit_price in this table)
    const item = await prisma.consignment_items.create({
      data: {
        product_id: BigInt(productId),
        supplier_id: BigInt(supplierId),
        consignment_date: consignmentDate,
        qty_received: qtyReceived,
        status: 'active',
      },
      include: {
        products: true,
        suppliers: true,
      },
    })

    // Create the initial payable record with unit_price and total_amount
    await prisma.consignment_payables.create({
      data: {
        consignment_id: item.id,
        supplier_id: BigInt(supplierId),
        qty_sold: 0,
        unit_price: unitPrice,
        total_amount: 0,
        status: 'pending',
      },
    })

    // Update product stock directly
    await prisma.products.update({
      where: { id: BigInt(productId) },
      data: { stock: { increment: qtyReceived } }
    })

    await logAudit({
      action: 'CREATE',
      modelType: 'consignment_items',
      modelId: Number(item.id),
      newValues: { product: (item as any).products?.name, supplier: (item as any).suppliers?.supplier_name, qty_received: qtyReceived, unit_price: unitPrice, consignment_date: consignmentDate.toISOString().slice(0,10) },
    })
    revalidatePath('/toko/konsinyasi')
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create consignment',
    }
  }
}

export async function getConsignmentItems(
  supplierId?: bigint,
  status?: 'active' | 'returned' | 'settled' | 'closed'
) {
  try {
    const items = await prisma.consignment_items.findMany({
      where: {
        ...(supplierId && { supplier_id: supplierId }),
        ...(status && { status }),
      },
      include: {
        products: true,
        suppliers: true,
        payables: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
      orderBy: { consignment_date: 'desc' },
    })

    // Map output to primitive numbers to avoid Next.js "Decimal objects are not supported" error
    const mappedItems = items.map(item => {
      const qty_received = Number(item.qty_received);
      const qty_returned = Number(item.qty_returned);
      const stock = item.products ? Number(item.products.stock) : 0;
      
      // Hitung qty_sold secara dinamis berdasarkan sisa stok aktual di tabel produk
      const qty_sold = Math.max(0, qty_received - qty_returned - stock);

      return {
        ...item,
        qty_received,
        qty_returned,
        qty_sold,
        return_reason: item.return_reason ?? null,
        return_date: item.return_date ? item.return_date.toISOString() : null,
        products: item.products ? {
          name: item.products.name,
          stock: Number(item.products.stock),
          purchase_price: Number(item.products.purchase_price),
          price: Number(item.products.price),
          member_price: item.products.member_price ? Number(item.products.member_price) : null
        } : null,
        payables: item.payables.map(p => ({
          ...p,
          qty_sold: Number(p.qty_sold),
          unit_price: Number(p.unit_price),
          total_amount: Number(p.total_amount)
        }))
      };
    });

    return { success: true, data: mappedItems }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch items',
    }
  }
}

export async function returnConsignmentItem(itemId: number, qtyReturn: number, returnReason: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized - tidak ada sesi login aktif')

    const item = await prisma.consignment_items.findUnique({
      where: { id: BigInt(itemId) },
      include: { products: true }
    })
    if (!item) throw new Error(`Item dengan ID ${itemId} tidak ditemukan`)

    const qty_received = Number(item.qty_received)
    const qty_returned_so_far = Number(item.qty_returned)
    const actual_stock = item.products ? Number(item.products.stock) : 0

    // Gunakan rumus yang sama dengan UI: qty_remaining = received - returned - actual_stock
    // actual_stock sudah mencerminkan penjualan POS secara real-time
    const qty_remaining = actual_stock

    if (qtyReturn <= 0) throw new Error('Jumlah retur harus lebih dari 0')
    if (!returnReason?.trim()) throw new Error('Alasan retur wajib diisi')
    if (qtyReturn > qty_remaining) {
      throw new Error(`Jumlah retur (${qtyReturn}) melebihi sisa stok yang tersedia (${qty_remaining})`)
    }

    const newStatus = (qty_remaining - qtyReturn) === 0 ? 'returned' : item.status

    // Gunakan interactive transaction untuk error handling yang lebih baik
    await prisma.$transaction(async (tx) => {
      await tx.consignment_items.update({
        where: { id: BigInt(itemId) },
        data: {
          qty_returned: { increment: qtyReturn },
          status: newStatus as any,
          return_reason: returnReason.trim(),
          return_date: new Date(),
        }
      })

      // Retur = barang kembali ke supplier = stok toko BERKURANG
      await tx.products.update({
        where: { id: item.product_id },
        data: { stock: { decrement: qtyReturn } }
      })
    })

    await logAudit({
      action: 'UPDATE',
      modelType: 'consignment_items',
      modelId: Number(itemId),
      newValues: { action: 'return', qty: qtyReturn }
    })
    revalidatePath('/toko/konsinyasi')
    return { success: true }
  } catch(error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed' }
  }
}

// ============================================
// CONSIGNMENT PAYABLES TRACKING
// ============================================

export async function recordConsignmentPayable(
  supplierId: number,
  consignmentId: number,
  qtySold: number,
  unitPrice: number,
  totalAmount: number
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    const payable = await prisma.$transaction(async (tx) => {
      const p = await tx.consignment_payables.create({
        data: {
          supplier_id: BigInt(supplierId),
          consignment_id: BigInt(consignmentId),
          qty_sold: qtySold,
          unit_price: unitPrice,
          total_amount: totalAmount,
          status: 'pending',
        },
        include: {
          suppliers: true,
        },
      })

      await tx.consignment_items.update({
        where: { id: BigInt(consignmentId) },
        data: { qty_sold: { increment: qtySold } }
      })

      return p
    })

    await logAudit({
      action: 'CREATE',
      modelType: 'consignment_payables',
      modelId: Number(payable.id),
      newValues: { supplier: (payable as any).suppliers?.supplier_name, total_qty_sold: qtySold, payable_amount: totalAmount },
    })
    revalidatePath('/toko/konsinyasi')
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to record payable',
    }
  }
}

export async function getConsignmentPayables(
  supplierId?: number,
  status?: 'pending' | 'partially_paid' | 'paid'
) {
  try {
    const payables = await prisma.consignment_payables.findMany({
      where: {
        ...(supplierId && { supplier_id: BigInt(supplierId) }),
        ...(status && { status }),
      },
      include: {
        suppliers: true,
        settlements: true,
      },
      orderBy: { created_at: 'desc' },
    })

    // Map output to primitive numbers to avoid Next.js serialization errors
    const mappedPayables = payables.map(p => ({
      ...p,
      qty_sold: Number(p.qty_sold),
      unit_price: Number(p.unit_price),
      total_amount: Number(p.total_amount),
      settlements: p.settlements.map(s => ({
        ...s,
        amount_paid: Number(s.amount_paid)
      }))
    }));

    return { success: true, data: mappedPayables }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch payables',
    }
  }
}

// ============================================
// CONSIGNMENT SETTLEMENT
// ============================================

export async function createConsignmentSettlement(
  payableId: number,
  amountPaid: number,
  paymentMethod: string,
  referenceNo?: string
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    const settlementDate = new Date()

    const settlement = await prisma.consignment_settlements.create({
      data: {
        payable_id: BigInt(payableId),
        amount_paid: amountPaid,
        payment_method: paymentMethod as any,
        reference_no: referenceNo,
        settlement_date: settlementDate,
        settlement_no: 'SET-' + Date.now(),
        processed_by: BigInt(session.user.id)
      },
      include: {
        consignment_payables: true,
      },
    })

    // Update payable status
    const payable = await prisma.consignment_payables.findUnique({
      where: { id: BigInt(payableId) },
      include: { settlements: true }
    })

    if (payable) {
      const totalPaid = payable.settlements.reduce((sum, s) => sum + Number(s.amount_paid), 0)
      const newStatus =
        totalPaid >= Number(payable.total_amount)
          ? 'paid'
          : 'partially_paid'

      await prisma.consignment_payables.update({
        where: { id: payableId },
        data: { status: newStatus as any },
      })
    }

    await logAudit({
      action: 'CREATE',
      modelType: 'consignment_settlements',
      modelId: Number(settlement.id),
      newValues: { payable_id: Number(payableId), amount_paid: amountPaid, payment_method: paymentMethod, reference_no: referenceNo ?? null },
    })
    revalidatePath('/toko/konsinyasi')
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create settlement',
    }
  }
}
