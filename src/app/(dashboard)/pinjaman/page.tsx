import { getMyPinjaman, getMyOrders } from "@/lib/actions/member-portal"
import { getLoanProducts } from "@/lib/actions/loan-products"
import { getAllLoans } from "@/lib/actions/loans"
import { auth } from "@/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CreditCard, ShoppingBag, Clock, CheckCircle, XCircle } from "lucide-react"
import { MemberLoanForm } from "./member-loan-form"
import { KelolaPinjamanClient } from "./kelola-pinjaman-client"
import Link from "next/link"

const formatRp = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  active:      { label: "Aktif",       cls: "bg-green-100 text-green-700" },
  paid_off:    { label: "Lunas",       cls: "bg-slate-100 text-slate-600" },
  overdue:     { label: "Menunggak",   cls: "bg-red-100 text-red-700" },
  pending:     { label: "Menunggu",    cls: "bg-amber-100 text-amber-700" },
  approved:    { label: "Disetujui",   cls: "bg-green-100 text-green-700" },
  rejected:    { label: "Ditolak",     cls: "bg-red-100 text-red-700" },
  draft:       { label: "Draft",       cls: "bg-slate-100 text-slate-600" },
}

export default async function PinjamanPage() {
  const session = await auth()
  if (!session?.user) return null

  const isAdmin = ["superadmin", "admin", "pengurus"].includes(session.user.role || "")

  if (isAdmin) {
    const allLoans = await getAllLoans()
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manajemen Pinjaman Anggota</h1>
          <p className="text-muted-foreground mt-1">
            Kelola saldo outstanding, tinjau jadwal angsuran, dan catat pelunasan cicilan anggota.
          </p>
        </div>
        <KelolaPinjamanClient initialLoans={allLoans} />
      </div>
    )
  }

  const [data, loanProducts] = await Promise.all([
    getMyPinjaman(),
    getLoanProducts()
  ])

  if (!data) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Data pinjaman tidak ditemukan. Pastikan akun terhubung ke data anggota.
          </CardContent>
        </Card>
      </div>
    )
  }

  const activeLoanProducts = loanProducts.filter((p: { is_active: boolean | null }) => p.is_active)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pinjaman Saya</h1>
          <p className="text-muted-foreground">Kelola dan ajukan pinjaman a.n. {data.member_name}</p>
        </div>
        <MemberLoanForm loanProducts={activeLoanProducts} memberId={data.member_id} />
      </div>

      {/* Pinjaman Aktif */}
      {data.loans.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-lg">Pinjaman Berjalan</h2>
          {data.loans.map((l: any) => (
            <Link key={l.id} href={`/pinjaman/transaksi/${l.id}`} className="block">
              <Card className={`border-l-4 hover:shadow-md transition-shadow cursor-pointer ${l.status === "active" ? "border-l-green-400" : l.status === "overdue" ? "border-l-red-400" : "border-l-slate-300"}`}>
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-mono font-semibold text-lg text-blue-700 dark:text-blue-400">
                        {l.product?.name || l.loan_applications?.loan_products?.name || "Pinjaman"}
                      </p>
                      <p className="font-mono text-sm">{l.loan_no}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Metode: {l.repayment_method === "salary_cut" ? "Potong Gaji" : "Tunai"}
                      </p>
                    </div>
                    <Badge className={STATUS_MAP[l.status]?.cls}>{STATUS_MAP[l.status]?.label}</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Pokok Pinjaman</p>
                      <p className="font-semibold">{formatRp(l.principal)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Sisa Hutang</p>
                      <p className="font-bold text-red-600">{formatRp(l.outstanding)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Cicilan/Bulan</p>
                      <p className="font-semibold">{formatRp(l.monthly_installment)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Jatuh Tempo Berikutnya</p>
                      <p className="font-semibold text-amber-600">{l.next_due || "-"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Tagihan Paylater Berjalan */}
      {data.paylater_debts && data.paylater_debts.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-lg">Tagihan Bayar Tempo (Toko)</h2>
          {data.paylater_debts.map((p: any) => (
            <Card key={p.id} className="border-l-4 border-l-amber-400">
              <CardContent className="pt-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-mono font-semibold">{p.order_no}</p>
                    <p className="text-sm text-muted-foreground">
                      Tanggal Pembelian: {new Date(p.ordered_at).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                  <Badge className="bg-amber-100 text-amber-700">Belum Dibayar</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Tagihan</p>
                    <p className="font-bold text-red-600">{formatRp(p.amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Sistem Pembayaran</p>
                    <p className="font-semibold">Potong Gaji</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Riwayat Pengajuan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat Pengajuan Pinjaman</CardTitle>
        </CardHeader>
        <CardContent>
          {data.applications.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">Belum ada pengajuan pinjaman.</p>
          ) : (
            <div className="space-y-2">
              {data.applications.map((a: any) => (
                <div key={a.id} className="block rounded-lg border overflow-hidden bg-white dark:bg-slate-900">
                  <div className="flex justify-between items-center p-3">
                    <div>
                      <p className="font-mono text-sm font-semibold">{a.application_no}</p>
                      <p className="text-xs text-muted-foreground">{a.product_name} — {formatRp(a.amount_requested)}</p>
                    </div>
                    <div className="text-right">
                      <Badge className={STATUS_MAP[a.status]?.cls}>{STATUS_MAP[a.status]?.label}</Badge>
                      {a.status === "approved" && a.queue_number && (
                        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-450 mt-1">
                          Antrean #{a.queue_number}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString('id-ID') : "-"}
                      </p>
                    </div>
                  </div>
                  {/* Warning on rule violations for pending */}
                  {a.status === "pending" && a.rule_violations && a.rule_violations.length > 0 && (
                    <div className="px-3 pb-3 pt-1 bg-red-50/50 dark:bg-red-950/10 border-t border-red-100/50 dark:border-red-900/20">
                      {a.rule_violations.map((violation: string, idx: number) => (
                        <p key={idx} className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1 mt-1">
                          ⚠️ {violation}
                        </p>
                      ))}
                    </div>
                  )}
                  {/* Warning/Reason for rejected applications */}
                  {a.status === "rejected" && a.rejection_note && (
                    <div className="px-3 pb-3 pt-1 bg-red-50/50 dark:bg-red-950/10 border-t border-red-100/50 dark:border-red-900/20 animate-in fade-in slide-in-from-top-1 duration-200">
                      <p className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1 mt-1">
                        ❌ {a.rejection_note}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
