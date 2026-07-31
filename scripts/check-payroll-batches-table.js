const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
BigInt.prototype.toJSON = function () { return this.toString(); };
(async () => {
  // Simulasi periode Oktober 2025 (ada data seed di sana)
  const periodStart = new Date(2025, 9, 1); // bulan 0-indexed, Oktober = 9
  const periodEnd = new Date(2025, 10, 0, 23, 59, 59);
  console.log('Period:', periodStart.toISOString(), '-', periodEnd.toISOString());

  const swType = await prisma.saving_types.findFirst({ where: { code: 'SW' } });
  console.log('SW type:', swType?.code);

  const existing = await prisma.payroll_batches.findUnique({ where: { period_code: '2025-10' } });
  console.log('Existing batch for 2025-10:', existing ? existing.status : 'none');

  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
