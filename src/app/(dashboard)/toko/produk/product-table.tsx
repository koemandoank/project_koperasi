"use client"

/**
 * ProductTable — Mobile-First Card Grid
 *
 * Replaces the desktop <Table> with a 2-column responsive card grid.
 * All business logic (state, handlers, Server Actions) is preserved.
 *
 * @param products - Product list from server
 * @param units - Unit options for product form
 * @param categories - Category options for product form
 * @param canEdit - Whether to show edit/delete controls (admin/pengurus only)
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Edit, Trash2, Search, Package } from "lucide-react"
import { deleteProduct } from "@/lib/actions/products"
import { toast } from "sonner"
import { ProductForm } from "./product-form"

const formatRupiah = (val: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)

export function ProductTable({
  products,
  units,
  categories,
  canEdit = false
}: {
  products: any[]
  units: any[]
  categories: any[]
  canEdit?: boolean
}) {
  const [search, setSearch] = useState("")

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category_name || "").toLowerCase().includes(search.toLowerCase())
  )

  /**
   * Deletes a product after confirmation.
   * @param id - Product ID to delete
   */
  const handleDelete = async (id: number) => {
    if (!confirm("Yakin ingin menghapus barang ini?")) return
    const res = await deleteProduct(id)
    if (res.success) toast.success("Barang berhasil dihapus")
    else toast.error(res.error)
  }

  return (
    <div className="space-y-4">
      {/* ── Search Bar ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Cari nama barang atau kategori..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-12 text-base"
        />
      </div>

      {/* ── Empty State ── */}
      {filteredProducts.length === 0 && (
        <div className="py-12 text-center text-slate-400 text-sm">
          Belum ada data barang ditemukan.
        </div>
      )}

      {/* ── Card Grid (2-col on mobile, 3-col on md+) ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filteredProducts.map((p) => (
          <div
            key={p.id}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col"
          >
            {/* Product Image */}
            <div className="relative aspect-square bg-slate-50 dark:bg-slate-800 overflow-hidden">
              {p.image_path ? (
                <img
                  src={p.image_path}
                  alt={p.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-10 w-10 text-slate-200" />
                </div>
              )}
              {/* Stock badge overlay */}
              <div className="absolute bottom-2 left-2">
                <Badge
                  variant={p.stock > 10 ? "default" : p.stock > 0 ? "secondary" : "destructive"}
                  className="text-xs shadow-sm"
                >
                  {p.stock} {p.unit_measure}
                </Badge>
              </div>
            </div>

            {/* Product Info */}
            <div className="p-3 flex-1 flex flex-col gap-1">
              <p className="font-semibold text-sm text-slate-900 dark:text-slate-50 line-clamp-2 leading-tight">
                {p.name}
              </p>
              <p className="text-xs text-slate-400">{p.sku}</p>
              <Badge variant="secondary" className="text-xs w-fit mt-0.5">
                {p.category_name}
              </Badge>

              <div className="mt-auto pt-2">
                <p className="text-base font-bold text-slate-900 dark:text-slate-50">
                  {formatRupiah(p.price)}
                </p>
                {p.member_price && (
                  <p className="text-xs text-blue-600 font-medium">
                    Anggota: {formatRupiah(p.member_price)}
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons (canEdit only) */}
            {canEdit && (
              <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-50 dark:border-slate-800">
                <ProductForm
                  units={units}
                  categories={categories}
                  productToEdit={p}
                  trigger={
                    <Button
                      variant="outline"
                      size="icon"
                      className="flex-1 h-11 text-blue-600 border-blue-100 active:bg-blue-50"
                      title="Edit Barang"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  }
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="flex-1 h-11 text-destructive border-red-100 active:bg-red-50"
                  onClick={() => handleDelete(p.id)}
                  title="Hapus"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
