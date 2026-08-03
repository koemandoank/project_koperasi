const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  // 497 order pertama = baseline sebelum seeding saya
  const oldOrders = await prisma.orders.findMany({ orderBy: { id: 'asc' }, take: 497, select: { id: true } });
  const boundaryId = oldOrders[oldOrders.length - 1].id;
  const oldSavingDeduct = await prisma.orders.count({ where: { id: { lte: boundaryId }, payment_method: 'saving_deduct', payment_status: 'paid' } });
  const oldSavingDeductWithPayment = await prisma.orders.count({ where: { id: { lte: boundaryId }, payment_method: 'saving_deduct', payment_status: 'paid', order_payments: { some: {} } } });
  console.log('Order lama (sebelum seeding) payment_method=saving_deduct & paid:', oldSavingDeduct);
  console.log('...yang punya order_payments:', oldSavingDeductWithPayment);
  await prisma.$disconnect();
})();
