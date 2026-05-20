import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const grs = await prisma.good_receipts.findMany({
    include: {
      gr_items: true,
      purchase_orders: { include: { po_items: true } },
      suppliers: true
    }
  })

  let created = 0
  for (const gr of grs) {
    const existingAp = await prisma.accounts_payable.findUnique({
      where: { invoice_no: 'INV-' + gr.gr_no }
    })
    if (existingAp) continue

    let apSubtotal = 0
    for (const item of gr.gr_items) {
      if (item.qty_accepted > 0) {
        const poItem = gr.purchase_orders?.po_items.find(p => p.product_id === item.product_id)
        if (poItem) {
          apSubtotal += item.qty_accepted * Number(poItem.unit_price)
        }
      }
    }

    if (apSubtotal > 0) {
      const apTax = apSubtotal * 0.1
      const apTotal = apSubtotal + apTax
      const terms = gr.suppliers?.payment_terms || 30
      const dueDate = new Date(gr.gr_date)
      dueDate.setDate(dueDate.getDate() + terms)

      await prisma.accounts_payable.create({
        data: {
          supplier_id: gr.supplier_id,
          invoice_no: 'INV-' + gr.gr_no,
          invoice_date: gr.gr_date,
          due_date: dueDate,
          subtotal: apSubtotal,
          tax_amount: apTax,
          total_amount: apTotal,
          amount_paid: 0,
          amount_due: apTotal,
          status: 'open',
          notes: 'Otomatis digenerate dari Penerimaan Barang (GR): ' + gr.gr_no,
          created_at: gr.gr_date,
          updated_at: gr.gr_date
        }
      })
      created++
    }
  }
  console.log(`Successfully backfilled ${created} AP records.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
