"use client";

import Image from "next/image";
import { useActionState } from "react";
import { authenticate } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LogIn, Clock, ShieldAlert } from "lucide-react";

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
        <Label htmlFor="email" className="font-semibold text-slate-200 text-xs tracking-wide uppercase">
          NIK / Username
        </Label>
        <Input
          id="email"
          name="email"
          type="text"
          placeholder="Masukkan NIK atau username"
          required
          disabled={isPending}
          className="h-12 bg-[#051630]/80 border-[#134074]/60 text-white placeholder-slate-500 focus:border-[#1d5c96] focus:ring-2 focus:ring-[#134074]/40 rounded-xl px-4 text-sm transition-all"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password" className="font-semibold text-slate-200 text-xs tracking-wide uppercase">
          Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          required
          disabled={isPending}
          className="h-12 bg-[#051630]/80 border-[#134074]/60 text-white placeholder-slate-500 focus:border-[#1d5c96] focus:ring-2 focus:ring-[#134074]/40 rounded-xl px-4 text-sm transition-all"
        />
      </div>

      {/* Idle logout notice */}
      {idleLogout && !errorMessage && (
        <div className="flex items-start gap-2.5 text-xs font-medium text-amber-300 bg-amber-950/40 border border-amber-800/50 rounded-xl p-3">
          <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>Sesi Anda berakhir karena tidak ada aktivitas selama 1 jam. Silakan masuk kembali.</span>
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <div className="flex items-start gap-2.5 text-xs font-medium text-red-400 bg-red-950/40 border border-red-900/50 rounded-xl p-3">
          <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <Button
        className="w-full h-12 bg-[#134074] hover:bg-[#1d5c96] text-white font-semibold rounded-xl text-sm shadow-lg shadow-[#134074]/20 hover:shadow-[#1d5c96]/30 transition-all duration-300 transform active:scale-[0.98] flex items-center justify-center gap-2 mt-2"
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
      <div className="min-h-screen w-full flex flex-col bg-[#020e24] relative overflow-hidden">
        {/* Ambient glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-[#134074]/20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[250px] h-[250px] rounded-full bg-[#0b2545]/30 blur-[100px] pointer-events-none" />

        {/* Top branding section */}
        <div className="flex flex-col items-center justify-center pt-16 pb-8 px-6 relative z-10">
          {/* Logo */}
          <div className="relative h-28 w-28 mb-5 drop-shadow-[0_8px_20px_rgba(20,83,161,0.6)]">
            <Image
              src={logoSrc}
              alt="Logo Koperasi"
              fill
              className="object-contain"
              priority
            />
          </div>

          {/* Name & tagline */}
          <h1 className="text-2xl font-bold text-white tracking-tight text-center">{companyName}</h1>
          <p className="text-xs text-slate-400 mt-1.5 text-center max-w-[260px] leading-relaxed">
            Wujudkan budaya keterbukaan dan transparansi melalui transformasi digital.
          </p>

          {/* Divider */}
          <div className="flex items-center gap-3 mt-8 w-full max-w-[320px]">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#134074]/60" />
            <span className="text-[10px] text-slate-500 font-semibold tracking-widest uppercase">Masuk Akun</span>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#134074]/60" />
          </div>
        </div>

        {/* Form section — takes remaining space, card at bottom */}
        <div className="flex-1 flex items-start justify-center px-5 relative z-10">
          <div className="w-full max-w-[400px] bg-[#020e24]/70 backdrop-blur-xl border border-[#134074]/30 rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
            {formFields}

            {/* Footer */}
            <p className="text-center text-[10px] text-slate-600 mt-5">
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
    <div className="min-h-screen w-full flex items-center justify-between bg-[#020e24] relative overflow-hidden px-8 md:px-16 lg:px-24">

      {/* Ambient glows */}
      <div className="absolute top-[-15%] left-[20%] w-[500px] h-[500px] rounded-full bg-[#134074]/20 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-[350px] h-[350px] rounded-full bg-[#0b2545]/40 blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] left-[-5%] w-[300px] h-[300px] rounded-full bg-[#1d5c96]/10 blur-[100px] pointer-events-none" />

      {/* ── Mascot image — sisi kiri, posisi tengah vertikal ── */}
      <div className="hidden md:flex flex-col items-center justify-center relative z-10 flex-shrink-0" style={{ marginLeft: "-2rem" }}>
        <div className="relative w-[420px] h-[420px] lg:w-[500px] lg:h-[500px] xl:w-[560px] xl:h-[560px] drop-shadow-[0_20px_60px_rgba(19,64,116,0.4)]">
          <Image
            src="/login-mascot.png"
            alt="Koperasi Sulfindo"
            fill
            className="object-contain"
            priority
          />
        </div>
        {/* Subtle tagline di bawah mascot */}
        <p className="text-slate-500 text-xs tracking-widest uppercase mt-4 text-center">
          Sistem Manajemen Koperasi Digital
        </p>
      </div>

      {/* ── Login card — sisi kanan ── */}
      <div className="w-full max-w-[360px] ml-auto mr-4 md:mr-8 lg:mr-12 bg-[#020e24]/90 backdrop-blur-xl border border-[#134074]/40 rounded-3xl p-6 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.8)] ring-1 ring-white/5 relative z-10 transition-all duration-300">
        <div className="space-y-6 relative z-20">
          {/* Logo & Branding */}
          <div className="flex flex-col items-center justify-center text-center">
            <div className="relative h-24 w-24 sm:h-28 sm:w-28 transition-transform duration-500 hover:scale-105">
              <Image
                src={logoSrc}
                alt="Logo Koperasi"
                fill
                className="object-contain filter drop-shadow-[0_4px_8px_rgba(20,83,161,0.5)]"
                priority
              />
            </div>
            <div className="space-y-1 mt-3">
              <h1 className="text-xl font-bold tracking-tight text-white filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                {companyName}
              </h1>
              <p className="text-[11px] text-slate-300 max-w-xs mx-auto leading-normal">
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
