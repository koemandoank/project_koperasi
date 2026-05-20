import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/shared/sidebar"
import { Header } from "@/components/shared/header"
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

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans selection:bg-blue-200">
      {/* Sidebar - Hidden on mobile, shown on md+ */}
      <div className="hidden md:flex">
        <Sidebar role={session.user.role as string} />
      </div>
      
      <div className="flex flex-1 flex-col overflow-hidden relative">
        {/* Decorative background blurs */}
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-50/80 to-transparent dark:from-blue-900/10 pointer-events-none -z-10" />
        
        <Header user={session.user} settings={settings} />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth">
          <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
