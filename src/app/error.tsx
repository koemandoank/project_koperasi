'use client'

import { useEffect, useState } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [lastChecked, setLastChecked] = useState('')

  const checkServerStatus = async () => {
    setServerStatus('checking')

    try {
      const response = await fetch('/api/ping', {
        method: 'GET',
        cache: 'no-store',
      })

      setServerStatus(response.ok ? 'online' : 'offline')
    } catch (error) {
      setServerStatus('offline')
    } finally {
      setLastChecked(
        new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      )
    }
  }

  useEffect(() => {
    console.error(error)
    checkServerStatus()

    const interval = window.setInterval(checkServerStatus, 5000)
    return () => window.clearInterval(interval)
  }, [error])

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="text-center space-y-6 max-w-md">
        <div className="text-6xl">⏱️</div>
        <h1 className="text-2xl font-bold text-slate-900">SERVER TIME OUT</h1>

        <div className="flex flex-col items-center space-y-4">
          <div className="h-24 w-24 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700 bg-slate-50">
            <img
              src="/koperasi.png"
              alt="Logo Koperasi"
              className="object-contain p-3 w-full h-full"
            />
          </div>
          <h2 className="text-xl font-semibold text-slate-800">Koperasi Sulfindo</h2>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-slate-800 bg-slate-100 mx-auto">
          <span className={`h-2.5 w-2.5 rounded-full ${
            serverStatus === 'online'
              ? 'bg-emerald-500'
              : serverStatus === 'offline'
              ? 'bg-red-500'
              : 'bg-amber-500'
          }`} />
          {serverStatus === 'checking'
            ? 'Mengecek koneksi server...'
            : serverStatus === 'online'
            ? 'Server online'
            : 'Server offline'}
        </div>

        {lastChecked && (
          <p className="text-xs text-slate-500">Terakhir dicek: {lastChecked}</p>
        )}

        <p className="text-slate-600 max-w-sm mx-auto">
          Halaman ini tersedia di bundel aplikasi. Jika server online, tekan refresh untuk mencoba kembali.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={checkServerStatus}
            className="border border-slate-300 hover:border-slate-400 text-slate-800 font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            🔁 Periksa Koneksi
          </button>
          <button
            type="button"
            onClick={() => reset()}
            className={`font-semibold py-3 px-4 rounded-lg transition-colors text-white ${
              serverStatus === 'online' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            🔄 Refresh Halaman
          </button>
        </div>
      </div>
    </div>
  )
}