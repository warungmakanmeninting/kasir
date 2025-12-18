import { NextRequest, NextResponse } from "next/server"
import { getAdminClient, requireAdmin } from "../users/route"

export async function GET(req: NextRequest) {
  try {
    const result = await requireAdmin(req)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const supabase = getAdminClient()

    // Get orders with items and payments
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select(`
        *,
        order_items (*),
        payments (
          *,
          payment_methods (*)
        )
      `)
      .order("created_at", { ascending: false })

    if (ordersError) {
      console.error("[ADMIN ORDERS API] Error fetching orders:", ordersError)
      return NextResponse.json({ error: ordersError.message }, { status: 500 })
    }

    // Transform orders to match frontend format
    const transformedOrders = (orders || []).map((order: any) => ({
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      orderType: order.order_type,
      customerName: order.customer_name,
      tableNumber: order.table_number,
      items: (order.order_items || []).map((item: any) => ({
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        price: Number(item.unit_price),
      })),
      total: Number(order.total),
      subtotal: Number(order.subtotal),
      tax: Number(order.tax_amount),
      paymentStatus: order.payment_status,
      note: order.note,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      completedAt: order.completed_at,
      cancelledAt: order.cancelled_at,
    }))

    return NextResponse.json({ orders: transformedOrders })
  } catch (err: any) {
    console.error("[ADMIN ORDERS API] Unexpected error:", err)
    return NextResponse.json({ error: err?.message ?? "Terjadi kesalahan tak terduga." }, { status: 500 })
  }
}

