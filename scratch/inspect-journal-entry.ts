import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const entry = await prisma.journal_entries.findFirst({
    where: { entry_no: "TX-20260525-8623" },
    include: {
      journal_lines: {
        include: { chart_of_accounts: true }
      }
    }
  })

  console.log("Journal Entry Details:")
  console.log(JSON.stringify(entry, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value
  , 2))
}

main()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect())
