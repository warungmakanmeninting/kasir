-- =========================================
-- FINANCIAL TRANSACTIONS (TRANSAKSI KEUANGAN)
-- =========================================
-- Tabel untuk mencatat pendapatan dan pengeluaran (tarik uang)

create type public.transaction_type as enum ('income', 'withdrawal');

create table public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  
  transaction_type public.transaction_type not null,
  amount numeric(12,2) not null check (amount > 0),
  notes text,                                    -- catatan/keterangan transaksi
  
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for faster queries
create index idx_financial_transactions_type on public.financial_transactions(transaction_type);
create index idx_financial_transactions_created_at on public.financial_transactions(created_at desc);

-- RLS Policies
alter table public.financial_transactions enable row level security;

-- Admin and Manager can do everything
create policy "financial_transactions_admin_manager_all"
  on public.financial_transactions
  for all
  using (public.has_role('admin') or public.has_role('manager'));

-- Cashier can only read (view transactions)
create policy "financial_transactions_cashier_read"
  on public.financial_transactions
  for select
  using (public.has_role('cashier'));

-- View untuk menghitung saldo saat ini
create view public.v_current_balance as
select
  coalesce(sum(case when transaction_type = 'income' then amount else 0 end), 0) -
  coalesce(sum(case when transaction_type = 'withdrawal' then amount else 0 end), 0) as current_balance
from public.financial_transactions;

-- View untuk ringkasan transaksi harian
create view public.v_daily_financial_summary as
select
  date_trunc('day', created_at) as day,
  sum(case when transaction_type = 'income' then amount else 0 end) as total_income,
  sum(case when transaction_type = 'withdrawal' then amount else 0 end) as total_withdrawal,
  sum(case when transaction_type = 'income' then amount else -amount end) as net_amount,
  count(*) as transaction_count
from public.financial_transactions
group by date_trunc('day', created_at)
order by day desc;

