const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const counts = {};
  counts.members = await prisma.members.count();
  counts.users = await prisma.users.count();
  counts.saving_types = await prisma.saving_types.count();
  counts.savings = await prisma.savings.count();
  counts.saving_transactions = await prisma.saving_transactions.count();
  counts.loan_products = await prisma.loan_products.count();
  counts.loan_applications = await prisma.loan_applications.count();
  counts.loans = await prisma.loans.count();
  counts.orders = await prisma.orders.count();
  counts.products = await prisma.products.count();
  counts.purchase_orders = await prisma.purchase_orders.count();
  counts.accounts_payable = await prisma.accounts_payable.count();
  console.log(JSON.stringify(counts, null, 2));
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
