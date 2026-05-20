import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.consignment_items.findMany({ include: { products: true } });
  
  for (const i of items) {
    if (i.products) {
      const received = i.qty_received;
      const returned = i.qty_returned;
      const sold = i.qty_sold; // This was just synced
      
      const expectedStock = received - sold - returned;
      
      if (expectedStock !== i.products.stock) {
        console.log(`Fixing product ${i.products.name} stock from ${i.products.stock} to ${expectedStock}`);
        await prisma.products.update({
          where: { id: i.products.id },
          data: { stock: expectedStock }
        });
      }
    }
  }
  console.log('Stock sync complete.');
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
