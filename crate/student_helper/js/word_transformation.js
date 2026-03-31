// IndexedDB
  // -----------------------------
  const DB_PREFIX = 'student_helper_db__';
  const DB_VERSION = 4;
  const STORE_TASKS = 'tasks';
  const WT_TABLE = 'sh_wt_tasks';
  const WT_ADMIN_EMAILS = ['itemkeygithub@gmail.com', 'kravetznikita@gmail.com'];

  const N2A_SUFFIX_FILE = 'db/word_transformation/student_helper_db__noun_to_adj_Suffixes.json';
  const N2A_PREFIX_FILE = 'db/word_transformation/student_helper_db__noun_to_adj_Prefixes.json';
  const N2A_INUN_FILE = 'db/word_transformation/student_helper_db__noun_to_adj_InUnPrefixes.json';
  const N2V_FILE = 'db/word_transformation/student_helper_db__noun_to_verb.json';
  const W2N_FILE = 'db/word_transformation/student_helper_db__word_to_noun.json';

  const wtRuntime = {
    isAdmin: false,
    supa: null,
    source: 'local'
  };

  const TRANSFORM_TYPE_N2A = 'noun_to_adj';
  const TRANSFORM_TYPE_INUN = 'in_un_prefix';
  const TRANSFORM_TYPE_N2V = 'noun_to_verb';
  const TRANSFORM_TYPE_W2N = 'word_to_noun';
  const CATEGORY_N2V = 'NounToVerb';
  const CATEGORY_W2N = 'WordToNoun';
  const WT_MODE_MIXED = 'mixed';
  const WT_MODE_CUSTOM = 'custom';
  const WT_MODE_KEY = 'sh_wt_mode_v1';
  const WT_CUSTOM_TYPES_KEY = 'sh_wt_custom_types_v1';
  const WT_TEXT_TEMPLATES = new Map();

  const WT_TYPES = [
    {
      id: TRANSFORM_TYPE_N2A,
      titleRu: 'образование прилагательного',
      titleEn: 'Adjective Formation',
      categories: ['Suffixes', 'Prefixes']
    },
    {
      id: TRANSFORM_TYPE_INUN,
      titleRu: 'приставки in- или un-',
      titleEn: 'in- or un- prefixes',
      categories: ['InUnPrefixes']
    },
    {
      id: TRANSFORM_TYPE_N2V,
      titleRu: 'образование глагола',
      titleEn: 'Verb Formation',
      categories: [CATEGORY_N2V]
    },
    {
      id: TRANSFORM_TYPE_W2N,
      titleRu: 'образование существительного',
      titleEn: 'Noun Formation',
      categories: [CATEGORY_W2N]
    }
  ];

  function normTransformType(type){
    const v = String(type || '').trim().toLowerCase();
    if(v === TRANSFORM_TYPE_INUN) return TRANSFORM_TYPE_INUN;
    if(v === TRANSFORM_TYPE_N2V) return TRANSFORM_TYPE_N2V;
    if(v === TRANSFORM_TYPE_W2N) return TRANSFORM_TYPE_W2N;
    return TRANSFORM_TYPE_N2A;
  }

  function normWtMode(mode){
    return String(mode || '').trim().toLowerCase() === WT_MODE_CUSTOM
      ? WT_MODE_CUSTOM
      : WT_MODE_MIXED;
  }

  function loadWtMode(){
    try{ return normWtMode(localStorage.getItem(WT_MODE_KEY)); }catch(_){ return WT_MODE_MIXED; }
  }

  function saveWtMode(mode){
    try{ localStorage.setItem(WT_MODE_KEY, normWtMode(mode)); }catch(_){ }
  }

  function normalizeWtTypeIds(list){
    const valid = new Set(WT_TYPES.map((x) => x.id));
    if(!Array.isArray(list)) return [];
    const out = [];
    for(const raw of list){
      const id = normTransformType(raw);
      if(!valid.has(id)) continue;
      if(out.includes(id)) continue;
      out.push(id);
    }
    return out;
  }

  function loadWtCustomTypes(){
    try{
      const raw = localStorage.getItem(WT_CUSTOM_TYPES_KEY);
      if(!raw) return [TRANSFORM_TYPE_N2A];
      const parsed = JSON.parse(raw);
      const ids = normalizeWtTypeIds(parsed);
      return ids.length ? ids : [TRANSFORM_TYPE_N2A];
    }catch(_){
      return [TRANSFORM_TYPE_N2A];
    }
  }

  function saveWtCustomTypes(ids){
    try{ localStorage.setItem(WT_CUSTOM_TYPES_KEY, JSON.stringify(normalizeWtTypeIds(ids))); }catch(_){ }
  }

  function taskTypeId(task){
    const c = normCategory(task && task.category || 'Suffixes');
    if(c === 'InUnPrefixes') return TRANSFORM_TYPE_INUN;
    if(c === CATEGORY_N2V) return TRANSFORM_TYPE_N2V;
    if(c === CATEGORY_W2N) return TRANSFORM_TYPE_W2N;
    return TRANSFORM_TYPE_N2A;
  }

  function idbSupported(){ return typeof indexedDB !== 'undefined'; }
  function dbNameFor(type){ return `${DB_PREFIX}${type}`; }
  function normalize(s){ return (s || '').trim().toLowerCase(); }
  function shuffleList(arr){
    const out = Array.isArray(arr) ? arr.slice() : [];
    for(let i = out.length - 1; i > 0; i -= 1){
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  function taskCycleKey(task){
    const t = task || {};
    if(t.id != null) return String(t.id);
    return `${normalize(t.en_noun)}|${normalize(t.en_adj)}|${normalize(normCategory(t.category))}`;
  }
  function buildCyclePool(list, random, lastKey){
    let pool = Array.isArray(list) ? list.slice() : [];
    if(random) pool = shuffleList(pool);
    if(lastKey && pool.length > 1 && taskCycleKey(pool[0]) === lastKey){
      const swapIdx = 1 + Math.floor(Math.random() * (pool.length - 1));
      [pool[0], pool[swapIdx]] = [pool[swapIdx], pool[0]];
    }
    return pool;
  }
  function siteLang(){
    try{
      if(window.IKSiteLang && typeof window.IKSiteLang.get === 'function'){
        const fromApi = String(window.IKSiteLang.get() || '').trim().toLowerCase();
        if(fromApi === 'en' || fromApi === 'ru') return fromApi;
      }
    }catch(_){ }
    const attr = String(document.documentElement && document.documentElement.getAttribute('lang') || '').trim().toLowerCase();
    return attr.startsWith('en') ? 'en' : 'ru';
  }
  function wtText(ru, en){ return siteLang() === 'en' ? en : ru; }
function escapeHtml(s){
  return String(s || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

// Affix hint inside the big word for speedrunners :)
// Returns: 'suffix' | 'prefix' | 'both'
function detectAffixHintKind(baseWord, answerWord, category){
  const base = normalize(baseWord);
  const ans  = normalize(answerWord);

  if(base && ans){
    const idx = ans.indexOf(base);
    if(idx >= 0){
      const before = idx > 0;
      const after  = (idx + base.length) < ans.length;
      if(before && after) return 'both';
      if(before && !after) return 'prefix';
      if(!before && after) return 'suffix';
    }
  }

  const cat = normalize(normCategory(category));
  if(cat === 'prefixes') return 'prefix';
  if(cat === 'inunprefixes') return 'prefix';
  if(cat === 'suffixes') return 'suffix';
  return 'suffix';
}

function buildAffixHintHTML(baseWord, kind){
  const w = escapeHtml(baseWord);
  const dots = '<span class="wt-dots" aria-hidden="true">...</span>';
  if(kind === 'prefix') return `${dots}<span class="wt-core">${w}</span>`;
  if(kind === 'both')   return `${dots}<span class="wt-core">${w}</span>${dots}`;
  return `<span class="wt-core">${w}</span>${dots}`; // suffix default
}

  function normCategory(cat){
    const c = String(cat || '').trim();
    if(!c) return 'Suffixes';
    const lc = c.toLowerCase();
    if(lc === 'suffixes') return 'Suffixes';
    if(lc === 'prefixes') return 'Prefixes';
    if(
      lc === 'inunprefixes' ||
      lc === 'in-un-prefixes' ||
      lc === 'in/un prefixes' ||
      lc === 'in-/un- prefixes' ||
      lc === 'in_un_prefixes'
    ) return 'InUnPrefixes';
    if(
      lc === 'nountoverb' ||
      lc === 'noun_to_verb' ||
      lc === 'noun-to-verb' ||
      lc === 'noun to verb'
    ) return CATEGORY_N2V;
    if(
      lc === 'wordtonoun' ||
      lc === 'word_to_noun' ||
      lc === 'word-to-noun' ||
      lc === 'word to noun' ||
      lc === 'nounformation' ||
      lc === 'noun_formation' ||
      lc === 'noun-formation' ||
      lc === 'noun formation'
    ) return CATEGORY_W2N;
    if(lc === 'all') return 'All';
    return c;
  }
  function makePairKey(t){
    return `${normalize(t.en_noun)}|${normalize(t.en_adj)}|${normalize(t.type)}|${normalize(normCategory(t.category))}`;
  }

  function templatePairKey(baseWord, answerWord, category){
    return `${normalize(baseWord)}|${normalize(answerWord)}|${normalize(TRANSFORM_TYPE_N2A)}|${normalize(normCategory(category))}`;
  }

  function registerTextTemplate(task, fallbackCategory){
    const t = task || {};
    const enNoun = normalize(t.en_noun);
    const enAdj = normalize(t.en_adj);
    if(!enNoun || !enAdj) return;

    const textEn = String(t.text_en || t.sentence_en || '').trim();
    const textRu = String(t.text_ru || t.sentence_ru || '').trim();
    if(!textEn && !textRu) return;

    const category = normCategory(t.category || fallbackCategory || 'Suffixes');
    const key = templatePairKey(enNoun, enAdj, category);
    WT_TEXT_TEMPLATES.set(key, {
      en: textEn,
      ru: textRu
    });
  }

  function registerTextTemplatesFromJson(data, fallbackCategory){
    const list = Array.isArray(data && data.tasks) ? data.tasks : [];
    for(const task of list){
      registerTextTemplate(task, fallbackCategory);
    }
  }

  function sentenceWithGap(sentence, answer){
    const src = String(sentence || '').trim();
    const ans = String(answer || '').trim();
    if(!src) return '';
    if(!ans) return src;

    const escaped = ans.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const asWord = new RegExp(`\\b${escaped}\\b`, 'i');
    if(asWord.test(src)) return src.replace(asWord, '____');

    const asRaw = new RegExp(escaped, 'i');
    if(asRaw.test(src)) return src.replace(asRaw, '____');

    return src;
  }

  function getCustomTextTemplate(task){
    const t = task || {};
    const category = normCategory(t.category || 'Suffixes');
    const key = templatePairKey(t.en_noun, t.en_adj, category);
    const raw = WT_TEXT_TEMPLATES.get(key);
    if(!raw) return null;
    return {
      en: String(raw.en || '').trim(),
      ru: String(raw.ru || '').trim()
    };
  }

  async function preloadSeedTextTemplates(){
    try{
      const data = await fetchJson(W2N_FILE);
      registerTextTemplatesFromJson(data, CATEGORY_W2N);
    }catch(_){ }
  }

  function openDBForType(type){
    return new Promise((resolve, reject)=>{
      if(!idbSupported()){
        reject(new Error('IndexedDB not supported'));
        return;
      }
      const name = dbNameFor(type);
      const req = indexedDB.open(name, DB_VERSION);

      req.onupgradeneeded = (event)=>{
        const db = req.result;
        let store;

        if(!db.objectStoreNames.contains(STORE_TASKS)){
          store = db.createObjectStore(STORE_TASKS, { keyPath:'id', autoIncrement:true });
        }else{
          store = req.transaction.objectStore(STORE_TASKS);
        }

        if(!store.indexNames.contains('type')) store.createIndex('type', 'type', { unique:false });
        if(!store.indexNames.contains('category')) store.createIndex('category', 'category', { unique:false });

        // pairKey - we recreate to ensure correct uniqueness with category
        if(store.indexNames.contains('pairKey')){
          try{ store.deleteIndex('pairKey'); }catch(_){}
        }
        store.createIndex('pairKey', 'pairKey', { unique:true });

        // migrate existing records: add category + pairKey
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = (e)=>{
          const cursor = e.target.result;
          if(!cursor) return;

          const v = cursor.value || {};
          if(!v.type) v.type = type;
          if(!v.category) v.category = 'Suffixes';
          v.category = normCategory(v.category);

          v.en_noun = normalize(v.en_noun);
          v.en_adj  = normalize(v.en_adj);

          v.pairKey = makePairKey(v);

          cursor.update(v);
          cursor.continue();
        };
      };

      req.onsuccess = ()=> resolve(req.result);
      req.onerror = ()=> reject(req.error || new Error('Failed to open DB'));
    });
  }

  function tx(db, mode='readonly'){
    if(db && db.kind === 'supabase') return null;
    if(db && db.kind === 'memory') return null;
    return db.transaction([STORE_TASKS], mode).objectStore(STORE_TASKS);
  }
  async function getAllTasks(db){
    if(db && db.kind === 'memory'){
      return Array.isArray(db.tasks) ? db.tasks.map((x) => ({ ...x })) : [];
    }
    if(db && db.kind === 'supabase'){
      const rows = [];
      const page = 1000;
      let from = 0;
      while(true){
        const { data, error } = await db.client
          .from(WT_TABLE)
          .select('id,type,category,en_noun,en_adj,ru_noun,ru_adj,pair_key,created_at,updated_at')
          .eq('type', db.type)
          .order('id', { ascending:true })
          .range(from, from + page - 1);
        if(error) throw error;
        const part = Array.isArray(data) ? data : [];
        rows.push(...part.map((r) => ({
          id: r.id,
          type: r.type,
          category: normCategory(r.category || 'Suffixes'),
          en_noun: normalize(r.en_noun),
          en_adj: normalize(r.en_adj),
          ru_noun: String(r.ru_noun || '').trim(),
          ru_adj: String(r.ru_adj || '').trim(),
          pairKey: String(r.pair_key || ''),
          createdAt: Date.parse(r.created_at || '') || Date.now(),
          updatedAt: Date.parse(r.updated_at || '') || Date.now()
        })));
        if(part.length < page) break;
        from += page;
      }
      return rows;
    }
    return new Promise((resolve, reject)=>{
      const store = tx(db, 'readonly');
      const req = store.getAll();
      req.onsuccess = ()=> resolve(req.result || []);
      req.onerror = ()=> reject(req.error || new Error('Failed to get tasks'));
    });
  }
  async function countAllTasks(db){
    if(db && db.kind === 'memory'){
      return Array.isArray(db.tasks) ? db.tasks.length : 0;
    }
    if(db && db.kind === 'supabase'){
      const { count, error } = await db.client
        .from(WT_TABLE)
        .select('id', { head:true, count:'exact' })
        .eq('type', db.type);
      if(error) throw error;
      return Number(count || 0);
    }
    return new Promise((resolve, reject)=>{
      const store = tx(db, 'readonly');
      const req = store.count();
      req.onsuccess = ()=> resolve(req.result || 0);
      req.onerror = ()=> reject(req.error || new Error('Failed to count'));
    });
  }
  async function clearAll(db){
    if(db && db.kind === 'memory'){
      db.tasks = [];
      return true;
    }
    if(db && db.kind === 'supabase'){
      const { error } = await db.client.from(WT_TABLE).delete().eq('type', db.type);
      if(error) throw error;
      return true;
    }
    return new Promise((resolve, reject)=>{
      const store = tx(db, 'readwrite');
      const req = store.clear();
      req.onsuccess = ()=> resolve(true);
      req.onerror = ()=> reject(req.error || new Error('Failed to clear'));
    });
  }
  async function addTask(db, task){
    const now = Date.now();
    const payload = {
      type: task.type,
      category: normCategory(task.category),
      en_noun: normalize(task.en_noun),
      en_adj: normalize(task.en_adj),
      ru_noun: String(task.ru_noun || '').trim(),
      ru_adj: String(task.ru_adj || '').trim(),
      createdAt: now,
      updatedAt: now
    };
    payload.pairKey = makePairKey(payload);

    if(db && db.kind === 'memory'){
      const has = (db.tasks || []).some((x) => String(x.pairKey || '') === String(payload.pairKey || ''));
      if(has) return { ok:false, skipped:true, reason:'duplicate' };
      const nextId = Number(db.nextId || 1);
      db.nextId = nextId + 1;
      db.tasks.push({ ...payload, id: nextId });
      return { ok:true, id: nextId };
    }

    if(db && db.kind === 'supabase'){
      const exists = await db.client
        .from(WT_TABLE)
        .select('id')
        .eq('type', payload.type)
        .eq('pair_key', payload.pairKey)
        .limit(1);
      if(exists.error) throw exists.error;
      if(Array.isArray(exists.data) && exists.data.length){
        return { ok:false, skipped:true, reason:'duplicate' };
      }

      const { data, error } = await db.client
        .from(WT_TABLE)
        .insert({
          type: payload.type,
          category: payload.category,
          en_noun: payload.en_noun,
          en_adj: payload.en_adj,
          ru_noun: payload.ru_noun,
          ru_adj: payload.ru_adj,
          pair_key: payload.pairKey,
          source: 'admin'
        })
        .select('id')
        .single();
      if(error) throw error;
      return { ok:true, id: data && data.id };
    }

    return new Promise((resolve, reject)=>{
      const store = tx(db, 'readwrite');
      const req = store.add(payload);
      req.onsuccess = ()=> resolve({ ok:true, id:req.result });
      req.onerror = ()=> {
        const err = req.error;
        if(err && err.name === 'ConstraintError'){
          resolve({ ok:false, skipped:true, reason:'duplicate' });
          return;
        }
        reject(err || new Error('Failed to add task'));
      };
    });
  }
  async function deleteTask(db, id){
    if(db && db.kind === 'memory'){
      db.tasks = (db.tasks || []).filter((x) => Number(x.id) !== Number(id));
      return true;
    }
    if(db && db.kind === 'supabase'){
      const { error } = await db.client.from(WT_TABLE).delete().eq('id', id).eq('type', db.type);
      if(error) throw error;
      return true;
    }
    return new Promise((resolve, reject)=>{
      const store = tx(db, 'readwrite');
      const req = store.delete(id);
      req.onsuccess = ()=> resolve(true);
      req.onerror = ()=> reject(req.error || new Error('Failed to delete task'));
    });
  }
  function escapeHTML(str){
    return String(str || '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#039;");
  }
  function safeParseJSON(text){
    try{ return { ok:true, data: JSON.parse(text) }; }
    catch(e){ return { ok:false, error:e }; }
  }

  function localCurrentEmail(){
    try{
      const raw = localStorage.getItem('itemkey.currentUser');
      const obj = raw ? JSON.parse(raw) : null;
      return String(obj && obj.email || '').trim().toLowerCase();
    }catch(_){
      return '';
    }
  }

  async function initWtAccess(){
    let email = localCurrentEmail();
    try{
      if(window.IKSupabase && typeof window.IKSupabase.getClient === 'function'){
        const client = window.IKSupabase.getClient();
        if(client){
          wtRuntime.supa = client;
          const out = await client.auth.getUser();
          const cloudEmail = String(out && out.data && out.data.user && out.data.user.email || '').trim().toLowerCase();
          if(cloudEmail) email = cloudEmail;
        }
      }
    }catch(_){
      wtRuntime.supa = null;
    }
    wtRuntime.isAdmin = WT_ADMIN_EMAILS.includes(email);
  }

  async function isSupabaseReady(type){
    if(!wtRuntime.supa) return false;
    try{
      const { error } = await wtRuntime.supa.from(WT_TABLE).select('id', { head:true, count:'exact' }).eq('type', type);
      return !error;
    }catch(_){
      return false;
    }
  }

  async function loadSeedTasksFromJson(type){
    if(type !== 'noun_to_adj') return [];
    const out = [];
    const push = (data, fallbackCategory) => {
      registerTextTemplatesFromJson(data, fallbackCategory);
      const list = Array.isArray(data && data.tasks) ? data.tasks : [];
      for(const t of list){
        const en_noun = normalize(t && t.en_noun);
        const en_adj = normalize(t && t.en_adj);
        const ru_noun = String(t && t.ru_noun || '').trim();
        const ru_adj = String(t && t.ru_adj || '').trim();
        const category = normCategory((t && t.category) || fallbackCategory || 'Suffixes');
        if(!en_noun || !en_adj || !ru_noun || !ru_adj) continue;
        const row = { type, category, en_noun, en_adj, ru_noun, ru_adj };
        row.pairKey = makePairKey(row);
        out.push(row);
      }
    };

    try{ push(await fetchJson(N2A_SUFFIX_FILE), 'Suffixes'); }catch(_){ }
    try{ push(await fetchJson(N2A_PREFIX_FILE), 'Prefixes'); }catch(_){ }
    try{ push(await fetchJson(N2A_INUN_FILE), 'InUnPrefixes'); }catch(_){ }
    try{ push(await fetchJson(N2V_FILE), CATEGORY_N2V); }catch(_){ }
    try{ push(await fetchJson(W2N_FILE), CATEGORY_W2N); }catch(_){ }

    const uniq = new Map();
    for(const row of out) uniq.set(String(row.pairKey || ''), row);
    return Array.from(uniq.values());
  }

  // -----------------------------
  // Rules
  // -----------------------------
  const INUN_RU_NOUN_FALLBACK = {
    interesting: 'интересный',
    thinkable: 'мыслимый',
    safe: 'безопасный',
    acceptable: 'приемлемый',
    employed: 'трудоустроенный',
    important: 'важный',
    capable: 'способный',
    comfortable: 'удобный',
    friendly: 'дружелюбный',
    experienced: 'опытный',
    fair: 'справедливый',
    competent: 'компетентный',
    fortunate: 'удачливый',
    effective: 'эффективный',
    active: 'активный',
    necessary: 'нужный',
    available: 'доступный',
    lucky: 'везучий',
    certain: 'уверенный',
    hospitable: 'гостеприимный',
    successful: 'успешный',
    expected: 'ожидаемый',
    likely: 'вероятный',
    willing: 'готовый',
    accurate: 'точный',
    known: 'известный',
    believable: 'правдоподобный',
    happy: 'счастливый',
    secure: 'уверенный',
    usual: 'обычный',
    sure: 'уверенный',
    significant: 'значительный',
    real: 'реальный',
    helpful: 'полезный',
    reliable: 'надежный',
    able: 'способный',
    healthy: 'здоровый',
    avoidable: 'предотвратимый',
    reasonable: 'разумный',
    valuable: 'ценный',
    explored: 'исследованный',
    common: 'обычный',
    favourable: 'благоприятный',
    predictable: 'предсказуемый',
    popular: 'популярный',
    like: 'похожий',
    suitable: 'подходящий',
    grateful: 'благодарный',
    familiar: 'знакомый',
    attentive: 'внимательный',
    kind: 'добрый',
    curable: 'излечимый',
    tolerable: 'терпимый',
    bearable: 'терпимый',
    visible: 'видимый',
    expensive: 'дорогой',
    correct: 'правильный',
    aware: 'осведомленный',
    worthy: 'достойный',
    clear: 'ясный',
    attractive: 'привлекательный',
    limited: 'ограниченный',
    fit: 'пригодный',
    forgettable: 'забываемый',
    pleasant: 'приятный',
    conscious: 'в сознании',
    fashionable: 'модный',
    sociable: 'общительный'
  };

  const INUN_RU_ADJ_FALLBACK = {
    uninteresting: 'неинтересный',
    unthinkable: 'немыслимый',
    unsafe: 'небезопасный',
    unacceptable: 'неприемлемый',
    unemployed: 'безработный',
    unimportant: 'неважный',
    incapable: 'неспособный',
    uncomfortable: 'неудобный',
    unfriendly: 'недружелюбный',
    inexperienced: 'неопытный',
    unfair: 'несправедливый',
    incompetent: 'некомпетентный',
    unfortunate: 'неудачливый',
    ineffective: 'неэффективный',
    inactive: 'неактивный',
    unnecessary: 'ненужный',
    unavailable: 'недоступный',
    unlucky: 'невезучий',
    uncertain: 'неуверенный',
    inhospitable: 'негостеприимный',
    unsuccessful: 'неуспешный',
    unexpected: 'неожиданный',
    unlikely: 'маловероятный',
    unwilling: 'неохотный',
    inaccurate: 'неточный',
    unknown: 'неизвестный',
    unbelievable: 'невероятный',
    unhappy: 'несчастный',
    insecure: 'неуверенный',
    unusual: 'необычный',
    unsure: 'неуверенный',
    insignificant: 'незначительный',
    unreal: 'нереальный',
    unhelpful: 'бесполезный',
    unreliable: 'ненадежный',
    unable: 'неспособный',
    unhealthy: 'нездоровый',
    unavoidable: 'неизбежный',
    unreasonable: 'неразумный',
    invaluable: 'бесценный',
    unexplored: 'неисследованный',
    uncommon: 'необычный',
    unfavourable: 'неблагоприятный',
    unpredictable: 'непредсказуемый',
    unpopular: 'непопулярный',
    unlike: 'непохожий',
    unsuitable: 'неподходящий',
    ungrateful: 'неблагодарный',
    unfamiliar: 'незнакомый',
    inattentive: 'невнимательный',
    unkind: 'недобрый',
    incurable: 'неизлечимый',
    intolerable: 'невыносимый',
    unbearable: 'невыносимый',
    invisible: 'невидимый',
    inexpensive: 'недорогой',
    incorrect: 'неправильный',
    unaware: 'неосведомленный',
    unworthy: 'недостойный',
    unclear: 'неясный',
    unattractive: 'непривлекательный',
    unlimited: 'неограниченный',
    unfit: 'непригодный',
    unforgettable: 'незабываемый',
    unpleasant: 'неприятный',
    unconscious: 'бессознательный',
    unfashionable: 'немодный',
    unsociable: 'необщительный'
  };

  const rulePanel = document.getElementById('rulePanel');
  const ruleTitle = document.getElementById('ruleTitle');
  const ruleBody = document.getElementById('ruleBody');

  function renderRule(category){
    if(!ruleBody || !ruleTitle) return;
    const c = normCategory(category);
    ruleBody.innerHTML = '';

    const addSub = (text) => {
      const p = document.createElement('p');
      p.className = 'ik-sub';
      p.textContent = text;
      ruleBody.appendChild(p);
    };

    const addChips = (items) => {
      const chips = document.createElement('div');
      chips.className = 'ik-chips';
      for(const item of items){
        const el = document.createElement('span');
        el.className = 'ik-chip';
        el.textContent = item;
        chips.appendChild(el);
      }
      ruleBody.appendChild(chips);
    };

    const addDivider = () => {
      const div = document.createElement('div');
      div.className = 'ik-divider';
      ruleBody.appendChild(div);
    };

    const addFoot = (text) => {
      const p = document.createElement('p');
      p.className = 'ik-footnote';
      p.textContent = text;
      ruleBody.appendChild(p);
    };

    const suffixSpec = {
      title: wtText('Суффиксы (добавляются в конец)', 'Suffixes (added to the end)'),
      chips: ['-ful','-less','-ous','-ive','-able','-ible','-al','-ical','-y','-ic']
    };

    const prefixSpec = {
      title: wtText('Отрицательные приставки (добавляются в начало)', 'Negative prefixes (added to the start)'),
      chips: [
        wtText('in- (общее правило)', 'in- (general)'),
        wtText('il- (перед l)', 'il- (before l)'),
        wtText('im- (перед m, p)', 'im- (before m, p)'),
        wtText('ir- (перед r)', 'ir- (before r)'),
        'mis-'
      ]
    };

    const inUnSpec = {
      title: wtText('Выбери приставку: in- или un-', 'Choose prefix: in- or un-'),
      chips: ['in-','un-']
    };

    if(c === CATEGORY_N2V){
      ruleTitle.textContent = wtText('правило', 'rule');

      addSub(wtText('Образование глагола: практическое правило', 'Verb formation: practical rule'));
      addFoot(wtText(
        'Нет одного универсального суффикса. Выбирай модель и проверяй по словарной паре.',
        'There is no single universal suffix. Choose a formation pattern and verify the lexical pair.'
      ));

      addDivider();
      addSub(wtText('1) -en (часто от признака/состояния)', '1) -en (often from quality/state)'));
      addChips(['bright -> brighten','broad -> broaden','dark -> darken','deaf -> deafen','fright -> frighten','length -> lengthen','light -> lighten']);

      addDivider();
      addSub(wtText('2) -fy (делать каким-то)', '2) -fy (to make / become)'));
      addChips(['class -> classify','horror -> horrify','identity -> identify','just -> justify']);

      addDivider();
      addSub(wtText('3) -ize / -ise (оформить как процесс/действие)', '3) -ize / -ise (process/action verb)'));
      addChips(['apology -> apologize','colony -> colonize','critic -> criticize','minimum -> minimize','real -> realize']);

      addDivider();
      addSub(wtText('4) en- + основа (дать/сделать ...)', '4) en- + base (to cause/put into state)'));
      addChips(['able -> enable','courage -> encourage','danger -> endanger','large -> enlarge','rich -> enrich','sure -> ensure']);

      addDivider();
      addSub(wtText('5) Нулевая/словарная модель', '5) Zero-change / lexical model'));
      addChips(['clear -> clear','cycle -> cycle','irritate -> irritate','reduce -> reduce','product -> produce','participant -> participate','motive -> motivate']);

      addFoot(wtText(
        'Важно: часть пар нерегулярны или зависят от смысла, их нужно запоминать как словарные.',
        'Important: some pairs are lexical/irregular and should be memorized as fixed pairs.'
      ));
      return;
    }

    if(c === CATEGORY_W2N){
      ruleTitle.textContent = wtText('правило', 'rule');

      addSub(wtText('Правила образования существительных', 'Noun formation rules'));

      addDivider();
      addSub(wtText('Глагол + суффикс', 'Verb + suffix'));
      addChips(['-ion, -tion, -sion -> attraction, decision','-ment -> achievement, argument']);

      addDivider();
      addSub(wtText('Прилагательное + суффикс', 'Adjective + suffix'));
      addChips(['-ness -> happiness, weakness','-ty, -ity -> ability, creativity']);

      addDivider();
      addSub(wtText('Профессии (глагол +)', 'Professions (verb +)'));
      addChips(['-or, -er -> actor, programmer']);

      addDivider();
      addSub(wtText('Профессии (сущ./прил. +)', 'Professions (noun/adj +)'));
      addChips(['-ist -> scientist, cyclist','-ship -> friendship, membership']);

      addDivider();
      addChips(['-ion','-tion','-sion','-ment','-ness','-ty','-ity','-or','-er','-ist','-ship']);

      addFoot(wtText(
        'Подбирай суффикс по части речи исходного слова и проверяй написание в контексте.',
        'Choose suffixes by the base word part of speech and verify spelling in context.'
      ));

      return;
    }

    if(c === 'All'){
      ruleTitle.textContent = wtText('правила', 'rules');
      addSub(suffixSpec.title);
      addChips(suffixSpec.chips);
      addDivider();
      addSub(prefixSpec.title);
      addChips(prefixSpec.chips);

      return;
    }

    let def = suffixSpec;
    if(c === 'Prefixes') def = prefixSpec;
    else if(c === 'InUnPrefixes') def = inUnSpec;

    ruleTitle.textContent = wtText('правило', 'rule');
    addSub(def.title);
    addChips(def.chips);
  }

  function ruleCategoryForTypeId(typeId){
    if(typeId === TRANSFORM_TYPE_INUN) return 'InUnPrefixes';
    if(typeId === TRANSFORM_TYPE_N2V) return CATEGORY_N2V;
    if(typeId === TRANSFORM_TYPE_W2N) return CATEGORY_W2N;
    return 'All';
  }

  function renderRuleForCurrentScope(){
    if(!ruleBody || !ruleTitle) return;
    const typeIds = currentRuleTypeIds();
    const normalized = normalizeWtTypeIds(typeIds);
    if(!normalized.length){
      ruleTitle.textContent = wtText('правило', 'rule');
      ruleBody.innerHTML = `<p class="ik-sub">${escapeHTML(wtText('выбери минимум один тип в пользовательском режиме', 'choose at least one type in custom mode'))}</p>`;
      return;
    }

    if(normalized.length === 1){
      renderRule(ruleCategoryForTypeId(normalized[0]));
      return;
    }

    const parts = [];
    for(const typeId of normalized){
      renderRule(ruleCategoryForTypeId(typeId));
      parts.push({
        title: wtTypeLabel(typeId),
        html: ruleBody.innerHTML
      });
    }

    ruleTitle.textContent = wtText('правила', 'rules');
    ruleBody.innerHTML = '';

    parts.forEach((part) => {
      const section = document.createElement('section');
      section.className = 'wt-rule-section';

      const head = document.createElement('p');
      head.className = 'wt-rule-section__head';
      head.textContent = part.title;
      section.appendChild(head);

      const content = document.createElement('div');
      content.className = 'wt-rule-section__body';
      content.innerHTML = part.html;
      section.appendChild(content);

      ruleBody.appendChild(section);
    });
  }

  // -----------------------------
  // Import / Export
  // -----------------------------
  let db = null;

  async function importFromObject(data, opts){
    const type = (opts && opts.type) || 'noun_to_adj';
    const replace = !!(opts && opts.replace);
    const silent = !!(opts && opts.silent);
    const defaultCategory = normCategory((opts && opts.defaultCategory) || data.category || 'Suffixes');

    const list = Array.isArray(data && data.tasks) ? data.tasks : [];

    if(replace){
      await clearAll(db);
    }

    let added = 0;
    let skipped = 0;

    for(const t of list){
      if(!t) continue;

      const enNoun = normalize(t.en_noun);
      const enAdj  = normalize(t.en_adj);
      const ruNoun = String(t.ru_noun || '').trim();
      const ruAdj  = String(t.ru_adj || '').trim();
      const cat = normCategory(t.category || defaultCategory);
      registerTextTemplate(t, cat);

      if(!enNoun || !enAdj || !ruNoun || !ruAdj) continue;

      // eslint-disable-next-line no-await-in-loop
      const res = await addTask(db, { type, category: cat, en_noun: enNoun, en_adj: enAdj, ru_noun: ruNoun, ru_adj: ruAdj });
      if(res && res.ok) added += 1;
      else skipped += 1;
    }

    if(!silent){
      const mode = replace ? 'replace' : 'merge';
      setFeedback('idle', 'import', `Импорт ${mode}: +${added}, skip ${skipped}`);
    }
    return { added, skipped };
  }

  function _uniq(arr){ return Array.from(new Set(arr)); }

function _guessSiteRoots(){
  const roots = [];
  try{
    const origin = location.origin;
    roots.push(origin + '/');

    // GitHub Pages project site: https://user.github.io/<repo>/
    const parts = location.pathname.split('/').filter(Boolean);
    if(location.hostname.endsWith('github.io') && parts.length >= 1){
      roots.push(origin + '/' + parts[0] + '/');
    }
  }catch(_){/* ignore */}
  return _uniq(roots);
}

function _buildUrlCandidates(relPath){
  const raw = String(relPath || '');
  const cleaned = raw.replace(/^\.?\/+/, '').replace(/^\/+/, '');
  const out = [];

  // relative to current document
  try{ out.push(new URL(cleaned, document.baseURI).href); }catch(_){/* ignore */}
  try{ out.push(new URL(raw, document.baseURI).href); }catch(_){/* ignore */}

  // relative to likely site roots
  for(const root of _guessSiteRoots()){
    try{ out.push(new URL(cleaned, root).href); }catch(_){/* ignore */}
  }

  return _uniq(out);
}

function _basename(p){ return String(p || '').split('/').filter(Boolean).pop() || ''; }

async function fetchJson(relPath){
  const urls = _buildUrlCandidates(relPath);
  let lastErr = null;

  for(const url of urls){
    try{
      const resp = await fetch(url, { cache:'no-store' });
      if(!resp.ok){
        lastErr = new Error(`HTTP ${resp.status}`);
        continue;
      }
      return await resp.json();
    }catch(e){
      lastErr = e;
    }
  }

  const tried = urls.slice(0, 6).join(' | ');
  throw new Error(`JSON fetch failed: ${relPath}. tried: ${tried}. ${lastErr && (lastErr.message || lastErr)}`);
}

  async function autoLoadIfEmpty(type){
    const n = await countAllTasks(db);
    if(n > 0) return { loaded:false, reason:'not_empty', count:n };

    // FIX: noun_to_adj loads all seed files automatically
    if(type === 'noun_to_adj'){
      const okFiles = [];
      const failFiles = [];
      let added = 0;
      let skipped = 0;

      // clear just in case
      await clearAll(db);

      // suffixes
      try{
        const data = await fetchJson(N2A_SUFFIX_FILE);
        registerTextTemplatesFromJson(data, 'Suffixes');
        const res = await importFromObject(data, { type, replace:false, silent:true, defaultCategory:'Suffixes' });
        okFiles.push(N2A_SUFFIX_FILE);
        added += res.added; skipped += res.skipped;
      }catch(e){
        failFiles.push(N2A_SUFFIX_FILE);
      }

      // prefixes
      try{
        const data = await fetchJson(N2A_PREFIX_FILE);
        registerTextTemplatesFromJson(data, 'Prefixes');
        const res = await importFromObject(data, { type, replace:false, silent:true, defaultCategory:'Prefixes' });
        okFiles.push(N2A_PREFIX_FILE);
        added += res.added; skipped += res.skipped;
      }catch(e){
        failFiles.push(N2A_PREFIX_FILE);
      }

      // in-/un- prefixes
      try{
        const data = await fetchJson(N2A_INUN_FILE);
        registerTextTemplatesFromJson(data, 'InUnPrefixes');
        const res = await importFromObject(data, { type, replace:false, silent:true, defaultCategory:'InUnPrefixes' });
        okFiles.push(N2A_INUN_FILE);
        added += res.added; skipped += res.skipped;
      }catch(e){
        failFiles.push(N2A_INUN_FILE);
      }

      // noun -> verb set
      try{
        const data = await fetchJson(N2V_FILE);
        registerTextTemplatesFromJson(data, CATEGORY_N2V);
        const res = await importFromObject(data, { type, replace:false, silent:true, defaultCategory:CATEGORY_N2V });
        okFiles.push(N2V_FILE);
        added += res.added; skipped += res.skipped;
      }catch(e){
        failFiles.push(N2V_FILE);
      }

      // word -> noun set
      try{
        const data = await fetchJson(W2N_FILE);
        registerTextTemplatesFromJson(data, CATEGORY_W2N);
        const res = await importFromObject(data, { type, replace:false, silent:true, defaultCategory:CATEGORY_W2N });
        okFiles.push(W2N_FILE);
        added += res.added; skipped += res.skipped;
      }catch(e){
        failFiles.push(W2N_FILE);
      }

      const after = await countAllTasks(db);
      return {
        loaded: okFiles.length > 0,
        okFiles, failFiles,
        imported: { added, skipped },
        count: after
      };
    }

    // other types - single file
    const filename = `${dbNameFor(type)}.json`;
    try{
      const data = await fetchJson(filename);
      const res = await importFromObject(data, { type, replace:true, silent:true });
      const after = await countAllTasks(db);
      return { loaded:true, okFiles:[filename], failFiles:[], imported:res, count:after };
    }catch(e){
      return { loaded:false, reason:'fetch_failed', okFiles:[], failFiles:[filename], error:String(e && (e.message || e)) };
    }
  }

  function exportFilenameFor(type, category){
    if(type === 'noun_to_adj'){
      const c = normCategory(category);
      if(c === 'Suffixes') return _basename(N2A_SUFFIX_FILE);
      if(c === 'Prefixes') return _basename(N2A_PREFIX_FILE);
      if(c === 'InUnPrefixes') return _basename(N2A_INUN_FILE);
      if(c === CATEGORY_N2V) return _basename(N2V_FILE);
      if(c === CATEGORY_W2N) return _basename(W2N_FILE);
      return 'student_helper_db__noun_to_adj_All.json';
    }
    return `${dbNameFor(type)}.json`;
  }

  async function mergeMissingSeedTasks(type){
    if(type !== 'noun_to_adj' || !db) return { added: 0, skipped: 0 };

    // Supabase read-only users cannot write seed rows.
    if(db.kind === 'supabase' && !wtRuntime.isAdmin){
      return { added: 0, skipped: 0, readonly: true };
    }

    const seedSets = [
      { file: N2A_INUN_FILE, category: 'InUnPrefixes' },
      { file: N2V_FILE, category: CATEGORY_N2V },
      { file: W2N_FILE, category: CATEGORY_W2N }
    ];

    let added = 0;
    let skipped = 0;
    let missing = 0;

    for(const seed of seedSets){
      try{
        // eslint-disable-next-line no-await-in-loop
        const data = await fetchJson(seed.file);
        registerTextTemplatesFromJson(data, seed.category);
        // eslint-disable-next-line no-await-in-loop
        const res = await importFromObject(data, {
          type,
          replace: false,
          silent: true,
          defaultCategory: seed.category
        });
        added += Number(res && res.added || 0);
        skipped += Number(res && res.skipped || 0);
      }catch(_){
        missing += 1;
      }
    }

    return { added, skipped, missing };
  }

  async function exportDb(type, category, tasks){
    const payload = {
      schema: 'student_helper_db_export',
      schemaVersion: 1,
      type,
      category: normCategory(category),
      exportedAt: new Date().toISOString(),
      dbName: dbNameFor(type),
      tasks: tasks.map(t => {
        const row = {
          type: t.type,
          category: normCategory(t.category),
          en_noun: t.en_noun,
          en_adj: t.en_adj,
          ru_noun: t.ru_noun,
          ru_adj: t.ru_adj
        };
        const tpl = getCustomTextTemplate(t);
        if(tpl && tpl.en) row.text_en = tpl.en;
        if(tpl && tpl.ru) row.text_ru = tpl.ru;
        return row;
      })
    };

    const filename = exportFilenameFor(type, category);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);

    setFeedback('idle', 'save', filename);
  }

  function inferDefaultCategoryFromFilename(name){
    const n = String(name || '').toLowerCase();
    if(n.includes('noun_to_verb')) return CATEGORY_N2V;
    if(n.includes('word_to_noun') || n.includes('noun_formation')) return CATEGORY_W2N;
    if(n.includes('_inunprefixes') || n.includes('_in_un') || n.includes('inun')) return 'InUnPrefixes';
    if(n.includes('_suffixes')) return 'Suffixes';
    if(n.includes('_prefixes')) return 'Prefixes';
    return 'Suffixes';
  }

  async function importFromFile(file, replace){
    const text = await file.text();
    const parsed = safeParseJSON(text);
    if(!parsed.ok){
      alert('Файл не является корректным JSON.');
      return;
    }
    const data = parsed.data || {};
    const type = data.type || 'noun_to_adj';
    const defCat = data.category ? normCategory(data.category) : inferDefaultCategoryFromFilename(file.name);

    await importFromObject(data, { type, replace, silent:true, defaultCategory:defCat });
  }

  // -----------------------------
  // App state + UI
  // -----------------------------
  let tasksAll = [];
  let tasksActive = [];
  let current = null;
  let transformType = TRANSFORM_TYPE_N2A;
  let wtMode = loadWtMode();
  let wtCustomTypeIds = loadWtCustomTypes();

  let revealRu = false;
  let sessionTotal = 0;
  let sessionCorrect = 0;

  let history = [];
  let historyPos = -1;
  let practicePool = [];
  let practiceLastKey = '';

  let checkMode = 'check'; // 'check' | 'next'

  let textTasksActive = [];
  let textCurrent = null;
  let textRevealRu = false;
  let textSessionTotal = 0;
  let textSessionCorrect = 0;
  let textHistory = [];
  let textHistoryPos = -1;
  let textPool = [];
  let textLastKey = '';
  let textCheckMode = 'check';

  const elDbStatus = document.getElementById('dbStatus');
  const elTaskCount = document.getElementById('taskCountBadge');
  const elSeedBadge = document.getElementById('seedBadge');
  const elDbNameLine = document.getElementById('dbNameLine');
  const elWtPanel = document.getElementById('panel-wt');
  const elTransformTypeLabel = document.getElementById('transformTypeLabel');
  const elTransformType = document.getElementById('transformType');
  const btnWtModeMixed = document.getElementById('wtModeMixedBtn');
  const btnWtModeCustom = document.getElementById('wtModeCustomBtn');
  const elWtModeHint = document.getElementById('wtModeHint');
  const elWtCustomTypePicker = document.getElementById('wtCustomTypePicker');
  const elWtCustomTypeTitle = document.getElementById('wtCustomTypeTitle');
  const elWtCustomTypeHint = document.getElementById('wtCustomTypeHint');
  const elWtCustomTypeGrid = document.getElementById('wtCustomTypeGrid');
  const btnWtCustomTypeSelectAll = document.getElementById('wtCustomTypeSelectAllBtn');
  const btnWtCustomTypeClearAll = document.getElementById('wtCustomTypeClearAllBtn');
  const elSubtabRule = document.getElementById('subtab-rule');
  const elSubtabPractice = document.getElementById('subtab-practice');
  const elSubtabText = document.getElementById('subtab-text');
  const elSubtabBuilder = document.getElementById('subtab-builder');
  const elPanelRule = document.getElementById('panel-rule');
  const elPanelPractice = document.getElementById('panel-practice');
  const elPanelText = document.getElementById('panel-text');
  const elPanelBuilder = document.getElementById('panel-builder');

  const elPromptEn = document.getElementById('promptEn');
  const elPromptRu = document.getElementById('promptRu');
  const elPromptLabel = document.getElementById('promptLabel');

  const elAnswer = document.getElementById('answerInput');
  const defaultAnswerPlaceholder = elAnswer ? (elAnswer.getAttribute('placeholder') || 'Ответ (EN)') : 'Ответ (EN)';
  const elScore = document.getElementById('sessionScore');
  const elQ = document.getElementById('qBadge');

  const elFeedbackBox = document.getElementById('feedbackBox');
  const elFeedbackStamp = document.getElementById('feedbackStamp');
  const elFeedbackLine = document.getElementById('feedbackLine');

  const elRandom = document.getElementById('randomOrder');
  const elPracticeCategory = document.getElementById('practiceCategory');
  const elTextRandom = document.getElementById('textRandomOrder');
  const elTextCategory = document.getElementById('textCategory');

  const elViewCategory = document.getElementById('viewCategory');
  const elAddCategory = document.getElementById('addCategory');

  const elTaskList = document.getElementById('taskList');
  const elImportReplace = document.getElementById('importReplace');
  const elFileImport = document.getElementById('fileImport');

  const btnPrev = document.getElementById('btnPrev');
  const btnNext = document.getElementById('btnNext');
  const btnReveal = document.getElementById('btnReveal');
  const btnCheckNext = document.getElementById('btnCheckNext');
  const btnShowAnswer = document.getElementById('btnShowAnswer');
  const elInUnPrefixPicker = document.getElementById('inUnPrefixPicker');
  const btnPrefixIn = document.getElementById('btnPrefixIn');
  const btnPrefixUn = document.getElementById('btnPrefixUn');

  const elTextPromptLabel = document.getElementById('textPromptLabel');
  const elTextSentenceEn = document.getElementById('textSentenceEn');
  const elTextSentenceRu = document.getElementById('textSentenceRu');
  const elTextAnswer = document.getElementById('textAnswerInput');
  const elTextQ = document.getElementById('textQBadge');
  const elTextScore = document.getElementById('textSessionScore');
  const elTextFeedbackBox = document.getElementById('textFeedbackBox');
  const elTextFeedbackStamp = document.getElementById('textFeedbackStamp');
  const elTextFeedbackLine = document.getElementById('textFeedbackLine');

  const btnTextPrev = document.getElementById('btnTextPrev');
  const btnTextNext = document.getElementById('btnTextNext');
  const btnTextReveal = document.getElementById('btnTextReveal');
  const btnTextCheckNext = document.getElementById('btnTextCheckNext');
  const btnTextShowAnswer = document.getElementById('btnTextShowAnswer');
  const btnWtAddToLibrary = document.getElementById('wtAddRuleToLibraryBtn');

  const adminStatus = {};
  function setAdminText(el, text, label){
    if(el) el.textContent = text;
    const key = label || (el && el.id) || '';
    if(key && window.IKAdminLog){
      const next = String(text || '');
      if(adminStatus[key] !== next){
        adminStatus[key] = next;
        window.IKAdminLog('log', 'student_helper', `${key}: ${next}`);
      }
    }
  }

  function enforceBuilderAccess(){
    if(elSubtabBuilder){
      elSubtabBuilder.hidden = !wtRuntime.isAdmin;
      elSubtabBuilder.disabled = !wtRuntime.isAdmin;
      elSubtabBuilder.setAttribute('aria-hidden', String(!wtRuntime.isAdmin));
    }
    if(!wtRuntime.isAdmin){
      if(elPanelBuilder) elPanelBuilder.hidden = true;
      if(window.StudentHelperTabs && typeof window.StudentHelperTabs.setWTSubTab === 'function'){
        const currentSubtab = (typeof window.StudentHelperTabs.getWTSubTab === 'function')
          ? window.StudentHelperTabs.getWTSubTab()
          : 'rule';
        if(currentSubtab === 'builder') window.StudentHelperTabs.setWTSubTab('rule');
      }else{
        if(elPanelRule) elPanelRule.hidden = false;
        if(elPanelPractice) elPanelPractice.hidden = true;
        if(elPanelText) elPanelText.hidden = true;
        if(elSubtabRule) elSubtabRule.setAttribute('aria-selected', 'true');
        if(elSubtabPractice) elSubtabPractice.setAttribute('aria-selected', 'false');
        if(elSubtabText) elSubtabText.setAttribute('aria-selected', 'false');
        if(elSubtabBuilder) elSubtabBuilder.setAttribute('aria-selected', 'false');
      }
    }
    syncBuilderTypeControlVisibility();
  }

  function syncBuilderTypeControlVisibility(){
    const isBuilder = !!(window.StudentHelperTabs
      && typeof window.StudentHelperTabs.getWTSubTab === 'function'
      && window.StudentHelperTabs.getWTSubTab() === 'builder');
    const show = !!(wtRuntime.isAdmin && isBuilder);
    if(elTransformTypeLabel) elTransformTypeLabel.hidden = !show;
    if(elTransformType) elTransformType.hidden = !show;
  }

  function pulse(el, cls){
    if(!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }
  function setFeedback(state, stamp, line){
    elFeedbackBox.dataset.state = state || 'idle';
    elFeedbackStamp.textContent = stamp || 'info';
    elFeedbackLine.textContent = line || '';
    pulse(elFeedbackBox, 'ik-pop');
  }

  function allWtTypeIds(){ return WT_TYPES.map((x) => x.id); }

  function getEffectiveTypeIds(){
    if(normWtMode(wtMode) === WT_MODE_MIXED) return allWtTypeIds();
    return normalizeWtTypeIds(wtCustomTypeIds);
  }

  function ensurePrimaryTransformType(){
    const ids = getEffectiveTypeIds();
    const current = normTransformType(transformType);
    const next = ids.includes(current) ? current : (ids[0] || TRANSFORM_TYPE_N2A);
    transformType = next || TRANSFORM_TYPE_N2A;
    if(elTransformType) elTransformType.value = transformType;
    return transformType;
  }

  function wtTypeLabel(typeId){
    const info = WT_TYPES.find((x) => x.id === typeId) || WT_TYPES[0];
    return wtText(info.titleRu, info.titleEn);
  }

  function categoriesForTypeIds(typeIds){
    const ids = Array.isArray(typeIds) ? typeIds : [];
    const out = [];
    for(const id of ids){
      const info = WT_TYPES.find((x) => x.id === id);
      if(!info) continue;
      for(const c of info.categories){
        const cat = normCategory(c);
        if(!out.includes(cat)) out.push(cat);
      }
    }
    return out;
  }

  function wtModeHint(mode){
    const m = normWtMode(mode);
    if(m === WT_MODE_CUSTOM){
      return wtText('пользовательский: выбери нужные типы словообразования', 'custom: choose needed word transformation types');
    }
    return wtText('смешанный: все типы словообразования', 'mixed: all word transformation types');
  }

  function renderWtCustomTypePicker(){
    if(!elWtCustomTypeGrid) return;
    const selected = normalizeWtTypeIds(wtCustomTypeIds);
    elWtCustomTypeGrid.innerHTML = '';

    const group = document.createElement('div');
    group.className = 'sh-custom-group';

    const head = document.createElement('div');
    head.className = 'sh-custom-group__head';
    head.innerHTML = `
      <p class="sh-custom-group__title">${escapeHTML(wtText('типы', 'types'))}</p>
      <span class="ik-badge">${selected.length}/${WT_TYPES.length}</span>
      <div class="sh-custom-group__actions"></div>
    `;
    group.appendChild(head);

    const body = document.createElement('div');
    body.className = 'sh-custom-group__body';
    for(const info of WT_TYPES){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `ik-btn ${selected.includes(info.id) ? 'ik-btn--black' : ''}`;
      btn.textContent = wtText(info.titleRu, info.titleEn);
      btn.dataset.typeId = info.id;
      btn.addEventListener('click', ()=>{
        const now = normalizeWtTypeIds(wtCustomTypeIds);
        const has = now.includes(info.id);
        const next = has ? now.filter((x) => x !== info.id) : [...now, info.id];
        wtCustomTypeIds = normalizeWtTypeIds(next);
        saveWtCustomTypes(wtCustomTypeIds);
        applyWtModeUi();
        refreshAfterScopeChange();
      });
      body.appendChild(btn);
    }
    group.appendChild(body);
    elWtCustomTypeGrid.appendChild(group);
  }

  function applyWtModeUi(){
    const mode = normWtMode(wtMode);
    if(btnWtModeMixed) btnWtModeMixed.textContent = wtText('смешанный', 'mixed');
    if(btnWtModeCustom) btnWtModeCustom.textContent = wtText('пользовательский', 'custom');
    if(btnWtModeMixed){
      btnWtModeMixed.classList.toggle('ik-btn--black', mode === WT_MODE_MIXED);
      btnWtModeMixed.classList.toggle('is-active', mode === WT_MODE_MIXED);
    }
    if(btnWtModeCustom){
      btnWtModeCustom.classList.toggle('ik-btn--black', mode === WT_MODE_CUSTOM);
      btnWtModeCustom.classList.toggle('is-active', mode === WT_MODE_CUSTOM);
    }
    if(elWtModeHint) elWtModeHint.textContent = wtModeHint(mode);
    if(elWtCustomTypeTitle) elWtCustomTypeTitle.textContent = wtText('пользовательский: выбери типы словообразования', 'custom: choose word transformation types');
    if(elWtCustomTypeHint) elWtCustomTypeHint.textContent = wtText('собери свой набор типов: можно выбрать один или несколько', 'build your own set: choose one or multiple types');
    if(btnWtCustomTypeSelectAll) btnWtCustomTypeSelectAll.textContent = wtText('выбрать все', 'select all');
    if(btnWtCustomTypeClearAll) btnWtCustomTypeClearAll.textContent = wtText('снять все', 'clear all');
    if(elWtCustomTypePicker) elWtCustomTypePicker.hidden = (mode !== WT_MODE_CUSTOM);
    renderWtCustomTypePicker();
    ensurePrimaryTransformType();
  }

  function setWtMode(mode, options){
    const opts = options || {};
    wtMode = normWtMode(mode);
    if(opts.persist !== false) saveWtMode(wtMode);
    applyWtModeUi();
  }

  function currentRuleTypeIds(){
    return getEffectiveTypeIds();
  }

  function setCustomTypes(typeIds){
    const next = normalizeWtTypeIds(typeIds);
    if(!next.length) return false;
    wtCustomTypeIds = next;
    saveWtCustomTypes(wtCustomTypeIds);
    setWtMode(WT_MODE_CUSTOM);
    ensurePrimaryTransformType();
    refreshAfterScopeChange();
    return true;
  }

  function addCurrentRuleToLibrary(){
    const lib = window.StudentHelperLibrary;
    if(!lib) return;
    const typeId = normTransformType(transformType);
    if(!typeId) return;
    const payload = {
      source: 'wt',
      id: typeId,
      title: wtTypeLabel(typeId),
      subtitle: wtText('правило word transformation', 'word transformation rule')
    };
    if(typeof lib.quickAddWithPicker === 'function') lib.quickAddWithPicker(payload);
    else if(typeof lib.quickAdd === 'function') lib.quickAdd(payload);
  }

  function refreshAfterScopeChange(){
    refreshLocalizedUi();
    updateActiveTasks();
    resetPracticeSession();
    goNext();
    resetTextSession();
    goTextNext();
  }

  function taskMatchesTransformType(task){
    const activeTypeIds = getEffectiveTypeIds();
    const typeId = taskTypeId(task);
    return activeTypeIds.includes(typeId);
  }

  function scopedTasks(){
    return tasksAll.filter(taskMatchesTransformType);
  }

  function setSelectOptions(selectEl, options, preferred){
    if(!selectEl) return;
    const prev = String(preferred || selectEl.value || '');
    selectEl.innerHTML = '';
    for(const opt of options){
      const o = document.createElement('option');
      o.value = String(opt.value);
      o.textContent = String(opt.label);
      selectEl.appendChild(o);
    }
    const allowed = new Set(options.map((x) => String(x.value)));
    if(allowed.has(prev)) selectEl.value = prev;
    else if(options[0]) selectEl.value = String(options[0].value);
  }

  function syncTransformTypeOptions(){
    if(!elTransformType) return;
    const prev = String(elTransformType.value || transformType || TRANSFORM_TYPE_N2A);
    setSelectOptions(elTransformType, [
      { value: TRANSFORM_TYPE_N2A, label: wtText('образование прилагательного', 'Adjective Formation') },
      { value: TRANSFORM_TYPE_INUN, label: wtText('приставки in- или un-', 'in- or un- prefixes') },
      { value: TRANSFORM_TYPE_N2V, label: wtText('образование глагола', 'Verb Formation') },
      { value: TRANSFORM_TYPE_W2N, label: wtText('образование существительного', 'Noun Formation') }
    ], prev);
  }

  function syncTypeSelectors(){
    const activeTypeIds = getEffectiveTypeIds();
    const activeCats = categoriesForTypeIds(activeTypeIds);

    const categoryLabel = (cat) => {
      if(cat === 'Suffixes') return wtText('суффиксы', 'Suffixes');
      if(cat === 'Prefixes') return wtText('приставки', 'Prefixes');
      if(cat === 'InUnPrefixes') return wtText('приставки in- или un-', 'in- or un- prefixes');
      if(cat === CATEGORY_N2V) return wtText('образование глагола', 'Verb Formation');
      if(cat === CATEGORY_W2N) return wtText('образование существительного', 'Noun Formation');
      return String(cat || '');
    };

    const opts = [{ value: 'All', label: wtText('все категории', 'All categories') }];
    for(const cat of activeCats){
      opts.push({ value: cat, label: categoryLabel(cat) });
    }

    setSelectOptions(elPracticeCategory, opts, elPracticeCategory && elPracticeCategory.value);
    setSelectOptions(elTextCategory, opts, elTextCategory && elTextCategory.value);

    const builderType = normTransformType(transformType);
    const builderCats = categoriesForTypeIds([builderType]);
    const builderViewOpts = [{ value: 'All', label: wtText('все категории', 'All categories') }];
    for(const cat of builderCats){
      builderViewOpts.push({ value: cat, label: categoryLabel(cat) });
    }
    setSelectOptions(elViewCategory, builderViewOpts, elViewCategory && elViewCategory.value);

    const builderAddOpts = [];
    for(const cat of builderCats){
      builderAddOpts.push({ value: cat, label: categoryLabel(cat) });
    }
    if(!builderAddOpts.length){
      builderAddOpts.push({ value: 'Suffixes', label: wtText('суффиксы', 'Suffixes') });
    }
    setSelectOptions(elAddCategory, builderAddOpts, elAddCategory && elAddCategory.value);
  }

  function updateScore(){ elScore.textContent = `${sessionCorrect}/${sessionTotal}`; }
  function updateQ(){ elQ.textContent = `q: ${historyPos >= 0 ? (historyPos + 1) : 0}`; }
  function updateCountBadge(){ elTaskCount.textContent = `tasks: ${scopedTasks().length}`; }

  function updateTextScore(){ if(elTextScore) elTextScore.textContent = `${textSessionCorrect}/${textSessionTotal}`; }
  function updateTextQ(){ if(elTextQ) elTextQ.textContent = `q: ${textHistoryPos >= 0 ? (textHistoryPos + 1) : 0}`; }

  function setTextFeedback(state, stamp, line){
    if(!elTextFeedbackBox || !elTextFeedbackStamp || !elTextFeedbackLine) return;
    elTextFeedbackBox.dataset.state = state || 'idle';
    elTextFeedbackStamp.textContent = stamp || 'info';
    elTextFeedbackLine.textContent = line || '';
    pulse(elTextFeedbackBox, 'ik-pop');
  }

  function clearTextInputState(){
    if(elTextAnswer) elTextAnswer.classList.remove('is-ok','is-bad');
  }

  function setTextCheckMode(mode){
    textCheckMode = mode;
    if(!btnTextCheckNext) return;
    if(mode === 'next'){
      btnTextCheckNext.textContent = wtText('далее', 'next');
      btnTextCheckNext.title = wtText('Далее (Enter)', 'Next (Enter)');
    }else{
      btnTextCheckNext.textContent = wtText('проверить', 'check');
      btnTextCheckNext.title = 'Check (Enter)';
    }
  }

  function resetTextSession(){
    textHistory = [];
    textHistoryPos = -1;
    textPool = [];
    textLastKey = '';
    updateTextQ();
    setTextCheckMode('check');
    clearTextInputState();
  }

  function textPromptForCurrentType(){
    const ids = getEffectiveTypeIds();
    if(ids.length !== 1){
      return wtText('Образуйте слово в скобках так, чтобы оно подходило по смыслу и грамматике.', 'Form the word in brackets so it fits the meaning and grammar.');
    }
    if(ids[0] === TRANSFORM_TYPE_INUN){
      return wtText('Образуйте слово в скобках так, чтобы оно подходило по смыслу и грамматике.', 'Form the word in brackets so it fits the meaning and grammar.');
    }
    if(ids[0] === TRANSFORM_TYPE_N2V){
      return wtText('Образуйте глагол от слова в скобках, чтобы завершить предложение.', 'Form a verb from the word in brackets to complete the sentence.');
    }
    if(ids[0] === TRANSFORM_TYPE_W2N){
      return wtText('Образуйте существительное от слова в скобках, чтобы завершить предложение.', 'Form a noun from the word in brackets to complete the sentence.');
    }
    return wtText('Образуйте однокоренное слово от основы в скобках.', 'Form a cognate word from the base in brackets.');
  }

  function updateTextPromptLabel(){
    if(elTextPromptLabel) elTextPromptLabel.textContent = textPromptForCurrentType();
  }

  function updateTextActiveTasks(){
    const cat = normCategory(elTextCategory && elTextCategory.value || 'All');
    const scope = scopedTasks();
    if(cat === 'All') textTasksActive = [...scope];
    else textTasksActive = scope.filter((t) => normCategory(t.category) === cat);
    textTasksActive.sort((a,b)=> (a.en_noun || '').localeCompare((b.en_noun || ''), 'en'));
    textPool = [];
    textLastKey = '';
    updateTextPromptLabel();
  }

  function pickTextTemplate(baseWord, templates){
    const list = Array.isArray(templates) ? templates : [];
    if(!list.length) return { en: 'Write the correct form: ____', ru: 'Напиши правильную форму: ____' };
    let sum = 0;
    const src = String(baseWord || '');
    for(let i = 0; i < src.length; i += 1) sum += src.charCodeAt(i);
    return list[sum % list.length];
  }

  function buildTextExercise(task){
    const t = task || {};
    const typeId = taskTypeId(t);
    const base = String(t.en_noun || '').toUpperCase();
    const ruBase = resolveRuNoun(t) || t.ru_noun || t.en_noun || '';
    const ruAnswer = resolveRuAdj(t) || t.ru_adj || t.en_adj || '';

    const customTpl = getCustomTextTemplate(t);
    if(customTpl && customTpl.en){
      const enSentence = sentenceWithGap(customTpl.en, t.en_adj);
      const ruSource = customTpl.ru || customTpl.en;
      const ruSentence = sentenceWithGap(ruSource, ruAnswer);
      return {
        en: `${enSentence} (${base})`,
        ru: `${ruSentence} (${ruBase})`
      };
    }

    let templates = [
      {
        en: 'The situation became ____ after the latest update.',
        ru: 'Ситуация стала ____ после последнего обновления.'
      },
      {
        en: 'Her explanation was ____ enough for everyone to understand.',
        ru: 'Ее объяснение было достаточно ____ для всех.'
      },
      {
        en: 'The final decision looked ____ to the whole team.',
        ru: 'Итоговое решение выглядело ____ для всей команды.'
      }
    ];

    if(typeId === TRANSFORM_TYPE_INUN){
      templates = [
        {
          en: 'Without enough data, his conclusion sounded ____.',
          ru: 'Без достаточных данных его вывод звучал ____.'
        },
        {
          en: 'After the review, the plan seemed ____ for this stage.',
          ru: 'После проверки план казался ____ для этого этапа.'
        },
        {
          en: 'In that context, the result looked completely ____.',
          ru: 'В этом контексте результат выглядел полностью ____.'
        }
      ];
    }else if(typeId === TRANSFORM_TYPE_N2V){
      templates = [
        {
          en: 'Before the launch, we need to ____ the process.',
          ru: 'Перед запуском нам нужно ____ процесс.'
        },
        {
          en: 'The team will ____ the idea during the workshop.',
          ru: 'Команда будет ____ идею во время воркшопа.'
        },
        {
          en: 'Please ____ this concept so the clients can follow it.',
          ru: 'Пожалуйста, ____ эту концепцию, чтобы клиенты могли ее понять.'
        }
      ];
    }else if(typeId === TRANSFORM_TYPE_W2N){
      templates = [
        {
          en: 'His ____ helped the team finish the task on time.',
          ru: 'Его ____ помогла команде закончить задачу вовремя.'
        },
        {
          en: 'The teacher praised her ____ in class.',
          ru: 'Учитель похвалил ее ____ на занятии.'
        },
        {
          en: 'We discussed this ____ at the meeting yesterday.',
          ru: 'Мы обсудили это ____ на встрече вчера.'
        }
      ];
    }

    const tpl = pickTextTemplate(t.en_noun, templates);
    return {
      en: `${tpl.en} (${base})`,
      ru: `${tpl.ru} (${ruBase})`
    };
  }

  function showTextTask(task){
    textCurrent = task || null;
    textRevealRu = false;
    if(elTextSentenceRu) elTextSentenceRu.hidden = true;
    setTextCheckMode('check');
    clearTextInputState();

    if(!textCurrent){
      if(elTextSentenceEn) elTextSentenceEn.textContent = wtText('нет заданий', 'no tasks');
      if(elTextSentenceRu) elTextSentenceRu.textContent = '';
      if(elTextAnswer) elTextAnswer.value = '';
      const noTypesPicked = (normWtMode(wtMode) === WT_MODE_CUSTOM && getEffectiveTypeIds().length === 0);
      setTextFeedback(
        'idle',
        wtText('пусто', 'empty'),
        noTypesPicked
          ? wtText('выбери минимум один тип в пользовательском режиме', 'choose at least one type in custom mode')
          : wtText('добавь задания или load db', 'add tasks or load db')
      );
      return;
    }

    const ex = buildTextExercise(textCurrent);
    if(elTextSentenceEn) elTextSentenceEn.textContent = ex.en;
    if(elTextSentenceRu) elTextSentenceRu.textContent = `${wtText('перевод', 'translation')}: ${ex.ru}`;
    if(elTextAnswer){
      elTextAnswer.value = '';
      elTextAnswer.focus({ preventScroll:true });
    }

    setTextFeedback('idle', wtText('готово', 'ready'), wtText('введи ответ и нажми check', 'enter the answer and press check'));
  }

  function pickNewTextTask(){
    if(!textTasksActive.length) return null;
    if(!textPool.length){
      const random = !!(elTextRandom && elTextRandom.checked);
      textPool = buildCyclePool(textTasksActive, random, textLastKey);
    }
    const next = textPool.shift() || null;
    if(next) textLastKey = taskCycleKey(next);
    return next;
  }

  function goTextNext(){
    if(!textTasksActive.length){ showTextTask(null); return; }

    if(textHistoryPos < textHistory.length - 1){
      textHistoryPos += 1;
      updateTextQ();
      showTextTask(textHistory[textHistoryPos]);
      return;
    }

    const next = pickNewTextTask();
    textHistory.push(next);
    textHistoryPos = textHistory.length - 1;
    updateTextQ();
    showTextTask(next);
  }

  function goTextPrev(){
    if(textHistoryPos <= 0) return;
    textHistoryPos -= 1;
    updateTextQ();
    showTextTask(textHistory[textHistoryPos]);
  }

  function toggleTextTranslate(){
    if(!textCurrent || !elTextSentenceRu) return;
    textRevealRu = !textRevealRu;
    elTextSentenceRu.hidden = !textRevealRu;
  }

  function checkTextOrNext(){
    if(!textCurrent) return;

    if(textCheckMode === 'next'){
      goTextNext();
      return;
    }

    const user = normalize(elTextAnswer && elTextAnswer.value || '');
    const correct = normalize(textCurrent.en_adj);

    if(!user){
      setTextFeedback('idle', wtText('ввод', 'type'), wtText('введи ответ', 'enter the answer'));
      if(elTextAnswer) pulse(elTextAnswer, 'ik-shake');
      return;
    }

    textSessionTotal += 1;

    if(user === correct){
      textSessionCorrect += 1;
      updateTextScore();
      setTextFeedback('correct', 'ok', formatSolvedPair(textCurrent));
      clearTextInputState();
      if(elTextAnswer) elTextAnswer.classList.add('is-ok');
      setTextCheckMode('next');
      return;
    }

    updateTextScore();
    setTextFeedback('wrong', wtText('нет', 'no'), wtText('неверно', 'incorrect'));
    clearTextInputState();
    if(elTextAnswer){
      elTextAnswer.classList.add('is-bad');
      elTextAnswer.focus({ preventScroll:true });
      elTextAnswer.select();
    }
    setTextCheckMode('check');
  }

  function showTextAnswer(){
    if(!textCurrent) return;
    setTextFeedback('idle', wtText('ответ', 'answer'), formatSolvedPair(textCurrent));
  }

  function clearInputState(){ elAnswer.classList.remove('is-ok','is-bad'); }

  function setCheckMode(mode){
    checkMode = mode;
    if(mode === 'next'){
      btnCheckNext.textContent = wtText('далее', 'next');
      btnCheckNext.title = wtText('Далее (Enter)', 'Next (Enter)');
    }else{
      btnCheckNext.textContent = wtText('проверить', 'check');
      btnCheckNext.title = 'Check (Enter)';
    }
  }

  function resetPracticeSession(){
    history = [];
    historyPos = -1;
    practicePool = [];
    practiceLastKey = '';
    updateQ();
    setCheckMode('check');
    clearInputState();
  }

  function promptTextForCategory(cat){
    const c = normCategory(cat);
    if(c === 'InUnPrefixes') return wtText('Выбери нужную приставку: in- или un-', 'Choose the correct prefix: in- or un-');
    if(c === CATEGORY_N2V) return wtText('Образуй глагол от данного слова', 'Form a verb from the base word');
    if(c === CATEGORY_W2N) return wtText('Образуй существительное от данного слова', 'Form a noun from the base word');
    if(c === 'Prefixes') return wtText('Образуй отрицательное прилагательное от данного слова', 'Build a negative adjective from the base word');
    return wtText('Образуй прилагательное из данного слова', 'Build an adjective from the base word');
  }

  function isInUnPrefixesCategory(category){
    return normCategory(category) === 'InUnPrefixes';
  }

  function resetPrefixChoiceButtons(){
    if(btnPrefixIn) btnPrefixIn.classList.remove('ik-btn--black');
    if(btnPrefixUn) btnPrefixUn.classList.remove('ik-btn--black');
  }

  function applyInUnPrefixMode(){
    const activeCategory = current
      ? normCategory(current.category || 'Suffixes')
      : normCategory(elPracticeCategory && elPracticeCategory.value || 'All');
    const enabled = isInUnPrefixesCategory(activeCategory);

    if(elWtPanel) elWtPanel.classList.toggle('wt-inun-mode', enabled);
    if(elInUnPrefixPicker) elInUnPrefixPicker.hidden = !enabled;
    if(elAnswer){
      elAnswer.readOnly = enabled;
      elAnswer.placeholder = enabled ? wtText('выбери in- или un-', 'choose in- or un-') : defaultAnswerPlaceholder;
    }

    if(!enabled) resetPrefixChoiceButtons();
  }

  function updatePromptLabel(){
    const selected = normCategory(elPracticeCategory && elPracticeCategory.value || 'All');
    if(selected === 'All'){
      if(!current){
        const cats = categoriesForTypeIds(getEffectiveTypeIds());
        if(cats.length > 1){
          elPromptLabel.textContent = wtText('Образуй нужную форму слова по типу задания', 'Build the needed word form based on task type');
          return;
        }
      }
      const curCat = current
        ? normCategory(current.category || 'Suffixes')
        : (categoriesForTypeIds(getEffectiveTypeIds())[0] || 'Suffixes');
      elPromptLabel.textContent = promptTextForCategory(curCat);
    }else{
      elPromptLabel.textContent = promptTextForCategory(selected);
    }
  }

  function updateActiveTasks(){
    const cat = normCategory(elPracticeCategory && elPracticeCategory.value || 'All');
    const scope = scopedTasks();

    if(cat === 'All') tasksActive = [...scope];
    else tasksActive = scope.filter(t => normCategory(t.category) === cat);

    tasksActive.sort((a,b)=> (a.en_noun || '').localeCompare((b.en_noun || ''), 'en'));
    practicePool = [];
    practiceLastKey = '';

    updatePromptLabel();
    renderRuleForCurrentScope();
    applyInUnPrefixMode();
    updateTextActiveTasks();
  }

  function refreshLocalizedUi(){
    syncTransformTypeOptions();
    applyWtModeUi();
    syncTypeSelectors();
    updateCountBadge();
    renderTaskList();
    updatePromptLabel();
    updateTextPromptLabel();

    renderRuleForCurrentScope();

    applyInUnPrefixMode();
    syncBuilderTypeControlVisibility();
    setCheckMode(checkMode);
    setTextCheckMode(textCheckMode);

    if(current && elPromptRu){
      const ruWord = resolveRuNoun(current);
      elPromptRu.textContent = `${wtText('перевод', 'translation')}: ${ruWord || current.ru_noun || current.en_noun}`;
    }

    if(textCurrent && elTextSentenceRu){
      const ex = buildTextExercise(textCurrent);
      elTextSentenceEn.textContent = ex.en;
      elTextSentenceRu.textContent = `${wtText('перевод', 'translation')}: ${ex.ru}`;
    }
  }

  function resolveRuNoun(task){
    const t = task || {};
    let ru = String(t.ru_noun || '').trim();
    if(!isInUnPrefixesCategory(t.category)) return ru;

    const key = normalize(t.en_noun);
    const fallback = INUN_RU_NOUN_FALLBACK[key] || '';
    const looksAscii = /^[a-z\s-]+$/i.test(ru);
    if(!ru || looksAscii) ru = fallback || ru;
    return ru;
  }

  function resolveRuAdj(task){
    const t = task || {};
    let ru = String(t.ru_adj || '').trim();
    if(!isInUnPrefixesCategory(t.category)) return ru;

    const key = normalize(t.en_adj);
    const fallback = INUN_RU_ADJ_FALLBACK[key] || '';
    const looksAscii = /^[a-z\s-]+$/i.test(ru);
    if(!ru || looksAscii) ru = fallback || ru;
    return ru;
  }

  function formatSolvedPair(task){
    if(!task) return '';
    const ruNoun = resolveRuNoun(task) || task.ru_noun || task.en_noun;
    const ruAdj = resolveRuAdj(task) || task.ru_adj || task.en_adj;
    return `${task.en_noun}(${ruNoun}) -> ${task.en_adj}(${ruAdj})`;
  }

  function showTask(t){
    current = t || null;
    updatePromptLabel();
    applyInUnPrefixMode();
    revealRu = false;
    if(elPromptRu) elPromptRu.hidden = true;

    clearInputState();
    setCheckMode('check');

    if(!current){
      elPromptEn.textContent = wtText('нет заданий', 'no tasks');
      elAnswer.value = '';
      resetPrefixChoiceButtons();
      const noTypesPicked = (normWtMode(wtMode) === WT_MODE_CUSTOM && getEffectiveTypeIds().length === 0);
      setFeedback(
        'idle',
        wtText('пусто', 'empty'),
        noTypesPicked
          ? wtText('выбери минимум один тип в пользовательском режиме', 'choose at least one type in custom mode')
          : wtText('добавь задания или load db', 'add tasks or load db')
      );
      return;
    }

    elPromptEn.innerHTML = buildAffixHintHTML(current.en_noun, detectAffixHintKind(current.en_noun, current.en_adj, current.category));
    const ruWord = resolveRuNoun(current);
    elPromptRu.textContent = `${wtText('перевод', 'translation')}: ${ruWord || current.ru_noun || current.en_noun}`;
    elPromptRu.hidden = true;

    elAnswer.value = '';
    resetPrefixChoiceButtons();
    elAnswer.focus({ preventScroll:true });
    setFeedback('idle', wtText('готово', 'ready'), isInUnPrefixesCategory(current && current.category)
      ? wtText('выбери приставку и нажми check', 'choose a prefix and press check')
      : wtText('введи ответ и нажми check', 'enter the answer and press check'));
  }

  function pickNewTask(){
    if(!tasksActive.length) return null;
    if(!practicePool.length){
      const random = !!(elRandom && elRandom.checked);
      practicePool = buildCyclePool(tasksActive, random, practiceLastKey);
    }
    const next = practicePool.shift() || null;
    if(next) practiceLastKey = taskCycleKey(next);
    return next;
  }

  function goNext(){
    if(!tasksActive.length){ showTask(null); return; }

    if(historyPos < history.length - 1){
      historyPos += 1;
      updateQ();
      showTask(history[historyPos]);
      return;
    }

    const t = pickNewTask();
    history.push(t);
    historyPos = history.length - 1;
    updateQ();
    showTask(t);
  }

  function goPrev(){
    if(historyPos <= 0) return;
    historyPos -= 1;
    updateQ();
    showTask(history[historyPos]);
  }

  function toggleTranslate(){
    if(!current) return;
    revealRu = !revealRu;
    elPromptRu.hidden = !revealRu;
  }

  function checkOrNext(){
    if(!current) return;

    if(checkMode === 'next'){
      goNext();
      return;
    }

    const user = normalize(elAnswer.value);
    const correct = normalize(current.en_adj);

    if(!user){
      setFeedback('idle', wtText('ввод', 'type'), isInUnPrefixesCategory(current && current.category)
        ? wtText('выбери приставку in- или un-', 'choose in- or un- prefix')
        : wtText('введи ответ', 'enter the answer'));
      pulse(elAnswer, 'ik-shake');
      return;
    }

    sessionTotal += 1;

    if(user === correct){
      sessionCorrect += 1;
      updateScore();
      setFeedback('correct', 'ok', formatSolvedPair(current));
      clearInputState();
      elAnswer.classList.add('is-ok');
      setCheckMode('next');
    }else{
      updateScore();
      setFeedback('wrong', wtText('нет', 'no'), wtText('неверно', 'incorrect'));
      clearInputState();
      elAnswer.classList.add('is-bad');
      elAnswer.focus({ preventScroll:true });
      elAnswer.select();
      setCheckMode('check');
    }
  }

  function showAnswer(){
    if(!current) return;
    setFeedback('idle', 'answer', formatSolvedPair(current));
  }

  async function refreshTasks(){
    const all = await getAllTasks(db);
    tasksAll = all
      .filter(t => t.type === 'noun_to_adj')
      .map(t => ({
        ...t,
        category: normCategory(t.category || 'Suffixes')
      }))
      .sort((a,b)=> (a.en_noun || '').localeCompare((b.en_noun || ''), 'en'));

    updateCountBadge();
    renderTaskList();
  }

  function supabaseDb(type){
    return { kind:'supabase', type, client: wtRuntime.supa };
  }

  function memoryDb(type, list){
    const tasks = Array.isArray(list) ? list.map((t, idx) => ({
      id: Number(t.id || (idx + 1)),
      type: t.type || type,
      category: normCategory(t.category || 'Suffixes'),
      en_noun: normalize(t.en_noun),
      en_adj: normalize(t.en_adj),
      ru_noun: String(t.ru_noun || '').trim(),
      ru_adj: String(t.ru_adj || '').trim(),
      pairKey: t.pairKey || makePairKey(t),
      createdAt: Number(t.createdAt || Date.now()),
      updatedAt: Number(t.updatedAt || Date.now())
    })) : [];
    return {
      kind: 'memory',
      type,
      tasks,
      nextId: tasks.length + 1
    };
  }

  async function seedCloudFromList(type, list){
    if(!wtRuntime.supa || !wtRuntime.isAdmin) return 0;
    let added = 0;
    const cloud = supabaseDb(type);
    for(const t of list){
      // eslint-disable-next-line no-await-in-loop
      const res = await addTask(cloud, {
        type,
        category: normCategory(t.category || 'Suffixes'),
        en_noun: t.en_noun,
        en_adj: t.en_adj,
        ru_noun: t.ru_noun,
        ru_adj: t.ru_adj
      });
      if(res && res.ok) added += 1;
    }
    return added;
  }

  function renderTaskList(){
    const view = normCategory(elViewCategory.value || 'All');
    const scope = scopedTasks();
    const list = (view === 'All') ? scope : scope.filter(t => normCategory(t.category) === view);

    elTaskList.innerHTML = '';
    if(!list.length){
      const li = document.createElement('li');
      li.innerHTML = `<p class="ik-itemline"><b>пусто</b></p>`;
      elTaskList.appendChild(li);
      return;
    }

    for(const t of list){
      const li = document.createElement('li');

      const left = document.createElement('div');
      left.innerHTML = `
        <p class="ik-itemline">
          <b>${escapeHTML(t.en_noun)}</b> -> <b>${escapeHTML(t.en_adj)}</b>
          <span class="ik-muted"> | ${escapeHTML(t.ru_noun)} -> ${escapeHTML(t.ru_adj)}</span>
          <span class="ik-muted"> | ${escapeHTML(normCategory(t.category))}</span>
        </p>
      `;

      const right = document.createElement('div');
      right.className = 'ik-mini';
      if(wtRuntime.isAdmin){
        const btnDel = document.createElement('button');
        btnDel.className = 'ik-btn';
        btnDel.type = 'button';
        btnDel.textContent = 'удалить';
        btnDel.addEventListener('click', async ()=>{
          try{
            await deleteTask(db, t.id);
            await refreshTasks();
            updateActiveTasks();
            resetPracticeSession();
            goNext();
            resetTextSession();
            goTextNext();
          }catch(e){
            alert(`Ошибка удаления: ${e.message || e}`);
          }
        });
        right.appendChild(btnDel);
      }
      li.appendChild(left);
      li.appendChild(right);
      elTaskList.appendChild(li);
    }
  }

  async function boot(){
    try{
      await initWtAccess();
      await preloadSeedTextTemplates();
      enforceBuilderAccess();

      setAdminText(elDbStatus, 'opening...');
      setAdminText(elDbNameLine, `db: ${dbNameFor('noun_to_adj')}`);

      let localDb = null;
      try{
        localDb = await openDBForType('noun_to_adj');
        db = localDb;
        wtRuntime.source = 'local';
        const report = await autoLoadIfEmpty('noun_to_adj');
        if(report.loaded){
          setAdminText(elSeedBadge, 'json: loaded');
          elSeedBadge.title = report.okFiles.join(', ');
        }else{
          setAdminText(elSeedBadge, report.reason === 'not_empty' ? 'json: skip' : 'json: fail');
          elSeedBadge.title = report.reason === 'not_empty'
            ? 'Данные уже есть'
            : 'Автозагрузка не сработала. Если это file://, нажми load db';
        }
      }catch(localError){
        console.warn('WT local DB unavailable:', localError);
      }

      if(wtRuntime.supa){
        try{
          const cloudReady = await isSupabaseReady('noun_to_adj');
          if(cloudReady){
            const cloud = supabaseDb('noun_to_adj');
            let cloudCount = 0;
            try{ cloudCount = await countAllTasks(cloud); }catch(_){ cloudCount = 0; }

            if(cloudCount <= 0 && wtRuntime.isAdmin){
              let sourceList = [];
              if(localDb){
                sourceList = await getAllTasks(localDb);
              }
              if(!sourceList.length){
                sourceList = await loadSeedTasksFromJson('noun_to_adj');
              }
              if(sourceList.length){
                await seedCloudFromList('noun_to_adj', sourceList);
                cloudCount = await countAllTasks(cloud);
              }
            }

            if(cloudCount > 0){
              db = cloud;
              wtRuntime.source = 'cloud';
              setAdminText(elDbNameLine, `db: ${WT_TABLE}`);
              setAdminText(elSeedBadge, wtRuntime.isAdmin ? 'cloud: admin' : 'cloud: read');
              elSeedBadge.title = wtRuntime.isAdmin
                ? 'Источник: Supabase (admin read/write)'
                : 'Источник: Supabase (read-only)';
            }
          }else{
            setAdminText(elSeedBadge, 'cloud: off');
            elSeedBadge.title = `Таблица ${WT_TABLE} пока не создана. Используется локальная база.`;
          }
        }catch(cloudError){
          console.warn('WT cloud init skipped:', cloudError);
          setAdminText(elSeedBadge, 'cloud: off');
          elSeedBadge.title = `Cloud fallback: ${cloudError && (cloudError.message || cloudError)}`;
        }
      }

      if(!db){
        const seed = await loadSeedTasksFromJson('noun_to_adj');
        db = memoryDb('noun_to_adj', seed);
        wtRuntime.source = 'memory';
        setAdminText(elDbNameLine, 'db: memory-seed');
        setAdminText(elSeedBadge, 'seed: memory');
        elSeedBadge.title = 'IndexedDB/Supabase недоступны. Показаны задания из локальных JSON файлов.';
      }

      setAdminText(elDbStatus, 'ok');

      await refreshTasks();
      if(!tasksAll.length){
        if(localDb && db && db.kind === 'supabase'){
          const localList = await getAllTasks(localDb);
          if(localList.length){
            db = localDb;
            wtRuntime.source = 'local';
            setAdminText(elDbNameLine, `db: ${dbNameFor('noun_to_adj')}`);
            setAdminText(elSeedBadge, 'cloud: empty/local');
            elSeedBadge.title = 'В облаке пока нет корректных задач. Показана локальная база браузера.';
            await refreshTasks();
          }
        }
      }

      if(!tasksAll.length){
        const seed = await loadSeedTasksFromJson('noun_to_adj');
        if(seed.length){
          db = memoryDb('noun_to_adj', seed);
          wtRuntime.source = 'memory';
          setAdminText(elDbNameLine, 'db: memory-seed');
          setAdminText(elSeedBadge, 'seed: memory');
          elSeedBadge.title = 'Показаны задания из JSON, потому что локальная/облачная база пустая.';
          await refreshTasks();
        }
      }

      try{
        const merged = await mergeMissingSeedTasks('noun_to_adj');
        if(merged && merged.added) await refreshTasks();
      }catch(seedMergeError){
        console.warn('WT in/un seed merge skipped:', seedMergeError);
      }

      syncTransformTypeOptions();
      transformType = normTransformType(elTransformType && elTransformType.value);
      if(elTransformType) elTransformType.value = transformType;
      refreshLocalizedUi();

      updateActiveTasks();
      updateScore();
      updateQ();
      goNext();

      updateTextScore();
      updateTextQ();
      goTextNext();

      if(window.IKLoading) window.IKLoading.done();

      if(wtRuntime.supa && wtRuntime.supa.auth && typeof wtRuntime.supa.auth.onAuthStateChange === 'function'){
        wtRuntime.supa.auth.onAuthStateChange(async () => {
          await initWtAccess();
          enforceBuilderAccess();
        });
      }
    }catch(e){
      setAdminText(elDbStatus, 'failed');
      setFeedback('idle', 'fail', `Ошибка запуска: ${e && (e.message || e)}`);
      console.error(e);
    }
  }

  // -----------------------------
  // Events
  // -----------------------------
  function choosePrefix(prefix){
    if(!current || !isInUnPrefixesCategory(current.category)) return;
    const p = normalize(prefix);
    if(p !== 'in' && p !== 'un') return;

    elAnswer.value = `${p}${normalize(current.en_noun)}`;
    clearInputState();

    if(btnPrefixIn) btnPrefixIn.classList.toggle('ik-btn--black', p === 'in');
    if(btnPrefixUn) btnPrefixUn.classList.toggle('ik-btn--black', p === 'un');

    elAnswer.focus({ preventScroll:true });
  }

  btnPrev.addEventListener('click', goPrev);
  btnNext.addEventListener('click', goNext);
  btnReveal.addEventListener('click', toggleTranslate);
  btnCheckNext.addEventListener('click', checkOrNext);
  btnShowAnswer.addEventListener('click', showAnswer);
  btnPrefixIn && btnPrefixIn.addEventListener('click', ()=> choosePrefix('in'));
  btnPrefixUn && btnPrefixUn.addEventListener('click', ()=> choosePrefix('un'));

  btnTextPrev && btnTextPrev.addEventListener('click', goTextPrev);
  btnTextNext && btnTextNext.addEventListener('click', goTextNext);
  btnTextReveal && btnTextReveal.addEventListener('click', toggleTextTranslate);
  btnTextCheckNext && btnTextCheckNext.addEventListener('click', checkTextOrNext);
  btnTextShowAnswer && btnTextShowAnswer.addEventListener('click', showTextAnswer);

  btnWtModeMixed && btnWtModeMixed.addEventListener('click', ()=>{
    setWtMode(WT_MODE_MIXED);
    refreshAfterScopeChange();
  });
  btnWtModeCustom && btnWtModeCustom.addEventListener('click', ()=>{
    setWtMode(WT_MODE_CUSTOM);
    refreshAfterScopeChange();
  });
  btnWtCustomTypeSelectAll && btnWtCustomTypeSelectAll.addEventListener('click', ()=>{
    wtCustomTypeIds = allWtTypeIds();
    saveWtCustomTypes(wtCustomTypeIds);
    applyWtModeUi();
    refreshAfterScopeChange();
  });
  btnWtCustomTypeClearAll && btnWtCustomTypeClearAll.addEventListener('click', ()=>{
    wtCustomTypeIds = [];
    saveWtCustomTypes(wtCustomTypeIds);
    applyWtModeUi();
    refreshAfterScopeChange();
  });
  btnWtAddToLibrary && btnWtAddToLibrary.addEventListener('click', addCurrentRuleToLibrary);

  elAnswer.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){
      e.preventDefault();
      checkOrNext();
    }
  });

  elTextAnswer && elTextAnswer.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){
      e.preventDefault();
      checkTextOrNext();
    }
  });

  document.addEventListener('keydown', (e)=>{
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    const inText = tag === 'input' || tag === 'textarea';
if(e.key.toLowerCase() === 't'){
      if(inText) return;
      const wtSubtab = (window.StudentHelperTabs && typeof window.StudentHelperTabs.getWTSubTab === 'function')
        ? window.StudentHelperTabs.getWTSubTab()
        : (elPanelText && !elPanelText.hidden ? 'text' : 'practice');
      if(wtSubtab === 'text') toggleTextTranslate();
      else toggleTranslate();
      return;
    }
    if(e.key.toLowerCase() === 'r'){
      if(inText) return;
      if(window.StudentHelperTabs && typeof window.StudentHelperTabs.setWTSubTab === 'function'){
        window.StudentHelperTabs.setWTSubTab('rule');
      }
      return;
    }
  });

  document.addEventListener('sh:route', (e)=>{
    const detail = e && e.detail ? e.detail : {};
    if(detail.main !== 'wt') return;
    syncBuilderTypeControlVisibility();
  });

  document.addEventListener('sh:library-open', (e)=>{
    const detail = e && e.detail ? e.detail : {};
    if(String(detail.source || '').toLowerCase() !== 'wt') return;
    const id = String(detail.id || '').trim();
    if(!id) return;
    if(!setCustomTypes([id])) return;
    if(window.StudentHelperTabs && typeof window.StudentHelperTabs.setWTSubTab === 'function'){
      window.StudentHelperTabs.setWTSubTab('rule');
    }
  });

  document.addEventListener('sh:library-practice', (e)=>{
    const detail = e && e.detail ? e.detail : {};
    if(String(detail.source || '').toLowerCase() !== 'wt') return;
    const ids = Array.isArray(detail.ids) ? detail.ids : [detail.id];
    if(!setCustomTypes(ids)) return;
    if(window.StudentHelperTabs && typeof window.StudentHelperTabs.setWTSubTab === 'function'){
      window.StudentHelperTabs.setWTSubTab('practice');
    }
    resetPracticeSession();
    goNext();
  });

  elPracticeCategory.addEventListener('change', ()=>{
    updateActiveTasks();
    resetPracticeSession();
    goNext();
  });

  elRandom && elRandom.addEventListener('change', ()=>{
    resetPracticeSession();
    goNext();
  });

  elTextCategory && elTextCategory.addEventListener('change', ()=>{
    updateTextActiveTasks();
    resetTextSession();
    goTextNext();
  });

  elTextRandom && elTextRandom.addEventListener('change', ()=>{
    resetTextSession();
    goTextNext();
  });

  elTransformType && elTransformType.addEventListener('change', ()=>{
    transformType = normTransformType(elTransformType.value);
    refreshAfterScopeChange();
  });

  elViewCategory.addEventListener('change', renderTaskList);

  document.getElementById('btnAddTask').addEventListener('click', async ()=>{
    if(!wtRuntime.isAdmin){
      setFeedback('idle', 'read-only', 'конструктор доступен только администратору');
      return;
    }
    let cat;
    if(transformType === TRANSFORM_TYPE_INUN) cat = 'InUnPrefixes';
    else if(transformType === TRANSFORM_TYPE_N2V) cat = CATEGORY_N2V;
    else if(transformType === TRANSFORM_TYPE_W2N) cat = CATEGORY_W2N;
    else cat = normCategory(elAddCategory.value || 'Suffixes');

    const enWord = normalize(document.getElementById('inEnWord').value);
    const enAns  = normalize(document.getElementById('inEnAnswer').value);
    const ruWord = (document.getElementById('inRuWord').value || '').trim();
    const ruAns  = (document.getElementById('inRuAnswer').value || '').trim();

    if(!enWord || !enAns || !ruWord || !ruAns){
      alert('Заполни все 4 поля.');
      return;
    }

    try{
      const res = await addTask(db, { type:'noun_to_adj', category: cat, en_noun: enWord, en_adj: enAns, ru_noun: ruWord, ru_adj: ruAns });
      if(res && res.skipped){
        alert('Такое задание уже есть (дубликат).');
        return;
      }

      document.getElementById('inEnWord').value = '';
      document.getElementById('inEnAnswer').value = '';
      document.getElementById('inRuWord').value = '';
      document.getElementById('inRuAnswer').value = '';

      await refreshTasks();
      updateActiveTasks();
      resetPracticeSession();
      goNext();
      resetTextSession();
      goTextNext();

      setFeedback('idle', 'saved', cat);
    }catch(e){
      alert(`Ошибка сохранения: ${e.message || e}`);
    }
  });

  document.getElementById('btnResetFromJson').addEventListener('click', async ()=>{
    if(!wtRuntime.isAdmin){
      setFeedback('idle', 'read-only', 'конструктор доступен только администратору');
      return;
    }
    try{
      await clearAll(db);
      const loadedFiles = [];

      if(transformType === TRANSFORM_TYPE_INUN){
        const iu = await fetchJson(N2A_INUN_FILE);
        await importFromObject(iu, { type:'noun_to_adj', replace:false, silent:true, defaultCategory:'InUnPrefixes' });
        loadedFiles.push(N2A_INUN_FILE);
      }else if(transformType === TRANSFORM_TYPE_N2V){
        const n2v = await fetchJson(N2V_FILE);
        await importFromObject(n2v, { type:'noun_to_adj', replace:false, silent:true, defaultCategory:CATEGORY_N2V });
        loadedFiles.push(N2V_FILE);
      }else if(transformType === TRANSFORM_TYPE_W2N){
        const w2n = await fetchJson(W2N_FILE);
        await importFromObject(w2n, { type:'noun_to_adj', replace:false, silent:true, defaultCategory:CATEGORY_W2N });
        loadedFiles.push(W2N_FILE);
      }else{
        const s = await fetchJson(N2A_SUFFIX_FILE);
        await importFromObject(s, { type:'noun_to_adj', replace:false, silent:true, defaultCategory:'Suffixes' });
        loadedFiles.push(N2A_SUFFIX_FILE);

        const p = await fetchJson(N2A_PREFIX_FILE);
        await importFromObject(p, { type:'noun_to_adj', replace:false, silent:true, defaultCategory:'Prefixes' });
        loadedFiles.push(N2A_PREFIX_FILE);
      }

      await refreshTasks();
      updateActiveTasks();
      resetPracticeSession();
      goNext();
      resetTextSession();
      goTextNext();

      setAdminText(elSeedBadge, 'json: loaded');
      elSeedBadge.title = loadedFiles.join(', ');
      setFeedback('idle', 'reset', 'ok');
    }catch(e){
      alert('Не удалось загрузить json рядом с HTML. Если открываешь как file://, браузер может блокировать fetch. Тогда нажми load db и выбери файлы вручную.');
    }
  });

  document.getElementById('btnExportDb').addEventListener('click', async ()=>{
    if(!wtRuntime.isAdmin){
      setFeedback('idle', 'read-only', 'конструктор доступен только администратору');
      return;
    }
    const view = normCategory(elViewCategory.value || 'All');
    const scope = scopedTasks();
    const list = (view === 'All') ? scope : scope.filter(t => normCategory(t.category) === view);
    const exportCategory = (view === 'All')
      ? (transformType === TRANSFORM_TYPE_INUN
        ? 'InUnPrefixes'
        : (transformType === TRANSFORM_TYPE_N2V
          ? CATEGORY_N2V
          : (transformType === TRANSFORM_TYPE_W2N ? CATEGORY_W2N : view)))
      : view;
    await exportDb('noun_to_adj', exportCategory, list);
  });

  document.getElementById('btnImportDb').addEventListener('click', ()=>{
    if(!wtRuntime.isAdmin){
      setFeedback('idle', 'read-only', 'конструктор доступен только администратору');
      return;
    }
    elFileImport.value = '';
    elFileImport.click();
  });

  elFileImport.addEventListener('change', async ()=>{
    if(!wtRuntime.isAdmin){
      setFeedback('idle', 'read-only', 'конструктор доступен только администратору');
      return;
    }
    const file = elFileImport.files && elFileImport.files[0];
    if(!file) return;
    try{
      await importFromFile(file, !!elImportReplace.checked);
      await refreshTasks();
      updateActiveTasks();
      resetPracticeSession();
      goNext();
      resetTextSession();
      goTextNext();
      setFeedback('idle', 'import', 'ok');
    }catch(e){
      alert(`Ошибка импорта: ${e.message || e}`);
    }
  });

  document.addEventListener('ik:languagechange', ()=>{
    transformType = normTransformType(elTransformType && elTransformType.value);
    refreshLocalizedUi();
    updateActiveTasks();
  });

  window.addEventListener('load', ()=>{
    transformType = normTransformType(elTransformType && elTransformType.value);
    refreshLocalizedUi();
    updateActiveTasks();
  });

  // -----------------------------

// expose + auto-boot
window.wtBoot = boot;
boot();
