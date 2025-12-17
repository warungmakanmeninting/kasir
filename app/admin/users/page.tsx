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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { supabaseClient } from "@/lib/supabaseClient"
import { Plus, Shield, User2, Search, Pencil, Trash2, Key } from "lucide-react"
import { Switch } from "@/components/ui/switch"

type AdminUser = {
  id: string
  full_name: string
  role: string
  is_active: boolean
  created_at: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "manager" | "cashier" | "chef">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "cashier",
    is_active: true,
  })

  useEffect(() => {
    const loadUsers = async () => {
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

        setCurrentUserId(session.user.id)

        const res = await fetch("/api/admin/users", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        const json = await res.json()
        if (!res.ok) {
          setError(json.error ?? "Gagal memuat data user.")
          return
        }

        setUsers(json.users ?? [])
      } catch (err) {
        setError("Terjadi kesalahan saat memuat data user.")
      } finally {
        setLoading(false)
      }
    }

    loadUsers()
  }, [])

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        const matchSearch =
          user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.role.toLowerCase().includes(searchQuery.toLowerCase())

        const matchRole = roleFilter === "all" || user.role === roleFilter
        const matchStatus =
          statusFilter === "all" ||
          (statusFilter === "active" && user.is_active) ||
          (statusFilter === "inactive" && !user.is_active)

        return matchSearch && matchRole && matchStatus
      }),
    [users, searchQuery, roleFilter, statusFilter],
  )

  const openDialog = () => {
    setEditingUser(null)
    setFormData({
      full_name: "",
      email: "",
      password: "",
      role: "cashier",
      is_active: true,
    })
    setDialogError(null)
    setIsDialogOpen(true)
  }

  const openEditDialog = (user: AdminUser) => {
    setEditingUser(user)
    setFormData({
      full_name: user.full_name,
      email: "",
      password: "",
      role: user.role,
      is_active: user.is_active,
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

      if (editingUser) {
        // Edit user: update full_name, role, dan status aktif
        if (!editingUser.id) {
          setDialogError("ID user tidak valid.")
          return
        }
        const res = await fetch(`/api/admin/users/${editingUser.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            full_name: formData.full_name,
            role: formData.role,
            is_active: formData.is_active,
          }),
        })

        const json = await res.json()
        if (!res.ok) {
          setDialogError(json.error ?? "Gagal mengubah user.")
          return
        }

        setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? json.user : u)))
      } else {
        // Tambah user baru
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            full_name: formData.full_name,
            role: formData.role,
          }),
        })

        const json = await res.json()
        if (!res.ok) {
          setDialogError(json.error ?? "Gagal membuat user baru.")
          return
        }

        setUsers((prev) => [...prev, json.user])
      }

      closeDialog()
    } catch (err) {
      setDialogError("Terjadi kesalahan saat membuat user.")
    }
  }

  const handleDeleteUser = async (user: AdminUser) => {
    if (!supabaseClient) {
      setError("Konfigurasi Supabase belum lengkap. Hubungi administrator.")
      return
    }

    if (!user.id) {
      setError("ID user tidak valid.")
      return
    }

    if (!confirm(`Hapus user "${user.full_name}"? Tindakan ini tidak dapat dibatalkan.`)) {
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

      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "Gagal menghapus user.")
        return
      }

      setUsers((prev) => prev.filter((u) => u.id !== user.id))
    } catch (err) {
      setError("Terjadi kesalahan saat menghapus user.")
    }
  }

  const handleResetPassword = async (user: AdminUser) => {
    if (!supabaseClient) {
      setError("Konfigurasi Supabase belum lengkap. Hubungi administrator.")
      return
    }

    if (!user.id) {
      setError("ID user tidak valid.")
      return
    }

    if (
      !confirm(
        `Reset password untuk user "${user.full_name}" ke password default "Sukses2025"? User akan diminta mengganti password sendiri setelah login.`,
      )
    ) {
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

      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ reset_password: true }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "Gagal mereset password user.")
        return
      }

      // eslint-disable-next-line no-alert
      alert(`Password user "${user.full_name}" telah direset ke "Sukses2025".`)
    } catch (err) {
      setError("Terjadi kesalahan saat mereset password user.")
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">User Management</h1>
          <p className="text-muted-foreground">
            Admin dapat mendaftarkan karyawan baru (kasir, koki, manager, admin) untuk mengakses sistem.
          </p>
        </div>
        <Button onClick={openDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah User
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari nama atau role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as typeof roleFilter)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua role</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="cashier">Cashier</SelectItem>
              <SelectItem value="chef">Chef</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Dibuat</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredUsers.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="flex items-center gap-2">
                <User2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{user.full_name}</span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-sm">
                  <Shield className="h-3 w-3 text-muted-foreground" />
                  <span className="capitalize">{user.role}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={user.is_active ? "default" : "secondary"}>
                  {user.is_active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {new Date(user.created_at).toLocaleString("id-ID")}
              </TableCell>
              <TableCell className="text-right">
                {user.id === currentUserId ? (
                  <span className="text-xs text-muted-foreground italic">Akun Anda</span>
                ) : (
                  <div className="inline-flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      title="Edit user"
                      onClick={() => openEditDialog(user)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      title='Reset password ke "Sukses2025"'
                      onClick={() => handleResetPassword(user)}
                    >
                      <Key className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      title="Hapus user"
                      onClick={() => handleDeleteUser(user)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
          {filteredUsers.length === 0 && !loading && !error && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                Belum ada user yang cocok dengan filter.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableCaption>
          Menampilkan {filteredUsers.length} user dari total {users.length} (tergantung filter dan pencarian).
        </TableCaption>
      </Table>

      {loading && !error && <p className="text-sm text-muted-foreground">Memuat data user...</p>}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Tambah User Baru"}</DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Perbarui data user. Perubahan role & status aktif akan langsung mempengaruhi hak akses mereka."
                : "Buat akun baru untuk karyawan. Mereka akan login menggunakan email dan password yang Anda set di sini."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-5 py-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nama Lengkap</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                />
              </div>

              {!editingUser && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                    />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="cashier">Cashier</SelectItem>
                    <SelectItem value="chef">Chef</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
                <div className="space-y-0.5">
                  <Label htmlFor="is_active" className="font-normal">
                    Status aktif
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Nonaktifkan user untuk mencegah login tanpa menghapus akun.
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
              <Button type="submit">Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}


