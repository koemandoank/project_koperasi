import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

const koperasiSettingsSchema = z.object({
  namaKoperasi: z.string().min(1, "Nama koperasi wajib diisi"),
  alamat: z.string().min(1, "Alamat wajib diisi"),
  noTelepon: z.string().min(1, "No. telepon wajib diisi"),
});

const INDUK_TYPE = "induk" as const;

function getActiveIndukUnitQuery() {
  return prisma.unit.findFirst({
    where: {
      type: INDUK_TYPE,
      is_active: true,
    },
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
    },
  });
}

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const settings = await getActiveIndukUnitQuery();

  // Jika tidak ada unit induk aktif, kembalikan object kosong (UI akan menampilkan form kosong)
  if (!settings) {
    return NextResponse.json(
      {
        namaKoperasi: "",
        alamat: "",
        noTelepon: "",
      },
      { status: 200 },
    );
  }

  return NextResponse.json(
    {
      namaKoperasi: settings.name ?? "",
      alamat: settings.address ?? "",
      noTelepon: settings.phone ?? "",
    },
    { status: 200 },
  );
}

export async function PUT(req: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;

  // RBAC: superadmin/admin/pengurus
  if (!["superadmin", "admin", "pengurus"].includes(String(role ?? ""))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = koperasiSettingsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Invalid payload",
        errors: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  // Cari unit induk aktif
  const existing = await prisma.unit.findFirst({
    where: {
      type: INDUK_TYPE,
      is_active: true,
    },
    select: { id: true },
  });

  if (!existing?.id) {
    return NextResponse.json(
      {
        message:
          "Unit koperasi (type=induk) tidak ditemukan. Aktifkan unit induk di database terlebih dahulu.",
      },
      { status: 400 },
    );
  }

  const updated = await prisma.unit.update({
    where: { id: existing.id },
    data: {
      name: parsed.data.namaKoperasi,
      address: parsed.data.alamat,
      phone: parsed.data.noTelepon,
    },
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
    },
  });

  return NextResponse.json(
    {
      namaKoperasi: updated.name ?? "",
      alamat: updated.address ?? "",
      noTelepon: updated.phone ?? "",
    },
    { status: 200 },
  );
}
