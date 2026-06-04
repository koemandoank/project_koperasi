import { PPOBSettingsForm } from "./ppob-settings-form";
import { getPpobSettings } from "@/lib/actions/ppob-settings";

export const metadata = {
  title: "Pengaturan PPOB",
  description: "Pengaturan integrasi Biller PPOB Koperasi berbasis sistem Bayar Tempo",
};

export default async function PPOBSettingsPage() {
  const settings = await getPpobSettings();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
          Pengaturan PPOB
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Kelola kredensial API gateway, margin transaksi, webhook callback, dan aktivasi layanan PPOB secara real-time.
        </p>
      </div>
      <PPOBSettingsForm initialData={settings} />
    </div>
  );
}
