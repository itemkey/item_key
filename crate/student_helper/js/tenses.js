(async function(){
  const TENSES_DIR = 'db/tenses/';

  function escapeHtml(s){
    return String(s || '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  async function fetchJson(path){
    const res = await fetch(path, { cache: 'no-cache' });
    if(!res.ok){
      throw new Error(`Fetch failed (${res.status}) for ${path}`);
    }
    return await res.json();
  }

  async function loadTensesDb(){
    const index = await fetchJson(TENSES_DIR + 'index.json');
    if(!Array.isArray(index)) throw new Error('tenses index.json must be an array');

    const byId = {};
    // load all theory tenses
    for(const meta of index){
      const file = meta && meta.file ? meta.file : `${meta.id}.json`;
      const obj = await fetchJson(TENSES_DIR + file);
      if(obj && obj.id) byId[obj.id] = obj;
    }

    // load mixed (practice only)
    try{
      const mixed = await fetchJson(TENSES_DIR + 'mixed.json');
      if(mixed && mixed.id) byId[mixed.id] = mixed;
    } catch(_){}

    // load mixed present (practice only)
    try{
      const mixedP = await fetchJson(TENSES_DIR + 'mixedPresent.json');
      if(mixedP && mixedP.id) byId[mixedP.id] = mixedP;
    } catch(_){}

    return { INDEX: index, byId };
  }

  let REG = null;
  try{
    REG = await loadTensesDb();
    window.StudentHelperTenses = REG;
  }catch(e){
    const statusEl = document.getElementById('tensesStatus');
    if(statusEl) statusEl.textContent = 'db error';
    // also print to console for debug
    console.error('[tenses] db load error:', e);
    return;
  }

  main(REG);

  function main(REG){
  const countBadge = document.getElementById('tensesCountBadge');
  const statusEl = document.getElementById('tensesStatus');

  const homeView = document.getElementById('tensesHomeView');
  const constructorView = document.getElementById('tensesConstructorView');
  const listView = document.getElementById('tensesListView');
  const detailView = document.getElementById('tensesDetailView');
  const practiceView = document.getElementById('tensesPracticeView');

  const compareView = document.getElementById('tensesCompareView');
  const dailyView = document.getElementById('tensesDailyView');

  const btnGoCompare = document.getElementById('tensesGoCompare');
  const btnGoDaily = document.getElementById('tensesGoDaily');
  const btnGoMixed = document.getElementById('tensesGoMixed');
  const btnGoBasics = document.getElementById('tensesGoBasics');
  const btnGoActiveTenses = document.getElementById('grammarGoActiveTenses');
  const btnGoUniversal = document.getElementById('grammarGoUniversal');

  const searchInput = document.getElementById('grammarSearchInput');
  const searchClearBtn = document.getElementById('grammarSearchClearBtn');
  const searchHint = document.getElementById('grammarSearchHint');
  const searchResults = document.getElementById('grammarSearchResults');
  const btnOpenConstructor = document.getElementById('grammarOpenConstructorBtn');
  const grammarHomeTabs = document.getElementById('grammarHomeTabs');
  const grammarHomeTabHint = document.getElementById('grammarHomeTabHint');
  const grammarHomeTileGrid = document.getElementById('grammarHomeTileGrid');

  const levelBox = document.getElementById('grammarLevelBox');
  const levelValue = document.getElementById('grammarLevelValue');
  const levelPrompt = document.getElementById('grammarLevelPrompt');
  const levelChangeBtn = document.getElementById('grammarLevelChangeBtn');
  const levelButtons = Array.from(document.querySelectorAll('[data-grammar-level]'));

  const btnBackHomeFromCompare = document.getElementById('tensesBackToHomeFromCompare');
  const btnBackHomeFromDaily = document.getElementById('tensesBackToHomeFromDaily');
  const btnBackHomeFromConstructor = document.getElementById('tensesBackToHomeFromConstructor');

  const cmpASelect = document.getElementById('tensesCompareA');
  const cmpBSelect = document.getElementById('tensesCompareB');
  const btnCompare = document.getElementById('tensesCompareBtn');
  const cmpRule = document.getElementById('tensesCompareRule');
  const cmpTable = document.getElementById('tensesCompareTable');
  const btnCmpMini10 = document.getElementById('tensesCompareStartMiniBtn');
  const btnCmpMini5 = document.getElementById('tensesCompareStartMini5Btn');
  const cmpRunBody = document.getElementById('tensesCompareRunBody');

  const btnDailyStart = document.getElementById('tensesDailyStartBtn');
  const btnDailyNew = document.getElementById('tensesDailyNewBtn');
  const dailyRunBody = document.getElementById('tensesDailyRunBody');

  const btnClearMistakes = document.getElementById('tensesClearMistakesBtn');
  const btnResetProgress = document.getElementById('tensesResetProgressBtn');

  const btnGoTheory = document.getElementById('tensesGoTheory');
  const btnGoPractice = document.getElementById('tensesGoPractice');

  const btnBackHomeFromList = document.getElementById('tensesBackToHomeFromList');
  const listEl = document.getElementById('tensesList');
  const listSubtitleEl = document.getElementById('tensesListSubtitle');
  const compactListToggle = document.getElementById('grammarCompactListToggle');
  const subgroupWrap = document.getElementById('grammarSubgroupWrap');
  const subgroupBar = document.getElementById('grammarSubgroupBar');

  const btnBackToList = document.getElementById('tensesBackToList');
  const btnBackToRunFromDetail = document.getElementById('tensesBackToRunFromDetail');
  const btnGoPracticeFromDetail = document.getElementById('tensesGoPracticeFromDetail');
  const btnGoPracticeBottom = document.getElementById('tensesGoPracticeBottom');

  const tenseTitleEl = document.getElementById('tenseTitle');
  const tenseSubtitleEl = document.getElementById('tenseSubtitle');
  const tenseMasteryBadge = document.getElementById('tenseMasteryBadge');
  const ruleModeShortBtn = document.getElementById('tenseRuleModeShortBtn');
  const ruleModeFullBtn = document.getElementById('tenseRuleModeFullBtn');
  const ruleBody = document.getElementById('tenseRuleBody');

  const btnBackHomeFromPractice = document.getElementById('tensesBackToHomeFromPractice');
  const goalSelect = document.getElementById('tensesGoalSelect');
  const tenseSelect = document.getElementById('tensesTenseSelect');
  const modeMixedBtn = document.getElementById('tensesModeMixedBtn');
  const modeCustomBtn = document.getElementById('tensesModeCustomBtn');
  const modeHintEl = document.getElementById('tensesPracticeModeHint');
  const btnStart = document.getElementById('tensesStartBtn');
  const btnRetry = document.getElementById('tensesRetryMistakesBtn');
  const cbShowAfter = document.getElementById('tensesShowAfterEach');
  const practiceBody = document.getElementById('tensesPracticeBody');
  const practiceMeta = document.getElementById('tensesPracticeMeta');
  const customPicker = document.getElementById('tensesCustomPicker');
  const customGrid = document.getElementById('tensesCustomGrid');
  const customHint = document.getElementById('tensesCustomHint');
  const customSearchInput = document.getElementById('tensesCustomSearchInput');
  const customSearchClearBtn = document.getElementById('tensesCustomSearchClearBtn');
  const customSearchEmpty = document.getElementById('tensesCustomSearchEmpty');
  const btnCustomSelectAll = document.getElementById('tensesCustomSelectAllBtn');
  const btnCustomClearAll = document.getElementById('tensesCustomClearAllBtn');

  const builderBody = document.getElementById('grammarBuilderBody');
  const builderStepBadge = document.getElementById('grammarBuilderStepBadge');
  const builderSubtitle = document.getElementById('grammarBuilderSubtitle');
  const builderPhraseInput = document.getElementById('grammarBuilderPhraseInput');

  if (!homeView || !listView || !detailView || !practiceView) return;
  if (!btnGoTheory || !btnGoPractice || !listEl) return;

  let currentId = null;
  let runKeyHandler = null;
  let runReturnState = null;
  let customSearchQuery = '';
  let detailBackStack = [];
  let overviewFloatingSyncBound = false;

  function setRunReturnState(state){
    runReturnState = state || null;
    if (btnBackToRunFromDetail){
      btnBackToRunFromDetail.hidden = !runReturnState;
      btnBackToRunFromDetail.title = runReturnState
        ? 'Вернуться к упражнению на текущем вопросе'
        : '';
    }
  }

  const KEY_UI = 'sh_tenses_ui_v1';
  const KEY_GRAMMAR_HOME_TAB = 'sh_grammar_home_tab_v1';
  const KEY_LEVEL = 'sh_grammar_level_v1';
  const KEY_CATEGORY = 'sh_grammar_category_v1';
  const KEY_SUBGROUP = 'sh_grammar_subgroup_v1';
  const KEY_LIST_COMPACT = 'sh_grammar_list_compact_v1';
  const KEY_RULE_MODE = 'sh_grammar_rule_mode_v1';
  const BASIC_OVERVIEW_ID = 'tensesBasicOverview';
  const CUSTOM_TENSE_ID = 'custom';
  const LEVELS = ['A2-B1', 'B1-B2', 'B2-C1'];
  const CATEGORY_LABEL = {
    all: 'все темы по уровню',
    active_tenses: 'active tenses - времена',
    present: 'present - настоящее',
    past: 'past - прошлое',
    future: 'future - будущее',
    universal: 'universal - общие структуры'
  };

  const SUBGROUP_LABEL = {
    all: 'все подкатегории',
    simple: 'simple / факт',
    continuous: 'continuous / процесс',
    perfect: 'perfect / результат',
    perfect_continuous: 'perfect continuous / длительность',
    future_forms: 'future forms / способы',
    usage_map: 'быстрый выбор грамматики',
    conditionals: 'conditionals',
    modals: 'modals',
    voice: 'passive voice',
    clauses: 'clauses',
    verb_patterns: 'verb patterns',
    articles: 'articles',
    syntax: 'syntax'
  };

  const SUBGROUP_ORDER = [
    'usage_map',
    'future_forms',
    'simple',
    'continuous',
    'perfect',
    'perfect_continuous',
    'conditionals',
    'modals',
    'voice',
    'clauses',
    'verb_patterns',
    'articles',
    'syntax'
  ];

  const HOME_TAB_HINT = {
    rules: 'раздел «правила»: только теория и темы по грамматике',
    practice: 'раздел «упражнения»: смешанные, пользовательские, сравнение и daily',
    all: 'раздел «всё»: показать все карточки'
  };

  let activeCategory = loadCategory();
  let activeSubgroup = loadSubgroup();
  let ruleMode = loadRuleMode();
  let grammarHomeTab = loadGrammarHomeTab();
  if (activeCategory === 'all') activeSubgroup = 'all';

  const GOALS = [
    { id:'all', title:'общее (all goals)' },
    { id:'meaning', title:'когда используем (meaning)' },
    { id:'formula', title:'формула (formula)' },
    { id:'story_cloze', title:'контекст (dropdown story)' },
    { id:'markers', title:'маркеры (markers)' },
    { id:'mistakes', title:'ошибки (mistakes)' },
    { id:'compare', title:'сравнение (compare)' },
  ];

  const PRACTICE_MODE_HINT = {
    mixed: 'смешанные упражнения: автоматический микс тем по твоему уровню',
    custom: 'пользовательские упражнения: сам выбираешь правила и времена в удобных группах'
  };

  const CONSTRUCTOR_NODES = {
    root: {
      q: 'К какому промежутку времени относится твое предложение?',
      hint: 'Если не уверен, выбери "не про время / не уверен".',
      options: [
        { id: 'present', label: 'Настоящее', next: 'present_stage' },
        { id: 'past', label: 'Прошлое', next: 'past_stage' },
        { id: 'future', label: 'Будущее', next: 'future_stage' },
        { id: 'universal', label: 'Не про время, а про структуру', next: 'universal_stage' },
        { id: 'unknown', label: 'Не уверен', result: 'global_map' }
      ]
    },
    present_stage: {
      q: 'В настоящем что тебе нужно?',
      options: [
        { id: 'habit', label: 'Обычно / регулярно / факт', next: 'present_habit_stage' },
        { id: 'now_type', label: 'Прямо сейчас', next: 'present_now_stage' },
        { id: 'link_now', label: 'Связь с текущим моментом', next: 'present_link_stage' },
        { id: 'map', label: 'Не уверен, помоги быстро выбрать', result: 'present_map' }
      ]
    },
    present_habit_stage: {
      q: 'Уточни про настоящее:',
      options: [
        { id: 'habit_fact', label: 'Это факт или рутина (обычно/каждый день)', result: 'present_habit' },
        { id: 'state', label: 'Это состояние/желание/мнение (know/like/want)', result: 'present_state' },
        { id: 'map', label: 'Не уверен, помоги быстро выбрать', result: 'present_map' }
      ]
    },
    present_now_stage: {
      q: 'Прямо сейчас это что?',
      options: [
        { id: 'action', label: 'Действие в процессе (делаю/иду/пишу)', result: 'present_process' },
        { id: 'state', label: 'Состояние/желание/мнение (want/know/like)', result: 'present_state' },
        { id: 'map', label: 'Не уверен, помоги быстро выбрать', result: 'present_map' }
      ]
    },
    present_link_stage: {
      q: 'Связь с сейчас: что важнее?',
      options: [
        { id: 'result', label: 'Результат к текущему моменту', result: 'present_result' },
        { id: 'duration', label: 'Как долго длится до сейчас', result: 'present_duration' },
        { id: 'map', label: 'Не уверен, помоги быстро выбрать', result: 'present_map' }
      ]
    },
    past_stage: {
      q: 'В прошлом что тебе нужно?',
      options: [
        { id: 'fact', label: 'Завершенный факт/событие', next: 'past_fact_stage' },
        { id: 'process', label: 'Процесс в момент в прошлом', result: 'past_process' },
        { id: 'habit', label: 'Повторялось раньше / раньше было так', next: 'past_habit_stage' },
        { id: 'map', label: 'Не уверен, помоги быстро выбрать', result: 'past_map' }
      ]
    },
    past_fact_stage: {
      q: 'Про прошлое событие: что важно?',
      options: [
        { id: 'single', label: 'Просто факт в прошлом', result: 'past_fact' },
        { id: 'earlier', label: 'Одно действие было раньше другого', result: 'past_earlier' },
        { id: 'duration', label: 'Нужна длительность до прошлого момента', result: 'past_duration' },
        { id: 'habit', label: 'Скорее это привычка в прошлом', result: 'past_habit' },
        { id: 'map', label: 'Не уверен, помоги быстро выбрать', result: 'past_map' }
      ]
    },
    past_habit_stage: {
      q: 'Это про что именно?',
      options: [
        { id: 'habit_action', label: 'Повторяющееся действие (играл, ходил)', result: 'past_habit' },
        { id: 'habit_state', label: 'Состояние раньше (был/имел/знал)', result: 'past_habit_state' },
        { id: 'map', label: 'Не уверен, помоги быстро выбрать', result: 'past_map' }
      ]
    },
    future_stage: {
      q: 'Про будущее: какой это тип мысли?',
      options: [
        { id: 'decision_now', label: 'Решение прямо сейчас / обещание', result: 'future_decision' },
        { id: 'intent_prediction', label: 'План / прогноз / идея', next: 'future_intent_stage' },
        { id: 'time_clause', label: 'После if/when/as soon as/unless', result: 'future_time_clause' },
        { id: 'advanced', label: 'Процесс/завершение/длительность в будущем', next: 'future_advanced_stage' },
        { id: 'map', label: 'Не уверен, помоги быстро выбрать', result: 'future_map' }
      ]
    },
    future_intent_stage: {
      q: 'Уточни, что именно ты имеешь в виду:',
      options: [
        { id: 'plan', label: 'Реальный план/намерение (я собираюсь)', next: 'future_plan_confirm' },
        { id: 'signs', label: 'Прогноз по признакам (смотри тучи)', result: 'future_signs' },
        { id: 'arrangement', label: 'Договоренность (встреча/билеты)', result: 'future_arrangement' },
        { id: 'timetable', label: 'Расписание / график', result: 'future_timetable' },
        { id: 'soft_idea', label: 'Мягкая идея: было бы неплохо...', result: 'would_idea' },
        { id: 'map', label: 'Не уверен, помоги быстро выбрать', result: 'future_map' }
      ]
    },
    future_plan_confirm: {
      q: 'Проверка: это точно план, а не мягкая идея?',
      options: [
        { id: 'yes_plan', label: 'Да, это мой конкретный план (реально собираюсь)', result: 'future_plan' },
        { id: 'soft_idea', label: 'Нет, это скорее "было бы неплохо"', result: 'would_idea' },
        { id: 'arrangement', label: 'Скорее это уже договоренность (встреча/билеты)', result: 'future_arrangement' },
        { id: 'map', label: 'Не уверен, помоги быстро выбрать', result: 'future_map' }
      ]
    },
    future_advanced_stage: {
      q: 'Что именно нужно в будущем?',
      options: [
        { id: 'process', label: 'Процесс в момент в будущем', result: 'future_process' },
        { id: 'finish', label: 'Завершение к сроку', result: 'future_finish' },
        { id: 'duration', label: 'Длительность к сроку', result: 'future_duration' },
        { id: 'map', label: 'Не уверен, помоги быстро выбрать', result: 'future_map' }
      ]
    },
    universal_stage: {
      q: 'Если это не про время, то что нужно?',
      options: [
        { id: 'condition', label: 'Условие (if ...)', next: 'universal_condition_stage' },
        { id: 'modal', label: 'Обязанность/совет/вероятность', next: 'universal_modal_stage' },
        { id: 'passive', label: 'Важно действие, а не исполнитель', next: 'universal_passive_stage' },
        { id: 'report', label: 'Передаю чужие слова', next: 'universal_report_stage' },
        { id: 'connect', label: 'Связать/уточнить части фразы', next: 'universal_connect_stage' },
        { id: 'emphasis', label: 'Нужен акцент в форме', next: 'universal_emphasis_stage' },
        { id: 'map', label: 'Не уверен, помоги быстро выбрать', result: 'universal_map' }
      ]
    },
    universal_condition_stage: {
      q: 'Какой тип условия?',
      options: [
        { id: 'real', label: 'Реальное условие / правило', result: 'cond_real' },
        { id: 'unreal_or_regret', label: 'Нереально или сожаление', next: 'universal_condition_unreal_stage' },
        { id: 'mixed', label: 'Смешанное условие', result: 'cond_mixed' }
      ]
    },
    universal_condition_unreal_stage: {
      q: 'Что ближе?',
      options: [
        { id: 'unreal_now', label: 'Нереально сейчас/в будущем', result: 'cond_unreal_now' },
        { id: 'past_regret', label: 'Сожаление о прошлом', result: 'cond_past_regret' },
        { id: 'mixed', label: 'Сложно выбрать, дай смешанный вариант', result: 'cond_mixed' }
      ]
    },
    universal_modal_stage: {
      q: 'Что нужно передать?',
      options: [
        { id: 'obligation', label: 'Обязанность / совет / запрет', next: 'universal_modal_obligation_stage' },
        { id: 'deduction', label: 'Вероятность / логический вывод', result: 'modal_deduction' },
        { id: 'soft_idea', label: 'Мягкая идея: было бы неплохо...', result: 'would_idea' },
        { id: 'map', label: 'Не уверен, помоги быстро выбрать', result: 'universal_map' }
      ]
    },
    universal_modal_obligation_stage: {
      q: 'Насколько сильная мысль?',
      options: [
        { id: 'strict', label: 'Строго: обязан / нельзя / надо', result: 'modal_obligation' },
        { id: 'advice', label: 'Мягко: стоит / лучше', result: 'modal_advice' },
        { id: 'soft_idea', label: 'Еще мягче: было бы неплохо', result: 'would_idea' },
        { id: 'map', label: 'Не уверен, помоги быстро выбрать', result: 'universal_map' }
      ]
    },
    universal_passive_stage: {
      q: 'Что ты хочешь подчеркнуть?',
      options: [
        { id: 'passive', label: 'Само действие важно, исполнитель не важен', result: 'passive' },
        { id: 'causative', label: 'Я организую, чтобы это сделали', result: 'emphasis_causative' },
        { id: 'map', label: 'Не уверен, помоги быстро выбрать', result: 'universal_map' }
      ]
    },
    universal_report_stage: {
      q: 'Какой тип пересказа?',
      options: [
        { id: 'report', label: 'Передаю чьи-то слова/мысли', result: 'report' },
        { id: 'embedded_q', label: 'Встраиваю косвенный вопрос (where he lives)', result: 'connect_noun' },
        { id: 'map', label: 'Не уверен, помоги быстро выбрать', result: 'universal_map' }
      ]
    },
    universal_connect_stage: {
      q: 'Что ты хочешь связать?',
      options: [
        { id: 'relative', label: 'Уточнить существительное (who/which/that)', result: 'connect_relative' },
        { id: 'noun_clause', label: 'Часть после know/think/wonder', result: 'connect_noun' },
        { id: 'articles', label: 'Выбрать a/an/the', result: 'connect_articles' },
        { id: 'verb_pattern', label: 'Выбрать -ing или to + do', result: 'connect_verb_pattern' }
      ]
    },
    universal_emphasis_stage: {
      q: 'Какой акцент тебе нужен?',
      options: [
        { id: 'wish', label: 'Сожаление / wish / if only', result: 'emphasis_wish' },
        { id: 'inversion', label: 'Формальный акцент (inversion)', result: 'emphasis_inversion' },
        { id: 'cleft', label: 'Выделить часть фразы (cleft)', result: 'emphasis_cleft' },
        { id: 'tag', label: 'Короткое подтверждение в конце', result: 'emphasis_tag' },
        { id: 'causative', label: 'Организовать действие другим человеком', result: 'emphasis_causative' }
      ]
    }
  };

  const CONSTRUCTOR_RESULTS = {
    global_map: { reason: 'Начнем с быстрой навигации по грамматике: так проще сразу выбрать нужную форму.', picks: ['futureExpressionWays', 'presentUsageMap', 'pastUsageMap'] },

    present_habit: { reason: 'Ты описываешь регулярность или факт в настоящем.', picks: ['presentSimple', 'presentUsageMap', 'presentContinuous'] },
    present_state: { reason: 'Это состояние/желание/мнение, обычно нужна форма Present Simple (например: I want...).', picks: ['presentSimple', 'presentUsageMap', 'presentContinuous'] },
    present_process: { reason: 'Ты говоришь о процессе прямо сейчас.', picks: ['presentContinuous', 'presentUsageMap', 'presentSimple'] },
    present_result: { reason: 'Тебе важен результат к текущему моменту.', picks: ['presentPerfect', 'presentUsageMap', 'presentPerfectContinuous'] },
    present_duration: { reason: 'Тебе нужна длительность процесса до сейчас.', picks: ['presentPerfectContinuous', 'presentUsageMap', 'presentPerfect'] },
    present_map: { reason: 'Нужна быстрая помощь, чтобы сразу выбрать форму в настоящем.', picks: ['presentUsageMap', 'presentSimple', 'presentContinuous'] },

    past_fact: { reason: 'Ты описываешь завершенное событие/факт в прошлом.', picks: ['pastSimple', 'pastUsageMap', 'pastContinuous'] },
    past_process: { reason: 'Важен процесс в конкретный момент прошлого.', picks: ['pastContinuous', 'pastUsageMap', 'pastSimple'] },
    past_earlier: { reason: 'Нужно показать, что одно прошлое действие произошло раньше.', picks: ['pastPerfect', 'pastUsageMap', 'pastSimple'] },
    past_duration: { reason: 'Ты подчеркиваешь длительность до прошлого момента.', picks: ['pastPerfectContinuous', 'pastUsageMap', 'pastPerfect'] },
    past_habit: { reason: 'Ты говоришь о повторяющейся привычке в прошлом.', picks: ['pastWouldHabits', 'pastSimple', 'pastUsageMap'] },
    past_habit_state: { reason: 'Это состояние в прошлом (был/имел/знал), в таких случаях чаще нужен used to, а не would.', picks: ['pastWouldHabits', 'pastSimple', 'pastUsageMap'] },
    past_map: { reason: 'Нужна быстрая помощь, чтобы выбрать past-форму по смыслу.', picks: ['pastUsageMap', 'pastSimple', 'pastContinuous'] },

    future_decision: { reason: 'Решение принимается прямо в момент речи.', picks: ['futureSimple', 'futureExpressionWays', 'futureGoingTo'] },
    future_plan: { reason: 'Это реальный план/намерение (не мягкая оценка), поэтому обычно be going to.', picks: ['futureGoingTo', 'futureExpressionWays', 'modalsWouldIdeas'] },
    future_signs: { reason: 'Прогноз основан на видимых признаках.', picks: ['futureGoingTo', 'futureExpressionWays', 'futureSimple'] },
    future_arrangement: { reason: 'Есть конкретная договоренность (встреча, куплены билеты), поэтому обычно Present Continuous for Future.', picks: ['futurePresentContinuous', 'futureExpressionWays', 'futureGoingTo'] },
    future_timetable: { reason: 'Это расписание или официальный график.', picks: ['futurePresentSimple', 'futureExpressionWays', 'futureSimple'] },
    future_time_clause: { reason: 'После if/when/as soon as/unless в будущем контексте нужна специальная форма.', picks: ['futureTimeClauses', 'futureExpressionWays', 'futureSimple'] },
    future_process: { reason: 'Нужен процесс в конкретный момент будущего.', picks: ['futureContinuous', 'futureExpressionWays', 'futureSimple'] },
    future_finish: { reason: 'Нужно показать завершение к будущему сроку.', picks: ['futurePerfect', 'futureExpressionWays', 'futurePerfectContinuous'] },
    future_duration: { reason: 'Нужна длительность до будущего момента.', picks: ['futurePerfectContinuous', 'futurePerfect', 'futureExpressionWays'] },
    future_map: { reason: 'Нужна быстрая помощь, чтобы выбрать способ выражения будущего.', picks: ['futureExpressionWays', 'futureSimple', 'futureGoingTo'] },

    cond_real: { reason: 'Ты описываешь реальное условие/закономерность.', picks: ['conditionalsZeroFirst', 'futureTimeClauses', 'universalUsageMap'] },
    cond_unreal_now: { reason: 'Это нереальная ситуация в настоящем/будущем.', picks: ['conditionalsSecondThird', 'mixedConditionals', 'universalUsageMap'] },
    cond_past_regret: { reason: 'Ты выражаешь сожаление о прошлом.', picks: ['conditionalsSecondThird', 'wishIfOnly', 'mixedConditionals'] },
    cond_mixed: { reason: 'Ты смешиваешь временные планы в условии и результате.', picks: ['mixedConditionals', 'conditionalsSecondThird', 'universalUsageMap'] },

    modal_obligation: { reason: 'Тебе нужно передать обязанность, совет или запрет.', picks: ['modalsObligationAdvice', 'universalUsageMap', 'modalsPossibilityDeduction'] },
    modal_advice: { reason: 'Это мягкий совет (стоит/лучше), поэтому чаще нужны should / had better / would be better.', picks: ['modalsObligationAdvice', 'modalsWouldIdeas', 'universalUsageMap'] },
    modal_deduction: { reason: 'Нужно выразить вероятность или логический вывод.', picks: ['modalsPossibilityDeduction', 'universalUsageMap', 'modalsObligationAdvice'] },
    would_idea: { reason: 'Здесь мягкая идея/оценка ("было бы неплохо"), поэтому лучше шаблоны с would: It would be good/better to...', picks: ['modalsWouldIdeas', 'futureExpressionWays', 'modalsObligationAdvice'] },

    passive: { reason: 'Фокус на действии/результате, а не на исполнителе.', picks: ['passiveVoiceBasics', 'universalUsageMap', 'causativeHaveGet'] },
    report: { reason: 'Ты передаешь чужие слова в косвенной речи.', picks: ['reportedSpeechBasics', 'nounClausesBasics', 'universalUsageMap'] },
    universal_map: { reason: 'Нужна быстрая помощь, чтобы выбрать структуру по смыслу (не только время).', picks: ['universalUsageMap', 'conditionalsZeroFirst', 'modalsObligationAdvice'] },

    connect_relative: { reason: 'Нужно уточнить существительное через who/which/that/where.', picks: ['relativeClausesBasics', 'nounClausesBasics', 'universalUsageMap'] },
    connect_noun: { reason: 'Нужна часть типа that/if/whether/wh-clause после think/know/wonder.', picks: ['nounClausesBasics', 'reportedSpeechBasics', 'relativeClausesBasics'] },
    connect_articles: { reason: 'Проблема выбора a/an/the/zero article.', picks: ['articlesBasics', 'presentUsageMap', 'universalUsageMap'] },
    connect_verb_pattern: { reason: 'Нужно выбрать между -ing и to + infinitive.', picks: ['gerundInfinitiveBasics', 'wishIfOnly', 'universalUsageMap'] },

    emphasis_wish: { reason: 'Ты хочешь выразить сожаление или желание о другой реальности.', picks: ['wishIfOnly', 'conditionalsSecondThird', 'mixedConditionals'] },
    emphasis_inversion: { reason: 'Нужен формальный/сильный акцент в порядке слов.', picks: ['inversionAdvanced', 'cleftSentencesBasics', 'questionTagsBasics'] },
    emphasis_cleft: { reason: 'Нужно выделить важную часть высказывания.', picks: ['cleftSentencesBasics', 'inversionAdvanced', 'nounClausesBasics'] },
    emphasis_tag: { reason: 'Нужно короткое подтверждение в конце фразы.', picks: ['questionTagsBasics', 'modalsObligationAdvice', 'presentSimple'] },
    emphasis_causative: { reason: 'Ты описываешь действие, которое выполняет другой человек.', picks: ['causativeHaveGet', 'passiveVoiceBasics', 'universalUsageMap'] }
  };

  let builderPath = [];
  let builderNode = 'root';
  let builderLastRec = null;

  // -------------------------
  // Storage (localStorage)
  // -------------------------
  function keyProgress(id){ return `sh_tenses_progress_${id}`; }

  function loadProgress(id){
    try{
      const raw = localStorage.getItem(keyProgress(id));
      if (!raw) return { mastery: 0, best: {}, mistakes: [] };
      const obj = JSON.parse(raw);
      return Object.assign({ mastery: 0, best: {}, mistakes: [] }, obj || {});
    } catch {
      return { mastery: 0, best: {}, mistakes: [] };
    }
  }

  function saveProgress(id, p){
    localStorage.setItem(keyProgress(id), JSON.stringify(p));
  }

  function masteryLabel(m){
    if (m >= 4) return 'Mastered';
    if (m >= 2) return 'Learning';
    return 'New';
  }

  function setStatus(text){
    if (!statusEl) return;
    statusEl.textContent = text;
    if (text !== 'ready'){
      setTimeout(()=>{ if (statusEl.textContent === text) statusEl.textContent = 'ready'; }, 650);
    }
  }

  function setVisible(el, visible){
    if (!el) return;
    el.hidden = !visible;
  }

  function showOnly(viewName){
    setVisible(homeView, viewName === 'home');
    setVisible(constructorView, viewName === 'constructor');
    setVisible(listView, viewName === 'list');
    setVisible(detailView, viewName === 'detail');
    setVisible(practiceView, viewName === 'practice');
    setVisible(compareView, viewName === 'compare');
    setVisible(dailyView, viewName === 'daily');
    syncFarmHubForTensesView(viewName);
    if (viewName !== 'detail'){
      const nav = document.getElementById('tensesOverviewFloatingNav');
      if (nav) nav.hidden = true;
      if (detailView){
        detailView.classList.remove('has-overview-floating-nav');
      }
    }
    if (viewName === 'home') applyGrammarHomeTab();
    if (viewName !== 'home' && searchResults) searchResults.hidden = true;
    window.scrollTo(0, 0);
  }

  function syncFarmHubForTensesView(viewName){
    const coach = window.IKFarmCoach;
    if (!coach || typeof coach.update !== 'function') return;

    if (viewName === 'practice'){
      coach.update({
        active: true,
        owner: 'tenses_practice',
        title: isEnLang() ? 'Farm HUB · Practice' : 'Farm HUB · Практика',
        line: isEnLang() ? 'Practice mode is active.' : 'Режим упражнений активен.',
        sub: isEnLang() ? 'Pick goal, start run, keep momentum.' : 'Выбери цель, запускай раунд и держи темп.',
        chips: isEnLang() ? ['practice', 'focus', 'progress'] : ['упражнения', 'фокус', 'прогресс'],
        progress: 0,
        hideLabel: isEnLang() ? 'hide' : 'скрыть',
        stripLabel: 'Farm HUB ▾'
      });
      return;
    }

    if (typeof coach.hide === 'function') coach.hide();
    else coach.update({ active: false });
  }

  function normalizeHeadingKey(text){
    return String(text || '')
      .toLowerCase()
      .replace(/^\d+\.\s*/,'')
      .replace(/[^a-zа-яё0-9]+/gi,'-')
      .replace(/^-+|-+$/g,'');
  }

  function scrollRuleHeadingTo(key){
    if (!ruleBody) return;
    const k = String(key || '').trim();
    if (!k) return;
    const target = ruleBody.querySelector(`[data-basic-heading-key="${k}"]`);
    if (!target) return;
    const nav = document.getElementById('tensesOverviewFloatingNav');
    const navShift = (nav && !nav.hidden) ? (nav.getBoundingClientRect().bottom + 10) : 88;
    const top = target.getBoundingClientRect().top + window.scrollY - navShift;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }

  function getOverviewFloatingNav(){
    let el = document.getElementById('tensesOverviewFloatingNav');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'tensesOverviewFloatingNav';
    el.className = 'sh-overview-floating-nav';
    el.hidden = true;
    document.body.appendChild(el);
    return el;
  }

  function syncOverviewFloatingNavPosition(){
    const box = document.getElementById('tensesOverviewFloatingNav');
    if (!box || box.hidden) return;

    const siteNav = document.getElementById('ikSiteNav') || document.querySelector('.ik-site-nav');

    const navRect = siteNav ? siteNav.getBoundingClientRect() : { bottom: 0 };
    const laneRect = siteNav ? siteNav.getBoundingClientRect() : { left: 0, right: window.innerWidth };

    const top = Math.max(0, Math.round(navRect.bottom + 2));
    const left = Math.max(0, Math.round(laneRect.left));
    const right = Math.max(0, Math.round(window.innerWidth - laneRect.right));

    box.style.top = `${top}px`;
    box.style.left = `${left}px`;
    box.style.right = `${right}px`;

  }

  function bindOverviewFloatingNavSync(){
    if (overviewFloatingSyncBound) return;
    overviewFloatingSyncBound = true;
    const run = ()=> syncOverviewFloatingNavPosition();
    window.addEventListener('scroll', run, { passive: true });
    window.addEventListener('resize', run);
  }

  function renderBasicOverviewQuickNav(){
    if (!ruleBody || !detailView) return;
    const box = getOverviewFloatingNav();
    box.innerHTML = '';

    const shouldShow = currentId === BASIC_OVERVIEW_ID && !detailView.hidden;
    if (!shouldShow){
      box.hidden = true;
      detailView.classList.remove('has-overview-floating-nav');
      return;
    }

    const links = [
      { label: 'Present Simple', key: normalizeHeadingKey('Present Simple') },
      { label: 'Present Continuous', key: normalizeHeadingKey('Present Continuous') },
      { label: 'Present Perfect', key: normalizeHeadingKey('Present Perfect') },
      { label: 'Present Perfect Continuous', key: normalizeHeadingKey('Present Perfect Continuous') },
      { label: 'Past Simple', key: normalizeHeadingKey('Past Simple') },
      { label: 'Past Continuous', key: normalizeHeadingKey('Past Continuous') },
      { label: 'Past Perfect', key: normalizeHeadingKey('Past Perfect') },
      { label: 'Future Simple', key: normalizeHeadingKey('Future Simple') },
      { label: 'First Conditional', key: normalizeHeadingKey('First Conditional') }
    ];

    const available = links.filter((x)=> ruleBody.querySelector(`[data-basic-heading-key="${x.key}"]`));
    if (!available.length) return;

    const title = document.createElement('p');
    title.className = 'sh-overview-floating-nav__title';
    title.textContent = isEnLang() ? 'Quick navigation' : 'Быстрая навигация';
    box.appendChild(title);

    const bar = document.createElement('div');
    bar.className = 'sh-overview-floating-nav__bar';
    available.forEach((x)=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ik-btn sh-overview-floating-nav__btn';
      btn.textContent = x.label;
      btn.addEventListener('click', ()=> scrollRuleHeadingTo(x.key));
      bar.appendChild(btn);
    });
    box.appendChild(bar);
    box.hidden = false;
    detailView.classList.add('has-overview-floating-nav');
    bindOverviewFloatingNavSync();
    syncOverviewFloatingNavPosition();
  }

  function saveUIState(patch){
    try{
      const prev = JSON.parse(localStorage.getItem(KEY_UI) || '{}') || {};
      const next = Object.assign({}, prev, patch || {});
      localStorage.setItem(KEY_UI, JSON.stringify(next));
    }catch(_){}
  }

  function loadUIState(){
    try{ return JSON.parse(localStorage.getItem(KEY_UI) || '{}') || {}; }
    catch{ return {}; }
  }

  function normalizeGrammarHomeTab(tab){
    const v = String(tab || '').trim().toLowerCase();
    if (v === 'tools') return 'practice';
    return (v === 'rules' || v === 'practice' || v === 'all') ? v : 'rules';
  }

  function loadGrammarHomeTab(){
    try{
      return normalizeGrammarHomeTab(localStorage.getItem(KEY_GRAMMAR_HOME_TAB) || 'rules');
    } catch(_){
      return 'rules';
    }
  }

  function setGrammarHomeTab(tab){
    grammarHomeTab = normalizeGrammarHomeTab(tab);
    try{ localStorage.setItem(KEY_GRAMMAR_HOME_TAB, grammarHomeTab); } catch(_){ }
    applyGrammarHomeTab();
  }

  function applyGrammarHomeTab(){
    const selected = normalizeGrammarHomeTab(grammarHomeTab);

    if (homeView){
      homeView.setAttribute('data-grammar-home-tab', selected);
    }

    if (grammarHomeTabs){
      const buttons = grammarHomeTabs.querySelectorAll('[data-grammar-home-tab]');
      buttons.forEach((btn)=>{
        const tab = normalizeGrammarHomeTab(btn.getAttribute('data-grammar-home-tab'));
        const active = tab === selected;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    }

    if (grammarHomeTabHint){
      grammarHomeTabHint.textContent = HOME_TAB_HINT[selected] || HOME_TAB_HINT.rules;
    }

    if (grammarHomeTileGrid){
      const tiles = grammarHomeTileGrid.querySelectorAll('.sh-tile[data-grammar-home-group]');
      const showAll = selected === 'all';
      grammarHomeTileGrid.hidden = false;
      tiles.forEach((tile)=>{
        if (showAll){
          tile.hidden = false;
          return;
        }
        const group = String(tile.getAttribute('data-grammar-home-group') || '').trim().toLowerCase();
        tile.hidden = (group !== selected);
      });
    }

    if (btnOpenConstructor){
      const wrap = document.getElementById('grammarBuilderBox');
      if (wrap) wrap.hidden = (selected === 'practice');
    }

    const searchWrap = document.getElementById('grammarSearchBox');
    if (searchWrap) searchWrap.hidden = (selected === 'practice');
  }

  function normalizeLevel(level){
    const v = String(level || '').trim();
    return LEVELS.includes(v) ? v : '';
  }

  function getLevel(){
    try{
      return normalizeLevel(localStorage.getItem(KEY_LEVEL));
    }catch(_){
      return '';
    }
  }

  function setLevel(level){
    const next = normalizeLevel(level);
    if (!next) return;
    try{ localStorage.setItem(KEY_LEVEL, next); }catch(_){ }
    refreshLevelUI();
    renderList();
    fillTenseOptions();
    renderCustomPicker();
    renderPracticeInfo();
  }

  function clearLevel(){
    try{ localStorage.removeItem(KEY_LEVEL); }catch(_){ }
    refreshLevelUI();
    if (countBadge) countBadge.textContent = 'grammar: 0';
  }

  function loadCategory(){
    try{
      const raw = String(localStorage.getItem(KEY_CATEGORY) || 'all').trim().toLowerCase();
      return CATEGORY_LABEL[raw] ? raw : 'all';
    }catch(_){
      return 'all';
    }
  }

  function normalizeSubgroup(subgroup){
    const raw = String(subgroup || 'all').trim().toLowerCase().replace(/-/g, '_');
    if (!raw) return 'all';
    if (raw === 'all') return 'all';
    return /^[a-z0-9_]+$/.test(raw) ? raw : 'all';
  }

  function loadSubgroup(){
    try{
      return normalizeSubgroup(localStorage.getItem(KEY_SUBGROUP) || 'all');
    }catch(_){
      return 'all';
    }
  }

  function isCompactList(){
    try{
      const raw = localStorage.getItem(KEY_LIST_COMPACT);
      if (raw == null) return true;
      return raw !== '0';
    }catch(_){
      return true;
    }
  }

  function setCompactList(next){
    const val = !!next;
    try{ localStorage.setItem(KEY_LIST_COMPACT, val ? '1' : '0'); }catch(_){ }
    if (compactListToggle) compactListToggle.checked = val;
  }

  function normalizeRuleMode(mode){
    return mode === 'full' ? 'full' : 'short';
  }

  function loadRuleMode(){
    try{
      return normalizeRuleMode(localStorage.getItem(KEY_RULE_MODE) || 'short');
    }catch(_){
      return 'short';
    }
  }

  function setRuleMode(mode){
    ruleMode = normalizeRuleMode(mode);
    try{ localStorage.setItem(KEY_RULE_MODE, ruleMode); }catch(_){ }
    updateRuleModeButtons();
    if (currentId) renderCurrentRule();
  }

  function setCategory(category){
    const next = CATEGORY_LABEL[category] ? category : 'all';
    activeCategory = next;
    if (next === 'all' && activeSubgroup !== 'all') setSubgroup('all');
    try{ localStorage.setItem(KEY_CATEGORY, next); }catch(_){ }
    saveUIState({ category: next });
  }

  function setSubgroup(subgroup){
    const next = normalizeSubgroup(subgroup);
    activeSubgroup = next;
    try{
      if (next === 'all') localStorage.removeItem(KEY_SUBGROUP);
      else localStorage.setItem(KEY_SUBGROUP, next);
    }catch(_){ }
    saveUIState({ subgroup: next });
  }

  function deriveSubgroup(meta){
    const id = String(meta?.id || '').toLowerCase();
    const group = String(meta?.group || '').toLowerCase();

    if (id === BASIC_OVERVIEW_ID.toLowerCase()) return 'usage_map';
    if (id.includes('usagemap') || id.includes('expressionways')) return 'usage_map';

    if (group === 'present' || group === 'past' || group === 'future'){
      if (group === 'future' && (id.includes('goingto') || id.includes('timeclauses') || id.includes('presentcontinuous') || id.includes('presentsimple'))){
        return 'future_forms';
      }
      if (id.includes('perfectcontinuous')) return 'perfect_continuous';
      if (id.includes('perfect')) return 'perfect';
      if (id.includes('continuous')) return 'continuous';
      return 'simple';
    }

    if (group !== 'universal') return 'simple';
    if (id.includes('conditional')) return 'conditionals';
    if (id.includes('modal')) return 'modals';
    if (id.includes('passive')) return 'voice';
    if (id.includes('clause') || id.includes('reported')) return 'clauses';
    if (id.includes('article')) return 'articles';
    if (id.includes('questiontags') || id.includes('inversion') || id.includes('cleft')) return 'syntax';
    if (id.includes('gerund') || id.includes('wish') || id.includes('causative')) return 'verb_patterns';
    return 'verb_patterns';
  }

  function subgroupLabel(subgroup){
    const key = normalizeSubgroup(subgroup);
    return SUBGROUP_LABEL[key] || key.replace(/_/g, ' ');
  }

  function getAvailableSubgroups(category){
    const metas = getFilteredMetas({ category: category || activeCategory, subgroup: 'all' });
    const out = [];
    const seen = new Set();

    for (const meta of metas){
      const key = deriveSubgroup(meta);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    }

    return sortSubgroups(out);
  }

  function sortSubgroups(list){
    const arr = Array.isArray(list) ? [...list] : [];
    arr.sort((a, b)=>{
      const ai = SUBGROUP_ORDER.indexOf(a);
      const bi = SUBGROUP_ORDER.indexOf(b);
      const aw = ai === -1 ? 999 : ai;
      const bw = bi === -1 ? 999 : bi;
      if (aw !== bw) return aw - bw;
      return String(a).localeCompare(String(b));
    });
    return arr;
  }

  function sortMetasForDisplay(metas){
    const arr = Array.isArray(metas) ? [...metas] : [];
    arr.sort((a, b)=>{
      const ap = String(a?.id || '') === BASIC_OVERVIEW_ID ? 0 : 1;
      const bp = String(b?.id || '') === BASIC_OVERVIEW_ID ? 0 : 1;
      if (ap !== bp) return ap - bp;

      const am = deriveSubgroup(a) === 'usage_map' ? 0 : 1;
      const bm = deriveSubgroup(b) === 'usage_map' ? 0 : 1;
      if (am !== bm) return am - bm;
      return 0;
    });
    return arr;
  }

  function matchesLevel(meta, level){
    if (!level) return true;
    if (!meta || !Array.isArray(meta.levels) || !meta.levels.length) return true;
    return meta.levels.includes(level);
  }

  function getFilteredMetas(options){
    const opts = options || {};
    const level = getLevel();
    const category = opts.category || 'all';
    const subgroup = normalizeSubgroup(opts.subgroup || 'all');

    let metas = Array.isArray(REG.INDEX) ? [...REG.INDEX] : [];
    metas = metas.filter((meta) => matchesLevel(meta, level));

    if (category !== 'all'){
      if (category === 'active_tenses'){
        metas = metas.filter((meta) => {
          const group = String(meta.group || '').toLowerCase();
          return group === 'present' || group === 'past' || group === 'future';
        });
      } else {
        metas = metas.filter((meta) => String(meta.group || '').toLowerCase() === category);
      }
    }

    if (subgroup !== 'all'){
      metas = metas.filter((meta) => deriveSubgroup(meta) === subgroup);
    }

    if (opts.onlyComparable){
      metas = metas.filter((meta) => (meta.kind || 'tense') === 'tense' && meta.compare !== false);
    }

    return metas;
  }

  function ensureLevelSelected(){
    return !!getLevel();
  }

  function refreshLevelUI(){
    const level = getLevel();
    if (levelValue) levelValue.textContent = level || 'не выбран';
    if (levelPrompt) levelPrompt.hidden = !!level;
    if (levelBox) levelBox.classList.toggle('is-empty', !level);

    levelButtons.forEach((btn) => {
      const btnLevel = normalizeLevel(btn.getAttribute('data-grammar-level'));
      btn.classList.toggle('is-active', !!level && btnLevel === level);
    });
  }

  function updateListSubtitle(){
    if (!listSubtitleEl) return;
    const base = CATEGORY_LABEL[activeCategory] || CATEGORY_LABEL.all;
    if (activeSubgroup && activeSubgroup !== 'all'){
      listSubtitleEl.textContent = `${base} - ${subgroupLabel(activeSubgroup)}`;
      return;
    }
    listSubtitleEl.textContent = base;
  }

  function renderSubgroupBar(){
    if (!subgroupWrap || !subgroupBar) return;

    if (activeCategory === 'all'){
      subgroupWrap.hidden = true;
      return;
    }

    const subgroups = getAvailableSubgroups(activeCategory);
    if (!subgroups.length){
      subgroupWrap.hidden = true;
      return;
    }

    if (activeSubgroup !== 'all' && !subgroups.includes(activeSubgroup)){
      setSubgroup('all');
    }

    subgroupBar.innerHTML = '';
    const allKeys = ['all', ...subgroups];
    for (const key of allKeys){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ik-btn';
      if (key === activeSubgroup) btn.classList.add('is-active');
      btn.textContent = subgroupLabel(key);
      btn.addEventListener('click', ()=>{
        setSubgroup(key);
        renderList();
      });
      subgroupBar.appendChild(btn);
    }

    subgroupWrap.hidden = false;
  }

  const SEARCH_HINT_DEFAULT = searchHint ? searchHint.textContent : '';

  const SEARCH_DOC_CACHE = new Map();

  function normalizeSearchText(text){
    return String(text || '')
      .toLowerCase()
      .replace(/[`´]/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  function splitWords(text){
    return normalizeSearchText(text)
      .split(/[^a-z0-9а-яё']+/i)
      .map((w)=> w.replace(/^'+|'+$/g, ''))
      .filter(Boolean);
  }

  function collectStrings(value, out){
    if (value == null) return;
    if (Array.isArray(value)){
      for (const item of value) collectStrings(item, out);
      return;
    }
    if (typeof value === 'object'){
      for (const v of Object.values(value)) collectStrings(v, out);
      return;
    }
    if (typeof value === 'string' || typeof value === 'number') out.push(String(value));
  }

  function collectPracticeSearchText(practice, out){
    if (!practice || !Array.isArray(practice.exercises)) return;
    for (const ex of practice.exercises){
      out.push(ex?.title || '', ex?.goal || '');
    }
  }

  function hasTokenPrefix(tokens, term){
    for (const tk of (tokens || [])){
      if (tk.startsWith(term)) return true;
    }
    return false;
  }

  function countToken(tokens, term){
    let n = 0;
    for (const tk of (tokens || [])){
      if (tk === term) n += 1;
    }
    return n;
  }

  function buildSnippet(tokens, terms){
    if (!Array.isArray(tokens) || !tokens.length) return '';
    const queryTerms = Array.isArray(terms) ? terms : [];

    let hitIndex = -1;
    for (const term of queryTerms){
      const prefixAllowed = String(term || '').length >= 4;
      hitIndex = tokens.findIndex((tk)=> tk === term || (prefixAllowed && tk.startsWith(term)));
      if (hitIndex >= 0) break;
    }

    if (hitIndex < 0) return '';
    const from = Math.max(0, hitIndex - 4);
    const to = Math.min(tokens.length, hitIndex + 5);
    const chunk = tokens.slice(from, to).join(' ');
    if (!chunk) return '';
    return from > 0 ? `... ${chunk}` : chunk;
  }

  function buildSearchSnippet(doc, terms){
    return (
      buildSnippet(doc.titleTokens, terms) ||
      buildSnippet(doc.metaTokens, terms) ||
      buildSnippet(doc.ruleTokens, terms)
    );
  }

  function buildSearchDoc(meta){
    const key = String(meta?.id || '');
    const cached = SEARCH_DOC_CACHE.get(key);
    if (cached) return cached;

    const group = String(meta?.group || '').toLowerCase();
    const subgroup = deriveSubgroup(meta);
    const topic = (REG && REG.byId) ? REG.byId[key] : null;

    const metaParts = [
      meta?.id,
      meta?.title,
      meta?.subtitle,
      meta?.hint,
      group,
      CATEGORY_LABEL[group] || '',
      subgroup,
      subgroupLabel(subgroup),
      Array.isArray(meta?.levels) ? meta.levels.join(' ') : ''
    ];

    const ruleParts = [];

    if (topic){
      collectStrings(topic.ruleBlocks || [], ruleParts);
      collectPracticeSearchText(topic.practice || {}, ruleParts);
    }

    const metaText = normalizeSearchText(metaParts.filter(Boolean).join(' '));
    const ruleText = normalizeSearchText(ruleParts.filter(Boolean).join(' '));
    const text = [metaText, ruleText].filter(Boolean).join(' ');

    const metaTokens = splitWords(metaText);
    const ruleTokens = splitWords(ruleText);
    const metaTokenSet = new Set(metaTokens);
    const ruleTokenSet = new Set(ruleTokens);

    const titleText = normalizeSearchText([meta?.title || '', meta?.id || '', meta?.subtitle || ''].join(' '));
    const titleTokens = splitWords(titleText);
    const titleTokenSet = new Set(titleTokens);

    const doc = {
      meta,
      group,
      subgroup,
      text,
      metaText,
      ruleText,
      metaTokens,
      ruleTokens,
      metaTokenSet,
      ruleTokenSet,
      titleText,
      titleTokens,
      titleTokenSet
    };
    SEARCH_DOC_CACHE.set(key, doc);
    return doc;
  }

  function getSearchBaseMetas(){
    return Array.isArray(REG.INDEX) ? [...REG.INDEX] : [];
  }

  function searchGrammarMetas(query){
    const q = normalizeSearchText(query || '');
    const terms = splitWords(q);
    if (!terms.length) return [];

    const level = getLevel();
    const rows = [];

    for (const meta of getSearchBaseMetas()){
      const doc = buildSearchDoc(meta);
      let score = 0;
      let allMatch = true;
      const fieldHits = { title: 0, meta: 0, rules: 0 };
      const exactMatches = [];

      for (const t of terms){
        const prefixAllowed = t.length >= 4;

        const titleExact = doc.titleTokenSet.has(t);
        const titlePrefix = !titleExact && prefixAllowed ? hasTokenPrefix(doc.titleTokens, t) : false;

        const metaExact = doc.metaTokenSet.has(t);
        const metaPrefix = !metaExact && prefixAllowed ? hasTokenPrefix(doc.metaTokens, t) : false;

        const ruleExact = doc.ruleTokenSet.has(t);
        const rulePrefix = !ruleExact && prefixAllowed ? hasTokenPrefix(doc.ruleTokens, t) : false;
        exactMatches.push(!!(titleExact || metaExact || ruleExact));

        if (!titleExact && !titlePrefix && !metaExact && !metaPrefix && !ruleExact && !rulePrefix){
          allMatch = false;
          break;
        }

        if (titleExact) score += 80 + Math.min(30, countToken(doc.titleTokens, t) * 4);
        else if (titlePrefix) score += 40;
        if (titleExact || titlePrefix) fieldHits.title += 1;

        if (metaExact) score += 26 + Math.min(18, countToken(doc.metaTokens, t) * 3);
        else if (metaPrefix) score += 11;
        if (metaExact || metaPrefix) fieldHits.meta += 1;

        if (ruleExact) score += 9 + Math.min(20, countToken(doc.ruleTokens, t) * 2);
        else if (rulePrefix) score += 3;
        if (ruleExact || rulePrefix) fieldHits.rules += 1;
      }

      if (!allMatch) continue;

      const idNorm = normalizeSearchText(meta.id || '');
      if (doc.titleText === q) score += 120;
      else if (doc.titleText.startsWith(q)) score += 50;
      if (idNorm === q) score += 90;
      else if (idNorm.startsWith(q)) score += 30;

      const levelMatch = !level || (Array.isArray(meta.levels) && meta.levels.includes(level));
      if (levelMatch) score += 8;

      const snippet = buildSearchSnippet(doc, terms);

      rows.push({
        meta,
        subgroup: doc.subgroup,
        score,
        levelMatch,
        fieldHits,
        allTermsExact: exactMatches.every(Boolean),
        snippet
      });
    }

    rows.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.levelMatch !== b.levelMatch) return a.levelMatch ? -1 : 1;
      return String(a.meta.title || '').localeCompare(String(b.meta.title || ''));
    });

    if (terms.length === 1 && terms[0].length <= 3){
      const strictRows = rows.filter((r)=> r.allTermsExact);
      if (strictRows.length) return strictRows.slice(0, 20);
    }

    return rows.slice(0, 20);
  }

  function openFromSearch(meta, subgroup){
    if (!meta || !meta.id) return;

    if (meta.group) setCategory(String(meta.group).toLowerCase());
    setSubgroup(subgroup || deriveSubgroup(meta));

    openTense(meta.id);
    showOnly('detail');
    setStatus('open');

    if (searchResults){
      searchResults.innerHTML = '';
      searchResults.hidden = true;
    }
  }

  function renderSearchResults(rawQuery){
    if (!searchResults) return;

    const query = String(rawQuery || '').trim();
    if (!query){
      searchResults.innerHTML = '';
      searchResults.hidden = true;
      if (searchHint) searchHint.textContent = SEARCH_HINT_DEFAULT;
      return;
    }

    const rows = searchGrammarMetas(query);
    searchResults.innerHTML = '';

    if (!rows.length){
      const li = document.createElement('li');
      li.innerHTML = '<p class="ik-itemline">ничего не найдено</p>';
      searchResults.appendChild(li);
      searchResults.hidden = false;
      return;
    }

    for (const row of rows){
      const meta = row.meta;
      const category = String(meta.group || '').toLowerCase();
      const categoryLabel = CATEGORY_LABEL[category] || category;
      const subgroupText = subgroupLabel(row.subgroup);
      const levelsText = Array.isArray(meta.levels) && meta.levels.length ? meta.levels.join(' / ') : '';
      const selectedLevel = getLevel();
      const outOfLevel = !!(selectedLevel && Array.isArray(meta.levels) && !meta.levels.includes(selectedLevel));
      const matchFields = [];
      if (row.fieldHits?.title) matchFields.push('title');
      if (row.fieldHits?.meta) matchFields.push('meta');
      if (row.fieldHits?.rules) matchFields.push('rules');
      const matchText = matchFields.length ? `совпадение: ${matchFields.join('/')}` : '';
      const snippetText = row.snippet ? `найдено: ${row.snippet}` : '';
      const metaLine = [categoryLabel, subgroupText, levelsText, outOfLevel ? 'другой уровень' : '', matchText].filter(Boolean).join(' • ');

      const li = document.createElement('li');
      li.className = 'is-clickable';

      const left = document.createElement('div');
      left.innerHTML = `<p class="ik-itemline"><b>${escapeHtml(meta.title || meta.id)}</b></p>
                        <p class="ik-itemline ik-muted">${escapeHtml(meta.hint || meta.subtitle || '')}</p>
                        <p class="ik-itemline ik-muted">${escapeHtml(metaLine)}</p>
                        ${snippetText ? `<p class="ik-itemline ik-muted">${escapeHtml(snippetText)}</p>` : ''}`;

      const right = document.createElement('div');
      right.className = 'ik-mini';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ik-btn ik-btn--black';
      btn.textContent = 'open';
      btn.addEventListener('click', (e)=>{
        e.stopPropagation();
        openFromSearch(meta, row.subgroup);
      });

      right.appendChild(btn);
      li.appendChild(left);
      li.appendChild(right);
      li.addEventListener('click', ()=> openFromSearch(meta, row.subgroup));
      searchResults.appendChild(li);
    }

    searchResults.hidden = false;
  }

  function initSearchUI(){
    if (!searchInput || !searchResults) return;

    searchInput.addEventListener('input', ()=>{
      renderSearchResults(searchInput.value);
    });

    searchInput.addEventListener('focus', ()=>{
      if (searchInput.value.trim()) renderSearchResults(searchInput.value);
    });

    searchInput.addEventListener('keydown', (e)=>{
      if (e.key !== 'Enter') return;
      const firstOpenBtn = searchResults.querySelector('button');
      if (!firstOpenBtn) return;
      e.preventDefault();
      firstOpenBtn.click();
    });

    searchClearBtn && searchClearBtn.addEventListener('click', ()=>{
      searchInput.value = '';
      renderSearchResults('');
      searchInput.focus();
    });

    document.addEventListener('click', (e)=>{
      if (!searchResults || searchResults.hidden) return;
      if (e.target === searchInput || e.target === searchClearBtn) return;
      if (searchResults.contains(e.target)) return;
      searchResults.hidden = true;
    });
  }

  function getMetaById(id){
    return (REG.INDEX || []).find((m) => m.id === id) || null;
  }

  function isLevelMatchId(id){
    const meta = getMetaById(id);
    if (!meta) return false;
    return matchesLevel(meta, getLevel());
  }

  function normalizeBuilderPicks(picks){
    const out = [];
    const seen = new Set();
    for (const id of (picks || [])){
      const k = String(id || '').trim();
      if (!k || seen.has(k)) continue;
      if (!REG.byId[k]) continue;
      seen.add(k);
      out.push(k);
    }
    return out;
  }

  function getBuilderPhraseText(){
    return normalizeSearchText(builderPhraseInput?.value || '');
  }

  function analyzeBuilderPhrase(){
    const text = getBuilderPhraseText();
    if (!text) return { hasText: false, text: '' };

    const words = splitWords(text);
    const hasWord = (arr) => arr.some((w) => words.includes(w));
    const hasChunk = (arr) => arr.some((s) => text.includes(s));

    const hasNow =
      hasWord(['сейчас', 'теперь', 'now']) ||
      hasChunk(['прямо сейчас', 'в данный момент', 'at the moment', 'right now']);

    const isStative =
      hasWord([
        'want', 'wants', 'wanted', 'need', 'needs', 'know', 'knows', 'like', 'likes',
        'love', 'loves', 'believe', 'believes', 'understand', 'understands', 'remember',
        'remembers', 'prefer', 'prefers', 'seem', 'seems'
      ]) ||
      hasChunk([
        'хочу', 'хочешь', 'хочет', 'хотим', 'хотите', 'хотят',
        'нравится', 'люблю', 'любит', 'любят', 'знаю', 'знает', 'знают',
        'понимаю', 'понимает', 'помню', 'помнит', 'верю', 'верит', 'кажется', 'нужно', 'надо'
      ]);

    const hasPlan =
      hasWord(['plan', 'planned', 'intend', 'intends', 'going']) ||
      hasChunk(['планирую', 'собираюсь', 'собираемся', 'собирается', 'going to', 'intend to']);

    const isWouldIdea =
      hasChunk([
        'было бы неплохо',
        'было бы не плохо',
        'было бы хорошо',
        'было бы лучше',
        'было бы здорово',
        'было бы классно',
        'было бы круто',
        'было бы полезно',
        'would be good',
        'would be nice',
        'would be better',
        'it would be good',
        'it would be nice',
        'it would be better'
      ]) ||
      /было\s*бы\s*(не\s*)?(плохо|хорошо|лучше|здорово|классно|круто|полезно)/i.test(text) ||
      (words.includes('would') && (words.includes('good') || words.includes('nice') || words.includes('better')));

    return { hasText: true, text, hasNow, isStative, hasPlan, isWouldIdea };
  }

  function tuneResultByPhrase(resultKey){
    const info = analyzeBuilderPhrase();
    let key = resultKey;
    let noteKey = '';

    if (!info.hasText) return { key, noteKey };

    if (info.isWouldIdea && (
      key.startsWith('future_') ||
      key === 'modal_obligation' ||
      key === 'modal_deduction' ||
      key === 'present_process' ||
      key === 'present_habit' ||
      key === 'present_state' ||
      key === 'present_map'
    )){
      key = 'would_idea';
      noteKey = 'would_idea';
    } else if ((key === 'present_process' || key === 'present_duration' || key === 'present_habit') && info.isStative){
      key = 'present_state';
      noteKey = 'stative';
    } else if ((key === 'present_habit' || key === 'present_state') && info.hasNow && !info.isStative){
      key = 'present_process';
      noteKey = 'now_process';
    } else if (key === 'future_decision' && info.hasPlan){
      key = 'future_plan';
      noteKey = 'plan';
    }

    return { key, noteKey };
  }

  function smartNoteText(noteKey){
    if (!noteKey) return '';
    if (isEnLang()){
      if (noteKey === 'stative') return 'Smart check: your phrase looks like a state/desire (want/know/like), so Present Simple is usually better.';
      if (noteKey === 'now_process') return 'Smart check: your phrase has a "now" marker and looks dynamic, so Present Continuous is likely better.';
      if (noteKey === 'plan') return 'Smart check: your phrase sounds like a plan/intention, so be going to is likely better.';
      if (noteKey === 'would_idea') return 'Smart check: your phrase sounds like a soft idea ("it would be good/better"), so would-patterns fit better than be going to.';
      return '';
    }
    if (noteKey === 'stative') return 'Умная проверка: по фразе это похоже на состояние/желание (want/know/like), поэтому обычно лучше Present Simple.';
    if (noteKey === 'now_process') return 'Умная проверка: во фразе есть маркер "сейчас" и динамика действия, поэтому вероятнее Present Continuous.';
    if (noteKey === 'plan') return 'Умная проверка: во фразе заметен план/намерение, поэтому чаще подходит be going to.';
    if (noteKey === 'would_idea') return 'Умная проверка: фраза похожа на мягкую идею ("было бы неплохо/лучше"), поэтому лучше использовать would-шаблон, а не be going to.';
    return '';
  }

  function buildConstructorRecommendation(resultKey){
    const tuned = tuneResultByPhrase(resultKey);
    const raw = CONSTRUCTOR_RESULTS[tuned.key] || CONSTRUCTOR_RESULTS[resultKey];
    if (!raw) return null;

    const picks = normalizeBuilderPicks(raw.picks);
    if (!picks.length) return null;

    const level = getLevel();
    let mainId = picks[0];
    if (level && !isLevelMatchId(mainId)){
      const fit = picks.find((id) => isLevelMatchId(id));
      if (fit) mainId = fit;
    }

    const alternatives = picks
      .filter((id) => id !== mainId)
      .map((id, i) => ({ id, i, fit: isLevelMatchId(id) ? 1 : 0 }))
      .sort((a, b) => b.fit - a.fit || a.i - b.i)
      .slice(0, 2)
      .map((x) => x.id);

    return {
      sourceKey: resultKey,
      tunedKey: tuned.key,
      reason: raw.reason || '',
      smartNote: smartNoteText(tuned.noteKey),
      mainId,
      alternatives,
      outOfLevel: !!(level && !isLevelMatchId(mainId))
    };
  }

  function isEnLang(){
    return String(document.documentElement.lang || 'ru').toLowerCase() === 'en';
  }

  function renderBuilderQuestion(){
    if (!builderBody) return;
    builderLastRec = null;
    const node = CONSTRUCTOR_NODES[builderNode] || CONSTRUCTOR_NODES.root;
    const step = builderPath.length + 1;
    if (builderStepBadge) builderStepBadge.textContent = isEnLang() ? `step ${step}` : `шаг ${step}`;
    if (builderSubtitle) builderSubtitle.textContent = isEnLang() ? 'choose meaning and we suggest the best topic' : 'выбери смысл, а мы подскажем лучшую тему';

    builderBody.innerHTML = '';

    const q = document.createElement('p');
    q.className = 'sh-builder__q';
    q.textContent = node.q || '';
    builderBody.appendChild(q);

    if (node.hint){
      const hint = document.createElement('p');
      hint.className = 'sh-builder__hint';
      hint.textContent = node.hint;
      builderBody.appendChild(hint);
    }

    const phrase = getBuilderPhraseText();
    if (phrase){
      const hint2 = document.createElement('p');
      hint2.className = 'sh-builder__hint';
      hint2.textContent = isEnLang() ? `Your phrase is considered: "${phrase}"` : `Учитываю твою фразу: "${phrase}"`;
      builderBody.appendChild(hint2);
    }

    const options = document.createElement('div');
    options.className = 'sh-builder__options';

    for (const opt of (node.options || [])){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ik-btn';
      btn.textContent = opt.label || opt.id || '...';
      btn.addEventListener('click', ()=>{
        builderPath.push({ node: builderNode, option: opt.id || '' });
        if (opt.next){
          builderNode = opt.next;
          renderBuilderQuestion();
          return;
        }
        const rec = buildConstructorRecommendation(opt.result);
        renderBuilderResult(rec);
      });
      options.appendChild(btn);
    }

    if (builderPath.length){
      const backBtn = document.createElement('button');
      backBtn.type = 'button';
      backBtn.className = 'ik-btn';
      backBtn.textContent = isEnLang() ? 'back to question' : 'назад к вопросу';
      backBtn.addEventListener('click', ()=>{
        const prev = builderPath.pop();
        builderNode = prev && prev.node ? prev.node : 'root';
        renderBuilderQuestion();
      });
      options.appendChild(backBtn);
    }

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'ik-btn';
    resetBtn.textContent = isEnLang() ? 'reset' : 'сбросить';
    resetBtn.addEventListener('click', resetConstructor);
    options.appendChild(resetBtn);

    builderBody.appendChild(options);
  }

  function openConstructorRule(id){
    if (!id || !REG.byId[id]) return;
    const meta = getMetaById(id);
    if (meta && meta.group) setCategory(String(meta.group).toLowerCase());
    setSubgroup('all');
    openTense(id);
  }

  function renderBuilderResult(rec){
    if (!builderBody) return;
    if (!rec || !rec.mainId){
      builderBody.innerHTML = `<p class="ik-itemline">${isEnLang() ? 'Could not pick a topic. Try again from start.' : 'Не удалось подобрать тему. Попробуй начать заново.'}</p>`;
      return;
    }

    builderLastRec = rec;

    if (builderStepBadge) builderStepBadge.textContent = isEnLang() ? 'result' : 'результат';
    if (builderSubtitle) builderSubtitle.textContent = isEnLang() ? '1 main option + 2 alternatives' : '1 главный вариант + 2 альтернативы';

    const mainMeta = getMetaById(rec.mainId);
    const altMetas = (rec.alternatives || []).map((id)=> getMetaById(id)).filter(Boolean);

    builderBody.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'sh-builder__result';

    const title = document.createElement('p');
    title.className = 'sh-builder__result-title';
    title.textContent = isEnLang() ? 'main option' : 'главный вариант';
    wrap.appendChild(title);

    const main = document.createElement('div');
    main.className = 'sh-builder__main';
    main.innerHTML = `<h4>${escapeHtml(mainMeta?.title || rec.mainId)}</h4>
                      <p>${escapeHtml(mainMeta?.subtitle || mainMeta?.hint || '')}</p>
                      <p style="margin-top:8px;">${escapeHtml(rec.reason || '')}</p>
                      ${rec.smartNote ? `<p style="margin-top:8px;">${escapeHtml(rec.smartNote)}</p>` : ''}
                      ${rec.outOfLevel ? `<p style="margin-top:8px;">${isEnLang() ? 'this topic is above/below your current level but is the most accurate by meaning.' : 'тема выше/ниже текущего уровня, но по смыслу самая точная.'}</p>` : ''}`;

    const mainActions = document.createElement('div');
    mainActions.className = 'sh-builder__actions';

    const btnRule = document.createElement('button');
    btnRule.type = 'button';
    btnRule.className = 'ik-btn ik-btn--black';
    btnRule.textContent = isEnLang() ? 'open rule' : 'открыть правило';
    btnRule.addEventListener('click', ()=> openConstructorRule(rec.mainId));

    const btnPracticeMain = document.createElement('button');
    btnPracticeMain.type = 'button';
    btnPracticeMain.className = 'ik-btn';
    btnPracticeMain.textContent = isEnLang() ? 'go to practice now' : 'сразу к упражнениям';
    btnPracticeMain.addEventListener('click', ()=> goPracticeForTense(rec.mainId));

    const btnRestartMain = document.createElement('button');
    btnRestartMain.type = 'button';
    btnRestartMain.className = 'ik-btn';
    btnRestartMain.textContent = isEnLang() ? 'start again' : 'начать заново';
    btnRestartMain.addEventListener('click', resetConstructor);

    mainActions.appendChild(btnRule);
    mainActions.appendChild(btnPracticeMain);
    mainActions.appendChild(btnRestartMain);
    main.appendChild(mainActions);

    wrap.appendChild(main);

    if (altMetas.length){
      const altTitle = document.createElement('p');
      altTitle.className = 'sh-builder__result-title';
      altTitle.textContent = isEnLang() ? 'alternatives' : 'альтернативы';
      wrap.appendChild(altTitle);

      for (const meta of altMetas){
        const alt = document.createElement('div');
        alt.className = 'sh-builder__alt';
        alt.innerHTML = `<h4>${escapeHtml(meta.title || meta.id)}</h4>
                         <p>${escapeHtml(meta.subtitle || meta.hint || '')}</p>`;

        const altActions = document.createElement('div');
        altActions.className = 'sh-builder__alt-actions';

        const btnAltRule = document.createElement('button');
        btnAltRule.type = 'button';
        btnAltRule.className = 'ik-btn';
        btnAltRule.textContent = isEnLang() ? 'open rule' : 'открыть правило';
        btnAltRule.addEventListener('click', ()=> openConstructorRule(meta.id));

        const btnAltPractice = document.createElement('button');
        btnAltPractice.type = 'button';
        btnAltPractice.className = 'ik-btn';
        btnAltPractice.textContent = isEnLang() ? 'practice' : 'упражнения';
        btnAltPractice.addEventListener('click', ()=> goPracticeForTense(meta.id));

        altActions.appendChild(btnAltRule);
        altActions.appendChild(btnAltPractice);
        alt.appendChild(altActions);
        wrap.appendChild(alt);
      }
    }

    builderBody.appendChild(wrap);
  }

  function resetConstructor(){
    builderPath = [];
    builderNode = 'root';
    builderLastRec = null;
    renderBuilderQuestion();
  }

  function showConstructor(){
    if (!builderBody) return;
    resetConstructor();
    showOnly('constructor');
    setStatus('constructor');
  }

  function openCategory(category){
    if (!ensureLevelSelected()){
      showOnly('home');
      setStatus('выбери уровень');
      return;
    }
    setCategory(category);
    setSubgroup('all');
    renderList();
    showOnly('list');
    setStatus('list');
  }

  // -------------------------
  // Rule renderer (same format as Structure)
  // -------------------------
  function renderRuleBlocks(container, blocks){
    container.innerHTML = '';
    for (const b of (blocks || [])){
      if (b.type === 'heading'){
        const h = document.createElement('h3');
        h.className = 'sh-rule-h';
        h.textContent = b.text || '';
        if (currentId === BASIC_OVERVIEW_ID){
          h.setAttribute('data-basic-heading-key', normalizeHeadingKey(b.text || ''));
        }
        container.appendChild(h);
      } else if (b.type === 'text'){
        const p = document.createElement('p');
        p.className = 'sh-rule-p';
        p.textContent = b.text || '';
        container.appendChild(p);
      } else if (b.type === 'topicLinks'){
        const links = Array.isArray(b.items) ? b.items : [];
        const valid = links.filter((item)=>{
          const topicId = String(item?.id || '').trim();
          return !!(topicId && REG.byId && REG.byId[topicId]);
        });
        if (!valid.length) continue;

        const box = document.createElement('div');
        box.className = 'sh-topic-links';

        if (b.title){
          const title = document.createElement('p');
          title.className = 'sh-topic-links__title';
          title.textContent = b.title;
          box.appendChild(title);
        }

        if (b.note){
          const note = document.createElement('p');
          note.className = 'sh-topic-links__note';
          note.textContent = b.note;
          box.appendChild(note);
        }

        const list = document.createElement('div');
        list.className = 'sh-topic-links__list';

        for (const item of valid){
          const topicId = String(item.id || '').trim();
          const topic = REG.byId[topicId] || {};

          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'sh-topic-link';

          const title = document.createElement('span');
          title.className = 'sh-topic-link__title';
          title.textContent = item.label || topic.title || topicId;
          btn.appendChild(title);

          const sub = document.createElement('span');
          sub.className = 'sh-topic-link__sub';
          sub.textContent = item.note || topic.subtitle || '';
          btn.appendChild(sub);

          btn.addEventListener('click', ()=>{
            const isBasicQuickMaps =
              currentId === BASIC_OVERVIEW_ID &&
              String(b.title || '').trim().toLowerCase() === 'быстрый переход к картам выбора';

            if (isBasicQuickMaps){
              const mapTargets = {
                presentUsageMap: normalizeHeadingKey('Present Simple'),
                pastUsageMap: normalizeHeadingKey('Past Simple'),
                futureExpressionWays: normalizeHeadingKey('Future Simple')
              };
              const targetKey = mapTargets[topicId];
              if (targetKey){
                scrollRuleHeadingTo(targetKey);
                return;
              }
            }

            openTense(topicId, { fromTopicLink: true, returnScrollY: window.scrollY });
          });
          list.appendChild(btn);
        }

        box.appendChild(list);
        container.appendChild(box);
      } else if (b.type === 'table'){
        const wrap = document.createElement('div');
        wrap.className = 'sh-table-wrap';

        if (b.caption){
          const cap = document.createElement('p');
          cap.className = 'sh-table-cap';
          cap.textContent = b.caption;
          wrap.appendChild(cap);
        }

        const table = document.createElement('table');
        table.className = 'sh-table';

        const thead = document.createElement('thead');
        const trh = document.createElement('tr');
        for (const c of (b.columns || [])){
          const th = document.createElement('th');
          th.textContent = c;
          trh.appendChild(th);
        }
        thead.appendChild(trh);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        for (const row of (b.rows || [])){
          const tr = document.createElement('tr');
          for (const cell of row){
            const td = document.createElement('td');
            td.textContent = cell;
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
        }
        table.appendChild(tbody);

        wrap.appendChild(table);
        container.appendChild(wrap);
      } else if (b.type === 'examples'){
        const box = document.createElement('div');
        box.className = 'sh-examples';

        const ul = document.createElement('ul');
        ul.className = 'sh-ex-list';

        for (const ex of (b.items || [])){
          const li = document.createElement('li');
          li.innerHTML = `<div class="sh-ex-en">${escapeHtml(ex.en || '')}</div>
                          <div class="sh-ex-ru">${escapeHtml(ex.ru || '')}</div>`;
          ul.appendChild(li);
        }
        box.appendChild(ul);
        container.appendChild(box);
      } else if (b.type === 'highlight'){
        const box = document.createElement('div');
        box.className = 'sh-highlight';

        const t = document.createElement('p');
        t.className = 'sh-highlight-title';
        t.textContent = b.title || 'note';
        box.appendChild(t);

        const ul = document.createElement('ul');
        ul.className = 'sh-highlight-list';
        for (const line of (b.lines || [])){
          const li = document.createElement('li');
          li.textContent = line;
          ul.appendChild(li);
        }
        box.appendChild(ul);
        container.appendChild(box);
      }
    }
  }

  // -------------------------
  // List
  // -------------------------
  function renderList(){
    renderSubgroupBar();
    const visibleMetas = sortMetasForDisplay(getFilteredMetas({ category: activeCategory, subgroup: activeSubgroup }));
    const compactMode = isCompactList();
    if (countBadge) countBadge.textContent = `grammar: ${visibleMetas.length}`;
    updateListSubtitle();

    listEl.innerHTML = '';
    if (!visibleMetas.length){
      const li = document.createElement('li');
      li.innerHTML = '<p class="ik-itemline">Для этого уровня пока нет тем в выбранной категории.</p>';
      listEl.appendChild(li);
      return;
    }

    for (const meta of visibleMetas){
      const prog = loadProgress(meta.id);
      const subgroupText = subgroupLabel(deriveSubgroup(meta));
      const metaHint = meta.hint || meta.subtitle || '';

      const li = document.createElement('li');
      li.className = 'is-clickable';
      li.addEventListener('click', ()=> openTense(meta.id));

      const left = document.createElement('div');
      if (compactMode){
        left.innerHTML = `<p class="ik-itemline"><b>${escapeHtml(meta.title)}</b></p>
                          <p class="ik-itemline ik-muted">${escapeHtml(subgroupText)}</p>`;
      } else {
        left.innerHTML = `<p class="ik-itemline"><b>${escapeHtml(meta.title)}</b></p>
                          <p class="ik-itemline ik-muted">${escapeHtml(metaHint)} • ${escapeHtml(subgroupText)}</p>`;
      }

      const right = document.createElement('div');
      right.className = 'ik-mini';

      const badge = document.createElement('span');
      badge.className = 'ik-badge';
      badge.textContent = `${masteryLabel(prog.mastery)} - ${prog.mastery}/5`;

      const btnRule = document.createElement('button');
      btnRule.className = 'ik-btn ik-btn--black';
      btnRule.type = 'button';
      btnRule.textContent = 'правило';
      btnRule.addEventListener('click', (e)=>{
        e.stopPropagation();
        openTense(meta.id);
      });

      right.appendChild(badge);
      right.appendChild(btnRule);

      li.appendChild(left);
      li.appendChild(right);
      listEl.appendChild(li);
    }
  }

  // -------------------------
  // Detail
  // -------------------------
  function blocksForRuleMode(blocks){
    const source = Array.isArray(blocks) ? blocks : [];
    if (ruleMode === 'full' || currentId === BASIC_OVERVIEW_ID) return source;

    const out = [];
    let heading = 0;
    let text = 0;
    let topicLinks = 0;
    let table = 0;
    let highlight = 0;
    let examples = 0;

    for (const block of source){
      if (!block || typeof block !== 'object') continue;

      if (block.type === 'heading' && heading < 1){
        out.push(block);
        heading += 1;
        continue;
      }

      if (block.type === 'text' && text < 1){
        out.push(block);
        text += 1;
        continue;
      }

      if (block.type === 'topicLinks' && topicLinks < 2){
        const items = Array.isArray(block.items) ? block.items.slice(0, 8) : [];
        out.push(Object.assign({}, block, { items }));
        topicLinks += 1;
        continue;
      }

      if (block.type === 'table' && table < 1){
        const rows = Array.isArray(block.rows) ? block.rows.slice(0, 4) : [];
        out.push(Object.assign({}, block, { rows }));
        table += 1;
        continue;
      }

      if (block.type === 'highlight' && highlight < 1){
        const lines = Array.isArray(block.lines) ? block.lines.slice(0, 4) : [];
        out.push(Object.assign({}, block, { lines }));
        highlight += 1;
        continue;
      }

      if (block.type === 'examples' && examples < 1){
        const items = Array.isArray(block.items) ? block.items.slice(0, 2) : [];
        out.push(Object.assign({}, block, { items }));
        examples += 1;
        continue;
      }
    }

    return out.length ? out : source.slice(0, 3);
  }

  function updateRuleModeButtons(){
    if (ruleModeShortBtn) ruleModeShortBtn.classList.toggle('is-active', ruleMode === 'short');
    if (ruleModeFullBtn) ruleModeFullBtn.classList.toggle('is-active', ruleMode === 'full');
  }

  function renderCurrentRule(){
    if (!currentId) return;
    const t = REG.byId[currentId];
    if (!t) return;
    renderRuleBlocks(ruleBody, blocksForRuleMode(t.ruleBlocks || []));
    renderBasicOverviewQuickNav();
  }

  function openTense(id, opts){
    const t = REG.byId[id];
    if (!t) return;

    const options = opts || {};
    if (options.fromRun){
      setRunReturnState(options.runContext || { sourceTenseId: id });
    } else {
      setRunReturnState(null);
    }

    if (options.fromTopicLink && currentId && currentId !== id){
      detailBackStack.push({
        id: currentId,
        scrollY: Number.isFinite(options.returnScrollY) ? options.returnScrollY : window.scrollY
      });
    } else if (!options.preserveBackStack){
      detailBackStack = [];
    }

    currentId = id;

    tenseTitleEl.textContent = t.title || id;
    tenseSubtitleEl.textContent = t.subtitle || '';
    renderCurrentRule();
    updateDetailPracticeButtons(t);

    updateMasteryUI(id);
    updateRuleModeButtons();
    showOnly('detail');
    renderBasicOverviewQuickNav();
    setStatus('open');
    if (Number.isFinite(options.restoreScrollY)){
      requestAnimationFrame(()=>{
        window.scrollTo({ top: Math.max(0, Number(options.restoreScrollY) || 0), behavior: 'auto' });
      });
    }
  }

  function hasPracticeForTopic(topic){
    const exercises = (topic && topic.practice && Array.isArray(topic.practice.exercises))
      ? topic.practice.exercises
      : [];
    return exercises.some((ex)=> Array.isArray(ex.items) && ex.items.length > 0);
  }

  function updateDetailPracticeButtons(topic){
    const canOpen = hasPracticeForTopic(topic);
    if (btnGoPracticeFromDetail) btnGoPracticeFromDetail.hidden = !canOpen;
    if (btnGoPracticeBottom) btnGoPracticeBottom.hidden = !canOpen;
  }

  function updateMasteryUI(id){
    const p = loadProgress(id);
    if (tenseMasteryBadge){
      tenseMasteryBadge.textContent = `mastery ${p.mastery || 0}/5`;
      tenseMasteryBadge.title = masteryLabel(p.mastery || 0);
    }
  }

  // -------------------------
  // Practice config
  // -------------------------
  function normalizePracticeMode(mode){
    return String(mode || '').toLowerCase() === 'custom' ? 'custom' : 'mixed';
  }

  function inferPracticeModeFromUi(ui){
    const byMode = normalizePracticeMode(ui?.practiceMode || '');
    if (byMode === 'custom') return 'custom';
    const tenseId = String(ui?.tense || '').trim();
    if (tenseId === CUSTOM_TENSE_ID) return 'custom';
    return 'mixed';
  }

  function applyPracticeModeButtons(mode){
    const m = normalizePracticeMode(mode);
    if (modeMixedBtn){
      modeMixedBtn.classList.toggle('ik-btn--black', m === 'mixed');
    }
    if (modeCustomBtn){
      modeCustomBtn.classList.toggle('ik-btn--black', m === 'custom');
    }
    if (modeHintEl){
      modeHintEl.textContent = PRACTICE_MODE_HINT[m] || PRACTICE_MODE_HINT.mixed;
    }
    if (btnStart){
      btnStart.textContent = m === 'custom' ? 'start custom' : 'start mixed';
    }
  }

  function setPracticeMode(mode, options){
    const opts = Object.assign({ persist: true, rerender: true }, options || {});
    const m = normalizePracticeMode(mode);

    applyPracticeModeButtons(m);

    if (tenseSelect){
      tenseSelect.value = m === 'custom' ? CUSTOM_TENSE_ID : 'mixedAll';
    }

    if (m === 'custom') renderCustomPicker();
    setCustomPickerVisible(m === 'custom');

    if (opts.persist){
      saveUIState({ practiceMode: m, tense: tenseSelect?.value || 'mixedAll' });
    }

    if (opts.rerender) renderPracticeInfo();
  }

  function fillGoalOptions(){
    goalSelect.innerHTML = '';
    for (const g of GOALS){
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.title;
      goalSelect.appendChild(opt);
    }
  }

  function fillTenseOptions(){
    tenseSelect.innerHTML = '';

    const optMixedAll = document.createElement('option');
    optMixedAll.value = 'mixedAll';
    optMixedAll.textContent = 'Смешанные упражнения';
    tenseSelect.appendChild(optMixedAll);

    const optCustom = document.createElement('option');
    optCustom.value = CUSTOM_TENSE_ID;
    optCustom.textContent = 'Пользовательские упражнения';
    tenseSelect.appendChild(optCustom);
  }

  function getCoreTenseIds(){
    return getFilteredMetas({ category: 'all' }).map(x=>x.id).filter(Boolean);
  }

  function getSavedCustomIds(){
    const ids = getCoreTenseIds();
    if (!ids.length) return [];
    const ui = loadUIState();
    const saved = Array.isArray(ui.customTenses) ? ui.customTenses : [];
    const valid = saved.filter(id => ids.includes(id));
    if (valid.length) return valid;
    return [];
  }

  function getCustomSelectedIds(){
    if (!customGrid) return getSavedCustomIds();
    const ids = [];
    customGrid.querySelectorAll('input[type="checkbox"][data-tense-id]').forEach((el)=>{
      if (el.checked) ids.push(el.getAttribute('data-tense-id'));
    });
    return ids;
  }

  function setCustomPickerVisible(visible){
    if (!customPicker) return;
    customPicker.hidden = !visible;
    if (visible) applyCustomSearchFilter();
  }

  function applyCustomSearchFilter(){
    if (!customGrid) return;
    const query = normalize(customSearchQuery || '');
    const hasQuery = !!query;
    let anyVisible = false;

    customGrid.querySelectorAll('.sh-custom-group').forEach((groupEl)=>{
      let groupVisible = false;
      groupEl.querySelectorAll('.sh-custom-subgroup').forEach((subEl)=>{
        let subVisible = false;
        subEl.querySelectorAll('.sh-custom-tense').forEach((itemEl)=>{
          const hay = String(itemEl.getAttribute('data-search') || '');
          const match = !hasQuery || hay.includes(query);
          itemEl.hidden = !match;
          if (match) subVisible = true;
        });
        subEl.hidden = !subVisible;
        if (subVisible) groupVisible = true;
      });
      groupEl.hidden = !groupVisible;
      if (groupVisible) anyVisible = true;
    });

    if (customSearchEmpty) customSearchEmpty.hidden = !hasQuery || anyVisible;
  }

  function saveCustomSelection(ids){
    saveUIState({ customTenses: ids });
    updateCustomHint(ids.length);
    refreshCustomGroupCounts();
    if (tenseSelect?.value === CUSTOM_TENSE_ID) renderPracticeInfo();
  }

  function setAllCustomSelection(checked){
    if (!customGrid) return;
    customGrid.querySelectorAll('input[type="checkbox"][data-tense-id]').forEach((el)=>{
      el.checked = !!checked;
    });
    saveCustomSelection(getCustomSelectedIds());
  }

  function refreshCustomGroupCounts(){
    if (!customGrid) return;
    customGrid.querySelectorAll('.sh-custom-group').forEach((groupEl)=>{
      const c = groupEl.querySelector('.sh-custom-group__count');
      if (!c) return;
      const boxes = Array.from(groupEl.querySelectorAll('input[type="checkbox"][data-tense-id]'));
      const total = boxes.length;
      const selected = boxes.filter((el)=> el.checked).length;
      c.textContent = `${selected}/${total}`;
    });
  }

  function renderCustomPicker(){
    if (!customGrid) return;
    const selected = new Set(getSavedCustomIds());
    const metas = sortMetasForDisplay(getFilteredMetas({ category: 'all' }));
    customGrid.innerHTML = '';
    const catOrder = ['present', 'past', 'future', 'universal'];
    const catMap = new Map();

    for (const meta of metas){
      const cat = String(meta.group || 'universal').toLowerCase();
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat).push(meta);
    }

    const orderedCats = [...catOrder.filter((cat)=> catMap.has(cat)), ...Array.from(catMap.keys()).filter((cat)=> !catOrder.includes(cat))];

    for (const cat of orderedCats){
      const groupMetas = catMap.get(cat) || [];
      if (!groupMetas.length) continue;

      const group = document.createElement('section');
      group.className = 'sh-custom-group';
      group.setAttribute('data-cat', cat);

      const groupHead = document.createElement('div');
      groupHead.className = 'sh-custom-group__head';

      const groupTitle = document.createElement('p');
      groupTitle.className = 'sh-custom-group__title';
      groupTitle.textContent = CATEGORY_LABEL[cat] || cat;

      const groupCount = document.createElement('span');
      groupCount.className = 'ik-badge sh-custom-group__count';
      groupCount.textContent = '0/0';

      const groupActions = document.createElement('div');
      groupActions.className = 'sh-custom-group__actions';

      const btnPickGroup = document.createElement('button');
      btnPickGroup.type = 'button';
      btnPickGroup.className = 'ik-btn';
      btnPickGroup.textContent = 'всё в разделе';
      btnPickGroup.addEventListener('click', ()=>{
        group.querySelectorAll('input[type="checkbox"][data-tense-id]').forEach((el)=>{ el.checked = true; });
        saveCustomSelection(getCustomSelectedIds());
      });

      const btnClearGroup = document.createElement('button');
      btnClearGroup.type = 'button';
      btnClearGroup.className = 'ik-btn';
      btnClearGroup.textContent = 'очистить раздел';
      btnClearGroup.addEventListener('click', ()=>{
        group.querySelectorAll('input[type="checkbox"][data-tense-id]').forEach((el)=>{ el.checked = false; });
        saveCustomSelection(getCustomSelectedIds());
      });

      groupActions.appendChild(btnPickGroup);
      groupActions.appendChild(btnClearGroup);

      groupHead.appendChild(groupTitle);
      groupHead.appendChild(groupCount);
      groupHead.appendChild(groupActions);
      group.appendChild(groupHead);

      const subgroupMap = new Map();
      for (const meta of groupMetas){
        const sub = deriveSubgroup(meta) || 'all';
        if (!subgroupMap.has(sub)) subgroupMap.set(sub, []);
        subgroupMap.get(sub).push(meta);
      }

      const subgroupOrder = [...SUBGROUP_ORDER.filter((s)=> subgroupMap.has(s)), ...Array.from(subgroupMap.keys()).filter((s)=> !SUBGROUP_ORDER.includes(s))];

      const subgroupWrap = document.createElement('div');
      subgroupWrap.className = 'sh-custom-group__body';

      for (const sub of subgroupOrder){
        const subMetas = subgroupMap.get(sub) || [];
        if (!subMetas.length) continue;

        const subCard = document.createElement('div');
        subCard.className = 'sh-custom-subgroup';

        const subTitle = document.createElement('p');
        subTitle.className = 'sh-custom-subgroup__title';
        subTitle.textContent = subgroupLabel(sub);
        subCard.appendChild(subTitle);

        const subItems = document.createElement('div');
        subItems.className = 'sh-custom-subgroup__items';

        for (const meta of subMetas){
          const label = document.createElement('label');
          label.className = 'sh-custom-tense';
          label.setAttribute('data-search', normalize([
            meta.title || meta.id || '',
            meta.subtitle || '',
            meta.hint || '',
            meta.id || '',
            subgroupLabel(sub),
            CATEGORY_LABEL[cat] || cat
          ].join(' ')));

          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.className = 'sh-custom-tense__cb';
          cb.setAttribute('data-tense-id', meta.id);
          cb.checked = selected.has(meta.id);

          const textWrap = document.createElement('span');
          textWrap.className = 'sh-custom-tense__text';

          const t = document.createElement('span');
          t.className = 'sh-custom-tense__title';
          t.textContent = meta.title || meta.id;

          const s = document.createElement('span');
          s.className = 'sh-custom-tense__sub';
          s.textContent = meta.subtitle || meta.hint || '';

          textWrap.appendChild(t);
          textWrap.appendChild(s);
          label.appendChild(cb);
          label.appendChild(textWrap);
          subItems.appendChild(label);

          cb.addEventListener('change', ()=>{
            saveCustomSelection(getCustomSelectedIds());
          });
        }

        subCard.appendChild(subItems);
        subgroupWrap.appendChild(subCard);
      }

      group.appendChild(subgroupWrap);
      customGrid.appendChild(group);
    }

    updateCustomHint(selected.size);
    refreshCustomGroupCounts();
    applyCustomSearchFilter();
  }

  function updateCustomHint(selectedCount){
    if (!customHint) return;
    const total = getFilteredMetas({ category: 'all' }).length;
    if (!selectedCount){
      customHint.textContent = `выбрано: 0 из ${total}. Отметь темы, чтобы собрать свой набор.`;
      return;
    }
    customHint.textContent = `выбрано: ${selectedCount} из ${total}`;
  }

  function buildMixedAllTense(){
    const metas = getFilteredMetas({
      category: activeCategory === 'all' ? 'all' : activeCategory,
      subgroup: activeCategory === 'all' ? 'all' : activeSubgroup
    });
    const grouped = new Map();
    for (const meta of metas){
      const t = REG.byId[meta.id];
      if (!t || !t.practice || !Array.isArray(t.practice.exercises)) continue;
      for (const ex of t.practice.exercises){
        const key = ex.id || 'all';
        if (!grouped.has(key)){
          grouped.set(key, {
            id: key,
            title: `${ex.title || key} - Mixed All`,
            kind: ex.kind || 'choice',
            items: []
          });
        }
        const target = grouped.get(key);
        if ((target.kind || 'choice') !== (ex.kind || 'choice')) continue;
        for (const item of (ex.items || [])){
          const cloned = Object.assign({}, item);
          cloned.id = `mixedAll_${meta.id}_${item.id || Math.random().toString(36).slice(2)}`;
          cloned.sourceTenseId = item.sourceTenseId || item.correctTenseId || meta.id;
          target.items.push(cloned);
        }
      }
    }
    return {
      id: 'mixedAll',
      title: 'Смешанные упражнения: все темы',
      subtitle: 'все темы выбранного фильтра и уровня',
      practice: {
        exercises: Array.from(grouped.values())
      }
    };
  }

  function buildCustomTense(selectedIds){
    const picked = Array.isArray(selectedIds) ? selectedIds : [];
    const grouped = new Map();
    const selectedSet = new Set(picked);

    for (const meta of getFilteredMetas({ category: 'all' })){
      if (!selectedSet.has(meta.id)) continue;
      const t = REG.byId[meta.id];
      if (!t || !t.practice || !Array.isArray(t.practice.exercises)) continue;
      for (const ex of t.practice.exercises){
        const key = ex.id || 'all';
        if (!grouped.has(key)){
          grouped.set(key, {
            id: key,
            title: `${ex.title || key} - Custom`,
            kind: ex.kind || 'choice',
            items: []
          });
        }
        const target = grouped.get(key);
        if ((target.kind || 'choice') !== (ex.kind || 'choice')) continue;
        for (const item of (ex.items || [])){
          const cloned = Object.assign({}, item);
          cloned.id = `custom_${meta.id}_${item.id || Math.random().toString(36).slice(2)}`;
          cloned.sourceTenseId = item.sourceTenseId || item.correctTenseId || meta.id;
          target.items.push(cloned);
        }
      }
    }

    return {
      id: CUSTOM_TENSE_ID,
      title: `Пользовательские упражнения (${picked.length} тем.)`,
      subtitle: 'набор по выбранным темам',
      practice: {
        exercises: Array.from(grouped.values())
      }
    };
  }

  function getTenseForPractice(id){
    if (id === 'mixedAll') return buildMixedAllTense();
    if (id === CUSTOM_TENSE_ID) return buildCustomTense(getCustomSelectedIds());
    const t = REG.byId[id];
    if (t) return t;
    // fallback
    const fallbackMeta =
      getFilteredMetas({ category: activeCategory, subgroup: activeSubgroup })[0] ||
      getFilteredMetas({ category: activeCategory, subgroup: 'all' })[0] ||
      getFilteredMetas({ category: 'all', subgroup: 'all' })[0] ||
      REG.INDEX?.[0];
    return REG.byId[fallbackMeta?.id];
  }

  function getSelectedGoalId(){
    const v = (goalSelect && goalSelect.value) ? goalSelect.value : 'all';
    return GOALS.some(x=>x.id === v) ? v : 'all';
  }

  function gatherExerciseIds(tenseObj, goalId){
    const list = (tenseObj.practice && tenseObj.practice.exercises) || [];
    if (goalId === 'all') return list.map(x=>x.id);
    return list.filter(x=>x.id === goalId || x.goal === goalId).map(x=>x.id);
  }

  function exerciseById(tenseObj, exId){
    const list = (tenseObj.practice && tenseObj.practice.exercises) || [];
    return list.find(x=>x.id === exId);
  }

  function totalQuestions(tenseObj, exIds){
    let n = 0;
    for (const id of exIds){
      const ex = exerciseById(tenseObj, id);
      n += (ex && ex.items) ? ex.items.length : 0;
    }
    return n;
  }

  function renderPracticeInfo(){
    if (!ensureLevelSelected()){
      if (practiceMeta) practiceMeta.textContent = 'выбери уровень';
      if (practiceBody) practiceBody.innerHTML = '';
      return;
    }
    const tenseId = tenseSelect.value || tenseSelect.options?.[0]?.value || (REG.INDEX[0] && REG.INDEX[0].id);
    const tenseObj = getTenseForPractice(tenseId);
    const goalId = getSelectedGoalId();
    const exIds = gatherExerciseIds(tenseObj, goalId);
    const total = totalQuestions(tenseObj, exIds);

    const prog = loadProgress(tenseObj.id);
    const mistakesCount = (prog.mistakes || []).length;

    if (practiceMeta){
      practiceMeta.textContent = `tasks: ${total} - mistakes: ${mistakesCount}`;
      practiceMeta.title = `${tenseObj.title || tenseObj.id}`;
    }

    if (btnRetry){
      btnRetry.disabled = mistakesCount === 0;
      btnRetry.title = mistakesCount ? '' : 'Нет ошибок';
    }

    if (btnStart){
      btnStart.disabled = total === 0;
      btnStart.title = total ? '' : 'Нет заданий: выбери темы';
    }

    if (tenseId === CUSTOM_TENSE_ID && getCustomSelectedIds().length === 0){
      const box = document.createElement('div');
      box.className = 'sh-highlight';
      box.innerHTML = '<p class="sh-highlight-title">Пользовательские упражнения</p><ul class="sh-highlight-list"><li>Сначала отметь хотя бы одну тему в блоке выбора выше.</li><li>Удобно начать с одной категории: present / past / future.</li></ul>';
      practiceBody.innerHTML = '';
      practiceBody.appendChild(box);
      saveUIState({ goal: goalId, tense: tenseId, category: activeCategory, subgroup: activeSubgroup });
      return;
    }

    // Summary card
    const box = document.createElement('div');
    box.className = 'sh-highlight';

    const title = document.createElement('p');
    title.className = 'sh-highlight-title';
    title.textContent = `${tenseObj.title || tenseObj.id} - progress`;
    box.appendChild(title);

    const ul = document.createElement('ul');
    ul.className = 'sh-highlight-list';

    const exList = (tenseObj.practice && tenseObj.practice.exercises) || [];
    for (const ex of exList){
      const best = prog.best && prog.best[ex.id];
      const qCount = (ex.items || []).length;
      const bestText = best ? `${best.correct}/${best.total}` : `0/${qCount}`;
      const li = document.createElement('li');
      li.textContent = `${ex.title}: best ${bestText}`;
      ul.appendChild(li);
    }

    const liM = document.createElement('li');
    liM.textContent = `mastery: ${prog.mastery || 0}/5`;
    ul.appendChild(liM);

    box.appendChild(ul);

    practiceBody.innerHTML = '';
    practiceBody.appendChild(box);

    saveUIState({ goal: goalId, tense: tenseId, category: activeCategory, subgroup: activeSubgroup });
  }

  // -------------------------
  // Practice run (choice/input/multi/match/multi_input/inline_select)
  // -------------------------
  function startRun(tenseObj, exerciseIds, opts, mountEl){
    const practiceBody = mountEl || document.getElementById('tensesPracticeBody');
    const options = Object.assign({ showAfterEach: true, onlyMistakes: false }, opts || {});
    const exercises = (tenseObj.practice && tenseObj.practice.exercises) || [];
    const chosen = exercises.filter(ex => exerciseIds.includes(ex.id));

    const prog = loadProgress(tenseObj.id);
    const mistakesSet = new Set(prog.mistakes || []);

    function saveMistakesSnapshot(){
      try{
        const p = loadProgress(tenseObj.id);
        p.mistakes = Array.from(mistakesSet);
        saveProgress(tenseObj.id, p);
      } catch(_){}
    }

    // -------------------------
    // Randomization helpers
    // -------------------------
    function shuffleInPlace(a){
      for(let i=a.length-1;i>0;i--){
        const j = Math.floor(Math.random()*(i+1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    function prepareItemForRun(kind, item){
      // Shallow clone + copy arrays we mutate
      const it = Object.assign({}, item);
      if (Array.isArray(item.options)) it.options = [...item.options];
      if (Array.isArray(item.correctIndices)) it.correctIndices = [...item.correctIndices];
      if (Array.isArray(item.pairs)) it.pairs = item.pairs.map(p => ({ left: p.left, right: p.right }));
      if (Array.isArray(item.segments)) it.segments = [...item.segments];
      if (Array.isArray(item.blanks)){
        it.blanks = item.blanks.map((b)=>({
          options: Array.isArray(b?.options) ? [...b.options] : [],
          correctIndex: Number(b?.correctIndex)
        }));
      }

      // Shuffle options to avoid fixed patterns
      if ((kind === 'choice' || kind === 'multi') && Array.isArray(it.options) && it.options.length > 1){
        const idxs = it.options.map((_, i)=>i);
        shuffleInPlace(idxs);
        const oldToNew = new Map();
        idxs.forEach((oldIdx, newIdx)=> oldToNew.set(oldIdx, newIdx));

        it.options = idxs.map(i => it.options[i]);

        if (kind === 'choice'){
          const oldCorrect = Number(it.correctIndex);
          it.correctIndex = oldToNew.has(oldCorrect) ? oldToNew.get(oldCorrect) : oldCorrect;
        } else {
          const oldCorrects = (it.correctIndices || []).map(x=>Number(x));
          it.correctIndices = oldCorrects
            .map(oldIdx => oldToNew.has(oldIdx) ? oldToNew.get(oldIdx) : oldIdx)
            .sort((a,b)=>a-b);
        }
      }

      // Shuffle pair rows in matching tasks too
      if (kind === 'match' && Array.isArray(it.pairs) && it.pairs.length > 1){
        shuffleInPlace(it.pairs);
      }

      return it;
    }

    // Build task queue (then shuffle it so questions are not always in the same order)
    const queue = [];
    for (const ex of chosen){
      for (const item of (ex.items || [])){
        if (options.onlyMistakes && !mistakesSet.has(item.id)) continue;
        const prepared = prepareItemForRun(ex.kind, item);
        queue.push({ exId: ex.id, exTitle: ex.title, kind: ex.kind, item: prepared });
      }
    }

    // Shuffle the final queue (keeps the exercise label per question, but randomizes sequence)
    shuffleInPlace(queue);

    if (options.onlyMistakes && queue.length === 0){
      setStatus('нет ошибок');
      return;
    }

    // Clear any old key handler
    if (runKeyHandler){
      document.removeEventListener('keydown', runKeyHandler, true);
      runKeyHandler = null;
    }

    practiceBody.innerHTML = '';

    const runWrap = document.createElement('div');
    runWrap.className = 'sh-practice-run';

    runWrap.innerHTML = `
      <div class="ik-row">
        <span class="ik-badge" id="shTRunEx">exercise</span>
        <span class="ik-badge" id="shTRunQ">question</span>
        <span class="ik-spacer" aria-hidden="true"></span>
        <label class="ik-label" style="display:flex; align-items:center; gap:8px;">
          <input type="checkbox" id="shTRunShowAfter" ${options.showAfterEach ? 'checked' : ''} />
          show answers after each
        </label>
        <button class="ik-btn" id="shTRunExit" type="button">exit</button>
      </div>

      <div class="ik-divider"></div>

      <p class="ik-prompt" id="shTRunInstr">...</p>
      <div id="shTRunHint" class="sh-hint" hidden></div>
      <div class="sh-progress" id="shTRunProgress"><div></div></div>
      <div class="sh-run-card" id="shTRunCard"></div>

      <div class="ik-divider"></div>

      <div class="ik-feedback" id="shTRunFeedback" data-state="idle" aria-live="polite">
        <div class="ik-feedback__stamp" id="shTRunStamp">ready</div>
        <p class="ik-feedback__line" id="shTRunLine">выбери ответ или введи ответ и нажми check</p>
      </div>

      <div class="ik-row" style="margin-top:12px; gap:10px;">
        <button class="ik-btn ik-btn--black" id="shTRunCheckNext" type="button">check</button>
        <button class="ik-btn" id="shTRunDontKnow" type="button">не знаю</button>
        <button class="ik-btn" id="shTRunExplainBtn" type="button" aria-disabled="true" title="перед объяснением дайте свой ответ">объяснение</button>
        <button class="ik-btn" id="shTRunOpenRuleBtn" type="button" aria-disabled="true" title="сначала проверь ответ">к правилу</button>
      </div>

      <div id="shTRunExplainBox" class="sh-hint" hidden></div>
    `;

    practiceBody.appendChild(runWrap);

    const elEx = runWrap.querySelector('#shTRunEx');
    const elQ  = runWrap.querySelector('#shTRunQ');
    const elInstr = runWrap.querySelector('#shTRunInstr');
    const elCard = runWrap.querySelector('#shTRunCard');

    const elFb = runWrap.querySelector('#shTRunFeedback');
    const elStamp = runWrap.querySelector('#shTRunStamp');
    const elLine = runWrap.querySelector('#shTRunLine');
    const btnExit = runWrap.querySelector('#shTRunExit');
    const btnCheckNext = runWrap.querySelector('#shTRunCheckNext');
    const btnDontKnow = runWrap.querySelector('#shTRunDontKnow');
    const btnExplain = runWrap.querySelector('#shTRunExplainBtn');
    const btnOpenRule = runWrap.querySelector('#shTRunOpenRuleBtn');
    const elExplain = runWrap.querySelector('#shTRunExplainBox');
    const cbShowAfterLocal = runWrap.querySelector('#shTRunShowAfter');

    if (elExplain){
      elExplain.style.display = 'block';
      elExplain.style.whiteSpace = 'pre-line';
    }

    let idx = 0;
    let checked = false;
    let lastCheck = null;

    // state per question
    let selectedIndex = null;
    let selectedSet = new Set(); // for multi
    let matchState = null; // { rights:[], selects:[] }
    let multiInputs = null; // [inputEl,...]
    let inlineSelectState = null; // { slots:[{mount,select,options,correctIndex}], segments:[] }

    // scoring per exercise
    const exTotals = {};
    const exCorrect = {};

    function setFeedback(state, stamp, line){
      elFb.setAttribute('data-state', state);
      elStamp.textContent = stamp;
      elLine.textContent = line;
    }

    function resetPerQuestionState(){
      selectedIndex = null;
      selectedSet = new Set();
      matchState = null;
      multiInputs = null;
      inlineSelectState = null;
      lastCheck = null;
    }

    function setActionAvailability(isAnswered){
      if (btnExplain){
        btnExplain.dataset.locked = isAnswered ? '0' : '1';
        btnExplain.setAttribute('aria-disabled', isAnswered ? 'false' : 'true');
        btnExplain.style.opacity = isAnswered ? '' : '0.55';
        btnExplain.title = isAnswered ? 'показать объяснение' : 'перед объяснением дайте свой ответ';
        btnExplain.textContent = 'объяснение';
      }

      if (btnOpenRule){
        btnOpenRule.dataset.locked = isAnswered ? '0' : '1';
        btnOpenRule.setAttribute('aria-disabled', isAnswered ? 'false' : 'true');
        btnOpenRule.style.opacity = isAnswered ? '' : '0.55';
        btnOpenRule.title = isAnswered ? 'открыть правило по этому заданию' : 'сначала проверь ответ';
      }
    }

    const TENSE_TEXT_PATTERNS = [
      ['presentSimple', /\bpresent simple\b/i],
      ['presentContinuous', /\bpresent continuous\b/i],
      ['presentPerfectContinuous', /\bpresent perfect continuous\b/i],
      ['presentPerfect', /\bpresent perfect\b/i],
      ['pastSimple', /\bpast simple\b/i],
      ['pastContinuous', /\bpast continuous\b/i],
      ['pastPerfectContinuous', /\bpast perfect continuous\b/i],
      ['pastPerfect', /\bpast perfect\b/i],
      ['futureSimple', /\bfuture simple\b/i],
      ['futureContinuous', /\bfuture continuous\b/i],
      ['futurePerfectContinuous', /\bfuture perfect continuous\b/i],
      ['futurePerfect', /\bfuture perfect\b/i],
    ];

    function qText(v){
      const t = String(v || '').trim();
      return t ? `«${t}»` : '—';
    }

    function joinReadable(items){
      const arr = (items || []).map(x=>String(x || '').trim()).filter(Boolean);
      return arr.length ? arr.map(x=>`«${x}»`).join(', ') : '—';
    }

    function pushExplainLine(lines, text){
      const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
      if (!cleaned) return;
      const key = normalize(cleaned).replace(/[^a-zа-я0-9]+/gi, ' ').trim();
      for (const prev of lines){
        const prevKey = normalize(prev).replace(/[^a-zа-я0-9]+/gi, ' ').trim();
        if (prevKey === key) return;
      }
      lines.push(cleaned);
    }

    function getTenseMetaById(id){
      const key = String(id || '').trim();
      if (!key) return null;
      const meta = (REG.INDEX || []).find(x => x.id === key);
      if (meta) return { id: meta.id, title: meta.title || meta.id, hint: meta.hint || '', subtitle: meta.subtitle || '' };
      const obj = REG.byId && REG.byId[key];
      if (obj && obj.title){
        return { id: obj.id || key, title: obj.title || key, hint: obj.hint || '', subtitle: obj.subtitle || '' };
      }
      return null;
    }

    function detectTenseIdFromText(text){
      const src = String(text || '');
      if (!src) return '';
      for (const [id, re] of TENSE_TEXT_PATTERNS){
        if (re.test(src)) return id;
      }
      return '';
    }

    function collectAcceptedSamples(item){
      const out = [];
      if (Array.isArray(item?.accepted)) out.push(...item.accepted);
      if (Array.isArray(item?.inputs)){
        for (const spec of item.inputs){
          if (Array.isArray(spec?.accepted)) out.push(...spec.accepted);
        }
      }
      return out.map(x=>String(x || '').trim()).filter(Boolean);
    }

    function detectTenseIdFromAnswerForms(item){
      const src = normalize(collectAcceptedSamples(item).join(' | '));
      if (!src) return '';

      const ids = new Set();
      if (/\bwill have been\b/.test(src) && /\bing\b/.test(src)) ids.add('futurePerfectContinuous');
      if (/\bhad been\b/.test(src) && /\bing\b/.test(src)) ids.add('pastPerfectContinuous');
      if (/\b(?:have|has) been\b/.test(src) && /\bing\b/.test(src)) ids.add('presentPerfectContinuous');

      if (/\bwill have\b/.test(src) && /\b(?:done|gone|been|seen|had|made|taken|written|drunk|eaten|finished|worked|studied|arrived|left|bought|told|given|found|known|thought|read)\b/.test(src)) ids.add('futurePerfect');
      if (/\bhad\b/.test(src) && /\b(?:done|gone|been|seen|had|made|taken|written|drunk|eaten|finished|worked|studied|arrived|left|bought|told|given|found|known|thought|read)\b/.test(src)) ids.add('pastPerfect');
      if (/\b(?:have|has)\b/.test(src) && /\b(?:done|gone|been|seen|had|made|taken|written|drunk|eaten|finished|worked|studied|arrived|left|bought|told|given|found|known|thought|read)\b/.test(src)) ids.add('presentPerfect');

      if (/\bwill be\b/.test(src) && /\bing\b/.test(src)) ids.add('futureContinuous');
      if (/\b(?:was|were)\b/.test(src) && /\bing\b/.test(src)) ids.add('pastContinuous');
      if (/\b(?:am|is|are)\b/.test(src) && /\bing\b/.test(src)) ids.add('presentContinuous');

      if (/\bwill\b/.test(src) && !/\bwill (?:be|have)\b/.test(src)) ids.add('futureSimple');
      if (/\bdid\b/.test(src) || /\b(?:went|saw|came|got|took|made|wrote|ate|drank|spoke|thought|found|knew|said|left|arrived|started|stopped|rang|called)\b/.test(src)) ids.add('pastSimple');
      if ((/\b(?:do|does)\b/.test(src) || /\b(?:always|usually|often|sometimes|never|every)\b/.test(src)) && !ids.size) ids.add('presentSimple');

      if (ids.size === 1) return Array.from(ids)[0];
      return '';
    }

    function inferQuestionTenseMeta(q, check){
      if (!q) return getTenseMetaById(tenseObj.id);
      const item = q.item || {};

      const direct = [item.correctTenseId, item.sourceTenseId, item._sourceTenseId];
      for (const id of direct){
        const meta = getTenseMetaById(id);
        if (meta) return meta;
      }

      const rawId = String(item.id || '');
      const m = rawId.match(/^(?:mixedAll|custom|dy)_([^_]+)_/);
      if (m && m[1]){
        const meta = getTenseMetaById(m[1]);
        if (meta) return meta;
      }

      if (Array.isArray(item.candidateTenseIds) && Number.isInteger(item.correctIndex)){
        const guessed = item.candidateTenseIds[item.correctIndex];
        const meta = getTenseMetaById(guessed);
        if (meta) return meta;
      }

      if (Array.isArray(item.options) && Number.isInteger(item.correctIndex) && item.options[item.correctIndex]){
        const idFromOption = detectTenseIdFromText(item.options[item.correctIndex]);
        const meta = getTenseMetaById(idFromOption);
        if (meta) return meta;
      }

      if (check && check.correctText){
        const idFromCheck = detectTenseIdFromText(check.correctText);
        const meta = getTenseMetaById(idFromCheck);
        if (meta) return meta;
      }

      const idFromForms = detectTenseIdFromAnswerForms(item);
      const metaFromForms = getTenseMetaById(idFromForms);
      if (metaFromForms) return metaFromForms;

      const fallback = getTenseMetaById(tenseObj.id);
      if (fallback) return fallback;
      return null;
    }

    function detectPromptSignals(prompt){
      const t = String(prompt || '').toLowerCase();
      const out = [];
      const add = (re, text)=>{ if (re.test(t)) out.push(text); };

      add(/\b(now|right now|at the moment|currently)\b|\blook\b|\blisten\b/, 'есть маркер текущего момента');
      add(/\b(always|usually|often|sometimes|never|generally|normally)\b|\bevery\s+(day|week|month|year)\b|\bon\s+\w+s\b|\bat weekends?\b/, 'есть маркер регулярности/привычки');
      add(/\b(yesterday|last\s+\w+|\d+\s+ago|in\s+\d{4}|then)\b/, 'есть точка в прошлом');
      add(/\bwhile\b/, 'есть while (обычно фон/процесс)');
      add(/\b(already|just|yet|ever|so far|recently|lately)\b/, 'есть perfect-маркер');
      add(/\b(for|since|how long)\b/, 'есть маркер длительности');
      add(/\b(by the time|before)\b|\bby\s+(tomorrow|then|next|\d)/, 'есть дедлайн/граница во времени');
      add(/\b(tomorrow|next\s+\w+|soon|this time tomorrow)\b/, 'есть ориентир на будущее');

      const uniqOut = [];
      const seen = new Set();
      for (const v of out){
        const key = normalize(v);
        if (!seen.has(key)){
          seen.add(key);
          uniqOut.push(v);
        }
      }
      return uniqOut;
    }

    function nearestAccepted(raw, accepted){
      const user = normalize(raw);
      let best = null;
      for (const candidate of (accepted || [])){
        const c = String(candidate || '').trim();
        if (!c) continue;
        const d = levenshtein(user, normalize(c));
        if (!best || d < best.dist){
          best = { text: c, dist: d };
        }
      }
      return best;
    }

    function tokenDiff(raw, correct){
      const user = tokensNormalized(raw);
      const good = tokensNormalized(correct);

      const cntUser = Object.create(null);
      for (const x of user) cntUser[x] = (cntUser[x] || 0) + 1;

      const missing = [];
      for (const x of good){
        if (cntUser[x] > 0) cntUser[x] -= 1;
        else missing.push(x);
      }

      const extra = [];
      for (const x of user){
        if (cntUser[x] > 0){
          extra.push(x);
          cntUser[x] -= 1;
        }
      }

      return { missing: uniq(missing), extra: uniq(extra) };
    }

    function cleanLegacyExplain(raw){
      let t = String(raw || '').trim();
      if (!t) return '';
      t = t.replace(/\s+/g, ' ');
      t = t.replace(/^В этом предложении важно значение ситуации, а не только форма\.\s*/i, '');
      t = t.replace(/^В исходной фразе нарушена форма времени или порядок слов\.\s*/i, '');
      return t.trim();
    }

    const STATIVE_FORMS = {
      know: ['know', 'knows', 'knew', 'known'],
      understand: ['understand', 'understands', 'understood'],
      believe: ['believe', 'believes', 'believed'],
      remember: ['remember', 'remembers', 'remembered'],
      forget: ['forget', 'forgets', 'forgot', 'forgotten'],
      mean: ['mean', 'means', 'meant'],
      need: ['need', 'needs', 'needed'],
      want: ['want', 'wants', 'wanted'],
      like: ['like', 'likes', 'liked'],
      love: ['love', 'loves', 'loved'],
      hate: ['hate', 'hates', 'hated'],
      prefer: ['prefer', 'prefers', 'preferred'],
      own: ['own', 'owns', 'owned'],
      belong: ['belong', 'belongs', 'belonged'],
      consist: ['consist', 'consists', 'consisted'],
      contain: ['contain', 'contains', 'contained'],
      include: ['include', 'includes', 'included'],
      seem: ['seem', 'seems', 'seemed']
    };

    const STATIVE_ING_TO_BASE = {
      knowing: 'know',
      understanding: 'understand',
      believing: 'believe',
      remembering: 'remember',
      forgetting: 'forget',
      meaning: 'mean',
      needing: 'need',
      wanting: 'want',
      liking: 'like',
      loving: 'love',
      hating: 'hate',
      preferring: 'prefer',
      owning: 'own',
      belonging: 'belong',
      consisting: 'consist',
      containing: 'contain',
      including: 'include',
      seeming: 'seem'
    };

    function detectStativeContinuousIssue(prompt, correctText){
      const src = normalize(prompt || '');
      if (!src) return null;
      const ingWords = src.match(/\b[a-z]+ing\b/g) || [];
      if (!ingWords.length) return null;

      const corrected = normalize(correctText || '');
      for (const ing of ingWords){
        const base = STATIVE_ING_TO_BASE[ing] || '';
        if (!base || !STATIVE_FORMS[base]) continue;

        const hasContinuousAux = new RegExp(`\\b(?:am|is|are|was|were|be|been|being|have been|has been|had been|will be|will have been)\\s+${ing}\\b`).test(src);
        const hasBareIng = new RegExp(`\\b${ing}\\b`).test(src);
        if (!hasContinuousAux && !hasBareIng) continue;

        let chosenForm = '';
        if (corrected){
          for (const form of STATIVE_FORMS[base]){
            if (new RegExp(`\\b${form}\\b`).test(corrected)){
              chosenForm = form;
              break;
            }
          }
        }

        return { base, ing, chosenForm };
      }

      return null;
    }

    const IRREGULAR_FORMS = {
      be: { past: 'was', pp: 'been' },
      have: { past: 'had', pp: 'had' },
      do: { past: 'did', pp: 'done' },
      go: { past: 'went', pp: 'gone' },
      see: { past: 'saw', pp: 'seen' },
      come: { past: 'came', pp: 'come' },
      make: { past: 'made', pp: 'made' },
      take: { past: 'took', pp: 'taken' },
      write: { past: 'wrote', pp: 'written' },
      read: { past: 'read', pp: 'read' },
      eat: { past: 'ate', pp: 'eaten' },
      drink: { past: 'drank', pp: 'drunk' },
      ride: { past: 'rode', pp: 'ridden' },
      speak: { past: 'spoke', pp: 'spoken' },
      know: { past: 'knew', pp: 'known' },
      find: { past: 'found', pp: 'found' },
      think: { past: 'thought', pp: 'thought' },
      tell: { past: 'told', pp: 'told' },
      give: { past: 'gave', pp: 'given' },
      put: { past: 'put', pp: 'put' },
      win: { past: 'won', pp: 'won' },
      fall: { past: 'fell', pp: 'fallen' },
      leave: { past: 'left', pp: 'left' },
      buy: { past: 'bought', pp: 'bought' },
      get: { past: 'got', pp: 'gotten' },
      begin: { past: 'began', pp: 'begun' },
      choose: { past: 'chose', pp: 'chosen' },
      learn: { past: 'learned', pp: 'learned' },
      meet: { past: 'met', pp: 'met' }
    };

    function toThirdPerson(base){
      const v = String(base || '').toLowerCase();
      if (!v) return '';
      if (v === 'be') return 'is';
      if (v === 'have') return 'has';
      if (v.endsWith('y') && !/[aeiou]y$/.test(v)) return `${v.slice(0, -1)}ies`;
      if (/(s|x|z|ch|sh|o)$/.test(v)) return `${v}es`;
      return `${v}s`;
    }

    function toIng(base){
      const v = String(base || '').toLowerCase();
      if (!v) return '';
      if (v === 'be') return 'being';
      if (v.endsWith('ie')) return `${v.slice(0, -2)}ying`;
      if (v.endsWith('e') && !/(ee|ye|oe)$/.test(v)) return `${v.slice(0, -1)}ing`;
      return `${v}ing`;
    }

    function toPast(base){
      const v = String(base || '').toLowerCase();
      if (!v) return '';
      if (v === 'be') return 'was';
      if (IRREGULAR_FORMS[v]?.past) return IRREGULAR_FORMS[v].past;
      if (v.endsWith('y') && !/[aeiou]y$/.test(v)) return `${v.slice(0, -1)}ied`;
      if (v.endsWith('e')) return `${v}d`;
      return `${v}ed`;
    }

    function toParticiple(base){
      const v = String(base || '').toLowerCase();
      if (!v) return '';
      if (IRREGULAR_FORMS[v]?.pp) return IRREGULAR_FORMS[v].pp;
      return toPast(v);
    }

    function detectSubjectRole(prompt){
      const raw = String(prompt || '');
      const beforeBlank = raw.split(/_{2,}/)[0] || '';
      const tokens = normalize(beforeBlank).split(' ').filter(Boolean);
      if (tokens.includes('and')) return 'plural';
      const last = tokens[tokens.length - 1] || '';
      if (last === 'i') return 'i';
      if (last === 'you' || last === 'we' || last === 'they') return 'plural';

      const bracket = (raw.match(/\(([^)]+)\)/) || [])[1] || '';
      const bNorm = normalize(bracket);
      if (/\byou\b/.test(bNorm)) return 'plural';
      if (/\bi\b/.test(bNorm)) return 'i';
      if (/\bwe\b|\bthey\b/.test(bNorm)) return 'plural';
      return 'singular';
    }

    function extractBaseVerb(prompt){
      const m = String(prompt || '').match(/\(([^)]+)\)/);
      if (!m) return '';
      const inside = String(m[1] || '').toLowerCase().replace(/[^a-z\s/]/g, ' ');
      const parts = inside.split(/[\/\s]+/).map(x => x.trim()).filter(Boolean);
      for (let i = parts.length - 1; i >= 0; i -= 1){
        const token = parts[i];
        if (token === 'to' || token === 'not' || token === 'already' || token === 'just' || token === 'ever' || token === 'never') continue;
        return token;
      }
      return '';
    }

    function buildFormByTense(baseVerb, tenseId, subjectRole){
      const v = String(baseVerb || '').toLowerCase();
      const id = String(tenseId || '');
      if (!v || !id) return '';

      const role = subjectRole || 'singular';
      const haveAux = role === 'singular' ? 'has' : 'have';
      const beAuxPresent = role === 'i' ? 'am' : (role === 'plural' ? 'are' : 'is');
      const beAuxPast = role === 'plural' ? 'were' : 'was';

      if (id === 'presentSimple'){
        if (v === 'be') return beAuxPresent;
        if (v === 'have') return haveAux;
        return role === 'singular' ? toThirdPerson(v) : v;
      }
      if (id === 'presentContinuous') return `${beAuxPresent} ${toIng(v)}`;
      if (id === 'presentPerfect') return `${haveAux} ${toParticiple(v)}`;
      if (id === 'presentPerfectContinuous') return `${haveAux} been ${toIng(v)}`;

      if (id === 'pastSimple'){
        if (v === 'be') return beAuxPast;
        return toPast(v);
      }
      if (id === 'pastContinuous') return `${beAuxPast} ${toIng(v)}`;
      if (id === 'pastPerfect') return `had ${toParticiple(v)}`;
      if (id === 'pastPerfectContinuous') return `had been ${toIng(v)}`;

      if (id === 'futureSimple') return `will ${v}`;
      if (id === 'futureContinuous') return `will be ${toIng(v)}`;
      if (id === 'futurePerfect') return `will have ${toParticiple(v)}`;
      if (id === 'futurePerfectContinuous') return `will have been ${toIng(v)}`;

      return '';
    }

    function looksLikeTenseLabel(text){
      return /\b(present|past|future)\b/i.test(String(text || ''));
    }

    function stripPromptHints(prompt){
      return String(prompt || '')
        .replace(/\s*\([^)]*\)/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function fillPromptBlanks(prompt, parts){
      let out = stripPromptHints(prompt);
      const forms = Array.isArray(parts) ? parts : [];
      for (const part of forms){
        out = out.replace(/_{2,}/, String(part || '').trim());
      }
      out = out.replace(/\s+/g, ' ').replace(/\s+([,.!?;:])/g, '$1').trim();
      if (out && !/[.!?]$/.test(out)) out += '.';
      return out;
    }

    function buildResolvedSentence(q, check, meta){
      const item = q?.item || {};
      const prompt = String(item.prompt || '').trim();
      if (!prompt || !check) return '';

      if (check.kind === 'input' || check.kind === 'correction'){
        const correct = String(check.correctText || check.closestText || '').trim();
        if (!correct) return '';
        if (!/_{2,}/.test(prompt)){
          if (/\s/.test(correct)) return correct;
          return '';
        }
        const blankCount = (prompt.match(/_{2,}/g) || []).length;
        if (blankCount !== 1 && /\s/.test(correct)) return correct;
        return fillPromptBlanks(prompt, [correct]);
      }

      if (check.kind === 'multi_input'){
        const parts = Array.isArray(check.correctParts) ? check.correctParts : [];
        if (!parts.length || !/_{2,}/.test(prompt)) return '';
        return fillPromptBlanks(prompt, parts);
      }

      if (check.kind === 'choice' && /_{2,}/.test(prompt)){
        const correctText = String(check.correctText || '').trim();
        let form = '';
        if (correctText && !looksLikeTenseLabel(correctText)){
          form = correctText;
        } else {
          const tenseId = meta?.id || detectTenseIdFromText(correctText);
          const baseVerb = extractBaseVerb(prompt);
          const role = detectSubjectRole(prompt);
          form = buildFormByTense(baseVerb, tenseId, role);
        }
        if (!form) return '';
        return fillPromptBlanks(prompt, [form]);
      }

      if (check.kind === 'inline_select'){
        return String(check.correctSentence || '').trim();
      }

      return '';
    }

    function buildSmartExplanation(q, check){
      const item = q?.item || {};
      const lines = [];
      const meta = inferQuestionTenseMeta(q, check);

      if (meta?.title){
        pushExplainLine(lines, `Время: ${meta.title}.`);
      }

      const signals = detectPromptSignals(item.prompt || '');
      if (signals.length){
        pushExplainLine(lines, `Сигналы в предложении: ${signals.slice(0, 3).join('; ')}.`);
      }

      if (check){
        if (check.kind === 'choice'){
          pushExplainLine(lines, `Правильно: ${qText(check.correctText)}.`);
        } else if (check.kind === 'input' || check.kind === 'correction'){
          pushExplainLine(lines, `Правильно: ${qText(check.correctText || check.closestText)}.`);

          const stativeIssue = detectStativeContinuousIssue(item.prompt || '', check.correctText || check.closestText || '');
          if (stativeIssue){
            pushExplainLine(lines, `Глагол «${stativeIssue.base}» — state verb (состояние), поэтому форма Continuous «${stativeIssue.ing}» здесь не используется.`);
            if (stativeIssue.chosenForm){
              pushExplainLine(lines, `Нужна форма без -ing: «${stativeIssue.chosenForm}» (по контексту предложения).`);
            } else {
              pushExplainLine(lines, 'Нужна форма без -ing в нужном времени (Simple/Perfect по контексту).');
            }
          }
        } else if (check.kind === 'multi'){
          if (check.ok){
            pushExplainLine(lines, `Верно: нужно выбрать ${joinReadable(check.correctLabels)}.`);
          } else {
            pushExplainLine(lines, `Правильный набор: ${joinReadable(check.correctLabels)}.`);
          }
        } else if (check.kind === 'match'){
          if (check.ok){
            pushExplainLine(lines, 'Все пары собраны верно.');
          } else {
            const wrong = (check.mismatches || []).slice(0, 3).map(x=>`${x.left} -> ${x.user || '—'} (нужно: ${x.right})`);
            if (wrong.length) pushExplainLine(lines, `Неверные пары: ${wrong.join(' | ')}.`);
          }
        } else if (check.kind === 'multi_input'){
          if (check.ok){
            pushExplainLine(lines, `Верные формы: ${joinReadable(check.correctParts)}.`);
            if (check.anyAlmost) pushExplainLine(lines, 'Есть мелкие опечатки, но логика формы верная.');
          } else {
            if (check.correctParts?.length) pushExplainLine(lines, `Правильные формы: ${joinReadable(check.correctParts)}.`);
          }
        } else if (check.kind === 'inline_select'){
          if (check.ok) pushExplainLine(lines, `Верно: ${check.correctCount}/${check.total}.`);
          else pushExplainLine(lines, `Результат: ${check.correctCount}/${check.total}.`);
        }

        const resolved = buildResolvedSentence(q, check, meta);
        if (resolved){
          pushExplainLine(lines, `Полное предложение: ${qText(resolved)}.`);
        }
      }

      const quickMeta = (meta && typeof QUICK === 'object' && QUICK && QUICK[meta.id]) ? QUICK[meta.id] : null;
      if (quickMeta?.formula){
        pushExplainLine(lines, `Формула: ${quickMeta.formula}.`);
      }

      const base = cleanLegacyExplain(item.explain || '');
      if (lines.length < 3 && base){
        pushExplainLine(lines, base);
      }

      if (!lines.length) return 'Объяснение пока не готово.';
      return lines.join('\n');
    }

    function renderChoice(q){
      const p = document.createElement('div');
      p.className = 'sh-run-prompt';
      p.textContent = q.item.prompt;
      elCard.appendChild(p);

      const list = document.createElement('div');
      list.className = 'sh-choice-list';

      q.item.options.forEach((opt, i)=>{
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ik-btn sh-choice';
        btn.textContent = `${String.fromCharCode(97+i)}) ${opt}`;
        btn.addEventListener('click', ()=>{
          if (checked) return;
          selectedIndex = i;
          [...list.querySelectorAll('button')].forEach(b=> b.classList.remove('is-picked'));
          btn.classList.add('is-picked');
        });
        list.appendChild(btn);
      });

      elCard.appendChild(list);
    }

    function renderInput(q){
      const p = document.createElement('div');
      p.className = 'sh-run-prompt';
      p.textContent = q.item.prompt;
      elCard.appendChild(p);

      const row = document.createElement('div');
      row.className = 'ik-row';
      row.style.marginTop = '12px';

      const input = document.createElement('input');
      input.className = 'ik-input';
      input.id = 'shTRunInput';
      input.type = 'text';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.placeholder = 'Answer...';

      row.appendChild(input);
      elCard.appendChild(row);
      input.focus?.();
    }

    function renderMulti(q){
      const p = document.createElement('div');
      p.className = 'sh-run-prompt';
      p.textContent = q.item.prompt;
      elCard.appendChild(p);

      const list = document.createElement('div');
      list.className = 'sh-choice-list';

      q.item.options.forEach((opt, i)=>{
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ik-btn sh-choice';
        btn.textContent = `${String.fromCharCode(97+i)}) ${opt}`;
        btn.addEventListener('click', ()=>{
          if (checked) return;
          if (selectedSet.has(i)) selectedSet.delete(i);
          else selectedSet.add(i);
          btn.classList.toggle('is-picked', selectedSet.has(i));
        });
        list.appendChild(btn);
      });

      elCard.appendChild(list);

      const hint = document.createElement('p');
      hint.className = 'ik-footnote';
      hint.textContent = 'мультивыбор: можно выбрать несколько';
      elCard.appendChild(hint);
    }

    function shuffle(arr){
      const a = [...arr];
      for(let i=a.length-1;i>0;i--){
        const j = Math.floor(Math.random()*(i+1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    function renderMatch(q){
      const p = document.createElement('div');
      p.className = 'sh-run-prompt';
      p.textContent = q.item.prompt;
      elCard.appendChild(p);

      const pairs = q.item.pairs || [];
      const rights = shuffle(pairs.map(x=>x.right));
      const wrap = document.createElement('div');
      wrap.style.display = 'grid';
      wrap.style.gridTemplateColumns = '1fr 1fr';
      wrap.style.gap = '10px';
      wrap.style.marginTop = '12px';

      const selects = [];

      pairs.forEach((pair, idx)=>{
        const left = document.createElement('div');
        left.className = 'ik-badge';
        left.textContent = pair.left;

        const sel = document.createElement('select');
        sel.className = 'ik-select';
        sel.setAttribute('data-idx', String(idx));

        const opt0 = document.createElement('option');
        opt0.value = '';
        opt0.textContent = 'выбери...';
        sel.appendChild(opt0);

        rights.forEach(r=>{
          const o = document.createElement('option');
          o.value = r;
          o.textContent = r;
          sel.appendChild(o);
        });

        selects.push(sel);
        wrap.appendChild(left);
        wrap.appendChild(sel);
      });

      matchState = { rights, selects, pairs };
      elCard.appendChild(wrap);
    }

    function renderMultiInput(q){
      const p = document.createElement('div');
      p.className = 'sh-run-prompt';
      p.textContent = q.item.prompt;
      elCard.appendChild(p);

      const row = document.createElement('div');
      row.className = 'ik-row';
      row.style.marginTop = '12px';
      row.style.flexWrap = 'wrap';

      const inputs = [];
      (q.item.inputs || []).forEach((spec, i)=>{
        const input = document.createElement('input');
        input.className = 'ik-input';
        input.type = 'text';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.placeholder = '';
        input.style.minWidth = '220px';
        input.setAttribute('data-idx', String(i));
        row.appendChild(input);
        inputs.push(input);
      });

      multiInputs = inputs;
      elCard.appendChild(row);
      inputs[0] && inputs[0].focus?.();
    }

    function renderInlineSelect(q){
      const item = q.item || {};
      const title = String(item.storyTitle || '').trim();
      if (title){
        const h = document.createElement('p');
        h.className = 'sh-inline-story-title';
        h.textContent = title;
        elCard.appendChild(h);
      }

      const box = document.createElement('div');
      box.className = 'sh-inline-story';

      const segments = Array.isArray(item.segments) ? item.segments : [];
      const blanks = Array.isArray(item.blanks) ? item.blanks : [];
      const slots = [];

      const textLine = document.createElement('p');
      textLine.className = 'sh-inline-story__line';

      for (let i = 0; i < blanks.length; i += 1){
        const seg = String(segments[i] || '');
        if (seg) textLine.appendChild(document.createTextNode(seg));

        const mount = document.createElement('span');
        mount.className = 'sh-inline-slot';

        const sel = document.createElement('select');
        sel.className = 'ik-select sh-inline-select';
        sel.setAttribute('data-idx', String(i));

        const blank = blanks[i] || {};
        const opts = Array.isArray(blank.options) ? blank.options : [];
        const ph = document.createElement('option');
        ph.value = '';
        ph.textContent = '...';
        sel.appendChild(ph);
        opts.forEach((opt, j)=>{
          const o = document.createElement('option');
          o.value = String(j);
          o.textContent = String(opt || '');
          sel.appendChild(o);
        });

        mount.appendChild(sel);
        textLine.appendChild(mount);

        slots.push({
          mount,
          select: sel,
          options: opts,
          correctIndex: Number(blank.correctIndex)
        });
      }

      const tail = String(segments[blanks.length] || '');
      if (tail) textLine.appendChild(document.createTextNode(tail));

      box.appendChild(textLine);
      elCard.appendChild(box);

      inlineSelectState = { slots, segments: [...segments] };
      slots[0]?.select?.focus?.();
    }

    function renderCurrent(){
      checked = false;
      btnCheckNext.textContent = 'check';
      setActionAvailability(false);
      if (btnDontKnow) btnDontKnow.disabled = false;
      if (elExplain){ elExplain.hidden = true; elExplain.textContent = ''; }
      resetPerQuestionState();
      setFeedback('idle', 'ready', 'выбери ответ или введи ответ и нажми check');


const q = queue[idx];

// progress
try{
  const bar = runWrap.querySelector('#shTRunProgress > div');
  if (bar){
    const pct = Math.round(((idx) / Math.max(1, queue.length)) * 100);
    bar.style.width = pct + '%';
  }
} catch(_){}
try{
  const hintEl = runWrap.querySelector('#shTRunHint');
  if (hintEl){
    hintEl.hidden = true;
    hintEl.textContent = '';
  }
} catch(_){}      elEx.textContent = `exercise: ${q.exTitle}`;
      elQ.textContent  = `question: ${idx+1}/${queue.length}`;

      elInstr.textContent = q.item.instruction || '';
      elCard.innerHTML = '';

      if (q.kind === 'choice'){
        renderChoice(q);
      } else if (q.kind === 'input' || q.kind === 'correction'){
        renderInput(q);
      } else if (q.kind === 'multi'){
        renderMulti(q);
      } else if (q.kind === 'match'){
        renderMatch(q);
      } else if (q.kind === 'multi_input'){
        renderMultiInput(q);
      } else if (q.kind === 'inline_select'){
        renderInlineSelect(q);
      } else {
        // fallback
        renderInput(q);
      }
    }

    function markChoice(correctIndex, chosenIndex){
      const btns = elCard.querySelectorAll('.sh-choice-list .sh-choice');
      btns.forEach((b, i)=>{
        b.classList.remove('is-correct', 'is-wrong');
        if (i === correctIndex) b.classList.add('is-correct');
        if (i === chosenIndex && i !== correctIndex) b.classList.add('is-wrong');
      });
    }

    function sameSet(aSet, bSet){
      if (aSet.size !== bSet.size) return false;
      for (const x of aSet) if (!bSet.has(x)) return false;
      return true;
    }

    function countAttempt(q){
      exTotals[q.exId] = (exTotals[q.exId] || 0) + 1;
    }

    function checkCurrent(){
      const q = queue[idx];
      if (q.kind === 'choice'){
        if (selectedIndex === null){
          setFeedback('idle', 'pick', 'сначала выбери вариант');
          lastCheck = null;
          return null;
        }
        countAttempt(q);
        const ok = selectedIndex === q.item.correctIndex;
        const selectedText = q.item.options?.[selectedIndex] || '';
        const correctText = q.item.options?.[q.item.correctIndex] || '';
        if (ok){
          exCorrect[q.exId] = (exCorrect[q.exId] || 0) + 1;
          mistakesSet.delete(q.item.id);
          setFeedback('correct', 'ok', 'верно');
        } else {
          mistakesSet.add(q.item.id);
          const corr = String.fromCharCode(97 + q.item.correctIndex);
          setFeedback('wrong', 'no', cbShowAfterLocal.checked ? `неверно (правильно: ${corr})` : 'неверно');
        }
        lastCheck = {
          kind: 'choice',
          ok,
          selectedIndex,
          correctIndex: q.item.correctIndex,
          selectedText,
          correctText
        };
        markChoice(q.item.correctIndex, selectedIndex);
        saveMistakesSnapshot();
        return ok;
      }

      if (q.kind === 'input' || q.kind === 'correction'){
        const input = elCard.querySelector('#shTRunInput');
        const raw = (input?.value || '').trim();
        if (!raw){ setFeedback('idle','input','введи ответ'); lastCheck = null; return null; }
        const accepted = q.item.accepted || [];
        let acceptedList = accepted;

        // For correction tasks: accept both the full corrected sentence and shorter fixes (single word / start of the question).
        if (q.kind === 'correction'){
          const extra = [];
          if (Array.isArray(q.item.acceptedShort)) extra.push(...q.item.acceptedShort);
          if (accepted && accepted[0]) extra.push(...deriveCorrectionKeywords(q.item.prompt || '', accepted[0] || ''));
          acceptedList = [...accepted, ...extra].filter(Boolean);
        }

        countAttempt(q);
        const res = checkInput(raw, acceptedList);
        const nearest = nearestAccepted(raw, acceptedList.length ? acceptedList : accepted);
        const primaryCorrect = (accepted && accepted[0]) ? accepted[0] : (nearest?.text || '');
        if (res.state === 'correct'){
          exCorrect[q.exId] = (exCorrect[q.exId] || 0) + 1;
          mistakesSet.delete(q.item.id);
          input.classList.remove('is-bad');
          input.classList.add('is-ok');
          setFeedback('correct', 'ok', 'верно');
        } else if (res.state === 'almost'){
          exCorrect[q.exId] = (exCorrect[q.exId] || 0) + 1;
          mistakesSet.delete(q.item.id);
          input.classList.remove('is-bad');
          input.classList.add('is-ok');
          setFeedback('correct', 'ok', 'верно (опечатка)');
        } else {
          mistakesSet.add(q.item.id);
          input.classList.remove('is-ok');
          input.classList.add('is-bad');
          if (cbShowAfterLocal.checked){
            setFeedback('wrong', 'no', `неверно (правильно: ${accepted[0] || ''})`);
          } else {
            setFeedback('wrong', 'no', 'неверно');
          }
        }
        lastCheck = {
          kind: q.kind,
          ok: res.state !== 'wrong',
          state: res.state,
          rawInput: raw,
          correctText: primaryCorrect,
          closestText: nearest?.text || ''
        };
        return res.state !== 'wrong';
      }

      if (q.kind === 'multi'){
        if (selectedSet.size === 0){ setFeedback('idle','pick','сначала выбери варианты'); lastCheck = null; return null; }
        countAttempt(q);
        const correctSet = new Set((q.item.correctIndices || []).map(x=>Number(x)));
        const ok = sameSet(selectedSet, correctSet);
        const selectedIdx = Array.from(selectedSet).sort((a,b)=>a-b);
        const correctIdx = Array.from(correctSet).sort((a,b)=>a-b);
        const selectedLabels = selectedIdx.map(i => q.item.options?.[i]).filter(Boolean);
        const correctLabels = correctIdx.map(i => q.item.options?.[i]).filter(Boolean);
        const missingLabels = correctIdx.filter(i => !selectedSet.has(i)).map(i => q.item.options?.[i]).filter(Boolean);
        const extraLabels = selectedIdx.filter(i => !correctSet.has(i)).map(i => q.item.options?.[i]).filter(Boolean);

        const btns = elCard.querySelectorAll('.sh-choice-list .sh-choice');
        btns.forEach((b, i)=>{
          b.classList.remove('is-correct', 'is-wrong');
          if (correctSet.has(i)) b.classList.add('is-correct');
          if (selectedSet.has(i) && !correctSet.has(i)) b.classList.add('is-wrong');
        });

        if (ok){
          exCorrect[q.exId] = (exCorrect[q.exId] || 0) + 1;
          mistakesSet.delete(q.item.id);
          setFeedback('correct', 'ok', 'верно');
        } else {
          mistakesSet.add(q.item.id);
          setFeedback('wrong', 'no', cbShowAfterLocal.checked ? `неверно (правильно: ${correctLabels.join(', ')})` : 'неверно');
        }

        lastCheck = {
          kind: 'multi',
          ok,
          selectedLabels,
          correctLabels,
          missingLabels,
          extraLabels
        };

        saveMistakesSnapshot();
        return ok;
      }

      if (q.kind === 'match'){
        const st = matchState;
        if (!st){
          setFeedback('idle', 'pick', 'сначала выбери варианты');
          lastCheck = null;
          return null;
        }

        let allPicked = true;
        let okCount = 0;

        st.selects.forEach((sel, i)=>{
          const v = sel.value;
          if (!v) allPicked = false;
          const isOk = v && v === st.pairs[i].right;
          sel.classList.toggle('is-ok', !!isOk);
          sel.classList.toggle('is-bad', !!v && !isOk);
          if (isOk) okCount += 1;
        });

        if (!allPicked){
          setFeedback('idle', 'pick', 'заполни все строки');
          lastCheck = null;
          return null;
        }

        countAttempt(q);
        const ok = okCount === st.pairs.length;
        const mismatches = st.pairs
          .map((p, i)=>({ left: p.left, right: p.right, user: st.selects[i]?.value || '' }))
          .filter(x => x.user !== x.right);
        if (ok){
          exCorrect[q.exId] = (exCorrect[q.exId] || 0) + 1;
          mistakesSet.delete(q.item.id);
          setFeedback('correct', 'ok', 'верно');
        } else {
          mistakesSet.add(q.item.id);
          const rightStr = st.pairs.map(p=>`${p.left} -> ${p.right}`).join(' | ');
          setFeedback('wrong', 'no', cbShowAfterLocal.checked ? `неверно (правильно: ${rightStr})` : 'неверно');
        }

        lastCheck = {
          kind: 'match',
          ok,
          mismatches
        };

        saveMistakesSnapshot();
        return ok;
      }

      if (q.kind === 'multi_input'){
        const specs = q.item.inputs || [];
        if (!multiInputs || multiInputs.length !== specs.length){
          setFeedback('idle', 'input', 'не удалось создать поля');
          lastCheck = null;
          return null;
        }

        let allOk = true;
        let anyAlmost = false;
        const slots = [];

        for (let i=0;i<specs.length;i++){
          const inputEl = multiInputs[i];
          const raw = (inputEl.value || '').trim();
          if (!raw){ setFeedback('idle','input','заполни все формы'); lastCheck = null; return null; }
          const accepted = specs[i].accepted || [];
          const res = checkInput(raw, accepted);
          const nearest = nearestAccepted(raw, accepted);
          const correct = (accepted && accepted[0]) ? accepted[0] : (nearest?.text || '');

          slots.push({
            index: i + 1,
            raw,
            correct,
            state: res.state
          });

          inputEl.classList.remove('is-ok','is-bad');
          if (res.state === 'wrong'){
            inputEl.classList.add('is-bad');
            allOk = false;
          } else {
            inputEl.classList.add('is-ok');
            if (res.state === 'almost') anyAlmost = true;
          }
        }

        countAttempt(q);
        if (allOk){
          exCorrect[q.exId] = (exCorrect[q.exId] || 0) + 1;
          mistakesSet.delete(q.item.id);
          setFeedback('correct', 'ok', anyAlmost ? 'верно (опечатка)' : 'верно');
        } else {
          mistakesSet.add(q.item.id);
          const firstAccepted = (specs[0] && specs[0].accepted && specs[0].accepted[0]) ? specs[0].accepted[0] : '';
          setFeedback('wrong', 'no', cbShowAfterLocal.checked ? `неверно (пример: ${firstAccepted} ...)` : 'неверно');
        }

        lastCheck = {
          kind: 'multi_input',
          ok: allOk,
          anyAlmost,
          slots,
          correctParts: slots.map(x => x.correct).filter(Boolean)
        };

        return allOk;
      }

      if (q.kind === 'inline_select'){
        const st = inlineSelectState;
        if (!st || !Array.isArray(st.slots) || !st.slots.length){
          setFeedback('idle', 'pick', 'не удалось создать поля');
          lastCheck = null;
          return null;
        }

        for (const slot of st.slots){
          const val = String(slot.select?.value || '');
          if (!val){
            setFeedback('idle', 'pick', 'заполни все поля');
            lastCheck = null;
            return null;
          }
        }

        countAttempt(q);

        let okCount = 0;
        const parts = [];
        const detail = [];

        for (let i = 0; i < st.slots.length; i += 1){
          const slot = st.slots[i];
          const pickedIndex = Number(slot.select.value);
          const correctIndex = Number(slot.correctIndex);
          const correctText = String(slot.options[correctIndex] || '');
          const pickedText = String(slot.options[pickedIndex] || '');
          const isOk = pickedIndex === correctIndex;
          if (isOk) okCount += 1;
          parts.push(correctText);

          const badge = document.createElement('span');
          badge.className = `sh-inline-result ${isOk ? 'is-ok' : 'is-wrong'}`;
          if (isOk){
            badge.textContent = correctText;
          } else {
            badge.innerHTML = `<s>${escapeHtml(pickedText)}</s> ${escapeHtml(correctText)} <span aria-hidden="true">×</span>`;
          }

          slot.mount.innerHTML = '';
          slot.mount.appendChild(badge);

          detail.push({ pickedText, correctText, ok: isOk });
        }

        const total = st.slots.length;
        const ok = okCount === total;
        if (ok){
          exCorrect[q.exId] = (exCorrect[q.exId] || 0) + 1;
          mistakesSet.delete(q.item.id);
          setFeedback('correct', 'ok', `верно (${okCount}/${total})`);
        } else {
          mistakesSet.add(q.item.id);
          setFeedback('wrong', 'no', `неверно (${okCount}/${total})`);
        }

        const sentenceParts = [];
        for (let i = 0; i < total; i += 1){
          sentenceParts.push(String(st.segments[i] || ''));
          sentenceParts.push(parts[i] || '');
        }
        sentenceParts.push(String(st.segments[total] || ''));
        const correctSentence = sentenceParts.join('').replace(/\s+/g, ' ').replace(/\s+([,.!?;:])/g, '$1').trim();

        lastCheck = {
          kind: 'inline_select',
          ok,
          correctCount: okCount,
          total,
          slots: detail,
          correctSentence
        };

        saveMistakesSnapshot();
        return ok;
      }

      // fallback
      setFeedback('wrong', 'no', 'unknown task type');
      lastCheck = { kind: q.kind || 'unknown', ok: false };
      return false;
    }

    function finish(){
      // remove key handler
      if (runKeyHandler){
        document.removeEventListener('keydown', runKeyHandler, true);
        runKeyHandler = null;
      }

      // Update best + mastery
      const p = loadProgress(tenseObj.id);
      p.mistakes = [...mistakesSet];

      for (const exId of Object.keys(exTotals)){
        const total = exTotals[exId];
        const correct = exCorrect[exId] || 0;
        const prev = p.best?.[exId];
        const better = (!prev) || (correct/total > prev.correct/prev.total);
        if (!p.best) p.best = {};
        if (better) p.best[exId] = { correct, total };
      }

      const totalAll = Object.values(exTotals).reduce((a,b)=>a+b,0);
      const correctAll = Object.values(exCorrect).reduce((a,b)=>a+b,0);
      const pct = totalAll ? Math.round((correctAll/totalAll)*100) : 0;

      if (!options.onlyMistakes && totalAll > 0){
        if (pct >= 85) p.mastery = Math.min(5, (p.mastery || 0) + 1);
      }

      saveProgress(tenseObj.id, p);

      // update detail badge if opened
      if (currentId === tenseObj.id) updateMasteryUI(tenseObj.id);

      renderPracticeInfo();
      setStatus('saved');
    }

    // Global key handler while run is active:
    runKeyHandler = (e)=>{
      if (window.StudentHelperTabs?.getMainTab?.() !== 'tenses') return;
      if (practiceView.hidden) return;
      if (!practiceBody.querySelector('#shTRunCard')) return;

      if (e.key === 'Enter'){
        if (e.isComposing || e.repeat) return;
        if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
        e.preventDefault();
        e.stopPropagation();
        btnCheckNext.click();
        return;
      }

      // MCQ: 1-9
      if (e.key >= '1' && e.key <= '9' && !checked){
        const k = parseInt(e.key, 10) - 1;
        const btns = elCard.querySelectorAll('.sh-choice-list .sh-choice');
        if (btns.length && k >= 0 && k < btns.length){
          btns[k].click();
        }
      }
    };
    document.addEventListener('keydown', runKeyHandler, true);

    btnExit.addEventListener('click', finish);

    function dontKnowCurrent(){
      const q = queue[idx];
      if (!q) return;

      countAttempt(q);
      mistakesSet.add(q.item.id);

      if (q.kind === 'choice'){
        const correctText = q.item.options?.[q.item.correctIndex] || '';
        markChoice(q.item.correctIndex, -1);
        lastCheck = {
          kind: 'choice',
          ok: false,
          selectedIndex: null,
          correctIndex: q.item.correctIndex,
          selectedText: '',
          correctText,
          forcedUnknown: true
        };
      } else if (q.kind === 'input' || q.kind === 'correction'){
        const input = elCard.querySelector('#shTRunInput');
        const accepted = q.item.accepted || [];
        const correctText = accepted[0] || '';
        if (input){
          input.value = correctText;
          input.classList.remove('is-bad');
          input.classList.add('is-ok');
        }
        lastCheck = {
          kind: q.kind,
          ok: false,
          state: 'wrong',
          rawInput: '',
          correctText,
          closestText: correctText,
          forcedUnknown: true
        };
      } else if (q.kind === 'multi'){
        const correctSet = new Set((q.item.correctIndices || []).map(x => Number(x)));
        const correctLabels = Array.from(correctSet).sort((a, b) => a - b).map(i => q.item.options?.[i]).filter(Boolean);
        const btns = elCard.querySelectorAll('.sh-choice-list .sh-choice');
        btns.forEach((b, i)=>{
          b.classList.remove('is-correct', 'is-wrong');
          if (correctSet.has(i)) b.classList.add('is-correct');
        });
        lastCheck = {
          kind: 'multi',
          ok: false,
          selectedLabels: [],
          correctLabels,
          missingLabels: correctLabels,
          extraLabels: [],
          forcedUnknown: true
        };
      } else if (q.kind === 'match'){
        const st = matchState;
        if (st){
          st.selects.forEach((sel, i)=>{
            sel.value = st.pairs[i].right;
            sel.classList.remove('is-bad');
            sel.classList.add('is-ok');
          });
        }
        lastCheck = {
          kind: 'match',
          ok: false,
          mismatches: [],
          forcedUnknown: true
        };
      } else if (q.kind === 'multi_input'){
        const slots = [];
        const specs = q.item.inputs || [];
        for (let i = 0; i < specs.length; i += 1){
          const correct = (specs[i].accepted && specs[i].accepted[0]) ? specs[i].accepted[0] : '';
          const inputEl = multiInputs && multiInputs[i];
          if (inputEl){
            inputEl.value = correct;
            inputEl.classList.remove('is-bad');
            inputEl.classList.add('is-ok');
          }
          slots.push({ index: i + 1, raw: '', correct, state: 'wrong' });
        }
        lastCheck = {
          kind: 'multi_input',
          ok: false,
          anyAlmost: false,
          slots,
          correctParts: slots.map(x => x.correct).filter(Boolean),
          forcedUnknown: true
        };
      } else if (q.kind === 'inline_select'){
        const st = inlineSelectState;
        const detail = [];
        if (st && Array.isArray(st.slots)){
          for (let i = 0; i < st.slots.length; i += 1){
            const slot = st.slots[i];
            const correctIndex = Number(slot.correctIndex);
            const correctText = String(slot.options?.[correctIndex] || '');
            const badge = document.createElement('span');
            badge.className = 'sh-inline-result is-ok';
            badge.textContent = correctText;
            slot.mount.innerHTML = '';
            slot.mount.appendChild(badge);
            detail.push({ pickedText: '', correctText, ok: false });
          }
        }

        const total = detail.length;
        const sentenceParts = [];
        if (st && Array.isArray(st.segments)){
          for (let i = 0; i < total; i += 1){
            sentenceParts.push(String(st.segments[i] || ''));
            sentenceParts.push(detail[i]?.correctText || '');
          }
          sentenceParts.push(String(st.segments[total] || ''));
        }

        lastCheck = {
          kind: 'inline_select',
          ok: false,
          correctCount: 0,
          total,
          slots: detail,
          correctSentence: sentenceParts.join('').replace(/\s+/g, ' ').replace(/\s+([,.!?;:])/g, '$1').trim(),
          forcedUnknown: true
        };
      } else {
        lastCheck = { kind: q.kind || 'unknown', ok: false, forcedUnknown: true };
      }

      saveMistakesSnapshot();
      setFeedback('wrong', 'idk', 'показан правильный ответ');
      checked = true;
      setActionAvailability(true);
      if (btnDontKnow) btnDontKnow.disabled = true;
      btnCheckNext.textContent = (idx === queue.length - 1) ? 'finish' : 'next';
    }

    if (btnExplain){
      btnExplain.addEventListener('click', ()=>{
        if (btnExplain.dataset.locked === '1') return;
        const q = queue[idx];
        const t = buildSmartExplanation(q, lastCheck);
        if (!elExplain) return;
        if (elExplain.hidden){
          elExplain.textContent = t;
          elExplain.hidden = false;
          btnExplain.textContent = 'скрыть';
        } else {
          elExplain.hidden = true;
          elExplain.textContent = '';
          btnExplain.textContent = 'объяснение';
        }
      });
    }

    if (btnOpenRule){
      btnOpenRule.addEventListener('click', ()=>{
        if (btnOpenRule.dataset.locked === '1') return;
        const q = queue[idx];
        if (!q) return;
        const meta = inferQuestionTenseMeta(q, lastCheck) || getTenseMetaById(tenseObj.id);
        if (!meta || !meta.id) return;
        openTense(meta.id, {
          fromRun: true,
          runContext: {
            sourceTenseId: meta.id,
            sourceExerciseTitle: q.exTitle,
            sourceQuestionIndex: idx + 1
          }
        });
        setStatus('rule');
      });
    }

    if (btnDontKnow){
      btnDontKnow.addEventListener('click', ()=>{
        if (checked) return;
        dontKnowCurrent();
      });
    }

    btnCheckNext.addEventListener('click', ()=>{
      if (!checked){
        const res = checkCurrent(); // null = ещё не готово
        if (res === null) return;
        checked = true;
        setActionAvailability(true);
        if (btnDontKnow) btnDontKnow.disabled = true;
        btnCheckNext.textContent = (idx === queue.length - 1) ? 'finish' : 'next';
        return;
      }
      if (idx < queue.length - 1){
        idx += 1;
        renderCurrent();
      } else {
        finish();
      }
    });

    renderCurrent();
  }

  // -------------------------
  // Input checking (same idea as Structure)
  // -------------------------
  const CONTRACTIONS = [
    [/\bI'm\b/gi, "i am"],
    [/\bYou're\b/gi, "you are"],
    [/\bHe's\b/gi, "he is"],
    [/\bShe's\b/gi, "she is"],
    [/\bIt's\b/gi, "it is"],
    [/\bWe're\b/gi, "we are"],
    [/\bThey're\b/gi, "they are"],
    [/\bisn't\b/gi, "is not"],
    [/\baren't\b/gi, "are not"],
    [/\bwasn't\b/gi, "was not"],
    [/\bweren't\b/gi, "were not"],
    [/\bdon't\b/gi, "do not"],
    [/\bdoesn't\b/gi, "does not"],
    [/\bdidn't\b/gi, "did not"],
    [/\bcan't\b/gi, "cannot"],
    [/\bwon't\b/gi, "will not"],
    [/\bhaven't\b/gi, "have not"],
    [/\bhasn't\b/gi, "has not"],
    [/\bhadn't\b/gi, "had not"],
  ];

  function normalize(s){
    let t = (s || '').trim();
    t = t.replace(/[.!?]+$/g, '');
    t = t.replace(/\s+/g, ' ');
    for (const [re, rep] of CONTRACTIONS){
      t = t.replace(re, rep);
    }
    t = t.toLowerCase().trim();
    t = t.replace(/\s+/g, ' ');
    return t;
  }


  function tokensNormalized(s){
    const t = normalize(s);
    return t ? t.split(' ').filter(Boolean) : [];
  }

  function uniq(arr){
    const out = [];
    const seen = new Set();
    for (const x of (arr || [])){
      const k = normalize(x);
      if (!k) continue;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(x);
    }
    return out;
  }

  // Derive short acceptable fixes for correction tasks.
  // Example: "Did you went there?" -> accepted word "go"
  // Also helps with word order fixes: "You were watching TV?" -> accepts "were", "were you", "were you watching"
  function deriveCorrectionKeywords(wrongRaw, correctRaw){
    const wrong = tokensNormalized(wrongRaw);
    const correct = tokensNormalized(correctRaw);

    const counts = Object.create(null);
    for (const w of wrong){
      counts[w] = (counts[w] || 0) + 1;
    }

    const extra = [];
    for (const c of correct){
      if (counts[c] > 0) counts[c] -= 1;
      else extra.push(c);
    }

    // If no token differences (often just word order), accept the start of the correct sentence/question.
    if (extra.length === 0 && correct.length){
      extra.push(correct[0]);
      if (correct.length >= 2) extra.push(correct[0] + ' ' + correct[1]);
      if (correct.length >= 3) extra.push(correct[0] + ' ' + correct[1] + ' ' + correct[2]);
    }

    return uniq(extra);
  }

  function levenshtein(a, b){
    const m = a.length, n = b.length;
    const dp = new Array(n+1);
    for (let j=0;j<=n;j++) dp[j]=j;
    for (let i=1;i<=m;i++){
      let prev = dp[0];
      dp[0]=i;
      for (let j=1;j<=n;j++){
        const tmp = dp[j];
        const cost = a[i-1] === b[j-1] ? 0 : 1;
        dp[j] = Math.min(dp[j] + 1, dp[j-1] + 1, prev + cost);
        prev = tmp;
      }
    }
    return dp[n];
  }

  function checkInput(raw, accepted){
    const a = normalize(raw);
    const accNorm = (accepted || []).map(x=> normalize(x));

    if (accNorm.includes(a)){
      return { state: 'correct' };
    }

    const maxDist = a.length >= 12 ? 2 : 1;
    for (const ok of accNorm){
      const d = levenshtein(a, ok);
      if (d <= maxDist){
        return { state: 'almost' };
      }
    }
    return { state: 'wrong' };
  }

  // -------------------------
  // Events
  // -------------------------
  btnGoBasics && btnGoBasics.addEventListener('click', ()=>{
    if (!ensureLevelSelected()){
      showOnly('home');
      setStatus('выбери уровень');
      return;
    }

    setCategory('all');
    setSubgroup('all');

    if (REG.byId && REG.byId[BASIC_OVERVIEW_ID]){
      openTense(BASIC_OVERVIEW_ID);
      return;
    }

    renderList();
    showOnly('list');
    setStatus('list');
  });

  btnGoTheory.addEventListener('click', ()=>{
    if (!ensureLevelSelected()){
      showOnly('home');
      setStatus('выбери уровень');
      return;
    }
    setCategory('all');
    setSubgroup('all');
    renderList();
    showOnly('list');
    setStatus('list');
  });

  btnGoPractice.addEventListener('click', ()=>{
    openPracticeMode('custom', { autoStart: false });
  });

  btnGoMixed && btnGoMixed.addEventListener('click', ()=>{
    openPracticeMode('mixed', { autoStart: true });
  });

  btnGoActiveTenses && btnGoActiveTenses.addEventListener('click', ()=> openCategory('active_tenses'));
  btnGoUniversal && btnGoUniversal.addEventListener('click', ()=> openCategory('universal'));
  btnOpenConstructor && btnOpenConstructor.addEventListener('click', ()=> showConstructor());
  btnBackHomeFromConstructor && btnBackHomeFromConstructor.addEventListener('click', ()=>{
    showOnly('home');
    setStatus('home');
  });
  builderPhraseInput && builderPhraseInput.addEventListener('input', ()=>{
    if (!constructorView || constructorView.hidden) return;
    if (!builderLastRec || !builderLastRec.sourceKey) return;
    const rec = buildConstructorRecommendation(builderLastRec.sourceKey);
    if (rec) renderBuilderResult(rec);
  });

  compactListToggle && compactListToggle.addEventListener('change', ()=>{
    setCompactList(!!compactListToggle.checked);
    renderList();
  });

  ruleModeShortBtn && ruleModeShortBtn.addEventListener('click', ()=> setRuleMode('short'));
  ruleModeFullBtn && ruleModeFullBtn.addEventListener('click', ()=> setRuleMode('full'));

  levelButtons.forEach((btn) => {
    btn.addEventListener('click', ()=>{
      const level = btn.getAttribute('data-grammar-level');
      if (!normalizeLevel(level)) return;
      setLevel(level);
      setStatus('уровень сохранен');
    });
  });

  levelChangeBtn && levelChangeBtn.addEventListener('click', ()=>{
    clearLevel();
    setStatus('выбери уровень');
  });

  if (grammarHomeTabs){
    grammarHomeTabs.querySelectorAll('[data-grammar-home-tab]').forEach((btn)=>{
      btn.addEventListener('click', ()=>{
        setGrammarHomeTab(btn.getAttribute('data-grammar-home-tab'));
      });
    });
  }

// Compare / Daily quick start
btnGoCompare && btnGoCompare.addEventListener('click', ()=>{
  if (!ensureLevelSelected()){
    showOnly('home');
    setStatus('выбери уровень');
    return;
  }
  showCompare();
});

btnGoDaily && btnGoDaily.addEventListener('click', ()=>{
  if (!ensureLevelSelected()){
    showOnly('home');
    setStatus('выбери уровень');
    return;
  }
  showDaily();
});


btnBackHomeFromCompare && btnBackHomeFromCompare.addEventListener('click', ()=>{
  showOnly('home');
  setStatus('home');
});

btnBackHomeFromDaily && btnBackHomeFromDaily.addEventListener('click', ()=>{
  showOnly('home');
  setStatus('home');
});

btnClearMistakes && btnClearMistakes.addEventListener('click', ()=>{
  const id = (tenseSelect && tenseSelect.value) || '';
  if (!id) return;
  const p = loadProgress(id);
  p.mistakes = [];
  saveProgress(id, p);
  setStatus('mistakes cleared');
  renderPracticeInfo();
});

btnResetProgress && btnResetProgress.addEventListener('click', ()=>{
  const id = (tenseSelect && tenseSelect.value) || '';
  if (!id) return;
  saveProgress(id, { mastery: 0, best: {}, mistakes: [] });
  setStatus('progress reset');
  renderPracticeInfo();
});


  btnBackHomeFromList && btnBackHomeFromList.addEventListener('click', ()=>{
    showOnly('home');
    setStatus('home');
  });

  btnBackToList && btnBackToList.addEventListener('click', ()=>{
    if (detailBackStack.length){
      const prev = detailBackStack.pop();
      const prevId = String(prev?.id || '');
      if (prevId && REG.byId[prevId]){
        openTense(prevId, { preserveBackStack: true, restoreScrollY: Number(prev?.scrollY || 0) });
        setStatus('open');
        return;
      }
    }
    setRunReturnState(null);
    renderList();
    showOnly('list');
    setStatus('list');
  });

  btnBackToRunFromDetail && btnBackToRunFromDetail.addEventListener('click', ()=>{
    if (!runReturnState) return;
    showOnly('practice');
    setStatus('practice');
    requestAnimationFrame(()=>{
      const card = document.querySelector('#shTRunCard');
      if (card) card.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  });

  function showPractice(options){
    const opts = options || {};
    if (!ensureLevelSelected()){
      showOnly('home');
      setStatus('выбери уровень');
      return false;
    }

    const ui = loadUIState();
    if (!opts.keepCurrentFilter){
      if (ui.category && CATEGORY_LABEL[ui.category]) setCategory(ui.category);
      if (ui.subgroup && (ui.category ? ui.category !== 'all' : activeCategory !== 'all')) setSubgroup(ui.subgroup);
    }

    fillGoalOptions();
    fillTenseOptions();
    renderCustomPicker();

    if (ui.goal && GOALS.some(x=>x.id === ui.goal)) goalSelect.value = ui.goal;

    const forcedMode = opts.forceMode ? normalizePracticeMode(opts.forceMode) : '';
    const mode = forcedMode || inferPracticeModeFromUi(ui);
    setPracticeMode(mode, { persist: !!forcedMode, rerender: false });

    showOnly('practice');
    renderPracticeInfo();
    setStatus('practice');
    return true;
  }

  function openPracticeMode(mode, options){
    const opts = Object.assign({ autoStart: false }, options || {});
    setCategory('all');
    setSubgroup('all');
    if (!showPractice({ keepCurrentFilter: true, forceMode: mode })) return false;
    if (opts.autoStart){
      setTimeout(()=>{ btnStart && btnStart.click(); }, 0);
    }
    return true;
  }

  btnBackHomeFromPractice && btnBackHomeFromPractice.addEventListener('click', ()=>{
    showOnly('home');
    setStatus('home');
  });

  function goPracticeForTense(id){
    if (!showPractice({ keepCurrentFilter: true, forceMode: 'custom' })) return;

    const meta = (REG.INDEX || []).find((m) => m.id === id);
    if (meta && meta.id){
      saveCustomSelection([meta.id]);
      setPracticeMode('custom', { persist: true, rerender: false });
    } else {
      setPracticeMode('mixed', { persist: true, rerender: false });
    }

    renderPracticeInfo();
  }

  btnGoPracticeFromDetail && btnGoPracticeFromDetail.addEventListener('click', ()=>{
    if (currentId) goPracticeForTense(currentId);
  });
  btnGoPracticeBottom && btnGoPracticeBottom.addEventListener('click', ()=>{
    if (currentId) goPracticeForTense(currentId);
  });

  goalSelect && goalSelect.addEventListener('change', renderPracticeInfo);
  modeMixedBtn && modeMixedBtn.addEventListener('click', ()=> setPracticeMode('mixed'));
  modeCustomBtn && modeCustomBtn.addEventListener('click', ()=> setPracticeMode('custom'));
  tenseSelect && tenseSelect.addEventListener('change', ()=>{
    const mode = tenseSelect.value === CUSTOM_TENSE_ID ? 'custom' : 'mixed';
    applyPracticeModeButtons(mode);
    setCustomPickerVisible(mode === 'custom');
    if (mode === 'custom') updateCustomHint(getCustomSelectedIds().length);
    renderPracticeInfo();
  });
  btnCustomSelectAll && btnCustomSelectAll.addEventListener('click', ()=> setAllCustomSelection(true));
  btnCustomClearAll && btnCustomClearAll.addEventListener('click', ()=> setAllCustomSelection(false));
  customSearchInput && customSearchInput.addEventListener('input', ()=>{
    customSearchQuery = String(customSearchInput.value || '');
    applyCustomSearchFilter();
  });
  customSearchClearBtn && customSearchClearBtn.addEventListener('click', ()=>{
    customSearchQuery = '';
    if (customSearchInput) customSearchInput.value = '';
    applyCustomSearchFilter();
    customSearchInput?.focus?.();
  });

  btnStart && btnStart.addEventListener('click', ()=>{
    const tenseId = tenseSelect.value || tenseSelect.options?.[0]?.value || (REG.INDEX[0] && REG.INDEX[0].id);
    const tenseObj = getTenseForPractice(tenseId);
    const goalId = getSelectedGoalId();
    const exIds = gatherExerciseIds(tenseObj, goalId);

    const showAfter = !!cbShowAfter?.checked;
    startRun(tenseObj, exIds, { showAfterEach: showAfter, onlyMistakes: false });
    if (tenseId === CUSTOM_TENSE_ID){
      requestAnimationFrame(()=>{
        practiceBody?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    }
  });

  btnRetry && btnRetry.addEventListener('click', ()=>{
    const tenseId = tenseSelect.value || tenseSelect.options?.[0]?.value || (REG.INDEX[0] && REG.INDEX[0].id);
    const tenseObj = getTenseForPractice(tenseId);
    const goalId = getSelectedGoalId();
    const exIds = gatherExerciseIds(tenseObj, goalId);

    const showAfter = !!cbShowAfter?.checked;
    startRun(tenseObj, exIds, { showAfterEach: showAfter, onlyMistakes: true });
  });

// -------------------------
// Compare view
// -------------------------
const QUICK = {
  pastSimple: {
    when: "факт/завершённое • цепочка • привычка в прошлом",
    markers: "yesterday • last ... • ago • in 2010 • then",
    formula: "V2 / did (neg+q)"
  },
  pastContinuous: {
    when: "процесс в моменте • фон • параллельно • раздражение (always)",
    markers: "while • when • at 5 p.m. • all day",
    formula: "was/were + V-ing"
  },
  pastPerfect: {
    when: "действие до другого/момента в прошлом",
    markers: "before • by (time) • by the time • already",
    formula: "had + V3"
  },
  pastPerfectContinuous: {
    when: "процесс/длительность до момента в прошлом • причина результата",
    markers: "for • since • before • by the time • how long",
    formula: "had been + V-ing"
  },
  presentSimple: {
    when: "привычка/рутина • факт • расписание • состояния",
    markers: "always • usually • often • every day • on Mondays",
    formula: "V1 / do-does (neg+q), -s/-es"
  },
  presentContinuous: {
    when: "процесс сейчас • временно • развитие • раздражение always",
    markers: "now • at the moment • right now • these days • Look!",
    formula: "am/is/are + V-ing"
  },
  presentPerfect: {
    when: "результат/опыт до сейчас • незаконченный период",
    markers: "already • yet • just • ever/never • for/since",
    formula: "have/has + V3"
  },
  presentPerfectContinuous: {
    when: "длительность/процесс до сейчас • видимый результат",
    markers: "for/since • how long • lately/recently",
    formula: "have/has been + V-ing"
  },
  futureSimple: {
    when: "решение в момент речи • прогноз • обещание/предложение",
    markers: "tomorrow • next ... • soon • probably • I think",
    formula: "will + V1"
  },
  futureContinuous: {
    when: "процесс в конкретный момент в будущем • вежливый вопрос о планах",
    markers: "this time tomorrow • at 8 tomorrow • when/while",
    formula: "will be + V-ing"
  },
  futurePerfect: {
    when: "результат завершится к моменту в будущем",
    markers: "by • by the time • before • by then",
    formula: "will have + V3"
  },
  futurePerfectContinuous: {
    when: "длительность процесса к моменту в будущем",
    markers: "for ... by ... • by the time • how long",
    formula: "will have been + V-ing"
  }
};

function fillCompareSelects(){
  if (!cmpASelect || !cmpBSelect) return;
  cmpASelect.innerHTML = '';
  cmpBSelect.innerHTML = '';
  const metas = getFilteredMetas({ category: 'all', onlyComparable: true });
  for (const meta of metas){
    const o1=document.createElement('option');
    o1.value=meta.id; o1.textContent=meta.title;
    const o2=o1.cloneNode(true);
    cmpASelect.appendChild(o1);
    cmpBSelect.appendChild(o2);
  }
  // default: first two
  if (metas.length>=2){
    cmpASelect.value = metas[0].id;
    cmpBSelect.value = metas[1].id;
  }
}

function superRule(aId,bId){
  const pair=[aId,bId].sort().join('|');
  if (pair==='presentContinuous|presentSimple') return 'Simple = привычка/факт/расписание (точка) • Continuous = процесс/временно (линия)';
  if (pair==='pastContinuous|pastSimple') return 'Past Simple = факт/событие (точка) • Past Continuous = процесс/фон (линия)';
  if (pair==='pastPerfect|pastSimple') return 'Past Perfect = действие до другого/момента в прошлом • Past Simple = факт/событие в прошлом';
  if (pair==='futureContinuous|futureSimple') return 'Future Simple = решение/факт/прогноз • Future Continuous = процесс в конкретный момент будущего';
  if (pair==='futurePerfect|futurePerfectContinuous') return 'Future Perfect = результат к сроку • Future Perfect Continuous = длительность к сроку';
  if (pair==='pastPerfect|pastPerfectContinuous') return 'Past Perfect = результат к моменту в прошлом • Past Perfect Continuous = процесс/длительность к моменту в прошлом';
  return 'Сравни: одно время — “более факт/обычно”, другое — “более процесс/контекст”.';
}

function renderCompare(){
  if (!cmpASelect || !cmpBSelect || !cmpRule || !cmpTable) return;
  const aId = cmpASelect.value;
  const bId = cmpBSelect.value;
  if (aId === bId){
    cmpRule.textContent = 'Выбери два разных времени.';
    cmpTable.innerHTML = '';
    return;
  }
  const A = REG.INDEX.find(x=>x.id===aId);
  const B = REG.INDEX.find(x=>x.id===bId);
  cmpRule.textContent = superRule(aId,bId);

  const qa = QUICK[aId] || {};
  const qb = QUICK[bId] || {};
  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr><th></th><th>${escapeHtml(A?.title||aId)}</th><th>${escapeHtml(B?.title||bId)}</th></tr>
    </thead>
    <tbody>
      <tr><th>когда</th><td>${escapeHtml(qa.when||'—')}</td><td>${escapeHtml(qb.when||'—')}</td></tr>
      <tr><th>маркеры</th><td>${escapeHtml(qa.markers||'—')}</td><td>${escapeHtml(qb.markers||'—')}</td></tr>
      <tr><th>формула</th><td>${escapeHtml(qa.formula||'—')}</td><td>${escapeHtml(qb.formula||'—')}</td></tr>
    </tbody>`;
  cmpTable.innerHTML='';
  cmpTable.appendChild(table);
}

function buildCompareItems(aId,bId,count){
  const aObj = REG.byId[aId];
  const bObj = REG.byId[bId];
  const A = REG.INDEX.find(x=>x.id===aId);
  const B = REG.INDEX.find(x=>x.id===bId);

  const items=[];
  function takeMeaning(tenseObj, correctIndex){
    const ex = (tenseObj?.practice?.exercises||[]).find(x=>x.id==='meaning');
    if (!ex || !Array.isArray(ex.items)) return;
    for (const it of ex.items.slice(0, 8)){
      const correctTenseId = correctIndex === 0 ? aId : bId;
      items.push({
        id: `cmp_${aId}_${bId}_${it.id}`,
        instruction: 'Какое время подходит?',
        prompt: it.prompt,
        options: [A?.title||aId, B?.title||bId],
        correctIndex,
        correctTenseId,
        sourceTenseId: it.correctTenseId || tenseObj?.id || correctTenseId,
        candidateTenseIds: [aId, bId],
        explain: it.explain || ''
      });
    }
  }
  takeMeaning(aObj,0);
  takeMeaning(bObj,1);

  // Add extra PS vs PC contrast from mixedPresent if relevant
  const pair=[aId,bId].sort().join('|');
  if (pair==='presentContinuous|presentSimple' && REG.byId.mixedPresent){
    const ex = (REG.byId.mixedPresent.practice?.exercises||[]).find(x=>x.id==='meaning');
    for (const it of (ex?.items||[]).slice(0,10)){
      const correctIndex = (it.correctTenseId===aId)?0:1;
      const correctTenseId = correctIndex === 0 ? aId : bId;
      items.push({
        id: `cmp_mpr_${it.id}`,
        instruction: it.instruction || 'Какое время?',
        prompt: it.prompt,
        options: [A?.title||aId, B?.title||bId],
        correctIndex,
        correctTenseId,
        sourceTenseId: it.correctTenseId || correctTenseId,
        candidateTenseIds: [aId, bId],
        explain: it.explain || ''
      });
    }
  }

  // shuffle
  for (let i=items.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [items[i],items[j]]=[items[j],items[i]];
  }
  return items.slice(0, Math.max(5, Math.min(10, count||10)));
}

function startCompareMini(n){
  const aId = cmpASelect.value;
  const bId = cmpBSelect.value;
  if (!aId || !bId || aId === bId) return;
  const items = buildCompareItems(aId,bId,n||10);
  const synth = {
    id: `compare_${aId}_vs_${bId}`,
    title: 'Compare',
    practice: { exercises: [{ id:'compare', title:'Compare', kind:'choice', items }] }
  };
  cmpRunBody.innerHTML='';
  startRun(synth, ['compare'], { showAfterEach: true, onlyMistakes: false }, cmpRunBody);
}

function showCompare(){
  const metas = getFilteredMetas({ category: 'all', onlyComparable: true });
  fillCompareSelects();
  if (metas.length < 2){
    if (cmpRule) cmpRule.textContent = 'Для сравнения нужно минимум 2 темы этого уровня.';
    if (cmpTable) cmpTable.innerHTML = '';
  }
  renderCompare();
  showOnly('compare');
  setStatus('compare');
}

btnCompare && btnCompare.addEventListener('click', ()=>{
  renderCompare();
});
btnCmpMini10 && btnCmpMini10.addEventListener('click', ()=> startCompareMini(10));
btnCmpMini5 && btnCmpMini5.addEventListener('click', ()=> startCompareMini(5));

cmpASelect && cmpASelect.addEventListener('change', renderCompare);
cmpBSelect && cmpBSelect.addEventListener('change', renderCompare);

// -------------------------
// Daily mini-session (10)
// -------------------------
const KEY_DAILY = 'sh_tenses_daily_v1';

function ymd(){
  const d=new Date();
  const yy=d.getFullYear();
  const mm=String(d.getMonth()+1).padStart(2,'0');
  const dd=String(d.getDate()).padStart(2,'0');
  return `${yy}-${mm}-${dd}`;
}

function pickDailySet(forceNew){
  const today = ymd();
  let state=null;
  try{ state = JSON.parse(localStorage.getItem(KEY_DAILY)||'null'); }catch(_){}
  if (!forceNew && state && state.date===today && Array.isArray(state.items) && state.items.length){
    return state.items;
  }

  // build pool from level-filtered grammar topics
  const pool=[];
  const allIds = getFilteredMetas({ category: 'all' }).map(x=>x.id).filter(id=>REG.byId[id]);
  for (const tid of allIds){
    const t = REG.byId[tid];
    for (const ex of (t.practice?.exercises||[])){
      for (const it of (ex.items||[])){
        pool.push({ tid, exId: ex.id, kind: ex.kind, item: it });
      }
    }
  }
  // shuffle and take 10
  for (let i=pool.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [pool[i],pool[j]]=[pool[j],pool[i]];
  }
  const picked = pool.slice(0,10);
  try{ localStorage.setItem(KEY_DAILY, JSON.stringify({ date: today, items: picked })); }catch(_){}
  return picked;
}

function startDaily(forceNew){
  const picked = pickDailySet(!!forceNew);

  // group by kind into exercises
  const byKind = {};
  for (const q of picked){
    const k = q.kind || 'choice';
    byKind[k] = byKind[k] || [];
    // clone item and keep unique id
    const cloned = Object.assign({}, q.item, {
      id: `dy_${q.tid}_${q.item.id}`,
      sourceTenseId: q.item?.sourceTenseId || q.item?.correctTenseId || q.tid
    });
    if (!cloned.correctTenseId && q.item?.correctTenseId) cloned.correctTenseId = q.item.correctTenseId;
    byKind[k].push(cloned);
  }

  const exs = [];
  const ids = [];
  for (const k of Object.keys(byKind)){
    const exId = `daily_${k}`;
    exs.push({ id: exId, title: `Daily (${k})`, kind: k, items: byKind[k] });
    ids.push(exId);
  }

  const synth = { id: 'daily', title:'Daily', practice: { exercises: exs } };
  dailyRunBody.innerHTML='';
  startRun(synth, ids, { showAfterEach: true, onlyMistakes: false }, dailyRunBody);
}

function showDaily(){
  showOnly('daily');
  setStatus('daily');
}

btnDailyStart && btnDailyStart.addEventListener('click', ()=> startDaily(false));
btnDailyNew && btnDailyNew.addEventListener('click', ()=> startDaily(true));

document.addEventListener('ik:languagechange', ()=>{
  if (listView && !listView.hidden) renderList();
  if (constructorView && !constructorView.hidden){
    if (builderLastRec) renderBuilderResult(builderLastRec);
    else renderBuilderQuestion();
  }
  if (searchInput && searchInput.value.trim()) renderSearchResults(searchInput.value);
});

  // Init
  refreshLevelUI();
  if (compactListToggle) compactListToggle.checked = isCompactList();
  updateRuleModeButtons();
  initSearchUI();
  if (countBadge) countBadge.textContent = `grammar: ${getFilteredMetas({ category: activeCategory, subgroup: activeSubgroup }).length}`;
  setGrammarHomeTab('rules');
  showOnly('home');

  // -------------------------
  // Utils
  // -------------------------
  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, (m)=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[m]);
  }
  }
})();
