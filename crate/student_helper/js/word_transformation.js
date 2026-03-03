// IndexedDB
  // -----------------------------
  const DB_PREFIX = 'student_helper_db__';
  const DB_VERSION = 4;
  const STORE_TASKS = 'tasks';
  const WT_TABLE = 'sh_wt_tasks';
  const WT_ADMIN_EMAILS = ['itemkeygithub@gmail.com', 'kravetznikita@gmail.com'];

  const N2A_SUFFIX_FILE = 'db/word_transformation/student_helper_db__noun_to_adj_Suffixes.json';
  const N2A_PREFIX_FILE = 'db/word_transformation/student_helper_db__noun_to_adj_Prefixes.json';

  const wtRuntime = {
    isAdmin: false,
    supa: null,
    source: 'local'
  };

  function idbSupported(){ return typeof indexedDB !== 'undefined'; }
  function dbNameFor(type){ return `${DB_PREFIX}${type}`; }
  function normalize(s){ return (s || '').trim().toLowerCase(); }
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
    if(lc === 'all') return 'All';
    return c;
  }
  function makePairKey(t){
    return `${normalize(t.en_noun)}|${normalize(t.en_adj)}|${normalize(t.type)}|${normalize(normCategory(t.category))}`;
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

    const uniq = new Map();
    for(const row of out) uniq.set(String(row.pairKey || ''), row);
    return Array.from(uniq.values());
  }

  // -----------------------------
  // Rules
  // -----------------------------
  const RULES = {
    Suffixes: {
      title: 'Suffixes (added to the end)',
      chips: ['-ful','-less','-ous','-ive','-able','-ible','-al','-ical','-y','-ic']
    },
    Prefixes: {
      title: '- Negative Prefixes (added to the start)',
      chips: ['in- (general)','il- (before l)','im- (before m, p)','ir- (before r)','mis-']
    }
  };

  const rulePanel = document.getElementById('rulePanel');
  const ruleTitle = document.getElementById('ruleTitle');
  const ruleBody = document.getElementById('ruleBody');

  function renderRule(category){
    const c = normCategory(category);
    ruleBody.innerHTML = '';

    if(c === 'All'){
      ruleTitle.textContent = 'rules';

      const topT = document.createElement('p');
      topT.className = 'ik-sub';
      topT.textContent = RULES.Suffixes.title;
      ruleBody.appendChild(topT);

      const chips1 = document.createElement('div');
      chips1.className = 'ik-chips';
      for(const s of RULES.Suffixes.chips){
        const el = document.createElement('span');
        el.className = 'ik-chip';
        el.textContent = s;
        chips1.appendChild(el);
      }
      ruleBody.appendChild(chips1);

      const div = document.createElement('div');
      div.className = 'ik-divider';
      ruleBody.appendChild(div);

      const botT = document.createElement('p');
      botT.className = 'ik-sub';
      botT.textContent = RULES.Prefixes.title;
      ruleBody.appendChild(botT);

      const chips2 = document.createElement('div');
      chips2.className = 'ik-chips';
      for(const s of RULES.Prefixes.chips){
        const el = document.createElement('span');
        el.className = 'ik-chip';
        el.textContent = s;
        chips2.appendChild(el);
      }
      ruleBody.appendChild(chips2);
      return;
    }

    const def = RULES[c] || RULES.Suffixes;
    ruleTitle.textContent = 'rule';

    const t = document.createElement('p');
    t.className = 'ik-sub';
    t.textContent = def.title;
    ruleBody.appendChild(t);

    const chips = document.createElement('div');
    chips.className = 'ik-chips';
    for(const s of def.chips){
      const el = document.createElement('span');
      el.className = 'ik-chip';
      el.textContent = s;
      chips.appendChild(el);
    }
    ruleBody.appendChild(chips);
  }

  function toggleRule(){
    const open = rulePanel.classList.toggle('is-open');
    rulePanel.setAttribute('aria-hidden', String(!open));
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

    // FIX: noun_to_adj loads BOTH files automatically
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
        const res = await importFromObject(data, { type, replace:false, silent:true, defaultCategory:'Suffixes' });
        okFiles.push(N2A_SUFFIX_FILE);
        added += res.added; skipped += res.skipped;
      }catch(e){
        failFiles.push(N2A_SUFFIX_FILE);
      }

      // prefixes
      try{
        const data = await fetchJson(N2A_PREFIX_FILE);
        const res = await importFromObject(data, { type, replace:false, silent:true, defaultCategory:'Prefixes' });
        okFiles.push(N2A_PREFIX_FILE);
        added += res.added; skipped += res.skipped;
      }catch(e){
        failFiles.push(N2A_PREFIX_FILE);
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
      return 'student_helper_db__noun_to_adj_All.json';
    }
    return `${dbNameFor(type)}.json`;
  }

  async function exportDb(type, category, tasks){
    const payload = {
      schema: 'student_helper_db_export',
      schemaVersion: 1,
      type,
      category: normCategory(category),
      exportedAt: new Date().toISOString(),
      dbName: dbNameFor(type),
      tasks: tasks.map(t => ({
        type: t.type,
        category: normCategory(t.category),
        en_noun: t.en_noun,
        en_adj: t.en_adj,
        ru_noun: t.ru_noun,
        ru_adj: t.ru_adj
      }))
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

  let revealRu = false;
  let sessionTotal = 0;
  let sessionCorrect = 0;

  let history = [];
  let historyPos = -1;
  let seqIndex = -1;

  let checkMode = 'check'; // 'check' | 'next'

  const elDbStatus = document.getElementById('dbStatus');
  const elTaskCount = document.getElementById('taskCountBadge');
  const elSeedBadge = document.getElementById('seedBadge');
  const elDbNameLine = document.getElementById('dbNameLine');
  const elSubtabPractice = document.getElementById('subtab-practice');
  const elSubtabBuilder = document.getElementById('subtab-builder');
  const elPanelPractice = document.getElementById('panel-practice');
  const elPanelBuilder = document.getElementById('panel-builder');

  const elPromptEn = document.getElementById('promptEn');
  const elPromptRu = document.getElementById('promptRu');
  const elPromptLabel = document.getElementById('promptLabel');

  const elAnswer = document.getElementById('answerInput');
  const elScore = document.getElementById('sessionScore');
  const elQ = document.getElementById('qBadge');

  const elFeedbackBox = document.getElementById('feedbackBox');
  const elFeedbackStamp = document.getElementById('feedbackStamp');
  const elFeedbackLine = document.getElementById('feedbackLine');

  const elRandom = document.getElementById('randomOrder');
  const elPracticeCategory = document.getElementById('practiceCategory');

  const elViewCategory = document.getElementById('viewCategory');
  const elAddCategory = document.getElementById('addCategory');

  const elTaskList = document.getElementById('taskList');
  const elImportReplace = document.getElementById('importReplace');
  const elFileImport = document.getElementById('fileImport');

  const btnPrev = document.getElementById('btnPrev');
  const btnNext = document.getElementById('btnNext');
  const btnRule = document.getElementById('btnRule');
  const btnReveal = document.getElementById('btnReveal');
  const btnCheckNext = document.getElementById('btnCheckNext');
  const btnShowAnswer = document.getElementById('btnShowAnswer');

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
      if(elPanelPractice) elPanelPractice.hidden = false;
      if(elSubtabPractice) elSubtabPractice.setAttribute('aria-selected', 'true');
    }
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
  function updateScore(){ elScore.textContent = `${sessionCorrect}/${sessionTotal}`; }
  function updateQ(){ elQ.textContent = `q: ${historyPos >= 0 ? (historyPos + 1) : 0}`; }
  function updateCountBadge(){ elTaskCount.textContent = `tasks: ${tasksAll.length}`; }

  function clearInputState(){ elAnswer.classList.remove('is-ok','is-bad'); }

  function setCheckMode(mode){
    checkMode = mode;
    if(mode === 'next'){
      btnCheckNext.textContent = 'далее';
      btnCheckNext.title = 'Далее (Enter)';
    }else{
      btnCheckNext.textContent = 'check';
      btnCheckNext.title = 'Check (Enter)';
    }
  }

  function resetPracticeSession(){
    history = [];
    historyPos = -1;
    seqIndex = -1;
    updateQ();
    setCheckMode('check');
    clearInputState();
  }

  function promptTextForCategory(cat){
    const c = normCategory(cat);
    if(c === 'Prefixes') return 'Образуй отрицательное прилагательное от данного слова';
    return 'Образуй прилагательное из данного слова';
  }

  function updatePromptLabel(){
    const selected = normCategory(elPracticeCategory.value || 'All');
    if(selected === 'All'){
      const curCat = current ? normCategory(current.category || 'Suffixes') : 'Suffixes';
      elPromptLabel.textContent = promptTextForCategory(curCat);
    }else{
      elPromptLabel.textContent = promptTextForCategory(selected);
    }
  }

  function updateActiveTasks(){
    const cat = normCategory(elPracticeCategory.value || 'All');
    if(cat === 'All') tasksActive = [...tasksAll];
    else tasksActive = tasksAll.filter(t => normCategory(t.category) === cat);

    tasksActive.sort((a,b)=> (a.en_noun || '').localeCompare((b.en_noun || ''), 'en'));

    updatePromptLabel();
    renderRule(cat);
  }

  function showTask(t){
    current = t || null;
    updatePromptLabel();
    revealRu = false;
    if(elPromptRu) elPromptRu.hidden = true;

    clearInputState();
    setCheckMode('check');

    if(!current){
      elPromptEn.textContent = 'нет заданий';
      elAnswer.value = '';
      setFeedback('idle', 'empty', 'добавь задания или load db');
      return;
    }

    elPromptEn.innerHTML = buildAffixHintHTML(current.en_noun, detectAffixHintKind(current.en_noun, current.en_adj, current.category));
    elPromptRu.textContent = `перевод: ${current.ru_noun}`;
    elPromptRu.hidden = true;

    elAnswer.value = '';
    elAnswer.focus({ preventScroll:true });
    setFeedback('idle', 'ready', 'введи ответ и нажми check');
  }

  function pickNewTask(){
    if(!tasksActive.length) return null;
    const random = !!elRandom.checked;
    if(random){
      return tasksActive[Math.floor(Math.random() * tasksActive.length)];
    }
    seqIndex = (seqIndex + 1) % tasksActive.length;
    return tasksActive[seqIndex];
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
      setFeedback('idle', 'type', 'введи ответ');
      pulse(elAnswer, 'ik-shake');
      return;
    }

    sessionTotal += 1;

    if(user === correct){
      sessionCorrect += 1;
      updateScore();
      setFeedback('correct', 'ok', `${current.en_noun} -> ${current.en_adj}`);
      clearInputState();
      elAnswer.classList.add('is-ok');
      setCheckMode('next');
    }else{
      updateScore();
      setFeedback('wrong', 'no', 'неверно');
      clearInputState();
      elAnswer.classList.add('is-bad');
      elAnswer.focus({ preventScroll:true });
      elAnswer.select();
      setCheckMode('check');
    }
  }

  function showAnswer(){
    if(!current) return;
    setFeedback('idle', 'answer', `${current.en_adj} | ${current.ru_adj}`);
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
    const list = (view === 'All') ? tasksAll : tasksAll.filter(t => normCategory(t.category) === view);

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

      updateActiveTasks();
      updateScore();
      updateQ();
      goNext();

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
  btnRule.addEventListener('click', toggleRule);
  btnPrev.addEventListener('click', goPrev);
  btnNext.addEventListener('click', goNext);
  btnReveal.addEventListener('click', toggleTranslate);
  btnCheckNext.addEventListener('click', checkOrNext);
  btnShowAnswer.addEventListener('click', showAnswer);

  elAnswer.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){
      e.preventDefault();
      checkOrNext();
    }
  });

  document.addEventListener('keydown', (e)=>{
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    const inText = tag === 'input' || tag === 'textarea';
if(e.key.toLowerCase() === 't'){ if(inText) return; toggleTranslate(); return; }
    if(e.key.toLowerCase() === 'r'){ if(inText) return; toggleRule(); return; }
  });

  elPracticeCategory.addEventListener('change', ()=>{
    updateActiveTasks();
    resetPracticeSession();
    goNext();
  });

  elViewCategory.addEventListener('change', renderTaskList);

  document.getElementById('btnAddTask').addEventListener('click', async ()=>{
    if(!wtRuntime.isAdmin){
      setFeedback('idle', 'read-only', 'конструктор доступен только администратору');
      return;
    }
    const cat = normCategory(elAddCategory.value || 'Suffixes');

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

      const s = await fetchJson(N2A_SUFFIX_FILE);
      await importFromObject(s, { type:'noun_to_adj', replace:false, silent:true, defaultCategory:'Suffixes' });

      const p = await fetchJson(N2A_PREFIX_FILE);
      await importFromObject(p, { type:'noun_to_adj', replace:false, silent:true, defaultCategory:'Prefixes' });

      await refreshTasks();
      updateActiveTasks();
      resetPracticeSession();
      goNext();

      setAdminText(elSeedBadge, 'json: loaded');
      elSeedBadge.title = `${N2A_SUFFIX_FILE}, ${N2A_PREFIX_FILE}`;
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
    const list = (view === 'All') ? tasksAll : tasksAll.filter(t => normCategory(t.category) === view);
    await exportDb('noun_to_adj', view, list);
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
      setFeedback('idle', 'import', 'ok');
    }catch(e){
      alert(`Ошибка импорта: ${e.message || e}`);
    }
  });

  // -----------------------------

// expose + auto-boot
window.wtBoot = boot;
boot();
