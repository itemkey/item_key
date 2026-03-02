(function(){
  const STORE_SECTIONS = 'sections';
  const STORE_WORDS = 'words';
  const DB_VERSION = 1;

  const OWNER_KEY = 'student_helper_dict_owner_v1';
  const RUN_REPORT_KEY = 'student_helper_dict_cloud_report_v1';

  const TABLE_SECTIONS = 'sh_dictionary_sections';
  const TABLE_WORDS = 'sh_dictionary_words';
  const TABLE_RUNS = 'sh_migration_runs';
  const REMOTE_BACKUP_KEY = 'student_helper_dict_remote_backup_v1';

  const MANIFEST_PATHS = ['db/manifest.json', 'db/dictionary/manifest.json'];
  const DICT_DIR = 'db/dictionary/';
  const DEFAULT_FILES = [
    'student_helper_db__dictionary_Destination_B1_Unit_3.json',
    'student_helper_db__dictionary_Destination_B1_Unit_6.json'
  ];

  const state = {
    client: null,
    userId: null,
    syncing: false,
    stock: null,
    interval: null,
    localChangeTimer: null
  };

  function dbName(){
    if(typeof window.dbNameFor === 'function') return window.dbNameFor('dictionary');
    return 'student_helper_db__dictionary';
  }

  function normSpaces(v){ return String(v || '').trim().replace(/\s+/g, ' '); }
  function normalize(v){ return String(v || '').trim().toLowerCase(); }
  function normEn(v){ return normSpaces(v).toLowerCase(); }
  function normRu(v){ return normSpaces(v).toLowerCase().replaceAll('ё', 'е'); }

  function setBadge(text, title){
    const badge = document.getElementById('dictSeedBadge');
    if(!badge) return;
    const base = String(badge.textContent || '').replace(/\s*\|\s*cloud:[^|]+$/i, '').trim();
    badge.textContent = `${base} | cloud: ${text}`;
    if(title) badge.title = title;
  }

  function shortErr(err){
    const raw = String(err && (err.message || err) || '').trim();
    if(!raw) return 'unknown';
    const one = raw.replace(/\s+/g, ' ');
    if(/row-level security|permission denied|not allowed/i.test(one)) return 'RLS';
    if(/jwt|token|auth/i.test(one)) return 'auth';
    if(/fetch|network|failed to fetch|timeout/i.test(one)) return 'network';
    if(/duplicate|unique/i.test(one)) return 'duplicate';
    return one.slice(0, 48);
  }

  function explainErr(err){
    if(!err) return 'unknown';
    const msg = String(err.message || '').trim();
    const details = String(err.details || '').trim();
    const hint = String(err.hint || '').trim();
    const code = String(err.code || '').trim();
    const parts = [];
    if(msg) parts.push(msg);
    if(code) parts.push(`code=${code}`);
    if(details) parts.push(`details=${details}`);
    if(hint) parts.push(`hint=${hint}`);
    return parts.join(' | ') || 'unknown';
  }

  function reqAsPromise(req){
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('request failed'));
    });
  }

  function openDb(){
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName(), DB_VERSION);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('open db failed'));
    });
  }

  function txDone(db, tx){
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => { try{ db.close(); }catch(_){ } resolve(true); };
      tx.onerror = () => { try{ db.close(); }catch(_){ } reject(tx.error || new Error('tx failed')); };
      tx.onabort = () => { try{ db.close(); }catch(_){ } reject(tx.error || new Error('tx aborted')); };
    });
  }

  async function readLocal(){
    const db = await openDb();
    const tx = db.transaction([STORE_SECTIONS, STORE_WORDS], 'readonly');
    const sReq = tx.objectStore(STORE_SECTIONS).getAll();
    const wReq = tx.objectStore(STORE_WORDS).getAll();
    const [sections, words] = await Promise.all([reqAsPromise(sReq), reqAsPromise(wReq)]);
    await txDone(db, tx);
    return { sections: sections || [], words: words || [] };
  }

  async function replaceLocal(snapshot){
    const db = await openDb();
    const tx = db.transaction([STORE_SECTIONS, STORE_WORDS], 'readwrite');
    const sStore = tx.objectStore(STORE_SECTIONS);
    const wStore = tx.objectStore(STORE_WORDS);

    sStore.clear();
    wStore.clear();

    const byNameKey = new Map();
    const sectionRows = (snapshot.sections || []).map((s) => ({
      name: normSpaces(s.name || ''),
      nameKey: normalize(s.nameKey || s.name || ''),
      createdAt: Date.now(),
      updatedAt: Date.now()
    })).filter((s) => s.name && s.nameKey);

    for(const section of sectionRows){
      const id = await reqAsPromise(sStore.add(section));
      byNameKey.set(section.nameKey, Number(id));
    }

    const words = snapshot.words || [];
    for(const w of words){
      const nameKey = normalize(w.sectionNameKey || '');
      const sid = byNameKey.get(nameKey);
      if(!sid) continue;

      const en = normSpaces(w.en || '');
      const ru = String(w.ru || '').trim();
      if(!en || !ru) continue;
      const enKey = normEn(en);
      const ruKey = normRu(ru);

      wStore.add({
        sectionId: sid,
        en,
        ru,
        enKey,
        ruKey,
        pairKey: `${sid}|${enKey}|${ruKey}`,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    await txDone(db, tx);
  }

  function parseSectionsJson(data, fallbackName){
    if(!data) return [];
    const fb = String(fallbackName || '').trim();
    if(Array.isArray(data.sections)){
      return data.sections
        .map((s) => ({
          name: String((s && (s.name || s.sectionName || s.section)) || fb).trim(),
          words: Array.isArray(s && s.words) ? s.words : []
        }))
        .filter((s) => s.name);
    }
    const name = String((data.sectionName || data.name || data.section) || fb).trim();
    if(name && Array.isArray(data.words)) return [{ name, words: data.words }];
    return [];
  }

  async function fetchJson(path){
    const res = await fetch(path, { cache: 'no-store' });
    if(!res.ok) throw new Error(`fetch failed: ${path}`);
    return res.json();
  }

  async function loadStockSnapshot(){
    if(state.stock) return state.stock;

    let files = [];
    for(const mp of MANIFEST_PATHS){
      try{
        const man = await fetchJson(mp);
        if(Array.isArray(man)) files = man;
        else if(man && Array.isArray(man.dictionary)) files = man.dictionary;
        else if(man && man.dictionary && Array.isArray(man.dictionary.files)) files = man.dictionary.files;
        else if(man && man.dictionary && Array.isArray(man.dictionary.dbs)) files = man.dictionary.dbs;
        else if(man && Array.isArray(man.files)) files = man.files;
        else if(man && Array.isArray(man.dbs)) files = man.dbs;
        if(files.length) break;
      }catch(_){ }
    }

    if(!files.length) files = DEFAULT_FILES;
    files = files.map((f) => String(f || '').trim()).filter(Boolean);

    const sections = [];
    for(const f of files){
      const rel = f.includes('/') ? f : `${DICT_DIR}${f}`;
      try{
        const json = await fetchJson(rel);
        const fallback = String(f).replace(/^student_helper_db__dictionary_/, '').replace(/\.json$/i, '').replaceAll('_', ' ');
        const parsed = parseSectionsJson(json, fallback);
        sections.push(...parsed);
      }catch(_){ }
    }

    const bySection = new Map();
    for(const sec of sections){
      const name = normSpaces(sec.name || '');
      const nameKey = normalize(name);
      if(!name || !nameKey) continue;
      if(!bySection.has(nameKey)) bySection.set(nameKey, { name, nameKey, words: new Map() });
      const bucket = bySection.get(nameKey);
      for(const w of (sec.words || [])){
        const en = normSpaces(w && w.en || '');
        const ru = String(w && w.ru || '').trim();
        if(!en || !ru) continue;
        const enKey = normEn(en);
        const ruKey = normRu(ru);
        bucket.words.set(`${enKey}|${ruKey}`, { en, ru, sectionNameKey: nameKey });
      }
    }

    const result = {
      sections: Array.from(bySection.values()).map((s) => ({ name: s.name, nameKey: s.nameKey })),
      words: Array.from(bySection.values()).flatMap((s) => Array.from(s.words.values()))
    };

    state.stock = result;
    return result;
  }

  function mergeSnapshots(stock, remote){
    const sectionMap = new Map();
    const wordMap = new Map();

    for(const s of (stock.sections || [])){
      const name = normSpaces(s.name || '');
      const nameKey = normalize(s.nameKey || s.name || '');
      if(!name || !nameKey) continue;
      sectionMap.set(nameKey, { name, nameKey });
    }

    for(const s of (remote.sections || [])){
      const name = normSpaces(s.name || '');
      const nameKey = normalize(s.nameKey || s.name || '');
      if(!name || !nameKey) continue;
      sectionMap.set(nameKey, { name, nameKey });
    }

    const pushWord = (w) => {
      const sectionNameKey = normalize(w.sectionNameKey || '');
      const en = normSpaces(w.en || '');
      const ru = String(w.ru || '').trim();
      if(!sectionNameKey || !en || !ru) return;
      const enKey = normEn(en);
      const ruKey = normRu(ru);
      wordMap.set(`${sectionNameKey}|${enKey}|${ruKey}`, { sectionNameKey, en, ru });
    };

    for(const w of (stock.words || [])) pushWord(w);
    for(const w of (remote.words || [])) pushWord(w);

    return {
      sections: Array.from(sectionMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'ru')),
      words: Array.from(wordMap.values())
    };
  }

  function makeStockKeySet(stock){
    const sectionKeys = new Set((stock.sections || []).map((s) => normalize(s.nameKey || s.name || '')).filter(Boolean));
    const wordKeys = new Set((stock.words || []).map((w) => {
      const sectionNameKey = normalize(w.sectionNameKey || '');
      const enKey = normEn(w.en || '');
      const ruKey = normRu(w.ru || '');
      return `${sectionNameKey}|${enKey}|${ruKey}`;
    }).filter(Boolean));
    return { sectionKeys, wordKeys };
  }

  function localToNamedSnapshot(local){
    const idToNameKey = new Map();
    for(const s of local.sections || []){
      idToNameKey.set(Number(s.id), normalize(s.nameKey || s.name || ''));
    }

    const sections = (local.sections || []).map((s) => ({
      name: normSpaces(s.name || ''),
      nameKey: normalize(s.nameKey || s.name || '')
    })).filter((s) => s.name && s.nameKey);

    const words = (local.words || []).map((w) => {
      const sectionNameKey = idToNameKey.get(Number(w.sectionId || 0)) || '';
      return {
        sectionNameKey,
        en: normSpaces(w.en || ''),
        ru: String(w.ru || '').trim()
      };
    }).filter((w) => w.sectionNameKey && w.en && w.ru);

    return { sections, words };
  }

  function localToScopedSnapshot(local, stock){
    const named = localToNamedSnapshot(local);
    const stockKeys = makeStockKeySet(stock);

    const sections = named.sections.filter((s) => !stockKeys.sectionKeys.has(normalize(s.nameKey || s.name || '')));

    const userSectionSet = new Set(sections.map((s) => normalize(s.nameKey || s.name || '')).filter(Boolean));
    const words = named.words.filter((w) => {
      const sectionNameKey = normalize(w.sectionNameKey || '');
      const enKey = normEn(w.en || '');
      const ruKey = normRu(w.ru || '');
      const key = `${sectionNameKey}|${enKey}|${ruKey}`;
      if(stockKeys.wordKeys.has(key)) return false;
      return userSectionSet.has(sectionNameKey);
    });

    return { sections, words };
  }

  function getOwnerMarker(){
    try{ return localStorage.getItem(OWNER_KEY) || 'guest'; }catch(_){ return 'guest'; }
  }

  function setOwnerMarker(owner){
    try{ localStorage.setItem(OWNER_KEY, owner || 'guest'); }catch(_){ }
  }

  async function selectOwned(table, columns){
    const rows = [];
    const size = 1000;
    let from = 0;

    while(true){
      const { data, error } = await state.client
        .from(table)
        .select(columns)
        .eq('owner_id', state.userId)
        .order('id', { ascending: true })
        .range(from, from + size - 1);
      if(error) throw error;
      const part = Array.isArray(data) ? data : [];
      rows.push(...part);
      if(part.length < size) break;
      from += size;
    }

    return rows;
  }

  function remoteRawToSnapshot(sectionsRaw, wordsRaw){
    const safeSections = Array.isArray(sectionsRaw) ? sectionsRaw : [];
    const safeWords = Array.isArray(wordsRaw) ? wordsRaw : [];

    const sectionNameById = new Map();
    const sections = safeSections.map((s) => {
      const name = normSpaces(s.name || '');
      const nameKey = normalize(s.name_key || s.name || '');
      sectionNameById.set(Number(s.id), nameKey);
      return { name, nameKey };
    }).filter((s) => s.name && s.nameKey);

    const words = safeWords.map((w) => ({
      sectionNameKey: sectionNameById.get(Number(w.section_id || 0)) || '',
      en: normSpaces(w.en || ''),
      ru: String(w.ru || '').trim()
    })).filter((w) => w.sectionNameKey && w.en && w.ru);

    return { sections, words };
  }

  async function fetchRemoteRaw(){
    const sectionsRaw = await selectOwned(TABLE_SECTIONS, 'id,name,name_key');
    const wordsRaw = await selectOwned(TABLE_WORDS, 'id,section_id,en,ru,pair_key');
    return { sectionsRaw, wordsRaw };
  }

  async function fetchRemoteSnapshot(){
    const raw = await fetchRemoteRaw();
    return remoteRawToSnapshot(raw.sectionsRaw, raw.wordsRaw);
  }

  async function insertRemoteFromSnapshot(snapshot){
    const sectionsPayload = (snapshot.sections || []).map((s) => ({
      owner_id: state.userId,
      name: normSpaces(s.name || ''),
      name_key: normalize(s.nameKey || s.name || ''),
      source: 'imported_local'
    })).filter((s) => s.name && s.name_key);

    if(sectionsPayload.length){
      const { error } = await state.client.from(TABLE_SECTIONS).insert(sectionsPayload);
      if(error) throw error;
    }

    const mappedSections = await selectOwned(TABLE_SECTIONS, 'id,name_key');
    const sectionIdByKey = new Map();
    mappedSections.forEach((s) => sectionIdByKey.set(normalize(s.name_key), Number(s.id)));

    const wordsPayload = (snapshot.words || []).map((w) => {
      const sectionNameKey = normalize(w.sectionNameKey || '');
      const sectionId = sectionIdByKey.get(sectionNameKey);
      const en = normSpaces(w.en || '');
      const ru = String(w.ru || '').trim();
      if(!sectionId || !sectionNameKey || !en || !ru) return null;
      const enKey = normEn(en);
      const ruKey = normRu(ru);
      return {
        owner_id: state.userId,
        section_id: sectionId,
        en,
        ru,
        en_key: enKey,
        ru_key: ruKey,
        pair_key: `${sectionNameKey}|${enKey}|${ruKey}`,
        source: 'imported_local'
      };
    }).filter(Boolean);

    if(wordsPayload.length){
      const { error } = await state.client.from(TABLE_WORDS).insert(wordsPayload);
      if(error) throw error;
    }
  }

  function saveRemoteBackup(snapshot){
    try{
      const payload = {
        ts: Date.now(),
        owner: state.userId,
        snapshot: snapshot || { sections: [], words: [] }
      };
      localStorage.setItem(REMOTE_BACKUP_KEY, JSON.stringify(payload));
    }catch(_){ }
  }

  function loadRemoteBackup(){
    try{
      const raw = localStorage.getItem(REMOTE_BACKUP_KEY);
      if(!raw) return null;
      const obj = JSON.parse(raw);
      if(!obj || obj.owner !== state.userId) return null;
      const snap = obj.snapshot;
      if(!snap || !Array.isArray(snap.sections) || !Array.isArray(snap.words)) return null;
      return snap;
    }catch(_){
      return null;
    }
  }

  function chunk(list, size){
    const out = [];
    for(let i = 0; i < list.length; i += size){
      out.push(list.slice(i, i + size));
    }
    return out;
  }

  async function clearRemoteUserData(){
    const remoteRaw = await fetchRemoteRaw();
    const remoteWords = Array.isArray(remoteRaw.wordsRaw) ? remoteRaw.wordsRaw : [];
    const remoteSections = Array.isArray(remoteRaw.sectionsRaw) ? remoteRaw.sectionsRaw : [];

    const wordIds = remoteWords.map((w) => Number(w.id)).filter((v) => Number.isFinite(v));
    for(const part of chunk(wordIds, 50)){
      const { error } = await state.client
        .from(TABLE_WORDS)
        .delete()
        .eq('owner_id', state.userId)
        .in('id', part);
      if(error) throw error;
    }

    const sectionIds = remoteSections.map((s) => Number(s.id)).filter((v) => Number.isFinite(v));
    for(const part of chunk(sectionIds, 50)){
      const { error } = await state.client
        .from(TABLE_SECTIONS)
        .delete()
        .eq('owner_id', state.userId)
        .in('id', part);
      if(error) throw error;
    }
  }

  async function syncRemoteWithLocal(localUserSnapshot){
    const remoteBefore = await fetchRemoteSnapshot();
    saveRemoteBackup(remoteBefore);
    try{
      await clearRemoteUserData();
      await insertRemoteFromSnapshot(localUserSnapshot);
    }catch(e){
      // rollback best-effort to previous remote state
      try{
        const backup = loadRemoteBackup();
        if(backup){
          await clearRemoteUserData();
          await insertRemoteFromSnapshot(backup);
        }
      }catch(_){ }
      throw e;
    }
  }

  function fp(snapshot){
    const s = (snapshot.sections || []).map((x) => normalize(x.nameKey || x.name || '')).filter(Boolean).sort();
    const w = (snapshot.words || [])
      .map((x) => `${normalize(x.sectionNameKey || '')}|${normEn(x.en || '')}|${normRu(x.ru || '')}`)
      .filter(Boolean)
      .sort();
    return `${s.join('||')}##${w.join('||')}`;
  }

  async function logRun(status, details){
    if(!state.userId) return;
    const d = details || {};
    try{
      await state.client.from(TABLE_RUNS).insert({
        owner_id: state.userId,
        run_type: 'dictionary',
        status,
        local_sections_count: Number(d.localSections || 0),
        local_words_count: Number(d.localWords || 0),
        remote_sections_count: Number(d.remoteSections || 0),
        remote_words_count: Number(d.remoteWords || 0),
        local_fingerprint: d.localFingerprint || null,
        remote_fingerprint: d.remoteFingerprint || null,
        details: d
      });
    }catch(_){ }
  }

  async function applyToUi(){
    if(typeof window.dictCloudRefresh === 'function'){
      try{ await window.dictCloudRefresh(); return; }catch(_){ }
    }
    window.location.reload();
  }

  async function switchToGuest(stock){
    const target = mergeSnapshots(stock, { sections: [], words: [] });
    await replaceLocal(target);
    setOwnerMarker('guest');
    setBadge('guest', 'Показаны только стоковые категории');
    await applyToUi();
  }

  async function switchToUser(stock){
    const remote = await fetchRemoteSnapshot();
    const target = mergeSnapshots(stock, remote);
    await replaceLocal(target);
    setOwnerMarker(state.userId);
    setBadge('account', 'Показаны стоковые + данные текущего аккаунта');
    await applyToUi();
  }

  async function regularSync(stock){
    if(state.syncing) return;
    state.syncing = true;
    setBadge('sync...', 'Синхронизация словаря');

    try{
      const local = localToScopedSnapshot(await readLocal(), stock);
      await syncRemoteWithLocal(local);

      const remote = await fetchRemoteSnapshot();
      const target = mergeSnapshots(stock, remote);
      await replaceLocal(target);

      const localAfter = localToScopedSnapshot(await readLocal(), stock);
      const localFingerprint = fp(localAfter);
      const remoteFingerprint = fp(remote);
      const ok = localFingerprint === remoteFingerprint;

      const report = {
        ts: Date.now(),
        status: ok ? 'ok' : 'partial',
        localSections: localAfter.sections.length,
        localWords: localAfter.words.length,
        remoteSections: remote.sections.length,
        remoteWords: remote.words.length,
        localFingerprint,
        remoteFingerprint
      };
      try{ localStorage.setItem(RUN_REPORT_KEY, JSON.stringify(report)); }catch(_){ }

      await logRun(ok ? 'ok' : 'failed', report);
      setBadge(ok ? 'ok' : 'partial', ok ? 'Синхронизация завершена' : 'Синхронизация завершена частично');
      await applyToUi();
    }catch(err){
      console.error(err);
      setBadge(`failed (${shortErr(err)})`, `Ошибка синхронизации: ${explainErr(err)}`);
      await logRun('failed', { error: String(err && (err.message || err) || 'unknown') });
    }finally{
      state.syncing = false;
    }
  }

  async function waitBoot(){
    const t0 = Date.now();
    while(Date.now() - t0 < 15000){
      const st = document.getElementById('dictDbStatus');
      if(st && String(st.textContent || '').trim() === 'ok') return true;
      await new Promise((r) => setTimeout(r, 250));
    }
    return false;
  }

  async function run(reason){
    if(!state.client) return;
    const stock = await loadStockSnapshot();
    const marker = getOwnerMarker();

    const { data, error } = await state.client.auth.getUser();
    if(error){
      setBadge('auth-error', 'Ошибка авторизации');
      return;
    }

    const user = data && data.user ? data.user : null;
    state.userId = user ? user.id : null;

    if(!state.userId){
      const localNow = localToNamedSnapshot(await readLocal());
      const stockOnly = mergeSnapshots(stock, { sections: [], words: [] });
      const guestNeedsReset = fp(localNow) !== fp(stockOnly);
      if(marker !== 'guest' || reason === 'force-guest' || guestNeedsReset){
        await switchToGuest(stock);
      }else{
        setBadge('guest', 'Показаны только стоковые категории');
      }
      return;
    }

    if(marker !== state.userId){
      await switchToUser(stock);
      return;
    }

    await regularSync(stock);
  }

  async function init(){
    if(!(window.IKSupabase && typeof window.IKSupabase.getClient === 'function')){
      setBadge('off', 'Supabase не подключен');
      return;
    }

    state.client = window.IKSupabase.getClient();
    if(!state.client){
      setBadge('off', 'Supabase не подключен');
      return;
    }

    await waitBoot();
    await run('boot');

    state.client.auth.onAuthStateChange(() => {
      run('auth-change');
    });

    if(state.interval) clearInterval(state.interval);
    state.interval = setInterval(() => {
      run('interval');
    }, 90000);

    window.addEventListener('dict:local-changed', () => {
      if(state.localChangeTimer) clearTimeout(state.localChangeTimer);
      state.localChangeTimer = setTimeout(() => {
        run('local-change');
      }, 350);
    });

    document.addEventListener('visibilitychange', () => {
      if(document.visibilityState === 'visible') run('focus');
    });
  }

  init().catch((err) => {
    console.error(err);
    setBadge(`failed (${shortErr(err)})`, `Cloud sync init failed: ${explainErr(err)}`);
  });
})();
