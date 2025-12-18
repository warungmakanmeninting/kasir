"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { supabaseClient } from "@/lib/supabaseClient"
import { Search, Calendar, Trash2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency } from "@/lib/currency"
import { toast } from "sonner"

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
  paymentStatus?: string
  note?: string
  createdAt: string
  updatedAt?: string
  completedAt?: string | null
  cancelledAt?: string | null
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  useEffect(() => {
    const loadOrders = async () => {
      if (!supabaseClient) {
        setError("Konfigurasi Supabase belum lengkap. Hubungi administrator.")
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

        setOrders(json.orders ?? [])
      } catch (err: any) {
        setError("Terjadi kesalahan saat memuat data pesanan.")
        console.error("Error loading orders:", err)
      } finally {
        setLoading(false)
      }
    }

    loadOrders()
  }, [])

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch =
        order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.orderNumber?.toString().includes(searchQuery) ||
        order.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.tableNumber?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = statusFilter === "all" || order.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [orders, searchQuery, statusFilter])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "default"
      case "pending":
        return "secondary"
      case "preparing":
        return "secondary"
      case "cancelled":
        return "destructive"
      default:
        return "secondary"
    }
  }

  const handleDelete = async (id: string) => {
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

      // Delete order via API
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Gagal menghapus pesanan")
        return
      }

      // Remove from local state
      setOrders((prev) => prev.filter((order) => order.id !== id))

      toast.success("Pesanan berhasil dihapus. Stok produk telah dikembalikan.")
    } catch (err: any) {
      toast.error("Terjadi kesalahan saat menghapus pesanan")
      console.error("Error deleting order:", err)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Manajemen Pesanan</h1>
        <p className="text-muted-foreground">Lihat dan kelola seluruh pesanan yang tercatat di sistem.</p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari ID pesanan, pelanggan, atau meja..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="completed">Selesai</SelectItem>
            <SelectItem value="pending">Menunggu</SelectItem>
            <SelectItem value="preparing">Sedang Dimasak</SelectItem>
            <SelectItem value="cancelled">Dibatalkan</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Memuat data pesanan...</p>
        </div>
      ) : (
        <div className="space-y-4">
        {filteredOrders.map((order) => (
          <Card key={order.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <CardTitle className="text-lg">
                    Pesanan #{order.orderNumber ? `ORD-${order.orderNumber}` : order.id.slice(-8)}
                  </CardTitle>
                  <Badge variant={getStatusColor(order.status)} className="capitalize">
                    {order.status === "pending"
                      ? "Menunggu"
                      : order.status === "preparing"
                        ? "Sedang Dimasak"
                        : order.status === "completed"
                          ? "Selesai"
                          : order.status === "cancelled"
                            ? "Dibatalkan"
                            : order.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {new Date(order.createdAt).toLocaleString("id-ID", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Hapus pesanan</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Pesanan</AlertDialogTitle>
                        <AlertDialogDescription>
                          Pesanan ini akan dihapus secara permanen beserta data pembayaran dan struk terkait. Stok produk akan dikembalikan ke sistem. Tindakan ini tidak dapat dibatalkan.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            handleDelete(order.id)
                          }}
                        >
                          Hapus
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                {order.customerName && (
                  <div>
                    <p className="text-sm text-muted-foreground">Pelanggan</p>
                    <p className="font-medium">{order.customerName}</p>
                  </div>
                )}
                {order.tableNumber && (
                  <div>
                    <p className="text-sm text-muted-foreground">Meja</p>
                    <p className="font-medium">Meja {order.tableNumber}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Jumlah Item</p>
                  <p className="font-medium">{order.items.length} item</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="space-y-2">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span>
                        {item.quantity}x {item.productName}
                      </span>
                      <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-4 pt-4 border-t">
                  <span className="font-semibold">Total</span>
                  <span className="text-lg font-bold text-primary">{formatCurrency(order.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

          {filteredOrders.length === 0 && !loading && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Tidak ada pesanan yang ditemukan.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
