import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  await prisma.products.updateMany({
    where: { product_categories: { slug: 'konsinyasi' } },
    data: { restock_requested: false }
  })
  console.log('Fixed stuck items')
}

main().catch(console.error).finally(()=>prisma.$disconnect())
