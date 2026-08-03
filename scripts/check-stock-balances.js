const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
BigInt.prototype.toJSON = function () { return this.toString(); };
(async () => {
  const totalBalances = await prisma.stock_balances.count();
  console.log('Total baris stock_balances:', totalBalances);

  const sample = await prisma.products.findMany({ take: 5, include: { stock_balances: true } });
  console.log(JSON.stringify(sample.map(p => ({ id: p.id, name: p.name, stock: p.stock, stock_balances: p.stock_balances })), null, 2));

  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
