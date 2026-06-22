import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("=== PO AND GOOD RECEIPTS CHECK ===")
  const poCount = await prisma.purchase_orders.count()
  console.log(`Total Purchase Orders (PO): ${poCount}`)
  
  const grCount = await prisma.good_receipts.count()
  console.log(`Total Good Receipts (GR): ${grCount}`)
  
  const grs = await prisma.good_receipts.findMany({
    include: {
      gr_items: true
    }
  })
  
  console.log("Good Receipts details:")
  grs.forEach(gr => {
    console.log(`- GR No: ${gr.gr_no}, Date: ${gr.gr_date.toISOString()}, Status: ${gr.status}, Items Count: ${gr.gr_items.length}`)
    gr.gr_items.forEach(gri => {
      console.log(`  * Product ID: ${gri.product_id}, Qty Rec: ${gri.qty_received}, Accepted: ${gri.qty_accepted}, Rejected: ${gri.qty_rejected}`)
    })
  })

  console.log("\n=== STOCK OPNAME CHECK ===")
  const opnameCount = await prisma.stock_opname.count()
  console.log(`Total Stock Opnames in DB: ${opnameCount}`)
  const allOpnames = await prisma.stock_opname.findMany()
  console.log(allOpnames)

  console.log("\n=== STOCK MOVEMENTS BY TYPE ===")
  const counts = await prisma.stock_movements.groupBy({
    by: ['type'],
    _count: { id: true }
  })
  console.log(counts)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
