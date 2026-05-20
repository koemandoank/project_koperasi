import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { authConfig } from "./auth.config";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Internal helper: tulis audit log login/logout langsung via Prisma.
// Tidak menggunakan logAudit() karena auth callbacks berjalan di luar
// request context Next.js (tidak ada headers() yang tersedia).
// ─────────────────────────────────────────────────────────────────────────────

async function writeLoginAudit({
  userId,
  action,
  username,
  role,
  note,
}: {
  userId: bigint | null
  action: "LOGIN" | "LOGOUT" | "LOGIN_FAILED"
  username: string
  role?: string
  note?: string
}) {
  try {
    await prisma.auditLog.create({
      data: {
        user_id:    userId,
        action,
        model_type: "users",
        model_id:   userId,
        old_values: undefined,
        new_values: {
          event:    action,
          username,
          role:     role ?? null,
          note:     note ?? null,
          timestamp: new Date().toISOString(),
        } as any,
        ip_address: undefined, // tidak tersedia di callbacks
        user_agent: undefined,
        url:        "/login",
        created_at: new Date(),
      },
    })
  } catch (err) {
    // Silent — jangan blokir proses login
    console.error("[writeLoginAudit] Failed:", err)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NextAuth Configuration
// ─────────────────────────────────────────────────────────────────────────────

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = z
          .object({ email: z.string().min(3), password: z.string().min(6) })
          .safeParse(credentials)

        if (!parsedCredentials.success) return null

        const { email, password } = parsedCredentials.data
        const identifier = email.trim()

        // Support login by email OR username OR NIK (members.nik)
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: identifier },
              { username: identifier },
              { members: { nik: identifier } },
            ],
            is_active: true,
          },
          include: { members: true },
        })

        console.log("Authorize attempt for:", identifier, "User found:", !!user)

        if (!user || !user.password) {
          // Catat percobaan login dengan user tidak ditemukan
          await writeLoginAudit({
            userId:   null,
            action:   "LOGIN_FAILED",
            username: identifier,
            note:     "User tidak ditemukan atau tidak aktif",
          })
          return null
        }

        const passwordsMatch = await bcrypt.compare(password, user.password)

        if (!passwordsMatch) {
          // Catat percobaan login dengan password salah
          await writeLoginAudit({
            userId:   user.id,
            action:   "LOGIN_FAILED",
            username: user.username,
            role:     user.role,
            note:     "Password salah",
          })
          return null
        }

        // Login berhasil — catat ke audit log
        await writeLoginAudit({
          userId:   user.id,
          action:   "LOGIN",
          username: user.username,
          role:     user.role,
        })

        return {
          id:   user.id.toString(),
          name: user.members?.full_name || user.username,
          email: user.email,
          role: user.role,
        }
      },
    }),
  ],

  // Note: Logout tracking di NextAuth v5 tidak dapat dilakukan via callbacks.
  // Logout audit harus ditambahkan di sisi Server Action jika dibutuhkan.
})
