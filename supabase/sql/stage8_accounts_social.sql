-- Stage 8: account profiles + friends system
-- Run after stage7_planning_private.sql
-- Safe to run multiple times.

create or replace function public.ik_is_admin_email(p_email text)
returns boolean
language sql
stable
as $$
  select lower(coalesce(p_email, '')) in ('itemkeygithub@gmail.com', 'kravetznikita@gmail.com');
$$;

create or replace function public.ik_sanitize_user_id(raw text)
returns text
language sql
immutable
as $$
  select left(lower(regexp_replace(coalesce(raw, ''), '[^a-zA-Z0-9._-]+', '', 'g')), 32);
$$;

create table if not exists public.ik_user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_id text not null,
  nickname text not null,
  bio text not null default '',
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_ik_user_profiles_user_id_ci
  on public.ik_user_profiles ((lower(user_id)));

create index if not exists idx_ik_user_profiles_nickname
  on public.ik_user_profiles (nickname);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ik_user_profiles_user_id_format'
      and conrelid = 'public.ik_user_profiles'::regclass
  ) then
    alter table public.ik_user_profiles
      add constraint ik_user_profiles_user_id_format
      check (user_id ~ '^[a-z0-9._-]{4,32}$');
  end if;
end $$;

create or replace function public.ik_generate_user_id(seed text)
returns text
language plpgsql
as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := public.ik_sanitize_user_id(seed);

  if base = '' then
    base := 'user_' || substring(md5(random()::text || clock_timestamp()::text), 1, 8);
  end if;

  if length(base) < 4 then
    base := base || substring(md5(random()::text || clock_timestamp()::text), 1, 4);
  end if;

  base := left(base, 32);
  candidate := base;

  while exists (
    select 1
    from public.ik_user_profiles p
    where lower(p.user_id) = lower(candidate)
  ) loop
    n := n + 1;
    candidate := left(base, greatest(1, 32 - length(n::text) - 1)) || '_' || n::text;
  end loop;

  return candidate;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ik_user_profiles_updated_at on public.ik_user_profiles;
create trigger trg_ik_user_profiles_updated_at
before update on public.ik_user_profiles
for each row execute function public.set_updated_at();

create or replace function public.ik_profile_enforce_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
begin
  select u.email into v_email
  from auth.users u
  where u.id = new.id;

  new.is_admin := public.ik_is_admin_email(v_email);
  return new;
end;
$$;

drop trigger if exists trg_ik_profile_enforce_admin on public.ik_user_profiles;
create trigger trg_ik_profile_enforce_admin
before insert or update on public.ik_user_profiles
for each row execute function public.ik_profile_enforce_admin_flag();

create or replace function public.ik_on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  requested_user_id_raw text := coalesce(meta->>'user_id', '');
  requested_user_id text;
  final_user_id text;
  final_nickname text;
begin
  final_nickname := btrim(coalesce(meta->>'nickname', meta->>'username', meta->>'login', ''));
  if final_nickname = '' then
    final_nickname := split_part(coalesce(new.email, ''), '@', 1);
  end if;
  if final_nickname = '' then
    final_nickname := 'user';
  end if;

  requested_user_id := public.ik_sanitize_user_id(requested_user_id_raw);
  if requested_user_id <> '' then
    if length(requested_user_id) < 4 then
      raise exception 'invalid user-id';
    end if;
    if exists (
      select 1
      from public.ik_user_profiles p
      where lower(p.user_id) = lower(requested_user_id)
    ) then
      raise exception 'user-id already taken';
    end if;
    final_user_id := requested_user_id;
  else
    final_user_id := public.ik_generate_user_id(split_part(coalesce(new.email, ''), '@', 1));
  end if;

  insert into public.ik_user_profiles (id, user_id, nickname, bio)
  values (new.id, final_user_id, final_nickname, '');

  return new;
end;
$$;

drop trigger if exists trg_ik_auth_user_created on auth.users;
create trigger trg_ik_auth_user_created
after insert on auth.users
for each row execute function public.ik_on_auth_user_created();

create or replace function public.ik_on_auth_user_email_changed()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update public.ik_user_profiles p
  set is_admin = public.ik_is_admin_email(new.email),
      updated_at = now()
  where p.id = new.id;
  return new;
end;
$$;

drop trigger if exists trg_ik_auth_user_email_changed on auth.users;
create trigger trg_ik_auth_user_email_changed
after update of email on auth.users
for each row execute function public.ik_on_auth_user_email_changed();

do $$
declare
  u record;
  nick text;
  handle text;
begin
  for u in
    select au.id, au.email, au.raw_user_meta_data
    from auth.users au
    left join public.ik_user_profiles p on p.id = au.id
    where p.id is null
    order by au.created_at asc
  loop
    nick := btrim(coalesce(
      u.raw_user_meta_data->>'nickname',
      u.raw_user_meta_data->>'username',
      u.raw_user_meta_data->>'login',
      split_part(coalesce(u.email, ''), '@', 1)
    ));

    if nick = '' then
      nick := 'user';
    end if;

    handle := public.ik_sanitize_user_id(u.raw_user_meta_data->>'user_id');
    if handle = '' or length(handle) < 4 then
      handle := public.ik_generate_user_id(split_part(coalesce(u.email, ''), '@', 1));
    elsif exists (
      select 1
      from public.ik_user_profiles p
      where lower(p.user_id) = lower(handle)
    ) then
      handle := public.ik_generate_user_id(handle);
    end if;

    insert into public.ik_user_profiles (id, user_id, nickname, bio)
    values (u.id, handle, nick, '')
    on conflict (id) do nothing;
  end loop;
end $$;

update public.ik_user_profiles p
set is_admin = public.ik_is_admin_email(u.email)
from auth.users u
where u.id = p.id;

create table if not exists public.ik_friend_requests (
  id bigserial primary key,
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id),
  check (status in ('pending', 'accepted', 'declined', 'cancelled'))
);

create index if not exists idx_ik_friend_requests_requester
  on public.ik_friend_requests (requester_id);

create index if not exists idx_ik_friend_requests_addressee
  on public.ik_friend_requests (addressee_id);

create unique index if not exists idx_ik_friend_requests_pending_pair
  on public.ik_friend_requests (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  )
  where status = 'pending';

create table if not exists public.ik_friendships (
  id bigserial primary key,
  user_low uuid not null references auth.users(id) on delete cascade,
  user_high uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_low < user_high),
  unique (user_low, user_high)
);

create index if not exists idx_ik_friendships_low on public.ik_friendships (user_low);
create index if not exists idx_ik_friendships_high on public.ik_friendships (user_high);

alter table public.ik_user_profiles enable row level security;
alter table public.ik_friend_requests enable row level security;
alter table public.ik_friendships enable row level security;

drop policy if exists "ik_profiles_select_auth" on public.ik_user_profiles;
create policy "ik_profiles_select_auth"
on public.ik_user_profiles for select
using (auth.uid() is not null);

drop policy if exists "ik_profiles_insert_own" on public.ik_user_profiles;
create policy "ik_profiles_insert_own"
on public.ik_user_profiles for insert
with check (id = auth.uid());

drop policy if exists "ik_profiles_update_own" on public.ik_user_profiles;
create policy "ik_profiles_update_own"
on public.ik_user_profiles for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "ik_profiles_delete_own" on public.ik_user_profiles;
create policy "ik_profiles_delete_own"
on public.ik_user_profiles for delete
using (id = auth.uid());

drop policy if exists "ik_friend_requests_select_own" on public.ik_friend_requests;
create policy "ik_friend_requests_select_own"
on public.ik_friend_requests for select
using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists "ik_friend_requests_insert_own" on public.ik_friend_requests;
create policy "ik_friend_requests_insert_own"
on public.ik_friend_requests for insert
with check (
  requester_id = auth.uid()
  and requester_id <> addressee_id
  and status = 'pending'
);

drop policy if exists "ik_friend_requests_update_addressee" on public.ik_friend_requests;
create policy "ik_friend_requests_update_addressee"
on public.ik_friend_requests for update
using (addressee_id = auth.uid() and status = 'pending')
with check (
  addressee_id = auth.uid()
  and status in ('accepted', 'declined')
);

drop policy if exists "ik_friend_requests_delete_requester" on public.ik_friend_requests;
create policy "ik_friend_requests_delete_requester"
on public.ik_friend_requests for delete
using (requester_id = auth.uid() and status = 'pending');

drop policy if exists "ik_friendships_select_own" on public.ik_friendships;
create policy "ik_friendships_select_own"
on public.ik_friendships for select
using (auth.uid() in (user_low, user_high));

drop policy if exists "ik_friendships_insert_own" on public.ik_friendships;
create policy "ik_friendships_insert_own"
on public.ik_friendships for insert
with check (auth.uid() in (user_low, user_high));

drop policy if exists "ik_friendships_delete_own" on public.ik_friendships;
create policy "ik_friendships_delete_own"
on public.ik_friendships for delete
using (auth.uid() in (user_low, user_high));

create or replace function public.ik_send_friend_request(target_user_id text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid := auth.uid();
  v_target uuid;
  v_target_user_id text := public.ik_sanitize_user_id(target_user_id);
  v_request_id bigint;
begin
  if v_sender is null then
    raise exception 'auth required';
  end if;

  if v_target_user_id = '' then
    raise exception 'user id not found';
  end if;

  select p.id into v_target
  from public.ik_user_profiles p
  where lower(p.user_id) = lower(v_target_user_id)
  limit 1;

  if v_target is null then
    raise exception 'user id not found';
  end if;

  if v_target = v_sender then
    raise exception 'cannot add yourself';
  end if;

  if exists (
    select 1
    from public.ik_friendships f
    where f.user_low = least(v_sender, v_target)
      and f.user_high = greatest(v_sender, v_target)
  ) then
    raise exception 'already friends';
  end if;

  if exists (
    select 1
    from public.ik_friend_requests r
    where r.status = 'pending'
      and least(r.requester_id, r.addressee_id) = least(v_sender, v_target)
      and greatest(r.requester_id, r.addressee_id) = greatest(v_sender, v_target)
  ) then
    raise exception 'friend request already pending';
  end if;

  insert into public.ik_friend_requests (requester_id, addressee_id, status)
  values (v_sender, v_target, 'pending')
  returning id into v_request_id;

  return v_request_id;
end;
$$;

create or replace function public.ik_respond_friend_request(p_request_id bigint, p_accept boolean default true)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_req public.ik_friend_requests%rowtype;
begin
  if v_user is null then
    raise exception 'auth required';
  end if;

  select * into v_req
  from public.ik_friend_requests r
  where r.id = p_request_id
    and r.addressee_id = v_user
    and r.status = 'pending'
  for update;

  if not found then
    raise exception 'request not found';
  end if;

  if coalesce(p_accept, true) then
    update public.ik_friend_requests
    set status = 'accepted', responded_at = now()
    where id = v_req.id;

    insert into public.ik_friendships (user_low, user_high)
    values (
      least(v_req.requester_id, v_req.addressee_id),
      greatest(v_req.requester_id, v_req.addressee_id)
    )
    on conflict (user_low, user_high) do nothing;

    return 'accepted';
  end if;

  update public.ik_friend_requests
  set status = 'declined', responded_at = now()
  where id = v_req.id;

  return 'declined';
end;
$$;

revoke all on function public.ik_send_friend_request(text) from public;
grant execute on function public.ik_send_friend_request(text) to authenticated;

revoke all on function public.ik_respond_friend_request(bigint, boolean) from public;
grant execute on function public.ik_respond_friend_request(bigint, boolean) to authenticated;
