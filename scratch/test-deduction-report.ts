import { getMonthlyDeductionReport } from "../src/lib/actions/reports"

async function main() {
  console.log("=== TESTING MONTHLY DEDUCTION REPORT FOR MAY 2026 ===")
  
  const from = "2026-05-01"
  const to = "2026-05-31"
  
  const report = await getMonthlyDeductionReport(from, to)
  console.log(`Report generated. Total rows: ${report.length}`)
  
  let totalUang = 0
  let totalBarang = 0
  let totalKilat = 0
  
  for (const row of report) {
    totalUang += row.total_pinjaman_uang + row.total_pinjaman_uang_interest
    totalBarang += row.total_pinjaman_barang + row.total_pinjaman_barang_interest
    totalKilat += row.total_pinjaman_kilat + row.total_pinjaman_kilat_interest
  }
  
  console.log("Results:")
  console.log(`- Pinjaman Uang: Rp ${totalUang.toLocaleString("id-ID")}`)
  console.log(`- Pinjaman Barang: Rp ${totalBarang.toLocaleString("id-ID")}`)
  console.log(`- Pinjaman Kilat: Rp ${totalKilat.toLocaleString("id-ID")}`)
}

main()
  .catch(console.error)
