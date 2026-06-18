import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
function getRandomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}
async function main() {
  console.log('Generating dummy transactions from 2026-06-04 to 2026-06-15...');
  const kasir = await prisma.user.findFirst({ where: { username: 'kasir01' } });
  const pengurus = await prisma.user.findFirst({ where: { username: 'pengurus01' } });
  if (!kasir || !pengurus) return console.error('Missing kasir01 or pengurus01');
  const members = await prisma.member.findMany({ take: 30 });
  const products = await prisma.products.findMany({ take: 10, where: { is_active: true } });
  const unit = await prisma.unit.findFirst();
  if (members.length === 0 || products.length === 0) return console.error('Missing data');
  const startDate = new Date('2026-06-04T08:00:00Z');
  const endDate = new Date('2026-06-15T17:00:00Z');
  let orderCount = 0, savingCount = 0, loanPayCount = 0;
  for (let m = 0; m < members.length; m++) {
    const member = members[m];
    const numOrders = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < numOrders; i++) {
      const orderDate = getRandomDate(startDate, endDate);
      const product = products[Math.floor(Math.random() * products.length)];
      const qty = Math.floor(Math.random() * 3) + 1;
      const total = Number(product.price) * qty;
      const order = await prisma.orders.create({ data: { order_no: `ORD-${Date.now()}-${m}-${i}`, member_id: member.id, unit_id: unit?.id || 1n, ordered_at: orderDate, subtotal: total, discount: 0, grand_total: total, payment_method: 'cash', payment_status: 'paid', order_status: 'delivered', cashier_id: kasir.id, created_at: orderDate, updated_at: orderDate } });
      await prisma.order_items.create({ data: { order_id: order.id, product_id: product.id, product_name: product.name, qty, unit_price: product.price, subtotal: total } });
      orderCount++;
    }
    const saveDate = getRandomDate(startDate, endDate);
    const sukarelaType = await prisma.saving_types.findFirst({ where: { code: 'SS' } });
    const memberSukarela = await prisma.savings.findFirst({ where: { member_id: member.id, saving_type_id: sukarelaType?.id || 1n } });
    if (sukarelaType && memberSukarela) {
      const amount = 50000;
      await prisma.saving_transactions.create({ data: { savings_id: memberSukarela.id, member_id: member.id, type: 'deposit', amount, balance_before: memberSukarela.balance, balance_after: Number(memberSukarela.balance) + amount, reference_no: `DEP-SS-${Date.now()}-${m}`, note: 'Setoran Sukarela dummy', processed_by: kasir.id, transaction_at: saveDate, created_at: saveDate, updated_at: saveDate } });
      await prisma.savings.update({ where: { id: memberSukarela.id }, data: { balance: { increment: amount }, total_deposit: { increment: amount } } });
      savingCount++;
    }
    const activeLoan = await prisma.loans.findFirst({ where: { member_id: member.id, status: 'active' } });
    if (activeLoan) {
      const payDate = getRandomDate(startDate, endDate);
      const amount = Number(activeLoan.monthly_installment) || 100000;
      await prisma.loan_payments.create({ data: { loan_id: activeLoan.id, payment_no: `PAY-${Date.now()}-${m}`, amount_paid: amount, principal_portion: amount * 0.8, interest_portion: amount * 0.2, penalty_amount: 0, payment_method: 'cash', processed_by: kasir.id, paid_at: payDate, note: 'Angsuran Dummy', created_at: payDate, updated_at: payDate } });
      await prisma.loans.update({ where: { id: activeLoan.id }, data: { total_paid: { increment: amount }, outstanding_principal: { decrement: amount * 0.8 } } });
      loanPayCount++;
    }
  }
  console.log(`Generated:\n  ( ${orderCount} POS Orders by Kasir01\n  - ${savingCount} Saving Deposits by Kasir01\n  - ${loanPayCount} Loan Payments by Kasir01`);
}
main().catch(e => console.error(e)).finally(async () => await prisma.$disconnect());