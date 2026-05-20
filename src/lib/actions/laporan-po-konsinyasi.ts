'use server'

import { prisma } from '@/lib/db/prisma'
import { verifySessionAndRole } from '@/lib/auth-helpers'

export interface POReportFilter {
  dateFrom?: string
  dateTo?: string
  supplierId?: number
  productId?: number
  status?: string
}

export interface ConsignmentReportFilter {
  dateFrom?: string
  dateTo?: string
  supplierId?: number
  productId?: number
  status?: string
}

/**
 * Ambil laporan Purchase Order dengan filter lengkap.
 */
export async function getPOReport(filter: POReportFilter = {}) {
  await verifySessionAndRole(['superadmin', 'admin', 'pengurus'])

  const dateFrom = filter.dateFrom ? new Date(filter.dateFrom + 'T00:00:00') : undefined
  const dateTo   = filter.dateTo   ? new Date(filter.dateTo   + 'T23:59:59') : undefined

  const orders = await prisma.purchase_orders.findMany({
    where: {
      ...(dateFrom && dateTo && { po_date: { gte: dateFrom, lte: dateTo } }),
      ...(filter.supplierId && { supplier_id: BigInt(filter.supplierId) }),
      ...(filter.status && { status: filter.status as any }),
      ...(filter.productId && {
        po_items: { some: { product_id: BigInt(filter.productId) } }
      }),
    },
    include: {
      suppliers: { select: { supplier_name: true } },
      po_items: {
        include: { products: { select: { id: true, name: true, sku: true } } }
      },
      good_receipts: {
        select: { id: true, gr_no: true, status: true, gr_date: true }
      },
    },
    orderBy: { po_date: 'desc' },
  })

  return orders.map(o => ({
    id: Number(o.id),
    po_no: o.po_no,
    po_date: o.po_date.toISOString().split('T')[0],
    supplier_name: o.suppliers?.supplier_name ?? '-',
    status: o.status,
    total_amount: Number(o.total_amount),
    items: o.po_items.map(i => ({
      id: Number(i.id),
      product_id: Number(i.product_id),
      product_name: i.products?.name ?? '-',
      product_sku: i.products?.sku ?? '-',
      qty_ordered: i.qty_ordered,
      qty_received: i.qty_received,
      unit_price: Number(i.unit_price),
      total_price: Number(i.line_total),
    })),
    good_receipts: o.good_receipts.map(gr => ({
      id: Number(gr.id),
      gr_no: gr.gr_no,
      gr_date: gr.gr_date.toISOString().split('T')[0],
      status: gr.status,
    })),
  }))
}

/**
 * Ambil laporan Konsinyasi dengan filter lengkap.
 */
export async function getConsignmentReport(filter: ConsignmentReportFilter = {}) {
  await verifySessionAndRole(['superadmin', 'admin', 'pengurus'])

  const dateFrom = filter.dateFrom ? new Date(filter.dateFrom + 'T00:00:00') : undefined
  const dateTo   = filter.dateTo   ? new Date(filter.dateTo   + 'T23:59:59') : undefined

  const items = await prisma.consignment_items.findMany({
    where: {
      ...(dateFrom && dateTo && { consignment_date: { gte: dateFrom, lte: dateTo } }),
      ...(filter.supplierId && { supplier_id: BigInt(filter.supplierId) }),
      ...(filter.productId && { product_id: BigInt(filter.productId) }),
      ...(filter.status && { status: filter.status as any }),
    },
    include: {
      products: { select: { id: true, name: true, sku: true, price: true, purchase_price: true, stock: true } },
      suppliers: { select: { supplier_name: true } },
      payables: {
        select: { id: true, unit_price: true, total_amount: true, status: true }
      },
    },
    orderBy: { consignment_date: 'desc' },
  })

  return items.map(i => {
    const qty_received = i.qty_received
    const qty_returned = i.qty_returned
    const actual_stock = i.products ? Number(i.products.stock) : 0
    const qty_sold = Math.max(0, qty_received - qty_returned - actual_stock)
    const unit_price = i.products ? Number(i.products.purchase_price) : 0
    const sell_price = i.products ? Number(i.products.price) : 0

    return {
      id: Number(i.id),
      consignment_date: new Date(i.consignment_date).toISOString().split('T')[0],
      product_id: Number(i.product_id),
      product_name: i.products?.name ?? '-',
      product_sku: i.products?.sku ?? '-',
      supplier_name: i.suppliers?.supplier_name ?? '-',
      qty_received,
      qty_sold,
      qty_returned,
      qty_remaining: actual_stock,
      unit_price,
      sell_price,
      total_sold_value: qty_sold * sell_price,
      total_payable: qty_sold * unit_price,
      margin: qty_sold * (sell_price - unit_price),
      status: i.status,
      return_reason: i.return_reason ?? null,
      return_date: i.return_date ? i.return_date.toISOString().split('T')[0] : null,
    }
  })
}

/**
 * Ambil daftar supplier untuk dropdown filter.
 */
export async function getSuppliersForFilter() {
  const suppliers = await prisma.suppliers.findMany({
    where: { is_active: true },
    select: { id: true, supplier_name: true },
    orderBy: { supplier_name: 'asc' },
  })
  return suppliers.map(s => ({ id: Number(s.id), supplier_name: s.supplier_name }))
}

/**
 * Ambil daftar produk untuk dropdown filter.
 */
export async function getProductsForFilter() {
  const products = await prisma.products.findMany({
    where: { is_active: true },
    select: { id: true, name: true, sku: true },
    orderBy: { name: 'asc' },
  })
  return products.map(p => ({ id: Number(p.id), name: p.name, sku: p.sku }))
}
