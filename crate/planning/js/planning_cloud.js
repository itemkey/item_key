const LOCAL_KEY = 'itemkey_planning_v1';
const OWNER_KEY = 'planning_owner_v1';
const CACHE_PREFIX = 'planning_cache_v1__';
const BACKUP_PREFIX = 'planning_backup_v1__';
const PLAN_TABLE = 'sh_plan_state';
const PLAN_FALLBACK_TABLE = 'sh_user_state';
const STATE_KEY = 'planning_state_v1';

const runtime = {
  client: null,
  userId: null,
  table: PLAN_TABLE,
  muted: false,
  timer: null,
  syncing: false,
  authBound: false,
  hooksInstalled: false,
  booting: false,
};

function setBadge(text, title){
  const el = document.getElementById('planningCloudBadge');
  if(!el) return;
  el.textContent = `planning cloud: ${text}`;
  if(title) el.title = title;
}

function errText(e){
  if(!e) return 'unknown';
  const parts = [];
  if(e.message) parts.push(String(e.message));
  if(e.code) parts.push(`code=${e.code}`);
  if(e.details) parts.push(`details=${e.details}`);
  if(e.hint) parts.push(`hint=${e.hint}`);
  if(!parts.length) parts.push(String(e));
  return parts.join(' | ');
}

function isMissingTableError(e){
  const msg = String(e && (e.message || e) || '').toLowerCase();
  const code = String(e && e.code || '').toUpperCase();
  return code === 'PGRST205' || msg.includes('could not find the table') || (msg.includes('relation') && msg.includes('does not exist'));
}

function storageGet(key){
  try{ return localStorage.getItem(key); }catch(_){ return null; }
}

function storageSet(key, value){
  runtime.muted = true;
  try{ localStorage.setItem(key, value); }catch(_){ }
  runtime.muted = false;
}

function storageDel(key){
  runtime.muted = true;
  try{ localStorage.removeItem(key); }catch(_){ }
  runtime.muted = false;
}

function cacheKey(owner){
  return `${CACHE_PREFIX}${String(owner || 'guest')}`;
}

function saveOwnerCache(owner, raw){
  try{
    if(!raw) return;
    localStorage.setItem(cacheKey(owner), raw);
  }catch(_){ }
}

function saveOwnerBackup(owner, raw){
  try{
    if(!raw) return;
    const key = `${BACKUP_PREFIX}${String(owner || 'guest')}`;
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), raw }));
  }catch(_){ }
}

function loadOwnerCache(owner){
  try{ return localStorage.getItem(cacheKey(owner)); }catch(_){ return null; }
}

function hashString(s){
  const str = String(s || '');
  let h = 2166136261;
  for(let i = 0; i < str.length; i += 1){
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return `h${(h >>> 0).toString(16)}`;
}

async function resolveTable(){
  try{
    const t1 = await runtime.client.from(PLAN_TABLE).select('id', { head:true, count:'exact' }).limit(1);
    if(!t1.error) return PLAN_TABLE;
  }catch(_){ }

  try{
    const t2 = await runtime.client.from(PLAN_FALLBACK_TABLE).select('id', { head:true, count:'exact' }).limit(1);
    if(!t2.error) return PLAN_FALLBACK_TABLE;
  }catch(_){ }

  return PLAN_TABLE;
}

async function pullRemote(){
  const run = async (table) => {
    const { data, error } = await runtime.client
      .from(table)
      .select('state_value')
      .eq('owner_id', runtime.userId)
      .eq('state_key', STATE_KEY)
      .maybeSingle();
    if(error) throw error;
    runtime.table = table;
    return data && data.state_value ? data.state_value : null;
  };

  try{
    return await run(runtime.table);
  }catch(e){
    if(runtime.table !== PLAN_FALLBACK_TABLE && isMissingTableError(e)){
      return run(PLAN_FALLBACK_TABLE);
    }
    throw e;
  }
}

async function pushRemoteRaw(raw){
  if(!raw) return;
  let parsed = null;
  try{ parsed = JSON.parse(raw); }catch(_){ return; }
  const payload = {
    owner_id: runtime.userId,
    state_key: STATE_KEY,
    state_value: parsed,
    state_hash: hashString(raw)
  };
  const run = async (table) => {
    const { error } = await runtime.client
      .from(table)
      .upsert(payload, { onConflict: 'owner_id,state_key' });
    if(error) throw error;
    runtime.table = table;
  };

  try{
    await run(runtime.table);
  }catch(e){
    if(runtime.table !== PLAN_FALLBACK_TABLE && isMissingTableError(e)){
      await run(PLAN_FALLBACK_TABLE);
      return;
    }
    throw e;
  }
}

async function syncNow(){
  if(runtime.syncing || !runtime.userId) return;
  runtime.syncing = true;
  setBadge('sync', 'syncing planning state');
  try{
    await pushRemoteRaw(storageGet(LOCAL_KEY));
    setBadge('ok', `table=${runtime.table}`);
  }catch(e){
    setBadge('off', errText(e));
  }finally{
    runtime.syncing = false;
  }
}

function scheduleSync(){
  if(runtime.muted || !runtime.userId) return;
  if(runtime.timer) clearTimeout(runtime.timer);
  runtime.timer = setTimeout(syncNow, 500);
}

function installLocalHooks(){
  if(runtime.hooksInstalled) return;
  runtime.hooksInstalled = true;
  const oldSetItem = Storage.prototype.setItem;
  const oldRemoveItem = Storage.prototype.removeItem;

  Storage.prototype.setItem = function(key, value){
    const res = oldSetItem.call(this, key, value);
    if(this === localStorage && String(key) === LOCAL_KEY) scheduleSync();
    return res;
  };

  Storage.prototype.removeItem = function(key){
    const res = oldRemoveItem.call(this, key);
    if(this === localStorage && String(key) === LOCAL_KEY) scheduleSync();
    return res;
  };
}

export async function initPlanningCloud(){
  if(runtime.booting) return;
  runtime.booting = true;
  setBadge('off', 'init');
  if(!(window.IKSupabase && typeof window.IKSupabase.getClient === 'function')){
    setBadge('off', 'supabase client missing');
    runtime.booting = false;
    return;
  }

  runtime.client = window.IKSupabase.getClient();
  if(!runtime.client){
    setBadge('off', 'supabase unavailable');
    runtime.booting = false;
    return;
  }

  installLocalHooks();

  if(!runtime.authBound && runtime.client.auth && typeof runtime.client.auth.onAuthStateChange === 'function'){
    runtime.authBound = true;
    runtime.client.auth.onAuthStateChange((_evt, session) => {
      const uid = session && session.user ? session.user.id : null;
      // If initial getUser() returned null but session appears later, restart cloud init.
      if(runtime.userId == null){
        if(uid) initPlanningCloud();
        else setBadge('off', 'login required');
        return;
      }
      if(String(uid || '') !== String(runtime.userId || '')){
        window.location.reload();
      }
    });
  }

  try{
    const out = await runtime.client.auth.getUser();
    const user = out && out.data && out.data.user ? out.data.user : null;
    runtime.userId = user ? user.id : null;
    if(!runtime.userId){
      const prevOwner = storageGet(OWNER_KEY) || '';
      const currentRaw = storageGet(LOCAL_KEY);
      if(prevOwner){
        saveOwnerCache(prevOwner, currentRaw);
        saveOwnerBackup(prevOwner, currentRaw);
      }
      storageDel(LOCAL_KEY);
      storageSet(OWNER_KEY, 'guest');
      setBadge('off', 'login required');
      return;
    }

    runtime.table = await resolveTable();

    const prevOwner = storageGet(OWNER_KEY) || '';
    const currentRaw = storageGet(LOCAL_KEY);

    // Strict privacy boundary:
    // if owner marker is missing or belongs to another user, never keep current local state
    // as active state for the new user.
    if(prevOwner !== runtime.userId){
      if(prevOwner){
        saveOwnerCache(prevOwner, currentRaw);
        saveOwnerBackup(prevOwner, currentRaw);
      }

      const cached = loadOwnerCache(runtime.userId);
      if(cached){
        storageSet(LOCAL_KEY, cached);
      } else {
        storageDel(LOCAL_KEY);
      }
    }

    storageSet(OWNER_KEY, runtime.userId);

    try{
      const remote = await pullRemote();
      if(remote && typeof remote === 'object'){
        storageSet(LOCAL_KEY, JSON.stringify(remote));
      }
    }catch(e){
      setBadge('off', errText(e));
      return;
    }

    await syncNow();

    // auth listener is bound above
  }catch(e){
    setBadge('off', errText(e));
  }finally{
    runtime.booting = false;
  }
}
