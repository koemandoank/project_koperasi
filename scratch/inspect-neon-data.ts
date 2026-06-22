import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("=== NEON POSTGRES PRODUCTS ===");
  const products = await prisma.products.findMany();
  for (const p of products) {
    console.log(`SKU: ${p.sku} | Name: ${p.name} | Price: ${p.price} | Stock: ${p.stock}`);
  }
  
  console.log("\n=== NEON POSTGRES LOAN PRODUCTS ===");
  const loanProducts = await prisma.loan_products.findMany();
  for (const lp of loanProducts) {
    console.log(`Code: ${lp.code} | Name: ${lp.name} | Rate: ${lp.interest_rate}%`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
