import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ log: ['error'] })

async function main() {
  console.log('\n=== DEBUG: Detil Journal Lines Aset ===\n')

  try {
    const lines = await prisma.journal_lines.findMany({
      where: {
        chart_of_accounts: { type: 'asset' }
      },
      include: {
        chart_of_accounts: true,
        journal_entries: true
      }
    })

    console.log(`Daftar Journal Lines:`)
    for (const l of lines) {
      console.log(`Jurnal ID: ${l.journal_id} (${l.journal_entries.entry_no})`)
      console.log(`Tanggal: ${l.journal_entries.entry_date.toISOString().split('T')[0]}`)
      console.log(`Keterangan Jurnal: ${l.journal_entries.description}`)
      console.log(`Keterangan Baris: ${l.description}`)
      console.log(`Akun: ${l.chart_of_accounts.code} - ${l.chart_of_accounts.name}`)
      console.log(`Debit: ${l.debit}, Credit: ${l.credit}`)
      console.log('--------------------------------------------------')
    }

  } catch (err) {
    console.error('ERROR:', err)
  } finally {
    await prisma.$disconnect()
  }
}

main()
