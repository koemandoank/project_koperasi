// Patch: backfill order_payments yang gagal (enum salah), lalu decrement stok
// HANYA untuk order_items dari batch BARU (id > boundary 497 order lama),
// supaya tidak dobel-hitung penjualan lama yang sudah tercermin di stok awal.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
BigInt.prototype.toJSON = function () { return this.toString(); };

async function main(){
  // 1. Tentukan boundary id order lama (497 order pertama = pre-existing)
  const oldOrders = await prisma.orders.findMany({ orderBy: { id: 'asc' }, take: 497, select: { id: true } });
  const boundaryId = oldOrders[oldOrders.length - 1].id;
  console.log('Boundary ID order lama (497 pertama):', boundaryId.toString());

  const newOrdersCount = await prisma.orders.count({ where: { id: { gt: boundaryId } } });
  console.log('Order baru (id > boundary):', newOrdersCount);

  // 2. Backfill order_payments untuk SEMUA order yang belum punya payment
  //    (pakai data payment_method/grand_total/payment_status yang sudah tersimpan di order itu sendiri)
  const missingPayment = await prisma.orders.findMany({
    where: { order_payments: { none: {} } },
    select: { id: true, payment_method: true, grand_total: true, payment_status: true, paid_at: true, ordered_at: true },
  });
  console.log('Order tanpa payment record:', missingPayment.length);

  // Order dgn payment_method='saving_deduct' TIDAK dibuatkan order_payments —
  // enum order_payments_payment_method tidak punya opsi itu, dan kode pos.ts asli
  // juga tidak membuat baris order_payments untuk metode ini (bukan "payment"
  // gateway, langsung potong saldo simpanan). Order tetap payment_status='paid'.
  // Skip 'saving_deduct' (tidak ada di enum order_payments, langsung potong saldo)
  // dan 'paylater' yang MASIH unpaid (wajar belum ada payment record - itu memang
  // makna "belum dibayar"). Kalau ada paylater yang statusnya 'paid' (sudah dilunasi
  // belakangan), itu tetap perlu payment record dan map ke 'other'.
  const skipped = missingPayment.filter(o =>
    o.payment_method === 'saving_deduct' || (o.payment_method === 'paylater' && o.payment_status !== 'paid')
  );
  const toInsert = missingPayment.filter(o => !skipped.includes(o));
  console.log(`Dilewati (saving_deduct / paylater belum lunas): ${skipped.length}`);

  const paymentRows = toInsert.map(o => ({
    order_id: o.id, payment_method: o.payment_method === 'paylater' ? 'other' : o.payment_method,
    amount: o.grand_total,
    payment_status: o.payment_status === 'paid' ? 'captured' : 'pending',
    paid_at: o.paid_at || o.ordered_at, created_at: o.ordered_at, updated_at: o.ordered_at,
  }));
  const CHUNK = 1000;
  for (let i = 0; i < paymentRows.length; i += CHUNK) {
    await prisma.order_payments.createMany({ data: paymentRows.slice(i, i + CHUNK) });
    console.log(`  payments ${Math.min(i+CHUNK, paymentRows.length)}/${paymentRows.length}`);
  }

  // 3. Decrement stok HANYA dari order_items milik order baru (id > boundary)
  const newItems = await prisma.order_items.groupBy({
    by: ['product_id'],
    where: { orders: { id: { gt: boundaryId } } },
    _sum: { qty: true },
  });
  console.log('Produk terjual (batch baru):', newItems.length);
  for (const row of newItems) {
    const qty = row._sum.qty || 0;
    const current = await prisma.products.findUnique({ where: { id: row.product_id }, select: { stock: true, name: true } });
    const newStock = Math.max(0, current.stock - qty);
    await prisma.products.update({ where: { id: row.product_id }, data: { stock: newStock } });
    console.log(`  ${current.name}: ${current.stock} - ${qty} = ${newStock}`);
  }

  const totalStockAfter = (await prisma.products.aggregate({ _sum: { stock: true } }))._sum.stock;
  console.log('\n=== PATCH SELESAI ===');
  console.log('Total stok akhir:', totalStockAfter);

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
