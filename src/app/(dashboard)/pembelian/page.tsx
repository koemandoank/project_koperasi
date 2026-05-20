import { getSuppliers, getPurchaseOrders } from "@/lib/actions/procurement";
import { PembelianClient } from "./pembelian-client";
import { prisma } from "@/lib/db/prisma";

export default async function PembelianPage() {
  const [suppliersRes, poRes, productsRaw] = await Promise.all([
    getSuppliers(),
    getPurchaseOrders(),
    // Exclude consignment products (category slug = 'konsinyasi') from PO form
    prisma.products.findMany({
      where: {
        is_active: true,
        product_categories: { slug: { not: 'konsinyasi' } }
      },
      select: { id: true, name: true, purchase_price: true }
    })
  ]);

  const products = productsRaw.map(p => ({
    id: Number(p.id),
    name: p.name,
    purchase_price: Number(p.purchase_price || 0)
  }));

  const suppliers = suppliersRes.success
    ? (suppliersRes.data as any[]).map((s) => ({
        id: Number(s.id),
        supplier_code: s.supplier_code,
        supplier_name: s.supplier_name,
        contact_person: s.contact_person || "-",
        phone: s.phone || "-",
        email: s.email || "-",
        city: s.city || "-",
        payment_terms: s.payment_terms ?? 30,
        is_active: s.is_active,
        po_count: s._count?.purchase_orders ?? 0,
      }))
    : [];

  const purchaseOrders = poRes.success
    ? (poRes.data as any[]).map((po) => ({
        id:                Number(po.id),
        po_no:             po.po_no as string,
        supplier_name:     (po.suppliers?.supplier_name ?? "-") as string,
        supplier_id:       Number(po.supplier_id),
        po_date:           po.po_date instanceof Date ? po.po_date.toISOString().split("T")[0] : (po.po_date ?? "-"),
        expected_delivery: po.expected_delivery instanceof Date ? po.expected_delivery.toISOString().split("T")[0] : (po.expected_delivery ?? "-"),
        status:            po.status as string,
        subtotal:          Number(po.subtotal ?? 0),
        tax_amount:        Number(po.tax_amount ?? 0),
        total_amount:      Number(po.total_amount ?? 0),
        notes:             (po.notes ?? null) as string | null,
        item_count:        Number(po.po_items?.length ?? 0),
      }))
    : [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pembelian (Procurement)</h1>
        <p className="text-muted-foreground mt-1">
          Kelola supplier, Purchase Order (PO), dan Good Receipt (GR) barang masuk.
        </p>
      </div>
      <PembelianClient suppliers={suppliers} purchaseOrders={purchaseOrders} products={products} />
    </div>
  );
}
