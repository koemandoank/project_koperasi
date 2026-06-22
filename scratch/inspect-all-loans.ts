import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("=== LISTING ALL LOANS IN DATABASE ===")
  const allLoans = await prisma.loans.findMany({
    include: {
      members: { select: { full_name: true } }
    },
    orderBy: { id: 'asc' }
  })

  for (const l of allLoans) {
    console.log(`ID: ${l.id} | No: ${l.loan_no} | Member: ${l.members?.full_name} | Status: ${l.status} | Plafon: Rp ${Number(l.principal).toLocaleString('id-ID')} | Outstanding: Rp ${Number(l.outstanding_principal).toLocaleString('id-ID')}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
