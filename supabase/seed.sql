-- Seed data untuk schema 20251217_init_restaurant_pos.sql
-- Jalankan file ini di SQL editor Supabase atau lewat CLI (supabase db reset / db seed).

-- =========================================
-- PROFILES (contoh admin)
-- =========================================
-- Sebelum menjalankan bagian ini:
-- 1. Buat dulu user lewat menu Authentication Supabase, misalnya dengan email: admin@example.com
-- 2. Lalu jalankan blok SQL ini untuk mengisi tabel public.profiles sesuai skema.

insert into public.profiles (id, full_name, role, is_active)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', 'Administrator') as full_name,
  coalesce(u.raw_user_meta_data->>'role', 'admin') as role,
  true
from auth.users u
where u.email = 'admin@example.com'
  and not exists (
    select 1 from public.profiles p where p.id = u.id
  );

-- =========================================
-- CATEGORIES
-- =========================================
-- Menggunakan favicon sebagai nilai kolom icon (path ke file di folder public)

insert into public.categories (name, icon, is_active, sort_order)
select 'Appetizers', '/favicon.ico', true, 1
where not exists (select 1 from public.categories where name = 'Appetizers');

insert into public.categories (name, icon, is_active, sort_order)
select 'Main Course', '/favicon.ico', true, 2
where not exists (select 1 from public.categories where name = 'Main Course');

insert into public.categories (name, icon, is_active, sort_order)
select 'Desserts', '/favicon.ico', true, 3
where not exists (select 1 from public.categories where name = 'Desserts');

insert into public.categories (name, icon, is_active, sort_order)
select 'Beverages', '/favicon.ico', true, 4
where not exists (select 1 from public.categories where name = 'Beverages');

-- =========================================
-- PRODUCTS
-- =========================================
-- Seed produk contoh yang sesuai dengan UI default (Caesar Salad, Grilled Chicken, dll.)

insert into public.products (
  category_id,
  name,
  description,
  price,
  stock_quantity,
  track_stock,
  image_url,
  is_available
)
select
  (select id from public.categories where name = 'Appetizers' limit 1),
  'Caesar Salad',
  'Fresh romaine lettuce with parmesan',
  8.99,
  100,
  false,
  '/caesar-salad.png',
  true
where not exists (select 1 from public.products where name = 'Caesar Salad');

insert into public.products (
  category_id,
  name,
  description,
  price,
  stock_quantity,
  track_stock,
  image_url,
  is_available
)
select
  (select id from public.categories where name = 'Main Course' limit 1),
  'Grilled Chicken',
  'Tender chicken with herbs',
  15.99,
  100,
  false,
  '/grilled-chicken.png',
  true
where not exists (select 1 from public.products where name = 'Grilled Chicken');

insert into public.products (
  category_id,
  name,
  description,
  price,
  stock_quantity,
  track_stock,
  image_url,
  is_available
)
select
  (select id from public.categories where name = 'Desserts' limit 1),
  'Chocolate Cake',
  'Rich chocolate layered cake',
  6.99,
  100,
  false,
  '/decadent-chocolate-cake.png',
  true
where not exists (select 1 from public.products where name = 'Chocolate Cake');

insert into public.products (
  category_id,
  name,
  description,
  price,
  stock_quantity,
  track_stock,
  image_url,
  is_available
)
select
  (select id from public.categories where name = 'Beverages' limit 1),
  'Fresh Orange Juice',
  'Freshly squeezed oranges',
  4.99,
  100,
  false,
  '/glass-of-orange-juice.png',
  true
where not exists (select 1 from public.products where name = 'Fresh Orange Juice');

-- =========================================
-- PAYMENT METHODS
-- =========================================
-- Metode pembayaran dasar sudah disisipkan di migration 20251217_init_restaurant_pos.sql:
-- ('cash', 'Cash'), ('qris', 'QRIS'), ('transfer', 'Transfer Bank')
-- Bila perlu menambah metode pembayaran lain, bisa ditambahkan di bawah ini.


