"use client";

import Image from "next/image";
import { useActionState } from "react";
import { authenticate } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LogIn, Clock, ShieldAlert } from "lucide-react";
import { MatrixRain } from "@/components/shared/matrix-rain";

type LoginFormProps = {
  settings?: { company_name?: string | null; logo_url?: string | null } | null;
  isMobile?: boolean;
  idleLogout?: boolean;
};

export function LoginForm({ settings, isMobile = false, idleLogout = false }: LoginFormProps) {
  const [errorMessage, formAction, isPending] = useActionState(
    authenticate,
    undefined,
  );

  const companyName =
    !settings?.company_name || settings.company_name === "Koperasi Digital"
      ? "Koperasi Sulfindo"
      : settings.company_name;

  const logoSrc = settings?.logo_url || "/koperasi.png";

  // ─── Form Fields (shared) ───────────────────────────────────────────────────
  const formFields = (
    <form action={formAction} className="space-y-4 w-full">
      <div className="space-y-1.5">
        <Label htmlFor="email" className="font-semibold text-slate-500 dark:text-zinc-400 text-xs tracking-wider uppercase">
          NIK / Username
        </Label>
        <Input
          id="email"
          name="email"
          type="text"
          placeholder="Masukkan NIK atau username"
          required
          disabled={isPending}
          className="h-12 bg-white/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-primary focus:ring-2 focus:ring-primary/15 rounded-2xl px-4 text-sm transition-all outline-none"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password" className="font-semibold text-slate-500 dark:text-zinc-400 text-xs tracking-wider uppercase">
          Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          required
          disabled={isPending}
          className="h-12 bg-white/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-primary focus:ring-2 focus:ring-primary/15 rounded-2xl px-4 text-sm transition-all outline-none"
        />
      </div>

      {/* Idle logout notice */}
      {idleLogout && !errorMessage && (
        <div className="flex items-start gap-2.5 text-xs font-medium text-amber-800 dark:text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3">
          <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
          <span>Sesi Anda berakhir karena tidak ada aktivitas selama 1 jam. Silakan masuk kembali.</span>
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <div className="flex items-start gap-2.5 text-xs font-medium text-red-800 dark:text-red-200 bg-red-500/10 border border-red-500/20 rounded-2xl p-3">
          <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      <Button
        className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-2xl text-sm shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all duration-300 transform active:scale-[0.98] flex items-center justify-center gap-2 mt-2 cursor-pointer"
        type="submit"
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogIn className="h-4 w-4" />
        )}
        {isPending ? "Memverifikasi..." : "Masuk"}
      </Button>
    </form>
  );

  // ─── MOBILE LAYOUT ──────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 relative overflow-hidden px-4">
        {/* Matrix Rain effect */}
        <MatrixRain color="rgba(16, 185, 129, 0.08)" />

        {/* Ambient glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[250px] h-[250px] rounded-full bg-emerald-500/5 blur-[100px] pointer-events-none" />

        {/* Center Card */}
        <div className="w-full max-w-[360px] bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-3xl p-6 sm:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.08)] relative z-10">
          <div className="space-y-6">
            {/* Logo & Branding */}
            <div className="flex flex-col items-center justify-center text-center">
              <div className="relative h-20 w-20 transition-transform duration-500 hover:scale-105">
                <Image
                  src={logoSrc}
                  alt="Logo Koperasi"
                  fill
                  className="object-contain filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
                  priority
                />
              </div>
              <div className="space-y-1 mt-4">
                <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 font-heading">
                  {companyName}
                </h1>
                <p className="text-[12px] text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto leading-normal">
                  Transformasi digital layanan koperasi terintegrasi.
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 w-full">
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-850" />
              <span className="text-[10px] text-zinc-400 font-bold tracking-widest uppercase">Masuk Akun</span>
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-850" />
            </div>

            {formFields}

            {/* Footer */}
            <p className="text-center text-[11px] text-zinc-400 dark:text-zinc-500 mt-2">
              Koperasi Sulfindo © {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── DESKTOP LAYOUT ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full flex items-center justify-between bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 relative overflow-hidden px-8 md:px-16 lg:px-24">
      {/* Matrix Rain effect */}
      <MatrixRain color="rgba(16, 185, 129, 0.08)" />

      {/* Ambient glows */}
      <div className="absolute top-[-15%] left-[20%] w-[500px] h-[500px] rounded-full bg-emerald-500/5 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-[350px] h-[350px] rounded-full bg-zinc-400/5 blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] left-[-5%] w-[300px] h-[300px] rounded-full bg-emerald-500/5 blur-[100px] pointer-events-none" />

      {/* ── Mascot image — sisi kiri, digeser 20% ke tengah ── */}
      <div className="hidden md:flex flex-col items-center justify-center relative z-10 flex-shrink-0 ml-[8%] lg:ml-[10%] xl:ml-[12%]">
        <div className="relative w-[420px] h-[420px] lg:w-[500px] lg:h-[500px] xl:w-[560px] xl:h-[560px] drop-shadow-[0_20px_50px_rgba(0,0,0,0.06)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo_bg_login.svg"
            alt="Koperasi Sulfindo"
            className="w-full h-full object-contain"
          />
        </div>
        {/* Subtle tagline di bawah mascot */}
        <p className="text-zinc-400 dark:text-zinc-500 text-xs tracking-widest uppercase mt-4 text-center font-semibold">
          Sistem Manajemen Koperasi Digital
        </p>
      </div>

      {/* ── Login card — sisi kanan ── */}
      <div className="w-full max-w-[360px] ml-auto mr-4 md:mr-[12%] lg:mr-[14%] xl:mr-[16%] bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-3xl p-6 sm:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.08)] relative z-10 transition-all duration-300">
        <div className="space-y-6 relative z-20">
          {/* Logo & Branding */}
          <div className="flex flex-col items-center justify-center text-center">
            <div className="relative h-20 w-20 sm:h-24 sm:w-24 transition-transform duration-500 hover:scale-105">
              <Image
                src={logoSrc}
                alt="Logo Koperasi"
                fill
                className="object-contain filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
                priority
              />
            </div>
            <div className="space-y-1 mt-4">
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 font-heading">
                {companyName}
              </h1>
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto leading-normal">
                Transformasi digital layanan koperasi terintegrasi.
              </p>
            </div>
          </div>

          {formFields}
        </div>
      </div>
    </div>
  );
}
