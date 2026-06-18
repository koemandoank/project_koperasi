import { Suspense } from "react"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getAppSettings } from "@/lib/actions/settings"
import { DashboardMobileRedirect } from "@/components/shared/dashboard-mobile-redirect"
import { DashboardSkeleton } from "@/components/ui/skeletons"

// ─── Lazy async sub-components (each fetches its own data) ────────────────────

// Pengurus / Superadmin / Petugas Akuntan
async function PengurusDashboardSection({ role, companyName }: { role: string; companyName: string }) {
  const { getAdminStats } = await import("@/lib/actions/dashboard-stats")
  const { getSuppliers } = await import("@/lib/actions/procurement")
  const { PengurusDashboard } = await import("./pengurus-dashboard")

  const [data, suppliersResult] = await Promise.all([
    getAdminStats(),
    getSuppliers(true),
  ])
  const suppliers = (suppliersResult.data ?? []).map((s: any) => ({
    id: Number(s.id),
    supplier_name: s.supplier_name,
  }))

  return <PengurusDashboard data={data} suppliers={suppliers} companyName={companyName} />
}

// Admin / Kredit
async function KreditDashboardSection({ companyName }: { companyName: string }) {
  const { getKreditStats } = await import("@/lib/actions/dashboard-stats")
  const { KreditDashboard } = await import("./kredit-dashboard")

  const data = await getKreditStats()
  return <KreditDashboard data={data} companyName={companyName} />
}

// Kasir
async function KasirDashboardSection({ companyName }: { companyName: string }) {
  const { getKasirStats } = await import("@/lib/actions/dashboard-stats")
  const { KasirDashboard } = await import("./kasir-dashboard")

  const data = await getKasirStats()
  return <KasirDashboard data={data} companyName={companyName} />
}

// Anggota
async function MemberDashboardSection() {
  const { getMySimpanan, getMyPinjaman, getMyOrders, getMyLoyalty } = await import("@/lib/actions/member-portal")
  const { getKoperasiStats } = await import("@/lib/actions/koperasi-stats")
  const { getPromotions } = await import("@/lib/actions/promotions")
  const { getMemberDashboardConfig } = await import("@/lib/actions/settings")
  const { MemberDashboard } = await import("./member-dashboard")

  const [simpanan, pinjaman, orders, stats, loyalty, allPromotions, dashboardConfig] = await Promise.all([
    getMySimpanan(),
    getMyPinjaman(),
    getMyOrders(),
    getKoperasiStats(),
    getMyLoyalty(),
    getPromotions(),
    getMemberDashboardConfig(),
  ])

  const activePromotions = allPromotions.filter((p: any) => p.is_active)

  return (
    <MemberDashboard
      data={{ simpanan, pinjaman, orders, stats, loyalty, promotions: activePromotions, dashboardConfig }}
    />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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

  return (
    <DashboardMobileRedirect>
      {["superadmin", "pengurus", "petugas_akuntan"].includes(role) ? (
        <Suspense fallback={<DashboardSkeleton />}>
          <PengurusDashboardSection role={role} companyName={companyName} />
        </Suspense>
      ) : role === "admin" ? (
        <Suspense fallback={<DashboardSkeleton />}>
          <KreditDashboardSection companyName={companyName} />
        </Suspense>
      ) : role === "kasir" ? (
        <Suspense fallback={<DashboardSkeleton />}>
          <KasirDashboardSection companyName={companyName} />
        </Suspense>
      ) : (
        <Suspense fallback={<DashboardSkeleton />}>
          <MemberDashboardSection />
        </Suspense>
      )}
    </DashboardMobileRedirect>
  )
}
