-- Stage 12: seed repo dictionaries as published USER dictionaries (rated)
-- Moves content from crate/student_helper/db/dictionary/* into Supabase so
-- the app does NOT depend on /db/dictionary or manifest.json.
--
-- Requires: stage11_economy_roles_public_dictionary.sql
-- Safe to run multiple times: if a dictionary already has a current version, it is skipped.

do $stage12$
declare
  v_owner uuid;
  v_title text;
  v_title_key text;
  v_dict_id bigint;
  v_current_ver bigint;
  v_ver_id bigint;
  v_payload jsonb;
begin
  select p.id
  into v_owner
  from public.ik_user_profiles p
  where p.is_admin = true
  order by p.created_at asc
  limit 1;

  if v_owner is null then
    raise exception 'seed requires at least one tech-admin profile (ik_user_profiles.is_admin=true)';
  end if;

  -- =============================
  -- Destination B1 Unit 3
  -- =============================
  v_title := 'Destination B1 Unit 3';
  v_title_key := public.ik_title_key(v_title);

  insert into public.ik_public_dicts(dict_type, title, title_key, owner_id, rating_enabled)
  values ('user', v_title, v_title_key, v_owner, true)
  on conflict (dict_type, title_key)
  do update set title = excluded.title, owner_id = excluded.owner_id, rating_enabled = true, updated_at = now();

  select d.id, d.current_version_id
  into v_dict_id, v_current_ver
  from public.ik_public_dicts d
  where d.dict_type = 'user' and d.title_key = v_title_key
  limit 1;

  if v_current_ver is null then
    insert into public.ik_public_dict_versions(dict_id, version, status, created_by)
    values (v_dict_id, 1, 'published', v_owner)
    returning id into v_ver_id;

    v_payload := $json$
{
  "schema": "student_helper_dictionary_section",
  "schemaVersion": 1,
  "exportedAt": "2026-02-11T00:00:00Z",
  "section": "Destination B1 Unit 3",
  "words": [
    {
      "en": "carry on",
      "ru": "продолжать заниматься чем-либо"
    },
    {
      "en": "beat",
      "ru": "бить, колотить; побеждать"
    },
    {
      "en": "challenge",
      "ru": "бросать вызов"
    },
    {
      "en": "coach",
      "ru": "тренер"
    },
    {
      "en": "competition",
      "ru": "соревнование, конкуренция"
    },
    {
      "en": "group",
      "ru": "группа"
    },
    {
      "en": "pleasure",
      "ru": "удовольствие, наслаждение"
    },
    {
      "en": "risk",
      "ru": "риск"
    },
    {
      "en": "entertain",
      "ru": "развлекать"
    },
    {
      "en": "music",
      "ru": "музыка"
    },
    {
      "en": "book",
      "ru": "книга"
    },
    {
      "en": "fan",
      "ru": "фанат"
    },
    {
      "en": "action",
      "ru": "действие, поступок"
    },
    {
      "en": "athletics",
      "ru": "атлетика"
    },
    {
      "en": "sailing",
      "ru": "мореплавание"
    },
    {
      "en": "sailor",
      "ru": "матрос, моряк"
    },
    {
      "en": "board game",
      "ru": "настольная игра"
    },
    {
      "en": "captain",
      "ru": "капитан"
    },
    {
      "en": "challenge",
      "ru": "вызов"
    },
    {
      "en": "champion",
      "ru": "чемпион"
    },
    {
      "en": "cheat",
      "ru": "обманывать"
    },
    {
      "en": "classical music",
      "ru": "классическая музыка"
    },
    {
      "en": "club",
      "ru": "клуб"
    },
    {
      "en": "concert",
      "ru": "концерт"
    },
    {
      "en": "defeat",
      "ru": "наносить поражение"
    },
    {
      "en": "defeat",
      "ru": "поражение"
    },
    {
      "en": "entertaining",
      "ru": "развлекательный"
    },
    {
      "en": "folk music",
      "ru": "народная музыка"
    },
    {
      "en": "gym",
      "ru": "спортивный зал"
    },
    {
      "en": "have fun",
      "ru": "веселиться"
    },
    {
      "en": "interest",
      "ru": "интересовать"
    },
    {
      "en": "interest",
      "ru": "интерес"
    },
    {
      "en": "member",
      "ru": "участник, член"
    },
    {
      "en": "opponent",
      "ru": "противник"
    },
    {
      "en": "organise",
      "ru": "организовывать"
    },
    {
      "en": "referee",
      "ru": "судья"
    },
    {
      "en": "rhythm",
      "ru": "ритм"
    },
    {
      "en": "risk",
      "ru": "рисковать"
    },
    {
      "en": "score",
      "ru": "набирать очки"
    },
    {
      "en": "score",
      "ru": "счёт"
    },
    {
      "en": "support",
      "ru": "поддерживать"
    },
    {
      "en": "team",
      "ru": "команда"
    },
    {
      "en": "train",
      "ru": "тренироваться"
    },
    {
      "en": "video game",
      "ru": "видеоигра"
    },
    {
      "en": "eat out",
      "ru": "есть вне дома"
    },
    {
      "en": "give up",
      "ru": "бросить, отказаться"
    },
    {
      "en": "join in",
      "ru": "принимать участие"
    },
    {
      "en": "send off",
      "ru": "удалить с поля"
    },
    {
      "en": "take up",
      "ru": "заняться чем-либо"
    },
    {
      "en": "turn down",
      "ru": "отвергать; уменьшать"
    },
    {
      "en": "turn up",
      "ru": "сделать громче; появляться"
    },
    {
      "en": "for a long time",
      "ru": "долгое время"
    },
    {
      "en": "in the middle",
      "ru": "в середине"
    },
    {
      "en": "on CD/DVD/video",
      "ru": "на CD/DVD/видео"
    },
    {
      "en": "act",
      "ru": "действовать"
    },
    {
      "en": "athlete",
      "ru": "спортсмен"
    },
    {
      "en": "child",
      "ru": "ребёнок"
    },
    {
      "en": "collect",
      "ru": "собирать"
    },
    {
      "en": "hero",
      "ru": "герой"
    },
    {
      "en": "play",
      "ru": "играть"
    },
    {
      "en": "sail",
      "ru": "плыть на корабле"
    },
    {
      "en": "bored with",
      "ru": "скучающий от"
    },
    {
      "en": "crazy about",
      "ru": "сходить с ума по"
    },
    {
      "en": "good at",
      "ru": "способный к"
    },
    {
      "en": "interested in",
      "ru": "заинтересованный"
    },
    {
      "en": "keen on",
      "ru": "увлечённый"
    },
    {
      "en": "popular with",
      "ru": "популярный среди"
    },
    {
      "en": "feel like",
      "ru": "хотеть"
    },
    {
      "en": "listen to",
      "ru": "слушать"
    },
    {
      "en": "take part in",
      "ru": "принимать участие"
    },
    {
      "en": "a game against",
      "ru": "игра против"
    },
    {
      "en": "inactive",
      "ru": "бездеятельный"
    },
    {
      "en": "active",
      "ru": "активный"
    },
    {
      "en": "athletic",
      "ru": "спортивный"
    },
    {
      "en": "childhood",
      "ru": "детство"
    },
    {
      "en": "children",
      "ru": "дети"
    },
    {
      "en": "collection",
      "ru": "коллекция"
    },
    {
      "en": "collector",
      "ru": "коллекционер"
    },
    {
      "en": "entertainment",
      "ru": "развлечение"
    },
    {
      "en": "heroic",
      "ru": "героический"
    },
    {
      "en": "heroine",
      "ru": "главная героиня"
    },
    {
      "en": "musical",
      "ru": "музыкальный"
    },
    {
      "en": "musician",
      "ru": "музыкант"
    },
    {
      "en": "player",
      "ru": "игрок"
    },
    {
      "en": "playful",
      "ru": "игривый"
    }
  ]
}
    $json$::jsonb;

    insert into public.ik_public_dict_words(dict_version_id, en, ru, en_key, ru_key, pair_key)
    select
      v_ver_id,
      btrim(coalesce(w->>'en','')),
      btrim(coalesce(w->>'ru','')),
      public.ik_norm_space_lower(coalesce(w->>'en','')),
      public.ik_norm_space_lower(coalesce(w->>'ru','')),
      public.ik_norm_space_lower(coalesce(w->>'en','')) || '|' || public.ik_norm_space_lower(coalesce(w->>'ru',''))
    from jsonb_array_elements(coalesce(v_payload->'words','[]'::jsonb)) w
    where btrim(coalesce(w->>'en','')) <> '' and btrim(coalesce(w->>'ru','')) <> '';

    update public.ik_public_dicts
    set current_version_id = v_ver_id, updated_at = now()
    where id = v_dict_id;
  end if;

  -- =============================
  -- Destination B1 Unit 6
  -- =============================
  v_title := 'Destination B1 Unit 6';
  v_title_key := public.ik_title_key(v_title);

  insert into public.ik_public_dicts(dict_type, title, title_key, owner_id, rating_enabled)
  values ('user', v_title, v_title_key, v_owner, true)
  on conflict (dict_type, title_key)
  do update set title = excluded.title, owner_id = excluded.owner_id, rating_enabled = true, updated_at = now();

  select d.id, d.current_version_id
  into v_dict_id, v_current_ver
  from public.ik_public_dicts d
  where d.dict_type = 'user' and d.title_key = v_title_key
  limit 1;

  if v_current_ver is null then
    insert into public.ik_public_dict_versions(dict_id, version, status, created_by)
    values (v_dict_id, 1, 'published', v_owner)
    returning id into v_ver_id;

    v_payload := $json$
{
  "schema": "student_helper_dictionary_section",
  "schemaVersion": 1,
  "exportedAt": "2026-02-11T00:00:00Z",
  "section": "Destination B1 Unit 6",
  "words": [
    {
      "en": "in favour of",
      "ru": "в пользу, в защиту"
    },
    {
      "en": "to achieve",
      "ru": "добиваться, достигать"
    },
    {
      "en": "brain",
      "ru": "мозг"
    },
    {
      "en": "clever",
      "ru": "умный"
    },
    {
      "en": "to concentrate on",
      "ru": "концентрироваться на"
    },
    {
      "en": "to consider",
      "ru": "рассматривать, обдумывать"
    },
    {
      "en": "course",
      "ru": "курс"
    },
    {
      "en": "expert (adj)",
      "ru": "экспертный, квалифицированный"
    },
    {
      "en": "degree",
      "ru": "степень"
    },
    {
      "en": "experience (n)",
      "ru": "опыт"
    },
    {
      "en": "to experience",
      "ru": "испытывать, переживать"
    },
    {
      "en": "expert (n)",
      "ru": "эксперт, специалист"
    },
    {
      "en": "to fail",
      "ru": "провалить"
    },
    {
      "en": "guess (v)",
      "ru": "догадываться"
    },
    {
      "en": "guess (n)",
      "ru": "предположение"
    },
    {
      "en": "to hesitate",
      "ru": "колебаться"
    },
    {
      "en": "instruction",
      "ru": "инструкция, обучение"
    },
    {
      "en": "to make progress",
      "ru": "делать прогресс"
    },
    {
      "en": "to make sure",
      "ru": "убедиться"
    },
    {
      "en": "mark (n)",
      "ru": "оценка"
    },
    {
      "en": "mark (v)",
      "ru": "ставить оценку"
    },
    {
      "en": "mental",
      "ru": "умственный"
    },
    {
      "en": "to pass",
      "ru": "сдать экзамен"
    },
    {
      "en": "to take an exam",
      "ru": "сдавать экзамен"
    },
    {
      "en": "qualification",
      "ru": "квалификация, диплом"
    },
    {
      "en": "to remind",
      "ru": "напомнить"
    },
    {
      "en": "report",
      "ru": "отчёт"
    },
    {
      "en": "to revise",
      "ru": "повторять материал"
    },
    {
      "en": "to search",
      "ru": "искать"
    },
    {
      "en": "skill",
      "ru": "навык"
    },
    {
      "en": "smart",
      "ru": "умный, сообразительный"
    },
    {
      "en": "subject",
      "ru": "предмет"
    },
    {
      "en": "talented",
      "ru": "талантливый"
    },
    {
      "en": "term",
      "ru": "семестр"
    },
    {
      "en": "to wonder",
      "ru": "интересоваться, желать знать"
    },
    {
      "en": "to cross out",
      "ru": "зачёркивать"
    },
    {
      "en": "to look up",
      "ru": "искать (в справочнике)"
    },
    {
      "en": "to point out",
      "ru": "указывать"
    },
    {
      "en": "to read out",
      "ru": "читать вслух"
    },
    {
      "en": "to rip up",
      "ru": "рвать на кусочки"
    },
    {
      "en": "to rub out",
      "ru": "стирать"
    },
    {
      "en": "rubber",
      "ru": "ластик"
    },
    {
      "en": "to turn over",
      "ru": "перевернуть"
    },
    {
      "en": "to write down",
      "ru": "записать"
    },
    {
      "en": "to begin",
      "ru": "начинать"
    },
    {
      "en": "beginner",
      "ru": "новичок"
    },
    {
      "en": "beginning",
      "ru": "начало"
    },
    {
      "en": "at the beginning of",
      "ru": "в начале чего-либо"
    },
    {
      "en": "in the beginning",
      "ru": "вначале"
    },
    {
      "en": "in the end",
      "ru": "в конце концов"
    },
    {
      "en": "at the end of",
      "ru": "в конце чего-либо"
    },
    {
      "en": "brave",
      "ru": "храбрый"
    },
    {
      "en": "bravery",
      "ru": "храбрость"
    },
    {
      "en": "correct (v)",
      "ru": "исправлять"
    },
    {
      "en": "correct (adj)",
      "ru": "правильный"
    },
    {
      "en": "correction",
      "ru": "исправление"
    },
    {
      "en": "incorrect",
      "ru": "неправильный"
    },
    {
      "en": "to divide",
      "ru": "делить"
    },
    {
      "en": "division",
      "ru": "деление"
    },
    {
      "en": "to educate",
      "ru": "обучать"
    },
    {
      "en": "education",
      "ru": "образование"
    },
    {
      "en": "to instruct",
      "ru": "инструктировать, обучать"
    },
    {
      "en": "instructor",
      "ru": "инструктор"
    },
    {
      "en": "memory",
      "ru": "память"
    },
    {
      "en": "to memorise",
      "ru": "запоминать"
    },
    {
      "en": "memorial",
      "ru": "мемориал"
    },
    {
      "en": "to refer",
      "ru": "ссылаться, обращаться, упоминать, направлять"
    },
    {
      "en": "reference",
      "ru": "ссылка, рекомендация"
    },
    {
      "en": "silent",
      "ru": "тихий"
    },
    {
      "en": "please keep silent",
      "ru": "пожалуйста, не шумите"
    },
    {
      "en": "silence",
      "ru": "тишина"
    },
    {
      "en": "silently",
      "ru": "тихо"
    },
    {
      "en": "simple",
      "ru": "простой"
    },
    {
      "en": "to simplify",
      "ru": "упрощать"
    },
    {
      "en": "simplicity",
      "ru": "простота"
    },
    {
      "en": "to be capable of",
      "ru": "быть способным на"
    },
    {
      "en": "to be talented at",
      "ru": "быть талантливым в"
    },
    {
      "en": "to cheat at/in",
      "ru": "жульничать"
    },
    {
      "en": "to confuse with",
      "ru": "перепутать"
    },
    {
      "en": "to continue with",
      "ru": "продолжить"
    },
    {
      "en": "to cope with",
      "ru": "справляться с"
    },
    {
      "en": "to help with",
      "ru": "помочь с"
    },
    {
      "en": "to know about",
      "ru": "знать о"
    },
    {
      "en": "to learn about",
      "ru": "узнавать о"
    },
    {
      "en": "to succeed in",
      "ru": "преуспеть в"
    },
    {
      "en": "an opinion about/of",
      "ru": "мнение о"
    },
    {
      "en": "a question about",
      "ru": "вопрос о"
    },
    {
      "en": "by heart",
      "ru": "наизусть"
    },
    {
      "en": "for instance",
      "ru": "например"
    },
    {
      "en": "in conclusion",
      "ru": "в заключение"
    },
    {
      "en": "in fact",
      "ru": "на самом деле"
    },
    {
      "en": "in general",
      "ru": "в целом, обычно"
    },
    {
      "en": "be in favour of",
      "ru": "поддерживать, быть сторонником"
    }
  ]
}
    $json$::jsonb;

    insert into public.ik_public_dict_words(dict_version_id, en, ru, en_key, ru_key, pair_key)
    select
      v_ver_id,
      btrim(coalesce(w->>'en','')),
      btrim(coalesce(w->>'ru','')),
      public.ik_norm_space_lower(coalesce(w->>'en','')),
      public.ik_norm_space_lower(coalesce(w->>'ru','')),
      public.ik_norm_space_lower(coalesce(w->>'en','')) || '|' || public.ik_norm_space_lower(coalesce(w->>'ru',''))
    from jsonb_array_elements(coalesce(v_payload->'words','[]'::jsonb)) w
    where btrim(coalesce(w->>'en','')) <> '' and btrim(coalesce(w->>'ru','')) <> '';

    update public.ik_public_dicts
    set current_version_id = v_ver_id, updated_at = now()
    where id = v_dict_id;
  end if;

  -- =============================
  -- Destination B1 Unit 12
  -- =============================
  v_title := 'Destination B1 Unit 12';
  v_title_key := public.ik_title_key(v_title);

  insert into public.ik_public_dicts(dict_type, title, title_key, owner_id, rating_enabled)
  values ('user', v_title, v_title_key, v_owner, true)
  on conflict (dict_type, title_key)
  do update set title = excluded.title, owner_id = excluded.owner_id, rating_enabled = true, updated_at = now();

  select d.id, d.current_version_id
  into v_dict_id, v_current_ver
  from public.ik_public_dicts d
  where d.dict_type = 'user' and d.title_key = v_title_key
  limit 1;

  if v_current_ver is null then
    insert into public.ik_public_dict_versions(dict_id, version, status, created_by)
    values (v_dict_id, 1, 'published', v_owner)
    returning id into v_ver_id;

    v_payload := $json$
{
  "schema": "student_helper_dictionary_section",
  "schemaVersion": 1,
  "exportedAt": "2026-02-22T00:00:00Z",
  "section": "Destination B1 Unit 12",
  "words": [
    {
      "en": "apologize (v)",
      "ru": "извиняться"
    },
    {
      "en": "boyfriend",
      "ru": "молодой человек"
    },
    {
      "en": "close",
      "ru": "близкий"
    },
    {
      "en": "confident",
      "ru": "уверенный"
    },
    {
      "en": "cool",
      "ru": "крутой"
    },
    {
      "en": "couple",
      "ru": "пара, чета"
    },
    {
      "en": "decorate",
      "ru": "украшать"
    },
    {
      "en": "defend",
      "ru": "защищать"
    },
    {
      "en": "divorced",
      "ru": "в разводе"
    },
    {
      "en": "flat",
      "ru": "квартира"
    },
    {
      "en": "generous",
      "ru": "щедрый"
    },
    {
      "en": "girlfriend",
      "ru": "девушка"
    },
    {
      "en": "grateful",
      "ru": "благодарный"
    },
    {
      "en": "guest",
      "ru": "гость"
    },
    {
      "en": "independent",
      "ru": "независимый"
    },
    {
      "en": "introduce",
      "ru": "представлять, знакомить"
    },
    {
      "en": "loving",
      "ru": "любящий"
    },
    {
      "en": "loyal",
      "ru": "преданный, верный"
    },
    {
      "en": "mood",
      "ru": "настроение"
    },
    {
      "en": "neighbourhood",
      "ru": "окружение"
    },
    {
      "en": "ordinary",
      "ru": "обычный"
    },
    {
      "en": "patient",
      "ru": "терпеливый"
    },
    {
      "en": "private",
      "ru": "частный, личный"
    },
    {
      "en": "recognise",
      "ru": "узнать"
    },
    {
      "en": "relation",
      "ru": "родственник"
    },
    {
      "en": "rent",
      "ru": "снимать"
    },
    {
      "en": "respect",
      "ru": "уважать"
    },
    {
      "en": "single",
      "ru": "не в браке"
    },
    {
      "en": "stranger",
      "ru": "незнакомец"
    },
    {
      "en": "trust",
      "ru": "доверять"
    },
    {
      "en": "bring up",
      "ru": "воспитывать"
    },
    {
      "en": "fall out with",
      "ru": "поссориться"
    },
    {
      "en": "get on with",
      "ru": "ладить"
    },
    {
      "en": "go out with",
      "ru": "встречаться"
    },
    {
      "en": "let down",
      "ru": "разочаровывать, подводить"
    },
    {
      "en": "look after",
      "ru": "присматривать за"
    },
    {
      "en": "split up",
      "ru": "разойтись, расстаться"
    },
    {
      "en": "have in common with",
      "ru": "иметь что-то общее с"
    },
    {
      "en": "in contact (with)",
      "ru": "поддерживать связь"
    },
    {
      "en": "in love (with)",
      "ru": "влюблен"
    },
    {
      "en": "on purpose",
      "ru": "нарочно"
    },
    {
      "en": "on your own",
      "ru": "самостоятельно"
    },
    {
      "en": "able",
      "ru": "в состоянии"
    },
    {
      "en": "ability",
      "ru": "способность"
    },
    {
      "en": "disabled",
      "ru": "с ограниченными возможностями, инвалид"
    },
    {
      "en": "unable",
      "ru": "не в состоянии"
    },
    {
      "en": "admire",
      "ru": "восхищаться"
    },
    {
      "en": "care",
      "ru": "забота"
    },
    {
      "en": "careless",
      "ru": "беспечный"
    },
    {
      "en": "confident",
      "ru": "уверенная в себе"
    },
    {
      "en": "confidence",
      "ru": "уверенность"
    },
    {
      "en": "forgive",
      "ru": "прощать"
    },
    {
      "en": "forgiveness",
      "ru": "прощение"
    },
    {
      "en": "honest",
      "ru": "честный"
    },
    {
      "en": "introduce",
      "ru": "вводить"
    },
    {
      "en": "lie",
      "ru": "ложь"
    },
    {
      "en": "person",
      "ru": "человек"
    },
    {
      "en": "relate",
      "ru": "иметь отношение"
    },
    {
      "en": "fond of",
      "ru": "любят"
    },
    {
      "en": "jealous of",
      "ru": "ревновать"
    },
    {
      "en": "kind to",
      "ru": "любезны"
    },
    {
      "en": "married to",
      "ru": "замужем за"
    },
    {
      "en": "proud of",
      "ru": "гордиться"
    },
    {
      "en": "admire sb for",
      "ru": "восхищаюсь для"
    },
    {
      "en": "apologise (to sb) for",
      "ru": "извиниться для"
    },
    {
      "en": "argue (with sb) about",
      "ru": "спорить о"
    },
    {
      "en": "care about",
      "ru": "заботиться"
    },
    {
      "en": "chat (to sb) about",
      "ru": "чат о"
    },
    {
      "en": "an argument (with sb) about",
      "ru": "аргумент о"
    },
    {
      "en": "a relationship with",
      "ru": "отношения с"
    },
    {
      "en": "ability",
      "ru": "способность, умение"
    },
    {
      "en": "dishonest",
      "ru": "нечестный, непорядочный"
    }
  ]
}
    $json$::jsonb;

    insert into public.ik_public_dict_words(dict_version_id, en, ru, en_key, ru_key, pair_key)
    select
      v_ver_id,
      btrim(coalesce(w->>'en','')),
      btrim(coalesce(w->>'ru','')),
      public.ik_norm_space_lower(coalesce(w->>'en','')),
      public.ik_norm_space_lower(coalesce(w->>'ru','')),
      public.ik_norm_space_lower(coalesce(w->>'en','')) || '|' || public.ik_norm_space_lower(coalesce(w->>'ru',''))
    from jsonb_array_elements(coalesce(v_payload->'words','[]'::jsonb)) w
    where btrim(coalesce(w->>'en','')) <> '' and btrim(coalesce(w->>'ru','')) <> '';

    update public.ik_public_dicts
    set current_version_id = v_ver_id, updated_at = now()
    where id = v_dict_id;
  end if;

  -- =============================
  -- destination B1 unit 9 vocabulary
  -- =============================
  v_title := 'destination B1 unit 9 vocabulary';
  v_title_key := public.ik_title_key(v_title);

  insert into public.ik_public_dicts(dict_type, title, title_key, owner_id, rating_enabled)
  values ('user', v_title, v_title_key, v_owner, true)
  on conflict (dict_type, title_key)
  do update set title = excluded.title, owner_id = excluded.owner_id, rating_enabled = true, updated_at = now();

  select d.id, d.current_version_id
  into v_dict_id, v_current_ver
  from public.ik_public_dicts d
  where d.dict_type = 'user' and d.title_key = v_title_key
  limit 1;

  if v_current_ver is null then
    insert into public.ik_public_dict_versions(dict_id, version, status, created_by)
    values (v_dict_id, 1, 'published', v_owner)
    returning id into v_ver_id;

    v_payload := $json$
{
  "schema": "student_helper_dictionary_section",
  "schemaVersion": 1,
  "exportedAt": "2026-02-13T00:00:00Z",
  "section": "destination B1 unit 9 vocabulary",
  "words": [
    {"en": "accommodation", "ru": "жильё"},
    {"en": "book", "ru": "бронировать, заказывать"},
    {"en": "break", "ru": "перерыв, отдых"},
    {"en": "cancel", "ru": "отменять"},
    {"en": "catch", "ru": "сесть на транспорт"},
    {"en": "coach", "ru": "междугородний автобус"},
    {"en": "convenient", "ru": "удобный"},
    {"en": "crash", "ru": "авария"},
    {"en": "crowded", "ru": "многолюдный"},
    {"en": "abroad", "ru": "за границей"},
    {"en": "cruise", "ru": "круиз"},
    {"en": "delay", "ru": "задерживать"},
    {"en": "destination", "ru": "пункт назначения"},
    {"en": "ferry", "ru": "паром"},
    {"en": "flight", "ru": "полёт, рейс"},
    {"en": "foreign", "ru": "иностранный"},
    {"en": "harbour", "ru": "гавань"},
    {"en": "journey", "ru": "путешествие, поездка"},
    {"en": "luggage", "ru": "багаж"},
    {"en": "nearby", "ru": "близлежащий"},
    {"en": "pack", "ru": "паковать"},
    {"en": "passport", "ru": "паспорт"},
    {"en": "platform", "ru": "платформа"},
    {"en": "public transport", "ru": "общественный транспорт"},
    {"en": "reach", "ru": "достигать"},
    {"en": "resort", "ru": "курорт"},
    {"en": "souvenir", "ru": "сувенир"},
    {"en": "traffic", "ru": "движение, транспорт"},
    {"en": "trip", "ru": "поездка"},
    {"en": "vehicle", "ru": "транспортное средство"},
    {"en": "get into", "ru": "сесть в машину"},
    {"en": "get on", "ru": "сесть в транспорт"},
    {"en": "get out of", "ru": "выйти из машины"},
    {"en": "get off", "ru": "выйти из транспорта"},
    {"en": "go away", "ru": "уезжать"},
    {"en": "go back", "ru": "возвращаться"},
    {"en": "set off", "ru": "отправляться"},
    {"en": "take off", "ru": "взлетать"},
    {"en": "on holiday", "ru": "в отпуске"},
    {"en": "on schedule", "ru": "по расписанию"},
    {"en": "by car/bus", "ru": "на машине, на автобусе"},
    {"en": "on the coast", "ru": "на побережье"},
    {"en": "on foot", "ru": "пешком"},
    {"en": "on board", "ru": "на борту"},
    {"en": "close to", "ru": "близко к"},
    {"en": "famous for", "ru": "знаменитый чем-либо"},
    {"en": "far from", "ru": "далеко от"},
    {"en": "late for", "ru": "опоздать на"},
    {"en": "suitable for", "ru": "подходящий для"},
    {"en": "arrive at", "ru": "прибыть в (место)"},
    {"en": "arrive in", "ru": "прибыть в (город, страну)"},
    {"en": "ask about", "ru": "спросить о"},
    {"en": "ask for", "ru": "попросить"},
    {"en": "look at", "ru": "смотреть на"},
    {"en": "prepare for", "ru": "готовиться к"},
    {"en": "provide with", "ru": "обеспечить чем-либо"},
    {"en": "wait for", "ru": "ждать"},
    {"en": "able", "ru": "способный"},
    {"en": "ability", "ru": "способность"},
    {"en": "attract", "ru": "привлекать"},
    {"en": "attractive", "ru": "привлекательный"},
    {"en": "attraction", "ru": "привлекательность"},
    {"en": "back", "ru": "назад"},
    {"en": "backwards", "ru": "назад, обратно"},
    {"en": "choice", "ru": "выбор"},
    {"en": "choose", "ru": "выбирать"},
    {"en": "comfort (v)", "ru": "утешать"},
    {"en": "comfort (n)", "ru": "комфорт"},
    {"en": "comfortable", "ru": "удобный"},
    {"en": "uncomfortable", "ru": "неудобный"},
    {"en": "depart", "ru": "отправляться"},
    {"en": "departure", "ru": "отправление"},
    {"en": "direct", "ru": "направлять"},
    {"en": "direction", "ru": "направление"},
    {"en": "traveller", "ru": "путешественник"},
    {"en": "visitor", "ru": "посетитель"}
  ]
}
    $json$::jsonb;

    insert into public.ik_public_dict_words(dict_version_id, en, ru, en_key, ru_key, pair_key)
    select
      v_ver_id,
      btrim(coalesce(w->>'en','')),
      btrim(coalesce(w->>'ru','')),
      public.ik_norm_space_lower(coalesce(w->>'en','')),
      public.ik_norm_space_lower(coalesce(w->>'ru','')),
      public.ik_norm_space_lower(coalesce(w->>'en','')) || '|' || public.ik_norm_space_lower(coalesce(w->>'ru',''))
    from jsonb_array_elements(coalesce(v_payload->'words','[]'::jsonb)) w
    where btrim(coalesce(w->>'en','')) <> '' and btrim(coalesce(w->>'ru','')) <> '';

    update public.ik_public_dicts
    set current_version_id = v_ver_id, updated_at = now()
    where id = v_dict_id;
  end if;

  -- =============================
  -- 189page
  -- =============================
  v_title := '189page';
  v_title_key := public.ik_title_key(v_title);

  insert into public.ik_public_dicts(dict_type, title, title_key, owner_id, rating_enabled)
  values ('user', v_title, v_title_key, v_owner, true)
  on conflict (dict_type, title_key)
  do update set title = excluded.title, owner_id = excluded.owner_id, rating_enabled = true, updated_at = now();

  select d.id, d.current_version_id
  into v_dict_id, v_current_ver
  from public.ik_public_dicts d
  where d.dict_type = 'user' and d.title_key = v_title_key
  limit 1;

  if v_current_ver is null then
    insert into public.ik_public_dict_versions(dict_id, version, status, created_by)
    values (v_dict_id, 1, 'published', v_owner)
    returning id into v_ver_id;

    v_payload := $json$
{
  "schema": "student_helper_dictionary_section",
  "schemaVersion": 1,
  "exportedAt": "2026-02-24T18:57:27Z",
  "section": "189page",
  "words": [
    {
      "en": "advertisement",
      "ru": "реклама, объявление"
    },
    {
      "en": "afford",
      "ru": "позволить себе (по деньгам)"
    },
    {
      "en": "bargain",
      "ru": "выгодная покупка, сделка"
    },
    {
      "en": "brand",
      "ru": "бренд, марка"
    },
    {
      "en": "catalogue",
      "ru": "каталог"
    },
    {
      "en": "change",
      "ru": "сдача"
    },
    {
      "en": "coin",
      "ru": "монета"
    },
    {
      "en": "cost",
      "ru": "стоить - стоимость, цена"
    },
    {
      "en": "customer",
      "ru": "покупатель, клиент"
    },
    {
      "en": "debt",
      "ru": "долг, задолженность"
    },
    {
      "en": "demand",
      "ru": "требовать"
    },
    {
      "en": "export",
      "ru": "экспортировать, вывозить"
    },
    {
      "en": "fee",
      "ru": "плата, сбор"
    },
    {
      "en": "fortune",
      "ru": "состояние (богатство)"
    },
    {
      "en": "import",
      "ru": "импортировать, ввозить"
    },
    {
      "en": "invest",
      "ru": "инвестировать, вкладывать (деньги)"
    },
    {
      "en": "obtain",
      "ru": "получать, добывать"
    },
    {
      "en": "owe",
      "ru": "быть должным"
    },
    {
      "en": "own",
      "ru": "владеть"
    },
    {
      "en": "profit",
      "ru": "прибыль"
    },
    {
      "en": "property",
      "ru": "собственность, имущество (иногда - недвижимость)"
    },
    {
      "en": "purchase",
      "ru": "покупать - покупка, приобретение"
    },
    {
      "en": "receipt",
      "ru": "чек, квитанция"
    },
    {
      "en": "require",
      "ru": "требовать, нуждаться (в)"
    },
    {
      "en": "sale",
      "ru": "распродажа - продажа"
    },
    {
      "en": "save",
      "ru": "экономить, копить"
    },
    {
      "en": "select",
      "ru": "выбирать, отбирать"
    },
    {
      "en": "supply",
      "ru": "поставлять, снабжать - поставка, запас"
    },
    {
      "en": "variety",
      "ru": "разнообразие, ассортимент"
    },
    {
      "en": "waste",
      "ru": "тратить впустую - отходы, мусор"
    },
    {
      "en": "add up",
      "ru": "складывать, подсчитывать (итог)"
    },
    {
      "en": "come back (from)",
      "ru": "возвращаться (из)"
    },
    {
      "en": "give away",
      "ru": "раздавать, отдавать бесплатно"
    },
    {
      "en": "hurry up",
      "ru": "торопиться"
    },
    {
      "en": "pay back",
      "ru": "возвращать деньги, отдавать долг"
    },
    {
      "en": "save up (for)",
      "ru": "копить (на)"
    },
    {
      "en": "take back",
      "ru": "вернуть/отнести обратно (например, в магазин)"
    },
    {
      "en": "take down",
      "ru": "снять (с высокой полки), убрать"
    },
    {
      "en": "by credit card/cheque",
      "ru": "кредитной картой/чеком"
    },
    {
      "en": "for rent",
      "ru": "в аренду, сдаётся"
    },
    {
      "en": "for sale",
      "ru": "на продажу, продаётся"
    },
    {
      "en": "in cash",
      "ru": "наличными"
    },
    {
      "en": "in debt",
      "ru": "в долгу"
    },
    {
      "en": "in good/bad condition",
      "ru": "в хорошем/плохом состоянии"
    },
    {
      "en": "add",
      "ru": "добавлять"
    },
    {
      "en": "addition",
      "ru": "добавление, сумма"
    },
    {
      "en": "affordable",
      "ru": "доступный (по цене)"
    },
    {
      "en": "compare",
      "ru": "сравнивать"
    },
    {
      "en": "comparison",
      "ru": "сравнение"
    },
    {
      "en": "decide",
      "ru": "решать"
    },
    {
      "en": "decision",
      "ru": "решение"
    },
    {
      "en": "expense",
      "ru": "расход"
    },
    {
      "en": "expensive",
      "ru": "дорогой"
    },
    {
      "en": "inexpensive",
      "ru": "недорогой"
    },
    {
      "en": "judge",
      "ru": "судить"
    },
    {
      "en": "judgement",
      "ru": "суждение, решение (суда)"
    },
    {
      "en": "serve",
      "ru": "обслуживать"
    },
    {
      "en": "service",
      "ru": "обслуживание"
    },
    {
      "en": "servant",
      "ru": "слуга"
    },
    {
      "en": "true",
      "ru": "правдивый"
    },
    {
      "en": "truth",
      "ru": "правда"
    },
    {
      "en": "untrue",
      "ru": "ложный"
    },
    {
      "en": "truthful",
      "ru": "правдивый"
    },
    {
      "en": "use",
      "ru": "использовать"
    },
    {
      "en": "useful",
      "ru": "полезный"
    },
    {
      "en": "useless",
      "ru": "бесполезный"
    },
    {
      "en": "value",
      "ru": "ценность/ценить"
    },
    {
      "en": "valuable",
      "ru": "ценный"
    },
    {
      "en": "wrong about",
      "ru": "ошибаться насчёт (чего-то)"
    },
    {
      "en": "wrong with",
      "ru": "что-то не так с (чем-то)"
    },
    {
      "en": "belong to",
      "ru": "принадлежать (кому-то)"
    },
    {
      "en": "borrow sth from",
      "ru": "взять взаймы что-то у (кого-то)"
    },
    {
      "en": "buy sth from",
      "ru": "купить что-то у (кого-то/где-то)"
    },
    {
      "en": "choose between",
      "ru": "выбирать между"
    },
    {
      "en": "compare sth to/with",
      "ru": "сравнивать что-то с/со"
    },
    {
      "en": "decide on",
      "ru": "выбрать, остановиться на"
    },
    {
      "en": "lend sth to",
      "ru": "одолжить что-то кому-то"
    },
    {
      "en": "pay for",
      "ru": "платить за"
    },
    {
      "en": "spend sth on",
      "ru": "тратить (деньги/время) на"
    },
    {
      "en": "an advert(isement) for",
      "ru": "реклама/объявление о (чём-то)"
    }
  ]
}
    $json$::jsonb;

    insert into public.ik_public_dict_words(dict_version_id, en, ru, en_key, ru_key, pair_key)
    select
      v_ver_id,
      btrim(coalesce(w->>'en','')),
      btrim(coalesce(w->>'ru','')),
      public.ik_norm_space_lower(coalesce(w->>'en','')),
      public.ik_norm_space_lower(coalesce(w->>'ru','')),
      public.ik_norm_space_lower(coalesce(w->>'en','')) || '|' || public.ik_norm_space_lower(coalesce(w->>'ru',''))
    from jsonb_array_elements(coalesce(v_payload->'words','[]'::jsonb)) w
    where btrim(coalesce(w->>'en','')) <> '' and btrim(coalesce(w->>'ru','')) <> '';

    update public.ik_public_dicts
    set current_version_id = v_ver_id, updated_at = now()
    where id = v_dict_id;
  end if;

  -- =============================
  -- Destination B1 Unit 18
  -- =============================
  v_title := 'Destination B1 Unit 18';
  v_title_key := public.ik_title_key(v_title);

  insert into public.ik_public_dicts(dict_type, title, title_key, owner_id, rating_enabled)
  values ('user', v_title, v_title_key, v_owner, true)
  on conflict (dict_type, title_key)
  do update set title = excluded.title, owner_id = excluded.owner_id, rating_enabled = true, updated_at = now();

  select d.id, d.current_version_id
  into v_dict_id, v_current_ver
  from public.ik_public_dicts d
  where d.dict_type = 'user' and d.title_key = v_title_key
  limit 1;

  if v_current_ver is null then
    insert into public.ik_public_dict_versions(dict_id, version, status, created_by)
    values (v_dict_id, 1, 'published', v_owner)
    returning id into v_ver_id;

    v_payload := $json$
{
  "schema": "student_helper_dictionary_section",
  "schemaVersion": 1,
  "exportedAt": "2026-03-05T00:00:00Z",
  "section": "Destination B1 Unit 18",
  "words": [
    {"en": "artificial", "ru": "искусственный"},
    {"en": "automatic", "ru": "автоматический"},
    {"en": "complicated", "ru": "сложный"},
    {"en": "decrease", "ru": "уменьшать(ся)"},
    {"en": "digital", "ru": "цифровой"},
    {"en": "discover", "ru": "открывать"},
    {"en": "effect", "ru": "эффект; влияние"},
    {"en": "equipment", "ru": "оборудование"},
    {"en": "estimate", "ru": "оценивать; оценка"},
    {"en": "exact", "ru": "точный"},
    {"en": "experiment", "ru": "эксперимент; экспериментировать"},
    {"en": "gadget", "ru": "гаджет"},
    {"en": "hardware", "ru": "аппаратное обеспечение; железо"},
    {"en": "invent", "ru": "изобретать"},
    {"en": "involve", "ru": "вовлекать; включать в себя"},
    {"en": "laboratory", "ru": "лаборатория"},
    {"en": "lack", "ru": "нехватка; испытывать недостаток"},
    {"en": "laptop", "ru": "ноутбук"},
    {"en": "machine", "ru": "машина; механизм"},
    {"en": "maximum", "ru": "максимальный; максимум"},
    {"en": "minimum", "ru": "минимальный; минимум"},
    {"en": "operate", "ru": "управлять; работать (о машине)"},
    {"en": "plastic", "ru": "пластик; пластиковый"},
    {"en": "program", "ru": "программа; программировать"},
    {"en": "research", "ru": "исследование; исследовать"},
    {"en": "run", "ru": "работать; запуск"},
    {"en": "screen", "ru": "экран"},
    {"en": "software", "ru": "программное обеспечение"},
    {"en": "sudden", "ru": "внезапный"},
    {"en": "technology", "ru": "технология"},
    {"en": "unique", "ru": "уникальный"},

    {"en": "break down", "ru": "сломаться"},
    {"en": "come across", "ru": "наткнуться (случайно)"},
    {"en": "find out", "ru": "узнать; выяснить"},
    {"en": "make up", "ru": "выдумать; придумать"},
    {"en": "pull off", "ru": "оторвать"},
    {"en": "throw away", "ru": "выбросить"},
    {"en": "turn off", "ru": "выключить"},
    {"en": "turn on", "ru": "включить"},

    {"en": "at last", "ru": "наконец"},
    {"en": "by chance", "ru": "случайно"},
    {"en": "in my opinion", "ru": "по моему мнению"},
    {"en": "in the end", "ru": "в конце концов"},
    {"en": "in the future", "ru": "в будущем"},
    {"en": "out of order", "ru": "не в порядке; неисправен; не по порядку"},

    {"en": "boil", "ru": "кипятить(ся)"},
    {"en": "boiler", "ru": "бойлер; котёл"},
    {"en": "boiling", "ru": "кипящий; кипячение"},
    {"en": "chemist", "ru": "химик"},
    {"en": "chemical", "ru": "химический; химикат"},
    {"en": "chemistry", "ru": "химия"},
    {"en": "conclude", "ru": "заключать; делать вывод"},
    {"en": "conclusion", "ru": "вывод; заключение"},
    {"en": "examine", "ru": "осматривать; исследовать; экзаменовать"},
    {"en": "exam (examination)", "ru": "экзамен; обследование"},
    {"en": "examiner", "ru": "экзаменатор; эксперт"},
    {"en": "fascinate", "ru": "увлекать; очаровывать"},
    {"en": "fascination", "ru": "очарование; увлечение"},
    {"en": "fascinating", "ru": "увлекательный; захватывающий"},
    {"en": "history", "ru": "история"},
    {"en": "historic", "ru": "исторический (важный)"},
    {"en": "historian", "ru": "историк"},
    {"en": "identify", "ru": "идентифицировать; опознавать"},
    {"en": "identity", "ru": "личность; идентичность"},
    {"en": "identical", "ru": "идентичный; одинаковый"},
    {"en": "long", "ru": "длинный"},
    {"en": "length", "ru": "длина"},
    {"en": "measure", "ru": "измерять"},
    {"en": "measurement", "ru": "измерение"},
    {"en": "science", "ru": "наука"},
    {"en": "scientist", "ru": "учёный"},

    {"en": "different from/to", "ru": "отличный от"},
    {"en": "full of", "ru": "полный (чего-то)"},
    {"en": "begin sth with", "ru": "начинать что-то с"},
    {"en": "connect sth to/with", "ru": "соединять что-то с"},
    {"en": "disconnect sth from", "ru": "отсоединять что-то от"},
    {"en": "fill sth with", "ru": "наполнять что-то чем-то"},
    {"en": "result in", "ru": "приводить к"},
    {"en": "a difference between", "ru": "разница между"},
    {"en": "an idea about", "ru": "идея о"},
    {"en": "a number of", "ru": "некоторое количество"},
    {"en": "a reason for", "ru": "причина (чего-то)"},
    {"en": "a type of", "ru": "тип (чего-то)"}
  ]
}
    $json$::jsonb;

    insert into public.ik_public_dict_words(dict_version_id, en, ru, en_key, ru_key, pair_key)
    select
      v_ver_id,
      btrim(coalesce(w->>'en','')),
      btrim(coalesce(w->>'ru','')),
      public.ik_norm_space_lower(coalesce(w->>'en','')),
      public.ik_norm_space_lower(coalesce(w->>'ru','')),
      public.ik_norm_space_lower(coalesce(w->>'en','')) || '|' || public.ik_norm_space_lower(coalesce(w->>'ru',''))
    from jsonb_array_elements(coalesce(v_payload->'words','[]'::jsonb)) w
    where btrim(coalesce(w->>'en','')) <> '' and btrim(coalesce(w->>'ru','')) <> '';

    update public.ik_public_dicts
    set current_version_id = v_ver_id, updated_at = now()
    where id = v_dict_id;
  end if;
end;
$stage12$;
