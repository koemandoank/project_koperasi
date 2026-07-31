const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const del = await prisma.payroll_batches.deleteMany({ where: { period_code: '2025-10', generated_by: 'cron' } });
  console.log('Deleted test draft rows:', del.count);
  await prisma.$disconnect();
})();
