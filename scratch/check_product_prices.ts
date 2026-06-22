import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("=== CHECKING PRODUCT PRICES AND STOCKS ===")
  const products = await prisma.products.findMany({
    select: {
      id: true,
      sku: true,
      name: true,
      stock: true,
      purchase_price: true,
      price: true,
    },
    take: 30
  })

  products.forEach(p => {
    console.log(`- ID: ${p.id}, SKU: ${p.sku}, Name: ${p.name}, Stock: ${p.stock}, Purchase Price: ${p.purchase_price}, Price: ${p.price}`)
  })
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
