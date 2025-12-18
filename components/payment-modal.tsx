"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/currency"
import { supabaseClient } from "@/lib/supabaseClient"
import { Printer, Loader2 } from "lucide-react"
import type { OrderItem } from "@/lib/types"
import { getPrinterInstance, type ReceiptData } from "@/lib/bluetooth-printer"
import { loadSettings, type AppSettings } from "@/lib/settings"

type PaymentMethod = {
  id: string
  code: string
  name: string
  is_active: boolean
}

interface PaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cart: OrderItem[]
  subtotal: number
  tax: number
  total: number
  customerName?: string
  tableNumber?: string
  orderType?: "dine_in" | "takeaway" | "gojek" | "grab" | "shopeefood"
  orderNote?: string
  onPaymentComplete: () => void
}

export function PaymentModal({
  open,
  onOpenChange,
  cart,
  subtotal,
  tax,
  total,
  customerName,
  tableNumber,
  orderType,
  orderNote,
  onPaymentComplete,
}: PaymentModalProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [selectedMethod, setSelectedMethod] = useState<string>("")
  const [amountPaid, setAmountPaid] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [printerConnected, setPrinterConnected] = useState(false)
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    const loadPaymentMethods = async () => {
      if (!supabaseClient || !open) return

      try {
        setLoading(true)

        // Load settings and payment methods in parallel
        const [settingsData, paymentData] = await Promise.all([
          loadSettings(),
          supabaseClient
            .from("payment_methods")
            .select("id, code, name, is_active")
            .eq("is_active", true)
            .order("sort_order", { ascending: true }),
        ])

        setSettings(settingsData)

        if (paymentData.error) throw paymentData.error

        setPaymentMethods(paymentData.data ?? [])
        if (paymentData.data && paymentData.data.length > 0) {
          setSelectedMethod(paymentData.data[0].code)
        }
      } catch (err) {
        setError("Gagal memuat metode pembayaran")
      } finally {
        setLoading(false)
      }
    }

    loadPaymentMethods()
  }, [open])

  useEffect(() => {
    // Check printer connection status
    const printer = getPrinterInstance()
    setPrinterConnected(printer.isConnected())
  }, [open])

  const amountPaidNum = Number.parseFloat(amountPaid) || 0
  const change = amountPaidNum - total
  const isValidPayment = amountPaidNum >= total && selectedMethod !== ""

  const handleConnectPrinter = async () => {
    try {
      setProcessing(true)
      const printer = getPrinterInstance()
      const connected = await printer.connect()
      setPrinterConnected(connected)
      if (!connected) {
        setError("Gagal terhubung ke printer. Pastikan printer menyala dan bluetooth aktif.")
      }
    } catch (err) {
      setError("Gagal terhubung ke printer")
    } finally {
      setProcessing(false)
    }
  }

  const handlePayment = async () => {
    if (!isValidPayment) return
    if (!supabaseClient) {
      setError("Konfigurasi Supabase belum lengkap")
      return
    }

    try {
      setProcessing(true)
      setError(null)

      const {
        data: { session },
      } = await supabaseClient.auth.getSession()

      if (!session) {
        setError("Sesi login tidak ditemukan. Silakan login kembali.")
        return
      }

      // Generate receipt number
      const receiptNumber = `INV-${Date.now()}`

      // Get payment method ID
      const paymentMethod = paymentMethods.find((m) => m.code === selectedMethod)
      if (!paymentMethod) {
        setError("Metode pembayaran tidak valid")
        return
      }

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
          customer_name: customerName,
          table_number: tableNumber,
          order_type: orderType || "dine_in",
          note: orderNote,
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
        throw new Error(errorData.error || "Gagal menyimpan order")
      }

      const { order } = await orderRes.json()

      // Save receipt to database
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
        // eslint-disable-next-line no-console
        console.error("Failed to save receipt:", errorData.error)
        // Continue anyway - receipt is optional
      }

      // Print receipt if printer connected and auto-print enabled
      const shouldAutoPrint = settings?.auto_print_receipt ?? true
      
      if (printerConnected && shouldAutoPrint) {
        const printer = getPrinterInstance()
        const receiptData: ReceiptData = {
          receiptNumber,
          orderDate: new Date(),
          customerName,
          tableNumber,
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
        if (!printed) {
          // eslint-disable-next-line no-alert
          const retry = confirm("Gagal mencetak struk. Coba lagi?")
          if (retry) {
            await printer.printReceipt(receiptData)
          }
        }
      } else if (printerConnected && !shouldAutoPrint) {
        // Manual print button could be added here if needed
        console.log("Auto-print disabled. Receipt data saved to database.")
      }

      // Complete payment
      onPaymentComplete()
      onOpenChange(false)
    } catch (err) {
      setError("Terjadi kesalahan saat memproses pembayaran")
    } finally {
      setProcessing(false)
    }
  }

  const handleQuickAmount = (multiplier: number) => {
    const roundedAmount = Math.ceil(total / multiplier) * multiplier
    setAmountPaid(roundedAmount.toString())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pembayaran</DialogTitle>
          <DialogDescription>Pilih metode pembayaran dan masukkan jumlah uang yang dibayarkan</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Summary */}
          <div className="rounded-lg border p-4 space-y-2 bg-muted/30">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {(settings?.tax_rate ?? 0) > 0 && tax > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pajak ({settings?.tax_rate}%)</span>
                <span>{formatCurrency(tax)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Payment Method */}
          {loading ? (
            <div className="text-sm text-muted-foreground">Memuat metode pembayaran...</div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="payment-method">Metode Pembayaran</Label>
              <Select value={selectedMethod} onValueChange={setSelectedMethod}>
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
          )}

          {/* Amount Paid */}
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
              <Button type="button" variant="outline" size="sm" onClick={() => handleQuickAmount(1000)}>
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

          {/* Change */}
          {amountPaidNum > 0 && (
            <div
              className={`rounded-lg border p-4 ${change >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
            >
              <div className="flex justify-between items-center">
                <span className={`font-semibold ${change >= 0 ? "text-green-900" : "text-red-900"}`}>Kembalian</span>
                <span className={`text-xl font-bold ${change >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(Math.max(0, change))}
                </span>
              </div>
              {change < 0 && <p className="text-xs text-red-600 mt-1">Uang bayar kurang!</p>}
            </div>
          )}

          {/* Printer Status */}
          <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
            <div className="flex items-center gap-2">
              <Printer className="h-4 w-4" />
              <span className="text-sm">Printer</span>
            </div>
            {printerConnected ? (
              <Badge variant="default">Terhubung</Badge>
            ) : (
              <Button variant="outline" size="sm" onClick={handleConnectPrinter} disabled={processing}>
                {processing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Hubungkan"}
              </Button>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
            Batal
          </Button>
          <Button onClick={handlePayment} disabled={!isValidPayment || processing}>
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Memproses...
              </>
            ) : (
              "Bayar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

