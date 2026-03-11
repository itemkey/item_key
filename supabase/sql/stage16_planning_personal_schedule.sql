-- Stage 16: personal schedule spaces + plans/lists workspace
-- Run after stage15_planning_schedule.sql
-- Safe to run multiple times.

create extension if not exists pgcrypto;

alter table public.ik_plan_projects
  add column if not exists kind text not null default 'board';

alter table public.ik_plan_projects
  drop constraint if exists ik_plan_projects_kind_check;

alter table public.ik_plan_projects
  add constraint ik_plan_projects_kind_check
  check (kind in ('board', 'schedule'));

create index if not exists idx_ik_plan_projects_kind_updated
  on public.ik_plan_projects(kind, updated_at desc);

create table if not exists public.ik_plan_schedule_lists (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ik_plan_projects(id) on delete cascade,
  name text not null,
  color text not null default '#2f6f4f',
  position numeric not null default 1024,
  version integer not null default 1,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(name) between 1 and 80),
  check (color ~ '^#[0-9A-Fa-f]{6}$'),
  unique (project_id, id)
);

create index if not exists idx_ik_plan_schedule_lists_project_position
  on public.ik_plan_schedule_lists(project_id, position asc, created_at asc);

create table if not exists public.ik_plan_schedule_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ik_plan_projects(id) on delete cascade,
  list_id uuid references public.ik_plan_schedule_lists(id) on delete set null,
  title text not null,
  note text not null default '',
  plan_date date,
  start_time time,
  end_time time,
  priority text not null default 'mid',
  repeat_rule text not null default 'none',
  repeat_until date,
  is_done boolean not null default false,
  version integer not null default 1,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(title) between 1 and 220),
  check (char_length(note) <= 2000),
  check (priority in ('low', 'mid', 'high')),
  check (repeat_rule in ('none', 'daily', 'weekly', 'monthly', 'yearly', 'weekdays', 'weekends')),
  check (start_time is null or end_time is null or end_time > start_time)
);

alter table public.ik_plan_schedule_plans
  add column if not exists repeat_rule text not null default 'none';

alter table public.ik_plan_schedule_plans
  add column if not exists repeat_until date;

alter table public.ik_plan_schedule_plans
  drop constraint if exists ik_plan_schedule_plans_repeat_rule_check;

alter table public.ik_plan_schedule_plans
  add constraint ik_plan_schedule_plans_repeat_rule_check
  check (repeat_rule in ('none', 'daily', 'weekly', 'monthly', 'yearly', 'weekdays', 'weekends'));

create index if not exists idx_ik_plan_schedule_plans_project_date
  on public.ik_plan_schedule_plans(project_id, plan_date asc, start_time asc, created_at asc);

create index if not exists idx_ik_plan_schedule_plans_project_list
  on public.ik_plan_schedule_plans(project_id, list_id, is_done, created_at asc);

drop trigger if exists trg_ik_plan_schedule_lists_updated_at on public.ik_plan_schedule_lists;
create trigger trg_ik_plan_schedule_lists_updated_at
before update on public.ik_plan_schedule_lists
for each row execute function public.set_updated_at();

drop trigger if exists trg_ik_plan_schedule_plans_updated_at on public.ik_plan_schedule_plans;
create trigger trg_ik_plan_schedule_plans_updated_at
before update on public.ik_plan_schedule_plans
for each row execute function public.set_updated_at();

alter table public.ik_plan_schedule_lists enable row level security;
alter table public.ik_plan_schedule_plans enable row level security;

drop policy if exists "ik_plan_schedule_lists_select_member" on public.ik_plan_schedule_lists;
create policy "ik_plan_schedule_lists_select_member"
on public.ik_plan_schedule_lists
for select
using (
  exists (
    select 1
    from public.ik_plan_members m
    where m.project_id = public.ik_plan_schedule_lists.project_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "ik_plan_schedule_plans_select_member" on public.ik_plan_schedule_plans;
create policy "ik_plan_schedule_plans_select_member"
on public.ik_plan_schedule_plans
for select
using (
  exists (
    select 1
    from public.ik_plan_members m
    where m.project_id = public.ik_plan_schedule_plans.project_id
      and m.user_id = auth.uid()
  )
);

grant select on public.ik_plan_schedule_lists to authenticated;
grant select on public.ik_plan_schedule_plans to authenticated;

drop function if exists public.ik_plan_list_projects();
create or replace function public.ik_plan_list_projects()
returns table (
  id uuid,
  name text,
  description text,
  role text,
  scope text,
  owner_id uuid,
  revision bigint,
  updated_at timestamptz,
  created_at timestamptz,
  card_count bigint,
  member_count bigint,
  pending_invite_count bigint,
  kind text,
  plan_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.name,
    p.description,
    m.role::text,
    case
      when coalesce(p.kind, 'board') = 'schedule' then 'personal'
      when coalesce(mm.member_count, 0) > 1 or coalesce(pi.pending_invite_count, 0) > 0 then 'shared'
      else 'personal'
    end as scope,
    p.owner_id,
    p.revision,
    p.updated_at,
    p.created_at,
    coalesce(c.card_count, 0) as card_count,
    coalesce(mm.member_count, 0) as member_count,
    coalesce(pi.pending_invite_count, 0) as pending_invite_count,
    coalesce(p.kind, 'board') as kind,
    coalesce(sp.plan_count, 0) as plan_count
  from public.ik_plan_members m
  join public.ik_plan_projects p on p.id = m.project_id
  left join lateral (
    select count(*)::bigint as card_count
    from public.ik_plan_cards c2
    where c2.project_id = p.id
  ) c on true
  left join lateral (
    select count(*)::bigint as member_count
    from public.ik_plan_members m2
    where m2.project_id = p.id
  ) mm on true
  left join lateral (
    select count(*)::bigint as pending_invite_count
    from public.ik_plan_invitations i2
    where i2.project_id = p.id
      and i2.status = 'pending'
      and i2.expires_at > now()
  ) pi on true
  left join lateral (
    select count(*)::bigint as plan_count
    from public.ik_plan_schedule_plans sp2
    where sp2.project_id = p.id
  ) sp on true
  where m.user_id = auth.uid()
  order by p.updated_at desc, p.created_at desc;
$$;

create or replace function public.ik_plan_create_schedule(
  p_name text,
  p_description text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_project_id uuid;
  v_name text := left(coalesce(nullif(btrim(p_name), ''), 'schedule'), 120);
  v_desc text := left(coalesce(btrim(p_description), ''), 500);
  v_revision bigint;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  insert into public.ik_plan_projects (name, description, owner_id, kind)
  values (v_name, v_desc, v_actor, 'schedule')
  returning id into v_project_id;

  insert into public.ik_plan_members(project_id, user_id, role)
  values (v_project_id, v_actor, 'owner');

  insert into public.ik_plan_schedule_lists(project_id, name, color, position, created_by, updated_by)
  values
    (v_project_id, 'inbox', '#1f2937', 1024, v_actor, v_actor),
    (v_project_id, 'work', '#005f73', 2048, v_actor, v_actor),
    (v_project_id, 'personal', '#6d597a', 3072, v_actor, v_actor);

  v_revision := public.ik_plan_next_revision(v_project_id);
  perform public.ik_plan_log_event(
    v_project_id,
    v_revision,
    'schedule.space_created',
    jsonb_build_object('project_id', v_project_id)
  );

  return v_project_id;
end;
$$;

create or replace function public.ik_plan_get_schedule_workspace(
  p_project_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_project record;
  v_lists jsonb := '[]'::jsonb;
  v_plans jsonb := '[]'::jsonb;
  v_calendar_counts jsonb := '[]'::jsonb;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  select
    p.id,
    p.name,
    p.description,
    p.kind,
    p.revision,
    p.updated_at,
    m.role::text as role
  into v_project
  from public.ik_plan_projects p
  join public.ik_plan_members m on m.project_id = p.id and m.user_id = v_actor
  where p.id = p_project_id;

  if v_project.id is null then
    raise exception 'forbidden';
  end if;

  if coalesce(v_project.kind, 'board') <> 'schedule' then
    raise exception 'schedule_project_required';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id,
    'name', l.name,
    'color', l.color,
    'position', l.position,
    'version', l.version,
    'created_at', l.created_at,
    'updated_at', l.updated_at
  ) order by l.position asc, l.created_at asc), '[]'::jsonb)
  into v_lists
  from public.ik_plan_schedule_lists l
  where l.project_id = p_project_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'list_id', s.list_id,
    'title', s.title,
    'note', s.note,
    'plan_date', s.plan_date,
    'start_time', s.start_time,
    'end_time', s.end_time,
    'priority', s.priority,
    'repeat_rule', s.repeat_rule,
    'repeat_until', s.repeat_until,
    'is_done', s.is_done,
    'version', s.version,
    'created_at', s.created_at,
    'updated_at', s.updated_at
  ) order by s.plan_date asc nulls last, s.start_time asc nulls last, s.created_at asc), '[]'::jsonb)
  into v_plans
  from public.ik_plan_schedule_plans s
  where s.project_id = p_project_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'date', x.plan_date,
    'count', x.cnt
  ) order by x.plan_date asc), '[]'::jsonb)
  into v_calendar_counts
  from (
    select s.plan_date, count(*)::integer as cnt
    from public.ik_plan_schedule_plans s
    where s.project_id = p_project_id
      and s.plan_date is not null
    group by s.plan_date
  ) x;

  return jsonb_build_object(
    'project', jsonb_build_object(
      'id', v_project.id,
      'name', v_project.name,
      'description', v_project.description,
      'kind', v_project.kind,
      'role', v_project.role,
      'revision', v_project.revision,
      'updated_at', v_project.updated_at
    ),
    'lists', v_lists,
    'plans', v_plans,
    'calendar_counts', v_calendar_counts
  );
end;
$$;

create or replace function public.ik_plan_create_schedule_list(
  p_project_id uuid,
  p_name text,
  p_color text default '#2f6f4f'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.ik_plan_member_role;
  v_kind text;
  v_name text := left(coalesce(nullif(btrim(p_name), ''), 'list'), 80);
  v_color text := case when coalesce(p_color, '') ~ '^#[0-9A-Fa-f]{6}$' then p_color else '#2f6f4f' end;
  v_position numeric;
  v_list_id uuid;
  v_revision bigint;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  select m.role, p.kind
  into v_role, v_kind
  from public.ik_plan_members m
  join public.ik_plan_projects p on p.id = m.project_id
  where m.project_id = p_project_id
    and m.user_id = v_actor;

  if v_role is null then
    raise exception 'forbidden';
  end if;

  if v_role not in ('owner', 'editor') then
    raise exception 'forbidden';
  end if;

  if coalesce(v_kind, 'board') <> 'schedule' then
    raise exception 'schedule_project_required';
  end if;

  select coalesce(max(l.position), 0) + 1024
  into v_position
  from public.ik_plan_schedule_lists l
  where l.project_id = p_project_id;

  insert into public.ik_plan_schedule_lists (
    project_id,
    name,
    color,
    position,
    version,
    created_by,
    updated_by
  )
  values (
    p_project_id,
    v_name,
    v_color,
    v_position,
    1,
    v_actor,
    v_actor
  )
  returning id into v_list_id;

  update public.ik_plan_projects p
  set updated_at = now()
  where p.id = p_project_id;

  v_revision := public.ik_plan_next_revision(p_project_id);
  perform public.ik_plan_log_event(
    p_project_id,
    v_revision,
    'schedule.list_created',
    jsonb_build_object('list_id', v_list_id)
  );

  return v_list_id;
end;
$$;

create or replace function public.ik_plan_update_schedule_list(
  p_project_id uuid,
  p_list_id uuid,
  p_name text,
  p_color text,
  p_position numeric default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.ik_plan_member_role;
  v_kind text;
  v_name text := left(coalesce(nullif(btrim(p_name), ''), 'list'), 80);
  v_color text := case when coalesce(p_color, '') ~ '^#[0-9A-Fa-f]{6}$' then p_color else '#2f6f4f' end;
  v_revision bigint;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  select m.role, p.kind
  into v_role, v_kind
  from public.ik_plan_members m
  join public.ik_plan_projects p on p.id = m.project_id
  where m.project_id = p_project_id
    and m.user_id = v_actor;

  if v_role is null then
    raise exception 'forbidden';
  end if;

  if v_role not in ('owner', 'editor') then
    raise exception 'forbidden';
  end if;

  if coalesce(v_kind, 'board') <> 'schedule' then
    raise exception 'schedule_project_required';
  end if;

  update public.ik_plan_schedule_lists l
  set name = v_name,
      color = v_color,
      position = coalesce(p_position, l.position),
      version = l.version + 1,
      updated_by = v_actor,
      updated_at = now()
  where l.id = p_list_id
    and l.project_id = p_project_id;

  if not found then
    raise exception 'schedule_list_not_found';
  end if;

  update public.ik_plan_projects p
  set updated_at = now()
  where p.id = p_project_id;

  v_revision := public.ik_plan_next_revision(p_project_id);
  perform public.ik_plan_log_event(
    p_project_id,
    v_revision,
    'schedule.list_updated',
    jsonb_build_object('list_id', p_list_id)
  );

  return true;
end;
$$;

create or replace function public.ik_plan_delete_schedule_list(
  p_project_id uuid,
  p_list_id uuid,
  p_move_plan_to uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.ik_plan_member_role;
  v_kind text;
  v_move_to uuid := p_move_plan_to;
  v_revision bigint;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  select m.role, p.kind
  into v_role, v_kind
  from public.ik_plan_members m
  join public.ik_plan_projects p on p.id = m.project_id
  where m.project_id = p_project_id
    and m.user_id = v_actor;

  if v_role is null then
    raise exception 'forbidden';
  end if;

  if v_role not in ('owner', 'editor') then
    raise exception 'forbidden';
  end if;

  if coalesce(v_kind, 'board') <> 'schedule' then
    raise exception 'schedule_project_required';
  end if;

  if not exists (
    select 1
    from public.ik_plan_schedule_lists l
    where l.id = p_list_id
      and l.project_id = p_project_id
  ) then
    raise exception 'schedule_list_not_found';
  end if;

  if v_move_to is not null then
    if not exists (
      select 1
      from public.ik_plan_schedule_lists l
      where l.id = v_move_to
        and l.project_id = p_project_id
    ) then
      raise exception 'schedule_list_not_found';
    end if;
  end if;

  update public.ik_plan_schedule_plans s
  set list_id = v_move_to,
      version = s.version + 1,
      updated_by = v_actor,
      updated_at = now()
  where s.project_id = p_project_id
    and s.list_id = p_list_id;

  delete from public.ik_plan_schedule_lists l
  where l.id = p_list_id
    and l.project_id = p_project_id;

  update public.ik_plan_projects p
  set updated_at = now()
  where p.id = p_project_id;

  v_revision := public.ik_plan_next_revision(p_project_id);
  perform public.ik_plan_log_event(
    p_project_id,
    v_revision,
    'schedule.list_deleted',
    jsonb_build_object('list_id', p_list_id, 'moved_to', v_move_to)
  );

  return true;
end;
$$;

drop function if exists public.ik_plan_create_schedule_plan(uuid, uuid, text, text, date, time, time, text);
create or replace function public.ik_plan_create_schedule_plan(
  p_project_id uuid,
  p_list_id uuid default null,
  p_title text default '',
  p_note text default '',
  p_plan_date date default null,
  p_start_time time default null,
  p_end_time time default null,
  p_priority text default 'mid',
  p_repeat_rule text default 'none',
  p_repeat_until date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.ik_plan_member_role;
  v_kind text;
  v_title text := left(coalesce(nullif(btrim(p_title), ''), 'plan'), 220);
  v_note text := left(coalesce(p_note, ''), 2000);
  v_priority text := lower(coalesce(nullif(btrim(p_priority), ''), 'mid'));
  v_repeat_rule text := lower(coalesce(nullif(btrim(p_repeat_rule), ''), 'none'));
  v_repeat_until date := p_repeat_until;
  v_plan_id uuid;
  v_revision bigint;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  select m.role, p.kind
  into v_role, v_kind
  from public.ik_plan_members m
  join public.ik_plan_projects p on p.id = m.project_id
  where m.project_id = p_project_id
    and m.user_id = v_actor;

  if v_role is null then
    raise exception 'forbidden';
  end if;

  if v_role not in ('owner', 'editor') then
    raise exception 'forbidden';
  end if;

  if coalesce(v_kind, 'board') <> 'schedule' then
    raise exception 'schedule_project_required';
  end if;

  if p_list_id is not null and not exists (
    select 1
    from public.ik_plan_schedule_lists l
    where l.id = p_list_id
      and l.project_id = p_project_id
  ) then
    raise exception 'schedule_list_not_found';
  end if;

  if p_start_time is not null and p_end_time is not null and p_end_time <= p_start_time then
    raise exception 'invalid_time_range';
  end if;

  if v_priority not in ('low', 'mid', 'high') then
    v_priority := 'mid';
  end if;

  if v_repeat_rule not in ('none', 'daily', 'weekly', 'monthly', 'yearly', 'weekdays', 'weekends') then
    v_repeat_rule := 'none';
  end if;

  if v_repeat_rule <> 'none' and p_plan_date is null then
    raise exception 'repeat_requires_date';
  end if;

  if v_repeat_rule = 'none' then
    v_repeat_until := null;
  elsif v_repeat_until is not null and p_plan_date is not null and v_repeat_until < p_plan_date then
    raise exception 'invalid_repeat_until';
  end if;

  insert into public.ik_plan_schedule_plans (
    project_id,
    list_id,
    title,
    note,
    plan_date,
    start_time,
    end_time,
    priority,
    repeat_rule,
    repeat_until,
    is_done,
    version,
    created_by,
    updated_by
  )
  values (
    p_project_id,
    p_list_id,
    v_title,
    v_note,
    p_plan_date,
    p_start_time,
    p_end_time,
    v_priority,
    v_repeat_rule,
    v_repeat_until,
    false,
    1,
    v_actor,
    v_actor
  )
  returning id into v_plan_id;

  update public.ik_plan_projects p
  set updated_at = now()
  where p.id = p_project_id;

  v_revision := public.ik_plan_next_revision(p_project_id);
  perform public.ik_plan_log_event(
    p_project_id,
    v_revision,
    'schedule.plan_created',
    jsonb_build_object('plan_id', v_plan_id)
  );

  return v_plan_id;
end;
$$;

drop function if exists public.ik_plan_update_schedule_plan(uuid, uuid, uuid, text, text, date, time, time, text, boolean);
create or replace function public.ik_plan_update_schedule_plan(
  p_project_id uuid,
  p_plan_id uuid,
  p_list_id uuid default null,
  p_title text default '',
  p_note text default '',
  p_plan_date date default null,
  p_start_time time default null,
  p_end_time time default null,
  p_priority text default 'mid',
  p_repeat_rule text default 'none',
  p_repeat_until date default null,
  p_is_done boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.ik_plan_member_role;
  v_kind text;
  v_title text := left(coalesce(nullif(btrim(p_title), ''), 'plan'), 220);
  v_note text := left(coalesce(p_note, ''), 2000);
  v_priority text := lower(coalesce(nullif(btrim(p_priority), ''), 'mid'));
  v_repeat_rule text := lower(coalesce(nullif(btrim(p_repeat_rule), ''), 'none'));
  v_repeat_until date := p_repeat_until;
  v_revision bigint;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  select m.role, p.kind
  into v_role, v_kind
  from public.ik_plan_members m
  join public.ik_plan_projects p on p.id = m.project_id
  where m.project_id = p_project_id
    and m.user_id = v_actor;

  if v_role is null then
    raise exception 'forbidden';
  end if;

  if v_role not in ('owner', 'editor') then
    raise exception 'forbidden';
  end if;

  if coalesce(v_kind, 'board') <> 'schedule' then
    raise exception 'schedule_project_required';
  end if;

  if p_list_id is not null and not exists (
    select 1
    from public.ik_plan_schedule_lists l
    where l.id = p_list_id
      and l.project_id = p_project_id
  ) then
    raise exception 'schedule_list_not_found';
  end if;

  if p_start_time is not null and p_end_time is not null and p_end_time <= p_start_time then
    raise exception 'invalid_time_range';
  end if;

  if v_priority not in ('low', 'mid', 'high') then
    v_priority := 'mid';
  end if;

  if v_repeat_rule not in ('none', 'daily', 'weekly', 'monthly', 'yearly', 'weekdays', 'weekends') then
    v_repeat_rule := 'none';
  end if;

  if v_repeat_rule <> 'none' and p_plan_date is null then
    raise exception 'repeat_requires_date';
  end if;

  if v_repeat_rule = 'none' then
    v_repeat_until := null;
  elsif v_repeat_until is not null and p_plan_date is not null and v_repeat_until < p_plan_date then
    raise exception 'invalid_repeat_until';
  end if;

  update public.ik_plan_schedule_plans s
  set list_id = p_list_id,
      title = v_title,
      note = v_note,
      plan_date = p_plan_date,
      start_time = p_start_time,
      end_time = p_end_time,
      priority = v_priority,
      repeat_rule = v_repeat_rule,
      repeat_until = v_repeat_until,
      is_done = coalesce(p_is_done, false),
      version = s.version + 1,
      updated_by = v_actor,
      updated_at = now()
  where s.id = p_plan_id
    and s.project_id = p_project_id;

  if not found then
    raise exception 'schedule_plan_not_found';
  end if;

  update public.ik_plan_projects p
  set updated_at = now()
  where p.id = p_project_id;

  v_revision := public.ik_plan_next_revision(p_project_id);
  perform public.ik_plan_log_event(
    p_project_id,
    v_revision,
    'schedule.plan_updated',
    jsonb_build_object('plan_id', p_plan_id)
  );

  return true;
end;
$$;

create or replace function public.ik_plan_toggle_schedule_plan_done(
  p_project_id uuid,
  p_plan_id uuid,
  p_is_done boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.ik_plan_member_role;
  v_kind text;
  v_revision bigint;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  select m.role, p.kind
  into v_role, v_kind
  from public.ik_plan_members m
  join public.ik_plan_projects p on p.id = m.project_id
  where m.project_id = p_project_id
    and m.user_id = v_actor;

  if v_role is null then
    raise exception 'forbidden';
  end if;

  if v_role not in ('owner', 'editor') then
    raise exception 'forbidden';
  end if;

  if coalesce(v_kind, 'board') <> 'schedule' then
    raise exception 'schedule_project_required';
  end if;

  update public.ik_plan_schedule_plans s
  set is_done = coalesce(p_is_done, false),
      version = s.version + 1,
      updated_by = v_actor,
      updated_at = now()
  where s.id = p_plan_id
    and s.project_id = p_project_id;

  if not found then
    raise exception 'schedule_plan_not_found';
  end if;

  update public.ik_plan_projects p
  set updated_at = now()
  where p.id = p_project_id;

  v_revision := public.ik_plan_next_revision(p_project_id);
  perform public.ik_plan_log_event(
    p_project_id,
    v_revision,
    'schedule.plan_toggled',
    jsonb_build_object('plan_id', p_plan_id, 'is_done', coalesce(p_is_done, false))
  );

  return true;
end;
$$;

create or replace function public.ik_plan_delete_schedule_plan(
  p_project_id uuid,
  p_plan_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.ik_plan_member_role;
  v_kind text;
  v_revision bigint;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  select m.role, p.kind
  into v_role, v_kind
  from public.ik_plan_members m
  join public.ik_plan_projects p on p.id = m.project_id
  where m.project_id = p_project_id
    and m.user_id = v_actor;

  if v_role is null then
    raise exception 'forbidden';
  end if;

  if v_role not in ('owner', 'editor') then
    raise exception 'forbidden';
  end if;

  if coalesce(v_kind, 'board') <> 'schedule' then
    raise exception 'schedule_project_required';
  end if;

  delete from public.ik_plan_schedule_plans s
  where s.id = p_plan_id
    and s.project_id = p_project_id;

  if not found then
    raise exception 'schedule_plan_not_found';
  end if;

  update public.ik_plan_projects p
  set updated_at = now()
  where p.id = p_project_id;

  v_revision := public.ik_plan_next_revision(p_project_id);
  perform public.ik_plan_log_event(
    p_project_id,
    v_revision,
    'schedule.plan_deleted',
    jsonb_build_object('plan_id', p_plan_id)
  );

  return true;
end;
$$;

revoke all on function public.ik_plan_list_projects() from public;
grant execute on function public.ik_plan_list_projects() to authenticated;

revoke all on function public.ik_plan_create_schedule(text, text) from public;
grant execute on function public.ik_plan_create_schedule(text, text) to authenticated;

revoke all on function public.ik_plan_get_schedule_workspace(uuid) from public;
grant execute on function public.ik_plan_get_schedule_workspace(uuid) to authenticated;

revoke all on function public.ik_plan_create_schedule_list(uuid, text, text) from public;
grant execute on function public.ik_plan_create_schedule_list(uuid, text, text) to authenticated;

revoke all on function public.ik_plan_update_schedule_list(uuid, uuid, text, text, numeric) from public;
grant execute on function public.ik_plan_update_schedule_list(uuid, uuid, text, text, numeric) to authenticated;

revoke all on function public.ik_plan_delete_schedule_list(uuid, uuid, uuid) from public;
grant execute on function public.ik_plan_delete_schedule_list(uuid, uuid, uuid) to authenticated;

revoke all on function public.ik_plan_create_schedule_plan(uuid, uuid, text, text, date, time, time, text, text, date) from public;
grant execute on function public.ik_plan_create_schedule_plan(uuid, uuid, text, text, date, time, time, text, text, date) to authenticated;

revoke all on function public.ik_plan_update_schedule_plan(uuid, uuid, uuid, text, text, date, time, time, text, text, date, boolean) from public;
grant execute on function public.ik_plan_update_schedule_plan(uuid, uuid, uuid, text, text, date, time, time, text, text, date, boolean) to authenticated;

revoke all on function public.ik_plan_toggle_schedule_plan_done(uuid, uuid, boolean) from public;
grant execute on function public.ik_plan_toggle_schedule_plan_done(uuid, uuid, boolean) to authenticated;

revoke all on function public.ik_plan_delete_schedule_plan(uuid, uuid) from public;
grant execute on function public.ik_plan_delete_schedule_plan(uuid, uuid) to authenticated;
