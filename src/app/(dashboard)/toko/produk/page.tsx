import { auth } from "@/auth"
import { getProducts, getCategories } from "@/lib/actions/products"
import { getUnits } from "@/lib/actions/members"
import { ProductTable } from "./product-table"
import { ProductForm } from "./product-form"

export default async function ProdukPage() {
  const session = await auth()
  const userRole = session?.user?.role ?? "kasir"
  const canEdit = ["superadmin", "admin", "pengurus"].includes(userRole)

  const products = await getProducts()
  const categories = await getCategories()
  const units = await getUnits()

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Katalog Barang (POS)</h1>
          <p className="text-muted-foreground">Kelola daftar harga, stok, dan master data barang toko koperasi.</p>
        </div>
        {canEdit && <ProductForm units={units} categories={categories} />}
      </div>
      
      <ProductTable products={products} units={units} categories={categories} canEdit={canEdit} />
    </div>
  )
}
