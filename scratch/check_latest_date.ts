import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const savings = await prisma.saving_transactions.findFirst({ orderBy: { transaction_at: 'desc' } });
    console.log('Latest SavingTransaction:', savings?.transaction_at);

    const loanPay = await prisma.loan_payments.findFirst({ orderBy: { paid_at: 'desc' } });
    console.log('Latest LoanPayment:', loanPay?.paid_at);

    const orders = await prisma.orders.findFirst({ orderBy: { created_at: 'desc' } });
    console.log('Latest Order:', orders?.created_at);

  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();