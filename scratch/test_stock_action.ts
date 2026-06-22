import { getMonitoringStockReport } from "../src/lib/actions/laporan-stok"

async function main() {
  console.log("=== TESTING SERVER ACTION getMonitoringStockReport ===")
  const res = await getMonitoringStockReport({
    startDate: "2026-05-01",
    endDate: "2026-05-31"
  })

  console.log(`Total rows returned: ${res.length}`)
  const activeRows = res.filter(r => r.pembelian > 0 || r.qtyRetur > 0 || r.stockOpname !== null)
  console.log(`Active rows count (pembelian > 0 or retur > 0 or opname !== null): ${activeRows.length}`)
  activeRows.slice(0, 10).forEach(r => {
    console.log(`- Product: ${r.name}, Stock Awal: ${r.stockAwal}, Pembelian: ${r.pembelian}, Tot Jual: ${r.totPenjualan}, Stock Akhir: ${r.stockAkhir}, Opname: ${r.stockOpname}, Retur: ${r.qtyRetur}`)
  })
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
