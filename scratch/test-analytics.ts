import { getAnalyticsData } from "../src/lib/actions/laporan-analitik"
import { getTransaksiKasirDetail } from "../src/lib/actions/laporan-transaksi-kasir"
import { getMembers } from "../src/lib/actions/members"
import { getMonthlyDeductionReport } from "../src/lib/actions/reports"
import { getMonitoringStockReport } from "../src/lib/actions/laporan-stok"

async function main() {
  const startDate = "2026-05-01"
  const endDate = "2026-05-31"
  const payMethod = "all"

  console.log("=== TESTING SERVER ACTIONS FOR ANALYTICS ===")

  // 1. getAnalyticsData
  try {
    console.log("\n1. Testing getAnalyticsData...")
    const res = await getAnalyticsData({ startDate, endDate, paymentMethod: payMethod })
    console.log("   ✅ success! Top products count:", res?.topProducts?.length)
  } catch (e: any) {
    console.error("   ❌ failed:", e.message || e)
  }

  // 2. getTransaksiKasirDetail
  try {
    console.log("\n2. Testing getTransaksiKasirDetail...")
    const res = await getTransaksiKasirDetail({ startDate, endDate, paymentMethod: payMethod })
    console.log("   ✅ success! Rows count:", res?.length)
  } catch (e: any) {
    console.error("   ❌ failed:", e.message || e)
  }

  // 3. getMembers
  try {
    console.log("\n3. Testing getMembers...")
    const res = await getMembers()
    console.log("   ✅ success! Members count:", res?.length)
  } catch (e: any) {
    console.error("   ❌ failed:", e.message || e)
  }

  // 4. getMonthlyDeductionReport
  try {
    console.log("\n4. Testing getMonthlyDeductionReport...")
    const res = await getMonthlyDeductionReport(startDate, endDate)
    console.log("   ✅ success! Deduction rows count:", res?.length)
  } catch (e: any) {
    console.error("   ❌ failed:", e.message || e)
  }

  // 5. getMonitoringStockReport
  try {
    console.log("\n5. Testing getMonitoringStockReport...")
    const res = await getMonitoringStockReport({ startDate, endDate })
    console.log("   ✅ success! Monitoring stock rows count:", res?.length)
  } catch (e: any) {
    console.error("   ❌ failed:", e.message || e)
  }
}

main().catch(console.error)
