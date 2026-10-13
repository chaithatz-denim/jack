create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  display_name text not null,
  role text not null check (role in ('Admin', 'Pattern', 'Cutting', 'Mer', 'Viewer')),
  password_hash text not null,
  profile_image_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_users_role_idx on public.app_users(role);

alter table public.app_users enable row level security;

drop policy if exists "app_users_no_client_access" on public.app_users;
create policy "app_users_no_client_access"
on public.app_users for all
using (false)
with check (false);

-- Do not seed predictable login credentials in source control. Provision the
-- first Admin through the protected operational setup, then manage all other
-- users from the Admin-only User / Password settings screen.
