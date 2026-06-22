import { PrismaClient } from '@prisma/client'; 
const prisma = new PrismaClient(); 

async function main() {
  const prod = await prisma.products.findFirst({where: {sku: 'BRG-00026'}})
  console.log(prod);
}

main().finally(() => prisma.$disconnect());
