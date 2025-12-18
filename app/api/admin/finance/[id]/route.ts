import { NextRequest, NextResponse } from "next/server"
import { getAdminClient, requireAdmin } from "@/lib/admin-client"

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  // Validasi UUID format
  if (!id || id === "undefined" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "ID transaksi tidak valid." }, { status: 400 })
  }

  try {
    const result = await requireAdmin(req)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const { supabase } = result

    // Delete transaction
    const { error: deleteError } = await supabase.from("financial_transactions").delete().eq("id", id)

    if (deleteError) {
      console.error("[FINANCE API] Failed to delete transaction:", deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // Get updated balance
    const { data: balanceData } = await supabase.from("v_current_balance").select("*").single()
    const currentBalance = balanceData?.current_balance || 0

    return NextResponse.json({
      message: "Transaction deleted successfully",
      currentBalance: Number(currentBalance),
    })
  } catch (err: any) {
    console.error("[FINANCE API] Unexpected error:", err)
    return NextResponse.json({ error: err?.message ?? "Terjadi kesalahan tak terduga." }, { status: 500 })
  }
}

