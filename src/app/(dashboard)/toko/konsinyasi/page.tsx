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
    prisma.products.findMany({
      where: { is_active: true },
      select: {
        id: true,
        name: true,
        purchase_price: true,
        product_categories: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  // Data sudah di-map flat oleh getConsignmentItems — langsung pakai
  const items = itemsRes.success ? (itemsRes.data as any[]) : [];

  // Data sudah di-map flat oleh getConsignmentPayables — langsung pakai
  const payables = payablesRes.success ? (payablesRes.data as any[]) : [];

  const suppliers = suppliersRes.success
    ? (suppliersRes.data as any[]).map((s) => ({
        id: Number(s.id),
        supplier_name: s.supplier_name,
      }))
    : [];

  const products = productsRaw.map((p) => ({
    id: Number(p.id),
    name: p.name,
    category: (p as any).product_categories?.name ?? "",
    purchase_price: Number(p.purchase_price ?? 0),
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
