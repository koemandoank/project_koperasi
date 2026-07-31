const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
BigInt.prototype.toJSON = function () { return this.toString(); };

const SYSTEM_PREFIXES = ['ADM','SAD','KAS','PEN','KET'];
function isSystemAccount(nik) { return SYSTEM_PREFIXES.some(p => nik.startsWith(p)); }

(async () => {
  const periodStart = new Date(2025, 9, 1);
  const periodEnd = new Date(2025, 10, 0, 23, 59, 59);
  const periodCode = `${periodStart.getFullYear()}-${String(periodStart.getMonth()+1).padStart(2,'0')}`;

  const swType = await prisma.saving_types.findFirst({ where: { code: 'SW' } });
  const swAmount = Number(swType.monthly_amount);

  const activeMembers = await prisma.members.findMany({
    where: { status: 'active' },
    include: { savings: { where: { saving_type_id: swType.id } } },
  });
  const eligibleIds = activeMembers.filter(m => !isSystemAccount(m.nik) && m.savings.length > 0).map(m => m.id);

  const existingTrx = await prisma.saving_transactions.findMany({
    where: { member_id: { in: eligibleIds }, savings: { saving_type_id: swType.id }, transaction_at: { gte: periodStart, lte: periodEnd }, type: 'salary_cut' },
    select: { member_id: true },
  });
  const alreadyPaid = new Set(existingTrx.map(t => t.member_id.toString()));
  const eligibleCount = eligibleIds.filter(id => !alreadyPaid.has(id.toString())).length;

  const pendingSchedules = await prisma.loan_schedules.findMany({
    where: { due_date: { gte: periodStart, lte: periodEnd }, status: { in: ['pending','partial','overdue'] }, loans: { repayment_method: 'salary_cut', status: 'active' } },
    select: { total_due: true, principal_paid: true, interest_paid: true },
  });
  const loanTotalEstimate = pendingSchedules.reduce((s, x) => s + Math.max(0, Number(x.total_due) - Number(x.principal_paid) - Number(x.interest_paid)), 0);

  console.log('Preview:', { eligibleCount, swTotal: swAmount * eligibleCount, scheduleCount: pendingSchedules.length, loanTotalEstimate });

  const batch = await prisma.payroll_batches.create({
    data: {
      period_code: periodCode,
      period_start: periodStart,
      period_end: periodEnd,
      status: 'draft',
      eligible_members: eligibleCount,
      sw_total_estimate: swAmount * eligibleCount,
      loan_schedule_count: pendingSchedules.length,
      loan_total_estimate: loanTotalEstimate,
      generated_by: 'cron',
    },
  });
  console.log('Draft created:', batch);

  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
