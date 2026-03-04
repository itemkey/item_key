const runtime = {
  client: null,
  lastText: '',
  lastTitle: ''
};

function errText(error) {
  if (!error) return 'unknown';
  const parts = [];
  if (error.message) parts.push(String(error.message));
  if (error.code) parts.push(`code=${error.code}`);
  if (error.details) parts.push(`details=${error.details}`);
  if (error.hint) parts.push(`hint=${error.hint}`);
  return parts.length ? parts.join(' | ') : String(error);
}

function setBadge(text, title) {
  const el = document.getElementById('planningCloudBadge');
  if (!el) return;

  const safeText = String(text || '').trim() || 'off';
  const safeTitle = String(title || '').trim();

  el.textContent = `planning cloud: ${safeText}`;
  if (safeTitle) el.title = safeTitle;

  if (safeText !== runtime.lastText || safeTitle !== runtime.lastTitle) {
    runtime.lastText = safeText;
    runtime.lastTitle = safeTitle;
    if (typeof window.IKAdminLog === 'function') {
      const payload = safeTitle ? `planning cloud: ${safeText} | ${safeTitle}` : `planning cloud: ${safeText}`;
      window.IKAdminLog('log', 'planning', payload);
    }
  }
}

async function getUserId() {
  if (!runtime.client) return null;
  const { data, error } = await runtime.client.auth.getUser();
  if (error) throw error;
  return data && data.user ? data.user.id : null;
}

function getClient() {
  if (runtime.client) return runtime.client;
  if (!(window.IKSupabase && typeof window.IKSupabase.getClient === 'function')) return null;
  runtime.client = window.IKSupabase.getClient();
  return runtime.client;
}

export function setPlanningCloudBadge(text, title) {
  setBadge(text, title);
}

export function getPlanningCloudClient() {
  return getClient();
}

export async function initPlanningCloud() {
  setBadge('off', 'init');

  const client = getClient();
  if (!client) {
    setBadge('off', 'supabase client missing');
    return;
  }

  try {
    const userId = await getUserId();
    if (!userId) {
      setBadge('off', 'login required');
    } else {
      setBadge('ready', 'authenticated');
    }
  } catch (error) {
    setBadge('off', errText(error));
  }

  window.IKPlanningCloud = {
    setBadge: setPlanningCloudBadge,
    getClient: getPlanningCloudClient,
    getUserId
  };
}
