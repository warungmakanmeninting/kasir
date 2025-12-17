import { NextRequest, NextResponse } from "next/server"
import { getAdminClient, requireAdmin } from "../users/route"

export async function GET(req: NextRequest) {
  try {
    const result = await requireAdmin(req)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const supabase = getAdminClient()

    const { data, error } = await supabase
      .from("categories")
      .select("id, name, is_active, sort_order, created_at, updated_at")
      .order("sort_order", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ categories: data ?? [] })
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

    const supabase = getAdminClient()
    const body = await req.json()
    const { name, is_active, sort_order } = body as {
      name?: string
      is_active?: boolean
      sort_order?: number
    }

    if (!name) {
      return NextResponse.json({ error: "Nama kategori wajib diisi." }, { status: 400 })
    }

    const payload = {
      name,
      is_active: typeof is_active === "boolean" ? is_active : true,
      sort_order: typeof sort_order === "number" ? sort_order : 0,
    }

    const { data, error } = await supabase
      .from("categories")
      .insert(payload)
      .select("id, name, is_active, sort_order, created_at, updated_at")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ category: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Terjadi kesalahan tak terduga." }, { status: 500 })
  }
}


