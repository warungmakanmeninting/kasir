import { NextRequest, NextResponse } from "next/server"
import { getAdminClient, requireAdmin } from "../users/route"

export async function GET(req: NextRequest) {
  try {
    const result = await requireAdmin(req)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const { data, error } = await getAdminClient()
      .from("settings")
      .select("*")
      .order("category", { ascending: true })
      .order("key", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ settings: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unexpected error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const result = await requireAdmin(req)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const body = await req.json()
    const { key, value, description, category } = body as {
      key?: string
      value?: string
      description?: string
      category?: string
    }

    if (!key || !value) {
      return NextResponse.json({ error: "key dan value wajib diisi" }, { status: 400 })
    }

    const { data, error } = await getAdminClient()
      .from("settings")
      .insert({
        key,
        value,
        description,
        category: category || "general",
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ setting: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unexpected error" }, { status: 500 })
  }
}

