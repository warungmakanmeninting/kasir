"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { loadSettings, type AppSettings } from "@/lib/settings"
import { supabaseClient } from "@/lib/supabaseClient"
import { getUserRole } from "@/lib/role-guard"
import { 
  ShoppingCart, 
  ChefHat, 
  LayoutDashboard, 
  User, 
  LogOut,
  ArrowRight
} from "lucide-react"

export default function HomePage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loadingRole, setLoadingRole] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const loadAppSettings = async () => {
      const appSettings = await loadSettings()
      setSettings(appSettings)
    }
    loadAppSettings()
  }, [])

  useEffect(() => {
    const loadUserRole = async () => {
      try {
        const role = await getUserRole()
        setUserRole(role)
      } catch (error) {
        console.error("Error loading user role:", error)
        setUserRole(null)
      } finally {
        setLoadingRole(false)
      }
    }
    loadUserRole()
  }, [])

  const handleLogout = async () => {
    try {
      setLoggingOut(true)
      
      // Always try to sign out, even if client is not available
      if (supabaseClient) {
        try {
          await supabaseClient.auth.signOut()
        } catch (signOutError) {
          // If signOut fails (e.g., invalid token), clear local storage manually
          console.error("[Logout] Sign out error:", signOutError)
          if (typeof window !== "undefined") {
            // Clear Supabase session from localStorage
            const keys = Object.keys(localStorage)
            keys.forEach((key) => {
              if (key.includes("supabase") || key.includes("auth-token")) {
                localStorage.removeItem(key)
              }
            })
            // Clear sessionStorage too
            sessionStorage.clear()
          }
        }
      } else {
        // If supabase client is not available, clear storage manually
        if (typeof window !== "undefined") {
          localStorage.clear()
          sessionStorage.clear()
        }
      }
      
      // Always redirect to login
      router.replace("/login")
    } catch (err) {
      console.error("[Logout] Unexpected error:", err)
      // Clear storage on error
      if (typeof window !== "undefined") {
        localStorage.clear()
        sessionStorage.clear()
      }
      router.replace("/login")
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="container mx-auto px-4 py-6 sm:py-8 md:py-12">
        {/* Header Section */}
        <div className="max-w-4xl mx-auto text-center mb-6 sm:mb-8 md:mb-10">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-2 sm:mb-3 md:mb-4 text-balance bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            {settings?.restaurant_name || "Sistem POS Restoran"}
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground text-pretty max-w-2xl mx-auto px-2">
            Kelola operasional restoran Anda dengan solusi point-of-sale yang modern
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 md:gap-6 max-w-4xl mx-auto">
          {/* Cashier POS Card - Show for cashier, admin, and manager */}
          {(userRole === "cashier" || userRole === "admin" || userRole === "manager") && (
            <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 border hover:border-primary/20">
            <CardHeader className="pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <ShoppingCart className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg sm:text-xl mb-1.5">Kasir POS</CardTitle>
              <CardDescription className="text-sm sm:text-base leading-relaxed">
                Proses pesanan dengan cepat menggunakan antarmuka kasir yang intuitif
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 px-4 sm:px-6 pb-4 sm:pb-6">
              <Link href="/pos" className="block group/btn">
                <Button size="default" className="w-full text-sm sm:text-base">
                  Buka POS
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover/btn:translate-x-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
          )}

          {/* Kitchen Dashboard Card - Show for chef, admin, and manager (if bypass_kitchen_menu is false) */}
          {settings?.bypass_kitchen_menu !== true && (userRole === "chef" || userRole === "admin" || userRole === "manager") && (
            <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 border hover:border-primary/20">
              <CardHeader className="pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                  <ChefHat className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg sm:text-xl mb-1.5">Dashboard Dapur</CardTitle>
                <CardDescription className="text-sm sm:text-base leading-relaxed">
                  Lihat dan kelola pesanan masuk dari dapur
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 px-4 sm:px-6 pb-4 sm:pb-6">
                <Link href="/kitchen" className="block group/btn">
                  <Button size="default" variant="default" className="w-full text-sm sm:text-base">
                    Buka Dapur
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover/btn:translate-x-1" />
                  </Button>
              </Link>
            </CardContent>
          </Card>
          )}

          {/* Admin Dashboard Card - Only show for admin and manager */}
          {(userRole === "admin" || userRole === "manager") && (
            <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 border hover:border-primary/20">
            <CardHeader className="pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <LayoutDashboard className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg sm:text-xl mb-1.5">Dashboard Admin</CardTitle>
              <CardDescription className="text-sm sm:text-base leading-relaxed">
                Kelola produk, lihat pesanan, dan lacak laporan penjualan
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 px-4 sm:px-6 pb-4 sm:pb-6">
              <Link href="/admin" className="block group/btn">
                <Button size="default" variant="secondary" className="w-full text-sm sm:text-base">
                  Buka Admin
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover/btn:translate-x-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
          )}

          {/* User Profile Card - Show for all roles */}
          <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 border hover:border-primary/20">
            <CardHeader className="pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <User className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg sm:text-xl mb-1.5">Profil Pengguna</CardTitle>
              <CardDescription className="text-sm sm:text-base leading-relaxed">
                Lihat detail akun dan kelola profil Anda
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 px-4 sm:px-6 pb-4 sm:pb-6 space-y-2.5">
              <Link href="/profile" className="block group/btn">
                <Button size="default" variant="outline" className="w-full text-sm sm:text-base">
                  Buka Profil
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover/btn:translate-x-1" />
                </Button>
              </Link>
              <Button
                size="default"
                variant="destructive"
                className="w-full text-sm sm:text-base transition-all duration-200"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                {loggingOut ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Keluar...
                  </>
                ) : (
                  <>
                    <LogOut className="mr-2 h-4 w-4" />
                    Keluar
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
