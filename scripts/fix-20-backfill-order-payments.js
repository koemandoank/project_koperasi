// Fix #20: backfill order_payments untuk 1107 order payment_method=saving_deduct
// yang statusnya paid tapi tidak punya rincian order_payments (flagged dashboard
// pengawas Check #8). PENTING: TIDAK menyentuh savings.balance siapa pun -
// murni bookkeeping order_payments supaya rekonsiliasi order_payments vs
// grand_total cocok. order_payments_payment_method enum tidak punya opsi
// "saving_deduct" (cuma cash/debit_card/credit_card/qris/transfer/check/other),
// jadi di-map ke "other" + reference_no jelas menandai asalnya utk jejak audit.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
BigInt.prototype.toJSON = function () { return this.toString(); };

(async () => {
  const missing = await prisma.orders.findMany({
    where: {
      payment_status: 'paid',
      payment_method: 'saving_deduct',
      order_payments: { none: {} },
    },
    select: { id: true, order_no: true, grand_total: true, paid_at: true, ordered_at: true },
  });
  console.log('Order yang perlu dibackfill:', missing.length);

  const rows = missing.map(o => ({
    order_id: o.id,
    payment_method: 'other',
    amount: o.grand_total,
    reference_no: `SAVING-DEDUCT-BACKFILL-${o.order_no}`,
    payment_status: 'captured',
    paid_at: o.paid_at || o.ordered_at,
    created_at: o.ordered_at,
    updated_at: o.ordered_at,
  }));

  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const res = await prisma.order_payments.createMany({ data: rows.slice(i, i + CHUNK) });
    inserted += res.count;
    console.log(`  ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
  }
  console.log('Total order_payments dibuat:', inserted);

  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
