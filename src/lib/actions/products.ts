"use server"

import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/actions/log-audit";
import { verifySessionAndRole } from "@/lib/auth-helpers";

/** Role yang boleh memodifikasi katalog produk */
const PRODUCT_ADMIN_ROLES = ["superadmin", "admin", "pengurus"] as const;

export async function getProducts() {
  try {
    const products = await prisma.products.findMany({
      include: {
        product_categories: true,
        units: true
      },
      orderBy: { created_at: "desc" }
    });

    return products.map(p => ({
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
  } catch (error) {
    console.error("Get products error:", error);
    return [];
  }
}

export async function getCategories() {
  try {
    const categories = await prisma.product_categories.findMany({
      where: { is_active: true }
    });
    return categories.map(c => ({ id: Number(c.id), name: c.name }));
  } catch {
    return [];
  }
}

export async function createProduct(data: any) {
  try {
    await verifySessionAndRole([...PRODUCT_ADMIN_ROLES]);
    let sku = data.sku;
    if (!sku) {
      const count = await prisma.products.count();
      sku = `BRG-${String(count + 1).padStart(5, '0')}`;
    }

    const created = await prisma.products.create({
      data: {
        sku,
        name: data.name,
        purchase_price: data.purchase_price || 0,
        price: data.price || 0,
        member_price: data.member_price || null,
        stock: parseInt(data.stock) || 0,
        unit_measure: data.unit_measure || 'pcs',
        category_id: BigInt(data.category_id),
        unit_id: BigInt(data.unit_id),
        image_path: data.image_path || null,
        is_active: true
      }
    });

    await logAudit({
      action: "CREATE",
      modelType: "products",
      modelId: Number(created.id),
      newValues: { sku, name: data.name, price: data.price, purchase_price: data.purchase_price, stock: parseInt(data.stock) || 0 },
    });

    revalidatePath("/toko/produk");
    return { success: true };
  } catch (error: any) {
    console.error(error);
    if (error.code === 'P2002') return { success: false, error: "SKU Barang sudah digunakan." };
    return { success: false, error: "Gagal menambahkan produk." };
  }
}

export async function updateProduct(id: number, data: any) {
  try {
    await verifySessionAndRole([...PRODUCT_ADMIN_ROLES]);
    const old = await prisma.products.findUnique({
      where: { id: BigInt(id) },
      select: { sku: true, name: true, price: true, purchase_price: true, stock: true, is_active: true }
    });

    await prisma.products.update({
      where: { id: BigInt(id) },
      data: {
        sku: data.sku,
        name: data.name,
        purchase_price: data.purchase_price || 0,
        price: data.price || 0,
        member_price: data.member_price || null,
        stock: parseInt(data.stock) || 0,
        unit_measure: data.unit_measure || 'pcs',
        category_id: BigInt(data.category_id),
        unit_id: BigInt(data.unit_id),
        ...(data.image_path !== undefined && { image_path: data.image_path || null }),
      }
    });

    await logAudit({
      action: "UPDATE",
      modelType: "products",
      modelId: id,
      oldValues: old ? { sku: old.sku, name: old.name, price: Number(old.price), purchase_price: Number(old.purchase_price), stock: old.stock } : null,
      newValues: { sku: data.sku, name: data.name, price: data.price, purchase_price: data.purchase_price, stock: parseInt(data.stock) || 0 },
    });

    revalidatePath("/toko/produk");
    return { success: true };
  } catch (error) {
    console.error("updateProduct error:", error);
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

    revalidatePath("/toko/produk");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Gagal menghapus produk. Barang mungkin sudah masuk histori transaksi." };
  }
}
