"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter, ChevronLeft, ChevronRight, ChevronDown, ChevronRight as CRight, RefreshCw, Download, FileText, Users, BarChart3, List } from "lucide-react"
import type { AuditLogRow, AuditLogResult, RoleSummaryRow, TimelineDayRow } from "@/lib/actions/audit-log"
import { RoleSummaryPanel, TimelinePanel } from "./role-summary"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import ExcelJS from "exceljs"
import { saveAs } from "file-saver"
import { generatePdfHeader, generatePdfFooter, generateExcelHeader, generateExcelFooter } from "@/lib/report-helpers"

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  loan:       { label: "Pinjaman",        color: "bg-blue-100 text-blue-700 border-blue-200" },
  approval:   { label: "Approval",        color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  saving:     { label: "Simpanan",        color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  member:     { label: "Anggota",         color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  user:       { label: "Pengguna",        color: "bg-violet-100 text-violet-700 border-violet-200" },
  shu_config: { label: "Konfigurasi SHU", color: "bg-amber-100 text-amber-700 border-amber-200" },
  pos:        { label: "Toko / POS",      color: "bg-orange-100 text-orange-700 border-orange-200" },
  setting:    { label: "Pengaturan",      color: "bg-pink-100 text-pink-700 border-pink-200" },
  other:      { label: "Lainnya",         color: "bg-slate-100 text-slate-600 border-slate-200" },
}

const ACTION_META: Record<string, { label: string; color: string }> = {
  CREATE:         { label: "Tambah",         color: "bg-green-100 text-green-700" },
  UPDATE:         { label: "Ubah",           color: "bg-yellow-100 text-yellow-800" },
  DELETE:         { label: "Hapus",          color: "bg-red-100 text-red-700" },
  APPROVE:        { label: "Approve",        color: "bg-emerald-100 text-emerald-700" },
  REJECT:         { label: "Tolak",          color: "bg-rose-100 text-rose-700" },
  RESET_PASSWORD: { label: "Reset Password", color: "bg-orange-100 text-orange-700" },
  EXPORT:         { label: "Export",         color: "bg-sky-100 text-sky-700" },
  LOGIN:          { label: "Login",          color: "bg-sky-100 text-sky-700" },
  LOGIN_FAILED:   { label: "Login Gagal",    color: "bg-red-200 text-red-800 font-bold" },
  LOGOUT:         { label: "Logout",         color: "bg-slate-100 text-slate-600" },
}

const ROLE_META: Record<string, { label: string; badge: string }> = {
  superadmin: { label: "Super Admin", badge: "bg-red-100 text-red-700" },
  admin:      { label: "Admin",       badge: "bg-violet-100 text-violet-700" },
  pengurus:   { label: "Pengurus",    badge: "bg-blue-100 text-blue-700" },
  ketua:      { label: "Ketua",       badge: "bg-amber-100 text-amber-700" },
  kasir:      { label: "Kasir",       badge: "bg-teal-100 text-teal-700" },
}

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso))

// ── Log Detail Row ─────────────────────────────────────────────────────────────

function LogDetailRow({ log }: { log: AuditLogRow }) {
  const [open, setOpen] = useState(false)
  const catMeta  = CATEGORY_META[log.category]  ?? CATEGORY_META.other
  const actMeta  = ACTION_META[log.action]       ?? { label: log.action, color: "bg-slate-100 text-slate-600" }
  const roleCls  = ROLE_META[log.user?.role ?? ""]?.badge ?? "bg-slate-100 text-slate-600"
  const hasData  = log.old_values || log.new_values

  return (
    <>
      <TableRow
        className={`transition-colors ${hasData ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50" : ""}`}
        onClick={() => hasData && setOpen((o) => !o)}
      >
        <TableCell className="w-8 text-center">
          {hasData
            ? open ? <ChevronDown className="h-4 w-4 text-muted-foreground mx-auto" />
                   : <CRight className="h-4 w-4 text-muted-foreground mx-auto" />
            : <span className="text-slate-300">—</span>}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmt(log.created_at)}</TableCell>
        <TableCell>
          {log.user ? (
            <div>
              <p className="font-semibold text-sm">{log.user.full_name ?? log.user.username}</p>
              {log.user.nik && <p className="text-xs text-muted-foreground font-mono">{log.user.nik}</p>}
            </div>
          ) : <span className="text-muted-foreground text-xs">—</span>}
        </TableCell>
        <TableCell>
          {log.user?.role && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${roleCls}`}>
              {ROLE_META[log.user.role]?.label ?? log.user.role}
            </span>
          )}
        </TableCell>
        <TableCell>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${catMeta.color}`}>
            {catMeta.label}
          </span>
        </TableCell>
        <TableCell className="font-mono text-xs text-muted-foreground">
          {log.model_type}{log.model_id ? ` #${log.model_id}` : ""}
        </TableCell>
        <TableCell>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${actMeta.color}`}>
            {actMeta.label}
          </span>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground font-mono">{log.ip_address ?? "—"}</TableCell>
      </TableRow>

      {open && hasData && (
        <TableRow className="bg-slate-50/80 dark:bg-slate-900/40">
          <TableCell colSpan={8} className="px-8 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {log.old_values && Object.keys(log.old_values).length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-2">Sebelum (Old Values)</p>
                  <pre className="text-xs bg-red-50 dark:bg-red-950/20 border border-red-100 rounded-lg p-3 overflow-auto max-h-48 text-red-900 dark:text-red-300">
                    {JSON.stringify(log.old_values, null, 2)}
                  </pre>
                </div>
              )}
              {log.new_values && Object.keys(log.new_values).length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-green-600 mb-2">Sesudah (New Values)</p>
                  <pre className="text-xs bg-green-50 dark:bg-green-950/20 border border-green-100 rounded-lg p-3 overflow-auto max-h-48 text-green-900 dark:text-green-300">
                    {JSON.stringify(log.new_values, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

type Filters = {
  search: string; category: string; action: string
  role: string; from: string; to: string; page: number; tab: string
}

export function LogClient({
  result, roleSummary, timeline, filters, templateConfig,
}: {
  result: AuditLogResult
  roleSummary: RoleSummaryRow[]
  timeline: TimelineDayRow[]
  filters: Filters
  templateConfig?: any
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [search,   setSearch]   = useState(filters.search)
  const [category, setCategory] = useState(filters.category)
  const [action,   setAction]   = useState(filters.action)
  const [role,     setRole]     = useState(filters.role)
  const [dateFrom, setDateFrom] = useState(filters.from)
  const [dateTo,   setDateTo]   = useState(filters.to)
  const [tab,      setTab]      = useState(filters.tab)

  const { data, total, page, pageSize } = result
  const totalPages = Math.ceil(total / pageSize)

  const pushFilter = (overrides: Record<string, string | number> = {}) => {
    const params  = new URLSearchParams()
    const merged  = { search, category, action, role, from: dateFrom, to: dateTo, page: 1, tab, ...overrides }
    Object.entries(merged).forEach(([k, v]) => {
      if (v && v !== "all" && v !== "0" && v !== 0) params.set(k, String(v))
    })
    startTransition(() => router.push(`?${params.toString()}`))
  }

  const handleFilter = () => pushFilter()
  const handlePage   = (p: number) => pushFilter({ page: p })

  const setPreset = (preset: "hari" | "minggu" | "bulan") => {
    const now = new Date()
    const pad = (n: number) => n.toString().padStart(2, "0")
    const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    let start = new Date(), end = new Date()
    if (preset === "minggu") start.setDate(now.getDate() - now.getDay())
    else if (preset === "bulan") {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      end   = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    }
    const s = toISO(start), e = toISO(end)
    setDateFrom(s); setDateTo(e)
    pushFilter({ from: s, to: e })
  }

  const switchTab = (t: string) => {
    setTab(t)
    pushFilter({ tab: t })
  }

  // ── Export Excel ─────────────────────────────────────────────────────────────
  const handleExportExcel = async () => {
    const wb  = new ExcelJS.Workbook()
    const ws  = wb.addWorksheet("Audit Log")
    const COLS = [
      { header: "No",       key: "no",     width: 5  },
      { header: "Waktu",    key: "time",   width: 20 },
      { header: "Nama",     key: "name",   width: 28 },
      { header: "NIK",      key: "nik",    width: 18 },
      { header: "Role",     key: "role",   width: 12 },
      { header: "Kategori", key: "cat",    width: 18 },
      { header: "Model",    key: "model",  width: 20 },
      { header: "Aksi",     key: "action", width: 12 },
      { header: "IP",       key: "ip",     width: 16 },
    ]
    ws.columns = COLS
    const startRow = generateExcelHeader(ws, "LOG AKTIVITAS SISTEM", `${dateFrom || "Awal"} s/d ${dateTo || "Akhir"}`, COLS.length, templateConfig)
    const hdr = ws.getRow(startRow)
    hdr.values = COLS.map((c) => c.header)
    hdr.font   = { bold: true, color: { argb: "FFFFFFFF" } }
    hdr.eachCell((cell) => {
      cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } }
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } }
    })
    let cur = startRow + 1
    data.forEach((r, i) => {
      const row = ws.getRow(cur++)
      row.values = {
        no: i + 1, time: fmt(r.created_at),
        name: r.user?.full_name ?? r.user?.username ?? "-",
        nik: r.user?.nik ?? "-",
        role: ROLE_META[r.user?.role ?? ""]?.label ?? r.user?.role ?? "-",
        cat: CATEGORY_META[r.category]?.label ?? r.category,
        model: `${r.model_type}${r.model_id ? ` #${r.model_id}` : ""}`,
        action: ACTION_META[r.action]?.label ?? r.action,
        ip: r.ip_address ?? "-",
      }
      row.eachCell((cell) => {
        cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } }
      })
    })

    generateExcelFooter(ws, cur + 2, COLS.length, templateConfig)

    const buf = await wb.xlsx.writeBuffer()
    saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `AuditLog_${dateFrom || "all"}.xlsx`)
  }

  // ── Export PDF ────────────────────────────────────────────────────────────────
  const handleExportPDF = () => {
    const doc    = new jsPDF({ orientation: "landscape" })
    const startY = generatePdfHeader(doc, "LOG AKTIVITAS SISTEM", `${dateFrom || "Awal"} s/d ${dateTo || "Akhir"}`, templateConfig)
    const rows   = data.map((r, i) => [
      i + 1, fmt(r.created_at),
      r.user?.full_name ?? r.user?.username ?? "-",
      r.user?.nik ?? "-",
      ROLE_META[r.user?.role ?? ""]?.label ?? r.user?.role ?? "-",
      CATEGORY_META[r.category]?.label ?? r.category,
      `${r.model_type}${r.model_id ? ` #${r.model_id}` : ""}`,
      ACTION_META[r.action]?.label ?? r.action,
      r.ip_address ?? "-",
    ])
    // @ts-ignore
    autoTable(doc, {
      startY, head: [["No","Waktu","Nama","NIK","Role","Kategori","Model","Aksi","IP"]],
      body: rows, theme: "grid",
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [30, 64, 175] },
    })

    const finalY = (doc as any).lastAutoTable.finalY + 10
    generatePdfFooter(doc, finalY, templateConfig)

    doc.save(`AuditLog_${dateFrom || "all"}.pdf`)
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const TABS = [
    { id: "log",      label: "Semua Log",    icon: List },
    { id: "per-role", label: "Per Role",     icon: Users },
    { id: "timeline", label: "Timeline",     icon: BarChart3 },
  ]

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          ["Total Log", total.toLocaleString("id-ID"), "text-slate-800 dark:text-slate-100"],
          ["Halaman",   `${page} / ${totalPages || 1}`, "text-blue-700"],
          ["Per Halaman", pageSize.toString(),           "text-slate-600"],
          ["Ditampilkan", data.length.toString(),        "text-indigo-700"],
        ] as const).map(([label, val, cls]) => (
          <div key={label} className="rounded-xl border bg-card p-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className={`text-xl font-bold mt-1 ${cls}`}>{val}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-xl border bg-card shadow-sm p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Filter Log</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-3">
          {/* Search */}
          <div className="space-y-1.5 lg:col-span-2">
            <Label className="text-xs">NIK / Nama / Username</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cari pengguna..." className="pl-9" value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFilter()} />
            </div>
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <Label className="text-xs">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v ?? "all")}>
              <SelectTrigger><SelectValue placeholder="Semua Role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Role</SelectItem>
                {Object.entries(ROLE_META).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-xs">Kategori</Label>
            <Select value={category} onValueChange={(v) => setCategory(v ?? "all")}>
              <SelectTrigger><SelectValue placeholder="Semua Kategori" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {Object.entries(CATEGORY_META).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action */}
          <div className="space-y-1.5">
            <Label className="text-xs">Aksi</Label>
            <Select value={action} onValueChange={(v) => setAction(v ?? "all")}>
              <SelectTrigger><SelectValue placeholder="Semua Aksi" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Aksi</SelectItem>
                {Object.entries(ACTION_META).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date From */}
          <div className="space-y-1.5">
            <Label className="text-xs">Dari Tanggal</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>

          {/* Date To */}
          <div className="space-y-1.5">
            <Label className="text-xs">Sampai Tanggal</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
          <Button onClick={handleFilter} disabled={isPending} className="h-8 px-4">
            {isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Filter className="h-4 w-4 mr-2" />}
            Terapkan
          </Button>
          <span className="text-xs text-muted-foreground">Preset:</span>
          {(["hari", "minggu", "bulan"] as const).map((p) => (
            <Button key={p} variant="outline" size="sm" className="h-8 text-xs" onClick={() => setPreset(p)}>
              {p === "hari" ? "Hari Ini" : p === "minggu" ? "Minggu Ini" : "Bulan Ini"}
            </Button>
          ))}
          <div className="ml-auto flex gap-2">
            <Button onClick={handleExportExcel} size="sm" className="h-8 bg-green-600 hover:bg-green-700 text-xs">
              <Download className="h-3.5 w-3.5 mr-1" /> Excel
            </Button>
            <Button onClick={handleExportPDF} size="sm" variant="outline" className="h-8 text-red-600 border-red-200 hover:bg-red-50 text-xs">
              <FileText className="h-3.5 w-3.5 mr-1" /> PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => switchTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === id
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "per-role" && <RoleSummaryPanel data={roleSummary} />}
      {tab === "timeline" && <TimelinePanel data={timeline} />}
      {tab === "log" && (
        <>
          {/* Category chips */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setCategory("all"); pushFilter({ category: "all" }) }}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-opacity hover:opacity-80 bg-slate-100 text-slate-600 border-slate-200 ${category === "all" ? "ring-2 ring-offset-1 ring-slate-400" : ""}`}
            >
              Semua
            </button>
            {Object.entries(CATEGORY_META).map(([key, { label, color }]) => (
              <button key={key}
                onClick={() => { setCategory(key); pushFilter({ category: key }) }}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border cursor-pointer transition-opacity hover:opacity-80 ${color} ${category === key ? "ring-2 ring-offset-1 ring-current" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-900 text-xs">
                  <TableHead className="w-8" />
                  <TableHead className="whitespace-nowrap">Waktu</TableHead>
                  <TableHead>Pengguna</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Model / ID</TableHead>
                  <TableHead>Aksi</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                      Tidak ada log aktivitas untuk filter yang dipilih.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((log) => <LogDetailRow key={log.id} log={log} />)
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Menampilkan {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} dari {total.toLocaleString("id-ID")} entri
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-8 w-8 p-0"
                  disabled={page <= 1 || isPending} onClick={() => handlePage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
                  return (
                    <Button key={p} variant={p === page ? "default" : "outline"} size="sm"
                      className="h-8 w-8 p-0 text-xs" onClick={() => handlePage(p)} disabled={isPending}>
                      {p}
                    </Button>
                  )
                })}
                <Button variant="outline" size="sm" className="h-8 w-8 p-0"
                  disabled={page >= totalPages || isPending} onClick={() => handlePage(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
