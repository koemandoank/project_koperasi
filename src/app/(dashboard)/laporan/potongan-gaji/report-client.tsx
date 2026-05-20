"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Download, FileText, Search, Filter, ChevronDown, ChevronRight } from "lucide-react"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import ExcelJS from "exceljs"
import { saveAs } from "file-saver"
import { generatePdfHeader, generateExcelHeader } from "@/lib/report-helpers"
import type { MemberDeductionRow } from "@/lib/actions/reports"

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  pinjaman_uang:         "Pinjaman Uang",
  pinjaman_barang:       "Pinjaman Barang",
  pinjaman_kilat:        "Pinjaman Kilat",
  paylater:              "Pay Later",
  simpanan_wajib:        "Simpanan Wajib",
  simpanan_salary_cut:   "Simpanan (Salary Cut)",
}

const CATEGORY_COLORS: Record<string, string> = {
  pinjaman_uang:         "bg-blue-100 text-blue-700",
  pinjaman_barang:       "bg-violet-100 text-violet-700",
  pinjaman_kilat:        "bg-orange-100 text-orange-700",
  paylater:              "bg-red-100 text-red-700",
  simpanan_wajib:        "bg-emerald-100 text-emerald-700",
  simpanan_salary_cut:   "bg-teal-100 text-teal-700",
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const fmt = (val: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val)

// ─────────────────────────────────────────────
// Sub-component: Row detail expander
// ─────────────────────────────────────────────

function DetailRow({ row }: { row: MemberDeductionRow }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <TableCell className="w-8">
          {open
            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </TableCell>
        <TableCell className="font-mono text-xs">{row.nik}</TableCell>
        <TableCell className="font-semibold">{row.name}</TableCell>
        <TableCell className="text-xs text-muted-foreground">{row.department}</TableCell>
        <TableCell className="text-right tabular-nums text-blue-700">
          {row.total_pinjaman_uang > 0 ? fmt(row.total_pinjaman_uang) : <span className="text-slate-300">—</span>}
        </TableCell>
        <TableCell className="text-right tabular-nums text-violet-700">
          {row.total_pinjaman_barang > 0 ? fmt(row.total_pinjaman_barang) : <span className="text-slate-300">—</span>}
        </TableCell>
        <TableCell className="text-right tabular-nums text-orange-700">
          {row.total_pinjaman_kilat > 0 ? fmt(row.total_pinjaman_kilat) : <span className="text-slate-300">—</span>}
        </TableCell>
        <TableCell className="text-right tabular-nums text-red-700">
          {row.total_paylater > 0 ? fmt(row.total_paylater) : <span className="text-slate-300">—</span>}
        </TableCell>
        <TableCell className="text-right tabular-nums text-emerald-700">
          {row.total_simpanan_wajib > 0 ? fmt(row.total_simpanan_wajib) : <span className="text-slate-300">—</span>}
        </TableCell>
        <TableCell className="text-right tabular-nums text-teal-700">
          {row.total_simpanan_salary_cut > 0 ? fmt(row.total_simpanan_salary_cut) : <span className="text-slate-300">—</span>}
        </TableCell>
        <TableCell className="text-right font-bold text-destructive">
          {fmt(row.total_deduction)}
        </TableCell>
      </TableRow>

      {open && (
        <TableRow className="bg-slate-50/70">
          <TableCell colSpan={11} className="px-8 py-3">
            <div className="space-y-1">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Detail Potongan</p>
              {row.details.map((d, i) => (
                <div key={i} className="flex items-center justify-between gap-4 text-xs py-1 border-b last:border-0 border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${CATEGORY_COLORS[d.category]}`}>
                      {CATEGORY_LABELS[d.category]}
                    </span>
                    <span className="text-slate-600">{d.label}</span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="font-mono text-muted-foreground">{d.reference}</span>
                    <span className="font-bold text-slate-800 w-32 text-right">{fmt(d.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export function ReportClient({
  data,
  from,
  to,
  q,
}: {
  data: MemberDeductionRow[]
  from: string
  to: string
  q: string
}) {
  const router = useRouter()
  const [search, setSearch] = useState(q)
  const [dateFrom, setDateFrom] = useState(from)
  const [dateTo, setDateTo] = useState(to)

  const periodLabel = dateFrom && dateTo ? `${dateFrom} s/d ${dateTo}` : "Semua Waktu"

  // ── Summary totals ────────────────────────────────────────────────────────
  const totals = data.reduce(
    (acc, r) => ({
      pinjaman_uang:       acc.pinjaman_uang + r.total_pinjaman_uang,
      pinjaman_barang:     acc.pinjaman_barang + r.total_pinjaman_barang,
      pinjaman_kilat:      acc.pinjaman_kilat + r.total_pinjaman_kilat,
      paylater:            acc.paylater + r.total_paylater,
      simpanan_wajib:      acc.simpanan_wajib + r.total_simpanan_wajib,
      simpanan_salary_cut: acc.simpanan_salary_cut + r.total_simpanan_salary_cut,
      total:               acc.total + r.total_deduction,
    }),
    { pinjaman_uang: 0, pinjaman_barang: 0, pinjaman_kilat: 0, paylater: 0, simpanan_wajib: 0, simpanan_salary_cut: 0, total: 0 }
  )

  // ── Filter handler ────────────────────────────────────────────────────────
  const handleFilter = () => {
    const params = new URLSearchParams()
    if (search) params.set("q", search)
    if (dateFrom) params.set("from", dateFrom)
    if (dateTo) params.set("to", dateTo)
    router.push(`?${params.toString()}`)
  }

  const setPreset = (preset: "hari" | "minggu" | "bulan") => {
    const now = new Date()
    const pad = (n: number) => n.toString().padStart(2, "0")
    const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

    let start = new Date(), end = new Date()
    if (preset === "minggu") start.setDate(now.getDate() - now.getDay())
    else if (preset === "bulan") {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    }

    const s = toISO(start), e = toISO(end)
    setDateFrom(s); setDateTo(e)
    const params = new URLSearchParams()
    if (search) params.set("q", search)
    params.set("from", s); params.set("to", e)
    router.push(`?${params.toString()}`)
  }

  // ── Export Excel ──────────────────────────────────────────────────────────
  const handleExportExcel = async () => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet("Potongan Gaji")

    const COLS = [
      { header: "No", key: "no", width: 5 },
      { header: "NIK", key: "nik", width: 16 },
      { header: "Nama", key: "name", width: 28 },
      { header: "Dept/Unit", key: "dept", width: 20 },
      { header: "Pin. Uang", key: "c1", width: 16 },
      { header: "Pin. Barang", key: "c2", width: 16 },
      { header: "Pin. Kilat", key: "c3", width: 16 },
      { header: "Pay Later", key: "c4", width: 16 },
      { header: "Simp. Wajib", key: "c5", width: 16 },
      { header: "Simp. S.Cut", key: "c6", width: 16 },
      { header: "Total Potongan", key: "total", width: 18 },
    ]
    ws.columns = COLS

    const startRow = generateExcelHeader(ws, "LAPORAN POTONGAN GAJI KOPERASI", periodLabel, COLS.length)

    const hdrRow = ws.getRow(startRow)
    hdrRow.values = COLS.map((c) => c.header)
    hdrRow.font = { bold: true, color: { argb: "FFFFFFFF" } }
    hdrRow.alignment = { horizontal: "center", vertical: "middle" }
    hdrRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } }
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } }
    })

    const moneyFmt = '"Rp"#,##0;[Red]-"Rp"#,##0'
    let cur = startRow + 1
    data.forEach((r, i) => {
      const row = ws.getRow(cur++)
      row.values = { no: i + 1, nik: r.nik, name: r.name, dept: r.department, c1: r.total_pinjaman_uang, c2: r.total_pinjaman_barang, c3: r.total_pinjaman_kilat, c4: r.total_paylater, c5: r.total_simpanan_wajib, c6: r.total_simpanan_salary_cut, total: r.total_deduction }
      ;["c1","c2","c3","c4","c5","c6","total"].forEach((k) => { row.getCell(k).numFmt = moneyFmt })
      row.eachCell((cell) => { cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } } })
    })

    const totRow = ws.getRow(cur)
    totRow.values = { no: "", nik: "", name: "", dept: "TOTAL", c1: totals.pinjaman_uang, c2: totals.pinjaman_barang, c3: totals.pinjaman_kilat, c4: totals.paylater, c5: totals.simpanan_wajib, c6: totals.simpanan_salary_cut, total: totals.total }
    totRow.font = { bold: true }
    ;["c1","c2","c3","c4","c5","c6","total"].forEach((k) => { totRow.getCell(k).numFmt = moneyFmt })
    totRow.eachCell((cell, col) => {
      if (col >= 5) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } }
        cell.border = { top: { style: "double" }, left: { style: "thin" }, bottom: { style: "double" }, right: { style: "thin" } }
      }
    })

    const buf = await wb.xlsx.writeBuffer()
    saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `Potongan_Gaji_${dateFrom || "all"}_${dateTo || "all"}.xlsx`)
  }

  // ── Export PDF ────────────────────────────────────────────────────────────
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" })
    const startY = generatePdfHeader(doc, "LAPORAN POTONGAN GAJI KOPERASI", periodLabel)

    const tableData = data.map((r, i) => [
      i + 1, r.nik, r.name, r.department,
      r.total_pinjaman_uang > 0 ? fmt(r.total_pinjaman_uang) : "-",
      r.total_pinjaman_barang > 0 ? fmt(r.total_pinjaman_barang) : "-",
      r.total_pinjaman_kilat > 0 ? fmt(r.total_pinjaman_kilat) : "-",
      r.total_paylater > 0 ? fmt(r.total_paylater) : "-",
      r.total_simpanan_wajib > 0 ? fmt(r.total_simpanan_wajib) : "-",
      r.total_simpanan_salary_cut > 0 ? fmt(r.total_simpanan_salary_cut) : "-",
      fmt(r.total_deduction),
    ])
    tableData.push(["", "", "", "TOTAL",
      fmt(totals.pinjaman_uang), fmt(totals.pinjaman_barang), fmt(totals.pinjaman_kilat),
      fmt(totals.paylater), fmt(totals.simpanan_wajib), fmt(totals.simpanan_salary_cut),
      fmt(totals.total),
    ])

    // @ts-ignore
    autoTable(doc, {
      startY,
      head: [["No", "NIK", "Nama", "Dept", "Pin.Uang", "Pin.Barang", "Pin.Kilat", "PayLater", "Simp.Wajib", "S.Cut", "Total"]],
      body: tableData,
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [30, 64, 175] },
      willDrawCell: (d: any) => {
        if (d.row.index === tableData.length - 1 && d.section === "body") doc.setFont("helvetica", "bold")
      },
    })
    doc.save(`Potongan_Gaji_${dateFrom || "all"}.pdf`)
  }

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {([
          ["Pinjaman Uang",        totals.pinjaman_uang,       "bg-blue-50 border-blue-200 text-blue-700"],
          ["Pinjaman Barang",      totals.pinjaman_barang,     "bg-violet-50 border-violet-200 text-violet-700"],
          ["Pinjaman Kilat",       totals.pinjaman_kilat,      "bg-orange-50 border-orange-200 text-orange-700"],
          ["Pay Later",            totals.paylater,            "bg-red-50 border-red-200 text-red-700"],
          ["Simpanan Wajib",       totals.simpanan_wajib,      "bg-emerald-50 border-emerald-200 text-emerald-700"],
          ["Simpanan Salary Cut",  totals.simpanan_salary_cut, "bg-teal-50 border-teal-200 text-teal-700"],
        ] as [string, number, string][]).map(([label, val, cls]) => (
          <div key={label} className={`rounded-xl border p-3 ${cls}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{label}</p>
            <p className="text-sm font-bold mt-1">{fmt(val)}</p>
          </div>
        ))}
      </div>

      {/* Grand Total Banner */}
      <div className="rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 text-white p-4 flex justify-between items-center">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-widest font-medium">Total Potongan Gaji</p>
          <p className="text-2xl font-bold mt-1">{fmt(totals.total)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Jumlah Anggota</p>
          <p className="text-2xl font-bold mt-1">{data.length} orang</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card p-4 rounded-xl border shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Filter Laporan</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Pencarian NIK / Nama</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cari..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleFilter()} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Dari Tanggal</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sampai Tanggal</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={handleFilter} className="w-full">Terapkan Filter</Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <span className="text-xs text-muted-foreground flex items-center mr-2">Pilih Cepat:</span>
          {(["hari", "minggu", "bulan"] as const).map((p) => (
            <Button key={p} variant="outline" size="sm" className="h-8 text-xs capitalize" onClick={() => setPreset(p)}>
              {p === "hari" ? "Hari Ini" : p === "minggu" ? "Minggu Ini" : "Bulan Ini"}
            </Button>
          ))}
        </div>
      </div>

      {/* Table Header + Export */}
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-lg">Rincian per Anggota</h3>
        <div className="flex gap-2">
          <Button onClick={handleExportExcel} className="bg-green-600 hover:bg-green-700 h-9">
            <Download className="mr-2 h-4 w-4" /> Excel
          </Button>
          <Button onClick={handleExportPDF} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 h-9">
            <FileText className="mr-2 h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-xl bg-card overflow-x-auto shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-900">
              <TableHead className="w-8" />
              <TableHead className="text-xs">NIK</TableHead>
              <TableHead className="text-xs">Nama Lengkap</TableHead>
              <TableHead className="text-xs">Dept/Unit</TableHead>
              <TableHead className="text-right text-xs text-blue-700">Pin. Uang</TableHead>
              <TableHead className="text-right text-xs text-violet-700">Pin. Barang</TableHead>
              <TableHead className="text-right text-xs text-orange-700">Pin. Kilat</TableHead>
              <TableHead className="text-right text-xs text-red-700">Pay Later</TableHead>
              <TableHead className="text-right text-xs text-emerald-700">Simp. Wajib</TableHead>
              <TableHead className="text-right text-xs text-teal-700">Simp. S.Cut</TableHead>
              <TableHead className="text-right text-xs font-bold">Total Potongan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                  Tidak ada data potongan gaji untuk filter yang dipilih.
                </TableCell>
              </TableRow>
            ) : (
              <>
                {data.map((row) => <DetailRow key={row.member_id} row={row} />)}
                {/* Total Row */}
                <TableRow className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2">
                  <TableCell />
                  <TableCell colSpan={3} className="text-right text-sm">TOTAL KESELURUHAN</TableCell>
                  <TableCell className="text-right tabular-nums text-blue-700">{totals.pinjaman_uang > 0 ? fmt(totals.pinjaman_uang) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-violet-700">{totals.pinjaman_barang > 0 ? fmt(totals.pinjaman_barang) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-orange-700">{totals.pinjaman_kilat > 0 ? fmt(totals.pinjaman_kilat) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-red-700">{totals.paylater > 0 ? fmt(totals.paylater) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-700">{totals.simpanan_wajib > 0 ? fmt(totals.simpanan_wajib) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-teal-700">{totals.simpanan_salary_cut > 0 ? fmt(totals.simpanan_salary_cut) : "—"}</TableCell>
                  <TableCell className="text-right text-destructive">{fmt(totals.total)}</TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <span key={key} className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${CATEGORY_COLORS[key]}`}>
            {label}
          </span>
        ))}
        <span className="text-[11px] text-muted-foreground flex items-center">← Klik baris untuk lihat detail</span>
      </div>
    </div>
  )
}
