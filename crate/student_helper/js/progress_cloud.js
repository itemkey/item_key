(function(){
  const TABLE = 'sh_user_state';
  const OWNER_MARKER = 'sh_cloud_owner_v1';
  const CACHE_PREFIX = 'sh_cloud_cache_v1__';

  const EXACT_KEYS = [
    'sh_tenses_ui_v1',
    'sh_tenses_daily_v1'
  ];

  const PREFIX_KEYS = [
    'sh_tenses_progress_',
    'sh_struct_progress_'
  ];

  const state = {
    client: null,
    ownerId: null,
    syncing: false,
    muted: false,
    timer: null,
    lastBadgeText: '',
    lastBadgeTitle: ''
  };

  function setBadge(stateText, title){
    const el = document.getElementById('progressCloudBadge');
    if(!el) return;
    el.textContent = `progress cloud: ${stateText}`;
    if(title) el.title = title;
    const nextText = String(stateText || '');
    const nextTitle = String(title || '');
    if(nextText !== state.lastBadgeText || nextTitle !== state.lastBadgeTitle){
      state.lastBadgeText = nextText;
      state.lastBadgeTitle = nextTitle;
      if(window.IKAdminLog){
        const payload = nextTitle ? `progress cloud: ${nextText} | ${nextTitle}` : `progress cloud: ${nextText}`;
        window.IKAdminLog('log', 'student_helper', payload);
      }
    }
  }

  function shortReason(err){
    const msg = String(err && (err.message || err) || '').toLowerCase();
    if(!msg) return 'unknown';
    if(msg.includes('could not find the table') || msg.includes('relation') && msg.includes('does not exist')) return 'table';
    if(msg.includes('row-level security') || msg.includes('permission denied')) return 'rls';
    if(msg.includes('jwt') || msg.includes('auth')) return 'auth';
    if(msg.includes('network') || msg.includes('fetch')) return 'network';
    return 'error';
  }

  function isManagedKey(key){
    const k = String(key || '');
    if(!k) return false;
    if(EXACT_KEYS.includes(k)) return true;
    return PREFIX_KEYS.some((p) => k.startsWith(p));
  }

  function managedKeys(){
    const keys = [];
    for(let i = 0; i < localStorage.length; i += 1){
      const key = localStorage.key(i);
      if(isManagedKey(key)) keys.push(String(key));
    }
    return keys.sort();
  }

  function parseMaybeJson(raw){
    try{ return JSON.parse(raw); }catch(_){ return raw; }
  }

  function stableHash(value){
    const s = typeof value === 'string' ? value : JSON.stringify(value);
    let h = 2166136261;
    for(let i = 0; i < s.length; i += 1){
      h ^= s.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return `h${(h >>> 0).toString(16)}`;
  }

  function localSnapshot(){
    const rows = [];
    for(const key of managedKeys()){
      const raw = localStorage.getItem(key);
      if(raw == null) continue;
      const value = parseMaybeJson(raw);
      rows.push({
        state_key: key,
        state_value: value,
        state_hash: stableHash(value)
      });
    }
    return rows;
  }

  function cacheKey(owner){
    return `${CACHE_PREFIX}${String(owner || 'guest')}`;
  }

  function saveCache(owner){
    try{
      const snap = localSnapshot();
      localStorage.setItem(cacheKey(owner), JSON.stringify(snap));
    }catch(_){ }
  }

  function loadCache(owner){
    try{
      const raw = localStorage.getItem(cacheKey(owner));
      if(!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    }catch(_){
      return [];
    }
  }

  function clearManagedLocal(){
    for(const key of managedKeys()) localStorage.removeItem(key);
  }

  function applyRowsToLocal(rows, replaceAll){
    state.muted = true;
    try{
      if(replaceAll) clearManagedLocal();
      for(const row of (rows || [])){
        if(!row || !isManagedKey(row.state_key)) continue;
        const value = row.state_value;
        const text = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(row.state_key, text);
      }
    } finally {
      state.muted = false;
    }
  }

  function currentMarker(){
    try{ return localStorage.getItem(OWNER_MARKER) || 'guest'; }catch(_){ return 'guest'; }
  }

  function setMarker(v){
    try{ localStorage.setItem(OWNER_MARKER, v || 'guest'); }catch(_){ }
  }

  async function selectOwned(){
    const out = [];
    let from = 0;
    const size = 1000;
    while(true){
      const { data, error } = await state.client
        .from(TABLE)
        .select('id,state_key,state_value,state_hash,updated_at')
        .eq('owner_id', state.ownerId)
        .order('id', { ascending: true })
        .range(from, from + size - 1);
      if(error) throw error;
      const part = Array.isArray(data) ? data : [];
      out.push(...part.filter((x) => isManagedKey(x.state_key)));
      if(part.length < size) break;
      from += size;
    }
    return out;
  }

  async function syncLocalToRemote(){
    if(!state.client || !state.ownerId || state.syncing) return;
    state.syncing = true;
    setBadge('sync', 'syncing local progress to cloud');
    try{
      const local = localSnapshot();
      const remote = await selectOwned();
      const localKeys = new Set(local.map((x) => x.state_key));

      const deleteIds = remote
        .filter((r) => !localKeys.has(r.state_key))
        .map((r) => Number(r.id))
        .filter((v) => Number.isFinite(v));

      for(let i = 0; i < deleteIds.length; i += 200){
        const part = deleteIds.slice(i, i + 200);
        const { error } = await state.client
          .from(TABLE)
          .delete()
          .eq('owner_id', state.ownerId)
          .in('id', part);
        if(error) throw error;
      }

      if(local.length){
        const payload = local.map((x) => ({
          owner_id: state.ownerId,
          state_key: x.state_key,
          state_value: x.state_value,
          state_hash: x.state_hash
        }));
        const { error } = await state.client
          .from(TABLE)
          .upsert(payload, { onConflict: 'owner_id,state_key' });
        if(error) throw error;
      }
      setBadge('ok', 'cloud progress sync is active');
    }catch(e){
      console.warn('progress cloud sync failed:', e);
      setBadge(`off (${shortReason(e)})`, `sync failed: ${String(e && (e.message || e) || 'unknown')}`);
    }finally{
      state.syncing = false;
    }
  }

  function scheduleSync(){
    if(state.muted || !state.ownerId) return;
    if(state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      syncLocalToRemote();
    }, 500);
  }

  async function switchOwner(nextOwner){
    const prev = currentMarker();
    if(prev !== nextOwner){
      saveCache(prev);
    }

    if(nextOwner === 'guest'){
      const guestRows = loadCache('guest');
      applyRowsToLocal(guestRows, true);
      setMarker('guest');
      state.ownerId = null;
      setBadge('off', 'login required for cloud progress');
      return;
    }

    const cached = loadCache(nextOwner);
    applyRowsToLocal(cached, true);
    setMarker(nextOwner);
    state.ownerId = nextOwner;

    try{
      const remote = await selectOwned();
      const have = new Set(managedKeys());
      const missing = remote.filter((r) => !have.has(r.state_key));
      if(missing.length) applyRowsToLocal(missing, false);
      setBadge('ok', 'cloud progress sync is active');
    }catch(e){
      console.warn('progress cloud pull failed:', e);
      setBadge(`off (${shortReason(e)})`, `pull failed: ${String(e && (e.message || e) || 'unknown')}`);
    }

    await syncLocalToRemote();
  }

  function installLocalHooks(){
    const originalSetItem = Storage.prototype.setItem;
    const originalRemoveItem = Storage.prototype.removeItem;

    Storage.prototype.setItem = function(key, value){
      const result = originalSetItem.call(this, key, value);
      if(this === localStorage && isManagedKey(key)) scheduleSync();
      return result;
    };

    Storage.prototype.removeItem = function(key){
      const result = originalRemoveItem.call(this, key);
      if(this === localStorage && isManagedKey(key)) scheduleSync();
      return result;
    };
  }

  async function init(){
    if(!(window.IKSupabase && typeof window.IKSupabase.getClient === 'function')) return;
    state.client = window.IKSupabase.getClient();
    if(!state.client){
      setBadge('off', 'supabase client not available');
      return;
    }

    installLocalHooks();

    const { data } = await state.client.auth.getUser();
    const user = data && data.user ? data.user : null;
    await switchOwner(user ? user.id : 'guest');

    state.client.auth.onAuthStateChange(async (_evt, session) => {
      const uid = session && session.user ? session.user.id : 'guest';
      await switchOwner(uid);
    });
  }

  init().catch((e) => {
    console.warn('progress cloud init failed:', e);
    setBadge(`off (${shortReason(e)})`, `init failed: ${String(e && (e.message || e) || 'unknown')}`);
  });
})();
