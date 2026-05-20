"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

export function DashboardMobileRedirect({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    setIsReady(true)
  }, [])

  useEffect(() => {
    if (!isReady) return
    if (typeof window === "undefined") return

    const forceDashboard = searchParams.get("forceDashboard") === "true"
    const isMobile = window.innerWidth < 768

    if (isMobile && !forceDashboard) {
      router.replace("/dashboard/home")
    }
  }, [isReady, router, searchParams])

  return <>{children}</>
}
