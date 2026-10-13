create index if not exists samples_archived_created_idx
on public.samples (archived_at, created_at desc);

create index if not exists samples_active_created_idx
on public.samples (created_at desc)
where archived_at is null;

create index if not exists samples_active_status_idx
on public.samples (status, created_at desc)
where archived_at is null;

create index if not exists samples_active_priority_idx
on public.samples (priority, created_at desc)
where archived_at is null;

create index if not exists sample_timeline_sample_action_created_idx
on public.sample_timeline (sample_id, action, created_at desc);

create index if not exists sample_timeline_sample_created_idx
on public.sample_timeline (sample_id, created_at desc);
