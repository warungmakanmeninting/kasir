-- =========================================
-- DROP ICON COLUMN FROM CATEGORIES
-- =========================================
alter table public.categories drop column if exists icon;

-- =========================================
-- SETTINGS TABLE
-- =========================================
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value text not null,
  description text,
  category text not null default 'general',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Insert default settings
insert into public.settings (key, value, description, category) values
  ('restaurant_name', 'Warung Makan Meninting', 'Nama restoran yang akan muncul di struk', 'general'),
  ('restaurant_address', 'Jl. Raya Meninting No. 123', 'Alamat restoran', 'general'),
  ('restaurant_phone', '0812-3456-7890', 'Nomor telepon restoran', 'general'),
  ('tax_rate', '10', 'Persentase pajak (tanpa simbol %)', 'finance'),
  ('receipt_footer', 'Terima Kasih Atas Kunjungan Anda', 'Pesan footer di struk', 'receipt'),
  ('auto_print_receipt', 'true', 'Otomatis cetak struk setelah pembayaran (true/false)', 'receipt')
on conflict (key) do nothing;

-- RLS policies for settings
alter table public.settings enable row level security;

-- Admin/Manager can read dan write settings
create policy "settings_admin_manage"
  on public.settings
  for all
  using (public.has_role('admin') or public.has_role('manager'));

-- Semua role operasional boleh membaca settings (digunakan di POS, kitchen, dll)
create policy "settings_select_all_roles"
  on public.settings
  for select
  using (
    public.has_role('admin')
    or public.has_role('manager')
    or public.has_role('cashier')
    or public.has_role('chef')
  );

-- =========================================
-- UPDATE ORDERS TABLE
-- =========================================
-- Add missing columns to orders if not exists
alter table public.orders 
  add column if not exists customer_name text,
  add column if not exists table_number text,
  add column if not exists cashier_id uuid references public.profiles(id),
  add column if not exists payment_method_id uuid references public.payment_methods(id),
  add column if not exists subtotal numeric(12,2) not null default 0,
  add column if not exists tax numeric(12,2) not null default 0,
  add column if not exists notes text;

-- Update order_items to ensure foreign key
alter table public.order_items
  add column if not exists price numeric(12,2) not null default 0;

-- =========================================
-- UPDATE RECEIPTS TABLE
-- =========================================
-- Add order_id reference if not exists
alter table public.receipts
  add column if not exists cashier_id uuid references public.profiles(id);

-- =========================================
-- STORAGE BUCKET: uploads (untuk gambar produk)
-- =========================================

-- Bucket sudah dibuat via Dashboard dengan nama 'uploads', dokumentasikan di sini:
-- id      : uploads
-- public  : true  (gambar bisa diakses via URL publik)

-- RLS untuk bucket uploads
-- Catatan: Supabase biasanya sudah mengaktifkan RLS pada storage.objects di migration awal.
-- Jika belum, jalankan manual sekali di SQL editor (sebagai owner storage):
--   alter table storage.objects enable row level security;

-- Public read: siapa saja boleh melihat gambar di bucket uploads
drop policy if exists "uploads_public_read" on storage.objects;
create policy "uploads_public_read"
  on storage.objects
  for select
  using (bucket_id = 'uploads');

-- Admin & Manager boleh upload (insert) ke bucket uploads
drop policy if exists "uploads_admin_manager_insert" on storage.objects;
create policy "uploads_admin_manager_insert"
  on storage.objects
  for insert
  with check (
    bucket_id = 'uploads'
    and (
      public.has_role('admin')
      or public.has_role('manager')
    )
  );

-- Admin & Manager boleh update metadata / rename file di bucket uploads
drop policy if exists "uploads_admin_manager_update" on storage.objects;
create policy "uploads_admin_manager_update"
  on storage.objects
  for update
  using (
    bucket_id = 'uploads'
    and (
      public.has_role('admin')
      or public.has_role('manager')
    )
  )
  with check (
    bucket_id = 'uploads'
    and (
      public.has_role('admin')
      or public.has_role('manager')
    )
  );

-- Admin & Manager boleh delete file di bucket uploads
drop policy if exists "uploads_admin_manager_delete" on storage.objects;
create policy "uploads_admin_manager_delete"
  on storage.objects
  for delete
  using (
    bucket_id = 'uploads'
    and (
      public.has_role('admin')
      or public.has_role('manager')
    )
  );

-- Create index for better performance
create index if not exists idx_orders_created_at on public.orders(created_at desc);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_receipts_order_id on public.receipts(order_id);
create index if not exists idx_settings_category on public.settings(category);

-- Update timestamp trigger for settings
create or replace function public.update_settings_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_settings_timestamp on public.settings;
create trigger update_settings_timestamp
  before update on public.settings
  for each row
  execute function public.update_settings_timestamp();

