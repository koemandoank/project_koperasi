import { getMembers, getUnits, getMemberStats } from "@/lib/actions/members"
import { MemberTable } from "./member-table"
import { MemberForm } from "./member-form"

export default async function AnggotaPage() {
  const members = await getMembers()
  const units = await getUnits()
  const stats = await getMemberStats()

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manajemen Anggota</h1>
          <p className="text-muted-foreground">Kelola data anggota dan akses pengguna koperasi.</p>
        </div>
        <MemberForm units={units} />
      </div>
      
      <MemberTable members={members} units={units} stats={stats} />
    </div>
  )
}
