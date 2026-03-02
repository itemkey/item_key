-- Stage 2: shared word_transformation storage
-- Read for everyone, write only for admin accounts

create table if not exists public.sh_wt_tasks (
  id bigserial primary key,
  type text not null,
  category text not null,
  en_noun text not null,
  en_adj text not null,
  ru_noun text not null,
  ru_adj text not null,
  pair_key text not null,
  source text not null default 'seed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (type, pair_key)
);

create index if not exists idx_sh_wt_tasks_type on public.sh_wt_tasks(type);
create index if not exists idx_sh_wt_tasks_category on public.sh_wt_tasks(category);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_sh_wt_tasks_updated_at on public.sh_wt_tasks;
create trigger trg_sh_wt_tasks_updated_at
before update on public.sh_wt_tasks
for each row execute function public.set_updated_at();

alter table public.sh_wt_tasks enable row level security;

drop policy if exists "wt_select_public" on public.sh_wt_tasks;
create policy "wt_select_public"
on public.sh_wt_tasks for select
using (true);

drop policy if exists "wt_admin_insert" on public.sh_wt_tasks;
create policy "wt_admin_insert"
on public.sh_wt_tasks for insert
with check (lower(coalesce(auth.jwt()->>'email','')) in ('itemkeygithub@gmail.com', 'kravetznikita@gmail.com'));

drop policy if exists "wt_admin_update" on public.sh_wt_tasks;
create policy "wt_admin_update"
on public.sh_wt_tasks for update
using (lower(coalesce(auth.jwt()->>'email','')) in ('itemkeygithub@gmail.com', 'kravetznikita@gmail.com'))
with check (lower(coalesce(auth.jwt()->>'email','')) in ('itemkeygithub@gmail.com', 'kravetznikita@gmail.com'));

drop policy if exists "wt_admin_delete" on public.sh_wt_tasks;
create policy "wt_admin_delete"
on public.sh_wt_tasks for delete
using (lower(coalesce(auth.jwt()->>'email','')) in ('itemkeygithub@gmail.com', 'kravetznikita@gmail.com'));
