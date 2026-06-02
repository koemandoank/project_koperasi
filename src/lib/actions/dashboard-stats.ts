"use server"

import { prisma } from "@/lib/db/prisma"
import { remember } from "@/lib/cache"

// Role 1: ADMINISTRATOR / PENGURUS
export async function getAdminStats() {
  return remember("stats:admin", 300, async () => {
    try {
    const totalMembers = await prisma.member.count()
    const activeMembers = await prisma.member.count({ where: { status: "active" } })
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    
    const newMembersThisMonth = await prisma.member.count({
      where: { created_at: { gte: firstDayOfMonth } }
    })

    // Asset Liquidity: sum of accounts with type asset
    const cashBankAccounts = await prisma.chart_of_accounts.findMany({
      where: { type: "asset" }
    })
    
    // For simplicity, we calculate the balance of all assets based on journal lines
    // Debit increases asset, credit decreases
    const assetAccountIds = cashBankAccounts.map((a: any) => a.id)
    const journalLines = await prisma.journal_lines.aggregate({
      _sum: {
        debit: true,
        credit: true
      },
      where: {
        account_id: { in: assetAccountIds },
        journal_entries: { is_posted: true }
      }
    })
    
    const assetLiquidity = Number(journalLines._sum.debit || 0) - Number(journalLines._sum.credit || 0)

    // Pending Approvals
    const pendingLoans = await prisma.loan_applications.count({
      where: { status: { in: ["pending", "under_review"] } }
    })
    const pendingStockAdjustments = await prisma.stock_transfer_orders.count({
      where: { status: "pending" }
    })
    
    // Laba/Rugi berjalan
    const revenues = await prisma.journal_lines.aggregate({
      _sum: { credit: true, debit: true },
      where: {
        chart_of_accounts: { type: "revenue" },
        journal_entries: { is_posted: true, entry_date: { gte: new Date(now.getFullYear(), 0, 1) } }
      }
    })
    
    const expenses = await prisma.journal_lines.aggregate({
      _sum: { debit: true, credit: true },
      where: {
        chart_of_accounts: { type: "expense" },
        journal_entries: { is_posted: true, entry_date: { gte: new Date(now.getFullYear(), 0, 1) } }
      }
    })
    
    const totalRevenue = Number(revenues._sum.credit || 0) - Number(revenues._sum.debit || 0)
    const totalExpense = Number(expenses._sum.debit || 0) - Number(expenses._sum.credit || 0)
    const currentSHU = totalRevenue - totalExpense

    // Laba/Rugi 5 tahun terakhir for Chart
    const shuHistory = await prisma.shu_periods.findMany({
      orderBy: { period_year: 'desc' },
      take: 5
    })

    // Restock alerts from cashier
    const restockAlerts = await prisma.products.findMany({
      where: { restock_requested: true, is_active: true },
      select: { id: true, name: true, sku: true, stock: true, min_stock: true }
    })

    return {
      memberStats: {
        total: totalMembers,
        active: activeMembers,
        newThisMonth: newMembersThisMonth
      },
      assetLiquidity,
      pendingApprovals: {
        loans: pendingLoans,
        stockAdjustments: pendingStockAdjustments,
        total: pendingLoans + pendingStockAdjustments
      },
      currentSHU,
      shuHistory: shuHistory.map((s: any) => ({
        name: s.period_year.toString(),
        amount: Number(s.total_shu)
      })).reverse(),
      restockAlerts: restockAlerts.map((p: any) => ({ ...p, id: Number(p.id) }))
    }
    } catch (error) {
      console.error("getAdminStats error:", error)
      return null
    }
  })
}

// Role 2: ADMIN KREDIT
export async function getKreditStats() {
  return remember("stats:kredit", 300, async () => {
    try {
    const activeLoans = await prisma.loans.aggregate({
      _sum: { outstanding_principal: true },
      where: { status: "active" }
    })
    
    const today = new Date()
    today.setHours(0,0,0,0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const nplLoans = await prisma.loan_schedules.aggregate({
      _sum: { total_due: true, principal_paid: true, interest_paid: true, penalty_paid: true },
      where: { 
        due_date: { lt: today },
        status: { in: ["pending", "partial"] }
      }
    })
    
    const todayCollections = await prisma.loan_schedules.findMany({
      where: {
        due_date: { gte: today, lt: tomorrow },
        status: { in: ["pending", "partial"] }
      },
      include: { loans: { include: { members: true } } }
    })
    
    const pendingApplications = await prisma.loan_applications.count({
      where: { status: { in: ["pending", "under_review"] } }
    })
    
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const savingsGrowth = await prisma.saving_transactions.aggregate({
      _sum: { amount: true },
      where: { type: "deposit", transaction_at: { gte: firstDayOfMonth } }
    })

    const nplAmount = Number(nplLoans._sum.total_due || 0) - (Number(nplLoans._sum.principal_paid || 0) + Number(nplLoans._sum.interest_paid || 0) + Number(nplLoans._sum.penalty_paid || 0))

    return {
      loanOutstanding: Number(activeLoans._sum.outstanding_principal || 0),
      nplAmount,
      todayCollectionTotal: todayCollections.reduce((acc: any, curr: any) => acc + (Number(curr.total_due) - (Number(curr.principal_paid) + Number(curr.interest_paid) + Number(curr.penalty_paid))), 0),
      todayCollectionsCount: todayCollections.length,
      pendingApplications,
      savingsGrowth: Number(savingsGrowth._sum.amount || 0)
    }
    } catch (error) {
      console.error("getKreditStats error:", error)
      return null
    }
  })
}

// Role 3: KASIR / ADMIN TOKO
export async function getKasirStats() {
  return remember("stats:kasir", 60, async () => {
    try {
    const today = new Date()
    today.setHours(0,0,0,0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const dailySales = await prisma.orders.aggregate({
      _sum: { grand_total: true },
      _count: { id: true },
      where: { 
        ordered_at: { gte: today, lt: tomorrow },
        order_status: { notIn: ["cancelled"] }
      }
    })
    
    const cashierBalance = await prisma.orders.aggregate({
      _sum: { grand_total: true },
      where: { 
        ordered_at: { gte: today, lt: tomorrow },
        payment_method: "cash",
        payment_status: "paid"
      }
    })
    
    const inventoryAlertsRaw = await prisma.$queryRaw`
      SELECT p.id, p.name, p.sku, p.stock, p.min_stock, p.restock_requested 
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE p.stock <= p.min_stock 
        AND p.is_active = true 
        AND (c.slug IS NULL OR c.slug != 'konsinyasi')
    `
    const inventoryAlerts = inventoryAlertsRaw.length
    const lowStockIds = inventoryAlertsRaw.map((p: any) => BigInt(p.id))
    
    // Cari status PO aktif untuk produk-produk ini
    const activePOs = await prisma.purchase_orders.findMany({
      where: {
        status: { in: ['draft', 'submitted', 'approved', 'partial_received'] as const },
        po_items: { some: { product_id: { in: lowStockIds } } }
      },
      include: { po_items: true },
      orderBy: { created_at: 'desc' }
    })

    const poStatusMap: Record<number, string> = {}
    for (const po of activePOs) {
      for (const item of po.po_items) {
        // Karena orderBy desc, yang pertama diset adalah PO terbaru
        if (!poStatusMap[Number(item.product_id)]) {
          poStatusMap[Number(item.product_id)] = po.status
        }
      }
    }

    const lowStockItems = inventoryAlertsRaw.map((p: any) => ({
      id: Number(p.id),
      name: p.name,
      sku: p.sku,
      stock: p.stock,
      min_stock: p.min_stock,
      restock_requested: Boolean(p.restock_requested),
      po_status: poStatusMap[Number(p.id)] || null
    }))

    
    const voidRefundLogs = await prisma.orders.count({
      where: {
        ordered_at: { gte: today, lt: tomorrow },
        OR: [
          { order_status: "cancelled" },
          { payment_status: "refunded" }
        ]
      }
    })
    
    // Top 5 products sold today
    const topProducts = await prisma.order_items.groupBy({
      by: ['product_id', 'product_name'],
      _sum: { qty: true, subtotal: true },
      where: {
        orders: {
          ordered_at: { gte: today, lt: tomorrow },
          order_status: { notIn: ["cancelled"] }
        }
      },
      orderBy: { _sum: { qty: 'desc' } },
      take: 5
    })

    return {
      dailySales: Number(dailySales._sum.grand_total || 0),
      transactionsCount: dailySales._count.id,
      cashierBalance: Number(cashierBalance._sum.grand_total || 0),
      inventoryAlerts,
      lowStockItems,
      voidRefundLogs,
      topProducts: topProducts.map((p: any) => ({
        name: p.product_name,
        qty: p._sum.qty || 0,
        revenue: Number(p._sum.subtotal || 0)
      }))
    }
    } catch (error) {
      console.error("getKasirStats error:", error)
      return null
    }
  })
}
