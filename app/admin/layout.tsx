"use client"

import type React from "react"
import { useEffect, useState } from "react"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, Package, ShoppingBag, BarChart3, Users, ArrowLeft, Tags, CreditCard, Receipt, Settings, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import { getUserRole } from "@/lib/role-guard"
import { supabaseClient } from "@/lib/supabaseClient"

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Produk", icon: Package },
  { href: "/admin/categories", label: "Kategori", icon: Tags },
  { href: "/admin/orders", label: "Pesanan", icon: ShoppingBag },
  { href: "/admin/receipts", label: "Struk", icon: Receipt },
  { href: "/admin/finance", label: "Keuangan", icon: Wallet },
  { href: "/admin/reports", label: "Laporan", icon: BarChart3 },
  { href: "/admin/payment-methods", label: "Metode Pembayaran", icon: CreditCard },
  { href: "/admin/users", label: "Pengguna", icon: Users },
  { href: "/admin/settings", label: "Pengaturan", icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)

  // Check role authorization
  useEffect(() => {
    const checkRole = async () => {
      if (!supabaseClient) {
        router.replace("/login")
        return
      }

      const role = await getUserRole()
      if (role !== "admin" && role !== "manager") {
        // Redirect to appropriate page based on role
        if (role === "cashier") {
          router.replace("/pos")
        } else if (role === "chef") {
          router.replace("/kitchen")
        } else {
          router.replace("/login")
        }
        return
      }

      setIsAuthorized(true)
    }

    checkRole()
  }, [router])

  // Prevent body scroll when in admin layout
  useEffect(() => {
    document.documentElement.style.overflow = "hidden"
    document.body.style.overflow = "hidden"
    
    return () => {
      document.documentElement.style.overflow = ""
      document.body.style.overflow = ""
    }
  }, [])

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Memeriksa izin akses...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-muted/30 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col overflow-hidden shadow-sm">
        {/* Header */}
        <div className="p-5 border-b border-sidebar-border flex-shrink-0 bg-gradient-to-r from-sidebar to-sidebar/95">
          <h1 className="text-xl font-bold text-sidebar-foreground tracking-tight">Panel Admin</h1>
          <p className="text-xs text-sidebar-foreground/70 mt-0.5">Panel Manajemen</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto overflow-x-hidden">
          <div className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link key={item.href} href={item.href} className="block">
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start gap-3 rounded-lg transition-all duration-200 h-10 px-3",
                      "text-sm font-medium",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-sm",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Button>
                </Link>
              )
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-sidebar-border flex-shrink-0 bg-sidebar/50">
          <Link href="/" className="block">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 rounded-lg transition-all duration-200 h-10 px-3 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-sm"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              <span className="truncate">Kembali ke Beranda</span>
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
    </div>
  )
}
