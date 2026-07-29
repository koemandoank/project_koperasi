const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const withBank = await prisma.members.count({ where: { bank_name: { not: null } } });
  console.log('Members dengan data bank utuh:', withBank);
  await prisma.$disconnect();
})();
