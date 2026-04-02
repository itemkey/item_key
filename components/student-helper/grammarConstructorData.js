export const CONSTRUCTOR_NODES = {
  root: {
    q: "К какому промежутку времени относится твое предложение?",
    hint: "Если не уверен, выбери \"не про время / не уверен\".",
    options: [
      { id: "present", label: "Настоящее", next: "present_stage" },
      { id: "past", label: "Прошлое", next: "past_stage" },
      { id: "future", label: "Будущее", next: "future_stage" },
      { id: "universal", label: "Не про время, а про структуру", next: "universal_stage" },
      { id: "unknown", label: "Не уверен", result: "global_map" },
    ],
  },
  present_stage: {
    q: "В настоящем что тебе нужно?",
    options: [
      { id: "habit", label: "Обычно / регулярно / факт", next: "present_habit_stage" },
      { id: "now_type", label: "Прямо сейчас", next: "present_now_stage" },
      { id: "link_now", label: "Связь с текущим моментом", next: "present_link_stage" },
      { id: "map", label: "Не уверен, помоги быстро выбрать", result: "present_map" },
    ],
  },
  present_habit_stage: {
    q: "Уточни про настоящее:",
    options: [
      { id: "habit_fact", label: "Это факт или рутина (обычно/каждый день)", result: "present_habit" },
      { id: "state", label: "Это состояние/желание/мнение (know/like/want)", result: "present_state" },
      { id: "map", label: "Не уверен, помоги быстро выбрать", result: "present_map" },
    ],
  },
  present_now_stage: {
    q: "Прямо сейчас это что?",
    options: [
      { id: "action", label: "Действие в процессе (делаю/иду/пишу)", result: "present_process" },
      { id: "state", label: "Состояние/желание/мнение (want/know/like)", result: "present_state" },
      { id: "map", label: "Не уверен, помоги быстро выбрать", result: "present_map" },
    ],
  },
  present_link_stage: {
    q: "Связь с сейчас: что важнее?",
    options: [
      { id: "result", label: "Результат к текущему моменту", result: "present_result" },
      { id: "duration", label: "Как долго длится до сейчас", result: "present_duration" },
      { id: "map", label: "Не уверен, помоги быстро выбрать", result: "present_map" },
    ],
  },
  past_stage: {
    q: "В прошлом что тебе нужно?",
    options: [
      { id: "fact", label: "Завершенный факт/событие", next: "past_fact_stage" },
      { id: "process", label: "Процесс в момент в прошлом", result: "past_process" },
      { id: "habit", label: "Повторялось раньше / раньше было так", next: "past_habit_stage" },
      { id: "map", label: "Не уверен, помоги быстро выбрать", result: "past_map" },
    ],
  },
  past_fact_stage: {
    q: "Про прошлое событие: что важно?",
    options: [
      { id: "single", label: "Просто факт в прошлом", result: "past_fact" },
      { id: "earlier", label: "Одно действие было раньше другого", result: "past_earlier" },
      { id: "duration", label: "Нужна длительность до прошлого момента", result: "past_duration" },
      { id: "habit", label: "Скорее это привычка в прошлом", result: "past_habit" },
      { id: "map", label: "Не уверен, помоги быстро выбрать", result: "past_map" },
    ],
  },
  past_habit_stage: {
    q: "Это про что именно?",
    options: [
      { id: "habit_action", label: "Повторяющееся действие (играл, ходил)", result: "past_habit" },
      { id: "habit_state", label: "Состояние раньше (был/имел/знал)", result: "past_habit_state" },
      { id: "map", label: "Не уверен, помоги быстро выбрать", result: "past_map" },
    ],
  },
  future_stage: {
    q: "Про будущее: какой это тип мысли?",
    options: [
      { id: "decision_now", label: "Решение прямо сейчас / обещание", result: "future_decision" },
      { id: "intent_prediction", label: "План / прогноз / идея", next: "future_intent_stage" },
      { id: "time_clause", label: "После if/when/as soon as/unless", result: "future_time_clause" },
      { id: "advanced", label: "Процесс/завершение/длительность в будущем", next: "future_advanced_stage" },
      { id: "map", label: "Не уверен, помоги быстро выбрать", result: "future_map" },
    ],
  },
  future_intent_stage: {
    q: "Уточни, что именно ты имеешь в виду:",
    options: [
      { id: "plan", label: "Реальный план/намерение (я собираюсь)", next: "future_plan_confirm" },
      { id: "signs", label: "Прогноз по признакам (смотри тучи)", result: "future_signs" },
      { id: "arrangement", label: "Договоренность (встреча/билеты)", result: "future_arrangement" },
      { id: "timetable", label: "Расписание / график", result: "future_timetable" },
      { id: "soft_idea", label: "Мягкая идея: было бы неплохо...", result: "would_idea" },
      { id: "map", label: "Не уверен, помоги быстро выбрать", result: "future_map" },
    ],
  },
  future_plan_confirm: {
    q: "Проверка: это точно план, а не мягкая идея?",
    options: [
      { id: "yes_plan", label: "Да, это мой конкретный план (реально собираюсь)", result: "future_plan" },
      { id: "soft_idea", label: "Нет, это скорее \"было бы неплохо\"", result: "would_idea" },
      { id: "arrangement", label: "Скорее это уже договоренность (встреча/билеты)", result: "future_arrangement" },
      { id: "map", label: "Не уверен, помоги быстро выбрать", result: "future_map" },
    ],
  },
  future_advanced_stage: {
    q: "Что именно нужно в будущем?",
    options: [
      { id: "process", label: "Процесс в момент в будущем", result: "future_process" },
      { id: "finish", label: "Завершение к сроку", result: "future_finish" },
      { id: "duration", label: "Длительность к сроку", result: "future_duration" },
      { id: "map", label: "Не уверен, помоги быстро выбрать", result: "future_map" },
    ],
  },
  universal_stage: {
    q: "Если это не про время, то что нужно?",
    options: [
      { id: "condition", label: "Условие (if ...)", next: "universal_condition_stage" },
      { id: "modal", label: "Обязанность/совет/вероятность", next: "universal_modal_stage" },
      { id: "passive", label: "Важно действие, а не исполнитель", next: "universal_passive_stage" },
      { id: "report", label: "Передаю чужие слова", next: "universal_report_stage" },
      { id: "connect", label: "Связать/уточнить части фразы", next: "universal_connect_stage" },
      { id: "emphasis", label: "Нужен акцент в форме", next: "universal_emphasis_stage" },
      { id: "map", label: "Не уверен, помоги быстро выбрать", result: "universal_map" },
    ],
  },
  universal_condition_stage: {
    q: "Какой тип условия?",
    options: [
      { id: "real", label: "Реальное условие / правило", result: "cond_real" },
      { id: "unreal_or_regret", label: "Нереально или сожаление", next: "universal_condition_unreal_stage" },
      { id: "mixed", label: "Смешанное условие", result: "cond_mixed" },
    ],
  },
  universal_condition_unreal_stage: {
    q: "Что ближе?",
    options: [
      { id: "unreal_now", label: "Нереально сейчас/в будущем", result: "cond_unreal_now" },
      { id: "past_regret", label: "Сожаление о прошлом", result: "cond_past_regret" },
      { id: "mixed", label: "Сложно выбрать, дай смешанный вариант", result: "cond_mixed" },
    ],
  },
  universal_modal_stage: {
    q: "Что нужно передать?",
    options: [
      { id: "obligation", label: "Обязанность / совет / запрет", next: "universal_modal_obligation_stage" },
      { id: "deduction", label: "Вероятность / логический вывод", result: "modal_deduction" },
      { id: "soft_idea", label: "Мягкая идея: было бы неплохо...", result: "would_idea" },
      { id: "map", label: "Не уверен, помоги быстро выбрать", result: "universal_map" },
    ],
  },
  universal_modal_obligation_stage: {
    q: "Насколько сильная мысль?",
    options: [
      { id: "strict", label: "Строго: обязан / нельзя / надо", result: "modal_obligation" },
      { id: "advice", label: "Мягко: стоит / лучше", result: "modal_advice" },
      { id: "soft_idea", label: "Еще мягче: было бы неплохо", result: "would_idea" },
      { id: "map", label: "Не уверен, помоги быстро выбрать", result: "universal_map" },
    ],
  },
  universal_passive_stage: {
    q: "Что ты хочешь подчеркнуть?",
    options: [
      { id: "passive", label: "Само действие важно, исполнитель не важен", result: "passive" },
      { id: "causative", label: "Я организую, чтобы это сделали", result: "emphasis_causative" },
      { id: "map", label: "Не уверен, помоги быстро выбрать", result: "universal_map" },
    ],
  },
  universal_report_stage: {
    q: "Какой тип пересказа?",
    options: [
      { id: "report", label: "Передаю чьи-то слова/мысли", result: "report" },
      { id: "embedded_q", label: "Встраиваю косвенный вопрос (where he lives)", result: "connect_noun" },
      { id: "map", label: "Не уверен, помоги быстро выбрать", result: "universal_map" },
    ],
  },
  universal_connect_stage: {
    q: "Что ты хочешь связать?",
    options: [
      { id: "relative", label: "Уточнить существительное (who/which/that)", result: "connect_relative" },
      { id: "noun_clause", label: "Часть после know/think/wonder", result: "connect_noun" },
      { id: "articles", label: "Выбрать a/an/the", result: "connect_articles" },
      { id: "verb_pattern", label: "Выбрать -ing или to + do", result: "connect_verb_pattern" },
    ],
  },
  universal_emphasis_stage: {
    q: "Какой акцент тебе нужен?",
    options: [
      { id: "wish", label: "Сожаление / wish / if only", result: "emphasis_wish" },
      { id: "inversion", label: "Формальный акцент (inversion)", result: "emphasis_inversion" },
      { id: "cleft", label: "Выделить часть фразы (cleft)", result: "emphasis_cleft" },
      { id: "tag", label: "Короткое подтверждение в конце", result: "emphasis_tag" },
      { id: "causative", label: "Организовать действие другим человеком", result: "emphasis_causative" },
    ],
  },
};

export const CONSTRUCTOR_RESULTS = {
  global_map: { reason: "Начнем с быстрой навигации по грамматике: так проще сразу выбрать нужную форму.", picks: ["futureExpressionWays", "presentUsageMap", "pastUsageMap"] },

  present_habit: { reason: "Ты описываешь регулярность или факт в настоящем.", picks: ["presentSimple", "presentUsageMap", "presentContinuous"] },
  present_state: { reason: "Это состояние/желание/мнение, обычно нужна форма Present Simple (например: I want...).", picks: ["stativeVerbs", "presentSimple", "presentUsageMap"] },
  present_process: { reason: "Ты говоришь о процессе прямо сейчас.", picks: ["presentContinuous", "presentUsageMap", "presentSimple"] },
  present_result: { reason: "Тебе важен результат к текущему моменту.", picks: ["presentPerfect", "presentUsageMap", "presentPerfectContinuous"] },
  present_duration: { reason: "Тебе нужна длительность процесса до сейчас.", picks: ["presentPerfectContinuous", "presentUsageMap", "presentPerfect"] },
  present_map: { reason: "Нужна быстрая помощь, чтобы сразу выбрать форму в настоящем.", picks: ["presentUsageMap", "presentSimple", "presentContinuous"] },

  past_fact: { reason: "Ты описываешь завершенное событие/факт в прошлом.", picks: ["pastSimple", "pastUsageMap", "pastContinuous"] },
  past_process: { reason: "Важен процесс в конкретный момент прошлого.", picks: ["pastContinuous", "pastUsageMap", "pastSimple"] },
  past_earlier: { reason: "Нужно показать, что одно прошлое действие произошло раньше.", picks: ["pastPerfect", "pastUsageMap", "pastSimple"] },
  past_duration: { reason: "Ты подчеркиваешь длительность до прошлого момента.", picks: ["pastPerfectContinuous", "pastUsageMap", "pastPerfect"] },
  past_habit: { reason: "Ты говоришь о повторяющейся привычке в прошлом.", picks: ["pastWouldHabits", "pastSimple", "pastUsageMap"] },
  past_habit_state: { reason: "Это состояние в прошлом (был/имел/знал), в таких случаях чаще нужен used to, а не would.", picks: ["pastWouldHabits", "pastSimple", "pastUsageMap"] },
  past_map: { reason: "Нужна быстрая помощь, чтобы выбрать past-форму по смыслу.", picks: ["pastUsageMap", "pastSimple", "pastContinuous"] },

  future_decision: { reason: "Решение принимается прямо в момент речи.", picks: ["futureSimple", "futureExpressionWays", "futureGoingTo"] },
  future_plan: { reason: "Это реальный план/намерение (не мягкая оценка), поэтому обычно be going to.", picks: ["futureGoingTo", "futureExpressionWays", "modalsWouldIdeas"] },
  future_signs: { reason: "Прогноз основан на видимых признаках.", picks: ["futureGoingTo", "futureExpressionWays", "futureSimple"] },
  future_arrangement: { reason: "Есть конкретная договоренность (встреча, куплены билеты), поэтому обычно Present Continuous for Future.", picks: ["futurePresentContinuous", "futureExpressionWays", "futureGoingTo"] },
  future_timetable: { reason: "Это расписание или официальный график.", picks: ["futurePresentSimple", "futureExpressionWays", "futureSimple"] },
  future_time_clause: { reason: "После if/when/as soon as/unless в будущем контексте нужна специальная форма.", picks: ["futureTimeClauses", "futureExpressionWays", "futureSimple"] },
  future_process: { reason: "Нужен процесс в конкретный момент будущего.", picks: ["futureContinuous", "futureExpressionWays", "futureSimple"] },
  future_finish: { reason: "Нужно показать завершение к будущему сроку.", picks: ["futurePerfect", "futureExpressionWays", "futurePerfectContinuous"] },
  future_duration: { reason: "Нужна длительность до будущего момента.", picks: ["futurePerfectContinuous", "futurePerfect", "futureExpressionWays"] },
  future_map: { reason: "Нужна быстрая помощь, чтобы выбрать способ выражения будущего.", picks: ["futureExpressionWays", "futureSimple", "futureGoingTo"] },

  cond_real: { reason: "Ты описываешь реальное условие/закономерность.", picks: ["conditionalsZeroFirst", "futureTimeClauses", "universalUsageMap"] },
  cond_unreal_now: { reason: "Это нереальная ситуация в настоящем/будущем.", picks: ["conditionalsSecondThird", "mixedConditionals", "universalUsageMap"] },
  cond_past_regret: { reason: "Ты выражаешь сожаление о прошлом.", picks: ["conditionalsSecondThird", "wishIfOnly", "mixedConditionals"] },
  cond_mixed: { reason: "Ты смешиваешь временные планы в условии и результате.", picks: ["mixedConditionals", "conditionalsSecondThird", "universalUsageMap"] },

  modal_obligation: { reason: "Тебе нужно передать обязанность, совет или запрет.", picks: ["modalsObligationAdvice", "universalUsageMap", "modalsPossibilityDeduction"] },
  modal_advice: { reason: "Это мягкий совет (стоит/лучше), поэтому чаще нужны should / had better / would be better.", picks: ["modalsObligationAdvice", "modalsWouldIdeas", "universalUsageMap"] },
  modal_deduction: { reason: "Нужно выразить вероятность или логический вывод.", picks: ["modalsPossibilityDeduction", "universalUsageMap", "modalsObligationAdvice"] },
  would_idea: { reason: "Здесь мягкая идея/оценка (\"было бы неплохо\"), поэтому лучше шаблоны с would: It would be good/better to...", picks: ["modalsWouldIdeas", "futureExpressionWays", "modalsObligationAdvice"] },

  passive: { reason: "Фокус на действии/результате, а не на исполнителе.", picks: ["passiveVoiceBasics", "universalUsageMap", "causativeHaveGet"] },
  report: { reason: "Ты передаешь чужие слова в косвенной речи.", picks: ["reportedSpeechBasics", "nounClausesBasics", "universalUsageMap"] },
  universal_map: { reason: "Нужна быстрая помощь, чтобы выбрать структуру по смыслу (не только время).", picks: ["universalUsageMap", "conditionalsZeroFirst", "modalsObligationAdvice"] },

  connect_relative: { reason: "Нужно уточнить существительное через who/which/that/where.", picks: ["relativeClausesBasics", "nounClausesBasics", "universalUsageMap"] },
  connect_noun: { reason: "Нужна часть типа that/if/whether/wh-clause после think/know/wonder.", picks: ["nounClausesBasics", "reportedSpeechBasics", "relativeClausesBasics"] },
  connect_articles: { reason: "Проблема выбора a/an/the/zero article.", picks: ["articlesBasics", "presentUsageMap", "universalUsageMap"] },
  connect_verb_pattern: { reason: "Нужно выбрать между -ing и to + infinitive.", picks: ["gerundInfinitiveBasics", "wishIfOnly", "universalUsageMap"] },

  emphasis_wish: { reason: "Ты хочешь выразить сожаление или желание о другой реальности.", picks: ["wishIfOnly", "conditionalsSecondThird", "mixedConditionals"] },
  emphasis_inversion: { reason: "Нужен формальный/сильный акцент в порядке слов.", picks: ["inversionAdvanced", "cleftSentencesBasics", "questionTagsBasics"] },
  emphasis_cleft: { reason: "Нужно выделить важную часть высказывания.", picks: ["cleftSentencesBasics", "inversionAdvanced", "nounClausesBasics"] },
  emphasis_tag: { reason: "Нужно короткое подтверждение в конце фразы.", picks: ["questionTagsBasics", "modalsObligationAdvice", "presentSimple"] },
  emphasis_causative: { reason: "Ты описываешь действие, которое выполняет другой человек.", picks: ["causativeHaveGet", "passiveVoiceBasics", "universalUsageMap"] },
};
