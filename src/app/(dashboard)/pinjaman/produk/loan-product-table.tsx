"use client"

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Edit } from "lucide-react"
import { toggleLoanProductStatus } from "@/lib/actions/loan-products"
import { toast } from "sonner"
import { LoanProductForm } from "./loan-product-form"

const formatRp = (v: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)

export function LoanProductTable({ products }: { products: {
    id: number; code: string; name: string; interest_rate: number; 
    interest_method: string; max_tenor: number; max_amount: number; 
    min_amount: number; admin_fee_pct: number; penalty_pct: number; 
    requires_guarantor: boolean; requirements: string | null; is_active: boolean;
}[] }) {
  const handleToggle = async (id: number, currentStatus: boolean) => {
    const res = await toggleLoanProductStatus(id, !currentStatus)
    if (res.success) toast.success("Status berhasil diubah")
    else toast.error("Gagal mengubah status")
  }

  return (
    <div>
      {/* Desktop Table View */}
      <div className="hidden md:block border rounded-xl bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kode</TableHead>
              <TableHead>Nama Produk</TableHead>
              <TableHead className="text-center">Bunga/bln</TableHead>
              <TableHead className="text-center">Metode</TableHead>
              <TableHead className="text-center">Tenor Max</TableHead>
              <TableHead className="text-right">Min</TableHead>
              <TableHead className="text-right">Max</TableHead>
              <TableHead className="text-center">Penjamin</TableHead>
              <TableHead className="text-center">Aktif</TableHead>
              <TableHead className="text-center">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-10 text-slate-400">
                  Belum ada data produk pinjaman.
                </TableCell>
              </TableRow>
            )}
            {products.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-mono font-semibold">{p.code}</TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className="text-blue-600 border-blue-200">{p.interest_rate}%</Badge>
                </TableCell>
                <TableCell className="text-center capitalize">{p.interest_method}</TableCell>
                <TableCell className="text-center">{p.max_tenor} bln</TableCell>
                <TableCell className="text-right text-sm">{formatRp(p.min_amount)}</TableCell>
                <TableCell className="text-right font-semibold">{formatRp(p.max_amount)}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={p.requires_guarantor ? "secondary" : "outline"}>
                    {p.requires_guarantor ? "Wajib" : "Tidak"}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={p.is_active}
                    onCheckedChange={() => handleToggle(p.id, p.is_active)}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <LoanProductForm
                    productToEdit={p}
                    trigger={
                      <Button variant="outline" size="icon" className="h-8 w-8 text-blue-600">
                        <Edit className="h-4 w-4" />
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card Feed View */}
      <div className="block md:hidden space-y-3">
        {products.length === 0 && (
          <div className="text-center py-10 text-slate-400 border border-dashed rounded-2xl bg-white dark:bg-slate-900">
            Belum ada data produk pinjaman.
          </div>
        )}
        {products.map(p => (
          <div
            key={p.id}
            className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-3 ${
              !p.is_active ? "opacity-50" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">{p.code}</span>
                  <Badge variant="outline" className="text-xs text-blue-600">{p.interest_rate}% / bln</Badge>
                  <Badge variant={p.requires_guarantor ? "default" : "outline"} className="text-xs">
                    {p.requires_guarantor ? "Wajib Penjamin" : "Tanpa Penjamin"}
                  </Badge>
                </div>
                <p className="font-bold text-base text-slate-900 dark:text-slate-50">{p.name}</p>
                <p className="text-xs text-slate-400 mt-0.5 capitalize">Metode Bunga: {p.interest_method} · Max Tenor: {p.max_tenor} bln</p>
              </div>
              <div className="flex items-center">
                <Switch
                  checked={p.is_active}
                  onCheckedChange={() => handleToggle(p.id, p.is_active)}
                  className="scale-95"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-50 dark:border-slate-800/50 pt-2.5">
              <div>
                <p className="text-slate-400">Min. Pinjaman</p>
                <p className="font-semibold text-slate-700 dark:text-slate-300">{formatRp(p.min_amount)}</p>
              </div>
              <div>
                <p className="text-slate-400">Max. Pinjaman</p>
                <p className="font-bold text-slate-900 dark:text-slate-100">{formatRp(p.max_amount)}</p>
              </div>
            </div>

            <div className="flex gap-2 border-t border-slate-50 dark:border-slate-800/50 pt-3">
              <LoanProductForm
                productToEdit={p}
                trigger={
                  <Button variant="outline" className="w-full h-11 gap-2 font-medium">
                    <Edit className="h-4 w-4" /> Edit Produk
                  </Button>
                }
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
