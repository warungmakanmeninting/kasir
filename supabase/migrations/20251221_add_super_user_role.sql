-- Add super_user role to profiles table
-- Drop the old check constraint
alter table public.profiles drop constraint if exists profiles_role_check;

-- Add new check constraint with super_user
alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'cashier', 'chef', 'manager', 'super_user'));

