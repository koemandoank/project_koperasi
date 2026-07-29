const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
BigInt.prototype.toJSON = function () { return this.toString(); };
(async () => {
  const budgets = await prisma.budgets.findMany();
  console.log('budgets count:', budgets.length);
  console.log(JSON.stringify(budgets, null, 2));
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
