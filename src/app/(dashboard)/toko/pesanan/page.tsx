import { getOnlineOrders } from "@/lib/actions/online-orders"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { OnlinePesananClient } from "./online-pesanan-client"

export default async function PesananOnlinePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const session = await auth()
  const role = session?.user?.role || ""
  if (!["superadmin", "admin", "pengurus", "kasir"].includes(role)) redirect("/dashboard")

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || "1"))
  const pageSize = 20

  const result = await getOnlineOrders(undefined, page, pageSize)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pesanan Online</h1>
        <p className="text-muted-foreground">Kelola pesanan yang masuk dari portal anggota.</p>
      </div>
      <OnlinePesananClient orders={result.data} pagination={result.pagination} />
    </div>
  )
}

