'use server'

import { prisma } from '@/lib/db/prisma'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { logAudit } from '@/lib/actions/log-audit'

/**
 * Kasir mengajukan permintaan restock untuk produk stok menipis.
 * @param productId - ID produk yang perlu direstok
 */
export async function requestRestock(productId: number) {
  try {
    await prisma.products.update({
      where: { id: productId },
      data: { restock_requested: true }
    })
    revalidatePath('/dashboard')
    return { success: true, message: 'Permintaan restock berhasil dikirim ke pengurus.' }
  } catch (error) {
    console.error('Error requesting restock:', error)
    return { success: false, message: 'Gagal mengirim permintaan restock.' }
  }
}

/**
 * Fetch daftar produk yang sudah di-request restock oleh kasir.
 * Digunakan untuk widget notifikasi di dashboard pengurus.
 */
export async function getRestockAlerts() {
  try {
    const products = await prisma.products.findMany({
      where: { 
        restock_requested: true, 
        is_active: true,
        product_categories: { slug: { not: 'konsinyasi' } }
      },
      select: {
        id: true, name: true, sku: true, stock: true, min_stock: true, purchase_price: true,
        product_categories: { select: { name: true, slug: true } }
      },
      orderBy: { name: 'asc' }
    })
    return products.map(p => ({
      ...p,
      id: Number(p.id),
      purchase_price: Number(p.purchase_price),
      category: p.product_categories?.name || '-',
      categorySlug: p.product_categories?.slug || '-'
    }))
  } catch (error) {
    console.error('Error getting restock alerts:', error)
    return []
  }
}

/**
 * Pengurus memproses permintaan restock: buat draft PO otomatis lalu reset flag.
 * @param supplierId   - ID supplier yang dituju
 * @param items        - Array { productId, qtyOrdered, unitPrice }
 * @param expectedDate - Tanggal ekspektasi pengiriman (ISO string)
 * @param notes        - Catatan PO opsional
 */
export async function createPOFromRestock(
  supplierId: number,
  items: Array<{ productId: number; qtyOrdered: number; unitPrice: number }>,
  expectedDate: string,
  notes?: string
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    const poNo       = `PO-${Date.now()}`
    const today      = new Date()
    const expDate    = new Date(expectedDate)
    const subtotal   = items.reduce((s, i) => s + i.qtyOrdered * i.unitPrice, 0)
    const taxAmount  = subtotal * 0.1
    const totalAmount = subtotal + taxAmount

    const po = await prisma.$transaction(async tx => {
      const newPO = await tx.purchase_orders.create({
        data: {
          supplier_id:       BigInt(supplierId),
          po_no:             poNo,
          po_date:           today,
          expected_delivery: expDate,
          status:            'draft',
          subtotal,
          tax_amount:        taxAmount,
          total_amount:      totalAmount,
          notes,
          created_by:        BigInt(session.user.id),
          po_items: {
            createMany: {
              data: items.map(i => ({
                product_id:  BigInt(i.productId),
                qty_ordered: i.qtyOrdered,
                unit_price:  i.unitPrice,
                line_total:  i.qtyOrdered * i.unitPrice,
              }))
            }
          }
        }
      })

      // Reset restock_requested flag for all processed products
      await tx.products.updateMany({
        where: { id: { in: items.map(i => i.productId) } },
        data:  { restock_requested: false }
      })

      return newPO
    })

    await logAudit({
      action:    'CREATE',
      modelType: 'purchase_orders',
      modelId:   Number(po.id),
      newValues: { po_no: poNo, supplierId, items_count: items.length, source: 'restock_request', notes }
    })

    revalidatePath('/dashboard')
    revalidatePath('/pembelian')
    return { success: true, poNo, poId: Number(po.id) }
  } catch (error) {
    console.error('createPOFromRestock error:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Gagal membuat PO.' }
  }
}
