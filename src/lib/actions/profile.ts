"use server"

import { prisma } from "@/lib/db/prisma"
import { auth } from "@/auth"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { logAudit } from "@/lib/actions/log-audit"

export async function getMyProfile() {
  const session = await auth()
  if (!session?.user?.id) return null

  const user = await prisma.user.findUnique({
    where: { id: BigInt(session.user.id) },
    include: { members: true }
  })

  if (!user) return null

  return {
    id: Number(user.id),
    username: user.username,
    email: user.email,
    role: user.role,
    member: user.members ? {
      full_name: user.members.full_name,
      nik: user.members.nik,
      photo_path: user.members.photo_path
    } : null
  }
}

export async function updatePhoto(photoPath: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: "Unauthorized" }

    const user = await prisma.user.findUnique({
      where: { id: BigInt(session.user.id) },
      include: { members: true }
    })

    if (user?.members) {
      await prisma.member.update({
        where: { id: user.members.id },
        data: { photo_path: photoPath }
      })
      revalidatePath("/")
      return { success: true }
    }
    return { success: false, error: "Bukan anggota" }
  } catch (error) {
    return { success: false, error: "Gagal update foto" }
  }
}

export async function changePassword(oldPass: string, newPass: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: "Unauthorized" }

    const user = await prisma.user.findUnique({
      where: { id: BigInt(session.user.id) }
    })

    if (!user) return { success: false, error: "User tidak ditemukan" }

    const isValid = await bcrypt.compare(oldPass, user.password)
    if (!isValid) {
      // Log gagal ubah password (brute-force indicator)
      await logAudit({
        action: "UPDATE",
        modelType: "users",
        modelId: Number(session.user.id),
        newValues: { event: "CHANGE_PASSWORD_FAILED", reason: "Password lama salah", username: user.username },
      })
      return { success: false, error: "Password lama salah" }
    }

    const hashedPassword = await bcrypt.hash(newPass, 10)
    await prisma.user.update({
      where: { id: BigInt(session.user.id) },
      data: { password: hashedPassword }
    })

    await logAudit({
      action: "UPDATE",
      modelType: "users",
      modelId: Number(session.user.id),
      newValues: { event: "CHANGE_PASSWORD_SUCCESS", username: user.username },
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: "Gagal update password" }
  }
}
