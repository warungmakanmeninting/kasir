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
import { Switch } from "@/components/ui/switch"
import { Search, CreditCard, Pencil, Trash2, ArrowUpDown } from "lucide-react"
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
import { toast } from "sonner"

type PaymentMethodRow = {
  id: string
  code: string
  name: string
  is_active: boolean
  sort_order: number
  created_at: string
}

export default function PaymentMethodsPage() {
  const [methods, setMethods] = useState<PaymentMethodRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingMethod, setEditingMethod] = useState<PaymentMethodRow | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [deletingMethodId, setDeletingMethodId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    sort_order: "",
    is_active: true,
  })

  useEffect(() => {
    const loadMethods = async () => {
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

        const res = await fetch("/api/admin/payment-methods", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        const json = await res.json()
        if (!res.ok) {
          setError(json.error ?? "Gagal memuat data metode pembayaran.")
          return
        }

        setMethods(json.paymentMethods ?? [])
      } catch (err) {
        setError("Terjadi kesalahan saat memuat data metode pembayaran.")
      } finally {
        setLoading(false)
      }
    }

    loadMethods()
  }, [])

  const filteredMethods = useMemo(
    () =>
      methods.filter((m) => {
        const matchSearch =
          m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.code.toLowerCase().includes(searchQuery.toLowerCase())

        const matchStatus =
          statusFilter === "all" ||
          (statusFilter === "active" && m.is_active) ||
          (statusFilter === "inactive" && !m.is_active)

        return matchSearch && matchStatus
      }),
    [methods, searchQuery, statusFilter],
  )

  const openDialog = (method?: PaymentMethodRow) => {
    if (method) {
      setEditingMethod(method)
      setFormData({
        code: method.code,
        name: method.name,
        sort_order: String(method.sort_order ?? ""),
        is_active: method.is_active,
      })
    } else {
      setEditingMethod(null)
      setFormData({
        code: "",
        name: "",
        sort_order: String((methods[methods.length - 1]?.sort_order ?? 0) + 1),
        is_active: true,
      })
    }
    setDialogError(null)
    setIsDialogOpen(true)
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    setDialogError(null)
    setEditingMethod(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setDialogError(null)

    if (!supabaseClient) {
      setDialogError("Konfigurasi Supabase belum lengkap. Hubungi administrator.")
      return
    }

    const sortOrderNum = formData.sort_order ? Number.parseInt(formData.sort_order, 10) : 0
    if (Number.isNaN(sortOrderNum)) {
      setDialogError("Urutan tampilan harus berupa angka.")
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

      if (editingMethod) {
        if (!editingMethod.id) {
          setDialogError("ID metode pembayaran tidak valid.")
          return
        }
        const res = await fetch(`/api/admin/payment-methods/${editingMethod.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            code: formData.code,
            name: formData.name,
            sort_order: sortOrderNum,
            is_active: formData.is_active,
          }),
        })

        const json = await res.json()
        if (!res.ok) {
          setDialogError(json.error ?? "Gagal mengubah metode pembayaran.")
          return
        }

        setMethods((prev) => prev.map((m) => (m.id === editingMethod.id ? json.paymentMethod : m)))
      } else {
        const res = await fetch("/api/admin/payment-methods", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            code: formData.code,
            name: formData.name,
            sort_order: sortOrderNum,
            is_active: formData.is_active,
          }),
        })

        const json = await res.json()
        if (!res.ok) {
          setDialogError(json.error ?? "Gagal membuat metode pembayaran baru.")
          return
        }

        setMethods((prev) => [...prev, json.paymentMethod])
      }

      closeDialog()
    } catch (err) {
      setDialogError("Terjadi kesalahan saat menyimpan metode pembayaran.")
    }
  }

  const handleDeleteMethod = async (method: PaymentMethodRow) => {
    if (!supabaseClient) {
      setError("Konfigurasi Supabase belum lengkap. Hubungi administrator.")
      return
    }

    if (!method.id) {
      setError("ID metode pembayaran tidak valid.")
      return
    }

    setDeletingMethodId(method.id)
  }

  const confirmDeleteMethod = async () => {
    if (!deletingMethodId || !supabaseClient) {
      setDeletingMethodId(null)
      return
    }

    const method = methods.find((m) => m.id === deletingMethodId)
    if (!method) {
      setDeletingMethodId(null)
      return
    }

    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession()

      if (!session) {
        setError("Sesi login tidak ditemukan. Silakan login kembali.")
        return
      }

      const res = await fetch(`/api/admin/payment-methods/${method.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "Gagal menghapus metode pembayaran.")
        return
      }

      setMethods((prev) => prev.filter((m) => m.id !== method.id))
    } catch (err) {
      setError("Terjadi kesalahan saat menghapus metode pembayaran.")
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Metode Pembayaran</h1>
          <p className="text-muted-foreground">
            Kelola daftar metode pembayaran yang tersedia di kasir (misalnya Cash, QRIS, Transfer Bank).
          </p>
        </div>
        <Button onClick={() => openDialog()}>
          <CreditCard className="h-4 w-4 mr-2" />
          Tambah Metode
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari kode atau nama..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Status:</span>
          <Button
            variant={statusFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("all")}
          >
            Semua
          </Button>
          <Button
            variant={statusFilter === "active" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("active")}
          >
            Aktif
          </Button>
          <Button
            variant={statusFilter === "inactive" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("inactive")}
          >
            Nonaktif
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kode</TableHead>
            <TableHead>Nama</TableHead>
            <TableHead className="text-right">
              Urutan
              <ArrowUpDown className="ml-1 inline h-3 w-3" />
            </TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredMethods.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="font-mono text-xs uppercase">{m.code}</TableCell>
              <TableCell>{m.name}</TableCell>
              <TableCell className="text-right">{m.sort_order}</TableCell>
              <TableCell>
                <Badge variant={m.is_active ? "default" : "secondary"}>{m.is_active ? "Aktif" : "Nonaktif"}</Badge>
              </TableCell>
              <TableCell className="text-right">
                {currentUserRole === "admin" ? (
                  <span className="text-xs text-muted-foreground italic">Read-only</span>
                ) : (
                  <div className="inline-flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      title="Edit metode"
                      onClick={() => openDialog(m)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <AlertDialog open={deletingMethodId === m.id} onOpenChange={(open) => !open && setDeletingMethodId(null)}>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Hapus metode"
                          onClick={() => handleDeleteMethod(m)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Metode Pembayaran</AlertDialogTitle>
                        <AlertDialogDescription>
                          Apakah Anda yakin ingin menghapus metode pembayaran "{m.name}" ({m.code})? Tindakan ini tidak dapat dibatalkan.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeletingMethodId(null)}>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteMethod} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Hapus
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
          {filteredMethods.length === 0 && !loading && !error && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                Belum ada metode pembayaran yang cocok dengan filter.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableCaption>
          Menampilkan {filteredMethods.length} metode dari total {methods.length} (tergantung filter dan pencarian).
        </TableCaption>
      </Table>

      {loading && !error && <p className="text-sm text-muted-foreground">Memuat data metode pembayaran...</p>}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingMethod ? "Edit Metode Pembayaran" : "Tambah Metode Pembayaran"}</DialogTitle>
            <DialogDescription>
              {editingMethod
                ? "Perbarui data metode pembayaran. Perubahan akan langsung tersedia di kasir."
                : "Buat metode pembayaran baru yang dapat dipilih kasir saat melakukan transaksi."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-5 py-4">
              <div className="space-y-2">
                <Label htmlFor="code">Kode (unik, huruf kecil)</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="mis. cash, qris, transfer"
                  required
                  disabled={!!editingMethod}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nama Tampilan</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="mis. Cash, QRIS, Transfer Bank"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sort_order">Urutan Tampilan</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
                <div className="space-y-0.5">
                  <Label htmlFor="is_active" className="font-normal">
                    Status aktif
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Nonaktifkan metode pembayaran jika sementara tidak digunakan.
                  </p>
                </div>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>

              {dialogError && <p className="text-sm text-red-500">{dialogError}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Batal
              </Button>
              <Button type="submit">{editingMethod ? "Simpan Perubahan" : "Simpan"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}


