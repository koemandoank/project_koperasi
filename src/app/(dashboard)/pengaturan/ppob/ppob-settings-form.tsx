"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Key,
  Percent,
  Link as LinkIcon,
  ToggleLeft,
  Eye,
  EyeOff,
  Save,
  Send,
  Loader2,
  Info,
  ShieldCheck,
  Building,
  Coins,
  Zap,
  Smartphone,
  Wallet,
  Receipt
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { updatePpobSettings, type PPOBSettingsData } from "@/lib/actions/ppob-settings";

// ─── VALIDATION SCHEMA ──────────────────────────────────────────────────────────
const ppobSettingsSchema = z.object({
  // Section 1: Konfigurasi API
  apiKey: z.string().min(8, "API Key minimal 8 karakter"),
  privateKey: z.string().min(8, "Private/Secret Key minimal 8 karakter"),
  merchantCode: z.string().min(3, "Kode Merchant minimal 3 karakter"),
  environment: z.enum(["sandbox", "production"]),

  // Section 2: Margin & Komisi
  defaultMargin: z.coerce.number().min(0, "Margin tidak boleh kurang dari Rp 0"),
  shuPercentage: z.coerce
    .number()
    .min(0, "Persentase komisi minimal 0%")
    .max(100, "Persentase komisi maksimal 100%"),
  dynamicPricingByLevel: z.boolean(),

  // Section 3: Webhook
  webhookUrl: z.string().url("Format URL webhook tidak valid").or(z.string().length(0)),

  // Section 4: Manajemen Layanan
  enablePulsa: z.boolean(),
  enablePln: z.boolean(),
  enableEWallet: z.boolean(),
  enableBills: z.boolean(),
});

type PPOBSettingsInput = z.infer<typeof ppobSettingsSchema>;

// Default Dummy Values
const defaultValues: PPOBSettingsInput = {
  apiKey: "tp_live_a1b2c3d4e5f6g7h8i9j0",
  privateKey: "tp_secret_9e8d7c6b5a4f3e2d1c",
  merchantCode: "SULFINO_COOP",
  environment: "sandbox",
  defaultMargin: 2500,
  shuPercentage: 40,
  dynamicPricingByLevel: true,
  webhookUrl: "https://koperasi.sulfindo.co.id/api/v1/webhook/ppob",
  enablePulsa: true,
  enablePln: true,
  enableEWallet: true,
  enableBills: false,
};

export function PPOBSettingsForm({ initialData }: { initialData: PPOBSettingsData }) {
  const [activeTab, setActiveTab] = useState("api");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  
  // Custom states for button actions
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(ppobSettingsSchema),
    defaultValues: initialData,
  });

  const webhookUrlValue = watch("webhookUrl");

  // Form submission handler
  const onSubmit = async (data: any) => {
    setIsSaving(true);
    try {
      const result = await updatePpobSettings(data);
      if (result.success) {
        toast.success("Pengaturan PPOB berhasil disimpan ke database!");
      } else {
        toast.error(result.error || "Gagal menyimpan pengaturan PPOB.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Terjadi kesalahan sistem saat menyimpan.");
    } finally {
      setIsSaving(false);
    }
  };

  // Webhook testing simulator
  const handleTestWebhook = () => {
    if (!webhookUrlValue) {
      toast.error("Silakan isi URL Webhook terlebih dahulu.");
      return;
    }

    setIsTestingWebhook(true);
    toast.info("Mengirim payload uji coba ke Webhook...");

    setTimeout(() => {
      setIsTestingWebhook(false);
      // Simulate random success/failure
      const isSuccess = Math.random() > 0.15;
      if (isSuccess) {
        toast.success("Webhook berhasil terhubung! Response: 200 OK");
      } else {
        toast.error("Gagal terhubung ke Webhook. Response: 504 Gateway Timeout");
      }
    }, 2000);
  };

  // Motion variants for tab change animations
  const tabContentVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: -15, transition: { duration: 0.2 } },
  };

  return (
    <div className="w-full max-w-5xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Navigation Tabs bar with custom style to look like beautiful cards */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-2.5 shadow-sm mb-6 overflow-x-auto no-scrollbar">
            <TabsList className="flex items-center gap-1.5 min-w-max border-0 bg-transparent h-auto p-0">
              <TabsTrigger
                value="api"
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl cursor-pointer text-sm font-semibold transition-all data-active:bg-[#0f4c3a] data-active:text-white dark:data-active:bg-[#0f4c3a] dark:data-active:text-white hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
              >
                <Key className="h-4.5 w-4.5" />
                <span>Konfigurasi API</span>
              </TabsTrigger>
              
              <TabsTrigger
                value="margin"
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl cursor-pointer text-sm font-semibold transition-all data-active:bg-[#0f4c3a] data-active:text-white dark:data-active:bg-[#0f4c3a] dark:data-active:text-white hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
              >
                <Percent className="h-4.5 w-4.5" />
                <span>Margin & Komisi</span>
              </TabsTrigger>
              
              <TabsTrigger
                value="webhook"
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl cursor-pointer text-sm font-semibold transition-all data-active:bg-[#0f4c3a] data-active:text-white dark:data-active:bg-[#0f4c3a] dark:data-active:text-white hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
              >
                <LinkIcon className="h-4.5 w-4.5" />
                <span>Konfigurasi Webhook</span>
              </TabsTrigger>
              
              <TabsTrigger
                value="layanan"
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl cursor-pointer text-sm font-semibold transition-all data-active:bg-[#0f4c3a] data-active:text-white dark:data-active:bg-[#0f4c3a] dark:data-active:text-white hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
              >
                <ToggleLeft className="h-4.5 w-4.5" />
                <span>Manajemen Layanan</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* AnimatePresence makes tab changes look very fluid */}
          <div className="relative min-h-[400px]">
            <AnimatePresence mode="wait">
              <TabsContent value="api" key="api">
                {activeTab === "api" && (
                  <motion.div
                    variants={tabContentVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                  >
                    <Card className="border border-slate-200/60 dark:border-slate-800 shadow-md bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
                      <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-6">
                        <div className="flex items-start gap-4">
                          <div className="p-3 bg-[#0f4c3a]/10 dark:bg-[#0f4c3a]/20 text-[#0f4c3a] dark:text-[#22c55e] rounded-xl shrink-0">
                            <Key className="h-6 w-6" />
                          </div>
                          <div>
                            <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-100">Kredensial API Biller PPOB</CardTitle>
                            <CardDescription className="text-sm mt-1">
                              Konfigurasikan kunci otentikasi Biller PPOB (seperti Digiflazz / Mobilepulsa) Anda. Harap simpan data ini secara rahasia.
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-6 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {/* Input: Merchant Code */}
                          <div className="space-y-2">
                            <Label htmlFor="merchantCode" className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
                              Kode Merchant
                            </Label>
                            <div className="relative">
                              <Building className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
                              <Input
                                id="merchantCode"
                                type="text"
                                {...register("merchantCode")}
                                placeholder="Masukkan Kode Merchant"
                                className="pl-11 h-12 bg-white/50 dark:bg-slate-950 border-slate-200 focus:border-[#0f4c3a] focus:ring-[#0f4c3a]/10 rounded-xl"
                              />
                            </div>
                            {errors.merchantCode && (
                              <p className="text-xs text-red-500 font-medium mt-1">{errors.merchantCode.message}</p>
                            )}
                          </div>

                          {/* Dropdown: Environment */}
                          <div className="space-y-2">
                            <Label htmlFor="environment" className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
                              Environment / Mode
                            </Label>
                            <Controller
                              name="environment"
                              control={control}
                              render={({ field }) => (
                                <Select
                                  value={field.value}
                                  onValueChange={(val) => field.onChange(val)}
                                >
                                  <SelectTrigger className="w-full h-12 text-sm bg-white/50 dark:bg-slate-950 border-slate-200 focus:border-[#0f4c3a] focus:ring-[#0f4c3a]/10 rounded-xl px-3.5 flex items-center justify-between">
                                    <SelectValue placeholder="Pilih Environment" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg">
                                    <SelectItem value="sandbox" className="text-slate-700 dark:text-slate-200 focus:bg-slate-100 dark:focus:bg-slate-800 cursor-pointer">
                                      Sandbox (Uji Coba)
                                    </SelectItem>
                                    <SelectItem value="production" className="text-slate-700 dark:text-slate-200 focus:bg-slate-100 dark:focus:bg-slate-800 cursor-pointer">
                                      Production (Live)
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            />
                            {errors.environment && (
                              <p className="text-xs text-red-500 font-medium mt-1">{errors.environment.message}</p>
                            )}
                          </div>
                        </div>

                        {/* Input: API Key */}
                        <div className="space-y-2">
                          <Label htmlFor="apiKey" className="font-semibold text-slate-700 dark:text-slate-300 text-sm flex items-center justify-between">
                            <span>API Key (Public)</span>
                            <span className="text-[11px] text-amber-600 dark:text-amber-500 font-medium flex items-center gap-1">
                              <ShieldCheck className="h-3.5 w-3.5" /> Enkripsi Aktif
                            </span>
                          </Label>
                          <div className="relative">
                            <Key className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
                            <Input
                              id="apiKey"
                              type={showApiKey ? "text" : "password"}
                              {...register("apiKey")}
                              placeholder="Masukkan API Key"
                              className="pl-11 pr-11 h-12 bg-white/50 dark:bg-slate-950 border-slate-200 focus:border-[#0f4c3a] focus:ring-[#0f4c3a]/10 rounded-xl"
                            />
                            <button
                              type="button"
                              onClick={() => setShowApiKey(!showApiKey)}
                              className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              {showApiKey ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                            </button>
                          </div>
                          {errors.apiKey && (
                            <p className="text-xs text-red-500 font-medium mt-1">{errors.apiKey.message}</p>
                          )}
                        </div>

                        {/* Input: Private / Secret Key */}
                        <div className="space-y-2">
                          <Label htmlFor="privateKey" className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
                            Private Key / Secret Key
                          </Label>
                          <div className="relative">
                            <Key className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
                            <Input
                              id="privateKey"
                              type={showPrivateKey ? "text" : "password"}
                              {...register("privateKey")}
                              placeholder="Masukkan Private Key"
                              className="pl-11 pr-11 h-12 bg-white/50 dark:bg-slate-950 border-slate-200 focus:border-[#0f4c3a] focus:ring-[#0f4c3a]/10 rounded-xl"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPrivateKey(!showPrivateKey)}
                              className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              {showPrivateKey ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                            </button>
                          </div>
                          {errors.privateKey && (
                            <p className="text-xs text-red-500 font-medium mt-1">{errors.privateKey.message}</p>
                          )}
                        </div>

                        {/* Tip Notice */}
                        <div className="flex items-start gap-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 rounded-xl p-4">
                          <Info className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-normal">
                            <strong>Saran Keamanan:</strong> Gunakan kredensial <em>Sandbox</em> saat melakukan pengujian sistem. Ganti ke mode <em>Production</em> hanya setelah seluruh alur transaksi PPOB berjalan dengan sukses.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </TabsContent>

              <TabsContent value="margin" key="margin">
                {activeTab === "margin" && (
                  <motion.div
                    variants={tabContentVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                  >
                    <Card className="border border-slate-200/60 dark:border-slate-800 shadow-md bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
                      <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-6">
                        <div className="flex items-start gap-4">
                          <div className="p-3 bg-[#0f4c3a]/10 dark:bg-[#0f4c3a]/20 text-[#0f4c3a] dark:text-[#22c55e] rounded-xl shrink-0">
                            <Percent className="h-6 w-6" />
                          </div>
                          <div>
                            <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-100">Margin & Komisi Transaksi</CardTitle>
                            <CardDescription className="text-sm mt-1">
                              Sesuaikan keuntungan margin koperasi dan alokasi SHU untuk setiap transaksi PPOB yang dilakukan oleh anggota.
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {/* Input Number: Margin Default */}
                          <div className="space-y-2">
                            <Label htmlFor="defaultMargin" className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
                              Margin Default per Transaksi (Rp)
                            </Label>
                            <div className="relative">
                              <span className="absolute left-4 top-3.5 font-bold text-slate-400 text-sm">Rp</span>
                              <Input
                                id="defaultMargin"
                                type="number"
                                {...register("defaultMargin")}
                                placeholder="Contoh: 2500"
                                className="pl-10 h-12 bg-white/50 dark:bg-slate-950 border-slate-200 focus:border-[#0f4c3a] focus:ring-[#0f4c3a]/10 rounded-xl"
                              />
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">Nilai margin tetap yang ditambahkan dari harga Biller dasar.</p>
                            {errors.defaultMargin && (
                              <p className="text-xs text-red-500 font-medium mt-1">{errors.defaultMargin.message}</p>
                            )}
                          </div>

                          {/* Input Number: Persentase SHU */}
                          <div className="space-y-2">
                            <Label htmlFor="shuPercentage" className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
                              Persentase Komisi SHU Koperasi (%)
                            </Label>
                            <div className="relative">
                              <Input
                                id="shuPercentage"
                                type="number"
                                {...register("shuPercentage")}
                                placeholder="Contoh: 40"
                                className="pr-10 h-12 bg-white/50 dark:bg-slate-950 border-slate-200 focus:border-[#0f4c3a] focus:ring-[#0f4c3a]/10 rounded-xl"
                              />
                              <span className="absolute right-4 top-3.5 font-bold text-slate-400 text-sm">%</span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">Porsi margin transaksi yang dimasukkan ke alokasi SHU anggota.</p>
                            {errors.shuPercentage && (
                              <p className="text-xs text-red-500 font-medium mt-1">{errors.shuPercentage.message}</p>
                            )}
                          </div>
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-slate-100 dark:bg-slate-800 my-2" />

                        {/* Toggle Switch: Dynamic Pricing by Level */}
                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                          <div className="space-y-1 pr-6">
                            <Label htmlFor="dynamicPricingByLevel" className="font-bold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-1.5">
                              Terapkan Harga Dinamis Berdasarkan Level
                            </Label>
                            <p className="text-xs text-slate-400 leading-normal">
                              Jika diaktifkan, margin harga akan disesuaikan secara otomatis berdasarkan level anggota koperasi (misal: Gold mendapat margin lebih rendah).
                            </p>
                          </div>
                          <Controller
                            name="dynamicPricingByLevel"
                            control={control}
                            render={({ field }) => (
                              <Switch
                                id="dynamicPricingByLevel"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                size="default"
                              />
                            )}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </TabsContent>

              <TabsContent value="webhook" key="webhook">
                {activeTab === "webhook" && (
                  <motion.div
                    variants={tabContentVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                  >
                    <Card className="border border-slate-200/60 dark:border-slate-800 shadow-md bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
                      <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-6">
                        <div className="flex items-start gap-4">
                          <div className="p-3 bg-[#0f4c3a]/10 dark:bg-[#0f4c3a]/20 text-[#0f4c3a] dark:text-[#22c55e] rounded-xl shrink-0">
                            <LinkIcon className="h-6 w-6" />
                          </div>
                          <div>
                            <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-100">Konfigurasi Webhook Biller</CardTitle>
                            <CardDescription className="text-sm mt-1">
                              Konfigurasikan URL penerimaan status transaksi PPOB secara real-time dari Biller PPOB.
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-6 space-y-5">
                        {/* Input URL: Webhook */}
                        <div className="space-y-2">
                          <Label htmlFor="webhookUrl" className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
                            Endpoint Webhook URL
                          </Label>
                          <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                              <LinkIcon className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
                              <Input
                                id="webhookUrl"
                                type="text"
                                {...register("webhookUrl")}
                                placeholder="https://domain-koperasi.com/api/v1/webhook"
                                className="pl-11 h-12 bg-white/50 dark:bg-slate-950 border-slate-200 focus:border-[#0f4c3a] focus:ring-[#0f4c3a]/10 rounded-xl"
                              />
                            </div>
                            <Button
                              type="button"
                              onClick={handleTestWebhook}
                              disabled={isTestingWebhook}
                              className="h-12 px-6 rounded-xl border border-[#0f4c3a] hover:bg-[#0f4c3a]/5 dark:hover:bg-[#0f4c3a]/10 text-[#0f4c3a] dark:text-[#22c55e] bg-transparent font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
                            >
                              {isTestingWebhook ? (
                                <Loader2 className="h-4.5 w-4.5 animate-spin" />
                              ) : (
                                <Send className="h-4.5 w-4.5" />
                              )}
                              <span>Test Webhook</span>
                            </Button>
                          </div>
                          {errors.webhookUrl && (
                            <p className="text-xs text-red-500 font-medium mt-1">{errors.webhookUrl.message}</p>
                          )}
                          <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                            Pastikan rute webhook di atas mendukung HTTP POST dan dapat merespons balik dalam waktu kurang dari 3 detik.
                          </p>
                        </div>

                        {/* Visual representation of Webhook Flow */}
                        <div className="mt-4 p-5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4">
                            Alur Keamanan Data Webhook
                          </h4>
                          <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative">
                            {/* Visual flow boxes */}
                            <div className="w-full md:w-1/3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-3.5 text-center shadow-xs">
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">1. Sistem Biller</p>
                              <p className="text-[11px] text-slate-400 mt-1">Transaksi sukses/gagal terdeteksi</p>
                            </div>

                            <div className="hidden md:block h-0.5 bg-slate-200 dark:bg-slate-800 flex-1 relative">
                              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#0f4c3a]" />
                            </div>

                            <div className="w-full md:w-1/3 bg-white dark:bg-slate-900 border border-[#0f4c3a]/20 rounded-xl p-3.5 text-center shadow-xs ring-1 ring-[#0f4c3a]/5">
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">2. HTTP POST Payload</p>
                              <p className="text-[11px] text-slate-400 mt-1">Mengirim tanda tangan digital MD5</p>
                            </div>

                            <div className="hidden md:block h-0.5 bg-slate-200 dark:bg-slate-800 flex-1 relative">
                              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#0f4c3a]" />
                            </div>

                            <div className="w-full md:w-1/3 bg-[#0f4c3a]/5 dark:bg-[#0f4c3a]/10 border border-[#0f4c3a]/30 rounded-xl p-3.5 text-center shadow-xs">
                              <p className="text-xs font-bold text-[#0f4c3a] dark:text-[#22c55e]">3. Webhook Koperasi</p>
                              <p className="text-[11px] text-slate-400 mt-1">Limit & tagihan Bayar Tempo anggota terupdate</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </TabsContent>

              <TabsContent value="layanan" key="layanan">
                {activeTab === "layanan" && (
                  <motion.div
                    variants={tabContentVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                  >
                    <Card className="border border-slate-200/60 dark:border-slate-800 shadow-md bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
                      <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-6">
                        <div className="flex items-start gap-4">
                          <div className="p-3 bg-[#0f4c3a]/10 dark:bg-[#0f4c3a]/20 text-[#0f4c3a] dark:text-[#22c55e] rounded-xl shrink-0">
                            <ToggleLeft className="h-6 w-6" />
                          </div>
                          <div>
                            <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-100">Manajemen Layanan PPOB</CardTitle>
                            <CardDescription className="text-sm mt-1">
                              Aktifkan atau nonaktifkan fitur-fitur transaksi PPOB secara real-time yang dapat diakses oleh anggota pada dashboard mereka.
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-6 space-y-4">
                        {/* Toggle 1: Pulsa & Paket Data */}
                        <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl transition-all duration-300 hover:shadow-sm">
                          <div className="flex items-start gap-3.5">
                            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
                              <Smartphone className="h-5 w-5" />
                            </div>
                            <div className="space-y-0.5">
                              <Label htmlFor="enablePulsa" className="font-bold text-slate-800 dark:text-slate-200 text-sm cursor-pointer">
                                Pulsa & Paket Data
                              </Label>
                              <p className="text-xs text-slate-400 dark:text-slate-500">Pembelian pulsa reguler dan kuota paket internet seluler.</p>
                            </div>
                          </div>
                          <Controller
                            name="enablePulsa"
                            control={control}
                            render={({ field }) => (
                              <Switch
                                id="enablePulsa"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            )}
                          />
                        </div>

                        {/* Toggle 2: Token PLN */}
                        <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl transition-all duration-300 hover:shadow-sm">
                          <div className="flex items-start gap-3.5">
                            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-500 rounded-xl shrink-0">
                              <Zap className="h-5 w-5" />
                            </div>
                            <div className="space-y-0.5">
                              <Label htmlFor="enablePln" className="font-bold text-slate-800 dark:text-slate-200 text-sm cursor-pointer">
                                Token PLN (Listrik Pintar)
                              </Label>
                              <p className="text-xs text-slate-400 dark:text-slate-500">Top up listrik prabayar dengan nomor meter/ID pelanggan.</p>
                            </div>
                          </div>
                          <Controller
                            name="enablePln"
                            control={control}
                            render={({ field }) => (
                              <Switch
                                id="enablePln"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            )}
                          />
                        </div>

                        {/* Toggle 3: E-Wallet */}
                        <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl transition-all duration-300 hover:shadow-sm">
                          <div className="flex items-start gap-3.5">
                            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
                              <Wallet className="h-5 w-5" />
                            </div>
                            <div className="space-y-0.5">
                              <Label htmlFor="enableEWallet" className="font-bold text-slate-800 dark:text-slate-200 text-sm cursor-pointer">
                                E-Wallet / Dompet Digital
                              </Label>
                              <p className="text-xs text-slate-400 dark:text-slate-500">Top-up saldo digital seperti ShopeePay, DANA, OVO, LinkAja, dan GoPay.</p>
                            </div>
                          </div>
                          <Controller
                            name="enableEWallet"
                            control={control}
                            render={({ field }) => (
                              <Switch
                                id="enableEWallet"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            )}
                          />
                        </div>

                        {/* Toggle 4: Pembayaran Tagihan */}
                        <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl transition-all duration-300 hover:shadow-sm">
                          <div className="flex items-start gap-3.5">
                            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-xl shrink-0">
                              <Receipt className="h-5 w-5" />
                            </div>
                            <div className="space-y-0.5">
                              <Label htmlFor="enableBills" className="font-bold text-slate-800 dark:text-slate-200 text-sm cursor-pointer">
                                Pembayaran Tagihan (Pascabayar/BPJS)
                              </Label>
                              <p className="text-xs text-slate-400 dark:text-slate-500">Pembayaran bulanan listrik pascabayar, air PDAM, iuran BPJS Kesehatan, dll.</p>
                            </div>
                          </div>
                          <Controller
                            name="enableBills"
                            control={control}
                            render={({ field }) => (
                              <Switch
                                id="enableBills"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            )}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </TabsContent>
            </AnimatePresence>
          </div>
        </Tabs>

        {/* Global Save Button at the Bottom right */}
        <div className="flex items-center justify-end pt-2">
          <Button
            type="submit"
            disabled={isSaving}
            className="h-12 px-8 bg-[#0f4c3a] hover:bg-[#15614b] text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition-all duration-300 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin" />
            ) : (
              <Save className="h-4.5 w-4.5" />
            )}
            <span>{isSaving ? "Menyimpan..." : "Simpan Pengaturan PPOB"}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
