const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
BigInt.prototype.toJSON = function () { return this.toString(); };

const SYSTEM_PREFIXES = ['ADM','SAD','KAS','PEN','KET'];
function isSystemAccount(nik) { return SYSTEM_PREFIXES.some(p => nik.startsWith(p)); }

(async () => {
  const startDate = new Date('2026-07-01T00:00:00+07:00');
  const endDate = new Date('2026-07-31T23:59:59.999+07:00');
  const periodCode = `${startDate.getFullYear()}${String(startDate.getMonth()+1).padStart(2,'0')}`;
  const userId = '1'; // dummy utk simulasi

  const swType = await prisma.saving_types.findFirst({ where: { code: 'SW' } });
  const swAmount = Number(swType.monthly_amount);
  console.log('SW amount:', swAmount);

  const activeMembers = await prisma.members.findMany({
    where: { status: 'active' },
    include: { savings: { where: { saving_type_id: swType.id } } },
  });
  const eligibleMemberIds = activeMembers.filter(m => !isSystemAccount(m.nik) && m.savings.length > 0).map(m => m.id);

  const existingTrxThisMonth = await prisma.saving_transactions.findMany({
    where: { member_id: { in: eligibleMemberIds }, savings: { saving_type_id: swType.id }, transaction_at: { gte: startDate, lte: endDate }, type: 'salary_cut' },
    select: { member_id: true },
  });
  const alreadyPaid = new Set(existingTrxThisMonth.map(t => t.member_id.toString()));
  const membersNeedingSw = activeMembers.filter(m => !isSystemAccount(m.nik) && m.savings.length > 0 && !alreadyPaid.has(m.id.toString()));
  console.log('membersNeedingSw:', membersNeedingSw.length);

  const pendingSchedules = await prisma.loan_schedules.findMany({
    where: { due_date: { gte: startDate, lte: endDate }, status: { in: ['pending','partial','overdue'] }, loans: { repayment_method: 'salary_cut', status: 'active' } },
    include: { loans: true },
  });
  console.log('pendingSchedules:', pendingSchedules.length);

  // Simulasikan TRANSAKSI PERSIS seperti processMonthlyPayrollBatch, tapi
  // di dalam try-catch supaya errornya kelihatan, dan di akhir SENGAJA throw
  // supaya rollback (tidak benar2 menulis data) - murni diagnostik.
  try {
    await prisma.$transaction(async (tx) => {
      const payrollDate = new Date(startDate.getFullYear(), startDate.getMonth(), 25, 10, 0, 0);

      if (membersNeedingSw.length > 0) {
        const swTxRows = membersNeedingSw.map(member => {
          const savingsRecord = member.savings[0];
          const balanceBefore = Number(savingsRecord.balance);
          const balanceAfter = balanceBefore + swAmount;
          return {
            savings_id: savingsRecord.id, member_id: member.id, type: 'salary_cut', amount: swAmount,
            balance_before: balanceBefore, balance_after: balanceAfter,
            reference_no: `PAYROLL-SW-${member.member_code}-${periodCode}`,
            note: `Test`, processed_by: BigInt(userId),
            transaction_at: payrollDate, created_at: payrollDate, updated_at: payrollDate,
          };
        });
        await tx.saving_transactions.createMany({ data: swTxRows });
        const savingsIds = membersNeedingSw.map(m => m.savings[0].id);
        await tx.savings.updateMany({ where: { id: { in: savingsIds } }, data: { balance: { increment: swAmount }, total_deposit: { increment: swAmount }, updated_at: new Date() } });
        console.log('SW batch OK:', membersNeedingSw.length);
      }

      let totalPrincipal = 0, totalInterest = 0, loansCount = 0, loansAmount = 0;
      for (const schedule of pendingSchedules) {
        const loan = schedule.loans;
        const remainingAmount = Number(schedule.total_due) - Number(schedule.principal_paid) - Number(schedule.interest_paid);
        if (remainingAmount <= 0) continue;
        const outstanding = Number(loan.outstanding_principal);
        const interestPortion = Math.max(0, Number(schedule.interest_due) - Number(schedule.interest_paid));
        const principalPortion = remainingAmount - interestPortion;
        const safePrincipalPortion = Math.min(outstanding, Math.max(0, principalPortion));
        const paymentNo = `PAY-BATCH-TEST-${loan.loan_no}`;
        await tx.loan_payments.create({ data: {
          loan_id: loan.id, schedule_id: schedule.id, payment_no: paymentNo, amount_paid: remainingAmount,
          principal_portion: safePrincipalPortion, interest_portion: interestPortion, penalty_amount: 0,
          payment_method: 'salary_cut', reference: `BATCH-TEST-${periodCode}`, processed_by: BigInt(userId),
          paid_at: payrollDate, note: 'test', created_at: payrollDate, updated_at: payrollDate,
        }});
        await tx.loan_schedules.update({ where: { id: schedule.id }, data: { status: 'paid', paid_at: payrollDate, principal_paid: Number(schedule.principal_due), interest_paid: Number(schedule.interest_due), updated_at: new Date() } });
        const nextOutstanding = Math.max(0, outstanding - safePrincipalPortion);
        await tx.loans.update({ where: { id: loan.id }, data: { outstanding_principal: nextOutstanding, total_paid: { increment: remainingAmount }, status: nextOutstanding <= 0 ? 'paid_off' : loan.status, updated_at: new Date() } });
        loansCount++; loansAmount += remainingAmount; totalPrincipal += safePrincipalPortion; totalInterest += interestPortion;
      }
      console.log('Loan batch OK:', loansCount, loansAmount);

      const totalCollected = (swAmount * membersNeedingSw.length) + totalPrincipal + totalInterest;
      if (totalCollected > 0) {
        const unit = await tx.units.findFirst();
        const unitId = unit ? unit.id : BigInt(1);
        console.log('Unit found:', unit ? unit.id.toString() : 'NONE, fallback 1');

        const coaBank = await tx.chart_of_accounts.findFirst({ where: { unit_id: unitId, code: '10104' } })
          || await tx.chart_of_accounts.findFirst({ where: { unit_id: unitId, code: '10102' } })
          || await tx.chart_of_accounts.findFirst({ where: { unit_id: unitId, type: 'asset' } });
        const coaRevenue = await tx.chart_of_accounts.findFirst({ where: { unit_id: unitId, code: '40101' } })
          || await tx.chart_of_accounts.findFirst({ where: { unit_id: unitId, type: 'revenue' } });
        console.log('coaBank:', coaBank ? coaBank.code : 'TIDAK DITEMUKAN');
        console.log('coaRevenue:', coaRevenue ? coaRevenue.code : 'TIDAK DITEMUKAN');

        if (!coaBank || !coaRevenue) {
          console.log('!!! JURNAL DI-SKIP karena COA bank/revenue tidak ditemukan !!!');
        }
      }

      throw new Error('ROLLBACK_INTENTIONAL_TEST');
    }, { maxWait: 15000, timeout: 30000 });
  } catch (e) {
    if (e.message === 'ROLLBACK_INTENTIONAL_TEST') {
      console.log('\n=== SIMULASI SUKSES (rollback disengaja, tidak ada data ditulis) ===');
    } else {
      console.error('\n!!! ERROR ASLI TERTANGKAP !!!');
      console.error(e);
    }
  }

  await prisma.$disconnect();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
