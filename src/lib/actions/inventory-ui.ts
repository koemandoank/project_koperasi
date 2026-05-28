"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

// Helper untuk mendapatkan unit_id anggota yang login.
// Di sistem ini session.user hanya berisi user.id (User.id), jadi kita ambil dari tabel users->members.
async function getLoggedInMemberAndUnit() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
    select: {
      id: true,
      role: true,
      members: {
        select: {
          id: true,
          unit_id: true,
        },
      },
    },
  });

  if (!user?.members) return null;
  return { memberId: user.members.id, unitId: user.members.unit_id };
}

export async function getInventarisReadModels() {
  const ctx = await getLoggedInMemberAndUnit();
  if (!ctx) {
    return { success: false, error: "Unauthorized" } as const;
  }

  const [locations, reorderPoints, balances, products] = await Promise.all([
    prisma.warehouse_locations.findMany({
      where: { unit_id: ctx.unitId, is_active: true },

      orderBy: { location_name: "asc" },
      select: {
        id: true,
        location_code: true,
        location_name: true,
        location_type: true,
        address: true,
      },
    }),
    prisma.stock_reorder_points.findMany({
      where: { is_active: true },
      include: { products: true },
      orderBy: { id: "desc" },
    }),


    prisma.stock_balances.findMany({
      where: {
        // balances table tidak punya unit_id, jadi ambil via join warehouse_locations
        warehouse_locations: {
          unit_id: ctx.unitId,
          is_active: true,
        } as any,
      },
      include: {
        products: true,
        warehouse_locations: true,
      },
      take: 200,
      orderBy: { updated_at: "desc" },
    }),
    prisma.products.findMany({
      where: { unit_id: ctx.unitId, is_active: true, deleted_at: null },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    success: true,
    data: {
      unitId: Number(ctx.unitId),
      products: products.map((p: any) => ({
        id: Number(p.id),
        name: p.name,
        sku: p.sku,
        stock: p.stock,
        purchase_price: Number(p.purchase_price),
        price: Number(p.price),
        unit_measure: p.unit_measure,
      })),
      locations: locations.map((l: any) => ({
        id: Number(l.id),
        location_code: l.location_code,
        location_name: l.location_name,
        location_type: l.location_type,
        address: l.address,
      })),

      /**
       * Serialize reorderPoints: explicitly convert all Decimal/BigInt fields.
       * `r.products` is a raw Prisma object — must not be passed as-is to client.
       */
      reorderPoints: reorderPoints.map((r: any) => ({
        id: Number(r.id),
        product_id: Number(r.product_id),
        reorder_qty: r.reorder_qty ?? 0,
        reorder_point: r.reorder_point ?? 0,
        lead_time_days: r.lead_time_days ?? 0,
        is_active: r.is_active ?? true,
        product: r.products
          ? {
              id: Number(r.products.id),
              name: r.products.name ?? "-",
              sku: r.products.sku ?? "-",
              stock: r.products.stock ?? 0,
              min_stock: r.products.min_stock ?? 0,
              unit_measure: r.products.unit_measure ?? "pcs",
              purchase_price: Number(r.products.purchase_price ?? 0),
              price: Number(r.products.price ?? 0),
              is_active: r.products.is_active ?? true,
            }
          : null,
      })),

      /**
       * Serialize balances: strip spread operator, convert all Decimal/BigInt,
       * and manually serialize nested `products` and `warehouse_locations`.
       */
      balances: balances.map((b: any) => ({
        id: Number(b.id),
        product_id: Number(b.product_id),
        location_id: Number(b.location_id),
        qty_on_hand: b.qty_on_hand ?? 0,
        qty_reserved: b.qty_reserved ?? 0,
        updated_at: b.updated_at?.toISOString() ?? null,
        products: b.products
          ? {
              id: Number(b.products.id),
              name: b.products.name ?? "-",
              sku: b.products.sku ?? "-",
              stock: b.products.stock ?? 0,
              min_stock: b.products.min_stock ?? 0,
              unit_measure: b.products.unit_measure ?? "pcs",
              purchase_price: Number(b.products.purchase_price ?? 0),
              price: Number(b.products.price ?? 0),
              image_path: b.products.image_path ?? null,
            }
          : null,
        warehouse_locations: b.warehouse_locations
          ? {
              id: Number(b.warehouse_locations.id),
              location_name: b.warehouse_locations.location_name ?? "-",
              location_code: b.warehouse_locations.location_code ?? "-",
              location_type: b.warehouse_locations.location_type ?? "-",
            }
          : null,
      })),
    },
  } as const;
}

