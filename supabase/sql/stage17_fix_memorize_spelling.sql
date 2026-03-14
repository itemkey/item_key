-- Stage 17: fix memorize spelling in seeded public dictionaries
-- Run after stage16_planning_personal_schedule.sql and optional stage12 seed.
-- Safe to run multiple times.

update public.ik_public_dict_words
set
  en = 'to memorize',
  en_key = public.ik_norm_space_lower('to memorize'),
  pair_key = public.ik_norm_space_lower('to memorize') || '|' || ru_key
where en_key = public.ik_norm_space_lower('to memorise')
  and ru_key = public.ik_norm_space_lower('запоминать');
