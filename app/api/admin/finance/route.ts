import { NextRequest, NextResponse } from "next/server"
import { getAdminClient, requireAdmin } from "@/lib/admin-client"

export async function GET(req: NextRequest) {
  try {
    const result = await requireAdmin(req)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const { supabase } = result

    // Get all financial transactions with creator info
    const { data: transactions, error: transactionsError } = await supabase
      .from("financial_transactions")
      .select(`
        *,
        created_by_profile:profiles!financial_transactions_created_by_fkey(id, full_name)
      `)
      .order("created_at", { ascending: false })

    if (transactionsError) {
      console.error("[FINANCE API] Failed to fetch transactions:", transactionsError)
      return NextResponse.json({ error: transactionsError.message }, { status: 500 })
    }

    // Get current balance
    const { data: balanceData, error: balanceError } = await supabase
      .from("v_current_balance")
      .select("*")
      .single()

    const currentBalance = balanceData?.current_balance || 0

    // Transform transactions
    const transformedTransactions = (transactions || []).map((t) => ({
      id: t.id,
      transactionType: t.transaction_type,
      amount: Number(t.amount),
      notes: t.notes,
      createdBy: t.created_by_profile?.full_name || "Unknown",
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }))

    return NextResponse.json({
      transactions: transformedTransactions,
      currentBalance: Number(currentBalance),
    })
  } catch (err: any) {
    console.error("[FINANCE API] Unexpected error:", err)
    return NextResponse.json({ error: err?.message ?? "Unexpected error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const result = await requireAdmin(req)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const { supabase, user } = result

    const body = await req.json()
    const { transaction_type, amount, notes } = body as {
      transaction_type: "income" | "withdrawal"
      amount: number
      notes?: string
    }

    if (!transaction_type || !["income", "withdrawal"].includes(transaction_type)) {
      return NextResponse.json({ error: "Transaction type harus 'income' atau 'withdrawal'" }, { status: 400 })
    }

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Amount harus lebih dari 0" }, { status: 400 })
    }

    // Create transaction
    const { data: transaction, error: transactionError } = await supabase
      .from("financial_transactions")
      .insert({
        transaction_type,
        amount: Number(amount),
        notes: notes || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (transactionError) {
      console.error("[FINANCE API] Failed to create transaction:", transactionError)
      return NextResponse.json({ error: transactionError.message }, { status: 500 })
    }

    // Get updated balance
    const { data: balanceData } = await supabase.from("v_current_balance").select("*").single()
    const currentBalance = balanceData?.current_balance || 0

    return NextResponse.json(
      {
        transaction: {
          id: transaction.id,
          transactionType: transaction.transaction_type,
          amount: Number(transaction.amount),
          notes: transaction.notes,
          createdAt: transaction.created_at,
        },
        currentBalance: Number(currentBalance),
      },
      { status: 201 }
    )
  } catch (err: any) {
    console.error("[FINANCE API] Unexpected error:", err)
    return NextResponse.json({ error: err?.message ?? "Unexpected error" }, { status: 500 })
  }
}

