import { getLoanProducts } from "@/lib/actions/loan-products"
import { LoanProductTable } from "./loan-product-table"
import { LoanProductForm } from "./loan-product-form"
import { LoanRulesModal } from "./loan-rules-modal"

export default async function LoanProductsPage() {
  const products = await getLoanProducts()

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Master Produk Pinjaman</h1>
          <p className="text-muted-foreground">Atur jenis, bunga, dan tenor maksimal pinjaman.</p>
        </div>
        <div className="flex items-center gap-2">
          <LoanRulesModal products={products} />
          <LoanProductForm />
        </div>
      </div>
      <LoanProductTable products={products} />
    </div>
  )
}
