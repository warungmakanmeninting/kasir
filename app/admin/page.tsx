"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { supabaseClient } from "@/lib/supabaseClient"
import { Package, ShoppingBag, DollarSign, TrendingUp } from "lucide-react"
import { formatCurrency } from "@/lib/currency"
import { loadSettings, type AppSettings } from "@/lib/settings"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts"

type OrderData = {
  id: string
  orderNumber?: number
  status: string
  orderType?: string
  customerName?: string
  tableNumber?: string
  items: Array<{
    productId: string
    productName: string
    quantity: number
    price: number
    category?: string
  }>
  total: number
  createdAt: string
}

type ProductData = {
  id: string
  name: string
  category: string
  available: boolean
}

export default function AdminDashboardPage() {
  const [products, setProducts] = useState<ProductData[]>([])
  const [orders, setOrders] = useState<OrderData[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [salesRange, setSalesRange] = useState<"7d" | "30d">("7d")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      if (!supabaseClient) {
        setError("Konfigurasi Supabase belum lengkap.")
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Load settings
        const appSettings = await loadSettings()
        setSettings(appSettings)

        // Load session
        const {
          data: { session },
        } = await supabaseClient.auth.getSession()

        if (!session) {
          setError("Sesi login tidak ditemukan. Silakan login kembali.")
          return
        }

        // Load orders
        const ordersRes = await fetch("/api/admin/orders", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        const ordersJson = await ordersRes.json()
        if (!ordersRes.ok) {
          throw new Error(ordersJson.error ?? "Gagal memuat pesanan")
        }

        // Load products
        const [catRes, prodRes] = await Promise.all([
          supabaseClient
            .from("categories")
            .select("id, name")
            .eq("is_active", true),
          supabaseClient
            .from("products")
            .select("id, name, category_id, is_available")
            .eq("is_available", true),
        ])

        if (catRes.error) throw catRes.error
        if (prodRes.error) throw prodRes.error

        const categoryMap = new Map<string, string>()
        ;(catRes.data ?? []).forEach((c: any) => {
          categoryMap.set(c.id, c.name)
        })

        // Transform orders - need to fetch products to get categories for items
        const ordersData = (ordersJson.orders ?? []).map((order: any) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          orderType: order.orderType,
          customerName: order.customerName,
          tableNumber: order.tableNumber,
          items: order.items.map((item: any) => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            price: item.price,
          })),
          total: order.total,
          createdAt: order.createdAt,
        }))

        // Transform products with categories
        const productsData = (prodRes.data ?? []).map((p: any) => ({
          id: p.id,
          name: p.name,
          category: categoryMap.get(p.category_id) ?? "Tidak Terkategori",
          available: p.is_available,
        }))

        // Enhance orders with product categories
        const ordersWithCategories = ordersData.map((order) => ({
          ...order,
          items: order.items.map((item) => {
            const productInfo = productsData.find((p) => p.id === item.productId)
            return {
              ...item,
              category: productInfo?.category,
            }
          }),
        }))

        setOrders(ordersWithCategories)
        setProducts(productsData)
      } catch (err: any) {
        setError(err?.message ?? "Gagal memuat data dashboard")
        console.error("Error loading dashboard data:", err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0)
  const completedOrders = orders.filter((o) => o.status === "completed").length
  const averageOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0

  type ProductSales = {
    productId: string
    name: string
    category: string
    quantitySold: number
    revenue: number
  }

  const productSalesMap = new Map<string, ProductSales>()

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const existing = productSalesMap.get(item.productId)
      const productMeta = products.find((p) => p.id === item.productId)
      const name = productMeta?.name ?? item.productName
      const category = productMeta?.category ?? "Tidak diketahui"
      const lineRevenue = item.price * item.quantity

      if (existing) {
        existing.quantitySold += item.quantity
        existing.revenue += lineRevenue
      } else {
        productSalesMap.set(item.productId, {
          productId: item.productId,
          name,
          category,
          quantitySold: item.quantity,
          revenue: lineRevenue,
        })
      }
    })
  })

  const topProducts = Array.from(productSalesMap.values())
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .slice(0, 5)

  type DailySalesPoint = {
    date: string
    revenue: number
    orders: number
  }

  const dailySalesMap = new Map<string, { revenue: number; orders: number }>()

  orders.forEach((order) => {
    const date = new Date(order.createdAt)
    const key = date.toISOString().slice(0, 10)
    const current = dailySalesMap.get(key) ?? { revenue: 0, orders: 0 }
    current.revenue += order.total
    current.orders += 1
    dailySalesMap.set(key, current)
  })

  const dailySalesAll: DailySalesPoint[] = Array.from(dailySalesMap.entries())
    .map(([date, value]) => ({
      date,
      revenue: value.revenue,
      orders: value.orders,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const today = new Date()
  const fromDate = new Date(today)
  fromDate.setDate(
    today.getDate() - (salesRange === "7d" ? 6 : 29),
  )
  const fromKey = fromDate.toISOString().slice(0, 10)

  const dailySales = dailySalesAll.filter((item) => item.date >= fromKey)

  const salesChartConfig: ChartConfig = {
    revenue: {
      label: "Pendapatan",
      color: "hsl(var(--chart-1))",
    },
  }

  const stats = [
    {
      title: "Total Produk",
      value: products.length,
      icon: Package,
      description: `${products.filter((p) => p.available).length} produk tersedia`,
    },
    {
      title: "Total Pesanan",
      value: orders.length,
      icon: ShoppingBag,
      description: `${completedOrders} pesanan selesai`,
    },
    {
      title: "Total Pendapatan",
      value: formatCurrency(totalRevenue),
      icon: DollarSign,
      description: "Akumulasi seluruh waktu",
    },
    {
      title: "Rata-rata Nilai Pesanan",
      value: formatCurrency(averageOrderValue),
      icon: TrendingUp,
      description: "Rata-rata per pesanan",
    },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Ringkasan Dashboard</h1>
        <p className="text-muted-foreground">
          {settings ? `${settings.restaurant_name} - ` : ""}
          Panel administrasi untuk memantau produk, pesanan, dan performa penjualan.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading && (
        <div className="text-center py-12 text-sm text-muted-foreground">Memuat data dashboard...</div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="mt-1 text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {!loading && dailySales.length > 0 && (
        <div className="mt-8">
          <Card>
            <CardHeader className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>Grafik Penjualan Harian</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ringkasan pendapatan harian berdasarkan pesanan yang tercatat.
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={salesRange === "7d" ? "default" : "ghost"}
                  onClick={() => setSalesRange("7d")}
                >
                  Mingguan
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={salesRange === "30d" ? "default" : "ghost"}
                  onClick={() => setSalesRange("30d")}
                >
                  Bulanan
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer config={salesChartConfig} className="h-64 w-full">
                <LineChart data={dailySales} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) =>
                      new Date(value as string).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                      })
                    }
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                    tickMargin={8}
                    tickFormatter={(value) => {
                      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
                      if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
                      return value.toString()
                    }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--color-revenue)"
                    strokeWidth={2}
                    dot={{ fill: "var(--color-revenue)", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Aktivitas Pesanan Terbaru</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {orders.slice(0, 5).map((order) => (
                <div key={order.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <div>
                    <p className="text-sm font-medium">Pesanan #{order.id}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.items.length} item •{" "}
                      {new Date(order.createdAt).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <p className="font-bold">{formatCurrency(order.total)}</p>
                </div>
              ))}
              {orders.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Belum ada pesanan yang tercatat di sistem.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Produk Unggulan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topProducts.map((product) => (
                <div
                  key={product.productId}
                  className="flex items-center justify-between border-b pb-3 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.category} • Terjual {product.quantitySold}x
                    </p>
                  </div>
                  <p className="font-bold text-primary">{formatCurrency(product.revenue)}</p>
                </div>
              ))}
              {topProducts.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Belum ada data penjualan untuk produk. Transaksi yang tercatat akan muncul di sini.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        </div>
      )}
    </div>
  )
}
