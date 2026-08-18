"use server"

import { prisma } from "@/lib/db/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { checkRole } from "@/lib/auth-helpers"
import { calculatePagination, getPaginationMeta } from "@/lib/utils/pagination"

/**
 * Anggota membuat pesanan online dari portal
 * channel = 'online', order_status = 'pending' (menunggu konfirmasi kasir)
 */
import { z } from "zod"

const OnlineOrderItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  price: z.number().nonnegative(),
  qty: z.number().int().positive("Kuantitas harus lebih dari 0")
})

export async function createOnlineOrder(data: {
  cart: Array<{ id: number; name: string; price: number; qty: number }>
  paymentMethod: "cash" | "paylater" | "qris"
  deliveryType: "pickup" | "delivery"
  deliveryAddress?: string
  note?: string
}) {
  try {
    // SECURITY FIX: Only logged-in members can create online orders
    const session = await auth()
    if (!session?.user?.id) throw new Error('Unauthorized')
    
    // Validasi Zod untuk keranjang mencegah injeksi kuantitas negatif
    const parsedCart = z.array(OnlineOrderItemSchema).parse(data.cart)
    if (!session?.user?.id) return { success: false, error: "Tidak terautentikasi" }

    const user = await prisma.user.findUnique({
      where: { id: BigInt(session.user.id) },
      include: { members: true }
    })
    if (!user?.members) return { success: false, error: "Data anggota tidak ditemukan" }

    const unit = await prisma.unit.findFirst()
    const unitId = unit?.id ?? BigInt(1)
    const count = await prisma.orders.count()
    const orderNo = `ONL-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(count + 1).padStart(4, "0")}`

    // FIX BUG-06 (Audit Menyeluruh 29 Jul 2026 - CRITICAL, sama seperti pos.ts):
    // SEBELUMNYA subtotal/grandTotal/unit_price SEPENUHNYA dari item.price
    // (client) tanpa verifikasi apa pun ke database - bahkan lebih rentan dari
    // pos.ts karena TIDAK ADA pengecekan konsistensi sama sekali. Anggota yang
    // mengubah request bisa checkout produk apa pun dengan harga berapa pun.
    // FIX: harga jual sekarang WAJIB diambil dari products.member_price/price
    // di database (dilakukan di dalam transaksi di bawah), item.price dari
    // client tidak dipakai lagi untuk nilai final apa pun.

    const noteText = [
      data.deliveryType === "delivery" ? `[ANTAR ke: ${data.deliveryAddress || "-"}]` : "[AMBIL SENDIRI / NITIP]",
      data.note || ""
    ].filter(Boolean).join(" | ")

    let finalGrandTotal = 0

    await prisma.$transaction(async (tx: any) => {
      const sellingPrices = new Map<bigint, number>()
      let realSubtotal = 0

      // Ambil harga ASLI dari database utk semua produk di keranjang SEBELUM
      // membuat order, supaya subtotal/grand_total final sudah benar.
      for (const item of parsedCart) {
        const product = await tx.products.findUnique({ where: { id: BigInt(item.id) } })
        if (!product) {
          throw new Error(`Produk "${item.name}" tidak ditemukan.`)
        }
        const realUnitPrice = product.member_price !== null
          ? Number(product.member_price)
          : Number(product.price)
        sellingPrices.set(product.id, realUnitPrice)
        realSubtotal += realUnitPrice * item.qty
      }

      // CHECK PAYLATER LIMIT - pakai realSubtotal (dari DB), bukan dari client
      if (data.paymentMethod === "paylater") {
        const { getLoanRules } = await import('./loan-rules')
        const rules = await getLoanRules()

        if (rules.max_paylater_debt?.enabled) {
          const existingPaylater = await tx.orders.aggregate({
            where: {
              member_id: user.members!.id,
              payment_method: "paylater",
              payment_status: "unpaid",
              order_status: { not: "cancelled" }
            },
            _sum: { grand_total: true }
          })

          const currentDebt = Number(existingPaylater._sum.grand_total || 0)
          if ((currentDebt + realSubtotal) > rules.max_paylater_debt.value) {
            throw new Error(`Limit Bayar Tempo ditolak: Sisa batas hutang Anda tidak mencukupi (Maksimal akumulasi Rp ${rules.max_paylater_debt.value.toLocaleString('id-ID')}).`)
          }
        }
      }

      finalGrandTotal = realSubtotal

      const order = await tx.orders.create({
        data: {
          order_no: orderNo,
          member_id: user.members!.id,
          unit_id: unitId,
          channel: "online",
          subtotal: realSubtotal,
          discount: 0,
          grand_total: realSubtotal,
          payment_method: data.paymentMethod,
          payment_status: data.paymentMethod === "paylater" ? "unpaid" : "unpaid",
          order_status: "pending",
          note: noteText,
          delivery_address: data.deliveryAddress || null,
          ordered_at: new Date(),
        }
      })

      for (const item of parsedCart) {
        const realPrice = sellingPrices.get(BigInt(item.id)) ?? 0

        await tx.order_items.create({
          data: {
            order_id: order.id,
            product_id: BigInt(item.id),
            product_name: item.name,
            qty: item.qty,
            unit_price: realPrice,
            discount: 0,
            subtotal: realPrice * item.qty,
          }
        })
        
        // Atomic Check and Decrement
        const updatedStock = await tx.products.updateMany({
          where: { 
            id: BigInt(item.id),
            stock: { gte: item.qty }
          },
          data: { stock: { decrement: item.qty } }
        })
        
        if (updatedStock.count === 0) {
          throw new Error(`Stok "${item.name}" tidak mencukupi saat proses pembayaran.`);
        }
      }

      // Paylater limit is checked dynamically above, no separate field is updated here.
    })

    revalidatePath("/toko")
    revalidatePath("/toko/pesanan")
    return { success: true, orderNo }
  } catch (error: any) {
    console.error("createOnlineOrder error:", error)
    if (error instanceof z.ZodError) return { success: false, error: "Data keranjang tidak valid." }
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: "Gagal membuat pesanan. Coba lagi." }
  }
}

/** Admin/Kasir: ambil semua pesanan online yg perlu diproses */
export async function getOnlineOrders(status?: string): Promise<any[]>
export async function getOnlineOrders(status: string | undefined, page: number, pageSize: number): Promise<{ data: any[]; pagination: any }>
export async function getOnlineOrders(status?: string, page?: number, pageSize?: number): Promise<any> {
  try {
    const session = await auth()
    if (!session?.user?.id) return page !== undefined ? { data: [], pagination: null } : []
    await checkRole(["superadmin", "admin", "pengurus", "kasir"])

    const where: any = { channel: "online" }
    if (status && status !== "all") where.order_status = status

    const isPaginated = page !== undefined && pageSize !== undefined

    if (isPaginated) {
      const { skip, take } = calculatePagination(page, pageSize)
      const [orders, total] = await Promise.all([
        prisma.orders.findMany({
          where,
          include: { members: true, order_items: true },
          orderBy: { ordered_at: "desc" },
          skip,
          take,
        }),
        prisma.orders.count({ where }),
      ])

      const data = orders.map((o: any) => ({
        id: Number(o.id),
        order_no: o.order_no,
        member_name: o.members?.full_name || "Umum",
        member_phone: o.members?.phone || "-",
        grand_total: Number(o.grand_total),
        payment_method: o.payment_method,
        payment_status: o.payment_status,
        order_status: o.order_status,
        note: o.note || "",
        delivery_address: o.delivery_address || "",
        ordered_at: o.ordered_at.toISOString(),
        item_count: o.order_items.length,
        items: o.order_items.map((i: any) => ({ name: i.product_name, qty: i.qty, subtotal: Number(i.subtotal) }))
      }))

      return { data, pagination: getPaginationMeta(total, page, pageSize) }
    }

    const orders = await prisma.orders.findMany({
      where,
      include: { members: true, order_items: true },
      orderBy: { ordered_at: "desc" }
    })

    return orders.map((o: any) => ({
      id: Number(o.id),
      order_no: o.order_no,
      member_name: o.members?.full_name || "Umum",
      member_phone: o.members?.phone || "-",
      grand_total: Number(o.grand_total),
      payment_method: o.payment_method,
      payment_status: o.payment_status,
      order_status: o.order_status,
      note: o.note || "",
      delivery_address: o.delivery_address || "",
      ordered_at: o.ordered_at.toISOString(),
      item_count: o.order_items.length,
      items: o.order_items.map((i: any) => ({ name: i.product_name, qty: i.qty, subtotal: Number(i.subtotal) }))
    }))
  } catch (error) {
    console.error("getOnlineOrders error:", error)
    return page !== undefined ? { data: [], pagination: null } : []
  }
}

/** Kasir konfirmasi/selesaikan pesanan online */
export async function updateOnlineOrderStatus(
  orderId: number,
  status: "confirmed" | "processing" | "delivered" | "cancelled"
) {
  try {
    // SECURITY FIX: Only kasir/admin can update online order status
    await checkRole(["superadmin", "admin", "pengurus", "kasir"]);
    
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: "Tidak terautentikasi" }

    await prisma.orders.update({
      where: { id: BigInt(orderId) },
      data: {
        order_status: status,
        paid_at: status === "delivered" ? new Date() : undefined,
        payment_status: status === "delivered" ? "paid" : undefined,
      }
    })
    revalidatePath("/toko/pesanan")
    return { success: true }
  } catch (error) {
    console.error("updateOnlineOrderStatus error:", error)
    return { success: false, error: "Gagal update status pesanan" }
  }
}

