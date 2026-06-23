"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { authenticate } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LogIn, Clock, ShieldAlert, Eye, EyeOff } from "lucide-react";

type LoginFormProps = {
  settings?: { company_name?: string | null; logo_url?: string | null } | null;
  isMobile?: boolean;
  idleLogout?: boolean;
};

export function LoginForm({ settings, isMobile = false, idleLogout = false }: LoginFormProps) {
  const [errorMessage, formAction, isPending] = useActionState(authenticate, undefined);
  const [showPassword, setShowPassword] = useState(false);

  const companyName =
    !settings?.company_name || settings.company_name === "Koperasi Digital"
      ? "Koperasi Sulfindo"
      : settings.company_name;

  const logoSrc = settings?.logo_url || "/koperasi.png";

  const formFields = (
    <form action={formAction} className="space-y-5 w-full">
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
          className="h-11 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl px-4 text-sm transition-all outline-none"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password" className="font-semibold text-slate-500 dark:text-zinc-400 text-xs tracking-wider uppercase">
          Password
        </Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="Masukkan password"
            required
            disabled={isPending}
            className="h-11 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl px-4 pr-10 text-sm transition-all outline-none w-full"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {idleLogout && !errorMessage && (
        <div className="flex items-start gap-2.5 text-xs font-medium text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-3">
          <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
          <span>Sesi Anda berakhir karena tidak ada aktivitas selama 1 jam. Silakan masuk kembali.</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-start gap-2.5 text-xs font-medium text-red-800 dark:text-red-200 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-3">
          <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      <Button
        className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl text-sm shadow-sm shadow-primary/10 hover:shadow-md hover:shadow-primary/15 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-1 cursor-pointer"
        type="submit"
        disabled={isPending}
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        {isPending ? "Memverifikasi..." : "Masuk"}
      </Button>
    </form>
  );

  const brandSection = (
    <div className="flex flex-col items-center text-center">
      <div className="relative h-16 w-16 sm:h-20 sm:w-20">
        <Image src={logoSrc} alt="Logo Koperasi" fill className="object-contain" priority />
      </div>
      <div className="space-y-0.5 mt-3">
        <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100 font-heading">
          {companyName}
        </h1>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">
          Transformasi digital layanan koperasi terintegrasi.
        </p>
      </div>
    </div>
  );

  // MOBILE
  if (isMobile) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900 relative px-4">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full bg-emerald-500/8 blur-[100px] pointer-events-none" />
        
        <div className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-lg relative z-10">
          <div className="space-y-6">
            {brandSection}
            <div className="flex items-center gap-3 w-full">
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
              <span className="text-[10px] text-zinc-400 font-semibold tracking-widest uppercase">Masuk</span>
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
            </div>
            {formFields}
            <p className="text-center text-[10px] text-zinc-400 dark:text-zinc-500">
              {companyName} &copy; {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // DESKTOP
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 relative overflow-hidden px-4">
      {/* Ambient glow */}
      <div className="absolute top-[-10%] left-[20%] w-[600px] h-[600px] rounded-full bg-emerald-500/5 blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[20%] w-[400px] h-[400px] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />

      <div className="flex w-full max-w-5xl items-center gap-12 lg:gap-20 relative z-10">
        {/* Left: Branding */}
        <div className="hidden lg:flex flex-col items-center text-center flex-1">
          <div className="relative w-[380px] h-[380px] xl:w-[440px] xl:h-[440px]">
            <img src="/logo_bg_login.svg" alt="Koperasi Sulfindo" className="w-full h-full object-contain" />
          </div>
          <div className="mt-6 space-y-1">
            <h2 className="text-2xl font-bold font-heading text-zinc-800 dark:text-zinc-100">{companyName}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Sistem Manajemen Koperasi Digital</p>
          </div>
        </div>

        {/* Right: Login Card */}
        <div className="w-full max-w-sm mx-auto lg:mx-0">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-7 shadow-lg">
            <div className="space-y-6">
              {brandSection}
              <div className="flex items-center gap-3 w-full">
                <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
                <span className="text-[10px] text-zinc-400 font-semibold tracking-widest uppercase">Masuk</span>
                <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
              </div>
              {formFields}
            </div>
          </div>
          <p className="text-center text-[10px] text-zinc-400 dark:text-zinc-500 mt-4">
            {companyName} &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
