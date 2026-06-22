import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("=== INSPECTING CONSIGNMENT ITEMS IN DETAIL ===")
  const ids = [3, 4, 5, 6]
  const items = await prisma.consignment_items.findMany({
    where: { id: { in: ids.map(BigInt) } },
    include: { products: true, suppliers: true }
  })
  
  items.forEach(i => {
    console.log(`\nConsignment Item ID: ${i.id}`)
    console.log(`- Date: ${i.consignment_date.toISOString().split("T")[0]}`)
    console.log(`- Supplier: ${i.suppliers?.supplier_name || "Unknown"}`)
    console.log(`- Product Name/SKU: ${i.products?.name} / ${i.products?.sku}`)
    console.log(`- Product Stock (Global): ${i.products?.stock}`)
    console.log(`- Qty Received: ${i.qty_received}`)
    console.log(`- Qty Returned: ${i.qty_returned}`)
    console.log(`- Qty Sold (DB column): ${i.qty_sold}`)
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())
