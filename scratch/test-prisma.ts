import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
p.loans.count().then(c => {
  console.log('Loan count via Prisma:', c)
  p.$disconnect()
}).catch(e => {
  console.error(e)
  p.$disconnect()
})
