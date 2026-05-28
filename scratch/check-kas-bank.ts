import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ log: ['error'] })

async function main() {
  console.log('\n=== DEBUG: Kas & Bank COA and Journal Lines ===\n')

  try {
    // 1. Ambil akun aset
    const assetAccounts = await prisma.chart_of_accounts.findMany({
      where: { type: 'asset' }
    })
    console.log(`Total akun aset: ${assetAccounts.length}`)
    console.log('Daftar Akun Aset:')
    console.log(assetAccounts.map(a => `${a.id}: ${a.code} - ${a.name} (${a.normal_balance})`))

    const assetIds = assetAccounts.map(a => a.id)

    // 2. Cek baris jurnal (journal_lines) untuk akun-akun ini
    const lines = await prisma.journal_lines.findMany({
      where: { account_id: { in: assetIds } },
      include: {
        journal_entries: true
      }
    })
    console.log(`\nTotal baris jurnal terkait aset: ${lines.length}`)
    
    // Hitung total debit & credit
    let totalDebit = 0
    let totalCredit = 0
    let totalPostedDebit = 0
    let totalPostedCredit = 0

    for (const l of lines) {
      const isPosted = l.journal_entries.is_posted
      const debit = Number(l.debit)
      const credit = Number(l.credit)
      
      totalDebit += debit
      totalCredit += credit

      if (isPosted) {
        totalPostedDebit += debit
        totalPostedCredit += credit
      }
    }

    console.log(`Total Debit (Semua): ${totalDebit}`)
    console.log(`Total Credit (Semua): ${totalCredit}`)
    console.log(`Total Debit (Posted Only): ${totalPostedDebit}`)
    console.log(`Total Credit (Posted Only): ${totalPostedCredit}`)
    console.log(`Total Kas & Bank (Posted Debit - Posted Credit): ${totalPostedDebit - totalPostedCredit}`)

    // 3. Cek apakah ada journal entries yang is_posted = true secara umum
    const postedEntriesCount = await prisma.journal_entries.count({
      where: { is_posted: true }
    })
    const totalEntriesCount = await prisma.journal_entries.count()
    console.log(`\nTotal Journal Entries di DB: ${totalEntriesCount}`)
    console.log(`Total Journal Entries yang POSTED: ${postedEntriesCount}`)

  } catch (err) {
    console.error('ERROR:', err)
  } finally {
    await prisma.$disconnect()
  }
}

main()
