"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabaseClient } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, User, Save, Lock, Mail, Shield } from "lucide-react"
import { toast } from "sonner"

type ProfileData = {
  id: string
  full_name: string
  email: string
  role: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [fullName, setFullName] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  useEffect(() => {
    const loadProfile = async () => {
      if (!supabaseClient) {
        setError("Konfigurasi Supabase belum lengkap. Hubungi administrator.")
        setLoading(false)
        return
      }

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabaseClient.auth.getSession()

        if (sessionError || !session) {
          router.replace("/login")
          return
        }

        // Get profile data
        const { data: profileData, error: profileError } = await supabaseClient
          .from("profiles")
          .select("id, full_name, role, is_active, created_at, updated_at")
          .eq("id", session.user.id)
          .single()

        if (profileError) {
          throw profileError
        }

        if (profileData) {
          const profileWithEmail: ProfileData = {
            ...profileData,
            email: session.user.email || "",
          }
          setProfile(profileWithEmail)
          setFullName(profileData.full_name)
        }
      } catch (err: any) {
        setError(err?.message ?? "Gagal memuat data profil.")
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [router])

  const handleSaveProfile = async () => {
    if (!supabaseClient || !profile) {
      setError("Konfigurasi Supabase belum lengkap.")
      return
    }

    if (!fullName.trim()) {
      setError("Nama lengkap tidak boleh kosong.")
      return
    }

    try {
      setSaving(true)
      setError(null)

      // Update profile
      const { error: updateError } = await supabaseClient
        .from("profiles")
        .update({ full_name: fullName.trim() })
        .eq("id", profile.id)

      if (updateError) {
        throw updateError
      }

      // Update user metadata
      const { error: metadataError } = await supabaseClient.auth.updateUser({
        data: { full_name: fullName.trim() },
      })

      if (metadataError) {
        // Non-critical error, just log it
        console.warn("Failed to update user metadata:", metadataError)
      }

      // Update local state
      setProfile({ ...profile, full_name: fullName.trim() })
      toast.success("Profil berhasil diperbarui")
    } catch (err: any) {
      setError(err?.message ?? "Gagal memperbarui profil.")
      toast.error("Gagal memperbarui profil")
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!supabaseClient) {
      setError("Konfigurasi Supabase belum lengkap.")
      return
    }

    if (!newPassword || !confirmPassword) {
      setError("Password baru dan konfirmasi password harus diisi.")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("Password baru dan konfirmasi password tidak cocok.")
      return
    }

    if (newPassword.length < 6) {
      setError("Password baru harus minimal 6 karakter.")
      return
    }

    try {
      setChangingPassword(true)
      setError(null)

      // Update password using Supabase auth
      // Note: Supabase doesn't require current password if you have a valid session
      const { error: passwordError } = await supabaseClient.auth.updateUser({
        password: newPassword,
      })

      if (passwordError) {
        throw passwordError
      }

      toast.success("Password berhasil diubah")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err: any) {
      setError(err?.message ?? "Gagal mengubah password.")
      toast.error("Gagal mengubah password")
    } finally {
      setChangingPassword(false)
    }
  }

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: "Administrator",
      manager: "Manager",
      cashier: "Kasir",
      chef: "Koki",
    }
    return labels[role] || role
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Memuat profil...</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Profil tidak ditemukan</CardTitle>
            <CardDescription>Terjadi kesalahan saat memuat profil Anda.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button className="w-full">Kembali ke Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Kembali ke Home
            </Button>
          </Link>
          <h1 className="text-3xl font-bold mb-2">Profil Saya</h1>
          <p className="text-muted-foreground">Kelola informasi profil dan keamanan akun Anda</p>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Informasi Profil
              </CardTitle>
              <CardDescription>Perbarui informasi profil Anda</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <Input id="email" value={profile.email} disabled className="bg-muted" />
                </div>
                <p className="text-xs text-muted-foreground">Email tidak dapat diubah</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_name">Nama Lengkap</Label>
                <Input
                  id="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Masukkan nama lengkap"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="role"
                    value={getRoleLabel(profile.role)}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Role tidak dapat diubah</p>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      profile.is_active ? "bg-emerald-500" : "bg-red-500"
                    }`}
                  />
                  <span className="text-sm">
                    {profile.is_active ? "Aktif" : "Tidak Aktif"}
                  </span>
                </div>
              </div>

              <Button
                onClick={handleSaveProfile}
                disabled={saving || fullName.trim() === profile.full_name}
                className="w-full"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Simpan Perubahan
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Ubah Password
              </CardTitle>
              <CardDescription>Perbarui password untuk keamanan akun Anda</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new_password">Password Baru</Label>
                <Input
                  id="new_password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Masukkan password baru (min. 6 karakter)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm_password">Konfirmasi Password Baru</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Konfirmasi password baru"
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Password akan diubah menggunakan sesi login saat ini. Pastikan Anda sudah login dengan akun yang benar.
              </p>

              <Button
                onClick={handleChangePassword}
                disabled={changingPassword || !newPassword || !confirmPassword}
                variant="outline"
                className="w-full"
              >
                {changingPassword ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                    Mengubah...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Ubah Password
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Account Information */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Informasi Akun</CardTitle>
            <CardDescription>Detail akun dan waktu pembuatan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-muted-foreground">ID Pengguna</span>
              <span className="text-sm font-mono">{profile.id}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-muted-foreground">Dibuat pada</span>
              <span className="text-sm">
                {new Date(profile.created_at).toLocaleString("id-ID", {
                  dateStyle: "long",
                  timeStyle: "short",
                })}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-muted-foreground">Terakhir diupdate</span>
              <span className="text-sm">
                {new Date(profile.updated_at).toLocaleString("id-ID", {
                  dateStyle: "long",
                  timeStyle: "short",
                })}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
