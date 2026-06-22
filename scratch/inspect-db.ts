import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      members: {
        include: {
          units: true
        }
      }
    }
  });

  console.log("=== USERS ===");
  for (const u of users) {
    console.log({
      id: Number(u.id),
      username: u.username,
      email: u.email,
      role: u.role,
      member_id: u.member_id ? Number(u.member_id) : null,
      member: u.members ? {
        id: Number(u.members.id),
        full_name: u.members.full_name,
        nik: u.members.nik,
        unit_id: Number(u.members.unit_id),
        unit_name: u.members.units?.name,
        photo_path: u.members.photo_path
      } : null
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
