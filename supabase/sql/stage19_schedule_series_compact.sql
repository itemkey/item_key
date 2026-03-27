-- Stage 19: schedule series model for compact assistant UX
-- Run after stage18_schedule_v2.sql

create extension if not exists pgcrypto;

create table if not exists public.ik_sched_busy_series (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.ik_sched_spaces(id) on delete cascade,
  title text not null,
  category text not null default 'mandatory',
  weekday smallint not null,
  starts_on date not null,
  ends_on date,
  start_time time not null,
  end_time time not null,
  note text not null default '',
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(title) between 1 and 220),
  check (char_length(note) <= 1000),
  check (category in ('mandatory', 'personal', 'temporary')),
  check (weekday between 0 and 6),
  check (end_time > start_time),
  check (ends_on is null or ends_on >= starts_on)
);

create index if not exists idx_ik_sched_busy_series_space_active
  on public.ik_sched_busy_series(space_id, is_active, weekday, starts_on);

create index if not exists idx_ik_sched_busy_series_space_updated
  on public.ik_sched_busy_series(space_id, updated_at desc);

drop trigger if exists trg_ik_sched_busy_series_updated_at on public.ik_sched_busy_series;
create trigger trg_ik_sched_busy_series_updated_at
before update on public.ik_sched_busy_series
for each row execute function public.set_updated_at();

alter table public.ik_sched_busy_series enable row level security;

drop policy if exists "ik_sched_busy_series_owner_all" on public.ik_sched_busy_series;
create policy "ik_sched_busy_series_owner_all"
on public.ik_sched_busy_series
for all
using (
  exists (
    select 1
    from public.ik_sched_spaces s
    where s.id = public.ik_sched_busy_series.space_id
      and s.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.ik_sched_spaces s
    where s.id = public.ik_sched_busy_series.space_id
      and s.owner_id = auth.uid()
  )
);

grant select, insert, update, delete on public.ik_sched_busy_series to authenticated;

alter table public.ik_sched_blocks
  add column if not exists busy_series_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_ik_sched_blocks_busy_series'
      and conrelid = 'public.ik_sched_blocks'::regclass
  ) then
    alter table public.ik_sched_blocks
      add constraint fk_ik_sched_blocks_busy_series
      foreign key (busy_series_id)
      references public.ik_sched_busy_series(id)
      on delete cascade;
  end if;
end
$$;

create index if not exists idx_ik_sched_blocks_space_series_start
  on public.ik_sched_blocks(space_id, busy_series_id, starts_at asc);

create unique index if not exists ux_ik_sched_blocks_series_start
  on public.ik_sched_blocks(space_id, busy_series_id, starts_at)
  where busy_series_id is not null;

alter table public.ik_sched_blocks
  drop constraint if exists ik_sched_blocks_source_check;

alter table public.ik_sched_blocks
  add constraint ik_sched_blocks_source_check
  check (source in ('manual', 'assistant', 'import', 'sync', 'series'));
