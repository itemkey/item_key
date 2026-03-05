// Dictionary (sections + words)
  // -----------------------------
  const DICT_DB_VERSION = 1;
  const DICT_STORE_SECTIONS = 'sections';
  const DICT_STORE_WORDS = 'words';
  const DICT_REASK_GAP = 3;

  function dictDbName(){ return dbNameFor('dictionary'); }

  function normSpaces(s){ return String(s || '').trim().replace(/\s+/g, ' '); }
  function normEnCmp(s){ return normSpaces(s).toLowerCase(); }
  function normRuCmp(s){ return normSpaces(s).toLowerCase().replaceAll('ё', 'е'); }
  function stripParenMeta(s){
    return String(s || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function normEnLoose(s){
    // for practice compare (EN answers)
    let t = stripParenMeta(normSpaces(s).toLowerCase());
    t = t.replace(/[.,!?;:]+$/g, '').trim();
    t = t.replace(/[“”„"]/g, '"').replace(/[’‘]/g, "'");
    t = t.replace(/[-\u2013\u2014]/g, '-');
    t = t.replace(/\s+/g, ' ').trim();
    return t;
  }

  function normRuLoose(s){
    return stripParenMeta(normRuCmp(s))
      .replace(/[.,!?;:()"'«»\[\]{}<>]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function splitVariants(raw, lang){
    const base = String(raw || '').trim();
    if(!base) return [];
    const sep = lang === 'ru'
      ? /(?:\n|;|\/|\s+или\s+|,)/i
      : /(?:\n|;|\/|\s+or\s+|,)/i;
    return base.split(sep).map(x=> String(x||'').trim()).filter(Boolean);
  }

  function ruVariants(ru){
    const out = [];
    for(const p of splitVariants(ru, 'ru')){
      const v = normRuLoose(p);
      if(v) out.push(v);
    }
    const whole = normRuLoose(ru);
    if(whole) out.push(whole);
    return Array.from(new Set(out));
  }

  function enVariants(en, cfg){
    const out = [];
    for(const p of splitVariants(en, 'en')){
      let v = normEnLoose(p);
      if(!v) continue;
      out.push(v);

      if(cfg && cfg.ignoreTo){
        if(v.startsWith('to ')) out.push(v.replace(/^to\s+/, '').trim());
      }
      if(cfg && cfg.ignoreArticles){
        out.push(v.replace(/^(a|an|the)\s+/, '').trim());
      }
    }
    const whole = normEnLoose(en);
    if(whole) out.push(whole);
    
    // optional: accept simple EN forms (for learn)
    if(cfg && cfg.acceptForms){
      const raw = stripParenMeta(normSpaces(en).toLowerCase());
      let lemma = raw;
      if(cfg.ignoreTo && lemma.startsWith('to ')) lemma = lemma.replace(/^to\s+/, '').trim();
      lemma = lemma.replace(/^(a|an|the)\s+/, '').trim();

      const mpos = String(en || '').toLowerCase().match(/\((v|n|adj)\)/);
      const pos = mpos ? mpos[1] : '';

      const add = (s)=>{ const v = normEnLoose(s); if(v) out.push(v); };

      if(pos === 'v' && lemma){
        // very simple verb forms (regular)
        add(lemma + 's');
        add(lemma + 'ed');
        add(lemma + 'ing');

        // y -> ies/ied (try)
        if(lemma.endsWith('y') && lemma.length>2 && !'aeiou'.includes(lemma[lemma.length-2])){
          add(lemma.slice(0,-1) + 'ies');
          add(lemma.slice(0,-1) + 'ied');
        }
        // e -> ed/ing
        if(lemma.endsWith('e') && lemma.length>2){
          add(lemma + 'd');
          add(lemma.slice(0,-1) + 'ing');
        }
      }else if(pos === 'n' && lemma){
        // simple plural
        add(lemma + 's');
        if(/[sxz]$/.test(lemma) || /ch$/.test(lemma) || /sh$/.test(lemma)) add(lemma + 'es');
        if(lemma.endsWith('y') && lemma.length>2 && !'aeiou'.includes(lemma[lemma.length-2])){
          add(lemma.slice(0,-1) + 'ies');
        }
      }else if(pos === 'adj' && lemma){
        add(lemma + 'er');
        add(lemma + 'est');
      }
    }

    return Array.from(new Set(out.filter(Boolean)));

  }

  function userTokens(raw, lang, cfg){
    const tokens = splitVariants(raw, lang);
    if(!tokens.length) return [];
    if(lang === 'ru') return tokens.map(normRuLoose).filter(Boolean);

    return tokens.map(t=>{
      let v = normEnLoose(t);
      if(cfg && cfg.ignoreTo) v = v.replace(/^to\s+/, '').trim();
      if(cfg && cfg.ignoreArticles) v = v.replace(/^(a|an|the)\s+/, '').trim();
      return v;
    }).filter(Boolean);
  }

  function levenshtein(a,b){
    const s = String(a||''); const t = String(b||'');
    const n = s.length; const m = t.length;
    if(n === 0) return m;
    if(m === 0) return n;
    const dp = new Array(m+1);
    for(let j=0;j<=m;j++) dp[j]=j;
    for(let i=1;i<=n;i++){
      let prev = dp[0];
      dp[0]=i;
      for(let j=1;j<=m;j++){
        const tmp = dp[j];
        const cost = s[i-1] === t[j-1] ? 0 : 1;
        dp[j] = Math.min(dp[j] + 1, dp[j-1] + 1, prev + cost);
        prev = tmp;
      }
    }
    return dp[m];
  }

  function typoThreshold(str){
    const x = String(str||'').replace(/\s+/g,'');
    const L = x.length;
    if(L <= 4) return 0;
    if(L <= 6) return 1;
    if(L <= 10) return 2;
    return 3;
  }

  function shuffle(arr){
    const a = [...arr];
    for(let i = a.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

// -----------------------------
// Multiple Choice (MCQ) helpers
// -----------------------------
const MCQ_CONFUSIONS_KEY = 'student_helper_dict_confusions_v1';

let mcqPosBagQuiz = [];
let mcqPosBagLearn = [];

function extractPos(raw){
  const m = String(raw || '').toLowerCase().match(/\((v|n|adj|adv)\)/);
  return m ? m[1] : '';
}
function mcqWordCount(s){
  return String(s || '').trim().split(/\s+/).filter(Boolean).length;
}
function mcqDisplayEn(raw){
  let t = stripParenMeta(normSpaces(raw));
  t = t.replace(/^to\s+/i, '').trim();
  t = t.replace(/^(a|an|the)\s+/i, '').trim();
  return t;
}
function mcqDisplayRu(raw){
  return stripParenMeta(String(raw || '').trim());
}
function mcqNormForLang(s, lang){
  return (lang === 'ru') ? normRuLoose(s) : normEnLoose(s);
}
function mcqPreferWholeDisplay(raw){
  const t = normSpaces(raw);
  return /\S\/\S/.test(t) && /\s/.test(t);
}
function mcqCanonical(item, answerLang){
  const rawAll = answerLang === 'en' ? (item && item.en) : (item && item.ru);
  const parts = splitVariants(rawAll, answerLang === 'en' ? 'en' : 'ru');
  const first = (parts && parts.length) ? parts[0] : (rawAll || '');
  const source = mcqPreferWholeDisplay(rawAll) ? (rawAll || first) : first;
  const pos = extractPos(first) || extractPos(rawAll);
  const display = (answerLang === 'en') ? mcqDisplayEn(source) : mcqDisplayRu(source);
  const norm = mcqNormForLang(display, answerLang === 'en' ? 'en' : 'ru');
  return { raw:source, display, norm, pos, wc: mcqWordCount(display) };
}
function mcqAllAcceptedNorms(item, answerLang, cfg){
  if(answerLang === 'en'){
    const vars = enVariants(item && item.en, cfg);
    // enVariants are already normalized to normEnLoose
    return new Set(vars || []);
  }
  const vars = ruVariants(item && item.ru);
  return new Set(vars || []);
}

function mcqLoadConfusions(){
  const raw = localStorage.getItem(MCQ_CONFUSIONS_KEY);
  return safeJsonParse(raw, {}) || {};
}
function mcqSaveConfusions(obj){
  try{ localStorage.setItem(MCQ_CONFUSIONS_KEY, JSON.stringify(obj || {})); }catch(_){}
}
function mcqBumpConfusion(item, askLang, chosenNorm, correctNorm){
  // store only when user selected a wrong option
  if(!item) return;
  if(!chosenNorm || chosenNorm === correctNorm) return;
  const key = practiceKey(item);
  if(!key) return;
  const dir = (askLang === 'en') ? 'en2ru' : 'ru2en';
  const all = mcqLoadConfusions();
  if(!all[dir]) all[dir] = {};
  if(!all[dir][key]) all[dir][key] = {};
  if(!all[dir][key][chosenNorm]) all[dir][key][chosenNorm] = 0;
  all[dir][key][chosenNorm] += 1;
  mcqSaveConfusions(all);
}
function mcqTopConfusions(item, askLang, limit){
  const key = practiceKey(item);
  if(!key) return [];
  const dir = (askLang === 'en') ? 'en2ru' : 'ru2en';
  const all = mcqLoadConfusions();
  const map = (all && all[dir] && all[dir][key]) ? all[dir][key] : null;
  if(!map) return [];
  const arr = Object.entries(map).sort((a,b)=> (b[1]||0) - (a[1]||0));
  return arr.slice(0, Math.max(0, limit||0)).map(x=> x[0]);
}

function mcqPickPos(bag, n){
  const k = Math.max(2, Math.min(8, Number(n) || 4));
  if(!Array.isArray(bag) || !bag.length){
    const fresh = [];
    for(let i=0;i<k;i++) fresh.push(i);
    // shuffle bag
    for(let i=fresh.length-1;i>0;i--){
      const j = Math.floor(Math.random() * (i+1));
      [fresh[i], fresh[j]] = [fresh[j], fresh[i]];
    }
    bag.splice(0, bag.length, ...fresh);
  }
  const x = bag.shift();
  return (x >= 0 && x < k) ? x : Math.floor(Math.random() * k);
}

function mcqBuildOptions(targetItem, askLang, answerLang, count, itemsPool, cfg){
  const n = Math.max(2, Math.min(8, Number(count) || 4));
  const correct = mcqCanonical(targetItem, answerLang);
  const excluded = mcqAllAcceptedNorms(targetItem, answerLang, cfg);
  if(correct && correct.norm) excluded.add(correct.norm);

  const preferNorms = mcqTopConfusions(targetItem, askLang, Math.max(2, n));
  const wantDistr = n - 1;

  const candidates = [];
  for(const it of (itemsPool || [])){
    if(!it) continue;
    // skip same word
    if(targetItem && it.id != null && targetItem.id != null && String(it.id) === String(targetItem.id)) continue;
    const c = mcqCanonical(it, answerLang);
    if(!c || !c.norm) continue;
    if(excluded.has(c.norm)) continue;
    candidates.push(c);
  }

  // de-dup candidates by norm
  const seen = new Set();
  const uniq = [];
  for(const c of candidates){
    if(seen.has(c.norm)) continue;
    seen.add(c.norm);
    uniq.push(c);
  }

  // phrase preference
  const targetWc = correct.wc || 1;
  const preferPhrase = targetWc > 1;
  const samePos = correct.pos ? uniq.filter(x => x.pos && x.pos === correct.pos) : [];
  const anyPos = uniq.slice();

  const pickFrom = (pool, need)=>{
    const out = [];
    const bag = pool.slice();
    while(out.length < need && bag.length){
      const idx = Math.floor(Math.random() * bag.length);
      out.push(bag[idx]);
      bag.splice(idx, 1);
    }
    return out;
  };

  const chosen = [];
  const pushIf = (cand)=>{
    if(!cand || !cand.norm) return;
    if(chosen.find(x => x.norm === cand.norm)) return;
    chosen.push(cand);
  };

  // 1) add top confusions if present in pools
  for(const norm of preferNorms){
    const hit = uniq.find(x => x.norm === norm);
    if(hit) pushIf(hit);
    if(chosen.length >= wantDistr) break;
  }

  // 2) prefer same POS and similar phrase-ness
  if(chosen.length < wantDistr){
    let pool = samePos.length ? samePos : anyPos;
    if(preferPhrase){
      const ph = pool.filter(x => (x.wc||1) > 1);
      if(ph.length >= Math.min(2, wantDistr)) pool = ph;
    }
    const rest = pickFrom(pool.filter(x => !chosen.find(y=>y.norm===x.norm)), wantDistr - chosen.length);
    for(const r of rest) pushIf(r);
  }

  // 3) fill from any
  if(chosen.length < wantDistr){
    const rest = pickFrom(anyPos.filter(x => !chosen.find(y=>y.norm===x.norm)), wantDistr - chosen.length);
    for(const r of rest) pushIf(r);
  }

  // final options without revealing order
  const opts = new Array(n).fill(null);
  return { correct, distractors: chosen.slice(0, wantDistr), n, opts };
}

  function dictOpenDB(){
    return new Promise((resolve, reject) => {
      if(!idbSupported()){
        reject(new Error('IndexedDB not supported'));
        return;
      }
      const req = indexedDB.open(dictDbName(), DICT_DB_VERSION);

      req.onupgradeneeded = () => {
        const dbx = req.result;

        if(!dbx.objectStoreNames.contains(DICT_STORE_SECTIONS)){
          const s = dbx.createObjectStore(DICT_STORE_SECTIONS, { keyPath:'id', autoIncrement:true });
          s.createIndex('nameKey', 'nameKey', { unique:true });
        }
        if(!dbx.objectStoreNames.contains(DICT_STORE_WORDS)){
          const w = dbx.createObjectStore(DICT_STORE_WORDS, { keyPath:'id', autoIncrement:true });
          w.createIndex('sectionId', 'sectionId', { unique:false });
          w.createIndex('pairKey', 'pairKey', { unique:true });
        }

        // Backfill keys for older data (if any)
        const txu = req.transaction;
        try{
          const sStore = txu.objectStore(DICT_STORE_SECTIONS);
          if(!sStore.indexNames.contains('nameKey')) sStore.createIndex('nameKey', 'nameKey', { unique:true });
          const curS = sStore.openCursor();
          curS.onsuccess = (e) => {
            const c = e.target.result;
            if(!c) return;
            const v = c.value || {};
            if(!v.nameKey) v.nameKey = normalize(v.name || '');
            c.update(v);
            c.continue();
          };
        }catch(_){/* ignore */}

        try{
          const wStore = txu.objectStore(DICT_STORE_WORDS);
          if(!wStore.indexNames.contains('sectionId')) wStore.createIndex('sectionId', 'sectionId', { unique:false });
          if(!wStore.indexNames.contains('pairKey')) wStore.createIndex('pairKey', 'pairKey', { unique:true });
          const curW = wStore.openCursor();
          curW.onsuccess = (e) => {
            const c = e.target.result;
            if(!c) return;
            const v = c.value || {};
            v.sectionId = Number(v.sectionId || 0);
            v.en = normSpaces(v.en || '');
            v.ru = String(v.ru || '').trim();
            v.enKey = v.enKey || normEnCmp(v.en);
            v.ruKey = v.ruKey || normRuCmp(v.ru);
            v.pairKey = v.pairKey || `${v.sectionId}|${v.enKey}|${v.ruKey}`;
            c.update(v);
            c.continue();
          };
        }catch(_){/* ignore */}
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Failed to open dict db'));
    });
  }

  function dictGetAll(dbx, store){
    return new Promise((resolve, reject) => {
      const t = dbx.transaction([store], 'readonly');
      const os = t.objectStore(store);
      const req = os.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error || new Error('Failed to getAll'));
    });
  }
  function dictCount(dbx, store){
    return new Promise((resolve, reject) => {
      const t = dbx.transaction([store], 'readonly');
      const os = t.objectStore(store);
      const req = os.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => reject(req.error || new Error('Failed to count'));
    });
  }
  function dictClear(dbx){
    return new Promise((resolve, reject) => {
      const t = dbx.transaction([DICT_STORE_WORDS, DICT_STORE_SECTIONS], 'readwrite');
      t.objectStore(DICT_STORE_WORDS).clear();
      t.objectStore(DICT_STORE_SECTIONS).clear();
      t.oncomplete = () => resolve(true);
      t.onerror = () => reject(t.error || new Error('Failed to clear dict db'));
    });
  }

  function dictAddSection(dbx, name){
    const n = String(name || '').trim();
    if(!n) return Promise.resolve({ ok:false, reason:'empty' });
    const payload = { name:n, nameKey: normalize(n), createdAt: Date.now(), updatedAt: Date.now() };

    return new Promise((resolve, reject) => {
      const t = dbx.transaction([DICT_STORE_SECTIONS], 'readwrite');
      const os = t.objectStore(DICT_STORE_SECTIONS);
      const req = os.add(payload);
      req.onsuccess = () => resolve({ ok:true, id:req.result });
      req.onerror = () => {
        const err = req.error;
        if(err && err.name === 'ConstraintError'){
          resolve({ ok:false, reason:'duplicate' });
          return;
        }
        reject(err || new Error('Failed to add section'));
      };
    });
  }

  function dictAddWord(dbx, sectionId, en, ru){
    const sid = Number(sectionId || 0);
    const enS = normSpaces(en);
    const ruS = String(ru || '').trim();
    if(!sid || !enS || !ruS) return Promise.resolve({ ok:false, reason:'empty' });

    const payload = {
      sectionId: sid,
      en: enS,
      enKey: normEnCmp(enS),
      ru: ruS,
      ruKey: normRuCmp(ruS),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    payload.pairKey = `${payload.sectionId}|${payload.enKey}|${payload.ruKey}`;

    return new Promise((resolve, reject) => {
      const t = dbx.transaction([DICT_STORE_WORDS], 'readwrite');
      const os = t.objectStore(DICT_STORE_WORDS);
      const req = os.add(payload);
      req.onsuccess = () => resolve({ ok:true, id:req.result });
      req.onerror = () => {
        const err = req.error;
        if(err && err.name === 'ConstraintError'){
          resolve({ ok:false, reason:'duplicate' });
          return;
        }
        reject(err || new Error('Failed to add word'));
      };
    });
  }

  function dictDeleteWord(dbx, id){
    return new Promise((resolve, reject) => {
      const t = dbx.transaction([DICT_STORE_WORDS], 'readwrite');
      const os = t.objectStore(DICT_STORE_WORDS);
      const req = os.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error || new Error('Failed to delete word'));
    });
  }

  function dictDeleteSection(dbx, sectionId){
    const sid = Number(sectionId || 0);
    return new Promise((resolve, reject) => {
      const t = dbx.transaction([DICT_STORE_SECTIONS, DICT_STORE_WORDS], 'readwrite');
      const sStore = t.objectStore(DICT_STORE_SECTIONS);
      const wStore = t.objectStore(DICT_STORE_WORDS);

      try{
        const idx = wStore.index('sectionId');
        const cur = idx.openCursor(IDBKeyRange.only(sid));
        cur.onsuccess = (e) => {
          const c = e.target.result;
          if(!c) return;
          c.delete();
          c.continue();
        };
      }catch(_){/* ignore */}

      sStore.delete(sid);

      t.oncomplete = () => resolve(true);
      t.onerror = () => reject(t.error || new Error('Failed to delete section'));
    });
  }

const DICT_DIR = 'db/dictionary/';
const DICT_MANIFESTS = ['db/manifest.json', `${DICT_DIR}manifest.json`];
const DICT_FILE_PREFIX = 'student_helper_db__dictionary_';
  const DICT_DEFAULT_FILES = [
    `${DICT_FILE_PREFIX}Destination_B1_Unit_3.json`,
    `${DICT_FILE_PREFIX}Destination_B1_Unit_6.json`,
  ];

function _uniq(list){
  const out = [];
  const set = new Set();
  for(const x of list){
    if(!x || set.has(x)) continue;
    set.add(x);
    out.push(x);
  }
  return out;
}

function _guessSiteRoots(){
  const roots = [];
  const origin = window.location && window.location.origin ? window.location.origin : '';
  const path = window.location && window.location.pathname ? window.location.pathname : '/';
  const baseDir = String(path || '/').replace(/[^/]*$/, '');

  if(origin){
    roots.push(origin + '/');
    if(baseDir) roots.push(origin + baseDir);
    const parts = String(path || '').split('/').filter(Boolean);
    const repoIdx = parts.indexOf('item_key');
    if(repoIdx >= 0){
      const repoPath = '/' + parts.slice(0, repoIdx + 1).join('/') + '/';
      roots.push(origin + repoPath);
    }
  }

  return _uniq(roots);
}

function _buildUrlCandidates(relPath){
  const cleaned = String(relPath || '').trim().replace(/^\.\//, '');
  const out = [];
  try{ out.push(new URL(cleaned, document.baseURI).href); }catch(_){ }
  for(const root of _guessSiteRoots()){
    try{ out.push(new URL(cleaned, root).href); }catch(_){ }
  }
  return _uniq(out);
}

async function fetchJson(relPath){
  const urls = _buildUrlCandidates(relPath);
  let lastErr = null;
  for(const url of urls){
    try{
      const res = await fetch(url, { cache: 'no-store' });
      if(!res.ok){
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      return await res.json();
    }catch(e){
      lastErr = e;
    }
  }
  const tried = urls.slice(0, 6).join(' | ');
  throw new Error(`JSON fetch failed: ${relPath}. tried: ${tried}. ${lastErr && (lastErr.message || lastErr)}`);
}

if(window.IKAdminLog) window.IKAdminLog('log', 'student_helper', 'dict: script loaded');

function dictSlug(name){
  return String(name || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function dictFilenameForSection(sectionName){
  const slug = dictSlug(sectionName) || 'section';
  return `${DICT_FILE_PREFIX}${slug}.json`;
}

  
  // Dict app state
  let dictDb = null;
  let dictSections = [];
  let dictWordsAll = [];
  let dictCounts = new Map();

  // Source:
  // - personal: user's own dictionaries (non-rated)
  // - system: site dictionaries (rated)
  // - user: published user dictionaries (rated)
  let dictSource = 'personal';
  let dictPersonalGuest = false;
  const DICT_ADMIN_EMAILS = ['itemkeygithub@gmail.com', 'kravetznikita@gmail.com'];
  const dictRuntime = {
    isAdmin: false,
    refreshingAdmin: false
  };
  let publicCatalog = { system: [], user: [] };
  let publicCounts = { system: new Map(), user: new Map() };
  let publicWordsCache = { system: new Map(), user: new Map() }; // dictId -> words[]
  let publicLoadedDictId = null;
  let publicTempWordId = -1;
  const STOCK_SECTION_KEYS = new Set([
    normalize('Destination B1 Unit 3'),
    normalize('Destination B1 Unit 6'),
    normalize('Destination B1 Unit 12'),
    normalize('destination B1 unit 9 vocabulary'),
    normalize('189page')
  ]);

  // Cards state
  let cardsDeck = [];
  let cardsHistory = [];
  let cardsPos = -1;
  let cardsSeq = -1;

  
  let cardsSeen = new Set();
// Quiz state
  let quizDeck = [];
  let quizQueue = [];
  let quizCurrent = null;
  let quizAskLang = 'en';
  let quizCheckMode = 'check';
  let quizTotal = 0;
  let quizCorrect = 0;
  let quizRewarded = false;

  
  let quizSeen = new Set();
  // MCQ runtime state (practice)
  let quizTaskKind = 'input'; // input | mcq
  let quizMcqState = null; // { options, correctIdx, selectedIdx, locked, askLang, answerLang }
  let quizModeOverrides = {}; // practiceKey -> 'input' | 'mcq' for next appearance


  // Practice (active recall) persistence
  const PRACTICE_CFG_KEY = 'student_helper_dict_practice_cfg_v1';
  const PRACTICE_STATS_KEY = 'student_helper_dict_practice_stats_v1';

  let practiceCfg = null;
  let practiceStats = null; // object map
  let quizSessionTarget = 0;

  let practiceHintLevel = 0;
  let practiceHintUsed = false;
  let practicePendingFuzzy = null;

  function safeJsonParse(s, fb){
    try{ return JSON.parse(s); }catch(_){ return fb; }
  }
  function loadPracticeCfg(){
    const def = {
      session:'20',
      typos:true,
      ignoreTo:true,
      ignoreArticles:true,
      taskMode:'mix', // input | mcq | mix
      mixInputPct:60, // for mix
      mcqCount:4,
      showPos:false,
      softMcq:true
    };
    const raw = localStorage.getItem(PRACTICE_CFG_KEY);
    const cfg = safeJsonParse(raw, def) || def;
    cfg.session = String(cfg.session || def.session);
    cfg.typos = cfg.typos !== false;
    cfg.ignoreTo = cfg.ignoreTo !== false;
    cfg.ignoreArticles = cfg.ignoreArticles !== false;

    cfg.taskMode = String(cfg.taskMode || def.taskMode);
    if(!['input','mcq','mix'].includes(cfg.taskMode)) cfg.taskMode = def.taskMode;

    const mp = Number(cfg.mixInputPct);
    cfg.mixInputPct = Number.isFinite(mp) ? Math.max(0, Math.min(100, Math.round(mp))) : def.mixInputPct;

    const mc = Number(cfg.mcqCount);
    cfg.mcqCount = Number.isFinite(mc) ? Math.max(2, Math.min(8, Math.round(mc))) : def.mcqCount;

    cfg.showPos = !!cfg.showPos;
    cfg.softMcq = cfg.softMcq !== false;

    practiceCfg = cfg;
    return cfg;
  }
  function savePracticeCfg(cfg){
    practiceCfg = cfg;
    try{ localStorage.setItem(PRACTICE_CFG_KEY, JSON.stringify(cfg)); }catch(_){}
  }
  function cfgFromUI(){
    const base = loadPracticeCfg();
    if(elPracticeSession) base.session = String(elPracticeSession.value || base.session);
    if(elPracticeTypos) base.typos = !!elPracticeTypos.checked;
    if(elPracticeIgnoreTo) base.ignoreTo = !!elPracticeIgnoreTo.checked;
    if(elPracticeIgnoreArticles) base.ignoreArticles = !!elPracticeIgnoreArticles.checked;

    if(typeof elPracticeTaskMode !== 'undefined' && elPracticeTaskMode) base.taskMode = String(elPracticeTaskMode.value || base.taskMode);
    if(typeof elPracticeMixInputPct !== 'undefined' && elPracticeMixInputPct) base.mixInputPct = Number(elPracticeMixInputPct.value || base.mixInputPct);
    if(typeof elPracticeMcqCount !== 'undefined' && elPracticeMcqCount) base.mcqCount = Number(elPracticeMcqCount.value || base.mcqCount);
    if(typeof elPracticeShowPos !== 'undefined' && elPracticeShowPos) base.showPos = !!elPracticeShowPos.checked;
    if(typeof elPracticeSoftMcq !== 'undefined' && elPracticeSoftMcq) base.softMcq = !!elPracticeSoftMcq.checked;

    return base;
  }
  function applyCfgToUI(cfg){
    if(!cfg) return;
    if(elPracticeSession) elPracticeSession.value = String(cfg.session || '20');
    if(elPracticeTypos) elPracticeTypos.checked = !!cfg.typos;
    if(elPracticeIgnoreTo) elPracticeIgnoreTo.checked = !!cfg.ignoreTo;
    if(elPracticeIgnoreArticles) elPracticeIgnoreArticles.checked = !!cfg.ignoreArticles;

    if(typeof elPracticeTaskMode !== 'undefined' && elPracticeTaskMode) elPracticeTaskMode.value = String(cfg.taskMode || 'mix');
    if(typeof elPracticeMixInputPct !== 'undefined' && elPracticeMixInputPct) elPracticeMixInputPct.value = String(cfg.mixInputPct != null ? cfg.mixInputPct : 60);
    if(typeof elPracticeMcqCount !== 'undefined' && elPracticeMcqCount) elPracticeMcqCount.value = String(cfg.mcqCount != null ? cfg.mcqCount : 4);
    if(typeof elPracticeShowPos !== 'undefined' && elPracticeShowPos) elPracticeShowPos.checked = !!cfg.showPos;
    if(typeof elPracticeSoftMcq !== 'undefined' && elPracticeSoftMcq) elPracticeSoftMcq.checked = !!cfg.softMcq;
  }

  function loadPracticeStats(){
    const raw = localStorage.getItem(PRACTICE_STATS_KEY);
    const st = safeJsonParse(raw, {}) || {};
    practiceStats = st;
    return st;
  }
  function savePracticeStats(){
    try{ localStorage.setItem(PRACTICE_STATS_KEY, JSON.stringify(practiceStats || {})); }catch(_){}
  }
  function practiceKey(item){
    if(!item) return '';
    const enK = normEnCmp(stripParenMeta(item.en || ''));
    const ruK = normRuCmp(stripParenMeta(item.ru || ''));
    return `${dictSource}:${item.sectionId}|${enK}|${ruK}`;
  }
  function practiceGetStat(item){
    const key = practiceKey(item);
    if(!key) return null;
    if(!practiceStats) loadPracticeStats();
    if(!practiceStats[key]){
      practiceStats[key] = {
        en2ru:{ c:0, w:0, h:0 },
        ru2en:{ c:0, w:0, h:0 }
      };
    }
    return practiceStats[key];
  }
  function practiceBump(item, askLang, outcome){
    // askLang: 'en' => EN->RU, 'ru' => RU->EN
    const st = practiceGetStat(item);
    if(!st) return;
    const k = askLang === 'en' ? 'en2ru' : 'ru2en';
    if(outcome === 'correct') st[k].c += 1;
    else if(outcome === 'hard') st[k].h += 1;
    else st[k].w += 1;
    savePracticeStats();
  }


  // -----------------------------
  // Learn (spaced + recall)
  // -----------------------------
  const LEARN_CFG_KEY = 'student_helper_dict_learn_cfg_v1';
  const LEARN_BATCHES_KEY = 'student_helper_dict_learn_batches_v1';

  let learnCfg = null;

  let learnSession = null; // { items, queue, idx, doneTests, portion, learnedCount, mode }
  let learnCurrent = null; // current task
  let learnCheckMode = 'check'; // 'check' | 'next'
  let learnAskLang = 'ru'; // ask on RU by default (RU->EN)
  let learnHintLevel = 0;
  let learnHintUsed = false;
  let learnTaskCounter = 0;

  // MCQ runtime state (learn intro)
  let learnMcqState = null; // { options, correctIdx, selectedIdx, locked, askLang, answerLang, item }
 // counts answered test tasks

  const LEARN_SRS_FAST = [1,2,4,7];
  const LEARN_SRS_LONG = [1,3,7,14,30];

  function ruNoun(n, one, few, many){
    const x = Math.abs(Number(n) || 0);
    const mod10 = x % 10;
    const mod100 = x % 100;
    if(mod10 === 1 && mod100 !== 11) return one;
    if(mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
    return many;
  }

  function learnLoadBatches(){
    const raw = localStorage.getItem(LEARN_BATCHES_KEY);
    return safeJsonParse(raw, {}) || {};
  }
  function learnSaveBatches(b){
    try{ localStorage.setItem(LEARN_BATCHES_KEY, JSON.stringify(b || {})); }catch(_){ }
  }
  function learnBatchKey(sectionId, source){
    return `${String(sectionId||'').trim()}|${String(source||'').trim()}`;
  }
  function learnSyncBatch(batch, keysNow){
    const nowSet = new Set(keysNow);
    let order = Array.isArray(batch && batch.order)
      ? batch.order.filter(k => nowSet.has(k))
      : [];

    const has = new Set(order);
    for(const k of keysNow){
      if(!has.has(k)) order.push(k);
    }
    if(!order.length) order = shuffle(keysNow);

    let idx = Number(batch && batch.idx);
    if(!Number.isFinite(idx)) idx = 0;
    idx = Math.max(0, Math.min(idx, order.length));

    return { order, idx };
  }
  function learnBatchPeek(sectionId, source, items){
    const keysNow = items.map(practiceKey);
    const store = learnLoadBatches();
    const key = learnBatchKey(sectionId, source);
    const synced = learnSyncBatch(store[key] || {}, keysNow);
    store[key] = synced;
    learnSaveBatches(store);
    return {
      remaining: Math.max(0, synced.order.length - synced.idx),
      total: synced.order.length,
      idx: synced.idx
    };
  }
  function learnBatchTake(sectionId, source, items, want){
    const keysNow = items.map(practiceKey);
    const store = learnLoadBatches();
    const key = learnBatchKey(sectionId, source);
    let batch = learnSyncBatch(store[key] || {}, keysNow);

    // start a new cycle when finished
    if(batch.idx >= batch.order.length){
      batch.order = shuffle(batch.order.slice());
      batch.idx = 0;
    }

    const sliceKeys = batch.order.slice(batch.idx, batch.idx + want);
    batch.idx += sliceKeys.length;
    store[key] = batch;
    learnSaveBatches(store);

    const byKey = new Map(items.map(it => [practiceKey(it), it]));
    const picked = sliceKeys.map(k => byKey.get(k)).filter(Boolean);

    return {
      picked,
      remaining: Math.max(0, batch.order.length - batch.idx),
      total: batch.order.length
    };
  }

  function learnCountCandidates(items, cfg, sectionId){
    const now = Date.now();
    if(cfg.source === 'all'){
      const peek = learnBatchPeek(sectionId, 'all', items);
      return peek.remaining;
    }
    let cnt = 0;
    for(const it of items){
      const st = practiceGetStat(it) || {};
      const srs = st.srs || null;
      if(cfg.source === 'new'){
        if(!srs || srs.step === undefined) cnt += 1;
      }else if(cfg.source === 'due'){
        if(srs && Number(srs.due || 0) > 0 && Number(srs.due) <= now) cnt += 1;
      }else{
        cnt += 1;
      }
    }
    return cnt;
  }

  function learnRenderIdleNext(sectionId, cfg){
    // show a helpful message on the big card when we're idle (e.g. after finishing a portion)
    if(!elLearnFront || !elLearnBack) return;

    const portionSetting = Math.max(1, Number(cfg.portion || 8) || 8);
    const sid = String(sectionId || '').trim();
    if(!sid){
      elLearnFront.textContent = 'выбери section';
      elLearnBack.textContent = 'нажми start';
      return;
    }

    const all = wordsForSelection(sid);
    if(!all.length){
      elLearnFront.textContent = 'нет слов';
      elLearnBack.textContent = 'добавь в constructor';
      return;
    }

    const remain = learnCountCandidates(all, cfg, sid);
    const nextN = Math.min(portionSetting, remain);
    if(remain <= 0){
      if(cfg.source === 'new'){
        elLearnFront.textContent = 'новых слов нет';
        elLearnBack.textContent = 'выбери другой источник';
      }else if(cfg.source === 'all'){
        elLearnFront.textContent = 'раздел пройден';
        elLearnBack.textContent = `нажми start (повтор ${portionSetting})`;
      }else{
        elLearnFront.textContent = 'нет слов для этого источника';
        elLearnBack.textContent = 'измени настройки';
      }
    }else{
      const w = ruNoun(nextN, 'термин', 'термина', 'терминов');
      elLearnFront.textContent = `выучить ещё ${nextN} ${w}`;
      elLearnBack.textContent = 'нажми start';
    }
  }

  function loadLearnCfg(){
    const def = {
      source:'new',
      portion:'8',
      dir:'ru',
      goal:'fast',
      strict:'soft',
      typos:true,
      acceptForms:true,
      ignoreTo:true,
      ignoreArticles:true,
      hints:true,
      introMode:'card', // card | mcq (only for stage 1 intro)
      introMcqCount:4,
      introShowPos:false
    };
    const raw = localStorage.getItem(LEARN_CFG_KEY);
    const cfg = safeJsonParse(raw, def) || def;

    cfg.source = String(cfg.source || def.source);
    cfg.portion = String(cfg.portion || def.portion);
    cfg.dir = String(cfg.dir || def.dir);
    cfg.goal = String(cfg.goal || def.goal);
    cfg.strict = String(cfg.strict || def.strict);

    cfg.typos = cfg.typos !== false;
    cfg.acceptForms = cfg.acceptForms !== false;
    cfg.ignoreTo = cfg.ignoreTo !== false;
    cfg.ignoreArticles = cfg.ignoreArticles !== false;
    cfg.hints = cfg.hints !== false;

    cfg.introMode = String(cfg.introMode || def.introMode);
    if(!['card','mcq'].includes(cfg.introMode)) cfg.introMode = def.introMode;
    const ic = Number(cfg.introMcqCount);
    cfg.introMcqCount = Number.isFinite(ic) ? Math.max(2, Math.min(8, Math.round(ic))) : def.introMcqCount;
    cfg.introShowPos = !!cfg.introShowPos;

    // strict overrides
    if(cfg.strict === 'strict'){
      cfg.typos = false;
      cfg.acceptForms = false;
      cfg.ignoreTo = false;
      cfg.ignoreArticles = false;
    }

    learnCfg = cfg;
    return cfg;
  }
  function saveLearnCfg(cfg){
    learnCfg = cfg;
    try{ localStorage.setItem(LEARN_CFG_KEY, JSON.stringify(cfg)); }catch(_){}
  }
  function learnCfgFromUI(){
    const cfg = loadLearnCfg();
    if(elLearnSource) cfg.source = String(elLearnSource.value || cfg.source);
    if(elLearnPortion) cfg.portion = String(elLearnPortion.value || cfg.portion);
    if(elLearnDir) cfg.dir = String(elLearnDir.value || cfg.dir);
    if(elLearnGoal) cfg.goal = String(elLearnGoal.value || cfg.goal);
    if(elLearnStrict) cfg.strict = String(elLearnStrict.value || cfg.strict);

    if(elLearnTypos) cfg.typos = !!elLearnTypos.checked;
    if(elLearnForms) cfg.acceptForms = !!elLearnForms.checked;
    if(elLearnIgnoreTo) cfg.ignoreTo = !!elLearnIgnoreTo.checked;
    if(elLearnIgnoreArticles) cfg.ignoreArticles = !!elLearnIgnoreArticles.checked;
    if(elLearnHints) cfg.hints = !!elLearnHints.checked;

    if(typeof elLearnIntroMode !== 'undefined' && elLearnIntroMode) cfg.introMode = String(elLearnIntroMode.value || cfg.introMode);
    if(typeof elLearnIntroMcqCount !== 'undefined' && elLearnIntroMcqCount) cfg.introMcqCount = Number(elLearnIntroMcqCount.value || cfg.introMcqCount);
    if(typeof elLearnIntroShowPos !== 'undefined' && elLearnIntroShowPos) cfg.introShowPos = !!elLearnIntroShowPos.checked;

    if(cfg.strict === 'strict'){
      cfg.typos = false;
      cfg.acceptForms = false;
      cfg.ignoreTo = false;
      cfg.ignoreArticles = false;
    }

    learnCfg = cfg;
    return cfg;
  }
  function applyLearnCfgToUI(cfg){
    if(!cfg) return;
    if(elLearnSource) elLearnSource.value = String(cfg.source || 'new');
    if(elLearnPortion) elLearnPortion.value = String(cfg.portion || '8');
    if(elLearnDir) elLearnDir.value = String(cfg.dir || 'ru');
    if(elLearnGoal) elLearnGoal.value = String(cfg.goal || 'fast');
    if(elLearnStrict) elLearnStrict.value = String(cfg.strict || 'soft');

    if(elLearnTypos) elLearnTypos.checked = !!cfg.typos;
    if(elLearnForms) elLearnForms.checked = !!cfg.acceptForms;
    if(elLearnIgnoreTo) elLearnIgnoreTo.checked = !!cfg.ignoreTo;
    if(elLearnIgnoreArticles) elLearnIgnoreArticles.checked = !!cfg.ignoreArticles;
    if(elLearnHints) elLearnHints.checked = !!cfg.hints;

    if(typeof elLearnIntroMode !== 'undefined' && elLearnIntroMode) elLearnIntroMode.value = String(cfg.introMode || 'card');
    if(typeof elLearnIntroMcqCount !== 'undefined' && elLearnIntroMcqCount) elLearnIntroMcqCount.value = String(cfg.introMcqCount != null ? cfg.introMcqCount : 4);
    if(typeof elLearnIntroShowPos !== 'undefined' && elLearnIntroShowPos) elLearnIntroShowPos.checked = !!cfg.introShowPos;
  }

  function learnSetFeedback(state, stamp, line){
    if(!elLearnFeedback) return;
    elLearnFeedback.dataset.state = state || 'idle';
    if(elLearnStamp) elLearnStamp.textContent = stamp || 'info';
    if(elLearnLine) elLearnLine.textContent = line || '';
    pulse(elLearnFeedback, 'ik-pop');
  }
  function learnUpdateProgress(){
    if(!elLearnProgress){
      return;
    }
    const total = learnSession ? (learnSession.portion || 0) : 0;
    const learned = learnSession ? (learnSession.learnedCount || 0) : 0;
    const attempts = learnSession ? (learnSession.doneTests || 0) : 0;
    elLearnProgress.textContent = total ? `${learned}/${total} | попыток: ${attempts}` : '0/0';
  }

  function learnChooseAskLang(item, cfg){
    const dir = cfg.dir || 'ru';
    if(dir === 'en') return 'en';
    if(dir === 'ru') return 'ru';
    if(dir === 'mix') return Math.random() < 0.5 ? 'en' : 'ru';

    // weak direction: ask more where errors are higher
    const st = practiceGetStat(item);
    if(!st) return Math.random() < 0.5 ? 'en' : 'ru';
    const a = st.en2ru; const b = st.ru2en;
    const wa = (a.w + a.h*0.5);
    const wb = (b.w + b.h*0.5);
    if(wa === wb) return Math.random() < 0.5 ? 'en' : 'ru';
    return (wa > wb) ? 'en' : 'ru';
  }

  function learnEnsureSrs(item){
    const st = practiceGetStat(item);
    if(!st) return null;
    if(!st.srs) st.srs = {};
    return st;
  }

  function learnSrsScheduleDays(cfg){
    return (cfg.goal === 'long') ? LEARN_SRS_LONG : LEARN_SRS_FAST;
  }

  function learnOnSrsCorrect(item, cfg){
    const st = learnEnsureSrs(item);
    if(!st) return;
    const sched = learnSrsScheduleDays(cfg);
    let step = Number.isFinite(st.srs.step) ? st.srs.step : 0;
    step = Math.min(step + 1, sched.length - 1);
    st.srs.step = step;
    st.srs.due = Date.now() + sched[step] * 24*60*60*1000;
    savePracticeStats();
  }

  function learnOnSrsNewLearned(item, cfg){
    const st = learnEnsureSrs(item);
    if(!st) return;
    const sched = learnSrsScheduleDays(cfg);
    st.srs.step = 0;
    st.srs.due = Date.now() + sched[0] * 24*60*60*1000;
    savePracticeStats();
  }

  function learnOnSrsWrong(item, cfg){
    const st = learnEnsureSrs(item);
    if(!st) return;
    const sched = learnSrsScheduleDays(cfg);
    st.srs.step = 0;
    st.srs.due = Date.now() + sched[0] * 24*60*60*1000;
    savePracticeStats();
  }

  function learnCandidateFilter(items, cfg){
    const now = Date.now();
    const out = [];
    for(const it of items){
      const st = practiceGetStat(it) || {};
      const srs = st.srs || null;
      if(cfg.source === 'new'){
        if(!srs || srs.step === undefined) out.push(it);
      }else if(cfg.source === 'due'){
        if(srs && Number(srs.due || 0) > 0 && Number(srs.due) <= now) out.push(it);
      }else if(cfg.source === 'weak'){
        out.push(it);
      }else{
        out.push(it);
      }
    }
    if(cfg.source === 'weak'){
      out.sort((a,b)=> practiceWeight(b) - practiceWeight(a));
      return out;
    }
    return shuffle(out);
  }

  function learnBuildQueue(picked, cfg){
    const portion = picked.length;
    const chunkSize = 6;
    const queue = [];
    let index = 0;
    const introMode = String(cfg.introMode || 'card');
    let mixFlip = false;
    while(index < portion){
      const chunk = picked.slice(index, index + chunkSize);
      index += chunkSize;

      // intro for chunk
      for(const it of chunk){
        const al = learnChooseAskLang(it, cfg);
        let introKind = introMode;
        if(introMode === 'mix'){
          mixFlip = !mixFlip;
          introKind = mixFlip ? 'mcq' : 'card';
        }
        queue.push({ type:'intro', item:it, askLang: al, introKind });
      }

      // first tests shuffled inside chunk
      const tests = shuffle(chunk.slice()).map(it => ({ type:'test', item:it, round:1 }));
      queue.push(...tests);
    }
    return queue;
  }

  function learnStartSession(auto){
    const cfg = learnCfgFromUI();
    saveLearnCfg(cfg);

    learnMcqState = null;
    mcqPosBagLearn = [];
    if(elLearnMcqWrap) elLearnMcqWrap.style.display = 'none';
    if(btnLearnGiveUp){ btnLearnGiveUp.textContent = 'сдаюсь'; btnLearnGiveUp.title = 'Показать ответ (считается ошибкой)'; }

    const sel = String(elSectionLearn && elSectionLearn.value || '').trim();
    if(!sel){
      learnShow(null);
      learnSetFeedback('idle', 'pick', 'выбери section');
      return;
    }

    const all = wordsForSelection(sel);
    if(!all.length){
      learnShow(null);
      learnSetFeedback('idle', 'empty', 'нет слов - добавь в constructor');
      return;
    }

    let picked = [];
    if(cfg.source === 'all'){
      const want = Math.min(Number(cfg.portion || 8) || 8, all.length || 0);
      const res = learnBatchTake(sel, 'all', all, want);
      picked = res.picked;
    }else{
      const candidates = learnCandidateFilter(all, cfg);
      const want = Math.min(Number(cfg.portion || 8) || 8, candidates.length || 0);
      picked = candidates.slice(0, want);
    }

    if(!picked.length){
      learnShow(null);
      learnSetFeedback('idle', 'empty', cfg.source === 'new' ? 'нет новых слов' : 'нет слов для этого источника');
      return;
    }

    learnSession = {
      cfg,
      portion: picked.length,
      items: picked,
      queue: learnBuildQueue(picked, cfg),
      doneTests: 0,
      learnedCount: 0,
      wordState: {}, // key -> { streak, lastOkAt, firstOkAt, learned }
    };
    learnTaskCounter = 0;

    learnNext();
    if(auto){
      // focus input in test mode, no-op for intro
      if(elLearnInput) elLearnInput.focus({ preventScroll:true });
    }
  }

  function learnWordState(item){
    if(!learnSession) return null;
    const k = practiceKey(item);
    if(!learnSession.wordState[k]){
      learnSession.wordState[k] = { streak:0, firstOkAt:-1, lastOkAt:-1, learned:false, reqSpacing:10 };
    }
    return learnSession.wordState[k];
  }

  function learnSetFlipped(flipped){
    if(!elLearnCard) return;
    elLearnCard.classList.toggle('is-flipped', !!flipped);
    elLearnCard.setAttribute('aria-pressed', String(!!flipped));
  }

  function learnSetIntroUi(isIntro){
    if(!elLearnAnswerRow) return;
    if(isIntro){
      if(elLearnInput) elLearnInput.style.display = 'none';
      if(btnLearnHint) btnLearnHint.style.display = 'none';
      if(btnLearnGiveUp) btnLearnGiveUp.style.display = 'none';
      elLearnAnswerRow.style.justifyContent = 'center';
      elLearnAnswerRow.style.gap = '12px';
    }else{
      if(elLearnInput) elLearnInput.style.display = '';
      if(btnLearnHint) btnLearnHint.style.display = '';
      if(btnLearnGiveUp) btnLearnGiveUp.style.display = '';
      elLearnAnswerRow.style.justifyContent = '';
      elLearnAnswerRow.style.gap = '';
    }
  }

  // Prevent "answer peek" while the card flips back to the next question:
  // - keep back side empty during question stage
  // - fill back side only after check
  function learnClearBack(){
    if(elLearnBack) elLearnBack.textContent = '';
    if(elLearnBackLang) elLearnBackLang.textContent = '';
  }

  function learnFillBackAnswer(item, askLang, cfg){
    if(!item) return;
    const exp = practiceExpected(item, askLang, cfg);
    if(elLearnBack) elLearnBack.textContent = exp.expectedRaw || '';
    if(elLearnBackLang) elLearnBackLang.textContent = (exp.lang === 'en') ? 'EN' : (exp.lang === 'ru' ? 'RU' : String(exp.lang||''));
  }




  function learnShow(task){
    learnCurrent = task;
    learnHintLevel = 0;
    learnHintUsed = false;
    learnClearBack();
    learnSetFlipped(false);
    learnSetIntroUi(false);

    if(elLearnMcqWrap) elLearnMcqWrap.style.display = 'none';
    learnMcqState = null;
    if(btnLearnGiveUp){ btnLearnGiveUp.textContent = 'сдаюсь'; btnLearnGiveUp.title = 'Показать ответ (считается ошибкой)'; }

    if(!task){
      if(elLearnFront) elLearnFront.textContent = 'выбери section';
      if(elLearnBack) elLearnBack.textContent = 'нажми start';
      if(elLearnFrontLang) elLearnFrontLang.textContent = '';
      if(elLearnBackLang) elLearnBackLang.textContent = '';
      if(elLearnPromptLabel) elLearnPromptLabel.textContent = 'заучивание';
      if(elLearnInput){ elLearnInput.value=''; elLearnInput.disabled = true; elLearnInput.classList.remove('is-ok','is-bad'); }
      if(btnLearnCheckNext){ btnLearnCheckNext.textContent = 'check'; btnLearnCheckNext.title = 'Check (Enter)'; }
      learnCheckMode = 'check';
      learnUpdateProgress();
      return;
    }

    const cfg = learnSession ? learnSession.cfg : loadLearnCfg();

if(task.type === 'intro'){
  // Stage 1: quick introduction (Card or MCQ)
  const cfg = learnCfg || loadLearnCfg();
  const introModeCfg = String(cfg.introMode || 'card');
  const introMode = (introModeCfg === 'mix') ? String(task.introKind || 'card') : introModeCfg;

  learnSetIntroUi(true);
  if(elLearnMcqWrap) elLearnMcqWrap.style.display = 'none';
  learnMcqState = null;

  if(introMode === 'mcq'){
    // MCQ intro: show question on one side + options
    if(btnLearnGiveUp){
      btnLearnGiveUp.style.display = '';
      btnLearnGiveUp.textContent = 'не знаю';
      btnLearnGiveUp.title = 'Показать правильный ответ (считается ошибкой)';
    }

    const askLang = task.askLang || learnChooseAskLang(task.item, cfg);
    const askIsEn = (askLang === 'en');
    const front = askIsEn ? stripParenMeta(task.item.en) : stripParenMeta(task.item.ru);
    const back = askIsEn ? stripParenMeta(task.item.ru) : stripParenMeta(task.item.en);

    if(elLearnFront) elLearnFront.textContent = front;
    if(elLearnBack) elLearnBack.textContent = back;
    if(elLearnFrontLang) elLearnFrontLang.textContent = askIsEn ? 'EN' : 'RU';
    if(elLearnBackLang) elLearnBackLang.textContent = askIsEn ? 'RU' : 'EN';
    if(elLearnPromptLabel) elLearnPromptLabel.textContent = 'выбери правильный перевод';

    if(elLearnInput){
      elLearnInput.value = '';
      elLearnInput.disabled = true;
      elLearnInput.classList.remove('is-ok','is-bad');
    }

    learnSetFlipped(false);
    learnRenderIntroMcq(task, cfg);

    learnSetFeedback('idle', 'ready', 'выбери вариант');
    learnCheckMode = 'check';
    if(btnLearnCheckNext){ btnLearnCheckNext.textContent = 'далее'; btnLearnCheckNext.title = 'Далее (Enter)'; }
  }else{
    // Card intro: show both sides (no input)
    if(btnLearnGiveUp) btnLearnGiveUp.style.display = 'none';

    if(elLearnFront) elLearnFront.textContent = task.item.en;
    if(elLearnBack) elLearnBack.textContent = task.item.ru;
    if(elLearnFrontLang) elLearnFrontLang.textContent = 'EN';
    if(elLearnBackLang) elLearnBackLang.textContent = 'RU';
    if(elLearnPromptLabel) elLearnPromptLabel.textContent = 'быстрый показ - запомни связку';

    if(elLearnInput){
      elLearnInput.value = '';
      elLearnInput.disabled = true;
      elLearnInput.classList.remove('is-ok','is-bad');
    }

    learnSetFeedback('idle', 'intro', 'нажми далее');
    learnCheckMode = 'next';
    if(btnLearnCheckNext){ btnLearnCheckNext.textContent = 'далее'; btnLearnCheckNext.title = 'Далее (Enter)'; }
  }

  learnUpdateProgress();
  return;
}

    // test / retype
    const askLang = learnChooseAskLang(task.item, cfg);
    learnAskLang = askLang;

    const frontIsEn = (askLang === 'en');
    if(elLearnFront) elLearnFront.textContent = frontIsEn ? task.item.en : task.item.ru;
    // Keep back side empty until after check (prevents answer peek during flip)
    learnClearBack();
    if(elLearnFrontLang) elLearnFrontLang.textContent = frontIsEn ? 'EN' : 'RU';

    const hintText = frontIsEn ? 'переведи на русский' : 'переведи на английский';
    if(elLearnPromptLabel) elLearnPromptLabel.textContent = (task.type === 'retype') ? 'введи правильный ответ' : hintText;

    if(elLearnInput){
      elLearnInput.disabled = false;
      elLearnInput.value = '';
      elLearnInput.classList.remove('is-ok','is-bad');
      elLearnInput.placeholder = (task.type === 'retype') ? 'Введите правильный ответ...' : 'Введите перевод...';
      elLearnInput.focus({ preventScroll:true });
    }

    learnSetFeedback('idle', 'ready', 'введи ответ и нажми check');
    learnCheckMode = 'check';
    if(btnLearnCheckNext){ btnLearnCheckNext.textContent = 'check'; btnLearnCheckNext.title = 'Check (Enter)'; }
    learnUpdateProgress();
  }

  function learnInsertTask(task, gapMin, gapMax){
    if(!learnSession) return;

    const minGap = Math.max(0, Math.floor(Number(gapMin) || 0));
    const maxGap = Math.max(minGap, Math.floor(Number(gapMax) || minGap));
    const key = (task && task.item) ? practiceKey(task.item) : '';

    const gap = minGap + Math.floor(Math.random() * Math.max(1, (maxGap-minGap+1)));
    let idx = Math.min(learnSession.queue.length, gap);

    // Anti-loop: если это слово уже есть в ближайших заданиях, не ставим его ещё ближе.
    if(key && learnSession.queue && learnSession.queue.length){
      const scanTo = Math.min(learnSession.queue.length, idx + 1);
      for(let i=0;i<scanTo;i++){
        const t = learnSession.queue[i];
        if(!t || !t.item) continue;
        if(t.type === 'test' && practiceKey(t.item) === key){
          idx = Math.min(learnSession.queue.length, i + minGap);
          break;
        }
      }
    }

    learnSession.queue.splice(idx, 0, task);
  }

  function learnNext(){
    if(!learnSession || !learnSession.queue.length){
      const prev = learnSession;
      learnShow(null);
      if(prev){
        learnSetFeedback('correct', 'done', `сессия завершена: выучено ${prev.learnedCount}/${prev.portion}`);
        const sid = String(elSectionLearn && elSectionLearn.value || '').trim();
        learnRenderIdleNext(sid, prev.cfg || loadLearnCfg());
      }
      return;
    }
    const task = learnSession.queue.shift();
    learnShow(task);
  }

  function learnEvaluateAnswer(raw, item, askLang, cfg){
    const exp = practiceExpected(item, askLang, cfg);
    const tokens = userTokens(raw, exp.lang, cfg);
    if(!tokens.length) return { status:'empty', exp, cfg };

    for(const tk of tokens){
      if(exp.expectedVariants.includes(tk)){
        return { status:'correct', exp, cfg };
      }
    }

    if(cfg.typos){
      let bestDist = Infinity;
      let bestExp = null;
      for(const tk of tokens){
        for(const ev of exp.expectedVariants){
          const d = levenshtein(tk, ev);
          if(d < bestDist){
            bestDist = d;
            bestExp = ev;
          }
        }
      }
      const thr = typoThreshold(bestExp);
      if(bestExp && bestDist > 0 && bestDist <= thr){
        return { status:'almost', exp, cfg, dist: bestDist, best:bestExp };
      }
    }
    return { status:'wrong', exp, cfg };
  }

  function learnLockAfterCheck(isCorrect){
if(elLearnInput){
  // IMPORTANT: keep red in retype until correct
  if(isCorrect){
    elLearnInput.classList.remove('is-bad');
    elLearnInput.classList.add('is-ok');
  }else{
    elLearnInput.classList.remove('is-ok');
    elLearnInput.classList.add('is-bad');
    pulse(elLearnInput, 'ik-shake');
  }
  elLearnInput.disabled = true;
}
  // Fill back side with the correct answer only after check
  try{
    const t = learnCurrent;
    if(t && t.item && (t.type === 'test' || t.type === 'retype')){
      const cfg = learnSession ? learnSession.cfg : loadLearnCfg();
      const askLang = learnAskLang || learnChooseAskLang(t.item, cfg);
      learnFillBackAnswer(t.item, askLang, cfg);
    }
  }catch(_e){}
learnSetFlipped(true);
learnCheckMode = 'next';
if(btnLearnCheckNext){ btnLearnCheckNext.textContent = 'далее'; btnLearnCheckNext.title = 'Далее (Enter)'; }
  }


  function learnEnterRetypeAfterWrong(task, cfg){
    // keep answer visible and force one correct retype before moving on
    learnCurrent = { type:'retype', item: task.item };
    learnHintLevel = 0;
    learnHintUsed = true;
    learnCheckMode = 'check';

    // show same card (already set) and flip to answer
    learnSetFlipped(true);

    if(elLearnPromptLabel) elLearnPromptLabel.textContent = 'введи правильный ответ';
    if(elLearnInput){
      elLearnInput.disabled = false;
      elLearnInput.value = '';
      elLearnInput.placeholder = 'Введите правильный ответ...';
      elLearnInput.classList.remove('is-ok');
      elLearnInput.classList.add('is-bad');
      elLearnInput.focus({ preventScroll:true });
    }
    if(btnLearnCheckNext){
      btnLearnCheckNext.textContent = 'check';
      btnLearnCheckNext.title = 'Check (Enter)';
    }
    if(btnLearnGiveUp){
      btnLearnGiveUp.style.display = '';
      btnLearnGiveUp.textContent = 'пропустить';
      btnLearnGiveUp.title = 'Пропустить и продолжить (слово вернётся позже)';
    }
    learnSetFeedback('wrong', 'fix', 'введи правильно (или нажми "пропустить")');
  }


  function learnHandleCorrect(task, cfg){
    if(!learnSession) return;

    learnSession.doneTests += 1;
    learnTaskCounter += 1;

    // update practice stats
    practiceBump(task.item, learnAskLang, learnHintUsed ? 'hard' : 'correct');

    const ws = learnWordState(task.item);
    if(!ws.learned){
      if(learnHintUsed){
        // hints break streak
        ws.streak = 0;
      }else{
        ws.streak += 1;
        if(ws.streak === 1) ws.firstOkAt = learnTaskCounter;
        ws.lastOkAt = learnTaskCounter;

        // schedule second check with feasible spacing
        const maxPossible = Math.max(0, (learnSession.portion || 0) - 1);
        const wantMin = Math.min(10, maxPossible);
        const remain = Math.max(0, learnSession.queue.length);
        const minGap = Math.min(wantMin, remain);
        const maxGap = Math.min(minGap + 10, remain);

        if(ws.streak === 1){
          ws.reqSpacing = minGap;
          learnInsertTask({ type:'test', item:task.item, round:(task.round||1)+1 }, minGap, maxGap);
        }else if(ws.streak >= 2){
          // require at least ws.reqSpacing tasks since first ok (auto-relaxed for small/late sessions)
          const need = Number.isFinite(ws.reqSpacing) ? ws.reqSpacing : wantMin;
          if(ws.firstOkAt >= 0 && (learnTaskCounter - ws.firstOkAt) >= need){
            ws.learned = true;
            learnSession.learnedCount += 1;

            // mark as learned for SRS if new
            const st = practiceGetStat(task.item) || {};
            const srs = st.srs || null;
            if(!srs || srs.step === undefined){
              learnOnSrsNewLearned(task.item, cfg);
            }else{
              learnOnSrsCorrect(task.item, cfg);
            }
          }else{
            // not enough spacing yet - ask again later
            ws.streak = 1;
            ws.firstOkAt = learnTaskCounter;
            ws.reqSpacing = minGap;
            learnInsertTask({ type:'test', item:task.item, round:(task.round||1)+1 }, minGap, maxGap);
          }
        }
      }
    }else{
      // already learned - still update SRS if it was a due review source
      if(cfg.source === 'due') learnOnSrsCorrect(task.item, cfg);
    }

    learnUpdateProgress();
    learnSetFeedback('correct', 'ok', learnHintUsed ? 'верно (с подсказкой)' : 'верно');
    learnLockAfterCheck(true);
  }

  function learnHandleWrong(task, cfg){
    if(!learnSession) return;

    learnSession.doneTests += 1;
    learnTaskCounter += 1;

    // update stats
    practiceBump(task.item, learnAskLang, 'wrong');
    learnOnSrsWrong(task.item, cfg);

    const ws = learnWordState(task.item);
    ws.streak = 0;

    // schedule the word again soon (быстрое повторение)
    learnInsertTask({ type:'test', item:task.item, round:(task.round||1)+1 }, 3, 8);

    learnUpdateProgress();
    learnSetFeedback('wrong', 'no', 'неверно - смотри ответ');

    // enter retype right now (обязательный ввод правильного)
    learnLockAfterCheck(false);
    learnEnterRetypeAfterWrong(task, cfg);
  }

  function learnCheckOrNext(){
    if(!learnCurrent){
      learnStartSession(true);
      return;
    }
    if(learnCheckMode === 'next'){
      learnNext();
      return;
    }
    const task = learnCurrent;

    // Intro stage (Card or MCQ)
    if(task.type === 'intro'){
      const cfgIntro = learnSession ? learnSession.cfg : loadLearnCfg();
      const introMode = String(cfgIntro.introMode || 'card');

      if(introMode === 'mcq'){
        if(learnMcqState && learnMcqState.locked){
          learnNext();
          return;
        }
        learnSetFeedback('idle', 'pick', 'выбери вариант или нажми не знаю');
        if(elLearnCard) pulse(elLearnCard, 'ik-shake');
        return;
      }

      // card intro -> just go next
      learnNext();
      return;
    }

    if(task.type !== 'test' && task.type !== 'retype'){
      learnNext();
      return;
    }

    const cfg = learnSession ? learnSession.cfg : loadLearnCfg();
    const raw = (elLearnInput && elLearnInput.value) ? elLearnInput.value : '';
    if(!String(raw).trim()){
      learnSetFeedback('idle', 'type', 'введи ответ');
      if(elLearnInput) pulse(elLearnInput, 'ik-shake');
      return;
    }

    const res = learnEvaluateAnswer(raw, task.item, learnAskLang, cfg);
    if(res.status === 'correct'){
      if(task.type === 'retype'){
        // retype correct - move on
        learnSetFeedback('correct', 'ok', 'принято - жми далее');
        learnLockAfterCheck(true);
        if(btnLearnGiveUp){ btnLearnGiveUp.textContent = 'сдаюсь'; btnLearnGiveUp.title = 'Показать ответ (считается ошибкой)'; }
        return;
      }
      learnHandleCorrect(task, cfg);
      return;
    }

    // almost -> count as wrong but with softer feedback
    if(res.status === 'almost'){
      if(task.type === 'retype'){
        learnSetFeedback('wrong', 'almost', 'почти - попробуй еще раз (нужно точно)');
        if(elLearnInput){
          elLearnInput.classList.remove('is-ok');
          elLearnInput.classList.add('is-bad');
          pulse(elLearnInput, 'ik-shake');
        }
        return;
      }
      learnHintUsed = true; // treat as hard
      learnSetFeedback('idle', 'almost', `почти! опечатка примерно в ${res.dist} символ(ах)`);
      // still lock + require retype
      learnHandleWrong(task, cfg);
      return;
    }

    // wrong
    if(task.type === 'retype'){
      learnSetFeedback('wrong', 'no', 'нужно ввести правильно, чтобы продолжить');
      if(elLearnInput){
        elLearnInput.classList.remove('is-ok');
        elLearnInput.classList.add('is-bad');
        pulse(elLearnInput, 'ik-shake');
      }
      return;
    }
    learnHandleWrong(task, cfg);
  }

  function learnHint(){
    const cfg = learnSession ? learnSession.cfg : loadLearnCfg();
    if(!cfg.hints){
      learnSetFeedback('idle', 'hint', 'подсказки выключены в настройках');
      return;
    }
    if(!learnCurrent || (learnCurrent.type !== 'test' && learnCurrent.type !== 'retype')) return;
    const exp = practiceExpected(learnCurrent.item, learnAskLang, cfg);
    const target = (exp.expectedRaw || '').trim();
    if(!target){
      learnSetFeedback('idle', 'hint', 'нет ответа');
      return;
    }
    learnHintUsed = true;
    learnHintLevel += 1;

    if(learnHintLevel === 1){
      const base = stripParenMeta(target).trim();
      const first = base.slice(0, Math.min(2, base.length));
      const mask = first + ' ' + '_'.repeat(Math.max(0, base.length - first.length));
      learnSetFeedback('idle', 'hint', mask);
      return;
    }
    if(learnHintLevel === 2){
      const base = stripParenMeta(target).trim();
      learnSetFeedback('idle', 'hint', `длина: ${base.length}`);
      return;
    }

    // level 3 -> show answer (counts as give up)
    learnGiveUp();
  }

  function learnGiveUp(){
    // Intro MCQ uses "не знаю"
    if(learnCurrent && learnCurrent.type === 'intro'){
      if(learnMcqState && !learnMcqState.locked){
        learnIntroMcqGiveUp();
        return;
      }
      // If already answered in intro, "не знаю" acts like next
      learnNext();
      return;
    }

    if(!learnCurrent || (learnCurrent.type !== 'test' && learnCurrent.type !== 'retype')) return;
    const cfg = learnSession ? learnSession.cfg : loadLearnCfg();
    learnHintUsed = true;
    if(learnCurrent.type === 'retype'){
      // Fail-safe: не блокируем сессию на одном слове навсегда
      learnSetFeedback('wrong', 'skip', 'пропущено — слово вернётся позже');
      learnLockAfterCheck(false);
      if(btnLearnGiveUp){
        btnLearnGiveUp.textContent = 'сдаюсь';
        btnLearnGiveUp.title = 'Показать ответ (считается ошибкой)';
      }
      return;
    }
    learnHandleWrong(learnCurrent, cfg);
  }


// UI
  const elDictDbStatus = document.getElementById('dictDbStatus');
  const elDictSeedBadge = document.getElementById('dictSeedBadge');
  const elDictDbNameLine = document.getElementById('dictDbNameLine');
  const elDictCountBadge = document.getElementById('dictCountBadge');

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

  const dictTabCards = document.getElementById('dict-tab-cards');
  const dictTabQuiz = document.getElementById('dict-tab-quiz');
  const dictTabLearn = document.getElementById('dict-tab-learn');
  const dictTabView = document.getElementById('dict-tab-view');
  const dictTabBuilder = document.getElementById('dict-tab-builder');
  const dictPanelCards = document.getElementById('dict-panel-cards');
  const dictPanelQuiz = document.getElementById('dict-panel-quiz');
  const dictPanelLearn = document.getElementById('dict-panel-learn');
  const dictPanelView = document.getElementById('dict-panel-view');
  const dictPanelBuilder = document.getElementById('dict-panel-builder');

  const elSectionCards = document.getElementById('dictSectionCards');
  const elSectionQuiz = document.getElementById('dictSectionQuiz');
  const elSectionLearn = document.getElementById('dictSectionLearn');
  const elSectionView = document.getElementById('dictSectionView');
  const elSectionBuilder = document.getElementById('dictBuilderSection');
  const elSectionList = document.getElementById('dictSectionList');
  const elWordList = document.getElementById('dictWordList');
  const elViewSearch = document.getElementById('dictViewSearch');
  const elViewList = document.getElementById('dictViewList');
  const elViewMeta = document.getElementById('dictViewMeta');

  const elDictFirstPick = document.getElementById('dictFirstPick');
  const elDictSubtabsWrap = document.getElementById('dictSubtabsWrap');
  const elFirstPickList = document.getElementById('dictFirstPickList');
  const elFirstPickSearch = document.getElementById('dictFirstPickSearch');
  const btnFirstPickOpenConstructor = document.getElementById('dictFirstPickOpenConstructor');
  const btnCardsChooseSection = document.getElementById('dictCardsChooseSection');
  const btnQuizChooseSection = document.getElementById('dictQuizChooseSection');
  const btnLearnChooseSection = document.getElementById('dictLearnChooseSection');

  const elCardsRandom = document.getElementById('dictCardsRandom');
  const elCardsFront = document.getElementById('dictCardsFront');
  const btnCardsPrev = document.getElementById('dictCardsPrev');
  const btnCardsNext = document.getElementById('dictCardsNext');


// Move cards prev/next under the flashcard (centered)
(function(){
  const meta = document.getElementById('dictCardsMeta');
  const stage = document.querySelector('#dict-panel-cards .ik-flip-stage');
  if(!meta || !stage || !btnCardsPrev || !btnCardsNext) return;
  const nav = document.createElement('div');
  nav.className = 'ik-row';
  nav.style.justifyContent = 'center';
  nav.style.marginTop = '12px';
  nav.appendChild(btnCardsPrev);
  nav.appendChild(btnCardsNext);
  meta.parentNode.insertBefore(nav, meta);
})();

  const elFlipCard = document.getElementById('dictFlipCard');
  const elCardFront = document.getElementById('dictCardFront');
  const elCardBack = document.getElementById('dictCardBack');
  const elCardFrontLang = document.getElementById('dictCardFrontLang');
  const elCardBackLang = document.getElementById('dictCardBackLang');
  const elCardsMeta = document.getElementById('dictCardsMeta');

  const elQuizMode = document.getElementById('dictQuizMode');
  const elQuizScore = document.getElementById('dictQuizScore');
  const elQuizPromptLabel = document.getElementById('dictQuizPromptLabel');
  const elQuizCard = document.getElementById('dictQuizCard');
  const elQuizFront = document.getElementById('dictQuizFront');
  const elQuizBack = document.getElementById('dictQuizBack');
  const elQuizFrontLang = document.getElementById('dictQuizFrontLang');
  const elQuizBackLang = document.getElementById('dictQuizBackLang');
  const elQuizInput = document.getElementById('dictQuizInput');
  const btnQuizCheckNext = document.getElementById('dictQuizCheckNext');
  const btnQuizSkip = document.getElementById('dictQuizSkip');
  const elQuizFeedback = document.getElementById('dictQuizFeedback');
  const elQuizStamp = document.getElementById('dictQuizStamp');
  const elQuizLine = document.getElementById('dictQuizLine');
  // Learn UI
  const elLearnProgress = document.getElementById('dictLearnProgress');
  const btnLearnSettingsBtn = document.getElementById('dictLearnSettingsBtn');
  const elLearnSettings = document.getElementById('dictLearnSettings');

  const elLearnSource = document.getElementById('dictLearnSource');
  const elLearnPortion = document.getElementById('dictLearnPortion');
  const elLearnDir = document.getElementById('dictLearnDir');
  const elLearnGoal = document.getElementById('dictLearnGoal');
  const elLearnStrict = document.getElementById('dictLearnStrict');

  const elLearnTypos = document.getElementById('dictLearnTypos');
  const elLearnForms = document.getElementById('dictLearnForms');
  const elLearnIgnoreTo = document.getElementById('dictLearnIgnoreTo');
  const elLearnIgnoreArticles = document.getElementById('dictLearnIgnoreArticles');
  const elLearnHints = document.getElementById('dictLearnHints');
  const btnLearnRestart = document.getElementById('dictLearnRestart');

  const elLearnPromptLabel = document.getElementById('dictLearnPromptLabel');
  const elLearnCard = document.getElementById('dictLearnCard');
  const elLearnFront = document.getElementById('dictLearnFront');
  const elLearnBack = document.getElementById('dictLearnBack');
  const elLearnFrontLang = document.getElementById('dictLearnFrontLang');
  const elLearnBackLang = document.getElementById('dictLearnBackLang');
  const elLearnInput = document.getElementById('dictLearnInput');
  const btnLearnCheckNext = document.getElementById('dictLearnCheckNext');
  const btnLearnHint = document.getElementById('dictLearnHint');
  const btnLearnGiveUp = document.getElementById('dictLearnGiveUp');
  const elLearnFeedback = document.getElementById('dictLearnFeedback');
  const elLearnStamp = document.getElementById('dictLearnStamp');
  const elLearnLine = document.getElementById('dictLearnLine');
  const elLearnAnswerRow = document.getElementById('dictLearnAnswerRow');

  const btnPracticeSettingsBtn = document.getElementById('dictPracticeSettingsBtn');
  const elPracticeSettings = document.getElementById('dictPracticeSettings');
  const elPracticeSession = document.getElementById('dictPracticeSession');
  const elPracticeTypos = document.getElementById('dictPracticeTypos');
  const elPracticeIgnoreTo = document.getElementById('dictPracticeIgnoreTo');
  const elPracticeIgnoreArticles = document.getElementById('dictPracticeIgnoreArticles');
  const btnPracticeHint = document.getElementById('dictPracticeHint');
  const elPracticeFuzzyActions = document.getElementById('dictPracticeFuzzyActions');
  const btnPracticeFuzzyAccept = document.getElementById('dictPracticeFuzzyAccept');
  const btnPracticeFuzzyReject = document.getElementById('dictPracticeFuzzyReject');


// Extra settings (injected via JS, so IDs might not exist in HTML)
let elPracticeTaskMode = null;
let elPracticeMixInputPct = null;
let elPracticeMcqCount = null;
let elPracticeShowPos = null;
let elPracticeSoftMcq = null;

let elLearnIntroMode = null;
let elLearnIntroMcqCount = null;
let elLearnIntroShowPos = null;

// MCQ UI containers
let elQuizMcqWrap = null;
let elQuizMcqMeta = null;
let elQuizMcqButtons = null;

let elLearnMcqWrap = null;
let elLearnMcqMeta = null;
let elLearnMcqButtons = null;


  const elNewSectionName = document.getElementById('dictNewSectionName');
  const btnAddSection = document.getElementById('dictAddSection');
  const btnDeleteSection = document.getElementById('dictDeleteSection');
  const btnSubmitModeration = document.getElementById('dictSubmitModeration');
  const elEnInput = document.getElementById('dictEnInput');
  const elRuInput = document.getElementById('dictRuInput');
  const btnAddWord = document.getElementById('dictAddWord');
  const btnDictExport = document.getElementById('dictExportDb');
  const btnDictImport = document.getElementById('dictImportDb');
  const elDictImportReplace = document.getElementById('dictImportReplace');
  const elDictFileImport = document.getElementById('dictFileImport');

  function dictSetSubtab(which){
    const isCards = which === 'cards';
    const isPractice = (which === 'quiz' || which === 'practice');
    const isLearn = which === 'learn';
    const isView = which === 'view';

    dictTabCards.setAttribute('aria-selected', String(isCards));
    dictTabQuiz.setAttribute('aria-selected', String(isPractice));
    if(dictTabLearn) dictTabLearn.setAttribute('aria-selected', String(isLearn));
    if(dictTabView) dictTabView.setAttribute('aria-selected', String(isView));
    dictTabBuilder.setAttribute('aria-selected', String(!isCards && !isPractice && !isLearn && !isView));

    dictPanelCards.hidden = !isCards;
    dictPanelQuiz.hidden = !isPractice;
    if(dictPanelLearn) dictPanelLearn.hidden = !isLearn;
    if(dictPanelView) dictPanelView.hidden = !isView;
    dictPanelBuilder.hidden = isCards || isPractice || isLearn || isView;
    coachUpdateFromQuiz();
  }

  function quizSetFeedback(state, stamp, line){
    elQuizFeedback.dataset.state = state || 'idle';
    elQuizStamp.textContent = stamp || 'info';
    elQuizLine.textContent = line || '';
    pulse(elQuizFeedback, 'ik-pop');
  }

  function uiLang(){
    try{
      const s = String(localStorage.getItem('ik_site_lang_v1') || '').trim().toLowerCase();
      if(s === 'en') return 'en';
    }catch(_){ }
    const dl = String(document.documentElement && document.documentElement.lang || '').toLowerCase();
    if(dl.startsWith('en')) return 'en';
    return 'ru';
  }

  function t2(ru, en){
    return uiLang() === 'en' ? en : ru;
  }

  function ruN(n, one, few, many){
    const x = Math.abs(Number(n || 0));
    const m10 = x % 10;
    const m100 = x % 100;
    if(m10 === 1 && m100 !== 11) return one;
    if(m10 >= 2 && m10 <= 4 && !(m100 >= 12 && m100 <= 14)) return few;
    return many;
  }

  function fmtEco(v){
    const n = Number(v);
    if(!Number.isFinite(n)) return '0';
    if(Number.isInteger(n)) return String(n);
    const s = n.toFixed(1);
    return s.endsWith('.0') ? s.slice(0, -2) : s;
  }

  let coachLastEvent = { type:'', at:0, textRu:'', textEn:'' };
  let coachIdleTimer = null;
  let coachIdleStep = 0;
  let coachShownLine = '';
  let coachShownAt = 0;

  function clearCoachIdleTalk(){
    if(coachIdleTimer){
      window.clearTimeout(coachIdleTimer);
      coachIdleTimer = null;
    }
    coachIdleStep = 0;
    coachShownLine = '';
    coachShownAt = 0;
  }

  function coachIdleMessage(done, correct, remain, acc){
    const step = Number(coachIdleStep || 0);
    const pick = (arr)=> arr[Math.floor(Math.random() * arr.length)] || '';
    if(step === 0){
      return t2('Дарова. Готов начать?', 'Hey. Ready to start?');
    }
    if(step === 1){
      return t2('Окей, поехали. Спокойно и точно.', 'Alright, let’s run it. Calm and accurate.');
    }
    if(done === 0){
      return t2('Начинай, я веду статистику по ходу.', 'Start when ready, I track stats as you go.');
    }
    if(remain > 0){
      return t2(
        pick([
          `Темп норм. Осталось ${remain}, точность ${acc}%.`,
          `Сейчас ${done}/20, правильных ${correct}.`,
          `Держи ритм, не суетись.`,
          `Продолжаем. Следующий вопрос.`
        ]),
        pick([
          `Good pace. ${remain} left, accuracy ${acc}%.`,
          `Now ${done}/20, correct ${correct}.`,
          'Keep rhythm, no rush.',
          'Continue. Next question.'
        ])
      );
    }
    return t2('Финал. Проверяем результат.', 'Final stretch. Checking result.');
  }

  function scheduleCoachIdleTalk(done, correct, remain, acc){
    if(coachIdleTimer) window.clearTimeout(coachIdleTimer);
    const delay = coachIdleStep < 2 ? 2600 : 9000;
    coachIdleTimer = window.setTimeout(()=>{
      if(!(window.IKFarmCoach && typeof window.IKFarmCoach.update === 'function')) return;
      const msg = coachIdleMessage(done, correct, remain, acc);
      if(msg){
        coachLastEvent = { type:'idle', at: Date.now(), textRu: msg, textEn: msg };
        coachUpdateFromQuiz();
      }
      coachIdleStep += 1;
    }, delay);
  }
  function coachSignal(type){
    const now = Date.now();
    if((now - Number(coachLastEvent.at || 0)) < 2600) return;
    const t = String(type || '');
    const pick = (arr)=> arr[Math.floor(Math.random() * arr.length)] || '';
    let textRu = '';
    let textEn = '';
    if(t === 'correct'){
      textRu = pick([
        'Засчитано. Двигаемся дальше.',
        'Чисто. Этот ответ в копилку награды.',
        'Нормальный ход. Продолжай темп.',
        'Есть. Шаг к выплате сделан.'
      ]);
      textEn = pick([
        'Counted. Keep moving.',
        'Clean hit. One step closer.',
        'Solid answer. Stay on pace.',
        'Good. Reward track continues.'
      ]);
    }else if(t === 'wrong'){
      textRu = pick([
        'Промах. Следующий бери чисто.',
        'Не попал. Выравниваем точность.',
        'Ладно, продолжаем без суеты.',
        'Мимо. Идём дальше.'
      ]);
      textEn = pick([
        'Miss. Take the next one clean.',
        'Not this one. Recover accuracy.',
        'Missed. Keep pushing.',
        'Off target. Continue.'
      ]);
    }else if(t === 'giveup'){
      textRu = 'Ответ открыт. Следующий лучше закрыть самостоятельно.';
      textEn = 'Answer revealed. Take the next one clean yourself.';
    }else if(t === 'almost'){
      textRu = 'Почти попал. Одна аккуратная правка — и это твой балл.';
      textEn = 'So close. One clean tweak and this point is yours.';
    }
    coachLastEvent = { type: t, at: now, textRu, textEn };
  }

  function coachEventTalk(){
    const age = Date.now() - Number(coachLastEvent.at || 0);
    if(age > 4500) return '';
    return t2(coachLastEvent.textRu || '', coachLastEvent.textEn || '');
  }

  function coachSelectLine(eventLine, baseLine){
    const now = Date.now();
    if(eventLine){
      coachShownLine = eventLine;
      coachShownAt = now;
      return eventLine;
    }
    if(!coachShownLine || (now - coachShownAt) > 5200){
      coachShownLine = baseLine;
      coachShownAt = now;
    }
    return coachShownLine || baseLine;
  }

  function coachUpdateFromQuiz(){
    if(!(window.IKFarmCoach && typeof window.IKFarmCoach.update === 'function')) return;
    const inPractice = dictPanelQuiz && dictPanelQuiz.hidden === false;
    const rated = isRatedSource();
    if(!inPractice || !rated){
      clearCoachIdleTalk();
      const line = !inPractice
        ? t2('Dictionary открыт. Выбери режим practice, если хочешь вести сессию.', 'Dictionary is open. Pick practice mode to run a session.')
        : t2('Это личный словарь без рейтинга. Тренировка идёт, но начислений нет.', 'This is personal dictionary (unrated). Training works, no ranked rewards.');
      const sub = !inPractice
        ? t2('Я остаюсь здесь. Когда начнешь practice — покажу боевую статистику.', 'I stay online. Start practice and I will show ranked stats.')
        : t2('Для рейтинга переключись на пользовательские или системные словари.', 'Switch to user/system dictionaries for ranked rewards.');
      window.IKFarmCoach.update({
        owner: 'dictionary',
        active: true,
        title: t2('Farm HUB · Учебный центр', 'Farm HUB · Learning Center'),
        line,
        subline: sub,
        showStats: false,
        chips: [],
        progressPct: 0,
        mood: 'calm',
        hideLabel: t2('скрыть', 'hide'),
        stripLabel: 'Farm HUB ▾',
      });
      return;
    }

    const target = Number(quizSessionTarget || 0);
    const done = Number(quizTotal || 0);
    const correct = Number(quizCorrect || 0);
    const wrong = Math.max(0, done - correct);
    const remain = Math.max(0, target - done);
    const toPass = Math.max(0, 15 - correct);
    const acc = done > 0 ? Math.round((correct / Math.max(1, done)) * 100) : 0;
    const progressPct = target > 0 ? Math.round((done / target) * 100) : 0;
    const cfg = cfgFromUI();
    const ratedEligible = String(cfg.session || '') === '20' && target === 20;

    let mood = 'calm';
    if(acc >= 85 && done >= 10) mood = 'hot';
    if(done >= target && correct >= 15) mood = 'done';
    if(!ratedEligible) mood = 'calm';

    const nowEco = (()=>{
      if(acc >= 95) return '~22 EKO';
      if(acc >= 85) return '~18 EKO';
      if(acc >= 70) return '~14 EKO';
      return '~10 EKO';
    })();

    const leftWordRu = ruN(remain, 'задание', 'задания', 'заданий');
    const passWordRu = ruN(toPass, 'правильный ответ', 'правильных ответа', 'правильных ответов');

    let line = '';
    let subline = '';
    let avatar = '⟐';
    const chips = [];

    const eventTalk = coachEventTalk();

    if(!ratedEligible){
      const baseLine = t2(
        'Сейчас рейтинг выключен. Поставь сессию на 20 заданий, чтобы получать EKO и I-bit þ.',
        'Ranked mode is off. Set session to 20 tasks to earn EKO and I-bit þ.'
      );
      line = coachSelectLine(eventTalk, baseLine);
      subline = t2(
        `Сейчас сессия: ${String(cfg.session || '?')}. Для рейтинга нужно: 20 заданий и минимум 15 правильных.`,
        `Current session: ${String(cfg.session || '?')}. Ranked rule: 20 tasks and at least 15 correct.`
      );
      chips.push(
        t2('◈ режим: без рейтинга', '◈ mode: unrated'),
        t2('⟐ чтобы включить фарм: session = 20', '⟐ to enable farming: session = 20')
      );
    }else if(done >= target){
      if(correct >= 15){
        const baseLine = t2(
          'Сессия закончена, условия выполнены. Сейчас отправляю результат на начисление.',
          'Session complete, conditions met. Sending result for reward credit now.'
        );
        line = coachSelectLine(eventTalk, baseLine);
        subline = t2(
          `Итог: ${correct}/20 правильных (${acc}%). Ожидай сообщение о фактическом начислении.`,
          `Final: ${correct}/20 correct (${acc}%). Wait for the final credited reward message.`
        );
        avatar = '⟢';
      }else{
        const baseLine = t2(
          'Сессия закончена, но награда не будет начислена: нужно минимум 15 правильных ответов из 20.',
          'Session complete, but no reward this run: you need at least 15 correct answers out of 20.'
        );
        line = coachSelectLine(eventTalk, baseLine);
        subline = t2(
          `У тебя ${correct}/20. Попробуй ещё раз и держи точность выше.`,
          `You got ${correct}/20. Try again and keep accuracy higher.`
        );
        avatar = '⟁';
      }
    }else if(toPass > 0){
      const baseLine = t2(
        `Нужно добрать ещё ${toPass} ${passWordRu}, чтобы включилось начисление.`,
        `Need ${toPass} more correct answers to unlock reward credit.`
      );
      line = coachSelectLine(eventTalk, baseLine);
      if(wrong >= 3){
        subline = t2(
          `Сделано ${done}/20, точность ${acc}%. Подсказка: не спеши, лучше стабильно +верно.`,
          `Done ${done}/20, accuracy ${acc}%. Hint: slow down a bit; stable correct answers win.`
        );
      }else{
        subline = t2(
          `Сделано ${done}/20 · осталось ${remain} ${leftWordRu}. Идёшь к награде ровно, продолжай.`,
          `Done ${done}/20 · ${remain} left. You are on track for reward, keep going.`
        );
      }
      avatar = acc >= 80 ? '⟡' : '⟐';
    }else{
      const baseLine = t2(
        `Условие выполнено: 15+ правильных уже есть. Закрой ещё ${remain} ${leftWordRu} — и будет начисление.`,
        `Condition met: you already have 15+ correct. Finish ${remain} more tasks for reward credit.`
      );
      line = coachSelectLine(eventTalk, baseLine);
      subline = t2(
        `Текущая точность ${acc}%. Для I-bit þ постарайся удержать 85%+ к финалу.`,
        `Current accuracy is ${acc}%. Keep 85%+ by the end to aim for I-bit þ.`
      );
      avatar = '⟣';
      mood = 'hot';
    }

    chips.push(
      `${t2('◈ прогресс','◈ progress')}: ${done}/20`,
      `${t2('⟐ правильных','⟐ correct')}: ${correct}/15`,
      `${t2('⟁ точность','⟁ accuracy')}: ${acc}%`,
      `${t2('◉ примерная награда','◉ estimated')}: ${nowEco}`,
      acc >= 85 ? t2('I-bit þ: шанс высокий', 'I-bit þ: high chance') : t2('I-bit þ: цель 85%+', 'I-bit þ: target 85%+')
    );

    window.IKFarmCoach.update({
      owner: 'dictionary',
      active: true,
      title: t2('Farm HUB · Рейтинг', 'Farm HUB · Ranked'),
      line,
      subline,
      progressPct,
      chips,
      mood,
      avatar,
      hideLabel: t2('скрыть', 'hide'),
      stripLabel: 'Farm HUB ▾',
    });

    scheduleCoachIdleTalk(done, correct, remain, acc);
  }

  function quizUpdateScore(){
    const denom = (quizSessionTarget || quizDeck.length || 0);
    const prog = denom ? Math.min(quizSeen.size, denom) : 0;
    elQuizScore.textContent = `${prog}/${denom} | ${quizCorrect}/${quizTotal}`;
    coachUpdateFromQuiz();
  }

  async function maybeRewardQuizSession(){
    if(quizRewarded) return;
    if(!isRatedSource()) return;
    const cfg = cfgFromUI();
    if(String(cfg.session || '') !== '20') return;
    const denom = Number(quizSessionTarget || 0);
    if(denom !== 20) return;
    if(quizTotal < denom) return;

    const dictId = Number((elSectionQuiz && elSectionQuiz.value) || 0);
    if(!dictId) return;

    const client = getSupaClient();
    if(!client) return;

    try{
      quizRewarded = true;
      const { data, error } = await client.rpc('ik_award_study_session', {
        p_module: 'dictionary',
        p_dict_id: dictId,
        p_tasks: denom,
        p_correct: Number(quizCorrect || 0),
        p_unique_words: Number(quizSeen && quizSeen.size || 0),
        p_rated: true,
        p_source: dictSource
      });
      if(error) throw error;
      if(data && data.awarded){
        const eco = fmtEco(data.eco != null ? data.eco : 0);
        const ib = Number(data.ibit || 0);
        const extra = ib ? ` +${ib} I-bit þ` : '';
        const pct = denom ? Math.round((Number(quizCorrect || 0) / denom) * 100) : 0;
        quizSetFeedback('correct', 'reward', `награда: +${eco} EKO${extra}`);
        try{
          const pills = [];
          if(Number(eco) > 0) pills.push(`+${eco} EKO`);
          if(ib > 0) pills.push(`+${ib} I-bit þ`);
          document.dispatchEvent(new CustomEvent('ik:reward', {
            detail: {
              title: 'Награда',
              body: `словарь: сессия 20 заданий (${pct}%)`,
              pills,
              showToast: true,
            }
          }));
        }catch(_){ }
        try{
          if(window.IKFarmCoach && typeof window.IKFarmCoach.finish === 'function'){
            window.IKFarmCoach.finish({
              owner: 'dictionary',
              active:true,
              title: t2('Farm HUB · Рейтинг', 'Farm HUB · Ranked'),
              line: t2('Сессия зачтена. Награда залетела!', 'Session accepted. Reward credited!'),
              subline: t2('Продолжай в том же духе - серия решает.', 'Keep going - streak matters.'),
              progressPct: 100,
              chips: [
                `+${eco} EKO`,
                ib > 0 ? `+${ib} I-bit þ` : t2('I-bit þ: в этот раз 0', 'I-bit þ: 0 this time')
              ],
              mood: 'done',
              avatar: '⟢',
              hideLabel: t2('скрыть', 'hide'),
              stripLabel: 'Farm HUB ▾',
            });
          }
        }catch(_){ }
      }else if(data && data.reason){
        quizSetFeedback('idle', 'no reward', String(data.reason));
        coachUpdateFromQuiz();
      }
    }catch(e){
      quizRewarded = false;
    }
  }

  function setQuizMode(mode){
    quizCheckMode = mode;
    if(mode === 'next'){
      btnQuizCheckNext.textContent = 'далее';
      btnQuizCheckNext.title = 'Далее (Enter)';
    }else{
      btnQuizCheckNext.textContent = 'check';
      btnQuizCheckNext.title = 'Check (Enter)';
    }
  }


// -----------------------------
// MCQ UI injection + renderers
// -----------------------------
function mcqPosLabel(pos){
  if(pos === 'v') return 'v (verb)';
  if(pos === 'n') return 'n (noun)';
  if(pos === 'adj') return 'adj';
  if(pos === 'adv') return 'adv';
  return pos || '';
}

function ensurePracticeExtraSettingsUI(){
  if(!elPracticeSettings) return;

  // inject only once
  if(document.getElementById('dictPracticeTaskMode')){
    elPracticeTaskMode = document.getElementById('dictPracticeTaskMode');
    elPracticeMixInputPct = document.getElementById('dictPracticeMixInputPct');
    elPracticeMcqCount = document.getElementById('dictPracticeMcqCount');
    elPracticeShowPos = document.getElementById('dictPracticeShowPos');
    elPracticeSoftMcq = document.getElementById('dictPracticeSoftMcq');
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'ik-row';
  wrap.style.gap = '12px';
  wrap.style.flexWrap = 'wrap';
  wrap.style.marginTop = '10px';

  const mkLabel = (text)=>{
    const l = document.createElement('label');
    l.className = 'ik-label';
    l.textContent = text;
    return l;
  };

  const modeLabel = mkLabel('тип заданий');
  modeLabel.setAttribute('for', 'dictPracticeTaskMode');

  const modeSel = document.createElement('select');
  modeSel.className = 'ik-select';
  modeSel.id = 'dictPracticeTaskMode';
  modeSel.style.minWidth = '220px';
  modeSel.innerHTML =
    '<option value="input">Написание ответа</option>' +
    '<option value="mcq">Выбор правильного ответа</option>' +
    '<option value="mix">Микс</option>';

  const mixLabel = mkLabel('в миксе: % ввод');
  mixLabel.setAttribute('for', 'dictPracticeMixInputPct');

  const mixSel = document.createElement('select');
  mixSel.className = 'ik-select';
  mixSel.id = 'dictPracticeMixInputPct';
  mixSel.style.minWidth = '120px';
  mixSel.innerHTML =
    '<option value="50">50</option>' +
    '<option value="60">60</option>' +
    '<option value="70">70</option>' +
    '<option value="80">80</option>';

  const cntLabel = mkLabel('вариантов');
  cntLabel.setAttribute('for', 'dictPracticeMcqCount');

  const cntSel = document.createElement('select');
  cntSel.className = 'ik-select';
  cntSel.id = 'dictPracticeMcqCount';
  cntSel.style.minWidth = '120px';
  cntSel.innerHTML =
    '<option value="2">2</option>' +
    '<option value="3">3</option>' +
    '<option value="4">4</option>' +
    '<option value="5">5</option>' +
    '<option value="6">6</option>' +
    '<option value="7">7</option>' +
    '<option value="8">8</option>';

  const showPosLabel = document.createElement('label');
  showPosLabel.className = 'ik-label';
  showPosLabel.style.display = 'flex';
  showPosLabel.style.alignItems = 'center';
  showPosLabel.style.gap = '8px';
  const showPosCb = document.createElement('input');
  showPosCb.type = 'checkbox';
  showPosCb.id = 'dictPracticeShowPos';
  showPosLabel.appendChild(showPosCb);
  showPosLabel.appendChild(document.createTextNode('показывать (v)/(n)'));

  const softLabel = document.createElement('label');
  softLabel.className = 'ik-label';
  softLabel.style.display = 'flex';
  softLabel.style.alignItems = 'center';
  softLabel.style.gap = '8px';
  const softCb = document.createElement('input');
  softCb.type = 'checkbox';
  softCb.id = 'dictPracticeSoftMcq';
  softCb.checked = true;
  softLabel.appendChild(softCb);
  softLabel.appendChild(document.createTextNode('MCQ влияет мягче'));

  wrap.appendChild(modeLabel);
  wrap.appendChild(modeSel);
  wrap.appendChild(mixLabel);
  wrap.appendChild(mixSel);
  wrap.appendChild(cntLabel);
  wrap.appendChild(cntSel);
  wrap.appendChild(showPosLabel);
  wrap.appendChild(softLabel);

  // insert before the footnote inside settings
  const foot = elPracticeSettings.querySelector('.ik-footnote');
  if(foot) elPracticeSettings.insertBefore(wrap, foot);
  else elPracticeSettings.appendChild(wrap);

  elPracticeTaskMode = modeSel;
  elPracticeMixInputPct = mixSel;
  elPracticeMcqCount = cntSel;
  elPracticeShowPos = showPosCb;
  elPracticeSoftMcq = softCb;

  const applyVis = ()=>{
    const v = String(elPracticeTaskMode.value || 'mix');
    const showMix = (v === 'mix');
    if(mixLabel) mixLabel.style.display = showMix ? '' : 'none';
    if(mixSel) mixSel.style.display = showMix ? '' : 'none';
    const showMcq = (v === 'mcq' || v === 'mix');
    if(cntLabel) cntLabel.style.display = showMcq ? '' : 'none';
    if(cntSel) cntSel.style.display = showMcq ? '' : 'none';
    if(showPosLabel) showPosLabel.style.display = showMcq ? '' : 'none';
    if(softLabel) softLabel.style.display = showMcq ? '' : 'none';
  };
  modeSel.addEventListener('change', applyVis);
  applyVis();
}

function ensureLearnExtraSettingsUI(){
  if(!elLearnSettings) return;

  if(document.getElementById('dictLearnIntroMode')){
    elLearnIntroMode = document.getElementById('dictLearnIntroMode');
    elLearnIntroMcqCount = document.getElementById('dictLearnIntroMcqCount');
    elLearnIntroShowPos = document.getElementById('dictLearnIntroShowPos');
    return;
  }

  const row = document.createElement('div');
  row.className = 'ik-row';
  row.style.gap = '12px';
  row.style.flexWrap = 'wrap';
  row.style.marginTop = '10px';

  const mkLabel = (text)=>{
    const l = document.createElement('label');
    l.className = 'ik-label';
    l.textContent = text;
    return l;
  };

  const introLabel = mkLabel('этап 1');
  introLabel.setAttribute('for', 'dictLearnIntroMode');

  const introSel = document.createElement('select');
  introSel.className = 'ik-select';
  introSel.id = 'dictLearnIntroMode';
  introSel.style.minWidth = '220px';
  introSel.innerHTML =
    '<option value="card">Card</option>' +
    '<option value="mcq">Выбор правильного ответа</option>' +
    '<option value="mix">Mix</option>';

  const cntLabel = mkLabel('вариантов');
  cntLabel.setAttribute('for', 'dictLearnIntroMcqCount');

  const cntSel = document.createElement('select');
  cntSel.className = 'ik-select';
  cntSel.id = 'dictLearnIntroMcqCount';
  cntSel.style.minWidth = '120px';
  cntSel.innerHTML =
    '<option value="2">2</option>' +
    '<option value="3">3</option>' +
    '<option value="4">4</option>' +
    '<option value="5">5</option>' +
    '<option value="6">6</option>' +
    '<option value="7">7</option>' +
    '<option value="8">8</option>';

  const showPosLabel = document.createElement('label');
  showPosLabel.className = 'ik-label';
  showPosLabel.style.display = 'flex';
  showPosLabel.style.alignItems = 'center';
  showPosLabel.style.gap = '8px';
  const showPosCb = document.createElement('input');
  showPosCb.type = 'checkbox';
  showPosCb.id = 'dictLearnIntroShowPos';
  showPosLabel.appendChild(showPosCb);
  showPosLabel.appendChild(document.createTextNode('показывать (v)/(n)'));

  row.appendChild(introLabel);
  row.appendChild(introSel);
  row.appendChild(cntLabel);
  row.appendChild(cntSel);
  row.appendChild(showPosLabel);

  // insert before the footnote inside settings
  const foot = elLearnSettings.querySelector('.ik-footnote');
  if(foot) elLearnSettings.insertBefore(row, foot);
  else elLearnSettings.appendChild(row);


  // UI polish: move START button under the "этап 1" row
  (function(){
    const btn = document.getElementById('dictLearnRestart');
    if(!btn) return;
    if(btn.parentElement && btn.parentElement.id === 'dictLearnStartRow') return;

    const startRow = document.createElement('div');
    startRow.className = 'ik-row';
    startRow.id = 'dictLearnStartRow';
    startRow.style.justifyContent = 'flex-start';
    startRow.style.gap = '12px';
    startRow.style.marginTop = '10px';

    startRow.appendChild(btn);

    const foot2 = elLearnSettings.querySelector('.ik-footnote');
    if(foot2) elLearnSettings.insertBefore(startRow, foot2);
    else elLearnSettings.appendChild(startRow);
  })();

  elLearnIntroMode = introSel;
  elLearnIntroMcqCount = cntSel;
  elLearnIntroShowPos = showPosCb;

  const applyVis = ()=>{
    const v = String(elLearnIntroMode.value || 'card');
    const show = (v === 'mcq' || v === 'mix');
    cntLabel.style.display = show ? '' : 'none';
    cntSel.style.display = show ? '' : 'none';
    showPosLabel.style.display = show ? '' : 'none';
  };
  introSel.addEventListener('change', applyVis);
  applyVis();
}

function ensureMcqContainers(){
  // Practice
  if(elQuizInput && !document.getElementById('dictQuizMcqWrap')){
    const wrap = document.createElement('div');
    wrap.id = 'dictQuizMcqWrap';
    wrap.style.display = 'none';
    wrap.style.marginTop = '10px';

    const meta = document.createElement('p');
    meta.id = 'dictQuizMcqMeta';
    meta.className = 'ik-footnote ik-muted';
    meta.style.margin = '0';

    const btns = document.createElement('div');
    btns.id = 'dictQuizMcqButtons';
    btns.style.display = 'flex';
    btns.style.flexDirection = 'column';
    btns.style.gap = '8px';
    btns.style.marginTop = '8px';

    wrap.appendChild(meta);
    wrap.appendChild(btns);

    const row = elQuizInput.parentElement;
    if(row && row.parentNode) row.parentNode.insertBefore(wrap, row);

    elQuizMcqWrap = wrap;
    elQuizMcqMeta = meta;
    elQuizMcqButtons = btns;
  }else{
    elQuizMcqWrap = document.getElementById('dictQuizMcqWrap');
    elQuizMcqMeta = document.getElementById('dictQuizMcqMeta');
    elQuizMcqButtons = document.getElementById('dictQuizMcqButtons');
  }

  // Learn
  if(elLearnAnswerRow && !document.getElementById('dictLearnMcqWrap')){
    const wrap = document.createElement('div');
    wrap.id = 'dictLearnMcqWrap';
    wrap.style.display = 'none';
    wrap.style.marginTop = '10px';

    const meta = document.createElement('p');
    meta.id = 'dictLearnMcqMeta';
    meta.className = 'ik-footnote ik-muted';
    meta.style.margin = '0';

    const btns = document.createElement('div');
    btns.id = 'dictLearnMcqButtons';
    btns.style.display = 'flex';
    btns.style.flexDirection = 'column';
    btns.style.gap = '8px';
    btns.style.marginTop = '8px';

    wrap.appendChild(meta);
    wrap.appendChild(btns);

    if(elLearnAnswerRow.parentNode) elLearnAnswerRow.parentNode.insertBefore(wrap, elLearnAnswerRow);

    elLearnMcqWrap = wrap;
    elLearnMcqMeta = meta;
    elLearnMcqButtons = btns;
  }else{
    elLearnMcqWrap = document.getElementById('dictLearnMcqWrap');
    elLearnMcqMeta = document.getElementById('dictLearnMcqMeta');
    elLearnMcqButtons = document.getElementById('dictLearnMcqButtons');
  }
}

function mcqBtnApplyState(btn, state){
  if(!btn) return;
  // reset
  btn.style.border = '';
  btn.style.background = '';
  btn.style.opacity = '';
  if(state === 'correct'){
    btn.style.border = '2px solid #2ecc71';
    btn.style.background = 'rgba(46,204,113,0.16)';
  }else if(state === 'wrong'){
    btn.style.border = '2px solid #e74c3c';
    btn.style.background = 'rgba(231,76,60,0.16)';
  }else if(state === 'dim'){
    btn.style.opacity = '0.75';
  }
}

function quizDecideTaskKind(item, cfg){
  const key = practiceKey(item);
  if(key && quizModeOverrides && quizModeOverrides[key]){
    const v = quizModeOverrides[key];
    delete quizModeOverrides[key];
    return v;
  }
  const mode = String(cfg.taskMode || 'mix');
  if(mode === 'input') return 'input';
  if(mode === 'mcq') return 'mcq';
  // mix
  const pct = Number(cfg.mixInputPct);
  const p = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 60;
  return (Math.random() * 100 < p) ? 'input' : 'mcq';
}

function quizSetTaskUi(kind, cfg){
  quizTaskKind = kind;

  // default texts
  if(btnQuizSkip){
    btnQuizSkip.textContent = (kind === 'mcq') ? 'не знаю' : 'сдаюсь';
    btnQuizSkip.title = (kind === 'mcq')
      ? 'Показать правильный ответ (считается ошибкой)'
      : 'Показать ответ (считается ошибкой)';
  }

  if(kind === 'mcq'){
    if(elQuizMcqWrap) elQuizMcqWrap.style.display = '';
    if(elQuizInput) elQuizInput.style.display = 'none';
    if(btnPracticeHint) btnPracticeHint.style.display = 'none';
    if(elPracticeFuzzyActions) elPracticeFuzzyActions.style.display = 'none';

    // use "далее" button even in check mode
    quizCheckMode = 'check';
    btnQuizCheckNext.textContent = 'далее';
    btnQuizCheckNext.title = 'Далее (Enter)';
  }else{
    if(elQuizMcqWrap) elQuizMcqWrap.style.display = 'none';
    if(elQuizInput) elQuizInput.style.display = '';
    if(btnPracticeHint) btnPracticeHint.style.display = '';
    // button back to check
    setQuizMode('check');
  }
}

function quizRenderMcq(item, askLang, cfg){
  ensureMcqContainers();
  if(!elQuizMcqButtons || !elQuizMcqWrap) return;

  const answerLang = (askLang === 'en') ? 'ru' : 'en';
  const itemsPool = wordsForSelection(elSectionQuiz && elSectionQuiz.value);

  const built = mcqBuildOptions(item, askLang, answerLang, cfg.mcqCount, itemsPool, cfg);
  const n = built.n;
  const correct = built.correct;
  const distractors = shuffle(built.distractors || []);

  const correctIdx = mcqPickPos(mcqPosBagQuiz, n);
  const options = new Array(n);

  // place distractors
  let di = 0;
  for(let i=0;i<n;i++){
    if(i === correctIdx){
      options[i] = correct;
    }else{
      options[i] = distractors[di] || correct;
      di += 1;
    }
  }

  elQuizMcqButtons.innerHTML = '';
  const showPos = !!cfg.showPos;
  elQuizMcqMeta.textContent = showPos && correct.pos ? `часть речи: ${mcqPosLabel(correct.pos)}` : '';

  quizMcqState = { options, correctIdx, selectedIdx:-1, locked:false, askLang, answerLang, item };

  for(let i=0;i<n;i++){
    const opt = options[i];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ik-btn';
    btn.dataset.idx = String(i);
    const num = i + 1;
    btn.textContent = `${num}. ${opt.display || ''}`;
    btn.addEventListener('click', ()=> quizMcqSelect(i));
    elQuizMcqButtons.appendChild(btn);
  }

  quizSetFeedback('idle', 'ready', 'выбери вариант');
}

function quizMcqLock(){
  if(!quizMcqState) return;
  quizMcqState.locked = true;
  // disable buttons
  if(elQuizMcqButtons){
    const btns = Array.from(elQuizMcqButtons.querySelectorAll('button'));
    for(const b of btns) b.disabled = true;
  }
  quizFillBackAnswer(quizCurrent, quizAskLang, cfgFromUI());
  quizSetFlipped(true);
  quizCheckMode = 'next';
  btnQuizCheckNext.textContent = 'далее';
  btnQuizCheckNext.title = 'Далее (Enter)';
}

function quizMcqSelect(idx){
  if(!quizCurrent || !quizMcqState || quizMcqState.locked) return;

  const cfg = cfgFromUI();
  const i = Number(idx);
  quizMcqState.selectedIdx = i;

  const correctIdx = quizMcqState.correctIdx;
  const correctOpt = quizMcqState.options[correctIdx];
  const chosenOpt = quizMcqState.options[i];

  // highlight
  if(elQuizMcqButtons){
    const btns = Array.from(elQuizMcqButtons.querySelectorAll('button'));
    for(let k=0;k<btns.length;k++){
      if(k === correctIdx) mcqBtnApplyState(btns[k], 'correct');
      else if(k === i && i !== correctIdx) mcqBtnApplyState(btns[k], 'wrong');
      else mcqBtnApplyState(btns[k], 'dim');
    }
  }

  const isOk = (i === correctIdx);

  quizTotal += 1;
  if(isOk) quizCorrect += 1;
  quizUpdateScore();
  maybeRewardQuizSession().catch(()=>{});

  if(isOk){
    // MCQ counts weaker by default
    const bumpAs = (cfg.softMcq !== false) ? 'hard' : 'correct';
    practiceBump(quizCurrent, quizAskLang, bumpAs);
    if(Math.random() < 0.38) coachSignal('correct');
    quizSetFeedback('correct', 'ok', 'верно');
  }else{
    practiceBump(quizCurrent, quizAskLang, 'wrong');
    if(Math.random() < 0.38) coachSignal('wrong');

    // remember confusion
    mcqBumpConfusion(quizCurrent, quizAskLang, chosenOpt && chosenOpt.norm, correctOpt && correctOpt.norm);

    // return later
    const insertAt = Math.min(quizQueue.length, DICT_REASK_GAP);
    quizQueue.splice(insertAt, 0, quizCurrent);

    // in mix: after wrong MCQ, force next attempt as input
    const k = practiceKey(quizCurrent);
    if(k && String(cfg.taskMode || 'mix') === 'mix') quizModeOverrides[k] = 'input';

    quizSetFeedback('wrong', 'no', 'неверно - смотри ответ и жми далее');
  }

  quizMcqLock();
}

function quizMcqGiveUp(){
  if(!quizCurrent || !quizMcqState || quizMcqState.locked) return;

  const cfg = cfgFromUI();
  const correctIdx = quizMcqState.correctIdx;
  const correctOpt = quizMcqState.options[correctIdx];

  // highlight only correct
  if(elQuizMcqButtons){
    const btns = Array.from(elQuizMcqButtons.querySelectorAll('button'));
    for(let k=0;k<btns.length;k++){
      if(k === correctIdx) mcqBtnApplyState(btns[k], 'correct');
      else mcqBtnApplyState(btns[k], 'dim');
    }
  }

  quizTotal += 1;
  quizUpdateScore();
  maybeRewardQuizSession().catch(()=>{});

  practiceBump(quizCurrent, quizAskLang, 'wrong');
  if(Math.random() < 0.45) coachSignal('giveup');

  const insertAt = Math.min(quizQueue.length, DICT_REASK_GAP);
  quizQueue.splice(insertAt, 0, quizCurrent);

  const k = practiceKey(quizCurrent);
  if(k && String(cfg.taskMode || 'mix') === 'mix') quizModeOverrides[k] = 'input';

  quizSetFeedback('wrong', 'giveup', 'ответ показан - слово вернется позже');

  quizMcqLock();
}

function learnRenderIntroMcq(task, cfg){
  ensureMcqContainers();
  if(!elLearnMcqWrap || !elLearnMcqButtons || !task || !task.item) return;

  const askLang = task.askLang || learnChooseAskLang(task.item, cfg);
  const answerLang = (askLang === 'en') ? 'ru' : 'en';

  const itemsPool = wordsForSelection(elSectionLearn && elSectionLearn.value);
  const built = mcqBuildOptions(task.item, askLang, answerLang, cfg.introMcqCount, itemsPool, cfg);
  const n = built.n;
  const correct = built.correct;
  const distractors = shuffle(built.distractors || []);

  const correctIdx = mcqPickPos(mcqPosBagLearn, n);
  const options = new Array(n);

  let di = 0;
  for(let i=0;i<n;i++){
    if(i === correctIdx) options[i] = correct;
    else{
      options[i] = distractors[di] || correct;
      di += 1;
    }
  }

  elLearnMcqButtons.innerHTML = '';
  elLearnMcqMeta.textContent = (cfg.introShowPos && correct.pos) ? `часть речи: ${mcqPosLabel(correct.pos)}` : '';

  learnMcqState = { options, correctIdx, selectedIdx:-1, locked:false, askLang, answerLang, item: task.item };

  for(let i=0;i<n;i++){
    const opt = options[i];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ik-btn';
    btn.dataset.idx = String(i);
    const num = i + 1;
    btn.textContent = `${num}. ${opt.display || ''}`;
    btn.addEventListener('click', ()=> learnIntroMcqSelect(i));
    elLearnMcqButtons.appendChild(btn);
  }

  if(elLearnMcqWrap) elLearnMcqWrap.style.display = '';
}

function learnIntroMcqLock(){
  if(!learnMcqState) return;
  learnMcqState.locked = true;

  if(elLearnMcqButtons){
    const btns = Array.from(elLearnMcqButtons.querySelectorAll('button'));
    for(const b of btns) b.disabled = true;
  }

  learnSetFlipped(true);
  learnCheckMode = 'next';
  if(btnLearnCheckNext){ btnLearnCheckNext.textContent = 'далее'; btnLearnCheckNext.title = 'Далее (Enter)'; }
}

function learnIntroMcqSelect(idx){
  if(!learnCurrent || learnCurrent.type !== 'intro' || !learnMcqState || learnMcqState.locked) return;

  const i = Number(idx);
  learnMcqState.selectedIdx = i;

  const correctIdx = learnMcqState.correctIdx;
  const correctOpt = learnMcqState.options[correctIdx];
  const chosenOpt = learnMcqState.options[i];

  // highlight
  if(elLearnMcqButtons){
    const btns = Array.from(elLearnMcqButtons.querySelectorAll('button'));
    for(let k=0;k<btns.length;k++){
      if(k === correctIdx) mcqBtnApplyState(btns[k], 'correct');
      else if(k === i && i !== correctIdx) mcqBtnApplyState(btns[k], 'wrong');
      else mcqBtnApplyState(btns[k], 'dim');
    }
  }

  const isOk = (i === correctIdx);

  // intro MCQ does NOT mark learned, but it does affect future ordering
  const ws = learnWordState(learnCurrent.item);
  if(ws){
    ws.introSeen = true;
    ws.introWrong = ws.introWrong || 0;
    if(!isOk) ws.introWrong += 1;
  }

  if(isOk){
    learnSetFeedback('correct', 'ok', 'верно');
  }else{
    mcqBumpConfusion(learnCurrent.item, learnMcqState.askLang, chosenOpt && chosenOpt.norm, correctOpt && correctOpt.norm);
    learnSetFeedback('wrong', 'no', 'неверно - запомни и дальше');
    // make it appear earlier and more often in stage 2
    learnInsertTask({ type:'test', item: learnCurrent.item, round:1 }, 0, 2);
    learnInsertTask({ type:'test', item: learnCurrent.item, round:1 }, 6, 10);
  }

  learnIntroMcqLock();
}

function learnIntroMcqGiveUp(){
  if(!learnCurrent || learnCurrent.type !== 'intro' || !learnMcqState || learnMcqState.locked) return;

  const correctIdx = learnMcqState.correctIdx;

  if(elLearnMcqButtons){
    const btns = Array.from(elLearnMcqButtons.querySelectorAll('button'));
    for(let k=0;k<btns.length;k++){
      if(k === correctIdx) mcqBtnApplyState(btns[k], 'correct');
      else mcqBtnApplyState(btns[k], 'dim');
    }
  }

  const ws = learnWordState(learnCurrent.item);
  if(ws){
    ws.introSeen = true;
    ws.introWrong = (ws.introWrong || 0) + 1;
  }

  learnSetFeedback('wrong', 'giveup', 'ответ показан - дальше');
  learnInsertTask({ type:'test', item: learnCurrent.item, round:1 }, 0, 2);
  learnInsertTask({ type:'test', item: learnCurrent.item, round:1 }, 6, 10);

  learnIntroMcqLock();
}

function isPracticePanelActive(){
  return dictPanelQuiz && !dictPanelQuiz.hidden;
}
function isLearnPanelActive(){
  return dictPanelLearn && !dictPanelLearn.hidden;
}

function handleMcqHotkeys(e){
  const key = e.key;

  // number keys for MCQ selection
  if(key >= '1' && key <= '8'){
    const num = Number(key);
    if(isPracticePanelActive() && quizTaskKind === 'mcq' && quizMcqState && !quizMcqState.locked){
      e.preventDefault();
      const idx = num - 1;
      if(idx >= 0 && idx < (quizMcqState.options || []).length) quizMcqSelect(idx);
      return;
    }
    if(isLearnPanelActive() && learnCurrent && learnCurrent.type === 'intro' && learnMcqState && !learnMcqState.locked){
      e.preventDefault();
      const idx = num - 1;
      if(idx >= 0 && idx < (learnMcqState.options || []).length) learnIntroMcqSelect(idx);
      return;
    }
  }

  // Enter -> next in MCQ
  if(key === 'Enter'){
    if(isPracticePanelActive() && quizTaskKind === 'mcq'){
      // let button handler run
      return;
    }
    if(isLearnPanelActive() && learnCurrent && learnCurrent.type === 'intro' && learnMcqState){
      // let button handler run
      return;
    }
  }
}

  function buildCounts(){
    if(isPublicSource()){
      // Keep catalog counts for all public dictionaries.
      // When we lazily load words for a dict, just ensure its count is correct.
      if(!(dictCounts instanceof Map) || dictCounts.size === 0){
        dictCounts = publicCounts[dictSource] || new Map();
      }
      const sid = Number(publicLoadedDictId || 0);
      if(sid) dictCounts.set(sid, Number(dictWordsAll.length || 0));
      return;
    }

    dictCounts = new Map();
    for(const s of dictSections){
      dictCounts.set(Number(s.id), 0);
    }
    for(const w of dictWordsAll){
      const sid = Number(w.sectionId);
      dictCounts.set(sid, (dictCounts.get(sid) || 0) + 1);
    }
  }

  function getSectionNameById(id){
    const s = dictSections.find(x => Number(x.id) === Number(id));
    return s ? s.name : 'section';
  }

  function updateGlobalBadges(){
    setAdminText(elDictDbNameLine, `db: ${dictDbName()}`);
    elDictCountBadge.textContent = `words: ${dictWordsAll.length}`;
  }

  function isPublicSource(){
    return dictSource === 'system' || dictSource === 'user';
  }

  function isRatedSource(){
    return isPublicSource();
  }

  function getSupaClient(){
    try{
      if(!(window.IKSupabase && typeof window.IKSupabase.getClient === 'function')) return null;
      return window.IKSupabase.getClient();
    }catch(_){
      return null;
    }
  }

  function localCurrentUser(){
    try{
      const raw = localStorage.getItem('itemkey.currentUser');
      return raw ? JSON.parse(raw) : null;
    }catch(_){
      return null;
    }
  }

  function canEditCurrentSource(){
    if(dictSource === 'personal') return !dictPersonalGuest;
    if(dictSource === 'system' || dictSource === 'user') return !!dictRuntime.isAdmin;
    return false;
  }

  function canUseBuilderForCurrentSource(){
    return canEditCurrentSource();
  }

  async function refreshDictAdminAccess(){
    if(dictRuntime.refreshingAdmin) return;
    dictRuntime.refreshingAdmin = true;
    try{
      let isAdmin = false;
      const localUser = localCurrentUser();
      const localEmail = String(localUser && localUser.email || '').trim().toLowerCase();
      if(localUser && localUser.isAdmin === true) isAdmin = true;
      if(!isAdmin && localEmail && DICT_ADMIN_EMAILS.includes(localEmail)) isAdmin = true;

      const client = getSupaClient();
      if(client && client.auth && typeof client.auth.getUser === 'function'){
        try{
          const out = await client.auth.getUser();
          const cloudEmail = String(out && out.data && out.data.user && out.data.user.email || '').trim().toLowerCase();
          if(cloudEmail && DICT_ADMIN_EMAILS.includes(cloudEmail)) isAdmin = true;
        }catch(_){ }
      }

      if(!isAdmin && client){
        try{
          const out = await client.rpc('ik_can_open_admin_console');
          if(out && out.data === true) isAdmin = true;
        }catch(_){ }
      }

      const changed = dictRuntime.isAdmin !== isAdmin;
      dictRuntime.isAdmin = isAdmin;
      if(changed){
        applyDictSourceAccess();
        if(!canUseBuilderForCurrentSource() && dictPanelBuilder && !dictPanelBuilder.hidden){
          dictShowFirstPick();
        }
        renderFirstPickUI();
        if(elDictSubtabsWrap && !elDictSubtabsWrap.hidden && dictPanelBuilder && !dictPanelBuilder.hidden){
          renderWordsUI();
        }
      }
    }finally{
      dictRuntime.refreshingAdmin = false;
    }
  }

  function scheduleAdminAccessRefresh(){
    const marks = [250, 900, 1800, 3200, 5200];
    for(const ms of marks){
      window.setTimeout(()=>{
        refreshDictAdminAccess().catch(()=>{});
      }, ms);
    }
  }

  function stockNameKey(v){
    return normalize(String(v || '').trim());
  }

  function hasStockName(name){
    return STOCK_SECTION_KEYS.has(stockNameKey(name));
  }

  async function clearStockFromLocal(){
    if(!dictDb) return 0;
    if(!Array.isArray(dictSections) || !dictSections.length) await dictRefreshAll();
    const target = dictSections.filter((s)=> hasStockName(s.nameKey || s.name));
    if(!target.length) return 0;
    for(const sec of target){
      await dictDeleteSection(dictDb, Number(sec.id));
    }
    await dictRefreshAll();
    return target.length;
  }

  async function clearStockFromRemote(){
    const client = getSupaClient();
    if(!client) return 0;
    const u = await client.auth.getUser();
    const uid = u && u.data && u.data.user ? u.data.user.id : null;
    if(!uid) return 0;

    const { data: remoteSecs, error: secErr } = await client
      .from('sh_dictionary_sections')
      .select('id,name,name_key')
      .eq('owner_id', uid);
    if(secErr) throw secErr;

    const ids = (remoteSecs || [])
      .filter((s)=> hasStockName(s.name_key || s.name))
      .map((s)=> Number(s.id || 0))
      .filter((n)=> n > 0);
    if(!ids.length) return 0;

    const { error: wErr } = await client
      .from('sh_dictionary_words')
      .delete()
      .eq('owner_id', uid)
      .in('section_id', ids);
    if(wErr) throw wErr;

    const { error: sErr } = await client
      .from('sh_dictionary_sections')
      .delete()
      .eq('owner_id', uid)
      .in('id', ids);
    if(sErr) throw sErr;

    return ids.length;
  }

  async function ensureStockCleanupOnce(){
    // Always enforce cleanup for legacy local stock dictionaries.
    // This guarantees personal source stays truly personal/cloud-only.
    for(let pass = 0; pass < 2; pass += 1){
      let removedRemote = 0;
      let removedLocal = 0;
      try{ removedRemote = await clearStockFromRemote(); }catch(_){ }
      try{ removedLocal = await clearStockFromLocal(); }catch(_){ }
      await dictRefreshAll();
      const stillLocal = (dictSections || []).some((s)=> hasStockName(s.nameKey || s.name));
      if(!stillLocal && removedRemote <= 0 && removedLocal <= 0) break;
    }
  }

  async function ensurePublicCatalog(kind){
    const k = (kind === 'system') ? 'system' : 'user';
    if(Array.isArray(publicCatalog[k]) && publicCatalog[k].length) return publicCatalog[k];
    const client = getSupaClient();
    if(!client) throw new Error('Supabase not available');

    const { data, error } = await client
      .from('ik_public_dict_catalog')
      .select('id,title,title_key,dict_type,owner_id,current_version_id,words_count,updated_at')
      .eq('dict_type', k)
      .order('updated_at', { ascending:false });

    if(error) throw error;
    const rows = Array.isArray(data) ? data : [];

    publicCatalog[k] = rows.map((r)=>({
      id: Number(r.id),
      name: String(r.title || 'dictionary').trim(),
      nameKey: String(r.title_key || r.title || '').trim().toLowerCase(),
      dictType: String(r.dict_type || k),
      ownerId: r.owner_id || null,
      currentVersionId: r.current_version_id || null,
      updatedAt: r.updated_at || null,
      wordsCount: Number(r.words_count || 0)
    })).filter((r)=> r.id && r.name);

    publicCounts[k] = new Map(publicCatalog[k].map((r)=> [Number(r.id), Number(r.wordsCount || 0)]));
    return publicCatalog[k];
  }

  async function ensurePublicWords(kind, dictId){
    const k = (kind === 'system') ? 'system' : 'user';
    const id = Number(dictId || 0);
    if(!id) return [];
    const cached = publicWordsCache[k].get(id);
    if(Array.isArray(cached) && cached.length) return cached;

    const client = getSupaClient();
    if(!client) throw new Error('Supabase not available');

    const { data, error } = await client
      .from('ik_public_dict_current_words')
      .select('id,dict_id,en,ru')
      .eq('dict_id', id)
      .order('id', { ascending:true });

    if(error) throw error;
    const rows = Array.isArray(data) ? data : [];
    const words = rows.map((w)=>({
      id: w.id,
      sectionId: Number(w.dict_id || id),
      en: String(w.en || '').trim(),
      ru: String(w.ru || '').trim(),
    })).filter((w)=> w.sectionId && w.en && w.ru);

    publicWordsCache[k].set(id, words);
    return words;
  }

  async function dictEnsureSectionLoaded(sectionValue){
    if(!isPublicSource()) return true;
    const v = String(sectionValue || '').trim();
    if(v === 'All'){
      if(publicLoadedDictId === 'All' && Array.isArray(dictWordsAll) && dictWordsAll.length) return true;
      const ids = (dictSections || []).map((s)=> Number(s.id || 0)).filter((n)=> n > 0);
      if(!ids.length){
        dictWordsAll = [];
        publicLoadedDictId = 'All';
        buildCounts();
        updateGlobalBadges();
        return true;
      }
      const chunks = [];
      for(const id of ids){
        try{
          const words = await ensurePublicWords(dictSource, id);
          if(Array.isArray(words) && words.length) chunks.push(...words);
        }catch(_){ }
      }
      dictWordsAll = chunks;
      publicLoadedDictId = 'All';
      buildCounts();
      updateGlobalBadges();
      return true;
    }
    const sid = Number(v || 0);
    if(!sid) return true;
    if(publicLoadedDictId === sid && Array.isArray(dictWordsAll) && dictWordsAll.length) return true;
    const words = await ensurePublicWords(dictSource, sid);
    dictWordsAll = words;
    publicLoadedDictId = sid;
    buildCounts();
    updateGlobalBadges();
    return true;
  }

  function dictShowFirstPick(){
    if(elDictFirstPick) elDictFirstPick.hidden = false;
    if(elDictSubtabsWrap) elDictSubtabsWrap.hidden = true;
    if(elFirstPickSearch){
      elFirstPickSearch.value = '';
      renderFirstPickUI();
      try{ elFirstPickSearch.focus({ preventScroll:true }); }catch(_){}
    }else{
      renderFirstPickUI();
    }
  }

  function dictOpenConstructorFromPick(){
    if(!canUseBuilderForCurrentSource()) return;
    if(elDictFirstPick) elDictFirstPick.hidden = true;
    if(elDictSubtabsWrap) elDictSubtabsWrap.hidden = false;
    dictSetSubtab('builder');
    renderWordsUI();
  }

  
  let dictCurrentSection = '';

  function dictSetCurrentSection(sectionValue){
    const v = String(sectionValue || '').trim();
    if(!v) return;
    dictCurrentSection = v;
    try{ localStorage.setItem('dict_last_section', v); }catch(_e){}

    if(elSectionCards && elSectionCards.value !== v) elSectionCards.value = v;
    if(elSectionQuiz && elSectionQuiz.value !== v) elSectionQuiz.value = v;
    if(elSectionLearn && elSectionLearn.value !== v) elSectionLearn.value = v;
    if(elSectionView && elSectionView.value !== v) elSectionView.value = v;
    if(elSectionBuilder && v !== 'All' && elSectionBuilder.value !== v) elSectionBuilder.value = v;
  }

 async function dictEnterSection(sectionValue, startTab){
    const v = String(sectionValue || '').trim();
    if(!v) return;

    await dictEnsureSectionLoaded(v);
    dictSetCurrentSection(v);

    if(elDictFirstPick) elDictFirstPick.hidden = true;
    if(elDictSubtabsWrap) elDictSubtabsWrap.hidden = false;

    if(startTab === 'practice' || startTab === 'quiz'){
      dictSetSubtab('practice');
      dictResetQuiz();
      return;
    }
    if(startTab === 'learn'){
      dictSetSubtab('learn');
      learnStartSession(true);
      return;
    }
    if(startTab === 'view'){
      dictSetSubtab('view');
      renderViewUI();
      return;
    }
    if(startTab === 'builder'){
      dictSetSubtab('builder');
      renderWordsUI();
      return;
    }

    dictSetSubtab('cards');
    dictResetCards();
  }

  function ensureDictSourceTabsUI(){
    if(!elDictFirstPick) return;
    if(document.getElementById('dictSourceTabs')) return;

    const wrap = document.createElement('div');
    wrap.id = 'dictSourceTabs';
    wrap.className = 'ik-tabs';
    wrap.style.marginTop = '10px';

    const mk = (key, label)=>{
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ik-tab';
      b.setAttribute('data-dict-source', key);
      b.textContent = label;
      b.setAttribute('aria-selected', String(dictSource === key));
      return b;
    };

    wrap.appendChild(mk('personal','личные'));
    wrap.appendChild(mk('system','системные'));
    wrap.appendChild(mk('user','пользовательские'));

    const sub = elDictFirstPick.querySelector('.ik-sub');
    if(sub && sub.parentNode){
      sub.parentNode.insertBefore(wrap, sub.nextSibling);
    }else{
      elDictFirstPick.insertBefore(wrap, elDictFirstPick.firstChild || null);
    }
  }

  function applyDictSourceAccess(){
    const editable = canEditCurrentSource();
    const isPersonalEditable = dictSource === 'personal' && editable;
    const isPublicAdminEditable = isPublicSource() && editable;
    if(dictTabBuilder) dictTabBuilder.style.display = editable ? '' : 'none';
    if(btnFirstPickOpenConstructor) btnFirstPickOpenConstructor.style.display = editable ? '' : 'none';

    if(btnAddSection) btnAddSection.disabled = !isPersonalEditable;
    if(btnDeleteSection) btnDeleteSection.disabled = !isPersonalEditable;
    if(btnDictExport) btnDictExport.disabled = !isPersonalEditable;
    if(btnDictImport) btnDictImport.disabled = !isPersonalEditable;
    if(btnAddWord) btnAddWord.disabled = !editable;
    if(elNewSectionName) elNewSectionName.disabled = !isPersonalEditable;
    if(elEnInput) elEnInput.disabled = !editable;
    if(elRuInput) elRuInput.disabled = !editable;
    if(elDictImportReplace) elDictImportReplace.disabled = !isPersonalEditable;
    if(btnSubmitModeration){
      if(isPersonalEditable){
        btnSubmitModeration.style.display = '';
        btnSubmitModeration.textContent = 'на модерацию';
        btnSubmitModeration.title = 'Отправить текущий section на модерацию';
      }else if(isPublicAdminEditable){
        btnSubmitModeration.style.display = '';
        btnSubmitModeration.textContent = 'сохранить в cloud';
        btnSubmitModeration.title = 'Сохранить изменения текущего словаря';
      }else{
        btnSubmitModeration.style.display = 'none';
      }
    }

    const tabs = document.querySelectorAll('#dictSourceTabs [data-dict-source]');
    tabs.forEach((t)=>{
      const k = t.getAttribute('data-dict-source');
      t.setAttribute('aria-selected', String(k === dictSource));
      t.classList.toggle('is-active', k === dictSource);
    });
  }

  async function dictSetSource(next){
    await refreshDictAdminAccess();
    const allowed = ['personal','system','user'];
    const k = allowed.includes(String(next || '')) ? String(next) : 'personal';
    dictSource = k;
    if(window.IKFarmCoach && typeof window.IKFarmCoach.hide === 'function'){
      window.IKFarmCoach.hide();
    }
    publicLoadedDictId = null;
    dictCurrentSection = '';
    quizRewarded = false;
    try{ localStorage.setItem('student_helper_dict_source_v1', dictSource); }catch(_){ }

    if(dictSource === 'personal'){
      dictPersonalGuest = false;
      const client = getSupaClient();
      if(client && client.auth && typeof client.auth.getUser === 'function'){
        try{
          const out = await client.auth.getUser();
          const user = out && out.data && out.data.user ? out.data.user : null;
          if(!user){
            dictSections = [];
            dictWordsAll = [];
            dictCounts = new Map();
            dictPersonalGuest = true;
            updateGlobalBadges();
            renderSectionsUI();
            dictShowFirstPick();
            applyDictSourceAccess();
            return;
          }
        }catch(_){ }
      }

      await ensureStockCleanupOnce();
      await dictRefreshAll();
      buildCounts();
      updateGlobalBadges();
      renderSectionsUI();
      dictShowFirstPick();
      applyDictSourceAccess();
      return;
    }

    try{
      const cat = await ensurePublicCatalog(dictSource);
      dictSections = cat.map((d)=>({ id: d.id, name: d.name, nameKey: d.nameKey }));
      dictCounts = publicCounts[dictSource] || new Map();
      dictWordsAll = [];
      updateGlobalBadges();
      renderSectionsUI();
      dictShowFirstPick();
      applyDictSourceAccess();
    }catch(e){
      console.error(e);
      // keep current source and show previous data if available
      alert(`Не удалось загрузить раздел: ${e && (e.message || e)}`);
      throw e;
    }
  }

  async function dictSelectSectionAndRun(sectionValue, fn){
    const v = String(sectionValue || '').trim();
    if(!v) return;
    await dictEnsureSectionLoaded(v);
    dictSetCurrentSection(v);
    if(typeof fn === 'function') fn();
  }

  async function submitCurrentSectionToModeration(){
    if(dictSource !== 'personal') return;
    const sid = Number(elSectionBuilder && elSectionBuilder.value || 0);
    if(!sid){
      alert('Выбери section.');
      return;
    }
    const title = getSectionNameById(sid);
    const words = dictWordsAll
      .filter((w)=> Number(w.sectionId) === sid)
      .map((w)=>({ en: String(w.en || '').trim(), ru: String(w.ru || '').trim() }))
      .filter((w)=> w.en && w.ru);
    if(words.length < 5){
      alert('Слишком мало слов для модерации (минимум 5).');
      return;
    }

    const client = getSupaClient();
    if(!client){
      alert('Supabase недоступен на этой странице.');
      return;
    }

    let targetDictId = null;
    try{
      const u = await client.auth.getUser();
      const uid = u && u.data && u.data.user ? u.data.user.id : null;
      if(uid){
        const { data } = await client
          .from('ik_public_dicts')
          .select('id,title,updated_at')
          .eq('owner_id', uid)
          .eq('dict_type', 'user')
          .order('updated_at', { ascending:false })
          .limit(20);
        const list = Array.isArray(data) ? data : [];
        if(list.length){
          const lines = list.map((x)=> `#${x.id}: ${x.title}`).join('\n');
          const wantsUpdate = confirm(`Отправить как обновление опубликованного словаря?\n\nOK = обновление\nCancel = новая публикация\n\nТвои словари:\n${lines}`);
          if(wantsUpdate){
            const raw = prompt('Введи ID словаря для обновления (число):', String(list[0].id));
            const n = Number(raw || 0);
            if(Number.isFinite(n) && n > 0) targetDictId = n;
          }
        }
      }
    }catch(_){ }

    try{
      const { data, error } = await client.rpc('ik_submit_dict_publish_request', {
        p_title: title,
        p_words: words,
        p_target_dict_id: targetDictId,
      });
      if(error) throw error;
      alert(`Отправлено на модерацию. request_id=${data}`);
    }catch(e){
      alert(`Ошибка отправки: ${e && (e.message || e)}`);
    }
  }

  function renderFirstPickUI(){
    if(!elFirstPickList) return;

    if(dictSource === 'personal' && dictPersonalGuest){
      elFirstPickList.innerHTML = '';
      const li = document.createElement('li');
      li.innerHTML = `<p class="ik-itemline"><b>войдите, чтобы видеть личные словари</b></p>`;
      elFirstPickList.appendChild(li);
      return;
    }

    const q = String(elFirstPickSearch && elFirstPickSearch.value || '').trim().toLowerCase();

    const totalCount = isPublicSource()
      ? Array.from((dictCounts && typeof dictCounts.values === 'function') ? dictCounts.values() : []).reduce((sum, n)=> sum + Number(n || 0), 0)
      : dictWordsAll.length;

    const items = [];
    items.push({ sid:'All', name:'All (все разделы)', count: totalCount });

    dictSections
      .slice()
      .sort((a,b)=> a.name.localeCompare(b.name, 'ru'))
      .forEach((s)=>{
        const sid = String(s.id);
        const count = dictCounts.get(Number(s.id)) || 0;
        items.push({ sid, name:s.name, count });
      });

    const filtered = items.filter(it => !q || String(it.name).toLowerCase().includes(q));

    elFirstPickList.innerHTML = '';
    if(!filtered.length){
      const li = document.createElement('li');
      li.innerHTML = `<p class="ik-itemline"><b>ничего не найдено</b></p>`;
      elFirstPickList.appendChild(li);
      return;
    }

    for(const it of filtered){
      const li = document.createElement('li');
      li.className = 'is-clickable';

      const left = document.createElement('div');
      left.innerHTML = `<p class="ik-itemline"><b>${escapeHTML(it.name)}</b> <span class="ik-muted">(${it.count})</span></p>`;

      const right = document.createElement('div');
      right.className = 'ik-mini';

      const btnView = document.createElement('button');
      btnView.className = 'ik-btn';
      btnView.type = 'button';
      btnView.textContent = 'просмотр';
      btnView.addEventListener('click', (e)=>{
        e.stopPropagation();
        dictEnterSection(it.sid, 'view');
      });

      right.appendChild(btnView);

      const btnCards = document.createElement('button');
      btnCards.className = 'ik-btn ik-btn--black';
      btnCards.type = 'button';
      btnCards.textContent = 'cards';
      btnCards.addEventListener('click', (e)=>{
        e.stopPropagation();
        dictEnterSection(it.sid, 'cards');
      });

      right.appendChild(btnCards);


      const btnLearn = document.createElement('button');
      btnLearn.className = 'ik-btn';
      btnLearn.type = 'button';
      btnLearn.textContent = 'learn';
      btnLearn.addEventListener('click', (e)=>{
        e.stopPropagation();
        dictEnterSection(it.sid, 'learn');
      });
      right.appendChild(btnLearn);

      const btnPractice = document.createElement('button');
      btnPractice.className = 'ik-btn';
      btnPractice.type = 'button';
      btnPractice.textContent = 'practice';
      btnPractice.addEventListener('click', (e)=>{
        e.stopPropagation();
        dictEnterSection(it.sid, 'practice');
      });

      right.appendChild(btnPractice);
li.appendChild(left);
      li.appendChild(right);
      li.addEventListener('click', ()=> dictEnterSection(it.sid, 'cards'));

      elFirstPickList.appendChild(li);
    }
  }

  function renderSectionsUI(){
    const opts = [];
    for(const s of dictSections){
      const sid = Number(s.id);
      const count = dictCounts.get(sid) || 0;
      opts.push({ value: String(sid), label: `${s.name} (${count})` });
    }

    function fillSelect(sel, includeAll){
      const prev = sel.value;
      sel.innerHTML = '';

      const ph = document.createElement('option');
      ph.value = '';
      ph.textContent = 'choose section...';
      sel.appendChild(ph);

      if(includeAll){
        const o = document.createElement('option');
        o.value = 'All';
        o.textContent = `All (${dictWordsAll.length})`;
        sel.appendChild(o);
      }
      for(const odef of opts){
        const o = document.createElement('option');
        o.value = odef.value;
        o.textContent = odef.label;
        sel.appendChild(o);
      }

      if(prev && Array.from(sel.options).some(o => o.value === prev)){
        sel.value = prev;
      }else{
        sel.value = '';
      }
    }

    fillSelect(elSectionCards, true);
    fillSelect(elSectionQuiz, true);
    fillSelect(elSectionLearn, true);
    if(elSectionView) fillSelect(elSectionView, true);
    fillSelect(elSectionBuilder, false);

    renderFirstPickUI();
    renderViewUI();

    elSectionList.innerHTML = '';
    if(!dictSections.length){
      const li = document.createElement('li');
      li.innerHTML = `<p class="ik-itemline"><b>пусто</b></p>`;
      elSectionList.appendChild(li);
      return;
    }

    dictSections
      .slice()
      .sort((a,b)=> a.name.localeCompare(b.name, 'ru'))
      .forEach((s)=>{
        const sid = Number(s.id);
        const count = dictCounts.get(sid) || 0;
        const li = document.createElement('li');

        const left = document.createElement('div');
        left.innerHTML = `<p class="ik-itemline"><b>${escapeHTML(s.name)}</b> <span class="ik-muted">(${count})</span></p>`;

        const right = document.createElement('div');
        right.className = 'ik-mini';

        const btnOpen = document.createElement('button');
        btnOpen.className = 'ik-btn ik-btn--black';
        btnOpen.type = 'button';
        btnOpen.textContent = 'open';
        btnOpen.addEventListener('click', ()=>{
          elSectionBuilder.value = String(sid);
          renderWordsUI();
          dictSetSubtab('builder');
        });

        right.appendChild(btnOpen);
        li.appendChild(left);
        li.appendChild(right);
        elSectionList.appendChild(li);
      });
  }

  function wordsForSelection(value){
    const v = String(value || '').trim();
    if(!v) return [];
    if(v === 'All') return [...dictWordsAll];
    const sid = Number(v);
    if(!sid) return [];
    return dictWordsAll.filter(w => Number(w.sectionId) === sid);
  }

  function renderViewUI(){
    if(!elViewList || !elViewMeta || !elSectionView) return;

    const selected = String((elSectionView && elSectionView.value) || dictCurrentSection || '').trim();
    if(!selected){
      elViewList.innerHTML = '';
      const li = document.createElement('li');
      li.innerHTML = `<p class="ik-itemline"><b>выбери section</b></p>`;
      elViewList.appendChild(li);
      elViewMeta.textContent = '0';
      return;
    }

    const all = wordsForSelection(selected)
      .slice()
      .sort((a,b)=> (a.en || '').localeCompare((b.en || ''), 'en'));
    const q = String(elViewSearch && elViewSearch.value || '').trim().toLowerCase();
    const filtered = q
      ? all.filter((w)=> String(w.en || '').toLowerCase().includes(q) || String(w.ru || '').toLowerCase().includes(q))
      : all;

    elViewList.innerHTML = '';
    if(!filtered.length){
      const li = document.createElement('li');
      li.innerHTML = `<p class="ik-itemline"><b>ничего не найдено</b></p>`;
      elViewList.appendChild(li);
      elViewMeta.textContent = `показано 0 из ${all.length}`;
      return;
    }

    for(const w of filtered){
      const li = document.createElement('li');
      li.innerHTML = `<p class="ik-itemline"><b>${escapeHTML(w.en)}</b> - ${escapeHTML(w.ru)}</p>`;
      elViewList.appendChild(li);
    }

    elViewMeta.textContent = `показано ${filtered.length} из ${all.length}`;
  }

  function renderWordsUI(){
    if(isPublicSource() && !dictRuntime.isAdmin){
      if(elSectionList) elSectionList.innerHTML = '';
      if(elWordList) elWordList.innerHTML = '';
      const li = document.createElement('li');
      li.innerHTML = `<p class="ik-itemline"><b>read-only</b> <span class="ik-muted">конструктор доступен только администратору</span></p>`;
      if(elWordList) elWordList.appendChild(li);
      return;
    }

    const sid = Number(elSectionBuilder.value || 0);
    const list = dictWordsAll
      .filter(w => Number(w.sectionId) === sid)
      .sort((a,b)=> (a.en || '').localeCompare((b.en || ''), 'en'));

    elWordList.innerHTML = '';

    if(!sid){
      const li = document.createElement('li');
      li.innerHTML = `<p class="ik-itemline"><b>выбери раздел</b></p>`;
      elWordList.appendChild(li);
      return;
    }

    if(!list.length){
      const li = document.createElement('li');
      li.innerHTML = `<p class="ik-itemline"><b>пусто</b> <span class="ik-muted">добавь слова выше</span></p>`;
      elWordList.appendChild(li);
      return;
    }

    for(const w of list){
      const li = document.createElement('li');

      const left = document.createElement('div');
      left.innerHTML = `<p class="ik-itemline"><b>${escapeHTML(w.en)}</b> - ${escapeHTML(w.ru)}</p>`;

      const right = document.createElement('div');
      right.className = 'ik-mini';

      const btnDel = document.createElement('button');
      btnDel.className = 'ik-btn';
      btnDel.type = 'button';
      btnDel.textContent = 'удалить';
      btnDel.addEventListener('click', async ()=>{
        try{
          if(isPublicSource()){
            dictWordsAll = dictWordsAll.filter((x)=> Number(x.id) !== Number(w.id));
            publicCounts[dictSource].set(Number(w.sectionId), dictWordsAll.filter((x)=> Number(x.sectionId) === Number(w.sectionId)).length);
            updateGlobalBadges();
          }else{
            await dictDeleteWord(dictDb, w.id);
            await dictRefreshAll();
          }
          renderWordsUI();
          renderViewUI();
          dictResetCards();
          dictResetQuiz();
        }catch(e){
          alert(`Ошибка удаления: ${e.message || e}`);
        }
      });

      right.appendChild(btnDel);
      li.appendChild(left);
      li.appendChild(right);
      elWordList.appendChild(li);
    }
  }

  async function savePublicBuilderSection(){
    if(!isPublicSource() || !dictRuntime.isAdmin) return;
    const sid = Number(elSectionBuilder && elSectionBuilder.value || 0);
    if(!sid){
      alert('Сначала выбери словарь.');
      return;
    }

    const title = getSectionNameById(sid);
    const rows = dictWordsAll
      .filter((w)=> Number(w.sectionId) === sid)
      .map((w)=>({ en: String(w.en || '').trim(), ru: String(w.ru || '').trim() }))
      .filter((w)=> w.en && w.ru);

    const uniq = [];
    const seen = new Set();
    for(const w of rows){
      const key = `${normEnCmp(w.en)}|${normRuCmp(w.ru)}`;
      if(seen.has(key)) continue;
      seen.add(key);
      uniq.push(w);
    }

    if(!uniq.length){
      alert('В словаре нет слов для сохранения.');
      return;
    }

    const client = getSupaClient();
    if(!client){
      alert('Supabase недоступен на этой странице.');
      return;
    }

    const payload = { p_title: title, p_words: uniq, p_dict_id: sid };
    try{
      let out;
      if(dictSource === 'system'){
        out = await client.rpc('ik_admin_create_system_dict', payload);
      }else{
        out = await client.rpc('ik_admin_update_user_dict', payload);
      }
      if(out && out.error) throw out.error;

      publicWordsCache[dictSource].delete(sid);
      publicCatalog[dictSource] = [];
      publicCounts[dictSource] = new Map();
      await dictSetSource(dictSource);
      await dictEnterSection(String(sid), 'builder');
      alert('Словарь обновлен.');
    }catch(e){
      alert(`Ошибка сохранения в cloud: ${e && (e.message || e)}`);
    }
  }

  function cardsSetFlipped(flipped){
    if(flipped){
      elFlipCard.classList.add('is-flipped');
      elFlipCard.setAttribute('aria-pressed', 'true');
    }else{
      elFlipCard.classList.remove('is-flipped');
      elFlipCard.setAttribute('aria-pressed', 'false');
    }
  }

  function cardsShow(item, frontLang){
    cardsSetFlipped(false);

    if(!item){
      const sel = String((elSectionCards && elSectionCards.value) || '').trim();
      if(!sel){
        elCardFront.textContent = 'выбери section';
        elCardBack.textContent = 'сначала выбери раздел';
      }else{
        elCardFront.textContent = 'нет слов';
        elCardBack.textContent = 'добавь слова в constructor';
      }
      elCardFrontLang.textContent = '';
      elCardBackLang.textContent = '';
      elCardsMeta.textContent = '';
      return;
    }

    const frontIsEn = frontLang === 'en';
    elCardFront.textContent = frontIsEn ? item.en : item.ru;
    elCardBack.textContent = frontIsEn ? item.ru : item.en;
    elCardFrontLang.textContent = frontIsEn ? 'EN' : 'RU';
    elCardBackLang.textContent = frontIsEn ? 'RU' : 'EN';

    const secName = getSectionNameById(item.sectionId);
    // progress: unique seen / total in current deck
    if(item && item.id != null) cardsSeen.add(String(item.id));
    const denom = cardsDeck.length || 0;
    const prog = denom ? cardsSeen.size : 0;
    elCardsMeta.textContent = `section: ${secName} | ${prog}/${denom}`;
}

  function cardsPick(){
    if(!cardsDeck.length) return null;
    if(elCardsRandom.checked){
      return cardsDeck[Math.floor(Math.random() * cardsDeck.length)];
    }
    cardsSeq = (cardsSeq + 1) % cardsDeck.length;
    return cardsDeck[cardsSeq];
  }

  function cardsGoNext(){
    if(!cardsDeck.length){ cardsShow(null, 'en'); return; }

    if(cardsPos < cardsHistory.length - 1){
      cardsPos += 1;
      const h = cardsHistory[cardsPos];
      cardsShow(h.item, h.frontLang);
      return;
    }

    const item = cardsPick();
    const pref = String(elCardsFront.value || 'en');
    const frontLang = pref === 'mix' ? (Math.random() < 0.5 ? 'en' : 'ru') : pref;

    cardsHistory.push({ item, frontLang });
    cardsPos = cardsHistory.length - 1;

    cardsShow(item, frontLang);
  }

  function cardsGoPrev(){
    if(cardsPos <= 0) return;
    cardsPos -= 1;
    const h = cardsHistory[cardsPos];
    cardsShow(h.item, h.frontLang);
  }

  function cardsToggleFlip(){
    const flipped = elFlipCard.classList.contains('is-flipped');
    cardsSetFlipped(!flipped);
  }

  function dictResetCards(){
    cardsDeck = wordsForSelection(elSectionCards.value);
    cardsHistory = [];
    cardsPos = -1;
    cardsSeq = -1;
    cardsSeen = new Set();
    cardsGoNext();
  }

  function quizSetFlipped(flipped){
    if(flipped){
      elQuizCard.classList.add('is-flipped');
      elQuizCard.setAttribute('aria-pressed', 'true');
    }else{
      elQuizCard.classList.remove('is-flipped');
      elQuizCard.setAttribute('aria-pressed', 'false');
    }
  }


  // Prevent answer peek on NEXT: keep back empty until check
  function quizClearBack(){
    if(elQuizBack) elQuizBack.textContent = '';
    if(elQuizBackLang) elQuizBackLang.textContent = '';
  }

  function quizFillBackAnswer(item, askLang, cfg){
    if(!item) return;
    const exp = practiceExpected(item, askLang, cfg);
    if(elQuizBack) elQuizBack.textContent = exp.expectedRaw || '';
    if(elQuizBackLang){
      elQuizBackLang.textContent = (exp.lang === 'en') ? 'EN' : (exp.lang === 'ru' ? 'RU' : String(exp.lang || ''));
    }
  }

  function quizPickAskLang(item){
    const pref = String(elQuizMode.value || 'en');
    if(pref === 'mix') return Math.random() < 0.5 ? 'en' : 'ru';
    if(pref === 'weak'){
      const st = practiceGetStat(item);
      if(!st) return Math.random() < 0.5 ? 'en' : 'ru';
      const a = st.en2ru; const b = st.ru2en;
      const wa = (a.w + a.h*0.5) / Math.max(1, (a.c + a.w + a.h));
      const wb = (b.w + b.h*0.5) / Math.max(1, (b.c + b.w + b.h));
      if(wa === wb) return Math.random() < 0.5 ? 'en' : 'ru';
      return wa > wb ? 'en' : 'ru';
    }
    return pref; // 'en' or 'ru'
  }

  function quizRenderPromptLabel(askLang){
    elQuizPromptLabel.textContent = askLang === 'en' ? 'переведи на русский' : 'переведи на английский';
  }

  function practiceHint(){
    if(!quizCurrent) return;
    if(quizCheckMode === 'next') return;

    const cfg = cfgFromUI();
    const exp = practiceExpected(quizCurrent, quizAskLang, cfg);
    const vars = exp.expectedVariants || [];
    const primary = vars.length ? vars[0] : (exp.expectedRaw || '');
    if(!primary) return;

    practiceHintUsed = true;
    practiceHintLevel += 1;

    if(practiceHintLevel === 1){
      const first = primary.slice(0,1);
      const masked = first + ' ' + '_'.repeat(Math.max(0, primary.length - 1));
      quizSetFeedback('idle', 'hint', `подсказка: ${masked}`);
      return;
    }

    // level 2+: show answer (counts as give up)
    elQuizInput.value = '';
    quizSkip();
  }

  function quizShow(item){
    quizCurrent = item || null;
    if(quizCurrent && quizCurrent.id != null){
      quizSeen.add(String(quizCurrent.id));
      quizUpdateScore();
    }
    quizAskLang = quizPickAskLang(quizCurrent);
    practiceHintLevel = 0;
    practiceHintUsed = false;
    practicePendingFuzzy = null;
    if(elPracticeFuzzyActions) elPracticeFuzzyActions.style.display = 'none';
    quizRenderPromptLabel(quizAskLang);

    quizSetFlipped(false);
    quizClearBack();

    elQuizInput.classList.remove('is-ok', 'is-bad');
    elQuizInput.disabled = false;
    elQuizInput.value = '';

    if(!quizCurrent){
      const sel = String((elSectionQuiz && elSectionQuiz.value) || '').trim();
      if(!sel){
        elQuizFront.textContent = 'выбери section';
        elQuizBack.textContent = 'сначала выбери раздел';
        quizSetFeedback('idle', 'pick', 'сначала выбери section');
      }else{
        elQuizFront.textContent = 'нет слов';
        elQuizBack.textContent = 'добавь слова в constructor';
        quizSetFeedback('idle', 'empty', 'добавь слова в constructor');
      }
      elQuizFrontLang.textContent = '';
      elQuizBackLang.textContent = '';
      if(elQuizMcqWrap) elQuizMcqWrap.style.display = 'none';
      if(elQuizInput) elQuizInput.style.display = '';
      if(btnPracticeHint) btnPracticeHint.style.display = '';
      if(btnQuizSkip){ btnQuizSkip.textContent = 'сдаюсь'; btnQuizSkip.title = 'Показать ответ (считается ошибкой)'; }
      setQuizMode('check');
      return;
    }

    const frontIsEn = quizAskLang === 'en';
    elQuizFront.textContent = frontIsEn ? quizCurrent.en : quizCurrent.ru;
    // back (answer) is filled only after check
    elQuizFrontLang.textContent = frontIsEn ? 'EN' : 'RU';

    const cfg = cfgFromUI();
    const kind = quizDecideTaskKind(quizCurrent, cfg);
    quizSetTaskUi(kind, cfg);

    if(kind === 'mcq'){
      quizRenderMcq(quizCurrent, quizAskLang, cfg);
    }else{
      elQuizInput.focus({ preventScroll:true });
      quizSetFeedback('idle', 'ready', 'введи перевод и нажми check');
      setQuizMode('check');
    }
  }

  function quizNext(){
    if(!quizQueue.length){
      quizShow(null);
      return;
    }
    const item = quizQueue.shift();
    quizShow(item);
  }

  function weightedPickNoReplace(items, n, weightFn){
    const pool = items.slice();
    const out = [];
    const k = Math.min(n, pool.length);
    for(let i=0;i<k;i++){
      let totalW = 0;
      const weights = pool.map(it=>{
        const w = Math.max(0.0001, Number(weightFn(it)) || 0.0001);
        totalW += w;
        return w;
      });
      let r = Math.random() * totalW;
      let idx = 0;
      for(let j=0;j<pool.length;j++){
        r -= weights[j];
        if(r <= 0){ idx = j; break; }
      }
      out.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return out;
  }

  function practiceWeight(item){
    const st = practiceGetStat(item);
    if(!st) return 1;
    const a = st.en2ru; const b = st.ru2en;
    const wrong = (a.w + b.w);
    const hard = (a.h + b.h);
    const correct = (a.c + b.c);
    // more wrong/hard => show earlier
    return 1 + wrong*3 + hard*1.5 - Math.min(2, correct*0.15);
  }

  function dictResetQuiz(){
    const cfg = cfgFromUI();
    savePracticeCfg(cfg);

    quizMcqState = null;
    quizTaskKind = 'input';
    quizModeOverrides = {};
    mcqPosBagQuiz = [];
    if(elQuizMcqWrap) elQuizMcqWrap.style.display = 'none';
    if(elQuizInput) elQuizInput.style.display = '';

    const all = wordsForSelection(elSectionQuiz.value);
    let target = 20;
    if(cfg.session === 'all') target = all.length;
    else{
      const n = Number(cfg.session || 20);
      target = Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 20;
      target = Math.min(target, all.length || target);
    }
    quizSessionTarget = target || 0;

    if(!all.length){
      quizDeck = [];
      quizQueue = [];
      quizTotal = 0;
      quizCorrect = 0;
      quizSeen = new Set();
      quizUpdateScore();
      quizShow(null);
      return;
    }

    // pick session words with weights (weak words appear earlier)
    const picked = target && target < all.length
      ? weightedPickNoReplace(all, target, practiceWeight)
      : all.slice();

    quizDeck = picked;
    quizQueue = shuffle(picked);

    quizTotal = 0;
    quizCorrect = 0;
    quizRewarded = false;
    quizSeen = new Set();
    quizUpdateScore();
    quizNext();
  }

  function quizLockAfterCheck(isCorrect){
    if(isCorrect) elQuizInput.classList.add('is-ok');
    else{
      elQuizInput.classList.add('is-bad');
      pulse(elQuizInput, 'ik-shake');
    }
    elQuizInput.disabled = true;
    quizFillBackAnswer(quizCurrent, quizAskLang, cfgFromUI());
    quizSetFlipped(true); // show answer
    setQuizMode('next');
  }

  function practiceExpected(item, askLang, cfg){
    if(!item) return { lang:'en', expectedRaw:'', expectedVariants:[] };
    if(askLang === 'en'){
      return { lang:'ru', expectedRaw:item.ru, expectedVariants: ruVariants(item.ru) };
    }
    return { lang:'en', expectedRaw:item.en, expectedVariants: enVariants(item.en, cfg) };
  }

  function practiceEvaluateAnswer(raw, item, askLang){
    const cfg = cfgFromUI();
    const exp = practiceExpected(item, askLang, cfg);
    const tokens = userTokens(raw, exp.lang, cfg);
    if(!tokens.length) return { status:'empty', exp, cfg };

    // exact match: any user token matches any expected variant
    for(const tk of tokens){
      if(exp.expectedVariants.includes(tk)){
        return { status:'correct', exp, cfg };
      }
    }

    // fuzzy (typos)
    if(cfg.typos){
      let bestDist = Infinity;
      let bestExp = null;
      for(const tk of tokens){
        for(const ev of exp.expectedVariants){
          const d = levenshtein(tk, ev);
          if(d < bestDist){
            bestDist = d;
            bestExp = ev;
          }
        }
      }
      const thr = typoThreshold(bestExp);
      if(bestExp && bestDist > 0 && bestDist <= thr){
        return { status:'almost', exp, cfg, dist: bestDist };
      }
    }

    return { status:'wrong', exp, cfg };
  }

  function practiceResolveFuzzy(accept){
    if(!practicePendingFuzzy) return;
    const p = practicePendingFuzzy;
    practicePendingFuzzy = null;
    if(elPracticeFuzzyActions) elPracticeFuzzyActions.style.display='none';

    quizTotal += 1;
    if(accept) quizCorrect += 1;
    quizUpdateScore();
    maybeRewardQuizSession().catch(()=>{});

  if(accept){
    practiceBump(p.item, p.askLang, 'hard');
    if(Math.random() < 0.35) coachSignal('correct');
    quizSetFeedback('correct', 'ok', `засчитано (опечатка ~${p.dist})`);
    return;
  }

  practiceBump(p.item, p.askLang, 'wrong');
  if(Math.random() < 0.35) coachSignal('wrong');
    const insertAt = Math.min(quizQueue.length, DICT_REASK_GAP);
    quizQueue.splice(insertAt, 0, p.item);
    quizSetFeedback('wrong', 'no', 'не засчитано - слово вернется позже');
  }

  function quizCheckOrNext(){
    if(quizCheckMode === 'next'){
      if(practicePendingFuzzy){
        practiceResolveFuzzy(false);
      }
      quizNext();
      return;
    }
    if(!quizCurrent) return;

    // MCQ: selection grades immediately, button is just 'далее'
    if(quizTaskKind === 'mcq'){
      if(!quizMcqState || quizMcqState.selectedIdx == null || quizMcqState.selectedIdx < 0){
        quizSetFeedback('idle', 'choose', 'выбери вариант');
        if(elQuizMcqWrap) pulse(elQuizMcqWrap, 'ik-shake');
        return;
      }
      // normally we are already in next mode
      quizMcqLock();
      return;
    }

    const raw = elQuizInput.value || '';
    if(!String(raw).trim()){
      quizSetFeedback('idle', 'type', 'введи ответ');
      pulse(elQuizInput, 'ik-shake');
      return;
    }

    const res = practiceEvaluateAnswer(raw, quizCurrent, quizAskLang);

    if(res.status === 'correct'){
      quizTotal += 1;
      quizCorrect += 1;
      quizUpdateScore();
      maybeRewardQuizSession().catch(()=>{});

      practiceBump(quizCurrent, quizAskLang, practiceHintUsed ? 'hard' : 'correct');
      if(Math.random() < 0.38) coachSignal('correct');

      quizSetFeedback('correct', 'ok', practiceHintUsed ? 'верно (с подсказкой)' : 'верно');
      quizLockAfterCheck(true);
      return;
    }

    if(res.status === 'almost'){
      practicePendingFuzzy = { item: quizCurrent, askLang: quizAskLang, dist: res.dist };
      if(Math.random() < 0.5) coachSignal('almost');
      quizSetFeedback('idle', 'almost', `почти! опечатка примерно в ${res.dist} символ(ах)`);
      if(elPracticeFuzzyActions) elPracticeFuzzyActions.style.display = 'flex';
      quizLockAfterCheck(false);
      return;
    }

    // wrong
    quizTotal += 1;
    quizUpdateScore();
    maybeRewardQuizSession().catch(()=>{});

    practiceBump(quizCurrent, quizAskLang, 'wrong');
    if(Math.random() < 0.38) coachSignal('wrong');

    const insertAt = Math.min(quizQueue.length, DICT_REASK_GAP);
    quizQueue.splice(insertAt, 0, quizCurrent);

    quizSetFeedback('wrong', 'no', 'неверно - смотри ответ и жми далее');
    quizLockAfterCheck(false);
  }

  function quizSkip(){
    if(!quizCurrent) return;

    if(practicePendingFuzzy){
      practiceResolveFuzzy(false);
      return;
    }

    if(quizTaskKind === 'mcq'){
      quizMcqGiveUp();
      return;
    }

  quizTotal += 1;
  quizUpdateScore();
  maybeRewardQuizSession().catch(()=>{});

  practiceBump(quizCurrent, quizAskLang, 'wrong');
  if(Math.random() < 0.45) coachSignal('giveup');

    const insertAt = Math.min(quizQueue.length, DICT_REASK_GAP);
    quizQueue.splice(insertAt, 0, quizCurrent);

    quizSetFeedback('wrong', 'giveup', 'ответ показан - слово вернется позже');
    quizLockAfterCheck(false);
  }

  async function dictRefreshAll(){
    dictSections = await dictGetAll(dictDb, DICT_STORE_SECTIONS);
    dictWordsAll = await dictGetAll(dictDb, DICT_STORE_WORDS);
    buildCounts();
    updateGlobalBadges();
    renderSectionsUI();
  }

  function dictJsonToSections(data, fallbackName){
  if(!data) return [];
  const fb = String(fallbackName || '').trim();

  if(Array.isArray(data.sections)){
    return data.sections
      .map(s => ({
        name: String((s && (s.name || s.sectionName || s.section)) || fb).trim(),
        words: Array.isArray(s && s.words) ? s.words : []
      }))
      .filter(s => s.name);
  }

  const name = String((data.sectionName || data.name || data.section) || fb).trim();
  if(name && Array.isArray(data.words)){
    return [{ name, words: data.words }];
  }

  return [];
}

function dictSectionExistsByName(name){
  const key = normalize(name || '');
  return dictSections.find(x => x.nameKey === key) || null;
}

function dictClearWordsInSection(dbx, sid){
  const sectionId = Number(sid || 0);
  return new Promise((resolve, reject) => {
    const t = dbx.transaction([DICT_STORE_WORDS], 'readwrite');
    const wStore = t.objectStore(DICT_STORE_WORDS);

    try{
      const idx = wStore.index('sectionId');
      const cur = idx.openCursor(IDBKeyRange.only(sectionId));
      cur.onsuccess = (e) => {
        const c = e.target.result;
        if(!c) return;
        c.delete();
        c.continue();
      };
    }catch(err){
      reject(err || new Error('Failed to clear section words'));
      return;
    }

    t.oncomplete = () => resolve(true);
    t.onerror = () => reject(t.error || new Error('Failed to clear section words'));
  });
}

async function dictImportSectionFile(data, opts){
  const replaceExisting = !!(opts && opts.replaceExisting);
  const mergeExisting = !!(opts && opts.mergeExisting);
  const fallbackName = (opts && opts.fallbackName) || '';

  const secs = dictJsonToSections(data, fallbackName);
  if(!secs.length) return { imported:0, skipped:0 };

  if(!dictDb) throw new Error('dict db not ready');

  if(!dictSections.length) await dictRefreshAll();

  let imported = 0;
  let skipped = 0;

  for(const s of secs){
    const name = String(s && s.name || '').trim();
    if(!name){ skipped += 1; continue; }

    const exist = dictSectionExistsByName(name);

    if(exist && !replaceExisting && !mergeExisting){
      skipped += 1;
      continue;
    }

    let sid = exist ? exist.id : null;

    if(!sid){
      // eslint-disable-next-line no-await-in-loop
      const resS = await dictAddSection(dictDb, name);
      sid = resS && resS.ok ? resS.id : null;
      if(!sid){
        // refresh cache and try find again
        // eslint-disable-next-line no-await-in-loop
        await dictRefreshAll();
        const exist2 = dictSectionExistsByName(name);
        sid = exist2 ? exist2.id : null;
      }
    }

    if(!sid){ skipped += 1; continue; }

    if(exist && replaceExisting){
      // eslint-disable-next-line no-await-in-loop
      await dictClearWordsInSection(dictDb, sid);
    }

    const words = Array.isArray(s.words) ? s.words : [];
    for(const w of words){
      if(!w || !w.en || !w.ru) continue;
      // eslint-disable-next-line no-await-in-loop
      const resW = await dictAddWord(dictDb, sid, w.en, w.ru);
      if(resW && resW.ok) imported += 1;
    }
  }

  return { imported, skipped };
}

async function dictSyncFromFolder(opts){
  const replaceExisting = !!(opts && opts.replaceExisting);
  const mergeExisting = !!(opts && opts.mergeExisting);

  const okFiles = [];
  const failFiles = [];

  let files = [];
  try{
    let man = null;
    let manifestUsed = null;
    const manifestErrors = [];
    for(const mp of DICT_MANIFESTS){
      try{
        // eslint-disable-next-line no-await-in-loop
        man = await fetchJson(mp);
        manifestUsed = mp;
        break;
      }catch(e){
        manifestErrors.push(`${mp} - ${e && (e.message || e)}`);
      }
    }

    if(Array.isArray(man)) files = man;
    else if(man && Array.isArray(man.dictionary)) files = man.dictionary;
    else if(man && man.dictionary && Array.isArray(man.dictionary.files)) files = man.dictionary.files;
    else if(man && man.dictionary && Array.isArray(man.dictionary.dbs)) files = man.dictionary.dbs;
    else if(man && Array.isArray(man.files)) files = man.files;
    else if(man && Array.isArray(man.dbs)) files = man.dbs;
  }catch(_){
    // no manifest - use defaults
  }

  if(!Array.isArray(files) || !files.length){
    files = DICT_DEFAULT_FILES;
  }

  files = files.map(x => String(x || '').trim()).filter(Boolean);

  // refresh caches
  await dictRefreshAll();

  for(const f of files){
    const rel = f.includes('/') ? f : `${DICT_DIR}${f}`;
    try{
      const data = await fetchJson(rel);
      // eslint-disable-next-line no-await-in-loop
      await dictImportSectionFile(data, {
        replaceExisting,
        mergeExisting,
        fallbackName: _basename(f)
          .replace(/^student_helper_db__dictionary_/, '')
          .replace(/\.json$/i, '')
          .replaceAll('_', ' ')
      });

      okFiles.push(rel);
      // eslint-disable-next-line no-await-in-loop
      await dictRefreshAll();
    }catch(e){
      failFiles.push(`${rel} - ${e && (e.message || e)}`);
    }
  }

  return { okFiles, failFiles, filesCount: files.length, manifestUsed, manifestErrors };
}

  async function dictExportSection(){
  const sid = Number(elSectionBuilder.value || 0);
  if(!sid){
    alert('Выбери section в constructor.');
    return;
  }
  const sec = dictSections.find(x => Number(x.id) === sid);
  if(!sec){
    alert('Section не найден.');
    return;
  }

  const words = dictWordsAll
    .filter(w => Number(w.sectionId) === sid)
    .sort((a,b)=> (a.en || '').localeCompare((b.en || ''), 'en'))
    .map(w => ({ en:w.en, ru:w.ru }));

  const payload = {
    schema: 'student_helper_dict_section',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    sectionName: sec.name,
    words
  };

  const filename = dictFilenameForSection(sec.name);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

  async function dictImportFromObject(data, replace){
    const sections = Array.isArray(data && data.sections) ? data.sections : [];
    if(replace) await dictClear(dictDb);

    for(const s of sections){
      if(!s || !s.name) continue;

      // eslint-disable-next-line no-await-in-loop
      const resS = await dictAddSection(dictDb, s.name);
      let sid = resS.ok ? resS.id : null;

      if(!sid){
        // duplicate - find existing
        const key = normalize(s.name);
        const exist = dictSections.find(x => x.nameKey === key);
        sid = exist ? exist.id : null;
      }

      if(!sid) continue;

      const words = Array.isArray(s.words) ? s.words : [];
      for(const w of words){
        if(!w || !w.en || !w.ru) continue;
        // eslint-disable-next-line no-await-in-loop
        await dictAddWord(dictDb, sid, w.en, w.ru);
      }
    }
  }

  async function dictImportFromFile(file, replace){
    const text = await file.text();
    const parsed = safeParseJSON(text);
    if(!parsed.ok){
      alert('Файл не является корректным JSON.');
      return;
    }

    // refresh to have current nameKey
    await dictRefreshAll();

    await dictImportSectionFile(parsed.data || {}, { replaceExisting: !!replace, mergeExisting: !replace });
  }

  async function dictBoot(){
    if(window.__dictBooted) return;
    window.__dictBooted = true;
    try{
      if(window.IKAdminLog) window.IKAdminLog('log', 'student_helper', 'dict: boot');
      setAdminText(elDictDbStatus, 'opening...');
      dictDb = await dictOpenDB();
      setAdminText(elDictDbStatus, 'ok');

      // Seed from repo JSON is disabled.
      // Default content lives on Supabase as public dictionaries (system/user).
      setAdminText(elDictSeedBadge, 'json: off');
      if(elDictSeedBadge) elDictSeedBadge.title = 'Локальный seed из /db/dictionary отключен. Используй вкладки "системные" / "пользовательские".';

      await dictRefreshAll();
      renderWordsUI();
      await refreshDictAdminAccess();
      scheduleAdminAccessRefresh();

      // apply last selected source (personal/system/user)
      try{
        const saved = String(localStorage.getItem('student_helper_dict_source_v1') || 'personal');
        await dictSetSource(saved);
      }catch(_){
        await dictSetSource('personal');
      }

      dictShowFirstPick();
      cardsShow(null, 'en');
      quizShow(null);
      learnShow(null);
      quizSetFeedback('idle', 'pick', 'выбери section');
    }catch(e){
      setAdminText(elDictDbStatus, 'failed');
      console.error(e);
      if(window.IKAdminLog) window.IKAdminLog('error', 'student_helper', `dict boot failed: ${e && (e.message || e)}`);
    }finally{
      if(window.IKLoading) window.IKLoading.done();
    }
  }

  // Dictionary events
  // Practice init (persisted settings)
  ensurePracticeExtraSettingsUI();
  ensureLearnExtraSettingsUI();
  ensureMcqContainers();
  applyCfgToUI(loadPracticeCfg());
  loadPracticeStats();

  ensureDictSourceTabsUI();
  applyDictSourceAccess();
  refreshDictAdminAccess().catch(()=>{});
  scheduleAdminAccessRefresh();

  document.addEventListener('ik:authchange', ()=>{
    refreshDictAdminAccess().catch(()=>{});
    scheduleAdminAccessRefresh();
  });
  window.addEventListener('storage', (e)=>{
    if(e && e.key === 'itemkey.currentUser'){
      refreshDictAdminAccess().catch(()=>{});
      scheduleAdminAccessRefresh();
    }
  });

  // Source tabs
  document.getElementById('dictSourceTabs')?.addEventListener('click', (e)=>{
    const btn = e.target && e.target.closest ? e.target.closest('[data-dict-source]') : null;
    if(!btn) return;
    const next = btn.getAttribute('data-dict-source') || 'personal';
    dictSetSource(next).catch((err)=>{
      console.error(err);
      alert(`Ошибка загрузки источника: ${err && (err.message || err)}`);
    });
  });

  // source is applied after dictBoot()

  dictTabCards.addEventListener('click', ()=>{
    dictSetSubtab('cards');
    const v = (elSectionCards && elSectionCards.value) || dictCurrentSection || 'All';
    dictSelectSectionAndRun(v, dictResetCards).catch(()=>{});
  });
  dictTabQuiz.addEventListener('click', ()=>{
    dictSetSubtab('practice');
    const v = (elSectionQuiz && elSectionQuiz.value) || dictCurrentSection || 'All';
    dictSelectSectionAndRun(v, dictResetQuiz).catch(()=>{});
  });
  dictTabLearn && dictTabLearn.addEventListener('click', ()=>{
    dictSetSubtab('learn');
    const v = (elSectionLearn && elSectionLearn.value) || dictCurrentSection || 'All';
    dictSelectSectionAndRun(v, ()=> learnStartSession(true)).catch(()=>{});
  });
  dictTabView && dictTabView.addEventListener('click', ()=>{
    dictSetSubtab('view');
    const v = (elSectionView && elSectionView.value) || dictCurrentSection || 'All';
    dictSelectSectionAndRun(v, renderViewUI).catch(()=>{});
  });
  dictTabBuilder.addEventListener('click', ()=>{
    if(!canUseBuilderForCurrentSource()){
      dictShowFirstPick();
      return;
    }
    dictSetSubtab('builder');
    dictSetCurrentSection((elSectionBuilder && elSectionBuilder.value) || dictCurrentSection || 'All');
    renderWordsUI();
  });

  if(btnCardsChooseSection) btnCardsChooseSection.addEventListener('click', dictShowFirstPick);
  if(btnQuizChooseSection) btnQuizChooseSection.addEventListener('click', dictShowFirstPick);
  if(btnLearnChooseSection) btnLearnChooseSection.addEventListener('click', dictShowFirstPick);
  if(btnFirstPickOpenConstructor) btnFirstPickOpenConstructor.addEventListener('click', dictOpenConstructorFromPick);
  if(elFirstPickSearch) elFirstPickSearch.addEventListener('input', renderFirstPickUI);
  if(btnSubmitModeration) btnSubmitModeration.addEventListener('click', ()=>{
    if(isPublicSource() && dictRuntime.isAdmin){
      savePublicBuilderSection().catch(()=>{});
      return;
    }
    submitCurrentSectionToModeration().catch(()=>{});
  });

  btnCardsPrev.addEventListener('click', cardsGoPrev);
  btnCardsNext.addEventListener('click', cardsGoNext);
  elCardsFront.addEventListener('change', dictResetCards);
  elCardsRandom.addEventListener('change', dictResetCards);
  elSectionCards.addEventListener('change', ()=>{
    dictSelectSectionAndRun(elSectionCards.value, dictResetCards).catch(()=>{});
  });

  elFlipCard.addEventListener('click', cardsToggleFlip);
  elFlipCard.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' || e.key === ' '){
      e.preventDefault();
      cardsToggleFlip();
    }
  });

  elSectionQuiz.addEventListener('change', ()=>{
    dictSelectSectionAndRun(elSectionQuiz.value, dictResetQuiz).catch(()=>{});
  });
  if(elSectionLearn) elSectionLearn.addEventListener('change', ()=>{
    dictSelectSectionAndRun(elSectionLearn.value, ()=> learnStartSession(true)).catch(()=>{});
  });
  if(elSectionView) elSectionView.addEventListener('change', ()=>{
    dictSelectSectionAndRun(elSectionView.value, renderViewUI).catch(()=>{});
  });
  if(elViewSearch) elViewSearch.addEventListener('input', renderViewUI);
  elQuizMode.addEventListener('change', dictResetQuiz);

  btnQuizCheckNext.addEventListener('click', quizCheckOrNext);
  elQuizInput.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){
      e.preventDefault();
      quizCheckOrNext();
    }
  });

  btnQuizSkip.addEventListener('click', quizSkip);
  if(btnPracticeHint) btnPracticeHint.addEventListener('click', practiceHint);

  if(btnPracticeSettingsBtn && elPracticeSettings){
    btnPracticeSettingsBtn.addEventListener('click', ()=>{
      const shown = elPracticeSettings.style.display !== 'none';
      elPracticeSettings.style.display = shown ? 'none' : 'block';
    });
  }


  // Learn init (persisted settings)
  applyLearnCfgToUI(loadLearnCfg());

  if(btnLearnSettingsBtn && elLearnSettings){
    btnLearnSettingsBtn.addEventListener('click', ()=>{
      const shown = elLearnSettings.style.display !== 'none';
      elLearnSettings.style.display = shown ? 'none' : 'block';
    });
  }

  const learnCfgChanged = ()=>{
    const cfg = learnCfgFromUI();
    saveLearnCfg(cfg);
  };
  if(elLearnSource) elLearnSource.addEventListener('change', learnCfgChanged);
  if(elLearnPortion) elLearnPortion.addEventListener('change', learnCfgChanged);
  if(elLearnDir) elLearnDir.addEventListener('change', learnCfgChanged);
  if(elLearnGoal) elLearnGoal.addEventListener('change', learnCfgChanged);
  if(elLearnStrict) elLearnStrict.addEventListener('change', ()=>{
    learnCfgChanged();
    applyLearnCfgToUI(loadLearnCfg());
  });
  if(elLearnTypos) elLearnTypos.addEventListener('change', learnCfgChanged);
  if(elLearnForms) elLearnForms.addEventListener('change', learnCfgChanged);
  if(elLearnIgnoreTo) elLearnIgnoreTo.addEventListener('change', learnCfgChanged);
  if(elLearnIgnoreArticles) elLearnIgnoreArticles.addEventListener('change', learnCfgChanged);
  if(elLearnHints) elLearnHints.addEventListener('change', learnCfgChanged);
  if(elLearnIntroMode) elLearnIntroMode.addEventListener('change', learnCfgChanged);
  if(elLearnIntroMcqCount) elLearnIntroMcqCount.addEventListener('change', learnCfgChanged);
  if(elLearnIntroShowPos) elLearnIntroShowPos.addEventListener('change', learnCfgChanged);

  if(btnLearnRestart) btnLearnRestart.addEventListener('click', ()=> learnStartSession(true));

  if(btnLearnCheckNext) btnLearnCheckNext.addEventListener('click', learnCheckOrNext);
  if(elLearnInput) elLearnInput.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){
      e.preventDefault();
      learnCheckOrNext();
    }
  });
  if(btnLearnHint) btnLearnHint.addEventListener('click', learnHint);
  if(btnLearnGiveUp) btnLearnGiveUp.addEventListener('click', learnGiveUp);

  // MCQ hotkeys (1-8) for practice and learn
  window.addEventListener('keydown', handleMcqHotkeys);

  // Learn card flips only after check
  if(elLearnCard){
    elLearnCard.addEventListener('click', ()=>{
      if(learnCheckMode !== 'next') return;
      const flipped = elLearnCard.classList.contains('is-flipped');
      learnSetFlipped(!flipped);
    });
    elLearnCard.addEventListener('keydown', (e)=>{
      if(learnCheckMode !== 'next') return;
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        const flipped = elLearnCard.classList.contains('is-flipped');
        learnSetFlipped(!flipped);
      }
    });
  }

  // Practice settings changes -> save + reset session
  const practiceCfgChanged = ()=>{
    const cfg = cfgFromUI();
    savePracticeCfg(cfg);
    // only reset if section selected
    if(elSectionQuiz && String(elSectionQuiz.value || '').trim()){
      dictResetQuiz();
    }
  };
  if(elPracticeSession) elPracticeSession.addEventListener('change', practiceCfgChanged);
  if(elPracticeTypos) elPracticeTypos.addEventListener('change', practiceCfgChanged);
  if(elPracticeIgnoreTo) elPracticeIgnoreTo.addEventListener('change', practiceCfgChanged);
  if(elPracticeIgnoreArticles) elPracticeIgnoreArticles.addEventListener('change', practiceCfgChanged);
  if(elPracticeTaskMode) elPracticeTaskMode.addEventListener('change', practiceCfgChanged);
  if(elPracticeMixInputPct) elPracticeMixInputPct.addEventListener('change', practiceCfgChanged);
  if(elPracticeMcqCount) elPracticeMcqCount.addEventListener('change', practiceCfgChanged);
  if(elPracticeShowPos) elPracticeShowPos.addEventListener('change', practiceCfgChanged);
  if(elPracticeSoftMcq) elPracticeSoftMcq.addEventListener('change', practiceCfgChanged);

  if(btnPracticeFuzzyAccept) btnPracticeFuzzyAccept.addEventListener('click', ()=> practiceResolveFuzzy(true));
  if(btnPracticeFuzzyReject) btnPracticeFuzzyReject.addEventListener('click', ()=> practiceResolveFuzzy(false));


  // Quiz card flips only after check
  elQuizCard.addEventListener('click', ()=>{
    if(quizCheckMode !== 'next') return;
    const flipped = elQuizCard.classList.contains('is-flipped');
    quizSetFlipped(!flipped);
  });
  elQuizCard.addEventListener('keydown', (e)=>{
    if(quizCheckMode !== 'next') return;
    if(e.key === 'Enter' || e.key === ' '){
      e.preventDefault();
      const flipped = elQuizCard.classList.contains('is-flipped');
      quizSetFlipped(!flipped);
    }
  });

  function notifyDictLocalChanged(){
    try{
      window.dispatchEvent(new CustomEvent('dict:local-changed'));
    }catch(_){ }
  }

  btnAddSection.addEventListener('click', async ()=>{
    const name = (elNewSectionName.value || '').trim();
    if(!name){
      alert('Название раздела пустое.');
      return;
    }
    try{
      const res = await dictAddSection(dictDb, name);
      if(!res.ok && res.reason === 'duplicate'){
        alert('Такой раздел уже есть.');
        return;
      }
      elNewSectionName.value = '';
      await dictRefreshAll();
      if(res.ok) elSectionBuilder.value = String(res.id);
      renderWordsUI();
      dictResetCards();
      dictResetQuiz();
      dictSetSubtab('builder');
      notifyDictLocalChanged();
    }catch(e){
      alert(`Ошибка сохранения: ${e.message || e}`);
    }
  });

  btnDeleteSection.addEventListener('click', async ()=>{
    const sid = Number(elSectionBuilder.value || 0);
    if(!sid){
      alert('Выбери раздел.');
      return;
    }
    const name = getSectionNameById(sid);
    if(!confirm(`Удалить раздел "${name}" и все слова внутри?`)) return;

    try{
      await dictDeleteSection(dictDb, sid);
      await dictRefreshAll();
      renderWordsUI();
      dictResetCards();
      dictResetQuiz();
      notifyDictLocalChanged();
    }catch(e){
      alert(`Ошибка удаления: ${e.message || e}`);
    }
  });

  elSectionBuilder.addEventListener('change', renderWordsUI);

  btnAddWord.addEventListener('click', async ()=>{
    const sid = Number(elSectionBuilder.value || 0);
    if(!sid){
      alert('Сначала выбери раздел.');
      return;
    }
    const en = (elEnInput.value || '').trim();
    const ru = (elRuInput.value || '').trim();
    if(!en || !ru){
      alert('Заполни EN и RU.');
      return;
    }
    try{
      if(isPublicSource()){
        if(!dictRuntime.isAdmin){
          alert('Конструктор доступен только администратору.');
          return;
        }
        const key = `${sid}|${normEnCmp(en)}|${normRuCmp(ru)}`;
        const hasDuplicate = dictWordsAll.some((w)=> `${Number(w.sectionId)}|${normEnCmp(w.en)}|${normRuCmp(w.ru)}` === key);
        if(hasDuplicate){
          alert('Такое слово уже есть (дубликат).');
          return;
        }
        dictWordsAll.push({
          id: publicTempWordId,
          sectionId: sid,
          en,
          ru
        });
        publicTempWordId -= 1;
        publicCounts[dictSource].set(sid, dictWordsAll.filter((w)=> Number(w.sectionId) === sid).length);
        updateGlobalBadges();
      }else{
        const res = await dictAddWord(dictDb, sid, en, ru);
        if(!res.ok && res.reason === 'duplicate'){
          alert('Такое слово уже есть (дубликат).');
          return;
        }
        await dictRefreshAll();
        notifyDictLocalChanged();
      }
      elEnInput.value = '';
      elRuInput.value = '';
      renderWordsUI();
      renderViewUI();
      dictResetCards();
      dictResetQuiz();
    }catch(e){
      alert(`Ошибка сохранения: ${e.message || e}`);
    }
  });

  btnDictExport.addEventListener('click', dictExportSection);

  btnDictImport.addEventListener('click', ()=>{
    elDictFileImport.value = '';
    elDictFileImport.click();
  });

  elDictFileImport.addEventListener('change', async ()=>{
    const file = elDictFileImport.files && elDictFileImport.files[0];
    if(!file) return;
    try{
      await dictImportFromFile(file, !!elDictImportReplace.checked);
      await dictRefreshAll();
      renderWordsUI();
      dictResetCards();
      dictResetQuiz();
      alert('Импорт: ok');
      notifyDictLocalChanged();
    }catch(e){
      alert(`Ошибка импорта: ${e.message || e}`);
    }
  });

  window.dictBoot = dictBoot;
  window.dictCloudRefresh = async function(){
    if(dictSource !== 'personal') return;
    await dictRefreshAll();
    buildCounts();
    updateGlobalBadges();
    renderSectionsUI();
    renderWordsUI();
  };


  dictBoot();
