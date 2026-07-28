// HARI 2 - Pengadaan barang: purchase_orders -> good_receipts -> accounts_payable
// 12 siklus bulanan (Agu 2025 - Jul 2026), 25 produk dibagi rata ke 5 supplier.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
BigInt.prototype.toJSON = function () { return this.toString(); };

function rand(n){ return Math.floor(Math.random()*n); }
function pick(arr){ return arr[rand(arr.length)]; }
function pad(n,l){ return String(n).padStart(l,'0'); }

async function main(){
  console.log('=== HARI 2: Pengadaan barang ===');

  const products = await prisma.products.findMany({ select: { id: true, name: true, stock: true, min_stock: true, purchase_price: true } });
  const suppliers = await prisma.suppliers.findMany();
  const pengurus = await prisma.users.findFirst({ where: { username: 'pengurus2' } });
  const kasir = await prisma.users.findFirst({ where: { username: 'kasir2' } });
  if (!pengurus || !kasir) throw new Error('Staff Hari 1 belum ada, jalankan script Hari 1 dulu');

  // Bagi 25 produk ke 5 supplier (5 produk/supplier), tetap konsisten tiap bulan
  const supplierProducts = {};
  suppliers.forEach((s, idx) => {
    supplierProducts[s.id] = products.filter((_, pi) => pi % suppliers.length === idx);
  });

  // Cari nomor PO & invoice terakhir per tahun
  const lastPOs = await prisma.purchase_orders.findMany({ select: { po_no: true } });
  const lastAPs = await prisma.accounts_payable.findMany({ select: { invoice_no: true } });
  let apCounter = lastAPs.length ? Math.max(...lastAPs.map(a => parseInt(a.invoice_no.split('-').pop(), 10) || 0)) : 0;
  const poCounterByYear = {};
  lastPOs.forEach(p => {
    const m = p.po_no.match(/PO-(\d{4})-(\d+)/);
    if (m) poCounterByYear[m[1]] = Math.max(poCounterByYear[m[1]] || 0, parseInt(m[2], 10));
  });

  const months = [];
  let cursor = new Date('2025-08-01');
  const endMonthsLimit = process.env.SEED_MONTHS ? parseInt(process.env.SEED_MONTHS) : 12;
  const end = new Date('2026-07-01');
  while (cursor <= end && months.length < endMonthsLimit) { months.push(new Date(cursor)); cursor.setMonth(cursor.getMonth() + 1); }

  const nearEmpty = new Set(['Sabun Mandi', 'Sampo Sachet', 'Baterai AAA 4pcs']);
  let poCount = 0, grCount = 0, apCount = 0;
  const restockedFirstCycle = new Set();

  for (let mi = 0; mi < months.length; mi++) {
    const poDate = new Date(months[mi].getFullYear(), months[mi].getMonth(), 5 + rand(5));
    const year = String(poDate.getFullYear());
    for (const s of suppliers) {
      const items = supplierProducts[s.id];
      if (!items.length) continue;

      poCounterByYear[year] = (poCounterByYear[year] || 0) + 1;
      const poNo = `PO-${year}-${pad(poCounterByYear[year], 3)}`;

      let subtotal = 0;
      const itemsData = items.map(p => {
        let qty = 50 + rand(101); // 50-150
        if (mi === 0 && nearEmpty.has(p.name) && !restockedFirstCycle.has(p.id)) {
          qty = 250 + rand(151); // 250-400 di siklus pertama utk produk kritis
          restockedFirstCycle.add(p.id);
        }
        const unitPrice = Number(p.purchase_price);
        const lineTotal = qty * unitPrice;
        subtotal += lineTotal;
        return { product_id: p.id, qty, unitPrice, lineTotal };
      });
      const tax = Math.round(subtotal * 0.11);
      const total = subtotal + tax;
      const expectedDelivery = new Date(poDate); expectedDelivery.setDate(expectedDelivery.getDate() + (s.avg_delivery_days || 3));

      const po = await prisma.purchase_orders.create({ data: {
        supplier_id: s.id, po_no: poNo, po_date: poDate, expected_delivery: expectedDelivery,
        status: 'received', subtotal, tax_amount: tax, total_amount: total,
        notes: `Pengadaan rutin bulanan ${months[mi].toLocaleString('id-ID',{month:'long',year:'numeric'})}`,
        created_by: pengurus.id, approved_by: pengurus.id, approved_at: poDate,
        created_at: poDate, updated_at: poDate,
      }});
      await prisma.purchase_order_items.createMany({ data: itemsData.map(it => ({
        po_id: po.id, product_id: it.product_id, qty_ordered: it.qty, qty_received: it.qty,
        unit_price: it.unitPrice, line_total: it.lineTotal, created_at: poDate,
      }))});
      poCount++;

      // Good receipt: barang diterima penuh, update stok
      const grDate = new Date(expectedDelivery);
      const grNo = `GR-${grDate.getFullYear()}${pad(grDate.getMonth()+1,2)}${pad(grDate.getDate(),2)}-${pad(poCount,4)}`;
      const gr = await prisma.good_receipts.create({ data: {
        po_id: po.id, supplier_id: s.id, gr_no: grNo, gr_date: grDate, status: 'accepted',
        received_by: kasir.id, notes: 'Barang diterima lengkap sesuai PO', created_at: grDate, updated_at: grDate,
      }});
      await prisma.good_receipt_items.createMany({ data: itemsData.map(it => ({
        gr_id: gr.id, product_id: it.product_id, qty_received: it.qty, qty_accepted: it.qty, qty_rejected: 0, created_at: grDate,
      }))});
      for (const it of itemsData) {
        await prisma.products.update({ where: { id: it.product_id }, data: { stock: { increment: it.qty } } });
      }
      grCount++;

      // Accounts payable
      apCounter++;
      const invoiceNo = `INV-SUP-${pad(apCounter, 3)}`;
      const dueDate = new Date(grDate); dueDate.setDate(dueDate.getDate() + (s.payment_terms || 14));
      const isPaid = Math.random() < 0.7; // 70% sudah lunas
      const isOverdue = !isPaid && dueDate < new Date('2026-07-27') && Math.random() < 0.4;
      const ap = await prisma.accounts_payable.create({ data: {
        supplier_id: s.id, invoice_no: invoiceNo, invoice_date: grDate, due_date: dueDate,
        subtotal, tax_amount: tax, total_amount: total,
        amount_paid: isPaid ? total : 0, amount_due: isPaid ? 0 : total,
        status: isPaid ? 'paid' : (isOverdue ? 'overdue' : 'open'),
        notes: `Invoice atas PO ${poNo}`, created_at: grDate, updated_at: grDate,
      }});
      await prisma.accounts_payable_details.createMany({ data: itemsData.map(it => ({
        ap_id: ap.id, product_id: it.product_id, description: products.find(p=>p.id===it.product_id)?.name || '-',
        qty: it.qty, unit_price: it.unitPrice, line_total: it.lineTotal, created_at: grDate,
      }))});
      apCount++;
    }
    console.log(`Bulan ${mi+1}/${months.length} (${months[mi].toISOString().slice(0,7)}) selesai — PO:${poCount} GR:${grCount} AP:${apCount}`);
  }

  const finalProducts = await prisma.products.findMany({ select: { name: true, stock: true } });
  const totalStock = finalProducts.reduce((a,p)=>a+p.stock,0);
  console.log(`\n=== SELESAI: ${poCount} PO, ${grCount} GR, ${apCount} AP ===`);
  console.log('Total stok akhir semua produk:', totalStock);
  console.log('Stok tersisa rendah:', finalProducts.filter(p=>p.stock<30));

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
