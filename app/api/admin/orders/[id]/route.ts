import { NextRequest, NextResponse } from "next/server"
import { getAdminClient } from "../../users/route"

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  // Validasi UUID format
  if (!id || id === "undefined" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "ID pesanan tidak valid." }, { status: 400 })
  }

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

    // Check user role - allow chef, admin, manager, super_user to update order status
    // Cashier can only cancel orders they created
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .single()

    if (profileError || !profile || !profile.is_active) {
      return NextResponse.json({ error: "Profile not found or inactive" }, { status: 403 })
    }

    const userRole = profile.role
    const body = await req.json()
    const { status, cancel_note } = body as {
      status?: "pending" | "preparing" | "completed" | "cancelled"
      cancel_note?: string
    }

    if (!status) {
      return NextResponse.json({ error: "Status wajib diisi" }, { status: 400 })
    }

    if (!["pending", "preparing", "completed", "cancelled"].includes(status)) {
      return NextResponse.json({ error: "Status tidak valid" }, { status: 400 })
    }

    // If cashier, check if they can only cancel orders they created
    if (userRole === "cashier") {
      if (status !== "cancelled") {
        return NextResponse.json({ error: "Cashier hanya dapat membatalkan pesanan, tidak dapat mengubah status lainnya" }, { status: 403 })
      }

      // Check if order belongs to this cashier
      const { data: order, error: orderCheckError } = await supabase
        .from("orders")
        .select("cashier_id, status")
        .eq("id", id)
        .single()

      if (orderCheckError || !order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 })
      }

      if (order.cashier_id !== user.id) {
        return NextResponse.json({ error: "Anda hanya dapat membatalkan pesanan yang Anda buat" }, { status: 403 })
      }

      // Check if order is already completed or cancelled
      if (order.status === "completed" || order.status === "cancelled") {
        return NextResponse.json({ error: "Pesanan sudah selesai atau dibatalkan, tidak dapat dibatalkan lagi" }, { status: 400 })
      }
    } else if (!["chef", "admin", "manager", "super_user"].includes(userRole)) {
      return NextResponse.json({ error: "Insufficient permissions to update order status" }, { status: 403 })
    }

    // If cancelling, restore stock BEFORE updating order status
    if (status === "cancelled") {
      // Get the order with items first to restore stock
      const { data: orderWithItems, error: orderError } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (*)
        `)
        .eq("id", id)
        .single()

      if (!orderError && orderWithItems && orderWithItems.order_items) {
        // Restore stock for each item
        for (const item of orderWithItems.order_items) {
          if (item.product_id) {
            // Get current product stock
            const { data: product, error: productError } = await supabase
              .from("products")
              .select("stock_quantity, track_stock")
              .eq("id", item.product_id)
              .single()

            if (!productError && product && product.track_stock) {
              // Restore stock by adding quantity back
              const { error: updateStockError } = await supabase
                .from("products")
                .update({
                  stock_quantity: (product.stock_quantity || 0) + item.quantity,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", item.product_id)

              if (updateStockError) {
                console.error(`[ADMIN ORDERS API] Failed to restore stock for product ${item.product_id}:`, updateStockError)
              } else {
                console.log(`[ADMIN ORDERS API] Restored stock for product ${item.product_id}: +${item.quantity}`)
              }
            }
          }
        }
      }
    }

    const updates: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    }

    // Set timestamps based on status
    if (status === "completed") {
      updates.completed_at = new Date().toISOString()
    } else if (status === "cancelled") {
      updates.cancelled_at = new Date().toISOString()
      if (cancel_note) {
        updates.note = cancel_note
      }
    } else {
      // Clear timestamps if status changed back
      if (status === "pending" || status === "preparing") {
        updates.completed_at = null
        updates.cancelled_at = null
      }
    }

    const { data: order, error: updateError } = await supabase
      .from("orders")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (updateError) {
      console.error("[ADMIN ORDERS API] Order update failed:", updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    return NextResponse.json({ order })
  } catch (err: any) {
    console.error("[ADMIN ORDERS API] Unexpected error:", err)
    return NextResponse.json({ error: err?.message ?? "Terjadi kesalahan tak terduga." }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  // Validasi UUID format
  if (!id || id === "undefined" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "ID pesanan tidak valid." }, { status: 400 })
  }

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

    // Get order with items BEFORE deleting to restore stock
    const { data: orderWithItems, error: orderError } = await supabase
      .from("orders")
      .select(`
        *,
        order_items (*)
      `)
      .eq("id", id)
      .single()

    if (orderError || !orderWithItems) {
      console.error("[ADMIN ORDERS API] Order not found:", orderError)
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // Restore stock for each item before deleting order
    if (orderWithItems.order_items && orderWithItems.order_items.length > 0) {
      for (const item of orderWithItems.order_items) {
        if (item.product_id) {
          // Get current product stock
          const { data: product, error: productError } = await supabase
            .from("products")
            .select("stock_quantity, track_stock")
            .eq("id", item.product_id)
            .single()

          if (!productError && product && product.track_stock) {
            // Restore stock by adding quantity back
            const { error: updateStockError } = await supabase
              .from("products")
              .update({
                stock_quantity: (product.stock_quantity || 0) + item.quantity,
                updated_at: new Date().toISOString(),
              })
              .eq("id", item.product_id)

            if (updateStockError) {
              console.error(`[ADMIN ORDERS API] Failed to restore stock for product ${item.product_id}:`, updateStockError)
              // Continue with other items even if one fails
            } else {
              console.log(`[ADMIN ORDERS API] Restored stock for product ${item.product_id}: +${item.quantity}`)
            }
          }
        }
      }
    }

    // Delete order (cascade will automatically delete order_items, payments, and receipts)
    const { error: deleteError } = await supabase.from("orders").delete().eq("id", id)

    if (deleteError) {
      console.error("[ADMIN ORDERS API] Order deletion failed:", deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    console.log(`[ADMIN ORDERS API] Order ${id} deleted successfully`)

    // Delete related financial transaction if exists (income from this order)
    // Find and delete financial transactions related to this order
    try {
      const orderNumber = orderWithItems.order_number ? `ORD-${orderWithItems.order_number}` : id.slice(-8)
      const { data: relatedTransactions } = await supabase
        .from("financial_transactions")
        .select("id")
        .eq("transaction_type", "income")
        .like("notes", `%pesanan ${orderNumber}%`)

      if (relatedTransactions && relatedTransactions.length > 0) {
        for (const transaction of relatedTransactions) {
          const { error: deleteFinanceError } = await supabase
            .from("financial_transactions")
            .delete()
            .eq("id", transaction.id)

          if (deleteFinanceError) {
            console.warn(`[ADMIN ORDERS API] Failed to delete financial transaction ${transaction.id}:`, deleteFinanceError)
          } else {
            console.log(`[ADMIN ORDERS API] Deleted financial transaction ${transaction.id} related to order ${id}`)
          }
        }
      }
    } catch (financeErr: any) {
      // Non-fatal error - order is already deleted
      console.warn("[ADMIN ORDERS API] Error deleting related financial transactions:", financeErr)
    }

    return NextResponse.json({ message: "Order deleted successfully" }, { status: 200 })
  } catch (err: any) {
    console.error("[ADMIN ORDERS API] Unexpected error during deletion:", err)
    return NextResponse.json({ error: err?.message ?? "Terjadi kesalahan tak terduga." }, { status: 500 })
  }
}

