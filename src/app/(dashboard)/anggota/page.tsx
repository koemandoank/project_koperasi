import { getMembers, getUnits, getMemberStats } from "@/lib/actions/members"
import { MemberTable } from "./member-table"
import { MemberForm } from "./member-form"

export default async function AnggotaPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || "1"))
  const pageSize = 25

  const result = await getMembers(page, pageSize)
  const units = await getUnits()
  const stats = await getMemberStats()

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manajemen Anggota</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Kelola data anggota dan akses pengguna koperasi.
          </p>
        </div>
        <MemberForm units={units} />
      </div>
      
      <MemberTable 
        members={result.data} 
        units={units} 
        stats={stats} 
        pagination={result.pagination}
      />
    </div>
  )
}
