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
