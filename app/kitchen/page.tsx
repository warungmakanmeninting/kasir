"use client"

import { useEffect, useState } from "react"
import { useStore } from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, ChefHat, CheckCircle2, XCircle, ArrowLeft, StickyNote } from "lucide-react"
import Link from "next/link"
import { loadSettings, type AppSettings } from "@/lib/settings"

export default function KitchenPage() {
  const { orders, updateOrderStatus } = useStore()
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    const loadAppSettings = async () => {
      const appSettings = await loadSettings()
      setSettings(appSettings)
    }
    loadAppSettings()
  }, [])

  const activeOrders = orders.filter((order) => order.status === "pending" || order.status === "preparing")
  const handleCancelOrder = (orderId: string) => {
    // eslint-disable-next-line no-alert
    const note = prompt("Alasan cancel order? (opsional)") || undefined
    updateOrderStatus(orderId, "cancelled", note)
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
        return "New Order"
      case "preparing":
        return "Preparing"
      case "completed":
        return "Ready"
      default:
        return status
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-orange-50/30 to-background">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <ChefHat className="h-8 w-8 text-orange-600" />
              <h1 className="text-3xl font-bold">Kitchen Dashboard</h1>
            </div>
            {settings && (
              <p className="text-sm text-muted-foreground ml-11">{settings.restaurant_name}</p>
            )}
          </div>
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
              <span className="text-sm font-medium">New Orders</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-blue-500" />
              <span className="text-sm font-medium">Preparing</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <span className="text-sm font-medium">Ready</span>
            </div>
          </div>
        </div>

        {activeOrders.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <ChefHat className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-xl text-muted-foreground">No active orders</p>
              <p className="text-sm text-muted-foreground">New orders will appear here</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeOrders.map((order) => (
              <Card key={order.id} className="border-2 hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2">Order #{order.id.slice(-6)}</CardTitle>
                      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                        {order.tableNumber && (
                          <div className="font-medium text-foreground">Table: {order.tableNumber}</div>
                        )}
                        {order.customerName && <div>Customer: {order.customerName}</div>}
                        {order.orderType && <div>Type: {order.orderType}</div>}
                        {order.note && (
                          <div className="flex items-start gap-1 text-xs text-muted-foreground">
                            <StickyNote className="h-3 w-3 mt-0.5" />
                            <span>{order.note}</span>
                          </div>
                        )}
                        {order.cancelNote && (
                          <div className="flex items-start gap-1 text-xs text-red-600">
                            <StickyNote className="h-3 w-3 mt-0.5" />
                            <span>Cancel note: {order.cancelNote}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(order.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                    <Badge className={`${getStatusColor(order.status)} text-white`}>
                      {getStatusLabel(order.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-b last:border-0">
                        <div className="flex-1">
                          <div className="font-medium">{item.productName}</div>
                          <div className="text-sm text-muted-foreground">Qty: {item.quantity}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 space-y-2">
                    {order.status === "pending" && (
                      <Button
                        onClick={() => updateOrderStatus(order.id, "preparing")}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        <ChefHat className="mr-2 h-4 w-4" />
                        Start Preparing
                      </Button>
                    )}

                    {order.status === "preparing" && (
                      <Button
                        onClick={() => updateOrderStatus(order.id, "completed")}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Mark as Ready
                      </Button>
                    )}

                    {order.status !== "cancelled" && (
                      <Button
                        onClick={() => handleCancelOrder(order.id)}
                        variant="outline"
                        className="w-full text-red-600 hover:bg-red-50"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Cancel Order
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
