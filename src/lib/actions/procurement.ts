'use server'

import { prisma } from '@/lib/db/prisma'
import { auth } from '@/auth'
import { checkRole } from '@/lib/auth-helpers'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/actions/log-audit'

// ============================================
// SUPPLIER MANAGEMENT
// ============================================

export async function createSupplier(
  supplierCode: string,
  supplierName: string,
  contactPerson?: string,
  phone?: string,
  email?: string,
  address?: string,
  city?: string,
  paymentTerms?: number,
  avgDeliveryDays?: number,
  notes?: string
) {
  try {
    // SECURITY FIX: Only admin/pengurus can create suppliers
    await checkRole(["admin", "pengurus", "superadmin"]);
    
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    const supplier = await prisma.suppliers.create({
      data: {
        supplier_code: supplierCode,
        supplier_name: supplierName,
        contact_person: contactPerson,
        phone,
        email,
        address,
        city,
        payment_terms: paymentTerms,
        avg_delivery_days: avgDeliveryDays,
        notes,
      },
    })

    await logAudit({
      action: 'CREATE',
      modelType: 'suppliers',
      modelId: Number(supplier.id),
      newValues: { supplier_code: supplierCode, supplier_name: supplierName, contact_person: contactPerson, phone, email, city },
    })

    revalidatePath('/dashboard/pembelian/supplier')
    return { success: true, data: supplier }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create supplier',
    }
  }
}

export async function getSuppliers(isActive: boolean = true) {
  try {
    const suppliers = await prisma.suppliers.findMany({
      where: { is_active: isActive },
      orderBy: { supplier_name: 'asc' },
      include: {
        _count: {
          select: {
            purchase_orders: true,
            good_receipts: true,
          },
        },
      },
    })

    return { success: true, data: suppliers }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch suppliers',
    }
  }
}

// ============================================
// PURCHASE ORDER (PO)
// ============================================

export async function createPurchaseOrder(
  supplierId: number,
  poDate: Date,
  expectedDelivery: Date,
  items: Array<{
    productId: number
    qtyOrdered: number
    unitPrice: number
  }>,
  notes?: string
) {
  try {
    // SECURITY FIX: Only admin/pengurus can create purchase orders
    await checkRole(["admin", "pengurus", "superadmin"]);
    
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    const supplierIdBigInt = BigInt(supplierId)
    const itemsBigInt = items.map((item: any) => ({
      ...item,
      productId: BigInt(item.productId)
    }))

    const poNo = `PO-${Date.now()}`
    const subtotal = items.reduce((sum: any, item: any) => sum + item.qtyOrdered * item.unitPrice, 0)
    const taxAmount = subtotal * 0.1 // 10% PPN
    const totalAmount = subtotal + taxAmount

    const po = await prisma.purchase_orders.create({
      data: {
        supplier_id: supplierIdBigInt,
        po_no: poNo,
        po_date: poDate,
        expected_delivery: expectedDelivery,
        status: 'draft',
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        notes,
        created_by: BigInt(session.user.id),
        po_items: {
          createMany: {
            data: itemsBigInt.map((item: any) => ({
              product_id: item.productId,
              qty_ordered: item.qtyOrdered,
              unit_price: item.unitPrice,
              line_total: item.qtyOrdered * item.unitPrice,
            })),
          },
        },
      },
      include: {
        po_items: true,
        suppliers: true,
      },
    })

    revalidatePath('/dashboard/pembelian/po')

    await logAudit({
      action: 'CREATE',
      modelType: 'purchase_orders',
      modelId: Number(po.id),
      newValues: {
        po_no: po.po_no,
        supplier: (po as any).suppliers?.supplier_name,
        total_amount: Number(po.total_amount),
        item_count: items.length,
        notes,
      },
    })

    return { 
      success: true, 
      data: {
        id: Number(po.id),
        po_no: po.po_no,
        total_amount: Number(po.total_amount)
      } 
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create PO',
    }
  }
}

export async function approvePurchaseOrder(poId: number) {
  try {
    // SECURITY FIX: Only admin/pengurus can approve purchase orders
    await checkRole(["admin", "pengurus", "superadmin"]);
    
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    const poIdBigInt = BigInt(poId)

    const updated = await prisma.purchase_orders.update({
      where: { id: poIdBigInt },
      data: {
        status: 'approved',
        approved_by: BigInt(session.user.id),
        approved_at: new Date(),
      },
      include: {
        po_items: {
          include: { products: true }
        },
      },
    })

    revalidatePath('/pembelian')

    await logAudit({
      action: 'APPROVE',
      modelType: 'purchase_orders',
      modelId: Number(poId),
      oldValues: { status: 'draft' },
      newValues: { status: 'approved', po_no: (updated as any).po_no, total_amount: Number((updated as any).total_amount) },
    })

    return { 
      success: true, 
      data: { id: Number(updated.id), status: updated.status } 
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve PO',
    }
  }
}

/**
 * Fetch PO details with all its items + product info for GR verification dialog.
 * @param poId - BigInt ID of purchase order
 */
export async function getPOItemsForReceipt(poId: number) {
  try {
    const poIdBigInt = BigInt(poId)

    const po = await prisma.purchase_orders.findUnique({
      where: { id: poIdBigInt },
      include: {
        po_items: {
          include: { products: true }
        },
        suppliers: true,
      },
    })

    if (!po) throw new Error('PO tidak ditemukan')

    return {
      success: true,
      data: {
        id: Number(po.id),
        po_no: po.po_no,
        supplier_name: po.suppliers?.supplier_name ?? '-',
        items: po.po_items.map((item: any) => ({
          id:            Number(item.id),
          product_id:    Number(item.product_id),
          product_name:  item.products?.name ?? '-',
          qty_ordered:   item.qty_ordered,
          qty_received:  item.qty_received ?? 0,
          unit_price:    Number(item.unit_price),
        }))
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch PO items',
    }
  }
}

/**
 * Create Good Receipt: validate received goods, update stock, log returns.
 * @param poId         - PO ID being received
 * @param supplierId   - Supplier ID
 * @param items        - Array of items with qty_received, qty_accepted, qty_rejected per product
 * @param notes        - Optional notes
 */
export async function receiveGoodsFromPO(
  poId: number,
  supplierId: number,
  items: Array<{
    productId:   number
    qtyReceived: number   // total yang datang dari supplier
    qtyAccepted: number   // yang diterima ke stok
    qtyRejected: number   // yang dikembalikan/cacat
    rejectReason?: string
  }>,
  notes?: string
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    const poIdBigInt = BigInt(poId)
    const supplierIdBigInt = BigInt(supplierId)
    const userId = BigInt(session.user.id)
    const itemsBigInt = items.map((i: any) => ({ ...i, productId: BigInt(i.productId) }))
    const grNo   = `GR-${Date.now()}`
    const today  = new Date()

    // Determine GR status based on rejections
    const hasRejections  = itemsBigInt.some((i: any) => i.qtyRejected > 0)
    const allRejected    = itemsBigInt.every((i: any) => i.qtyAccepted === 0)
    const grStatus: "received" | "partially_accepted" | "rejected" =
      allRejected ? 'rejected' : hasRejections ? 'partially_accepted' : 'received'

    // Get default warehouse location (WH-001 Gudang Utama)
    const defaultLocation = await prisma.warehouse_locations.findFirst({
      where: { is_active: true },
      orderBy: { id: 'asc' },
    })

    await prisma.$transaction(async (tx: any) => {
      // 0. Pre-load semua product data sekaligus SEBELUM loop
      //    agar tidak ada serial findUnique per-item di dalam transaksi
      const productIds = itemsBigInt.map((i: any) => i.productId)
      const productsBatch = await tx.products.findMany({
        where: { id: { in: productIds } },
        select: { id: true, stock: true },
      })
      const productMap = new Map<string, { id: bigint; stock: number }>(
        productsBatch.map((p: any) => [p.id.toString(), { id: p.id, stock: Number(p.stock ?? 0) }])
      )

      // 1. Create Good Receipt header
      const gr = await tx.good_receipts.create({
        data: {
          po_id:       poIdBigInt,
          supplier_id: supplierIdBigInt,
          gr_no:       grNo,
          gr_date:     today,
          status:      grStatus,
          received_by: userId,
          notes,
          good_receipt_items: {
            createMany: {
              data: itemsBigInt.map((item: any) => ({
                product_id:   item.productId,
                qty_received: item.qtyReceived,
                qty_accepted: item.qtyAccepted,
                qty_rejected: item.qtyRejected,
                notes:        item.rejectReason || null,
              })),
            },
          },
        },
      })

      // 2. Untuk setiap item yang diterima: update stok, stock_balances, stock_movements
      // Gunakan data dari productMap (sudah di-preload) agar tidak ada findUnique berulang
      for (const item of itemsBigInt) {
        const productData = productMap.get(item.productId.toString())

        if (item.qtyAccepted > 0) {
          const stockBefore = productData?.stock ?? 0
          const stockAfter  = stockBefore + item.qtyAccepted

          // Update products.stock
          await tx.products.update({
            where: { id: item.productId },
            data:  { stock: stockAfter },
          })
          // Update local cache agar perhitungan rejected tepat
          if (productData) productData.stock = stockAfter

          // Upsert stock_balances (per location)
          if (defaultLocation) {
            await tx.stock_balances.upsert({
              where: {
                product_id_location_id: {
                  product_id:  item.productId,
                  location_id: defaultLocation.id,
                },
              },
              update: {
                qty_on_hand:   { increment: item.qtyAccepted },
                qty_available: { increment: item.qtyAccepted },
                updated_at:    today,
              },
              create: {
                product_id:    item.productId,
                location_id:   defaultLocation.id,
                qty_on_hand:   item.qtyAccepted,
                qty_reserved:  0,
                qty_available: item.qtyAccepted,
                updated_at:    today,
              },
            })
          }

          // Log stock_movements untuk qty yang diterima
          await tx.stock_movements.create({
            data: {
              product_id:   item.productId,
              type:         'in',
              qty:          item.qtyAccepted,
              stock_before: stockBefore,
              stock_after:  stockAfter,
              reference:    grNo,
              note:         `Penerimaan barang dari PO. GR: ${grNo}`,
              created_by:   userId,
              created_at:   today,
            },
          })
        }

        // 3. Log stock_movements untuk barang yang ditolak/retur
        if (item.qtyRejected > 0) {
          const stockNow = productData?.stock ?? 0
          await tx.stock_movements.create({
            data: {
              product_id:   item.productId,
              type:         'return',
              qty:          item.qtyRejected,
              stock_before: stockNow,
              stock_after:  stockNow, // tidak mengubah stok - barang dikembalikan ke supplier
              reference:    grNo,
              note:         `Retur ke supplier. Alasan: ${item.rejectReason ?? 'Barang cacat/rusak'}. GR: ${grNo}`,
              created_by:   userId,
              created_at:   today,
            },
          })
        }
      }

      // 4. Update qty_received on purchase_order_items
      for (const item of itemsBigInt) {
        await tx.purchase_order_items.updateMany({
          where: { po_id: poIdBigInt, product_id: item.productId },
          data:  { qty_received: { increment: item.qtyAccepted } },
        })
      }

      // 5. Update PO status to received/partial/cancelled based on all items
      const allPoItems = await tx.purchase_order_items.findMany({
        where: { po_id: poIdBigInt }
      })
      const totalOrdered = allPoItems.reduce((acc: any, poi: any) => acc + poi.qty_ordered, 0)
      const totalReceived = allPoItems.reduce((acc: any, poi: any) => acc + (poi.qty_received ?? 0), 0)

      let poStatus: "received" | "partial_received" | "approved" = 'partial_received'
      if (totalReceived >= totalOrdered) {
        poStatus = 'received'
      } else if (totalReceived === 0) {
        poStatus = 'approved'
      } else {
        poStatus = 'partial_received'
      }
        
      await tx.purchase_orders.update({
        where: { id: poIdBigInt },
        data:  { status: poStatus },
      })

      // 6. GENERATE ACCOUNTS PAYABLE
      // Hitung total nilai barang yang diterima HANYA PADA GR INI
      let apSubtotal = 0
      for (const item of itemsBigInt) {
        if (item.qtyAccepted > 0) {
          const poItem = allPoItems.find((p: any) => p.product_id === item.productId)
          if (poItem) {
            apSubtotal += item.qtyAccepted * Number(poItem.unit_price)
          }
        }
      }

      if (apSubtotal > 0) {
        const apTax = apSubtotal * 0.1 // Sesuai default tax PO (10%)
        const apTotal = apSubtotal + apTax
        const supplier = await tx.suppliers.findUnique({ where: { id: supplierIdBigInt } })
        const terms = supplier?.payment_terms || 30
        const dueDate = new Date(today)
        dueDate.setDate(dueDate.getDate() + terms)
        
        await tx.accounts_payable.create({
          data: {
            supplier_id: supplierIdBigInt,
            invoice_no: 'INV-' + grNo, // Auto-generate dari GR No
            invoice_date: today,
            due_date: dueDate,
            subtotal: apSubtotal,
            tax_amount: apTax,
            total_amount: apTotal,
            amount_paid: 0,
            amount_due: apTotal,
            status: 'open',
            notes: 'Otomatis digenerate dari Penerimaan Barang (GR): ' + grNo,
            created_at: today,
            updated_at: today
          }
        })
      }

      return gr
    }, {
      timeout: 30000,  // 30 detik — cukup untuk PO dengan banyak item
      maxWait: 10000,  // tunggu slot koneksi maksimal 10 detik
    })

    await logAudit({
      action: 'CREATE',
      modelType: 'good_receipts',
      modelId: 0,
      newValues: {
        gr_no:        grNo,
        po_id:        poId,
        status:       grStatus,
        items_count:  items.length,
        total_accepted: items.reduce((s: any, i: any) => s + i.qtyAccepted, 0),
        total_rejected: items.reduce((s: any, i: any) => s + i.qtyRejected, 0),
        notes,
      },
    })

    revalidatePath('/pembelian')
    revalidatePath('/toko/inventaris')

    return { success: true, grNo }
  } catch (error) {
    console.error('receiveGoodsFromPO error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to receive goods',
    }
  }
}

export async function getPurchaseOrders(
  supplierId?: bigint,
  status?: 'draft' | 'submitted' | 'approved' | 'partial_received' | 'received' | 'cancelled'
) {
  try {
    const pos = await prisma.purchase_orders.findMany({
      where: {
        ...(supplierId && { supplier_id: supplierId }),
        ...(status && { status }),
      },
      include: {
        po_items: {
          include: { products: { select: { id: true, name: true, sku: true, purchase_price: true } } },
        },
        suppliers: { select: { id: true, supplier_name: true, supplier_code: true } },
        good_receipts: { select: { id: true, gr_no: true, gr_date: true, status: true } },
      },
      orderBy: { po_date: 'desc' },
    })

    // Serialize all Decimal / BigInt fields to plain JS types
    const serialized = pos.map((po: any) => ({
      id:                Number(po.id),
      supplier_id:       Number(po.supplier_id),
      po_no:             po.po_no,
      po_date:           po.po_date instanceof Date ? po.po_date.toISOString().split('T')[0] : String(po.po_date),
      expected_delivery: po.expected_delivery instanceof Date ? po.expected_delivery.toISOString().split('T')[0] : String(po.expected_delivery),
      status:            po.status,
      subtotal:          Number(po.subtotal ?? 0),
      tax_amount:        Number(po.tax_amount ?? 0),
      total_amount:      Number(po.total_amount ?? 0),
      notes:             po.notes ?? null,
      created_by:        po.created_by ? Number(po.created_by) : null,
      approved_by:       po.approved_by ? Number(po.approved_by) : null,
      approved_at:       po.approved_at instanceof Date ? po.approved_at.toISOString() : null,
      created_at:        po.created_at instanceof Date ? po.created_at.toISOString() : null,
      updated_at:        po.updated_at instanceof Date ? po.updated_at.toISOString() : null,
      suppliers: po.suppliers ? {
        id:            Number(po.suppliers.id),
        supplier_name: po.suppliers.supplier_name,
        supplier_code: po.suppliers.supplier_code,
      } : null,
      po_items: po.po_items.map((item: any) => ({
        id:           Number(item.id),
        product_id:   Number(item.product_id),
        qty_ordered:  item.qty_ordered,
        qty_received: item.qty_received ?? 0,
        unit_price:   Number(item.unit_price),
        line_total:   Number(item.line_total),
        products: item.products ? {
          id:             Number(item.products.id),
          name:           item.products.name,
          sku:            item.products.sku,
          purchase_price: Number(item.products.purchase_price),
        } : null,
      })),
      good_receipts: po.good_receipts.map((gr: any) => ({
        id:      Number(gr.id),
        gr_no:   gr.gr_no,
        gr_date: gr.gr_date instanceof Date ? gr.gr_date.toISOString().split('T')[0] : String(gr.gr_date),
        status:  gr.status,
      })),
    }))

    return { success: true, data: serialized }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch POs',
    }
  }
}

// ============================================
// GOOD RECEIPTS (GR)
// ============================================

export async function createGoodReceipt(
  poId: bigint,
  supplierId: bigint,
  grDate: Date,
  items: Array<{
    productId: bigint
    qtyReceived: number
    qtyAccepted?: number
    qtyRejected?: number
    notes?: string
  }>,
  notes?: string
) {
  try {
    // SECURITY FIX: Only admin/pengurus can create good receipts
    await checkRole(["admin", "pengurus", "superadmin"]);
    
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    const grNo = `GR-${Date.now()}`

    const gr = await prisma.good_receipts.create({
      data: {
        po_id: poId,
        supplier_id: supplierId,
        gr_no: grNo,
        gr_date: grDate,
        status: 'received',
        received_by: BigInt(session.user.id),
        notes,
        good_receipt_items: {
          createMany: {
            data: items.map((item: any) => ({
              product_id: item.productId,
              qty_received: item.qtyReceived,
              qty_accepted: item.qtyAccepted || item.qtyReceived,
              qty_rejected: item.qtyRejected || 0,
              notes: item.notes,
            })),
          },
        },
      },
      include: {
        good_receipt_items: {
          include: {
            products: true,
          },
        },
        purchase_orders: true,
      },
    })

    // Update stock for accepted items
    await Promise.all(
      items.map((item: any) =>
        prisma.products.update({
          where: { id: item.productId },
          data: {
            stock: {
              increment: item.qtyAccepted || item.qtyReceived,
            },
          },
        })
      )
    )

    revalidatePath('/dashboard/pembelian/gr')

    await logAudit({
      action: 'CREATE',
      modelType: 'good_receipts',
      modelId: Number(gr.id),
      newValues: {
        gr_no: gr.gr_no,
        po_no: (gr as any).purchase_orders?.po_no,
        item_count: items.length,
        notes,
      },
    })

    return { success: true, data: gr }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create GR',
    }
  }
}

export async function approveGoodReceipt(grId: bigint) {
  try {
    // SECURITY FIX: Only admin/pengurus can approve good receipts
    await checkRole(["admin", "pengurus", "superadmin"]);
    
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    const updated = await prisma.good_receipts.update({
      where: { id: grId },
      data: {
        status: 'accepted',
      },
      include: {
        good_receipt_items: true,
      },
    })

    revalidatePath('/dashboard/pembelian/gr')

    await logAudit({
      action: 'APPROVE',
      modelType: 'good_receipts',
      modelId: Number(grId),
      oldValues: { status: 'received' },
      newValues: { status: 'accepted', gr_no: (updated as any).gr_no },
    })

    return { success: true, data: updated }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve GR',
    }
  }
}

export async function getGoodReceipts(
  poId?: bigint,
  supplierId?: bigint,
  status?: 'received' | 'inspected' | 'accepted' | 'rejected' | 'partially_accepted'
) {
  try {
    const grs = await prisma.good_receipts.findMany({
      where: {
        ...(poId && { po_id: poId }),
        ...(supplierId && { supplier_id: supplierId }),
        ...(status && { status }),
      },
      include: {
        good_receipt_items: {
          include: {
            products: true,
          },
        },
        purchase_orders: true,
        suppliers: true,
      },
      orderBy: { gr_date: 'desc' },
    })

    return { success: true, data: grs }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch GRs',
    }
  }
}

// ============================================
// SUPPLIER PERFORMANCE TRACKING
// ============================================

export async function getSupplierPerformance(
  supplierId: bigint,
  monthsBack: number = 12
) {
  try {
    const dateFrom = new Date()
    dateFrom.setMonth(dateFrom.getMonth() - monthsBack)

    const pos = await prisma.purchase_orders.findMany({
      where: {
        supplier_id: supplierId,
        po_date: { gte: dateFrom },
      },
      include: {
        good_receipts: true,
      },
    })

    const metrics = {
      totalPOs: pos.length,
      onTimeDelivery: 0,
      lateDelivery: 0,
      avgDeliveryDays: 0,
    }

    let totalDays = 0
    pos.forEach((po: any) => {
      const grs = po.good_receipts
      if (grs.length > 0) {
        const daysToDeliver = Math.floor(
          (grs[0].gr_date.getTime() - po.expected_delivery.getTime()) /
            (1000 * 60 * 60 * 24)
        )
        totalDays += daysToDeliver

        if (daysToDeliver <= 0) metrics.onTimeDelivery++
        else metrics.lateDelivery++
      }
    })

    metrics.avgDeliveryDays = Math.round(
      totalDays / (pos.length || 1)
    )

    return { success: true, data: metrics }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch performance',
    }
  }
}
