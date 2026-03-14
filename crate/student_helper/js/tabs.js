// -----------------------------
// Tabs (main + WT subtabs)
// -----------------------------
(function(){
  const tabDict   = document.getElementById('tab-dict');
  const tabStruct = document.getElementById('tab-struct');
  const tabTenses = document.getElementById('tab-tenses');
  const tabWT     = document.getElementById('tab-wt');

  const panelDict   = document.getElementById('panel-dict');
  const panelStruct = document.getElementById('panel-struct');
  const panelTenses = document.getElementById('panel-tenses');
  const panelWT     = document.getElementById('panel-wt');

  function setMainTab(which){
    const w =
      (which === 'struct') ? 'struct' :
      (which === 'tenses') ? 'tenses' :
      (which === 'wt') ? 'wt' :
      'dict';

    if (tabDict)   tabDict.setAttribute('aria-selected', String(w === 'dict'));
    if (tabStruct) tabStruct.setAttribute('aria-selected', String(w === 'struct'));
    if (tabTenses) tabTenses.setAttribute('aria-selected', String(w === 'tenses'));
    if (tabWT)     tabWT.setAttribute('aria-selected', String(w === 'wt'));

    if (panelDict)   panelDict.hidden   = (w !== 'dict');
    if (panelStruct) panelStruct.hidden = (w !== 'struct');
    if (panelTenses) panelTenses.hidden = (w !== 'tenses');
    if (panelWT)     panelWT.hidden     = (w !== 'wt');

    try{
      document.dispatchEvent(new CustomEvent('sh:route', { detail: { route: w, main: w } }));
    }catch(_){ }
  }

  function getMainTab(){
    if (panelStruct && !panelStruct.hidden) return 'struct';
    if (panelTenses && !panelTenses.hidden) return 'tenses';
    if (panelWT && !panelWT.hidden) return 'wt';
    return 'dict';
  }

  window.StudentHelperTabs = window.StudentHelperTabs || {};
  window.StudentHelperTabs.setMainTab = setMainTab;
  window.StudentHelperTabs.getMainTab = getMainTab;

  function goRouteOrFallback(route, fallback){
    if(window.StudentHelperRoute && typeof window.StudentHelperRoute.go === 'function'){
      window.StudentHelperRoute.go(route);
      return;
    }
    fallback();
  }

  if (tabDict) tabDict.addEventListener('click', ()=> goRouteOrFallback('dict', ()=> setMainTab('dict')));
  if (tabStruct) tabStruct.addEventListener('click', ()=> goRouteOrFallback('struct', ()=> setMainTab('struct')));
  if (tabTenses) tabTenses.addEventListener('click', ()=> goRouteOrFallback('tenses', ()=> setMainTab('tenses')));
  if (tabWT) tabWT.addEventListener('click', ()=> goRouteOrFallback('wt', ()=> setMainTab('wt')));

  // Init from markup
  let init = 'dict';
  if (tabStruct && tabStruct.getAttribute('aria-selected') === 'true') init = 'struct';
  if (tabTenses && tabTenses.getAttribute('aria-selected') === 'true') init = 'tenses';
  if (tabWT && tabWT.getAttribute('aria-selected') === 'true') init = 'wt';
  setMainTab(init);
})();

// WT subtabs (practice/builder)
(function(){
  const a = document.getElementById('subtab-practice');
  const t = document.getElementById('subtab-text');
  const b = document.getElementById('subtab-builder');
  const pa = document.getElementById('panel-practice');
  const pt = document.getElementById('panel-text');
  const pb = document.getElementById('panel-builder');

  if (!a || !t || !b || !pa || !pt || !pb) return;

  function set(which){
    const w = (which === 'builder') ? 'builder' : (which === 'text' ? 'text' : 'practice');
    const isPractice = w === 'practice';
    const isText = w === 'text';
    const isBuilder = w === 'builder';

    a.setAttribute('aria-selected', String(isPractice));
    t.setAttribute('aria-selected', String(isText));
    b.setAttribute('aria-selected', String(isBuilder));

    pa.hidden = !isPractice;
    pt.hidden = !isText;
    pb.hidden = !isBuilder;

    try{
      const route = isBuilder ? 'wt-builder' : (isText ? 'wt-text' : 'wt-practice');
      document.dispatchEvent(new CustomEvent('sh:route', { detail: { route, main: 'wt', wtSubtab: w } }));
    }catch(_){ }
  }

  window.StudentHelperTabs = window.StudentHelperTabs || {};
  window.StudentHelperTabs.setWTSubTab = set;
  window.StudentHelperTabs.getWTSubTab = ()=> {
    if(!pt.hidden) return 'text';
    return pa.hidden ? 'builder' : 'practice';
  };

  function goRouteOrFallback(route, fallback){
    if(window.StudentHelperRoute && typeof window.StudentHelperRoute.go === 'function'){
      window.StudentHelperRoute.go(route);
      return;
    }
    fallback();
  }

  a.addEventListener('click', ()=> goRouteOrFallback('wt-practice', ()=> set('practice')));
  t.addEventListener('click', ()=> goRouteOrFallback('wt-text', ()=> set('text')));
  b.addEventListener('click', ()=> goRouteOrFallback('wt-builder', ()=> set('builder')));

  const initSubtab = (b.getAttribute('aria-selected') === 'true')
    ? 'builder'
    : (t.getAttribute('aria-selected') === 'true' ? 'text' : 'practice');
  set(initSubtab);
})();
