"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { loadSettings, type AppSettings } from "@/lib/settings"

export default function HomePage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    const loadAppSettings = async () => {
      const appSettings = await loadSettings()
      setSettings(appSettings)
    }
    loadAppSettings()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className="text-5xl font-bold mb-4 text-balance">
            {settings?.restaurant_name || ""}
          </h1>
          <p className="text-xl text-muted-foreground text-pretty">
            Streamline your restaurant operations with our modern point-of-sale solution
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-2xl">Cashier POS</CardTitle>
              <CardDescription>Process orders quickly with our intuitive cashier interface</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/pos">
                <Button size="lg" className="w-full">
                  Open POS
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-2xl">Kitchen Dashboard</CardTitle>
              <CardDescription>View and manage incoming orders from the kitchen</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/kitchen">
                <Button size="lg" variant="default" className="w-full">
                  Open Kitchen
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-2xl">Admin Dashboard</CardTitle>
              <CardDescription>Manage products, view orders, and track sales reports</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin">
                <Button size="lg" variant="secondary" className="w-full">
                  Open Admin
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
