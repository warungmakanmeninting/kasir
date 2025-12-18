"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, ChefHat, CheckCircle2, XCircle, ArrowLeft, StickyNote, Utensils } from "lucide-react"
import Link from "next/link"
import { loadSettings, type AppSettings } from "@/lib/settings"
import { formatCurrency } from "@/lib/currency"
import { toast } from "sonner"
import { supabaseClient } from "@/lib/supabaseClient"
import { getUserRole, getDefaultRouteForRole } from "@/lib/role-guard"

type OrderItem = {
  productId: string | null
  productName: string
  quantity: number
  price: number
}

type Order = {
  id: string
  orderNumber?: number
  status: string
  orderType?: string
  customerName?: string
  tableNumber?: string
  items: OrderItem[]
  total: number
  subtotal: number
  tax: number
  note?: string
  createdAt: string
}

export default function KitchenPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkingRole, setCheckingRole] = useState(true)

  // Check role authorization
  useEffect(() => {
    const checkRole = async () => {
      const role = await getUserRole()
      if (role !== "chef" && role !== "admin" && role !== "manager") {
        const defaultRoute = getDefaultRouteForRole(role)
        router.replace(defaultRoute)
        return
      }
      setCheckingRole(false)
    }
    checkRole()
  }, [router])

  useEffect(() => {
    const loadAppSettings = async () => {
      const appSettings = await loadSettings()
      setSettings(appSettings)
      
      // Block access if bypass_kitchen_menu is enabled
      if (appSettings.bypass_kitchen_menu === true) {
        router.replace("/")
        return
      }
    }
    loadAppSettings()
  }, [router])

  useEffect(() => {
    const loadOrders = async () => {
      if (settings?.bypass_kitchen_menu === true) return

      if (!supabaseClient) {
        setError("Konfigurasi Supabase belum lengkap.")
        return
      }

      try {
        setLoading(true)
        setError(null)

        const {
          data: { session },
        } = await supabaseClient.auth.getSession()

        if (!session) {
          setError("Sesi login tidak ditemukan. Silakan login kembali.")
          return
        }

        // Get only active orders (pending or preparing)
        const res = await fetch("/api/admin/orders", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        const json = await res.json()
        if (!res.ok) {
          setError(json.error ?? "Gagal memuat data pesanan.")
          return
        }

        const allOrders = json.orders ?? []
        // Filter only active orders for kitchen
        const activeOrders = allOrders.filter(
          (order: Order) => order.status === "pending" || order.status === "preparing"
        )
        setOrders(activeOrders)
      } catch (err: any) {
        setError("Terjadi kesalahan saat memuat data pesanan.")
        console.error("Error loading orders:", err)
      } finally {
        setLoading(false)
      }
    }

    loadOrders()

    // Auto-refresh every 5 seconds
    const interval = setInterval(loadOrders, 5000)
    return () => clearInterval(interval)
  }, [settings?.bypass_kitchen_menu])

  if (checkingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Memeriksa izin akses...</div>
      </div>
    )
  }

  // Early return if bypass_kitchen_menu is enabled
  if (settings?.bypass_kitchen_menu === true) {
    return null
  }

  const activeOrders = useMemo(() => {
    return orders.filter((order) => order.status === "pending" || order.status === "preparing")
  }, [orders])

  const handleUpdateStatus = async (orderId: string, newStatus: "preparing" | "completed" | "cancelled") => {
    if (!supabaseClient) {
      toast.error("Konfigurasi Supabase belum lengkap")
      return
    }

    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession()

      if (!session) {
        toast.error("Sesi login tidak ditemukan")
        return
      }

      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      })

      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Gagal memperbarui status pesanan")
        return
      }

      // Update local state
      setOrders((prev) =>
        prev.map((order) => (order.id === orderId ? { ...order, status: newStatus } : order))
      )

      toast.success(
        newStatus === "preparing"
          ? "Pesanan sedang dimasak"
          : newStatus === "completed"
            ? "Pesanan siap"
            : "Pesanan dibatalkan"
      )
    } catch (err: any) {
      toast.error("Terjadi kesalahan saat memperbarui status pesanan")
      console.error("Error updating order status:", err)
    }
  }

  const handleCancelOrder = async (orderId: string) => {
    // eslint-disable-next-line no-alert
    const note = prompt("Alasan membatalkan pesanan? (opsional)") || undefined
    if (note !== null) {
      if (!supabaseClient) {
        toast.error("Konfigurasi Supabase belum lengkap")
        return
      }

      try {
        const {
          data: { session },
        } = await supabaseClient.auth.getSession()

        if (!session) {
          toast.error("Sesi login tidak ditemukan")
          return
        }

        const res = await fetch(`/api/admin/orders/${orderId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ status: "cancelled", cancel_note: note || undefined }),
        })

        const json = await res.json()
        if (!res.ok) {
          toast.error(json.error ?? "Gagal membatalkan pesanan")
          return
        }

        // Update local state
        setOrders((prev) => prev.filter((order) => order.id !== orderId))

        toast.success("Pesanan berhasil dibatalkan")
      } catch (err: any) {
        toast.error("Terjadi kesalahan saat membatalkan pesanan")
        console.error("Error cancelling order:", err)
      }
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500"
      case "preparing":
        return "bg-blue-500"
      case "completed":
        return "bg-green-500"
      default:
        return "bg-gray-500"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "Pesanan Baru"
      case "preparing":
        return "Sedang Dimasak"
      case "completed":
        return "Siap"
      case "cancelled":
        return "Dibatalkan"
      default:
        return status
    }
  }

  const getOrderTypeLabel = (type?: string) => {
    switch (type) {
      case "dine_in":
        return "Makan di Tempat"
      case "takeaway":
        return "Bungkus"
      case "gojek":
        return "Gojek"
      case "grab":
        return "Grab"
      case "shopeefood":
        return "ShopeeFood"
      default:
        return type
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <ChefHat className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Dashboard Dapur</h1>
                {settings && (
                  <p className="text-sm text-muted-foreground">{settings.restaurant_name}</p>
                )}
              </div>
            </div>
          </div>
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Kembali ke Home
            </Button>
          </Link>
        </div>

        <div className="mb-6 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
            <span className="text-sm text-muted-foreground">Pesanan Baru</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            <span className="text-sm text-muted-foreground">Sedang Dimasak</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
            <span className="text-sm text-muted-foreground">Siap</span>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Utensils className="h-12 w-12 text-muted-foreground animate-pulse" />
              </div>
              <p className="text-sm text-muted-foreground">Memuat pesanan...</p>
            </CardContent>
          </Card>
        ) : activeOrders.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Utensils className="h-12 w-12 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium text-foreground mb-1">Tidak Ada Pesanan Aktif</p>
              <p className="text-sm text-muted-foreground">Pesanan baru akan muncul di sini</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeOrders.map((order) => (
              <Card key={order.id} className="hover:shadow-md transition-all duration-200 border-l-4" style={{ borderLeftColor: order.status === "pending" ? "#eab308" : order.status === "preparing" ? "#3b82f6" : "#22c55e" }}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg mb-2 flex items-center gap-2">
                        <span className="font-mono text-sm text-muted-foreground">
                          #{order.orderNumber ? `ORD-${order.orderNumber}` : order.id.slice(-8)}
                        </span>
                      </CardTitle>
                      <div className="flex flex-col gap-1.5 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          <span>{new Date(order.createdAt).toLocaleString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "short",
                          })}</span>
                        </div>
                        {order.tableNumber && (
                          <div className="font-medium text-foreground">Meja {order.tableNumber}</div>
                        )}
                        {order.customerName && (
                          <div className="text-muted-foreground">Pelanggan: {order.customerName}</div>
                        )}
                        {order.orderType && (
                          <div className="text-muted-foreground">Tipe: {getOrderTypeLabel(order.orderType)}</div>
                        )}
                        {order.note && (
                          <div className="flex items-start gap-1.5 text-xs bg-muted/50 p-2 rounded-md mt-1">
                            <StickyNote className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                            <span className="text-muted-foreground">{order.note}</span>
                          </div>
                        )}
                        {order.cancelNote && (
                          <div className="flex items-start gap-1.5 text-xs bg-red-50 text-red-700 p-2 rounded-md mt-1 border border-red-200">
                            <StickyNote className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span>Catatan Batal: {order.cancelNote}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge className={`${getStatusColor(order.status)} text-white shrink-0`}>
                      {getStatusLabel(order.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2.5">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Item Pesanan</div>
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start py-2 border-b last:border-0 last:pb-0">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{item.productName}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">Qty: {item.quantity}</span>
                            {item.price > 0 && (
                              <>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-xs text-muted-foreground">{formatCurrency(item.price)}</span>
                              </>
                            )}
                          </div>
                        </div>
                        {item.price > 0 && (
                          <div className="text-sm font-medium ml-2 shrink-0">
                            {formatCurrency(item.price * item.quantity)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {order.total > 0 && (
                    <div className="pt-2 border-t">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-muted-foreground">Total</span>
                        <span className="text-base font-bold text-primary">{formatCurrency(order.total)}</span>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 space-y-2">
                    {order.status === "pending" && (
                      <Button
                        onClick={() => handleUpdateStatus(order.id, "preparing")}
                        className="w-full"
                        size="sm"
                      >
                        <ChefHat className="mr-2 h-4 w-4" />
                        Mulai Memasak
                      </Button>
                    )}

                    {order.status === "preparing" && (
                      <Button
                        onClick={() => handleUpdateStatus(order.id, "completed")}
                        className="w-full bg-green-600 hover:bg-green-700"
                        size="sm"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Tandai Siap
                      </Button>
                    )}

                    {order.status !== "cancelled" && (
                      <Button
                        onClick={() => handleCancelOrder(order.id)}
                        variant="outline"
                        className="w-full text-red-600 hover:bg-red-50 hover:text-red-700"
                        size="sm"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Batalkan Pesanan
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
