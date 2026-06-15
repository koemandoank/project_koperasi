"use server"

import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/actions/log-audit";
import { verifySessionAndRole } from "@/lib/auth-helpers";
import { remember, deleteCache } from "@/lib/cache";
import { calculatePagination, getPaginationMeta } from "@/lib/utils/pagination";
import { z } from "zod";
import { productCreateSchema, productUpdateSchema } from "@/lib/validations";

/** Role yang boleh memodifikasi katalog produk */
const PRODUCT_ADMIN_ROLES = ["superadmin", "admin", "pengurus"] as const;

export async function getProducts(): Promise<Array<{
  id: number;
  sku: string;
  name: string;
  purchase_price: number;
  price: number;
  member_price: number | null;
  stock: number;
  min_stock: number;
  unit_measure: string;
  category_id: number;
  category_name: string;
  unit_id: number;
  unit_name: string;
  is_active: boolean;
  image_path: string | null;
}>>;
export async function getProducts(
  page: number,
  pageSize: number
): Promise<{
  data: Array<{
    id: number;
    sku: string;
    name: string;
    purchase_price: number;
    price: number;
    member_price: number | null;
    stock: number;
    min_stock: number;
    unit_measure: string;
    category_id: number;
    category_name: string;
    unit_id: number;
    unit_name: string;
    is_active: boolean;
    image_path: string | null;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pages: number;
    hasMore: boolean;
  };
}>;
export async function getProducts(page?: number, pageSize?: number): Promise<any> {
  try {
    const isPaginated = page !== undefined && pageSize !== undefined;

    if (isPaginated) {
      const { skip, take } = calculatePagination(page, pageSize);

      const [products, total] = await Promise.all([
        prisma.products.findMany({
          include: {
            product_categories: true,
            units: true
          },
          orderBy: { created_at: "desc" },
          skip,
          take,
        }),
        prisma.products.count(),
      ]);

      const data = products.map((p: any) => ({
        id: Number(p.id),
        sku: p.sku,
        name: p.name,
        purchase_price: Number(p.purchase_price),
        price: Number(p.price),
        member_price: p.member_price ? Number(p.member_price) : null,
        stock: p.stock,
        min_stock: p.min_stock ?? 0,
        unit_measure: p.unit_measure,
        category_id: Number(p.category_id),
        category_name: p.product_categories?.name || "-",
        unit_id: Number(p.unit_id),
        unit_name: p.units?.name || "-",
        is_active: p.is_active,
        image_path: p.image_path || null,
      }));

      return {
        data,
        pagination: getPaginationMeta(total, page, pageSize),
      };
    } else {
      return remember("products:all", 3600, async () => {
        const products = await prisma.products.findMany({
          include: {
            product_categories: true,
            units: true
          },
          orderBy: { created_at: "desc" }
        });

        return products.map((p: any) => ({
          id: Number(p.id),
          sku: p.sku,
          name: p.name,
          purchase_price: Number(p.purchase_price),
          price: Number(p.price),
          member_price: p.member_price ? Number(p.member_price) : null,
          stock: p.stock,
          min_stock: p.min_stock ?? 0,
          unit_measure: p.unit_measure,
          category_id: Number(p.category_id),
          category_name: p.product_categories?.name || "-",
          unit_id: Number(p.unit_id),
          unit_name: p.units?.name || "-",
          is_active: p.is_active,
          image_path: p.image_path || null,
        }));
      });
    }
  } catch (error) {
    console.error("Get products error:", error);
    if (page !== undefined && pageSize !== undefined) {
      return {
        data: [],
        pagination: getPaginationMeta(0, page, pageSize),
      };
    }
    return [];
  }
}

export async function getCategories() {
  return remember("products:categories", 3600, async () => {
    try {
      const categories = await prisma.product_categories.findMany({
        where: { is_active: true }
      });
      return categories.map((c: any) => ({ id: Number(c.id), name: c.name }));
    } catch {
      return [];
    }
  });
}

export async function createProduct(data: any) {
  try {
    await verifySessionAndRole([...PRODUCT_ADMIN_ROLES]);
    const validated = productCreateSchema.parse(data);
    
    let sku = validated.sku;
    if (!sku) {
      const count = await prisma.products.count();
      sku = `BRG-${String(count + 1).padStart(5, '0')}`;
    }

    const created = await prisma.products.create({
      data: {
        sku,
        name: validated.name,
        purchase_price: validated.purchase_price || 0,
        price: validated.price || 0,
        member_price: validated.member_price || null,
        stock: validated.stock || 0,
        min_stock: validated.min_stock || 0,
        unit_measure: validated.unit_measure || 'pcs',
        category_id: BigInt(validated.category_id),
        unit_id: BigInt(validated.unit_id),
        image_path: validated.image_path || null,
        is_active: true
      }
    });

    await logAudit({
      action: "CREATE",
      modelType: "products",
      modelId: Number(created.id),
      newValues: { sku, name: validated.name, price: validated.price, purchase_price: validated.purchase_price, stock: validated.stock || 0 },
    });

    await deleteCache(["products:all", "products:categories", "stats:admin", "stats:kasir"]);
    revalidatePath("/toko/produk");
    return { success: true };
  } catch (error: any) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message };
    }
    if (error.code === 'P2002') return { success: false, error: "SKU Barang sudah digunakan." };
    return { success: false, error: "Gagal menambahkan produk." };
  }
}

export async function updateProduct(id: number, data: any) {
  try {
    await verifySessionAndRole([...PRODUCT_ADMIN_ROLES]);
    const validated = productUpdateSchema.parse(data);

    const old = await prisma.products.findUnique({
      where: { id: BigInt(id) },
      select: { sku: true, name: true, price: true, purchase_price: true, stock: true, is_active: true }
    });

    await prisma.products.update({
      where: { id: BigInt(id) },
      data: {
        sku: validated.sku,
        name: validated.name,
        purchase_price: validated.purchase_price,
        price: validated.price,
        member_price: validated.member_price,
        stock: validated.stock,
        min_stock: validated.min_stock,
        unit_measure: validated.unit_measure,
        category_id: validated.category_id !== undefined ? BigInt(validated.category_id) : undefined,
        unit_id: validated.unit_id !== undefined ? BigInt(validated.unit_id) : undefined,
        image_path: validated.image_path !== undefined ? (validated.image_path || null) : undefined,
      }
    });

    await logAudit({
      action: "UPDATE",
      modelType: "products",
      modelId: id,
      oldValues: old ? { sku: old.sku, name: old.name, price: Number(old.price), purchase_price: Number(old.purchase_price), stock: old.stock } : null,
      newValues: { sku: validated.sku, name: validated.name, price: validated.price, purchase_price: validated.purchase_price, stock: validated.stock },
    });

    await deleteCache(["products:all", "products:categories", "stats:admin", "stats:kasir"]);
    revalidatePath("/toko/produk");
    return { success: true };
  } catch (error: any) {
    console.error("updateProduct error:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message };
    }
    return { success: false, error: "Gagal mengupdate produk." };
  }
}

export async function deleteProduct(id: number) {
  try {
    await verifySessionAndRole([...PRODUCT_ADMIN_ROLES]);
    const old = await prisma.products.findUnique({
      where: { id: BigInt(id) },
      select: { sku: true, name: true, price: true, stock: true }
    });

    await prisma.products.delete({ where: { id: BigInt(id) } });

    await logAudit({
      action: "DELETE",
      modelType: "products",
      modelId: id,
      oldValues: old ? { sku: old.sku, name: old.name, price: Number(old.price), stock: old.stock } : null,
    });

    await deleteCache(["products:all", "products:categories", "stats:admin", "stats:kasir"]);
    revalidatePath("/toko/produk");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Gagal menghapus produk. Barang mungkin sudah masuk histori transaksi." };
  }
}
