import { auth } from "@/auth"
import { PengurusDashboard } from "./pengurus-dashboard"
import { KreditDashboard } from "./kredit-dashboard"
import { KasirDashboard } from "./kasir-dashboard"
import { MemberDashboard } from "./member-dashboard"
import { redirect } from "next/navigation"
import { getMySimpanan, getMyPinjaman, getMyOrders, getMyLoyalty } from "@/lib/actions/member-portal"
import { getKoperasiStats } from "@/lib/actions/koperasi-stats"
import { getAdminStats, getKreditStats, getKasirStats } from "@/lib/actions/dashboard-stats"
import { getPromotions } from "@/lib/actions/promotions"
import { getMemberDashboardConfig, getAppSettings } from "@/lib/actions/settings"
import { DashboardMobileRedirect } from "@/components/shared/dashboard-mobile-redirect"
import { getSuppliers } from "@/lib/actions/procurement"

export default async function DashboardPage() {
  const session = await auth()
  
  if (!session?.user) {
    redirect("/login")
  }

  const role = session.user.role
  const settings = await getAppSettings()
  const companyName = settings?.company_name ?? "Koperasi"

  if (role === "pengawas") {
    redirect("/pengawas")
  }

  if (["superadmin", "pengurus", "petugas_akuntan"].includes(role)) {
    const [data, suppliersResult] = await Promise.all([
      getAdminStats(),
      getSuppliers(true)
    ])
    const suppliers = (suppliersResult.data ?? []).map((s: any) => ({
      id: Number(s.id),
      supplier_name: s.supplier_name
    }))
    return (
      <DashboardMobileRedirect>
        <PengurusDashboard data={data} suppliers={suppliers} companyName={companyName} />
      </DashboardMobileRedirect>
    )
  } 
  
  if (role === "admin") {
    const data = await getKreditStats()
    return (
      <DashboardMobileRedirect>
        <KreditDashboard data={data} companyName={companyName} />
      </DashboardMobileRedirect>
    )
  }
  
  if (role === "kasir") {
    const data = await getKasirStats()
    return (
      <DashboardMobileRedirect>
        <KasirDashboard data={data} companyName={companyName} />
      </DashboardMobileRedirect>
    )
  }

  // default anggota
  const [simpanan, pinjaman, orders, stats, loyalty, allPromotions, dashboardConfig] = await Promise.all([
    getMySimpanan(),
    getMyPinjaman(),
    getMyOrders(),
    getKoperasiStats(),
    getMyLoyalty(),
    getPromotions(),
    getMemberDashboardConfig()
  ])

  // Hanya ambil promosi yang aktif
  const activePromotions = allPromotions.filter((p: any) => p.is_active)

  return (
    <DashboardMobileRedirect>
      <MemberDashboard data={{ simpanan, pinjaman, orders, stats, loyalty, promotions: activePromotions, dashboardConfig }} />
    </DashboardMobileRedirect>
  )
}
