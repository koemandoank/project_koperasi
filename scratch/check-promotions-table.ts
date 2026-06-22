import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  try {
    const res = await prisma.$queryRawUnsafe("SHOW TABLES LIKE 'promotions'");
    console.log("SHOW TABLES LIKE 'promotions':", res);
  } catch (e) {
    console.error("Error checking table:", e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
