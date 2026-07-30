const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const swType = await prisma.saving_types.findFirst({ where: { code: 'SW' } });
  console.log('SW type:', swType?.code, swType?.monthly_amount);

  const activeMembers = await prisma.members.findMany({
    where: { status: 'active' },
    include: { savings: { where: { saving_type_id: swType.id } } },
  });
  const eligible = activeMembers.filter(m => {
    const sys = ['ADM','SAD','KAS','PEN','KET'].some(p => m.nik.startsWith(p));
    return !sys && m.savings.length > 0;
  });
  console.log('Total active members:', activeMembers.length, '| Eligible for SW cut:', eligible.length);

  const startDate = new Date('2025-10-01T00:00:00+07:00');
  const endDate = new Date('2025-10-31T23:59:59+07:00');
  const pendingSchedules = await prisma.loan_schedules.findMany({
    where: {
      due_date: { gte: startDate, lte: endDate },
      status: { in: ['pending','partial','overdue'] },
      loans: { repayment_method: 'salary_cut', status: 'active' },
    },
  });
  console.log('Pending salary_cut loan schedules (Okt 2025):', pendingSchedules.length);

  const estimatedQueriesOld = eligible.length * 2 + pendingSchedules.length * 3 + 10;
  const estimatedQueriesNew = 2 + pendingSchedules.length * 3 + 10;
  console.log('Estimasi query di dalam transaksi - SEBELUM fix:', estimatedQueriesOld, '| SESUDAH fix:', estimatedQueriesNew);

  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
