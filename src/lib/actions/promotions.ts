"use server";

import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/actions/log-audit";

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

export async function getPromotions(): Promise<Promotion[]> {
  try {
    const promotions = await (prisma as any).promotions?.findMany({
      orderBy: { sort_order: 'asc' },
    });

    return promotions?.map((p: any) => ({
      ...p,
      id: Number(p.id),
      is_active: Boolean(p.is_active),
    })) || [];
  } catch (error) {
    console.error("Error fetching promotions:", error);
    return [];
  }
}

export async function createPromotion(data: Omit<Promotion, 'id' | 'created_at' | 'updated_at'>): Promise<Promotion | null> {
  try {
    const promotion = await (prisma as any).promotions.create({
      data: { ...data, updated_at: new Date() },
    });

    await logAudit({
      action: "CREATE",
      modelType: "promotions",
      modelId: Number(promotion.id),
      newValues: { title: data.title, is_active: data.is_active, link_url: data.link_url },
    });

    revalidatePath('/pengaturan/promosi');
    return { ...promotion, id: Number(promotion.id) };
  } catch (error) {
    console.error("Error creating promotion:", error);
    return null;
  }
}

export async function updatePromotion(id: number, data: Partial<Omit<Promotion, 'id' | 'created_at' | 'updated_at'>>): Promise<Promotion | null> {
  try {
    const promotion = await (prisma as any).promotions.update({
      where: { id: BigInt(id) },
      data: { ...data, updated_at: new Date() },
    });

    await logAudit({
      action: "UPDATE",
      modelType: "promotions",
      modelId: id,
      newValues: { title: data.title, is_active: data.is_active } as Record<string, unknown>,
    });

    revalidatePath('/pengaturan/promosi');
    return { ...promotion, id: Number(promotion.id) };
  } catch (error) {
    console.error("Error updating promotion:", error);
    return null;
  }
}

export async function deletePromotion(id: number): Promise<boolean> {
  try {
    await (prisma as any).promotions.delete({ where: { id: BigInt(id) } });

    await logAudit({
      action: "DELETE",
      modelType: "promotions",
      modelId: id,
      oldValues: { id },
    });

    revalidatePath('/pengaturan/promosi');
    return true;
  } catch (error) {
    console.error("Error deleting promotion:", error);
    return false;
  }
}