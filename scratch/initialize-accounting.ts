import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function ensureDefaultAccounts(unitId: bigint) {
  const defaults = [
    // Rekening / Bank (Asset)
    { code: "10101", name: "Kas Utama", type: "asset" as const, normal_balance: "debit" as const },
    { code: "10102", name: "Bank Mandiri (Koperasi)", type: "asset" as const, normal_balance: "debit" as const },
    { code: "10103", name: "Bank BCA Koperasi (BCA)", type: "asset" as const, normal_balance: "debit" as const },

    // Pengeluaran (Expense)
    { code: "50101", name: "Pembayaran Gaji karyawan", type: "expense" as const, normal_balance: "debit" as const },
    { code: "50102", name: "Pembelian ATK Koperasi", type: "expense" as const, normal_balance: "debit" as const },

    // Pemasukan (Revenue)
    { code: "40101", name: "Jasa Koperasi", type: "revenue" as const, normal_balance: "credit" as const },
    { code: "40102", name: "Penjualan Produk Koperasi", type: "revenue" as const, normal_balance: "credit" as const },
  ];

  for (const item of defaults) {
    const existing = await prisma.chart_of_accounts.findFirst({
      where: { unit_id: unitId, code: item.code }
    });
    if (!existing) {
      await prisma.chart_of_accounts.create({
        data: {
          unit_id: unitId,
          code: item.code,
          name: item.name,
          type: item.type,
          normal_balance: item.normal_balance,
          level: 1,
          is_header: false,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      });
      console.log(`[COA] Created: ${item.code} - ${item.name}`);
    }
  }
}

async function ensureCoa(unitId: bigint, code: string, name: string, type: "asset" | "liability" | "equity" | "revenue" | "expense", normal_balance: "debit" | "credit") {
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
    console.log(`[COA] Created: ${code} - ${name}`);
  }
  return account;
}

async function main() {
  console.log("=== STARTING FULL ACCOUNTING INITIALIZATION ===");
  const unit = await prisma.unit.findFirst({ where: { code: 'U-001' } });
  if (!unit) {
    throw new Error("Unit U-001 not found.");
  }
  const unitId = unit.id;

  // 1. Create defaults
  await ensureDefaultAccounts(unitId);

  // 2. Create specific accounts
  const coaAssetReceivable = await ensureCoa(unitId, "10201", "Piutang Pinjaman Anggota", "asset", "debit");
  const coaLiabilitySw = await ensureCoa(unitId, "20102", "Simpanan Wajib Anggota", "liability", "credit");
  const coaLiabilitySs = await ensureCoa(unitId, "20101", "Simpanan Sukarela Anggota", "liability", "credit");
  const equityCoa = await ensureCoa(unitId, "30101", "Modal Awal Pendirian Koperasi", "equity", "credit");

  const coaBankMandiri = await prisma.chart_of_accounts.findFirst({ where: { code: "10102", unit_id: unitId } });
  const coaJasaKoperasi = await prisma.chart_of_accounts.findFirst({ where: { code: "40101", unit_id: unitId } });
  const kasUtama = await prisma.chart_of_accounts.findFirst({ where: { code: "10101", unit_id: unitId } });
  const bankBca = await prisma.chart_of_accounts.findFirst({ where: { code: "10103", unit_id: unitId } });

  if (!coaBankMandiri || !coaJasaKoperasi || !kasUtama || !bankBca) {
    throw new Error("Missing some base accounts.");
  }

  // 3. Create Opening Balance Journal Entry
  const opEntryNo = 'TX-OP-2026-0001';
  const existingOp = await prisma.journal_entries.findUnique({ where: { entry_no: opEntryNo } });
  if (!existingOp) {
    await prisma.$transaction(async (tx) => {
      const entry = await tx.journal_entries.create({
        data: {
          unit_id: unitId,
          entry_no: opEntryNo,
          entry_date: new Date('2026-01-01'),
          description: 'Pencatatan Saldo Awal Kas/Bank & Modal Pendirian Koperasi',
          source: 'manual',
          is_posted: true,
          posted_at: new Date('2026-01-01'),
          created_at: new Date(),
          updated_at: new Date()
        }
      });
      await tx.journal_lines.createMany({
        data: [
          { journal_id: entry.id, account_id: kasUtama.id, debit: 500000000.00, credit: 0.00, description: 'Saldo Awal Kas Utama Koperasi', created_at: new Date(), updated_at: new Date() },
          { journal_id: entry.id, account_id: coaBankMandiri.id, debit: 300000000.00, credit: 0.00, description: 'Saldo Awal Bank Mandiri', created_at: new Date(), updated_at: new Date() },
          { journal_id: entry.id, account_id: bankBca.id, debit: 200000000.00, credit: 0.00, description: 'Saldo Awal Bank BCA Koperasi', created_at: new Date(), updated_at: new Date() },
          { journal_id: entry.id, account_id: equityCoa.id, debit: 0.00, credit: 1000000000.00, description: 'Setoran Modal Awal Pendirian Koperasi', created_at: new Date(), updated_at: new Date() }
        ]
      });
    });
    console.log("✅ Created Opening Balance Journal Entry.");
  }

  // 4. Create or Update Payroll Journal Entry
  const payrollEntryNo = "TX-20260525-8623";
  const existingPayroll = await prisma.journal_entries.findUnique({ where: { entry_no: payrollEntryNo } });
  if (!existingPayroll) {
    await prisma.$transaction(async (tx) => {
      const entry = await tx.journal_entries.create({
        data: {
          unit_id: unitId,
          entry_no: payrollEntryNo,
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
      await tx.journal_lines.createMany({
        data: [
          { journal_id: entry.id, account_id: coaBankMandiri.id, debit: 123757000.00, credit: 0.00, description: "Penerimaan Kas Payroll Mei 2026", created_at: new Date(), updated_at: new Date() },
          { journal_id: entry.id, account_id: coaJasaKoperasi.id, debit: 0.00, credit: 2492000.00, description: "Pendapatan Jasa Koperasi/Bunga - Potongan Gaji Mei 2026", created_at: new Date(), updated_at: new Date() },
          { journal_id: entry.id, account_id: coaAssetReceivable.id, debit: 0.00, credit: 45016666.67, description: "Pelunasan Pokok Pinjaman Anggota - Potongan Gaji Mei 2026", created_at: new Date(), updated_at: new Date() },
          { journal_id: entry.id, account_id: coaLiabilitySw.id, debit: 0.00, credit: 6000000.00, description: "Setoran Simpanan Wajib Anggota - Potongan Gaji Mei 2026", created_at: new Date(), updated_at: new Date() },
          { journal_id: entry.id, account_id: coaLiabilitySs.id, debit: 0.00, credit: 70248333.33, description: "Setoran Simpanan Sukarela Anggota - Potongan Gaji Mei 2026", created_at: new Date(), updated_at: new Date() }
        ]
      });
    });
    console.log("✅ Created Payroll Journal Entry.");
  } else {
    // Recreate lines
    await prisma.journal_lines.deleteMany({ where: { journal_id: existingPayroll.id } });
    await prisma.journal_lines.createMany({
      data: [
        { journal_id: existingPayroll.id, account_id: coaBankMandiri.id, debit: 123757000.00, credit: 0.00, description: "Penerimaan Kas Payroll Mei 2026", created_at: new Date(), updated_at: new Date() },
        { journal_id: existingPayroll.id, account_id: coaJasaKoperasi.id, debit: 0.00, credit: 2492000.00, description: "Pendapatan Jasa Koperasi/Bunga - Potongan Gaji Mei 2026", created_at: new Date(), updated_at: new Date() },
        { journal_id: existingPayroll.id, account_id: coaAssetReceivable.id, debit: 0.00, credit: 45016666.67, description: "Pelunasan Pokok Pinjaman Anggota - Potongan Gaji Mei 2026", created_at: new Date(), updated_at: new Date() },
        { journal_id: existingPayroll.id, account_id: coaLiabilitySw.id, debit: 0.00, credit: 6000000.00, description: "Setoran Simpanan Wajib Anggota - Potongan Gaji Mei 2026", created_at: new Date(), updated_at: new Date() },
        { journal_id: existingPayroll.id, account_id: coaLiabilitySs.id, debit: 0.00, credit: 70248333.33, description: "Setoran Simpanan Sukarela Anggota - Potongan Gaji Mei 2026", created_at: new Date(), updated_at: new Date() }
      ]
    });
    console.log("✅ Updated/Reallocated Payroll Journal Entry lines.");
  }
  console.log("=== INITIALIZATION COMPLETE ===");
}

main().catch(console.error).finally(() => prisma.$disconnect());
