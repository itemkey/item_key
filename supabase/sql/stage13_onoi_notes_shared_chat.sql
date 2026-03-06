-- Stage 13: onoi_notes shared categories + section chat
-- Run after stage8_accounts_social.sql and stage6_onoi_notes_private.sql
-- Safe to run multiple times.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ik_onoi_shared_role') then
    create type public.ik_onoi_shared_role as enum ('owner', 'editor', 'viewer');
  end if;
end $$;

create table if not exists public.sh_onoi_shared_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(name) between 1 and 120)
);

create index if not exists idx_sh_onoi_shared_categories_owner
  on public.sh_onoi_shared_categories(owner_id);

create table if not exists public.sh_onoi_shared_members (
  category_id uuid not null references public.sh_onoi_shared_categories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.ik_onoi_shared_role not null default 'editor',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (category_id, user_id)
);

create index if not exists idx_sh_onoi_shared_members_user
  on public.sh_onoi_shared_members(user_id);

create table if not exists public.sh_onoi_shared_sections (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.sh_onoi_shared_categories(id) on delete cascade,
  name text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(name) between 1 and 120),
  constraint uq_sh_onoi_shared_sections_id_category unique (id, category_id)
);

create index if not exists idx_sh_onoi_shared_sections_category
  on public.sh_onoi_shared_sections(category_id, updated_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'uq_sh_onoi_shared_sections_id_category'
      and conrelid = 'public.sh_onoi_shared_sections'::regclass
  ) then
    alter table public.sh_onoi_shared_sections
      add constraint uq_sh_onoi_shared_sections_id_category
      unique (id, category_id);
  end if;
end $$;

create table if not exists public.sh_onoi_shared_messages (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.sh_onoi_shared_categories(id) on delete cascade,
  section_id uuid not null references public.sh_onoi_shared_sections(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict,
  body text not null,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(body) between 1 and 4000),
  constraint fk_sh_onoi_shared_messages_section_category
    foreign key (section_id, category_id)
    references public.sh_onoi_shared_sections(id, category_id)
    on delete cascade
);

create index if not exists idx_sh_onoi_shared_messages_section_time
  on public.sh_onoi_shared_messages(section_id, created_at asc);

create index if not exists idx_sh_onoi_shared_messages_category_time
  on public.sh_onoi_shared_messages(category_id, created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_sh_onoi_shared_messages_section_category'
      and conrelid = 'public.sh_onoi_shared_messages'::regclass
  ) then
    alter table public.sh_onoi_shared_messages
      add constraint fk_sh_onoi_shared_messages_section_category
      foreign key (section_id, category_id)
      references public.sh_onoi_shared_sections(id, category_id)
      on delete cascade;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.sh_onoi_shared_messages;
    exception when duplicate_object then
      null;
    end;
    begin
      alter publication supabase_realtime add table public.sh_onoi_shared_sections;
    exception when duplicate_object then
      null;
    end;
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sh_onoi_shared_categories_updated_at on public.sh_onoi_shared_categories;
create trigger trg_sh_onoi_shared_categories_updated_at
before update on public.sh_onoi_shared_categories
for each row execute function public.set_updated_at();

drop trigger if exists trg_sh_onoi_shared_members_updated_at on public.sh_onoi_shared_members;
create trigger trg_sh_onoi_shared_members_updated_at
before update on public.sh_onoi_shared_members
for each row execute function public.set_updated_at();

drop trigger if exists trg_sh_onoi_shared_sections_updated_at on public.sh_onoi_shared_sections;
create trigger trg_sh_onoi_shared_sections_updated_at
before update on public.sh_onoi_shared_sections
for each row execute function public.set_updated_at();

drop trigger if exists trg_sh_onoi_shared_messages_updated_at on public.sh_onoi_shared_messages;
create trigger trg_sh_onoi_shared_messages_updated_at
before update on public.sh_onoi_shared_messages
for each row execute function public.set_updated_at();

create or replace function public.ik_onoi_shared_role_of(p_category_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role::text
  from public.sh_onoi_shared_members m
  where m.category_id = p_category_id
    and m.user_id = auth.uid()
  limit 1;
$$;

alter table public.sh_onoi_shared_categories enable row level security;
alter table public.sh_onoi_shared_members enable row level security;
alter table public.sh_onoi_shared_sections enable row level security;
alter table public.sh_onoi_shared_messages enable row level security;

drop policy if exists "sh_onoi_shared_categories_select_member" on public.sh_onoi_shared_categories;
create policy "sh_onoi_shared_categories_select_member"
on public.sh_onoi_shared_categories for select
using (
  exists (
    select 1 from public.sh_onoi_shared_members m
    where m.category_id = public.sh_onoi_shared_categories.id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "sh_onoi_shared_categories_insert_owner" on public.sh_onoi_shared_categories;
create policy "sh_onoi_shared_categories_insert_owner"
on public.sh_onoi_shared_categories for insert
with check (owner_id = auth.uid());

drop policy if exists "sh_onoi_shared_categories_update_owner" on public.sh_onoi_shared_categories;
create policy "sh_onoi_shared_categories_update_owner"
on public.sh_onoi_shared_categories for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "sh_onoi_shared_categories_delete_owner" on public.sh_onoi_shared_categories;
create policy "sh_onoi_shared_categories_delete_owner"
on public.sh_onoi_shared_categories for delete
using (owner_id = auth.uid());

drop policy if exists "sh_onoi_shared_members_select_member" on public.sh_onoi_shared_members;
create policy "sh_onoi_shared_members_select_member"
on public.sh_onoi_shared_members for select
using (
  exists (
    select 1 from public.sh_onoi_shared_members m
    where m.category_id = public.sh_onoi_shared_members.category_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "sh_onoi_shared_members_insert_owner" on public.sh_onoi_shared_members;
create policy "sh_onoi_shared_members_insert_owner"
on public.sh_onoi_shared_members for insert
with check (
  exists (
    select 1 from public.sh_onoi_shared_categories c
    where c.id = public.sh_onoi_shared_members.category_id
      and c.owner_id = auth.uid()
  )
);

drop policy if exists "sh_onoi_shared_members_update_owner" on public.sh_onoi_shared_members;
create policy "sh_onoi_shared_members_update_owner"
on public.sh_onoi_shared_members for update
using (
  exists (
    select 1 from public.sh_onoi_shared_categories c
    where c.id = public.sh_onoi_shared_members.category_id
      and c.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.sh_onoi_shared_categories c
    where c.id = public.sh_onoi_shared_members.category_id
      and c.owner_id = auth.uid()
  )
);

drop policy if exists "sh_onoi_shared_members_delete_owner" on public.sh_onoi_shared_members;
create policy "sh_onoi_shared_members_delete_owner"
on public.sh_onoi_shared_members for delete
using (
  exists (
    select 1 from public.sh_onoi_shared_categories c
    where c.id = public.sh_onoi_shared_members.category_id
      and c.owner_id = auth.uid()
  )
);

drop policy if exists "sh_onoi_shared_sections_select_member" on public.sh_onoi_shared_sections;
create policy "sh_onoi_shared_sections_select_member"
on public.sh_onoi_shared_sections for select
using (
  public.ik_onoi_shared_role_of(public.sh_onoi_shared_sections.category_id) is not null
);

drop policy if exists "sh_onoi_shared_sections_insert_editor" on public.sh_onoi_shared_sections;
create policy "sh_onoi_shared_sections_insert_editor"
on public.sh_onoi_shared_sections for insert
with check (
  public.ik_onoi_shared_role_of(public.sh_onoi_shared_sections.category_id) in ('owner', 'editor')
);

drop policy if exists "sh_onoi_shared_sections_update_editor" on public.sh_onoi_shared_sections;
create policy "sh_onoi_shared_sections_update_editor"
on public.sh_onoi_shared_sections for update
using (
  public.ik_onoi_shared_role_of(public.sh_onoi_shared_sections.category_id) in ('owner', 'editor')
)
with check (
  public.ik_onoi_shared_role_of(public.sh_onoi_shared_sections.category_id) in ('owner', 'editor')
);

drop policy if exists "sh_onoi_shared_sections_delete_editor" on public.sh_onoi_shared_sections;
create policy "sh_onoi_shared_sections_delete_editor"
on public.sh_onoi_shared_sections for delete
using (
  public.ik_onoi_shared_role_of(public.sh_onoi_shared_sections.category_id) in ('owner', 'editor')
);

drop policy if exists "sh_onoi_shared_messages_select_member" on public.sh_onoi_shared_messages;
create policy "sh_onoi_shared_messages_select_member"
on public.sh_onoi_shared_messages for select
using (
  public.ik_onoi_shared_role_of(public.sh_onoi_shared_messages.category_id) is not null
);

drop policy if exists "sh_onoi_shared_messages_insert_editor" on public.sh_onoi_shared_messages;
create policy "sh_onoi_shared_messages_insert_editor"
on public.sh_onoi_shared_messages for insert
with check (
  public.ik_onoi_shared_role_of(public.sh_onoi_shared_messages.category_id) in ('owner', 'editor')
);

drop policy if exists "sh_onoi_shared_messages_update_editor" on public.sh_onoi_shared_messages;
create policy "sh_onoi_shared_messages_update_editor"
on public.sh_onoi_shared_messages for update
using (
  public.ik_onoi_shared_role_of(public.sh_onoi_shared_messages.category_id) in ('owner', 'editor')
)
with check (
  public.ik_onoi_shared_role_of(public.sh_onoi_shared_messages.category_id) in ('owner', 'editor')
);

drop policy if exists "sh_onoi_shared_messages_delete_editor" on public.sh_onoi_shared_messages;
create policy "sh_onoi_shared_messages_delete_editor"
on public.sh_onoi_shared_messages for delete
using (
  public.ik_onoi_shared_role_of(public.sh_onoi_shared_messages.category_id) in ('owner', 'editor')
);

grant select, insert, update, delete on public.sh_onoi_shared_categories to authenticated;
grant select, insert, update, delete on public.sh_onoi_shared_members to authenticated;
grant select, insert, update, delete on public.sh_onoi_shared_sections to authenticated;
grant select, insert, update, delete on public.sh_onoi_shared_messages to authenticated;

create or replace function public.ik_onoi_shared_list_categories()
returns table (
  id uuid,
  name text,
  owner_id uuid,
  my_role text,
  member_count bigint,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    c.id,
    c.name,
    c.owner_id,
    m.role::text as my_role,
    (select count(*) from public.sh_onoi_shared_members mm where mm.category_id = c.id) as member_count,
    c.created_at,
    c.updated_at
  from public.sh_onoi_shared_categories c
  join public.sh_onoi_shared_members m
    on m.category_id = c.id
   and m.user_id = auth.uid()
  order by c.updated_at desc, c.created_at desc;
$$;

create or replace function public.ik_onoi_shared_create_category(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
  v_name text := left(coalesce(nullif(btrim(p_name), ''), 'shared'), 120);
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  insert into public.sh_onoi_shared_categories(name, owner_id)
  values (v_name, v_actor)
  returning id into v_id;

  insert into public.sh_onoi_shared_members(category_id, user_id, role, invited_by)
  values (v_id, v_actor, 'owner', v_actor)
  on conflict (category_id, user_id)
  do update set role = 'owner', updated_at = now();

  return v_id;
end;
$$;

create or replace function public.ik_onoi_shared_delete_category(p_category_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if not exists (
    select 1
    from public.sh_onoi_shared_categories c
    where c.id = p_category_id
      and c.owner_id = v_actor
  ) then
    raise exception 'only_owner_can_delete_category';
  end if;

  delete from public.sh_onoi_shared_categories c
  where c.id = p_category_id;

  return true;
end;
$$;

create or replace function public.ik_onoi_shared_add_friend(
  p_category_id uuid,
  p_target_user_id text,
  p_role text default 'editor'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_target uuid;
  v_handle text := public.ik_sanitize_user_id(p_target_user_id);
  v_role public.ik_onoi_shared_role;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if not exists (
    select 1 from public.sh_onoi_shared_categories c
    where c.id = p_category_id
      and c.owner_id = v_actor
  ) then
    raise exception 'only_owner_can_invite';
  end if;

  if v_handle = '' then
    raise exception 'target_user_not_found';
  end if;

  select up.id into v_target
  from public.ik_user_profiles up
  where lower(up.user_id) = lower(v_handle)
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

  v_role := case when lower(coalesce(p_role, 'editor')) = 'viewer' then 'viewer'::public.ik_onoi_shared_role else 'editor'::public.ik_onoi_shared_role end;

  insert into public.sh_onoi_shared_members(category_id, user_id, role, invited_by)
  values (p_category_id, v_target, v_role, v_actor)
  on conflict (category_id, user_id)
  do update set role = excluded.role, invited_by = v_actor, updated_at = now();

  update public.sh_onoi_shared_categories
  set updated_at = now()
  where id = p_category_id;

  return v_target;
end;
$$;

create or replace function public.ik_onoi_shared_list_sections(p_category_id uuid)
returns table (
  id uuid,
  category_id uuid,
  name text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    s.id,
    s.category_id,
    s.name,
    s.created_by,
    s.updated_by,
    s.created_at,
    s.updated_at
  from public.sh_onoi_shared_sections s
  where s.category_id = p_category_id
    and public.ik_onoi_shared_role_of(s.category_id) is not null
  order by s.updated_at desc, s.created_at desc;
$$;

create or replace function public.ik_onoi_shared_list_members(p_category_id uuid)
returns table (
  user_id uuid,
  role text,
  profile_user_id text,
  nickname text,
  avatar_url text,
  added_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    m.user_id,
    m.role::text,
    coalesce(up.user_id, '') as profile_user_id,
    coalesce(up.nickname, '') as nickname,
    coalesce(up.avatar_url, '') as avatar_url,
    m.created_at as added_at
  from public.sh_onoi_shared_members m
  left join public.ik_user_profiles up on up.id = m.user_id
  where m.category_id = p_category_id
    and public.ik_onoi_shared_role_of(m.category_id) is not null
  order by m.created_at asc;
$$;

create or replace function public.ik_onoi_shared_create_section(
  p_category_id uuid,
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role text := public.ik_onoi_shared_role_of(p_category_id);
  v_id uuid;
  v_name text := left(coalesce(nullif(btrim(p_name), ''), 'section'), 120);
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if v_role not in ('owner', 'editor') then
    raise exception 'forbidden';
  end if;

  insert into public.sh_onoi_shared_sections(category_id, name, created_by, updated_by)
  values (p_category_id, v_name, v_actor, v_actor)
  returning id into v_id;

  update public.sh_onoi_shared_categories
  set updated_at = now()
  where id = p_category_id;

  return v_id;
end;
$$;

create or replace function public.ik_onoi_shared_delete_section(p_section_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_section public.sh_onoi_shared_sections%rowtype;
begin
  select * into v_section
  from public.sh_onoi_shared_sections s
  where s.id = p_section_id
  for update;

  if not found then
    raise exception 'section_not_found';
  end if;

  if public.ik_onoi_shared_role_of(v_section.category_id) not in ('owner', 'editor') then
    raise exception 'forbidden';
  end if;

  delete from public.sh_onoi_shared_sections
  where id = p_section_id;

  update public.sh_onoi_shared_categories
  set updated_at = now()
  where id = v_section.category_id;

  return true;
end;
$$;

create or replace function public.ik_onoi_shared_get_messages(
  p_section_id uuid,
  p_limit integer default 300
)
returns table (
  id uuid,
  section_id uuid,
  category_id uuid,
  body text,
  author_id uuid,
  author_user_id text,
  author_nickname text,
  created_at timestamptz,
  updated_at timestamptz,
  edited_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    m.id,
    m.section_id,
    m.category_id,
    m.body,
    m.author_id,
    coalesce(up.user_id, '') as author_user_id,
    coalesce(up.nickname, '') as author_nickname,
    m.created_at,
    m.updated_at,
    m.edited_at
  from public.sh_onoi_shared_messages m
  left join public.ik_user_profiles up on up.id = m.author_id
  where m.section_id = p_section_id
    and public.ik_onoi_shared_role_of(m.category_id) is not null
  order by m.created_at asc
  limit greatest(1, least(coalesce(p_limit, 300), 500));
$$;

create or replace function public.ik_onoi_shared_send_message(
  p_section_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_section public.sh_onoi_shared_sections%rowtype;
  v_body text := left(coalesce(btrim(p_body), ''), 4000);
  v_id uuid;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if v_body = '' then
    raise exception 'message_empty';
  end if;

  select * into v_section
  from public.sh_onoi_shared_sections s
  where s.id = p_section_id
  for update;

  if not found then
    raise exception 'section_not_found';
  end if;

  if public.ik_onoi_shared_role_of(v_section.category_id) not in ('owner', 'editor') then
    raise exception 'forbidden';
  end if;

  insert into public.sh_onoi_shared_messages(section_id, category_id, author_id, body)
  values (v_section.id, v_section.category_id, v_actor, v_body)
  returning id into v_id;

  update public.sh_onoi_shared_sections
  set updated_by = v_actor,
      updated_at = now()
  where id = v_section.id;

  update public.sh_onoi_shared_categories
  set updated_at = now()
  where id = v_section.category_id;

  return v_id;
end;
$$;

create or replace function public.ik_onoi_shared_edit_message(
  p_message_id uuid,
  p_body text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_msg public.sh_onoi_shared_messages%rowtype;
  v_actor uuid := auth.uid();
  v_body text := left(coalesce(btrim(p_body), ''), 4000);
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if v_body = '' then
    raise exception 'message_empty';
  end if;

  select * into v_msg
  from public.sh_onoi_shared_messages m
  where m.id = p_message_id
  for update;

  if not found then
    raise exception 'message_not_found';
  end if;

  if public.ik_onoi_shared_role_of(v_msg.category_id) not in ('owner', 'editor') then
    raise exception 'forbidden';
  end if;

  update public.sh_onoi_shared_messages
  set body = v_body,
      edited_at = now(),
      updated_at = now()
  where id = v_msg.id;

  return true;
end;
$$;

create or replace function public.ik_onoi_shared_delete_message(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_msg public.sh_onoi_shared_messages%rowtype;
begin
  select * into v_msg
  from public.sh_onoi_shared_messages m
  where m.id = p_message_id
  for update;

  if not found then
    raise exception 'message_not_found';
  end if;

  if public.ik_onoi_shared_role_of(v_msg.category_id) not in ('owner', 'editor') then
    raise exception 'forbidden';
  end if;

  delete from public.sh_onoi_shared_messages
  where id = v_msg.id;

  return true;
end;
$$;

revoke all on function public.ik_onoi_shared_role_of(uuid) from public;
grant execute on function public.ik_onoi_shared_role_of(uuid) to authenticated;

revoke all on function public.ik_onoi_shared_list_categories() from public;
grant execute on function public.ik_onoi_shared_list_categories() to authenticated;

revoke all on function public.ik_onoi_shared_create_category(text) from public;
grant execute on function public.ik_onoi_shared_create_category(text) to authenticated;

revoke all on function public.ik_onoi_shared_delete_category(uuid) from public;
grant execute on function public.ik_onoi_shared_delete_category(uuid) to authenticated;

revoke all on function public.ik_onoi_shared_add_friend(uuid, text, text) from public;
grant execute on function public.ik_onoi_shared_add_friend(uuid, text, text) to authenticated;

revoke all on function public.ik_onoi_shared_list_sections(uuid) from public;
grant execute on function public.ik_onoi_shared_list_sections(uuid) to authenticated;

revoke all on function public.ik_onoi_shared_list_members(uuid) from public;
grant execute on function public.ik_onoi_shared_list_members(uuid) to authenticated;

revoke all on function public.ik_onoi_shared_create_section(uuid, text) from public;
grant execute on function public.ik_onoi_shared_create_section(uuid, text) to authenticated;

revoke all on function public.ik_onoi_shared_delete_section(uuid) from public;
grant execute on function public.ik_onoi_shared_delete_section(uuid) to authenticated;

revoke all on function public.ik_onoi_shared_get_messages(uuid, integer) from public;
grant execute on function public.ik_onoi_shared_get_messages(uuid, integer) to authenticated;

revoke all on function public.ik_onoi_shared_send_message(uuid, text) from public;
grant execute on function public.ik_onoi_shared_send_message(uuid, text) to authenticated;

revoke all on function public.ik_onoi_shared_edit_message(uuid, text) from public;
grant execute on function public.ik_onoi_shared_edit_message(uuid, text) to authenticated;

revoke all on function public.ik_onoi_shared_delete_message(uuid) from public;
grant execute on function public.ik_onoi_shared_delete_message(uuid) to authenticated;
