const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
BigInt.prototype.toJSON = function () { return this.toString(); };
(async () => {
  const total = await prisma.orders.count();
  const withPayments = await prisma.orders.count({ where: { order_payments: { some: {} } } });
  const withItems = await prisma.orders.count({ where: { order_items: { some: {} } } });
  const dateRange = await prisma.orders.aggregate({ _min: { ordered_at: true }, _max: { ordered_at: true } });
  const itemCount = await prisma.order_items.count();
  console.log({ total, withPayments, withItems, itemCount, dateRange });
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
