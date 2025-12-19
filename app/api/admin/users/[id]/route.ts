import { NextRequest, NextResponse } from "next/server"
import { getAdminClient, requireAdmin } from "../route"

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  // Validasi UUID format
  if (!id || id === "undefined" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "ID user tidak valid." }, { status: 400 })
  }

  try {
    const result = await requireAdmin(req)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    // Check write permission (admin is read-only)
    const userRole = result.role
    if (userRole === "admin") {
      return NextResponse.json({ error: "Admin hanya dapat membaca data, tidak dapat mengubah user" }, { status: 403 })
    }

    const { supabase } = result
    const body = await req.json()
    
    const { full_name, role, is_active, reset_password } = body as {
      full_name?: string
      role?: string
      is_active?: boolean
      reset_password?: boolean
    }

    const noProfileUpdates = full_name === undefined && role === undefined && is_active === undefined

    const updates: Record<string, any> = {}

    if (full_name !== undefined) {
      updates.full_name = full_name
    }

    if (role !== undefined) {
      // Check if user can assign this role
      if (role === "super_user" && userRole !== "super_user") {
        return NextResponse.json({ error: "Hanya super_user yang dapat mengubah role menjadi super_user" }, { status: 403 })
      }

      if (!["admin", "manager", "cashier", "chef", "super_user"].includes(role)) {
        return NextResponse.json({ error: "Role tidak valid: " + role }, { status: 400 })
      }
      updates.role = role
    }

    if (typeof is_active === "boolean") {
      updates.is_active = is_active
    }

    let updatedProfile: any = null

    if (Object.keys(updates).length > 0) {
      const { data, error } = await getAdminClient()
        .from("profiles")
        .update(updates)
        .eq("id", id)
        .select("id, full_name, role, is_active, created_at, updated_at")
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      updatedProfile = data
    } else {
      // Tidak ada perubahan profil, ambil data terbaru saja
      const { data, error } = await getAdminClient()
        .from("profiles")
        .select("id, full_name, role, is_active, created_at, updated_at")
        .eq("id", id)
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      updatedProfile = data
    }

    // Sync metadata di auth.users agar role & full_name konsisten saat login
    if (!noProfileUpdates && (full_name !== undefined || role !== undefined)) {
      const metadataUpdate: Record<string, any> = {}
      if (full_name !== undefined) metadataUpdate.full_name = full_name
      if (role !== undefined) metadataUpdate.role = role

      const { error: updateUserError } = await supabase.auth.admin.updateUserById(id, {
        user_metadata: metadataUpdate,
      })
      if (updateUserError) {
        return NextResponse.json({ error: updateUserError.message }, { status: 500 })
      }
    }

    // Reset password ke default bila diminta
    if (reset_password) {
      const { error: pwError } = await supabase.auth.admin.updateUserById(id, {
        password: "Sukses2025",
      })
      if (pwError) {
        return NextResponse.json({ error: pwError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ user: updatedProfile })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unexpected error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  // Validasi UUID format
  if (!id || id === "undefined" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "ID user tidak valid." }, { status: 400 })
  }

  try {
    const result = await requireAdmin(req)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    // Check write permission (admin is read-only)
    if (result.role === "admin") {
      return NextResponse.json({ error: "Admin hanya dapat membaca data, tidak dapat menghapus user" }, { status: 403 })
    }

    const { supabase, user: currentUser } = result

    if (currentUser.id === id) {
      return NextResponse.json({ error: "Tidak dapat menghapus akun Anda sendiri." }, { status: 400 })
    }

    const { error } = await supabase.auth.admin.deleteUser(id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // profiles akan ikut terhapus karena FK on delete cascade
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unexpected error" }, { status: 500 })
  }
}


