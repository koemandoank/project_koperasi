import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("=== SALSABILA PUTRI APPLICATIONS ===")
  const apps = await prisma.loan_applications.findMany({
    where: { member_id: BigInt(15) },
    include: { loan_products: true }
  })
  for (const app of apps) {
    console.log(`ID: ${app.id} | No: ${app.application_no} | Product: ${app.loan_products.name} (${app.loan_products.code}) | Purpose: ${app.purpose} | Amount: Rp ${Number(app.amount_requested).toLocaleString("id-ID")} | Status: ${app.status}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
