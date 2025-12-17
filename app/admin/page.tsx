"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useStore } from "@/lib/store"
import { Package, ShoppingBag, DollarSign, TrendingUp } from "lucide-react"
import { formatCurrency } from "@/lib/currency"
import { loadSettings, type AppSettings } from "@/lib/settings"

export default function AdminDashboardPage() {
  const { products, orders } = useStore()
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    const loadAppSettings = async () => {
      const appSettings = await loadSettings()
      setSettings(appSettings)
    }
    loadAppSettings()
  }, [])

  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0)
  const completedOrders = orders.filter((o) => o.status === "completed").length
  const averageOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0

  const stats = [
    {
      title: "Total Products",
      value: products.length,
      icon: Package,
      description: `${products.filter((p) => p.available).length} available`,
    },
    {
      title: "Total Orders",
      value: orders.length,
      icon: ShoppingBag,
      description: `${completedOrders} completed`,
    },
    {
      title: "Total Revenue",
      value: formatCurrency(totalRevenue),
      icon: DollarSign,
      description: "All time",
    },
    {
      title: "Avg Order Value",
      value: formatCurrency(averageOrderValue),
      icon: TrendingUp,
      description: "Per order",
    },
  ]

  return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard Overview</h1>
          <p className="text-muted-foreground">
            {settings ? `${settings.restaurant_name} - ` : ""}Welcome to your restaurant management system
          </p>
        </div>

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
                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {orders.slice(0, 5).map((order) => (
                <div key={order.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <div>
                    <p className="font-medium text-sm">Order #{order.id}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.items.length} items • {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="font-bold">{formatCurrency(order.total)}</p>
                </div>
              ))}
              {orders.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No orders yet</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {products.slice(0, 5).map((product) => (
                <div key={product.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <div>
                    <p className="font-medium text-sm">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.category}</p>
                  </div>
                  <p className="font-bold text-primary">{formatCurrency(product.price)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
