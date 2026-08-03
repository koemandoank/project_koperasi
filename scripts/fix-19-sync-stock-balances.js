// Fix #19: sync stock_balances.qty_on_hand supaya sama dengan products.stock.
// Aman: cuma 1 lokasi/produk saat ini, jadi sinkronisasi 1:1, tidak perlu
// alokasi proporsional. Tidak menyentuh savings/orders/data finansial apa pun.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const products = await prisma.products.findMany({ include: { stock_balances: true } });
  let fixed = 0, alreadyOk = 0, noBalanceRow = 0;

  for (const p of products) {
    if (p.stock_balances.length === 0) { noBalanceRow++; continue; }
    for (const b of p.stock_balances) {
      if (b.qty_on_hand !== p.stock) {
        await prisma.stock_balances.update({
          where: { id: b.id },
          data: { qty_on_hand: p.stock, qty_available: p.stock, updated_at: new Date() },
        });
        fixed++;
      } else {
        alreadyOk++;
      }
    }
  }
  console.log('Produk diperbaiki:', fixed, '| Sudah cocok:', alreadyOk, '| Tanpa baris stock_balances:', noBalanceRow);
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
