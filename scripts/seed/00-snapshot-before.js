// Snapshot ringan sebelum seeding — bukan pengganti pg_dump penuh, tapi cukup
// untuk audit trail & rollback manual kalau perlu (catat semua ID row lama).
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();
BigInt.prototype.toJSON = function () { return this.toString(); };

(async () => {
  const snapshot = {
    taken_at: new Date().toISOString(),
    members: await prisma.members.findMany({ select: { id: true, member_code: true } }),
    users: await prisma.users.findMany({ select: { id: true, username: true, role: true } }),
    savings: await prisma.savings.findMany({ select: { id: true, member_id: true, saving_type_id: true, balance: true } }),
    saving_transactions_count: await prisma.saving_transactions.count(),
    loan_applications: await prisma.loan_applications.findMany({ select: { id: true, status: true } }),
    loans: await prisma.loans.findMany({ select: { id: true, loan_no: true, status: true } }),
    orders_count: await prisma.orders.count(),
    products: await prisma.products.findMany({ select: { id: true, name: true, stock: true } }),
    purchase_orders: await prisma.purchase_orders.findMany({ select: { id: true } }),
    accounts_payable: await prisma.accounts_payable.findMany({ select: { id: true } }),
  };
  const outDir = path.join(__dirname, '..', '..', 'docs', 'backups');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `snapshot-pre-seed-2026-07-28.json`);
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
  console.log('Snapshot saved to', outPath);
  console.log('Summary:', {
    members: snapshot.members.length,
    users: snapshot.users.length,
    savings: snapshot.savings.length,
    saving_transactions: snapshot.saving_transactions_count,
    loan_applications: snapshot.loan_applications.length,
    loans: snapshot.loans.length,
    orders: snapshot.orders_count,
    products: snapshot.products.length,
    purchase_orders: snapshot.purchase_orders.length,
    accounts_payable: snapshot.accounts_payable.length,
  });
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
