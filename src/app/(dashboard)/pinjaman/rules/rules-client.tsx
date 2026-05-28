"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { type LoanRules, type RuleConfig, DEFAULT_LOAN_RULES } from "@/lib/types/loan-rules.types"
import { Save, AlertTriangle, Clock, ShieldCheck, Receipt, ShoppingCart, Percent, Loader2 } from "lucide-react"


export function RulesClient({
  products,
  onSaved
}: {
  products: { id: number; name: string; is_active: boolean }[]
  onSaved?: () => void
}) {
  const [loadingData, setLoadingData] = useState(true) // true by default — fetch on mount
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<LoanRules>(DEFAULT_LOAN_RULES)

  /** Fetch data terbaru dari API setiap kali komponen di-mount (modal dibuka) */
  useEffect(() => {
    let cancelled = false
    fetch("/api/loan-rules", { cache: "no-store" })
      .then(res => {
        if (!res.ok) throw new Error("Gagal memuat data")
        return res.json() as Promise<LoanRules>
      })
      .then(data => { if (!cancelled) setFormData(data) })
      .catch(() => {
        if (!cancelled) {
          toast.error("Gagal memuat konfigurasi aturan")
          setFormData(DEFAULT_LOAN_RULES)
        }
      })
      .finally(() => { if (!cancelled) setLoadingData(false) })
    return () => { cancelled = true }
  }, [])

  /** Simpan ke API endpoint */
  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/loan-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      const result = await res.json() as { success: boolean; error?: string }
      if (result.success) {
        toast.success("Aturan pinjaman berhasil diperbarui!")
        if (onSaved) onSaved()
      } else {
        toast.error(result.error || "Gagal menyimpan")
      }
    } catch {
      toast.error("Terjadi kesalahan jaringan. Coba lagi.")
    } finally {
      setSaving(false)
    }
  }

  const updateRule = (ruleKey: keyof LoanRules, field: keyof RuleConfig, value: number | boolean | number[]) => {
    setFormData(prev => ({
      ...prev,
      [ruleKey]: {
        ...prev[ruleKey],
        [field]: value
      }
    }))
  }

  const toggleProduct = (ruleKey: keyof LoanRules, productId: number) => {
    const current = formData[ruleKey].applied_to_products
    const updated = current.includes(productId)
      ? current.filter((id: any) => id !== productId)
      : [...current, productId]
    updateRule(ruleKey, "applied_to_products", updated)
  }

  const renderProductSelector = (ruleKey: keyof LoanRules) => {
    if (!formData[ruleKey].enabled) return null
    return (
      <div className="mt-3 pt-3 border-t">
        <p className="text-xs font-medium text-slate-600 mb-2">
          Terapkan pada produk pinjaman (kosong = tidak diterapkan):
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {products.map((p: any) => (
            <div key={p.id} className="flex items-center gap-2">
              <Checkbox
                id={`${ruleKey}-${p.id}`}
                checked={formData[ruleKey].applied_to_products.includes(p.id)}
                onCheckedChange={() => toggleProduct(ruleKey, p.id)}
              />
              <label htmlFor={`${ruleKey}-${p.id}`} className="text-sm cursor-pointer">
                {p.name}
              </label>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (loadingData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Memuat konfigurasi aturan...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 items-start">
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-800">
          Setiap rule bisa diaktifkan/dinonaktifkan dan diikat (diterapkan) hanya pada produk pinjaman tertentu saja sesuai kebutuhan operasional.
        </p>
      </div>

      <div className="space-y-10">

        {/* KATEGORI 1 — Rule Global Terplot */}
        <div className="space-y-4">
          <div className="border-b pb-2">
            <h3 className="text-lg font-bold text-slate-800">1. Aturan Modul Global Terplot</h3>
            <p className="text-sm text-slate-500">Aturan yang terikat pada modul spesifik (bukan produk pinjaman) secara keseluruhan.</p>
          </div>

          <Card className={formData.max_paylater_debt.enabled ? "border-blue-300 shadow-sm" : "opacity-70"}>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.max_paylater_debt.enabled}
                      onCheckedChange={(c) => updateRule("max_paylater_debt", "enabled", c)}
                    />
                    <Label className="text-base font-semibold flex items-center gap-2 cursor-pointer" onClick={() => updateRule("max_paylater_debt", "enabled", !formData.max_paylater_debt.enabled)}>
                      <ShoppingCart className="h-4 w-4 text-red-500" />
                      Limit Maksimal Hutang Paylater (Modul Toko)
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 ml-11">
                    Total batas nominal akumulasi hutang paylater di toko. Jika melebihi ini, transaksi paylater otomatis ditolak.
                  </p>
                </div>
                {formData.max_paylater_debt.enabled && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold">Rp</span>
                    <Input
                      type="number"
                      className="w-36 text-right"
                      value={formData.max_paylater_debt.value as number}
                      onChange={(e) => updateRule("max_paylater_debt", "value", parseInt(e.target.value) || 0)}
                      min={0}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* KATEGORI 2 — Aturan Syarat Khusus Produk (toggle only) */}
        <div className="space-y-4">
          <div className="border-b pb-2">
            <h3 className="text-lg font-bold text-slate-800">2. Aturan Syarat Khusus Produk</h3>
            <p className="text-sm text-slate-500">Aturan ON/OFF yang diterapkan secara spesifik dengan mencentang produk pinjaman tertentu.</p>
          </div>

          {/* Wajib Lunas */}
          <Card className={formData.strict_single_active_loan.enabled ? "border-blue-300 shadow-sm" : "opacity-70"}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.strict_single_active_loan.enabled}
                  onCheckedChange={(c) => updateRule("strict_single_active_loan", "enabled", c)}
                />
                <Label className="text-base font-semibold flex items-center gap-2 cursor-pointer" onClick={() => updateRule("strict_single_active_loan", "enabled", !formData.strict_single_active_loan.enabled)}>
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  Wajib Lunas (Single Active Loan)
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-1 ml-11">
                Peminjam hanya boleh punya satu cicilan berjalan untuk produk ini. Wajib lunas 100% sebelum mengajukan yang baru.
              </p>
              {renderProductSelector("strict_single_active_loan")}
            </CardContent>
          </Card>

          {/* Wajib Kwitansi */}
          <Card className={formData.require_receipt_for_goods.enabled ? "border-blue-300 shadow-sm" : "opacity-70"}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.require_receipt_for_goods.enabled}
                  onCheckedChange={(c) => updateRule("require_receipt_for_goods", "enabled", c)}
                />
                <Label className="text-base font-semibold flex items-center gap-2 cursor-pointer" onClick={() => updateRule("require_receipt_for_goods", "enabled", !formData.require_receipt_for_goods.enabled)}>
                  <Receipt className="h-4 w-4 text-orange-500" />
                  Wajib Lampirkan Kwitansi
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-1 ml-11">
                Memaksa anggota untuk mengunggah file/foto kwitansi asli pada form pengajuan (biasanya untuk Pinjaman Barang).
              </p>
              {renderProductSelector("require_receipt_for_goods")}
            </CardContent>
          </Card>
        </div>

        {/* KATEGORI 3 — Aturan Parameter Angka */}
        <div className="space-y-4">
          <div className="border-b pb-2">
            <h3 className="text-lg font-bold text-slate-800">3. Aturan Parameter Kuantitas (Input Angka)</h3>
            <p className="text-sm text-slate-500">Aturan yang membutuhkan masukan angka: kuantitas, nominal batas, atau persentase.</p>
          </div>

          {/* Batas Frekuensi */}
          <Card className={formData.max_loans_per_month.enabled ? "border-blue-300 shadow-sm" : "opacity-70"}>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.max_loans_per_month.enabled}
                      onCheckedChange={(c) => updateRule("max_loans_per_month", "enabled", c)}
                    />
                    <Label className="text-base font-semibold flex items-center gap-2 cursor-pointer" onClick={() => updateRule("max_loans_per_month", "enabled", !formData.max_loans_per_month.enabled)}>
                      <Clock className="h-4 w-4 text-blue-500" />
                      Batas Frekuensi Pengajuan / Bulan
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 ml-11">
                    Maksimal frekuensi anggota boleh mengajukan pinjaman ini dalam satu bulan kalender.
                  </p>
                </div>
                {formData.max_loans_per_month.enabled && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      type="number"
                      className="w-20 text-center"
                      value={formData.max_loans_per_month.value as number}
                      onChange={(e) => updateRule("max_loans_per_month", "value", parseInt(e.target.value) || 1)}
                      min={1}
                    />
                    <span className="text-sm text-slate-600">Kali / Bulan</span>
                  </div>
                )}
              </div>
              {renderProductSelector("max_loans_per_month")}
            </CardContent>
          </Card>

          {/* Syarat Top-up */}
          <Card className={formData.min_remaining_installments_for_topup.enabled ? "border-blue-300 shadow-sm" : "opacity-70"}>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.min_remaining_installments_for_topup.enabled}
                      onCheckedChange={(c) => updateRule("min_remaining_installments_for_topup", "enabled", c)}
                    />
                    <Label className="text-base font-semibold flex items-center gap-2 cursor-pointer" onClick={() => updateRule("min_remaining_installments_for_topup", "enabled", !formData.min_remaining_installments_for_topup.enabled)}>
                      <Clock className="h-4 w-4 text-purple-500" />
                      Syarat Sisa Cicilan Maksimal (Top-up)
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 ml-11">
                    Berapa kali sisa cicilan maksimal agar anggota boleh &quot;Top Up&quot; atau pinjam lagi sebelum lunas total.
                    (Contoh: isi 3 → anggota boleh pinjam lagi ketika cicilan tinggal 3 kali).
                  </p>
                </div>
                {formData.min_remaining_installments_for_topup.enabled && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      type="number"
                      className="w-20 text-center"
                      value={formData.min_remaining_installments_for_topup.value as number}
                      onChange={(e) => updateRule("min_remaining_installments_for_topup", "value", parseInt(e.target.value) || 0)}
                      min={0}
                    />
                    <span className="text-sm text-slate-600">Cicilan</span>
                  </div>
                )}
              </div>
              {renderProductSelector("min_remaining_installments_for_topup")}
            </CardContent>
          </Card>

          {/* Maksimal % Simpanan */}
          <Card className={formData.max_loan_percentage_of_savings.enabled ? "border-blue-300 shadow-sm" : "opacity-70"}>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.max_loan_percentage_of_savings.enabled}
                      onCheckedChange={(c) => updateRule("max_loan_percentage_of_savings", "enabled", c)}
                    />
                    <Label className="text-base font-semibold flex items-center gap-2 cursor-pointer" onClick={() => updateRule("max_loan_percentage_of_savings", "enabled", !formData.max_loan_percentage_of_savings.enabled)}>
                      <Percent className="h-4 w-4 text-green-600" />
                      Maksimal Persentase dari Simpanan
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 ml-11">
                    Nominal pengajuan pinjaman dibatasi berdasarkan persen (%) dari Total Saldo Simpanan anggota saat itu.
                  </p>
                </div>
                {formData.max_loan_percentage_of_savings.enabled && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      type="number"
                      className="w-20 text-center"
                      value={formData.max_loan_percentage_of_savings.value as number}
                      onChange={(e) => updateRule("max_loan_percentage_of_savings", "value", parseInt(e.target.value) || 0)}
                      min={1}
                      max={1000}
                    />
                    <span className="text-sm text-slate-600">%</span>
                  </div>
                )}
              </div>
              {renderProductSelector("max_loan_percentage_of_savings")}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t">
        <Button onClick={handleSave} disabled={saving} className="gap-2 w-full md:w-auto">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Menyimpan..." : "Simpan Semua Aturan"}
        </Button>
      </div>
    </div>
  )
}
