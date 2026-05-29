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
        <Label htmlFor="email" className="font-semibold text-slate-600 text-xs tracking-wide uppercase">
          NIK / Username
        </Label>
        <Input
          id="email"
          name="email"
          type="text"
          placeholder="Masukkan NIK atau username"
          required
          disabled={isPending}
          className="h-12 bg-white/90 border-[#e6dfd3] text-slate-800 placeholder-slate-400 focus:border-[#0f4c3a] focus:ring-2 focus:ring-[#0f4c3a]/10 rounded-xl px-4 text-sm transition-all"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password" className="font-semibold text-slate-600 text-xs tracking-wide uppercase">
          Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          required
          disabled={isPending}
          className="h-12 bg-white/90 border-[#e6dfd3] text-slate-800 placeholder-slate-400 focus:border-[#0f4c3a] focus:ring-2 focus:ring-[#0f4c3a]/10 rounded-xl px-4 text-sm transition-all"
        />
      </div>

      {/* Idle logout notice */}
      {idleLogout && !errorMessage && (
        <div className="flex items-start gap-2.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>Sesi Anda berakhir karena tidak ada aktivitas selama 1 jam. Silakan masuk kembali.</span>
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <div className="flex items-start gap-2.5 text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-xl p-3">
          <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <Button
        className="w-full h-12 bg-[#0f4c3a] hover:bg-[#15614b] text-white font-semibold rounded-xl text-sm shadow-lg shadow-[#0f4c3a]/10 hover:shadow-[#15614b]/20 transition-all duration-300 transform active:scale-[0.98] flex items-center justify-center gap-2 mt-2"
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
      <div className="min-h-screen w-full flex flex-col bg-gradient-to-br from-[#fdfbf7] via-[#f7f2e8] to-[#eee5d3] relative overflow-hidden">
        {/* Matrix Rain effect */}
        <MatrixRain color="rgba(15, 76, 58, 0.2)" />

        {/* Ambient glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-amber-100/40 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[250px] h-[250px] rounded-full bg-emerald-50/40 blur-[100px] pointer-events-none" />

        {/* Top branding section */}
        <div className="flex flex-col items-center justify-center pt-16 pb-8 px-6 relative z-10">
          {/* Logo */}
          <div className="relative h-28 w-28 mb-5 drop-shadow-[0_8px_20px_rgba(139,115,85,0.15)]">
            <Image
              src={logoSrc}
              alt="Logo Koperasi"
              fill
              className="object-contain"
              priority
            />
          </div>

          {/* Name & tagline */}
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight text-center">{companyName}</h1>
          <p className="text-xs text-slate-500 mt-1.5 text-center max-w-[260px] leading-relaxed">
            Wujudkan budaya keterbukaan dan transparansi melalui transformasi digital.
          </p>

          {/* Divider */}
          <div className="flex items-center gap-3 mt-8 w-full max-w-[320px]">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#e6dfd3]" />
            <span className="text-[10px] text-slate-400 font-semibold tracking-widest uppercase">Masuk Akun</span>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#e6dfd3]" />
          </div>
        </div>

        {/* Form section — takes remaining space, card at bottom */}
        <div className="flex-1 flex items-start justify-center px-5 relative z-10">
          <div className="w-full max-w-[400px] bg-white/70 backdrop-blur-xl border border-white rounded-3xl p-6 shadow-[0_20px_50px_rgba(139,115,85,0.15)]">
            {formFields}

            {/* Footer */}
            <p className="text-center text-[10px] text-slate-400 mt-5">
              Versi APK Android — Koperasi Sulfindo © {new Date().getFullYear()}
            </p>
          </div>
        </div>

        <div className="h-8" />
      </div>
    );
  }

  // ─── DESKTOP LAYOUT ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full flex items-center justify-between bg-gradient-to-br from-[#fdfbf7] via-[#f7f2e8] to-[#eee5d3] relative overflow-hidden px-8 md:px-16 lg:px-24">
      {/* Matrix Rain effect */}
      <MatrixRain color="rgba(15, 76, 58, 0.2)" />

      {/* Ambient glows */}
      <div className="absolute top-[-15%] left-[20%] w-[500px] h-[500px] rounded-full bg-amber-100/30 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-[350px] h-[350px] rounded-full bg-[#eee5d3]/50 blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] left-[-5%] w-[300px] h-[300px] rounded-full bg-emerald-50/20 blur-[100px] pointer-events-none" />

      {/* ── Mascot image — sisi kiri, digeser 20% ke tengah ── */}
      <div className="hidden md:flex flex-col items-center justify-center relative z-10 flex-shrink-0 ml-[8%] lg:ml-[10%] xl:ml-[12%]">
        <div className="relative w-[420px] h-[420px] lg:w-[500px] lg:h-[500px] xl:w-[560px] xl:h-[560px] drop-shadow-[0_20px_50px_rgba(139,115,85,0.12)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo_bg_login.svg"
            alt="Koperasi Sulfindo"
            className="w-full h-full object-contain"
          />
        </div>
        {/* Subtle tagline di bawah mascot */}
        <p className="text-slate-400 text-xs tracking-widest uppercase mt-4 text-center font-medium">
          Sistem Manajemen Koperasi Digital
        </p>
      </div>

      {/* ── Login card — sisi kanan ── */}
      <div className="w-full max-w-[360px] ml-auto mr-4 md:mr-8 lg:mr-12 bg-white/80 backdrop-blur-xl border border-white rounded-3xl p-6 sm:p-7 shadow-[0_25px_60px_rgba(139,115,85,0.18)] ring-1 ring-black/5 relative z-10 transition-all duration-300">
        <div className="space-y-6 relative z-20">
          {/* Logo & Branding */}
          <div className="flex flex-col items-center justify-center text-center">
            <div className="relative h-24 w-24 sm:h-28 sm:w-28 transition-transform duration-500 hover:scale-105">
              <Image
                src={logoSrc}
                alt="Logo Koperasi"
                fill
                className="object-contain filter drop-shadow-[0_4px_8px_rgba(139,115,85,0.15)]"
                priority
              />
            </div>
            <div className="space-y-1 mt-3">
              <h1 className="text-xl font-bold tracking-tight text-slate-800 filter drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">
                {companyName}
              </h1>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-normal">
                Wujudkan budaya keterbukaan dan transparansi melalui transformasi digital.
              </p>
            </div>
          </div>

          {formFields}
        </div>
      </div>
    </div>
  );
}
