"use server";

import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/actions/log-audit";

/**
 * Tipe data Promotion yang mencerminkan kolom tabel `promotions`.
 */
type Promotion = {
  id: number;
  title: string;
  description?: string | null;
  image_url: string;
  link_url?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at?: Date | null;
  updated_at?: Date | null;
};

/** Mapper row dari raw SQL ke tipe Promotion yang aman */
function mapRow(p: any): Promotion {
  return {
    id: Number(p.id),
    title: p.title,
    description: p.description ?? null,
    image_url: p.image_url,
    link_url: p.link_url ?? null,
    is_active: Boolean(p.is_active),
    sort_order: Number(p.sort_order),
    created_at: p.created_at ? new Date(p.created_at) : null,
    updated_at: p.updated_at ? new Date(p.updated_at) : null,
  };
}

/**
 * Mengambil semua data promosi dari database, diurutkan berdasarkan sort_order.
 * Menggunakan raw SQL karena model `promotions` tidak terdaftar di schema.prisma.
 *
 * @returns Promise<Promotion[]>
 */
export async function getPromotions(): Promise<Promotion[]> {
  try {
    const rows = await prisma.$queryRawUnsafe(
      "SELECT * FROM promotions ORDER BY sort_order ASC"
    ) as any[];
    return rows.map(mapRow);
  } catch (error) {
    console.error("Error fetching promotions:", error);
    return [];
  }
}

/**
 * Membuat entri promosi baru di database.
 *
 * @param data - Data promosi tanpa id, created_at, updated_at
 * @returns Promise<Promotion | null>
 */
export async function createPromotion(
  data: Omit<Promotion, "id" | "created_at" | "updated_at">
): Promise<Promotion | null> {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO promotions (title, description, image_url, link_url, is_active, sort_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      data.title,
      data.description ?? null,
      data.image_url,
      data.link_url ?? null,
      data.is_active,
      data.sort_order
    );

    const rows = await prisma.$queryRawUnsafe(
      "SELECT * FROM promotions ORDER BY id DESC LIMIT 1"
    ) as any[];
    const promotion = mapRow(rows[0]);

    await logAudit({
      action: "CREATE",
      modelType: "promotions",
      modelId: promotion.id,
      newValues: { title: data.title, is_active: data.is_active, link_url: data.link_url },
    });

    revalidatePath("/pengaturan/promosi");
    revalidatePath("/dashboard/home");
    return promotion;
  } catch (error) {
    console.error("Error creating promotion:", error);
    return null;
  }
}

/**
 * Memperbarui data promosi yang sudah ada berdasarkan id.
 *
 * @param id - ID promosi yang ingin diupdate
 * @param data - Field yang diupdate (partial)
 * @returns Promise<Promotion | null>
 */
export async function updatePromotion(
  id: number,
  data: Partial<Omit<Promotion, "id" | "created_at" | "updated_at">>
): Promise<Promotion | null> {
  try {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.title !== undefined)       { fields.push(`title = $${paramIndex++}`);       values.push(data.title); }
    if (data.description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(data.description); }
    if (data.image_url !== undefined)   { fields.push(`image_url = $${paramIndex++}`);   values.push(data.image_url); }
    if (data.link_url !== undefined)    { fields.push(`link_url = $${paramIndex++}`);    values.push(data.link_url); }
    if (data.is_active !== undefined)   { fields.push(`is_active = $${paramIndex++}`);   values.push(data.is_active); }
    if (data.sort_order !== undefined)  { fields.push(`sort_order = $${paramIndex++}`);  values.push(data.sort_order); }
    fields.push("updated_at = NOW()");

    if (fields.length === 1) return null; // tidak ada yang diupdate

    values.push(id);
    await prisma.$executeRawUnsafe(
      `UPDATE promotions SET ${fields.join(", ")} WHERE id = $${paramIndex}`,
      ...values
    );

    const rows = await prisma.$queryRawUnsafe(
      "SELECT * FROM promotions WHERE id = $1 LIMIT 1", id
    ) as any[];
    const promotion = mapRow(rows[0]);

    await logAudit({
      action: "UPDATE",
      modelType: "promotions",
      modelId: id,
      newValues: { title: data.title, is_active: data.is_active } as Record<string, unknown>,
    });

    revalidatePath("/pengaturan/promosi");
    revalidatePath("/dashboard/home");
    return promotion;
  } catch (error) {
    console.error("Error updating promotion:", error);
    return null;
  }
}

/**
 * Menghapus data promosi berdasarkan id.
 *
 * @param id - ID promosi yang ingin dihapus
 * @returns Promise<boolean>
 */
export async function deletePromotion(id: number): Promise<boolean> {
  try {
    await prisma.$executeRawUnsafe("DELETE FROM promotions WHERE id = $1", id);

    await logAudit({
      action: "DELETE",
      modelType: "promotions",
      modelId: id,
      oldValues: { id },
    });

    revalidatePath("/pengaturan/promosi");
    revalidatePath("/dashboard/home");
    return true;
  } catch (error) {
    console.error("Error deleting promotion:", error);
    return false;
  }
}