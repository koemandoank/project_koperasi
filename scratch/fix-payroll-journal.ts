import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== RUNNING DATABASE GENERAL LEDGER ALIGNMENT ===");

  // 1. Get unit ID
  const unit = await prisma.unit.findFirst();
  if (!unit) {
    throw new Error("No active unit found in database.");
  }
  const unitId = unit.id;
  console.log(`Using Unit ID: ${unitId}`);

  // 2. Helper to ensure COA exists
  const ensureCoa = async (code: string, name: string, type: "asset" | "liability" | "equity" | "revenue" | "expense", normal_balance: "debit" | "credit") => {
    let account = await prisma.chart_of_accounts.findFirst({
      where: { unit_id: unitId, code: code }
    });
    if (!account) {
      account = await prisma.chart_of_accounts.create({
        data: {
          unit_id: unitId,
          code,
          name,
          type,
          normal_balance,
          level: 1,
          is_header: false,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      });
      console.log(`[COA] Created missing account: ${code} - ${name}`);
    } else {
      console.log(`[COA] Existing account found: ${code} - ${name}`);
    }
    return account;
  };

  // Ensure our target accounts exist
  const coaAssetReceivable = await ensureCoa("10201", "Piutang Pinjaman Anggota", "asset", "debit");
  const coaLiabilitySw = await ensureCoa("20102", "Simpanan Wajib Anggota", "liability", "credit");
  const coaLiabilitySs = await ensureCoa("20101", "Simpanan Sukarela Anggota", "liability", "credit");
  
  // Find other required accounts
  const coaBankMandiri = await prisma.chart_of_accounts.findFirst({ where: { code: "10104" } }) 
    || await prisma.chart_of_accounts.findFirst({ where: { code: "10102" } });
  
  const coaJasaKoperasi = await prisma.chart_of_accounts.findFirst({ where: { code: "40101" } });

  if (!coaBankMandiri || !coaJasaKoperasi) {
    throw new Error("Required COA accounts (10104/10102 or 40101) are missing from database.");
  }
  console.log(`Using Bank Mandiri Account ID: ${coaBankMandiri.id} (${coaBankMandiri.code})`);
  console.log(`Using Jasa Koperasi Account ID: ${coaJasaKoperasi.id} (${coaJasaKoperasi.code})`);

  // 3. Find target journal entry
  const entry = await prisma.journal_entries.findUnique({
    where: { entry_no: "TX-20260525-8623" }
  });

  if (!entry) {
    console.warn("⚠️ Journal entry TX-20260525-8623 was not found in the database. Creating a new one instead...");
    // Let's create it if it doesn't exist
    const newEntry = await prisma.journal_entries.create({
      data: {
        unit_id: unitId,
        entry_no: "TX-20260525-8623",
        entry_date: new Date("2026-05-25"),
        description: "Penerimaan Kas - Angsuran Pinjaman Tanggal 25 Mei 2026",
        reference: "PAYROLL-MEI-2026",
        source: "manual",
        is_posted: true,
        posted_at: new Date("2026-05-25T10:00:00Z"),
        created_at: new Date("2026-05-25T10:00:00Z"),
        updated_at: new Date("2026-05-25T10:00:00Z")
      }
    });
    console.log(`Created new journal entry TX-20260525-8623 (ID: ${newEntry.id})`);
    
    // Create new lines
    await createJournalLines(newEntry.id, coaBankMandiri.id, coaJasaKoperasi.id, coaAssetReceivable.id, coaLiabilitySw.id, coaLiabilitySs.id);
  } else {
    console.log(`Found journal entry TX-20260525-8623 (ID: ${entry.id}). Reallocating lines...`);

    // Clean up old lines
    const deleteCount = await prisma.journal_lines.deleteMany({
      where: { journal_id: entry.id }
    });
    console.log(`Deleted ${deleteCount.count} obsolete journal lines.`);

    // Create correct lines
    await createJournalLines(entry.id, coaBankMandiri.id, coaJasaKoperasi.id, coaAssetReceivable.id, coaLiabilitySw.id, coaLiabilitySs.id);
  }

  console.log("=== DATABASE GENERAL LEDGER ALIGNMENT SUCCESSFUL ===");
}

async function createJournalLines(
  journalId: bigint,
  bankAccountId: bigint,
  jasaAccountId: bigint,
  receivableAccountId: bigint,
  swAccountId: bigint,
  ssAccountId: bigint
) {
  const lines = [
    // DEBIT: Bank Mandiri (Koperasi)
    {
      journal_id: journalId,
      account_id: bankAccountId,
      debit: 123757000.00,
      credit: 0.00,
      description: "Penerimaan Kas Payroll Mei 2026",
      created_at: new Date(),
      updated_at: new Date()
    },
    // CREDIT: Jasa Koperasi (Interest)
    {
      journal_id: journalId,
      account_id: jasaAccountId,
      debit: 0.00,
      credit: 2492000.00,
      description: "Pendapatan Jasa Koperasi/Bunga - Potongan Gaji Mei 2026",
      created_at: new Date(),
      updated_at: new Date()
    },
    // CREDIT: Piutang Pinjaman Anggota (Principal)
    {
      journal_id: journalId,
      account_id: receivableAccountId,
      debit: 0.00,
      credit: 45016666.67,
      description: "Pelunasan Pokok Pinjaman Anggota - Potongan Gaji Mei 2026",
      created_at: new Date(),
      updated_at: new Date()
    },
    // CREDIT: Simpanan Wajib Anggota (Simpanan Wajib)
    {
      journal_id: journalId,
      account_id: swAccountId,
      debit: 0.00,
      credit: 6000000.00,
      description: "Setoran Simpanan Wajib Anggota - Potongan Gaji Mei 2026",
      created_at: new Date(),
      updated_at: new Date()
    },
    // CREDIT: Simpanan Sukarela Anggota (Simpanan Sukarela)
    {
      journal_id: journalId,
      account_id: ssAccountId,
      debit: 0.00,
      credit: 70248333.33,
      description: "Setoran Simpanan Sukarela Anggota - Potongan Gaji Mei 2026",
      created_at: new Date(),
      updated_at: new Date()
    }
  ];

  for (const line of lines) {
    await prisma.journal_lines.create({ data: line });
  }
  console.log("Successfully created 5 balanced journal lines.");
}

main()
  .catch(err => {
    console.error("Error executing database reallocation:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
