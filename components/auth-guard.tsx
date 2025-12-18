"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { supabaseClient } from "@/lib/supabaseClient"
import { getUserRole, canAccessRoute, getDefaultRouteForRole, type UserRole } from "@/lib/role-guard"

const PUBLIC_PATHS = ["/login"]

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let isMounted = true

    const checkSession = async () => {
      const isPublicPath = PUBLIC_PATHS.includes(pathname)

      // Jika Supabase belum dikonfigurasi, anggap tidak ada sesi
      if (!supabaseClient) {
        if (!isPublicPath) {
          router.replace("/login")
          return
        }

        if (isMounted) setIsReady(true)
        return
      }

      try {
        const {
          data: { session },
          error,
        } = await supabaseClient.auth.getSession()

        if (error) {
          // Jika gagal cek sesi (misal network error), paksa ke halaman login
          if (!isPublicPath) {
            router.replace("/login")
            return
          }

          if (isMounted) setIsReady(true)
          return
        }

        if (!session && !isPublicPath) {
          router.replace("/login")
          return
        }

        if (session && isPublicPath) {
          // Redirect to default route based on role
          const role = await getUserRole()
          const defaultRoute = getDefaultRouteForRole(role)
          router.replace(defaultRoute)
          return
        }

        // Check role-based access for protected paths
        if (session && !isPublicPath) {
          const role = await getUserRole()
          
          if (!role) {
            router.replace("/login")
            return
          }

          // Check if user can access this route
          if (!canAccessRoute(role, pathname)) {
            // Redirect to default route for their role
            const defaultRoute = getDefaultRouteForRole(role)
            router.replace(defaultRoute)
            return
          }
        }

        if (isMounted) {
          setIsReady(true)
        }
      } catch {
        // Error tak terduga saat cek sesi: amankan dengan redirect ke login
        if (!isPublicPath) {
          router.replace("/login")
          return
        }

        if (isMounted) setIsReady(true)
      }
    }

    checkSession()

    return () => {
      isMounted = false
    }
  }, [pathname, router])

  if (!isReady && !PUBLIC_PATHS.includes(pathname)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Memeriksa sesi login...</div>
      </div>
    )
  }

  return <>{children}</>
}


