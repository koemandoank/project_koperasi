import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const registers = await prisma.cash_registers.findMany()
  console.log("=== Cash Registers ===")
  console.log(registers)

  const sessions = await prisma.cash_register_sessions.findMany({
    orderBy: { session_date: "desc" },
    take: 10
  })
  console.log("\n=== Recent Cash Register Sessions ===")
  for (const s of sessions) {
    console.log(`ID: ${s.id} | Register ID: ${s.cash_register_id} | Date: ${s.session_date.toISOString().split('T')[0]} | Status: ${s.status} | Open Bal: ${s.opening_balance} | Close Bal: ${s.closing_balance} | Opened: ${s.opened_at}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
