(() => {
  const STORAGE_KEY = 'ik_site_lang_v1';
  const DEFAULT_LANG = 'ru';
  const PAGE = document.body?.dataset?.i18nPage || '';

  const TITLES = {
    index: { ru: 'Item Key — Главное меню', en: 'Item Key - Main menu' },
    'item-crate': { ru: 'Item Key - onoi_notes', en: 'Item Key - onoi_notes' },
    'onoi_notes': { ru: 'Item Key - onoi_notes', en: 'Item Key - onoi_notes' },
    planning: { ru: 'Item Key — Planning', en: 'Item Key - Planning' },
    student_helper: { ru: 'Учебный центр', en: 'Study Center' },
    whisperer: { ru: 'Item Key - whisperer', en: 'Item Key - whisperer' }
  };

  const TEXTS_RU_TO_EN = {
    'Главное меню': 'Main menu',
    'Настройки': 'Settings',
    'Язык сайта': 'Site language',
    'Русский': 'Russian',
    'отсек в разработке': 'section in development',
    'Этот отсек ещё не ожил. Возвращайся позже.': 'This section is not ready yet. Come back later.',
    'вернуться назад': 'go back',
    'перейти': 'open',
    'планирование': 'planning',
    'Учебный центр': 'Study Center',
    'выбери раздел, чтобы начать': 'choose a section to start',
    'выбери раздел чтобы начать': 'choose a section to start',
    'продолжить': 'continue',
    'обучение': 'learning',
    'карточки': 'cards',
    'практика': 'practice',
    'заучивание': 'learn',
    'разделы': 'sections',
    'назад': 'back',
    'далее': 'next',
    'англ': 'EN',
    'рус': 'RU',
    'сдаюсь': 'give up',
    'засчитать': 'accept',
    'не засчитывать': 'reject',
    'настройки сохраняются в браузере': 'settings are saved in the browser',
    'нажми на карточку чтобы перевернуть': 'tap the card to flip it',
    'переведи': 'translate',
    'введи перевод и нажми check': 'enter translation and press check',
    'источник': 'source',
    'новые': 'new',
    'пора повторить': 'due for review',
    'слабые': 'weak',
    'все': 'all',
    'порция': 'batch',
    'направление': 'direction',
    'цель': 'goal',
    'быстро запомнить': 'memorize fast',
    'закрепить надолго': 'retain longer',
    'строгость': 'strictness',
    'мягко': 'soft',
    'строго': 'strict',
    'опечатки': 'typos',
    'формы (EN)': 'forms (EN)',
    'подсказки': 'hints',
    'создать': 'create',
    'удалить раздел': 'delete section',
    'сохранить': 'save',
    'список разделов': 'section list',
    'слова в разделе': 'words in section',
    'слова': 'words',
    'выбери грамматическую тему': 'choose a grammar topic',
    'прошепчи моё имя, пожалуйста': 'whisper my name, please',
    'Меню': 'Menu',
    'Экспорт JSON': 'Export JSON',
    'Импорт JSON': 'Import JSON',
    '+ Категория': '+ Category',
    '+ Подкатегория': '+ Subcategory',
    'Переименовать': 'Rename',
    'Удалить': 'Delete',
    'Новая заметка': 'New note',
    'Прошептать': 'Whisper',
    'Закрыть': 'Close',
    'Применить': 'Apply',
    'Сброс': 'Reset',
    'Отмена': 'Cancel',
    'Ок': 'OK',
    'Цвет текста': 'Text color',
    'Маркер': 'Marker',
    'Проверить': 'Test',
    'Поиск по заметкам…': 'Search notes…',
    'Название заметки…': 'Note title…',
    'ЗАМЕТКИ': 'NOTES',
    'Очистить': 'Clear',
    'Из заметок': 'From notes',
    'Озвучить': 'Speak',
    'Стоп': 'Stop',
    'Заблокировать': 'Lock',
    'Пауза': 'Pause',
    'Вставить': 'Insert',
    'Вставить и озвучить': 'Insert and speak',
    'Выбери заметки - я вставлю их в поле текста. Можно сразу озвучить.': 'Select notes - I will insert them into the text field. You can speak them right away.',
    'Поиск заметок...': 'Search notes...',
    'грамматика: правила + практика': 'grammar: rules + practice',
    'времена: теория + упражнения': 'tenses: theory + exercises',
    'практика и constructor для word forms': 'practice and constructor for word forms',
    'правила, формулы, маркеры, ошибки': 'rules, formulas, markers, mistakes',
    'открыть': 'open',
    'сравнение времён': 'tenses comparison',
    'выбери любые 2 времени и потренируй различие': 'pick any 2 tenses and train the difference',
    'упражнения': 'practice',
    'закрепление по целям и смешанные тренировки': 'goal-based drills and mixed training',
    '+ project': '+ project',
    '+ task': '+ task',
    '+ schedule': '+ schedule',
    'clear': 'clear',
    'board': 'board',
    'schedule': 'schedule',
    'module': 'module',
    'planning · projects · tasks': 'planning · projects · tasks',
    'pre-alpha': 'pre-alpha',
    'priority: all': 'priority: all',
    'priority: high': 'priority: high',
    'priority: mid': 'priority: mid',
    'priority: low': 'priority: low',
    'deadline: all': 'deadline: all',
    'deadline: today': 'deadline: today',
    'deadline: overdue': 'deadline: overdue',
    'deadline: week': 'deadline: week',
    'sort: default': 'sort: default',
    'sort: deadline': 'sort: deadline',
    'sort: priority': 'sort: priority',
    'sort: newest': 'sort: newest',
    'value': 'value',
    'settings': 'settings',
    'dialog': 'dialog',
    'replace': 'replace',
    'cloud mode': 'cloud mode',
    'poll': 'poll',
    'token (PAT)': 'token (PAT)',
    'owner / user': 'owner / user',
    'repo': 'repo',
    'branch': 'branch',
    'path (json file)': 'path (json file)',
    'gist id': 'gist id',
    'filename': 'filename',
    'check': 'check',
    'hint': 'hint',
    'start': 'start',
    'constructor': 'constructor',
    'dictionary': 'dictionary',
    'structure': 'structure',
    'tenses': 'tenses',
    'word transformation': 'word transformation',
    'ready': 'ready'
  };

  const TEXTS_EN_TO_RU = {
    'Main menu': 'Главное меню',
    'Settings': 'Настройки',
    'Site language': 'Язык сайта',
    'Russian': 'Русский',
    'section in development': 'отсек в разработке',
    'This section is not ready yet. Come back later.': 'Этот отсек ещё не ожил. Возвращайся позже.',
    'go back': 'вернуться назад',
    'open': 'перейти',
    'planning': 'планирование',
    'Study Center': 'Учебный центр',
    'choose a section to start': 'выбери раздел, чтобы начать',
    'continue': 'продолжить',
    'learning': 'обучение',
    'cards': 'карточки',
    'practice': 'практика',
    'learn': 'заучивание',
    'sections': 'разделы',
    'back': 'назад',
    'next': 'далее',
    'EN': 'англ',
    'RU': 'рус',
    'give up': 'сдаюсь',
    'accept': 'засчитать',
    'reject': 'не засчитывать',
    'settings are saved in the browser': 'настройки сохраняются в браузере',
    'tap the card to flip it': 'нажми на карточку чтобы перевернуть',
    'translate': 'переведи',
    'enter translation and press check': 'введи перевод и нажми check',
    'source': 'источник',
    'new': 'новые',
    'due for review': 'пора повторить',
    'weak': 'слабые',
    'all': 'все',
    'batch': 'порция',
    'direction': 'направление',
    'goal': 'цель',
    'memorize fast': 'быстро запомнить',
    'retain longer': 'закрепить надолго',
    'strictness': 'строгость',
    'soft': 'мягко',
    'strict': 'строго',
    'typos': 'опечатки',
    'hints': 'подсказки',
    'create': 'создать',
    'delete section': 'удалить раздел',
    'save': 'сохранить',
    'section list': 'список разделов',
    'words in section': 'слова в разделе',
    'words': 'слова',
    'choose a grammar topic': 'выбери грамматическую тему',
    'whisper my name, please': 'прошепчи моё имя, пожалуйста',
    'Menu': 'Меню',
    'Export JSON': 'Экспорт JSON',
    'Import JSON': 'Импорт JSON',
    '+ Category': '+ Категория',
    '+ Subcategory': '+ Подкатегория',
    'Rename': 'Переименовать',
    'Delete': 'Удалить',
    'New note': 'Новая заметка',
    'Whisper': 'Прошептать',
    'Close': 'Закрыть',
    'Apply': 'Применить',
    'Reset': 'Сброс',
    'Cancel': 'Отмена',
    'OK': 'Ок',
    'Text color': 'Цвет текста',
    'Marker': 'Маркер',
    'Test': 'Проверить',
    'Search notes…': 'Поиск по заметкам…',
    'Note title…': 'Название заметки…',
    'NOTES': 'ЗАМЕТКИ',
    'Clear': 'Очистить',
    'From notes': 'Из заметок',
    'Speak': 'Озвучить',
    'Stop': 'Стоп',
    'Lock': 'Заблокировать',
    'Pause': 'Пауза',
    'Insert': 'Вставить',
    'Insert and speak': 'Вставить и озвучить',
    'Select notes - I will insert them into the text field. You can speak them right away.': 'Выбери заметки - я вставлю их в поле текста. Можно сразу озвучить.',
    'Search notes...': 'Поиск заметок...',
    'grammar: rules + practice': 'грамматика: правила + практика',
    'tenses: theory + exercises': 'времена: теория + упражнения',
    'practice and constructor for word forms': 'практика и constructor для word forms',
    'rules, formulas, markers, mistakes': 'правила, формулы, маркеры, ошибки',
    'tenses comparison': 'сравнение времён',
    'pick any 2 tenses and train the difference': 'выбери любые 2 времени и потренируй различие',
    'priority: all': 'priority: all',
    'priority: high': 'priority: high',
    'priority: mid': 'priority: mid',
    'priority: low': 'priority: low',
    'deadline: all': 'deadline: all',
    'deadline: today': 'deadline: today',
    'deadline: overdue': 'deadline: overdue',
    'deadline: week': 'deadline: week',
    'sort: default': 'sort: default',
    'sort: deadline': 'sort: deadline',
    'sort: priority': 'sort: priority',
    'sort: newest': 'sort: newest',
    'value': 'value',
    'settings': 'settings',
    'dialog': 'dialog'
  };

  const PLACEHOLDERS_RU_TO_EN = {
    'Поиск по заметкам…': 'Search notes…',
    'Название заметки…': 'Note title…',
    'Поиск заметок...': 'Search notes...',
    'Вставь сюда текст...': 'Paste text here...',
    'поиск задач…': 'search tasks…',
    'поиск...': 'search...',
    'Ответ': 'Answer',
    'Введите перевод...': 'Enter translation...',
    'название раздела': 'section name',
    'перевод (RU)': 'translation (RU)'
  };

  const PLACEHOLDERS_EN_TO_RU = {
    'Search notes…': 'Поиск по заметкам…',
    'Note title…': 'Название заметки…',
    'Search notes...': 'Поиск заметок...',
    'Paste text here...': 'Вставь сюда текст...',
    'search tasks…': 'поиск задач…',
    'search...': 'поиск...',
    'Answer': 'Ответ',
    'Enter translation...': 'Введите перевод...',
    'section name': 'название раздела',
    'translation (RU)': 'перевод (RU)'
  };

  const SELECTOR_RULES = {
    index: [
      { selector: '#devOverlayTitle', text: { ru: 'отсек в разработке', en: 'section in development' } },
      { selector: '#devOverlayText', text: { ru: 'Этот отсек ещё не ожил. Возвращайся позже.', en: 'This section is not ready yet. Come back later.' } },
      { selector: '#devOverlayBack', text: { ru: 'вернуться назад', en: 'go back' } },
      { selector: '.nav-btn--user .nav-btn__hint', text: { ru: 'перейти', en: 'open' } },
      { selector: '.nav-btn--crate .nav-btn__hint', text: { ru: 'перейти', en: 'open' } }
    ],
    planning: [
      { selector: '.planning-title h1', text: { ru: 'планирование', en: 'planning' } },
      { selector: '#searchInput', placeholder: { ru: 'поиск задач…', en: 'search tasks…' } }
    ],
    student_helper: [
      { selector: '#shLobby .ik-title', text: { ru: 'Учебный центр', en: 'Study Center' } },
      { selector: '#shLobby .ik-sub', text: { ru: 'выбери раздел, чтобы начать', en: 'choose a section to start' } },
      { selector: '#shContinue', text: { ru: 'продолжить', en: 'continue' } }
    ],
    whisperer: [
      { selector: '.w-title .sub', text: { ru: 'прошепчи моё имя, пожалуйста', en: 'whisper my name, please' } },
      { selector: '#textInput', placeholder: { ru: 'Вставь сюда текст...', en: 'Paste text here...' } },
      { selector: '#notesSearch', placeholder: { ru: 'Поиск заметок...', en: 'Search notes...' } }
    ],
    'item-crate': [
      { selector: '#searchInput', placeholder: { ru: 'Поиск по заметкам…', en: 'Search notes…' } },
      { selector: '#noteTitle', placeholder: { ru: 'Название заметки…', en: 'Note title…' } }
    ],
    onoi_notes: [
      { selector: 'h1', text: { ru: 'ЗАМЕТКИ', en: 'NOTES' } },
      { selector: '#searchInput', placeholder: { ru: 'Поиск по заметкам…', en: 'Search notes…' } },
      { selector: '#noteTitle', placeholder: { ru: 'Название заметки…', en: 'Note title…' } }
    ]
  };

  function normalize(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function getLang() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'en' ? 'en' : DEFAULT_LANG;
    } catch (e) {
      return DEFAULT_LANG;
    }
  }

  function saveLang(lang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang === 'en' ? 'en' : 'ru');
    } catch (e) {}
  }

  function translateText(text, lang) {
    const key = normalize(text);
    if (!key) return text;
    if (lang === 'en') return TEXTS_RU_TO_EN[key] || text;
    return TEXTS_EN_TO_RU[key] || text;
  }

  function translatePlaceholder(text, lang) {
    const key = normalize(text);
    if (!key) return text;
    if (lang === 'en') return PLACEHOLDERS_RU_TO_EN[key] || text;
    return PLACEHOLDERS_EN_TO_RU[key] || text;
  }

  function setPanelState(lang) {
    const ru = document.getElementById('ikLangRu');
    const en = document.getElementById('ikLangEn');
    if (ru) ru.checked = lang === 'ru';
    if (en) en.checked = lang === 'en';
    document.querySelectorAll('.ik-lang-option').forEach((label) => {
      const input = label.querySelector('input');
      label.classList.toggle('is-active', !!input?.checked);
    });
    const gear = document.getElementById('ikGlobalSettingsBtn');
    if (gear) {
      const label = lang === 'en' ? 'Site settings' : 'Настройки сайта';
      gear.setAttribute('aria-label', label);
      gear.setAttribute('title', label);
    }
  }

  function applySelectorRules(lang) {
    const rules = SELECTOR_RULES[PAGE] || [];
    rules.forEach((rule) => {
      document.querySelectorAll(rule.selector).forEach((el) => {
        if (rule.text) el.textContent = rule.text[lang];
        if (rule.placeholder && 'placeholder' in el) el.placeholder = rule.placeholder[lang];
      });
    });
  }

  function isTranslatableElement(el) {
    if (!el || !(el instanceof Element)) return false;
    if (el.closest('[contenteditable="true"]')) return false;
    if (el.closest('#ikSiteSettingsPanel')) return false;
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.tagName === 'SELECT') return false;
    return true;
  }

  function applyTextTranslations(lang) {
    const selector = [
      'button', 'a', 'label', 'option', 'h1', 'h2', 'h3', 'h4', 'p',
      'span.nav-btn__hint', '.kicker', '.hint', '.modal-title', '.modal__title',
      '.ik-title', '.ik-sub', '.ik-footnote', '.ik-label', '.ik-prompt'
    ].join(',');

    document.querySelectorAll(selector).forEach((el) => {
      if (!isTranslatableElement(el)) return;
      const text = normalize(el.textContent);
      if (!text) return;
      const translated = translateText(text, lang);
      if (translated !== text) el.textContent = translated;
    });

    document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach((el) => {
      const current = el.getAttribute('placeholder');
      const translated = translatePlaceholder(current, lang);
      if (translated !== current) el.setAttribute('placeholder', translated);
    });
  }

  function applyLanguage(lang) {
    const next = lang === 'en' ? 'en' : 'ru';
    document.documentElement.lang = next;
    if (TITLES[PAGE]) document.title = TITLES[PAGE][next];

    const titleEl = document.getElementById('ikSiteSettingsTitle');
    const closeEl = document.getElementById('ikSiteSettingsClose');
    const labelEl = document.getElementById('ikSiteLangLabel');
    const ruEl = document.getElementById('ikLangRuText');
    const enEl = document.getElementById('ikLangEnText');

    if (titleEl) titleEl.textContent = next === 'en' ? 'Settings' : 'Настройки';
    if (closeEl) closeEl.textContent = next === 'en' ? 'Close' : 'Закрыть';
    if (labelEl) labelEl.textContent = next === 'en' ? 'Site language' : 'Язык сайта';
    if (ruEl) ruEl.textContent = next === 'en' ? 'Russian' : 'Русский';
    if (enEl) enEl.textContent = 'English';

    applySelectorRules(next);
    applyTextTranslations(next);
    setPanelState(next);
  }

  function setLang(lang) {
    const next = lang === 'en' ? 'en' : 'ru';
    saveLang(next);
    applyLanguage(next);
    document.dispatchEvent(new CustomEvent('ik:languagechange', { detail: { lang: next } }));
  }

  function buildGearButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'ikGlobalSettingsBtn';
    btn.className = 'ik-gear-btn';
    btn.setAttribute('aria-label', 'Настройки сайта');
    btn.setAttribute('title', 'Настройки сайта');
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
        <path d="M12 8.4A3.6 3.6 0 1 0 12 15.6A3.6 3.6 0 1 0 12 8.4Z"/>
        <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.2 1.2 0 0 1 0 1.7l-1.6 1.6a1.2 1.2 0 0 1-1.7 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1.2 1.2 0 0 1-1.2 1.2h-2.3A1.2 1.2 0 0 1 9.9 20v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.2 1.2 0 0 1-1.7 0l-1.6-1.6a1.2 1.2 0 0 1 0-1.7l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4A1.2 1.2 0 0 1 2.8 13v-2.3A1.2 1.2 0 0 1 4 9.5h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.2 1.2 0 0 1 0-1.7l1.6-1.6a1.2 1.2 0 0 1 1.7 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4A1.2 1.2 0 0 1 11.1 2.8h2.3A1.2 1.2 0 0 1 14.6 4v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1.2 1.2 0 0 1 1.7 0l1.6 1.6a1.2 1.2 0 0 1 0 1.7l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.2A1.2 1.2 0 0 1 21.2 10.7V13A1.2 1.2 0 0 1 20 14.2h-.2a1 1 0 0 0-.4.8Z"/>
      </svg>
    `;
    return btn;
  }

  function buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'ikSiteSettingsPanel';
    panel.className = 'ik-settings-panel';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="ik-settings-panel__head">
        <p class="ik-settings-panel__title" id="ikSiteSettingsTitle">Настройки</p>
        <button type="button" class="ik-settings-panel__close" id="ikSiteSettingsClose">Закрыть</button>
      </div>
      <div class="ik-settings-group">
        <div class="ik-settings-label" id="ikSiteLangLabel">Язык сайта</div>
        <div class="ik-lang-switch">
          <label class="ik-lang-option" for="ikLangRu">
            <input type="radio" name="ikSiteLang" id="ikLangRu" value="ru" />
            <span id="ikLangRuText">Русский</span>
          </label>
          <label class="ik-lang-option" for="ikLangEn">
            <input type="radio" name="ikSiteLang" id="ikLangEn" value="en" />
            <span id="ikLangEnText">English</span>
          </label>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    return panel;
  }

  function initSettingsUI() {
    if (document.getElementById('ikGlobalSettingsBtn')) return;

    const gearBtn = buildGearButton();
    const panel = buildPanel();
    const closeBtn = panel.querySelector('#ikSiteSettingsClose');
    const header = document.querySelector('.ik-site-nav');

    if (header) {
      let actions = header.querySelector('.ik-site-nav__actions');
      if (!actions) {
        actions = document.createElement('div');
        actions.className = 'ik-site-nav__actions';
        header.appendChild(actions);
      }
      actions.appendChild(gearBtn);
    } else {
      const floating = document.createElement('div');
      floating.className = 'ik-floating-settings';
      floating.appendChild(gearBtn);
      document.body.appendChild(floating);
    }

    const openPanel = () => { panel.hidden = false; };
    const closePanel = () => { panel.hidden = true; };

    gearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.hidden ? openPanel() : closePanel();
    });
    closeBtn.addEventListener('click', closePanel);
    panel.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', () => { if (!panel.hidden) closePanel(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) closePanel(); });
    panel.querySelectorAll('input[name="ikSiteLang"]').forEach((input) => {
      input.addEventListener('change', () => setLang(input.value));
    });
  }

  function initObserver() {
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        applyLanguage(getLang());
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.IKSiteLang = {
    get: getLang,
    set: setLang,
    apply: () => applyLanguage(getLang())
  };

  document.addEventListener('DOMContentLoaded', () => {
    initSettingsUI();
    applyLanguage(getLang());
    initObserver();
  });
})();
