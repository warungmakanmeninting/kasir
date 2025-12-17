-- =========================================
-- AUTH PROFILES TRIGGER
-- Lengkapi integrasi auth dengan tabel public.profiles
-- =========================================

-- Function untuk membuat / mengupdate row di public.profiles
-- setiap kali user baru dibuat di auth.users

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'cashier'),
    true
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        role = excluded.role,
        updated_at = now();

  return new;
end;
$$;

-- Trigger: dijalankan setelah user baru dibuat oleh Supabase Auth

drop trigger if exists handle_new_auth_user on auth.users;

create trigger handle_new_auth_user
after insert on auth.users
for each row
execute procedure public.handle_new_auth_user();


