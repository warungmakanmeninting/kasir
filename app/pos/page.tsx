"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useStore } from "@/lib/store"
import type { OrderItem } from "@/lib/types"
import { Minus, Plus, ShoppingCart, Trash2, X, ArrowLeft, Printer } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { supabaseClient } from "@/lib/supabaseClient"
import { formatCurrency } from "@/lib/currency"
import { PaymentModal } from "@/components/payment-modal"
import { loadSettings } from "@/lib/settings"
import { getPrinterInstance } from "@/lib/bluetooth-printer"

type CategoryRow = {
  id: string
  name: string
}

type ProductRow = {
  id: string
  name: string
  description: string | null
  price: number
  category_id: string | null
  image_url: string | null
  is_available: boolean
}

export default function POSPage() {
  const { createOrder } = useStore()
  const [cart, setCart] = useState<OrderItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [customerName, setCustomerName] = useState("")
  const [tableNumber, setTableNumber] = useState("")

  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [productRows, setProductRows] = useState<ProductRow[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [taxRate, setTaxRate] = useState(10) // default 10%
  const [restaurantName, setRestaurantName] = useState("Cashier POS")
  const [printerConnected, setPrinterConnected] = useState(false)
  const [connectingPrinter, setConnectingPrinter] = useState(false)
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway" | "gojek" | "grab" | "shopeefood">("dine_in")
  const [orderNote, setOrderNote] = useState("")
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      if (!supabaseClient) {
        setDataError("Konfigurasi Supabase belum lengkap. Hubungi administrator.")
        return
      }

      try {
        setLoadingData(true)
        setDataError(null)

        // Load settings first to get tax rate and restaurant name
        const settings = await loadSettings()
        setTaxRate(settings.tax_rate)
        setRestaurantName(settings.restaurant_name)

        const [catRes, prodRes] = await Promise.all([
          supabaseClient
            .from("categories")
            .select("id, name, is_active, sort_order")
            .eq("is_active", true)
            .order("sort_order", { ascending: true }),
          supabaseClient
            .from("products")
            .select("id, name, description, price, category_id, image_url, is_available, created_at")
            .eq("is_available", true)
            .order("created_at", { ascending: true }),
        ])

        if (catRes.error) {
          throw catRes.error
        }
        if (prodRes.error) {
          throw prodRes.error
        }

        setCategories(
          (catRes.data ?? []).map((c: any) => ({
            id: c.id as string,
            name: c.name as string,
          })),
        )

        setProductRows(
          (prodRes.data ?? []).map((p: any) => ({
            id: p.id as string,
            name: p.name as string,
            description: (p.description as string | null) ?? null,
            price: Number(p.price),
            category_id: (p.category_id as string | null) ?? null,
            image_url: (p.image_url as string | null) ?? null,
            is_available: Boolean(p.is_available),
          })),
        )
      } catch (err) {
        setDataError("Gagal memuat data produk dari database. Silakan coba lagi atau hubungi administrator.")
      } finally {
        setLoadingData(false)
      }
    }

    loadData()
  }, [])

  // Cek status koneksi printer saat pertama kali load
  useEffect(() => {
    try {
      const printer = getPrinterInstance()
      setPrinterConnected(printer.isConnected())
    } catch {
      // Abaikan error jika bluetooth tidak tersedia
    }
  }, [])

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>()
    categories.forEach((c) => {
      if (c.id) map.set(c.id, c.name)
    })
    return map
  }, [categories])

  const products = useMemo(
    () =>
      productRows.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description ?? "",
        price: p.price,
        category: p.category_id ? categoryNameById.get(p.category_id) ?? "Uncategorized" : "Uncategorized",
        image: p.image_url ?? "/placeholder.svg",
        available: p.is_available,
      })),
    [productRows, categoryNameById],
  )

  const filteredProducts =
    selectedCategory === "all" ? products : products.filter((p) => p.category === selectedCategory)

  const addToCart = (productId: string, productName: string, price: number) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === productId)
      if (existing) {
        return prev.map((item) => (item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item))
      }
      return [...prev, { productId, productName, quantity: 1, price }]
    })
  }

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.productId === productId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item,
        )
        .filter((item) => item.quantity > 0),
    )
  }

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId))
  }

  const clearCart = () => {
    setCart([])
    setCustomerName("")
    setTableNumber("")
  }

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = (subtotal * taxRate) / 100
  const total = subtotal + tax

  const handleCheckout = () => {
    if (cart.length === 0) return
    setSuccessMessage(null)
    setIsPaymentModalOpen(true)
  }

  const handlePaymentComplete = () => {
    createOrder(cart, customerName, tableNumber, orderType, orderNote)
    clearCart()
    setSuccessMessage("Pembayaran berhasil dan order telah dikirim ke dapur.")
  }

  const handleConnectPrinter = async () => {
    try {
      setConnectingPrinter(true)
      const printer = getPrinterInstance()
      const ok = await printer.connect()
      setPrinterConnected(ok)

      if (!ok) {
        // eslint-disable-next-line no-alert
        alert("Gagal terhubung ke printer. Pastikan printer menyala dan bluetooth aktif.")
      }
    } catch {
      // eslint-disable-next-line no-alert
      alert("Terjadi kesalahan saat menghubungkan ke printer.")
    } finally {
      setConnectingPrinter(false)
    }
  }

  return (
    <>
      <PaymentModal
        open={isPaymentModalOpen}
        onOpenChange={setIsPaymentModalOpen}
        cart={cart}
        subtotal={subtotal}
        tax={tax}
        total={total}
        customerName={customerName}
        tableNumber={tableNumber}
        orderType={orderType}
        orderNote={orderNote}
        onPaymentComplete={handlePaymentComplete}
      />

    <div className="flex h-screen bg-muted/30">
      {/* Products Section */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-card border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
              <div className="flex flex-col">
            <h1 className="text-2xl font-bold">Cashier POS</h1>
                <p className="text-xs text-muted-foreground">{restaurantName}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleConnectPrinter}
                  disabled={connectingPrinter}
                  className="flex items-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  <span className="text-xs">
                    {connectingPrinter
                      ? "Menghubungkan..."
                      : printerConnected
                        ? "Printer terhubung"
                        : "Hubungkan printer"}
                  </span>
                </Button>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      printerConnected ? "bg-emerald-500" : "bg-red-500"
                    }`}
                  />
                  <span>{printerConnected ? "Siap cetak" : "Belum terhubung"}</span>
                </div>
          </div>
          <Badge variant="secondary" className="text-sm">
            {cart.reduce((sum, item) => sum + item.quantity, 0)} items
          </Badge>
            </div>
        </header>

        <div className="p-6 overflow-auto">
          {dataError && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {dataError}
            </div>
          )}

          {successMessage && (
            <div className="mb-4 flex items-start justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <div>
                <p className="font-semibold">Pembayaran berhasil</p>
                <p className="text-xs">{successMessage}</p>
              </div>
              <button
                type="button"
                onClick={() => setSuccessMessage(null)}
                className="text-xs font-medium text-emerald-900/70 hover:text-emerald-900"
              >
                Tutup
              </button>
            </div>
          )}

          <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="mb-6">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="all">All</TabsTrigger>
              {categories.map((cat) => (
                <TabsTrigger key={cat.id} value={cat.name}>
                  {cat.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {loadingData && filteredProducts.length === 0 ? (
            <div className="text-sm text-muted-foreground">Memuat produk dari database...</div>
          ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map((product) => (
              <Card
                key={product.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => addToCart(product.id, product.name, product.price)}
              >
                <CardContent className="p-4">
                  <div className="aspect-square relative mb-3 rounded-lg overflow-hidden bg-muted">
                      <Image
                        src={product.image || "/placeholder.svg"}
                        alt={product.name}
                        fill
                        className="object-cover"
                      />
                  </div>
                  <h3 className="font-semibold text-sm mb-1 truncate">{product.name}</h3>
                  <p className="text-xs text-muted-foreground mb-2 line-clamp-1">{product.description}</p>
                  <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-primary">{formatCurrency(product.price)}</span>
                    {!product.available && (
                      <Badge variant="destructive" className="text-xs">
                        Out
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          )}
        </div>
      </div>

      {/* Cart Section */}
      <div className="w-96 bg-card border-l flex flex-col">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Current Order
            </h2>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearCart}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="customer">Customer Name</Label>
              <Input
                id="customer"
                placeholder="Optional"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="table">Table Number</Label>
              <Input
                id="table"
                placeholder="Optional"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="order_type">Order Type</Label>
              <Select
                value={orderType}
                onValueChange={(value) =>
                  setOrderType(value as "dine_in" | "takeaway" | "gojek" | "grab" | "shopeefood")
                }
              >
                <SelectTrigger id="order_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dine_in">Dine in</SelectItem>
                  <SelectItem value="takeaway">Takeaway</SelectItem>
                  <SelectItem value="gojek">Gojek</SelectItem>
                  <SelectItem value="grab">Grab</SelectItem>
                  <SelectItem value="shopeefood">ShopeeFood</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="order_note">Order Note</Label>
              <Textarea
                id="order_note"
                placeholder="Catatan untuk dapur atau kasir (opsional)"
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ShoppingCart className="h-16 w-16 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Cart is empty</p>
              <p className="text-sm text-muted-foreground">Add items to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map((item) => (
                <Card key={item.productId} className="border border-muted bg-muted/40">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start justify-between mb-2 sm:mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-base leading-snug">{item.productName}</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                          {formatCurrency(item.price)} / item
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-600"
                        onClick={() => removeFromCart(item.productId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 bg-transparent"
                          onClick={() => updateQuantity(item.productId, -1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="min-w-[2.5rem] text-center font-semibold text-base">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 bg-transparent"
                          onClick={() => updateQuantity(item.productId, 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <span className="font-semibold text-base sm:text-lg">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-muted/30">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {taxRate > 0 && tax > 0 && (
            <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pajak ({taxRate}%)</span>
                <span>{formatCurrency(tax)}</span>
            </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>
          </div>
          <Button className="w-full" size="lg" onClick={handleCheckout} disabled={cart.length === 0}>
            Bayar
          </Button>
        </div>
      </div>
    </div>
    </>
  )
}
