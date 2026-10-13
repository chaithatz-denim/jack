create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.app_users(id) on delete set null,
  actor_username text,
  action text not null,
  entity_type text not null,
  entity_id text,
  sample_id uuid references public.samples(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_actor_user_id_idx on public.audit_logs(actor_user_id);
create index if not exists audit_logs_action_idx on public.audit_logs(action);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);
create index if not exists audit_logs_sample_id_idx on public.audit_logs(sample_id);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_no_client_access" on public.audit_logs;
create policy "audit_logs_no_client_access"
on public.audit_logs for all
using (false)
with check (false);
