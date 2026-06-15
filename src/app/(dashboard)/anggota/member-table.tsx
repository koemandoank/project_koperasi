"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, Key, Edit, Trash2, Phone, Mail, Building2, Users, Activity, Clock } from "lucide-react"
import { resetMemberPassword, deleteMember } from "@/lib/actions/members"
import { toast } from "sonner"
import { MemberForm } from "./member-form"
import { cn } from "@/lib/utils"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Pagination } from "@/components/ui/pagination"

/**
 * Validates that a photo path is a proper external URL (Cloudinary, ui-avatars, etc).
 * Rejects local /uploads/ paths that only exist on development filesystem.
 *
 * @param path - photo_path value from database
 * @returns true if the path is a displayable external URL
 */
function isValidPhotoUrl(path: string | null | undefined): boolean {
  if (!path) return false
  // Reject local filesystem paths
  if (path.startsWith("/uploads/") || path.startsWith("./") || path.startsWith("../")) return false
  // Accept external http(s) URLs
  return path.startsWith("http://") || path.startsWith("https://")
}

export function MemberTable({
  members,
  units,
  stats,
  pagination,
}: {
  members: any[]
  units: any[]
  stats: any
  pagination?: {
    page: number
    pages: number
    total: number
    pageSize: number
    hasMore: boolean
  }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams)
    params.set("page", newPage.toString())
    router.push(`${pathname}?${params.toString()}`)
  }

  const [activeTab, setActiveTab] = useState<"list" | "stats" | "activities">(
    searchParams.get("page") ? "list" : "list"
  )
  const [loading, setLoading] = useState<number | null>(null)
  const [search, setSearch] = useState("")

  const filteredMembers = members.filter(
    (m: any) =>
      m.full_name.toLowerCase().includes(search.toLowerCase()) || m.nik.includes(search)
  )

  /**
   * Resets member password. Prompts for a custom password or uses the default.
   * @param userId - The user account ID to reset
   */
  const handleResetPassword = async (userId: number | null) => {
    if (!userId) return toast.error("Anggota belum memiliki akun")

    const input = window.prompt(
      "Masukkan password baru.\nKosongkan lalu klik OK untuk password default: K0pmember01"
    )
    if (input === null) return

    const customPassword = input.trim()
    setLoading(userId)
    const res = await resetMemberPassword(userId, customPassword || undefined)
    if (res.success) toast.success(res.message)
    else toast.error(res.error)
    setLoading(null)
  }

  /**
   * Deletes a member after confirmation.
   * @param memberId - The member ID to delete
   */
  const handleDelete = async (memberId: number) => {
    if (!confirm("Yakin ingin menghapus anggota ini? Data transaksi mungkin mencegah penghapusan.")) return
    const res = await deleteMember(memberId)
    if (res.success) toast.success("Anggota berhasil dihapus")
    else toast.error(res.error)
  }

  return (
    <div className="space-y-4">
      {/* ── Tabs Navigator ── */}
      <div className="flex justify-start border-b border-slate-100 dark:border-slate-800 pb-2">
        <div className="flex space-x-1 bg-slate-100/70 dark:bg-slate-800/60 backdrop-blur p-0.5 rounded-lg w-full max-w-xs md:max-w-sm">
          <button
            onClick={() => setActiveTab("list")}
            className={cn(
              "flex-1 py-1 px-2.5 rounded-md text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5",
              activeTab === "list"
                ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <Users className="h-3.5 w-3.5" />
            Daftar
          </button>
          <button
            onClick={() => setActiveTab("stats")}
            className={cn(
              "flex-1 py-1 px-2.5 rounded-md text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5",
              activeTab === "stats"
                ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <Activity className="h-3.5 w-3.5" />
            Statistik
          </button>
          <button
            onClick={() => setActiveTab("activities")}
            className={cn(
              "flex-1 py-1 px-2.5 rounded-md text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5",
              activeTab === "activities"
                ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            Aktivitas
          </button>
        </div>
      </div>

      {/* ── Tab 1: Member Directory (Daftar) ── */}
      {activeTab === "list" && (
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Cari NIK atau Nama Anggota..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 text-sm"
            />
          </div>

          {/* Empty State */}
          {filteredMembers.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-sm">
              Tidak ada data anggota ditemukan.
            </div>
          )}

          {/* Desktop Table View (md and up) - Ultra Compact */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                  <th className="py-2 px-3 font-semibold text-xs w-[60px]">Foto</th>
                  <th className="py-2 px-3 font-semibold text-xs">Kode / NIK</th>
                  <th className="py-2 px-3 font-semibold text-xs">Nama</th>
                  <th className="py-2 px-3 font-semibold text-xs">Unit / Lokasi</th>
                  <th className="py-2 px-3 font-semibold text-xs">Kontak</th>
                  <th className="py-2 px-3 font-semibold text-xs">Peran</th>
                  <th className="py-2 px-3 font-semibold text-xs">Status</th>
                  <th className="py-2 px-3 font-semibold text-xs text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredMembers.map((member: any) => (
                  <tr
                    key={member.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-1.5 px-3">
                      {isValidPhotoUrl(member.photo_path) ? (
                        <img
                          src={member.photo_path}
                          alt={member.full_name}
                          className="h-8 w-8 rounded-full object-cover"
                          onError={(e) => {
                            ;(e.target as HTMLImageElement).style.display = "none"
                          }}
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                          {member.full_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </td>
                    <td className="py-1.5 px-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-200">
                        {member.member_code}
                      </div>
                      <div className="text-[10px] text-slate-400">{member.nik}</div>
                    </td>
                    <td className="py-1.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                      {member.full_name}
                    </td>
                    <td className="py-1.5 px-3">
                      <span className="inline-flex items-center gap-1 text-[11px]">
                        <Building2 className="h-3 w-3 text-slate-400" />
                        {member.unit_name}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 space-y-0.5">
                      {member.phone && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <Phone className="h-3 w-3 text-slate-400" />
                          <span>{member.phone}</span>
                        </div>
                      )}
                      {member.email && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <Mail className="h-3 w-3 text-slate-400" />
                          <span className="truncate max-w-[150px]">{member.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-1.5 px-3">
                      <Badge
                        variant="outline"
                        className="text-[10px] py-0 px-1.5 capitalize font-normal border-slate-200 dark:border-slate-700"
                      >
                        {member.role}
                      </Badge>
                    </td>
                    <td className="py-1.5 px-3">
                      <Badge
                        variant={member.status === "active" ? "default" : "secondary"}
                        className="text-[10px] py-0 px-1.5 font-normal"
                      >
                        {member.status === "active" ? "Aktif" : member.status}
                      </Badge>
                    </td>
                    <td className="py-1.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <MemberForm
                          units={units}
                          memberToEdit={member}
                          trigger={
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 text-blue-600 border-blue-100 dark:border-slate-800 active:bg-blue-50"
                              title="Edit Anggota"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          }
                        />
                        {member.user_id && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 text-amber-600 border-amber-100 dark:border-slate-800 active:bg-amber-50"
                            onClick={() => handleResetPassword(member.user_id)}
                            disabled={loading === member.user_id}
                            title="Reset Password"
                          >
                            <Key className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 text-destructive border-red-100 dark:border-slate-800 active:bg-red-50"
                          onClick={() => handleDelete(member.id)}
                          title="Hapus Anggota"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View (under md) - High Density Polish */}
          <div className="block md:hidden space-y-2">
            {filteredMembers.map((member: any) => (
              <div
                key={member.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden"
              >
                {/* Header info */}
                <div className="flex items-start justify-between gap-2 p-3 pb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {isValidPhotoUrl(member.photo_path) ? (
                      <img
                        src={member.photo_path}
                        alt={member.full_name}
                        className="h-9 w-9 rounded-full object-cover shrink-0"
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).style.display = "none"
                        }}
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {member.full_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-900 dark:text-slate-50 truncate">
                        {member.full_name}
                      </p>
                      <p className="text-[11px] text-slate-400">{member.member_code} • NIK {member.nik}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge
                      variant={member.status === "active" ? "default" : "secondary"}
                      className="text-[10px] py-0 px-1"
                    >
                      {member.status === "active" ? "Aktif" : member.status}
                    </Badge>
                  </div>
                </div>

                {/* Body details */}
                <div className="px-3 pb-2 space-y-1 border-t border-slate-50 dark:border-slate-800/40 pt-1.5">
                  <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-500">
                    {member.unit_name && (
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3 w-3 shrink-0 text-slate-400" />
                        <span className="truncate">{member.unit_name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 justify-end">
                      <Badge variant="outline" className="text-[9px] py-0 px-1 capitalize h-4 font-normal">
                        {member.role}
                      </Badge>
                    </div>
                  </div>

                  {(member.phone || member.email) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-slate-500">
                      {member.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 shrink-0 text-slate-400" />
                          <span>{member.phone}</span>
                        </div>
                      )}
                      {member.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3 w-3 shrink-0 text-slate-400" />
                          <span className="truncate">{member.email}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions row */}
                <div className="flex items-center justify-end gap-1.5 px-3 py-2 border-t border-slate-50 dark:border-slate-800/40 bg-slate-50/50 dark:bg-slate-900/50">
                  <MemberForm
                    units={units}
                    memberToEdit={member}
                    trigger={
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-blue-600 border-slate-200 dark:border-slate-800 active:bg-blue-50"
                        title="Edit Anggota"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    }
                  />

                  {member.user_id && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-amber-600 border-slate-200 dark:border-slate-800 active:bg-amber-50"
                      onClick={() => handleResetPassword(member.user_id)}
                      disabled={loading === member.user_id}
                      title="Reset Password"
                    >
                      <Key className="h-4 w-4" />
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 text-destructive border-slate-200 dark:border-slate-800 active:bg-red-50"
                    onClick={() => handleDelete(member.id)}
                    title="Hapus Anggota"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          {pagination && pagination.pages > 1 && (
            <Pagination
              page={pagination.page}
              pages={pagination.pages}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      )}

      {/* ── Tab 2: Location Statistics (Statistik) ── */}
      {activeTab === "stats" && stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-300">
          {/* Card 1: Total Members */}
          <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-100/50 dark:border-indigo-900/30 shadow-sm">
            <div className="absolute right-4 top-4 bg-indigo-500/10 p-2 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Users className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Anggota</p>
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
              {stats.totalMembers}
            </h3>
            <div className="flex gap-2 mt-3 text-[10px]">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 font-semibold">
                {stats.activeMembers} Aktif
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-semibold">
                {stats.inactiveMembers} Non-aktif
              </span>
            </div>
          </div>

          {/* Card 2: Top Member Location */}
          <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-100/50 dark:border-emerald-900/30 shadow-sm">
            <div className="absolute right-4 top-4 bg-emerald-500/10 p-2 rounded-xl text-emerald-600 dark:text-emerald-400">
              <Building2 className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Lokasi Anggota Terbanyak
            </p>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-2 truncate pr-10">
              {stats.topLocationName}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
              Memiliki{" "}
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                {stats.topLocationCount}
              </span>{" "}
              anggota terdaftar
            </p>
          </div>

          {/* Card 3: Most Active Location */}
          <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-100/50 dark:border-amber-900/30 shadow-sm">
            <div className="absolute right-4 top-4 bg-amber-500/10 p-2 rounded-xl text-amber-600 dark:text-amber-400">
              <Activity className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Lokasi Paling Aktif
            </p>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-2 truncate pr-10">
              {stats.mostActiveLocationName}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
              Mencatat{" "}
              <span className="text-amber-600 dark:text-amber-400 font-bold">
                {stats.mostActiveLocationCount}
              </span>{" "}
              total aktivitas transaksi
            </p>
          </div>
        </div>
      )}

      {/* ── Tab 3: Recent Activity (Aktivitas) ── */}
      {activeTab === "activities" && stats && (
        <div className="space-y-4 max-w-xl animate-in fade-in duration-300">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-indigo-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Log Riwayat Transaksi Anggota
            </h2>
          </div>

          <div className="relative pl-4 border-l border-slate-150 dark:border-slate-800 space-y-4">
            {stats.recentActivities.map((act: any) => (
              <div key={act.id} className="relative">
                {/* Timeline Dot */}
                <div
                  className={cn(
                    "absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-950 shadow-sm",
                    act.type === "saving" ? "bg-emerald-500" : "bg-indigo-500"
                  )}
                />

                {/* Timeline Content Card */}
                <div className="bg-slate-50/50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100/50 dark:border-slate-800/40 space-y-1">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {act.memberName}
                      </p>
                      <p className="text-[10px] text-slate-400">{act.memberCode}</p>
                    </div>
                    <span
                      className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded-full font-semibold",
                        act.type === "saving"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                          : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400"
                      )}
                    >
                      {act.type === "saving" ? "Simpanan" : "Toko POS"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300">{act.description}</p>

                  <div className="flex justify-between items-center text-[10px] pt-1 border-t border-slate-100/30 dark:border-slate-800/20">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      Rp {new Intl.NumberFormat("id-ID").format(act.amount)}
                    </span>
                    <span className="text-slate-400">
                      {new Date(act.date).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {stats.recentActivities.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-xs">
                Belum ada riwayat aktivitas transaksi.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
