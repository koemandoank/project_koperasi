"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Edit, Trash2, Search } from "lucide-react"
import { deleteProduct } from "@/lib/actions/products"
import { toast } from "sonner"
import { ProductForm } from "./product-form"

export function ProductTable({ products, units, categories, canEdit = false }: { products: any[], units: any[], categories: any[], canEdit?: boolean }) {
  const [search, setSearch] = useState("")

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    (p.category_name || "").toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async (id: number) => {
    if (confirm("Yakin ingin menghapus barang ini?")) {
      const res = await deleteProduct(id)
      if (res.success) toast.success("Barang berhasil dihapus")
      else toast.error(res.error)
    }
  }

  const formatRupiah = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)

  return (
    <div className="space-y-4">
      <div className="relative w-full md:w-1/3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Cari nama barang atau kategori..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="border rounded-md bg-card">
        <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14">Foto</TableHead>
            <TableHead>SKU / Kode</TableHead>
            <TableHead>Nama Barang</TableHead>
            <TableHead>Kategori</TableHead>
            <TableHead className="text-right">Harga Beli</TableHead>
            <TableHead className="text-right">Harga Jual (Umum)</TableHead>
            <TableHead className="text-right">Harga Anggota</TableHead>
            <TableHead className="text-center">Stok</TableHead>
            {canEdit && <TableHead className="text-right">Aksi</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredProducts.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-6 text-muted-foreground">
                Belum ada data barang.
              </TableCell>
            </TableRow>
          )}
          {filteredProducts.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <div className="h-11 w-11 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-center overflow-hidden">
                  {p.image_path ? (
                    <img src={p.image_path} alt={p.name} className="object-cover w-full h-full" />
                  ) : (
                    <span className="font-bold text-slate-300 text-sm uppercase">{p.name.substring(0,2)}</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="font-medium">{p.sku}</TableCell>
              <TableCell>{p.name}</TableCell>
              <TableCell>
                <Badge variant="secondary">{p.category_name}</Badge>
              </TableCell>
              <TableCell className="text-right">{formatRupiah(p.purchase_price)}</TableCell>
              <TableCell className="text-right font-semibold">{formatRupiah(p.price)}</TableCell>
              <TableCell className="text-right font-semibold text-blue-600">
                {p.member_price ? formatRupiah(p.member_price) : "-"}
              </TableCell>
              <TableCell className="text-center">
                <Badge variant={p.stock > 10 ? "default" : "destructive"}>
                  {p.stock} {p.unit_measure}
                </Badge>
              </TableCell>
              {canEdit && (
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <ProductForm 
                      units={units} 
                      categories={categories}
                      productToEdit={p} 
                      trigger={
                        <Button variant="outline" size="icon" className="h-8 w-8 text-blue-600">
                          <Edit className="h-4 w-4" />
                        </Button>
                      } 
                    />
                    
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(p.id)}
                      title="Hapus"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </div>
  )
}
