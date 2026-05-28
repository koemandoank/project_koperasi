"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Activity, CreditCard, DollarSign, Users } from "lucide-react"

const shuData = [
  { name: "2020", amount: 4000 },
  { name: "2021", amount: 3000 },
  { name: "2022", amount: 5000 },
  { name: "2023", amount: 8000 },
  { name: "2024", amount: 12000 },
]

export function AdminDashboard({ companyName = "Koperasi" }: { companyName?: string }) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">{companyName}</h1>
        <p className="text-sm text-muted-foreground font-medium">Dashboard Admin</p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Saldo Koperasi</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Rp 1.250.000.000</div>
            <p className="text-xs text-muted-foreground">+20.1% dari bulan lalu</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pinjaman Aktif</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">142</div>
            <p className="text-xs text-muted-foreground">+12 pengajuan baru</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Anggota</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">850</div>
            <p className="text-xs text-muted-foreground">+4 anggota bulan ini</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktivitas Toko</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+573</div>
            <p className="text-xs text-muted-foreground">transaksi minggu ini</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Distribusi SHU (5 Tahun Terakhir)</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={shuData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => `Rp ${value}M`} />
                  <Tooltip formatter={(value) => [`Rp ${value} Juta`, 'SHU']} />
                  <Bar dataKey="amount" fill="currentColor" className="fill-primary" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Produk Terlaris (Toko & PPOB)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {['Token Listrik 100k', 'Beras Premium 5kg', 'Minyak Goreng 2L', 'Paket Data Telkomsel'].map((item: any, i: any) => (
                <div key={item} className="flex items-center">
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-medium leading-none">{item}</p>
                    <p className="text-sm text-muted-foreground">
                      {150 - i * 20} transaksi
                    </p>
                  </div>
                  <div className="ml-auto font-medium">
                    +Rp {(150 - i * 20) * 15000}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
