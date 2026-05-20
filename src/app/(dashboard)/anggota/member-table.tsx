"use client"

/**
 * MemberTable — Mobile-First Card List
 *
 * Replaces the desktop <Table> with a card-based list optimized for touch.
 * All business logic (state, handlers, Server Actions) is preserved.
 *
 * @param members - List of member objects from server
 * @param units - List of unit objects for the edit form
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, Key, Edit, Trash2, Phone, Mail, Building2 } from "lucide-react"
import { resetMemberPassword, deleteMember } from "@/lib/actions/members"
import { toast } from "sonner"
import { MemberForm } from "./member-form"
import { cn } from "@/lib/utils"

export function MemberTable({ members, units }: { members: any[], units: any[] }) {
  const [loading, setLoading] = useState<number | null>(null)
  const [search, setSearch] = useState("")

  const filteredMembers = members.filter(m =>
    m.full_name.toLowerCase().includes(search.toLowerCase()) ||
    m.nik.includes(search)
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
      {/* ── Search Bar ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Cari NIK atau Nama Anggota..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-12 text-base"
        />
      </div>

      {/* ── Empty State ── */}
      {filteredMembers.length === 0 && (
        <div className="py-12 text-center text-slate-400 text-sm">
          Tidak ada data anggota ditemukan.
        </div>
      )}

      {/* ── Card List ── */}
      <div className="space-y-3">
        {filteredMembers.map((member) => (
          <div
            key={member.id}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden"
          >
            {/* Card Header */}
            <div className="flex items-start justify-between gap-3 p-4 pb-3">
              {/* Avatar + Name */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-11 w-11 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-base shrink-0">
                  {member.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-base text-slate-900 dark:text-slate-50 truncate">
                    {member.full_name}
                  </p>
                  <p className="text-sm text-slate-400">NIK: {member.nik}</p>
                </div>
              </div>

              {/* Status + Role badges */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Badge
                  variant={member.status === "active" ? "default" : "secondary"}
                  className="text-xs"
                >
                  {member.status === "active" ? "Aktif" : member.status}
                </Badge>
                <Badge variant="outline" className="text-xs capitalize">
                  {member.role}
                </Badge>
              </div>
            </div>

            {/* Card Body */}
            <div className="px-4 pb-3 space-y-1.5 border-t border-slate-50 dark:border-slate-800 pt-2">
              {member.unit_name && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span>{member.unit_name}</span>
                </div>
              )}
              {member.phone && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span>{member.phone}</span>
                </div>
              )}
              {member.email && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{member.email}</span>
                </div>
              )}
            </div>

            {/* Card Actions */}
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              {/* Edit */}
              <MemberForm
                units={units}
                memberToEdit={member}
                trigger={
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 text-blue-600 border-blue-100 active:bg-blue-50"
                    title="Edit Anggota"
                  >
                    <Edit className="h-5 w-5" />
                  </Button>
                }
              />

              {/* Reset Password */}
              {member.user_id && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 text-amber-600 border-amber-100 active:bg-amber-50"
                  onClick={() => handleResetPassword(member.user_id)}
                  disabled={loading === member.user_id}
                  title="Reset Password"
                >
                  <Key className="h-5 w-5" />
                </Button>
              )}

              {/* Delete */}
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 text-destructive border-red-100 active:bg-red-50"
                onClick={() => handleDelete(member.id)}
                title="Hapus Anggota"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
