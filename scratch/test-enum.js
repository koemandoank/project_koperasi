const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  console.log(prisma.stock_movements_type);
}
run();
