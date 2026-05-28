'use server'

import { prisma } from '@/lib/db/prisma'

export type TransaksiKasirRow = {
  no:           number
  tanggal:      string   // 01-Apr-26
  minggu:       string   // M1, M2, M3, M4, M5
  bayar:        string   // CAS, PAY, QRS, TRF, SDP
  nik:          string
  nama_anggota: string
  nama_barang:  string
  qty:          number
  harga_jual:   number
  tot_harga_jual: number
  harga_pokok:  number
  tot_harga_pokok: number
  laba:         number
  category_slug?: string
  unit_code?:     string
}

const PAYMENT_ABBREV: Record<string, string> = {
  cash:          'CAS',
  paylater:      'PAY',
  qris:          'QRS',
  transfer:      'TRF',
  saving_deduct: 'SDP',
}

function getWeekLabel(date: Date): string {
  const day = date.getDate()
  if (day <= 7)  return 'M1'
  if (day <= 14) return 'M2'
  if (day <= 21) return 'M3'
  if (day <= 28) return 'M4'
  return 'M5'
}

function formatTanggal(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    day:   '2-digit',
    month: 'short',
    year:  '2-digit',
  }).replace(/ /g, '-')
}

/**
 * Fetch detailed per-item transaction data for the Kasir Excel report.
 * Matches the format: NO | TANGGAL | MINGGU | BAYAR | NIK | NAMA ANGGOTA | NAMA BARANG | QTY | HARGA JUAL | TOT HARGA JUAL | HARGA POKOK | TOT HARGA POKOK | LABA
 */
export async function getTransaksiKasirDetail(params: {
  startDate:     string
  endDate:       string
  paymentMethod?: string
}): Promise<TransaksiKasirRow[]> {
  try {
    const start = new Date(params.startDate)
    const end   = new Date(params.endDate)
    end.setHours(23, 59, 59, 999)

    const paymentMethodEnum = params.paymentMethod && params.paymentMethod !== 'all'
      ? (params.paymentMethod as any)
      : undefined

    const orders = await prisma.orders.findMany({
      where: {
        payment_status: 'paid',
        OR: [
          { paid_at:  { gte: start, lte: end } },
          { paid_at:  null, ordered_at: { gte: start, lte: end } },
        ],
        payment_method: paymentMethodEnum,
      },
      include: {
        order_items: {
          include: {
            products: {
              select: {
                product_categories: {
                  select: { slug: true }
                }
              }
            },
          },
        },
        members: {
          select: {
            nik: true,
            full_name: true,
            units: {
              select: { code: true }
            }
          }
        },
      },
      orderBy: { ordered_at: 'asc' },
    })

    const rows: TransaksiKasirRow[] = []
    let no = 1

    for (const order of orders) {
      const txDate     = (order.paid_at ?? order.ordered_at) as Date
      const tanggal    = formatTanggal(txDate)
      const minggu     = getWeekLabel(txDate)
      const bayar      = PAYMENT_ABBREV[order.payment_method] ?? order.payment_method.toUpperCase().slice(0, 3)
      const nik        = order.members?.nik ?? 'ALL'
      const namaAnggota = order.members?.full_name ?? 'COSTUMER'
      const unitCode   = order.members?.units?.code ?? 'U-001'

      for (const item of order.order_items) {
        const hargaJual    = Number(item.unit_price ?? 0)
        const totHargaJual = Number(item.subtotal ?? 0)
        const hpp          = Number(item.purchase_price ?? 0)
        const totHpp       = hpp * item.qty
        const laba         = totHargaJual - totHpp
        const categorySlug = (item.products as any)?.product_categories?.slug ?? 'umum'

        rows.push({
          no,
          tanggal,
          minggu,
          bayar,
          nik,
          nama_anggota:    namaAnggota,
          nama_barang:     item.product_name,
          qty:             item.qty,
          harga_jual:      hargaJual,
          tot_harga_jual:  totHargaJual,
          harga_pokok:     hpp,
          tot_harga_pokok: totHpp,
          laba,
          category_slug:   categorySlug,
          unit_code:       unitCode,
        })
        no++
      }
    }

    return rows
  } catch (error) {
    console.error('[getTransaksiKasirDetail]', error)
    return []
  }
}
