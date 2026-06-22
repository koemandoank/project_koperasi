import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("=========================================================================")
  console.log("             DATABASE REPAIR & HEALING SYSTEM STARTING                  ")
  console.log("=========================================================================\n")

  // --- 1. HEALING STORE STOCK DESYNC (GLOBAL VS LOCATION) ---
  console.log("--- 1. HEALING: STOCK DESYNC DISCREPANCIES ---")
  const products = await prisma.products.findMany({
    where: { deleted_at: null },
    include: {
      stock_balances: true,
      units: true
    }
  })

  let stockHealedCount = 0
  for (const product of products) {
    const globalStock = product.stock
    const stockBalances = product.stock_balances
    
    if (stockBalances.length === 0) {
      // Product has no stock balances, we need to create one to represent its global stock
      console.log(`[Action] Product SKU: ${product.sku} has no location registered in stock_balances.`)
      // Find first warehouse location in the product's unit
      const location = await prisma.warehouse_locations.findFirst({
        where: { unit_id: product.unit_id, is_active: true }
      })
      
      if (location) {
        console.log(`  -> Creating default stock balance at location "${location.location_name}" (ID ${location.id}) with qty: ${globalStock}`)
        await prisma.stock_balances.create({
          data: {
            product_id: product.id,
            location_id: location.id,
            qty_on_hand: globalStock,
            qty_reserved: 0,
            qty_available: globalStock
          }
        })
        stockHealedCount++
      } else {
        console.log(`  -> ⚠️ ERROR: No warehouse location found for unit ID ${product.unit_id}. Cannot create default stock balance.`)
      }
    } else {
      // Product has stock balances, but let's check if the sum matches global stock
      const sumLocationStock = stockBalances.reduce((sum, bal) => sum + bal.qty_on_hand, 0)
      if (globalStock !== sumLocationStock) {
        console.log(`[Action] Stock mismatch on SKU: ${product.sku} | Name: ${product.name}`)
        console.log(`  - Fixing Global Stock (products.stock) from ${globalStock} to match sum of locations: ${sumLocationStock}`)
        
        await prisma.products.update({
          where: { id: product.id },
          data: { stock: sumLocationStock }
        })
        stockHealedCount++
      }
    }
  }
  console.log(`✅ SUCCESS: Healed/Synced ${stockHealedCount} product stock records!\n`)


  // --- 2. HEALING PAID ORDERS VS RECONCILED PAYMENTS ---
  console.log("--- 2. HEALING: MISSING ORDER PAYMENT ENTRIES ---")
  const paidOrders = await prisma.orders.findMany({
    where: { payment_status: "paid" },
    include: { order_payments: true }
  })

  // Map orders.payment_method to order_payments.payment_method enum
  const methodMap: Record<string, any> = {
    cash: "cash",
    qris: "qris",
    transfer: "transfer",
    saving_deduct: "other",
    paylater: "other"
  }

  let paymentsHealedCount = 0
  for (const order of paidOrders) {
    const grandTotal = Number(order.grand_total)
    const paymentSum = order.order_payments.reduce((sum, pay) => sum + Number(pay.amount), 0)
    
    if (Math.abs(grandTotal - paymentSum) > 0.01) {
      // Clear any partial/mismatched payments for this order first to prevent duplicate keys or clutter
      if (order.order_payments.length > 0) {
        await prisma.order_payments.deleteMany({
          where: { order_id: order.id }
        })
      }
      
      const mappedMethod = methodMap[order.payment_method] || "other"
      const payDate = order.paid_at ?? order.ordered_at ?? new Date()
      
      // Create a fully matching payment record
      await prisma.order_payments.create({
        data: {
          order_id: order.id,
          payment_method: mappedMethod,
          amount: grandTotal,
          reference_no: order.order_no,
          payment_status: "captured",
          paid_at: payDate,
          created_at: payDate,
          updated_at: payDate
        }
      })
      paymentsHealedCount++
    }
  }
  console.log(`✅ SUCCESS: Created/Synced ${paymentsHealedCount} order payment records!\n`)

  console.log("=========================================================================")
  console.log("             DATABASE REPAIR & HEALING COMPLETE!                        ")
  console.log("=========================================================================")
}

main()
  .catch(err => {
    console.error("Database healing failed:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
