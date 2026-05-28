"use server";

import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { verifySessionAndRole } from "@/lib/auth-helpers";

export type UserData = {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: Date | null;
  last_login_at: Date | null;
};

export async function getUsers(): Promise<UserData[]> {
  try {
    await verifySessionAndRole(["superadmin", "admin"]);
    
    // Hanya fetch user selain anggota (anggota dikelola di modul anggota)
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
  } catch (error) {
    console.error("getUsers error:", error);
    return [];
  }
}

export async function createUser(data: {
  username: string;
  email: string;
  role: "admin" | "pengurus" | "kasir" | "superadmin" | "petugas_akuntan" | "pengawas";
  password?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await verifySessionAndRole(["superadmin", "admin"]);
    
    // Admin cannot create superadmin
    if (session.user.role === "admin" && data.role === "superadmin") {
      return { success: false, error: "Admin tidak dapat membuat akun superadmin." };
    }

    const hashedPassword = await bcrypt.hash(data.password || "654321", 10);

    await prisma.user.create({
      data: {
        username: data.username.toLowerCase(),
        email: data.email.toLowerCase(),
        password: hashedPassword,
        role: data.role,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    revalidatePath("/akun");
    return { success: true };
  } catch (error: any) {
    console.error("createUser error:", error);
    if (error.code === "P2002") {
      return { success: false, error: "Username atau Email sudah digunakan." };
    }
    return { success: false, error: "Gagal membuat user." };
  }
}

export async function updateUser(
  id: number,
  data: {
    username: string;
    email: string;
    role: "admin" | "pengurus" | "kasir" | "superadmin" | "petugas_akuntan" | "pengawas";
    password?: string;
    is_active: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await verifySessionAndRole(["superadmin", "admin"]);
    
    const target = await prisma.user.findUnique({ where: { id: BigInt(id) } });
    if (!target) return { success: false, error: "User tidak ditemukan." };

    if (session.user.role === "admin" && target.role === "superadmin") {
      return { success: false, error: "Admin tidak dapat mengubah akun superadmin." };
    }

    const updateData: any = {
      username: data.username.toLowerCase(),
      email: data.email.toLowerCase(),
      role: data.role,
      is_active: data.is_active,
      updated_at: new Date(),
    };

    if (data.password && data.password.trim().length >= 6) {
      updateData.password = await bcrypt.hash(data.password.trim(), 10);
    }

    await prisma.user.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    revalidatePath("/akun");
    return { success: true };
  } catch (error: any) {
    console.error("updateUser error:", error);
    if (error.code === "P2002") {
      return { success: false, error: "Username atau Email sudah digunakan." };
    }
    return { success: false, error: "Gagal memperbarui user." };
  }
}
