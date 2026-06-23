"use server"

import { prisma } from "@/lib/db/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { logAudit } from "@/lib/actions/log-audit"
import { ensureTables } from "@/lib/db/ensure-tables"

/**
 * Interface untuk status kuorum dan rangkuman absensi RAT.
 */
export interface RatStatus {
  year: number
  totalActive: number
  totalPresent: number
  quorumPercentage: number
  isQuorumReached: boolean
}

/**
 * Interface untuk data kehadiran anggota individual.
 */
export interface RatMemberAttendance {
  memberId: string
  memberCode: string
  fullName: string
  unitName: string
  isPresent: boolean
  voted: boolean
  attendedAt: string | null
}

/**
 * Helper untuk memvalidasi otorisasi sesi pengurus/admin.
 * 
 * @returns {Promise<string>} ID User yang terautentikasi
 * @throws {Error} Jika tidak terautentikasi atau role tidak valid
 */
async function verifyAuthorizedUser(): Promise<string> {
  const session = await auth()
  const role = session?.user?.role
  if (!session?.user?.id) throw new Error("Tidak terautentikasi")
  
  const allowed = ["superadmin", "admin", "pengurus"]
  if (!allowed.includes(role as string)) {
    throw new Error("Hak akses ditolak. Hanya pengurus atau admin yang diizinkan.")
  }
  return session.user.id
}

/**
 * Mengambil ringkasan kuorum RAT untuk tahun buku tertentu.
 * 
 * @param {number} year - Tahun buku RAT
 * @returns {Promise<{ success: boolean, status?: RatStatus, error?: string }>} Status kuorum
 */
export async function getRatQuorumStatus(year: number): Promise<{
  success: boolean
  status?: RatStatus
  error?: string
}> {
  try {
    await ensureTables()
    const totalActive = await prisma.members.count({ where: { status: "active" } })
    const totalPresent = await prisma.rat_attendances.count({
      where: { year, is_present: true },
    })

    const quorumPercentage = totalActive > 0 ? (totalPresent / totalActive) * 100 : 0
    const requiredQuorum = Math.floor(totalActive / 2) + 1
    const isQuorumReached = totalPresent >= requiredQuorum

    return {
      success: true,
      status: {
        year,
        totalActive,
        totalPresent,
        quorumPercentage: Number(quorumPercentage.toFixed(2)),
        isQuorumReached,
      },
    }
  } catch (error) {
    console.error("[getRatQuorumStatus] Error:", error)
    return { success: false, error: "Gagal mengambil status kuorum RAT." }
  }
}

/**
 * Mengambil daftar seluruh anggota beserta status kehadiran RAT mereka.
 * 
 * @param {number} year - Tahun buku RAT
 * @returns {Promise<RatMemberAttendance[]>} Daftar absensi anggota
 */
export async function getRatMembersAttendanceList(year: number): Promise<RatMemberAttendance[]> {
  try {
    await ensureTables()
    const members = await prisma.members.findMany({
      where: { status: "active" },
      include: {
        units: { select: { name: true } },
        rat_attendances: { where: { year } },
      },
      orderBy: { member_code: "asc" },
    })

    return members.map((m: any) => {
      const att = m.rat_attendances[0]
      return {
        memberId: m.id.toString(),
        memberCode: m.member_code,
        fullName: m.full_name,
        unitName: m.units?.name ?? "-",
        isPresent: att?.is_present ?? false,
        voted: att?.voted ?? false,
        attendedAt: att?.attended_at ? att.attended_at.toISOString() : null,
      }
    })
  } catch (error) {
    console.error("[getRatMembersAttendanceList] Error:", error)
    return []
  }
}

/**
 * Mencatat kehadiran anggota pada RAT (Check-in).
 * 
 * @param {number} memberId - ID Anggota
 * @param {number} year - Tahun buku RAT
 * @returns {Promise<{ success: boolean, error?: string }>} Status sukses operasi
 */
export async function registerRatAttendance(
  memberId: number,
  year: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureTables()
    const userId = await verifyAuthorizedUser()

    const member = await prisma.members.findUnique({
      where: { id: BigInt(memberId) },
      select: { full_name: true, member_code: true, status: true },
    })

    if (!member) return { success: false, error: "Anggota tidak ditemukan." }
    if (member.status !== "active") return { success: false, error: "Anggota tidak berstatus aktif." }

    const attendance = await prisma.rat_attendances.upsert({
      where: { member_id_year: { member_id: BigInt(memberId), year } },
      create: {
        member_id: BigInt(memberId),
        year,
        is_present: true,
        voted: false,
        attended_at: new Date(),
      },
      update: {
        is_present: true,
        attended_at: new Date(),
      },
    })

    await logAudit({
      action: "CREATE",
      modelType: "rat_attendances",
      modelId: Number(attendance.id),
      newValues: {
        member_id: memberId,
        member_code: member.member_code,
        full_name: member.full_name,
        year,
        is_present: true,
      },
    })

    revalidatePath("/akuntansi/rat-absensi")
    return { success: true }
  } catch (error: any) {
    console.error("[registerRatAttendance] Error:", error)
    return { success: false, error: error.message || "Gagal mencatat kehadiran." }
  }
}

/**
 * Menghapus/membatalkan catatan kehadiran anggota RAT.
 * 
 * @param {number} memberId - ID Anggota
 * @param {number} year - Tahun buku RAT
 * @returns {Promise<{ success: boolean, error?: string }>} Status sukses operasi
 */
export async function cancelRatAttendance(
  memberId: number,
  year: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureTables()
    await verifyAuthorizedUser()

    await prisma.rat_attendances.delete({
      where: { member_id_year: { member_id: BigInt(memberId), year } },
    })

    revalidatePath("/akuntansi/rat-absensi")
    return { success: true }
  } catch (error: any) {
    console.error("[cancelRatAttendance] Error:", error)
    return { success: false, error: error.message || "Gagal membatalkan kehadiran." }
  }
}

/**
 * Mengubah status hak suara anggota (sudah memilih atau belum).
 * 
 * @param {number} memberId - ID Anggota
 * @param {number} year - Tahun buku RAT
 * @param {boolean} voted - Status hak suara
 * @returns {Promise<{ success: boolean, error?: string }>} Status sukses operasi
 */
export async function toggleRatVotingRight(
  memberId: number,
  year: number,
  voted: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureTables()
    await verifyAuthorizedUser()

    const attendance = await prisma.rat_attendances.findUnique({
      where: { member_id_year: { member_id: BigInt(memberId), year } },
    })

    if (!attendance) return { success: false, error: "Anggota belum tercatat hadir di RAT." }

    await prisma.rat_attendances.update({
      where: { id: attendance.id },
      data: { voted, updated_at: new Date() },
    })

    revalidatePath("/akuntansi/rat-absensi")
    return { success: true }
  } catch (error: any) {
    console.error("[toggleRatVotingRight] Error:", error)
    return { success: false, error: error.message || "Gagal memperbarui status hak suara." }
  }
}
