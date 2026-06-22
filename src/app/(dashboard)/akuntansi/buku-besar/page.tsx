import { getJournalEntries, getGeneralLedgerNotifications } from "@/lib/actions/buku-besar"
import { BukuBesarClient } from "./buku-besar-client"

export default async function BukuBesarPage({
  searchParams
}: {
  searchParams: { [key: string]: string | undefined }
}) {
  const { startDate, endDate, search, page } = searchParams
  const [data, notifications] = await Promise.all([
    getJournalEntries({
      startDate, endDate, search, page: page ? parseInt(page) : 1
    }),
    getGeneralLedgerNotifications()
  ])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Buku Besar</h1>
        <p className="text-muted-foreground">Riwayat seluruh jurnal akuntansi (Journal Entries).</p>
      </div>
      <BukuBesarClient data={data} notifications={notifications} />
    </div>
  )
}
