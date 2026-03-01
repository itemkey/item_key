(() => {
  const CURRENT_KEY = 'itemkey.currentUser';
  const NAME_MAP_KEY = 'itemkey.supabaseNameMap';

  const guestBox = document.getElementById('authGuest');
  const profileBox = document.getElementById('authProfile');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const logoutBtn = document.getElementById('logoutBtn');
  const pLogin = document.getElementById('pLogin');
  const pEmail = document.getElementById('pEmail');

  function readJson(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) return fallback;
      return JSON.parse(raw);
    }catch(_){
      return fallback;
    }
  }

  function writeJson(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_){ }
  }

  function normalizeEmail(v){
    return String(v || '').trim().toLowerCase();
  }

  function setNameForEmail(email, name){
    const map = readJson(NAME_MAP_KEY, {});
    const e = normalizeEmail(email);
    const n = String(name || '').trim();
    if(!e || !n) return;
    map[e] = n;
    writeJson(NAME_MAP_KEY, map);
  }

  function getNameForEmail(email){
    const map = readJson(NAME_MAP_KEY, {});
    return map[normalizeEmail(email)] || '';
  }

  function displayNameFromUser(user){
    if(!user) return '';
    const meta = user.user_metadata || {};
    const fromMeta = String(meta.username || meta.login || '').trim();
    if(fromMeta) return fromMeta;
    const fromMap = getNameForEmail(user.email || '');
    if(fromMap) return fromMap;
    const localPart = String(user.email || '').split('@')[0] || 'user';
    return localPart;
  }

  function setLegacyCurrentUser(user){
    if(!user){
      try{ localStorage.removeItem(CURRENT_KEY); }catch(_){ }
      return;
    }
    const payload = {
      id: user.id,
      name: displayNameFromUser(user),
      email: user.email || '',
      provider: 'supabase'
    };
    writeJson(CURRENT_KEY, payload);
  }

  function renderSession(user){
    if(!guestBox || !profileBox) return;
    if(user){
      guestBox.classList.add('hidden');
      profileBox.classList.remove('hidden');
      if(pLogin) pLogin.textContent = displayNameFromUser(user);
      if(pEmail) pEmail.textContent = user.email || '';
      setLegacyCurrentUser(user);
      return;
    }

    guestBox.classList.remove('hidden');
    profileBox.classList.add('hidden');
    setLegacyCurrentUser(null);
  }

  function setupTabs(){
    document.querySelectorAll('.auth-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach((t) => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        if(loginForm) loginForm.classList.toggle('hidden', tab.dataset.tab !== 'login');
        if(registerForm) registerForm.classList.toggle('hidden', tab.dataset.tab !== 'register');
      });
    });
  }

  async function init(){
    setupTabs();

    if(!(window.IKSupabase && window.IKSupabase.getClient)){
      alert('Supabase SDK не загружен. Обнови страницу.');
      return;
    }

    const supa = window.IKSupabase.getClient();
    if(!supa){
      alert('Supabase клиент не инициализирован.');
      return;
    }

    const { data: sessionData } = await supa.auth.getSession();
    renderSession(sessionData && sessionData.session ? sessionData.session.user : null);

    supa.auth.onAuthStateChange((_evt, session) => {
      renderSession(session ? session.user : null);
    });

    if(registerForm){
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('regName');
        const emailInput = document.getElementById('regEmail');
        const passInput = document.getElementById('regPass');

        const name = String(nameInput && nameInput.value || '').trim();
        const email = normalizeEmail(emailInput && emailInput.value);
        const pass = String(passInput && passInput.value || '');

        if(!name || !email || !pass){
          alert('Заполни логин, почту и пароль.');
          return;
        }

        const { data, error } = await supa.auth.signUp({
          email,
          password: pass,
          options: {
            data: { username: name }
          }
        });

        if(error){
          alert(`Ошибка регистрации: ${error.message || error}`);
          return;
        }

        setNameForEmail(email, name);
        renderSession(data && data.user ? data.user : null);
        alert('Аккаунт создан. Теперь можно работать со словарем в облаке.');
      });
    }

    if(loginForm){
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const loginInput = document.getElementById('loginName');
        const passInput = document.getElementById('loginPass');

        const email = normalizeEmail(loginInput && loginInput.value);
        const pass = String(passInput && passInput.value || '');

        if(!email || !pass){
          alert('Введи почту и пароль.');
          return;
        }

        const { data, error } = await supa.auth.signInWithPassword({
          email,
          password: pass
        });

        if(error){
          alert(`Ошибка входа: ${error.message || error}`);
          return;
        }

        renderSession(data && data.user ? data.user : null);
      });
    }

    if(logoutBtn){
      logoutBtn.addEventListener('click', async () => {
        const { error } = await supa.auth.signOut();
        if(error){
          alert(`Ошибка выхода: ${error.message || error}`);
          return;
        }
        renderSession(null);
      });
    }
  }

  init().catch((err) => {
    console.error(err);
    alert(`Auth init failed: ${err && err.message ? err.message : err}`);
  });
})();
