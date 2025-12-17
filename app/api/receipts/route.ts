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
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .insert({
        order_id,
        copy_type: copy_type || "original",
        printed_by: user.id,
        cashier_id: user.id,
        printed_at: new Date().toISOString(),
        data_snapshot: snapshot ?? {},
      })
      .select()
      .single()

    if (receiptError) {
      return NextResponse.json({ error: receiptError.message }, { status: 500 })
    }

    return NextResponse.json({ receipt }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unexpected error" }, { status: 500 })
  }
}

