import { getAppSettings } from "@/lib/actions/settings"
import { SettingsForm } from "./settings-form"

export default async function PengaturanPage() {
  const settings = await getAppSettings()
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold tracking-tight mb-6">Pengaturan Sistem</h1>
      <SettingsForm initialData={settings} />
    </div>
  )
}
