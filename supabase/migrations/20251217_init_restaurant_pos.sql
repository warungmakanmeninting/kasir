-- =========================================
-- EXTENSIONS
-- =========================================
create extension if not exists "pgcrypto" with schema extensions;

-- =========================================
-- ENUM TYPES
-- =========================================
create type public.order_status as enum ('pending', 'preparing', 'completed', 'cancelled');

create type public.payment_status as enum ('unpaid', 'partial', 'paid', 'refunded');

-- jenis orderan: dine in, take away, gojek, grab, shopeefood
create type public.order_type as enum ('dine_in', 'takeaway', 'gojek', 'grab', 'shopeefood');

-- =========================================
-- PROFILES (USER / KARYAWAN)
-- =========================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'cashier', 'chef', 'manager')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================
-- MASTER DATA: CATEGORIES, PRODUCTS, VARIANTS
-- =========================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text,
  is_active boolean not null default true,
  sort_order integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id),
  name text not null,
  description text,
  price numeric(12,2) not null,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  track_stock boolean not null default false,
  image_url text,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabel varian produk (misal: ukuran, topping, dsb.)
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,                              -- contoh: Large, Extra Cheese
  price_delta numeric(12,2) not null default 0,   -- penyesuaian dari harga dasar produk
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================
-- PAYMENT METHODS (CASH, QRIS, TRANSFER)
-- =========================================
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                      -- 'cash', 'qris', 'transfer'
  name text not null,                             -- nama tampilan
  is_active boolean not null default true,
  sort_order integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed metode pembayaran dasar
insert into public.payment_methods (code, name, sort_order) values
  ('cash', 'Cash', 1),
  ('qris', 'QRIS', 2),
  ('transfer', 'Transfer Bank', 3);

-- =========================================
-- ORDERS (TRANSAKSI POS)
-- =========================================
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigserial unique,                  -- nomor urut mudah dibaca kasir

  status public.order_status not null default 'pending',
  order_type public.order_type not null default 'dine_in',

  customer_name text,
  table_number text,                              -- nomor meja (tanpa tabel master)

  subtotal numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  service_charge numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,         -- nilai akhir setelah pajak/diskon

  payment_status public.payment_status not null default 'unpaid',
  note text,

  cashier_id uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz
);

-- =========================================
-- ORDER ITEMS (DETAIL TIAP ITEM)
-- =========================================
create table public.order_items (
  id bigserial primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),

  product_name text not null,                     -- snapshot nama produk saat transaksi
  unit_price numeric(12,2) not null,             -- snapshot harga per unit (sudah include varian bila perlu)
  quantity integer not null check (quantity > 0),

  total numeric(12,2) generated always as (unit_price * quantity) stored,
  note text,                                      -- catatan per item, opsional
  created_at timestamptz not null default now()
);

-- =========================================
-- PAYMENTS (PEMBAYARAN)
-- =========================================
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,

  payment_method_id uuid not null references public.payment_methods(id),
  amount numeric(12,2) not null,

  paid_at timestamptz not null default now(),
  received_by uuid references public.profiles(id) on delete set null,

  change_given numeric(12,2) not null default 0,  -- uang kembalian (untuk cash)
  details jsonb,                                  -- info tambahan: no referensi, dsb.

  constraint payments_amount_positive check (amount > 0)
);

-- =========================================
-- RECEIPTS (RIWAYAT STRUK)
-- =========================================
create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,

  receipt_number bigserial unique,                -- nomor struk yang dicetak
  printed_at timestamptz not null default now(),
  printed_by uuid references public.profiles(id) on delete set null,

  copy_type text not null default 'original'
    check (copy_type in ('original','reprint')),

  data_snapshot jsonb not null                    -- snapshot JSON: order, items, payment, dll.
);

-- =========================================
-- REPORTING VIEWS
-- =========================================

-- Pendapatan harian (hanya order yang sudah dibayar)
create view public.v_daily_sales as
select
  date_trunc('day', created_at) as day,
  sum(total) as revenue,
  count(*) as orders
from public.orders
where payment_status = 'paid'
group by date_trunc('day', created_at)
order by day;

-- Penjualan per kategori
create view public.v_category_sales as
select
  coalesce(c.name, 'Uncategorized') as category,
  sum(oi.total) as revenue
from public.order_items oi
join public.orders o on o.id = oi.order_id
left join public.products p on p.id = oi.product_id
left join public.categories c on c.id = p.category_id
where o.payment_status = 'paid'
group by coalesce(c.name, 'Uncategorized')
order by revenue desc;

-- Top selling products
create view public.v_product_sales as
select
  oi.product_id,
  max(oi.product_name) as product_name,
  sum(oi.quantity) as quantity,
  sum(oi.total) as revenue
from public.order_items oi
join public.orders o on o.id = oi.order_id
where o.payment_status = 'paid'
group by oi.product_id
order by revenue desc;

-- =========================================
-- RLS HELPERS & POLICIES
-- =========================================

-- Helper function untuk pengecekan role user saat ini
create or replace function public.has_role(target_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = target_role
      and p.is_active = true
  );
$$;

-- =========================================
-- PROFILES
-- =========================================
alter table public.profiles enable row level security;

-- User bisa melihat profil sendiri, admin & manager bisa melihat semua
create policy "profiles_select_self_or_admin"
on public.profiles
for select
using (
  id = auth.uid()
  or public.has_role('admin')
  or public.has_role('manager')
);

-- User bisa update profil sendiri, admin & manager bisa update semua
create policy "profiles_update_self_or_admin"
on public.profiles
for update
using (
  id = auth.uid()
  or public.has_role('admin')
  or public.has_role('manager')
)
with check (
  id = auth.uid()
  or public.has_role('admin')
  or public.has_role('manager')
);

-- Hanya admin/manager yang boleh membuat & menghapus profil (karyawan)
create policy "profiles_insert_admin_only"
on public.profiles
for insert
with check (
  public.has_role('admin')
  or public.has_role('manager')
);

create policy "profiles_delete_admin_only"
on public.profiles
for delete
using (
  public.has_role('admin')
  or public.has_role('manager')
);

-- =========================================
-- CATEGORIES
-- =========================================
alter table public.categories enable row level security;

-- Semua role bisa melihat kategori
create policy "categories_select_all_roles"
on public.categories
for select
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
  or public.has_role('chef')
);

-- Hanya admin & manager yang bisa tulis (insert/update/delete) kategori
create policy "categories_write_admin_manager"
on public.categories
for all
using (
  public.has_role('admin')
  or public.has_role('manager')
)
with check (
  public.has_role('admin')
  or public.has_role('manager')
);

-- =========================================
-- PRODUCTS
-- =========================================
alter table public.products enable row level security;

create policy "products_select_all_roles"
on public.products
for select
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
  or public.has_role('chef')
);

create policy "products_write_admin_manager"
on public.products
for all
using (
  public.has_role('admin')
  or public.has_role('manager')
)
with check (
  public.has_role('admin')
  or public.has_role('manager')
);

-- =========================================
-- PRODUCT VARIANTS
-- =========================================
alter table public.product_variants enable row level security;

create policy "product_variants_select_all_roles"
on public.product_variants
for select
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
  or public.has_role('chef')
);

create policy "product_variants_write_admin_manager"
on public.product_variants
for all
using (
  public.has_role('admin')
  or public.has_role('manager')
)
with check (
  public.has_role('admin')
  or public.has_role('manager')
);

-- =========================================
-- PAYMENT METHODS
-- =========================================
alter table public.payment_methods enable row level security;

create policy "payment_methods_select_all_roles"
on public.payment_methods
for select
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
  or public.has_role('chef')
);

create policy "payment_methods_write_admin_manager"
on public.payment_methods
for all
using (
  public.has_role('admin')
  or public.has_role('manager')
)
with check (
  public.has_role('admin')
  or public.has_role('manager')
);

-- =========================================
-- ORDERS
-- =========================================
alter table public.orders enable row level security;

-- Semua role operasional bisa melihat order
create policy "orders_select_all_roles"
on public.orders
for select
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
  or public.has_role('chef')
);

-- Hanya admin/manager/cashier yang bisa membuat order
create policy "orders_insert_cashier_admin_manager"
on public.orders
for insert
with check (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
);

-- Admin/manager/cashier/chef bisa update status/order
create policy "orders_update_cashier_admin_manager_chef"
on public.orders
for update
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
  or public.has_role('chef')
)
with check (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
  or public.has_role('chef')
);

-- Hanya admin & manager yang boleh hapus order
create policy "orders_delete_admin_manager"
on public.orders
for delete
using (
  public.has_role('admin')
  or public.has_role('manager')
);

-- =========================================
-- ORDER ITEMS
-- =========================================
alter table public.order_items enable row level security;

-- Semua role operasional bisa lihat detail item
create policy "order_items_select_all_roles"
on public.order_items
for select
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
  or public.has_role('chef')
);

-- Hanya admin/manager/cashier yang boleh ubah detail item
create policy "order_items_write_cashier_admin_manager"
on public.order_items
for all
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
)
with check (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
);

-- =========================================
-- PAYMENTS
-- =========================================
alter table public.payments enable row level security;

-- Hanya admin/manager/cashier yang boleh lihat pembayaran
create policy "payments_select_cashier_admin_manager"
on public.payments
for select
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
);

-- Insert/update pembayaran: admin/manager/cashier
create policy "payments_insert_cashier_admin_manager"
on public.payments
for insert
with check (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
);

create policy "payments_update_cashier_admin_manager"
on public.payments
for update
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
)
with check (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
);

-- Hapus pembayaran: admin/manager saja
create policy "payments_delete_admin_manager"
on public.payments
for delete
using (
  public.has_role('admin')
  or public.has_role('manager')
);

-- =========================================
-- RECEIPTS
-- =========================================
alter table public.receipts enable row level security;

-- Kasir/admin/manager bisa lihat riwayat struk
create policy "receipts_select_cashier_admin_manager"
on public.receipts
for select
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
);

-- Kasir/admin/manager bisa membuat record struk baru
create policy "receipts_insert_cashier_admin_manager"
on public.receipts
for insert
with check (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
);

-- Update/hapus struk hanya oleh admin/manager
create policy "receipts_update_admin_manager"
on public.receipts
for update
using (
  public.has_role('admin')
  or public.has_role('manager')
)
with check (
  public.has_role('admin')
  or public.has_role('manager')
);

create policy "receipts_delete_admin_manager"
on public.receipts
for delete
using (
  public.has_role('admin')
  or public.has_role('manager')
);

