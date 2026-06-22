import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      is_active: true
    },
    orderBy: { id: 'asc' }
  })
  
  console.log("All users in DB:")
  console.table(users.map(u => ({
    id: Number(u.id),
    username: u.username,
    email: u.email,
    role: u.role,
    is_active: u.is_active
  })))
}

main()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect())
