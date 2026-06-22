import { getMonthlyDeductionReport } from "../src/lib/actions/reports"

async function main() {
  console.log("=== CHECKING BUDI SANTOSO DEDUCTIONS IN MAY 2026 ===")
  const report = await getMonthlyDeductionReport("2026-05-01", "2026-05-31")
  const row = report.find(r => r.nik === "S0001")
  console.log(JSON.stringify(row, null, 2))
}

main().catch(console.error)
