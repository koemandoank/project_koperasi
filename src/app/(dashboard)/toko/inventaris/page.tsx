import { auth } from "@/auth";
import InventarisClient from "./client";
import { TransferStockPanel } from "./transfer-stock";
import { OpnameStockPanel } from "./opname-stock";
import { getInventarisReadModels } from "@/lib/actions/inventory-ui";

export default async function InventarisPage() {
  const session = await auth();
  if (!session?.user) return null;

  const readModel = await getInventarisReadModels();
  const locations = readModel.success ? readModel.data.locations : [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inventaris</h1>
        <p className="text-muted-foreground mt-1">
          Modul inventaris: reorder point, stock balances, serta stock transfer & stock opname (MVP).
        </p>
      </div>

      <InventarisClient />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <TransferStockPanel locations={locations} />
        <OpnameStockPanel locations={locations} />
      </div>
    </div>
  );
}





