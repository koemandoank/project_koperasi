"use server";

import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { checkRole } from "@/lib/auth-helpers";
import { calculatePagination, getPaginationMeta } from "@/lib/utils/pagination";
import { z } from "zod";
import { userCreateSchema, userUpdateSchema } from "@/lib/validations";

export type UserData = {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: Date | null;
  last_login_at: Date | null;
};

export async function getUsers(): Promise<UserData[]>;
export async function getUsers(
  page: number,
  pageSize: number
): Promise<{ data: UserData[]; pagination: any }>;
export async function getUsers(page?: number, pageSize?: number): Promise<any> {
  try {
    await checkRole(["superadmin", "admin"]);
    const isPaginated = page !== undefined && pageSize !== undefined;
    
    if (isPaginated) {
      const { skip, take } = calculatePagination(page, pageSize);

      // Hanya fetch user selain anggota (anggota dikelola di modul anggota)
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where: {
            role: {
              in: ["superadmin", "admin", "pengurus", "kasir", "petugas_akuntan", "pengawas"],
            },
          },
          orderBy: { id: "asc" },
          skip,
          take,
        }),
        prisma.user.count({
          where: {
            role: {
              in: ["superadmin", "admin", "pengurus", "kasir", "petugas_akuntan", "pengawas"],
            },
          },
        }),
      ]);

      const data = users.map((u: any) => ({
        id: Number(u.id),
        username: u.username,
        email: u.email,
        role: u.role,
        is_active: u.is_active,
        created_at: u.created_at,
        last_login_at: u.last_login_at,
      }));

      return {
        data,
        pagination: getPaginationMeta(total, page, pageSize),
      };
    } else {
      const users = await prisma.user.findMany({
        where: {
          role: {
            in: ["superadmin", "admin", "pengurus", "kasir", "petugas_akuntan", "pengawas"],
          },
        },
        orderBy: { id: "asc" },
      });

      return users.map((u: any) => ({
        id: Number(u.id),
        username: u.username,
        email: u.email,
        role: u.role,
        is_active: u.is_active,
        created_at: u.created_at,
        last_login_at: u.last_login_at,
      }));
    }
  } catch (error) {
    console.error("getUsers error:", error);
    if (page !== undefined && pageSize !== undefined) {
      return {
        data: [],
        pagination: getPaginationMeta(0, page, pageSize),
      };
    }
    return [];
  }
}

export async function createUser(data: any): Promise<{ success: boolean; error?: string }> {
  try {
    // SECURITY FIX: Only admin/superadmin can create users
    const session = await checkRole(["admin", "superadmin"]);
    
    const validated = userCreateSchema.parse(data);
    
    // Admin cannot create superadmin
    if (session.user.role === "admin" && validated.role === "superadmin") {
      return { success: false, error: "Admin tidak dapat membuat akun superadmin." };
    }

    const hashedPassword = await bcrypt.hash(validated.password || "654321", 10);

    await prisma.user.create({
      data: {
        username: validated.username.toLowerCase(),
        email: validated.email.toLowerCase(),
        password: hashedPassword,
        role: validated.role,
        is_active: validated.is_active,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    revalidatePath("/akun");
    return { success: true };
  } catch (error: any) {
    console.error("createUser error:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message };
    }
    if (error.code === "P2002") {
      return { success: false, error: "Username atau Email sudah digunakan." };
    }
    return { success: false, error: "Gagal membuat user." };
  }
}

export async function updateUser(
  id: number,
  data: any
): Promise<{ success: boolean; error?: string }> {
  try {
    // SECURITY FIX: Only admin/superadmin can update users
    const session = await checkRole(["admin", "superadmin"]);
    
    const validated = userUpdateSchema.parse(data);
    
    const target = await prisma.user.findUnique({ where: { id: BigInt(id) } });
    if (!target) return { success: false, error: "User tidak ditemukan." };

    if (session.user.role === "admin" && target.role === "superadmin") {
      return { success: false, error: "Admin tidak dapat mengubah akun superadmin." };
    }

    const updateData: any = {
      username: validated.username?.toLowerCase(),
      email: validated.email?.toLowerCase(),
      role: validated.role,
      is_active: validated.is_active,
      updated_at: new Date(),
    };

    if (validated.password && validated.password.trim().length >= 6) {
      updateData.password = await bcrypt.hash(validated.password.trim(), 10);
    }

    await prisma.user.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    revalidatePath("/akun");
    return { success: true };
  } catch (error: any) {
    console.error("updateUser error:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message };
    }
    if (error.code === "P2002") {
      return { success: false, error: "Username atau Email sudah digunakan." };
    }
    return { success: false, error: "Gagal memperbarui user." };
  }
}
