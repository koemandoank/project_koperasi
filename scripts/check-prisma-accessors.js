const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  console.log('typeof prisma.member:', typeof prisma.member);
  console.log('typeof prisma.members:', typeof prisma.members);
  console.log('typeof prisma.unit:', typeof prisma.unit);
  console.log('typeof prisma.units:', typeof prisma.units);
  await prisma.$disconnect();
})();
