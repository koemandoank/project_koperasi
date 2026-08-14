// FASE 0.1: Backup ringan sebelum mulai perbaikan kode (audit menyeluruh
// 29 Juli 2026). Bukan pengganti pg_dump penuh, tapi cukup untuk rollback
// manual/referensi kalau ada yang tidak sesuai rencana selama FASE 1-4.
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();
BigInt.prototype.toJSON = function () { return this.toString(); };

(async () => {
  const snapshot = {
    taken_at: new Date().toISOString(),
    reason: "Sebelum FASE 1-4 audit menyeluruh 29 Juli 2026 (BUG-06 dst.)",
    products: await prisma.products.findMany(),
    orders_count: await prisma.orders.count(),
    order_items_count: await prisma.order_items.count(),
    order_payments_count: await prisma.order_payments.count(),
    order_returns: await prisma.order_returns.findMany(),
    savings: await prisma.savings.findMany(),
    saving_transactions_count: await prisma.saving_transactions.count(),
    loans: await prisma.loans.findMany(),
    loan_schedules_count: await prisma.loan_schedules.count(),
    loan_payments_count: await prisma.loan_payments.count(),
    journal_entries: await prisma.journal_entries.findMany({ include: { journal_lines: true } }),
    members_count: await prisma.members.count(),
    stock_balances: await prisma.stock_balances.findMany(),
    payroll_batches: await prisma.payroll_batches.findMany(),
  };

  const outDir = path.join(__dirname, '..', 'docs', 'backups');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `snapshot-pre-fase1-audit-2026-07-29.json`);
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));

  console.log('Snapshot saved:', outPath);
  console.log('Summary:', {
    products: snapshot.products.length,
    orders: snapshot.orders_count,
    order_items: snapshot.order_items_count,
    order_payments: snapshot.order_payments_count,
    order_returns: snapshot.order_returns.length,
    savings: snapshot.savings.length,
    saving_transactions: snapshot.saving_transactions_count,
    loans: snapshot.loans.length,
    loan_schedules: snapshot.loan_schedules_count,
    loan_payments: snapshot.loan_payments_count,
    journal_entries: snapshot.journal_entries.length,
    members: snapshot.members_count,
    stock_balances: snapshot.stock_balances.length,
    payroll_batches: snapshot.payroll_batches.length,
  });

  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
