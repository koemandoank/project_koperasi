const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const r = await prisma.member.findMany({ where: { status: 'active' } });
    console.log('SUCCESS, got', r.length, 'rows');
  } catch (e) {
    console.log('ERROR TYPE:', e.constructor.name);
    console.log('ERROR MSG:', e.message);
  }
  await prisma.$disconnect();
})();
