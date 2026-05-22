import { getConsignmentItems, getConsignmentPayables } from "@/lib/actions/consignment";
import { getSuppliers } from "@/lib/actions/procurement";
import { prisma } from "@/lib/db/prisma";
import KonsinyasiClient from "./konsinyasi-client";

export default async function KonsinyasiPage() {
  const [itemsRes, payablesRes, suppliersRes, productsRaw] = await Promise.all([
    getConsignmentItems(),
    getConsignmentPayables(),
    getSuppliers(),
    // Ambil semua produk aktif untuk dropdown penerimaan konsinyasi
    // Filter 'konsinyasi' tidak digunakan karena kategori tersebut mungkin tidak ada di semua environment
    prisma.products.findMany({
      where: { is_active: true },
      select: { id: true, name: true, purchase_price: true, product_categories: { select: { name: true } } },
      orderBy: { name: 'asc' },
    })
  ]);

  const items = itemsRes.success ? (itemsRes.data as any[]).map(item => ({
    id: Number(item.id),
    product_id: Number(item.product_id),
    product_name: item.products?.name ?? "-",
    supplier_id: Number(item.supplier_id),
    supplier_name: item.suppliers?.supplier_name ?? "-",
    qty_received: item.qty_received,
    qty_sold: Math.max(0, item.qty_received - item.qty_returned - (item.products?.stock ?? 0)),
    qty_unbilled: Math.max(0, (item.qty_received - item.qty_returned - (item.products?.stock ?? 0)) - item.qty_sold),
    qty_returned: item.qty_returned,
    qty_remaining: item.products?.stock ?? 0,
    unit_price: Number(item.products?.purchase_price ?? 0),
    margin_pct: 0,
    status: item.status,
    return_reason: item.return_reason ?? null,
    return_date: item.return_date ?? null,
    received_at: item.consignment_date ? new Date(item.consignment_date).toISOString().split("T")[0] : "-"
  })) : [];

  const payables = payablesRes.success ? (payablesRes.data as any[]).map(p => ({
    id: Number(p.id),
    supplier_id: Number(p.supplier_id),
    supplier_name: p.suppliers?.supplier_name ?? "-",
    period_start: p.created_at ? new Date(p.created_at).toISOString().split("T")[0] : "-",
    period_end: p.updated_at ? new Date(p.updated_at).toISOString().split("T")[0] : "-",
    total_qty_sold: p.qty_sold,
    total_revenue: Number(p.total_amount?.toString() || 0),
    margin_amount: 0,
    payable_amount: Number(p.total_amount?.toString() || 0),
    status: p.status,
    settlements: p.settlements ? p.settlements.map((s: any) => ({
      id: Number(s.id),
      amount_paid: Number(s.amount_paid?.toString() || 0),
      payment_method: s.payment_method,
      paid_at: s.settlement_date ? new Date(s.settlement_date).toISOString().split("T")[0] : "-"
    })) : []
  })) : [];

  const suppliers = suppliersRes.success ? (suppliersRes.data as any[]).map(s => ({
    id: Number(s.id),
    supplier_name: s.supplier_name
  })) : [];

  // Semua produk aktif ditampilkan di dropdown; sertakan nama kategori sebagai context
  const products = productsRaw.map(p => ({
    id: Number(p.id),
    name: p.name,
    category: (p as any).product_categories?.name ?? "",
    purchase_price: Number(p.purchase_price ?? 0)
  }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Barang Konsinyasi (Titip Jual)</h1>
        <p className="text-muted-foreground mt-1">
          Kelola penerimaan, retur, dan tagihan barang titipan dari supplier.
        </p>
      </div>
      <KonsinyasiClient items={items} payables={payables} suppliers={suppliers} products={products} />
    </div>
  );
}
