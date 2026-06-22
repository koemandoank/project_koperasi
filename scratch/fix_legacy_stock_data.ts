import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("=== STARTING LEGACY STOCK DATA BACKFILL (OPTIMIZED HIGH-SPEED) ===")

  // 1. Repairing Purchase & Return movements (created_at is null)
  console.log("\n1. Repairing Purchase & Return movements (created_at is null)...")
  const nullMovements = await prisma.stock_movements.findMany({
    where: { created_at: null }
  })

  console.log(`Found ${nullMovements.length} movements with null timestamps.`)

  let repairedPurchases = 0
  for (const m of nullMovements) {
    let resolvedDate = new Date() // default fallback
    
    if (m.reference && m.reference.startsWith("GR-")) {
      const tsString = m.reference.replace("GR-", "")
      const ts = parseInt(tsString, 10)
      if (!isNaN(ts)) {
        resolvedDate = new Date(ts)
      }
    }

    await prisma.stock_movements.update({
      where: { id: m.id },
      data: {
        created_at: resolvedDate,
        updated_at: resolvedDate
      }
    })
    repairedPurchases++
  }
  console.log(`Successfully backfilled ${repairedPurchases} purchase/return movements.`)

  // 2. Backfill Sales Movements from Orders (In-Memory O(1) matching & Bulk Create)
  console.log("\n2. Checking and backfilling sales movements from historical orders...")
  
  // Cache all existing movements to prevent N+1 SELECT query problem
  const existingMovements = await prisma.stock_movements.findMany({
    where: { type: "out" },
    select: { product_id: true, reference: true }
  })
  
  const existingSet = new Set(
    existingMovements.map(em => `${Number(em.product_id)}_${em.reference}`)
  )
  console.log(`Cached ${existingSet.size} existing sales movements in memory.`)

  // Cache products stock
  const products = await prisma.products.findMany({
    select: { id: true, stock: true }
  })
  const productStockMap = new Map<number, number>()
  products.forEach(p => {
    productStockMap.set(Number(p.id), p.stock)
  })

  // Fetch all completed orders and items
  const orders = await prisma.orders.findMany({
    where: {
      order_status: {
        in: ["confirmed", "delivered"]
      }
    },
    include: {
      order_items: true
    }
  })

  console.log(`Found ${orders.length} completed (confirmed/delivered) orders in database.`)

  const newMovementsData: any[] = []
  
  for (const order of orders) {
    for (const item of order.order_items) {
      const pId = Number(item.product_id)
      const key = `${pId}_${order.order_no}`
      
      if (!existingSet.has(key)) {
        const currentStock = productStockMap.get(pId) ?? 0
        
        newMovementsData.push({
          product_id: item.product_id,
          type: "out",
          qty: item.qty,
          stock_before: currentStock,
          stock_after: currentStock, // Historical placeholder
          reference: order.order_no,
          note: "Backfill Penjualan POS Lama",
          created_by: order.cashier_id,
          created_at: order.ordered_at || new Date(),
          updated_at: order.ordered_at || new Date()
        })
      }
    }
  }

  console.log(`Calculated ${newMovementsData.length} missing sales movements to backfill.`)

  if (newMovementsData.length > 0) {
    // Bulk insert with createMany (highly efficient, 1 single database write)
    const result = await prisma.stock_movements.createMany({
      data: newMovementsData,
      skipDuplicates: true
    })
    console.log(`Successfully bulk created ${result.count} stock movements in 1 database roundtrip!`)
  } else {
    console.log("No missing sales movements found. Backfill up-to-date!")
  }

  console.log("\n=== BACKFILL COMPLETE ===")
}

main()
  .catch(e => {
    console.error("Backfill failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
