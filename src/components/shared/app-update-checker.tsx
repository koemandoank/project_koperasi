"use client"

import { useState, useEffect } from "react"
import { Capacitor } from "@capacitor/core"
import { App } from "@capacitor/app"
import { Browser } from "@capacitor/browser"
import { motion, AnimatePresence } from "framer-motion"
import { Download, AlertTriangle, ArrowUpCircle, X } from "lucide-react"

interface VersionInfo {
  latestVersion: string
  minRequiredVersion: string
  downloadUrl: string
  releaseNotes: string
}

export function AppUpdateChecker() {
  const [showModal, setShowModal] = useState(false)
  const [isMandatory, setIsMandatory] = useState(false)
  const [versionData, setVersionData] = useState<VersionInfo | null>(null)
  const [currentVersion, setCurrentVersion] = useState<string>("")

  useEffect(() => {
    // Hanya jalankan di platform native (Android/iOS)
    if (!Capacitor.isNativePlatform()) return

    async function checkUpdate() {
      try {
        // 1. Dapatkan versi native aplikasi saat ini
        const info = await App.getInfo()
        const curVer = info.version // contoh: "3.0.0"
        setCurrentVersion(curVer)

        // 2. Fetch versi terbaru dari server Next.js
        const res = await fetch("/api/app-version")
        if (!res.ok) return
        const data: VersionInfo = await res.json()
        setVersionData(data)

        // Helper comparison: apakah curVer < targetVer
        const compareVersions = (v1: string, v2: string) => {
          const parts1 = v1.split(".").map(Number)
          const parts2 = v2.split(".").map(Number)
          for (let i = 0; i < 3; i++) {
            const num1 = parts1[i] || 0
            const num2 = parts2[i] || 0
            if (num1 < num2) return -1
            if (num1 > num2) return 1
          }
          return 0
        }

        // 3. Bandingkan versi
        const isUpdateAvailable = compareVersions(curVer, data.latestVersion) < 0
        if (isUpdateAvailable) {
          const forceUpdate = compareVersions(curVer, data.minRequiredVersion) < 0
          setIsMandatory(forceUpdate)
          setShowModal(true)
        }
      } catch (error) {
        console.error("Gagal melakukan pengecekan update APK:", error)
      }
    }

    checkUpdate()
  }, [])

  const handleUpdate = async () => {
    if (!versionData) return
    try {
      // Buat absolute URL agar browser bawaan Android bisa mengunduh file APK secara langsung
      const absoluteUrl = window.location.origin + versionData.downloadUrl
      await Browser.open({ url: absoluteUrl })
    } catch (err) {
      console.error("Gagal membuka link unduhan APK:", err)
    }
  }

  if (!showModal || !versionData) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        {/* Background Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => {
            if (!isMandatory) setShowModal(false)
          }}
        />

        {/* Modal Card */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-100 dark:border-slate-800 text-center overflow-hidden"
        >
          {/* Decorative Top Gradient */}
          <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600" />

          {/* Close button (only if optional) */}
          {!isMandatory && (
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Tutup dialog"
            >
              <X className="h-5 w-5" />
            </button>
          )}

          {/* Icon Header */}
          <div className="mx-auto mt-4 mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
            {isMandatory ? (
              <AlertTriangle className="h-8 w-8 text-amber-500 animate-bounce" />
            ) : (
              <ArrowUpCircle className="h-8 w-8 animate-pulse" />
            )}
          </div>

          {/* Title */}
          <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 leading-snug">
            {isMandatory ? "Pembaruan Wajib Tersedia" : "Pembaruan Aplikasi Baru"}
          </h3>
          
          <p className="text-xs text-slate-400 mt-1">
            Versi saat ini: <span className="font-semibold text-slate-600 dark:text-slate-300">v{currentVersion}</span> • 
            Versi terbaru: <span className="font-semibold text-indigo-600 dark:text-indigo-400">v{versionData.latestVersion}</span>
          </p>

          {/* Release Notes */}
          <div className="mt-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 text-left border border-slate-100 dark:border-slate-800/60 max-h-32 overflow-y-auto no-scrollbar">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Catatan Rilis:</h4>
            <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed">
              {versionData.releaseNotes}
            </p>
          </div>

          {/* Prompt Instruction */}
          <p className="text-[11px] text-slate-400 mt-4 leading-normal">
            Setelah unduhan selesai, buka file APK untuk memperbarui aplikasi secara otomatis tanpa kehilangan data sesi Anda.
          </p>

          {/* Action Buttons */}
          <div className="mt-5 flex flex-col gap-2">
            <button
              onClick={handleUpdate}
              className="flex items-center justify-center gap-2 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-transform"
            >
              <Download className="h-4 w-4" />
              Unduh &amp; Perbarui Sekarang
            </button>

            {!isMandatory && (
              <button
                onClick={() => setShowModal(false)}
                className="w-full py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 transition-colors"
              >
                Ingatkan Nanti
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
