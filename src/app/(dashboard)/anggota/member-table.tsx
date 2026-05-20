"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { MoreHorizontal, Key, Edit, Trash2, Search } from "lucide-react"
import { resetMemberPassword, deleteMember } from "@/lib/actions/members"
import { toast } from "sonner"
import { MemberForm } from "./member-form"

export function MemberTable({ members, units }: { members: any[], units: any[] }) {
  const [loading, setLoading] = useState<number | null>(null)
  const [search, setSearch] = useState("")

  const filteredMembers = members.filter(m => 
    m.full_name.toLowerCase().includes(search.toLowerCase()) || 
    m.nik.includes(search)
  )

  const handleResetPassword = async (userId: number | null) => {
    if (!userId) return toast.error("Anggota belum memiliki akun")
    
    const input = window.prompt("Masukkan password baru untuk anggota ini.\nKosongkan lalu klik OK untuk menggunakan password default: K0pmember01")
    
    if (input === null) return; // User clicked Cancel
    
    const customPassword = input.trim();
    
    setLoading(userId)
    const res = await resetMemberPassword(userId, customPassword || undefined)
    if (res.success) toast.success(res.message)
    else toast.error(res.error)
    setLoading(null)
  }

  const handleDelete = async (memberId: number) => {
    if (confirm("Yakin ingin menghapus anggota ini? Data transaksi mungkin mencegah penghapusan.")) {
      const res = await deleteMember(memberId)
      if (res.success) toast.success("Anggota berhasil dihapus")
      else toast.error(res.error)
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative w-full md:w-1/3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Cari NIK atau Nama Anggota..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      
      <div className="border rounded-md bg-card">
        <Table>
        <TableHeader>
          <TableRow>
            <TableHead>No. Anggota</TableHead>
            <TableHead>Nama Lengkap</TableHead>
            <TableHead>Kontak</TableHead>
            <TableHead>Unit / Dept</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Role Akses</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredMembers.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                Tidak ada data anggota.
              </TableCell>
            </TableRow>
          )}
          {filteredMembers.map((member) => (
            <TableRow key={member.id}>
              <TableCell className="font-medium">{member.member_code}</TableCell>
              <TableCell>
                <div>{member.full_name}</div>
                <div className="text-xs text-muted-foreground">NIK: {member.nik}</div>
              </TableCell>
              <TableCell>
                <div>{member.phone || "-"}</div>
                <div className="text-xs text-muted-foreground">{member.email || "-"}</div>
              </TableCell>
              <TableCell>{member.unit_name}</TableCell>
              <TableCell>
                <Badge variant={member.status === "active" ? "default" : "secondary"}>
                  {member.status}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {member.role}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <MemberForm 
                    units={units} 
                    memberToEdit={member} 
                    trigger={
                      <Button variant="outline" size="icon" className="h-8 w-8 text-blue-600">
                        <Edit className="h-4 w-4" />
                      </Button>
                    } 
                  />
                  {member.user_id && (
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-8 w-8 text-amber-600"
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
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(member.id)}
                    title="Hapus"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </div>
  )
}
