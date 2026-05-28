'use server'

import { prisma } from "@/lib/db/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { logAudit } from "@/lib/actions/log-audit"

// ============================================
// WAREHOUSE LOCATIONS MANAGEMENT
// ============================================

export async function createWarehouseLocation(
  unitId: bigint,
  locationCode: string,
  locationName: string,
  locationType: 'main' | 'branch' | 'warehouse' | 'kiosk',
  address?: string
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    const location = await prisma.warehouse_locations.create({
      data: {
        unit_id: unitId,
        location_code: locationCode,
        location_name: locationName,
        location_type: locationType,
        address,
      },
    })

    revalidatePath('/dashboard/toko')
    return { success: true, data: location }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create location',
    }
  }
}

export async function getWarehouseLocations(unitId: bigint) {
  try {
    const locations = await prisma.warehouse_locations.findMany({
      where: { unit_id: unitId, is_active: true },
      orderBy: { location_name: 'asc' },
    })

    return { success: true, data: locations }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch locations',
    }
  }
}

// ============================================
// STOCK BALANCE TRACKING (MULTI-LOCATION)
// ============================================

export async function getStockBalances(
  productId: bigint,
  locationId?: bigint
) {
  try {
    const balances = await prisma.stock_balances.findMany({
      where: {
        product_id: productId,
        ...(locationId && { location_id: locationId }),
      },
      include: {
        warehouse_locations: true,
        products: true,
      },
    })

    return { success: true, data: balances }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch balances',
    }
  }
}

export async function updateStockBalance(
  productId: bigint,
  locationId: bigint,
  qtyOnHand: number,
  qtyReserved: number = 0
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    const qtyAvailable = qtyOnHand - qtyReserved

    const balance = await prisma.stock_balances.upsert({
      where: {
        product_id_location_id: {
          product_id: productId,
          location_id: locationId,
        },
      },
      update: {
        qty_on_hand: qtyOnHand,
        qty_reserved: qtyReserved,
        qty_available: qtyAvailable,
        updated_at: new Date(),
      },
      create: {
        product_id: productId,
        location_id: locationId,
        qty_on_hand: qtyOnHand,
        qty_reserved: qtyReserved,
        qty_available: qtyAvailable,
      },
    })

    revalidatePath('/dashboard/toko')

    await logAudit({
      action: 'UPDATE',
      modelType: 'stock_balances',
      modelId: Number(productId),
      newValues: { product_id: Number(productId), location_id: Number(locationId), qty_on_hand: qtyOnHand, qty_reserved: qtyReserved, qty_available: qtyOnHand - qtyReserved },
    })

    return { success: true, data: balance }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update balance',
    }
  }
}

// ============================================
// STOCK REORDER POINTS
// ============================================

export async function setStockReorderPoint(
  productId: bigint,
  reorderQty: number,
  reorderPoint: number,
  leadTimeDays: number = 7
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    const reorderPoint_data = await prisma.stock_reorder_points.upsert({
      where: { product_id: productId },
      update: {
        reorder_qty: reorderQty,
        reorder_point: reorderPoint,
        lead_time_days: leadTimeDays,
        updated_at: new Date(),
      },
      create: {
        product_id: productId,
        reorder_qty: reorderQty,
        reorder_point: reorderPoint,
        lead_time_days: leadTimeDays,
      },
    })

    revalidatePath('/dashboard/toko')
    return { success: true, data: reorderPoint_data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set reorder point',
    }
  }
}

export async function getStockReorderAlerts(unitId: bigint) {
  try {
    const alerts = await prisma.stock_reorder_points.findMany({
      where: {
        is_active: true,
      },
      include: {
        products: true,
      },
    })

    const filtered = alerts.filter((a: any) => a.products !== null)

    return { success: true, data: filtered }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch alerts',
    }
  }
}

// ============================================
// STOCK TRANSFER ORDERS
// ============================================

export async function createStockTransferOrder(
  fromLocationId: bigint,
  toLocationId: bigint,
  items: Array<{
    productId: bigint
    qtyRequested: number
  }>,
  notes?: string
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    const transferNo = `TRANS-${Date.now()}`

    const transferOrder = await prisma.stock_transfer_orders.create({
      data: {
        transfer_no: transferNo,
        from_location_id: fromLocationId,
        to_location_id: toLocationId,
        status: 'pending',
        requested_by: BigInt(session.user.id),
        notes,
        transfer_items: {
          createMany: {
            data: items.map((item: any) => ({
              product_id: item.productId,
              qty_requested: item.qtyRequested,
            })),
          },
        },
      },
      include: {
        transfer_items: true,
      },
    })

    revalidatePath('/dashboard/toko')

    await logAudit({
      action: 'CREATE',
      modelType: 'stock_transfer_orders',
      modelId: Number(transferOrder.id),
      newValues: { transfer_no: transferOrder.transfer_no, from_location_id: Number(fromLocationId), to_location_id: Number(toLocationId), item_count: items.length, notes },
    })

    return { success: true, data: transferOrder }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create transfer',
    }
  }
}

export async function approveStockTransfer(transferId: bigint) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    const updated = await prisma.stock_transfer_orders.update({
      where: { id: transferId },
      data: {
        status: 'in_transit',
        approved_by: BigInt(session.user.id),
        approved_at: new Date(),
      },
      include: {
        transfer_items: true,
      },
    })

    revalidatePath('/dashboard/toko')

    await logAudit({
      action: 'APPROVE',
      modelType: 'stock_transfer_orders',
      modelId: Number(transferId),
      oldValues: { status: 'pending' },
      newValues: { status: 'in_transit', transfer_no: (updated as any).transfer_no },
    })

    return { success: true, data: updated }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve transfer',
    }
  }
}

export async function receiveStockTransfer(transferId: bigint) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    const transfer = await prisma.stock_transfer_orders.findUnique({
      where: { id: transferId },
      include: { transfer_items: true },
    })

    if (!transfer) throw new Error('Transfer order not found')

    await Promise.all(
      transfer.transfer_items.map(async (item: any) => {
        await prisma.stock_balances.update({
          where: {
            product_id_location_id: {
              product_id: item.product_id,
              location_id: transfer.from_location_id,
            },
          },
          data: {
            qty_on_hand: {
              decrement: item.qty_transferred,
            },
          },
        })

        await prisma.stock_balances.update({
          where: {
            product_id_location_id: {
              product_id: item.product_id,
              location_id: transfer.to_location_id,
            },
          },
          data: {
            qty_on_hand: {
              increment: item.qty_transferred,
            },
          },
        })
      })
    )

    const updated = await prisma.stock_transfer_orders.update({
      where: { id: transferId },
      data: {
        status: 'received',
        transferred_by: BigInt(session.user.id),
        transferred_at: new Date(),
      },
    })

    revalidatePath('/dashboard/toko')

    await logAudit({
      action: 'UPDATE',
      modelType: 'stock_transfer_orders',
      modelId: Number(transferId),
      oldValues: { status: 'in_transit' },
      newValues: { status: 'received', transfer_no: (updated as any).transfer_no, item_count: transfer.transfer_items.length },
    })

    return { success: true, data: updated }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to receive transfer',
    }
  }
}

// ============================================
// STOCK OPNAME (INVENTORY RECONCILIATION)
// ============================================

export async function createStockOpname(
  opnameDate: Date,
  locationId?: bigint,
  notes?: string
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    const opnameNo = `OPNAME-${Date.now()}`

    const opname = await prisma.stock_opname.create({
      data: {
        opname_no: opnameNo,
        opname_date: opnameDate,
        location_id: locationId,
        status: 'draft',
        notes,
        conducted_by: BigInt(session.user.id),
      },
    })

    revalidatePath('/dashboard/toko')
    return { success: true, data: opname }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create opname',
    }
  }
}

export async function recordOpnameDetail(
  opnameId: bigint,
  productId: bigint,
  qtySystem: number,
  qtyPhysical: number,
  notes?: string
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    const variance = qtyPhysical - qtySystem

    const detail = await prisma.stock_opname_details.create({
      data: {
        opname_id: opnameId,
        product_id: productId,
        qty_system: qtySystem,
        qty_physical: qtyPhysical,
        variance,
        notes,
      },
    })

    revalidatePath('/dashboard/toko')
    return { success: true, data: detail }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to record detail',
    }
  }
}

export async function approveStockOpname(opnameId: bigint) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')
    const userId = BigInt(session.user.id)

    // Execute in a transaction to ensure all stock changes and movements are reconciled atomically
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Update the stock opname status to approved
      const updated = await tx.stock_opname.update({
        where: { id: opnameId },
        data: {
          status: 'approved',
          approved_by: userId,
          approved_at: new Date(),
        },
        include: {
          opname_details: true,
        },
      })

      // Fetch warehouse location name if location_id exists
      let locationName = ''
      if (updated.location_id) {
        const loc = await tx.warehouse_locations.findUnique({
          where: { id: updated.location_id },
          select: { location_name: true },
        })
        if (loc) {
          locationName = loc.location_name
        }
      }

      // 2. Loop through all details to reconcile stock
      for (const detail of updated.opname_details) {
        const pid = detail.product_id
        const qtyPhysical = detail.qty_physical
        let adjustment = 0
        let globalStockBefore = 0
        let globalStockAfter = 0

        if (updated.location_id) {
          // Get the current stock balance at this location
          const existingBalance = await tx.stock_balances.findUnique({
            where: {
              product_id_location_id: {
                product_id: pid,
                location_id: updated.location_id,
              },
            },
          })

          const localStockBefore = existingBalance ? existingBalance.qty_on_hand : 0
          adjustment = qtyPhysical - localStockBefore

          // Update stock balance at the location
          await tx.stock_balances.upsert({
            where: {
              product_id_location_id: {
                product_id: pid,
                location_id: updated.location_id,
              },
            },
            update: {
              qty_on_hand: qtyPhysical,
              qty_available: qtyPhysical - (existingBalance ? existingBalance.qty_reserved : 0),
              updated_at: new Date(),
            },
            create: {
              product_id: pid,
              location_id: updated.location_id,
              qty_on_hand: qtyPhysical,
              qty_reserved: 0,
              qty_available: qtyPhysical,
              updated_at: new Date(),
            },
          })

          // Update global product stock
          const product = await tx.products.findUnique({
            where: { id: pid },
            select: { stock: true },
          })
          globalStockBefore = product ? product.stock : 0
          globalStockAfter = globalStockBefore + adjustment

          await tx.products.update({
            where: { id: pid },
            data: { stock: globalStockAfter },
          })

        } else {
          // No location specified: update global product stock directly
          const product = await tx.products.findUnique({
            where: { id: pid },
            select: { stock: true },
          })
          globalStockBefore = product ? product.stock : 0
          globalStockAfter = qtyPhysical
          adjustment = qtyPhysical - globalStockBefore

          await tx.products.update({
            where: { id: pid },
            data: { stock: globalStockAfter },
          })
        }

        // 3. Log stock movement for the reconciliation
        await tx.stock_movements.create({
          data: {
            product_id: pid,
            type: 'adjustment',
            qty: adjustment,
            stock_before: globalStockBefore,
            stock_after: globalStockAfter,
            reference: updated.opname_no,
            note: updated.location_id
              ? `Stock opname adjustment. Lokasi: ${locationName || 'Unknown'}`
              : 'Stock opname adjustment. (Global)',
            created_by: userId,
            created_at: new Date(),
          },
        })
      }

      return updated
    })

    revalidatePath('/dashboard/toko')
    revalidatePath('/toko/inventaris')

    await logAudit({
      action: 'APPROVE',
      modelType: 'stock_opname',
      modelId: Number(opnameId),
      oldValues: { status: 'draft' },
      newValues: {
        status: 'approved',
        opname_no: result.opname_no,
        detail_count: result.opname_details?.length ?? 0,
      },
    })

    return {
      success: true,
      data: {
        id: Number(result.id),
        status: result.status,
        opname_no: result.opname_no,
      },
    }
  } catch (error) {
    console.error('[inventory] Error approving stock opname:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve opname',
    }
  }
}

// ============================================
// PRODUCT COSTING METHODS
// ============================================

export async function setProductCosting(
  productId: bigint,
  costingMethod: 'fifo' | 'lifo' | 'average_cost' | 'standard_cost',
  currentCost: number
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')

    const costing = await prisma.product_costing.upsert({
      where: { product_id: productId },
      update: {
        costing_method: costingMethod,
        current_cost: currentCost,
        updated_at: new Date(),
      },
      create: {
        product_id: productId,
        costing_method: costingMethod,
        current_cost: currentCost,
      },
    })

    await logAudit({
      action: 'UPDATE',
      modelType: 'product_costing',
      modelId: Number(productId),
      newValues: { product_id: Number(productId), costing_method: costingMethod, current_cost: currentCost },
    })
    revalidatePath('/dashboard/toko')
    return { success: true, data: costing }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set costing',
    }
  }
}

export async function getProductCosting(productId: bigint) {
  try {
    const costing = await prisma.product_costing.findUnique({
      where: { product_id: productId },
      include: { products: true },
    })

    return { success: true, data: costing }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch costing',
    }
  }
}
