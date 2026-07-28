const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
BigInt.prototype.toJSON = function () { return this.toString(); };
(async () => {
  console.log('--- suppliers ---');
  console.log(JSON.stringify(await prisma.suppliers.findMany(), null, 2));
  console.log('--- existing purchase_orders ---');
  console.log(JSON.stringify(await prisma.purchase_orders.findMany({ include: { po_items: true } }), null, 2));
  console.log('--- existing accounts_payable ---');
  console.log(JSON.stringify(await prisma.accounts_payable.findMany(), null, 2));
  console.log('--- products (id,name,stock,min_stock,purchase_price) ---');
  console.log(JSON.stringify(await prisma.products.findMany({ select: { id: true, name: true, stock: true, min_stock: true, purchase_price: true, price: true } }), null, 2));
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
