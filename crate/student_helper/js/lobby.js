(function(){
  const lobby = document.getElementById('shLobby');
  const app = document.getElementById('shApp');

  const btnHome = document.getElementById('shHomeBtn');
  const btnDict = document.getElementById('shGoDict');
  const btnStruct = document.getElementById('shGoStruct');
  const btnTenses = document.getElementById('shGoTenses');
  const btnWT = document.getElementById('shGoWT');
  const btnContinue = document.getElementById('shContinue');

  const KEY_LAST = 'sh_last_module';
  const KEY_SEEN = 'sh_seen_lobby';

  if (!lobby || !app || !btnDict || !btnWT || !btnHome) return;

  function setVisible(el, visible){
    el.hidden = !visible;
  }

  function showLobby(){
    setVisible(lobby, true);
    setVisible(app, false);

    const last = localStorage.getItem(KEY_LAST);
    if (btnContinue){
      btnContinue.hidden = !last;
      if (last === 'dict') btnContinue.textContent = 'продолжить: dictionary';
      if (last === 'struct') btnContinue.textContent = 'продолжить: structure';
      if (last === 'tenses') btnContinue.textContent = 'продолжить: tenses';
      if (last === 'wt') btnContinue.textContent = 'продолжить: word transformation';
    }

    (btnContinue && !btnContinue.hidden ? btnContinue : btnDict).focus?.();
    window.scrollTo(0, 0);
  }

  function openModule(mod){
    const module =
      (mod === 'wt') ? 'wt' :
      (mod === 'struct') ? 'struct' :
      (mod === 'tenses') ? 'tenses' :
      'dict';

    localStorage.setItem(KEY_LAST, module);

    setVisible(lobby, false);
    setVisible(app, true);

    if (window.StudentHelperTabs && typeof window.StudentHelperTabs.setMainTab === 'function'){
      window.StudentHelperTabs.setMainTab(module);
    }

    window.scrollTo(0, 0);
  }

  btnDict.addEventListener('click', ()=> openModule('dict'));
  if (btnStruct) btnStruct.addEventListener('click', ()=> openModule('struct'));
  if (btnTenses) btnTenses.addEventListener('click', ()=> openModule('tenses'));
  btnWT.addEventListener('click', ()=> openModule('wt'));
  btnHome.addEventListener('click', showLobby);

  if (btnContinue){
    btnContinue.addEventListener('click', ()=>{
      const last = localStorage.getItem(KEY_LAST);
      if (last) openModule(last);
      else showLobby();
    });
  }

  // Hash controls: #dict, #struct, #tenses, #wt, #menu
  function applyHash(){
    const h = (location.hash || '').replace('#', '').trim();
    if (h === 'dict') return openModule('dict');
    if (h === 'struct') return openModule('struct');
    if (h === 'tenses') return openModule('tenses');
    if (h === 'wt') return openModule('wt');
    if (h === 'menu') return showLobby();
  }
  window.addEventListener('hashchange', applyHash);

  applyHash();
  const seen = localStorage.getItem(KEY_SEEN);
  const last = localStorage.getItem(KEY_LAST);

  if (!seen){
    localStorage.setItem(KEY_SEEN, '1');
    showLobby();
  } else if (last){
    openModule(last);
  } else {
    showLobby();
  }

  // Esc returns to menu
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape' && lobby.hidden){
      showLobby();
    }
  });
})();