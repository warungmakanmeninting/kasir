import { NextRequest, NextResponse } from "next/server"
import { getAdminClient, requireAdmin } from "@/lib/admin-client"

export async function GET(req: NextRequest) {
  try {
    const result = await requireAdmin(req)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const supabase = getAdminClient()

    const { searchParams } = new URL(req.url)
    const limit = Number(searchParams.get("limit") ?? "100")

    const { data, error } = await supabase
      .from("receipts")
      .select("id, order_id, receipt_number, printed_at, printed_by, copy_type, print_status")
      .order("printed_at", { ascending: false })
      .limit(Number.isFinite(limit) && limit > 0 ? limit : 100)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ receipts: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Terjadi kesalahan tak terduga." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const result = await requireAdmin(req)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const { user } = result
    const supabase = getAdminClient()

    const body = await req.json()
    const { order_id, copy_type, note } = body as {
      order_id?: string
      copy_type?: string
      note?: string
    }

    if (!order_id) {
      return NextResponse.json({ error: "order_id wajib diisi untuk membuat receipt." }, { status: 400 })
    }

    const isUuid = /^[0-9a-fA-F-]{36}$/.test(order_id)
    if (!isUuid) {
      return NextResponse.json({ error: 'order_id harus berupa UUID yang valid, bukan "undefined" atau teks lain.' }, { status: 400 })
    }

    if (copy_type && !["original", "reprint"].includes(copy_type)) {
      return NextResponse.json({ error: "copy_type tidak valid." }, { status: 400 })
    }

    const finalCopyType = copy_type ?? "original"

    // Check if order already has an original receipt (only for original receipts)
    if (finalCopyType === "original") {
      const { data: existingReceipt, error: checkError } = await supabase
        .from("receipts")
        .select("id, receipt_number, print_status")
        .eq("order_id", order_id)
        .eq("copy_type", "original")
        .maybeSingle()

      if (checkError) {
        console.error("[ADMIN RECEIPTS API] Error checking existing receipt:", checkError)
        return NextResponse.json({ error: "Gagal memeriksa receipt yang sudah ada" }, { status: 500 })
      }

      if (existingReceipt) {
        console.log("[ADMIN RECEIPTS API] Order already has original receipt:", existingReceipt.id)
        // Return existing receipt instead of creating new one
        return NextResponse.json(
          {
            receipt: existingReceipt,
            message: "Receipt sudah ada untuk order ini",
          },
          { status: 200 }
        )
      }
    }

    const payload = {
      order_id,
      copy_type: finalCopyType,
      printed_by: user.id,
      print_status: "pending",
      data_snapshot: {
        note: note ?? null,
        created_via: "admin_panel",
        created_at: new Date().toISOString(),
      },
    }

    const { data, error } = await supabase
      .from("receipts")
      .insert(payload)
      .select("id, order_id, receipt_number, printed_at, printed_by, copy_type, print_status")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ receipt: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Terjadi kesalahan tak terduga." }, { status: 500 })
  }
}


