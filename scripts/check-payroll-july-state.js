const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
BigInt.prototype.toJSON = function () { return this.toString(); };
(async () => {
  const periodStart = new Date('2026-07-01T00:00:00+07:00');
  const periodEnd = new Date('2026-07-31T23:59:59+07:00');

  const swTx = await prisma.saving_transactions.count({
    where: { type: 'salary_cut', transaction_at: { gte: periodStart, lte: periodEnd } },
  });
  console.log('saving_transactions type=salary_cut Jul 2026:', swTx);

  const loanPay = await prisma.loan_payments.count({
    where: { payment_method: 'salary_cut', paid_at: { gte: periodStart, lte: periodEnd } },
  });
  console.log('loan_payments method=salary_cut Jul 2026:', loanPay);

  const journal = await prisma.journal_entries.findUnique({ where: { entry_no: 'TX-PAYROLL-202607' } });
  console.log('journal_entries TX-PAYROLL-202607:', journal ? 'ADA' : 'tidak ada');

  const pendingSchedules = await prisma.loan_schedules.findMany({
    where: {
      due_date: { gte: periodStart, lte: periodEnd },
      status: { in: ['pending','partial','overdue'] },
      loans: { repayment_method: 'salary_cut', status: 'active' },
    },
    include: { loans: { select: { loan_no: true, member_id: true, outstanding_principal: true } } },
  });
  console.log('Pending salary_cut schedules Jul 2026:', pendingSchedules.length);
  console.log(JSON.stringify(pendingSchedules.slice(0, 3), null, 2));

  await prisma.$disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
