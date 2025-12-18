import { NextRequest, NextResponse } from "next/server"
import { getAdminClient } from "../../users/route"

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  // Validasi UUID format
  if (!id || id === "undefined" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "ID pesanan tidak valid." }, { status: 400 })
  }

  try {
    const supabase = getAdminClient()

    const authHeader = req.headers.get("authorization") ?? ""
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
    if (!token) {
      return NextResponse.json({ error: "Missing access token" }, { status: 401 })
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json({ error: "Invalid access token" }, { status: 401 })
    }

    const body = await req.json()
    const { status, cancel_note } = body as {
      status?: "pending" | "preparing" | "completed" | "cancelled"
      cancel_note?: string
    }

    if (!status) {
      return NextResponse.json({ error: "Status wajib diisi" }, { status: 400 })
    }

    if (!["pending", "preparing", "completed", "cancelled"].includes(status)) {
      return NextResponse.json({ error: "Status tidak valid" }, { status: 400 })
    }

    const updates: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    }

    // Set timestamps based on status
    if (status === "completed") {
      updates.completed_at = new Date().toISOString()
    } else if (status === "cancelled") {
      updates.cancelled_at = new Date().toISOString()
      if (cancel_note) {
        updates.note = cancel_note
      }
    } else {
      // Clear timestamps if status changed back
      if (status === "pending" || status === "preparing") {
        updates.completed_at = null
        updates.cancelled_at = null
      }
    }

    const { data: order, error: updateError } = await supabase
      .from("orders")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (updateError) {
      console.error("[ADMIN ORDERS API] Order update failed:", updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    return NextResponse.json({ order })
  } catch (err: any) {
    console.error("[ADMIN ORDERS API] Unexpected error:", err)
    return NextResponse.json({ error: err?.message ?? "Terjadi kesalahan tak terduga." }, { status: 500 })
  }
}

