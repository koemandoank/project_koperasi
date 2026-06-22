import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const payments = await prisma.loan_payments.findMany({
    where: { loan_id: 63 }, // Irfan Maulana (LN-2603-12)
    orderBy: { paid_at: 'asc' }
  })

  console.log(`=== PAYMENTS FOR LOAN LN-2603-12 (Irfan Maulana) ===`)
  for (const p of payments) {
    console.log(`ID: ${p.id} | No: ${p.payment_no} | Paid At: ${p.paid_at.toISOString().split('T')[0]} | Amount: Rp ${Number(p.amount_paid).toLocaleString('id-ID')} | Principal: Rp ${Number(p.principal_portion).toLocaleString('id-ID')} | Interest: Rp ${Number(p.interest_portion).toLocaleString('id-ID')} | Ref: ${p.reference}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
