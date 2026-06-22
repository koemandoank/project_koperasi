import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const models = [
    "User", "Member", "Unit", "failed_jobs", "journal_entries", "journal_lines",
    "loan_applications", "loan_payments", "loan_products", "loan_schedules", "loans",
    "order_items", "orders", "ppob_transactions", "product_categories", "products",
    "saving_transactions", "saving_types", "savings", "shu_distributions", "shu_periods",
    "stock_movements", "app_settings", "monthly_closures", "cash_registers",
    "cash_register_sessions", "order_payments", "order_returns"
  ]

  console.log("TABLE ROW COUNTS:")
  for (const model of models) {
    try {
      // @ts-ignore
      const count = await prisma[model.toLowerCase() === "failed_jobs" ? "failed_jobs" : model.charAt(0).toLowerCase() + model.slice(1)].count()
      console.log(`${model}: ${count}`)
    } catch (e: any) {
      console.log(`${model}: ERROR (${e.message.substring(0, 50)})`)
    }
  }
}

main().catch(console.error)
