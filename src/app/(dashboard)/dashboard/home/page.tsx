import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getAppSettings, getMemberDashboardConfig } from "@/lib/actions/settings"
import { getMyOrders } from "@/lib/actions/member-portal"
import { getPromotions } from "@/lib/actions/promotions"
import { DashboardHomePage } from "./home-page-client"

export default async function DashboardHome() {
  const session = await auth()
  
  if (!session?.user) {
    redirect("/login")
  }

  const [settings, promotions, dashboardConfig] = await Promise.all([
    getAppSettings(),
    getPromotions(),
    getMemberDashboardConfig(),
  ])

  const role = session.user.role
  let orders: any[] = []

  if (role === "anggota") {
    orders = await getMyOrders()
  }

  const today = new Date().toISOString().split("T")[0]
  const todayOrders = orders?.filter((o: any) => o.created_at?.split("T")[0] === today) || []

  return <DashboardHomePage settings={settings} promotions={promotions} todayOrders={todayOrders} dashboardConfig={dashboardConfig} />
}
