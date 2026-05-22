'use server'

import { prisma } from '@/lib/db/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/actions/log-audit'

// ============================================
// CONSIGNMENT ITEMS — PENERIMAAN
// ============================================

/**
 * Catat penerimaan barang konsinyasi dari supplier.
 * Alur: Terima barang → tambah stok produk → simpan item.
 * TIDAK membuat payable saat penerimaan; payable dibuat terpisah
 * via recordConsignmentPayable() setelah barang terjual.
 *
 * @param productId - ID produk yang diterima
 * @param supplierId - ID supplier pengirim
 * @param qtyReceived - Jumlah unit yang diterima
 * @param unitPrice - Harga beli per unit (HPP)
 * @param consignmentDate - Tanggal penerimaan
 */
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

    if (qtyReceived <= 0) throw new Error('Jumlah barang harus lebih dari 0')
    if (unitPrice < 0) throw new Error('Harga tidak boleh negatif')

    const item = await prisma.$transaction(async (tx) => {
      // 1. Buat record konsinyasi
      const created = await tx.consignment_items.create({
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

      // 2. Tambah stok produk
      await tx.products.update({
        where: { id: BigInt(productId) },
        data: { stock: { increment: qtyReceived } },
      })

      // 3. Update purchase_price produk dengan HPP terbaru
      if (unitPrice > 0) {
        await tx.products.update({
          where: { id: BigInt(productId) },
          data: { purchase_price: unitPrice },
        })
      }

      return created
    })

    await logAudit({
      action: 'CREATE',
      modelType: 'consignment_items',
      modelId: Number(item.id),
      newValues: {
        product: (item as any).products?.name,
        supplier: (item as any).suppliers?.supplier_name,
        qty_received: qtyReceived,
        unit_price: unitPrice,
        consignment_date: consignmentDate.toISOString().slice(0, 10),
      },
    })

    revalidatePath('/toko/konsinyasi')
    return { success: true }
  } catch (error) {
    console.error('[createConsignmentItem]', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal mencatat penerimaan',
    }
  }
}

// ============================================
// CONSIGNMENT ITEMS — READ
// ============================================

/**
 * Ambil semua item konsinyasi dengan kalkulasi qty_sold dari stok aktual.
 *
 * @param supplierId - Filter opsional per supplier
 * @param status - Filter opsional per status
 */
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
      },
      orderBy: { consignment_date: 'desc' },
    })

    const mappedItems = items.map(item => {
      const qty_received = Number(item.qty_received)
      const qty_returned = Number(item.qty_returned)
      // Stok aktual produk = sisa barang yang belum terjual & belum diretur
      const actual_stock = item.products ? Number(item.products.stock) : 0

      // qty_sold = received - returned - sisa_stok (mencerminkan penjualan POS riil)
      const qty_sold = Math.max(0, qty_received - qty_returned - actual_stock)

      // qty_unbilled = qty_sold yang belum dibuatkan tagihan (belum ada payable)
      // Gunakan field qty_sold di DB sebagai penanda sudah ditagih
      const qty_billed = Number(item.qty_sold)
      const qty_unbilled = Math.max(0, qty_sold - qty_billed)

      return {
        id: Number(item.id),
        product_id: Number(item.product_id),
        product_name: item.products?.name ?? '-',
        supplier_id: Number(item.supplier_id),
        supplier_name: item.suppliers?.supplier_name ?? '-',
        qty_received,
        qty_sold,
        qty_billed,
        qty_unbilled,
        qty_returned,
        qty_remaining: actual_stock,
        unit_price: Number(item.products?.purchase_price ?? 0),
        status: item.status,
        return_reason: item.return_reason ?? null,
        return_date: item.return_date ? item.return_date.toISOString() : null,
        received_at: item.consignment_date
          ? new Date(item.consignment_date).toISOString().split('T')[0]
          : '-',
      }
    })

    return { success: true, data: mappedItems }
  } catch (error) {
    console.error('[getConsignmentItems]', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal mengambil data konsinyasi',
    }
  }
}

// ============================================
// CONSIGNMENT ITEMS — RETUR
// ============================================

/**
 * Proses retur barang konsinyasi ke supplier.
 * Stok produk dikurangi, qty_returned konsinyasi ditambah.
 *
 * @param itemId - ID consignment_items
 * @param qtyReturn - Jumlah unit yang diretur
 * @param returnReason - Alasan retur (wajib)
 */
export async function returnConsignmentItem(
  itemId: number,
  qtyReturn: number,
  returnReason: string
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized - tidak ada sesi login aktif')

    if (qtyReturn <= 0) throw new Error('Jumlah retur harus lebih dari 0')
    if (!returnReason?.trim()) throw new Error('Alasan retur wajib diisi')

    const item = await prisma.consignment_items.findUnique({
      where: { id: BigInt(itemId) },
      include: { products: true },
    })
    if (!item) throw new Error(`Item konsinyasi ID ${itemId} tidak ditemukan`)

    const qty_remaining = item.products ? Number(item.products.stock) : 0

    if (qtyReturn > qty_remaining) {
      throw new Error(
        `Jumlah retur (${qtyReturn}) melebihi sisa stok tersedia (${qty_remaining})`
      )
    }

    const newQtyReturned = Number(item.qty_returned) + qtyReturn
    const newStatus =
      Number(item.products?.stock ?? 0) - qtyReturn <= 0 ? 'returned' : item.status

    await prisma.$transaction(async (tx) => {
      await tx.consignment_items.update({
        where: { id: BigInt(itemId) },
        data: {
          qty_returned: newQtyReturned,
          status: newStatus as any,
          return_reason: returnReason.trim(),
          return_date: new Date(),
        },
      })

      // Retur = barang kembali ke supplier = stok toko berkurang
      await tx.products.update({
        where: { id: item.product_id },
        data: { stock: { decrement: qtyReturn } },
      })
    })

    await logAudit({
      action: 'UPDATE',
      modelType: 'consignment_items',
      modelId: Number(itemId),
      newValues: { action: 'return', qty: qtyReturn, reason: returnReason },
    })

    revalidatePath('/toko/konsinyasi')
    return { success: true }
  } catch (error) {
    console.error('[returnConsignmentItem]', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal proses retur',
    }
  }
}

// ============================================
// CONSIGNMENT PAYABLES — BUAT TAGIHAN
// ============================================

/**
 * Buat tagihan pembayaran ke supplier untuk barang konsinyasi yang sudah terjual.
 * Hanya dipanggil setelah ada penjualan (qty_sold > 0 dan ada qty_unbilled).
 *
 * @param supplierId - ID supplier
 * @param consignmentId - ID consignment_items
 * @param qtySold - Jumlah unit yang ditagihkan
 * @param unitPrice - Harga beli per unit
 * @param totalAmount - Total tagihan
 */
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

    if (qtySold <= 0) throw new Error('Jumlah terjual harus lebih dari 0')

    const payable = await prisma.$transaction(async (tx) => {
      // 1. Buat record tagihan
      const p = await tx.consignment_payables.create({
        data: {
          supplier_id: BigInt(supplierId),
          consignment_id: BigInt(consignmentId),
          qty_sold: qtySold,
          unit_price: unitPrice,
          total_amount: totalAmount,
          status: 'pending',
        },
        include: { suppliers: true },
      })

      // 2. Update qty_sold di consignment_items sebagai penanda "sudah ditagih"
      await tx.consignment_items.update({
        where: { id: BigInt(consignmentId) },
        data: { qty_sold: { increment: qtySold } },
      })

      return p
    })

    await logAudit({
      action: 'CREATE',
      modelType: 'consignment_payables',
      modelId: Number(payable.id),
      newValues: {
        supplier: (payable as any).suppliers?.supplier_name,
        qty_sold: qtySold,
        payable_amount: totalAmount,
      },
    })

    revalidatePath('/toko/konsinyasi')
    return { success: true }
  } catch (error) {
    console.error('[recordConsignmentPayable]', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal membuat tagihan',
    }
  }
}

// ============================================
// CONSIGNMENT PAYABLES — READ
// ============================================

/**
 * Ambil daftar tagihan konsinyasi.
 * Filter hanya yang qty_sold > 0 (tagihan nyata, bukan draft saat penerimaan).
 *
 * @param supplierId - Filter opsional per supplier
 * @param status - Filter opsional per status
 */
export async function getConsignmentPayables(
  supplierId?: number,
  status?: 'pending' | 'partially_paid' | 'paid'
) {
  try {
    const payables = await prisma.consignment_payables.findMany({
      where: {
        ...(supplierId && { supplier_id: BigInt(supplierId) }),
        ...(status && { status }),
        // Hanya tampilkan tagihan yang benar-benar ada penjualan
        qty_sold: { gt: 0 },
      },
      include: {
        suppliers: true,
        settlements: true,
        consignment_items: {
          include: { products: true },
        },
      },
      orderBy: { created_at: 'desc' },
    })

    const mappedPayables = payables.map(p => ({
      id: Number(p.id),
      supplier_id: Number(p.supplier_id),
      supplier_name: p.suppliers?.supplier_name ?? '-',
      consignment_id: Number(p.consignment_id),
      product_name: (p as any).consignment_items?.products?.name ?? '-',
      period_start: p.created_at
        ? new Date(p.created_at).toISOString().split('T')[0]
        : '-',
      period_end: p.updated_at
        ? new Date(p.updated_at).toISOString().split('T')[0]
        : '-',
      total_qty_sold: Number(p.qty_sold),
      unit_price: Number(p.unit_price),
      total_revenue: Number(p.total_amount),
      payable_amount: Number(p.total_amount),
      status: p.status,
      settlements: p.settlements.map(s => ({
        id: Number(s.id),
        amount_paid: Number(s.amount_paid),
        payment_method: s.payment_method,
        paid_at: s.settlement_date
          ? new Date(s.settlement_date).toISOString().split('T')[0]
          : '-',
      })),
    }))

    return { success: true, data: mappedPayables }
  } catch (error) {
    console.error('[getConsignmentPayables]', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal mengambil tagihan',
    }
  }
}

// ============================================
// CONSIGNMENT SETTLEMENT — BAYAR TAGIHAN
// ============================================

/**
 * Catat pembayaran tagihan konsinyasi ke supplier.
 * Update status payable ke 'paid' atau 'partially_paid'.
 *
 * @param payableId - ID consignment_payables
 * @param amountPaid - Nominal yang dibayarkan
 * @param paymentMethod - Metode pembayaran
 * @param referenceNo - Nomor referensi opsional
 */
export async function createConsignmentSettlement(
  payableId: number,
  amountPaid: number,
  paymentMethod: string,
  referenceNo?: string
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    if (amountPaid <= 0) throw new Error('Nominal pembayaran harus lebih dari 0')

    const payableIdBig = BigInt(payableId)

    const settlement = await prisma.consignment_settlements.create({
      data: {
        payable_id: payableIdBig,
        amount_paid: amountPaid,
        payment_method: paymentMethod as any,
        reference_no: referenceNo || null,
        settlement_date: new Date(),
        settlement_no: `SET-${Date.now()}`,
        processed_by: BigInt(session.user.id),
      },
    })

    // Hitung total sudah dibayar (termasuk settlement baru ini)
    const payable = await prisma.consignment_payables.findUnique({
      where: { id: payableIdBig },
      include: { settlements: true },
    })

    if (payable) {
      const totalPaid = payable.settlements.reduce(
        (sum, s) => sum + Number(s.amount_paid),
        0
      )
      const newStatus =
        totalPaid >= Number(payable.total_amount) ? 'paid' : 'partially_paid'

      await prisma.consignment_payables.update({
        where: { id: payableIdBig }, // ✅ BigInt konsisten
        data: { status: newStatus as any },
      })
    }

    await logAudit({
      action: 'CREATE',
      modelType: 'consignment_settlements',
      modelId: Number(settlement.id),
      newValues: {
        payable_id: payableId,
        amount_paid: amountPaid,
        payment_method: paymentMethod,
        reference_no: referenceNo ?? null,
      },
    })

    revalidatePath('/toko/konsinyasi')
    return { success: true }
  } catch (error) {
    console.error('[createConsignmentSettlement]', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal mencatat pembayaran',
    }
  }
}
