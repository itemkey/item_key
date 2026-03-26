-- Stage 18: schedule v2 (full reset for schedule domain)
-- Run after stage16_planning_personal_schedule.sql (or later).
-- WARNING: this stage intentionally resets schedule data.

create extension if not exists pgcrypto;

-- Reset legacy schedule projects inside planning domain, keep board projects untouched.
do $$
begin
  if exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'ik_plan_projects'
      and c.column_name = 'kind'
  ) then
    delete from public.ik_plan_projects p
    where coalesce(p.kind, 'board') = 'schedule';
  end if;
exception
  when undefined_table then
    null;
end
$$;

drop function if exists public.ik_sched_get_or_create_default_space(text);

drop table if exists public.ik_sched_blocks cascade;
drop table if exists public.ik_sched_assistant_suggestions cascade;
drop table if exists public.ik_sched_assistant_runs cascade;
drop table if exists public.ik_sched_items cascade;
drop table if exists public.ik_sched_prefs cascade;
drop table if exists public.ik_sched_spaces cascade;

create table public.ik_sched_spaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  timezone text not null default 'UTC',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(name) between 1 and 120),
  check (char_length(timezone) between 1 and 80)
);

create index idx_ik_sched_spaces_owner_updated
  on public.ik_sched_spaces(owner_id, updated_at desc);

create table public.ik_sched_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_space_id uuid references public.ik_sched_spaces(id) on delete set null,
  notification_defaults jsonb not null default '{"enabled": true, "offsets": [60, 15]}'::jsonb,
  assistant_defaults jsonb not null default '{"mode": "deadline_focus", "horizon_days": 30, "day_start": "08:00", "day_end": "22:00"}'::jsonb,
  view_defaults jsonb not null default '{"mode": "month"}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(notification_defaults) = 'object'),
  check (jsonb_typeof(assistant_defaults) = 'object'),
  check (jsonb_typeof(view_defaults) = 'object')
);

create table public.ik_sched_items (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.ik_sched_spaces(id) on delete cascade,
  title text not null,
  description text not null default '',
  category text not null default 'mandatory',
  item_type text not null default 'task',
  priority text not null default 'mid',
  is_required boolean not null default false,
  estimated_minutes integer not null default 60,
  deadline_at timestamptz,
  preferred_period text not null default 'any',
  preferred_time_from time,
  preferred_time_to time,
  flexibility text not null default 'flexible',
  desired_day date,
  desired_start timestamptz,
  desired_end timestamptz,
  repeat_rule text not null default 'none',
  repeat_until date,
  notify_enabled boolean not null default true,
  notify_offsets jsonb not null default '[60, 15]'::jsonb,
  status text not null default 'pending',
  note text not null default '',
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(title) between 1 and 220),
  check (char_length(description) <= 1000),
  check (char_length(note) <= 1000),
  check (category in ('mandatory', 'personal', 'temporary')),
  check (item_type in ('task', 'event')),
  check (priority in ('low', 'mid', 'high', 'critical')),
  check (estimated_minutes between 15 and 720),
  check (preferred_period in ('any', 'morning', 'afternoon', 'evening', 'night')),
  check (flexibility in ('fixed', 'flexible', 'very_flexible')),
  check (repeat_rule in ('none', 'daily', 'weekly', 'monthly', 'yearly', 'weekdays', 'weekends')),
  check (status in ('pending', 'in_progress', 'scheduled', 'done', 'archived')),
  check (jsonb_typeof(notify_offsets) = 'array'),
  check (preferred_time_from is null or preferred_time_to is null or preferred_time_to > preferred_time_from),
  check (desired_start is null or desired_end is null or desired_end > desired_start),
  check (repeat_until is null or desired_day is null or repeat_until >= desired_day)
);

create index idx_ik_sched_items_space_created
  on public.ik_sched_items(space_id, created_at desc);

create index idx_ik_sched_items_space_deadline
  on public.ik_sched_items(space_id, deadline_at asc nulls last);

create index idx_ik_sched_items_space_status
  on public.ik_sched_items(space_id, status, updated_at desc);

create table public.ik_sched_assistant_runs (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.ik_sched_spaces(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  mode text not null default 'deadline_focus',
  horizon_days integer not null default 30,
  status text not null default 'completed',
  summary jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (mode in ('auto', 'deadline_focus', 'balanced', 'light')),
  check (horizon_days between 3 and 180),
  check (status in ('running', 'completed', 'failed', 'cancelled')),
  check (jsonb_typeof(summary) = 'object')
);

create index idx_ik_sched_runs_space_started
  on public.ik_sched_assistant_runs(space_id, started_at desc);

create table public.ik_sched_assistant_suggestions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.ik_sched_assistant_runs(id) on delete cascade,
  space_id uuid not null references public.ik_sched_spaces(id) on delete cascade,
  item_id uuid not null references public.ik_sched_items(id) on delete cascade,
  chunk_index integer not null default 1,
  chunk_total integer not null default 1,
  suggested_start_at timestamptz not null,
  suggested_end_at timestamptz not null,
  score numeric not null default 0,
  reason text not null default '',
  status text not null default 'pending',
  applied_block_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (chunk_index >= 1),
  check (chunk_total >= 1),
  check (chunk_index <= chunk_total),
  check (suggested_end_at > suggested_start_at),
  check (status in ('pending', 'accepted', 'accepted_edited', 'rejected', 'expired'))
);

create index idx_ik_sched_suggestions_space_status_start
  on public.ik_sched_assistant_suggestions(space_id, status, suggested_start_at asc);

create index idx_ik_sched_suggestions_run
  on public.ik_sched_assistant_suggestions(run_id, created_at asc);

create table public.ik_sched_blocks (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.ik_sched_spaces(id) on delete cascade,
  item_id uuid references public.ik_sched_items(id) on delete set null,
  suggestion_id uuid references public.ik_sched_assistant_suggestions(id) on delete set null,
  title text not null,
  category text not null default 'mandatory',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'planned',
  is_locked boolean not null default false,
  source text not null default 'manual',
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(title) between 1 and 220),
  check (category in ('mandatory', 'personal', 'temporary')),
  check (ends_at > starts_at),
  check (status in ('planned', 'done', 'skipped', 'cancelled')),
  check (source in ('manual', 'assistant', 'import', 'sync'))
);

create index idx_ik_sched_blocks_space_start
  on public.ik_sched_blocks(space_id, starts_at asc);

create index idx_ik_sched_blocks_space_item
  on public.ik_sched_blocks(space_id, item_id, starts_at asc);

drop trigger if exists trg_ik_sched_spaces_updated_at on public.ik_sched_spaces;
create trigger trg_ik_sched_spaces_updated_at
before update on public.ik_sched_spaces
for each row execute function public.set_updated_at();

drop trigger if exists trg_ik_sched_prefs_updated_at on public.ik_sched_prefs;
create trigger trg_ik_sched_prefs_updated_at
before update on public.ik_sched_prefs
for each row execute function public.set_updated_at();

drop trigger if exists trg_ik_sched_items_updated_at on public.ik_sched_items;
create trigger trg_ik_sched_items_updated_at
before update on public.ik_sched_items
for each row execute function public.set_updated_at();

drop trigger if exists trg_ik_sched_runs_updated_at on public.ik_sched_assistant_runs;
create trigger trg_ik_sched_runs_updated_at
before update on public.ik_sched_assistant_runs
for each row execute function public.set_updated_at();

drop trigger if exists trg_ik_sched_suggestions_updated_at on public.ik_sched_assistant_suggestions;
create trigger trg_ik_sched_suggestions_updated_at
before update on public.ik_sched_assistant_suggestions
for each row execute function public.set_updated_at();

drop trigger if exists trg_ik_sched_blocks_updated_at on public.ik_sched_blocks;
create trigger trg_ik_sched_blocks_updated_at
before update on public.ik_sched_blocks
for each row execute function public.set_updated_at();

alter table public.ik_sched_spaces enable row level security;
alter table public.ik_sched_prefs enable row level security;
alter table public.ik_sched_items enable row level security;
alter table public.ik_sched_assistant_runs enable row level security;
alter table public.ik_sched_assistant_suggestions enable row level security;
alter table public.ik_sched_blocks enable row level security;

drop policy if exists "ik_sched_spaces_owner_all" on public.ik_sched_spaces;
create policy "ik_sched_spaces_owner_all"
on public.ik_sched_spaces
for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "ik_sched_prefs_owner_all" on public.ik_sched_prefs;
create policy "ik_sched_prefs_owner_all"
on public.ik_sched_prefs
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "ik_sched_items_owner_all" on public.ik_sched_items;
create policy "ik_sched_items_owner_all"
on public.ik_sched_items
for all
using (
  exists (
    select 1
    from public.ik_sched_spaces s
    where s.id = public.ik_sched_items.space_id
      and s.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.ik_sched_spaces s
    where s.id = public.ik_sched_items.space_id
      and s.owner_id = auth.uid()
  )
);

drop policy if exists "ik_sched_runs_owner_all" on public.ik_sched_assistant_runs;
create policy "ik_sched_runs_owner_all"
on public.ik_sched_assistant_runs
for all
using (
  exists (
    select 1
    from public.ik_sched_spaces s
    where s.id = public.ik_sched_assistant_runs.space_id
      and s.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.ik_sched_spaces s
    where s.id = public.ik_sched_assistant_runs.space_id
      and s.owner_id = auth.uid()
  )
);

drop policy if exists "ik_sched_suggestions_owner_all" on public.ik_sched_assistant_suggestions;
create policy "ik_sched_suggestions_owner_all"
on public.ik_sched_assistant_suggestions
for all
using (
  exists (
    select 1
    from public.ik_sched_spaces s
    where s.id = public.ik_sched_assistant_suggestions.space_id
      and s.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.ik_sched_spaces s
    where s.id = public.ik_sched_assistant_suggestions.space_id
      and s.owner_id = auth.uid()
  )
);

drop policy if exists "ik_sched_blocks_owner_all" on public.ik_sched_blocks;
create policy "ik_sched_blocks_owner_all"
on public.ik_sched_blocks
for all
using (
  exists (
    select 1
    from public.ik_sched_spaces s
    where s.id = public.ik_sched_blocks.space_id
      and s.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.ik_sched_spaces s
    where s.id = public.ik_sched_blocks.space_id
      and s.owner_id = auth.uid()
  )
);

grant select, insert, update, delete on public.ik_sched_spaces to authenticated;
grant select, insert, update, delete on public.ik_sched_prefs to authenticated;
grant select, insert, update, delete on public.ik_sched_items to authenticated;
grant select, insert, update, delete on public.ik_sched_assistant_runs to authenticated;
grant select, insert, update, delete on public.ik_sched_assistant_suggestions to authenticated;
grant select, insert, update, delete on public.ik_sched_blocks to authenticated;

create or replace function public.ik_sched_get_or_create_default_space(
  p_name text default 'Мое расписание'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_space_id uuid;
  v_name text := left(coalesce(nullif(btrim(p_name), ''), 'Мое расписание'), 120);
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  select p.default_space_id
  into v_space_id
  from public.ik_sched_prefs p
  where p.user_id = v_actor;

  if v_space_id is not null and exists (
    select 1
    from public.ik_sched_spaces s
    where s.id = v_space_id
      and s.owner_id = v_actor
      and s.archived_at is null
  ) then
    return v_space_id;
  end if;

  select s.id
  into v_space_id
  from public.ik_sched_spaces s
  where s.owner_id = v_actor
    and s.archived_at is null
  order by s.updated_at desc, s.created_at desc
  limit 1;

  if v_space_id is null then
    insert into public.ik_sched_spaces(owner_id, name)
    values (v_actor, v_name)
    returning id into v_space_id;
  end if;

  insert into public.ik_sched_prefs(user_id, default_space_id)
  values (v_actor, v_space_id)
  on conflict (user_id) do update
  set default_space_id = excluded.default_space_id,
      updated_at = now();

  return v_space_id;
end;
$$;

revoke all on function public.ik_sched_get_or_create_default_space(text) from public;
grant execute on function public.ik_sched_get_or_create_default_space(text) to authenticated;
