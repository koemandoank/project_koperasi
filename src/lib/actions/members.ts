"use server"

import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { logAudit } from "@/lib/actions/log-audit";

// ─────────────────────────────────────────────────────────────────────────────
// READ
/**
 * Mengambil daftar seluruh anggota koperasi beserta akun user dan unit/lokasinya.
 * 
 * @returns {Promise<Array<{ id: number, member_code: string, nik: string, full_name: string, email: string | null, phone: string | null, status: string, unit_id: number, unit_name: string, unit_code: string, role: string, user_id: number | null, photo_path: string | null }>>} List anggota koperasi
 * @throws {Error} Jika terjadi kegagalan saat membaca database
 */
export async function getMembers() {
  try {
    const members = await prisma.member.findMany({
      include: {
        users: true,
        units: true,
      },
      orderBy: { created_at: "desc" },
    });

    return members.map((m) => ({
      id: Number(m.id),
      member_code: m.member_code,
      nik: m.nik,
      full_name: m.full_name,
      email: m.email,
      phone: m.phone,
      status: m.status,
      unit_id: Number(m.unit_id),
      unit_name: m.units?.name || "-",
      unit_code: m.units?.code || "-",
      role: m.users?.role || "anggota",
      user_id: m.users ? Number(m.users.id) : null,
      photo_path: m.photo_path,
    }));
  } catch (error) {
    console.error("Failed to fetch members:", error);
    return [];
  }
}

export async function getUnits() {
  try {
    const units = await prisma.unit.findMany({
      where: { is_active: true },
    });
    return units.map((u) => ({ id: Number(u.id), name: u.name }));
  } catch {
    return [];
  }
}

export async function createUnit(name: string) {
  try {
    const count = await prisma.unit.count();
    const code = `U-${String(count + 1).padStart(3, "0")}`;
    const unit = await prisma.unit.create({
      data: {
        name,
        code,
        type: "induk",
        is_active: true,
      }
    });
    return { success: true, id: Number(unit.id) };
  } catch (error) {
    console.error("Failed to create unit:", error);
    return { success: false, error: "Gagal membuat lokasi baru" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RESET PASSWORD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reset password anggota ke nilai default "K0pmember01" atau custom.
 * Menulis ke audit_logs dengan action RESET_PASSWORD.
 *
 * @param userId - ID user yang password-nya akan di-reset
 * @param customPassword - Password custom jika diminta user (opsional)
 */
export async function resetMemberPassword(userId: number, customPassword?: string) {
  try {
    const newPassword = customPassword || "K0pmember01";
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Ambil data user sebelum diubah untuk audit
    const existingUser = await prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { id: true, username: true, email: true, role: true, member_id: true },
    });

    await prisma.user.update({
      where: { id: BigInt(userId) },
      data: { password: hashedPassword },
    });

    // Audit log — tidak menyertakan hash password untuk keamanan
    await logAudit({
      action: "RESET_PASSWORD",
      modelType: "users",
      modelId: userId,
      oldValues: null,
      newValues: {
        note: customPassword ? "Password di-reset ke password custom oleh admin/pengurus" : "Password di-reset ke default oleh admin/pengurus",
        username: existingUser?.username,
        email: existingUser?.email,
        role: existingUser?.role,
      },
    });

    return { 
      success: true, 
      message: customPassword 
        ? "Password berhasil di-reset dengan password custom." 
        : "Password berhasil di-reset menjadi 'K0pmember01'" 
    };
  } catch (error) {
    console.error("Failed to reset password:", error);
    return { success: false, error: "Gagal mereset password" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Buat anggota baru beserta akun user-nya (jika ada email).
 *
 * @param {any} data - Data anggota baru termasuk nik, full_name, email, phone, unit_id, role, dan photo_path
 * @returns {Promise<{ success: boolean, error?: string }>} Status keberhasilan
 */
export async function createMember(data: any) {
  try {
    const count = await prisma.member.count();
    const memberCode = `MBR-${String(count + 1).padStart(4, "0")}`;

    let newMemberId: bigint | null = null;

    await prisma.$transaction(async (tx) => {
      const member = await tx.member.create({
        data: {
          member_code: memberCode,
          nik: data.nik,
          full_name: data.full_name,
          email: data.email,
          phone: data.phone,
          unit_id: BigInt(data.unit_id),
          join_date: new Date(),
          status: "active",
          photo_path: data.photo_path || null,
        },
      });

      newMemberId = member.id;

      if (data.email) {
        const hashedPassword = await bcrypt.hash("K0pmember01", 10);
        await tx.user.create({
          data: {
            username: data.email.split("@")[0],
            email: data.email,
            password: hashedPassword,
            role: data.role || "anggota",
            member_id: member.id,
            is_active: true,
          },
        });
      }
    });

    await logAudit({
      action: "CREATE",
      modelType: "members",
      modelId: newMemberId ? Number(newMemberId) : null,
      newValues: {
        member_code: memberCode,
        nik: data.nik,
        full_name: data.full_name,
        email: data.email,
        phone: data.phone,
        unit_id: data.unit_id,
        role: data.role || "anggota",
        photo_path: data.photo_path || null,
      },
    });

    revalidatePath("/anggota");
    return { success: true };
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2002") return { success: false, error: "NIK atau Email sudah terdaftar." };
    return { success: false, error: "Gagal menambahkan anggota." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update data anggota dan role akun user-nya.
 *
 * @param {number} id - ID member
 * @param {any} data - Data yang diperbarui termasuk nik, full_name, email, phone, unit_id, role, dan photo_path
 * @returns {Promise<{ success: boolean, error?: string }>} Status keberhasilan
 */
export async function updateMember(id: number, data: any) {
  try {
    // Ambil data lama untuk audit
    const oldMember = await prisma.member.findUnique({
      where: { id: BigInt(id) },
      select: { nik: true, full_name: true, email: true, phone: true, unit_id: true, photo_path: true },
    });
    const oldUser = await prisma.user.findUnique({
      where: { member_id: BigInt(id) },
      select: { role: true, email: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.member.update({
        where: { id: BigInt(id) },
        data: {
          nik: data.nik,
          full_name: data.full_name,
          email: data.email,
          phone: data.phone,
          unit_id: BigInt(data.unit_id),
          photo_path: data.photo_path || null,
        },
      });

      const existingUser = await tx.user.findUnique({ where: { member_id: BigInt(id) } });
      if (existingUser) {
        await tx.user.update({
          where: { id: existingUser.id },
          data: {
            email: data.email || existingUser.email,
            role: data.role,
          },
        });
      } else if (data.email) {
        const hashedPassword = await bcrypt.hash("K0pmember01", 10);
        const member = await tx.member.findUnique({
          where: { id: BigInt(id) },
          select: { member_code: true },
        });
        const username = member?.member_code || data.email.split("@")[0];
        await tx.user.create({
          data: {
            username,
            email: data.email,
            password: hashedPassword,
            role: data.role || "anggota",
            member_id: BigInt(id),
            is_active: true,
          },
        });
      }
    });

    await logAudit({
      action: "UPDATE",
      modelType: "members",
      modelId: id,
      oldValues: {
        nik: oldMember?.nik,
        full_name: oldMember?.full_name,
        email: oldMember?.email,
        phone: oldMember?.phone,
        unit_id: oldMember ? Number(oldMember.unit_id) : null,
        role: oldUser?.role,
        photo_path: oldMember?.photo_path,
      },
      newValues: {
        nik: data.nik,
        full_name: data.full_name,
        email: data.email,
        phone: data.phone,
        unit_id: data.unit_id,
        role: data.role,
        photo_path: data.photo_path,
      },
    });

    revalidatePath("/anggota");
    return { success: true };
  } catch (error: any) {
    if (error.code === "P2002") return { success: false, error: "NIK atau Email sudah terdaftar." };
    return { success: false, error: "Gagal mengupdate anggota." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hapus anggota beserta akun user-nya secara cascade.
 *
 * @param memberId - ID member yang akan dihapus
 */
export async function deleteMember(memberId: number) {
  try {
    const member = await prisma.member.findUnique({
      where: { id: BigInt(memberId) },
      include: { users: true, units: true },
    });

    if (member?.users) {
      await prisma.user.delete({ where: { id: member.users.id } });
    }
    await prisma.member.delete({ where: { id: BigInt(memberId) } });

    await logAudit({
      action: "DELETE",
      modelType: "members",
      modelId: memberId,
      oldValues: {
        member_code: member?.member_code,
        nik: member?.nik,
        full_name: member?.full_name,
        email: member?.email,
        unit_name: member?.units?.name,
        role: member?.users?.role,
      },
    });

    revalidatePath("/anggota");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete member:", error);
    return { success: false, error: "Gagal menghapus anggota. Pastikan tidak ada transaksi terkait." };
  }
}
