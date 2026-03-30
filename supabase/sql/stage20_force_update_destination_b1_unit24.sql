-- Stage 20: force update for "destination B1 unit 24 vocabulary"
-- Run after stage11 and stage12. Creates a new published version every run.

do $stage20$
declare
  v_title text := 'destination B1 unit 24 vocabulary';
  v_title_key text := public.ik_title_key(v_title);
  v_owner uuid;
  v_dict_id bigint;
  v_prev_ver_id bigint;
  v_next_ver int;
  v_ver_id bigint;
  v_payload jsonb;
begin
  select d.id, d.current_version_id, d.owner_id
  into v_dict_id, v_prev_ver_id, v_owner
  from public.ik_public_dicts d
  where d.dict_type = 'user'
    and d.title_key = v_title_key
  order by d.id asc
  limit 1
  for update;

  if v_dict_id is null then
    select p.id
    into v_owner
    from public.ik_user_profiles p
    where p.is_admin = true
    order by p.created_at asc
    limit 1;

    if v_owner is null then
      raise exception 'stage20 requires at least one tech-admin profile (ik_user_profiles.is_admin=true)';
    end if;

    insert into public.ik_public_dicts(dict_type, title, title_key, owner_id, rating_enabled)
    values ('user', v_title, v_title_key, v_owner, true)
    returning id, current_version_id into v_dict_id, v_prev_ver_id;
  end if;

  select coalesce(max(version), 0) + 1
  into v_next_ver
  from public.ik_public_dict_versions
  where dict_id = v_dict_id;

  insert into public.ik_public_dict_versions(dict_id, version, status, created_by)
  values (v_dict_id, v_next_ver, 'published', v_owner)
  returning id into v_ver_id;

  v_payload := $json$
{
  "schema": "student_helper_dictionary_section",
  "schemaVersion": 1,
  "exportedAt": "2026-03-30T00:00:00Z",
  "section": "destination B1 unit 24 vocabulary",
  "words": [
    {"en": "to admit", "ru": "признавать"},
    {"en": "to arrest", "ru": "арестовывать"},
    {"en": "charity", "ru": "благотворительность"},
    {"en": "to commit", "ru": "совершать"},
    {"en": "commit a crime", "ru": "совершить преступление"},
    {"en": "community", "ru": "сообщество"},
    {"en": "court", "ru": "суд"},
    {"en": "in court", "ru": "в суде"},
    {"en": "criminal", "ru": "преступник"},
    {"en": "criminal", "ru": "преступный, криминальный"},
    {"en": "culture", "ru": "культура"},
    {"en": "familiar", "ru": "знакомый, известный"},
    {"en": "government", "ru": "правительство"},
    {"en": "habit", "ru": "привычка"},
    {"en": "identity card", "ru": "удостоверение личности"},
    {"en": "illegal", "ru": "незаконный"},
    {"en": "politics", "ru": "политика"},
    {"en": "population", "ru": "население"},
    {"en": "prison", "ru": "тюрьма"},
    {"en": "in prison", "ru": "в тюрьме"},
    {"en": "prisoner", "ru": "заключенный"},
    {"en": "to protest against", "ru": "протестовать против"},
    {"en": "protest", "ru": "протест"},
    {"en": "resident", "ru": "житель"},
    {"en": "responsible", "ru": "ответственный"},
    {"en": "robbery", "ru": "ограбление"},
    {"en": "to rob", "ru": "грабить"},
    {"en": "routine", "ru": "распорядок,рутина"},
    {"en": "routine", "ru": "текущий, рутинный"},
    {"en": "schedule", "ru": "график, расписание, повестка дня"},
    {"en": "on schedule", "ru": "по графику"},
    {"en": "situation", "ru": "ситуация"},
    {"en": "social", "ru": "социальный"},
    {"en": "society", "ru": "общество"},
    {"en": "to steal", "ru": "красть"},
    {"en": "tradition", "ru": "традиция"},
    {"en": "typical of", "ru": "типичный для"},
    {"en": "to vote for", "ru": "голосовать за"},
    {"en": "vote", "ru": "голос, голосование"},
    {"en": "youth club", "ru": "молодежный клуб"},
    {"en": "break into", "ru": "вломиться в ( дом)"},
    {"en": "to catch up with", "ru": "нагонять, догонять"},
    {"en": "to get away with (the crime)", "ru": "избежать наказания, выйти сухим из воды"},
    {"en": "to get up", "ru": "встать"},
    {"en": "to move in", "ru": "въехать в дом"},
    {"en": "to put away", "ru": "убирать на место"},
    {"en": "to wake up", "ru": "проснуться"},
    {"en": "to wash up", "ru": "мыть посуду"},
    {"en": "against the law", "ru": "незаконно, против закона"},
    {"en": "at the age of", "ru": "в возрасте"},
    {"en": "in public", "ru": "на людях"},
    {"en": "in response to (in reply to, in answer to)", "ru": "в ответ на"},
    {"en": "in touch with", "ru": "в контакте с кем-л."},
    {"en": "to keep in touch with", "ru": "поддерживать связь с"},
    {"en": "to put sb in touch with sb", "ru": "познакомить кого-л. с кем-л."},
    {"en": "in your teens", "ru": "в возрасте 13-19 лет"},
    {"en": "in your twenties", "ru": "в возрасте 20-29 лет"},
    {"en": "to agree", "ru": "соглашаться"},
    {"en": "agreement", "ru": "соглашение, договор; согласие"},
    {"en": "to disagree", "ru": "не соглашаться, расходиться во мнениях"},
    {"en": "belief", "ru": "верование, убеждение"},
    {"en": "to believe", "ru": "верить"},
    {"en": "believable", "ru": "вероятный, правдоподобный, возможный"},
    {"en": "unbelievable", "ru": "невероятный, неправдоподобный"},
    {"en": "courage", "ru": "мужество, смелость"},
    {"en": "courageous", "ru": "мужественный"},
    {"en": "to elect", "ru": "избирать"},
    {"en": "election", "ru": "выборы"},
    {"en": "equal", "ru": "равный, равноправный"},
    {"en": "equality", "ru": "равенство, равноправие"},
    {"en": "unequal", "ru": "неравный"},
    {"en": "life", "ru": "жизнь"},
    {"en": "to live", "ru": "жить"},
    {"en": "alive", "ru": "живой"},
    {"en": "nation", "ru": "народ, нация"},
    {"en": "nationality", "ru": "национальность"},
    {"en": "national", "ru": "народный, национальный, государственный"},
    {"en": "international", "ru": "международный, интернациональный"},
    {"en": "peace", "ru": "мир"},
    {"en": "peaceful", "ru": "мирный, миролюбивый"},
    {"en": "peaceful", "ru": "тихий, спокойный"},
    {"en": "peacefully", "ru": "мирно, миролюбиво"},
    {"en": "peacefully", "ru": "тихо, спокойно"},
    {"en": "to shoot (shot-shot)", "ru": "стрелять"},
    {"en": "shot", "ru": "выстрел"},
    {"en": "shooting", "ru": "стрельба, перестрелка"},
    {"en": "to be angry with sb about", "ru": "злой на кого-то за"},
    {"en": "to be guilty of", "ru": "виновный в"},
    {"en": "to accuse of", "ru": "обвинять в"},
    {"en": "to blame sb for", "ru": "винить за"},
    {"en": "to blame something on someone", "ru": "возлагать вину на"},
    {"en": "to critise for", "ru": "критиковать за"},
    {"en": "to forget about", "ru": "забыть о"},
    {"en": "to forgive for", "ru": "простить за"},
    {"en": "to invite to", "ru": "приглашать"},
    {"en": "invitation", "ru": "приглашение"},
    {"en": "to punish someone for", "ru": "наказывать за"},
    {"en": "to share something with", "ru": "делить с"},
    {"en": "to smile at", "ru": "улыбаться"}
  ]
}
  $json$::jsonb;

  insert into public.ik_public_dict_words(dict_version_id, en, ru, en_key, ru_key, pair_key)
  select
    v_ver_id,
    s.en,
    s.ru,
    s.en_key,
    s.ru_key,
    s.pair_key
  from (
    select distinct on (pair_key)
      btrim(coalesce(w->>'en','')) as en,
      btrim(coalesce(w->>'ru','')) as ru,
      public.ik_norm_space_lower(coalesce(w->>'en','')) as en_key,
      public.ik_norm_space_lower(coalesce(w->>'ru','')) as ru_key,
      public.ik_norm_space_lower(coalesce(w->>'en','')) || '|' || public.ik_norm_space_lower(coalesce(w->>'ru','')) as pair_key
    from jsonb_array_elements(coalesce(v_payload->'words','[]'::jsonb)) w
    where btrim(coalesce(w->>'en','')) <> ''
      and btrim(coalesce(w->>'ru','')) <> ''
    order by pair_key
  ) s;

  update public.ik_public_dict_versions
  set status = 'archived'
  where dict_id = v_dict_id
    and id <> v_ver_id
    and status = 'published';

  update public.ik_public_dicts
  set current_version_id = v_ver_id,
      title = v_title,
      title_key = v_title_key,
      rating_enabled = true,
      updated_at = now()
  where id = v_dict_id;
end;
$stage20$;
