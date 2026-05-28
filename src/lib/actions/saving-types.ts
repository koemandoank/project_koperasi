"use server";

import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/actions/log-audit";
import { verifySessionAndRole } from "@/lib/auth-helpers";

export type SavingTypeData = {
  id: number;
  code: string;
  name: string;
  is_mandatory: boolean;
  min_amount: number;
  monthly_amount: number;
  is_withdrawable: boolean;
  description: string | null;
  is_active: boolean;
  member_count: number;
};

/**
 * Ambil semua jenis simpanan beserta jumlah anggota yang terdaftar di dalamnya.
 */
export async function getSavingTypes(): Promise<SavingTypeData[]> {
  try {
    const types = await prisma.saving_types.findMany({
      orderBy: { id: "asc" },
      include: {
        _count: { select: { savings: true } },
      },
    });

    return types.map((t: any) => ({
      id: Number(t.id),
      code: t.code,
      name: t.name,
      is_mandatory: t.is_mandatory,
      min_amount: Number(t.min_amount),
      monthly_amount: Number(t.monthly_amount),
      is_withdrawable: t.is_withdrawable,
      description: t.description,
      is_active: t.is_active,
      member_count: t._count.savings,
    }));
  } catch (error) {
    console.error("getSavingTypes error:", error);
    return [];
  }
}

/**
 * Buat jenis simpanan baru.
 */
export async function createSavingType(data: {
  code: string;
  name: string;
  is_mandatory: boolean;
  min_amount: number;
  monthly_amount: number;
  is_withdrawable: boolean;
  description?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await verifySessionAndRole(["superadmin", "ketua", "pengurus", "admin"]);
    
    const created = await prisma.saving_types.create({
      data: {
        code: data.code.toUpperCase().trim(),
        name: data.name.trim(),
        is_mandatory: data.is_mandatory,
        min_amount: data.min_amount,
        monthly_amount: data.monthly_amount,
        is_withdrawable: data.is_withdrawable,
        description: data.description?.trim() || null,
        is_active: true,
      },
    });

    await logAudit({
      action: "CREATE",
      modelType: "saving_types",
      modelId: Number(created.id),
      newValues: {
        code: created.code,
        name: created.name,
        is_mandatory: created.is_mandatory,
        min_amount: Number(created.min_amount),
        monthly_amount: Number(created.monthly_amount),
        is_withdrawable: created.is_withdrawable,
      },
    });

    revalidatePath("/simpanan");
    return { success: true };
  } catch (error: unknown) {
    console.error("createSavingType error:", error);
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("Unique") || msg.includes("unique")) {
      return { success: false, error: "Kode jenis simpanan sudah digunakan." };
    }
    return { success: false, error: "Gagal membuat jenis simpanan baru." };
  }
}

/**
 * Perbarui data jenis simpanan.
 * Simpanan Sukarela (is_mandatory = false) tidak bisa diubah monthly_amount-nya.
 */
export async function updateSavingType(
  id: number,
  data: {
    name: string;
    is_mandatory: boolean;
    min_amount: number;
    monthly_amount: number;
    is_withdrawable: boolean;
    description?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await verifySessionAndRole(["superadmin", "ketua", "pengurus", "admin"]);
    const old = await prisma.saving_types.findUnique({ where: { id: BigInt(id) } });

    await prisma.saving_types.update({
      where: { id: BigInt(id) },
      data: {
        name: data.name.trim(),
        is_mandatory: data.is_mandatory,
        min_amount: data.min_amount,
        monthly_amount: data.monthly_amount,
        is_withdrawable: data.is_withdrawable,
        description: data.description?.trim() || null,
        updated_at: new Date(),
      },
    });

    await logAudit({
      action: "UPDATE",
      modelType: "saving_types",
      modelId: id,
      oldValues: old ? {
        name: old.name,
        is_mandatory: old.is_mandatory,
        min_amount: Number(old.min_amount),
        monthly_amount: Number(old.monthly_amount),
        is_withdrawable: old.is_withdrawable,
      } : null,
      newValues: {
        name: data.name,
        is_mandatory: data.is_mandatory,
        min_amount: data.min_amount,
        monthly_amount: data.monthly_amount,
        is_withdrawable: data.is_withdrawable,
      },
    });

    revalidatePath("/simpanan");
    return { success: true };
  } catch (error) {
    console.error("updateSavingType error:", error);
    return { success: false, error: "Gagal memperbarui jenis simpanan." };
  }
}

/**
 * Toggle status aktif/nonaktif jenis simpanan.
 */
export async function toggleSavingTypeStatus(
  id: number,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await verifySessionAndRole(["superadmin", "ketua", "pengurus", "admin"]);
    await prisma.saving_types.update({
      where: { id: BigInt(id) },
      data: { is_active: isActive, updated_at: new Date() },
    });

    await logAudit({
      action: "UPDATE",
      modelType: "saving_types",
      modelId: id,
      oldValues: { is_active: !isActive },
      newValues: { is_active: isActive },
    });

    revalidatePath("/simpanan");
    return { success: true };
  } catch (error) {
    console.error("toggleSavingTypeStatus error:", error);
    return { success: false, error: "Gagal mengubah status." };
  }
}
