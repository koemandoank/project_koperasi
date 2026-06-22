import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    select: {
      role: true
    }
  })
  
  const roles = new Set(users.map(u => String(u.role)))
  console.log("Distinct roles in DB:", Array.from(roles))
  
  const roleCounts: Record<string, number> = {}
  for (const u of users) {
    const roleStr = String(u.role)
    roleCounts[roleStr] = (roleCounts[roleStr] || 0) + 1
  }
  console.log("User counts per role:", roleCounts)
}

main()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect())
