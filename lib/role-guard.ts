import { supabaseClient } from "./supabaseClient"

export type UserRole = "admin" | "manager" | "cashier" | "chef" | "super_user"

/**
 * Get user role from database
 */
export async function getUserRole(): Promise<UserRole | null> {
  if (!supabaseClient) return null

  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabaseClient.auth.getSession()

    if (sessionError) {
      // If session error (e.g., invalid token), return null
      throw sessionError
    }

    if (!session) return null

    const { data: profile, error } = await supabaseClient
      .from("profiles")
      .select("role, is_active")
      .eq("id", session.user.id)
      .single()

    if (error) {
      // If error (could be invalid token or permission issue), throw to be caught
      throw error
    }

    if (!profile || !profile.is_active) return null

    return profile.role as UserRole
  } catch (error: any) {
    // Return null on any error (including invalid token)
    console.error("[getUserRole] Error:", error?.message)
    return null
  }
}

/**
 * Check if user has permission to access a route
 */
export function canAccessRoute(role: UserRole | null, route: string): boolean {
  if (!role) return false

  // Super user, manager, and admin can access everything (admin is read-only though)
  if (role === "super_user" || role === "manager" || role === "admin") return true

  // Cashier can only access POS and home
  if (role === "cashier") {
    return route === "/pos" || route.startsWith("/pos") || route === "/" || route === "/profile"
  }

  // Chef can only access kitchen and home
  if (role === "chef") {
    return route === "/kitchen" || route.startsWith("/kitchen") || route === "/" || route === "/profile"
  }

  return false
}

/**
 * Get the default route for a role after login
 */
export function getDefaultRouteForRole(role: UserRole | null): string {
  if (!role) return "/login"

  switch (role) {
    case "admin":
    case "manager":
    case "super_user":
      return "/admin"
    case "cashier":
      return "/pos"
    case "chef":
      return "/kitchen"
    default:
      return "/login"
  }
}

/**
 * Check if user can write (create, update, delete)
 * Admin is read-only, manager and super_user have full access
 */
export function canWrite(role: UserRole | null): boolean {
  if (!role) return false
  return role === "manager" || role === "super_user"
}

/**
 * Check if user can create super_user
 * Only super_user can create another super_user
 */
export function canCreateSuperUser(role: UserRole | null): boolean {
  if (!role) return false
  return role === "super_user"
}

