"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabaseClient } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!supabaseClient) {
      setError("Konfigurasi Supabase belum lengkap. Cek variabel environment Supabase Anda.")
      return
    }

    try {
      setLoading(true)
      const { data, error: signInError } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError || !data.session) {
        setError(signInError?.message ?? "Login gagal. Periksa email dan password Anda.")
        return
      }

      // Gunakan role yang disimpan di metadata supaya selaras dengan skema profiles/has_role
      const user = data.user
      const role = (user?.user_metadata?.role as string | undefined) ?? "cashier"

      if (role === "admin" || role === "manager") {
        router.replace("/admin")
      } else if (role === "cashier") {
        router.replace("/pos")
      } else if (role === "chef") {
        router.replace("/kitchen")
      } else {
        router.replace("/")
      }
    } catch (err) {
      setError(
        "Gagal menghubungi Supabase. Periksa NEXT_PUBLIC_SUPABASE_URL, kunci publik, koneksi internet, atau ad blocker.",
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl">Masuk ke Sistem</CardTitle>
          <CardDescription>Gunakan akun Supabase (email & password) yang sudah terdaftar.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Masuk..." : "Masuk"}
            </Button>

            <p className="mt-3 text-xs text-center text-muted-foreground">
              Akun baru hanya dapat dibuat oleh admin melalui menu Users di dashboard.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}


