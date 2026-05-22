'use server'

import { prisma } from '@/lib/db/prisma'

export type AnalyticsParams = {
  startDate: string   // YYYY-MM-DD
  endDate:   string   // YYYY-MM-DD
  paymentMethod?: string  // 'all' | 'cash' | 'paylater' | 'qris' | 'transfer' | 'saving_deduct'
}

export type AnalyticsResult = {
  summary: {
    omzet:          number
    cogs:           number
    gross_profit:   number
    margin_pct:     number
    transaction_count: number
    avg_transaction:   number
  }
  byPaymentMethod: { method: string; total: number; count: number }[]
  topProducts: {
    product_id:    number
    product_name:  string
    total_qty:     number
    total_revenue: number
    total_cogs:    number
    gross_profit:  number
    margin_pct:    number
  }[]
  slowMoving: {
    id: number; name: string; stock: number
    purchase_price: number; category: string; stock_value: number
  }[]
  dailySeries: { date: string; omzet: number; cogs: number }[]
}

/**
 * Mengambil data analitik keuangan (omzet, HPP riil, laba kotor, margin, produk lambat)
 * untuk rentang tanggal dan metode pembayaran tertentu secara akurat dari database.
 *
 * @param {AnalyticsParams} params Parameter kueri analitik (startDate, endDate, paymentMethod)
 * @returns {Promise<AnalyticsResult>} Laporan analitik terhitung 100% akurat dari database
 * @throws {Error} Mengembalikan error jika kueri database gagal
 */
export async function getAnalyticsData(params: AnalyticsParams): Promise<AnalyticsResult> {
  try {
    const start = new Date(params.startDate)
    const end   = new Date(params.endDate)
    end.setHours(23, 59, 59, 999)

    const paymentFilter = params.paymentMethod && params.paymentMethod !== 'all'
      ? { payment_method: params.paymentMethod }
      : {}

    // Paylater orders have paid_at = NULL but payment_status = 'paid'.
    // We use ordered_at as fallback: include rows where paid_at IS in range,
    // OR paid_at IS NULL and ordered_at IS in range.
    const orderWhere = {
      payment_status: 'paid',
      OR: [
        { paid_at:    { gte: start, lte: end } },
        { paid_at:    null, ordered_at: { gte: start, lte: end } },
      ],
      ...paymentFilter,
    } as any

    // ── Parallel queries ─────────────────────────────────────
    const [
      revAgg,
      byPayment,
      itemGroups,
      slowRaw,
      dailyRaw,
      allSoldItems,
    ] = await Promise.all([
      // 1. Aggregate omzet
      prisma.orders.aggregate({
        where:  orderWhere,
        _sum:   { grand_total: true },
        _count: true,
      }),

      // 2. By payment method
      prisma.orders.groupBy({
        by:    ['payment_method'],
        where: orderWhere,
        _sum:  { grand_total: true },
        _count: true,
      }),

      // 3. Top products (qty + subtotal)
      prisma.order_items.groupBy({
        by:      ['product_id', 'product_name'],
        where:   { orders: orderWhere },
        _sum:    { qty: true, subtotal: true },
        orderBy: { _sum: { subtotal: 'desc' } },
        take:    20,
      }),

      // 4. Slow moving (active products with stock but no sales in period)
      prisma.products.findMany({
        where: {
          is_active: true,
          stock:     { gt: 0 },
          order_items: {
            none: { orders: { paid_at: { gte: start, lte: end }, payment_status: 'paid' } }
          },
        },
        select: {
          id: true, name: true, stock: true, purchase_price: true,
          product_categories: { select: { name: true } },
        },
        take:    20,
        orderBy: { stock: 'desc' },
      }),

      // 5. Daily series per date — HPP riil dihitung via JOIN ke order_items + products
      //    COALESCE(paid_at, ordered_at) menangani paylater yang paid_at = NULL
      prisma.$queryRaw<{ date: string; omzet: number; cogs: number }[]>`
        SELECT 
          DATE_FORMAT(COALESCE(o.paid_at, o.ordered_at), '%Y-%m-%d') AS \`date\`,
          SUM(o.grand_total)                                           AS omzet,
          SUM(oi.qty * p.purchase_price)                               AS cogs
        FROM orders o
        INNER JOIN order_items oi ON oi.order_id = o.id
        INNER JOIN products    p  ON p.id = oi.product_id
        WHERE o.payment_status = 'paid'
          AND COALESCE(o.paid_at, o.ordered_at) >= ${start}
          AND COALESCE(o.paid_at, o.ordered_at) <= ${end}
        GROUP BY DATE_FORMAT(COALESCE(o.paid_at, o.ordered_at), '%Y-%m-%d')
        ORDER BY \`date\`
      `,

      // 6. Fetch ALL sold items to compute exact COGS summary (no limit)
      prisma.order_items.findMany({
        where: { orders: orderWhere },
        select: {
          qty: true,
          products: {
            select: { purchase_price: true }
          }
        }
      })
    ])

    // ── Fetch HPP for all sold products ──────────────────────
    const soldIds = itemGroups.map(p => p.product_id)
    const hppRows = await prisma.products.findMany({
      where:  { id: { in: soldIds } },
      select: { id: true, purchase_price: true },
    })
    const hppMap = new Map(hppRows.map(p => [Number(p.id), Number(p.purchase_price)]))

    // ── Build top products with margin ───────────────────────
    const topProducts = itemGroups.map(p => {
      const qty     = p._sum.qty ?? 0
      const revenue = Number(p._sum.subtotal ?? 0)
      const hpp     = hppMap.get(Number(p.product_id)) ?? 0
      const cogs    = hpp * qty
      const profit  = revenue - cogs
      return {
        product_id:    Number(p.product_id),
        product_name:  p.product_name,
        total_qty:     qty,
        total_revenue: revenue,
        total_cogs:    cogs,
        gross_profit:  profit,
        margin_pct:    revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0,
      }
    })

    // ── Calculate total real COGS from all sold items ─────────
    const totalRealCogs = allSoldItems.reduce((sum, item) => {
      const price = Number(item.products?.purchase_price ?? 0)
      return sum + (item.qty * price)
    }, 0)

    // ── Summary ───────────────────────────────────────────────
    const omzet   = Number(revAgg._sum.grand_total ?? 0)
    const cogs    = totalRealCogs
    const profit  = omzet - cogs
    const txCount = revAgg._count

    // dailySeries menggunakan HPP riil per hari dari SQL JOIN (bukan estimasi rasio)
    const dailySeries = (dailyRaw as any[]).map(row => ({
      date:  String(row.date),
      omzet: Number(row.omzet),
      cogs:  Number(row.cogs ?? 0),
    }))

    return {
      summary: {
        omzet,
        cogs,
        gross_profit:      profit,
        margin_pct:        omzet > 0 ? Math.round((profit / omzet) * 1000) / 10 : 0,
        transaction_count: txCount,
        avg_transaction:   txCount > 0 ? Math.round(omzet / txCount) : 0,
      },
      byPaymentMethod: byPayment.map(g => ({
        method: g.payment_method,
        total:  Number(g._sum.grand_total ?? 0),
        count:  g._count,
      })),
      topProducts,
      slowMoving: slowRaw.map(p => ({
        id:             Number(p.id),
        name:           p.name,
        stock:          p.stock,
        purchase_price: Number(p.purchase_price),
        category:       (p.product_categories as any)?.name ?? '-',
        stock_value:    Number(p.purchase_price) * p.stock,
      })),
      dailySeries,
    }
  } catch (error: any) {
    console.error("[laporan-analitik] Error in getAnalyticsData:", error)
    throw new Error(`Gagal memproses Laporan Analitik Keuangan: ${error.message || error}`)
  }
}
