import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import {
  ShuConfigSchema,
  DEFAULT_SHU_CONFIG,
  SHU_CONFIG_ALLOWED_ROLES,
  validateShuConfig,
  migrateLegacyShuConfig,
} from "@/lib/types/shu-config.types";
import { verifySessionAndRole } from "@/lib/auth-helpers";
import { z } from "zod";

/**
 * GET /api/shu-config
 * Ambil konfigurasi SHU aktif. Semua role authenticated bisa baca.
 * Auto-migrate dari format lama jika diperlukan.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await prisma.app_settings.findFirst();
    if (!settings?.shu_config) {
      return NextResponse.json(DEFAULT_SHU_CONFIG);
    }

    const raw = JSON.parse(settings.shu_config) as Record<string, unknown>;
    const config = migrateLegacyShuConfig(raw);
    return NextResponse.json(config);
  } catch (error) {
    console.error("GET /api/shu-config error:", error);
    return NextResponse.json(DEFAULT_SHU_CONFIG);
  }
}

/**
 * POST /api/shu-config
 * Simpan konfigurasi SHU baru.
 * RBAC: Hanya superadmin | ketua yang diizinkan.
 * Validasi: 3 grup total=100% + rule bisnis.
 * Audit: Catat ke AuditLog dengan old_values dan new_values.
 */
export async function POST(request: Request) {
  try {
    const session = await verifySessionAndRole(["superadmin", "ketua"]);

    const body = await request.json();
    
    // Strict Parsing
    const parsedData = ShuConfigSchema.parse(body);

    // Validasi 3 grup + rule bisnis
    const validationError = validateShuConfig(parsedData);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 422 });
    }

    // Ambil nilai lama untuk audit log
    const settings = await prisma.app_settings.findFirst();
    const oldConfig = settings?.shu_config
      ? (JSON.parse(settings.shu_config) as Record<string, unknown>)
      : null;

    // Simpan ke DB
    const jsonValue = JSON.stringify(parsedData);
    if (settings) {
      await prisma.app_settings.update({
        where: { id: settings.id },
        data: { shu_config: jsonValue, updated_at: new Date() },
      });
    } else {
      await prisma.app_settings.create({
        data: {
          company_name: "Koperasi Digital",
          shu_config: jsonValue,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
    }

    // Audit Log
    const ipRaw = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown";
    const ipAddress = ipRaw.split(",")[0].trim();
    await prisma.auditLog.create({
      data: {
        user_id: BigInt(session.user.id),
        action: "UPDATE",
        model_type: "shu_config",
        model_id: settings?.id ?? BigInt(0),
        old_values: (oldConfig ?? {}) as any,
        new_values: body as any,
        ip_address: ipAddress,
        user_agent: request.headers.get("user-agent") ?? "",
        url: "/api/shu-config",
        created_at: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Validasi gagal: format tidak dikenali." }, { status: 422 });
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("POST /api/shu-config error:", msg);
    if (msg.includes("Forbidden")) return NextResponse.json({ success: false, error: msg }, { status: 403 });
    return NextResponse.json({ success: false, error: `Gagal menyimpan: ${msg}` }, { status: 500 });
  }
}
