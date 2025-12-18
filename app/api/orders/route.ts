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
      console.error("[ORDERS API] Missing access token")
      return NextResponse.json({ error: "Missing access token" }, { status: 401 })
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)

    if (userError || !user) {
      console.error("[ORDERS API] Invalid access token:", userError?.message)
      return NextResponse.json({ error: "Invalid access token" }, { status: 401 })
    }

    console.log("[ORDERS API] User authenticated:", user.id)

    const body = await req.json()
    const { items, customer_name, table_number, order_type, note, payment_method_id, subtotal, tax, total, amount_paid, change_given } = body as {
      items: Array<{ product_id: string; product_name: string; quantity: number; price: number }>
      customer_name?: string
      table_number?: string
      order_type?: "dine_in" | "takeaway" | "gojek" | "grab" | "shopeefood"
      note?: string
      payment_method_id: string
      subtotal: number
      tax: number
      total: number
      amount_paid?: number
      change_given?: number
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Items wajib diisi" }, { status: 400 })
    }

    if (!payment_method_id) {
      return NextResponse.json({ error: "Metode pembayaran wajib dipilih" }, { status: 400 })
    }

    // Check bypass_kitchen_menu setting
    const { data: bypassSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "bypass_kitchen_menu")
      .single()
    
    const bypassKitchen = bypassSetting?.value?.toLowerCase() === "true"
    
    // Determine order status based on bypass setting
    // If bypass_kitchen_menu = true, order is directly completed
    // If bypass_kitchen_menu = false or not set, order starts as pending
    const orderStatus = bypassKitchen ? "completed" : "pending"
    const completedAt = bypassKitchen ? new Date().toISOString() : null

    // Create order
    // Note: schema uses 'note' (singular) in init migration, but cleanup migration adds 'notes' (plural)
    // Using 'note' to match the original schema definition
    const orderData: Record<string, any> = {
      customer_name: customer_name || null,
      table_number: table_number || null,
      order_type: order_type || "dine_in",
      note: note || null,
      cashier_id: user.id,
      payment_method_id,
      // financials - keep in sync with schema
      subtotal: Number(subtotal),
      discount_amount: 0,
      service_charge: 0,
      tax_amount: Number(tax),
      total: Number(total),
      // Payment status is always paid when order is created from POS
      payment_status: "paid",
      // Order status depends on bypass_kitchen_menu setting
      status: orderStatus,
      // If bypass kitchen, mark as completed immediately
      completed_at: completedAt,
    }

    console.log("[ORDERS API] Creating order with data:", JSON.stringify(orderData, null, 2))

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert(orderData)
      .select()
      .single()

    if (orderError) {
      console.error("[ORDERS API] Order creation failed:", orderError)
      return NextResponse.json({ error: `Failed to create order: ${orderError.message}` }, { status: 500 })
    }

    if (!order) {
      console.error("[ORDERS API] Order created but no data returned")
      return NextResponse.json({ error: "Order created but no data returned" }, { status: 500 })
    }

    console.log("[ORDERS API] Order created successfully:", order.id)

    // Create order items
    // Note: 'price' column is added in cleanup migration, but may not exist in all databases
    // We'll include it but it's optional - unit_price is the main column
    const orderItems = items.map((item) => ({
      order_id: order.id,
      product_id: item.product_id || null,
      product_name: item.product_name,
      unit_price: Number(item.price),
      quantity: Number(item.quantity),
      // Optional helper column (added in cleanup migration)
      price: Number(item.price),
    }))

    console.log("[ORDERS API] Creating order items:", orderItems.length, "items")

    const { error: itemsError, data: insertedItems } = await supabase.from("order_items").insert(orderItems).select()

    if (itemsError) {
      console.error("[ORDERS API] Order items creation failed:", itemsError)
      // Rollback order if items fail
      await supabase.from("orders").delete().eq("id", order.id)
      return NextResponse.json({ error: `Failed to create order items: ${itemsError.message}` }, { status: 500 })
    }

    console.log("[ORDERS API] Order items created successfully:", insertedItems?.length || 0, "items")

    // Check stock availability before proceeding with payment
    // This ensures we don't create payment if stock is insufficient
    for (const item of items) {
      if (item.product_id) {
        const { data: product, error: productError } = await supabase
          .from("products")
          .select("stock_quantity, track_stock")
          .eq("id", item.product_id)
          .single()

        if (!productError && product && product.track_stock) {
          const currentStock = product.stock_quantity || 0
          const requestedQuantity = Number(item.quantity)

          if (currentStock < requestedQuantity) {
            console.error(`[ORDERS API] Insufficient stock for product ${item.product_id}. Current: ${currentStock}, Requested: ${requestedQuantity}`)
            // Rollback order and items
            await supabase.from("order_items").delete().eq("order_id", order.id)
            await supabase.from("orders").delete().eq("id", order.id)
            return NextResponse.json(
              { error: `Stok tidak mencukupi untuk produk ${item.product_name}. Stok tersedia: ${currentStock}` },
              { status: 400 }
            )
          }
        }
      }
    }

    // Create payment record - MUST be created for every order since payment_status is "paid"
    // If amount_paid is not provided, use total as amount_paid (for non-cash payments like QRIS, transfer)
    const paymentAmount = amount_paid !== undefined ? Number(amount_paid) : Number(total)
    const paymentChange = change_given !== undefined ? Number(change_given) : 0

    const paymentData = {
      order_id: order.id,
      payment_method_id,
      amount: paymentAmount,
      change_given: paymentChange,
      received_by: user.id,
    }

    console.log("[ORDERS API] Creating payment record:", JSON.stringify(paymentData, null, 2))

    const { error: paymentError, data: payment } = await supabase.from("payments").insert(paymentData).select().single()

    if (paymentError) {
      console.error("[ORDERS API] Payment creation failed:", paymentError)
      // Rollback order and items if payment record creation fails
      await supabase.from("order_items").delete().eq("order_id", order.id)
      await supabase.from("orders").delete().eq("id", order.id)
      return NextResponse.json({ error: `Failed to create payment record: ${paymentError.message}` }, { status: 500 })
    }

    console.log("[ORDERS API] Payment created successfully:", payment?.id)

    // Create financial transaction (income) from payment
    // This automatically records the income from sales
    try {
      // Get payment method name for notes
      let paymentMethodName = "Unknown"
      if (payment_method_id) {
        const { data: paymentMethod } = await supabase
          .from("payment_methods")
          .select("name")
          .eq("id", payment_method_id)
          .single()
        if (paymentMethod) {
          paymentMethodName = paymentMethod.name
        }
      }

      const orderNumber = order.order_number ? `ORD-${order.order_number}` : order.id.slice(-8)
      const notes = `Pembayaran pesanan ${orderNumber} via ${paymentMethodName}`

      const { error: financeError } = await supabase.from("financial_transactions").insert({
        transaction_type: "income",
        amount: Number(total), // Use total order amount as income
        notes,
        created_by: user.id,
      })

      if (financeError) {
        // Log error but don't fail the order creation
        console.warn("[ORDERS API] Failed to create financial transaction:", financeError)
        // Order and payment are already created, so we continue
      } else {
        console.log("[ORDERS API] Financial transaction created for order:", order.id)
      }
    } catch (financeErr: any) {
      // Non-fatal error - order is already created
      console.warn("[ORDERS API] Error creating financial transaction:", financeErr)
    }

    // Update product stock after payment is successful
    // This ensures stock is only reduced when payment is confirmed
    for (const item of items) {
      if (item.product_id) {
        // Get current product stock info
        const { data: product, error: productError } = await supabase
          .from("products")
          .select("stock_quantity, track_stock")
          .eq("id", item.product_id)
          .single()

        if (!productError && product && product.track_stock) {
          const currentStock = product.stock_quantity || 0
          const newStock = currentStock - Number(item.quantity)

          // Update stock (we already checked availability above)
          const { error: updateStockError } = await supabase
            .from("products")
            .update({
              stock_quantity: newStock,
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.product_id)

          if (updateStockError) {
            console.error(`[ORDERS API] Failed to update stock for product ${item.product_id}:`, updateStockError)
            // Note: Payment is already created, so we should not rollback
            // This is a warning but the order is still valid
            // In production, you might want to implement a compensation transaction or alert
            console.warn(`[ORDERS API] Stock update failed but order is already paid. Product: ${item.product_id}`)
          } else {
            console.log(`[ORDERS API] Stock updated for product ${item.product_id}: ${currentStock} -> ${newStock}`)
          }
        }
      }
    }

    console.log("[ORDERS API] Order creation completed successfully:", order.id)
    return NextResponse.json({ order }, { status: 201 })
  } catch (err: any) {
    console.error("[ORDERS API] Unexpected error:", err)
    return NextResponse.json({ error: err?.message ?? "Unexpected error" }, { status: 500 })
  }
}

