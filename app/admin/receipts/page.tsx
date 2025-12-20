"use client"

import { useEffect, useMemo, useState } from "react"
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
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { supabaseClient } from "@/lib/supabaseClient"
import { getPrinterInstance, type ReceiptData } from "@/lib/bluetooth-printer"
import { loadSettings } from "@/lib/settings"
import { formatCurrency } from "@/lib/currency"
import { toast } from "sonner"
import { Search, Receipt as ReceiptIcon, Trash2, Printer } from "lucide-react"
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

type ReceiptRow = {
  id: string
  order_id: string
  receipt_number: number | null
  printed_at: string
  printed_by: string | null
  copy_type: string
  print_status?: "pending" | "printed" | "failed"
}

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [copyTypeFilter, setCopyTypeFilter] = useState<"all" | "original" | "reprint">("all")
  const [printerConnected, setPrinterConnected] = useState(false)
  const [connectingPrinter, setConnectingPrinter] = useState(false)
  const [reprintingReceiptId, setReprintingReceiptId] = useState<string | null>(null)
  const [deletingReceiptId, setDeletingReceiptId] = useState<string | null>(null)
  const [showPrinterConnectConfirm, setShowPrinterConnectConfirm] = useState(false)
  const [pendingReprintReceipt, setPendingReprintReceipt] = useState<ReceiptRow | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    order_id: "",
    copy_type: "original",
    note: "",
  })

  useEffect(() => {
    const loadReceipts = async () => {
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

        // Get current user role
        const { data: currentProfile } = await supabaseClient
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single()
        
        if (currentProfile) {
          setCurrentUserRole(currentProfile.role)
        }

        const res = await fetch("/api/admin/receipts?limit=200", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        const json = await res.json()
        if (!res.ok) {
          setError(json.error ?? "Gagal memuat data struk.")
          return
        }

        setReceipts(json.receipts ?? [])
      } catch (err) {
        setError("Terjadi kesalahan saat memuat data struk.")
      } finally {
        setLoading(false)
      }
    }

    loadReceipts()
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

  const handleReprint = async (receipt: ReceiptRow) => {
    if (!supabaseClient) {
      toast.error("Konfigurasi Supabase belum lengkap")
      return
    }

    // Check printer connection
    let isPrinterReady = printerConnected
    try {
      const printer = getPrinterInstance()
      isPrinterReady = printer.isConnected()
      if (!isPrinterReady) {
        setPrinterConnected(false)
      }
    } catch {
      isPrinterReady = false
    }

    if (!isPrinterReady) {
      setPendingReprintReceipt(receipt)
      setShowPrinterConnectConfirm(true)
      return
    }

    // If printer is ready, proceed with reprint
    try {
      setReprintingReceiptId(receipt.id)
      setError(null)

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
      const res = await fetch(`/api/admin/receipts/${receipt.id}`, {
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
      const settings = await loadSettings()

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
        restaurantName: settings.restaurant_name,
        restaurantAddress: settings.restaurant_address,
        restaurantPhone: settings.restaurant_phone,
        footerMessage: settings.receipt_footer,
        taxRate: settings.tax_rate,
      }

      // Print receipt
      const printer = getPrinterInstance()
      const printed = await printer.printReceipt(receiptData)

      // Update print status
      try {
        await fetch(`/api/admin/receipts/${receipt.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ print_status: printed ? "printed" : "failed" }),
        })
      } catch (err) {
        console.error("[RECEIPTS] Failed to update print status:", err)
      }

      if (!printed) {
        toast.error("Gagal mencetak struk", {
          description: "Pastikan printer terhubung dan siap.",
        })
        // Update receipt status in local state
        setReceipts((prev) =>
          prev.map((r) => (r.id === receipt.id ? { ...r, print_status: "failed" as const } : r))
        )
      } else {
        toast.success("Struk berhasil dicetak ulang")
        // Update receipt status in local state
        setReceipts((prev) =>
          prev.map((r) => (r.id === receipt.id ? { ...r, print_status: "printed" as const } : r))
        )
        // Reload receipts to ensure data is fresh
        loadReceipts()
      }
    } catch (err: any) {
      toast.error("Terjadi kesalahan saat mencetak ulang struk", {
        description: err?.message,
      })
    } finally {
      setReprintingReceiptId(null)
    }
  }

  const filteredReceipts = useMemo(
    () =>
      receipts.filter((r) => {
        const matchSearch =
          String(r.receipt_number ?? "").includes(searchQuery) ||
          r.order_id.toLowerCase().includes(searchQuery.toLowerCase())

        const matchType = copyTypeFilter === "all" || r.copy_type === copyTypeFilter

        return matchSearch && matchType
      }),
    [receipts, searchQuery, copyTypeFilter],
  )

  const openDialog = () => {
    setFormData({
      order_id: "",
      copy_type: "original",
      note: "",
    })
    setDialogError(null)
    setIsDialogOpen(true)
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    setDialogError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setDialogError(null)

    if (!supabaseClient) {
      setDialogError("Konfigurasi Supabase belum lengkap. Hubungi administrator.")
      return
    }

    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession()

      if (!session) {
        setDialogError("Sesi login tidak ditemukan. Silakan login kembali.")
        return
      }

      const res = await fetch("/api/admin/receipts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(formData),
      })

      const json = await res.json()
      if (!res.ok) {
        setDialogError(json.error ?? "Gagal membuat struk baru.")
        return
      }

      setReceipts((prev) => [json.receipt, ...prev])
      closeDialog()
    } catch (err) {
      setDialogError("Terjadi kesalahan saat menyimpan struk.")
    }
  }

  const handleDeleteReceipt = (receipt: ReceiptRow) => {
    if (!receipt.id) {
      setError("ID struk tidak valid.")
      return
    }
    setDeletingReceiptId(receipt.id)
  }

  const confirmDeleteReceipt = async () => {
    if (!deletingReceiptId || !supabaseClient) {
      setDeletingReceiptId(null)
      return
    }

    const receipt = receipts.find((r) => r.id === deletingReceiptId)
    if (!receipt) {
      setDeletingReceiptId(null)
      return
    }

    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession()

      if (!session) {
        setError("Sesi login tidak ditemukan. Silakan login kembali.")
        setDeletingReceiptId(null)
        return
      }

      const res = await fetch(`/api/admin/receipts/${receipt.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "Gagal menghapus struk.")
        setDeletingReceiptId(null)
        return
      }

      setReceipts((prev) => prev.filter((r) => r.id !== receipt.id))
      toast.success("Struk berhasil dihapus")
      setDeletingReceiptId(null)
    } catch (err) {
      setError("Terjadi kesalahan saat menghapus struk.")
      setDeletingReceiptId(null)
    }
  }

  const handleConnectPrinterFromConfirm = async () => {
    setShowPrinterConnectConfirm(false)
    await handleConnectPrinter()
    // After connecting, try reprint again if needed
    if (pendingReprintReceipt) {
      await handleReprint(pendingReprintReceipt)
      setPendingReprintReceipt(null)
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Riwayat Struk</h1>
          <p className="text-muted-foreground">
            Lihat dan kelola riwayat struk yang pernah dicetak. Biasanya data ini bersifat arsip.
          </p>
        </div>
        {currentUserRole !== "admin" && (
        <Button onClick={openDialog}>
          <ReceiptIcon className="h-4 w-4 mr-2" />
          Tambah Struk Manual
        </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari no struk atau ID order..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
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
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Tipe:</span>
          <Button
            variant={copyTypeFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setCopyTypeFilter("all")}
          >
            Semua
          </Button>
          <Button
            variant={copyTypeFilter === "original" ? "default" : "outline"}
            size="sm"
            onClick={() => setCopyTypeFilter("original")}
          >
            Original
          </Button>
          <Button
            variant={copyTypeFilter === "reprint" ? "default" : "outline"}
            size="sm"
            onClick={() => setCopyTypeFilter("reprint")}
          >
            Reprint
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>No Struk</TableHead>
            <TableHead>ID Order</TableHead>
            <TableHead>Tipe</TableHead>
            <TableHead>Status Print</TableHead>
            <TableHead>Tanggal Cetak</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredReceipts.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono text-xs">
                {r.receipt_number !== null ? `#${r.receipt_number}` : <span className="text-muted-foreground">-</span>}
              </TableCell>
              <TableCell className="font-mono text-xs">{r.order_id}</TableCell>
              <TableCell>
                <Badge variant={r.copy_type === "original" ? "default" : "secondary"}>
                  {r.copy_type === "original" ? "Original" : "Reprint"}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    r.print_status === "printed"
                      ? "default"
                      : r.print_status === "failed"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {r.print_status === "printed"
                    ? "Sudah Print"
                    : r.print_status === "failed"
                      ? "Gagal Print"
                      : r.print_status === "pending"
                        ? "Belum Print"
                        : "Tidak diketahui"}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {new Date(r.printed_at).toLocaleString("id-ID")}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Cetak ulang struk"
                    onClick={() => handleReprint(r)}
                    disabled={reprintingReceiptId === r.id}
                  >
                    <Printer className="h-3 w-3" />
                  </Button>
                  <AlertDialog open={deletingReceiptId === r.id} onOpenChange={(open) => !open && setDeletingReceiptId(null)}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Hapus struk"
                        onClick={() => handleDeleteReceipt(r)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Struk</AlertDialogTitle>
                        <AlertDialogDescription>
                          Apakah Anda yakin ingin menghapus struk #{r.receipt_number ?? "?"} untuk order {r.order_id}?
                          Tindakan ini tidak dapat dibatalkan.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeletingReceiptId(null)}>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteReceipt} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Hapus
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {filteredReceipts.length === 0 && !loading && !error && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                Belum ada struk yang cocok dengan filter.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableCaption>
          Menampilkan {filteredReceipts.length} struk dari total {receipts.length} (tergantung filter dan pencarian).
        </TableCaption>
      </Table>

      {loading && !error && <p className="text-sm text-muted-foreground">Memuat data struk...</p>}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah Struk Manual</DialogTitle>
            <DialogDescription>
              Buat entri struk baru secara manual, misalnya untuk kebutuhan koreksi atau arsip tambahan.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-5 py-4">
              <div className="space-y-2">
                <Label htmlFor="order_id">ID Order</Label>
                <Input
                  id="order_id"
                  value={formData.order_id}
                  onChange={(e) => setFormData({ ...formData, order_id: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="copy_type">Tipe Struk</Label>
                <select
                  id="copy_type"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.copy_type}
                  onChange={(e) => setFormData({ ...formData, copy_type: e.target.value as "original" | "reprint" })}
                >
                  <option value="original">Original</option>
                  <option value="reprint">Reprint</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">Catatan (opsional)</Label>
                <Input
                  id="note"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  placeholder="Mis. koreksi manual, test, dsb."
                />
              </div>

              {dialogError && <p className="text-sm text-red-500">{dialogError}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Batal
              </Button>
              <Button type="submit">Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Printer Connection Confirmation Dialog */}
      <AlertDialog open={showPrinterConnectConfirm} onOpenChange={setShowPrinterConnectConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Printer Belum Terhubung</AlertDialogTitle>
            <AlertDialogDescription>
              Printer belum terhubung. Hubungkan printer terlebih dahulu sebelum mencetak struk?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingReprintReceipt(null)}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleConnectPrinterFromConfirm}>Hubungkan Printer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}


