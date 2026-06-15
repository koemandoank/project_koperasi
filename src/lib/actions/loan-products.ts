"use server"

import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/actions/log-audit";
import { auth } from "@/auth";
import { checkRole } from "@/lib/auth-helpers";

export async function getLoanProducts() {
  try {
    const products = await prisma.loan_products.findMany({
      orderBy: { created_at: "desc" }
    });
    return products.map((p: any) => ({
      id: Number(p.id),
      code: p.code,
      name: p.name,
      interest_rate: Number(p.interest_rate),
      interest_method: p.interest_method,
      max_tenor: p.max_tenor,
      max_amount: Number(p.max_amount),
      min_amount: Number(p.min_amount),
      admin_fee_pct: Number(p.admin_fee_pct),
      penalty_pct: Number(p.penalty_pct),
      requires_guarantor: p.requires_guarantor,
      requirements: p.requirements,
      is_active: p.is_active,
    }));
  } catch (error) {
    console.error("Failed to fetch loan products:", error);
    return [];
  }
}

export async function createLoanProduct(data: any) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Tidak terautentikasi" };
    checkRole(session, ["superadmin", "admin", "pengurus"]);

    const created = await prisma.loan_products.create({
      data: {
        code: data.code,
        name: data.name,
        interest_rate: Number(data.interest_rate),
        interest_method: data.interest_method,
        max_tenor: parseInt(data.max_tenor),
        max_amount: Number(data.max_amount),
        min_amount: Number(data.min_amount) || 500000,
        admin_fee_pct: Number(data.admin_fee_pct) || 0,
        penalty_pct: Number(data.penalty_pct) || 0,
        requires_guarantor: data.requires_guarantor === true || data.requires_guarantor === "true",
        requirements: data.requirements || null,
        is_active: true,
      }
    });

    await logAudit({
      action: "CREATE",
      modelType: "loan_products",
      modelId: Number(created.id),
      newValues: { code: data.code, name: data.name, interest_rate: Number(data.interest_rate), interest_method: data.interest_method, max_tenor: parseInt(data.max_tenor), max_amount: Number(data.max_amount) },
    });

    revalidatePath("/pinjaman/produk");
    return { success: true };
  } catch (error: any) {
    if (error.code === 'P2002') return { success: false, error: "Kode produk sudah digunakan." };
    return { success: false, error: "Gagal menyimpan produk pinjaman." };
  }
}

export async function updateLoanProduct(id: number, data: any) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Tidak terautentikasi" };
    checkRole(session, ["superadmin", "admin", "pengurus"]);

    const old = await prisma.loan_products.findUnique({ where: { id: BigInt(id) }, select: { code: true, name: true, interest_rate: true, max_tenor: true, max_amount: true, min_amount: true, admin_fee_pct: true, penalty_pct: true } });

    await prisma.loan_products.update({
      where: { id: BigInt(id) },
      data: {
        code: data.code,
        name: data.name,
        interest_rate: Number(data.interest_rate),
        interest_method: data.interest_method,
        max_tenor: parseInt(data.max_tenor),
        max_amount: Number(data.max_amount),
        min_amount: Number(data.min_amount) || 500000,
        admin_fee_pct: Number(data.admin_fee_pct) || 0,
        penalty_pct: Number(data.penalty_pct) || 0,
        requires_guarantor: data.requires_guarantor === true || data.requires_guarantor === "true",
        requirements: data.requirements || null,
      }
    });

    await logAudit({
      action: "UPDATE",
      modelType: "loan_products",
      modelId: id,
      oldValues: old ? { code: old.code, name: old.name, interest_rate: Number(old.interest_rate), max_tenor: old.max_tenor, max_amount: Number(old.max_amount), min_amount: Number(old.min_amount) } : null,
      newValues: { code: data.code, name: data.name, interest_rate: Number(data.interest_rate), max_tenor: parseInt(data.max_tenor), max_amount: Number(data.max_amount), min_amount: Number(data.min_amount) },
    });

    revalidatePath("/pinjaman/produk");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Gagal mengupdate produk pinjaman." };
  }
}

export async function toggleLoanProductStatus(id: number, isActive: boolean) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Tidak terautentikasi" };
    checkRole(session, ["superadmin", "admin", "pengurus"]);

    await prisma.loan_products.update({
      where: { id: BigInt(id) },
      data: { is_active: isActive }
    });

    await logAudit({
      action: "UPDATE",
      modelType: "loan_products",
      modelId: id,
      oldValues: { is_active: !isActive },
      newValues: { is_active: isActive },
    });

    revalidatePath("/pinjaman/produk");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to update status" };
  }
}
