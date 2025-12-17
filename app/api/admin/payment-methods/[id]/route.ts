import { NextRequest, NextResponse } from "next/server"
import { getAdminClient, requireAdmin } from "../../users/route"

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  // Validasi UUID format
  if (!id || id === "undefined" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "ID metode pembayaran tidak valid." }, { status: 400 })
  }

  try {
    const result = await requireAdmin(req)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const supabase = getAdminClient()
    const body = await req.json()
    const { code, name, is_active, sort_order } = body as {
      code?: string
      name?: string
      is_active?: boolean
      sort_order?: number
    }

    const updates: Record<string, any> = {}
    if (code !== undefined) updates.code = code
    if (name !== undefined) updates.name = name
    if (typeof is_active === "boolean") updates.is_active = is_active
    if (typeof sort_order === "number") updates.sort_order = sort_order

    const baseSelect = () =>
      supabase
        .from("payment_methods")
        .select("id, code, name, is_active, sort_order, created_at, updated_at")
        .eq("id", id)

    const { data, error } =
      Object.keys(updates).length > 0
        ? await supabase
            .from("payment_methods")
            .update(updates)
            .eq("id", id)
            .select("id, code, name, is_active, sort_order, created_at, updated_at")
            .single()
        : await baseSelect().single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ paymentMethod: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Terjadi kesalahan tak terduga." }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  // Validasi UUID format
  if (!id || id === "undefined" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "ID metode pembayaran tidak valid." }, { status: 400 })
  }

  try {
    const result = await requireAdmin(req)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const supabase = getAdminClient()

    const { error } = await supabase.from("payment_methods").delete().eq("id", id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Terjadi kesalahan tak terduga." }, { status: 500 })
  }
}


