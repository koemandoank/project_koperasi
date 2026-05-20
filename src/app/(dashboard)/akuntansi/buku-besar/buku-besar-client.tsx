"use client"

import React, { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, ChevronDown, ChevronRight, Filter } from "lucide-react"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"

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

export function BukuBesarClient({ data }: { data: any }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState(searchParams.get("search") || "")
  const [startDate, setStartDate] = useState(searchParams.get("startDate") || "")
  const [endDate, setEndDate] = useState(searchParams.get("endDate") || "")

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

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Cari no jurnal, deskripsi..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Input type="date" className="w-40" value={startDate} onChange={e => setStartDate(e.target.value)} />
        <Input type="date" className="w-40" value={endDate} onChange={e => setEndDate(e.target.value)} />
        <Button onClick={handleFilter} className="gap-2"><Filter className="h-4 w-4" /> Filter</Button>
      </div>

      {/* Summary */}
      <div className="text-sm text-muted-foreground">
        Menampilkan <strong>{data.entries.length}</strong> dari <strong>{data.total}</strong> jurnal
        (Halaman {data.page} dari {data.totalPages || 1})
      </div>

      {/* Table */}
      <div className="border rounded-xl bg-card overflow-hidden">
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
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
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
                      : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    }
                  </TableCell>
                  <TableCell className="font-mono text-xs font-semibold">{entry.entry_no}</TableCell>
                  <TableCell className="text-sm">{entry.entry_date}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{entry.description}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{entry.reference}</TableCell>
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
                                <td className="py-1 text-xs text-muted-foreground">{line.description}</td>
                                <td className="py-1 text-right font-medium text-green-700">{formatRp(line.debit)}</td>
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

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: data.totalPages }, (_, i) => i + 1).map(p => (
            <Button key={p} variant={data.page === p ? "default" : "outline"} size="sm" onClick={() => handlePage(p)}>
              {p}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
