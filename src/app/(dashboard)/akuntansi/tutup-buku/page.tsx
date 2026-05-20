import { getMonthlyClosures } from "@/lib/actions/accounting"
import { ClosingClient } from "./closing-client"

export default async function TutupBukuPage() {
  const closures = await getMonthlyClosures()

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tutup Buku Bulanan</h1>
          <p className="text-muted-foreground">Proses rekapitulasi dan penguncian transaksi bulanan (SHU sementara).</p>
        </div>
      </div>
      
      <ClosingClient closures={closures} />
    </div>
  )
}
