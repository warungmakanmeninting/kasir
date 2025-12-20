"use client"

import { useEffect, useMemo, useState } from "react"
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
} from "@/components/ui/dialog"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { supabaseClient } from "@/lib/supabaseClient"
import { Settings as SettingsIcon, Pencil, Trash2, Plus, Search } from "lucide-react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { clearSettingsCache } from "@/lib/settings"

type SettingRow = {
  id: string
  key: string
  value: string
  description: string | null
  category: string
  created_at: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSetting, setEditingSetting] = useState<SettingRow | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    key: "",
    value: "",
    description: "",
    category: "general",
  })

  useEffect(() => {
    const loadSettings = async () => {
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

        const res = await fetch("/api/admin/settings", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        const json = await res.json()
        if (!res.ok) {
          setError(json.error ?? "Gagal memuat data pengaturan.")
          return
        }

        setSettings(json.settings ?? [])
      } catch (err) {
        setError("Terjadi kesalahan saat memuat data pengaturan.")
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [])

  const categories = useMemo(() => {
    const cats = new Set(settings.map((s) => s.category))
    return Array.from(cats).sort()
  }, [settings])

  const filteredSettings = useMemo(
    () =>
      settings.filter((setting) => {
        const matchSearch =
          setting.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
          setting.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (setting.description || "").toLowerCase().includes(searchQuery.toLowerCase())

        const matchCategory = categoryFilter === "all" || setting.category === categoryFilter

        return matchSearch && matchCategory
      }),
    [settings, searchQuery, categoryFilter],
  )

  const openDialog = (setting?: SettingRow) => {
    if (setting) {
      setEditingSetting(setting)
      setFormData({
        key: setting.key,
        value: setting.value,
        description: setting.description || "",
        category: setting.category,
      })
    } else {
      setEditingSetting(null)
      setFormData({
        key: "",
        value: "",
        description: "",
        category: "general",
      })
    }
    setDialogError(null)
    setIsDialogOpen(true)
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    setDialogError(null)
    setEditingSetting(null)
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

      if (editingSetting) {
        if (!editingSetting.id) {
          setDialogError("ID setting tidak valid.")
          return
        }

        const res = await fetch(`/api/admin/settings/${editingSetting.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            value: formData.value,
            description: formData.description || null,
            category: formData.category,
          }),
        })

        const json = await res.json()
        if (!res.ok) {
          setDialogError(json.error ?? "Gagal mengubah pengaturan.")
          return
        }

        setSettings((prev) => prev.map((s) => (s.id === editingSetting.id ? json.setting : s)))
      } else {
        const res = await fetch("/api/admin/settings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(formData),
        })

        const json = await res.json()
        if (!res.ok) {
          setDialogError(json.error ?? "Gagal membuat pengaturan baru.")
          return
        }

        setSettings((prev) => [...prev, json.setting])
      }

      // Clear settings cache to force reload
      clearSettingsCache()

      closeDialog()
    } catch (err) {
      setDialogError("Terjadi kesalahan saat menyimpan pengaturan.")
    }
  }

  const handleDeleteSetting = async (setting: SettingRow) => {
    if (!supabaseClient) {
      setError("Konfigurasi Supabase belum lengkap. Hubungi administrator.")
      return
    }

    if (!setting.id) {
      setError("ID setting tidak valid.")
      return
    }

    setDeletingSettingId(setting.id)
  }

  const confirmDeleteSetting = async () => {
    if (!deletingSettingId || !supabaseClient) {
      setDeletingSettingId(null)
      return
    }

    const setting = settings.find((s) => s.id === deletingSettingId)
    if (!setting) {
      setDeletingSettingId(null)
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

      const res = await fetch(`/api/admin/settings/${setting.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "Gagal menghapus pengaturan.")
        return
      }

      setSettings((prev) => prev.filter((s) => s.id !== setting.id))
      
      // Clear settings cache to force reload
      clearSettingsCache()
    } catch (err) {
      setError("Terjadi kesalahan saat menghapus pengaturan.")
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Pengaturan</h1>
          <p className="text-muted-foreground">
            Kelola pengaturan aplikasi dan konfigurasi sistem. Perubahan akan diterapkan otomatis di seluruh aplikasi.
          </p>
        </div>
        {currentUserRole !== "admin" && (
        <Button onClick={() => openDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Pengaturan
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
            placeholder="Cari pengaturan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Kategori:</span>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Deskripsi</TableHead>
            <TableHead>Kategori</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredSettings.map((setting) => (
            <TableRow key={setting.id}>
              <TableCell className="font-mono text-xs">{setting.key}</TableCell>
              <TableCell className="max-w-xs truncate">{setting.value}</TableCell>
              <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                {setting.description || "-"}
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium">
                  {setting.category}
                </span>
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
                    title="Edit pengaturan"
                    onClick={() => openDialog(setting)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <AlertDialog open={deletingSettingId === setting.id} onOpenChange={(open) => !open && setDeletingSettingId(null)}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Hapus pengaturan"
                        onClick={() => handleDeleteSetting(setting)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Pengaturan</AlertDialogTitle>
                        <AlertDialogDescription>
                          Apakah Anda yakin ingin menghapus pengaturan "{setting.key}"? Tindakan ini tidak dapat dibatalkan.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeletingSettingId(null)}>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteSetting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
          {filteredSettings.length === 0 && !loading && !error && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                Belum ada pengaturan yang cocok dengan filter.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableCaption>
          Menampilkan {filteredSettings.length} pengaturan dari total {settings.length}.
        </TableCaption>
      </Table>

      {loading && !error && <p className="text-sm text-muted-foreground">Memuat data pengaturan...</p>}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSetting ? "Edit Pengaturan" : "Tambah Pengaturan Baru"}</DialogTitle>
            <DialogDescription>
              {editingSetting
                ? "Perbarui nilai pengaturan sistem."
                : "Tambahkan pengaturan baru untuk konfigurasi aplikasi."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="key">Key</Label>
                <Input
                  id="key"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  placeholder="mis. restaurant_name"
                  required
                  disabled={!!editingSetting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="value">Value</Label>
                <Textarea
                  id="value"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder="Nilai pengaturan"
                  required
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Deskripsi (optional)</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Penjelasan tentang pengaturan ini"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Kategori</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="receipt">Receipt</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {dialogError && <p className="text-sm text-red-500">{dialogError}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Batal
              </Button>
              <Button type="submit">{editingSetting ? "Simpan Perubahan" : "Simpan"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

