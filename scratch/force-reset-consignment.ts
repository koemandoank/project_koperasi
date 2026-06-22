import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const products = await prisma.products.findMany({
    where: { product_categories: { slug: 'konsinyasi' } }
  })
  
  for (const p of products) {
    await prisma.products.update({
      where: { id: p.id },
      data: { restock_requested: false }
    })
    console.log(`Reset restock_requested for: ${p.name}`)
  }
  console.log('Done reset.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
