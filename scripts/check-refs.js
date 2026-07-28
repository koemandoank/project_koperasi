const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
BigInt.prototype.toJSON = function () { return this.toString(); };
(async () => {
  console.log('--- loan_products ---');
  console.log(JSON.stringify(await prisma.loan_products.findMany(), null, 2));
  console.log('--- units ---');
  console.log(JSON.stringify(await prisma.units.findMany(), null, 2));
  console.log('--- saving_types ---');
  console.log(JSON.stringify(await prisma.saving_types.findMany(), null, 2));
  console.log('--- app_settings (loan_rules) ---');
  console.log(JSON.stringify(await prisma.app_settings.findMany(), null, 2));
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
