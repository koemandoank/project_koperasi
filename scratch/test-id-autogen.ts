import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("Testing PostgreSQL sequence autoincrement...");
  
  // 1. Test product_categories
  try {
    console.log("Creating dummy product category...");
    const cat = await prisma.product_categories.create({
      data: {
        name: "Dummy Category",
        slug: `dummy-category-${Date.now()}`,
        is_active: false
      }
    });
    console.log(`Success! Created dummy category with ID: ${cat.id}`);
    
    // Clean up
    await prisma.product_categories.delete({
      where: { id: cat.id }
    });
    console.log("Cleaned up dummy category.");
  } catch (e: any) {
    console.error("❌ Error in product_categories auto-generation:", e.message);
  }
  
  // 2. Test loan_products
  try {
    console.log("Creating dummy loan product...");
    const lp = await prisma.loan_products.create({
      data: {
        code: `LP-D-${Date.now().toString().slice(-8)}`,
        name: "Dummy Loan Product",
        interest_rate: 1.5,
        interest_method: 'flat',
        max_tenor: 12,
        max_amount: 1000000.00,
        is_active: false
      }
    });
    console.log(`Success! Created dummy loan product with ID: ${lp.id}`);
    
    // Clean up
    await prisma.loan_products.delete({
      where: { id: lp.id }
    });
    console.log("Cleaned up dummy loan product.");
  } catch (e: any) {
    console.error("❌ Error in loan_products auto-generation:", e.message);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
