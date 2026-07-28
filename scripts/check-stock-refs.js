const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const products = await prisma.products.findMany({ select: { id: true, name: true, stock: true, min_stock: true } });
  const totalStock = products.reduce((a, p) => a + p.stock, 0);
  console.log('Total products:', products.length, '| Total stock units:', totalStock);
  console.log('Low/zero stock:', products.filter(p => p.stock <= (p.min_stock || 0)).map(p => `${p.name}:${p.stock}`));
  const lastMember = await prisma.members.findFirst({ orderBy: { member_code: 'desc' }, select: { member_code: true } });
  console.log('Last member_code:', lastMember?.member_code);
  const lastOrder = await prisma.orders.findFirst({ orderBy: { id: 'desc' }, select: { order_no: true, created_at: true } });
  console.log('Last order_no:', lastOrder?.order_no, lastOrder?.created_at);
  const usersByRole = await prisma.users.groupBy({ by: ['role'], _count: true });
  console.log('Users by role:', usersByRole);
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
