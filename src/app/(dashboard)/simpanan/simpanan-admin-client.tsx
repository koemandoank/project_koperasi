"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Wallet } from "lucide-react"

const formatRp = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)

const SAVING_TYPE_LABEL: Record<string, string> = {
  deposit: "Setoran",
  withdrawal: "Penarikan",
  interest: "Bunga SHU",
  transfer_in: "Transfer Masuk",
  transfer_out: "Transfer Keluar",
}

type GroupedSaving = { type_name: string; total: number };
type RecentTransaction = { id: number; transaction_at: string; member_name: string; member_code: string; saving_type: string; type: string; amount: number; balance_after: number };
type AdminData = { totalBalance: number; groupedSavings: GroupedSaving[]; recentTransactions: RecentTransaction[] };

export function SimpananAdminClient({ data }: { data: AdminData }) {
  if (!data) return <p>Data gagal dimuat.</p>

  return (
    <div className="space-y-6">
      {/* Saldo Cards - 4 Tab Berbaris Style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-0 shadow-lg">
          <CardContent className="pt-6">
            <Wallet className="h-8 w-8 mb-3 opacity-80" />
            <p className="text-blue-100 text-sm">Total Dana Terhimpun</p>
            <p className="text-3xl font-bold mt-1">{formatRp(data.totalBalance)}</p>
          </CardContent>
        </Card>
        {data.groupedSavings.map((g: GroupedSaving, i: number) => (
          <Card key={i} className="border-l-4 border-l-blue-400">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground uppercase font-semibold">
                {g.type_name}
              </p>
              <p className="text-2xl font-bold mt-1">{formatRp(g.total)}</p>
              <div className="flex gap-4 mt-2 text-xs text-muted-foreground opacity-0">
                {/* Placeholder untuk menjaga tinggi kartu agar sama dengan member */}
                <span>-</span>
              </div>
              <p className="text-xs text-blue-600 mt-1 font-medium">
                Dana Kolektif Anggota
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Riwayat Transaksi Terbaru</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Anggota</TableHead>
                <TableHead>Jenis Simpanan</TableHead>
                <TableHead>Transaksi</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
                <TableHead className="text-right">Saldo Akhir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recentTransactions.map((t: RecentTransaction) => (
                <TableRow key={t.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(t.transaction_at).toLocaleString('id-ID')}
                  </TableCell>
                  <TableCell>
                    <p className="font-semibold">{t.member_name}</p>
                    <p className="text-xs text-muted-foreground">{t.member_code}</p>
                  </TableCell>
                  <TableCell>{t.saving_type}</TableCell>
                  <TableCell>
                    <Badge variant={t.type === 'deposit' ? 'default' : t.type === 'withdrawal' ? 'destructive' : 'secondary'} className="text-xs">
                      {SAVING_TYPE_LABEL[t.type] || t.type}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-right font-bold ${t.type === 'withdrawal' ? 'text-red-500' : 'text-green-600'}`}>
                    {t.type === 'withdrawal' ? '-' : '+'}{formatRp(t.amount)}
                  </TableCell>
                  <TableCell className="text-right">{formatRp(t.balance_after)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
