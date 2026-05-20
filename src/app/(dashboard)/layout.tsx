import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/shared/sidebar"
import { Header } from "@/components/shared/header"
import { BottomNav } from "@/components/shared/bottom-nav"
import { getAppSettings } from "@/lib/actions/settings"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  
  if (!session?.user) {
    redirect("/login")
  }

  const settings = await getAppSettings()
  const role = session.user.role as string

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans selection:bg-blue-200">
      {/* ── Desktop Sidebar (hidden on mobile) ── */}
      <div className="hidden md:flex">
        <Sidebar role={role} />
      </div>
      
      <div className="flex flex-1 flex-col overflow-hidden relative">
        {/* Decorative background blurs — desktop only */}
        <div className="hidden md:block absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-50/80 to-transparent dark:from-blue-900/10 pointer-events-none -z-10" />
        
        {/* Header (renders both desktop HeaderClient + mobile MobileHeader) */}
        <Header user={session.user} settings={settings} />
        
        {/* Main content area */}
        <main className="flex-1 overflow-y-auto scroll-smooth">
          <div
            className={[
              "mx-auto max-w-7xl",
              // Desktop padding
              "md:p-6 lg:p-8",
              // Mobile padding — top normal (MobileHeader uses fixed positioning + spacer)
              "p-4",
              // Bottom padding on mobile to clear the fixed BottomNav
              "pb-safe-nav md:pb-8",
              // Entry animation
              "animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out",
            ].join(" ")}
          >
            {children}
          </div>
        </main>
      </div>

      {/* ── Mobile Bottom Navigation (hidden on desktop) ── */}
      <BottomNav role={role} />
    </div>
  )
}

