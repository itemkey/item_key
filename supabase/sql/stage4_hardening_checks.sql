-- Stage 4: hardening and verification queries
-- Safe to run multiple times.

-- Ensure key indexes exist
create index if not exists idx_sh_user_state_owner_key on public.sh_user_state(owner_id, state_key);

-- Verify policy coverage quickly
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'sh_dictionary_sections',
    'sh_dictionary_words',
    'sh_migration_runs',
    'sh_wt_tasks',
    'sh_user_state',
    'sh_onoi_state',
    'sh_plan_state',
    'ik_user_profiles',
    'ik_friend_requests',
    'ik_friendships'
  )
order by tablename, policyname;

-- Verify table presence
select
  to_regclass('public.sh_dictionary_sections') as sh_dictionary_sections,
  to_regclass('public.sh_dictionary_words') as sh_dictionary_words,
  to_regclass('public.sh_migration_runs') as sh_migration_runs,
  to_regclass('public.sh_wt_tasks') as sh_wt_tasks,
  to_regclass('public.sh_user_state') as sh_user_state,
  to_regclass('public.sh_onoi_state') as sh_onoi_state,
  to_regclass('public.sh_plan_state') as sh_plan_state,
  to_regclass('public.ik_user_profiles') as ik_user_profiles,
  to_regclass('public.ik_friend_requests') as ik_friend_requests,
  to_regclass('public.ik_friendships') as ik_friendships;

-- Verify unique constraints
select conrelid::regclass as table_name, conname as constraint_name
from pg_constraint
where conrelid::regclass::text in (
  'sh_dictionary_sections',
  'sh_dictionary_words',
  'sh_wt_tasks',
  'sh_user_state',
  'sh_onoi_state',
  'sh_plan_state',
  'ik_friendships'
)
  and contype = 'u'
order by conrelid::regclass::text, conname;
