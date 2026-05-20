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
    <div className="border rounded-xl bg-card overflow-hidden">
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
              <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
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
  )
}
