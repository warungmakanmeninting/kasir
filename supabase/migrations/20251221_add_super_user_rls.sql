-- =========================================
-- RLS POLICIES FOR SUPER_USER ROLE
-- =========================================
-- This migration adds RLS policies to allow super_user to access all tables
-- Super user should have full access (SELECT, INSERT, UPDATE, DELETE) to all tables

-- Update has_role function to include super_user
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

-- Helper function to check if user is super_user
create or replace function public.is_super_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('super_user');
$$;

-- =========================================
-- PROFILES
-- =========================================
-- Add super_user to existing policies
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
on public.profiles
for select
using (
  id = auth.uid()
  or public.has_role('admin')
  or public.has_role('manager')
  or public.is_super_user()
);

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin"
on public.profiles
for update
using (
  id = auth.uid()
  or public.has_role('admin')
  or public.has_role('manager')
  or public.is_super_user()
)
with check (
  id = auth.uid()
  or public.has_role('admin')
  or public.has_role('manager')
  or public.is_super_user()
);

drop policy if exists "profiles_insert_admin_only" on public.profiles;
create policy "profiles_insert_admin_only"
on public.profiles
for insert
with check (
  public.has_role('admin')
  or public.has_role('manager')
  or public.is_super_user()
);

drop policy if exists "profiles_delete_admin_only" on public.profiles;
create policy "profiles_delete_admin_only"
on public.profiles
for delete
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.is_super_user()
);

-- =========================================
-- CATEGORIES
-- =========================================
drop policy if exists "categories_select_all_roles" on public.categories;
create policy "categories_select_all_roles"
on public.categories
for select
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
  or public.has_role('chef')
  or public.is_super_user()
);

drop policy if exists "categories_write_admin_manager" on public.categories;
create policy "categories_write_admin_manager"
on public.categories
for all
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.is_super_user()
)
with check (
  public.has_role('admin')
  or public.has_role('manager')
  or public.is_super_user()
);

-- =========================================
-- PRODUCTS
-- =========================================
drop policy if exists "products_select_all_roles" on public.products;
create policy "products_select_all_roles"
on public.products
for select
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
  or public.has_role('chef')
  or public.is_super_user()
);

drop policy if exists "products_write_admin_manager" on public.products;
create policy "products_write_admin_manager"
on public.products
for all
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.is_super_user()
)
with check (
  public.has_role('admin')
  or public.has_role('manager')
  or public.is_super_user()
);

-- =========================================
-- PRODUCT VARIANTS
-- =========================================
drop policy if exists "product_variants_select_all_roles" on public.product_variants;
create policy "product_variants_select_all_roles"
on public.product_variants
for select
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
  or public.has_role('chef')
  or public.is_super_user()
);

drop policy if exists "product_variants_write_admin_manager" on public.product_variants;
create policy "product_variants_write_admin_manager"
on public.product_variants
for all
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.is_super_user()
)
with check (
  public.has_role('admin')
  or public.has_role('manager')
  or public.is_super_user()
);

-- =========================================
-- PAYMENT METHODS
-- =========================================
drop policy if exists "payment_methods_select_all_roles" on public.payment_methods;
create policy "payment_methods_select_all_roles"
on public.payment_methods
for select
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
  or public.has_role('chef')
  or public.is_super_user()
);

drop policy if exists "payment_methods_write_admin_manager" on public.payment_methods;
create policy "payment_methods_write_admin_manager"
on public.payment_methods
for all
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.is_super_user()
)
with check (
  public.has_role('admin')
  or public.has_role('manager')
  or public.is_super_user()
);

-- =========================================
-- ORDERS
-- =========================================
drop policy if exists "orders_select_all_roles" on public.orders;
create policy "orders_select_all_roles"
on public.orders
for select
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
  or public.has_role('chef')
  or public.is_super_user()
);

drop policy if exists "orders_insert_cashier_admin_manager" on public.orders;
create policy "orders_insert_cashier_admin_manager"
on public.orders
for insert
with check (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
  or public.is_super_user()
);

drop policy if exists "orders_update_cashier_admin_manager_chef" on public.orders;
create policy "orders_update_cashier_admin_manager_chef"
on public.orders
for update
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
  or public.has_role('chef')
  or public.is_super_user()
)
with check (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
  or public.has_role('chef')
  or public.is_super_user()
);

drop policy if exists "orders_delete_admin_manager" on public.orders;
create policy "orders_delete_admin_manager"
on public.orders
for delete
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.is_super_user()
);

-- =========================================
-- ORDER ITEMS
-- =========================================
drop policy if exists "order_items_select_all_roles" on public.order_items;
create policy "order_items_select_all_roles"
on public.order_items
for select
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
  or public.has_role('chef')
  or public.is_super_user()
);

drop policy if exists "order_items_write_cashier_admin_manager" on public.order_items;
create policy "order_items_write_cashier_admin_manager"
on public.order_items
for all
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
  or public.is_super_user()
)
with check (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
  or public.is_super_user()
);

-- =========================================
-- PAYMENTS
-- =========================================
drop policy if exists "payments_select_cashier_admin_manager" on public.payments;
create policy "payments_select_cashier_admin_manager"
on public.payments
for select
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
  or public.is_super_user()
);

drop policy if exists "payments_insert_cashier_admin_manager" on public.payments;
create policy "payments_insert_cashier_admin_manager"
on public.payments
for insert
with check (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
  or public.is_super_user()
);

drop policy if exists "payments_update_cashier_admin_manager" on public.payments;
create policy "payments_update_cashier_admin_manager"
on public.payments
for update
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
  or public.is_super_user()
)
with check (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
  or public.is_super_user()
);

drop policy if exists "payments_delete_admin_manager" on public.payments;
create policy "payments_delete_admin_manager"
on public.payments
for delete
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.is_super_user()
);

-- =========================================
-- RECEIPTS
-- =========================================
drop policy if exists "receipts_select_cashier_admin_manager" on public.receipts;
create policy "receipts_select_cashier_admin_manager"
on public.receipts
for select
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
  or public.is_super_user()
);

drop policy if exists "receipts_insert_cashier_admin_manager" on public.receipts;
create policy "receipts_insert_cashier_admin_manager"
on public.receipts
for insert
with check (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
  or public.is_super_user()
);

drop policy if exists "receipts_update_admin_manager" on public.receipts;
create policy "receipts_update_admin_manager"
on public.receipts
for update
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.is_super_user()
)
with check (
  public.has_role('admin')
  or public.has_role('manager')
  or public.is_super_user()
);

drop policy if exists "receipts_delete_admin_manager" on public.receipts;
create policy "receipts_delete_admin_manager"
on public.receipts
for delete
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.is_super_user()
);

-- =========================================
-- FINANCIAL TRANSACTIONS
-- =========================================
drop policy if exists "financial_transactions_admin_manager_all" on public.financial_transactions;
create policy "financial_transactions_admin_manager_all"
on public.financial_transactions
for all
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.is_super_user()
)
with check (
  public.has_role('admin')
  or public.has_role('manager')
  or public.is_super_user()
);

drop policy if exists "financial_transactions_cashier_read" on public.financial_transactions;
create policy "financial_transactions_cashier_read"
on public.financial_transactions
for select
using (
  public.has_role('cashier')
  or public.is_super_user()
);

-- =========================================
-- SETTINGS
-- =========================================
-- Enable RLS if not already enabled
alter table public.settings enable row level security;

-- Drop existing policies if they exist
drop policy if exists "settings_select_all_roles" on public.settings;
drop policy if exists "settings_write_admin_manager" on public.settings;
drop policy if exists "settings_admin_manage" on public.settings;

-- All authenticated users can read settings
create policy "settings_select_all_roles"
on public.settings
for select
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.has_role('cashier')
  or public.has_role('chef')
  or public.is_super_user()
);

-- Only admin, manager, and super_user can write settings
create policy "settings_write_admin_manager"
on public.settings
for all
using (
  public.has_role('admin')
  or public.has_role('manager')
  or public.is_super_user()
)
with check (
  public.has_role('admin')
  or public.has_role('manager')
  or public.is_super_user()
);

-- =========================================
-- STORAGE POLICIES (uploads bucket)
-- =========================================
-- Update storage policies to include super_user
drop policy if exists "uploads_admin_manager_insert" on storage.objects;
create policy "uploads_admin_manager_insert"
on storage.objects
for insert
with check (
  bucket_id = 'uploads'
  and (
    public.has_role('admin')
    or public.has_role('manager')
    or public.is_super_user()
  )
);

drop policy if exists "uploads_admin_manager_update" on storage.objects;
create policy "uploads_admin_manager_update"
on storage.objects
for update
using (
  bucket_id = 'uploads'
  and (
    public.has_role('admin')
    or public.has_role('manager')
    or public.is_super_user()
  )
)
with check (
  bucket_id = 'uploads'
  and (
    public.has_role('admin')
    or public.has_role('manager')
    or public.is_super_user()
  )
);

drop policy if exists "uploads_admin_manager_delete" on storage.objects;
create policy "uploads_admin_manager_delete"
on storage.objects
for delete
using (
  bucket_id = 'uploads'
  and (
    public.has_role('admin')
    or public.has_role('manager')
    or public.is_super_user()
  )
);

