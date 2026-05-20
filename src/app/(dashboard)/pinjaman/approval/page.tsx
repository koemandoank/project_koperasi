import { getLoanApplications, getPendingLoanCount } from "@/lib/actions/loans"
import { ApprovalClient } from "./approval-client"
import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function LoanApprovalPage() {
  const session = await auth()
  const role = session?.user?.role || ""
  
  if (!["superadmin", "admin", "pengurus"].includes(role)) {
    redirect("/dashboard")
  }

  const applications = await getLoanApplications()
  const pendingCount = await getPendingLoanCount()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Approval Pengajuan Pinjaman</h1>
          <p className="text-muted-foreground">Review, setujui, atau tolak pengajuan pinjaman dari anggota.</p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="font-semibold">{pendingCount} pengajuan menunggu review</span>
          </div>
        )}
      </div>
      <ApprovalClient applications={applications} />
    </div>
  )
}
