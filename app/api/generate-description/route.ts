import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { productName, categoryName } = await req.json()

    if (!productName) {
      return NextResponse.json({ error: "Nama produk diperlukan" }, { status: 400 })
    }

    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY tidak dikonfigurasi" }, { status: 500 })
    }

    // Get model name from environment variable, with fallback
    const modelName = process.env.GEMINI_MODEL || "gemini-pro"
    // Use v1beta API version
    const apiVersion = "v1beta"

    // Build prompt untuk generate deskripsi singkat (< 250 karakter)
    const prompt = `Buatkan deskripsi produk makanan yang singkat, menarik, dan informatif untuk produk berikut:

Nama produk: ${productName}
${categoryName ? `Kategori: ${categoryName}` : ""}

Deskripsi harus:
- Singkat, maksimal 250 karakter
- Menarik dan menggugah selera
- Informative tentang produk
- Dalam bahasa Indonesia
- Tidak menggunakan bullet points atau tanda baca berlebihan
- Fokus pada rasa, bahan, atau keunikan produk

Hanya kembalikan deskripsi saja, tanpa tambahan teks lainnya.`
    const response = await fetch(
      `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = "Gagal generate deskripsi. Silakan coba lagi."
      
      console.error("[GENERATE DESCRIPTION] Gemini API error status:", response.status)
      console.error("[GENERATE DESCRIPTION] Gemini API error response:", errorText)
      
      try {
        const errorData = JSON.parse(errorText)
        // Extract more specific error message if available
        if (errorData.error?.message) {
          errorMessage = errorData.error.message
        } else if (errorData.error) {
          errorMessage = typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error)
        } else if (errorData.message) {
          errorMessage = errorData.message
        }
      } catch (parseError) {
        // If not JSON, use text directly (limit length)
        if (errorText) {
          errorMessage = errorText.substring(0, 200)
        }
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      )
    }

    const data = await response.json()

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content?.parts?.[0]?.text) {
      return NextResponse.json(
        { error: "Format response dari API tidak valid" },
        { status: 500 }
      )
    }

    let description = data.candidates[0].content.parts[0].text.trim()

    // Ensure description is less than 250 characters
    if (description.length > 250) {
      description = description.substring(0, 247) + "..."
    }

    return NextResponse.json({ description })
  } catch (err: any) {
    console.error("[GENERATE DESCRIPTION] Error:", err)
    return NextResponse.json(
      { error: err?.message ?? "Terjadi kesalahan saat generate deskripsi" },
      { status: 500 }
    )
  }
}

