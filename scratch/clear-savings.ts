import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.saving_transactions.deleteMany();
  await prisma.savings.deleteMany();
  console.log('Deleted savings and transactions');
}
main().finally(()=>prisma.$disconnect());
