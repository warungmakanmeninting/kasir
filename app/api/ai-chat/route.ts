import { NextRequest, NextResponse } from "next/server"
import { loadSettings } from "@/lib/settings"

const SYSTEM_PROMPT_BASE = `Anda adalah AI Assistant yang membantu pengguna menggunakan aplikasi Restaurant POS (Point of Sale).

INFORMASI APLIKASI:
Aplikasi ini adalah sistem POS untuk restoran/warung makan dengan berbagai fitur untuk mengelola operasional restoran.

FITUR-FITUR APLIKASI:

1. KASIR POS (/pos)
   - Proses pesanan pelanggan
   - Pilih produk, tambah ke keranjang
   - Pilih metode pembayaran (Cash, QRIS, Transfer)
   - Cetak struk
   - Lihat history transaksi
   - Batal transaksi (hanya untuk order sendiri yang belum completed/cancelled)

2. KITCHEN DASHBOARD (/kitchen)
   - Lihat pesanan yang masuk
   - Update status pesanan (pending → preparing → completed)
   - Monitor pesanan real-time

3. ADMIN DASHBOARD (/admin)
   - Dashboard dengan statistik penjualan
   - Manajemen produk dan kategori
   - Manajemen pesanan
   - Manajemen struk
   - Manajemen keuangan
   - Laporan penjualan
   - Manajemen metode pembayaran
   - Manajemen pengguna
   - Pengaturan aplikasi

ROLE DAN PERMISSION:

1. CASHIER (Kasir)
   - Akses: POS page, Profile page
   - Bisa: Create order, lihat history transaksi sendiri, reprint receipt, cancel order sendiri
   - Tidak bisa: Akses admin pages, kitchen page

2. CHEF (Koki)
   - Akses: Kitchen page, Profile page
   - Bisa: Update status pesanan
   - Tidak bisa: Akses POS, admin pages

3. ADMIN (Administrator)
   - Akses: Semua admin pages (read-only), POS, Kitchen
   - Bisa: Lihat semua data, tapi TIDAK BISA create, update, atau delete
   - Tidak bisa: Membuat user baru, mengubah data

4. MANAGER (Manajer)
   - Akses: Full access ke semua halaman
   - Bisa: Semua operasi CRUD kecuali membuat super_user
   - Tidak bisa: Membuat user dengan role super_user

5. SUPER_USER (Super User)
   - Akses: Full access ke semua halaman
   - Bisa: Semua operasi termasuk membuat super_user lain

MENU NAVIGASI:

Home (/):
- Dashboard utama dengan card untuk setiap fitur berdasarkan role

POS (/pos):
- Kasir untuk memproses pesanan

Kitchen (/kitchen):
- Dashboard dapur untuk melihat dan mengupdate pesanan

Admin Pages (/admin):
- Dashboard: Ringkasan penjualan dan statistik
- Produk: Kelola produk menu
- Kategori: Kelola kategori produk
- Pesanan: Lihat dan kelola pesanan
- Struk: Lihat history struk
- Keuangan: Kelola transaksi keuangan (pendapatan, tarik uang)
- Laporan: Laporan penjualan harian/bulanan
- Metode Pembayaran: Kelola metode pembayaran
- Pengguna: Kelola user dan role
- Pengaturan: Konfigurasi aplikasi

Profile (/profile):
- Lihat dan edit profil sendiri

TIPS PENGGUNAAN:
- Gunakan navigasi menu di sidebar untuk berpindah halaman
- Setiap role memiliki akses terbatas sesuai permission
- Admin hanya bisa read, tidak bisa modify data
- Manager dan super_user memiliki full access

Selain membantu penggunaan aplikasi, Anda juga bisa menjawab pertanyaan umum, diskusi tentang resep masakan, atau topik random lainnya. Gunakan bahasa Indonesia yang ramah dan mudah dipahami.

Ingat: Jika pengguna menanyakan sesuatu di luar topik aplikasi, Anda tetap boleh menjawab dengan ramah.`

export async function POST(req: NextRequest) {
  try {
    const { messages, userRole } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages harus berupa array" }, { status: 400 })
    }

    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY tidak dikonfigurasi" }, { status: 500 })
    }

    // Load application settings
    const settings = await loadSettings()
    const settingsInfo = `
INFORMASI RESTORAN (dari pengaturan aplikasi):
- Nama Restoran: ${settings.restaurant_name}
- Alamat: ${settings.restaurant_address}
- Telepon: ${settings.restaurant_phone}
- Tax Rate: ${settings.tax_rate}%
- Auto Print Receipt: ${settings.auto_print_receipt ? "Ya" : "Tidak"}
- Bypass Kitchen Menu: ${settings.bypass_kitchen_menu ? "Ya (menu dapur dinonaktifkan)" : "Tidak (menu dapur aktif)"}
- Receipt Footer: ${settings.receipt_footer}
`

    const modelName = process.env.GEMINI_MODEL || "gemini-pro"
    const apiVersion = "v1beta"

    // Prepare conversation history for Gemini API
    // Skip the first assistant greeting message
    const conversationMessages = messages.slice(1)
    const systemPromptText = SYSTEM_PROMPT_BASE + settingsInfo + (userRole ? `\n\nRole pengguna saat ini: **${userRole.toUpperCase()}**` : "")
    
    // Build contents array - Gemini requires alternating user/model messages
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = []
    
    if (conversationMessages.length === 0) {
      // No conversation yet, just send system prompt
      contents.push({
        role: "user",
        parts: [{ text: systemPromptText }],
      })
    } else {
      // Build conversation with system prompt in first message
      let firstUserMessage = true
      
      for (const msg of conversationMessages) {
        if (msg.role === "user") {
          if (firstUserMessage) {
            // Include system prompt in first user message
            contents.push({
              role: "user",
              parts: [{ text: systemPromptText + "\n\nUser: " + msg.content }],
            })
            firstUserMessage = false
          } else {
            contents.push({
              role: "user",
              parts: [{ text: msg.content }],
            })
          }
        } else {
          contents.push({
            role: "model",
            parts: [{ text: msg.content }],
          })
        }
      }
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents,
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = "Gagal mendapatkan respons dari AI. Silakan coba lagi."

      console.error("[AI CHAT] Gemini API error status:", response.status)
      console.error("[AI CHAT] Gemini API error response:", errorText)

      try {
        const errorData = JSON.parse(errorText)
        if (errorData.error?.message) {
          errorMessage = errorData.error.message
        } else if (errorData.error) {
          errorMessage = typeof errorData.error === "string" ? errorData.error : JSON.stringify(errorData.error)
        } else if (errorData.message) {
          errorMessage = errorData.message
        }
      } catch (parseError) {
        if (errorText) {
          errorMessage = errorText.substring(0, 200)
        }
      }

      return NextResponse.json({ error: errorMessage }, { status: response.status })
    }

    const data = await response.json()

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content?.parts?.[0]?.text) {
      return NextResponse.json(
        { error: "Format response dari API tidak valid" },
        { status: 500 }
      )
    }

    const aiResponse = data.candidates[0].content.parts[0].text.trim()

    return NextResponse.json({ response: aiResponse })
  } catch (err: any) {
    console.error("[AI CHAT] Error:", err)
    return NextResponse.json(
      { error: err?.message ?? "Terjadi kesalahan saat memproses chat" },
      { status: 500 }
    )
  }
}
