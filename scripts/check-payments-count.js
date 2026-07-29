const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  console.log('order_payments count:', await prisma.order_payments.count());
  await prisma.$disconnect();
})();
