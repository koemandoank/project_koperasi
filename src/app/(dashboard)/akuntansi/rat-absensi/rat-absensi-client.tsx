"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import {
  Users, CheckCircle2, XCircle, Search, Printer,
  RefreshCw, Vote, Calendar, Award, ShieldCheck, CheckSquare, Square
} from "lucide-react"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import {
  registerRatAttendance,
  cancelRatAttendance,
  toggleRatVotingRight,
  getRatQuorumStatus,
  getRatMembersAttendanceList,
  RatStatus,
  RatMemberAttendance
} from "@/lib/actions/rat-absensi"
import { generatePdfHeader, generatePdfFooter } from "@/lib/report-helpers"

interface Props {
  initialQuorum: RatStatus | null
  initialAttendance: RatMemberAttendance[]
  initialYear: number
  templateConfig?: any
}

/**
 * Komponen interaktif Client-Side untuk Manajemen Kehadiran & Hak Suara RAT.
 *
 * @param {Props} props - Properti komponen
 * @returns {JSX.Element} Panel Absensi RAT
 */
export function RatAbsensiClient({ initialQuorum, initialAttendance, initialYear, templateConfig }: Props) {
  const [year] = useState(initialYear)
  const [quorum, setQuorum] = useState<RatStatus | null>(initialQuorum)
  const [attendanceList, setAttendanceList] = useState<RatMemberAttendance[]>(initialAttendance)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<"all" | "present" | "absent" | "voted" | "not_voted">("all")
  const [loading, setLoading] = useState(false)
  const [mutatingIds, setMutatingIds] = useState<Record<string, boolean>>({})

  /**
   * Mengambil ulang data absensi dan status kuorum dari database secara real-time.
   */
  const handleRefresh = async () => {
    setLoading(true)
    try {
      const [quorumRes, list] = await Promise.all([
        getRatQuorumStatus(year),
        getRatMembersAttendanceList(year)
      ])
      if (quorumRes.success && quorumRes.status) {
        setQuorum(quorumRes.status)
      }
      setAttendanceList(list)
      toast.success("Data absensi RAT berhasil diperbarui secara real-time.")
    } catch (err) {
      console.error("[handleRefresh] Error:", err)
      toast.error("Gagal memperbarui data absensi.")
    } finally {
      setLoading(false)
    }
  }

  /**
   * Mencatat kehadiran anggota RAT.
   *
   * @param {string} memberIdStr - ID Anggota dalam format string
   */
  const handleCheckIn = async (memberIdStr: string) => {
    const id = parseInt(memberIdStr)
    setMutatingIds(prev => ({ ...prev, [memberIdStr]: true }))
    try {
      const res = await registerRatAttendance(id, year)
      if (res.success) {
        toast.success("Kehadiran anggota berhasil tercatat.")
        await handleRefresh()
      } else {
        toast.error(res.error || "Gagal mencatat kehadiran.")
      }
    } catch (err) {
      console.error("[handleCheckIn] Error:", err)
      toast.error("Terjadi kesalahan sistem saat check-in.")
    } finally {
      setMutatingIds(prev => ({ ...prev, [memberIdStr]: false }))
    }
  }

  /**
   * Membatalkan catatan kehadiran anggota RAT.
   *
   * @param {string} memberIdStr - ID Anggota dalam format string
   */
  const handleCancelAttendance = async (memberIdStr: string) => {
    const id = parseInt(memberIdStr)
    setMutatingIds(prev => ({ ...prev, [memberIdStr]: true }))
    try {
      const res = await cancelRatAttendance(id, year)
      if (res.success) {
        toast.success("Kehadiran anggota berhasil dibatalkan.")
        await handleRefresh()
      } else {
        toast.error(res.error || "Gagal membatalkan kehadiran.")
      }
    } catch (err) {
      console.error("[handleCancelAttendance] Error:", err)
      toast.error("Terjadi kesalahan sistem saat membatalkan kehadiran.")
    } finally {
      setMutatingIds(prev => ({ ...prev, [memberIdStr]: false }))
    }
  }

  /**
   * Mengubah status penggunaan hak suara/voting anggota.
   *
   * @param {string} memberIdStr - ID Anggota dalam format string
   * @param {boolean} voted - Status hak suara baru
   */
  const handleToggleVoting = async (memberIdStr: string, voted: boolean) => {
    const id = parseInt(memberIdStr)
    setMutatingIds(prev => ({ ...prev, [`vote-${memberIdStr}`]: true }))
    try {
      const res = await toggleRatVotingRight(id, year, voted)
      if (res.success) {
        toast.success(voted ? "Hak suara terverifikasi digunakan." : "Status penggunaan hak suara dibatalkan.")
        await handleRefresh()
      } else {
        toast.error(res.error || "Gagal mengubah status hak suara.")
      }
    } catch (err) {
      console.error("[handleToggleVoting] Error:", err)
      toast.error("Terjadi kesalahan sistem saat memperbarui hak suara.")
    } finally {
      setMutatingIds(prev => ({ ...prev, [`vote-${memberIdStr}`]: false }))
    }
  }

  /**
   * Mengekspor daftar absensi dan hak suara RAT ke PDF premium dengan Kop & TTD ganda.
   */
  const handleExportPDF = async () => {
    if (attendanceList.length === 0) {
      toast.error("Tidak ada data absensi untuk diekspor.")
      return
    }

    try {
      const doc = new jsPDF()

      // Header Kop Surat
      const startY = generatePdfHeader(
        doc,
        "DAFTAR HADIR & REKAP HAK SUARA ANGGOTA RAT",
        `Tahun Buku ${year} | Tanggal RAT: ${new Date().toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })}`,
        templateConfig
      )

      // 1. Ringkasan Kuorum Kehadiran
      doc.setFontSize(10)
      doc.setFont("helvetica", "bold")
      doc.text("1. RINGKASAN KUORUM KEHADIRAN", 14, startY)

      const quorumRows = [
        ["Total Anggota Aktif Koperasi", `${quorum?.totalActive ?? 0} Orang`],
        ["Total Anggota Hadir Fisik (RAT)", `${quorum?.totalPresent ?? 0} Orang`],
        ["Persentase Kehadiran", `${quorum?.quorumPercentage ?? 0}%`],
        ["Status Kuorum (Persyaratan >= 50% + 1)", (quorum?.isQuorumReached ?? false) ? "MEMENUHI SYARAT (KUORUM TERCAPAI)" : "BELUM MEMENUHI SYARAT"]
      ]

      autoTable(doc, {
        startY: startY + 4,
        head: [['Indikator Kuorum Kehadiran', 'Keterangan Analisis']],
        body: quorumRows,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 100, fontStyle: 'bold' }
        },
        styles: { fontSize: 8.5 }
      })

      const finalY1 = (doc as any).lastAutoTable.finalY + 8

      // 2. Tabel Absensi Anggota
      doc.setFont("helvetica", "bold")
      doc.text("2. BUKU DAFTAR HADIR HARI H RAT", 14, finalY1)

      const memberRows = filteredList.map((m: any, idx: any) => [
        (idx + 1).toString(),
        m.memberCode,
        m.fullName,
        m.unitName,
        m.isPresent ? "HADIR" : "TIDAK HADIR",
        m.voted ? "SUDAH MEMILIH" : "BELUM MEMILIH",
        m.attendedAt ? new Date(m.attendedAt).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' }) : "-"
      ])

      autoTable(doc, {
        startY: finalY1 + 4,
        head: [['No', 'No. Anggota', 'Nama Lengkap Anggota', 'Unit / Divisi', 'Status Kehadiran', 'Status Hak Suara', 'Jam Absen']],
        body: memberRows,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 25, halign: 'center' },
          2: { cellWidth: 45 },
          3: { cellWidth: 35 },
          4: { cellWidth: 25, halign: 'center' },
          5: { cellWidth: 27, halign: 'center' },
          6: { cellWidth: 20, halign: 'center' }
        },
        styles: { fontSize: 8 },
        didParseCell: (data) => {
          if (data.column.index === 4) {
            if (data.cell.text[0] === "HADIR") {
              data.cell.styles.textColor = [16, 185, 129] // Emerald Green
              data.cell.styles.fontStyle = "bold"
            } else {
              data.cell.styles.textColor = [239, 68, 68] // Rose Red
            }
          }
          if (data.column.index === 5 && data.cell.text[0] === "SUDAH MEMILIH") {
            data.cell.styles.textColor = [79, 70, 229] // Indigo
            data.cell.styles.fontStyle = "bold"
          }
        }
      })

      const finalY2 = (doc as any).lastAutoTable.finalY
      generatePdfFooter(doc, finalY2, templateConfig)

      doc.save(`Absensi_Kehadiran_RAT_${year}.pdf`)
      toast.success("Daftar hadir RAT berhasil diekspor ke PDF.")
    } catch (err) {
      console.error("[handleExportPDF] Error:", err)
      toast.error("Terjadi kesalahan saat memproses ekspor PDF.")
    }
  }

  // Filter list anggota berdasarkan input search dan tombol filter
  const filteredList = attendanceList.filter((m: any) => {
    const matchSearch =
      m.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.memberCode.toLowerCase().includes(searchQuery.toLowerCase())

    if (!matchSearch) return false

    if (filterType === "present") return m.isPresent
    if (filterType === "absent") return !m.isPresent
    if (filterType === "voted") return m.voted
    if (filterType === "not_voted") return m.isPresent && !m.voted
    return true
  })

  // Hitung jumlah sisa
  const totalAbsent = (quorum?.totalActive ?? 0) - (quorum?.totalPresent ?? 0)
  const isQuorumReached = quorum?.isQuorumReached ?? false

  return (
    <div className="space-y-6">
      {/* 1. GRID STATISTIK KUORUM & KEHADIRAN */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Anggota */}
        <Card className="border shadow-sm rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/10 border-indigo-100 dark:border-indigo-950">
          <CardContent className="p-5 space-y-2">
            <div className="flex justify-between items-center text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Total Anggota Aktif</span>
              <Users className="h-5 w-5 text-indigo-500" />
            </div>
            <p className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">
              {quorum?.totalActive ?? 0}
            </p>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">Tahun Buku {year}</p>
          </CardContent>
        </Card>

        {/* Total Kehadiran */}
        <Card className="border shadow-sm rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-950">
          <CardContent className="p-5 space-y-2">
            <div className="flex justify-between items-center text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Hadir Fisik</span>
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <p className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">
              {quorum?.totalPresent ?? 0}
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-450 font-semibold">Anggota Terdaftar Hadir</p>
          </CardContent>
        </Card>

        {/* Belum Hadir */}
        <Card className="border shadow-sm rounded-2xl bg-rose-50/40 dark:bg-rose-950/10 border-rose-100 dark:border-rose-950">
          <CardContent className="p-5 space-y-2">
            <div className="flex justify-between items-center text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Belum Hadir</span>
              <XCircle className="h-5 w-5 text-rose-500" />
            </div>
            <p className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">
              {totalAbsent}
            </p>
            <p className="text-xs text-rose-600 dark:text-rose-455 font-semibold">Menunggu Check-In</p>
          </CardContent>
        </Card>

        {/* Status Kuorum */}
        <Card className={`border shadow-sm rounded-2xl ${
          isQuorumReached 
            ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900" 
            : "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900"
        }`}>
          <CardContent className="p-5 space-y-2.5">
            <div className="flex justify-between items-center text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Status Kuorum RAT</span>
              <ShieldCheck className={`h-5 w-5 ${isQuorumReached ? "text-emerald-500" : "text-amber-500"}`} />
            </div>
            <div className="flex items-center justify-between">
              <p className={`text-2xl font-extrabold ${isQuorumReached ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-455"}`}>
                {quorum?.quorumPercentage ?? 0}%
              </p>
              <Badge className={`font-bold border-0 ${
                isQuorumReached 
                  ? "bg-emerald-500 text-white hover:bg-emerald-600" 
                  : "bg-amber-500 text-white hover:bg-amber-600"
              }`}>
                {isQuorumReached ? "TERCAPAI" : "BELUM TERPENUHI"}
              </Badge>
            </div>
            <div className="space-y-1">
              <Progress 
                value={quorum?.quorumPercentage ?? 0} 
                className={`h-2 ${isQuorumReached ? "bg-emerald-200 dark:bg-emerald-900" : "bg-amber-200 dark:bg-amber-900"}`}
              />
              <p className="text-[10px] text-slate-500 font-medium">Syarat Kuorum: Min {(Math.floor((quorum?.totalActive ?? 0) / 2) + 1)} Anggota (50% + 1)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. ACTION BAR (SEARCH, FILTERS, BUTTONS) */}
      <div className="flex flex-col gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center lg:justify-between">
          
          {/* Pencarian */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Cari anggota berdasarkan nama atau kode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 h-10 rounded-xl bg-slate-50 border-0 dark:bg-slate-800 dark:text-slate-100 text-xs font-semibold focus-visible:ring-1 focus-visible:ring-indigo-500"
            />
          </div>

          {/* Opsi Ekspor & Refresh */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleRefresh}
              disabled={loading}
              variant="outline"
              className="rounded-xl h-10 px-3.5 text-xs font-bold border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm flex items-center gap-1.5"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Segarkan
            </Button>
            
            <Button
              onClick={handleExportPDF}
              disabled={loading || attendanceList.length === 0}
              variant="default"
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 px-4 text-xs font-bold shadow-sm flex items-center gap-1.5"
            >
              <Printer className="h-4 w-4" />
              Cetak Daftar Hadir (PDF)
            </Button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-1.5 border-t border-slate-100 dark:border-slate-800 pt-3">
          <Button
            variant={filterType === "all" ? "default" : "ghost"}
            onClick={() => setFilterType("all")}
            className={`rounded-xl h-8 px-4 text-xs font-bold ${filterType === "all" ? "bg-slate-800 hover:bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}
          >
            Semua ({attendanceList.length})
          </Button>
          <Button
            variant={filterType === "present" ? "default" : "ghost"}
            onClick={() => setFilterType("present")}
            className={`rounded-xl h-8 px-4 text-xs font-bold ${filterType === "present" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "text-slate-500 hover:bg-slate-100"}`}
          >
            Hadir ({attendanceList.filter((a: any) => a.isPresent).length})
          </Button>
          <Button
            variant={filterType === "absent" ? "default" : "ghost"}
            onClick={() => setFilterType("absent")}
            className={`rounded-xl h-8 px-4 text-xs font-bold ${filterType === "absent" ? "bg-rose-600 hover:bg-rose-700 text-white" : "text-slate-500 hover:bg-slate-100"}`}
          >
            Belum Hadir ({attendanceList.filter((a: any) => !a.isPresent).length})
          </Button>
          <Button
            variant={filterType === "voted" ? "default" : "ghost"}
            onClick={() => setFilterType("voted")}
            className={`rounded-xl h-8 px-4 text-xs font-bold ${filterType === "voted" ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "text-slate-500 hover:bg-slate-100"}`}
          >
            Sudah Memilih ({attendanceList.filter((a: any) => a.voted).length})
          </Button>
          <Button
            variant={filterType === "not_voted" ? "default" : "ghost"}
            onClick={() => setFilterType("not_voted")}
            className={`rounded-xl h-8 px-4 text-xs font-bold ${filterType === "not_voted" ? "bg-amber-600 hover:bg-amber-700 text-white" : "text-slate-500 hover:bg-slate-100"}`}
          >
            Hadir Belum Memilih ({attendanceList.filter((a: any) => a.isPresent && !a.voted).length})
          </Button>
        </div>
      </div>

      {/* 3. DAFTAR ANGGOTA TABLE */}
      <Card className="border border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-500" />
            Buku Presensi Kehadiran & Status Suara RAT
          </CardTitle>
          <CardDescription>Pencatatan real-time kehadiran fisik serta validasi partisipasi suara pemungutan RAT.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px] text-center">No. Anggota</TableHead>
                  <TableHead>Nama Anggota</TableHead>
                  <TableHead>Unit Kerja / Divisi</TableHead>
                  <TableHead className="text-center w-[120px]">Kehadiran</TableHead>
                  <TableHead className="text-center w-[150px]">Hak Suara (Voted)</TableHead>
                  <TableHead className="text-center w-[120px]">Jam Check-In</TableHead>
                  <TableHead className="w-[160px] text-right pr-6">Tindakan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-slate-400 font-medium animate-pulse">
                      Menghubungkan ke server database...
                    </TableCell>
                  </TableRow>
                ) : filteredList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                      Tidak ada data anggota aktif yang sesuai dengan kriteria filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredList.map((m: any) => {
                    const isMutating = mutatingIds[m.memberId] || false
                    const isVoteMutating = mutatingIds[`vote-${m.memberId}`] || false
                    
                    return (
                      <TableRow key={m.memberId} className="hover:bg-slate-50/50">
                        <TableCell className="font-semibold text-center text-xs tracking-wider">
                          {m.memberCode}
                        </TableCell>
                        <TableCell className="font-bold text-slate-800 dark:text-slate-200">
                          {m.fullName}
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-slate-500">
                          {m.unitName}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`font-bold border-0 py-1 px-2.5 rounded-full text-[10px] ${
                            m.isPresent
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-450"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                          }`}>
                            {m.isPresent ? "HADIR" : "BELUM HADIR"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {m.isPresent ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <Switch
                                checked={m.voted}
                                onCheckedChange={(checked) => handleToggleVoting(m.memberId, checked)}
                                disabled={isVoteMutating}
                                className="data-[state=checked]:bg-indigo-600"
                              />
                              <span className={`text-[10px] font-extrabold ${m.voted ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`}>
                                {m.voted ? "MEMILIH" : "BELUM"}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Menunggu Hadir</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-xs font-bold text-slate-500">
                          {m.attendedAt 
                            ? new Date(m.attendedAt).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit', second: '2-digit' }) 
                            : "-"
                          }
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          {m.isPresent ? (
                            <Button
                              onClick={() => handleCancelAttendance(m.memberId)}
                              disabled={isMutating}
                              variant="outline"
                              className="rounded-xl h-8 px-3 text-[10px] font-extrabold border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-350 dark:hover:bg-rose-950/20"
                            >
                              Batal Hadir
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleCheckIn(m.memberId)}
                              disabled={isMutating}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-8 px-3 text-[10px] font-extrabold shadow-sm"
                            >
                              Check-In
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
