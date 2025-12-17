import { NextRequest, NextResponse } from "next/server"
import { getAdminClient, requireAdmin } from "../users/route"

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
      .select("id, order_id, receipt_number, printed_at, printed_by, copy_type")
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

    const payload = {
      order_id,
      copy_type: copy_type ?? "original",
      printed_by: user.id,
      data_snapshot: {
        note: note ?? null,
        created_via: "admin_panel",
        created_at: new Date().toISOString(),
      },
    }

    const { data, error } = await supabase
      .from("receipts")
      .insert(payload)
      .select("id, order_id, receipt_number, printed_at, printed_by, copy_type")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ receipt: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Terjadi kesalahan tak terduga." }, { status: 500 })
  }
}


