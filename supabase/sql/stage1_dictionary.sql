-- Stage 1: Dictionary per-account storage + migration logs

create table if not exists public.sh_dictionary_sections (
  id bigserial primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  name_key text not null,
  source text not null default 'imported_local',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name_key)
);

create table if not exists public.sh_dictionary_words (
  id bigserial primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  section_id bigint not null references public.sh_dictionary_sections(id) on delete cascade,
  en text not null,
  ru text not null,
  en_key text not null,
  ru_key text not null,
  pair_key text not null,
  source text not null default 'imported_local',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, pair_key)
);

create table if not exists public.sh_migration_runs (
  id bigserial primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  run_type text not null default 'dictionary',
  status text not null,
  local_sections_count int not null default 0,
  local_words_count int not null default 0,
  remote_sections_count int not null default 0,
  remote_words_count int not null default 0,
  local_fingerprint text,
  remote_fingerprint text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_sh_dict_sections_owner on public.sh_dictionary_sections(owner_id);
create index if not exists idx_sh_dict_words_owner on public.sh_dictionary_words(owner_id);
create index if not exists idx_sh_dict_words_section on public.sh_dictionary_words(section_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_sh_sections_updated_at on public.sh_dictionary_sections;
create trigger trg_sh_sections_updated_at
before update on public.sh_dictionary_sections
for each row execute function public.set_updated_at();

drop trigger if exists trg_sh_words_updated_at on public.sh_dictionary_words;
create trigger trg_sh_words_updated_at
before update on public.sh_dictionary_words
for each row execute function public.set_updated_at();

alter table public.sh_dictionary_sections enable row level security;
alter table public.sh_dictionary_words enable row level security;
alter table public.sh_migration_runs enable row level security;

drop policy if exists "sections_select_own" on public.sh_dictionary_sections;
create policy "sections_select_own"
on public.sh_dictionary_sections for select
using (owner_id = auth.uid());

drop policy if exists "sections_insert_own" on public.sh_dictionary_sections;
create policy "sections_insert_own"
on public.sh_dictionary_sections for insert
with check (owner_id = auth.uid());

drop policy if exists "sections_update_own" on public.sh_dictionary_sections;
create policy "sections_update_own"
on public.sh_dictionary_sections for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "sections_delete_own" on public.sh_dictionary_sections;
create policy "sections_delete_own"
on public.sh_dictionary_sections for delete
using (owner_id = auth.uid());

drop policy if exists "words_select_own" on public.sh_dictionary_words;
create policy "words_select_own"
on public.sh_dictionary_words for select
using (owner_id = auth.uid());

drop policy if exists "words_insert_own" on public.sh_dictionary_words;
create policy "words_insert_own"
on public.sh_dictionary_words for insert
with check (owner_id = auth.uid());

drop policy if exists "words_update_own" on public.sh_dictionary_words;
create policy "words_update_own"
on public.sh_dictionary_words for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "words_delete_own" on public.sh_dictionary_words;
create policy "words_delete_own"
on public.sh_dictionary_words for delete
using (owner_id = auth.uid());

drop policy if exists "runs_select_own" on public.sh_migration_runs;
create policy "runs_select_own"
on public.sh_migration_runs for select
using (owner_id = auth.uid());

drop policy if exists "runs_insert_own" on public.sh_migration_runs;
create policy "runs_insert_own"
on public.sh_migration_runs for insert
with check (owner_id = auth.uid());
