"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { supabaseClient } from "@/lib/supabaseClient"
import { formatCurrency } from "@/lib/currency"
import { toast } from "sonner"
import { Plus, ArrowDownCircle, ArrowUpCircle, Trash2, Wallet } from "lucide-react"

type FinancialTransaction = {
  id: string
  transactionType: "income" | "withdrawal"
  amount: number
  notes?: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export default function FinancePage() {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([])
  const [currentBalance, setCurrentBalance] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isIncomeDialogOpen, setIsIncomeDialogOpen] = useState(false)
  const [isWithdrawalDialogOpen, setIsWithdrawalDialogOpen] = useState(false)
  const [transactionType, setTransactionType] = useState<"income" | "withdrawal">("income")
  const [amount, setAmount] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)

  useEffect(() => {
    loadTransactions()
  }, [])

  const loadTransactions = async () => {
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

      const res = await fetch("/api/admin/finance", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "Gagal memuat data transaksi.")
        return
      }

      setTransactions(json.transactions ?? [])
      setCurrentBalance(json.currentBalance ?? 0)
    } catch (err: any) {
      setError("Terjadi kesalahan saat memuat data transaksi.")
      console.error("Error loading transactions:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) {
      toast.error("Jumlah harus lebih dari 0")
      return
    }

    if (!supabaseClient) {
      toast.error("Konfigurasi Supabase belum lengkap")
      return
    }

    try {
      setSubmitting(true)

      const {
        data: { session },
      } = await supabaseClient.auth.getSession()

      if (!session) {
        toast.error("Sesi login tidak ditemukan")
        return
      }

      const res = await fetch("/api/admin/finance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          transaction_type: transactionType,
          amount: Number(amount),
          notes: notes.trim() || undefined,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Gagal menambahkan transaksi")
        return
      }

      toast.success(
        transactionType === "income"
          ? "Pendapatan berhasil ditambahkan"
          : "Penarikan uang berhasil dicatat"
      )

      // Reset form
      setAmount("")
      setNotes("")
      setIsIncomeDialogOpen(false)
      setIsWithdrawalDialogOpen(false)

      // Reload transactions
      await loadTransactions()
    } catch (err: any) {
      toast.error("Terjadi kesalahan saat menambahkan transaksi")
      console.error("Error submitting transaction:", err)
    } finally {
      setSubmitting(false)
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

      const res = await fetch(`/api/admin/finance/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Gagal menghapus transaksi")
        return
      }

      toast.success("Transaksi berhasil dihapus")
      await loadTransactions()
    } catch (err: any) {
      toast.error("Terjadi kesalahan saat menghapus transaksi")
      console.error("Error deleting transaction:", err)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Manajemen Keuangan</h1>
        <p className="text-muted-foreground">Catat pendapatan dan penarikan uang untuk melacak keuangan restoran.</p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Balance Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Saldo Saat Ini
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-primary">{formatCurrency(currentBalance)}</div>
          <p className="text-sm text-muted-foreground mt-2">
            Total pendapatan dikurangi total penarikan uang
          </p>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {currentUserRole !== "admin" && (
        <div className="flex gap-4 mb-6">
          <Dialog open={isIncomeDialogOpen} onOpenChange={setIsIncomeDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setTransactionType("income")
                setAmount("")
                setNotes("")
              }}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Tambah Pendapatan
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Pendapatan</DialogTitle>
              <DialogDescription>Catat jumlah pendapatan yang masuk ke kas.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="income-amount">Jumlah (Rp)</Label>
                <Input
                  id="income-amount"
                  type="number"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1"
                  step="0.01"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="income-notes">Catatan (Opsional)</Label>
                <Textarea
                  id="income-notes"
                  placeholder="Contoh: Setoran dari penjualan hari ini"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsIncomeDialogOpen(false)}>
                Batal
              </Button>
              <Button
                onClick={() => {
                  setTransactionType("income")
                  handleSubmit()
                }}
                disabled={submitting}
              >
                {submitting ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isWithdrawalDialogOpen} onOpenChange={setIsWithdrawalDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              onClick={() => {
                setTransactionType("withdrawal")
                setAmount("")
                setNotes("")
              }}
              className="flex items-center gap-2"
            >
              <ArrowDownCircle className="h-4 w-4" />
              Tarik Uang
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tarik Uang</DialogTitle>
              <DialogDescription>Catat penarikan uang dari kas dengan keterangan.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="withdrawal-amount">Jumlah (Rp)</Label>
                <Input
                  id="withdrawal-amount"
                  type="number"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1"
                  step="0.01"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="withdrawal-notes">Catatan *</Label>
                <Textarea
                  id="withdrawal-notes"
                  placeholder="Contoh: Bayar supplier bahan baku"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Catatan wajib diisi untuk penarikan uang
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsWithdrawalDialogOpen(false)}>
                Batal
              </Button>
              <Button
                onClick={() => {
                  setTransactionType("withdrawal")
                  handleSubmit()
                }}
                disabled={submitting || !notes.trim()}
              >
                {submitting ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      )}

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Riwayat Transaksi</CardTitle>
          <CardDescription>Daftar semua transaksi keuangan yang tercatat</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Memuat data transaksi...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Belum ada transaksi yang tercatat</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Catatan</TableHead>
                  <TableHead>Dibuat Oleh</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      {new Date(transaction.createdAt).toLocaleString("id-ID", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={transaction.transactionType === "income" ? "default" : "secondary"}
                        className="flex items-center gap-1 w-fit"
                      >
                        {transaction.transactionType === "income" ? (
                          <ArrowUpCircle className="h-3 w-3" />
                        ) : (
                          <ArrowDownCircle className="h-3 w-3" />
                        )}
                        {transaction.transactionType === "income" ? "Pendapatan" : "Penarikan"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {transaction.transactionType === "income" ? "+" : "-"}
                      {formatCurrency(transaction.amount)}
                    </TableCell>
                    <TableCell>{transaction.notes || "-"}</TableCell>
                    <TableCell>{transaction.createdBy}</TableCell>
                    <TableCell className="text-right">
                      {currentUserRole === "admin" ? (
                        <span className="text-xs text-muted-foreground italic">Read-only</span>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Hapus transaksi</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Hapus Transaksi</AlertDialogTitle>
                              <AlertDialogDescription>
                                Transaksi ini akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(transaction.id)}>
                                Hapus
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

