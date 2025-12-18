-- Add print_status column to receipts table
alter table public.receipts
add column if not exists print_status text default 'pending'
  check (print_status in ('pending', 'printed', 'failed'));

-- Add comment
comment on column public.receipts.print_status is 'Status print struk: pending (belum print), printed (sudah print), failed (gagal print)';

-- Update existing receipts to 'printed' if they have printed_at
update public.receipts
set print_status = 'printed'
where print_status = 'pending' and printed_at is not null;

