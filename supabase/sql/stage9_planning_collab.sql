-- Stage 9: planning collaboration with realtime events
-- Run after stage8_accounts_social.sql
-- Safe to run multiple times.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ik_plan_member_role') then
    create type public.ik_plan_member_role as enum ('owner', 'editor', 'viewer');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ik_plan_invite_status') then
    create type public.ik_plan_invite_status as enum ('pending', 'accepted', 'rejected', 'cancelled', 'expired');
  end if;
end $$;

create table if not exists public.ik_plan_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  owner_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(name) between 1 and 120),
  check (char_length(description) <= 500)
);

create index if not exists idx_ik_plan_projects_owner on public.ik_plan_projects(owner_id);
create index if not exists idx_ik_plan_projects_updated on public.ik_plan_projects(updated_at desc);

create table if not exists public.ik_plan_members (
  project_id uuid not null references public.ik_plan_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.ik_plan_member_role not null default 'editor',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists idx_ik_plan_members_user on public.ik_plan_members(user_id);
create index if not exists idx_ik_plan_members_project_role on public.ik_plan_members(project_id, role);

create table if not exists public.ik_plan_invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ik_plan_projects(id) on delete cascade,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid not null references auth.users(id) on delete cascade,
  status public.ik_plan_invite_status not null default 'pending',
  message text not null default '',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  check (inviter_id <> invitee_id),
  check (char_length(message) <= 300)
);

create index if not exists idx_ik_plan_invites_project on public.ik_plan_invitations(project_id);
create index if not exists idx_ik_plan_invites_invitee_status on public.ik_plan_invitations(invitee_id, status, created_at desc);

create unique index if not exists idx_ik_plan_invites_pending_unique
  on public.ik_plan_invitations(project_id, invitee_id)
  where status = 'pending';

create table if not exists public.ik_plan_columns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ik_plan_projects(id) on delete cascade,
  name text not null,
  color text not null default '#111111',
  role text not null default 'todo',
  position numeric not null default 1024,
  version integer not null default 1,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(name) between 1 and 120),
  check (color ~ '^#[0-9A-Fa-f]{6}$'),
  check (role in ('todo', 'doing', 'done')),
  unique (project_id, id)
);

create index if not exists idx_ik_plan_columns_project_position on public.ik_plan_columns(project_id, position asc);

create table if not exists public.ik_plan_cards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ik_plan_projects(id) on delete cascade,
  column_id uuid not null,
  name text not null,
  description text not null default '',
  priority text not null default 'mid',
  deadline date,
  tags jsonb not null default '[]'::jsonb,
  position numeric not null default 1024,
  version integer not null default 1,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(name) between 1 and 240),
  check (char_length(description) <= 4000),
  check (priority in ('low', 'mid', 'high')),
  check (jsonb_typeof(tags) = 'array'),
  unique (project_id, id),
  constraint fk_ik_plan_cards_column_project
    foreign key (column_id, project_id)
    references public.ik_plan_columns(id, project_id)
    on delete cascade
);

create index if not exists idx_ik_plan_cards_project_column_position
  on public.ik_plan_cards(project_id, column_id, position asc, created_at asc);

create index if not exists idx_ik_plan_cards_project_updated
  on public.ik_plan_cards(project_id, updated_at desc);

create index if not exists idx_ik_plan_cards_tags on public.ik_plan_cards using gin (tags);

create table if not exists public.ik_plan_events (
  id bigserial primary key,
  project_id uuid not null references public.ik_plan_projects(id) on delete cascade,
  revision bigint not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (project_id, revision)
);

create index if not exists idx_ik_plan_events_project_revision
  on public.ik_plan_events(project_id, revision desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ik_plan_projects_updated_at on public.ik_plan_projects;
create trigger trg_ik_plan_projects_updated_at
before update on public.ik_plan_projects
for each row execute function public.set_updated_at();

drop trigger if exists trg_ik_plan_members_updated_at on public.ik_plan_members;
create trigger trg_ik_plan_members_updated_at
before update on public.ik_plan_members
for each row execute function public.set_updated_at();

drop trigger if exists trg_ik_plan_columns_updated_at on public.ik_plan_columns;
create trigger trg_ik_plan_columns_updated_at
before update on public.ik_plan_columns
for each row execute function public.set_updated_at();

drop trigger if exists trg_ik_plan_cards_updated_at on public.ik_plan_cards;
create trigger trg_ik_plan_cards_updated_at
before update on public.ik_plan_cards
for each row execute function public.set_updated_at();

alter table public.ik_plan_projects enable row level security;
alter table public.ik_plan_members enable row level security;
alter table public.ik_plan_invitations enable row level security;
alter table public.ik_plan_columns enable row level security;
alter table public.ik_plan_cards enable row level security;
alter table public.ik_plan_events enable row level security;

drop policy if exists "ik_plan_projects_select_member" on public.ik_plan_projects;
create policy "ik_plan_projects_select_member"
on public.ik_plan_projects
for select
using (
  exists (
    select 1
    from public.ik_plan_members m
    where m.project_id = public.ik_plan_projects.id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "ik_plan_members_select_member" on public.ik_plan_members;
create policy "ik_plan_members_select_member"
on public.ik_plan_members
for select
using (
  user_id = auth.uid()
);

drop policy if exists "ik_plan_invitations_select_visible" on public.ik_plan_invitations;
create policy "ik_plan_invitations_select_visible"
on public.ik_plan_invitations
for select
using (
  inviter_id = auth.uid()
  or invitee_id = auth.uid()
  or exists (
    select 1
    from public.ik_plan_members m
    where m.project_id = public.ik_plan_invitations.project_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "ik_plan_columns_select_member" on public.ik_plan_columns;
create policy "ik_plan_columns_select_member"
on public.ik_plan_columns
for select
using (
  exists (
    select 1
    from public.ik_plan_members m
    where m.project_id = public.ik_plan_columns.project_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "ik_plan_cards_select_member" on public.ik_plan_cards;
create policy "ik_plan_cards_select_member"
on public.ik_plan_cards
for select
using (
  exists (
    select 1
    from public.ik_plan_members m
    where m.project_id = public.ik_plan_cards.project_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "ik_plan_events_select_member" on public.ik_plan_events;
create policy "ik_plan_events_select_member"
on public.ik_plan_events
for select
using (
  exists (
    select 1
    from public.ik_plan_members m
    where m.project_id = public.ik_plan_events.project_id
      and m.user_id = auth.uid()
  )
);

grant select on public.ik_plan_projects to authenticated;
grant select on public.ik_plan_members to authenticated;
grant select on public.ik_plan_invitations to authenticated;
grant select on public.ik_plan_columns to authenticated;
grant select on public.ik_plan_cards to authenticated;
grant select on public.ik_plan_events to authenticated;

create or replace function public.ik_plan_has_role(p_project_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ik_plan_members m
    where m.project_id = p_project_id
      and m.user_id = auth.uid()
      and m.role::text = any(p_roles)
  );
$$;

create or replace function public.ik_plan_next_revision(p_project_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revision bigint;
begin
  update public.ik_plan_projects
  set revision = revision + 1,
      updated_at = now()
  where id = p_project_id
  returning revision into v_revision;

  if v_revision is null then
    raise exception 'project_not_found';
  end if;

  return v_revision;
end;
$$;

create or replace function public.ik_plan_log_event(
  p_project_id uuid,
  p_revision bigint,
  p_event_type text,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ik_plan_events(project_id, revision, actor_id, event_type, payload)
  values (p_project_id, p_revision, auth.uid(), p_event_type, coalesce(p_payload, '{}'::jsonb));
end;
$$;

create or replace function public.ik_plan_list_projects()
returns table (
  id uuid,
  name text,
  description text,
  role text,
  owner_id uuid,
  revision bigint,
  updated_at timestamptz,
  created_at timestamptz,
  card_count bigint,
  member_count bigint
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
    p.owner_id,
    p.revision,
    p.updated_at,
    p.created_at,
    coalesce(c.card_count, 0) as card_count,
    coalesce(mm.member_count, 0) as member_count
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

  return jsonb_build_object(
    'project', jsonb_build_object(
      'id', v_project.id,
      'name', v_project.name,
      'description', v_project.description,
      'owner_id', v_project.owner_id,
      'revision', v_project.revision,
      'role', v_role::text,
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
          'position', c.position,
          'version', c.version,
          'updated_by', c.updated_by,
          'updated_at', c.updated_at,
          'created_at', c.created_at
        )
        order by c.column_id, c.position asc, c.created_at asc
      )
      from public.ik_plan_cards c
      where c.project_id = p_project_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.ik_plan_get_events_since(p_project_id uuid, p_since bigint default 0)
returns table (
  revision bigint,
  event_type text,
  actor_id uuid,
  payload jsonb,
  created_at timestamptz
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
  select e.revision, e.event_type, e.actor_id, e.payload, e.created_at
  from public.ik_plan_events e
  where e.project_id = p_project_id
    and e.revision > coalesce(p_since, 0)
  order by e.revision asc
  limit 300;
end;
$$;

create or replace function public.ik_plan_list_incoming_invitations()
returns table (
  invitation_id uuid,
  project_id uuid,
  project_name text,
  inviter_id uuid,
  inviter_user_id text,
  inviter_nickname text,
  inviter_avatar_url text,
  created_at timestamptz,
  expires_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    i.id as invitation_id,
    p.id as project_id,
    p.name as project_name,
    i.inviter_id,
    coalesce(up.user_id, '') as inviter_user_id,
    coalesce(up.nickname, '') as inviter_nickname,
    coalesce(up.avatar_url, '') as inviter_avatar_url,
    i.created_at,
    i.expires_at
  from public.ik_plan_invitations i
  join public.ik_plan_projects p on p.id = i.project_id
  left join public.ik_user_profiles up on up.id = i.inviter_id
  where i.invitee_id = auth.uid()
    and i.status = 'pending'
    and i.expires_at > now()
  order by i.created_at desc;
$$;

create or replace function public.ik_plan_create_project(
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
  v_name text := left(coalesce(nullif(btrim(p_name), ''), 'project'), 120);
  v_desc text := left(coalesce(btrim(p_description), ''), 500);
  v_revision bigint;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  insert into public.ik_plan_projects (name, description, owner_id)
  values (v_name, v_desc, v_actor)
  returning id into v_project_id;

  insert into public.ik_plan_members(project_id, user_id, role)
  values (v_project_id, v_actor, 'owner');

  insert into public.ik_plan_columns(project_id, name, color, role, position, created_by, updated_by)
  values
    (v_project_id, 'backlog', '#111111', 'todo', 1024, v_actor, v_actor),
    (v_project_id, 'in progress', '#aa5f00', 'doing', 2048, v_actor, v_actor),
    (v_project_id, 'review', '#005aaa', 'doing', 3072, v_actor, v_actor),
    (v_project_id, 'done', '#008c46', 'done', 4096, v_actor, v_actor);

  v_revision := public.ik_plan_next_revision(v_project_id);
  perform public.ik_plan_log_event(
    v_project_id,
    v_revision,
    'project.created',
    jsonb_build_object('project_id', v_project_id)
  );

  return v_project_id;
end;
$$;

create or replace function public.ik_plan_delete_project(
  p_project_id uuid,
  p_base_revision bigint default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.ik_plan_member_role;
  v_revision bigint;
begin
  select m.role into v_role
  from public.ik_plan_members m
  where m.project_id = p_project_id
    and m.user_id = auth.uid();

  if v_role is null then
    raise exception 'forbidden';
  end if;

  if v_role <> 'owner' then
    raise exception 'only_owner_can_delete_project';
  end if;

  select p.revision into v_revision
  from public.ik_plan_projects p
  where p.id = p_project_id
  for update;

  if v_revision is null then
    raise exception 'project_not_found';
  end if;

  if p_base_revision is not null and p_base_revision <> v_revision then
    raise exception 'revision_conflict';
  end if;

  delete from public.ik_plan_projects p
  where p.id = p_project_id;

  return true;
end;
$$;

create or replace function public.ik_plan_invite_friend(
  p_project_id uuid,
  p_target_user_id text,
  p_message text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_target uuid;
  v_target_handle text := public.ik_sanitize_user_id(p_target_user_id);
  v_invite_id uuid;
  v_revision bigint;
  v_message text := left(coalesce(btrim(p_message), ''), 300);
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if not public.ik_plan_has_role(p_project_id, array['owner', 'editor']) then
    raise exception 'forbidden';
  end if;

  if v_target_handle = '' then
    raise exception 'target_user_not_found';
  end if;

  select up.id into v_target
  from public.ik_user_profiles up
  where lower(up.user_id) = lower(v_target_handle)
  limit 1;

  if v_target is null then
    raise exception 'target_user_not_found';
  end if;

  if v_target = v_actor then
    raise exception 'cannot_invite_self';
  end if;

  if not exists (
    select 1
    from public.ik_friendships f
    where f.user_low = least(v_actor, v_target)
      and f.user_high = greatest(v_actor, v_target)
  ) then
    raise exception 'not_friends';
  end if;

  if exists (
    select 1
    from public.ik_plan_members m
    where m.project_id = p_project_id
      and m.user_id = v_target
  ) then
    raise exception 'already_member';
  end if;

  select i.id into v_invite_id
  from public.ik_plan_invitations i
  where i.project_id = p_project_id
    and i.invitee_id = v_target
    and i.status = 'pending'
    and i.expires_at > now()
  for update;

  if v_invite_id is null then
    insert into public.ik_plan_invitations(project_id, inviter_id, invitee_id, status, message, expires_at)
    values (p_project_id, v_actor, v_target, 'pending', v_message, now() + interval '7 days')
    returning id into v_invite_id;
  else
    update public.ik_plan_invitations
    set inviter_id = v_actor,
        status = 'pending',
        message = v_message,
        created_at = now(),
        responded_at = null,
        expires_at = now() + interval '7 days'
    where id = v_invite_id;
  end if;

  v_revision := public.ik_plan_next_revision(p_project_id);
  perform public.ik_plan_log_event(
    p_project_id,
    v_revision,
    'member.invited',
    jsonb_build_object(
      'invitation_id', v_invite_id,
      'invitee_id', v_target,
      'invitee_user_id', v_target_handle
    )
  );

  return v_invite_id;
end;
$$;

create or replace function public.ik_plan_cancel_invitation(p_invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.ik_plan_invitations%rowtype;
  v_revision bigint;
begin
  select * into v_inv
  from public.ik_plan_invitations i
  where i.id = p_invitation_id
  for update;

  if not found then
    raise exception 'invitation_not_found';
  end if;

  if v_inv.status <> 'pending' then
    raise exception 'invitation_not_pending';
  end if;

  if not (
    v_inv.inviter_id = auth.uid()
    or public.ik_plan_has_role(v_inv.project_id, array['owner', 'editor'])
  ) then
    raise exception 'forbidden';
  end if;

  update public.ik_plan_invitations
  set status = 'cancelled',
      responded_at = now()
  where id = v_inv.id;

  v_revision := public.ik_plan_next_revision(v_inv.project_id);
  perform public.ik_plan_log_event(
    v_inv.project_id,
    v_revision,
    'member.invite_cancelled',
    jsonb_build_object('invitation_id', v_inv.id, 'invitee_id', v_inv.invitee_id)
  );

  return true;
end;
$$;

create or replace function public.ik_plan_respond_invitation(
  p_invitation_id uuid,
  p_accept boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_inv public.ik_plan_invitations%rowtype;
  v_status text;
  v_revision bigint;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  select * into v_inv
  from public.ik_plan_invitations i
  where i.id = p_invitation_id
  for update;

  if not found then
    raise exception 'invitation_not_found';
  end if;

  if v_inv.invitee_id <> v_actor then
    raise exception 'forbidden';
  end if;

  if v_inv.status <> 'pending' then
    raise exception 'invitation_not_pending';
  end if;

  if v_inv.expires_at <= now() then
    update public.ik_plan_invitations
    set status = 'expired',
        responded_at = now()
    where id = v_inv.id;
    raise exception 'invitation_expired';
  end if;

  if coalesce(p_accept, true) then
    insert into public.ik_plan_members(project_id, user_id, role)
    values (v_inv.project_id, v_actor, 'editor')
    on conflict (project_id, user_id)
    do update set role = excluded.role, updated_at = now();

    update public.ik_plan_invitations
    set status = 'accepted',
        responded_at = now()
    where id = v_inv.id;

    v_status := 'accepted';
  else
    update public.ik_plan_invitations
    set status = 'rejected',
        responded_at = now()
    where id = v_inv.id;

    v_status := 'rejected';
  end if;

  v_revision := public.ik_plan_next_revision(v_inv.project_id);
  perform public.ik_plan_log_event(
    v_inv.project_id,
    v_revision,
    case when v_status = 'accepted' then 'member.joined' else 'member.rejected' end,
    jsonb_build_object('invitation_id', v_inv.id, 'member_id', v_actor, 'status', v_status)
  );

  return jsonb_build_object(
    'project_id', v_inv.project_id,
    'status', v_status,
    'revision', v_revision
  );
end;
$$;

create or replace function public.ik_plan_remove_member(
  p_project_id uuid,
  p_member_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role public.ik_plan_member_role;
  v_target_role public.ik_plan_member_role;
  v_revision bigint;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  select m.role into v_actor_role
  from public.ik_plan_members m
  where m.project_id = p_project_id
    and m.user_id = v_actor;

  if v_actor_role is null then
    raise exception 'forbidden';
  end if;

  if v_actor_role not in ('owner', 'editor') then
    raise exception 'forbidden';
  end if;

  select m.role into v_target_role
  from public.ik_plan_members m
  where m.project_id = p_project_id
    and m.user_id = p_member_id
  for update;

  if v_target_role is null then
    raise exception 'member_not_found';
  end if;

  if v_target_role = 'owner' and v_actor_role <> 'owner' then
    raise exception 'forbidden';
  end if;

  if v_target_role = 'owner' and p_member_id = v_actor then
    raise exception 'owner_cannot_leave';
  end if;

  delete from public.ik_plan_members
  where project_id = p_project_id
    and user_id = p_member_id;

  v_revision := public.ik_plan_next_revision(p_project_id);
  perform public.ik_plan_log_event(
    p_project_id,
    v_revision,
    'member.removed',
    jsonb_build_object('member_id', p_member_id)
  );

  return true;
end;
$$;

create or replace function public.ik_plan_save_columns(
  p_project_id uuid,
  p_columns jsonb,
  p_base_revision bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_project_revision bigint;
  v_new_revision bigint;
  v_fallback_column uuid;
  v_done_count integer;
  v_exists boolean;
  rec record;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if not public.ik_plan_has_role(p_project_id, array['owner', 'editor']) then
    raise exception 'forbidden';
  end if;

  if p_columns is null or jsonb_typeof(p_columns) <> 'array' then
    raise exception 'invalid_columns_payload';
  end if;

  create temporary table tmp_plan_columns (
    ord integer not null,
    input_id uuid not null,
    name text not null,
    color text not null,
    role text not null,
    unique (input_id)
  ) on commit drop;

  insert into tmp_plan_columns(ord, input_id, name, color, role)
  select
    e.ord::integer,
    case
      when (e.item->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (e.item->>'id')::uuid
      else gen_random_uuid()
    end as input_id,
    left(coalesce(nullif(btrim(e.item->>'name'), ''), 'column'), 120) as name,
    case
      when coalesce(e.item->>'color', '') ~* '^#[0-9a-f]{6}$' then lower(e.item->>'color')
      else '#111111'
    end as color,
    case
      when lower(coalesce(e.item->>'role', '')) = 'done' then 'done'
      when lower(coalesce(e.item->>'role', '')) = 'doing' then 'doing'
      else 'todo'
    end as role
  from jsonb_array_elements(p_columns) with ordinality as e(item, ord);

  if not exists (select 1 from tmp_plan_columns) then
    raise exception 'need_at_least_one_column';
  end if;

  select count(*) into v_done_count
  from tmp_plan_columns
  where role = 'done';

  if v_done_count = 0 then
    update tmp_plan_columns
    set role = 'done'
    where ord = (select max(ord) from tmp_plan_columns);
  elsif v_done_count > 1 then
    with ranked as (
      select input_id, row_number() over (order by ord asc) as rn
      from tmp_plan_columns
      where role = 'done'
    )
    update tmp_plan_columns t
    set role = case when r.rn = 1 then 'done' else 'todo' end
    from ranked r
    where t.input_id = r.input_id;
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

  select t.input_id into v_fallback_column
  from tmp_plan_columns t
  order by t.ord asc
  limit 1;

  for rec in
    select t.ord, t.input_id, t.name, t.color, t.role
    from tmp_plan_columns t
    order by t.ord asc
  loop
    select exists (
      select 1
      from public.ik_plan_columns c
      where c.id = rec.input_id
        and c.project_id = p_project_id
    ) into v_exists;

    if v_exists then
      update public.ik_plan_columns c
      set name = rec.name,
          color = rec.color,
          role = rec.role,
          position = rec.ord * 1024,
          version = c.version + 1,
          updated_by = v_actor,
          updated_at = now()
      where c.id = rec.input_id
        and c.project_id = p_project_id;
    else
      insert into public.ik_plan_columns (
        id,
        project_id,
        name,
        color,
        role,
        position,
        version,
        created_by,
        updated_by
      )
      values (
        rec.input_id,
        p_project_id,
        rec.name,
        rec.color,
        rec.role,
        rec.ord * 1024,
        1,
        v_actor,
        v_actor
      );
    end if;
  end loop;

  for rec in
    select c.id
    from public.ik_plan_columns c
    where c.project_id = p_project_id
      and c.id not in (select input_id from tmp_plan_columns)
  loop
    with moved as (
      select cc.id,
             row_number() over(order by cc.position asc, cc.created_at asc) as rn
      from public.ik_plan_cards cc
      where cc.project_id = p_project_id
        and cc.column_id = rec.id
    ), base as (
      select coalesce(max(c2.position), 0) as start_pos
      from public.ik_plan_cards c2
      where c2.project_id = p_project_id
        and c2.column_id = v_fallback_column
    )
    update public.ik_plan_cards c
    set column_id = v_fallback_column,
        position = base.start_pos + moved.rn * 1024,
        version = c.version + 1,
        updated_by = v_actor,
        updated_at = now()
    from moved, base
    where c.id = moved.id;

    delete from public.ik_plan_columns c
    where c.project_id = p_project_id
      and c.id = rec.id;
  end loop;

  v_new_revision := public.ik_plan_next_revision(p_project_id);
  perform public.ik_plan_log_event(
    p_project_id,
    v_new_revision,
    'column.bulk_saved',
    jsonb_build_object('count', (select count(*) from tmp_plan_columns))
  );

  return v_new_revision;
end;
$$;

create or replace function public.ik_plan_create_card(
  p_project_id uuid,
  p_column_id uuid,
  p_name text,
  p_description text default '',
  p_priority text default 'mid',
  p_deadline date default null,
  p_tags jsonb default '[]'::jsonb,
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
      'position', v_position
    )
  );

  return v_card_id;
end;
$$;

create or replace function public.ik_plan_update_card(
  p_project_id uuid,
  p_card_id uuid,
  p_name text,
  p_description text,
  p_priority text,
  p_deadline date,
  p_tags jsonb,
  p_column_id uuid default null,
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
      'version', v_new_version
    )
  );

  return jsonb_build_object(
    'card_id', p_card_id,
    'version', v_new_version,
    'revision', v_revision,
    'column_id', v_target_column
  );
end;
$$;

create or replace function public.ik_plan_delete_card(
  p_project_id uuid,
  p_card_id uuid,
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
  v_card_version integer;
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

  select c.version into v_card_version
  from public.ik_plan_cards c
  where c.id = p_card_id
    and c.project_id = p_project_id
  for update;

  if v_card_version is null then
    raise exception 'card_not_found';
  end if;

  if p_base_version is not null and p_base_version <> v_card_version then
    raise exception 'version_conflict';
  end if;

  delete from public.ik_plan_cards c
  where c.id = p_card_id
    and c.project_id = p_project_id;

  v_revision := public.ik_plan_next_revision(p_project_id);
  perform public.ik_plan_log_event(
    p_project_id,
    v_revision,
    'card.deleted',
    jsonb_build_object('card_id', p_card_id)
  );

  return true;
end;
$$;

create or replace function public.ik_plan_move_card(
  p_project_id uuid,
  p_card_id uuid,
  p_to_column_id uuid,
  p_before_card_id uuid default null,
  p_after_card_id uuid default null,
  p_base_revision bigint default null,
  p_base_version integer default null
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
  v_before_id uuid := p_before_card_id;
  v_after_id uuid := p_after_card_id;
  v_before_pos numeric;
  v_after_pos numeric;
  v_new_pos numeric;
  v_rebased boolean := false;
  v_new_version integer;
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

  if not exists (
    select 1
    from public.ik_plan_columns c
    where c.id = p_to_column_id
      and c.project_id = p_project_id
  ) then
    raise exception 'column_not_found';
  end if;

  if v_before_id is not null and v_before_id = p_card_id then
    v_before_id := null;
    v_rebased := true;
  end if;

  if v_after_id is not null and v_after_id = p_card_id then
    v_after_id := null;
    v_rebased := true;
  end if;

  if v_before_id is not null then
    select c.position into v_before_pos
    from public.ik_plan_cards c
    where c.id = v_before_id
      and c.project_id = p_project_id
      and c.column_id = p_to_column_id
    for update;
    if v_before_pos is null then
      v_rebased := true;
    end if;
  end if;

  if v_after_id is not null then
    select c.position into v_after_pos
    from public.ik_plan_cards c
    where c.id = v_after_id
      and c.project_id = p_project_id
      and c.column_id = p_to_column_id
    for update;
    if v_after_pos is null then
      v_rebased := true;
    end if;
  end if;

  if v_before_pos is not null and v_after_pos is not null and v_before_pos >= v_after_pos then
    v_after_pos := null;
    v_rebased := true;
  end if;

  if v_before_pos is not null and v_after_pos is not null then
    v_new_pos := (v_before_pos + v_after_pos) / 2;
  elsif v_before_pos is not null then
    v_new_pos := v_before_pos + 1024;
  elsif v_after_pos is not null then
    v_new_pos := v_after_pos - 1024;
  else
    select coalesce(max(c.position), 0) + 1024 into v_new_pos
    from public.ik_plan_cards c
    where c.project_id = p_project_id
      and c.column_id = p_to_column_id;
    if v_before_id is not null or v_after_id is not null then
      v_rebased := true;
    end if;
  end if;

  update public.ik_plan_cards c
  set column_id = p_to_column_id,
      position = v_new_pos,
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
    'card.moved',
    jsonb_build_object(
      'card_id', p_card_id,
      'from_column_id', v_card.column_id,
      'to_column_id', p_to_column_id,
      'position', v_new_pos,
      'rebased', v_rebased,
      'version', v_new_version
    )
  );

  return jsonb_build_object(
    'card_id', p_card_id,
    'column_id', p_to_column_id,
    'position', v_new_pos,
    'version', v_new_version,
    'revision', v_revision,
    'rebased', v_rebased
  );
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'ik_plan_events'
    ) then
      execute 'alter publication supabase_realtime add table public.ik_plan_events';
    end if;
  end if;
end $$;

revoke all on function public.ik_plan_has_role(uuid, text[]) from public;
revoke all on function public.ik_plan_next_revision(uuid) from public;
revoke all on function public.ik_plan_log_event(uuid, bigint, text, jsonb) from public;

revoke all on function public.ik_plan_list_projects() from public;
grant execute on function public.ik_plan_list_projects() to authenticated;

revoke all on function public.ik_plan_get_board(uuid) from public;
grant execute on function public.ik_plan_get_board(uuid) to authenticated;

revoke all on function public.ik_plan_get_events_since(uuid, bigint) from public;
grant execute on function public.ik_plan_get_events_since(uuid, bigint) to authenticated;

revoke all on function public.ik_plan_list_incoming_invitations() from public;
grant execute on function public.ik_plan_list_incoming_invitations() to authenticated;

revoke all on function public.ik_plan_create_project(text, text) from public;
grant execute on function public.ik_plan_create_project(text, text) to authenticated;

revoke all on function public.ik_plan_delete_project(uuid, bigint) from public;
grant execute on function public.ik_plan_delete_project(uuid, bigint) to authenticated;

revoke all on function public.ik_plan_invite_friend(uuid, text, text) from public;
grant execute on function public.ik_plan_invite_friend(uuid, text, text) to authenticated;

revoke all on function public.ik_plan_cancel_invitation(uuid) from public;
grant execute on function public.ik_plan_cancel_invitation(uuid) to authenticated;

revoke all on function public.ik_plan_respond_invitation(uuid, boolean) from public;
grant execute on function public.ik_plan_respond_invitation(uuid, boolean) to authenticated;

revoke all on function public.ik_plan_remove_member(uuid, uuid) from public;
grant execute on function public.ik_plan_remove_member(uuid, uuid) to authenticated;

revoke all on function public.ik_plan_save_columns(uuid, jsonb, bigint) from public;
grant execute on function public.ik_plan_save_columns(uuid, jsonb, bigint) to authenticated;

revoke all on function public.ik_plan_create_card(uuid, uuid, text, text, text, date, jsonb, bigint) from public;
grant execute on function public.ik_plan_create_card(uuid, uuid, text, text, text, date, jsonb, bigint) to authenticated;

revoke all on function public.ik_plan_update_card(uuid, uuid, text, text, text, date, jsonb, uuid, integer, bigint) from public;
grant execute on function public.ik_plan_update_card(uuid, uuid, text, text, text, date, jsonb, uuid, integer, bigint) to authenticated;

revoke all on function public.ik_plan_delete_card(uuid, uuid, integer, bigint) from public;
grant execute on function public.ik_plan_delete_card(uuid, uuid, integer, bigint) to authenticated;

revoke all on function public.ik_plan_move_card(uuid, uuid, uuid, uuid, uuid, bigint, integer) from public;
grant execute on function public.ik_plan_move_card(uuid, uuid, uuid, uuid, uuid, bigint, integer) to authenticated;
