import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.consignment_items.findMany({ include: { products: true } });
  
  for (const i of items) {
    if (i.products) {
      const received = i.qty_received;
      const returned = i.qty_returned;
      const stock = i.products.stock;
      
      const expectedSold = received - returned - stock;
      if (expectedSold >= 0 && expectedSold !== i.qty_sold) {
        console.log(`Fixing ID ${i.id}: sold changed from ${i.qty_sold} to ${expectedSold}`);
        await prisma.consignment_items.update({
          where: { id: i.id },
          data: { qty_sold: expectedSold }
        });
      }
    }
  }
  console.log('Sync complete.');
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
