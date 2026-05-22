'use server'

import { prisma } from '@/lib/db/prisma'

/**
 * Fetch stock movement history with filters.
 * Handles records where created_at IS NULL (legacy GR data).
 *
 * @param params.startDate  - ISO date (YYYY-MM-DD)
 * @param params.endDate    - ISO date (YYYY-MM-DD)
 * @param params.productId  - Optional product ID
 * @param params.type       - Optional movement type (in|out|adjustment|return|transfer)
 */
export async function getStockMovements(params: {
  startDate?: string
  endDate?: string
  productId?: number
  type?: string
}) {
  try {
    const andConditions: any[] = []

    // Date filter: include NULL created_at rows (legacy data has no timestamp)
    if (params.startDate && params.endDate) {
      const start = new Date(params.startDate)
      const end   = new Date(params.endDate)
      end.setHours(23, 59, 59, 999)
      andConditions.push({
        OR: [
          { created_at: { gte: start, lte: end } },
          { created_at: null },
        ],
      })
    }

    if (params.productId) {
      andConditions.push({ product_id: params.productId })
    }

    if (params.type && params.type !== 'all') {
      andConditions.push({ type: params.type })
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {}

    const movements = await prisma.stock_movements.findMany({
      where,
      orderBy: { id: 'desc' },
      take: 500,
      include: {
        products: { select: { name: true, sku: true } },
        users:    { select: { username: true } },  // User model uses 'username' not 'name'
      },
    })

    return movements.map(m => ({
      id:           Number(m.id),
      created_at:   m.created_at?.toISOString() ?? new Date().toISOString(),
      product_name: m.products.name,
      product_sku:  m.products.sku,
      type:         m.type as string,
      quantity:     m.qty,
      stock_before: m.stock_before,
      stock_after:  m.stock_after,
      reference:    m.reference || '-',
      notes:        m.note || '-',
      created_by:   m.users?.username || 'System',
    }))
  } catch (error) {
    console.error('[laporan-stok] Error fetching stock movements:', error)
    return []
  }
}

export interface MonitoringStockRow {
  productId: number
  sku: string
  name: string
  stockAwal: number
  pembelian: number
  m1: number
  m2: number
  m3: number
  m4: number
  m5: number
  totPenjualan: number
  stockAkhir: number
  stockOpname: number | null
  qtyRetur: number
  penyesuaian: number
}

export async function getMonitoringStockReport(params: {
  startDate: string
  endDate: string
}) {
  try {
    const start = new Date(params.startDate)
    const end = new Date(params.endDate)
    end.setHours(23, 59, 59, 999)

    // Get all products
    const products = await prisma.products.findMany({
      select: {
        id: true,
        sku: true,
        name: true,
        stock: true,
        purchase_price: true,
        price: true,
      },
      orderBy: { name: 'asc' },
    })

    // Get all movements in range
    const movements = await prisma.stock_movements.findMany({
      where: {
        created_at: { gte: start, lte: end },
      },
      orderBy: { id: 'asc' },
    })

    // Get all approved stock opname details in range
    const opnameDetails = await prisma.stock_opname_details.findMany({
      where: {
        stock_opname: {
          status: 'approved',
          opname_date: { gte: start, lte: end },
        },
      },
      select: {
        product_id: true,
        qty_physical: true,
        stock_opname: {
          select: {
            opname_date: true,
          },
        },
      },
      orderBy: {
        stock_opname: {
          opname_date: 'desc',
        },
      },
    })

    // Map of latest opname qty physical per product
    const opnameMap = new Map<number, number>()
    opnameDetails.forEach(od => {
      const pid = Number(od.product_id)
      if (!opnameMap.has(pid)) {
        opnameMap.set(pid, od.qty_physical)
      }
    })

    // Group movements by product
    const prodMovementsMap = new Map<number, typeof movements>()
    movements.forEach(m => {
      const pid = Number(m.product_id)
      if (!prodMovementsMap.has(pid)) {
        prodMovementsMap.set(pid, [])
      }
      prodMovementsMap.get(pid)!.push(m)
    })

    const reportRows: MonitoringStockRow[] = products.map(p => {
      const pid = Number(p.id)
      const pMovements = prodMovementsMap.get(pid) || []
      const purchasePrice = Number(p.purchase_price || 0)
      const sellingPrice = Number(p.price || 0)

      // Calculate Stock Awal:
      // If there are movements in the range, the stock_before of the first movement
      // is the stock at the start. Otherwise, it is the current stock.
      let stockAwalQty = p.stock
      if (pMovements.length > 0) {
        stockAwalQty = pMovements[0].stock_before
      }

      // Calculate Stock Akhir:
      // If there are movements in the range, the stock_after of the last movement
      // is the stock at the end. Otherwise, it is equal to stockAwal.
      let stockAkhirQty = stockAwalQty
      if (pMovements.length > 0) {
        stockAkhirQty = pMovements[pMovements.length - 1].stock_after
      }

      let pembelianQty = 0
      let qtyReturQty = 0
      let adjustmentQty = 0
      let m1Qty = 0
      let m2Qty = 0
      let m3Qty = 0
      let m4Qty = 0
      let m5Qty = 0

      pMovements.forEach(m => {
        const qty = m.qty
        const date = m.created_at ? new Date(m.created_at) : new Date()
        const day = date.getDate()

        if (m.type === 'in') {
          pembelianQty += qty
        } else if (m.type === 'return') {
          qtyReturQty += qty
        } else if (m.type === 'adjustment') {
          adjustmentQty += qty
        } else if (m.type === 'out') {
          if (day <= 7) m1Qty += qty
          else if (day <= 14) m2Qty += qty
          else if (day <= 21) m3Qty += qty
          else if (day <= 28) m4Qty += qty
          else m5Qty += qty
        }
      })

      const totPenjualanQty = m1Qty + m2Qty + m3Qty + m4Qty + m5Qty
      const stockOpnameQty = opnameMap.get(pid) ?? null

      // Convert quantities to financial values
      const stockAwal = stockAwalQty * purchasePrice
      const pembelian = pembelianQty * purchasePrice
      const m1 = m1Qty * sellingPrice
      const m2 = m2Qty * sellingPrice
      const m3 = m3Qty * sellingPrice
      const m4 = m4Qty * sellingPrice
      const m5 = m5Qty * sellingPrice
      const totPenjualan = totPenjualanQty * sellingPrice
      const stockAkhir = stockAkhirQty * purchasePrice
      const stockOpname = stockOpnameQty !== null ? stockOpnameQty * purchasePrice : null
      const qtyRetur = qtyReturQty * purchasePrice
      const penyesuaian = adjustmentQty * purchasePrice

      return {
        productId: pid,
        sku: p.sku,
        name: p.name,
        stockAwal,
        pembelian,
        m1,
        m2,
        m3,
        m4,
        m5,
        totPenjualan,
        stockAkhir,
        stockOpname,
        qtyRetur,
        penyesuaian,
      }
    })

    return reportRows
  } catch (error) {
    console.error('[laporan-stok] Error generating monitoring stock report:', error)
    return []
  }
}
