-- Stage 15: planning schedule (calendar/events)
-- Run after stage10_planning_shared_personal_tasks.sql
-- Safe to run multiple times.

create extension if not exists pgcrypto;

create table if not exists public.ik_plan_schedule_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ik_plan_projects(id) on delete cascade,
  title text not null,
  description text not null default '',
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  location text not null default '',
  tags jsonb not null default '[]'::jsonb,
  assignee_id uuid references auth.users(id) on delete set null,
  version integer not null default 1,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(title) between 1 and 180),
  check (char_length(description) <= 500),
  check (char_length(location) <= 120),
  check (start_at < end_at),
  check (jsonb_typeof(tags) = 'array')
);

create index if not exists idx_ik_plan_schedule_project_start
  on public.ik_plan_schedule_events(project_id, start_at asc);

create index if not exists idx_ik_plan_schedule_project_end
  on public.ik_plan_schedule_events(project_id, end_at asc);

create index if not exists idx_ik_plan_schedule_project_assignee
  on public.ik_plan_schedule_events(project_id, assignee_id, start_at asc);

drop trigger if exists trg_ik_plan_schedule_events_updated_at on public.ik_plan_schedule_events;
create trigger trg_ik_plan_schedule_events_updated_at
before update on public.ik_plan_schedule_events
for each row execute function public.set_updated_at();

alter table public.ik_plan_schedule_events enable row level security;

drop policy if exists "ik_plan_schedule_events_select_member" on public.ik_plan_schedule_events;
create policy "ik_plan_schedule_events_select_member"
on public.ik_plan_schedule_events
for select
using (
  exists (
    select 1
    from public.ik_plan_members m
    where m.project_id = public.ik_plan_schedule_events.project_id
      and m.user_id = auth.uid()
  )
);

grant select on public.ik_plan_schedule_events to authenticated;

create or replace function public.ik_plan_list_schedule_events(
  p_project_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  id uuid,
  title text,
  description text,
  start_at timestamptz,
  end_at timestamptz,
  all_day boolean,
  location text,
  tags jsonb,
  assignee_id uuid,
  assignee_user_id text,
  assignee_nickname text,
  version integer,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ik_plan_has_role(p_project_id, array['owner', 'editor', 'viewer']) then
    raise exception 'forbidden';
  end if;

  return query
  select
    e.id,
    e.title,
    e.description,
    e.start_at,
    e.end_at,
    e.all_day,
    e.location,
    e.tags,
    e.assignee_id,
    coalesce(up.user_id, '') as assignee_user_id,
    coalesce(up.nickname, '') as assignee_nickname,
    e.version,
    e.created_at,
    e.updated_at
  from public.ik_plan_schedule_events e
  left join public.ik_user_profiles up on up.id = e.assignee_id
  where e.project_id = p_project_id
    and e.start_at < p_to
    and e.end_at > p_from
  order by e.start_at asc, e.created_at asc;
end;
$$;

create or replace function public.ik_plan_create_schedule_event(
  p_project_id uuid,
  p_title text,
  p_description text default '',
  p_start_at timestamptz default null,
  p_end_at timestamptz default null,
  p_all_day boolean default false,
  p_location text default '',
  p_tags jsonb default '[]'::jsonb,
  p_assignee_id uuid default null,
  p_repeat_rule text default 'none',
  p_repeat_until date default null,
  p_base_revision bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_project_revision bigint;
  v_title text := left(coalesce(nullif(btrim(p_title), ''), 'event'), 180);
  v_desc text := left(coalesce(p_description, ''), 500);
  v_location text := left(coalesce(p_location, ''), 120);
  v_tags jsonb := coalesce(p_tags, '[]'::jsonb);
  v_repeat_rule text := lower(coalesce(p_repeat_rule, 'none'));
  v_first_id uuid;
  v_inserted_id uuid;
  v_created integer := 0;
  v_cur_start timestamptz;
  v_cur_end timestamptz;
  v_revision bigint;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if not public.ik_plan_has_role(p_project_id, array['owner', 'editor']) then
    raise exception 'forbidden';
  end if;

  if p_start_at is null or p_end_at is null or p_end_at <= p_start_at then
    raise exception 'invalid_time_range';
  end if;

  if jsonb_typeof(v_tags) <> 'array' then
    v_tags := '[]'::jsonb;
  end if;

  if p_assignee_id is not null and not exists (
    select 1
    from public.ik_plan_members m
    where m.project_id = p_project_id
      and m.user_id = p_assignee_id
  ) then
    raise exception 'assignee_not_member';
  end if;

  select p.revision into v_project_revision
  from public.ik_plan_projects p
  where p.id = p_project_id
  for update;

  if v_project_revision is null then
    raise exception 'project_not_found';
  end if;

  if p_base_revision is not null and p_base_revision <> v_project_revision then
    raise exception 'revision_conflict';
  end if;

  if v_repeat_rule not in ('none', 'weekly') then
    v_repeat_rule := 'none';
  end if;

  if v_repeat_rule = 'weekly' and p_repeat_until is not null and p_repeat_until >= p_start_at::date then
    v_cur_start := p_start_at;
    v_cur_end := p_end_at;

    while v_cur_start::date <= p_repeat_until and v_created < 104 loop
      insert into public.ik_plan_schedule_events (
        project_id,
        title,
        description,
        start_at,
        end_at,
        all_day,
        location,
        tags,
        assignee_id,
        version,
        created_by,
        updated_by
      )
      values (
        p_project_id,
        v_title,
        v_desc,
        v_cur_start,
        v_cur_end,
        coalesce(p_all_day, false),
        v_location,
        v_tags,
        p_assignee_id,
        1,
        v_actor,
        v_actor
      )
      returning id into v_inserted_id;

      if v_first_id is null then
        v_first_id := v_inserted_id;
      end if;

      v_created := v_created + 1;
      v_cur_start := v_cur_start + interval '7 days';
      v_cur_end := v_cur_end + interval '7 days';
    end loop;
  else
    insert into public.ik_plan_schedule_events (
      project_id,
      title,
      description,
      start_at,
      end_at,
      all_day,
      location,
      tags,
      assignee_id,
      version,
      created_by,
      updated_by
    )
    values (
      p_project_id,
      v_title,
      v_desc,
      p_start_at,
      p_end_at,
      coalesce(p_all_day, false),
      v_location,
      v_tags,
      p_assignee_id,
      1,
      v_actor,
      v_actor
    )
    returning id into v_first_id;

    v_created := 1;
  end if;

  v_revision := public.ik_plan_next_revision(p_project_id);
  perform public.ik_plan_log_event(
    p_project_id,
    v_revision,
    'schedule.created',
    jsonb_build_object(
      'event_id', v_first_id,
      'created', v_created,
      'repeat_rule', v_repeat_rule
    )
  );

  return jsonb_build_object(
    'event_id', v_first_id,
    'created', v_created,
    'revision', v_revision
  );
end;
$$;

create or replace function public.ik_plan_update_schedule_event(
  p_project_id uuid,
  p_event_id uuid,
  p_title text,
  p_description text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_all_day boolean,
  p_location text,
  p_tags jsonb,
  p_assignee_id uuid,
  p_base_version integer default null,
  p_base_revision bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_project_revision bigint;
  v_event public.ik_plan_schedule_events%rowtype;
  v_title text := left(coalesce(nullif(btrim(p_title), ''), 'event'), 180);
  v_desc text := left(coalesce(p_description, ''), 500);
  v_location text := left(coalesce(p_location, ''), 120);
  v_tags jsonb := coalesce(p_tags, '[]'::jsonb);
  v_revision bigint;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if not public.ik_plan_has_role(p_project_id, array['owner', 'editor']) then
    raise exception 'forbidden';
  end if;

  if p_start_at is null or p_end_at is null or p_end_at <= p_start_at then
    raise exception 'invalid_time_range';
  end if;

  if jsonb_typeof(v_tags) <> 'array' then
    v_tags := '[]'::jsonb;
  end if;

  if p_assignee_id is not null and not exists (
    select 1
    from public.ik_plan_members m
    where m.project_id = p_project_id
      and m.user_id = p_assignee_id
  ) then
    raise exception 'assignee_not_member';
  end if;

  select p.revision into v_project_revision
  from public.ik_plan_projects p
  where p.id = p_project_id
  for update;

  if v_project_revision is null then
    raise exception 'project_not_found';
  end if;

  if p_base_revision is not null and p_base_revision <> v_project_revision then
    raise exception 'revision_conflict';
  end if;

  select * into v_event
  from public.ik_plan_schedule_events e
  where e.id = p_event_id
    and e.project_id = p_project_id
  for update;

  if not found then
    raise exception 'schedule_event_not_found';
  end if;

  if p_base_version is not null and p_base_version <> v_event.version then
    raise exception 'version_conflict';
  end if;

  update public.ik_plan_schedule_events e
  set title = v_title,
      description = v_desc,
      start_at = p_start_at,
      end_at = p_end_at,
      all_day = coalesce(p_all_day, false),
      location = v_location,
      tags = v_tags,
      assignee_id = p_assignee_id,
      version = e.version + 1,
      updated_by = v_actor,
      updated_at = now()
  where e.id = p_event_id
    and e.project_id = p_project_id;

  v_revision := public.ik_plan_next_revision(p_project_id);
  perform public.ik_plan_log_event(
    p_project_id,
    v_revision,
    'schedule.updated',
    jsonb_build_object('event_id', p_event_id)
  );

  return jsonb_build_object('event_id', p_event_id, 'revision', v_revision);
end;
$$;

create or replace function public.ik_plan_delete_schedule_event(
  p_project_id uuid,
  p_event_id uuid,
  p_base_version integer default null,
  p_base_revision bigint default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_project_revision bigint;
  v_event_version integer;
  v_revision bigint;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if not public.ik_plan_has_role(p_project_id, array['owner', 'editor']) then
    raise exception 'forbidden';
  end if;

  select p.revision into v_project_revision
  from public.ik_plan_projects p
  where p.id = p_project_id
  for update;

  if v_project_revision is null then
    raise exception 'project_not_found';
  end if;

  if p_base_revision is not null and p_base_revision <> v_project_revision then
    raise exception 'revision_conflict';
  end if;

  select e.version into v_event_version
  from public.ik_plan_schedule_events e
  where e.id = p_event_id
    and e.project_id = p_project_id
  for update;

  if v_event_version is null then
    raise exception 'schedule_event_not_found';
  end if;

  if p_base_version is not null and p_base_version <> v_event_version then
    raise exception 'version_conflict';
  end if;

  delete from public.ik_plan_schedule_events e
  where e.id = p_event_id
    and e.project_id = p_project_id;

  v_revision := public.ik_plan_next_revision(p_project_id);
  perform public.ik_plan_log_event(
    p_project_id,
    v_revision,
    'schedule.deleted',
    jsonb_build_object('event_id', p_event_id)
  );

  return true;
end;
$$;

create or replace function public.ik_plan_move_schedule_event(
  p_project_id uuid,
  p_event_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_base_version integer default null,
  p_base_revision bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_project_revision bigint;
  v_event public.ik_plan_schedule_events%rowtype;
  v_revision bigint;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if not public.ik_plan_has_role(p_project_id, array['owner', 'editor']) then
    raise exception 'forbidden';
  end if;

  if p_start_at is null or p_end_at is null or p_end_at <= p_start_at then
    raise exception 'invalid_time_range';
  end if;

  select p.revision into v_project_revision
  from public.ik_plan_projects p
  where p.id = p_project_id
  for update;

  if v_project_revision is null then
    raise exception 'project_not_found';
  end if;

  if p_base_revision is not null and p_base_revision <> v_project_revision then
    raise exception 'revision_conflict';
  end if;

  select * into v_event
  from public.ik_plan_schedule_events e
  where e.id = p_event_id
    and e.project_id = p_project_id
  for update;

  if not found then
    raise exception 'schedule_event_not_found';
  end if;

  if p_base_version is not null and p_base_version <> v_event.version then
    raise exception 'version_conflict';
  end if;

  update public.ik_plan_schedule_events e
  set start_at = p_start_at,
      end_at = p_end_at,
      version = e.version + 1,
      updated_by = v_actor,
      updated_at = now()
  where e.id = p_event_id
    and e.project_id = p_project_id;

  v_revision := public.ik_plan_next_revision(p_project_id);
  perform public.ik_plan_log_event(
    p_project_id,
    v_revision,
    'schedule.moved',
    jsonb_build_object('event_id', p_event_id)
  );

  return jsonb_build_object('event_id', p_event_id, 'revision', v_revision);
end;
$$;

create or replace function public.ik_plan_copy_schedule_week(
  p_project_id uuid,
  p_source_week_start date,
  p_target_week_start date,
  p_base_revision bigint default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_project_revision bigint;
  v_source_start timestamptz;
  v_source_end timestamptz;
  v_shift interval;
  v_copied integer := 0;
  v_revision bigint;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if not public.ik_plan_has_role(p_project_id, array['owner', 'editor']) then
    raise exception 'forbidden';
  end if;

  if p_source_week_start is null or p_target_week_start is null then
    raise exception 'invalid_week_range';
  end if;

  select p.revision into v_project_revision
  from public.ik_plan_projects p
  where p.id = p_project_id
  for update;

  if v_project_revision is null then
    raise exception 'project_not_found';
  end if;

  if p_base_revision is not null and p_base_revision <> v_project_revision then
    raise exception 'revision_conflict';
  end if;

  v_source_start := p_source_week_start::timestamptz;
  v_source_end := (p_source_week_start + 7)::timestamptz;
  v_shift := ((p_target_week_start - p_source_week_start)::text || ' days')::interval;

  insert into public.ik_plan_schedule_events (
    project_id,
    title,
    description,
    start_at,
    end_at,
    all_day,
    location,
    tags,
    assignee_id,
    version,
    created_by,
    updated_by
  )
  select
    e.project_id,
    e.title,
    e.description,
    e.start_at + v_shift,
    e.end_at + v_shift,
    e.all_day,
    e.location,
    e.tags,
    e.assignee_id,
    1,
    v_actor,
    v_actor
  from public.ik_plan_schedule_events e
  where e.project_id = p_project_id
    and e.start_at >= v_source_start
    and e.start_at < v_source_end;

  get diagnostics v_copied = row_count;

  if v_copied > 0 then
    v_revision := public.ik_plan_next_revision(p_project_id);
    perform public.ik_plan_log_event(
      p_project_id,
      v_revision,
      'schedule.week_copied',
      jsonb_build_object(
        'source_week', p_source_week_start,
        'target_week', p_target_week_start,
        'count', v_copied
      )
    );
  end if;

  return v_copied;
end;
$$;

revoke all on function public.ik_plan_list_schedule_events(uuid, timestamptz, timestamptz) from public;
grant execute on function public.ik_plan_list_schedule_events(uuid, timestamptz, timestamptz) to authenticated;

revoke all on function public.ik_plan_create_schedule_event(uuid, text, text, timestamptz, timestamptz, boolean, text, jsonb, uuid, text, date, bigint) from public;
grant execute on function public.ik_plan_create_schedule_event(uuid, text, text, timestamptz, timestamptz, boolean, text, jsonb, uuid, text, date, bigint) to authenticated;

revoke all on function public.ik_plan_update_schedule_event(uuid, uuid, text, text, timestamptz, timestamptz, boolean, text, jsonb, uuid, integer, bigint) from public;
grant execute on function public.ik_plan_update_schedule_event(uuid, uuid, text, text, timestamptz, timestamptz, boolean, text, jsonb, uuid, integer, bigint) to authenticated;

revoke all on function public.ik_plan_delete_schedule_event(uuid, uuid, integer, bigint) from public;
grant execute on function public.ik_plan_delete_schedule_event(uuid, uuid, integer, bigint) to authenticated;

revoke all on function public.ik_plan_move_schedule_event(uuid, uuid, timestamptz, timestamptz, integer, bigint) from public;
grant execute on function public.ik_plan_move_schedule_event(uuid, uuid, timestamptz, timestamptz, integer, bigint) to authenticated;

revoke all on function public.ik_plan_copy_schedule_week(uuid, date, date, bigint) from public;
grant execute on function public.ik_plan_copy_schedule_week(uuid, date, date, bigint) to authenticated;
