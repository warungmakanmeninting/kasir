import { NextRequest } from "next/server"
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

  if (!profile.is_active || !["admin", "manager"].includes(profile.role)) {
    return { error: "Insufficient permissions", status: 403 } as const
  }

  return { supabase, user } as const
}

