'use server'

import { prisma } from '@/lib/db/prisma'

export type MingguanDayRow = {
  tanggal:    string  // YYYY-MM-DD
  dayName:    string  // Senin, Selasa, ...
  hppCash:    number
  jualCash:   number
  labaCash:   number
  hppKredit:  number
  jualKredit: number
  labaKredit: number
}

export type MingguanResult = {
  rows:         MingguanDayRow[]
  totCashHpp:   number
  totCashJual:  number
  totCashLaba:  number
  totKrdHpp:    number
  totKrdJual:   number
  totKrdLaba:   number
  grandHpp:     number
  grandJual:    number
  grandLaba:    number
}

const DAY_ID = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']
const CASH_METHODS = ['cash', 'qris', 'transfer']

/**
 * Hitung tanggal start & end berdasarkan tahun, bulan (1-12), minggu ke (1-5).
 * Minggu 1 = tgl 1-7, Minggu 2 = tgl 8-14, dst.
 */
function getWeekRange(year: number, month: number, weekOf: number): { start: Date; end: Date } {
  const startDay = (weekOf - 1) * 7 + 1
  const start    = new Date(year, month - 1, startDay, 0, 0, 0, 0)
  const endDay   = Math.min(startDay + 6, new Date(year, month, 0).getDate())
  const end      = new Date(year, month - 1, endDay, 23, 59, 59, 999)
  return { start, end }
}

/**
 * Mengambil data laporan penjualan mingguan per hari, dipisah antara CASH dan KREDIT.
 *
 * @param {object} params Parameter laporan mingguan
 * @param {number} params.year  Tahun laporan
 * @param {number} params.month Bulan laporan (1-12)
 * @param {number} params.weekOf Minggu ke- dalam bulan (1-5)
 * @returns {Promise<MingguanResult>} Hasil agregasi laporan mingguan per hari
 * @throws {Error} Mengembalikan data kosong jika terjadi error database
 */
export async function getLaporanMingguanData(params: {
  year:    number
  month:   number   // 1-12
  weekOf:  number   // 1-5
}): Promise<MingguanResult> {
  const emptyResult: MingguanResult = {
    rows:         [],
    totCashHpp:   0,
    totCashJual:  0,
    totCashLaba:  0,
    totKrdHpp:    0,
    totKrdJual:   0,
    totKrdLaba:   0,
    grandHpp:     0,
    grandJual:    0,
    grandLaba:    0,
  }

  try {
    const { start, end } = getWeekRange(params.year, params.month, params.weekOf)

    // Fetch all paid orders in range with items and products
    const orders = await prisma.orders.findMany({
      where: {
        payment_status: 'paid',
        OR: [
          { paid_at:   { gte: start, lte: end } },
          { paid_at:   null, ordered_at: { gte: start, lte: end } },
        ],
      },
      include: {
        order_items: {
          select: {
            qty: true,
            subtotal: true,
            purchase_price: true,
          },
        },
      },
      orderBy: { ordered_at: 'asc' },
    })

    // Aggregate per day per payment category
    type Acc = { hpp: number; jual: number }
    const cashMap:   Map<string, Acc> = new Map()
    const kreditMap: Map<string, Acc> = new Map()

    for (const order of orders) {
      const txDate   = (order.paid_at ?? order.ordered_at) as Date
      const dateKey  = txDate.toISOString().split('T')[0]  // YYYY-MM-DD
      const isCash   = CASH_METHODS.includes(order.payment_method)
      const map      = isCash ? cashMap : kreditMap

      const prev = map.get(dateKey) ?? { hpp: 0, jual: 0 }
      for (const item of order.order_items) {
        const hpp  = Number(item.purchase_price ?? 0) * item.qty
        const jual = Number(item.subtotal ?? 0)
        prev.hpp  += hpp
        prev.jual += jual
      }
      map.set(dateKey, prev)
    }

    // Build daily rows for every day in range
    const rows: MingguanDayRow[] = []
    const cur = new Date(start)
    while (cur <= end) {
      const key     = cur.toISOString().split('T')[0]
      const cash    = cashMap.get(key)   ?? { hpp: 0, jual: 0 }
      const kredit  = kreditMap.get(key) ?? { hpp: 0, jual: 0 }
      const fmt     = (d: Date) => d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'2-digit' }).replace(/ /g, '-')

      rows.push({
        tanggal:    fmt(cur),
        dayName:    DAY_ID[cur.getDay()],
        hppCash:    cash.hpp,
        jualCash:   cash.jual,
        labaCash:   cash.jual  - cash.hpp,
        hppKredit:  kredit.hpp,
        jualKredit: kredit.jual,
        labaKredit: kredit.jual - kredit.hpp,
      })
      cur.setDate(cur.getDate() + 1)
    }

    const totCashHpp   = rows.reduce((s, r) => s + r.hppCash, 0)
    const totCashJual  = rows.reduce((s, r) => s + r.jualCash, 0)
    const totCashLaba  = totCashJual - totCashHpp
    const totKrdHpp    = rows.reduce((s, r) => s + r.hppKredit, 0)
    const totKrdJual   = rows.reduce((s, r) => s + r.jualKredit, 0)
    const totKrdLaba   = totKrdJual - totKrdHpp
    const grandHpp     = totCashHpp  + totKrdHpp
    const grandJual    = totCashJual + totKrdJual
    const grandLaba    = grandJual   - grandHpp

    return {
      rows,
      totCashHpp, totCashJual, totCashLaba,
      totKrdHpp,  totKrdJual,  totKrdLaba,
      grandHpp,   grandJual,   grandLaba,
    }
  } catch (error) {
    console.error('[getLaporanMingguanData] Error:', error)
    return emptyResult
  }
}

