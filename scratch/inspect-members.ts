import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const members = await prisma.member.findMany({
    orderBy: { id: "asc" }
  });

  console.log("=== MEMBERS ===");
  for (const m of members) {
    console.log({
      id: Number(m.id),
      member_code: m.member_code,
      nik: m.nik,
      full_name: m.full_name,
      email: m.email,
      phone: m.phone,
      unit_id: Number(m.unit_id),
      photo_path: m.photo_path
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
