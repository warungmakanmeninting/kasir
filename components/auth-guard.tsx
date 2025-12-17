"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { supabaseClient } from "@/lib/supabaseClient"

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
          router.replace("/")
          return
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


