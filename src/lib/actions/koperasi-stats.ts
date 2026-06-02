"use server"

import { prisma } from "@/lib/db/prisma"
import { remember } from "@/lib/cache"

export async function getKoperasiStats() {
  return remember("stats:koperasi", 600, async () => {
    try {
      const activeMembers = await prisma.member.count({ where: { status: "active" } })
      const inactiveMembers = await prisma.member.count({ where: { status: "inactive" } }) // Pensiun/Keluar
      const suspendedMembers = await prisma.member.count({ where: { status: "suspended" } }) // Mengundurkan diri / dibekukan
      const totalMembers = await prisma.member.count()

      // Hitung history simpanan/pinjaman (contoh sederhana)
      // Untuk production bisa di-query per hari/minggu/bulan
      const now = new Date()
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      
      const monthlySavings = await prisma.saving_transactions.aggregate({
        _sum: { amount: true },
        where: { transaction_at: { gte: firstDayOfMonth }, type: 'deposit' }
      })

      return {
        members: {
          active: activeMembers,
          inactive: inactiveMembers,
          suspended: suspendedMembers,
          total: totalMembers,
        },
        monthlySavings: Number(monthlySavings._sum.amount || 0)
      }
    } catch (error) {
      console.error("getKoperasiStats error:", error)
      return null
    }
  })
}
