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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useStore } from "@/lib/store"
import type { OrderItem } from "@/lib/types"
import { Minus, Plus, ShoppingCart, Trash2, X, ArrowLeft, Printer, Search, History, RotateCcw, Eye, XCircle, Menu } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { supabaseClient } from "@/lib/supabaseClient"
import { formatCurrency } from "@/lib/currency"
import { loadSettings } from "@/lib/settings"
import { getPrinterInstance, type ReceiptData } from "@/lib/bluetooth-printer"
import { toast } from "sonner"
import { getUserRole, getDefaultRouteForRole } from "@/lib/role-guard"
import { useRouter } from "next/navigation"

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
  stock_quantity: number
  track_stock: boolean
}

type ProductVariant = {
  id: string
  name: string
  additional_price: number
  is_active: boolean
}

type ReceiptHistoryItem = {
  id: string
  receipt_number: number | null
  order_id: string
  printed_at: string
  print_status?: "pending" | "printed" | "failed"
}

export default function POSPage() {
  const router = useRouter()
  const { createOrder } = useStore()
  const [cart, setCart] = useState<OrderItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [customerName, setCustomerName] = useState("")
  const [tableNumber, setTableNumber] = useState("")
  const [checkingRole, setCheckingRole] = useState(true)

  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [productRows, setProductRows] = useState<ProductRow[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [taxRate, setTaxRate] = useState(10) // default 10%
  const [restaurantName, setRestaurantName] = useState("Cashier POS")
  const [printerConnected, setPrinterConnected] = useState(false)
  const [connectingPrinter, setConnectingPrinter] = useState(false)
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway" | "gojek" | "grab" | "shopeefood">("dine_in")
  const [orderNote, setOrderNote] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [processingCheckout, setProcessingCheckout] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [paymentMethods, setPaymentMethods] = useState<Array<{ id: string; code: string; name: string }>>([])
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("")
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false)
  const [amountPaid, setAmountPaid] = useState<string>("")
  const [productVariants, setProductVariants] = useState<Record<string, ProductVariant[]>>({})
  const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false)
  const [selectedProductForVariant, setSelectedProductForVariant] = useState<ProductRow | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [showPrinterAlert, setShowPrinterAlert] = useState(false)
  const [receiptHistory, setReceiptHistory] = useState<ReceiptHistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [isHistoryDropdownOpen, setIsHistoryDropdownOpen] = useState(false)
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false)
  const [reprintingReceiptId, setReprintingReceiptId] = useState<string | null>(null)
  const [cancellingReceiptId, setCancellingReceiptId] = useState<string | null>(null)
  const [selectedReceiptForDetail, setSelectedReceiptForDetail] = useState<string | null>(null)
  const [receiptDetailData, setReceiptDetailData] = useState<any>(null)
  const [isReceiptDetailOpen, setIsReceiptDetailOpen] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null)
  const [showPrinterConnectConfirm, setShowPrinterConnectConfirm] = useState(false)

  // Check role authorization
  useEffect(() => {
    const checkRole = async () => {
      const role = await getUserRole()
      if (role !== "cashier" && role !== "admin" && role !== "manager" && role !== "super_user") {
        const defaultRoute = getDefaultRouteForRole(role)
        router.replace(defaultRoute)
        return
      }
      setCheckingRole(false)
    }
    checkRole()
  }, [router])

  // Load receipt history function
  const loadReceiptHistory = async () => {
    if (!supabaseClient) return

    try {
      setLoadingHistory(true)
      const {
        data: { session },
      } = await supabaseClient.auth.getSession()

      if (!session) return

      const res = await fetch("/api/receipts?limit=10", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (res.ok) {
        const json = await res.json()
        setReceiptHistory(json.receipts ?? [])
      }
    } catch (err) {
      console.error("[POS] Error loading receipt history:", err)
    } finally {
      setLoadingHistory(false)
    }
  }

  // Load receipt history on mount
  useEffect(() => {
    loadReceiptHistory()
  }, [])

  useEffect(() => {
    // Don't load data until role check is complete
    if (checkingRole) {
      return
    }

    const loadData = async () => {
      if (!supabaseClient) {
        setDataError("Konfigurasi Supabase belum lengkap. Hubungi administrator.")
        return
      }

      try {
        setLoadingData(true)
        setDataError(null)

        // Check session first
        const {
          data: { session },
        } = await supabaseClient.auth.getSession()

        if (!session) {
          setDataError("Sesi login tidak ditemukan. Silakan login kembali.")
          return
        }

        console.log("[POS] Session found, user:", session.user.email)

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
            .select("id, name, description, price, category_id, image_url, is_available, stock_quantity, track_stock, created_at")
            .eq("is_available", true)
            .order("created_at", { ascending: true }),
        ])

        if (catRes.error) {
          console.error("[POS] Error loading categories:", catRes.error)
          throw catRes.error
        }
        if (prodRes.error) {
          console.error("[POS] Error loading products:", prodRes.error)
          console.error("[POS] Products error details:", JSON.stringify(prodRes.error, null, 2))
          throw prodRes.error
        }

        console.log("[POS] Categories loaded:", catRes.data?.length ?? 0)
        console.log("[POS] Products loaded (raw):", prodRes.data?.length ?? 0, prodRes.data)

        // Load variants separately - not critical if it fails
        let variantRes: { data: any[] | null; error: any } = { data: [], error: null }
        try {
          const variantResult = await supabaseClient
            .from("product_variants")
            .select("id, product_id, name, additional_price, is_active")
            .eq("is_active", true)
          
          if (variantResult.error) {
            console.warn("[POS] Warning: Failed to load variants (non-critical):", variantResult.error)
            // Continue without variants - not a fatal error
          } else {
            variantRes = variantResult
          }
        } catch (variantErr: any) {
          console.warn("[POS] Warning: Exception loading variants (non-critical):", variantErr?.message || variantErr)
          // Continue without variants - not a fatal error
        }

        setCategories(
          (catRes.data ?? []).map((c: any) => ({
            id: c.id as string,
            name: c.name as string,
          })),
        )

        const productData = (prodRes.data ?? []).map((p: any) => ({
            id: p.id as string,
            name: p.name as string,
            description: (p.description as string | null) ?? null,
            price: Number(p.price),
            category_id: (p.category_id as string | null) ?? null,
            image_url: (p.image_url as string | null) ?? null,
            is_available: Boolean(p.is_available),
            stock_quantity: Number(p.stock_quantity || 0),
            track_stock: Boolean(p.track_stock),
        }))
        console.log("[POS] Loaded products:", productData.length, "items")
        setProductRows(productData)

        // Group variants by product_id
        const variantsByProduct: Record<string, ProductVariant[]> = {}
        if (variantRes && variantRes.data) {
          ;(variantRes.data ?? []).forEach((v: any) => {
            const productId = v.product_id as string
            if (!variantsByProduct[productId]) {
              variantsByProduct[productId] = []
            }
            variantsByProduct[productId].push({
              id: v.id as string,
              name: v.name as string,
              additional_price: Number(v.additional_price),
              is_active: Boolean(v.is_active),
            })
          })
        }
        setProductVariants(variantsByProduct)
      } catch (err: any) {
        console.error("[POS] Error loading data:", err)
        setDataError(
          err?.message 
            ? `Gagal memuat data: ${err.message}` 
            : "Gagal memuat data produk dari database. Silakan coba lagi atau hubungi administrator."
        )
      } finally {
        setLoadingData(false)
      }
    }

    loadData()
  }, [checkingRole])

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
        category: p.category_id ? categoryNameById.get(p.category_id) ?? "Tidak Terkategori" : "Tidak Terkategori",
        image: p.image_url ?? "/placeholder.svg",
        available: p.is_available,
        stockQuantity: p.stock_quantity,
        trackStock: p.track_stock,
      })),
    [productRows, categoryNameById],
  )

  const filteredProducts = useMemo(() => {
    let filtered = selectedCategory === "all" 
      ? products 
      : products.filter((p) => p.category === selectedCategory)
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter((p) => 
        p.name.toLowerCase().includes(query) || 
        (p.description && p.description.toLowerCase().includes(query))
      )
    }
    
    return filtered
  }, [products, selectedCategory, searchQuery])

  const handleProductClick = (product: { id: string; name: string; price: number; category?: string }) => {
    const variants = productVariants[product.id] || []
    
    // Jika produk punya varian aktif, tampilkan dialog pemilihan varian
    if (variants.length > 0) {
      // Find the ProductRow to store for variant dialog
      const productRow = productRows.find(p => p.id === product.id)
      if (productRow) {
        setSelectedProductForVariant(productRow)
        setSelectedVariantId(null)
        setIsVariantDialogOpen(true)
      } else {
        // Fallback: langsung tambah jika tidak ditemukan ProductRow
        addToCart(product.id, product.name, product.price, product.category)
      }
    } else {
      // Jika tidak ada varian, langsung tambah ke cart
      addToCart(product.id, product.name, product.price, product.category)
    }
  }

  const handleConfirmVariantSelection = () => {
    if (!selectedProductForVariant) return

    const variants = productVariants[selectedProductForVariant.id] || []
    let finalPrice = selectedProductForVariant.price

    // Jika varian dipilih, tambahkan additional_price
    if (selectedVariantId) {
      const selectedVariant = variants.find(v => v.id === selectedVariantId)
      if (selectedVariant) {
        finalPrice = selectedProductForVariant.price + selectedVariant.additional_price
      }
    }

    // Build product name with variant if selected
    let productName = selectedProductForVariant.name
    if (selectedVariantId) {
      const selectedVariant = variants.find(v => v.id === selectedVariantId)
      if (selectedVariant) {
        productName = `${selectedProductForVariant.name} - ${selectedVariant.name}`
      }
    }
    // If no variant selected, use base product name

    // Get category from productRows
    const category = selectedProductForVariant.category_id 
      ? categoryNameById.get(selectedProductForVariant.category_id) ?? undefined
      : undefined

    addToCart(selectedProductForVariant.id, productName, finalPrice, category)
    setIsVariantDialogOpen(false)
    setSelectedProductForVariant(null)
    setSelectedVariantId(null)
  }

  const addToCart = (productId: string, productName: string, price: number, category?: string) => {
    setCart((prev) => {
      // Check if same product with same name (includes variant) exists
      const existing = prev.find((item) => item.productId === productId && item.productName === productName)
      if (existing) {
        return prev.map((item) => 
          item.productId === productId && item.productName === productName 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        )
      }
      return [...prev, { productId, productName, quantity: 1, price, category }]
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

  const handleCheckout = async () => {
    if (cart.length === 0) return
    if (!supabaseClient) {
      toast.error("Konfigurasi Supabase belum lengkap")
      return
    }

    try {
      setLoadingPaymentMethods(true)
      setIsPaymentDialogOpen(true)

      const {
        data: { session },
      } = await supabaseClient.auth.getSession()

      if (!session) {
        toast.error("Sesi login tidak ditemukan", {
          description: "Silakan login kembali.",
        })
        setIsPaymentDialogOpen(false)
        return
      }

      // Load payment methods
      const { data: methods, error } = await supabaseClient
        .from("payment_methods")
        .select("id, code, name")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })

      if (error) throw error

      if (!methods || methods.length === 0) {
        toast.error("Tidak ada metode pembayaran yang tersedia")
        setIsPaymentDialogOpen(false)
        return
      }

      setPaymentMethods(methods)
      setSelectedPaymentMethod(methods[0].code)
      // Set default amount paid to total
      setAmountPaid(total.toFixed(0))
    } catch (err: any) {
      toast.error("Gagal memuat metode pembayaran", {
        description: err?.message,
      })
      setIsPaymentDialogOpen(false)
    } finally {
      setLoadingPaymentMethods(false)
    }
  }

  const handleProcessCheckout = async () => {
    if (!selectedPaymentMethod) {
      toast.error("Pilih metode pembayaran terlebih dahulu")
      return
  }

    const amountPaidNum = Number.parseFloat(amountPaid) || 0
    if (amountPaidNum < total) {
      toast.error("Jumlah pembayaran kurang", {
        description: `Minimal pembayaran: ${formatCurrency(total)}`,
      })
      return
    }

    if (!supabaseClient) {
      toast.error("Konfigurasi Supabase belum lengkap")
      return
    }

    try {
      setProcessingCheckout(true)

      const {
        data: { session },
      } = await supabaseClient.auth.getSession()

      if (!session) {
        toast.error("Sesi login tidak ditemukan", {
          description: "Silakan login kembali.",
        })
        return
      }

      const paymentMethod = paymentMethods.find((m) => m.code === selectedPaymentMethod)
      if (!paymentMethod) {
        toast.error("Metode pembayaran tidak valid")
        return
      }

      const change = Math.max(0, amountPaidNum - total)

      // Load settings
      const settings = await loadSettings()

      // Create order in database
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          items: cart.map((item) => ({
            product_id: item.productId,
            product_name: item.productName,
            quantity: item.quantity,
            price: item.price,
          })),
          customer_name: customerName || undefined,
          table_number: tableNumber || undefined,
          order_type: orderType || "dine_in",
          note: orderNote || undefined,
          payment_method_id: paymentMethod.id,
          subtotal,
          tax,
          total,
          amount_paid: amountPaidNum,
          change_given: change,
        }),
      })

      if (!orderRes.ok) {
        const errorData = await orderRes.json()
        console.error("[POS] Order creation failed:", errorData)
        throw new Error(errorData.error || "Gagal menyimpan order")
      }

      const orderData = await orderRes.json()
      const { order } = orderData

      if (!order || !order.id) {
        console.error("[POS] Order response invalid:", orderData)
        throw new Error("Order created but invalid response")
      }

      console.log("[POS] Order created successfully:", order.id)

      // Save receipt to database
      const receiptNumber = `INV-${Date.now()}`
      const receiptRes = await fetch("/api/receipts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          order_id: order.id,
          copy_type: "original",
          snapshot: {
            order,
            items: cart.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              price: item.price,
            })),
            payment: {
              method_code: paymentMethod.code,
              method_name: paymentMethod.name,
              subtotal,
              tax,
              total,
              amount_paid: amountPaidNum,
              change,
            },
            client_receipt_number: receiptNumber,
            settings,
          },
        }),
      })

      if (!receiptRes.ok) {
        const errorData = await receiptRes.json()
        console.error("[POS] Failed to save receipt:", errorData.error)
        // Don't throw error - receipt is optional, order is already saved
      } else {
        const receiptData = await receiptRes.json()
        const receiptId = receiptData.receipt?.id
        if (receiptData.message) {
          console.log("[POS] Receipt already exists:", receiptId)
        } else {
          console.log("[POS] Receipt saved successfully:", receiptId)
        }

        // Print receipt if printer connected and auto-print enabled
        const shouldAutoPrint = settings?.auto_print_receipt ?? true
        
        if (shouldAutoPrint) {
          if (!printerConnected) {
            // Update status to failed - printer not connected
            if (receiptId) {
              try {
                await fetch(`/api/receipts/${receiptId}`, {
                  method: "PATCH",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({ print_status: "failed" }),
                })
              } catch (err) {
                console.error("[POS] Failed to update print status:", err)
              }
            }
            // Show alert dialog to connect printer
            setShowPrinterAlert(true)
          } else {
            // Print receipt - ensure it only runs in browser/client-side
            // Check if we're in browser environment and Bluetooth is available
            if (typeof window !== "undefined" && typeof navigator !== "undefined" && "bluetooth" in navigator) {
              try {
                // Use setTimeout to ensure print happens after UI updates
                setTimeout(async () => {
                  try {
                    const printer = getPrinterInstance()
                    const receiptData: ReceiptData = {
                      receiptNumber,
                      orderDate: new Date(),
                      customerName: customerName || undefined,
                      tableNumber: tableNumber || undefined,
                      items: cart.map((item) => ({
                        name: item.productName,
                        quantity: item.quantity,
                        price: item.price,
                        total: item.price * item.quantity,
                      })),
                      subtotal,
                      tax,
                      total,
                      paymentMethod: paymentMethod.name,
                      cashier: session.user.user_metadata?.full_name || session.user.email || "Kasir",
                      restaurantName: settings?.restaurant_name,
                      restaurantAddress: settings?.restaurant_address,
                      restaurantPhone: settings?.restaurant_phone,
                      footerMessage: settings?.receipt_footer,
                      taxRate: settings?.tax_rate,
                    }

                    const printed = await printer.printReceipt(receiptData)
                    if (receiptId) {
                      // Update print status based on result
                      try {
                        await fetch(`/api/receipts/${receiptId}`, {
                          method: "PATCH",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${session.access_token}`,
                          },
                          body: JSON.stringify({ print_status: printed ? "printed" : "failed" }),
                        })
                      } catch (err) {
                        console.error("[POS] Failed to update print status:", err)
                      }
                    }

                    if (!printed) {
                      toast.error("Gagal mencetak struk", {
                        description: "Pastikan printer terhubung dan siap.",
                      })
                    } else {
                      toast.success("Struk berhasil dicetak")
                    }
                  } catch (printError: any) {
                    console.error("[POS] Print error:", printError)
                    // Update status to failed
                    if (receiptId) {
                      try {
                        await fetch(`/api/receipts/${receiptId}`, {
                          method: "PATCH",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${session.access_token}`,
                          },
                          body: JSON.stringify({ print_status: "failed" }),
                        })
                      } catch (err) {
                        console.error("[POS] Failed to update print status:", err)
                      }
                    }
                    toast.error("Gagal mencetak struk", {
                      description: printError?.message || "Terjadi kesalahan saat mencetak.",
                    })
                  }
                }, 100) // Small delay to ensure UI is ready
              } catch (setupError: any) {
                console.error("[POS] Print setup error:", setupError)
                // Update status to failed
                if (receiptId) {
                  try {
                    await fetch(`/api/receipts/${receiptId}`, {
                      method: "PATCH",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${session.access_token}`,
                      },
                      body: JSON.stringify({ print_status: "failed" }),
                    })
                  } catch (err) {
                    console.error("[POS] Failed to update print status:", err)
                  }
                }
                toast.error("Gagal menyiapkan cetak struk", {
                  description: setupError?.message || "Terjadi kesalahan saat menyiapkan printer.",
                })
              }
            } else {
              console.warn("[POS] Bluetooth API not available (server-side or unsupported browser)")
              // Update status to failed if Bluetooth not available
              if (receiptId) {
                try {
                  await fetch(`/api/receipts/${receiptId}`, {
                    method: "PATCH",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({ print_status: "failed" }),
                  })
                } catch (err) {
                  console.error("[POS] Failed to update print status:", err)
                }
              }
            }
          }
        } else {
          // Auto-print disabled, status remains "pending"
          console.log("[POS] Auto-print disabled, receipt status: pending")
        }
      }

      // Clear cart
    clearCart()
      setIsPaymentDialogOpen(false)
      toast.success("Pesanan berhasil dibuat")
    } catch (err: any) {
      toast.error("Terjadi kesalahan saat checkout", {
        description: err?.message || "Silakan coba lagi.",
      })
    } finally {
      setProcessingCheckout(false)
    }
  }

  const handleQuickAmount = (multiplier: number) => {
    const roundedAmount = Math.ceil(total / multiplier) * multiplier
    setAmountPaid(roundedAmount.toString())
  }

  const handleConnectPrinter = async () => {
    try {
      setConnectingPrinter(true)
      const printer = getPrinterInstance()
      const ok = await printer.connect()
      setPrinterConnected(ok)

      if (!ok) {
        toast.error("Gagal terhubung ke printer", {
          description: "Pastikan printer menyala dan bluetooth aktif.",
        })
      } else {
        toast.success("Printer berhasil terhubung")
      }
    } catch {
      toast.error("Terjadi kesalahan saat menghubungkan ke printer")
    } finally {
      setConnectingPrinter(false)
    }
  }

  if (checkingRole) {
  return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Memeriksa izin akses...</div>
      </div>
    )
  }

  const handleConnectPrinterFromAlert = async () => {
    setShowPrinterAlert(false)
    await handleConnectPrinter()
  }

  const handleViewReceiptDetail = async (receiptId: string) => {
    if (!supabaseClient) {
      toast.error("Konfigurasi Supabase belum lengkap")
      return
    }

    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession()

      if (!session) {
        toast.error("Sesi login tidak ditemukan", {
          description: "Silakan login kembali.",
        })
        return
      }

      // Get receipt detail with order data
      const res = await fetch(`/api/receipts/${receiptId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const json = await res.json()
      if (!res.ok) {
        toast.error("Gagal memuat data struk", {
          description: json.error ?? "Terjadi kesalahan saat memuat data.",
        })
        return
      }

      setReceiptDetailData(json)
      setSelectedReceiptForDetail(receiptId)
      setIsReceiptDetailOpen(true)
    } catch (err: any) {
      toast.error("Terjadi kesalahan saat memuat detail struk", {
        description: err?.message,
      })
    }
  }

  const handleCancelReceiptOrder = (orderId: string) => {
    setCancelOrderId(orderId)
    setShowCancelConfirm(true)
  }

  const handleConfirmCancelOrder = async () => {
    if (!cancelOrderId || !supabaseClient) {
      toast.error("Konfigurasi Supabase belum lengkap")
      setShowCancelConfirm(false)
      return
    }

    try {
      setCancellingReceiptId(cancelOrderId)

      const {
        data: { session },
      } = await supabaseClient.auth.getSession()

      if (!session) {
        toast.error("Sesi login tidak ditemukan", {
          description: "Silakan login kembali.",
        })
        return
      }

      const res = await fetch(`/api/admin/orders/${cancelOrderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status: "cancelled", cancel_note: "Dibatalkan dari POS" }),
      })

      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Gagal membatalkan pesanan")
        return
      }

      // Refresh receipt history
      const historyRes = await fetch("/api/receipts?limit=10", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (historyRes.ok) {
        const historyJson = await historyRes.json()
        setReceiptHistory(historyJson.receipts ?? [])
      }

      toast.success("Pesanan berhasil dibatalkan dan stok produk dikembalikan")
    } catch (err: any) {
      toast.error("Terjadi kesalahan saat membatalkan pesanan", {
        description: err?.message,
      })
    } finally {
      setCancellingReceiptId(null)
    }
  }

  const handleReprintReceipt = async (receiptId: string) => {
    if (!supabaseClient) {
      toast.error("Konfigurasi Supabase belum lengkap")
      return
    }

    // Check printer connection
    if (!printerConnected) {
      setSelectedReceiptForDetail(receiptId)
      setShowPrinterConnectConfirm(true)
      return
    }

    try {
      setReprintingReceiptId(receiptId)

      const {
        data: { session },
      } = await supabaseClient.auth.getSession()

      if (!session) {
        toast.error("Sesi login tidak ditemukan", {
          description: "Silakan login kembali.",
        })
        return
      }

      // Get receipt detail with order data
      const res = await fetch(`/api/receipts/${receiptId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const json = await res.json()
      if (!res.ok) {
        toast.error("Gagal memuat data struk", {
          description: json.error ?? "Terjadi kesalahan saat memuat data.",
        })
        return
      }

      const { receipt: receiptDetail, order } = json

      if (!order) {
        toast.error("Data order tidak ditemukan")
        return
      }

      // Load settings
      const receiptSettings = await loadSettings()

      // Get payment method name
      let paymentMethodName = "Belum dibayar"
      if (order.payments && order.payments.length > 0) {
        const payment = order.payments[0]
        if (payment.payment_methods) {
          paymentMethodName = payment.payment_methods.name || "Sudah dibayar"
        } else {
          paymentMethodName = "Sudah dibayar"
        }
      }

      // Get cashier name from session user
      const cashierName = session.user.user_metadata?.full_name || session.user.email || "Kasir"

      // Prepare receipt data for printing
      const receiptData: ReceiptData = {
        receiptNumber: receiptDetail.receipt_number?.toString() || "N/A",
        orderDate: new Date(order.created_at),
        customerName: order.customer_name || undefined,
        tableNumber: order.table_number || undefined,
        items: (order.order_items || []).map((item: any) => ({
          name: item.product_name,
          quantity: item.quantity,
          price: Number(item.unit_price),
          total: Number(item.total),
        })),
        subtotal: Number(order.subtotal),
        tax: Number(order.tax_amount),
        total: Number(order.total),
        paymentMethod: paymentMethodName,
        cashier: cashierName,
        restaurantName: receiptSettings.restaurant_name,
        restaurantAddress: receiptSettings.restaurant_address,
        restaurantPhone: receiptSettings.restaurant_phone,
        footerMessage: receiptSettings.receipt_footer,
        taxRate: receiptSettings.tax_rate,
      }

      // Print receipt - ensure it only runs in browser/client-side
      if (typeof window !== "undefined" && "bluetooth" in navigator) {
        const printer = getPrinterInstance()
        const printed = await printer.printReceipt(receiptData)

        // Update print status
        try {
          await fetch(`/api/receipts/${receiptId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ print_status: printed ? "printed" : "failed" }),
          })
        } catch (err) {
          console.error("[POS] Failed to update print status:", err)
        }

        if (!printed) {
          toast.error("Gagal mencetak struk", {
            description: "Pastikan printer terhubung dan siap.",
          })
        } else {
          toast.success("Struk berhasil dicetak ulang")
        }
      } else {
        // Update status to failed if Bluetooth not available
        try {
          await fetch(`/api/receipts/${receiptId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ print_status: "failed" }),
          })
        } catch (err) {
          console.error("[POS] Failed to update print status:", err)
        }
        toast.error("Bluetooth tidak tersedia", {
          description: "Pastikan browser mendukung Bluetooth API.",
        })
      }
    } catch (err: any) {
      toast.error("Terjadi kesalahan saat mencetak ulang struk", {
        description: err?.message,
      })
    } finally {
      setReprintingReceiptId(null)
    }
  }

  return (
    <div className="flex h-screen bg-muted/30">
      {/* Printer Alert Dialog */}
      <AlertDialog open={showPrinterAlert} onOpenChange={setShowPrinterAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Printer Belum Terhubung</AlertDialogTitle>
            <AlertDialogDescription>
              Auto print struk diaktifkan, tetapi printer belum terhubung. Silakan hubungkan printer terlebih dahulu untuk mencetak struk secara otomatis.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowPrinterAlert(false)}>
              Tutup
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConnectPrinterFromAlert}>
              Koneksikan Printer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Order Confirmation Dialog */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan Pesanan</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin membatalkan pesanan ini? Stok produk akan dikembalikan ke sistem. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowCancelConfirm(false)
              setCancelOrderId(null)
            }}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCancelOrder}>
              Ya, Batalkan Pesanan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Printer Connect Confirmation Dialog */}
      <AlertDialog open={showPrinterConnectConfirm} onOpenChange={setShowPrinterConnectConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Printer Belum Terhubung</AlertDialogTitle>
            <AlertDialogDescription>
              Printer belum terhubung. Hubungkan printer terlebih dahulu untuk mencetak struk?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowPrinterConnectConfirm(false)
              setSelectedReceiptForDetail(null)
            }}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              setShowPrinterConnectConfirm(false)
              await handleConnectPrinter()
              if (printerConnected && selectedReceiptForDetail) {
                await handleReprintReceipt(selectedReceiptForDetail)
              } else {
                toast.error("Gagal terhubung ke printer", {
                  description: "Silakan hubungkan printer terlebih dahulu.",
                })
              }
              setSelectedReceiptForDetail(null)
            }}>
              Hubungkan Printer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Receipt Detail Dialog */}
      <Dialog open={isReceiptDetailOpen} onOpenChange={setIsReceiptDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Struk</DialogTitle>
          </DialogHeader>
          {receiptDetailData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">No Struk</Label>
                  <p className="font-medium">{receiptDetailData.receipt?.receipt_number || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Tanggal</Label>
                  <p className="font-medium">
                    {new Date(receiptDetailData.order?.created_at).toLocaleString("id-ID")}
                  </p>
                </div>
                {receiptDetailData.order?.customer_name && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Nama Customer</Label>
                    <p className="font-medium">{receiptDetailData.order.customer_name}</p>
                  </div>
                )}
                {receiptDetailData.order?.table_number && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Meja</Label>
                    <p className="font-medium">{receiptDetailData.order.table_number}</p>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Items</Label>
                <div className="space-y-2">
                  {receiptDetailData.order?.order_items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center border-b pb-2">
                      <div className="flex-1">
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity} x {formatCurrency(Number(item.unit_price))}
                        </p>
                      </div>
                      <p className="font-medium">{formatCurrency(Number(item.total))}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1 pt-2 border-t">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatCurrency(Number(receiptDetailData.order?.subtotal || 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pajak</span>
                  <span className="font-medium">{formatCurrency(Number(receiptDetailData.order?.tax_amount || 0))}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total</span>
                  <span>{formatCurrency(Number(receiptDetailData.order?.total || 0))}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
            <h1 className="text-2xl font-bold">Kasir POS</h1>
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
                <DropdownMenu
                  open={isHistoryDropdownOpen}
                  onOpenChange={(open) => {
                    setIsHistoryDropdownOpen(open)
                    // Refresh data when dropdown opens
                    if (open) {
                      loadReceiptHistory()
                    }
                  }}
                >
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <History className="h-4 w-4" />
                      <span className="text-xs">History</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
                    <DropdownMenuLabel>History Transaksi (10 Terakhir)</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {loadingHistory ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        Memuat...
                      </div>
                    ) : receiptHistory.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        Belum ada history transaksi
                      </div>
                    ) : (
                      receiptHistory.map((receipt) => (
                        <DropdownMenuItem
                          key={receipt.id}
                          className="flex items-center justify-between gap-2 p-2 cursor-default"
                          onSelect={(e) => e.preventDefault()}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-medium">
                                No Struk: {receipt.receipt_number || "N/A"}
                              </div>
                              {receipt.print_status && (
                                <Badge
                                  variant={
                                    receipt.print_status === "printed"
                                      ? "default"
                                      : receipt.print_status === "failed"
                                        ? "destructive"
                                        : "secondary"
                                  }
                                  className="text-xs"
                                >
                                  {receipt.print_status === "printed"
                                    ? "Sudah Print"
                                    : receipt.print_status === "failed"
                                      ? "Gagal Print"
                                      : "Belum Print"}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {new Date(receipt.printed_at).toLocaleString("id-ID", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewReceiptDetail(receipt.id)}
                              className="h-7 w-7 p-0"
                              title="Detail"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleReprintReceipt(receipt.id)}
                              disabled={reprintingReceiptId === receipt.id}
                              className="h-7 w-7 p-0"
                              title="Reprint"
                            >
                              {reprintingReceiptId === receipt.id ? (
                                <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                              ) : (
                                <RotateCcw className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCancelReceiptOrder(receipt.order_id)}
                              disabled={cancellingReceiptId === receipt.order_id}
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              title="Batal"
                            >
                              {cancellingReceiptId === receipt.order_id ? (
                                <div className="h-3 w-3 animate-spin rounded-full border-2 border-destructive border-t-transparent" />
                              ) : (
                                <XCircle className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      printerConnected ? "bg-emerald-500" : "bg-red-500"
                    }`}
                  />
                  <span>{printerConnected ? "Siap cetak" : "Belum terhubung"}</span>
                </div>
          </div>
          <Badge variant="secondary" className="text-sm hidden md:flex">
            {cart.reduce((sum, item) => sum + item.quantity, 0)} item
          </Badge>
          {/* Mobile Cart Toggle Button */}
          <Button
            variant="outline"
            size="sm"
            className="md:hidden flex items-center gap-2 relative"
            onClick={() => setIsMobileCartOpen(true)}
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="text-xs">Keranjang</span>
            {cart.length > 0 && (
              <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </Badge>
            )}
          </Button>
            </div>
        </header>

        <div className="p-6 overflow-auto">
          {dataError && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {dataError}
            </div>
          )}

          <div className="mb-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              </div>
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="w-full justify-start">
                <TabsTrigger value="all">Semua</TabsTrigger>
              {categories.map((cat) => (
                <TabsTrigger key={cat.id} value={cat.name}>
                  {cat.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          </div>

          {loadingData && filteredProducts.length === 0 ? (
            <div className="text-sm text-muted-foreground">Memuat produk dari database...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Tidak ada produk ditemukan</p>
            </div>
          ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredProducts.map((product) => (
              <Card
                key={product.id}
                className="cursor-pointer group hover:shadow-lg transition-all duration-200 hover:-translate-y-1 border overflow-hidden"
                onClick={() => handleProductClick(product)}
              >
                <CardContent className="p-0">
                  <div className="aspect-square relative overflow-hidden bg-gradient-to-br from-muted to-muted/50">
                      <Image
                        src={product.image || "/placeholder.svg"}
                        alt={product.name}
                        fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    {!product.available && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Badge variant="destructive" className="text-xs font-semibold">
                          Habis
                      </Badge>
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    <div>
                      <h3 className="font-semibold text-sm mb-1 truncate leading-tight group-hover:text-primary transition-colors">{product.name}</h3>
                      {product.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{product.description}</p>
                      )}
                    </div>
                    <div className="space-y-1.5 pt-1 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-base font-bold text-primary">{formatCurrency(product.price)}</span>
                      </div>
                      {product.trackStock && (
                        <div className="flex items-center gap-1.5">
                          <div className={`h-2 w-2 rounded-full ${product.stockQuantity > 0 ? "bg-emerald-500" : "bg-red-500"}`} />
                          <span className="text-xs text-muted-foreground">
                            Stok: <span className={`font-medium ${product.stockQuantity > 0 ? "text-emerald-600" : "text-red-600"}`}>{product.stockQuantity}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          )}
        </div>
      </div>

      {/* Cart Section - Desktop */}
      <div className="hidden md:flex w-[460px] bg-card border-l flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Pesanan Saat Ini
            </h2>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearCart} className="h-7 w-7">
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2">
            <div className="space-y-1">
              <Label htmlFor="customer" className="text-xs">Nama Pelanggan</Label>
              <Input
                id="customer"
                placeholder="Opsional"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
                <Label htmlFor="table" className="text-xs">Nomor Meja</Label>
              <Input
                id="table"
                  placeholder="Opsional"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                  className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
                <Label htmlFor="order_type" className="text-xs">Tipe Pesanan</Label>
              <Select
                value={orderType}
                onValueChange={(value) =>
                  setOrderType(value as "dine_in" | "takeaway" | "gojek" | "grab" | "shopeefood")
                }
              >
                  <SelectTrigger id="order_type" className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="dine_in">Makan di Tempat</SelectItem>
                    <SelectItem value="takeaway">Bungkus</SelectItem>
                  <SelectItem value="gojek">Gojek</SelectItem>
                  <SelectItem value="grab">Grab</SelectItem>
                  <SelectItem value="shopeefood">ShopeeFood</SelectItem>
                </SelectContent>
              </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="order_note" className="text-xs">Catatan Pesanan</Label>
              <Textarea
                id="order_note"
                placeholder="Catatan untuk dapur atau kasir (opsional)"
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ShoppingCart className="h-16 w-16 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Keranjang kosong</p>
              <p className="text-sm text-muted-foreground">Tambahkan item untuk memulai</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((item) => (
                <Card key={item.productId} className="border border-muted bg-muted/40">
                  <CardContent className="p-2.5">
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex-1 pr-2">
                        <h3 className="font-medium text-sm leading-snug">{item.productName}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatCurrency(item.price)} / item
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-red-600 shrink-0"
                        onClick={() => removeFromCart(item.productId)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t">
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 bg-transparent"
                          onClick={() => updateQuantity(item.productId, -1)}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <span className="min-w-[2rem] text-center font-semibold text-sm">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 bg-transparent"
                          onClick={() => updateQuantity(item.productId, 1)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <span className="font-semibold text-sm">
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
          <div className="space-y-1.5 mb-4">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {taxRate > 0 && tax > 0 && (
            <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Pajak ({taxRate}%)</span>
                <span>{formatCurrency(tax)}</span>
            </div>
            )}
            <div className="flex justify-between text-sm font-bold pt-1.5 border-t">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>
          </div>
          <Button className="w-full" size="lg" onClick={handleCheckout} disabled={cart.length === 0 || processingCheckout}>
            {processingCheckout ? "Memproses..." : "Checkout"}
          </Button>
        </div>
      </div>

      {/* Cart Section - Mobile (Sheet) */}
      <Sheet open={isMobileCartOpen} onOpenChange={setIsMobileCartOpen}>
        <SheetContent side="right" className="w-full sm:w-[400px] p-0 flex flex-col">
          <SheetHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Pesanan Saat Ini
              </SheetTitle>
              {cart.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearCart} className="h-7 w-7">
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
    </div>
          </SheetHeader>

          <div className="flex-1 overflow-auto">
            <div className="p-4 border-b">
              <div className="grid grid-cols-1 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="customer-mobile" className="text-xs">Nama Pelanggan</Label>
                  <Input
                    id="customer-mobile"
                    placeholder="Opsional"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="table-mobile" className="text-xs">Nomor Meja</Label>
                    <Input
                      id="table-mobile"
                      placeholder="Opsional"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="order_type-mobile" className="text-xs">Tipe Pesanan</Label>
                    <Select
                      value={orderType}
                      onValueChange={(value) =>
                        setOrderType(value as "dine_in" | "takeaway" | "gojek" | "grab" | "shopeefood")
                      }
                    >
                      <SelectTrigger id="order_type-mobile" className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dine_in">Makan di Tempat</SelectItem>
                        <SelectItem value="takeaway">Bungkus</SelectItem>
                        <SelectItem value="gojek">Gojek</SelectItem>
                        <SelectItem value="grab">Grab</SelectItem>
                        <SelectItem value="shopeefood">ShopeeFood</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="order_note-mobile" className="text-xs">Catatan Pesanan</Label>
                  <Textarea
                    id="order_note-mobile"
                    placeholder="Catatan untuk dapur atau kasir (opsional)"
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="p-4">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <ShoppingCart className="h-16 w-16 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">Keranjang kosong</p>
                  <p className="text-sm text-muted-foreground">Tambahkan item untuk memulai</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cart.map((item) => (
                    <Card key={item.productId} className="border border-muted bg-muted/40">
                      <CardContent className="p-2.5">
                        <div className="flex items-start justify-between mb-1.5">
                          <div className="flex-1 pr-2">
                            <h3 className="font-medium text-sm leading-snug">{item.productName}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatCurrency(item.price)} / item
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-red-600 shrink-0"
                            onClick={() => removeFromCart(item.productId)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t">
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 bg-transparent"
                              onClick={() => updateQuantity(item.productId, -1)}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="min-w-[2rem] text-center font-semibold text-sm">
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 bg-transparent"
                              onClick={() => updateQuantity(item.productId, 1)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <span className="font-semibold text-sm">
                            {formatCurrency(item.price * item.quantity)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t bg-muted/30">
            <div className="space-y-1.5 mb-4">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {taxRate > 0 && tax > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Pajak ({taxRate}%)</span>
                  <span>{formatCurrency(tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold pt-1.5 border-t">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(total)}</span>
              </div>
            </div>
            <Button 
              className="w-full" 
              size="lg" 
              onClick={() => {
                setIsMobileCartOpen(false)
                handleCheckout()
              }} 
              disabled={cart.length === 0 || processingCheckout}
            >
              {processingCheckout ? "Memproses..." : "Checkout"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Pilih Metode Pembayaran</DialogTitle>
              <DialogDescription>
                Pilih metode pembayaran untuk menyelesaikan transaksi
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {loadingPaymentMethods ? (
                <div className="text-sm text-muted-foreground text-center py-4">Memuat metode pembayaran...</div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="payment-method">Metode Pembayaran</Label>
                    <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
                      <SelectTrigger id="payment-method">
                        <SelectValue placeholder="Pilih metode pembayaran" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMethods.map((method) => (
                          <SelectItem key={method.id} value={method.code}>
                            {method.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amount-paid">Jumlah Bayar</Label>
                    <Input
                      id="amount-paid"
                      type="number"
                      placeholder="0"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      min={0}
                    />
                    <div className="flex gap-2 flex-wrap">
                      <Button type="button" variant="outline" size="sm" onClick={() => handleQuickAmount(total)}>
                        Pas
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => handleQuickAmount(10000)}>
                        Rp 10rb
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => handleQuickAmount(20000)}>
                        Rp 20rb
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => handleQuickAmount(50000)}>
                        Rp 50rb
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => handleQuickAmount(100000)}>
                        Rp 100rb
                      </Button>
                    </div>
                  </div>

                  {Number.parseFloat(amountPaid) > 0 && (
                    <div
                      className={`rounded-lg border p-4 ${
                        Number.parseFloat(amountPaid) >= total
                          ? "bg-green-50 border-green-200"
                          : "bg-red-50 border-red-200"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span
                          className={`font-semibold ${
                            Number.parseFloat(amountPaid) >= total ? "text-green-900" : "text-red-900"
                          }`}
                        >
                          Kembalian
                        </span>
                        <span
                          className={`text-xl font-bold ${
                            Number.parseFloat(amountPaid) >= total ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {formatCurrency(Math.max(0, Number.parseFloat(amountPaid) - total))}
                        </span>
                      </div>
                      {Number.parseFloat(amountPaid) < total && (
                        <p className="text-xs text-red-600 mt-1">Uang bayar kurang!</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsPaymentDialogOpen(false)
                  setAmountPaid("")
                }}
                disabled={processingCheckout}
              >
                Batal
              </Button>
              <Button
                onClick={handleProcessCheckout}
                disabled={!selectedPaymentMethod || processingCheckout || Number.parseFloat(amountPaid || "0") < total}
              >
                {processingCheckout ? "Memproses..." : "Proses Pembayaran"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Variant Selection Dialog */}
        <Dialog open={isVariantDialogOpen} onOpenChange={setIsVariantDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Pilih Varian</DialogTitle>
              <DialogDescription>
                {selectedProductForVariant?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedProductForVariant && (
                <>
                  <div className="space-y-2">
                    <Label>Pilih varian (opsional)</Label>
                    {/* Option for no variant */}
                    <div
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedVariantId === null
                          ? "border-primary bg-primary/5"
                          : "border-muted hover:border-primary/50"
                      }`}
                      onClick={() => setSelectedVariantId(null)}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          checked={selectedVariantId === null}
                          onChange={() => setSelectedVariantId(null)}
                          className="h-4 w-4 text-primary"
                        />
                        <div>
                          <div className="font-medium">Tanpa Varian</div>
                          <div className="text-sm text-muted-foreground">Harga dasar</div>
                        </div>
                      </div>
                      <div className="font-semibold">
                        {formatCurrency(selectedProductForVariant.price)}
                      </div>
                    </div>
                    {/* Variant options */}
                    {productVariants[selectedProductForVariant.id]?.map((variant) => (
                      <div
                        key={variant.id}
                        className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedVariantId === variant.id
                            ? "border-primary bg-primary/5"
                            : "border-muted hover:border-primary/50"
                        }`}
                        onClick={() => setSelectedVariantId(variant.id)}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            checked={selectedVariantId === variant.id}
                            onChange={() => setSelectedVariantId(variant.id)}
                            className="h-4 w-4 text-primary"
                          />
                          <div>
                            <div className="font-medium">{variant.name}</div>
                            {variant.additional_price !== 0 && (
                              <div className="text-sm text-muted-foreground">
                                {variant.additional_price > 0 ? "+" : ""}
                                {formatCurrency(variant.additional_price)}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="font-semibold">
                          {formatCurrency(selectedProductForVariant.price + variant.additional_price)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="font-semibold">Total Harga</span>
                    <span className="text-lg font-bold text-primary">
                      {formatCurrency(
                        selectedProductForVariant.price +
                          (selectedVariantId
                            ? productVariants[selectedProductForVariant.id]?.find(v => v.id === selectedVariantId)?.additional_price || 0
                            : 0)
                      )}
                    </span>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsVariantDialogOpen(false)}>
                Batal
              </Button>
              <Button onClick={() => handleConfirmVariantSelection()}>
                Tambah ke Keranjang
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  )
}
