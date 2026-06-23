"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  CloudUpload,
  Database,
  Settings2,
  Clock,
  Play,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  HardDrive,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  updateBackupConfigAction,
  runBackupNowAction,
  type BackupPageData,
} from "@/lib/actions/backup-actions";
import {
  DAY_LABELS,
  DEFAULT_DRIVE_FOLDER_ID,
  type BackupDay,
} from "@/lib/backup/types";

const ALL_DAYS: BackupDay[] = [1, 2, 3, 4, 5, 6, 0];

export function BackupClient({ initialData }: { initialData: BackupPageData }) {
  const [config, setConfig] = useState(initialData.config);
  const [history, setHistory] = useState(initialData.history);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  function toggleDay(day: BackupDay) {
    setConfig((prev) => {
      const has = prev.scheduleDays.includes(day);
      const scheduleDays = has
        ? prev.scheduleDays.filter((d) => d !== day)
        : [...prev.scheduleDays, day].sort((a, b) => a - b);
      return { ...prev, scheduleDays };
    });
  }

  async function handleSave() {
    setSaving(true);
    const result = await updateBackupConfigAction({
      enabled: config.enabled,
      scheduleTime: config.scheduleTime,
      scheduleDays: config.scheduleDays,
      googleDriveFolderId: config.googleDriveFolderId,
      backupDatabase: config.backupDatabase,
      backupSettings: config.backupSettings,
    });

    if (result.success) {
      toast.success("Pengaturan backup disimpan");
    } else {
      toast.error(result.error || "Gagal menyimpan");
    }
    setSaving(false);
  }

  async function handleRunNow() {
    if (!confirm("Jalankan backup sekarang dan unggah ke Google Drive?")) return;
    setRunning(true);
    const result = await runBackupNowAction();
    if (result.success) {
      toast.success(result.message);
      setConfig((prev) => ({
        ...prev,
        lastRunAt: new Date().toISOString(),
        lastRunStatus: "success",
        lastRunMessage: result.message,
      }));
    } else {
      toast.error(result.message);
      setConfig((prev) => ({
        ...prev,
        lastRunAt: new Date().toISOString(),
        lastRunStatus: "error",
        lastRunMessage: result.message,
      }));
    }
    setRunning(false);
    window.location.reload();
  }

  const driveFolderUrl = `https://drive.google.com/drive/folders/${config.googleDriveFolderId || DEFAULT_DRIVE_FOLDER_ID}`;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Backup & Google Drive</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadangkan database dan pengaturan aplikasi, lalu unggah otomatis ke Google Drive sesuai jadwal.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={saving || running}
            className="rounded-xl gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Simpan
          </Button>
          <Button
            onClick={handleRunNow}
            disabled={saving || running || !initialData.driveConfigured}
            className="rounded-xl gap-2 font-semibold"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Backup Sekarang
          </Button>
        </div>
      </div>

      {!initialData.driveConfigured && (
        <Card className="rounded-2xl border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900">
          <CardContent className="pt-6 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-amber-800 dark:text-amber-300">Google Drive belum dikonfigurasi</p>
              <p className="text-amber-700/80 dark:text-amber-400/80 mt-1">
                Tambahkan kredensial Service Account di file <code className="text-xs">.env</code>:
              </p>
              <ul className="list-disc ml-5 mt-2 text-amber-700/80 dark:text-amber-400/80 space-y-1">
                <li><code className="text-xs">GOOGLE_SERVICE_ACCOUNT_JSON</code> — isi JSON lengkap service account, atau</li>
                <li><code className="text-xs">GOOGLE_SERVICE_ACCOUNT_EMAIL</code> + <code className="text-xs">GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</code></li>
              </ul>
              <p className="mt-2 text-amber-700/80 dark:text-amber-400/80">
                Bagikan folder Google Drive ke email service account (akses Editor).
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CloudUpload className="h-4 w-4 text-primary" />
              Google Drive
            </CardTitle>
            <CardDescription>Folder tujuan unggahan file backup</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="folderId">Folder ID</Label>
              <Input
                id="folderId"
                value={config.googleDriveFolderId}
                onChange={(e) => setConfig({ ...config, googleDriveFolderId: e.target.value })}
                placeholder={DEFAULT_DRIVE_FOLDER_ID}
                className="rounded-xl font-mono text-xs"
              />
              <a
                href={driveFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Buka folder di Google Drive
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-primary" />
              Jenis Backup
            </CardTitle>
            <CardDescription>Pilih data yang akan dicadangkan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-slate-500" />
                <Label htmlFor="backupDb">Database (SQL)</Label>
              </div>
              <Switch
                id="backupDb"
                checked={config.backupDatabase}
                onCheckedChange={(v) => setConfig({ ...config, backupDatabase: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-slate-500" />
                <Label htmlFor="backupSettings">Pengaturan Aplikasi (JSON)</Label>
              </div>
              <Switch
                id="backupSettings"
                checked={config.backupSettings}
                onCheckedChange={(v) => setConfig({ ...config, backupSettings: v })}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Jadwal Otomatis (WIB)
          </CardTitle>
          <CardDescription>
            Backup terjadwal dijalankan via endpoint cron. Atur Windows Task Scheduler atau cron server untuk memanggil API setiap menit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <Label htmlFor="enabled">Aktifkan jadwal otomatis</Label>
            <Switch
              id="enabled"
              checked={config.enabled}
              onCheckedChange={(v) => setConfig({ ...config, enabled: v })}
            />
          </div>

          <div className="space-y-2 max-w-xs">
            <Label htmlFor="scheduleTime">Jam backup (WIB)</Label>
            <Input
              id="scheduleTime"
              type="time"
              value={config.scheduleTime}
              onChange={(e) => setConfig({ ...config, scheduleTime: e.target.value })}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label>Hari</Label>
            <div className="flex flex-wrap gap-3">
              {ALL_DAYS.map((day) => (
                <label
                  key={day}
                  className="flex items-center gap-2 text-sm cursor-pointer select-none"
                >
                  <Checkbox
                    checked={config.scheduleDays.includes(day)}
                    onCheckedChange={() => toggleDay(day)}
                  />
                  {DAY_LABELS[day]}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Contoh: 23:50 WIB, Senin–Sabtu (default)
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 p-4 text-xs font-mono text-slate-600 dark:text-slate-400 break-all">
            <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Endpoint cron (setiap menit):</p>
            <p>GET /api/cron/backup?secret=BACKUP_CRON_SECRET</p>
            <p className="mt-2 text-muted-foreground">
              Set <code>BACKUP_CRON_SECRET</code> di .env. Pakai <code>?force=1</code> untuk paksa backup tanpa cek jadwal.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Status Terakhir</CardTitle>
        </CardHeader>
        <CardContent>
          {config.lastRunAt ? (
            <div className="flex items-start gap-3">
              {config.lastRunStatus === "success" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 shrink-0" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {new Date(config.lastRunAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">{config.lastRunMessage}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Belum pernah dijalankan</p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">Riwayat Backup</CardTitle>
          <CardDescription>{history.length} entri terakhir</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Belum ada riwayat</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 dark:bg-slate-900/40 text-xs uppercase text-slate-500">
                    <th className="px-6 py-3">Waktu</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Pemicu</th>
                    <th className="px-6 py-3">File</th>
                    <th className="px-6 py-3">Pesan</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {history.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                      <td className="px-6 py-3 whitespace-nowrap">
                        {new Date(entry.finishedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}
                      </td>
                      <td className="px-6 py-3">
                        {entry.status === "success" ? (
                          <span className="text-emerald-600 text-xs font-medium">Berhasil</span>
                        ) : (
                          <span className="text-red-600 text-xs font-medium">Gagal</span>
                        )}
                      </td>
                      <td className="px-6 py-3 capitalize text-xs">{entry.triggeredBy}</td>
                      <td className="px-6 py-3 font-mono text-xs">
                        {entry.files.map((f) => f.name).join(", ") || "—"}
                      </td>
                      <td className="px-6 py-3 text-muted-foreground text-xs max-w-xs truncate">
                        {entry.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
