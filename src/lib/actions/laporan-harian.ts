"use server"

import { prisma } from "@/lib/db/prisma"
import { auth } from "@/auth"

/** Laporan harian POS - summary transaksi hari ini */
export async function getLaporanHarian(from?: string, to?: string, search?: string) {
  try {
    const now = new Date()
    const startDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), now.getDate())
    startDate.setHours(0, 0, 0, 0)
    
    const endDate = to ? new Date(to) : new Date(now.getFullYear(), now.getMonth(), now.getDate())
    endDate.setHours(23, 59, 59, 999)

    const whereClause: any = {
      ordered_at: { gte: startDate, lte: endDate }
    }
    
    if (search) {
      const q = search.toLowerCase()
      whereClause.members = {
        OR: [
          { full_name: { contains: q } },
          { nik: { contains: q } }
        ]
      }
    }

    const orders = await prisma.orders.findMany({
      where: whereClause,
      include: {
        order_items: true,
        members: true,
      },
      orderBy: { ordered_at: "desc" }
    })

    const totalTransaksi = orders.length
    const totalPendapatan = orders
      .filter((o: any) => o.payment_status === "paid")
      .reduce((sum: any, o: any) => sum + Number(o.grand_total), 0)
    const totalPaylater = orders
      .filter((o: any) => o.payment_method === "paylater")
      .reduce((sum: any, o: any) => sum + Number(o.grand_total), 0)
    const totalTunai = orders
      .filter((o: any) => o.payment_method === "cash")
      .reduce((sum: any, o: any) => sum + Number(o.grand_total), 0)
    const totalQris = orders
      .filter((o: any) => o.payment_method === "qris")
      .reduce((sum: any, o: any) => sum + Number(o.grand_total), 0)

    return {
      tanggal: `${startDate.toISOString().split("T")[0]} - ${endDate.toISOString().split("T")[0]}`,
      totalTransaksi,
      totalPendapatan,
      totalPaylater,
      totalTunai,
      totalQris,
      orders: orders.map((o: any) => ({
        id: Number(o.id),
        order_no: o.order_no,
        member_name: o.members?.full_name || "Umum",
        grand_total: Number(o.grand_total),
        payment_method: o.payment_method,
        payment_status: o.payment_status,
        ordered_at: o.ordered_at.toISOString(),
        item_count: o.order_items.length,
      }))
    }
  } catch (error) {
    console.error("getLaporanHarian error:", error)
    return { tanggal: "", totalTransaksi: 0, totalPendapatan: 0, totalPaylater: 0, totalTunai: 0, totalQris: 0, orders: [] }
  }
}
