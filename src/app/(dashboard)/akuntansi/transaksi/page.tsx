import { getTransactionFormOptions, getRecentTransactions, getTodayTransactionStats } from "@/lib/actions/transactions"
import { TransaksiClient } from "./transaksi-client"

export const revalidate = 0 // Disable cache for this page so stats and lists are always fresh

/**
 * TransaksiPage - Next.js Server Component
 * 
 * Mengambil data awal secara server-side (opsi form COA, transaksi terkini, statistik hari ini)
 * dan mengirimkannya ke client component untuk rendering interaktif.
 */
export default async function TransaksiPage({
  searchParams
}: {
  searchParams: { [key: string]: string | undefined }
}) {
  const typeParam = searchParams?.type === "pemasukan" ? "pemasukan" : "pengeluaran"
  const optionsRes = await getTransactionFormOptions()
  const statsRes = await getTodayTransactionStats()
  const recentRes = await getRecentTransactions(10)

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
          Input Transaksi
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Catat aktivitas keuangan koperasi dengan cepat dan akurat.
        </p>
      </div>

      <TransaksiClient 
        initialAccounts={optionsRes.accounts || []}
        initialCategoriesExpense={optionsRes.categoriesExpense || []}
        initialCategoriesIncome={optionsRes.categoriesIncome || []}
        initialStats={statsRes.stats || { pemasukanHariIni: 0, pengeluaranHariIni: 0 }}
        initialRecentTransactions={recentRes.entries || []}
        defaultType={typeParam}
      />
    </div>
  )
}
