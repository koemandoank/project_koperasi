"use server"

import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { checkRole } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/actions/log-audit";
import { remember, deleteCache } from "@/lib/cache";
import { calculatePagination, getPaginationMeta } from "@/lib/utils/pagination";
import { z } from "zod";
import { memberCreateSchema, memberUpdateSchema } from "@/lib/validations";

// ─────────────────────────────────────────────────────────────────────────────
// READ
export async function getMembers(): Promise<Array<{
  id: number;
  member_code: string;
  nik: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  unit_id: number;
  unit_name: string;
  unit_code: string;
  role: string;
  user_id: number | null;
  photo_path: string | null;
}>>;
export async function getMembers(
  page: number,
  pageSize: number
): Promise<{
  data: Array<{
    id: number;
    member_code: string;
    nik: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    status: string;
    unit_id: number;
    unit_name: string;
    unit_code: string;
    role: string;
    user_id: number | null;
    photo_path: string | null;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pages: number;
    hasMore: boolean;
  };
}>;
export async function getMembers(page?: number, pageSize?: number): Promise<any> {
  try {
    const isPaginated = page !== undefined && pageSize !== undefined;

    if (isPaginated) {
      const { skip, take } = calculatePagination(page, pageSize);

      const [members, total] = await Promise.all([
        prisma.member.findMany({
          include: {
            users: true,
            units: true,
          },
          orderBy: { created_at: "desc" },
          skip,
          take,
        }),
        prisma.member.count(),
      ]);

      const data = members.map((m: any) => ({
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

      return {
        data,
        pagination: getPaginationMeta(total, page, pageSize),
      };
    } else {
      const members = await prisma.member.findMany({
        include: {
          users: true,
          units: true,
        },
        orderBy: { created_at: "desc" },
      });

      return members.map((m: any) => ({
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
    }
  } catch (error) {
    console.error("Failed to fetch members:", error);
    if (page !== undefined && pageSize !== undefined) {
      return {
        data: [],
        pagination: getPaginationMeta(0, page, pageSize),
      };
    }
    return [];
  }
}

export async function getUnits() {
  try {
    const units = await prisma.unit.findMany({
      where: { is_active: true },
    });
    return units.map((u: any) => ({ id: Number(u.id), name: u.name }));
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
    // SECURITY FIX: Only admin/pengurus can create members
    await checkRole(["admin", "pengurus", "superadmin"]);
    
    const validated = memberCreateSchema.parse(data);

    const count = await prisma.member.count();
    const memberCode = `MBR-${String(count + 1).padStart(4, "0")}`;

    let newMemberId: bigint | null = null;

    await prisma.$transaction(async (tx: any) => {
      const member = await tx.member.create({
        data: {
          member_code: memberCode,
          nik: validated.nik,
          full_name: validated.full_name,
          email: validated.email || null,
          phone: validated.phone || null,
          unit_id: BigInt(validated.unit_id),
          join_date: new Date(),
          status: "active",
          photo_path: validated.photo_path || null,
        },
      });

      newMemberId = member.id;

      if (validated.email) {
        const hashedPassword = await bcrypt.hash("K0pmember01", 10);
        await tx.user.create({
          data: {
            username: validated.email.split("@")[0],
            email: validated.email,
            password: hashedPassword,
            role: validated.role || "anggota",
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
        nik: validated.nik,
        full_name: validated.full_name,
        email: validated.email,
        phone: validated.phone,
        unit_id: validated.unit_id,
        role: validated.role,
        photo_path: validated.photo_path || null,
      },
    });

    await deleteCache(["members:all", "stats:admin", "stats:koperasi", "members:stats"]);
    revalidatePath("/anggota");
    return { success: true };
  } catch (error: any) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message };
    }
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
    // SECURITY FIX: Only admin/pengurus can update members
    await checkRole(["admin", "pengurus", "superadmin"]);
    
    const validated = memberUpdateSchema.parse(data);

    // Ambil data lama untuk audit
    const oldMember = await prisma.member.findUnique({
      where: { id: BigInt(id) },
      select: { nik: true, full_name: true, email: true, phone: true, unit_id: true, photo_path: true },
    });
    const oldUser = await prisma.user.findUnique({
      where: { member_id: BigInt(id) },
      select: { role: true, email: true },
    });

    await prisma.$transaction(async (tx: any) => {
      await tx.member.update({
        where: { id: BigInt(id) },
        data: {
          nik: validated.nik,
          full_name: validated.full_name,
          email: validated.email,
          phone: validated.phone,
          unit_id: validated.unit_id !== undefined ? BigInt(validated.unit_id) : undefined,
          photo_path: validated.photo_path !== undefined ? (validated.photo_path || null) : undefined,
        },
      });

      const existingUser = await tx.user.findUnique({ where: { member_id: BigInt(id) } });
      if (existingUser) {
        await tx.user.update({
          where: { id: existingUser.id },
          data: {
            email: validated.email || existingUser.email,
            role: validated.role,
          },
        });
      } else if (validated.email) {
        const hashedPassword = await bcrypt.hash("K0pmember01", 10);
        const member = await tx.member.findUnique({
          where: { id: BigInt(id) },
          select: { member_code: true },
        });
        const username = member?.member_code || validated.email.split("@")[0];
        await tx.user.create({
          data: {
            username,
            email: validated.email,
            password: hashedPassword,
            role: validated.role || "anggota",
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
        nik: validated.nik,
        full_name: validated.full_name,
        email: validated.email,
        phone: validated.phone,
        unit_id: validated.unit_id,
        role: validated.role,
        photo_path: validated.photo_path,
      },
    });

    await deleteCache(["members:all", "stats:admin", "stats:koperasi", "members:stats"]);
    revalidatePath("/anggota");
    return { success: true };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message };
    }
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
    // SECURITY FIX: Only admin/superadmin can delete members
    await checkRole(["admin", "superadmin"]);
    
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

    await deleteCache(["members:all", "stats:admin", "stats:koperasi", "members:stats"]);
    revalidatePath("/anggota");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete member:", error);
    return { success: false, error: "Gagal menghapus anggota. Pastikan tidak ada transaksi terkait." };
  }
}

/**
 * Mengambil statistik anggota, termasuk total anggota, jumlah aktif/tidak aktif,
 * lokasi anggota terbanyak, lokasi paling aktif (berdasarkan transaksi),
 * serta 5 riwayat aktivitas transaksi terakhir.
 */
export async function getMemberStats() {
  return remember("members:stats", 300, async () => {
    try {
      const totalMembers = await prisma.member.count();
      const activeMembers = await prisma.member.count({
        where: { status: "active" },
      });
      const inactiveMembers = totalMembers - activeMembers;

      // Top location by member count
      const memberGroups = await prisma.member.groupBy({
        by: ["unit_id"],
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: "desc",
          },
        },
        take: 1,
      });

      let topLocationName = "-";
      let topLocationCount = 0;
      if (memberGroups.length > 0) {
        const topGroupId = memberGroups[0].unit_id;
        topLocationCount = memberGroups[0]._count.id;
        const unit = await prisma.unit.findUnique({
          where: { id: topGroupId },
        });
        if (unit) {
          topLocationName = unit.name;
        }
      }

      // Most active location
      const units = await prisma.unit.findMany({
        include: {
          members: {
            select: {
              id: true,
            },
          },
        },
      });

      const unitActivities = await Promise.all(
        units.map(async (unit: any) => {
          const memberIds = unit.members.map((m: any) => m.id);
          if (memberIds.length === 0) {
            return { unitName: unit.name, activityCount: 0 };
          }

          const orderCount = await prisma.orders.count({
            where: {
              member_id: { in: memberIds },
            },
          });

          const savingCount = await prisma.saving_transactions.count({
            where: {
              member_id: { in: memberIds },
            },
          });

          const ppobCount = await prisma.ppob_transactions.count({
            where: {
              member_id: { in: memberIds },
            },
          });

          return {
            unitName: unit.name,
            activityCount: orderCount + savingCount + ppobCount,
          };
        })
      );

      unitActivities.sort((a, b) => b.activityCount - a.activityCount);
      const mostActiveLocation = unitActivities[0] || { unitName: "-", activityCount: 0 };

      // Recent activities timeline (last 5 saving_transactions + orders)
      const recentSavings = await prisma.saving_transactions.findMany({
        take: 5,
        orderBy: { transaction_at: "desc" },
        include: {
          members: {
            select: {
              full_name: true,
              member_code: true,
            },
          },
        },
      });

      const recentOrders = await prisma.orders.findMany({
        take: 5,
        orderBy: { ordered_at: "desc" },
        include: {
          members: {
            select: {
              full_name: true,
              member_code: true,
            },
          },
        },
      });

      const activities = [
        ...recentSavings.map((s: any) => ({
          id: `saving-${s.id}`,
          type: "saving",
          date: s.transaction_at.toISOString(),
          amount: Number(s.amount),
          description: s.type === "deposit" ? "Setoran Simpanan" : "Penarikan Simpanan",
          memberName: s.members?.full_name || "Umum",
          memberCode: s.members?.member_code || "-",
        })),
        ...recentOrders.map((o: any) => ({
          id: `order-${o.id}`,
          type: "pos",
          date: o.ordered_at.toISOString(),
          amount: Number(o.grand_total),
          description: `Belanja POS (${o.payment_method})`,
          memberName: o.members?.full_name || "Umum",
          memberCode: o.members?.member_code || "-",
        })),
      ];

      activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const recentActivities = activities.slice(0, 5);

      return {
        totalMembers,
        activeMembers,
        inactiveMembers,
        topLocationName,
        topLocationCount,
        mostActiveLocationName: mostActiveLocation.unitName,
        mostActiveLocationCount: mostActiveLocation.activityCount,
        recentActivities,
      };
    } catch (error) {
      console.error("Failed to fetch member stats:", error);
      return {
        totalMembers: 0,
        activeMembers: 0,
        inactiveMembers: 0,
        topLocationName: "-",
        topLocationCount: 0,
        mostActiveLocationName: "-",
        mostActiveLocationCount: 0,
        recentActivities: [],
      };
    }
  });
}
