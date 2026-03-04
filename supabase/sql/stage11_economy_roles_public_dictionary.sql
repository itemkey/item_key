-- Stage 11: economy (eco + i-bit þ), roles, public dictionaries + moderation
-- Safe to run multiple times.

-- -----------------------------
-- Helpers
-- -----------------------------

create or replace function public.ik_norm_space_lower(v text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(btrim(coalesce(v, '')), '\s+', ' ', 'g'))
$$;

create or replace function public.ik_title_key(v text)
returns text
language sql
immutable
as $$
  select left(
    regexp_replace(public.ik_norm_space_lower(v), '[^a-z0-9 _.-]+', '', 'g')
  , 64)
$$;

-- -----------------------------
-- Roles (owner/admin/moderator)
-- -----------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ik_role' and typnamespace = 'public'::regnamespace) then
    create type public.ik_role as enum ('owner', 'admin', 'moderator');
  end if;
end $$;

create table if not exists public.ik_user_roles (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.ik_role not null,
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.ik_user_roles enable row level security;

create or replace function public.ik_is_tech_admin(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.ik_user_profiles p where p.id = p_user), false)
$$;

create or replace function public.ik_has_role(p_role text, p_user uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user is null then
    return false;
  end if;
  return exists (
    select 1
    from public.ik_user_roles r
    where r.user_id = p_user
      and r.role = (lower(coalesce(p_role,'')))::public.ik_role
  );
exception
  when others then
    return false;
end;
$$;

create or replace function public.ik_can_open_admin_console()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.ik_is_tech_admin(auth.uid())
     or public.ik_has_role('owner', auth.uid())
     or public.ik_has_role('admin', auth.uid())
     or public.ik_has_role('moderator', auth.uid())
$$;

drop policy if exists "ik_user_roles_select" on public.ik_user_roles;
create policy "ik_user_roles_select"
on public.ik_user_roles for select
using (
  user_id = auth.uid()
  or public.ik_can_open_admin_console()
);

-- deny write by default (use RPC)
drop policy if exists "ik_user_roles_write_none" on public.ik_user_roles;
create policy "ik_user_roles_write_none"
on public.ik_user_roles for insert
with check (false);

drop policy if exists "ik_user_roles_update_none" on public.ik_user_roles;
create policy "ik_user_roles_update_none"
on public.ik_user_roles for update
using (false)
with check (false);

drop policy if exists "ik_user_roles_delete_none" on public.ik_user_roles;
create policy "ik_user_roles_delete_none"
on public.ik_user_roles for delete
using (false);

create or replace function public.ik_set_user_role_by_user_id(
  p_user text,
  p_role text,
  p_enabled boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.ik_role;
  v_target uuid;
  v_user_id text;
  v_is_uuid boolean := false;
begin
  if v_actor is null then
    raise exception 'auth required';
  end if;

  if not (public.ik_has_role('owner', v_actor) or public.ik_is_tech_admin(v_actor)) then
    raise exception 'only owner can manage roles';
  end if;

  v_user_id := btrim(coalesce(p_user, ''));
  if v_user_id = '' then
    raise exception 'user required';
  end if;

  begin
    v_target := v_user_id::uuid;
    v_is_uuid := true;
  exception when others then
    v_is_uuid := false;
  end;

  if not v_is_uuid then
    v_user_id := public.ik_sanitize_user_id(v_user_id);
    select p.id into v_target
    from public.ik_user_profiles p
    where lower(p.user_id) = lower(v_user_id)
    limit 1;
  end if;

  if v_target is null then
    raise exception 'user not found';
  end if;

  v_role := (lower(coalesce(p_role,'')))::public.ik_role;

  if coalesce(p_enabled, true) then
    insert into public.ik_user_roles(user_id, role, granted_by)
    values (v_target, v_role, v_actor)
    on conflict (user_id, role) do nothing;
  else
    delete from public.ik_user_roles r
    where r.user_id = v_target
      and r.role = v_role;
  end if;

  return jsonb_build_object(
    'ok', true,
    'user_id', v_target,
    'role', v_role::text,
    'enabled', coalesce(p_enabled, true)
  );
end;
$$;

create or replace function public.ik_get_user_roles_by_user_id(p_user text)
returns setof public.ik_user_roles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_target uuid;
  v_user_id text;
  v_is_uuid boolean := false;
begin
  if v_actor is null then
    raise exception 'auth required';
  end if;
  if not public.ik_can_open_admin_console() then
    raise exception 'forbidden';
  end if;

  v_user_id := btrim(coalesce(p_user, ''));
  if v_user_id = '' then
    raise exception 'user required';
  end if;

  begin
    v_target := v_user_id::uuid;
    v_is_uuid := true;
  exception when others then
    v_is_uuid := false;
  end;

  if not v_is_uuid then
    v_user_id := public.ik_sanitize_user_id(v_user_id);
    select p.id into v_target
    from public.ik_user_profiles p
    where lower(p.user_id) = lower(v_user_id)
    limit 1;
  end if;

  if v_target is null then
    return;
  end if;

  return query
    select *
    from public.ik_user_roles r
    where r.user_id = v_target
    order by r.role::text;
end;
$$;

revoke all on function public.ik_set_user_role_by_user_id(text, text, boolean) from public;
grant execute on function public.ik_set_user_role_by_user_id(text, text, boolean) to authenticated;

revoke all on function public.ik_get_user_roles_by_user_id(text) from public;
grant execute on function public.ik_get_user_roles_by_user_id(text) to authenticated;

revoke all on function public.ik_can_open_admin_console() from public;
grant execute on function public.ik_can_open_admin_console() to authenticated;

-- Bootstrap emergency admins as owner (idempotent)
insert into public.ik_user_roles(user_id, role, granted_by)
select p.id, 'owner'::public.ik_role, p.id
from public.ik_user_profiles p
where p.is_admin = true
on conflict (user_id, role) do nothing;

-- -----------------------------
-- Economy: wallet + events + state
-- eco is stored as x10 integer (0.5 eco = 5)
-- -----------------------------

create table if not exists public.ik_wallets (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  eco_x10 int not null default 0,
  ibit int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ik_reward_state (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  active_day date,
  active_eco_x10 int not null default 0,
  last_active_minute_at timestamptz,
  last_daily_claim date,
  daily_streak int not null default 0,
  study_day date,
  study_ibit int not null default 0,
  module_counts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ik_reward_events (
  id bigserial primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  source text,
  eco_x10 int not null default 0,
  ibit int not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ik_reward_events_owner_created
  on public.ik_reward_events(owner_id, created_at desc);

drop trigger if exists trg_ik_wallets_updated_at on public.ik_wallets;
create trigger trg_ik_wallets_updated_at
before update on public.ik_wallets
for each row execute function public.set_updated_at();

drop trigger if exists trg_ik_reward_state_updated_at on public.ik_reward_state;
create trigger trg_ik_reward_state_updated_at
before update on public.ik_reward_state
for each row execute function public.set_updated_at();

alter table public.ik_wallets enable row level security;
alter table public.ik_reward_state enable row level security;
alter table public.ik_reward_events enable row level security;

drop policy if exists "ik_wallets_select_own" on public.ik_wallets;
create policy "ik_wallets_select_own"
on public.ik_wallets for select
using (owner_id = auth.uid());

drop policy if exists "ik_wallets_insert_own" on public.ik_wallets;
create policy "ik_wallets_insert_own"
on public.ik_wallets for insert
with check (owner_id = auth.uid());

drop policy if exists "ik_wallets_update_own" on public.ik_wallets;
create policy "ik_wallets_update_own"
on public.ik_wallets for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "ik_reward_state_select_own" on public.ik_reward_state;
create policy "ik_reward_state_select_own"
on public.ik_reward_state for select
using (owner_id = auth.uid());

drop policy if exists "ik_reward_state_insert_own" on public.ik_reward_state;
create policy "ik_reward_state_insert_own"
on public.ik_reward_state for insert
with check (owner_id = auth.uid());

drop policy if exists "ik_reward_state_update_own" on public.ik_reward_state;
create policy "ik_reward_state_update_own"
on public.ik_reward_state for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "ik_reward_events_select_own" on public.ik_reward_events;
create policy "ik_reward_events_select_own"
on public.ik_reward_events for select
using (owner_id = auth.uid());

create or replace function public.ik_wallet_ensure()
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'auth required';
  end if;
  insert into public.ik_wallets(owner_id) values (v_user)
  on conflict (owner_id) do nothing;
  insert into public.ik_reward_state(owner_id) values (v_user)
  on conflict (owner_id) do nothing;
  return true;
end;
$$;

revoke all on function public.ik_wallet_ensure() from public;
grant execute on function public.ik_wallet_ensure() to authenticated;

create or replace function public.ik_award_internal(
  p_owner uuid,
  p_event_type text,
  p_source text,
  p_eco_x10 int,
  p_ibit int,
  p_meta jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_owner is null then
    return;
  end if;
  if coalesce(p_eco_x10,0) = 0 and coalesce(p_ibit,0) = 0 then
    return;
  end if;

  insert into public.ik_wallets(owner_id) values (p_owner)
  on conflict (owner_id) do nothing;

  update public.ik_wallets w
  set eco_x10 = w.eco_x10 + greatest(0, coalesce(p_eco_x10,0)),
      ibit = w.ibit + greatest(0, coalesce(p_ibit,0)),
      updated_at = now()
  where w.owner_id = p_owner;

  insert into public.ik_reward_events(owner_id, event_type, source, eco_x10, ibit, meta)
  values (p_owner, coalesce(p_event_type,'award'), p_source, greatest(0, coalesce(p_eco_x10,0)), greatest(0, coalesce(p_ibit,0)), coalesce(p_meta,'{}'::jsonb));
end;
$$;

-- Active minute: 0.5 eco (x10=5) with actions, AFK stop in client, daily cap 30 eco
create or replace function public.ik_award_active_minute(p_actions int default 1)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_state public.ik_reward_state%rowtype;
  v_award int := 0;
  v_cap int := 300; -- 30 eco * 10
  v_step int := 5;  -- 0.5 eco * 10
begin
  if v_user is null then
    raise exception 'auth required';
  end if;
  perform public.ik_wallet_ensure();

  select * into v_state from public.ik_reward_state where owner_id = v_user for update;

  if coalesce(p_actions, 0) <= 0 then
    return jsonb_build_object('awarded', false, 'reason', 'no_actions');
  end if;

  if v_state.last_active_minute_at is not null and now() - v_state.last_active_minute_at < interval '55 seconds' then
    return jsonb_build_object('awarded', false, 'reason', 'rate_limited');
  end if;

  if v_state.active_day is null or v_state.active_day <> v_today then
    v_state.active_day := v_today;
    v_state.active_eco_x10 := 0;
  end if;

  if v_state.active_eco_x10 >= v_cap then
    update public.ik_reward_state
    set active_day = v_state.active_day,
        active_eco_x10 = v_state.active_eco_x10,
        last_active_minute_at = now()
    where owner_id = v_user;
    return jsonb_build_object('awarded', false, 'reason', 'daily_cap');
  end if;

  v_award := least(v_step, v_cap - v_state.active_eco_x10);

  update public.ik_reward_state
  set active_day = v_state.active_day,
      active_eco_x10 = v_state.active_eco_x10 + v_award,
      last_active_minute_at = now()
  where owner_id = v_user;

  perform public.ik_award_internal(v_user, 'active_minute', 'site', v_award, 0, jsonb_build_object('actions', p_actions));
  return jsonb_build_object('awarded', true, 'eco_x10', v_award);
end;
$$;

revoke all on function public.ik_award_active_minute(int) from public;
grant execute on function public.ik_award_active_minute(int) to authenticated;

-- Daily visit with streak milestones
create or replace function public.ik_claim_daily_visit()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_yesterday date := ((now() at time zone 'utc')::date - 1);
  v_state public.ik_reward_state%rowtype;
  v_base int := 80; -- 8 eco
  v_bonus int := 0;
  v_ibit int := 0;
  v_streak int := 0;
begin
  if v_user is null then
    raise exception 'auth required';
  end if;
  perform public.ik_wallet_ensure();
  select * into v_state from public.ik_reward_state where owner_id = v_user for update;

  if v_state.last_daily_claim = v_today then
    return jsonb_build_object('awarded', false, 'reason', 'already_claimed', 'streak', v_state.daily_streak);
  end if;

  if v_state.last_daily_claim = v_yesterday then
    v_streak := coalesce(v_state.daily_streak, 0) + 1;
  else
    v_streak := 1;
  end if;

  -- milestones
  if v_streak = 3 then
    v_bonus := v_bonus + 40; -- +4 eco
  elsif v_streak = 7 then
    v_bonus := v_bonus + 80; -- +8 eco
    v_ibit := v_ibit + 1;
  elsif v_streak = 14 then
    v_bonus := v_bonus + 150; -- +15 eco
    v_ibit := v_ibit + 2;
  elsif v_streak = 30 then
    v_bonus := v_bonus + 300; -- +30 eco
    v_ibit := v_ibit + 5;
  end if;

  update public.ik_reward_state
  set last_daily_claim = v_today,
      daily_streak = v_streak
  where owner_id = v_user;

  perform public.ik_award_internal(
    v_user,
    'daily_visit',
    'site',
    v_base + v_bonus,
    v_ibit,
    jsonb_build_object('streak', v_streak)
  );

  return jsonb_build_object(
    'awarded', true,
    'eco_x10', v_base + v_bonus,
    'ibit', v_ibit,
    'streak', v_streak
  );
end;
$$;

revoke all on function public.ik_claim_daily_visit() from public;
grant execute on function public.ik_claim_daily_visit() to authenticated;

-- -----------------------------
-- Public dictionaries + moderation (personal dictionaries stay in sh_dictionary_*)
-- -----------------------------

create table if not exists public.ik_public_dicts (
  id bigserial primary key,
  dict_type text not null check (dict_type in ('system','user')),
  title text not null,
  title_key text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  rating_enabled boolean not null default true,
  current_version_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dict_type, title_key)
);

create table if not exists public.ik_public_dict_versions (
  id bigserial primary key,
  dict_id bigint not null references public.ik_public_dicts(id) on delete cascade,
  version int not null,
  status text not null default 'published' check (status in ('published','archived')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  source_request_id bigint,
  unique (dict_id, version)
);

alter table public.ik_public_dicts
  drop constraint if exists fk_ik_public_dicts_current_version;
alter table public.ik_public_dicts
  add constraint fk_ik_public_dicts_current_version
  foreign key (current_version_id) references public.ik_public_dict_versions(id) on delete set null;

create table if not exists public.ik_public_dict_words (
  id bigserial primary key,
  dict_version_id bigint not null references public.ik_public_dict_versions(id) on delete cascade,
  en text not null,
  ru text not null,
  en_key text not null,
  ru_key text not null,
  pair_key text not null,
  created_at timestamptz not null default now(),
  unique (dict_version_id, pair_key)
);

create table if not exists public.ik_dict_publish_requests (
  id bigserial primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (request_type in ('publish','update')),
  target_dict_id bigint references public.ik_public_dicts(id) on delete set null,
  status text not null default 'pending' check (status in ('draft','pending','approved','rejected','needs_work')),
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  words_count int not null default 0,
  payload_hash text,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text,
  decision_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_ik_public_dicts_updated_at on public.ik_public_dicts;
create trigger trg_ik_public_dicts_updated_at
before update on public.ik_public_dicts
for each row execute function public.set_updated_at();

drop trigger if exists trg_ik_dict_publish_requests_updated_at on public.ik_dict_publish_requests;
create trigger trg_ik_dict_publish_requests_updated_at
before update on public.ik_dict_publish_requests
for each row execute function public.set_updated_at();

alter table public.ik_public_dicts enable row level security;
alter table public.ik_public_dict_versions enable row level security;
alter table public.ik_public_dict_words enable row level security;
alter table public.ik_dict_publish_requests enable row level security;

-- Public read (authenticated)
drop policy if exists "ik_public_dicts_select_auth" on public.ik_public_dicts;
create policy "ik_public_dicts_select_auth"
on public.ik_public_dicts for select
using (auth.uid() is not null);

drop policy if exists "ik_public_dict_versions_select_auth" on public.ik_public_dict_versions;
create policy "ik_public_dict_versions_select_auth"
on public.ik_public_dict_versions for select
using (auth.uid() is not null);

drop policy if exists "ik_public_dict_words_select_auth" on public.ik_public_dict_words;
create policy "ik_public_dict_words_select_auth"
on public.ik_public_dict_words for select
using (auth.uid() is not null);

-- Deny direct writes (moderation uses RPC)
drop policy if exists "ik_public_dicts_write_none" on public.ik_public_dicts;
create policy "ik_public_dicts_write_none"
on public.ik_public_dicts for insert
with check (false);

drop policy if exists "ik_public_dicts_update_none" on public.ik_public_dicts;
create policy "ik_public_dicts_update_none"
on public.ik_public_dicts for update
using (false)
with check (false);

drop policy if exists "ik_public_dicts_delete_none" on public.ik_public_dicts;
create policy "ik_public_dicts_delete_none"
on public.ik_public_dicts for delete
using (false);

drop policy if exists "ik_public_dict_versions_write_none" on public.ik_public_dict_versions;
create policy "ik_public_dict_versions_write_none"
on public.ik_public_dict_versions for insert
with check (false);

drop policy if exists "ik_public_dict_words_write_none" on public.ik_public_dict_words;
create policy "ik_public_dict_words_write_none"
on public.ik_public_dict_words for insert
with check (false);

-- Requests: owner can read own; moderators/admin/owner can read all
drop policy if exists "ik_dict_requests_select" on public.ik_dict_publish_requests;
create policy "ik_dict_requests_select"
on public.ik_dict_publish_requests for select
using (
  owner_id = auth.uid()
  or public.ik_can_open_admin_console()
);

drop policy if exists "ik_dict_requests_insert_own" on public.ik_dict_publish_requests;
create policy "ik_dict_requests_insert_own"
on public.ik_dict_publish_requests for insert
with check (owner_id = auth.uid());

drop policy if exists "ik_dict_requests_update_none" on public.ik_dict_publish_requests;
create policy "ik_dict_requests_update_none"
on public.ik_dict_publish_requests for update
using (false)
with check (false);

-- Catalog views
create or replace view public.ik_public_dict_catalog as
select
  d.id,
  d.title,
  d.title_key,
  d.dict_type,
  d.owner_id,
  d.current_version_id,
  d.updated_at,
  coalesce(w.cnt, 0)::int as words_count
from public.ik_public_dicts d
left join (
  select v.id as version_id, count(*) as cnt
  from public.ik_public_dict_versions v
  join public.ik_public_dict_words w on w.dict_version_id = v.id
  group by v.id
) w on w.version_id = d.current_version_id;

create or replace view public.ik_public_dict_current_words as
select
  w.id,
  d.id as dict_id,
  w.en,
  w.ru
from public.ik_public_dicts d
join public.ik_public_dict_versions v on v.id = d.current_version_id
join public.ik_public_dict_words w on w.dict_version_id = v.id;

-- Submit request (publish/update)
create or replace function public.ik_submit_dict_publish_request(
  p_title text,
  p_words jsonb,
  p_target_dict_id bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_type text := case when p_target_dict_id is null then 'publish' else 'update' end;
  v_payload jsonb;
  v_count int;
  v_hash text;
  v_id bigint;
  v_today date := (now() at time zone 'utc')::date;
begin
  if v_user is null then
    raise exception 'auth required';
  end if;

  if v_title = '' then
    raise exception 'title required';
  end if;
  if length(v_title) > 96 then
    v_title := left(v_title, 96);
  end if;

  if jsonb_typeof(p_words) <> 'array' then
    raise exception 'words must be json array';
  end if;

  v_count := jsonb_array_length(p_words);
  if v_count < 5 then
    raise exception 'too few words';
  end if;
  if v_count > 2000 then
    raise exception 'too many words';
  end if;

  if p_target_dict_id is not null then
    if not exists (
      select 1 from public.ik_public_dicts d
      where d.id = p_target_dict_id
        and d.dict_type = 'user'
        and d.owner_id = v_user
    ) then
      raise exception 'target dict not found or not owned';
    end if;
  end if;

  -- daily anti-spam cap: 20 requests/day
  if (
    select count(*)
    from public.ik_dict_publish_requests r
    where r.owner_id = v_user
      and (r.created_at at time zone 'utc')::date = v_today
  ) >= 20 then
    raise exception 'daily request cap reached';
  end if;

  v_payload := jsonb_build_object('words', p_words);
  v_hash := md5(v_payload::text);

  insert into public.ik_dict_publish_requests(
    owner_id, request_type, target_dict_id, status, title, payload, words_count, payload_hash
  ) values (
    v_user, v_type, p_target_dict_id, 'pending', v_title, v_payload, v_count, v_hash
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.ik_submit_dict_publish_request(text, jsonb, bigint) from public;
grant execute on function public.ik_submit_dict_publish_request(text, jsonb, bigint) to authenticated;

-- Admin/moderator listing
create or replace function public.ik_list_dict_publish_requests(p_status text default 'pending')
returns table(
  id bigint,
  owner_id uuid,
  author_user_id text,
  request_type text,
  target_dict_id bigint,
  title text,
  words_count int,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;
  if not public.ik_can_open_admin_console() then
    raise exception 'forbidden';
  end if;

  return query
  select
    r.id,
    r.owner_id,
    coalesce(p.user_id, r.owner_id::text) as author_user_id,
    r.request_type,
    r.target_dict_id,
    r.title,
    r.words_count,
    r.created_at
  from public.ik_dict_publish_requests r
  left join public.ik_user_profiles p on p.id = r.owner_id
  where r.status = coalesce(nullif(btrim(p_status), ''), 'pending')
  order by r.created_at asc;
end;
$$;

revoke all on function public.ik_list_dict_publish_requests(text) from public;
grant execute on function public.ik_list_dict_publish_requests(text) to authenticated;

create or replace function public.ik_get_dict_publish_request(p_request_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  r public.ik_dict_publish_requests%rowtype;
  p public.ik_user_profiles%rowtype;
begin
  if v_user is null then
    raise exception 'auth required';
  end if;
  select * into r from public.ik_dict_publish_requests where id = p_request_id;
  if not found then
    raise exception 'not found';
  end if;

  if not (r.owner_id = v_user or public.ik_can_open_admin_console()) then
    raise exception 'forbidden';
  end if;

  select * into p from public.ik_user_profiles where id = r.owner_id;

  return jsonb_build_object(
    'id', r.id,
    'status', r.status,
    'request_type', r.request_type,
    'target_dict_id', r.target_dict_id,
    'title', r.title,
    'words_count', r.words_count,
    'created_at', r.created_at,
    'owner_id', r.owner_id,
    'author_user_id', coalesce(p.user_id, r.owner_id::text),
    'payload', r.payload,
    'review_note', r.review_note
  );
end;
$$;

revoke all on function public.ik_get_dict_publish_request(bigint) from public;
grant execute on function public.ik_get_dict_publish_request(bigint) to authenticated;

create or replace function public.ik_review_dict_publish_request(
  p_request_id bigint,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_dec text := lower(btrim(coalesce(p_decision,'')));
  r public.ik_dict_publish_requests%rowtype;
  v_dict_id bigint;
  v_next_ver int;
  v_ver_id bigint;
  v_prev_ver_id bigint;
  v_title_key text;
begin
  if v_actor is null then
    raise exception 'auth required';
  end if;
  if not public.ik_can_open_admin_console() then
    raise exception 'forbidden';
  end if;

  if v_dec not in ('approve','reject','needs_work') then
    raise exception 'bad decision';
  end if;

  select * into r from public.ik_dict_publish_requests where id = p_request_id for update;
  if not found then
    raise exception 'not found';
  end if;
  if r.status <> 'pending' then
    raise exception 'not pending';
  end if;

  if v_dec <> 'approve' then
    update public.ik_dict_publish_requests
    set status = case when v_dec = 'reject' then 'rejected' else 'needs_work' end,
        reviewed_by = v_actor,
        review_note = btrim(coalesce(p_note,'')),
        decision_at = now()
    where id = r.id;
    return jsonb_build_object('ok', true, 'status', case when v_dec='reject' then 'rejected' else 'needs_work' end);
  end if;

  v_title_key := public.ik_title_key(r.title);
  if v_title_key = '' then
    v_title_key := 'dict_' || substring(md5(random()::text || clock_timestamp()::text), 1, 10);
  end if;

  if r.request_type = 'publish' then
    insert into public.ik_public_dicts(dict_type, title, title_key, owner_id, rating_enabled)
    values ('user', r.title, v_title_key, r.owner_id, true)
    returning id into v_dict_id;

    v_next_ver := 1;
  else
    v_dict_id := r.target_dict_id;
    if v_dict_id is null then
      raise exception 'missing target dict';
    end if;
    select current_version_id into v_prev_ver_id from public.ik_public_dicts where id = v_dict_id;
    select coalesce(max(version), 0) + 1 into v_next_ver
    from public.ik_public_dict_versions where dict_id = v_dict_id;
  end if;

  insert into public.ik_public_dict_versions(dict_id, version, status, created_by, source_request_id)
  values (v_dict_id, v_next_ver, 'published', v_actor, r.id)
  returning id into v_ver_id;

  -- insert words
  insert into public.ik_public_dict_words(dict_version_id, en, ru, en_key, ru_key, pair_key)
  select
    v_ver_id,
    btrim(coalesce(x->>'en','')) as en,
    btrim(coalesce(x->>'ru','')) as ru,
    public.ik_norm_space_lower(coalesce(x->>'en','')) as en_key,
    public.ik_norm_space_lower(coalesce(x->>'ru','')) as ru_key,
    public.ik_norm_space_lower(coalesce(x->>'en','')) || '|' || public.ik_norm_space_lower(coalesce(x->>'ru','')) as pair_key
  from jsonb_array_elements(coalesce(r.payload->'words','[]'::jsonb)) x
  where btrim(coalesce(x->>'en','')) <> ''
    and btrim(coalesce(x->>'ru','')) <> '';

  update public.ik_public_dicts
  set current_version_id = v_ver_id,
      updated_at = now()
  where id = v_dict_id;

  if r.request_type = 'update' and v_prev_ver_id is not null then
    update public.ik_public_dict_versions
    set status = 'archived'
    where id = v_prev_ver_id;
  end if;

  update public.ik_dict_publish_requests
  set status = 'approved',
      reviewed_by = v_actor,
      review_note = btrim(coalesce(p_note,'')),
      decision_at = now()
  where id = r.id;

  return jsonb_build_object(
    'ok', true,
    'dict_id', v_dict_id,
    'version', v_next_ver,
    'version_id', v_ver_id
  );
end;
$$;

revoke all on function public.ik_review_dict_publish_request(bigint, text, text) from public;
grant execute on function public.ik_review_dict_publish_request(bigint, text, text) to authenticated;

-- -----------------------------
-- Rewards for study sessions (currently: dictionary)
-- -----------------------------

create table if not exists public.ik_public_dict_usage_daily (
  dict_id bigint not null references public.ik_public_dicts(id) on delete cascade,
  day date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (dict_id, day, user_id)
);

create table if not exists public.ik_public_dict_creator_daily (
  dict_id bigint not null references public.ik_public_dicts(id) on delete cascade,
  day date not null,
  eco_x10 int not null default 0,
  ibit int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (dict_id, day)
);

alter table public.ik_public_dict_usage_daily enable row level security;
alter table public.ik_public_dict_creator_daily enable row level security;

drop policy if exists "ik_public_dict_usage_select_admin" on public.ik_public_dict_usage_daily;
create policy "ik_public_dict_usage_select_admin"
on public.ik_public_dict_usage_daily for select
using (public.ik_can_open_admin_console());

drop policy if exists "ik_public_dict_creator_select_admin" on public.ik_public_dict_creator_daily;
create policy "ik_public_dict_creator_select_admin"
on public.ik_public_dict_creator_daily for select
using (public.ik_can_open_admin_console());

create or replace function public.ik_award_study_session(
  p_module text,
  p_dict_id bigint,
  p_tasks int,
  p_correct int,
  p_unique_words int,
  p_rated boolean,
  p_source text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_state public.ik_reward_state%rowtype;
  v_module text := lower(btrim(coalesce(p_module,'')));
  v_tasks int := greatest(0, coalesce(p_tasks,0));
  v_correct int := greatest(0, coalesce(p_correct,0));
  v_unique int := greatest(0, coalesce(p_unique_words,0));
  v_eco int := 0;
  v_ibit int := 0;
  v_accuracy numeric := 0;
  v_count int := 0;
  v_mult numeric := 1.0;
  v_key text;
  v_prev int;
  v_dict public.ik_public_dicts%rowtype;
  v_inserted boolean := false;
  v_rowcount int := 0;
  v_unique_count int := 0;
  v_creator_eco int := 0;
  v_creator_ibit int := 0;
  v_creator_day public.ik_public_dict_creator_daily%rowtype;
  v_user_created timestamptz;
begin
  if v_user is null then
    raise exception 'auth required';
  end if;
  perform public.ik_wallet_ensure();

  if v_module <> 'dictionary' then
    return jsonb_build_object('awarded', false, 'reason', 'unsupported');
  end if;
  if coalesce(p_rated, false) is not true then
    return jsonb_build_object('awarded', false, 'reason', 'not_rated');
  end if;
  if v_tasks <> 20 then
    return jsonb_build_object('awarded', false, 'reason', 'session_size_must_be_20');
  end if;
  if v_unique < 12 then
    return jsonb_build_object('awarded', false, 'reason', 'too_few_unique_words');
  end if;
  if v_correct < 15 then
    return jsonb_build_object('awarded', false, 'reason', 'need_15_of_20');
  end if;

  v_accuracy := v_correct::numeric / v_tasks::numeric;

  -- base + accuracy bonus (eco x10)
  v_eco := 100; -- 10 eco
  if v_accuracy >= 0.95 then
    v_eco := v_eco + 120;
  elsif v_accuracy >= 0.85 then
    v_eco := v_eco + 80;
  elsif v_accuracy >= 0.70 then
    v_eco := v_eco + 40;
  end if;

  -- diminishing returns per day per module
  select * into v_state from public.ik_reward_state where owner_id = v_user for update;
  if v_state.study_day is null or v_state.study_day <> v_today then
    v_state.study_day := v_today;
    v_state.study_ibit := 0;
    v_state.module_counts := '{}'::jsonb;
  end if;

  v_key := v_module;
  v_prev := coalesce((v_state.module_counts->>v_key)::int, 0);
  v_count := v_prev + 1;

  if v_count <= 3 then v_mult := 1.0;
  elsif v_count <= 6 then v_mult := 0.7;
  elsif v_count <= 10 then v_mult := 0.4;
  else v_mult := 0.2;
  end if;

  v_eco := floor(v_eco * v_mult)::int;
  if v_eco < 0 then v_eco := 0; end if;

  -- i-bit: +1 if accuracy >=85%, rated, daily cap 3 across study modules
  if v_accuracy >= 0.85 and v_state.study_ibit < 3 then
    v_ibit := 1;
  end if;

  update public.ik_reward_state
  set study_day = v_state.study_day,
      study_ibit = v_state.study_ibit + v_ibit,
      module_counts = jsonb_set(
        coalesce(v_state.module_counts, '{}'::jsonb),
        array[v_key],
        to_jsonb(v_count),
        true
      )
  where owner_id = v_user;

  perform public.ik_award_internal(
    v_user,
    'study_session',
    v_module,
    v_eco,
    v_ibit,
    jsonb_build_object(
      'module', v_module,
      'tasks', v_tasks,
      'correct', v_correct,
      'accuracy', v_accuracy,
      'dict_id', p_dict_id,
      'source', coalesce(p_source,'')
    )
  );

  -- creator rewards (only for published user dicts)
  if p_dict_id is not null then
    select * into v_dict from public.ik_public_dicts where id = p_dict_id;
    if found and v_dict.dict_type = 'user' and v_dict.owner_id is not null and v_dict.owner_id <> v_user then
      -- anti-abuse: only count accounts older than 2 days
      select u.created_at into v_user_created from auth.users u where u.id = v_user;
      if v_user_created is not null and v_user_created <= now() - interval '2 days' then
        begin
          insert into public.ik_public_dict_usage_daily(dict_id, day, user_id)
          values (p_dict_id, v_today, v_user)
          on conflict do nothing;
          get diagnostics v_rowcount = row_count;
          v_inserted := v_rowcount > 0;
        exception when others then
          v_inserted := false;
        end;

        if v_inserted then
          select count(*) into v_unique_count
          from public.ik_public_dict_usage_daily
          where dict_id = p_dict_id and day = v_today;

          -- caps per dict/day
          insert into public.ik_public_dict_creator_daily(dict_id, day)
          values (p_dict_id, v_today)
          on conflict (dict_id, day) do nothing;

          select * into v_creator_day
          from public.ik_public_dict_creator_daily
          where dict_id = p_dict_id and day = v_today
          for update;

          if v_creator_day.eco_x10 < 400 then
            v_creator_eco := least(40, 400 - v_creator_day.eco_x10);
          end if;

          if (v_unique_count % 5 = 0) and v_creator_day.ibit < 5 then
            v_creator_ibit := 1;
          end if;

          if v_creator_eco > 0 or v_creator_ibit > 0 then
            update public.ik_public_dict_creator_daily
            set eco_x10 = eco_x10 + v_creator_eco,
                ibit = ibit + v_creator_ibit,
                updated_at = now()
            where dict_id = p_dict_id and day = v_today;

            perform public.ik_award_internal(
              v_dict.owner_id,
              'dict_creator_usage',
              'dictionary',
              v_creator_eco,
              v_creator_ibit,
              jsonb_build_object('dict_id', p_dict_id, 'unique_users_today', v_unique_count)
            );
          end if;
        end if;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'awarded', true,
    'eco', (v_eco::numeric / 10)::text,
    'eco_x10', v_eco,
    'ibit', v_ibit
  );
end;
$$;

revoke all on function public.ik_award_study_session(text, bigint, int, int, int, boolean, text) from public;
grant execute on function public.ik_award_study_session(text, bigint, int, int, int, boolean, text) to authenticated;

-- -----------------------------
-- Admin: create/update system dictionaries
-- -----------------------------

create or replace function public.ik_admin_create_system_dict(
  p_title text,
  p_words jsonb,
  p_dict_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_title text := btrim(coalesce(p_title,''));
  v_key text;
  v_dict_id bigint;
  v_prev_ver_id bigint;
  v_next_ver int;
  v_ver_id bigint;
begin
  if v_actor is null then
    raise exception 'auth required';
  end if;
  if not (public.ik_has_role('owner', v_actor) or public.ik_has_role('admin', v_actor) or public.ik_is_tech_admin(v_actor)) then
    raise exception 'admin required';
  end if;
  if v_title = '' then
    raise exception 'title required';
  end if;
  if jsonb_typeof(p_words) <> 'array' then
    raise exception 'words must be json array';
  end if;

  v_key := public.ik_title_key(v_title);
  if v_key = '' then
    v_key := 'system_' || substring(md5(random()::text || clock_timestamp()::text), 1, 10);
  end if;

  if p_dict_id is null then
    -- avoid collisions
    if exists (select 1 from public.ik_public_dicts d where d.dict_type='system' and d.title_key=v_key) then
      v_key := left(v_key || '_' || substring(md5(random()::text || clock_timestamp()::text), 1, 4), 64);
    end if;

    insert into public.ik_public_dicts(dict_type, title, title_key, owner_id, rating_enabled)
    values ('system', v_title, v_key, v_actor, true)
    returning id into v_dict_id;
    v_next_ver := 1;
  else
    v_dict_id := p_dict_id;
    select current_version_id into v_prev_ver_id
    from public.ik_public_dicts d
    where d.id = v_dict_id and d.dict_type = 'system';
    if not found then
      raise exception 'system dict not found';
    end if;
    select coalesce(max(version),0)+1 into v_next_ver
    from public.ik_public_dict_versions where dict_id = v_dict_id;
  end if;

  insert into public.ik_public_dict_versions(dict_id, version, status, created_by)
  values (v_dict_id, v_next_ver, 'published', v_actor)
  returning id into v_ver_id;

  insert into public.ik_public_dict_words(dict_version_id, en, ru, en_key, ru_key, pair_key)
  select
    v_ver_id,
    btrim(coalesce(x->>'en','')) as en,
    btrim(coalesce(x->>'ru','')) as ru,
    public.ik_norm_space_lower(coalesce(x->>'en','')) as en_key,
    public.ik_norm_space_lower(coalesce(x->>'ru','')) as ru_key,
    public.ik_norm_space_lower(coalesce(x->>'en','')) || '|' || public.ik_norm_space_lower(coalesce(x->>'ru','')) as pair_key
  from jsonb_array_elements(coalesce(p_words,'[]'::jsonb)) x
  where btrim(coalesce(x->>'en','')) <> ''
    and btrim(coalesce(x->>'ru','')) <> '';

  update public.ik_public_dicts
  set current_version_id = v_ver_id,
      title = v_title,
      title_key = v_key,
      updated_at = now()
  where id = v_dict_id;

  if v_prev_ver_id is not null then
    update public.ik_public_dict_versions
    set status = 'archived'
    where id = v_prev_ver_id;
  end if;

  return jsonb_build_object('ok', true, 'dict_id', v_dict_id, 'version', v_next_ver, 'version_id', v_ver_id);
end;
$$;

revoke all on function public.ik_admin_create_system_dict(text, jsonb, bigint) from public;
grant execute on function public.ik_admin_create_system_dict(text, jsonb, bigint) to authenticated;
