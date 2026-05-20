import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const products = await prisma.products.findMany({
    where: { name: { contains: 'Aoka' } },
    include: { product_categories: true }
  })
  console.log('PRODUCTS FOUND FOR AOKA:', JSON.stringify(products, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
