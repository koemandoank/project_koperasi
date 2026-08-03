const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const negBal = await p.savings.count({ where: { balance: { lt: 0 } } });
  const swCount = await p.saving_transactions.count({ where: { type: 'withdraw', note: { contains: 'POS' } } });
  console.log('Saldo simpanan negatif:', negBal, '| Transaksi withdraw baru terkait POS:', swCount, '(harusnya 0, kita tidak sentuh)');
  await p.$disconnect();
})();
