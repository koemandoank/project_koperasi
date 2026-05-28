import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const spType = await prisma.saving_types.findFirst({ where: { code: "SP" } })
  console.log("SP Type:", JSON.stringify(spType, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
