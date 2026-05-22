import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const members = await prisma.member.findMany({
    where: { photo_path: { not: null } },
    select: { id: true, full_name: true, photo_path: true },
  })
  console.log("=== Member Photos ===")
  members.forEach(m => console.log(`ID:${m.id} | ${m.full_name} | ${m.photo_path}`))
  console.log(`Total: ${members.length}`)
}

main().finally(() => prisma.$disconnect())
