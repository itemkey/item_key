(() => {
  const SUPABASE_URL = 'https://uuolcnmefpasncnkgqdr.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1b2xjbm1lZnBhc25jbmtncWRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNTY1ODgsImV4cCI6MjA4NzkzMjU4OH0.cc6qrQrnBVAj_uiO8IFbH1Jj3YeuWjSgI-fjTmr3-g4';

  let client = null;

  function hasSdk(){
    return !!(window.supabase && typeof window.supabase.createClient === 'function');
  }

  function getClient(){
    if(client) return client;
    if(!hasSdk()) return null;
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return client;
  }

  async function getSession(){
    const c = getClient();
    if(!c) return null;
    const { data, error } = await c.auth.getSession();
    if(error) throw error;
    return (data && data.session) || null;
  }

  async function getUser(){
    const c = getClient();
    if(!c) return null;
    const { data, error } = await c.auth.getUser();
    if(error) throw error;
    return (data && data.user) || null;
  }

  window.IKSupabase = {
    url: SUPABASE_URL,
    getClient,
    getSession,
    getUser,
  };
})();
