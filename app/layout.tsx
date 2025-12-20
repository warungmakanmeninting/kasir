import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { StoreProvider } from "@/lib/store"
import { AuthGuard } from "@/components/auth-guard"
import { Toaster } from "@/components/ui/sonner"
import { loadSettings } from "@/lib/settings"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export async function generateMetadata(): Promise<Metadata> {
  const settings = await loadSettings()
  const appName = settings.restaurant_name || "Restaurant POS"
  
  return {
    title: appName,
  description: "Modern restaurant point of sale system",
  generator: "v0.app",
  icons: {
      icon: [
        { url: "/logo.png", type: "image/png" },
        { url: "/favicon.ico", type: "image/x-icon", sizes: "any" },
      ],
      apple: "/logo.png",
      shortcut: "/logo.png",
  },
  }
}

import { ClientWrapper } from "@/components/client-wrapper"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <StoreProvider>
          <AuthGuard>
            <ClientWrapper>{children}</ClientWrapper>
          </AuthGuard>
        </StoreProvider>
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
