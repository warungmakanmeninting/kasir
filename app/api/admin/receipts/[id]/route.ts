import { NextRequest, NextResponse } from "next/server"
import { getAdminClient, requireAdmin } from "../../users/route"

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  // Validasi UUID format
  if (!id || id === "undefined" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "ID struk tidak valid." }, { status: 400 })
  }

  try {
    const result = await requireAdmin(req)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const supabase = getAdminClient()

    // Get receipt
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .select("*")
      .eq("id", id)
      .single()

    if (receiptError || !receipt) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 })
    }

    // Get order with items and payments
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        *,
        order_items (*),
        payments (
          *,
          payment_methods (*)
        )
      `)
      .eq("id", receipt.order_id)
      .single()

    if (orderError) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    return NextResponse.json({ receipt, order })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Terjadi kesalahan tak terduga." }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  // Validasi UUID format
  if (!id || id === "undefined" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "ID struk tidak valid." }, { status: 400 })
  }

  try {
    const result = await requireAdmin(req)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const supabase = getAdminClient()
    const body = await req.json()
    const { copy_type, print_status } = body as { copy_type?: string; print_status?: "pending" | "printed" | "failed" }

    const updates: Record<string, any> = {}

    if (copy_type) {
      if (!["original", "reprint"].includes(copy_type)) {
        return NextResponse.json({ error: "copy_type tidak valid." }, { status: 400 })
      }
      updates.copy_type = copy_type
    }

    if (print_status) {
      if (!["pending", "printed", "failed"].includes(print_status)) {
        return NextResponse.json({ error: "print_status tidak valid." }, { status: 400 })
      }
      updates.print_status = print_status
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "copy_type atau print_status wajib diisi untuk update." }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("receipts")
      .update(updates)
      .eq("id", id)
      .select("id, order_id, receipt_number, printed_at, printed_by, copy_type, print_status")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ receipt: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Terjadi kesalahan tak terduga." }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  // Validasi UUID format
  if (!id || id === "undefined" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "ID struk tidak valid." }, { status: 400 })
  }

  try {
    const result = await requireAdmin(req)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const supabase = getAdminClient()

    const { error } = await supabase.from("receipts").delete().eq("id", id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Terjadi kesalahan tak terduga." }, { status: 500 })
  }
}


