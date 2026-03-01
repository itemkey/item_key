(function(){
  const DB_VERSION = 1;
  const DB_SECTIONS = 'sections';
  const DB_WORDS = 'words';
  const REPORT_KEY = 'student_helper_dict_cloud_report_v1';
  const SECTION_TABLE = 'sh_dictionary_sections';
  const WORD_TABLE = 'sh_dictionary_words';
  const RUNS_TABLE = 'sh_migration_runs';

  const state = {
    syncing: false,
    timer: null,
    userId: null,
    client: null
  };

  function normSpaces(v){
    return String(v || '').trim().replace(/\s+/g, ' ');
  }

  function normalize(v){
    return String(v || '').trim().toLowerCase();
  }

  function normEnCmp(v){
    return normSpaces(v).toLowerCase();
  }

  function normRuCmp(v){
    return normSpaces(v).toLowerCase().replaceAll('ё', 'е');
  }

  function dictDbName(){
    if(typeof window.dbNameFor === 'function') return window.dbNameFor('dictionary');
    return 'student_helper_db__dictionary';
  }

  function setBadge(text, title){
    const badge = document.getElementById('dictSeedBadge');
    if(!badge) return;
    badge.dataset.cloud = text;
    const base = badge.textContent || '';
    const clean = base.replace(/\s*\|\s*cloud:[^|]+$/i, '').trim();
    badge.textContent = `${clean} | cloud: ${text}`;
    if(title) badge.title = title;
  }

  function openDb(){
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(dictDbName(), DB_VERSION);
      req.onerror = () => reject(req.error || new Error('open db failed'));
      req.onsuccess = () => resolve(req.result);
    });
  }

  function txDone(tx, db){
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => { try{ db.close(); }catch(_){ } resolve(true); };
      tx.onerror = () => { try{ db.close(); }catch(_){ } reject(tx.error || new Error('tx failed')); };
      tx.onabort = () => { try{ db.close(); }catch(_){ } reject(tx.error || new Error('tx aborted')); };
    });
  }

  function reqAsPromise(req){
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('request failed'));
    });
  }

  async function readLocalSnapshot(){
    const db = await openDb();
    const tx = db.transaction([DB_SECTIONS, DB_WORDS], 'readonly');
    const sReq = tx.objectStore(DB_SECTIONS).getAll();
    const wReq = tx.objectStore(DB_WORDS).getAll();
    const [sections, words] = await Promise.all([reqAsPromise(sReq), reqAsPromise(wReq)]);
    await txDone(tx, db);
    return {
      sections: Array.isArray(sections) ? sections : [],
      words: Array.isArray(words) ? words : []
    };
  }

  async function ensureLocalSections(remoteSections){
    if(!Array.isArray(remoteSections) || !remoteSections.length) return;
    const snap = await readLocalSnapshot();
    const have = new Set(snap.sections.map((s) => normalize(s.nameKey || s.name || '')));
    const toAdd = remoteSections
      .map((s) => ({
        name: normSpaces(s.name || ''),
        nameKey: normalize(s.name_key || s.name || '')
      }))
      .filter((s) => s.name && s.nameKey && !have.has(s.nameKey));
    if(!toAdd.length) return;

    const db = await openDb();
    const tx = db.transaction([DB_SECTIONS], 'readwrite');
    const store = tx.objectStore(DB_SECTIONS);
    for(const s of toAdd){
      store.add({
        name: s.name,
        nameKey: s.nameKey,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }
    await txDone(tx, db);
  }

  async function ensureLocalWords(remoteWords, sectionIdByNameKey){
    if(!Array.isArray(remoteWords) || !remoteWords.length) return;
    const snap = await readLocalSnapshot();
    const have = new Set(snap.words.map((w) => String(w.pairKey || '')));
    const toAdd = [];

    for(const w of remoteWords){
      const nameKey = normalize(w.section_name_key || '');
      const sectionId = sectionIdByNameKey.get(nameKey);
      if(!sectionId) continue;

      const en = normSpaces(w.en || '');
      const ru = String(w.ru || '').trim();
      if(!en || !ru) continue;

      const enKey = normEnCmp(en);
      const ruKey = normRuCmp(ru);
      const pairKey = `${sectionId}|${enKey}|${ruKey}`;
      if(have.has(pairKey)) continue;
      have.add(pairKey);

      toAdd.push({
        sectionId,
        en,
        ru,
        enKey,
        ruKey,
        pairKey,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    if(!toAdd.length) return;
    const db = await openDb();
    const tx = db.transaction([DB_WORDS], 'readwrite');
    const store = tx.objectStore(DB_WORDS);
    for(const row of toAdd) store.add(row);
    await txDone(tx, db);
  }

  function chunk(list, size){
    const out = [];
    for(let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
  }

  async function selectAllOwned(table, columns, userId){
    const rows = [];
    const page = 1000;
    let from = 0;

    while(true){
      const { data, error } = await state.client
        .from(table)
        .select(columns)
        .eq('owner_id', userId)
        .order('id', { ascending: true })
        .range(from, from + page - 1);

      if(error) throw error;
      const chunkRows = Array.isArray(data) ? data : [];
      rows.push(...chunkRows);
      if(chunkRows.length < page) break;
      from += page;
    }

    return rows;
  }

  function fingerprint(snapshot){
    const sectionKeys = snapshot.sections
      .map((s) => normalize(s.nameKey || s.name || ''))
      .filter(Boolean)
      .sort();

    const sectionById = new Map();
    snapshot.sections.forEach((s) => sectionById.set(Number(s.id), normalize(s.nameKey || s.name || '')));

    const wordKeys = snapshot.words
      .map((w) => {
        const sid = Number(w.sectionId || 0);
        const sectionKey = sectionById.get(sid) || '';
        const enKey = normEnCmp(w.en || w.enKey || '');
        const ruKey = normRuCmp(w.ru || w.ruKey || '');
        return `${sectionKey}|${enKey}|${ruKey}`;
      })
      .filter(Boolean)
      .sort();

    return `${sectionKeys.join('||')}##${wordKeys.join('||')}`;
  }

  async function pushLocalToRemote(local){
    const sectionsPayload = local.sections
      .map((s) => ({
        owner_id: state.userId,
        name: normSpaces(s.name || ''),
        name_key: normalize(s.nameKey || s.name || ''),
        source: 'imported_local'
      }))
      .filter((s) => s.name && s.name_key);

    for(const part of chunk(sectionsPayload, 500)){
      const { error } = await state.client
        .from(SECTION_TABLE)
        .upsert(part, { onConflict: 'owner_id,name_key' });
      if(error) throw error;
    }

    const remoteSections = await selectAllOwned(SECTION_TABLE, 'id,name_key', state.userId);
    const sectionIdByNameKey = new Map();
    for(const s of remoteSections){
      sectionIdByNameKey.set(normalize(s.name_key), Number(s.id));
    }

    const sectionByLocalId = new Map();
    for(const s of local.sections){
      sectionByLocalId.set(Number(s.id), normalize(s.nameKey || s.name || ''));
    }

    const wordsPayload = [];
    for(const w of local.words){
      const localSid = Number(w.sectionId || 0);
      const sectionNameKey = sectionByLocalId.get(localSid);
      const remoteSid = sectionNameKey ? sectionIdByNameKey.get(sectionNameKey) : null;
      if(!remoteSid) continue;

      const en = normSpaces(w.en || '');
      const ru = String(w.ru || '').trim();
      if(!en || !ru) continue;

      const enKey = normEnCmp(en);
      const ruKey = normRuCmp(ru);
      wordsPayload.push({
        owner_id: state.userId,
        section_id: remoteSid,
        en,
        ru,
        en_key: enKey,
        ru_key: ruKey,
        pair_key: `${sectionNameKey}|${enKey}|${ruKey}`,
        source: 'imported_local'
      });
    }

    for(const part of chunk(wordsPayload, 500)){
      const { error } = await state.client
        .from(WORD_TABLE)
        .upsert(part, { onConflict: 'owner_id,pair_key' });
      if(error) throw error;
    }

    return {
      sections: sectionsPayload.length,
      words: wordsPayload.length
    };
  }

  async function pullRemoteToLocal(){
    const remoteSections = await selectAllOwned(SECTION_TABLE, 'id,name,name_key', state.userId);
    const remoteWordsRaw = await selectAllOwned(WORD_TABLE, 'id,section_id,en,ru,en_key,ru_key,pair_key', state.userId);

    if(!remoteSections.length && !remoteWordsRaw.length){
      return { remoteSections, remoteWords: [] };
    }

    await ensureLocalSections(remoteSections);
    const snap = await readLocalSnapshot();
    const localSectionIdByNameKey = new Map();
    for(const s of snap.sections){
      localSectionIdByNameKey.set(normalize(s.nameKey || s.name || ''), Number(s.id));
    }

    const remoteSectionNameById = new Map();
    for(const s of remoteSections){
      remoteSectionNameById.set(Number(s.id), normalize(s.name_key || s.name || ''));
    }

    const remoteWords = remoteWordsRaw.map((w) => ({
      section_name_key: remoteSectionNameById.get(Number(w.section_id)) || '',
      en: w.en,
      ru: w.ru,
      en_key: w.en_key,
      ru_key: w.ru_key,
      pair_key: w.pair_key
    }));

    await ensureLocalWords(remoteWords, localSectionIdByNameKey);
    return { remoteSections, remoteWords };
  }

  async function writeRunLog(payload){
    try{
      await state.client.from(RUNS_TABLE).insert({
        owner_id: state.userId,
        run_type: 'dictionary',
        status: payload.status,
        local_sections_count: payload.local_sections_count,
        local_words_count: payload.local_words_count,
        remote_sections_count: payload.remote_sections_count,
        remote_words_count: payload.remote_words_count,
        local_fingerprint: payload.local_fingerprint,
        remote_fingerprint: payload.remote_fingerprint,
        details: payload.details || {}
      });
    }catch(_){ }
  }

  async function syncOnce(reason){
    if(state.syncing || !state.client || !state.userId) return;
    state.syncing = true;
    setBadge('sync...', `sync reason: ${reason}`);

    try{
      const localBefore = await readLocalSnapshot();
      const pull = await pullRemoteToLocal();
      const localAfterPull = await readLocalSnapshot();
      await pushLocalToRemote(localAfterPull);

      const remoteSectionsFinal = await selectAllOwned(SECTION_TABLE, 'id,name_key', state.userId);
      const remoteWordsFinal = await selectAllOwned(WORD_TABLE, 'id,pair_key', state.userId);

      const localFingerprint = fingerprint(localAfterPull);
      const remoteFingerprint = `${remoteSectionsFinal.map((s) => normalize(s.name_key)).sort().join('||')}##${remoteWordsFinal.map((w) => String(w.pair_key || '')).sort().join('||')}`;
      const status = localFingerprint === remoteFingerprint ? 'ok' : 'partial';

      const report = {
        ts: Date.now(),
        reason,
        status,
        localBefore: {
          sections: localBefore.sections.length,
          words: localBefore.words.length
        },
        localAfter: {
          sections: localAfterPull.sections.length,
          words: localAfterPull.words.length
        },
        remote: {
          sections: remoteSectionsFinal.length,
          words: remoteWordsFinal.length
        }
      };
      localStorage.setItem(REPORT_KEY, JSON.stringify(report));

      await writeRunLog({
        status: status === 'ok' ? 'ok' : 'failed',
        local_sections_count: localAfterPull.sections.length,
        local_words_count: localAfterPull.words.length,
        remote_sections_count: remoteSectionsFinal.length,
        remote_words_count: remoteWordsFinal.length,
        local_fingerprint: localFingerprint,
        remote_fingerprint: remoteFingerprint,
        details: report
      });

      if(status === 'ok'){
        setBadge('ok', `cloud sync ok\nlocal sections: ${report.localAfter.sections}\nlocal words: ${report.localAfter.words}\nremote sections: ${report.remote.sections}\nremote words: ${report.remote.words}`);
      }else{
        setBadge('partial', 'cloud sync finished with fingerprint mismatch');
      }
    }catch(err){
      console.error(err);
      setBadge('failed', `cloud sync error: ${err && err.message ? err.message : err}`);
      await writeRunLog({
        status: 'failed',
        local_sections_count: 0,
        local_words_count: 0,
        remote_sections_count: 0,
        remote_words_count: 0,
        local_fingerprint: null,
        remote_fingerprint: null,
        details: {
          reason,
          error: String(err && (err.message || err) || 'unknown error')
        }
      });
    }finally{
      state.syncing = false;
    }
  }

  function waitDictReady(timeoutMs){
    const started = Date.now();
    return new Promise((resolve) => {
      function probe(){
        const el = document.getElementById('dictDbStatus');
        if(el && String(el.textContent || '').trim() === 'ok'){
          resolve(true);
          return;
        }
        if(Date.now() - started >= timeoutMs){
          resolve(false);
          return;
        }
        setTimeout(probe, 350);
      }
      probe();
    });
  }

  async function init(){
    if(!(window.IKSupabase && typeof window.IKSupabase.getClient === 'function')){
      setBadge('off', 'supabase client missing');
      return;
    }

    state.client = window.IKSupabase.getClient();
    if(!state.client){
      setBadge('off', 'supabase sdk missing');
      return;
    }

    const { data, error } = await state.client.auth.getUser();
    if(error){
      setBadge('auth-error', `auth error: ${error.message || error}`);
      return;
    }

    const user = data && data.user;
    if(!user){
      setBadge('login', 'Войди через item-user, чтобы синхронизировать словарь с Supabase.');
      return;
    }

    state.userId = user.id;
    await waitDictReady(20000);
    await syncOnce('boot');

    if(state.timer) clearInterval(state.timer);
    state.timer = setInterval(() => {
      syncOnce('interval');
    }, 60000);

    document.addEventListener('visibilitychange', () => {
      if(document.visibilityState === 'visible') syncOnce('focus');
    });

    state.client.auth.onAuthStateChange((_evt, session) => {
      const uid = session && session.user ? session.user.id : null;
      state.userId = uid;
      if(uid) syncOnce('auth-change');
      else setBadge('login', 'Войди через item-user, чтобы синхронизировать словарь с Supabase.');
    });
  }

  init().catch((err) => {
    console.error(err);
    setBadge('failed', `cloud init failed: ${err && err.message ? err.message : err}`);
  });
})();
