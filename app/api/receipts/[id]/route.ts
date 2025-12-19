import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin env vars missing")
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  // Validasi UUID format
  if (!id || id === "undefined" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "ID struk tidak valid." }, { status: 400 })
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

    // Get user role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    const userRole = profile?.role || "cashier"

    // Get receipt
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .select("*")
      .eq("id", id)
      .single()

    if (receiptError || !receipt) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 })
    }

    // If cashier, only allow access to receipts for orders they created
    if (userRole === "cashier") {
      // Check if order belongs to this cashier
      const { data: order, error: orderCheckError } = await supabase
        .from("orders")
        .select("cashier_id")
        .eq("id", receipt.order_id)
        .single()

      if (orderCheckError || !order || order.cashier_id !== user.id) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }
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
    console.error("[RECEIPTS API] Error in GET:", err)
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
    const { print_status } = body as { print_status?: "pending" | "printed" | "failed" }

    if (!print_status || !["pending", "printed", "failed"].includes(print_status)) {
      return NextResponse.json({ error: "print_status harus 'pending', 'printed', atau 'failed'" }, { status: 400 })
    }

    // Get user role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    const userRole = profile?.role || "cashier"

    // Get receipt first to check ownership
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .select("order_id")
      .eq("id", id)
      .single()

    if (receiptError || !receipt) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 })
    }

    // If cashier, only allow access to receipts for orders they created
    if (userRole === "cashier") {
      // Check if order belongs to this cashier
      const { data: order, error: orderCheckError } = await supabase
        .from("orders")
        .select("cashier_id")
        .eq("id", receipt.order_id)
        .single()

      if (orderCheckError || !order || order.cashier_id !== user.id) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }
    }

    // Update print status
    const { data: updatedReceipt, error: updateError } = await supabase
      .from("receipts")
      .update({ print_status })
      .eq("id", id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ receipt: updatedReceipt })
  } catch (err: any) {
    console.error("[RECEIPTS API] Error in PATCH:", err)
    return NextResponse.json({ error: err?.message ?? "Terjadi kesalahan tak terduga." }, { status: 500 })
  }
}
