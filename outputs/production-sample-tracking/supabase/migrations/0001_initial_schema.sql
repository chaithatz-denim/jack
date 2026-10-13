create extension if not exists "pgcrypto";

do $$ begin
  create type public.app_role as enum ('Admin', 'Pattern', 'Cutting', 'Mer', 'Viewer');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.sample_priority as enum ('Low', 'Normal', 'High', 'Urgent');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.sample_status as enum ('Pattern', 'Cutting', 'Embellishment', 'Sewing', 'Washing', 'QC', 'Complete', 'Cancelled', 'Hold');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null,
  role public.app_role not null default 'Viewer',
  profile_image_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.samples (
  id uuid primary key default gen_random_uuid(),
  sample_code text not null unique,
  model_id text,
  block_id text,
  cutting text,
  fabric_name text not null,
  thread_color text,
  fly text,
  washing text,
  priority public.sample_priority not null default 'Normal',
  status public.sample_status not null default 'Pattern',
  current_stage text not null default 'pattern',
  start_date date not null default current_date,
  due_date date,
  note text,
  washing_factory text,
  size_mode text not null default 'numeric' check (size_mode in ('numeric', 'letter')),
  sample_size text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.sample_timeline (
  id uuid primary key default gen_random_uuid(),
  sample_id uuid not null references public.samples(id) on delete cascade,
  stage text not null,
  action text not null,
  note text,
  from_status text,
  to_status text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.sample_files (
  id uuid primary key default gen_random_uuid(),
  sample_id uuid not null references public.samples(id) on delete cascade,
  bucket_id text not null default 'sample-files',
  storage_path text not null,
  file_name text not null,
  mime_type text,
  file_size bigint,
  stage text,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.sample_images (
  id uuid primary key default gen_random_uuid(),
  sample_id uuid not null references public.samples(id) on delete cascade,
  bucket_id text not null default 'sample-images',
  storage_path text not null,
  sort_order integer not null default 0,
  is_main boolean not null default false,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.sample_size_specs (
  id uuid primary key default gen_random_uuid(),
  sample_id uuid not null references public.samples(id) on delete cascade,
  measurement_point text not null,
  description text,
  tolerance text,
  values jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists samples_status_idx on public.samples(status);
create index if not exists samples_due_date_idx on public.samples(due_date);
create index if not exists samples_fabric_name_idx on public.samples(fabric_name);
create index if not exists sample_timeline_sample_id_idx on public.sample_timeline(sample_id);
create index if not exists sample_files_sample_id_idx on public.sample_files(sample_id);
create index if not exists sample_images_sample_id_idx on public.sample_images(sample_id);
create index if not exists sample_size_specs_sample_id_idx on public.sample_size_specs(sample_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists samples_touch_updated_at on public.samples;
create trigger samples_touch_updated_at
before update on public.samples
for each row execute function public.touch_updated_at();

drop trigger if exists sample_size_specs_touch_updated_at on public.sample_size_specs;
create trigger sample_size_specs_touch_updated_at
before update on public.sample_size_specs
for each row execute function public.touch_updated_at();

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'Viewer'::public.app_role);
$$;

alter table public.profiles enable row level security;
alter table public.samples enable row level security;
alter table public.sample_timeline enable row level security;
alter table public.sample_files enable row level security;
alter table public.sample_images enable row level security;
alter table public.sample_size_specs enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "profiles_admin_write" on public.profiles;
create policy "profiles_admin_write"
on public.profiles for all
to authenticated
using (public.current_user_role() = 'Admin')
with check (public.current_user_role() = 'Admin');

drop policy if exists "samples_select_authenticated" on public.samples;
create policy "samples_select_authenticated"
on public.samples for select
to authenticated
using (true);

drop policy if exists "samples_admin_write" on public.samples;
create policy "samples_admin_write"
on public.samples for all
to authenticated
using (public.current_user_role() = 'Admin')
with check (public.current_user_role() = 'Admin');

drop policy if exists "timeline_select_authenticated" on public.sample_timeline;
create policy "timeline_select_authenticated"
on public.sample_timeline for select
to authenticated
using (true);

drop policy if exists "timeline_role_insert" on public.sample_timeline;
create policy "timeline_role_insert"
on public.sample_timeline for insert
to authenticated
with check (public.current_user_role() in ('Admin', 'Pattern', 'Cutting', 'Mer'));

drop policy if exists "files_select_authenticated" on public.sample_files;
create policy "files_select_authenticated"
on public.sample_files for select
to authenticated
using (true);

drop policy if exists "files_role_write" on public.sample_files;
create policy "files_role_write"
on public.sample_files for all
to authenticated
using (public.current_user_role() in ('Admin', 'Pattern', 'Cutting', 'Mer'))
with check (public.current_user_role() in ('Admin', 'Pattern', 'Cutting', 'Mer'));

drop policy if exists "images_select_authenticated" on public.sample_images;
create policy "images_select_authenticated"
on public.sample_images for select
to authenticated
using (true);

drop policy if exists "images_role_write" on public.sample_images;
create policy "images_role_write"
on public.sample_images for all
to authenticated
using (public.current_user_role() in ('Admin', 'Pattern', 'Cutting', 'Mer'))
with check (public.current_user_role() in ('Admin', 'Pattern', 'Cutting', 'Mer'));

drop policy if exists "size_specs_select_authenticated" on public.sample_size_specs;
create policy "size_specs_select_authenticated"
on public.sample_size_specs for select
to authenticated
using (true);

drop policy if exists "size_specs_admin_mer_write" on public.sample_size_specs;
create policy "size_specs_admin_mer_write"
on public.sample_size_specs for all
to authenticated
using (public.current_user_role() in ('Admin', 'Mer'))
with check (public.current_user_role() in ('Admin', 'Mer'));
