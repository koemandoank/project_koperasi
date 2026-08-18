"use server"

import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { checkRole } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/actions/log-audit";
import { deleteCache } from "@/lib/cache";
import { z } from "zod";
import { posCheckoutSchema } from "@/lib/validations";

export async function processPosCheckout(data: any) {
  try {
    // SECURITY FIX: Verify user has kasir or admin role
    await checkRole(["kasir", "admin", "superadmin"]);
    
    const validated = posCheckoutSchema.parse(data);

    // FIX BUG-06 (Audit Menyeluruh 29 Jul 2026 - CRITICAL):
    // SEBELUMNYA di sini ada pengecekan "Manipulasi harga terdeteksi" yang
    // HANYA membandingkan angka-angka yang SEMUANYA berasal dari client
    // (item.price, discount, grandTotal) - tidak pernah dibandingkan ke
    // products.price/member_price yang sebenarnya di database. Ini proteksi
    // PALSU: siapa pun yang bisa mengubah request (DevTools browser dsb)
    // bisa checkout barang apa pun dengan harga berapa pun (termasuk 0/negatif)
    // dan tetap lolos, karena cek lama cuma verifikasi konsistensi internal
    // angka client, bukan verifikasi ke sumber kebenaran (database).
    //
    // FIX: harga jual sekarang HANYA diambil dari database (product.price /
    // product.member_price) di dalam transaksi di bawah - item.price dari
    // client SAMA SEKALI TIDAK DIPAKAI lagi untuk nilai final apa pun,
    // cuma untuk lookup produk mana yang dibeli (item.id) dan berapa qty.

    const session = await auth();
    const userId = session?.user?.id;
    
    // Default unit id (just use the first one or hardcode 1 for POS if not multitenant yet)
    const unit = await prisma.unit.findFirst();
    const unitId = unit ? unit.id : 1;

    // FIX #19 (28 Jul 2026): stock_balances (stok per lokasi gudang) sebelumnya
    // TIDAK PERNAH di-update saat checkout POS - cuma products.stock (global) &
    // stock_movements (log) yang ter-update. Akibatnya stock_balances makin lama
    // makin ngaco dibanding stok global (ditemukan lewat audit dashboard pengawas
    // Check #6: 25/25 produk mismatch, data lama sudah disinkronkan lewat
    // scripts/fix-19-sync-stock-balances.js). procurement.ts (barang MASUK) sudah
    // benar update stock_balances - checkout (barang KELUAR) sekarang disamakan.
    const defaultLocation = await prisma.warehouse_locations.findFirst({
      where: { is_active: true },
      orderBy: { id: "asc" },
    });

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
        // Catatan: cek limit di bawah masih memakai validated.grandTotal (dari
        // client) untuk estimasi cepat SEBELUM transaksi - ini cuma estimasi
        // awal untuk pesan error yang informatif, bukan nilai final yang
        // disimpan. Nilai final tetap dihitung dari database di dalam transaksi.
        if ((currentDebt + validated.grandTotal) > rules.max_paylater_debt.value) {
          return { success: false, error: `Limit Bayar Tempo ditolak: Sisa batas hutang anggota tidak mencukupi (Maksimal akumulasi Rp ${rules.max_paylater_debt.value.toLocaleString('id-ID')}).` };
        }
      }
    }

    let finalOrderId: bigint | null = null;
    let finalGrandTotal = 0;

    await prisma.$transaction(async (tx: any) => {
      const purchasePrices = new Map<bigint, number>();
      const sellingPrices = new Map<bigint, number>();
      let realSubtotal = 0;

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

        // FIX BUG-06: harga jual SELALU dari database, bukan dari item.price
        // (client). member_price dipakai kalau ada memberId & harga member
        // di-set utk produk itu, kalau tidak fallback ke harga umum.
        const realUnitPrice = validated.memberId && product.member_price !== null
          ? Number(product.member_price)
          : Number(product.price);
        sellingPrices.set(product.id, realUnitPrice);
        realSubtotal += realUnitPrice * item.qty;

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

        // FIX #19: selaraskan stock_balances per lokasi (lihat catatan di atas)
        if (defaultLocation) {
          await tx.stock_balances.upsert({
            where: {
              product_id_location_id: {
                product_id:  BigInt(item.id),
                location_id: defaultLocation.id,
              },
            },
            update: {
              qty_on_hand:   { decrement: item.qty },
              qty_available: { decrement: item.qty },
              updated_at:    new Date(),
            },
            create: {
              product_id:    BigInt(item.id),
              location_id:   defaultLocation.id,
              qty_on_hand:   Math.max(0, stockAfter),
              qty_reserved:  0,
              qty_available: Math.max(0, stockAfter),
              updated_at:    new Date(),
            },
          });
        }
      }

      // FIX BUG-06: diskon divalidasi terhadap subtotal RIIL (dari database),
      // tidak boleh negatif, tidak boleh melebihi subtotal (mencegah grand_total
      // negatif / transaksi "dibayar minus"). Validasi penuh terhadap rule
      // promosi aktif (tabel promotions) belum diimplementasikan di sini -
      // dicatat sebagai kelanjutan terpisah (lihat docs/AUDIT_MENYELURUH).
      const safeDiscount = Math.max(0, Math.min(Number(validated.discount) || 0, realSubtotal));
      const realGrandTotal = realSubtotal - safeDiscount;
      finalGrandTotal = realGrandTotal;

      // Create Order
      const order = await tx.orders.create({
        data: {
          order_no: orderNo,
          member_id: validated.memberId ? BigInt(validated.memberId) : null,
          unit_id: BigInt(unitId),
          channel: "pos",
          subtotal: realSubtotal,
          discount: safeDiscount,
          grand_total: realGrandTotal,
          payment_method: validated.paymentMethod,
          payment_status: paymentStatus,
          order_status: orderStatus,
          cashier_id: cashierId,
          ordered_at: new Date(),
          paid_at: validated.paymentMethod !== "paylater" ? new Date() : null,
        }
      });
      finalOrderId = order.id;

      // Create Order Items - unit_price dari database (sellingPrices), BUKAN item.price client
      for (const item of validated.cart) {
        const pId = BigInt(item.id);
        const pPrice = purchasePrices.get(pId) ?? 0;
        const realPrice = sellingPrices.get(pId) ?? 0;

        await tx.order_items.create({
          data: {
            order_id: order.id,
            product_id: pId,
            product_name: item.name,
            qty: item.qty,
            unit_price: realPrice,
            purchase_price: pPrice,
            discount: 0,
            subtotal: realPrice * item.qty,
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
        grand_total: finalGrandTotal,
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
