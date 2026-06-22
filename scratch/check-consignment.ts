import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.consignment_items.findMany({ include: { products: true } });
  
  console.log('CONSIGNMENT ITEMS:');
  items.forEach(i => {
    console.log(`- ID: ${i.id}, Product: ${i.products?.name}, Received: ${i.qty_received}, Sold: ${i.qty_sold}, Returned: ${i.qty_returned}, Remaining Calc: ${i.qty_received - i.qty_sold - i.qty_returned}, Actual Stock: ${i.products?.stock}`);
  });
}

main().finally(() => prisma.$disconnect());
