import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("=== GENERATING MEI 2026 DEMO STOK DATA ===")

  // Fetch some products to work with
  const products = await prisma.products.findMany({
    take: 30,
    orderBy: { id: "asc" }
  })

  if (products.length === 0) {
    console.log("No products found in DB. Cannot generate demo data.")
    return
  }

  console.log(`Loaded ${products.length} products for demo data generation.`)

  const user = await prisma.user.findFirst()
  const userId = user ? user.id : BigInt(1)
  
  const warehouse = await prisma.warehouse_locations.findFirst({
    where: { is_active: true }
  })
  const locationId = warehouse ? warehouse.id : null

  // 1. Generate Pembelian (type: 'in') - 15 movements distributed in May 2026
  console.log("\n1. Generating Demo Pembelian (type: 'in')...")
  let inCreated = 0
  for (let i = 0; i < 15; i++) {
    const product = products[i % products.length]
    const qty = Math.floor(Math.random() * 80) + 20 // 20 - 100
    const day = Math.floor(Math.random() * 20) + 1 // 1 - 20 May
    const date = new Date(`2026-05-${String(day).padStart(2, '0')}T10:00:00Z`)
    
    await prisma.stock_movements.create({
      data: {
        product_id: product.id,
        type: "in",
        qty: qty,
        stock_before: product.stock,
        stock_after: product.stock + qty,
        reference: `GR-DEMO-202605${String(day).padStart(2, '0')}`,
        note: "Penerimaan Barang Demo",
        created_by: userId,
        created_at: date,
        updated_at: date
      }
    })
    inCreated++
  }
  console.log(`Successfully created ${inCreated} purchase movements.`)

  // 2. Generate Qty Retur (type: 'return') - 5 movements in May 2026
  console.log("\n2. Generating Demo Qty Retur (type: 'return')...")
  let returnCreated = 0
  for (let i = 0; i < 5; i++) {
    const product = products[(i + 7) % products.length]
    const qty = Math.floor(Math.random() * 4) + 1 // 1 - 4
    const day = Math.floor(Math.random() * 20) + 1 // 1 - 20 May
    const date = new Date(`2026-05-${String(day).padStart(2, '0')}T14:30:00Z`)
    
    await prisma.stock_movements.create({
      data: {
        product_id: product.id,
        type: "return",
        qty: qty,
        stock_before: product.stock,
        stock_after: product.stock, // Return to supplier doesn't change current shop stock in this design
        reference: `RT-DEMO-202605${String(day).padStart(2, '0')}`,
        note: "Retur Demo Barang Rusak ke Supplier",
        created_by: userId,
        created_at: date,
        updated_at: date
      }
    })
    returnCreated++
  }
  console.log(`Successfully created ${returnCreated} return movements.`)

  // 3. Generate Approved Stock Opname
  console.log("\n3. Generating Demo Approved Stock Opname...")
  const opnameDate = new Date("2026-05-22")
  
  const opname = await prisma.stock_opname.create({
    data: {
      opname_no: "OPN-20260522-0001",
      location_id: locationId,
      opname_date: opnameDate,
      status: "approved",
      notes: "Opname Demo Bulanan Mei 2026",
      conducted_by: userId,
      approved_by: userId,
      approved_at: opnameDate,
      created_at: opnameDate,
      updated_at: opnameDate
    }
  })

  let detailsCreated = 0
  for (let i = 0; i < 10; i++) {
    const product = products[(i + 12) % products.length]
    const systemQty = product.stock
    const physicalQty = systemQty > 5 ? systemQty - 2 : systemQty + 1 // slight realistic variance
    const variance = physicalQty - systemQty

    await prisma.stock_opname_details.create({
      data: {
        opname_id: opname.id,
        product_id: product.id,
        qty_system: systemQty,
        qty_physical: physicalQty,
        variance: variance,
        notes: variance < 0 ? "Selisih kurang, barang rusak" : "Selisih lebih, salah hitung sebelumnya",
        created_at: opnameDate
      }
    })
    detailsCreated++
  }

  console.log(`Successfully created 1 approved stock opname header with ${detailsCreated} detail lines.`)
  console.log("\n=== DEMO DATA GENERATION COMPLETE ===")
}

main()
  .catch(e => {
    console.error("Failed to generate demo data:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
