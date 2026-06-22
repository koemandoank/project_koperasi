import { getNotifications } from "@/lib/actions/member-portal"
import { HeaderClient } from "./header-client"
import { MobileHeader } from "./mobile-header"

export async function Header({
  user,
  settings
}: {
  user: any
  settings: any
}) {
  // Fetch real notifications server-side (role dibaca dari session di dalam action)
  const notifications = await getNotifications()

  return (
    <>
      {/* Desktop header — hidden on mobile */}
      <div className="hidden md:block">
        <HeaderClient user={user} settings={settings} notifications={notifications} />
      </div>

      {/* Mobile top app bar — hidden on desktop */}
      <MobileHeader user={user} notifications={notifications} />
    </>
  )
}

