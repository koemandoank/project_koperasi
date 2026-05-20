import { getPromotions } from "@/lib/actions/promotions"
import { PromotionsManager } from "./promotions-manager"

export default async function PromosiPage() {
  const promotions = await getPromotions()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold tracking-tight mb-6">Pengaturan Promosi</h1>
      <PromotionsManager initialPromotions={promotions} />
    </div>
  )
}