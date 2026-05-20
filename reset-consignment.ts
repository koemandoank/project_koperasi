import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("Resetting consignment returns for testing...");
  
  // Find Roti Aoka
  const aoka = await prisma.products.findFirst({ where: { name: "Roti Aoka" } });
  if (aoka) {
    const consignment = await prisma.consignment_items.findFirst({ where: { product_id: aoka.id } });
    if (consignment) {
      // Reset qty_returned to 0
      await prisma.consignment_items.update({
        where: { id: consignment.id },
        data: { qty_returned: 0 }
      });
      console.log(`Reset Roti Aoka qty_returned to 0 (was ${consignment.qty_returned})`);
      
      // Calculate new expected stock
      // Roti aoka had received 102, sold 0. So expected stock is 102.
      const expectedStock = consignment.qty_received - consignment.qty_sold;
      await prisma.products.update({
        where: { id: aoka.id },
        data: { stock: expectedStock }
      });
      console.log(`Reset Roti Aoka stock to ${expectedStock}`);
    }
  }

  // Also fix "Obat Kuat" if they were messed up
  const obatKuat = await prisma.products.findFirst({ where: { name: "Obat Kuat" } });
  if (obatKuat) {
     const consignments = await prisma.consignment_items.findMany({ where: { product_id: obatKuat.id } });
     let totalReceived = 0;
     let totalSold = 0;
     for (const c of consignments) {
        totalReceived += c.qty_received;
        // Let's reset sold and returned to 0 for Obat Kuat just to be clean
        await prisma.consignment_items.update({
          where: { id: c.id },
          data: { qty_sold: 0, qty_returned: 0 }
        });
     }
     
     if (consignments.length > 0) {
       await prisma.products.update({
         where: { id: obatKuat.id },
         data: { stock: totalReceived }
       });
       console.log(`Reset Obat Kuat stock to ${totalReceived}`);
     }
  }

  console.log("Reset complete.");
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
