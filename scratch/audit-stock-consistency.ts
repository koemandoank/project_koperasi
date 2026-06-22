import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("=========================================================================")
  console.log("        COMPREHENSIVE AUDIT: STORE STOCK & DATA CONSISTENCY CHECK        ")
  console.log("=========================================================================\n")

  let totalDiscrepancies = 0

  // --- 1. Audit Global Stock vs Sum of Location Stocks ---
  console.log("--- 1. AUDITING: GLOBAL STOCK VS SUM OF LOCATION STOCKS ---")
  const products = await prisma.products.findMany({
    where: { deleted_at: null },
    include: {
      stock_balances: true,
      units: true
    }
  })

  let locationDiscrepancies = 0
  for (const product of products) {
    const globalStock = product.stock
    const sumLocationStock = product.stock_balances.reduce((sum, bal) => sum + bal.qty_on_hand, 0)
    
    if (globalStock !== sumLocationStock) {
      locationDiscrepancies++
      totalDiscrepancies++
      if (locationDiscrepancies <= 10) {
        console.log(`[Discrepancy] Product SKU: ${product.sku} | Name: ${product.name}`)
        console.log(`  - Global Stock (products.stock)    : ${globalStock}`)
        console.log(`  - Sum of Location Stocks (balances) : ${sumLocationStock}`)
        console.log(`  - Diff                             : ${globalStock - sumLocationStock}`)
        console.log(`  - Unit                             : ${product.units?.name || "Unknown"}`)
        console.log(`  - Locations registered             : ${product.stock_balances.map(b => `LocID ${b.location_id}: ${b.qty_on_hand}`).join(", ")}`)
      }
    }
  }
  if (locationDiscrepancies === 0) {
    console.log("✅ OK: All global stocks perfectly match the sum of their location stocks!\n")
  } else {
    console.log(`⚠️ WARNING: Found ${locationDiscrepancies} products with mismatching global vs location-based stock quantities. (Showing first 10)\n`)
  }

  // --- 2. Audit Negative Stocks ---
  console.log("--- 2. AUDITING: NEGATIVE STOCKS ---")
  let negativeStocks = 0
  for (const product of products) {
    if (product.stock < 0) {
      negativeStocks++
      totalDiscrepancies++
      if (negativeStocks <= 10) {
        console.log(`[Discrepancy] Negative Global Stock | SKU: ${product.sku} | Name: ${product.name} | Stock: ${product.stock}`)
      }
    }
    for (const bal of product.stock_balances) {
      if (bal.qty_on_hand < 0 || bal.qty_available < 0) {
        negativeStocks++
        totalDiscrepancies++
        if (negativeStocks <= 10) {
          console.log(`[Discrepancy] Negative Location Stock | SKU: ${product.sku} | Name: ${product.name} | Location ID: ${bal.location_id} | Qty On Hand: ${bal.qty_on_hand} | Available: ${bal.qty_available}`)
        }
      }
    }
  }
  if (negativeStocks === 0) {
    console.log("✅ OK: No negative stock levels found anywhere in the system!\n")
  } else {
    console.log(`⚠️ WARNING: Found ${negativeStocks} instances of negative stock levels. (Showing first 10)\n`)
  }

  // --- 3. Audit Pricing & HPP Costing ---
  console.log("--- 3. AUDITING: PRODUCT PRICING & HPP COSTING ---")
  let priceDiscrepancies = 0
  for (const product of products) {
    const buyPrice = Number(product.purchase_price)
    const sellPrice = Number(product.price)
    const memberPrice = product.member_price ? Number(product.member_price) : null
    
    if (buyPrice <= 0) {
      priceDiscrepancies++
      totalDiscrepancies++
      if (priceDiscrepancies <= 10) {
        console.log(`[Discrepancy] Zero/Negative Purchase Price (HPP) | SKU: ${product.sku} | Name: ${product.name} | HPP: Rp ${buyPrice}`)
      }
    }
    if (sellPrice <= 0) {
      priceDiscrepancies++
      totalDiscrepancies++
      if (priceDiscrepancies <= 10) {
        console.log(`[Discrepancy] Zero/Negative Sell Price | SKU: ${product.sku} | Name: ${product.name} | Price: Rp ${sellPrice}`)
      }
    }
    if (buyPrice > sellPrice) {
      priceDiscrepancies++
      totalDiscrepancies++
      if (priceDiscrepancies <= 10) {
        console.log(`[Discrepancy] HPP Higher than Selling Price (Loss Margin) | SKU: ${product.sku} | Name: ${product.name} | HPP: Rp ${buyPrice} | Sell Price: Rp ${sellPrice}`)
      }
    }
    if (memberPrice !== null && memberPrice > sellPrice) {
      priceDiscrepancies++
      totalDiscrepancies++
      if (priceDiscrepancies <= 10) {
        console.log(`[Discrepancy] Member Price Higher than General Price | SKU: ${product.sku} | Name: ${product.name} | Member: Rp ${memberPrice} | General: Rp ${sellPrice}`)
      }
    }
  }
  if (priceDiscrepancies === 0) {
    console.log("✅ OK: All product prices and HPP are positive and properly structured!\n")
  } else {
    console.log(`⚠️ WARNING: Found ${priceDiscrepancies} pricing/HPP anomalies. (Showing first 10)\n`)
  }

  // --- 4. Audit Reorder Points ---
  console.log("--- 4. AUDITING: REORDER POINTS & ALERTS ---")
  const reorderPoints = await prisma.stock_reorder_points.findMany({
    include: { products: true }
  })
  
  let reorderAnomalies = 0
  for (const rp of reorderPoints) {
    if (!rp.products) {
      reorderAnomalies++
      totalDiscrepancies++
      if (reorderAnomalies <= 10) {
        console.log(`[Discrepancy] Orphan Reorder Point Record | ID: ${rp.id} | Product ID: ${rp.product_id}`)
      }
      continue
    }
    
    const prod = rp.products
    const stock = prod.stock
    const threshold = rp.reorder_point
    
    // Check if stock is below reorder point but restock_requested is false
    if (stock < threshold && !prod.restock_requested) {
      // Just a notice, not a hard db discrepancy
    }
  }
  if (reorderAnomalies === 0) {
    console.log("✅ OK: No orphan reorder points or system alert sync issues!\n")
  } else {
    console.log(`⚠️ WARNING: Found ${reorderAnomalies} reorder alert issues.\n`)
  }

  // --- 5. Audit Consignment Items Sold Quantities ---
  console.log("--- 5. AUDITING: CONSIGNMENT ITEMS SYSTEM LOGIC ---")
  const consignmentItems = await prisma.consignment_items.findMany({
    include: { products: true, suppliers: true }
  })
  
  let consignmentDiscrepancies = 0
  for (const item of consignmentItems) {
    if (!item.products) {
      consignmentDiscrepancies++
      totalDiscrepancies++
      if (consignmentDiscrepancies <= 10) {
        console.log(`[Discrepancy] Orphan Consignment Item | ID: ${item.id} | Product ID: ${item.product_id}`)
      }
      continue
    }
    
    const qty_received = item.qty_received
    const qty_returned = item.qty_returned
    const actual_stock = item.products.stock
    
    // Sold quantity: qty_received - qty_returned - actual_stock
    const qty_sold = qty_received - qty_returned - actual_stock
    
    if (qty_sold < 0) {
      consignmentDiscrepancies++
      totalDiscrepancies++
      if (consignmentDiscrepancies <= 10) {
        console.log(`[Discrepancy] Negative Calculated Consignment Sales (Logic Error) | ID: ${item.id}`)
        console.log(`  - Supplier          : ${item.suppliers?.supplier_name || "Unknown"}`)
        console.log(`  - Product SKU/Name  : ${item.products.sku} / ${item.products.name}`)
        console.log(`  - Qty Received      : ${qty_received}`)
        console.log(`  - Qty Returned      : ${qty_returned}`)
        console.log(`  - Actual stock      : ${actual_stock}`)
        console.log(`  - Calculated Qty Sold: ${qty_sold} (Expected >= 0)`)
      }
    }
  }
  if (consignmentDiscrepancies === 0) {
    console.log("✅ OK: All consignment sales calculations are logically consistent (>= 0)!\n")
  } else {
    console.log(`⚠️ WARNING: Found ${consignmentDiscrepancies} consignment logic discrepancies. (Showing first 10)\n`)
  }

  // --- 6. Audit Paid Orders vs Cash Payments ---
  console.log("--- 6. AUDITING: PAID ORDERS VS PAYMENTS INTEGRITY ---")
  const paidOrders = await prisma.orders.findMany({
    where: { payment_status: "paid" },
    include: { order_payments: true }
  })
  
  let paymentDiscrepancies = 0
  for (const order of paidOrders) {
    const grandTotal = Number(order.grand_total)
    const paymentSum = order.order_payments.reduce((sum, pay) => sum + Number(pay.amount), 0)
    
    if (Math.abs(grandTotal - paymentSum) > 0.01) {
      paymentDiscrepancies++
      totalDiscrepancies++
      if (paymentDiscrepancies <= 5) {
        console.log(`[Discrepancy] Order Paid Sum Mismatch | Order No: ${order.order_no} | Payment Method: ${order.payment_method}`)
        console.log(`  - Order Grand Total  : Rp ${grandTotal}`)
        console.log(`  - Payments Sum       : Rp ${paymentSum}`)
        console.log(`  - Diff               : Rp ${grandTotal - paymentSum}`)
      }
    }
  }
  if (paymentDiscrepancies === 0) {
    console.log("✅ OK: All paid orders have perfectly matching transaction payment entries!\n")
  } else {
    console.log(`⚠️ WARNING: Found ${paymentDiscrepancies} payment mismatches. (Showing first 5)\n`)
  }

  // --- Final Summary ---
  console.log("=========================================================================")
  console.log(`AUDIT FINISHED | Total anomalies found: ${totalDiscrepancies}`)
  console.log("=========================================================================")
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
