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
          // Jika error karena invalid token, clear session dan redirect ke login
          console.error("[AuthGuard] Session error:", error.message)
          if (error.message.includes("Invalid") || error.message.includes("expired") || error.message.includes("token")) {
            // Clear invalid session
            try {
              await supabaseClient.auth.signOut()
            } catch (signOutError) {
              // Ignore signOut errors
            }
          }
          
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
          try {
            const role = await getUserRole()
            
            if (!role) {
              // Invalid role, clear session and redirect
              await supabaseClient.auth.signOut()
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
          } catch (roleError: any) {
            // If error getting role (e.g., invalid token), clear session and redirect
            console.error("[AuthGuard] Role check error:", roleError?.message)
            if (roleError?.message?.includes("Invalid") || roleError?.message?.includes("token") || roleError?.message?.includes("401")) {
              try {
                await supabaseClient.auth.signOut()
              } catch (signOutError) {
                // Ignore signOut errors
              }
              router.replace("/login")
              return
            }
          }
        }

        if (isMounted) {
          setIsReady(true)
        }
      } catch (err: any) {
        // Error tak terduga saat cek sesi: clear session dan redirect ke login
        console.error("[AuthGuard] Unexpected error:", err?.message)
        
        // If it's a token-related error, clear session
        if (err?.message?.includes("Invalid") || err?.message?.includes("token") || err?.message?.includes("401") || err?.message?.includes("403")) {
          try {
            await supabaseClient.auth.signOut()
          } catch (signOutError) {
            // Ignore signOut errors
          }
        }
        
        if (!isPublicPath) {
          router.replace("/login")
          return
        }

        if (isMounted) setIsReady(true)
      }
    }

    checkSession()

    // Listen for auth state changes (e.g., when user logs out from another device)
    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (!session && !PUBLIC_PATHS.includes(pathname))) {
        router.replace("/login")
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
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


