"use client"

/**
 * SimpananAdminClient — Mobile-First Feed Cards
 *
 * Replaces the desktop transaction <Table> with a feed-style card list.
 * Summary stat cards remain in a scrollable horizontal strip on mobile.
 * All data display logic is preserved.
 *
 * @param data - Admin savings data including totals, grouped savings, and recent transactions
 */

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Wallet, ArrowUpCircle, ArrowDownCircle, RefreshCw } from "lucide-react"

const formatRp = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)

const SAVING_TYPE_LABEL: Record<string, string> = {
  deposit:      "Setoran",
  withdrawal:   "Penarikan",
  interest:     "Bunga SHU",
  transfer_in:  "Transfer Masuk",
  transfer_out: "Transfer Keluar",
}

type GroupedSaving = { type_name: string; total: number }
type RecentTransaction = {
  id: number
  transaction_at: string
  member_name: string
  member_code: string
  saving_type: string
  type: string
  amount: number
  balance_after: number
}
type AdminData = {
  totalBalance: number
  groupedSavings: GroupedSaving[]
  recentTransactions: RecentTransaction[]
}

export function SimpananAdminClient({ data }: { data: AdminData }) {
  if (!data) return <p className="text-center text-slate-400 py-8">Data gagal dimuat.</p>

  return (
    <div className="space-y-6">
      {/* ── Summary Strip (horizontal scroll on mobile) ── */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
        {/* Total Balance Hero Card */}
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-4 text-white shrink-0 min-w-[200px]">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="h-5 w-5 opacity-80" />
            <p className="text-sm text-blue-100 font-medium">Total Dana Terhimpun</p>
          </div>
          <p className="text-2xl font-bold">{formatRp(data.totalBalance)}</p>
        </div>

        {/* Per-type Savings Cards */}
        {data.groupedSavings.map((g: GroupedSaving, i: number) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm shrink-0 min-w-[180px]"
          >
            <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide mb-1">
              {g.type_name}
            </p>
            <p className="text-xl font-bold text-slate-900 dark:text-slate-50">
              {formatRp(g.total)}
            </p>
            <p className="text-xs text-blue-600 mt-1 font-medium">Dana Kolektif</p>
          </div>
        ))}
      </div>

      {/* ── Recent Transactions Feed ── */}
      <div>
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-50 mb-3">
          Riwayat Transaksi Terbaru
        </h3>

        {data.recentTransactions.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">
            Belum ada transaksi.
          </div>
        ) : (
          <div className="space-y-2">
            {data.recentTransactions.map((t: RecentTransaction) => {
              const isDeposit = t.type === "deposit" || t.type === "transfer_in" || t.type === "interest"
              const AmountIcon = isDeposit ? ArrowUpCircle : ArrowDownCircle

              return (
                <div
                  key={t.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 flex items-center gap-3"
                >
                  {/* Icon */}
                  <div className={`h-11 w-11 rounded-full flex items-center justify-center shrink-0 ${
                    isDeposit
                      ? "bg-green-100 dark:bg-green-900/30"
                      : "bg-red-100 dark:bg-red-900/30"
                  }`}>
                    <AmountIcon className={`h-5 w-5 ${
                      isDeposit ? "text-green-600" : "text-red-500"
                    }`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-slate-900 dark:text-slate-50 truncate">
                        {t.member_name}
                      </p>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {t.member_code}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {t.saving_type} · {SAVING_TYPE_LABEL[t.type] || t.type}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(t.transaction_at).toLocaleString('id-ID', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>

                  {/* Amount */}
                  <div className="text-right shrink-0">
                    <p className={`font-bold text-sm ${isDeposit ? "text-green-600" : "text-red-500"}`}>
                      {isDeposit ? "+" : "-"}{formatRp(t.amount)}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Saldo: {formatRp(t.balance_after)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
