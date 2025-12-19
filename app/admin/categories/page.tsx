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
import { Search, Tags, Pencil, Trash2, ArrowUpDown } from "lucide-react"
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

type CategoryRow = {
  id: string
  name: string
  is_active: boolean
  sort_order: number
  created_at: string
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    sort_order: "",
    is_active: true,
  })

  useEffect(() => {
    const loadCategories = async () => {
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

        const res = await fetch("/api/admin/categories", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        const json = await res.json()
        if (!res.ok) {
          setError(json.error ?? "Gagal memuat data kategori.")
          return
        }

        setCategories(json.categories ?? [])
      } catch (err) {
        setError("Terjadi kesalahan saat memuat data kategori.")
      } finally {
        setLoading(false)
      }
    }

    loadCategories()
  }, [])

  const filteredCategories = useMemo(
    () =>
      categories.filter((cat) => {
        const matchSearch = cat.name.toLowerCase().includes(searchQuery.toLowerCase())

        const matchStatus =
          statusFilter === "all" ||
          (statusFilter === "active" && cat.is_active) ||
          (statusFilter === "inactive" && !cat.is_active)

        return matchSearch && matchStatus
      }),
    [categories, searchQuery, statusFilter],
  )

  const openDialog = (category?: CategoryRow) => {
    if (category) {
      setEditingCategory(category)
      setFormData({
        name: category.name,
        sort_order: String(category.sort_order ?? ""),
        is_active: category.is_active,
      })
    } else {
      setEditingCategory(null)
      setFormData({
        name: "",
        sort_order: String((categories[categories.length - 1]?.sort_order ?? 0) + 1),
        is_active: true,
      })
    }
    setDialogError(null)
    setIsDialogOpen(true)
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    setDialogError(null)
    setEditingCategory(null)
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

      if (editingCategory) {
        if (!editingCategory.id) {
          setDialogError("ID kategori tidak valid.")
          return
        }
        const res = await fetch(`/api/admin/categories/${editingCategory.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            name: formData.name,
            sort_order: sortOrderNum,
            is_active: formData.is_active,
          }),
        })

        const json = await res.json()
        if (!res.ok) {
          setDialogError(json.error ?? "Gagal mengubah kategori.")
          return
        }

        setCategories((prev) => prev.map((c) => (c.id === editingCategory.id ? json.category : c)))
      } else {
        const res = await fetch("/api/admin/categories", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            name: formData.name,
            sort_order: sortOrderNum,
            is_active: formData.is_active,
          }),
        })

        const json = await res.json()
        if (!res.ok) {
          setDialogError(json.error ?? "Gagal membuat kategori baru.")
          return
        }

        setCategories((prev) => [...prev, json.category])
      }

      closeDialog()
    } catch (err) {
      setDialogError("Terjadi kesalahan saat menyimpan kategori.")
    }
  }

  const handleDeleteCategory = async (category: CategoryRow) => {
    if (!supabaseClient) {
      setError("Konfigurasi Supabase belum lengkap. Hubungi administrator.")
      return
    }

    if (!category.id) {
      setError("ID kategori tidak valid.")
      return
    }

    setDeletingCategoryId(category.id)
  }

  const confirmDeleteCategory = async () => {
    if (!deletingCategoryId || !supabaseClient) {
      setDeletingCategoryId(null)
      return
    }

    const category = categories.find((c) => c.id === deletingCategoryId)
    if (!category) {
      setDeletingCategoryId(null)
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

      const res = await fetch(`/api/admin/categories/${category.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "Gagal menghapus kategori.")
        return
      }

      setCategories((prev) => prev.filter((c) => c.id !== category.id))
    } catch (err) {
      setError("Terjadi kesalahan saat menghapus kategori.")
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Kategori Menu</h1>
          <p className="text-muted-foreground">
            Kelola daftar kategori menu (misalnya Appetizer, Main Course, Dessert, dll).
          </p>
        </div>
        {currentUserRole !== "admin" && (
          <Button onClick={() => openDialog()}>
            <Tags className="h-4 w-4 mr-2" />
            Tambah Kategori
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari nama kategori..."
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
          {filteredCategories.map((cat) => (
            <TableRow key={cat.id}>
              <TableCell>{cat.name}</TableCell>
              <TableCell className="text-right">{cat.sort_order}</TableCell>
              <TableCell>
                <Badge variant={cat.is_active ? "default" : "secondary"}>
                  {cat.is_active ? "Aktif" : "Nonaktif"}
                </Badge>
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
                      title="Edit kategori"
                      onClick={() => openDialog(cat)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <AlertDialog open={deletingCategoryId === cat.id} onOpenChange={(open) => !open && setDeletingCategoryId(null)}>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Hapus kategori"
                          onClick={() => handleDeleteCategory(cat)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Kategori</AlertDialogTitle>
                        <AlertDialogDescription>
                          Apakah Anda yakin ingin menghapus kategori "{cat.name}"?
                          <br />
                          <br />
                          <strong>Perhatian:</strong> Jika masih ada produk yang menggunakan kategori ini, penghapusan bisa gagal.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeletingCategoryId(null)}>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteCategory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
          {filteredCategories.length === 0 && !loading && !error && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                Belum ada kategori yang cocok dengan filter.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableCaption>
          Menampilkan {filteredCategories.length} kategori dari total {categories.length} (tergantung filter dan
          pencarian).
        </TableCaption>
      </Table>

      {loading && !error && <p className="text-sm text-muted-foreground">Memuat data kategori...</p>}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Kategori" : "Tambah Kategori Baru"}</DialogTitle>
            <DialogDescription>
              {editingCategory
                ? "Perbarui data kategori. Perubahan akan langsung mempengaruhi tampilan di kasir."
                : "Buat kategori baru untuk mengelompokkan menu di kasir."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-5 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama Kategori</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                    Nonaktifkan kategori jika sementara tidak digunakan di kasir.
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
              <Button type="submit">{editingCategory ? "Simpan Perubahan" : "Simpan"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}


