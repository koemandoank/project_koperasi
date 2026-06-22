import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { authConfig } from "./auth.config";
import { z } from "zod";
import crypto from "crypto";

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
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 }, // absolute max 24 jam; idle 1 jam ditangani di authorized callback
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

        // Generate new session token for single-session restriction
        const sessionToken = crypto.randomUUID();
        
        // Save the new session token to DB
        await prisma.user.update({
          where: { id: user.id },
          data: {
            remember_token: sessionToken,
            last_login_at: new Date()
          }
        });

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
          sessionToken,
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        const u = user as { role?: unknown; id?: unknown; sessionToken?: string };
        if (u.role !== undefined) token.role = String(u.role);
        if (u.id !== undefined) {
          token.id = String(u.id);
          token.sub = String(u.id);
        }
        if (u.sessionToken !== undefined) {
          token.sessionToken = u.sessionToken;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = String(token.id);
      } else if (session.user && token.sub) {
        session.user.id = String(token.sub);
      }
      if (session.user && token.role) {
        session.user.role = String(token.role);
      }
      if (session.user && token.sessionToken) {
        session.user.sessionToken = String(token.sessionToken);
      }

      // Single Session Guard
      if (session.user && session.user.id && token.sessionToken) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: BigInt(session.user.id) },
            select: { remember_token: true }
          });
          
          if (dbUser && dbUser.remember_token && dbUser.remember_token !== token.sessionToken) {
            console.log(`[Session Guard] Session token mismatch for user ${session.user.id}. Invalidating session.`);
            return {} as any; // Returns empty session, next-auth treats as unauthenticated
          }
        } catch (error) {
          console.error("[Session Guard] Database query failed:", error);
        }
      }

      return session;
    }
  }
})
