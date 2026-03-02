-- Stage 3: user progress cloud state for tenses + structure

create table if not exists public.sh_user_state (
  id bigserial primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  state_key text not null,
  state_value jsonb not null,
  state_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, state_key)
);

create index if not exists idx_sh_user_state_owner on public.sh_user_state(owner_id);
create index if not exists idx_sh_user_state_key on public.sh_user_state(state_key);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_sh_user_state_updated_at on public.sh_user_state;
create trigger trg_sh_user_state_updated_at
before update on public.sh_user_state
for each row execute function public.set_updated_at();

alter table public.sh_user_state enable row level security;

drop policy if exists "sh_user_state_select_own" on public.sh_user_state;
create policy "sh_user_state_select_own"
on public.sh_user_state for select
using (owner_id = auth.uid());

drop policy if exists "sh_user_state_insert_own" on public.sh_user_state;
create policy "sh_user_state_insert_own"
on public.sh_user_state for insert
with check (owner_id = auth.uid());

drop policy if exists "sh_user_state_update_own" on public.sh_user_state;
create policy "sh_user_state_update_own"
on public.sh_user_state for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "sh_user_state_delete_own" on public.sh_user_state;
create policy "sh_user_state_delete_own"
on public.sh_user_state for delete
using (owner_id = auth.uid());
