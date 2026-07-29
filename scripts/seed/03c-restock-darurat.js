// Perbaikan: 12 produk defisit (stok kepotong 0 padahal masih ada order_items
// yang "menuntut" lebih). Tambah restock darurat supaya stok jadi konsisten
// (tidak ada produk mentok 0 gara2 kekurangan pasokan yang seharusnya cukup).
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
BigInt.prototype.toJSON = function () { return this.toString(); };

async function main(){
  const products = await prisma.products.findMany({ select: { id: true, name: true, stock: true, purchase_price: true } });
  const boundaryOrders = await prisma.orders.findMany({ orderBy: { id: 'asc' }, take: 497, select: { id: true } });
  const boundaryId = boundaryOrders[boundaryOrders.length - 1].id;

  const sold = await prisma.order_items.groupBy({
    by: ['product_id'], where: { orders: { id: { gt: boundaryId } } }, _sum: { qty: true },
  });
  const soldMap = Object.fromEntries(sold.map(s => [s.product_id.toString(), s._sum.qty || 0]));

  // Stok SAAT INI sudah di-floor ke 0 oleh patch sebelumnya. Untuk hitung defisit asli,
  // kita perlu tahu stok sebelum decrement. Karena floor(0) menghilangkan info persis,
  // kita pakai pendekatan: kalau current stock == 0, anggap ada defisit, kasih buffer aman
  // (300 unit) supaya positif dan tidak akan mepet lagi ke depan (Hari 4 masih akan pakai produk toko tidak langsung, jadi buffer ini murni utk konsistensi histori & kalau nanti dites live).
  const supplier = (await prisma.suppliers.findFirst());
  const pengurus = await prisma.users.findFirst({ where: { username: 'pengurus2' } });
  const kasir = await prisma.users.findFirst({ where: { username: 'kasir2' } });

  const restockDate = new Date('2025-09-15'); // ditempatkan awal simulasi, sebelum mayoritas transaksi
  const deficitProducts = products.filter(p => p.stock === 0);
  console.log('Produk stok 0 (perlu restock darurat):', deficitProducts.map(p=>p.name));

  if (deficitProducts.length === 0) { console.log('Tidak ada produk defisit.'); await prisma.$disconnect(); return; }

  let subtotal = 0;
  const items = deficitProducts.map(p => {
    const qty = 400; // buffer aman
    const unitPrice = Number(p.purchase_price);
    const lineTotal = qty * unitPrice;
    subtotal += lineTotal;
    return { product_id: p.id, qty, unitPrice, lineTotal };
  });
  const tax = Math.round(subtotal * 0.11);
  const total = subtotal + tax;

  const lastPOs = await prisma.purchase_orders.findMany({ select: { po_no: true } });
  const yearCounters = {};
  lastPOs.forEach(p => { const m = p.po_no.match(/PO-(\d{4})-(\d+)/); if (m) yearCounters[m[1]] = Math.max(yearCounters[m[1]]||0, parseInt(m[2],10)); });
  const year = '2025';
  yearCounters[year] = (yearCounters[year]||0) + 1;
  const poNo = `PO-${year}-${String(yearCounters[year]).padStart(3,'0')}-DARURAT`;

  const po = await prisma.purchase_orders.create({ data: {
    supplier_id: supplier.id, po_no: poNo, po_date: restockDate, expected_delivery: restockDate,
    status: 'received', subtotal, tax_amount: tax, total_amount: total,
    notes: 'Restock darurat - koreksi kekurangan estimasi pengadaan awal (defisit stok teridentifikasi saat verifikasi Hari 3)',
    created_by: pengurus.id, approved_by: pengurus.id, approved_at: restockDate,
    created_at: restockDate, updated_at: restockDate,
  }});
  await prisma.purchase_order_items.createMany({ data: items.map(it => ({
    po_id: po.id, product_id: it.product_id, qty_ordered: it.qty, qty_received: it.qty,
    unit_price: it.unitPrice, line_total: it.lineTotal, created_at: restockDate,
  }))});

  const gr = await prisma.good_receipts.create({ data: {
    po_id: po.id, supplier_id: supplier.id, gr_no: `GR-20250915-DARURAT`, gr_date: restockDate, status: 'accepted',
    received_by: kasir.id, notes: 'Restock darurat', created_at: restockDate, updated_at: restockDate,
  }});
  await prisma.good_receipt_items.createMany({ data: items.map(it => ({
    gr_id: gr.id, product_id: it.product_id, qty_received: it.qty, qty_accepted: it.qty, qty_rejected: 0, created_at: restockDate,
  }))});
  for (const it of items) {
    await prisma.products.update({ where: { id: it.product_id }, data: { stock: { increment: it.qty } } });
  }

  const apCount = (await prisma.accounts_payable.count()) + 1;
  const ap = await prisma.accounts_payable.create({ data: {
    supplier_id: supplier.id, invoice_no: `INV-SUP-${String(apCount).padStart(3,'0')}-DARURAT`,
    invoice_date: restockDate, due_date: new Date('2025-09-29'),
    subtotal, tax_amount: tax, total_amount: total, amount_paid: total, amount_due: 0, status: 'paid',
    notes: `Invoice restock darurat PO ${poNo}`, created_at: restockDate, updated_at: restockDate,
  }});
  await prisma.accounts_payable_details.createMany({ data: items.map(it => ({
    ap_id: ap.id, product_id: it.product_id, description: products.find(p=>p.id===it.product_id)?.name || '-',
    qty: it.qty, unit_price: it.unitPrice, line_total: it.lineTotal, created_at: restockDate,
  }))});

  const finalStock = await prisma.products.aggregate({ _sum: { stock: true } });
  const zeroStock = await prisma.products.count({ where: { stock: 0 } });
  console.log(`\n=== RESTOCK DARURAT SELESAI: ${items.length} produk, total ${items.reduce((a,i)=>a+i.qty,0)} unit ===`);
  console.log('Total stok akhir semua produk:', finalStock._sum.stock);
  console.log('Produk masih stok 0:', zeroStock);

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
