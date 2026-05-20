const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.loan_payments.deleteMany();
  await prisma.loan_schedules.deleteMany();
  await prisma.loans.deleteMany();
  await prisma.loan_applications.deleteMany();
  console.log('Loans cleared');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
