-- Stage 21: seed "Destination B1 Unit 27" as published USER dictionary
-- Run after stage11 (or after full deploy). Safe to run multiple times.

do $stage21$
declare
  v_title text := 'Destination B1 Unit 27';
  v_title_key text := public.ik_title_key(v_title);
  v_owner uuid;
  v_dict_id bigint;
  v_current_ver bigint;
  v_ver_id bigint;
  v_payload jsonb;
begin
  select d.id, d.current_version_id, d.owner_id
  into v_dict_id, v_current_ver, v_owner
  from public.ik_public_dicts d
  where d.dict_type = 'user'
    and d.title_key = v_title_key
  order by d.id asc
  limit 1;

  if v_owner is null then
    select p.id
    into v_owner
    from public.ik_user_profiles p
    where p.is_admin = true
    order by p.created_at asc
    limit 1;
  end if;

  if v_owner is null then
    raise exception 'stage21 requires at least one tech-admin profile (ik_user_profiles.is_admin=true)';
  end if;

  if v_dict_id is null then
    insert into public.ik_public_dicts(dict_type, title, title_key, owner_id, rating_enabled)
    values ('user', v_title, v_title_key, v_owner, true)
    returning id, current_version_id into v_dict_id, v_current_ver;
  else
    update public.ik_public_dicts
    set title = v_title,
        title_key = v_title_key,
        owner_id = v_owner,
        rating_enabled = true,
        updated_at = now()
    where id = v_dict_id;
  end if;

  if v_current_ver is null then
    insert into public.ik_public_dict_versions(dict_id, version, status, created_by)
    values (v_dict_id, 1, 'published', v_owner)
    returning id into v_ver_id;

    v_payload := $json$
{
  "schema": "student_helper_dictionary_section",
  "schemaVersion": 1,
  "exportedAt": "2026-04-06T00:00:00Z",
  "section": "Destination B1 Unit 27",
  "words": [
    {"en": "ambition", "ru": "амбиция, желание"},
    {"en": "application", "ru": "заявление"},
    {"en": "bank account", "ru": "счет в банке"},
    {"en": "career", "ru": "карьера, профессиональная деятельность"},
    {"en": "colleague", "ru": "коллега"},
    {"en": "company", "ru": "компания"},
    {"en": "contract", "ru": "контракт"},
    {"en": "department", "ru": "отдел"},
    {"en": "to deserve", "ru": "заслуживать"},
    {"en": "to earn", "ru": "зарабатывать"},
    {"en": "fame", "ru": "слава"},
    {"en": "goal", "ru": "цель"},
    {"en": "to impress", "ru": "впечатлять"},
    {"en": "impression", "ru": "впечатление"},
    {"en": "impressive", "ru": "впечатляющий"},
    {"en": "income", "ru": "доход"},
    {"en": "industry", "ru": "промышленность"},
    {"en": "interview", "ru": "интервью, собеседование"},
    {"en": "to interview", "ru": "брать интервью, проводить собеседование"},
    {"en": "leader", "ru": "руководитель, лидер"},
    {"en": "poverty", "ru": "бедность"},
    {"en": "pension", "ru": "пенсия"},
    {"en": "manager", "ru": "менеджер"},
    {"en": "pressure", "ru": "давление"},
    {"en": "previous", "ru": "предыдущий"},
    {"en": "profession", "ru": "профессия"},
    {"en": "to retire", "ru": "выходить на пенсию"},
    {"en": "retirement", "ru": "выход на пенсию"},
    {"en": "salary", "ru": "зарплата"},
    {"en": "staff", "ru": "штат служащих, сотрудники"},
    {"en": "strike", "ru": "забастовка"},
    {"en": "tax", "ru": "налог"},
    {"en": "to tax", "ru": "облагать налогом"},
    {"en": "wealth", "ru": "богатство"},
    {"en": "wealthy", "ru": "богатый"},

    {"en": "to call off", "ru": "отменять"},
    {"en": "to give back", "ru": "возвращать, отдавать"},
    {"en": "to go on", "ru": "происходить, продолжаться"},
    {"en": "to put off", "ru": "откладывать"},
    {"en": "to set up", "ru": "учреждать, основывать"},
    {"en": "to stay up", "ru": "не ложиться спать допоздна, засиживаться"},
    {"en": "to take away", "ru": "унести, убрать, забрать"},
    {"en": "to take over", "ru": "захватить, взять под контроль"},

    {"en": "at the moment", "ru": "в данный момент"},
    {"en": "be in charge of", "ru": "быть ответственным за что-то"},
    {"en": "on business", "ru": "в командировке, по делам"},
    {"en": "on strike", "ru": "бастовать, быть на забастовке"},
    {"en": "on time", "ru": "вовремя"},
    {"en": "be on duty", "ru": "быть на службе, дежурить"},
    {"en": "be off duty", "ru": "быть не на службе"},

    {"en": "to assist", "ru": "помогать"},
    {"en": "assistance", "ru": "помощь"},
    {"en": "assistant", "ru": "помощник"},
    {"en": "to beg", "ru": "умолять"},
    {"en": "beggar", "ru": "попрошайка"},
    {"en": "boss", "ru": "начальник"},
    {"en": "bossy", "ru": "властный, любящий командовать"},
    {"en": "to employ", "ru": "нанимать, принимать на работу"},
    {"en": "unemployment", "ru": "безработица"},
    {"en": "employee", "ru": "работник"},
    {"en": "employer", "ru": "наниматель, работодатель"},
    {"en": "unemployed", "ru": "безработный"},
    {"en": "famous for", "ru": "знаменитый чем-либо"},
    {"en": "to occupy", "ru": "занимать"},
    {"en": "occupation", "ru": "занятие, профессия, работа"},
    {"en": "office", "ru": "офис"},
    {"en": "officer", "ru": "офицер, служащий"},
    {"en": "unofficial", "ru": "неофициальный"},
    {"en": "retired", "ru": "пенсионер"},
    {"en": "safe", "ru": "безопасный, в безопасности"},
    {"en": "save from", "ru": "спасать от"},
    {"en": "safety", "ru": "безопасность"},
    {"en": "unsafe", "ru": "небезопасный"},
    {"en": "succeed in", "ru": "достигать успеха в"},
    {"en": "success", "ru": "успех"},
    {"en": "unsuccessful", "ru": "неуспешный"},

    {"en": "to be careful with", "ru": "быть осторожным с"},
    {"en": "to be difficult for", "ru": "быть сложным для"},
    {"en": "to be fed up with", "ru": "быть сытым по горло, когда что-то надоело"},
    {"en": "to be ready for", "ru": "быть готовым к"},
    {"en": "to be responsible for", "ru": "быть ответственным за"},
    {"en": "to apply for", "ru": "подавать заявление, подавать заявку"},
    {"en": "to depend on", "ru": "зависеть от"},
    {"en": "to refer to", "ru": "ссылаться на, упоминать"},
    {"en": "to work as", "ru": "работать кем-то"},
    {"en": "to work for", "ru": "работать на кого-то"},

    {"en": "in time", "ru": "заблаговременно"},
    {"en": "just in time", "ru": "как раз вовремя"},
    {"en": "famous", "ru": "знаменитый"},
    {"en": "infamous", "ru": "печально известный"},
    {"en": "official", "ru": "официальный"},
    {"en": "save", "ru": "спасать"},
    {"en": "successful", "ru": "успешный"},
    {"en": "inform sb about", "ru": "информировать кого-то о чем-то"},
    {"en": "a kind of", "ru": "вид чего-то, своего рода"}
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

    update public.ik_public_dicts
    set current_version_id = v_ver_id,
        title = v_title,
        title_key = v_title_key,
        rating_enabled = true,
        updated_at = now()
    where id = v_dict_id;
  end if;
end;
$stage21$;
