import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const units = await prisma.unit.findMany();
  console.log("=== UNITS ===");
  console.log(units.map(u => ({ id: Number(u.id), name: u.name, code: u.code })));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
