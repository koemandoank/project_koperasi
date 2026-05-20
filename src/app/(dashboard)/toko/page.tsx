import { getMyOrders } from "@/lib/actions/member-portal"
import { getProducts } from "@/lib/actions/products"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { TokoAnggotaClient } from "./toko-anggota-client"

export default async function TokoAnggotaPage() {
  const session = await auth()
  if (!session?.user) return null

  // Hanya anggota yang boleh akses halaman toko belanja online
  const role = (session.user as any).role as string
  if (role && role !== "anggota") {
    redirect("/toko/kasir")
  }

  const [orders, products] = await Promise.all([
    getMyOrders(),
    getProducts()
  ])

  const activeProducts = products.filter((p: any) => p.is_active && p.stock > 0)

  return <TokoAnggotaClient products={activeProducts} orders={orders} />
}
