import { getMemberDashboardConfig } from "@/lib/actions/settings"
import { DashboardAnggotaSettingsForm } from "./dashboard-anggota-settings-form"

export default async function DashboardAnggotaSettingsPage() {
  const config = await getMemberDashboardConfig()
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold tracking-tight mb-2">Pengaturan Dashboard Anggota</h1>
      <p className="text-muted-foreground mb-6">Kelola fitur dan tampilan apa saja yang bisa dilihat oleh anggota di dashboard mereka.</p>
      
      <DashboardAnggotaSettingsForm initialConfig={config} />
    </div>
  )
}
