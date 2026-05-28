"use client";

import Image from "next/image";
import { useActionState } from "react";
import { authenticate } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export function LoginForm({ settings }: { settings?: any }) {
  const [errorMessage, formAction, isPending] = useActionState(
    authenticate,
    undefined,
  );

  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center md:justify-end bg-[#020e24] bg-cover bg-center relative overflow-hidden p-4 sm:p-6 md:p-12 lg:p-20"
      style={{ backgroundImage: "url('/login-bg.jpg')" }}
    >
      {/* Full screen dark overlay to enhance card readability and contrast */}
      <div className="absolute inset-0 bg-[#020e24]/40 z-0 pointer-events-none" />

      {/* Floating glowing blue ambient background lights behind the card */}
      <div className="absolute top-[-10%] right-[-10%] w-[300px] h-[300px] rounded-full bg-[#134074]/30 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[300px] h-[300px] rounded-full bg-[#0b2545]/40 blur-[100px] pointer-events-none" />

      {/* THE FLOATING CARD: Menempel di atas lapisan background, ultra compact, shifted slightly left on desktop */}
      <div className="w-full max-w-[350px] md:mr-12 lg:mr-20 bg-[#020e24]/85 md:bg-[#020e24]/90 backdrop-blur-xl border border-[#134074]/40 rounded-3xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.7)] ring-1 ring-white/5 relative z-10 transition-all duration-300">
        
        <div className="space-y-6 relative z-20">
          {/* Logo & Branding */}
          <div className="flex flex-col items-center justify-center text-center">
            <div className="relative h-24 w-24 sm:h-28 sm:w-28 transition-transform duration-500 hover:scale-105">
              <Image
                src={settings?.logo_url || "/koperasi.png"}
                alt="Logo Koperasi"
                fill
                className="object-contain filter drop-shadow-[0_4px_8px_rgba(20,83,161,0.5)]"
                priority
              />
            </div>
            <div className="space-y-1 mt-2">
              <h1 className="text-xl font-bold tracking-tight text-white filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                {!settings?.company_name || settings.company_name === "Koperasi Digital" ? "Koperasi Sulfindo" : settings.company_name}
              </h1>
              <p className="text-[11px] text-slate-300 max-w-xs mx-auto leading-normal">
                Wujudkan budaya keterbukaan dan transparansi melalui transformasi digital.
              </p>
            </div>
          </div>

          {/* Form Fields */}
          <form action={formAction} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email" className="font-semibold text-slate-200 text-xs tracking-wide">
                NIK
              </Label>
              <Input
                id="email"
                name="email"
                type="text"
                placeholder="Masukkan NIK"
                required
                disabled={isPending}
                className="h-11 bg-[#051630]/80 border-[#134074]/60 text-white placeholder-slate-400 focus:border-[#1d5c96] focus:ring-2 focus:ring-[#134074]/40 rounded-xl px-3.5 text-sm transition-all"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password" className="font-semibold text-slate-200 text-xs tracking-wide">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                disabled={isPending}
                className="h-11 bg-[#051630]/80 border-[#134074]/60 text-white placeholder-slate-400 focus:border-[#1d5c96] focus:ring-2 focus:ring-[#134074]/40 rounded-xl px-3.5 text-sm transition-all"
              />
            </div>

            {errorMessage && (
              <div className="text-xs font-medium text-red-400 bg-red-950/40 border border-red-900/50 rounded-xl p-2.5 text-center animate-pulse">
                {errorMessage}
              </div>
            )}

            <Button 
              className="w-full h-11 bg-[#134074] hover:bg-[#1d5c96] text-white font-semibold rounded-xl text-sm shadow-lg shadow-[#134074]/20 hover:shadow-[#1d5c96]/30 transition-all duration-300 transform active:scale-[0.98] flex items-center justify-center gap-2 mt-2" 
              type="submit" 
              disabled={isPending}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Masuk
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
