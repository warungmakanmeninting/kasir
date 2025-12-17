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

export async function POST(req: NextRequest) {
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
    const { items, customer_name, table_number, order_type, note, payment_method_id, subtotal, tax, total } = body as {
      items: Array<{ product_id: string; product_name: string; quantity: number; price: number }>
      customer_name?: string
      table_number?: string
      order_type?: "dine_in" | "takeaway" | "gojek" | "grab" | "shopeefood"
      note?: string
      payment_method_id: string
      subtotal: number
      tax: number
      total: number
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Items wajib diisi" }, { status: 400 })
    }

    if (!payment_method_id) {
      return NextResponse.json({ error: "Metode pembayaran wajib dipilih" }, { status: 400 })
    }

    // Create order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_name,
        table_number,
        order_type: order_type || "dine_in",
        note,
        cashier_id: user.id,
        payment_method_id,
        // financials - keep in sync with schema
        subtotal,
        discount_amount: 0,
        service_charge: 0,
        tax_amount: tax,
        total,
        // mark as paid & completed
        payment_status: "paid",
        status: "completed",
      })
      .select()
      .single()

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 })
    }

    // Create order items
    const orderItems = items.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.product_name,
      unit_price: item.price,
      quantity: item.quantity,
      // optional helper column
      price: item.price,
    }))

    const { error: itemsError } = await supabase.from("order_items").insert(orderItems)

    if (itemsError) {
      // Rollback order if items fail
      await supabase.from("orders").delete().eq("id", order.id)
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    return NextResponse.json({ order }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unexpected error" }, { status: 500 })
  }
}

