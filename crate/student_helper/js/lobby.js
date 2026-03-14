(function(){
  const lobby = document.getElementById('shLobby');
  const app = document.getElementById('shApp');

  const btnHome = document.getElementById('shHomeBtn');
  const btnDict = document.getElementById('shGoDict');
  const btnGrammar = document.getElementById('shGoGrammar');
  const btnWT = document.getElementById('shGoWT');
  const btnContinue = document.getElementById('shContinue');

  const KEY_LAST = 'sh_last_module';
  const KEY_SEEN = 'sh_seen_lobby';
  const VALID_ROUTES = new Set(['menu', 'dict', 'grammar', 'struct', 'tenses', 'wt', 'wt-practice', 'wt-text', 'wt-builder']);

  let ignoreNextHashChange = false;

  if (!lobby || !app || !btnDict || !btnGrammar || !btnWT || !btnHome) return;

  function setVisible(el, visible){
    el.hidden = !visible;
  }

  function normalizeRoute(route){
    const raw = String(route || '').trim().toLowerCase();
    if(!raw) return '';
    if(VALID_ROUTES.has(raw)) return raw;
    if(raw === 'practice') return 'wt-practice';
    if(raw === 'text') return 'wt-text';
    if(raw === 'builder') return 'wt-builder';
    return '';
  }

  function parseRoute(route){
    const normalized = normalizeRoute(route);
    if(!normalized) return null;

    if(normalized === 'menu') return { main: 'menu', wtSubtab: '' };
    if(normalized === 'struct' || normalized === 'tenses') return { main: 'grammar', wtSubtab: '' };
    if(normalized === 'wt-practice') return { main: 'wt', wtSubtab: 'practice' };
    if(normalized === 'wt-text') return { main: 'wt', wtSubtab: 'text' };
    if(normalized === 'wt-builder') return { main: 'wt', wtSubtab: 'builder' };
    return { main: normalized, wtSubtab: '' };
  }

  function routeToHash(route){
    const parsed = parseRoute(route);
    if(!parsed) return '';
    if(parsed.main === 'menu') return 'menu';
    if(parsed.main !== 'wt') return parsed.main;
    if(parsed.wtSubtab === 'builder') return 'wt-builder';
    if(parsed.wtSubtab === 'text') return 'wt-text';
    return 'wt-practice';
  }

  function setHashRoute(route, replace){
    const nextHashValue = routeToHash(route);
    if(!nextHashValue) return;

    const nextHash = '#' + nextHashValue;
    if(window.location.hash === nextHash) return;

    if(replace){
      const nextUrl = window.location.pathname + window.location.search + nextHash;
      window.history.replaceState(window.history.state, '', nextUrl);
      return;
    }

    ignoreNextHashChange = true;
    window.location.hash = nextHashValue;
  }

  function showLobby(opts){
    const options = opts || {};

    setVisible(lobby, true);
    setVisible(app, false);

    const last = localStorage.getItem(KEY_LAST);
    if (btnContinue){
      btnContinue.hidden = !last;
      if (last === 'dict') btnContinue.textContent = 'продолжить: dictionary';
      if (last === 'grammar' || last === 'struct' || last === 'tenses') btnContinue.textContent = 'продолжить: grammar';
      if (last === 'wt') btnContinue.textContent = 'продолжить: word transformation';
    }

    (btnContinue && !btnContinue.hidden ? btnContinue : btnDict).focus?.();
    window.scrollTo(0, 0);

    if(options.syncHash !== false){
      setHashRoute('menu', !!options.replaceHash);
    }

    try{
      document.dispatchEvent(new CustomEvent('sh:route', { detail: { route: 'menu', main: 'menu' } }));
    }catch(_){ }
  }

  function openModule(mod, opts){
    const options = opts || {};
    const parsed = parseRoute(mod) || { main: 'dict', wtSubtab: '' };

    const module =
      (parsed.main === 'grammar') ? 'grammar' :
      (parsed.main === 'wt') ? 'wt' :
      (parsed.main === 'struct' || parsed.main === 'tenses') ? 'grammar' :
      'dict';

    let wtSubtab = parsed.wtSubtab;
    if(module === 'wt' && !wtSubtab && window.StudentHelperTabs && typeof window.StudentHelperTabs.getWTSubTab === 'function'){
      wtSubtab = window.StudentHelperTabs.getWTSubTab() || 'practice';
    }
    if(module === 'wt' && wtSubtab !== 'builder' && wtSubtab !== 'text') wtSubtab = 'practice';

    localStorage.setItem(KEY_LAST, module);

    setVisible(lobby, false);
    setVisible(app, true);

    if (window.StudentHelperTabs && typeof window.StudentHelperTabs.setMainTab === 'function'){
      window.StudentHelperTabs.setMainTab(module === 'grammar' ? 'tenses' : module);
    }
    if(module === 'wt' && window.StudentHelperTabs && typeof window.StudentHelperTabs.setWTSubTab === 'function'){
      window.StudentHelperTabs.setWTSubTab(wtSubtab);
    }

    window.scrollTo(0, 0);

    if(options.syncHash !== false){
      const routeValue = module === 'wt'
        ? (wtSubtab === 'builder' ? 'wt-builder' : (wtSubtab === 'text' ? 'wt-text' : 'wt-practice'))
        : (module === 'grammar' ? 'grammar' : module);
      setHashRoute(routeValue, !!options.replaceHash);
    }

    try{
      const route = module === 'wt'
        ? (wtSubtab === 'builder' ? 'wt-builder' : (wtSubtab === 'text' ? 'wt-text' : 'wt-practice'))
        : (module === 'grammar' ? 'grammar' : module);
      document.dispatchEvent(new CustomEvent('sh:route', { detail: { route, main: module, wtSubtab: wtSubtab || '' } }));
    }catch(_){ }
  }

  window.StudentHelperRoute = window.StudentHelperRoute || {};
  window.StudentHelperRoute.go = function(route){
    const parsed = parseRoute(route);
    if(!parsed || parsed.main === 'menu'){
      showLobby();
      return;
    }

    if(parsed.main === 'wt' && parsed.wtSubtab){
      openModule('wt-' + parsed.wtSubtab);
      return;
    }

    openModule(parsed.main);
  };
  window.StudentHelperRoute.get = function(){
    if(!lobby.hidden) return 'menu';

    let main = 'dict';
    if(window.StudentHelperTabs && typeof window.StudentHelperTabs.getMainTab === 'function'){
      main = window.StudentHelperTabs.getMainTab() || 'dict';
    }
    if(main === 'tenses' || main === 'struct') return 'grammar';
    if(main !== 'wt') return main;

    if(window.StudentHelperTabs && typeof window.StudentHelperTabs.getWTSubTab === 'function'){
      const wtSubtab = window.StudentHelperTabs.getWTSubTab();
      if(wtSubtab === 'builder') return 'wt-builder';
      if(wtSubtab === 'text') return 'wt-text';
      return 'wt-practice';
    }
    return 'wt-practice';
  };

  btnDict.addEventListener('click', ()=> openModule('dict'));
  btnGrammar.addEventListener('click', ()=> openModule('grammar'));
  btnWT.addEventListener('click', ()=> openModule('wt'));
  btnHome.addEventListener('click', showLobby);

  if (btnContinue){
    btnContinue.addEventListener('click', ()=>{
      const rawLast = localStorage.getItem(KEY_LAST);
      const last = (rawLast === 'tenses' || rawLast === 'struct') ? 'grammar' : rawLast;
      if (last) openModule(last);
      else showLobby();
    });
  }

  // Hash controls: #dict, #grammar, #wt, #menu
  function applyHash(){
    const raw = (location.hash || '').replace('#', '').trim();
    const parsed = parseRoute(raw);
    if(!parsed) return false;

    if(parsed.main === 'menu'){
      showLobby({ syncHash: false });
      return true;
    }

    if(parsed.main === 'wt' && parsed.wtSubtab){
      openModule('wt-' + parsed.wtSubtab, { syncHash: false });
      return true;
    }

    openModule(parsed.main, { syncHash: false });
    return true;
  }

  window.addEventListener('hashchange', function(){
    if(ignoreNextHashChange){
      ignoreNextHashChange = false;
      return;
    }
    applyHash();
  });

  const hashApplied = applyHash();
  const seen = localStorage.getItem(KEY_SEEN);
  const rawLast = localStorage.getItem(KEY_LAST);
  const last = (rawLast === 'tenses' || rawLast === 'struct') ? 'grammar' : rawLast;

  if (!hashApplied){
    if (!seen){
      localStorage.setItem(KEY_SEEN, '1');
      showLobby({ replaceHash: true });
    } else if (last){
      openModule(last, { replaceHash: true });
    } else {
      showLobby({ replaceHash: true });
    }
  }

  // Esc returns to menu
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape' && lobby.hidden){
      showLobby();
    }
  });
})();
