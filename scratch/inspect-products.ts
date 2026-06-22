import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const products = await prisma.loan_products.findMany()
  console.log(JSON.stringify(products, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
