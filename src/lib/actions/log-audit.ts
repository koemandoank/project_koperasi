"use server"

import { prisma } from "@/lib/db/prisma"
import { auth } from "@/auth"
import { headers } from "next/headers"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "RESET_PASSWORD"
  | "APPROVE"
  | "REJECT"
  | "LOGIN"
  | "LOGOUT"
  | "EXPORT"

export interface LogAuditParams {
  action: AuditAction
  modelType: string
  modelId?: number | bigint | null
  oldValues?: Record<string, unknown> | null
  newValues?: Record<string, unknown> | null
  /** Override user_id jika tidak ingin mengambil dari session */
  actorUserId?: number | bigint | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Utility
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tulis satu baris audit log ke tabel `audit_logs`.
 * Secara otomatis membaca user session yang aktif dan IP dari request headers.
 * Silent — tidak melempar exception agar tidak mengganggu flow utama.
 *
 * @param params - Detail log yang akan ditulis
 */
export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    const session = await auth()
    const hdrs = await headers()

    const userId =
      params.actorUserId != null
        ? BigInt(params.actorUserId)
        : session?.user?.id
          ? BigInt(session.user.id)
          : null

    // Tidak log jika tidak ada user
    if (!userId) return

    const ipRaw =
      hdrs.get("x-forwarded-for") ??
      hdrs.get("x-real-ip") ??
      "unknown"
    const ipAddress = ipRaw.split(",")[0].trim()
    const userAgent = hdrs.get("user-agent") ?? ""

    await prisma.auditLog.create({
      data: {
        user_id:    userId,
        action:     params.action,
        model_type: params.modelType,
        model_id:   params.modelId != null ? BigInt(params.modelId) : null,
        old_values: (params.oldValues ?? null) as any,
        new_values: (params.newValues ?? null) as any,
        ip_address: ipAddress,
        user_agent: userAgent,
        url:        null,
        created_at: new Date(),
      },
    })
  } catch (err) {
    // Silent fail — jangan sampai log mengganggu operasi utama
    console.error("[logAudit] Failed to write audit log:", err)
  }
}
