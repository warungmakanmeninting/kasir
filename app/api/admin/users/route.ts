import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin env vars missing. Set NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY.")
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

export async function requireAdmin(req: NextRequest) {
  const supabase = getAdminClient()

  const authHeader = req.headers.get("authorization") ?? ""
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
  if (!token) {
    return { error: "Missing access token", status: 401 } as const
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token)

  if (userError || !user) {
    return { error: "Invalid access token", status: 401 } as const
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single()

  if (profileError || !profile) {
    return { error: "Profile not found", status: 403 } as const
  }

  if (!profile.is_active || !["admin", "manager", "super_user"].includes(profile.role)) {
    return { error: "Insufficient permissions", status: 403 } as const
  }

  return { supabase, user, role: profile.role } as const
}

export async function GET(req: NextRequest) {
  try {
    const result = await requireAdmin(req)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const { supabase } = result

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role, is_active, created_at, updated_at")
      .order("created_at", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ users: data ?? [] })
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

    const { supabase } = result
    const body = await req.json()
    const { email, password, full_name, role } = body as {
      email?: string
      password?: string
      full_name?: string
      role?: string
    }

    if (!email || !password || !full_name || !role) {
      return NextResponse.json({ error: "email, password, full_name, dan role wajib diisi" }, { status: 400 })
    }

    // Check if user can create this role
    const userRole = result.role
    if (role === "super_user" && userRole !== "super_user") {
      return NextResponse.json({ error: "Hanya super_user yang dapat membuat super_user" }, { status: 403 })
    }

    if (!["admin", "manager", "cashier", "chef", "super_user"].includes(role)) {
      return NextResponse.json({ error: "Role tidak valid" }, { status: 400 })
    }

    // Check write permission (admin is read-only)
    if (userRole === "admin") {
      return NextResponse.json({ error: "Admin hanya dapat membaca data, tidak dapat membuat user baru" }, { status: 403 })
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Tunggu sebentar untuk memastikan trigger sudah selesai membuat profile
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Ambil profile yang baru dibuat untuk mengembalikan data yang konsisten
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, role, is_active, created_at, updated_at")
      .eq("id", data.user.id)
      .single()

    if (profileError || !profile) {
      // Fallback: return auth user data
      return NextResponse.json(
        {
          user: {
            id: data.user.id,
            full_name,
            role,
            is_active: true,
            created_at: data.user.created_at,
            updated_at: data.user.updated_at,
          },
        },
        { status: 201 },
      )
    }

    return NextResponse.json({ user: profile }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unexpected error" }, { status: 500 })
  }
}


