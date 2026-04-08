const QUERY_FLAG_KEY = "dict_react";
const STORAGE_FLAG_KEY = "sh_dict_react_shell_v1";
const STORAGE_SOURCE_KEY = "student_helper_dict_source_v1";

const TRUE_SET = new Set(["1", "true", "yes", "on"]);
const FALSE_SET = new Set(["0", "false", "no", "off"]);
const SOURCES = new Set(["personal", "system", "user"]);

function parseFlagValue(raw) {
  const v = String(raw || "").trim().toLowerCase();
  if (!v) return null;
  if (TRUE_SET.has(v)) return true;
  if (FALSE_SET.has(v)) return false;
  return null;
}

function normalizeSource(raw) {
  const v = String(raw || "").trim().toLowerCase();
  return SOURCES.has(v) ? v : "personal";
}

function getSupabaseClient() {
  try {
    if (!(window.IKSupabase && typeof window.IKSupabase.getClient === "function")) return null;
    return window.IKSupabase.getClient();
  } catch (_err) {
    return null;
  }
}

export function resolveDictionaryShellEnabled(defaultEnabled) {
  const fallback = !!defaultEnabled;
  if (typeof window === "undefined") return fallback;

  let queryValue = null;
  try {
    const params = new URLSearchParams(window.location.search || "");
    queryValue = parseFlagValue(params.get(QUERY_FLAG_KEY));
  } catch (_err) {
    queryValue = null;
  }

  if (queryValue !== null) {
    try {
      localStorage.setItem(STORAGE_FLAG_KEY, queryValue ? "1" : "0");
    } catch (_err) {}
    return queryValue;
  }

  try {
    const stored = parseFlagValue(localStorage.getItem(STORAGE_FLAG_KEY));
    if (stored !== null) return stored;
  } catch (_err) {}

  return fallback;
}

export function setDictionaryShellEnabled(enabled) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_FLAG_KEY, enabled ? "1" : "0");
  } catch (_err) {}
}

export function defaultDictionaryCapabilities() {
  return {
    canOpenAdminConsole: false,
    canReviewPublishRequests: false,
    canManageSystemDicts: false,
    canManageUserDicts: false,
    canSubmitPublishRequest: false,
  };
}

export function normalizeDictionaryCapabilities(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    canOpenAdminConsole: src.can_open_admin_console === true || src.canOpenAdminConsole === true,
    canReviewPublishRequests: src.can_review_publish_requests === true || src.canReviewPublishRequests === true,
    canManageSystemDicts: src.can_manage_system_dicts === true || src.canManageSystemDicts === true,
    canManageUserDicts: src.can_manage_user_dicts === true || src.canManageUserDicts === true,
    canSubmitPublishRequest: src.can_submit_publish_request === true || src.canSubmitPublishRequest === true,
  };
}

export function defaultDictionarySnapshot() {
  return {
    booted: false,
    source: "personal",
    currentSection: "",
    personalGuest: false,
    canEditCurrentSource: false,
    canUseBuilderForCurrentSource: false,
    subtab: "first-pick",
    counts: { sections: 0, words: 0 },
    capabilities: defaultDictionaryCapabilities(),
  };
}

export function defaultDictionaryFirstPickModel() {
  return {
    source: "personal",
    personalGuest: false,
    query: "",
    totalCount: 0,
    items: [],
    empty: true,
    message: "",
  };
}

export function normalizeDictionaryFirstPickModel(raw) {
  const base = defaultDictionaryFirstPickModel();
  const src = raw && typeof raw === "object" ? raw : {};
  const rows = Array.isArray(src.items) ? src.items : [];
  return {
    ...base,
    source: normalizeSource(src.source),
    personalGuest: src.personalGuest === true,
    query: String(src.query || ""),
    totalCount: Number(src.totalCount) || 0,
    items: rows.map((item) => ({
      sid: String(item && item.sid != null ? item.sid : ""),
      name: String(item && item.name ? item.name : ""),
      count: Number(item && item.count) || 0,
    })),
    empty: src.empty === true || rows.length === 0,
    message: String(src.message || ""),
  };
}

export function defaultDictionaryViewModel() {
  return {
    source: "personal",
    selected: "",
    query: "",
    totalAll: 0,
    shown: 0,
    items: [],
    empty: true,
    message: "выбери section",
    meta: "0",
  };
}

export function normalizeDictionaryViewModel(raw) {
  const base = defaultDictionaryViewModel();
  const src = raw && typeof raw === "object" ? raw : {};
  const rows = Array.isArray(src.items) ? src.items : [];
  return {
    ...base,
    source: normalizeSource(src.source),
    selected: String(src.selected || ""),
    query: String(src.query || ""),
    totalAll: Number(src.totalAll) || 0,
    shown: Number(src.shown) || 0,
    items: rows.map((item) => ({
      id: item && item.id != null ? item.id : null,
      sectionId: item && item.sectionId != null ? item.sectionId : null,
      en: String(item && item.en ? item.en : ""),
      ru: String(item && item.ru ? item.ru : ""),
    })),
    empty: src.empty === true || rows.length === 0,
    message: String(src.message || base.message),
    meta: String(src.meta || base.meta),
  };
}

export function defaultDictionaryCardsModel() {
  return {
    source: "personal",
    selected: "",
    frontPreference: "en",
    random: true,
    flipped: false,
    done: false,
    meta: "",
    frontText: "",
    backText: "",
    frontLang: "",
    backLang: "",
    deckSize: 0,
    queueSize: 0,
    historySize: 0,
    historyPos: -1,
  };
}

export function normalizeDictionaryCardsModel(raw) {
  const base = defaultDictionaryCardsModel();
  const src = raw && typeof raw === "object" ? raw : {};
  const frontPref = String(src.frontPreference || base.frontPreference).toLowerCase();
  return {
    ...base,
    source: normalizeSource(src.source),
    selected: String(src.selected || ""),
    frontPreference: ["en", "ru", "mix"].includes(frontPref) ? frontPref : "en",
    random: src.random !== false,
    flipped: src.flipped === true,
    done: src.done === true,
    meta: String(src.meta || ""),
    frontText: String(src.frontText || ""),
    backText: String(src.backText || ""),
    frontLang: String(src.frontLang || ""),
    backLang: String(src.backLang || ""),
    deckSize: Number(src.deckSize) || 0,
    queueSize: Number(src.queueSize) || 0,
    historySize: Number(src.historySize) || 0,
    historyPos: Number.isFinite(Number(src.historyPos)) ? Number(src.historyPos) : -1,
  };
}

export function defaultDictionaryPracticeModel() {
  return {
    source: "personal",
    selected: "",
    mode: "en",
    score: "0/0 | 0/0",
    prompt: "переведи",
    flipped: false,
    frontText: "",
    backText: "",
    frontLang: "",
    backLang: "",
    checkMode: "check",
    checkLabel: "check",
    skipLabel: "сдаюсь",
    hintVisible: true,
    fuzzyVisible: false,
    feedback: {
      state: "idle",
      stamp: "ready",
      line: "введи перевод и нажми check",
    },
    input: {
      visible: true,
      value: "",
      disabled: false,
      placeholder: "Ответ",
      isOk: false,
      isBad: false,
    },
    mcq: {
      visible: false,
      locked: false,
      selectedIdx: -1,
      correctIdx: -1,
      meta: "",
      options: [],
    },
    settingsOpen: false,
    settings: {
      session: "20",
      typos: true,
      ignoreTo: true,
      ignoreArticles: true,
      taskMode: "mix",
      mixInputPct: 60,
      mcqCount: 4,
      showPos: false,
      softMcq: true,
    },
    stats: {
      sessionTarget: 0,
      total: 0,
      correct: 0,
      seen: 0,
    },
  };
}

export function normalizeDictionaryPracticeModel(raw) {
  const base = defaultDictionaryPracticeModel();
  const src = raw && typeof raw === "object" ? raw : {};
  const feedback = src.feedback && typeof src.feedback === "object" ? src.feedback : {};
  const input = src.input && typeof src.input === "object" ? src.input : {};
  const mcq = src.mcq && typeof src.mcq === "object" ? src.mcq : {};
  const settings = src.settings && typeof src.settings === "object" ? src.settings : {};
  const stats = src.stats && typeof src.stats === "object" ? src.stats : {};
  const rawOptions = Array.isArray(mcq.options) ? mcq.options : [];

  return {
    ...base,
    source: normalizeSource(src.source),
    selected: String(src.selected || ""),
    mode: String(src.mode || base.mode),
    score: String(src.score || base.score),
    prompt: String(src.prompt || base.prompt),
    flipped: src.flipped === true,
    frontText: String(src.frontText || ""),
    backText: String(src.backText || ""),
    frontLang: String(src.frontLang || ""),
    backLang: String(src.backLang || ""),
    checkMode: String(src.checkMode || base.checkMode),
    checkLabel: String(src.checkLabel || base.checkLabel),
    skipLabel: String(src.skipLabel || base.skipLabel),
    hintVisible: src.hintVisible !== false,
    fuzzyVisible: src.fuzzyVisible === true,
    feedback: {
      state: String(feedback.state || base.feedback.state),
      stamp: String(feedback.stamp || base.feedback.stamp),
      line: String(feedback.line || base.feedback.line),
    },
    input: {
      visible: input.visible !== false,
      value: String(input.value || ""),
      disabled: input.disabled === true,
      placeholder: String(input.placeholder || base.input.placeholder),
      isOk: input.isOk === true,
      isBad: input.isBad === true,
    },
    mcq: {
      visible: mcq.visible === true,
      locked: mcq.locked === true,
      selectedIdx: Number.isFinite(Number(mcq.selectedIdx)) ? Number(mcq.selectedIdx) : -1,
      correctIdx: Number.isFinite(Number(mcq.correctIdx)) ? Number(mcq.correctIdx) : -1,
      meta: String(mcq.meta || ""),
      options: rawOptions.map((opt, idx) => ({
        index: Number.isFinite(Number(opt && opt.index)) ? Number(opt.index) : idx,
        text: String(opt && (opt.text || opt.label) ? (opt.text || opt.label) : ""),
        selected: opt && opt.selected === true,
        correct: opt && opt.correct === true,
        locked: opt && opt.locked === true,
      })),
    },
    settingsOpen: src.settingsOpen === true,
    settings: {
      session: String(settings.session || base.settings.session),
      typos: settings.typos !== false,
      ignoreTo: settings.ignoreTo !== false,
      ignoreArticles: settings.ignoreArticles !== false,
      taskMode: String(settings.taskMode || base.settings.taskMode),
      mixInputPct: Number(settings.mixInputPct) || base.settings.mixInputPct,
      mcqCount: Number(settings.mcqCount) || base.settings.mcqCount,
      showPos: settings.showPos === true,
      softMcq: settings.softMcq !== false,
    },
    stats: {
      sessionTarget: Number(stats.sessionTarget) || 0,
      total: Number(stats.total) || 0,
      correct: Number(stats.correct) || 0,
      seen: Number(stats.seen) || 0,
    },
  };
}

export function defaultDictionaryLearnModel() {
  return {
    source: "personal",
    selected: "",
    currentType: "",
    progress: "0/0",
    prompt: "заучивание",
    flipped: false,
    frontText: "",
    backText: "",
    frontLang: "",
    backLang: "",
    checkMode: "check",
    checkLabel: "check",
    giveUpLabel: "сдаюсь",
    hintVisible: true,
    giveUpVisible: true,
    input: {
      visible: true,
      value: "",
      disabled: false,
      placeholder: "Введите перевод...",
      isOk: false,
      isBad: false,
    },
    mcq: {
      visible: false,
      locked: false,
      selectedIdx: -1,
      correctIdx: -1,
      meta: "",
      options: [],
    },
    feedback: {
      state: "idle",
      stamp: "ready",
      line: "нажми start или выбери section",
    },
    settingsOpen: false,
    settings: {
      source: "new",
      portion: "8",
      dir: "ru",
      goal: "fast",
      strict: "soft",
      typos: true,
      acceptForms: true,
      ignoreTo: true,
      ignoreArticles: true,
      hints: true,
      introMode: "card",
      introMcqCount: 4,
      introShowPos: false,
    },
    session: {
      active: false,
      portion: 0,
      doneTests: 0,
      learnedCount: 0,
      queueSize: 0,
    },
  };
}

export function normalizeDictionaryLearnModel(raw) {
  const base = defaultDictionaryLearnModel();
  const src = raw && typeof raw === "object" ? raw : {};
  const input = src.input && typeof src.input === "object" ? src.input : {};
  const mcq = src.mcq && typeof src.mcq === "object" ? src.mcq : {};
  const feedback = src.feedback && typeof src.feedback === "object" ? src.feedback : {};
  const settings = src.settings && typeof src.settings === "object" ? src.settings : {};
  const session = src.session && typeof src.session === "object" ? src.session : {};
  const options = Array.isArray(mcq.options) ? mcq.options : [];

  return {
    ...base,
    source: normalizeSource(src.source),
    selected: String(src.selected || ""),
    currentType: String(src.currentType || ""),
    progress: String(src.progress || base.progress),
    prompt: String(src.prompt || base.prompt),
    flipped: src.flipped === true,
    frontText: String(src.frontText || ""),
    backText: String(src.backText || ""),
    frontLang: String(src.frontLang || ""),
    backLang: String(src.backLang || ""),
    checkMode: String(src.checkMode || base.checkMode),
    checkLabel: String(src.checkLabel || base.checkLabel),
    giveUpLabel: String(src.giveUpLabel || base.giveUpLabel),
    hintVisible: src.hintVisible !== false,
    giveUpVisible: src.giveUpVisible !== false,
    input: {
      visible: input.visible !== false,
      value: String(input.value || ""),
      disabled: input.disabled === true,
      placeholder: String(input.placeholder || base.input.placeholder),
      isOk: input.isOk === true,
      isBad: input.isBad === true,
    },
    mcq: {
      visible: mcq.visible === true,
      locked: mcq.locked === true,
      selectedIdx: Number.isFinite(Number(mcq.selectedIdx)) ? Number(mcq.selectedIdx) : -1,
      correctIdx: Number.isFinite(Number(mcq.correctIdx)) ? Number(mcq.correctIdx) : -1,
      meta: String(mcq.meta || ""),
      options: options.map((opt, idx) => ({
        index: Number.isFinite(Number(opt && opt.index)) ? Number(opt.index) : idx,
        text: String(opt && (opt.text || opt.label) ? (opt.text || opt.label) : ""),
        selected: opt && opt.selected === true,
        correct: opt && opt.correct === true,
        locked: opt && opt.locked === true,
      })),
    },
    feedback: {
      state: String(feedback.state || base.feedback.state),
      stamp: String(feedback.stamp || base.feedback.stamp),
      line: String(feedback.line || base.feedback.line),
    },
    settingsOpen: src.settingsOpen === true,
    settings: {
      source: String(settings.source || base.settings.source),
      portion: String(settings.portion || base.settings.portion),
      dir: String(settings.dir || base.settings.dir),
      goal: String(settings.goal || base.settings.goal),
      strict: String(settings.strict || base.settings.strict),
      typos: settings.typos !== false,
      acceptForms: settings.acceptForms !== false,
      ignoreTo: settings.ignoreTo !== false,
      ignoreArticles: settings.ignoreArticles !== false,
      hints: settings.hints !== false,
      introMode: String(settings.introMode || base.settings.introMode),
      introMcqCount: Number(settings.introMcqCount) || base.settings.introMcqCount,
      introShowPos: settings.introShowPos === true,
    },
    session: {
      active: session.active === true,
      portion: Number(session.portion) || 0,
      doneTests: Number(session.doneTests) || 0,
      learnedCount: Number(session.learnedCount) || 0,
      queueSize: Number(session.queueSize) || 0,
    },
  };
}

export function defaultDictionaryBuilderModel() {
  return {
    source: "personal",
    selected: "",
    editable: false,
    canEditWords: false,
    canCreateSection: false,
    canDeleteSection: false,
    canImportExport: false,
    canSubmit: false,
    submitAction: "none",
    submitLabel: "",
    submitTitle: "",
    readOnlyMessage: "",
    sections: [],
    words: [],
    counts: {
      sections: 0,
      words: 0,
    },
  };
}

export function normalizeDictionaryBuilderModel(raw) {
  const base = defaultDictionaryBuilderModel();
  const src = raw && typeof raw === "object" ? raw : {};
  const sections = Array.isArray(src.sections) ? src.sections : [];
  const words = Array.isArray(src.words) ? src.words : [];
  const counts = src.counts && typeof src.counts === "object" ? src.counts : {};
  const submitAction = String(src.submitAction || base.submitAction);

  return {
    ...base,
    source: normalizeSource(src.source),
    selected: String(src.selected || ""),
    editable: src.editable === true,
    canEditWords: src.canEditWords === true,
    canCreateSection: src.canCreateSection === true,
    canDeleteSection: src.canDeleteSection === true,
    canImportExport: src.canImportExport === true,
    canSubmit: src.canSubmit === true,
    submitAction: ["none", "moderation", "save-cloud"].includes(submitAction) ? submitAction : "none",
    submitLabel: String(src.submitLabel || ""),
    submitTitle: String(src.submitTitle || ""),
    readOnlyMessage: String(src.readOnlyMessage || ""),
    sections: sections.map((item) => ({
      sid: String(item && item.sid != null ? item.sid : ""),
      name: String(item && item.name ? item.name : ""),
      count: Number(item && item.count) || 0,
    })),
    words: words.map((item) => ({
      id: item && item.id != null ? item.id : null,
      sectionId: item && item.sectionId != null ? item.sectionId : null,
      en: String(item && item.en ? item.en : ""),
      ru: String(item && item.ru ? item.ru : ""),
    })),
    counts: {
      sections: Number(counts.sections) || sections.length,
      words: Number(counts.words) || 0,
    },
  };
}

export function normalizeDictionarySnapshot(raw) {
  const base = defaultDictionarySnapshot();
  const src = raw && typeof raw === "object" ? raw : {};
  const counts = src && src.counts && typeof src.counts === "object" ? src.counts : {};
  return {
    ...base,
    booted: src.booted === true,
    source: normalizeSource(src.source),
    currentSection: String(src.currentSection || ""),
    personalGuest: src.personalGuest === true,
    canEditCurrentSource: src.canEditCurrentSource === true,
    canUseBuilderForCurrentSource: src.canUseBuilderForCurrentSource === true,
    subtab: String(src.subtab || base.subtab),
    counts: {
      sections: Number(counts.sections) || 0,
      words: Number(counts.words) || 0,
    },
    capabilities: normalizeDictionaryCapabilities(src.capabilities || src),
  };
}

export function getDictionaryBridge() {
  if (typeof window === "undefined") return null;
  const bridge = window.IKDictionaryBridge || window.dictBridge || null;
  if (!bridge || typeof bridge.getState !== "function") return null;
  return bridge;
}

export async function waitForDictionaryBridge(timeoutMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const bridge = getDictionaryBridge();
    if (bridge) return bridge;
    await new Promise((resolve) => window.setTimeout(resolve, 120));
  }
  return null;
}

async function fetchCapabilitiesFallback(client) {
  const base = defaultDictionaryCapabilities();
  if (!client) return base;

  try {
    const out = await client.rpc("ik_can_open_admin_console");
    const canOpen = !!(out && out.data === true);
    return {
      canOpenAdminConsole: canOpen,
      canReviewPublishRequests: canOpen,
      canManageSystemDicts: canOpen,
      canManageUserDicts: canOpen,
      canSubmitPublishRequest: true,
    };
  } catch (_err) {
    return {
      ...base,
      canSubmitPublishRequest: true,
    };
  }
}

export async function fetchDictionaryCapabilitiesFromCloud() {
  if (typeof window === "undefined") return defaultDictionaryCapabilities();
  const client = getSupabaseClient();
  if (!client || !client.auth || typeof client.auth.getUser !== "function") {
    return defaultDictionaryCapabilities();
  }

  let user = null;
  try {
    const out = await client.auth.getUser();
    user = out && out.data ? out.data.user : null;
  } catch (_err) {
    user = null;
  }
  if (!user) return defaultDictionaryCapabilities();

  try {
    const out = await client.rpc("ik_dictionary_capabilities");
    if (out && out.error) throw out.error;
    if (out && out.data && typeof out.data === "object") {
      const caps = normalizeDictionaryCapabilities(out.data);
      if (!caps.canSubmitPublishRequest) caps.canSubmitPublishRequest = true;
      return caps;
    }
  } catch (_err) {}

  return fetchCapabilitiesFallback(client);
}

function fallbackSnapshotFromStorage(caps) {
  let source = "personal";
  try {
    source = normalizeSource(localStorage.getItem(STORAGE_SOURCE_KEY));
  } catch (_err) {
    source = "personal";
  }

  const capabilities = normalizeDictionaryCapabilities(caps);
  const canEditCurrentSource = source === "personal"
    ? capabilities.canSubmitPublishRequest
    : (source === "system" ? capabilities.canManageSystemDicts : capabilities.canManageUserDicts);

  return normalizeDictionarySnapshot({
    booted: false,
    source,
    personalGuest: !capabilities.canSubmitPublishRequest,
    canEditCurrentSource,
    canUseBuilderForCurrentSource: canEditCurrentSource,
    capabilities,
  });
}

export async function getDictionarySnapshot() {
  const bridge = getDictionaryBridge();
  if (bridge) {
    try {
      return normalizeDictionarySnapshot(bridge.getState());
    } catch (_err) {}
  }

  const caps = await fetchDictionaryCapabilitiesFromCloud();
  return fallbackSnapshotFromStorage(caps);
}

export async function refreshDictionarySnapshot() {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.refreshCapabilities === "function") {
    try {
      const out = await bridge.refreshCapabilities();
      return normalizeDictionarySnapshot(out);
    } catch (_err) {}
  }
  return getDictionarySnapshot();
}

export async function setDictionarySource(nextSource) {
  const source = normalizeSource(nextSource);
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.setSource === "function") {
    const out = await bridge.setSource(source);
    return normalizeDictionarySnapshot(out);
  }

  try {
    localStorage.setItem(STORAGE_SOURCE_KEY, source);
  } catch (_err) {}
  return getDictionarySnapshot();
}

export async function listDictionaryFirstPick(query) {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.listFirstPick === "function") {
    const out = await bridge.listFirstPick(query);
    return normalizeDictionaryFirstPickModel(out);
  }

  const snapshot = await getDictionarySnapshot();
  if (snapshot.source === "personal" && snapshot.personalGuest) {
    return normalizeDictionaryFirstPickModel({
      source: "personal",
      personalGuest: true,
      message: "войдите, чтобы видеть личные словари",
    });
  }

  return normalizeDictionaryFirstPickModel({
    source: snapshot.source,
    totalCount: Number(snapshot && snapshot.counts && snapshot.counts.words) || 0,
    items: [
      {
        sid: "All",
        name: "All (все разделы)",
        count: Number(snapshot && snapshot.counts && snapshot.counts.words) || 0,
      },
    ],
    empty: false,
  });
}

export async function listDictionaryView(sectionValue, query) {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.listView === "function") {
    const out = await bridge.listView(sectionValue, query);
    return normalizeDictionaryViewModel(out);
  }

  const snapshot = await getDictionarySnapshot();
  return normalizeDictionaryViewModel({
    source: snapshot.source,
    selected: String(sectionValue || snapshot.currentSection || ""),
    query: String(query || ""),
  });
}

export async function loadDictionaryViewSection(sectionValue) {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.loadViewSection === "function") {
    const out = await bridge.loadViewSection(sectionValue);
    const state = normalizeDictionarySnapshot(out && out.state);
    const view = normalizeDictionaryViewModel(out && out.view);
    return { state, view };
  }

  const state = await getDictionarySnapshot();
  const view = await listDictionaryView(sectionValue, "");
  return { state, view };
}

function normalizeDictionaryCardsPayload(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    state: normalizeDictionarySnapshot(src.state || src),
    cards: normalizeDictionaryCardsModel(src.cards || src),
  };
}

export async function getDictionaryCardsState() {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.getCardsState === "function") {
    const out = await bridge.getCardsState();
    return normalizeDictionaryCardsPayload(out);
  }

  const state = await getDictionarySnapshot();
  const cards = normalizeDictionaryCardsModel({
    source: state.source,
    selected: state.currentSection,
  });
  return { state, cards };
}

export async function loadDictionaryCardsSection(sectionValue) {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.loadCardsSection === "function") {
    const out = await bridge.loadCardsSection(sectionValue);
    return normalizeDictionaryCardsPayload(out);
  }
  return getDictionaryCardsState();
}

export async function dictionaryCardsNext() {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.cardsNext === "function") {
    const out = await bridge.cardsNext();
    return normalizeDictionaryCardsPayload(out);
  }
  return getDictionaryCardsState();
}

export async function dictionaryCardsPrev() {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.cardsPrev === "function") {
    const out = await bridge.cardsPrev();
    return normalizeDictionaryCardsPayload(out);
  }
  return getDictionaryCardsState();
}

export async function dictionaryCardsToggleFlip() {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.cardsToggleFlip === "function") {
    const out = await bridge.cardsToggleFlip();
    return normalizeDictionaryCardsPayload(out);
  }
  return getDictionaryCardsState();
}

export async function dictionaryCardsRestart() {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.cardsRestart === "function") {
    const out = await bridge.cardsRestart();
    return normalizeDictionaryCardsPayload(out);
  }
  return getDictionaryCardsState();
}

export async function setDictionaryCardsFront(frontPreference) {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.setCardsFront === "function") {
    const out = await bridge.setCardsFront(frontPreference);
    return normalizeDictionaryCardsPayload(out);
  }
  return getDictionaryCardsState();
}

export async function setDictionaryCardsRandom(randomMode) {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.setCardsRandom === "function") {
    const out = await bridge.setCardsRandom(randomMode);
    return normalizeDictionaryCardsPayload(out);
  }
  return getDictionaryCardsState();
}

function normalizeDictionaryPracticePayload(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    state: normalizeDictionarySnapshot(src.state || src),
    practice: normalizeDictionaryPracticeModel(src.practice || src),
  };
}

export async function getDictionaryPracticeState() {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.getPracticeState === "function") {
    const out = await bridge.getPracticeState();
    return normalizeDictionaryPracticePayload(out);
  }

  const state = await getDictionarySnapshot();
  const practice = normalizeDictionaryPracticeModel({
    source: state.source,
    selected: state.currentSection,
  });
  return { state, practice };
}

export async function loadDictionaryPracticeSection(sectionValue) {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.loadPracticeSection === "function") {
    const out = await bridge.loadPracticeSection(sectionValue);
    return normalizeDictionaryPracticePayload(out);
  }
  return getDictionaryPracticeState();
}

export async function setDictionaryPracticeMode(modeValue) {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.setPracticeMode === "function") {
    const out = await bridge.setPracticeMode(modeValue);
    return normalizeDictionaryPracticePayload(out);
  }
  return getDictionaryPracticeState();
}

export async function setDictionaryPracticeConfig(nextCfg) {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.setPracticeConfig === "function") {
    const out = await bridge.setPracticeConfig(nextCfg);
    return normalizeDictionaryPracticePayload(out);
  }
  return getDictionaryPracticeState();
}

export async function setDictionaryPracticeAnswer(answerText) {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.setPracticeAnswer === "function") {
    const out = await bridge.setPracticeAnswer(answerText);
    return normalizeDictionaryPracticePayload(out);
  }
  return getDictionaryPracticeState();
}

export async function dictionaryPracticeCheckOrNext() {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.practiceCheckOrNext === "function") {
    const out = await bridge.practiceCheckOrNext();
    return normalizeDictionaryPracticePayload(out);
  }
  return getDictionaryPracticeState();
}

export async function dictionaryPracticeSkip() {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.practiceSkip === "function") {
    const out = await bridge.practiceSkip();
    return normalizeDictionaryPracticePayload(out);
  }
  return getDictionaryPracticeState();
}

export async function dictionaryPracticeUseHint() {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.practiceUseHint === "function") {
    const out = await bridge.practiceUseHint();
    return normalizeDictionaryPracticePayload(out);
  }
  return getDictionaryPracticeState();
}

export async function dictionaryPracticeFuzzyResolve(accept) {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.practiceFuzzyResolve === "function") {
    const out = await bridge.practiceFuzzyResolve(accept === true);
    return normalizeDictionaryPracticePayload(out);
  }
  return getDictionaryPracticeState();
}

export async function dictionaryPracticeMcqSelect(indexValue) {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.practiceMcqSelect === "function") {
    const out = await bridge.practiceMcqSelect(indexValue);
    return normalizeDictionaryPracticePayload(out);
  }
  return getDictionaryPracticeState();
}

export async function dictionaryPracticeToggleFlip() {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.practiceToggleFlip === "function") {
    const out = await bridge.practiceToggleFlip();
    return normalizeDictionaryPracticePayload(out);
  }
  return getDictionaryPracticeState();
}

export async function toggleDictionaryPracticeSettings(forceOpen) {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.togglePracticeSettings === "function") {
    const out = await bridge.togglePracticeSettings(forceOpen);
    return normalizeDictionaryPracticePayload(out);
  }
  return getDictionaryPracticeState();
}

function normalizeDictionaryLearnPayload(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    state: normalizeDictionarySnapshot(src.state || src),
    learn: normalizeDictionaryLearnModel(src.learn || src),
  };
}

export async function getDictionaryLearnState() {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.getLearnState === "function") {
    const out = await bridge.getLearnState();
    return normalizeDictionaryLearnPayload(out);
  }

  const state = await getDictionarySnapshot();
  const learn = normalizeDictionaryLearnModel({
    source: state.source,
    selected: state.currentSection,
  });
  return { state, learn };
}

export async function loadDictionaryLearnSection(sectionValue) {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.loadLearnSection === "function") {
    const out = await bridge.loadLearnSection(sectionValue);
    return normalizeDictionaryLearnPayload(out);
  }
  return getDictionaryLearnState();
}

export async function startDictionaryLearnSession() {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.startLearnSession === "function") {
    const out = await bridge.startLearnSession();
    return normalizeDictionaryLearnPayload(out);
  }
  return getDictionaryLearnState();
}

export async function setDictionaryLearnConfig(nextCfg) {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.setLearnConfig === "function") {
    const out = await bridge.setLearnConfig(nextCfg);
    return normalizeDictionaryLearnPayload(out);
  }
  return getDictionaryLearnState();
}

export async function toggleDictionaryLearnSettings(forceOpen) {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.toggleLearnSettings === "function") {
    const out = await bridge.toggleLearnSettings(forceOpen);
    return normalizeDictionaryLearnPayload(out);
  }
  return getDictionaryLearnState();
}

export async function setDictionaryLearnAnswer(answerText) {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.setLearnAnswer === "function") {
    const out = await bridge.setLearnAnswer(answerText);
    return normalizeDictionaryLearnPayload(out);
  }
  return getDictionaryLearnState();
}

export async function dictionaryLearnCheckOrNext() {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.learnCheckOrNext === "function") {
    const out = await bridge.learnCheckOrNext();
    return normalizeDictionaryLearnPayload(out);
  }
  return getDictionaryLearnState();
}

export async function dictionaryLearnHint() {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.learnHint === "function") {
    const out = await bridge.learnHint();
    return normalizeDictionaryLearnPayload(out);
  }
  return getDictionaryLearnState();
}

export async function dictionaryLearnGiveUp() {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.learnGiveUp === "function") {
    const out = await bridge.learnGiveUp();
    return normalizeDictionaryLearnPayload(out);
  }
  return getDictionaryLearnState();
}

export async function dictionaryLearnIntroMcqSelect(indexValue) {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.learnIntroMcqSelect === "function") {
    const out = await bridge.learnIntroMcqSelect(indexValue);
    return normalizeDictionaryLearnPayload(out);
  }
  return getDictionaryLearnState();
}

export async function dictionaryLearnToggleFlip() {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.learnToggleFlip === "function") {
    const out = await bridge.learnToggleFlip();
    return normalizeDictionaryLearnPayload(out);
  }
  return getDictionaryLearnState();
}

function normalizeDictionaryBuilderPayload(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    state: normalizeDictionarySnapshot(src.state || src),
    builder: normalizeDictionaryBuilderModel(src.builder || src),
  };
}

export async function getDictionaryBuilderState() {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.getBuilderState === "function") {
    const out = await bridge.getBuilderState();
    return normalizeDictionaryBuilderPayload(out);
  }

  const state = await getDictionarySnapshot();
  const builder = normalizeDictionaryBuilderModel({
    source: state.source,
    selected: state.currentSection,
  });
  return { state, builder };
}

export async function loadDictionaryBuilderSection(sectionValue) {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.loadBuilderSection === "function") {
    const out = await bridge.loadBuilderSection(sectionValue);
    return normalizeDictionaryBuilderPayload(out);
  }
  return getDictionaryBuilderState();
}

export async function dictionaryBuilderAddSection(nameValue) {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.builderAddSection === "function") {
    const out = await bridge.builderAddSection(nameValue);
    return normalizeDictionaryBuilderPayload(out);
  }
  return getDictionaryBuilderState();
}

export async function dictionaryBuilderDeleteSection(sectionValue) {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.builderDeleteSection === "function") {
    const out = await bridge.builderDeleteSection(sectionValue);
    return normalizeDictionaryBuilderPayload(out);
  }
  return getDictionaryBuilderState();
}

export async function dictionaryBuilderAddWord(sectionValue, enValue, ruValue) {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.builderAddWord === "function") {
    const out = await bridge.builderAddWord(sectionValue, enValue, ruValue);
    return normalizeDictionaryBuilderPayload(out);
  }
  return getDictionaryBuilderState();
}

export async function dictionaryBuilderDeleteWord(wordId) {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.builderDeleteWord === "function") {
    const out = await bridge.builderDeleteWord(wordId);
    return normalizeDictionaryBuilderPayload(out);
  }
  return getDictionaryBuilderState();
}

export async function dictionaryBuilderSubmit() {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.builderSubmit === "function") {
    const out = await bridge.builderSubmit();
    return normalizeDictionaryBuilderPayload(out);
  }
  return getDictionaryBuilderState();
}

export async function dictionaryBuilderExport(sectionValue) {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.builderExport === "function") {
    const out = await bridge.builderExport(sectionValue);
    return normalizeDictionaryBuilderPayload(out);
  }
  return getDictionaryBuilderState();
}

export async function dictionaryBuilderImport(fileValue, replaceExisting) {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.builderImport === "function") {
    const out = await bridge.builderImport(fileValue, !!replaceExisting);
    return normalizeDictionaryBuilderPayload(out);
  }
  return getDictionaryBuilderState();
}

export async function enterDictionarySection(sectionValue, startTab = "cards") {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.enterSection === "function") {
    const out = await bridge.enterSection(sectionValue, startTab);
    return normalizeDictionarySnapshot(out);
  }
  return getDictionarySnapshot();
}

export async function showDictionaryFirstPick() {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.showFirstPick === "function") {
    const out = bridge.showFirstPick();
    return normalizeDictionarySnapshot(out);
  }
  return getDictionarySnapshot();
}

export async function openDictionaryConstructor() {
  const bridge = getDictionaryBridge();
  if (bridge && typeof bridge.openConstructor === "function") {
    const out = bridge.openConstructor();
    return normalizeDictionarySnapshot(out);
  }
  return getDictionarySnapshot();
}
