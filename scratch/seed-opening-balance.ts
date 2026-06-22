import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log("=== SEEDING OPENING BALANCE & EQUITY COA ===")

  // 1. Dapatkan Unit ID 1 (Kantor Pusat)
  const unit = await prisma.unit.findFirst({
    where: { code: 'U-001' }
  })
  if (!unit) {
    throw new Error("Unit U-001 (Kantor Pusat) tidak ditemukan di database.")
  }
  const unitId = unit.id

  // 2. Cari atau Buat COA Modal Awal (Equity)
  let equityCoa = await prisma.chart_of_accounts.findFirst({
    where: { code: '30101', unit_id: unitId }
  })

  if (!equityCoa) {
    equityCoa = await prisma.chart_of_accounts.create({
      data: {
        unit_id: unitId,
        code: '30101',
        name: 'Modal Awal Pendirian Koperasi',
        type: 'equity',
        normal_balance: 'credit',
        level: 1,
        is_header: false,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    })
    console.log(`✅ Berhasil membuat COA Equity: ${equityCoa.code} - ${equityCoa.name}`)
  } else {
    console.log(`ℹ️ COA Equity ${equityCoa.code} sudah ada.`)
  }

  // 3. Ambil COA Kas Utama, Mandiri, BCA
  const kasUtama = await prisma.chart_of_accounts.findFirst({ where: { code: '10101', unit_id: unitId } })
  const bankMandiri = await prisma.chart_of_accounts.findFirst({ where: { code: '10102', unit_id: unitId } })
  const bankBca = await prisma.chart_of_accounts.findFirst({ where: { code: '10103', unit_id: unitId } })

  if (!kasUtama || !bankMandiri || !bankBca) {
    throw new Error("COA Kas Utama (10101), Bank Mandiri (10102), atau Bank BCA (10103) tidak ditemukan.")
  }

  // 4. Cek Jurnal Saldo Awal
  const entryNo = 'TX-OP-2026-0001'
  const existingEntry = await prisma.journal_entries.findUnique({
    where: { entry_no: entryNo }
  })

  if (!existingEntry) {
    // Jalankan dalam $transaction agar aman
    await prisma.$transaction(async (tx) => {
      const entry = await tx.journal_entries.create({
        data: {
          unit_id: unitId,
          entry_no: entryNo,
          entry_date: new Date('2026-01-01'),
          description: 'Pencatatan Saldo Awal Kas/Bank & Modal Pendirian Koperasi',
          source: 'manual',
          is_posted: true,
          posted_at: new Date('2026-01-01'),
          created_at: new Date(),
          updated_at: new Date()
        }
      })

      // Buat journal lines (debit kas/bank, credit equity)
      await tx.journal_lines.createMany({
        data: [
          {
            journal_id: entry.id,
            account_id: kasUtama.id,
            debit: 500000000.00,
            credit: 0.00,
            description: 'Saldo Awal Kas Utama Koperasi',
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            journal_id: entry.id,
            account_id: bankMandiri.id,
            debit: 300000000.00,
            credit: 0.00,
            description: 'Saldo Awal Bank Mandiri',
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            journal_id: entry.id,
            account_id: bankBca.id,
            debit: 200000000.00,
            credit: 0.00,
            description: 'Saldo Awal Bank BCA Koperasi',
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            journal_id: entry.id,
            account_id: equityCoa.id,
            debit: 0.00,
            credit: 1000000000.00,
            description: 'Setoran Modal Awal Pendirian Koperasi',
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      })
    })
    console.log(`✅ Berhasil mendaftarkan Jurnal Saldo Awal: ${entryNo} senilai Rp1.000.000.000`)
  } else {
    console.log(`ℹ️ Jurnal Saldo Awal ${entryNo} sudah terdaftar.`)
  }
}

main()
  .catch(e => {
    console.error("❌ Gagal melakukan seeding saldo awal:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
