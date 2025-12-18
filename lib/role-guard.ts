import { supabaseClient } from "./supabaseClient"

export type UserRole = "admin" | "manager" | "cashier" | "chef"

/**
 * Get user role from database
 */
export async function getUserRole(): Promise<UserRole | null> {
  if (!supabaseClient) return null

  try {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession()

    if (!session) return null

    const { data: profile, error } = await supabaseClient
      .from("profiles")
      .select("role, is_active")
      .eq("id", session.user.id)
      .single()

    if (error || !profile || !profile.is_active) return null

    return profile.role as UserRole
  } catch {
    return null
  }
}

/**
 * Check if user has permission to access a route
 */
export function canAccessRoute(role: UserRole | null, route: string): boolean {
  if (!role) return false

  // Admin and manager can access everything
  if (role === "admin" || role === "manager") return true

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
      return "/admin"
    case "cashier":
      return "/pos"
    case "chef":
      return "/kitchen"
    default:
      return "/login"
  }
}

