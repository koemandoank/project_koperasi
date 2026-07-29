// HARI 3a - Belanja rutin toko: 80% anggota (96/120), 1-2x/minggu, hari kerja saja.
// Pakai createManyAndReturn supaya cepat (bukan insert satu-satu).
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
BigInt.prototype.toJSON = function () { return this.toString(); };

function rand(n){ return Math.floor(Math.random()*n); }
function pick(arr){ return arr[rand(arr.length)]; }
function pad(n,l){ return String(n).padStart(l,'0'); }
function weightedPayment(){
  const r = Math.random();
  if (r < 0.45) return 'cash';
  if (r < 0.85) return 'qris';
  return 'saving_deduct';
}

async function main(){
  console.log('=== HARI 3a: Belanja rutin toko ===');
  const WEEK_START = process.env.SEED_WEEK_START ? parseInt(process.env.SEED_WEEK_START) : 0;
  const WEEK_COUNT = process.env.SEED_WEEK_COUNT ? parseInt(process.env.SEED_WEEK_COUNT) : 52;

  const allMembers = await prisma.members.findMany({ select: { id: true, unit_id: true, member_code: true } });
  const products = await prisma.products.findMany({ select: { id: true, price: true, member_price: true } });
  const kasirs = await prisma.users.findMany({ where: { role: 'kasir' }, select: { id: true } });
  if (!kasirs.length) throw new Error('Belum ada user kasir');

  // Pilih 96 anggota (80%) partisipan tetap - deterministik per member_code hash sederhana
  // supaya konsisten kalau script dijalankan ulang per-chunk minggu.
  const sortedMembers = [...allMembers].sort((a,b) => a.member_code.localeCompare(b.member_code));
  const participantCount = Math.round(allMembers.length * 0.8);
  const participants = sortedMembers.filter((_, i) => i % 5 !== 0).slice(0, participantCount); // skip tiap ke-5 => ~80%

  console.log(`Partisipan: ${participants.length}/${allMembers.length} anggota`);

  // Bangun daftar minggu (Senin) dari 2025-08-01
  const weeks = [];
  let d = new Date('2025-08-04'); // Senin pertama Agustus 2025
  while (weeks.length < 52) { weeks.push(new Date(d)); d.setDate(d.getDate() + 7); }
  const chunkWeeks = weeks.slice(WEEK_START, WEEK_START + WEEK_COUNT);
  console.log(`Memproses minggu ke-${WEEK_START+1} s.d. ${WEEK_START+chunkWeeks.length} dari 52`);

  let orderCounter = await prisma.orders.count();
  const ordersData = [];
  const orderMeta = {}; // order_no -> { items, payment_method, grand_total }

  for (const member of participants) {
    for (const monday of chunkWeeks) {
      const purchaseCount = 1 + rand(2); // 1 atau 2
      for (let p = 0; p < purchaseCount; p++) {
        const weekday = rand(5); // 0=Senin..4=Jumat
        const orderDate = new Date(monday); orderDate.setDate(orderDate.getDate() + weekday);
        orderDate.setHours(8 + rand(12), rand(60), 0, 0);

        const itemCount = 1 + rand(4);
        const chosenProducts = [];
        for (let k = 0; k < itemCount; k++) chosenProducts.push(pick(products));

        let subtotal = 0;
        const items = chosenProducts.map(prod => {
          const qty = 1 + rand(3);
          const unitPrice = Number(prod.member_price || prod.price);
          const lineSubtotal = qty * unitPrice;
          subtotal += lineSubtotal;
          return { product_id: prod.id, qty, unitPrice, lineSubtotal };
        });

        orderCounter++;
        const dateStr = `${orderDate.getFullYear()}${pad(orderDate.getMonth()+1,2)}${pad(orderDate.getDate(),2)}`;
        const orderNo = `INV-${dateStr}-${pad(orderCounter,4)}`;
        const paymentMethod = weightedPayment();

        ordersData.push({
          order_no: orderNo, member_id: member.id, unit_id: member.unit_id, channel: 'pos',
          subtotal, discount: 0, grand_total: subtotal, payment_method: paymentMethod,
          payment_status: 'paid', order_status: 'confirmed', cashier_id: pick(kasirs).id,
          ordered_at: orderDate, paid_at: orderDate, created_at: orderDate, updated_at: orderDate,
        });
        orderMeta[orderNo] = { items, paymentMethod, grandTotal: subtotal, orderDate };
      }
    }
  }

  console.log(`Total order dibuat di batch ini: ${ordersData.length}`);

  // Insert bertahap per 500 supaya payload tidak terlalu besar
  const CHUNK = 500;
  let insertedOrders = [];
  for (let i = 0; i < ordersData.length; i += CHUNK) {
    const slice = ordersData.slice(i, i + CHUNK);
    const result = await prisma.orders.createManyAndReturn({ data: slice, select: { id: true, order_no: true } });
    insertedOrders = insertedOrders.concat(result);
    console.log(`  Insert orders ${i + slice.length}/${ordersData.length}`);
  }

  // Bangun order_items & order_payments pakai id yang baru
  const itemRows = [];
  const paymentRows = [];
  const productSoldQty = {};
  for (const o of insertedOrders) {
    const meta = orderMeta[o.order_no];
    for (const it of meta.items) {
      itemRows.push({
        order_id: o.id, product_id: it.product_id, product_name: '', qty: it.qty,
        unit_price: it.unitPrice, discount: 0, subtotal: it.lineSubtotal,
        created_at: meta.orderDate, updated_at: meta.orderDate,
      });
      productSoldQty[it.product_id] = (productSoldQty[it.product_id] || 0) + it.qty;
    }
    paymentRows.push({
      order_id: o.id, payment_method: meta.paymentMethod, amount: meta.grandTotal,
      payment_status: 'completed', paid_at: meta.orderDate, created_at: meta.orderDate, updated_at: meta.orderDate,
    });
  }
  // Isi product_name dari data produk
  const productMap = Object.fromEntries((await prisma.products.findMany({ select: { id: true, name: true } })).map(p => [p.id.toString(), p.name]));
  itemRows.forEach(r => { r.product_name = productMap[r.product_id.toString()] || '-'; });

  for (let i = 0; i < itemRows.length; i += CHUNK*3) {
    await prisma.order_items.createMany({ data: itemRows.slice(i, i + CHUNK*3) });
  }
  console.log(`Order items dibuat: ${itemRows.length}`);

  for (let i = 0; i < paymentRows.length; i += CHUNK*3) {
    await prisma.order_payments.createMany({ data: paymentRows.slice(i, i + CHUNK*3) });
  }
  console.log(`Order payments dibuat: ${paymentRows.length}`);

  // Decrement stok agregat (bukan per-order, demi performa)
  for (const [productId, qty] of Object.entries(productSoldQty)) {
    const current = await prisma.products.findUnique({ where: { id: BigInt(productId) }, select: { stock: true } });
    const newStock = Math.max(0, current.stock - qty);
    await prisma.products.update({ where: { id: BigInt(productId) }, data: { stock: newStock } });
  }
  console.log('Stok produk sudah diperbarui.');

  console.log(`\n=== SELESAI batch minggu ${WEEK_START+1}-${WEEK_START+chunkWeeks.length}: ${ordersData.length} order, ${itemRows.length} item, ${paymentRows.length} payment ===`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
