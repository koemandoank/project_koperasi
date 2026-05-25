"use client"

import React, { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, ChevronDown, ChevronRight, Filter, AlertTriangle, AlertCircle, Info } from "lucide-react"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

const formatRp = (v: number) =>
  v > 0 ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v) : "-"

const SOURCE_BADGE: Record<string, string> = {
  manual: "bg-slate-100 text-slate-600",
  pos: "bg-blue-100 text-blue-700",
  loan: "bg-amber-100 text-amber-700",
  saving: "bg-green-100 text-green-700",
  ppob: "bg-purple-100 text-purple-700",
  salary_cut: "bg-pink-100 text-pink-700",
}

interface NotificationItem {
  type: "info" | "warning" | "error"
  message: string
  detail?: string
  actionLink?: string
}

export function BukuBesarClient({ data, notifications = [] }: { data: any; notifications?: NotificationItem[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState(searchParams.get("search") || "")
  const [startDate, setStartDate] = useState(searchParams.get("startDate") || "")
  const [endDate, setEndDate] = useState(searchParams.get("endDate") || "")
  const [dismissedNotifs, setDismissedNotifs] = useState<Set<number>>(new Set())

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleFilter = () => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (startDate) params.set("startDate", startDate)
    if (endDate) params.set("endDate", endDate)
    router.push(`/akuntansi/buku-besar?${params.toString()}`)
  }

  const handlePage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(p))
    router.push(`/akuntansi/buku-besar?${params.toString()}`)
  }

  const activeNotifs = notifications.filter((_, idx) => !dismissedNotifs.has(idx))
  const errorCount = activeNotifs.filter(n => n.type === "error").length
  const warningCount = activeNotifs.filter(n => n.type === "warning").length

  return (
    <div className="space-y-4">
      {/* Notifications Panel */}
      {activeNotifs.length > 0 && (
        <div className="space-y-2.5">
          {/* Summary badges */}
          <div className="flex items-center gap-2 px-1">
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Tindakan Diperlukan</span>
            {errorCount > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
                {errorCount} Kritis
              </span>
            )}
            {warningCount > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                {warningCount} Peringatan
              </span>
            )}
          </div>

          {/* Individual notification cards */}
          {notifications.map((notif, idx) => {
            if (dismissedNotifs.has(idx)) return null
            const isError = notif.type === "error"
            const isWarning = notif.type === "warning"
            return (
              <div
                key={idx}
                className={cn(
                  "p-4 rounded-2xl border flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200 shadow-sm",
                  isError
                    ? "bg-rose-50 border-rose-100 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-355"
                    : isWarning
                    ? "bg-amber-50 border-amber-100 text-amber-800 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-355"
                    : "bg-blue-50 border-blue-100 text-blue-800 dark:bg-blue-950/20 dark:border-blue-900/40 dark:text-blue-355"
                )}
              >
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <div className="mt-0.5 shrink-0">
                    {isError ? (
                      <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-450 shrink-0" />
                    ) : isWarning ? (
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-450 shrink-0" />
                    ) : (
                      <Info className="h-5 w-5 text-blue-600 dark:text-blue-450 shrink-0" />
                    )}
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-sm font-semibold leading-relaxed">
                      {notif.message}
                    </p>
                    {notif.detail && (
                      <p className="text-xs opacity-80 leading-relaxed">
                        {notif.detail}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {notif.actionLink && (
                    <Button
                      size="sm"
                      variant="link"
                      className={cn(
                        "p-0 h-auto font-bold flex items-center gap-1 text-xs",
                        isError
                          ? "text-rose-700 dark:text-rose-400 hover:text-rose-800"
                          : isWarning
                          ? "text-amber-700 dark:text-amber-400 hover:text-amber-800"
                          : "text-blue-700 dark:text-blue-400 hover:text-blue-800"
                      )}
                      onClick={() => router.push(notif.actionLink!)}
                    >
                      Proses <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <button
                    onClick={() => setDismissedNotifs(prev => new Set([...prev, idx]))}
                    className="text-xs opacity-50 hover:opacity-80 transition-opacity leading-none p-1 rounded"
                    aria-label="Tutup notifikasi"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap md:flex-nowrap gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border shadow-sm items-center">
        <div className="relative flex-1 min-w-[200px] w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <Input className="pl-11 h-12 text-base rounded-xl" placeholder="Cari no jurnal, deskripsi..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2 w-full md:w-auto md:flex md:gap-3">
          <Input type="date" className="h-12 text-base rounded-xl w-full md:w-40" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <Input type="date" className="h-12 text-base rounded-xl w-full md:w-40" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <Button onClick={handleFilter} className="w-full md:w-auto h-12 rounded-xl font-semibold gap-2 shrink-0"><Filter className="h-4 w-4" /> Filter</Button>
      </div>

      {/* Summary */}
      <div className="text-sm text-muted-foreground">
        Menampilkan <strong>{data.entries.length}</strong> dari <strong>{data.total}</strong> jurnal
        (Halaman {data.page} dari {data.totalPages || 1})
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block border rounded-xl bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-900/50">
              <TableHead className="w-8" />
              <TableHead>No. Jurnal</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Keterangan</TableHead>
              <TableHead>Referensi</TableHead>
              <TableHead>Sumber</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-slate-400">
                  Tidak ada data jurnal.
                </TableCell>
              </TableRow>
            )}
            {data.entries.map((entry: any) => (
              <React.Fragment key={entry.id}>
                <TableRow
                  className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/30"
                  onClick={() => toggleExpand(entry.id)}
                >
                  <TableCell className="w-8 pl-4">
                    {expandedIds.has(entry.id)
                      ? <ChevronDown className="h-4 w-4 text-blue-500" />
                      : <ChevronRight className="h-4 w-4 text-slate-400" />
                    }
                  </TableCell>
                  <TableCell className="font-mono text-xs font-semibold">{entry.entry_no}</TableCell>
                  <TableCell className="text-sm">{entry.entry_date}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{entry.description}</TableCell>
                  <TableCell className="text-xs text-slate-400">{entry.reference}</TableCell>
                  <TableCell>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${SOURCE_BADGE[entry.source] || "bg-slate-100"}`}>
                      {entry.source}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={entry.is_posted ? "default" : "secondary"} className={entry.is_posted ? "bg-green-100 text-green-700" : ""}>
                      {entry.is_posted ? "Posted" : "Draft"}
                    </Badge>
                  </TableCell>
                </TableRow>

                {/* Expanded: Lines */}
                {expandedIds.has(entry.id) && (
                  <TableRow key={`${entry.id}-lines`}>
                    <TableCell colSpan={7} className="p-0 bg-blue-50/30 dark:bg-blue-950/10">
                      <div className="px-12 py-3">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="text-xs text-slate-500 border-b">
                              <th className="text-left py-1.5 font-semibold">Kode Akun</th>
                              <th className="text-left py-1.5 font-semibold">Nama Akun</th>
                              <th className="text-left py-1.5 font-semibold">Keterangan</th>
                              <th className="text-right py-1.5 font-semibold">Debit</th>
                              <th className="text-right py-1.5 font-semibold">Kredit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entry.lines.map((line: any) => (
                              <tr key={line.id} className="border-b border-slate-100 last:border-0">
                                <td className="py-1 font-mono text-xs">{line.account_code}</td>
                                <td className="py-1">{line.account_name}</td>
                                <td className="py-1 text-xs text-slate-400">{line.description}</td>
                                <td className="py-1 text-right font-medium text-green-750">{formatRp(line.debit)}</td>
                                <td className="py-1 text-right font-medium text-red-600">{formatRp(line.credit)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card Feed View */}
      <div className="block md:hidden space-y-3">
        {data.entries.length === 0 ? (
          <div className="text-center py-10 text-slate-400 bg-white dark:bg-slate-900 border rounded-2xl">
            Tidak ada data jurnal.
          </div>
        ) : (
          data.entries.map((entry: any) => {
            const isExpanded = expandedIds.has(entry.id);
            return (
              <div key={entry.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden transition-all">
                {/* Entry Summary Card Header */}
                <div
                  className="p-4 space-y-3 cursor-pointer hover:bg-slate-50/50"
                  onClick={() => toggleExpand(entry.id)}
                >
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-mono text-xs font-extrabold text-blue-600 dark:text-blue-450">{entry.entry_no}</span>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={entry.is_posted ? "default" : "secondary"} className={`text-[10px] font-semibold ${entry.is_posted ? "bg-green-100 text-green-700" : ""}`}>
                        {entry.is_posted ? "Posted" : "Draft"}
                      </Badge>
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-slate-50 text-sm line-clamp-2">{entry.description || "Tanpa Keterangan"}</h4>
                    {entry.reference && <p className="text-[11px] text-slate-400 mt-0.5">Ref: {entry.reference}</p>}
                  </div>

                  <div className="flex justify-between items-center text-xs border-t border-slate-50 dark:border-slate-800/30 pt-2.5 mt-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${SOURCE_BADGE[entry.source] || "bg-slate-100"}`}>
                        {entry.source}
                      </span>
                      <span className="text-[11px] text-slate-450">{entry.entry_date}</span>
                    </div>

                    <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                      {entry.lines?.length ?? 0} Transaksi
                    </span>
                  </div>
                </div>

                {/* Expanded Details: Jurnal Lines */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 p-3 space-y-2">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">Rincian Transaksi</p>
                    <div className="space-y-2">
                      {entry.lines.map((line: any) => {
                        const isDebit = Number(line.debit) > 0;
                        return (
                          <div key={line.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-3 rounded-xl space-y-1.5 shadow-sm">
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{line.account_name}</p>
                                <p className="font-mono text-[10px] text-slate-400">{line.account_code}</p>
                              </div>
                              <span className={`text-xs font-extrabold ${isDebit ? "text-green-700" : "text-red-650"}`}>
                                {isDebit ? `D: ${formatRp(line.debit)}` : `K: ${formatRp(line.credit)}`}
                              </span>
                            </div>
                            {line.description && (
                              <p className="text-xs text-slate-450 italic border-t border-slate-50 dark:border-slate-800/30 pt-1.5">
                                &ldquo;{line.description}&rdquo;
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          {Array.from({ length: data.totalPages }, (_, i) => i + 1).map(p => (
            <Button key={p} variant={data.page === p ? "default" : "outline"} className="h-11 w-11 rounded-xl font-bold" onClick={() => handlePage(p)}>
              {p}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
