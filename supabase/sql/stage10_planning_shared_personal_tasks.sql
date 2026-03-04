-- Stage 10: planning personal/shared scope + task assignee
-- Run after stage9_planning_collab.sql
-- Safe to run multiple times.

alter table public.ik_plan_cards
  add column if not exists assignee_id uuid references auth.users(id) on delete set null;

create index if not exists idx_ik_plan_cards_project_assignee
  on public.ik_plan_cards(project_id, assignee_id);

update public.ik_plan_cards c
set assignee_id = null
where c.assignee_id is not null
  and not exists (
    select 1
    from public.ik_plan_members m
    where m.project_id = c.project_id
      and m.user_id = c.assignee_id
  );

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
  pending_invite_count bigint
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
      when coalesce(mm.member_count, 0) > 1 or coalesce(pi.pending_invite_count, 0) > 0 then 'shared'
      else 'personal'
    end as scope,
    p.owner_id,
    p.revision,
    p.updated_at,
    p.created_at,
    coalesce(c.card_count, 0) as card_count,
    coalesce(mm.member_count, 0) as member_count,
    coalesce(pi.pending_invite_count, 0) as pending_invite_count
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
  where m.user_id = auth.uid()
  order by p.updated_at desc, p.created_at desc;
$$;

create or replace function public.ik_plan_get_board(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.ik_plan_member_role;
  v_project record;
  v_member_count bigint;
  v_pending_invite_count bigint;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  select p.* into v_project
  from public.ik_plan_projects p
  where p.id = p_project_id;

  if not found then
    raise exception 'project_not_found';
  end if;

  select m.role into v_role
  from public.ik_plan_members m
  where m.project_id = p_project_id
    and m.user_id = auth.uid();

  if v_role is null then
    raise exception 'forbidden';
  end if;

  select count(*)::bigint into v_member_count
  from public.ik_plan_members m
  where m.project_id = p_project_id;

  select count(*)::bigint into v_pending_invite_count
  from public.ik_plan_invitations i
  where i.project_id = p_project_id
    and i.status = 'pending'
    and i.expires_at > now();

  return jsonb_build_object(
    'project', jsonb_build_object(
      'id', v_project.id,
      'name', v_project.name,
      'description', v_project.description,
      'owner_id', v_project.owner_id,
      'revision', v_project.revision,
      'role', v_role::text,
      'scope', case when coalesce(v_member_count, 0) > 1 or coalesce(v_pending_invite_count, 0) > 0 then 'shared' else 'personal' end,
      'member_count', coalesce(v_member_count, 0),
      'pending_invite_count', coalesce(v_pending_invite_count, 0),
      'updated_at', v_project.updated_at,
      'created_at', v_project.created_at
    ),
    'members', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'user_id', m.user_id,
          'role', m.role::text,
          'nickname', coalesce(up.nickname, ''),
          'profile_user_id', coalesce(up.user_id, ''),
          'avatar_url', coalesce(up.avatar_url, ''),
          'created_at', m.created_at
        )
        order by m.created_at asc
      )
      from public.ik_plan_members m
      left join public.ik_user_profiles up on up.id = m.user_id
      where m.project_id = p_project_id
    ), '[]'::jsonb),
    'invitations', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'status', i.status::text,
          'inviter_id', i.inviter_id,
          'invitee_id', i.invitee_id,
          'inviter_nickname', coalesce(ip.nickname, ''),
          'inviter_user_id', coalesce(ip.user_id, ''),
          'invitee_nickname', coalesce(ap.nickname, ''),
          'invitee_user_id', coalesce(ap.user_id, ''),
          'created_at', i.created_at,
          'expires_at', i.expires_at,
          'message', i.message
        )
        order by i.created_at desc
      )
      from public.ik_plan_invitations i
      left join public.ik_user_profiles ip on ip.id = i.inviter_id
      left join public.ik_user_profiles ap on ap.id = i.invitee_id
      where i.project_id = p_project_id
        and i.status = 'pending'
        and i.expires_at > now()
    ), '[]'::jsonb),
    'columns', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'color', c.color,
          'role', c.role,
          'position', c.position,
          'version', c.version,
          'updated_by', c.updated_by,
          'updated_at', c.updated_at,
          'created_at', c.created_at
        )
        order by c.position asc, c.created_at asc
      )
      from public.ik_plan_columns c
      where c.project_id = p_project_id
    ), '[]'::jsonb),
    'cards', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'column_id', c.column_id,
          'name', c.name,
          'description', c.description,
          'priority', c.priority,
          'deadline', c.deadline,
          'tags', c.tags,
          'assignee_id', c.assignee_id,
          'assignee_user_id', coalesce(up.user_id, ''),
          'assignee_nickname', coalesce(up.nickname, ''),
          'position', c.position,
          'version', c.version,
          'updated_by', c.updated_by,
          'updated_at', c.updated_at,
          'created_at', c.created_at
        )
        order by c.column_id, c.position asc, c.created_at asc
      )
      from public.ik_plan_cards c
      left join public.ik_user_profiles up on up.id = c.assignee_id
      where c.project_id = p_project_id
    ), '[]'::jsonb)
  );
end;
$$;

drop function if exists public.ik_plan_create_card(uuid, uuid, text, text, text, date, jsonb, bigint);
create or replace function public.ik_plan_create_card(
  p_project_id uuid,
  p_column_id uuid,
  p_name text,
  p_description text default '',
  p_priority text default 'mid',
  p_deadline date default null,
  p_tags jsonb default '[]'::jsonb,
  p_assignee_id uuid default null,
  p_base_revision bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_project_revision bigint;
  v_priority text := lower(coalesce(p_priority, 'mid'));
  v_tags jsonb := coalesce(p_tags, '[]'::jsonb);
  v_name text := left(coalesce(nullif(btrim(p_name), ''), 'task'), 240);
  v_desc text := left(coalesce(p_description, ''), 4000);
  v_position numeric;
  v_card_id uuid;
  v_revision bigint;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if not public.ik_plan_has_role(p_project_id, array['owner', 'editor']) then
    raise exception 'forbidden';
  end if;

  if v_priority not in ('low', 'mid', 'high') then
    v_priority := 'mid';
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

  if not exists (
    select 1
    from public.ik_plan_columns c
    where c.id = p_column_id
      and c.project_id = p_project_id
  ) then
    raise exception 'column_not_found';
  end if;

  select coalesce(max(c.position), 0) + 1024 into v_position
  from public.ik_plan_cards c
  where c.project_id = p_project_id
    and c.column_id = p_column_id;

  insert into public.ik_plan_cards(
    project_id,
    column_id,
    name,
    description,
    priority,
    deadline,
    tags,
    assignee_id,
    position,
    version,
    created_by,
    updated_by
  )
  values (
    p_project_id,
    p_column_id,
    v_name,
    v_desc,
    v_priority,
    p_deadline,
    v_tags,
    p_assignee_id,
    v_position,
    1,
    v_actor,
    v_actor
  )
  returning id into v_card_id;

  v_revision := public.ik_plan_next_revision(p_project_id);
  perform public.ik_plan_log_event(
    p_project_id,
    v_revision,
    'card.created',
    jsonb_build_object(
      'card_id', v_card_id,
      'column_id', p_column_id,
      'position', v_position,
      'assignee_id', p_assignee_id
    )
  );

  return v_card_id;
end;
$$;

drop function if exists public.ik_plan_update_card(uuid, uuid, text, text, text, date, jsonb, uuid, integer, bigint);
create or replace function public.ik_plan_update_card(
  p_project_id uuid,
  p_card_id uuid,
  p_name text,
  p_description text,
  p_priority text,
  p_deadline date,
  p_tags jsonb,
  p_column_id uuid default null,
  p_assignee_id uuid default null,
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
  v_card public.ik_plan_cards%rowtype;
  v_priority text := lower(coalesce(p_priority, 'mid'));
  v_tags jsonb := coalesce(p_tags, '[]'::jsonb);
  v_name text := left(coalesce(nullif(btrim(p_name), ''), 'task'), 240);
  v_desc text := left(coalesce(p_description, ''), 4000);
  v_target_column uuid;
  v_target_position numeric;
  v_new_version integer;
  v_revision bigint;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if not public.ik_plan_has_role(p_project_id, array['owner', 'editor']) then
    raise exception 'forbidden';
  end if;

  if v_priority not in ('low', 'mid', 'high') then
    v_priority := 'mid';
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

  select * into v_card
  from public.ik_plan_cards c
  where c.id = p_card_id
    and c.project_id = p_project_id
  for update;

  if not found then
    raise exception 'card_not_found';
  end if;

  if p_base_version is not null and p_base_version <> v_card.version then
    raise exception 'version_conflict';
  end if;

  v_target_column := coalesce(p_column_id, v_card.column_id);

  if not exists (
    select 1
    from public.ik_plan_columns c
    where c.id = v_target_column
      and c.project_id = p_project_id
  ) then
    raise exception 'column_not_found';
  end if;

  if v_target_column <> v_card.column_id then
    select coalesce(max(c.position), 0) + 1024 into v_target_position
    from public.ik_plan_cards c
    where c.project_id = p_project_id
      and c.column_id = v_target_column;
  else
    v_target_position := v_card.position;
  end if;

  update public.ik_plan_cards c
  set name = v_name,
      description = v_desc,
      priority = v_priority,
      deadline = p_deadline,
      tags = v_tags,
      assignee_id = p_assignee_id,
      column_id = v_target_column,
      position = v_target_position,
      version = c.version + 1,
      updated_by = v_actor,
      updated_at = now()
  where c.id = p_card_id
    and c.project_id = p_project_id
  returning c.version into v_new_version;

  v_revision := public.ik_plan_next_revision(p_project_id);
  perform public.ik_plan_log_event(
    p_project_id,
    v_revision,
    'card.updated',
    jsonb_build_object(
      'card_id', p_card_id,
      'column_id', v_target_column,
      'version', v_new_version,
      'assignee_id', p_assignee_id
    )
  );

  return jsonb_build_object(
    'card_id', p_card_id,
    'version', v_new_version,
    'revision', v_revision,
    'column_id', v_target_column,
    'assignee_id', p_assignee_id
  );
end;
$$;

revoke all on function public.ik_plan_list_projects() from public;
grant execute on function public.ik_plan_list_projects() to authenticated;

revoke all on function public.ik_plan_get_board(uuid) from public;
grant execute on function public.ik_plan_get_board(uuid) to authenticated;

revoke all on function public.ik_plan_create_card(uuid, uuid, text, text, text, date, jsonb, uuid, bigint) from public;
grant execute on function public.ik_plan_create_card(uuid, uuid, text, text, text, date, jsonb, uuid, bigint) to authenticated;

revoke all on function public.ik_plan_update_card(uuid, uuid, text, text, text, date, jsonb, uuid, uuid, integer, bigint) from public;
grant execute on function public.ik_plan_update_card(uuid, uuid, text, text, text, date, jsonb, uuid, uuid, integer, bigint) to authenticated;
