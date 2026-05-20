import { getMySimpanan } from "@/lib/actions/member-portal"
import { getAdminSimpananData } from "@/lib/actions/simpanan-admin"
import { getSavingTypes } from "@/lib/actions/saving-types"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Wallet, ArrowDownCircle, ArrowUpCircle } from "lucide-react"
import { SimpananAdminClient } from "./simpanan-admin-client"
import { SavingTypesModal } from "./saving-types-modal"

const formatRp = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)

const SAVING_TYPE_LABEL: Record<string, string> = {
  deposit: "Setor",
  withdrawal: "Tarik",
  interest: "Bunga",
  transfer_in: "Transfer Masuk",
  transfer_out: "Transfer Keluar",
}

export default async function SimpananPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const data = await getMySimpanan()
  const isAdmin = ["superadmin", "admin", "pengurus"].includes(session.user.role || "")

  // Admin/pengurus lihat semua
  if (isAdmin) {
    const [adminData, savingTypes] = await Promise.all([
      getAdminSimpananData(),
      getSavingTypes(),
    ])
    return (
      <div className="p-6 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Manajemen Simpanan</h1>
            <p className="text-muted-foreground">Ringkasan simpanan dan mutasi kas seluruh anggota.</p>
          </div>
          <SavingTypesModal initialTypes={savingTypes} />
        </div>
        {adminData ? (
          <SimpananAdminClient data={adminData} />
        ) : (
          <p className="text-muted-foreground">Data simpanan gagal dimuat.</p>
        )}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Data simpanan tidak ditemukan. Pastikan akun Anda telah terhubung ke data anggota.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Simpanan Saya</h1>
        <p className="text-muted-foreground">Saldo dan riwayat transaksi simpanan a.n. {data.member_name}</p>
      </div>

      {/* Saldo Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-0 shadow-lg">
          <CardContent className="pt-6">
            <Wallet className="h-8 w-8 mb-3 opacity-80" />
            <p className="text-blue-100 text-sm">Total Saldo</p>
            <p className="text-3xl font-bold mt-1">{formatRp(data.totalBalance)}</p>
          </CardContent>
        </Card>
        {data.savings.map((s: { id: number; type_name: string; balance: number; total_deposit: number; total_withdraw: number; last_transaction: string | null }) => (
          <Card key={s.id} className="border-l-4 border-l-blue-400">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground uppercase font-semibold">
                {s.type_name}
              </p>
              <p className="text-2xl font-bold mt-1">{formatRp(s.balance)}</p>
              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                <span className="text-green-600">↑ {formatRp(s.total_deposit)}</span>
                <span className="text-red-500">↓ {formatRp(s.total_withdraw)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Terakhir: {s.last_transaction ? new Date(s.last_transaction).toLocaleDateString('id-ID') : "-"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Riwayat */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat Transaksi Simpanan</CardTitle>
        </CardHeader>
        <CardContent>
          {data.transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">Belum ada transaksi.</p>
          ) : (
            <div className="space-y-3">
              {data.transactions.map((t: { id: number; type: string; saving_name: string; reference_no: string; transaction_at: string; amount: number; balance_after: number }) => {
                const isCredit = t.type === "deposit" || t.type === "interest"
                return (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border bg-slate-50/50 dark:bg-slate-900/30">
                    <div className="flex items-center gap-3">
                      {isCredit
                        ? <ArrowDownCircle className="h-5 w-5 text-green-500 shrink-0" />
                        : <ArrowUpCircle className="h-5 w-5 text-red-500 shrink-0" />
                      }
                      <div>
                        <p className="text-sm font-medium">{SAVING_TYPE_LABEL[t.type] || t.type} — {t.saving_name}</p>
                        <p className="text-xs text-muted-foreground">{t.reference_no} • {new Date(t.transaction_at).toLocaleDateString('id-ID')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${isCredit ? "text-green-600" : "text-red-600"}`}>
                        {isCredit ? "+" : "-"}{formatRp(t.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">Saldo: {formatRp(t.balance_after)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
