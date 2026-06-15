"use server"

import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { logAudit } from "@/lib/actions/log-audit";
import { deleteCache } from "@/lib/cache";
import { z } from "zod";
import { posCheckoutSchema } from "@/lib/validations";

export async function processPosCheckout(data: any) {
  try {
    const validated = posCheckoutSchema.parse(data);
    const calculatedGrandTotal = validated.cart.reduce((sum: any, item: any) => sum + (item.price * item.qty), 0) - validated.discount;
    if (validated.grandTotal !== calculatedGrandTotal) {
      throw new Error("Manipulasi harga terdeteksi.");
    }
    const session = await auth();
    const userId = session?.user?.id;
    
    // Default unit id (just use the first one or hardcode 1 for POS if not multitenant yet)
    const unit = await prisma.unit.findFirst();
    const unitId = unit ? unit.id : 1;

    // Fetch user for cashier
    let cashierId = null;
    if (userId) {
      const u = await prisma.user.findUnique({ where: { id: BigInt(userId) }});
      if (u) cashierId = u.id;
    }

    // Generate Order No
    const count = await prisma.orders.count();
    const orderNo = `INV-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(count + 1).padStart(4, '0')}`;

    const orderStatus = "confirmed";
    const paymentStatus = validated.paymentMethod === "paylater" ? "unpaid" : "paid";

    /**
     * PENTING: Rule paylater limit hanya dicek di sini (transaksi BARU).
     * Order paylater yang sudah dibuat dan belum dibayar TIDAK dibatalkan
     * ketika rule dinonaktifkan atau limit diubah oleh admin.
     */
    if (validated.paymentMethod === "paylater") {
      if (!validated.memberId) {
        return { success: false, error: "Transaksi Bayar Tempo wajib memilih anggota pembeli." };
      }
      
      const { getLoanRules } = await import('./loan-rules');
      const rules = await getLoanRules();
      
      if (rules.max_paylater_debt?.enabled) {
        const existingPaylater = await prisma.orders.aggregate({
          where: {
            member_id: BigInt(validated.memberId),
            payment_method: "paylater",
            payment_status: "unpaid",
            order_status: { not: "cancelled" }
          },
          _sum: { grand_total: true }
        });
        
        const currentDebt = Number(existingPaylater._sum.grand_total || 0);
        if ((currentDebt + validated.grandTotal) > rules.max_paylater_debt.value) {
          return { success: false, error: `Limit Bayar Tempo ditolak: Sisa batas hutang anggota tidak mencukupi (Maksimal akumulasi Rp ${rules.max_paylater_debt.value.toLocaleString('id-ID')}).` };
        }
      }
    }

    await prisma.$transaction(async (tx: any) => {
      const purchasePrices = new Map<bigint, number>();

      // Paylater limit is checked dynamically above, no separate field is updated here.
      // Validate stock atomically before committing the order
      for (const item of validated.cart) {
        // Fetch current stock before updates for logging card
        const product = await tx.products.findUnique({
          where: { id: BigInt(item.id) }
        });
        if (!product) {
          throw new Error(`Produk ${item.name} tidak ditemukan.`);
        }

        // Simpan harga pokok (purchase_price) historis saat transaksi dilakukan
        purchasePrices.set(product.id, Number(product.purchase_price));

        const stockBefore = product.stock;
        if (stockBefore < item.qty) {
          throw new Error(`Stok untuk produk ${item.name} tidak mencukupi.`);
        }

        const updated = await tx.products.updateMany({
          where: {
            id: BigInt(item.id),
            stock: { gte: item.qty }
          },
          data: {
            stock: { decrement: item.qty }
          }
        });
        if (updated.count === 0) {
          throw new Error(`Stok untuk produk ${item.name} tidak mencukupi atau barang tidak ditemukan.`);
        }

        const stockAfter = stockBefore - item.qty;

        // Log the stock movement as 'out'
        await tx.stock_movements.create({
          data: {
            product_id:   BigInt(item.id),
            type:         "out",
            qty:          item.qty,
            stock_before: stockBefore,
            stock_after:  stockAfter,
            reference:    orderNo,
            note:         "Penjualan POS",
            created_by:   cashierId,
            created_at:   new Date(),
          }
        });
      }

      // Create Order
      const order = await tx.orders.create({
        data: {
          order_no: orderNo,
          member_id: validated.memberId ? BigInt(validated.memberId) : null,
          unit_id: BigInt(unitId),
          channel: "pos",
          subtotal: validated.subtotal,
          discount: validated.discount,
          grand_total: validated.grandTotal,
          payment_method: validated.paymentMethod,
          payment_status: paymentStatus,
          order_status: orderStatus,
          cashier_id: cashierId,
          ordered_at: new Date(),
          paid_at: validated.paymentMethod !== "paylater" ? new Date() : null,
        }
      });

      // Create Order Items
      for (const item of validated.cart) {
        const pId = BigInt(item.id);
        const pPrice = purchasePrices.get(pId) ?? 0;

        await tx.order_items.create({
          data: {
            order_id: order.id,
            product_id: pId,
            product_name: item.name,
            qty: item.qty,
            unit_price: item.price,
            purchase_price: pPrice,
            discount: 0,
            subtotal: item.price * item.qty,
          }
        });
      }
    });

    await deleteCache(["products:all", "stats:kasir", "stats:admin"]);
    revalidatePath("/toko/produk");
    revalidatePath("/dashboard");

    await logAudit({
      action: "CREATE",
      modelType: "orders",
      modelId: null,
      newValues: {
        order_no: orderNo,
        payment_method: validated.paymentMethod,
        payment_status: paymentStatus,
        grand_total: validated.grandTotal,
        subtotal: validated.subtotal,
        discount: validated.discount,
        member_id: validated.memberId,
        item_count: validated.cart.length,
      },
    });

    return { success: true, orderNo };
  } catch (error: any) {
    console.error("Checkout Failed:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message };
    }
    return { success: false, error: error.message || "Transaksi gagal diproses. Pastikan stok mencukupi." };
  }
}

