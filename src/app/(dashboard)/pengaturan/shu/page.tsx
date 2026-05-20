import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ShuConfigForm } from "./shu-settings-form";
import { DEFAULT_SHU_CONFIG, migrateLegacyShuConfig, type ShuConfig } from "@/lib/types/shu-config.types";
import { prisma } from "@/lib/db/prisma";

async function getShuConfig(): Promise<ShuConfig> {
  try {
    const settings = await prisma.app_settings.findFirst();
    if (!settings?.shu_config) return DEFAULT_SHU_CONFIG;
    const raw = JSON.parse(settings.shu_config) as Record<string, unknown>;
    return migrateLegacyShuConfig(raw);
  } catch {
    return DEFAULT_SHU_CONFIG;
  }
}

export default async function ShuSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const config = await getShuConfig();
  const userRole = session.user.role ?? "anggota";

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Konfigurasi Parameter SHU</h1>
        <p className="text-muted-foreground">
          Pengaturan formula dan alokasi Sisa Hasil Usaha sesuai UU No. 25 Tahun 1992.
          {" "}Perubahan dicatat dalam audit log secara otomatis.
        </p>
      </div>
      <ShuConfigForm initialConfig={config} userRole={userRole} />
    </div>
  );
}
