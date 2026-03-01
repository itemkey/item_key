(() => {
  const CURRENT_KEY = 'itemkey.currentUser';
  const NAME_MAP_KEY = 'itemkey.supabaseNameMap';
  const NOTICE_STYLE_ID = 'ikAuthNoticeStyles';

  const guestBox = document.getElementById('authGuest');
  const profileBox = document.getElementById('authProfile');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const logoutBtn = document.getElementById('logoutBtn');
  const pLogin = document.getElementById('pLogin');
  const pEmail = document.getElementById('pEmail');

  function ensureNoticeStyles(){
    if(document.getElementById(NOTICE_STYLE_ID)) return;
    const st = document.createElement('style');
    st.id = NOTICE_STYLE_ID;
    st.textContent = [
      '.ik-auth-notice-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;z-index:100200;padding:16px;}',
      '.ik-auth-notice{width:min(420px,96vw);background:#fff;border:1px solid rgba(0,0,0,.18);box-shadow:0 10px 32px rgba(0,0,0,.16);padding:16px;}',
      '.ik-auth-notice__text{margin:0 0 12px;font-size:14px;line-height:1.45;color:#111;}',
      '.ik-auth-notice__actions{display:flex;gap:8px;justify-content:flex-end;}',
      '.ik-auth-notice__btn{appearance:none;border:1px solid rgba(0,0,0,.2);background:#fff;color:#111;padding:8px 12px;cursor:pointer;font-size:12px;letter-spacing:.04em;text-transform:uppercase;}',
      '.ik-auth-notice__btn--main{background:#111;color:#fff;border-color:#111;}'
    ].join('');
    document.head.appendChild(st);
  }

  function showNotice(text, options){
    ensureNoticeStyles();
    const opts = options || {};
    const backdrop = document.createElement('div');
    backdrop.className = 'ik-auth-notice-backdrop';
    const box = document.createElement('div');
    box.className = 'ik-auth-notice';
    const p = document.createElement('p');
    p.className = 'ik-auth-notice__text';
    p.textContent = String(text || '').trim() || 'Готово';

    const actions = document.createElement('div');
    actions.className = 'ik-auth-notice__actions';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'ik-auth-notice__btn';
    closeBtn.textContent = opts.closeLabel || 'Закрыть';
    closeBtn.addEventListener('click', () => backdrop.remove());
    actions.appendChild(closeBtn);

    if(opts.actionLabel && typeof opts.onAction === 'function'){
      const goBtn = document.createElement('button');
      goBtn.type = 'button';
      goBtn.className = 'ik-auth-notice__btn ik-auth-notice__btn--main';
      goBtn.textContent = opts.actionLabel;
      goBtn.addEventListener('click', () => {
        try{ opts.onAction(); }finally{ backdrop.remove(); }
      });
      actions.appendChild(goBtn);
    }

    box.appendChild(p);
    box.appendChild(actions);
    backdrop.appendChild(box);
    backdrop.addEventListener('click', (e) => {
      if(e.target === backdrop) backdrop.remove();
    });
    document.body.appendChild(backdrop);
  }

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
      showNotice('Ошибка инициализации');
      return;
    }

    const supa = window.IKSupabase.getClient();
    if(!supa){
      showNotice('Ошибка инициализации');
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
          showNotice('Заполни логин, почту и пароль');
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
          showNotice('Ошибка регистрации');
          return;
        }

        setNameForEmail(email, name);
        renderSession(data && data.user ? data.user : null);
        showNotice('Успешная регистрация', {
          actionLabel: 'Перейти к сайту',
          closeLabel: 'Остаться',
          onAction: () => {
            window.location.href = 'index.html';
          }
        });
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
          showNotice('Введи почту и пароль');
          return;
        }

        const { data, error } = await supa.auth.signInWithPassword({
          email,
          password: pass
        });

        if(error){
          showNotice('Ошибка входа');
          return;
        }

        renderSession(data && data.user ? data.user : null);
      });
    }

    if(logoutBtn){
      logoutBtn.addEventListener('click', async () => {
        const { error } = await supa.auth.signOut();
        if(error){
          showNotice('Ошибка выхода');
          return;
        }
        renderSession(null);
      });
    }
  }

  init().catch((err) => {
    console.error(err);
    showNotice('Ошибка инициализации');
  });
})();
