import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

function mapPaymentMethod(method: string): any {
  switch (method) {
    case "cash": return "cash";
    case "qris": return "qris";
    case "transfer": return "transfer";
    case "saving_deduct": return "other";
    case "paylater": return "other";
    default: return "other";
  }
}

async function main() {
  console.log("=======================================================================")
  console.log("=== RUNNING DATABASE AUDIT REPAIR SYSTEM ===")
  console.log("=======================================================================\n")

  // 1. Fix duplicate active loans for S0016 and S0018
  console.log("--- STEP 1: Fixing Duplicate Active Loans ---")
  const rianLoan2 = await prisma.loans.findFirst({
    where: { loan_no: "LN-0016-2" },
    include: { loan_applications: true }
  });
  if (rianLoan2) {
    await prisma.loan_applications.update({
      where: { id: rianLoan2.application_id },
      data: {
        loan_product_id: BigInt(1), // LP-003: Pinjaman Kilat
        updated_at: new Date()
      }
    });
    console.log("  ✅ Updated LN-0016-2 application to product ID 1 (LP-003)");
  } else {
    console.log("  ℹ️ LN-0016-2 not found or already corrected.");
  }

  const christineLoan2 = await prisma.loans.findFirst({
    where: { loan_no: "LN-0018-2" },
    include: { loan_applications: true }
  });
  if (christineLoan2) {
    await prisma.loan_applications.update({
      where: { id: christineLoan2.application_id },
      data: {
        loan_product_id: BigInt(1), // LP-003: Pinjaman Kilat
        updated_at: new Date()
      }
    });
    console.log("  ✅ Updated LN-0018-2 application to product ID 1 (LP-003)");
  } else {
    console.log("  ℹ️ LN-0018-2 not found or already corrected.");
  }
  console.log()

  // 2. Reconcile ledger balance for COA 10201 in TX-OP-2026-0001
  console.log("--- STEP 2: Reconciling GL 10201 Balance ---")
  const entry = await prisma.journal_entries.findUnique({
    where: { entry_no: "TX-OP-2026-0001" }
  });
  if (entry) {
    // Delete existing lines
    await prisma.journal_lines.deleteMany({
      where: { journal_id: entry.id }
    });
    console.log("  Deleted existing journal lines for TX-OP-2026-0001.");

    // Retrieve COA records
    const kasUtama = await prisma.chart_of_accounts.findFirst({ where: { code: '10101' } });
    const bankMandiri = await prisma.chart_of_accounts.findFirst({ where: { code: '10102' } });
    const bankBca = await prisma.chart_of_accounts.findFirst({ where: { code: '10103' } });
    const loanCoa = await prisma.chart_of_accounts.findFirst({ where: { code: '10201' } });
    const equityCoa = await prisma.chart_of_accounts.findFirst({ where: { code: '30101' } });

    if (!kasUtama || !bankMandiri || !bankBca || !loanCoa || !equityCoa) {
      throw new Error("Required COA not found!");
    }

    // Insert corrected journal lines
    await prisma.journal_lines.createMany({
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
          account_id: loanCoa.id,
          debit: 120966666.67,
          credit: 0.00,
          description: 'Saldo Awal Piutang Pinjaman Anggota (Disbursement Historis)',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          journal_id: entry.id,
          account_id: equityCoa.id,
          debit: 0.00,
          credit: 1120966666.67,
          description: 'Setoran Modal Awal Pendirian & Piutang Historis',
          created_at: new Date(),
          updated_at: new Date()
        }
      ]
    });
    console.log("  ✅ Re-created journal lines for TX-OP-2026-0001 with corrected balances.");
  } else {
    console.log("  ❌ Opening Balance Entry TX-OP-2026-0001 not found.");
  }
  console.log()

  // 3. Fix store stock mismatches (global vs location)
  console.log("--- STEP 3: Fixing Store Stock Mismatches ---")
  const products = await prisma.products.findMany({
    where: { deleted_at: null },
    include: { stock_balances: true }
  });
  let stockMismatchCount = 0;
  for (const product of products) {
    const globalStock = product.stock;
    const sumLocationStock = product.stock_balances.reduce((sum, bal) => sum + bal.qty_on_hand, 0);
    if (globalStock !== sumLocationStock) {
      stockMismatchCount++;
      await prisma.products.update({
        where: { id: product.id },
        data: {
          stock: sumLocationStock,
          updated_at: new Date()
        }
      });
      console.log(`  ✅ Updated product ${product.sku} (${product.name}) stock: ${globalStock} -> ${sumLocationStock}`);
    }
  }
  console.log(`  Total stock mismatch cases fixed: ${stockMismatchCount}`);
  console.log()

  // 4. Recover missing POS order payments
  console.log("--- STEP 4: Recovering Missing POS Payments ---")
  const paidOrders = await prisma.orders.findMany({
    where: { payment_status: "paid" },
    include: { order_payments: true }
  });
  let missingPaymentCount = 0;
  for (const order of paidOrders) {
    const grandTotal = Number(order.grand_total);
    const paymentSum = order.order_payments.reduce((sum, pay) => sum + Number(pay.amount), 0);
    const diff = grandTotal - paymentSum;
    if (diff > 0.01) {
      missingPaymentCount++;
      await prisma.order_payments.create({
        data: {
          order_id: order.id,
          payment_method: mapPaymentMethod(order.payment_method),
          amount: diff,
          payment_status: "captured",
          paid_at: order.paid_at ?? order.ordered_at ?? new Date(),
          created_at: order.created_at ?? new Date(),
          updated_at: new Date()
        }
      });
    }
  }
  console.log(`  ✅ Created missing order payment entries for ${missingPaymentCount} orders.`);
  console.log()

  // 5. Fix consignment stock anomalies
  console.log("--- STEP 5: Reconciling Consignment Stock ---")
  
  // 5a. Keripik Singkong (P-012): Net Received is 39. So actual stock and location stock should be 39.
  const singkong = await prisma.products.findFirst({
    where: { sku: "P-012" }
  })
  if (singkong) {
    await prisma.products.update({
      where: { id: singkong.id },
      data: { stock: 39 }
    })
    await prisma.stock_balances.updateMany({
      where: { product_id: singkong.id, location_id: BigInt(2) },
      data: { qty_on_hand: 39, qty_available: 39 }
    })
    console.log("  ✅ Reconciled Keripik Singkong (P-012) stock and Location 2 balance to 39.")
  }

  // 5b. Roti Aoka (P-025): Net Received is 0. So actual stock and location stock should be 0.
  const aoka = await prisma.products.findFirst({
    where: { sku: "P-025" }
  })
  if (aoka) {
    await prisma.products.update({
      where: { id: aoka.id },
      data: { stock: 0 }
    })
    await prisma.stock_balances.updateMany({
      where: { product_id: aoka.id },
      data: { qty_on_hand: 0, qty_available: 0 }
    })
    console.log("  ✅ Reconciled Roti Aoka (P-025) stock and Location balances to 0.")
  }

  // 5c. Obat Kuat (BRG-00026): Net Received is 11. So actual stock and location stock should be 11.
  const obatKuat = await prisma.products.findFirst({
    where: { sku: "BRG-00026" }
  })
  if (obatKuat) {
    await prisma.products.update({
      where: { id: obatKuat.id },
      data: { stock: 11 }
    })
    // Check if stock_balances record for location_id 2 exists, if not create, else update
    const balance = await prisma.stock_balances.findFirst({
      where: { product_id: obatKuat.id, location_id: BigInt(2) }
    })
    if (balance) {
      await prisma.stock_balances.update({
        where: { id: balance.id },
        data: { qty_on_hand: 11, qty_available: 11 }
      })
    } else {
      await prisma.stock_balances.create({
        data: {
          product_id: obatKuat.id,
          location_id: BigInt(2),
          qty_on_hand: 11,
          qty_available: 11
        }
      })
    }
    console.log("  ✅ Reconciled Obat Kuat (BRG-00026) stock and Location 2 balance to 11.")
  }

  console.log("\n=======================================================================")
  console.log("=== DATABASE REPAIR SYSTEM COMPLETED ===")
  console.log("=======================================================================")
}

main().catch(console.error).finally(() => prisma.$disconnect())
