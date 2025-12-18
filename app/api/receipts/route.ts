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

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url)
    const limit = Number(searchParams.get("limit") ?? "10")

    // Build query
    let query = supabase
      .from("receipts")
      .select("id, order_id, receipt_number, printed_at, printed_by, copy_type, print_status")
      .order("printed_at", { ascending: false })
      .limit(Number.isFinite(limit) && limit > 0 ? limit : 10)

    // If cashier, only show receipts they printed
    // Admin and manager can see all receipts
    if (userRole === "cashier") {
      query = query.eq("printed_by", user.id)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ receipts: data ?? [] })
  } catch (err: any) {
    console.error("[RECEIPTS API] Error in GET:", err)
    return NextResponse.json({ error: err?.message ?? "Unexpected error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getAdminClient()

    const authHeader = req.headers.get("authorization") ?? ""
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
    if (!token) {
      console.error("[RECEIPTS API] Missing access token")
      return NextResponse.json({ error: "Missing access token" }, { status: 401 })
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)

    if (userError || !user) {
      console.error("[RECEIPTS API] Invalid access token:", userError?.message)
      return NextResponse.json({ error: "Invalid access token" }, { status: 401 })
    }

    console.log("[RECEIPTS API] User authenticated:", user.id)

    const body = await req.json()
    const { order_id, copy_type, snapshot } = body as {
      order_id: string
      copy_type?: string
      snapshot?: any
    }

    if (!order_id) {
      return NextResponse.json({ error: "order_id wajib diisi" }, { status: 400 })
    }

    // Create receipt
    // Kolom receipt_number bertipe bigserial dan akan diisi otomatis oleh database
    const receiptData = {
      order_id,
      copy_type: copy_type || "original",
      printed_by: user.id,
      cashier_id: user.id,
      printed_at: new Date().toISOString(),
      print_status: "pending", // Default: belum print
      data_snapshot: snapshot ?? {},
    }

    console.log("[RECEIPTS API] Creating receipt for order:", order_id)

    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .insert(receiptData)
      .select()
      .single()

    if (receiptError) {
      console.error("[RECEIPTS API] Receipt creation failed:", receiptError)
      return NextResponse.json({ error: `Failed to create receipt: ${receiptError.message}` }, { status: 500 })
    }

    if (!receipt) {
      console.error("[RECEIPTS API] Receipt created but no data returned")
      return NextResponse.json({ error: "Receipt created but no data returned" }, { status: 500 })
    }

    console.log("[RECEIPTS API] Receipt created successfully:", receipt.id, "Receipt number:", receipt.receipt_number)
    return NextResponse.json({ receipt }, { status: 201 })
  } catch (err: any) {
    console.error("[RECEIPTS API] Unexpected error:", err)
    return NextResponse.json({ error: err?.message ?? "Unexpected error" }, { status: 500 })
  }
}

