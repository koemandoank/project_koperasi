import { getNotifications } from "@/lib/actions/member-portal"
import { HeaderClient } from "./header-client"

export async function Header({
  user,
  settings
}: {
  user: any
  settings: any
}) {
  // Fetch real notifications server-side
  const notifications = await getNotifications(user?.role || "anggota")

  return <HeaderClient user={user} settings={settings} notifications={notifications} />
}
