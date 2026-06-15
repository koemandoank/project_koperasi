"use server"

import { prisma } from "@/lib/db/prisma"
import { auth } from "@/auth"
import { checkRole } from "@/lib/auth-helpers"

export async function getAdminSimpananData() {
  try {
    const session = await auth()
    if (!session?.user?.id) return null
    checkRole(session, ["superadmin", "admin", "pengurus", "petugas_akuntan", "pengawas"])
    const totalBalance = await prisma.savings.aggregate({
      _sum: { balance: true }
    })

    const activeMembers = await prisma.member.count({
      where: { status: "active" }
    })

    const recentTransactions = await prisma.saving_transactions.findMany({
      orderBy: { transaction_at: "desc" },
      take: 15,
      include: {
        savings: {
          include: {
            saving_types: true,
            members: {
              select: { full_name: true, member_code: true }
            }
          }
        }
      }
    })

    const groupedSavings = await prisma.savings.groupBy({
      by: ['saving_type_id'],
      _sum: { balance: true }
    })

    const types = await prisma.saving_types.findMany()

    return {
      totalBalance: Number(totalBalance._sum.balance || 0),
      activeMembers,
      recentTransactions: recentTransactions.map((t: any) => ({
        id: Number(t.id),
        member_name: t.savings?.members?.full_name || "-",
        member_code: t.savings?.members?.member_code || "-",
        type: t.type, // deposit, withdrawal, interest
        amount: Number(t.amount),
        balance_after: Number(t.balance_after),
        transaction_at: t.transaction_at.toISOString(),
        saving_type: t.savings?.saving_types?.name || "-"
      })),
      groupedSavings: groupedSavings.map((g: any) => ({
        type_name: types.find((t: any) => t.id === g.saving_type_id)?.name || "Lainnya",
        total: Number(g._sum.balance || 0)
      }))
    }
  } catch (error) {
    console.error("getAdminSimpananData error:", error)
    return null
  }
}
