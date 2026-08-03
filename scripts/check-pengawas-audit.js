const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
BigInt.prototype.toJSON = function () { return this.toString(); };

(async () => {
  console.log('=== 1. Jurnal tidak seimbang ===');
  const entries = await prisma.journal_entries.findMany({ include: { journal_lines: true } });
  let unbalanced = 0;
  for (const e of entries) {
    let d = 0, c = 0;
    for (const l of e.journal_lines) { d += Number(l.debit); c += Number(l.credit); }
    if (Math.abs(d - c) > 0.01) unbalanced++;
  }
  console.log('Total journal_entries:', entries.length, '| Tidak seimbang:', unbalanced);

  console.log('\n=== 2. Akun pendapatan sementara 40104 ===');
  const misclassified = await prisma.journal_lines.count({ where: { chart_of_accounts: { code: '40104' } } });
  console.log('Baris jurnal ke akun 40104:', misclassified);

  console.log('\n=== 3. Pinjaman outstanding negatif ===');
  const negLoans = await prisma.loans.count({ where: { outstanding_principal: { lt: 0 } } });
  console.log('Jumlah:', negLoans);

  console.log('\n=== 4. Saldo tabungan negatif ===');
  const negSavings = await prisma.savings.count({ where: { balance: { lt: 0 } } });
  console.log('Jumlah:', negSavings);

  console.log('\n=== 5. Jurnal belum posting ===');
  const unposted = await prisma.journal_entries.count({ where: { is_posted: false } });
  console.log('Jumlah:', unposted);

  console.log('\n=== 6. Selisih stok global vs lokasi ===');
  const products = await prisma.products.findMany({ where: { deleted_at: null }, include: { stock_balances: true } });
  let stockMismatch = 0;
  for (const p of products) {
    const sumLoc = p.stock_balances.reduce((s, b) => s + (b.qty_on_hand ?? 0), 0);
    if (p.stock !== sumLoc) stockMismatch++;
  }
  console.log('Total produk:', products.length, '| Mismatch:', stockMismatch);

  console.log('\n=== 7. Anomali konsinyasi ===');
  const consignmentItems = await prisma.consignment_items.count();
  console.log('Total consignment_items:', consignmentItems, '(kalau 0, check ini otomatis tidak flag apa2)');

  console.log('\n=== 8. Order lunas tanpa rincian pembayaran ===');
  const paidOrders = await prisma.orders.findMany({ where: { payment_status: 'paid' }, include: { order_payments: true } });
  let paymentMismatch = 0;
  const mismatchByMethod = {};
  for (const o of paidOrders) {
    const grandTotal = Number(o.grand_total);
    const paySum = o.order_payments.reduce((s, p) => s + Number(p.amount), 0);
    if (Math.abs(grandTotal - paySum) > 0.01) {
      paymentMismatch++;
      mismatchByMethod[o.payment_method] = (mismatchByMethod[o.payment_method] || 0) + 1;
    }
  }
  console.log('Total order paid:', paidOrders.length, '| Mismatch:', paymentMismatch);
  console.log('Breakdown by payment_method:', mismatchByMethod);

  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
