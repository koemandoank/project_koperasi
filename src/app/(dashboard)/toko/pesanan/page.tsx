import { getOnlineOrders } from "@/lib/actions/online-orders"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { OnlinePesananClient } from "./online-pesanan-client"

export default async function PesananOnlinePage() {
  const session = await auth()
  const role = session?.user?.role || ""
  if (!["superadmin", "admin", "pengurus", "kasir"].includes(role)) redirect("/dashboard")

  const orders = await getOnlineOrders()

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pesanan Online</h1>
        <p className="text-muted-foreground">Kelola pesanan yang masuk dari portal anggota.</p>
      </div>
      <OnlinePesananClient orders={orders} />
    </div>
  )
}
