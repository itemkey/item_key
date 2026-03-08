(async function(){
  const TENSES_DIR = 'db/tenses/';

  function escapeHtml(s){
    return String(s || '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  async function fetchJson(path){
    const res = await fetch(path, { cache: 'no-cache' });
    if(!res.ok){
      throw new Error(`Fetch failed (${res.status}) for ${path}`);
    }
    return await res.json();
  }

  async function loadTensesDb(){
    const index = await fetchJson(TENSES_DIR + 'index.json');
    if(!Array.isArray(index)) throw new Error('tenses index.json must be an array');

    const byId = {};
    // load all theory tenses
    for(const meta of index){
      const file = meta && meta.file ? meta.file : `${meta.id}.json`;
      const obj = await fetchJson(TENSES_DIR + file);
      if(obj && obj.id) byId[obj.id] = obj;
    }

    // load mixed (practice only)
    try{
      const mixed = await fetchJson(TENSES_DIR + 'mixed.json');
      if(mixed && mixed.id) byId[mixed.id] = mixed;
    } catch(_){}

    // load mixed present (practice only)
    try{
      const mixedP = await fetchJson(TENSES_DIR + 'mixedPresent.json');
      if(mixedP && mixedP.id) byId[mixedP.id] = mixedP;
    } catch(_){}

    return { INDEX: index, byId };
  }

  let REG = null;
  try{
    REG = await loadTensesDb();
    window.StudentHelperTenses = REG;
  }catch(e){
    const statusEl = document.getElementById('tensesStatus');
    if(statusEl) statusEl.textContent = 'db error';
    // also print to console for debug
    console.error('[tenses] db load error:', e);
    return;
  }

  main(REG);

  function main(REG){
  const countBadge = document.getElementById('tensesCountBadge');
  const statusEl = document.getElementById('tensesStatus');

  const homeView = document.getElementById('tensesHomeView');
  const listView = document.getElementById('tensesListView');
  const detailView = document.getElementById('tensesDetailView');
  const practiceView = document.getElementById('tensesPracticeView');

  const compareView = document.getElementById('tensesCompareView');
  const dailyView = document.getElementById('tensesDailyView');

  const btnGoCompare = document.getElementById('tensesGoCompare');
  const btnGoDaily = document.getElementById('tensesGoDaily');
  const btnGoMixedPresent = document.getElementById('tensesGoMixedPresent');

  const btnBackHomeFromCompare = document.getElementById('tensesBackToHomeFromCompare');
  const btnBackHomeFromDaily = document.getElementById('tensesBackToHomeFromDaily');

  const cmpASelect = document.getElementById('tensesCompareA');
  const cmpBSelect = document.getElementById('tensesCompareB');
  const btnCompare = document.getElementById('tensesCompareBtn');
  const cmpRule = document.getElementById('tensesCompareRule');
  const cmpTable = document.getElementById('tensesCompareTable');
  const btnCmpMini10 = document.getElementById('tensesCompareStartMiniBtn');
  const btnCmpMini5 = document.getElementById('tensesCompareStartMini5Btn');
  const cmpRunBody = document.getElementById('tensesCompareRunBody');

  const btnDailyStart = document.getElementById('tensesDailyStartBtn');
  const btnDailyNew = document.getElementById('tensesDailyNewBtn');
  const dailyRunBody = document.getElementById('tensesDailyRunBody');

  const btnClearMistakes = document.getElementById('tensesClearMistakesBtn');
  const btnResetProgress = document.getElementById('tensesResetProgressBtn');

  const btnGoTheory = document.getElementById('tensesGoTheory');
  const btnGoPractice = document.getElementById('tensesGoPractice');

  const btnBackHomeFromList = document.getElementById('tensesBackToHomeFromList');
  const listEl = document.getElementById('tensesList');

  const btnBackToList = document.getElementById('tensesBackToList');
  const btnGoPracticeFromDetail = document.getElementById('tensesGoPracticeFromDetail');
  const btnGoPracticeBottom = document.getElementById('tensesGoPracticeBottom');

  const tenseTitleEl = document.getElementById('tenseTitle');
  const tenseSubtitleEl = document.getElementById('tenseSubtitle');
  const tenseMasteryBadge = document.getElementById('tenseMasteryBadge');
  const ruleBody = document.getElementById('tenseRuleBody');

  const btnBackHomeFromPractice = document.getElementById('tensesBackToHomeFromPractice');
  const goalSelect = document.getElementById('tensesGoalSelect');
  const tenseSelect = document.getElementById('tensesTenseSelect');
  const btnStart = document.getElementById('tensesStartBtn');
  const btnRetry = document.getElementById('tensesRetryMistakesBtn');
  const cbShowAfter = document.getElementById('tensesShowAfterEach');
  const practiceBody = document.getElementById('tensesPracticeBody');
  const practiceMeta = document.getElementById('tensesPracticeMeta');
  const customPicker = document.getElementById('tensesCustomPicker');
  const customGrid = document.getElementById('tensesCustomGrid');
  const customHint = document.getElementById('tensesCustomHint');
  const btnCustomSelectAll = document.getElementById('tensesCustomSelectAllBtn');
  const btnCustomClearAll = document.getElementById('tensesCustomClearAllBtn');

  if (!homeView || !listView || !detailView || !practiceView) return;
  if (!btnGoTheory || !btnGoPractice || !listEl) return;

  let currentId = null;
  let runKeyHandler = null;

  const KEY_UI = 'sh_tenses_ui_v1';
  const CUSTOM_TENSE_ID = 'custom';

  const GOALS = [
    { id:'all', title:'общее (all goals)' },
    { id:'meaning', title:'когда используем (meaning)' },
    { id:'formula', title:'формула (formula)' },
    { id:'markers', title:'маркеры (markers)' },
    { id:'mistakes', title:'ошибки (mistakes)' },
    { id:'compare', title:'сравнение (compare)' },
  ];

  // -------------------------
  // Storage (localStorage)
  // -------------------------
  function keyProgress(id){ return `sh_tenses_progress_${id}`; }

  function loadProgress(id){
    try{
      const raw = localStorage.getItem(keyProgress(id));
      if (!raw) return { mastery: 0, best: {}, mistakes: [] };
      const obj = JSON.parse(raw);
      return Object.assign({ mastery: 0, best: {}, mistakes: [] }, obj || {});
    } catch {
      return { mastery: 0, best: {}, mistakes: [] };
    }
  }

  function saveProgress(id, p){
    localStorage.setItem(keyProgress(id), JSON.stringify(p));
  }

  function masteryLabel(m){
    if (m >= 4) return 'Mastered';
    if (m >= 2) return 'Learning';
    return 'New';
  }

  function setStatus(text){
    if (!statusEl) return;
    statusEl.textContent = text;
    if (text !== 'ready'){
      setTimeout(()=>{ if (statusEl.textContent === text) statusEl.textContent = 'ready'; }, 650);
    }
  }

  function setVisible(el, visible){
    if (!el) return;
    el.hidden = !visible;
  }

  function showOnly(viewName){
    setVisible(homeView, viewName === 'home');
    setVisible(listView, viewName === 'list');
    setVisible(detailView, viewName === 'detail');
    setVisible(practiceView, viewName === 'practice');
    setVisible(compareView, viewName === 'compare');
    setVisible(dailyView, viewName === 'daily');
    window.scrollTo(0, 0);
  }

  function saveUIState(patch){
    try{
      const prev = JSON.parse(localStorage.getItem(KEY_UI) || '{}') || {};
      const next = Object.assign({}, prev, patch || {});
      localStorage.setItem(KEY_UI, JSON.stringify(next));
    }catch(_){}
  }

  function loadUIState(){
    try{ return JSON.parse(localStorage.getItem(KEY_UI) || '{}') || {}; }
    catch{ return {}; }
  }

  // -------------------------
  // Rule renderer (same format as Structure)
  // -------------------------
  function renderRuleBlocks(container, blocks){
    container.innerHTML = '';
    for (const b of (blocks || [])){
      if (b.type === 'heading'){
        const h = document.createElement('h3');
        h.className = 'sh-rule-h';
        h.textContent = b.text || '';
        container.appendChild(h);
      } else if (b.type === 'text'){
        const p = document.createElement('p');
        p.className = 'sh-rule-p';
        p.textContent = b.text || '';
        container.appendChild(p);
      } else if (b.type === 'table'){
        const wrap = document.createElement('div');
        wrap.className = 'sh-table-wrap';

        if (b.caption){
          const cap = document.createElement('p');
          cap.className = 'sh-table-cap';
          cap.textContent = b.caption;
          wrap.appendChild(cap);
        }

        const table = document.createElement('table');
        table.className = 'sh-table';

        const thead = document.createElement('thead');
        const trh = document.createElement('tr');
        for (const c of (b.columns || [])){
          const th = document.createElement('th');
          th.textContent = c;
          trh.appendChild(th);
        }
        thead.appendChild(trh);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        for (const row of (b.rows || [])){
          const tr = document.createElement('tr');
          for (const cell of row){
            const td = document.createElement('td');
            td.textContent = cell;
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
        }
        table.appendChild(tbody);

        wrap.appendChild(table);
        container.appendChild(wrap);
      } else if (b.type === 'examples'){
        const box = document.createElement('div');
        box.className = 'sh-examples';

        const ul = document.createElement('ul');
        ul.className = 'sh-ex-list';

        for (const ex of (b.items || [])){
          const li = document.createElement('li');
          li.innerHTML = `<div class="sh-ex-en">${escapeHtml(ex.en || '')}</div>
                          <div class="sh-ex-ru">${escapeHtml(ex.ru || '')}</div>`;
          ul.appendChild(li);
        }
        box.appendChild(ul);
        container.appendChild(box);
      } else if (b.type === 'highlight'){
        const box = document.createElement('div');
        box.className = 'sh-highlight';

        const t = document.createElement('p');
        t.className = 'sh-highlight-title';
        t.textContent = b.title || 'note';
        box.appendChild(t);

        const ul = document.createElement('ul');
        ul.className = 'sh-highlight-list';
        for (const line of (b.lines || [])){
          const li = document.createElement('li');
          li.textContent = line;
          ul.appendChild(li);
        }
        box.appendChild(ul);
        container.appendChild(box);
      }
    }
  }

  // -------------------------
  // List
  // -------------------------
  function renderList(){
    if (countBadge) countBadge.textContent = `tenses: ${REG.INDEX.length}`;

    listEl.innerHTML = '';
    for (const meta of REG.INDEX){
      const prog = loadProgress(meta.id);

      const li = document.createElement('li');

      const left = document.createElement('div');
      left.innerHTML = `<p class="ik-itemline"><b>${escapeHtml(meta.title)}</b></p>
                        <p class="ik-itemline ik-muted">${escapeHtml(meta.hint || meta.subtitle || '')}</p>`;

      const right = document.createElement('div');
      right.className = 'ik-mini';

      const badge = document.createElement('span');
      badge.className = 'ik-badge';
      badge.textContent = `${masteryLabel(prog.mastery)} - ${prog.mastery}/5`;

      const btn = document.createElement('button');
      btn.className = 'ik-btn ik-btn--black';
      btn.type = 'button';
      btn.textContent = 'open';
      btn.addEventListener('click', ()=> openTense(meta.id));

      right.appendChild(badge);
      right.appendChild(btn);

      li.appendChild(left);
      li.appendChild(right);
      listEl.appendChild(li);
    }
  }

  // -------------------------
  // Detail
  // -------------------------
  function openTense(id){
    const t = REG.byId[id];
    if (!t) return;

    currentId = id;

    tenseTitleEl.textContent = t.title || id;
    tenseSubtitleEl.textContent = t.subtitle || '';
    renderRuleBlocks(ruleBody, t.ruleBlocks || []);

    updateMasteryUI(id);
    showOnly('detail');
    setStatus('open');
  }

  function updateMasteryUI(id){
    const p = loadProgress(id);
    if (tenseMasteryBadge){
      tenseMasteryBadge.textContent = `mastery ${p.mastery || 0}/5`;
      tenseMasteryBadge.title = masteryLabel(p.mastery || 0);
    }
  }

  // -------------------------
  // Practice config
  // -------------------------
  function fillGoalOptions(){
    goalSelect.innerHTML = '';
    for (const g of GOALS){
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.title;
      goalSelect.appendChild(opt);
    }
  }

  function fillTenseOptions(){
    tenseSelect.innerHTML = '';

    const metas = Array.isArray(REG.INDEX) ? REG.INDEX : [];

    const optMixedAll = document.createElement('option');
    optMixedAll.value = 'mixedAll';
    optMixedAll.textContent = 'Mixed All (12 tenses)';
    tenseSelect.appendChild(optMixedAll);

    const optCustom = document.createElement('option');
    optCustom.value = CUSTOM_TENSE_ID;
    optCustom.textContent = 'Пользовательское (Custom)';
    tenseSelect.appendChild(optCustom);

    for (let i = 0; i < metas.length; i++){
      const meta = metas[i];
      const opt = document.createElement('option');
      opt.value = meta.id;
      opt.textContent = meta.title;
      tenseSelect.appendChild(opt);
    }

    // Special
    const optMixed = document.createElement('option');
    optMixed.value = 'mixed';
    optMixed.textContent = 'Mixed (Past Simple + Past Continuous)';
    tenseSelect.appendChild(optMixed);

    const optMixedP = document.createElement('option');
    optMixedP.value = 'mixedPresent';
    optMixedP.textContent = 'Mixed Present (Present Simple + Present Continuous)';
    tenseSelect.appendChild(optMixedP);

    const optMixedPP = document.createElement('option');
    optMixedPP.value = 'mixedPerfectPast';
    optMixedPP.textContent = 'Mixed Perfect - Past (Present Perfect + Past Simple)';
    tenseSelect.appendChild(optMixedPP);

  }

  function getCoreTenseIds(){
    return (REG.INDEX || []).map(x=>x.id).filter(Boolean);
  }

  function getSavedCustomIds(){
    const ids = getCoreTenseIds();
    if (!ids.length) return [];
    const ui = loadUIState();
    const saved = Array.isArray(ui.customTenses) ? ui.customTenses : [];
    const valid = saved.filter(id => ids.includes(id));
    if (valid.length) return valid;
    return [...ids];
  }

  function getCustomSelectedIds(){
    if (!customGrid) return getSavedCustomIds();
    const ids = [];
    customGrid.querySelectorAll('input[type="checkbox"][data-tense-id]').forEach((el)=>{
      if (el.checked) ids.push(el.getAttribute('data-tense-id'));
    });
    return ids;
  }

  function setCustomPickerVisible(visible){
    if (!customPicker) return;
    customPicker.hidden = !visible;
  }

  function saveCustomSelection(ids){
    saveUIState({ customTenses: ids });
    updateCustomHint(ids.length);
    if (tenseSelect?.value === CUSTOM_TENSE_ID) renderPracticeInfo();
  }

  function setAllCustomSelection(checked){
    if (!customGrid) return;
    customGrid.querySelectorAll('input[type="checkbox"][data-tense-id]').forEach((el)=>{
      el.checked = !!checked;
    });
    saveCustomSelection(getCustomSelectedIds());
  }

  function renderCustomPicker(){
    if (!customGrid) return;
    const selected = new Set(getSavedCustomIds());
    customGrid.innerHTML = '';

    for (const meta of (REG.INDEX || [])){
      const label = document.createElement('label');
      label.className = 'sh-custom-tense';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'sh-custom-tense__cb';
      cb.setAttribute('data-tense-id', meta.id);
      cb.checked = selected.has(meta.id);

      const textWrap = document.createElement('span');
      textWrap.className = 'sh-custom-tense__text';

      const t = document.createElement('span');
      t.className = 'sh-custom-tense__title';
      t.textContent = meta.title || meta.id;

      const s = document.createElement('span');
      s.className = 'sh-custom-tense__sub';
      s.textContent = meta.subtitle || '';

      textWrap.appendChild(t);
      textWrap.appendChild(s);
      label.appendChild(cb);
      label.appendChild(textWrap);
      customGrid.appendChild(label);

      cb.addEventListener('change', ()=>{
        saveCustomSelection(getCustomSelectedIds());
      });
    }

    updateCustomHint(selected.size);
  }

  function updateCustomHint(selectedCount){
    if (!customHint) return;
    if (!selectedCount){
      customHint.textContent = 'выбери минимум одно время, чтобы начать';
      return;
    }
    customHint.textContent = `выбрано: ${selectedCount} из ${(REG.INDEX || []).length}`;
  }

  function buildMixedAllTense(){
    const grouped = new Map();
    for (const meta of (REG.INDEX || [])){
      const t = REG.byId[meta.id];
      if (!t || !t.practice || !Array.isArray(t.practice.exercises)) continue;
      for (const ex of t.practice.exercises){
        const key = ex.id || 'all';
        if (!grouped.has(key)){
          grouped.set(key, {
            id: key,
            title: `${ex.title || key} - Mixed All`,
            kind: ex.kind || 'choice',
            items: []
          });
        }
        const target = grouped.get(key);
        if ((target.kind || 'choice') !== (ex.kind || 'choice')) continue;
        for (const item of (ex.items || [])){
          const cloned = Object.assign({}, item);
          cloned.id = `mixedAll_${meta.id}_${item.id || Math.random().toString(36).slice(2)}`;
          cloned.sourceTenseId = item.sourceTenseId || item.correctTenseId || meta.id;
          target.items.push(cloned);
        }
      }
    }
    return {
      id: 'mixedAll',
      title: 'Mixed All (12 tenses)',
      subtitle: 'all core tenses together',
      practice: {
        exercises: Array.from(grouped.values())
      }
    };
  }

  function buildCustomTense(selectedIds){
    const picked = Array.isArray(selectedIds) ? selectedIds : [];
    const grouped = new Map();
    const selectedSet = new Set(picked);

    for (const meta of (REG.INDEX || [])){
      if (!selectedSet.has(meta.id)) continue;
      const t = REG.byId[meta.id];
      if (!t || !t.practice || !Array.isArray(t.practice.exercises)) continue;
      for (const ex of t.practice.exercises){
        const key = ex.id || 'all';
        if (!grouped.has(key)){
          grouped.set(key, {
            id: key,
            title: `${ex.title || key} - Custom`,
            kind: ex.kind || 'choice',
            items: []
          });
        }
        const target = grouped.get(key);
        if ((target.kind || 'choice') !== (ex.kind || 'choice')) continue;
        for (const item of (ex.items || [])){
          const cloned = Object.assign({}, item);
          cloned.id = `custom_${meta.id}_${item.id || Math.random().toString(36).slice(2)}`;
          cloned.sourceTenseId = item.sourceTenseId || item.correctTenseId || meta.id;
          target.items.push(cloned);
        }
      }
    }

    return {
      id: CUSTOM_TENSE_ID,
      title: `Пользовательское (${picked.length} т.)`,
      subtitle: 'набор по выбранным временам',
      practice: {
        exercises: Array.from(grouped.values())
      }
    };
  }

  function getTenseForPractice(id){
    if (id === 'mixedAll') return buildMixedAllTense();
    if (id === CUSTOM_TENSE_ID) return buildCustomTense(getCustomSelectedIds());
    const t = REG.byId[id];
    if (t) return t;
    // fallback
    return REG.byId[REG.INDEX?.[0]?.id];
  }

  function getSelectedGoalId(){
    const v = (goalSelect && goalSelect.value) ? goalSelect.value : 'all';
    return GOALS.some(x=>x.id === v) ? v : 'all';
  }

  function gatherExerciseIds(tenseObj, goalId){
    const list = (tenseObj.practice && tenseObj.practice.exercises) || [];
    if (goalId === 'all') return list.map(x=>x.id);
    return list.filter(x=>x.id === goalId || x.goal === goalId).map(x=>x.id);
  }

  function exerciseById(tenseObj, exId){
    const list = (tenseObj.practice && tenseObj.practice.exercises) || [];
    return list.find(x=>x.id === exId);
  }

  function totalQuestions(tenseObj, exIds){
    let n = 0;
    for (const id of exIds){
      const ex = exerciseById(tenseObj, id);
      n += (ex && ex.items) ? ex.items.length : 0;
    }
    return n;
  }

  function renderPracticeInfo(){
    const tenseId = tenseSelect.value || (REG.INDEX[0] && REG.INDEX[0].id);
    const tenseObj = getTenseForPractice(tenseId);
    const goalId = getSelectedGoalId();
    const exIds = gatherExerciseIds(tenseObj, goalId);
    const total = totalQuestions(tenseObj, exIds);

    const prog = loadProgress(tenseObj.id);
    const mistakesCount = (prog.mistakes || []).length;

    if (practiceMeta){
      practiceMeta.textContent = `tasks: ${total} - mistakes: ${mistakesCount}`;
      practiceMeta.title = `${tenseObj.title || tenseObj.id}`;
    }

    if (btnRetry){
      btnRetry.disabled = mistakesCount === 0;
      btnRetry.title = mistakesCount ? '' : 'Нет ошибок';
    }

    if (btnStart){
      btnStart.disabled = total === 0;
      btnStart.title = total ? '' : 'Нет заданий: выбери времена';
    }

    // Summary card
    const box = document.createElement('div');
    box.className = 'sh-highlight';

    const title = document.createElement('p');
    title.className = 'sh-highlight-title';
    title.textContent = `${tenseObj.title || tenseObj.id} - progress`;
    box.appendChild(title);

    const ul = document.createElement('ul');
    ul.className = 'sh-highlight-list';

    const exList = (tenseObj.practice && tenseObj.practice.exercises) || [];
    for (const ex of exList){
      const best = prog.best && prog.best[ex.id];
      const qCount = (ex.items || []).length;
      const bestText = best ? `${best.correct}/${best.total}` : `0/${qCount}`;
      const li = document.createElement('li');
      li.textContent = `${ex.title}: best ${bestText}`;
      ul.appendChild(li);
    }

    const liM = document.createElement('li');
    liM.textContent = `mastery: ${prog.mastery || 0}/5`;
    ul.appendChild(liM);

    box.appendChild(ul);

    practiceBody.innerHTML = '';
    practiceBody.appendChild(box);

    saveUIState({ goal: goalId, tense: tenseId });
  }

  // -------------------------
  // Practice run (choice/input/multi/match/multi_input)
  // -------------------------
  function startRun(tenseObj, exerciseIds, opts, mountEl){
    const practiceBody = mountEl || document.getElementById('tensesPracticeBody');
    const options = Object.assign({ showAfterEach: true, onlyMistakes: false }, opts || {});
    const exercises = (tenseObj.practice && tenseObj.practice.exercises) || [];
    const chosen = exercises.filter(ex => exerciseIds.includes(ex.id));

    const prog = loadProgress(tenseObj.id);
    const mistakesSet = new Set(prog.mistakes || []);

    function saveMistakesSnapshot(){
      try{
        const p = loadProgress(tenseObj.id);
        p.mistakes = Array.from(mistakesSet);
        saveProgress(tenseObj.id, p);
      } catch(_){}
    }

    // -------------------------
    // Randomization helpers
    // -------------------------
    function shuffleInPlace(a){
      for(let i=a.length-1;i>0;i--){
        const j = Math.floor(Math.random()*(i+1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    function prepareItemForRun(kind, item){
      // Shallow clone + copy arrays we mutate
      const it = Object.assign({}, item);
      if (Array.isArray(item.options)) it.options = [...item.options];
      if (Array.isArray(item.correctIndices)) it.correctIndices = [...item.correctIndices];
      if (Array.isArray(item.pairs)) it.pairs = item.pairs.map(p => ({ left: p.left, right: p.right }));

      // Shuffle options to avoid fixed patterns
      if ((kind === 'choice' || kind === 'multi') && Array.isArray(it.options) && it.options.length > 1){
        const idxs = it.options.map((_, i)=>i);
        shuffleInPlace(idxs);
        const oldToNew = new Map();
        idxs.forEach((oldIdx, newIdx)=> oldToNew.set(oldIdx, newIdx));

        it.options = idxs.map(i => it.options[i]);

        if (kind === 'choice'){
          const oldCorrect = Number(it.correctIndex);
          it.correctIndex = oldToNew.has(oldCorrect) ? oldToNew.get(oldCorrect) : oldCorrect;
        } else {
          const oldCorrects = (it.correctIndices || []).map(x=>Number(x));
          it.correctIndices = oldCorrects
            .map(oldIdx => oldToNew.has(oldIdx) ? oldToNew.get(oldIdx) : oldIdx)
            .sort((a,b)=>a-b);
        }
      }

      // Shuffle pair rows in matching tasks too
      if (kind === 'match' && Array.isArray(it.pairs) && it.pairs.length > 1){
        shuffleInPlace(it.pairs);
      }

      return it;
    }

    // Build task queue (then shuffle it so questions are not always in the same order)
    const queue = [];
    for (const ex of chosen){
      for (const item of (ex.items || [])){
        if (options.onlyMistakes && !mistakesSet.has(item.id)) continue;
        const prepared = prepareItemForRun(ex.kind, item);
        queue.push({ exId: ex.id, exTitle: ex.title, kind: ex.kind, item: prepared });
      }
    }

    // Shuffle the final queue (keeps the exercise label per question, but randomizes sequence)
    shuffleInPlace(queue);

    if (options.onlyMistakes && queue.length === 0){
      setStatus('нет ошибок');
      return;
    }

    // Clear any old key handler
    if (runKeyHandler){
      document.removeEventListener('keydown', runKeyHandler, true);
      runKeyHandler = null;
    }

    practiceBody.innerHTML = '';

    const runWrap = document.createElement('div');
    runWrap.className = 'sh-practice-run';

    runWrap.innerHTML = `
      <div class="ik-row">
        <span class="ik-badge" id="shTRunEx">exercise</span>
        <span class="ik-badge" id="shTRunQ">question</span>
        <span class="ik-spacer" aria-hidden="true"></span>
        <label class="ik-label" style="display:flex; align-items:center; gap:8px;">
          <input type="checkbox" id="shTRunShowAfter" ${options.showAfterEach ? 'checked' : ''} />
          show answers after each
        </label>
        <button class="ik-btn" id="shTRunExit" type="button">exit</button>
      </div>

      <div class="ik-divider"></div>

      <p class="ik-prompt" id="shTRunInstr">...</p>
      <div id="shTRunHint" class="sh-hint" hidden></div>
      <div class="sh-progress" id="shTRunProgress"><div></div></div>
      <div class="sh-run-card" id="shTRunCard"></div>

      <div class="ik-divider"></div>

      <div class="ik-feedback" id="shTRunFeedback" data-state="idle" aria-live="polite">
        <div class="ik-feedback__stamp" id="shTRunStamp">ready</div>
        <p class="ik-feedback__line" id="shTRunLine">выбери ответ или введи ответ и нажми check</p>
      </div>

      <div class="ik-row" style="margin-top:12px; gap:10px;">
        <button class="ik-btn ik-btn--black" id="shTRunCheckNext" type="button">check</button>
        <button class="ik-btn" id="shTRunExplainBtn" type="button" aria-disabled="true" title="перед объяснением дайте свой ответ">объяснение</button>
      </div>

      <div id="shTRunExplainBox" class="sh-hint" hidden></div>
    `;

    practiceBody.appendChild(runWrap);

    const elEx = runWrap.querySelector('#shTRunEx');
    const elQ  = runWrap.querySelector('#shTRunQ');
    const elInstr = runWrap.querySelector('#shTRunInstr');
    const elCard = runWrap.querySelector('#shTRunCard');

    const elFb = runWrap.querySelector('#shTRunFeedback');
    const elStamp = runWrap.querySelector('#shTRunStamp');
    const elLine = runWrap.querySelector('#shTRunLine');
    const btnExit = runWrap.querySelector('#shTRunExit');
    const btnCheckNext = runWrap.querySelector('#shTRunCheckNext');
    const btnExplain = runWrap.querySelector('#shTRunExplainBtn');
    const elExplain = runWrap.querySelector('#shTRunExplainBox');
    const cbShowAfterLocal = runWrap.querySelector('#shTRunShowAfter');

    if (elExplain){
      elExplain.style.display = 'block';
      elExplain.style.whiteSpace = 'pre-line';
    }

    let idx = 0;
    let checked = false;
    let lastCheck = null;

    // state per question
    let selectedIndex = null;
    let selectedSet = new Set(); // for multi
    let matchState = null; // { rights:[], selects:[] }
    let multiInputs = null; // [inputEl,...]

    // scoring per exercise
    const exTotals = {};
    const exCorrect = {};

    function setFeedback(state, stamp, line){
      elFb.setAttribute('data-state', state);
      elStamp.textContent = stamp;
      elLine.textContent = line;
    }

    function resetPerQuestionState(){
      selectedIndex = null;
      selectedSet = new Set();
      matchState = null;
      multiInputs = null;
      lastCheck = null;
    }

    function setExplainAvailability(isAnswered){
      if (!btnExplain) return;
      btnExplain.dataset.locked = isAnswered ? '0' : '1';
      btnExplain.setAttribute('aria-disabled', isAnswered ? 'false' : 'true');
      btnExplain.style.opacity = isAnswered ? '' : '0.55';
      btnExplain.title = isAnswered ? 'показать объяснение' : 'перед объяснением дайте свой ответ';
      btnExplain.textContent = 'объяснение';
    }

    const TENSE_TEXT_PATTERNS = [
      ['presentSimple', /\bpresent simple\b/i],
      ['presentContinuous', /\bpresent continuous\b/i],
      ['presentPerfectContinuous', /\bpresent perfect continuous\b/i],
      ['presentPerfect', /\bpresent perfect\b/i],
      ['pastSimple', /\bpast simple\b/i],
      ['pastContinuous', /\bpast continuous\b/i],
      ['pastPerfectContinuous', /\bpast perfect continuous\b/i],
      ['pastPerfect', /\bpast perfect\b/i],
      ['futureSimple', /\bfuture simple\b/i],
      ['futureContinuous', /\bfuture continuous\b/i],
      ['futurePerfectContinuous', /\bfuture perfect continuous\b/i],
      ['futurePerfect', /\bfuture perfect\b/i],
    ];

    function qText(v){
      const t = String(v || '').trim();
      return t ? `«${t}»` : '—';
    }

    function joinReadable(items){
      const arr = (items || []).map(x=>String(x || '').trim()).filter(Boolean);
      return arr.length ? arr.map(x=>`«${x}»`).join(', ') : '—';
    }

    function pushExplainLine(lines, text){
      const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
      if (!cleaned) return;
      const key = normalize(cleaned).replace(/[^a-zа-я0-9]+/gi, ' ').trim();
      for (const prev of lines){
        const prevKey = normalize(prev).replace(/[^a-zа-я0-9]+/gi, ' ').trim();
        if (prevKey === key) return;
      }
      lines.push(cleaned);
    }

    function getTenseMetaById(id){
      const key = String(id || '').trim();
      if (!key) return null;
      const meta = (REG.INDEX || []).find(x => x.id === key);
      if (meta) return { id: meta.id, title: meta.title || meta.id, hint: meta.hint || '', subtitle: meta.subtitle || '' };
      const obj = REG.byId && REG.byId[key];
      if (obj && obj.title){
        return { id: obj.id || key, title: obj.title || key, hint: obj.hint || '', subtitle: obj.subtitle || '' };
      }
      return null;
    }

    function detectTenseIdFromText(text){
      const src = String(text || '');
      if (!src) return '';
      for (const [id, re] of TENSE_TEXT_PATTERNS){
        if (re.test(src)) return id;
      }
      return '';
    }

    function collectAcceptedSamples(item){
      const out = [];
      if (Array.isArray(item?.accepted)) out.push(...item.accepted);
      if (Array.isArray(item?.inputs)){
        for (const spec of item.inputs){
          if (Array.isArray(spec?.accepted)) out.push(...spec.accepted);
        }
      }
      return out.map(x=>String(x || '').trim()).filter(Boolean);
    }

    function detectTenseIdFromAnswerForms(item){
      const src = normalize(collectAcceptedSamples(item).join(' | '));
      if (!src) return '';

      const ids = new Set();
      if (/\bwill have been\b/.test(src) && /\bing\b/.test(src)) ids.add('futurePerfectContinuous');
      if (/\bhad been\b/.test(src) && /\bing\b/.test(src)) ids.add('pastPerfectContinuous');
      if (/\b(?:have|has) been\b/.test(src) && /\bing\b/.test(src)) ids.add('presentPerfectContinuous');

      if (/\bwill have\b/.test(src) && /\b(?:done|gone|been|seen|had|made|taken|written|drunk|eaten|finished|worked|studied|arrived|left|bought|told|given|found|known|thought|read)\b/.test(src)) ids.add('futurePerfect');
      if (/\bhad\b/.test(src) && /\b(?:done|gone|been|seen|had|made|taken|written|drunk|eaten|finished|worked|studied|arrived|left|bought|told|given|found|known|thought|read)\b/.test(src)) ids.add('pastPerfect');
      if (/\b(?:have|has)\b/.test(src) && /\b(?:done|gone|been|seen|had|made|taken|written|drunk|eaten|finished|worked|studied|arrived|left|bought|told|given|found|known|thought|read)\b/.test(src)) ids.add('presentPerfect');

      if (/\bwill be\b/.test(src) && /\bing\b/.test(src)) ids.add('futureContinuous');
      if (/\b(?:was|were)\b/.test(src) && /\bing\b/.test(src)) ids.add('pastContinuous');
      if (/\b(?:am|is|are)\b/.test(src) && /\bing\b/.test(src)) ids.add('presentContinuous');

      if (/\bwill\b/.test(src) && !/\bwill (?:be|have)\b/.test(src)) ids.add('futureSimple');
      if (/\bdid\b/.test(src) || /\b(?:went|saw|came|got|took|made|wrote|ate|drank|spoke|thought|found|knew|said|left|arrived|started|stopped|rang|called)\b/.test(src)) ids.add('pastSimple');
      if ((/\b(?:do|does)\b/.test(src) || /\b(?:always|usually|often|sometimes|never|every)\b/.test(src)) && !ids.size) ids.add('presentSimple');

      if (ids.size === 1) return Array.from(ids)[0];
      return '';
    }

    function inferQuestionTenseMeta(q, check){
      if (!q) return getTenseMetaById(tenseObj.id);
      const item = q.item || {};

      const direct = [item.correctTenseId, item.sourceTenseId, item._sourceTenseId];
      for (const id of direct){
        const meta = getTenseMetaById(id);
        if (meta) return meta;
      }

      const rawId = String(item.id || '');
      const m = rawId.match(/^(?:mixedAll|custom|dy)_([^_]+)_/);
      if (m && m[1]){
        const meta = getTenseMetaById(m[1]);
        if (meta) return meta;
      }

      if (Array.isArray(item.candidateTenseIds) && Number.isInteger(item.correctIndex)){
        const guessed = item.candidateTenseIds[item.correctIndex];
        const meta = getTenseMetaById(guessed);
        if (meta) return meta;
      }

      if (Array.isArray(item.options) && Number.isInteger(item.correctIndex) && item.options[item.correctIndex]){
        const idFromOption = detectTenseIdFromText(item.options[item.correctIndex]);
        const meta = getTenseMetaById(idFromOption);
        if (meta) return meta;
      }

      if (check && check.correctText){
        const idFromCheck = detectTenseIdFromText(check.correctText);
        const meta = getTenseMetaById(idFromCheck);
        if (meta) return meta;
      }

      const idFromForms = detectTenseIdFromAnswerForms(item);
      const metaFromForms = getTenseMetaById(idFromForms);
      if (metaFromForms) return metaFromForms;

      const fallback = getTenseMetaById(tenseObj.id);
      if (fallback) return fallback;
      return null;
    }

    function detectPromptSignals(prompt){
      const t = String(prompt || '').toLowerCase();
      const out = [];
      const add = (re, text)=>{ if (re.test(t)) out.push(text); };

      add(/\b(now|right now|at the moment|currently)\b|\blook\b|\blisten\b/, 'есть маркер текущего момента');
      add(/\b(always|usually|often|sometimes|never|generally|normally)\b|\bevery\s+(day|week|month|year)\b|\bon\s+\w+s\b|\bat weekends?\b/, 'есть маркер регулярности/привычки');
      add(/\b(yesterday|last\s+\w+|\d+\s+ago|in\s+\d{4}|then)\b/, 'есть точка в прошлом');
      add(/\bwhile\b/, 'есть while (обычно фон/процесс)');
      add(/\b(already|just|yet|ever|so far|recently|lately)\b/, 'есть perfect-маркер');
      add(/\b(for|since|how long)\b/, 'есть маркер длительности');
      add(/\b(by the time|before)\b|\bby\s+(tomorrow|then|next|\d)/, 'есть дедлайн/граница во времени');
      add(/\b(tomorrow|next\s+\w+|soon|this time tomorrow)\b/, 'есть ориентир на будущее');

      const uniqOut = [];
      const seen = new Set();
      for (const v of out){
        const key = normalize(v);
        if (!seen.has(key)){
          seen.add(key);
          uniqOut.push(v);
        }
      }
      return uniqOut;
    }

    function nearestAccepted(raw, accepted){
      const user = normalize(raw);
      let best = null;
      for (const candidate of (accepted || [])){
        const c = String(candidate || '').trim();
        if (!c) continue;
        const d = levenshtein(user, normalize(c));
        if (!best || d < best.dist){
          best = { text: c, dist: d };
        }
      }
      return best;
    }

    function tokenDiff(raw, correct){
      const user = tokensNormalized(raw);
      const good = tokensNormalized(correct);

      const cntUser = Object.create(null);
      for (const x of user) cntUser[x] = (cntUser[x] || 0) + 1;

      const missing = [];
      for (const x of good){
        if (cntUser[x] > 0) cntUser[x] -= 1;
        else missing.push(x);
      }

      const extra = [];
      for (const x of user){
        if (cntUser[x] > 0){
          extra.push(x);
          cntUser[x] -= 1;
        }
      }

      return { missing: uniq(missing), extra: uniq(extra) };
    }

    function cleanLegacyExplain(raw){
      let t = String(raw || '').trim();
      if (!t) return '';
      t = t.replace(/\s+/g, ' ');
      t = t.replace(/^В этом предложении важно значение ситуации, а не только форма\.\s*/i, '');
      t = t.replace(/^В исходной фразе нарушена форма времени или порядок слов\.\s*/i, '');
      return t.trim();
    }

    const STATIVE_FORMS = {
      know: ['know', 'knows', 'knew', 'known'],
      understand: ['understand', 'understands', 'understood'],
      believe: ['believe', 'believes', 'believed'],
      remember: ['remember', 'remembers', 'remembered'],
      forget: ['forget', 'forgets', 'forgot', 'forgotten'],
      mean: ['mean', 'means', 'meant'],
      need: ['need', 'needs', 'needed'],
      want: ['want', 'wants', 'wanted'],
      like: ['like', 'likes', 'liked'],
      love: ['love', 'loves', 'loved'],
      hate: ['hate', 'hates', 'hated'],
      prefer: ['prefer', 'prefers', 'preferred'],
      own: ['own', 'owns', 'owned'],
      belong: ['belong', 'belongs', 'belonged'],
      consist: ['consist', 'consists', 'consisted'],
      contain: ['contain', 'contains', 'contained'],
      include: ['include', 'includes', 'included'],
      seem: ['seem', 'seems', 'seemed']
    };

    const STATIVE_ING_TO_BASE = {
      knowing: 'know',
      understanding: 'understand',
      believing: 'believe',
      remembering: 'remember',
      forgetting: 'forget',
      meaning: 'mean',
      needing: 'need',
      wanting: 'want',
      liking: 'like',
      loving: 'love',
      hating: 'hate',
      preferring: 'prefer',
      owning: 'own',
      belonging: 'belong',
      consisting: 'consist',
      containing: 'contain',
      including: 'include',
      seeming: 'seem'
    };

    function detectStativeContinuousIssue(prompt, correctText){
      const src = normalize(prompt || '');
      if (!src) return null;
      const ingWords = src.match(/\b[a-z]+ing\b/g) || [];
      if (!ingWords.length) return null;

      const corrected = normalize(correctText || '');
      for (const ing of ingWords){
        const base = STATIVE_ING_TO_BASE[ing] || '';
        if (!base || !STATIVE_FORMS[base]) continue;

        const hasContinuousAux = new RegExp(`\\b(?:am|is|are|was|were|be|been|being|have been|has been|had been|will be|will have been)\\s+${ing}\\b`).test(src);
        const hasBareIng = new RegExp(`\\b${ing}\\b`).test(src);
        if (!hasContinuousAux && !hasBareIng) continue;

        let chosenForm = '';
        if (corrected){
          for (const form of STATIVE_FORMS[base]){
            if (new RegExp(`\\b${form}\\b`).test(corrected)){
              chosenForm = form;
              break;
            }
          }
        }

        return { base, ing, chosenForm };
      }

      return null;
    }

    function buildSmartExplanation(q, check){
      const item = q?.item || {};
      const lines = [];
      const meta = inferQuestionTenseMeta(q, check);

      if (meta?.title){
        pushExplainLine(lines, `Время: ${meta.title}.`);
      }

      const signals = detectPromptSignals(item.prompt || '');
      if (signals.length){
        pushExplainLine(lines, `Сигналы в предложении: ${signals.slice(0, 3).join('; ')}.`);
      }

      if (check){
        if (check.kind === 'choice'){
          if (check.ok){
            pushExplainLine(lines, `Твой выбор ${qText(check.selectedText)} — верно.`);
          } else {
            pushExplainLine(lines, `Твой выбор ${qText(check.selectedText)}. Правильно: ${qText(check.correctText)}.`);
          }
        } else if (check.kind === 'input' || check.kind === 'correction'){
          if (check.state === 'correct'){
            pushExplainLine(lines, `Твой ответ ${qText(check.rawInput)} — верно.`);
          } else if (check.state === 'almost'){
            pushExplainLine(lines, `Твой ответ ${qText(check.rawInput)} — почти верно (мелкая опечатка).`);
            if (check.correctText) pushExplainLine(lines, `Эталонная форма: ${qText(check.correctText)}.`);
          } else {
            pushExplainLine(lines, `Твой ответ ${qText(check.rawInput)}. Правильно: ${qText(check.correctText || check.closestText)}.`);
            const diff = tokenDiff(check.rawInput || '', check.correctText || check.closestText || '');
            if (diff.missing.length) pushExplainLine(lines, `Добавь: ${joinReadable(diff.missing)}.`);
            if (diff.extra.length) pushExplainLine(lines, `Убери/проверь: ${joinReadable(diff.extra)}.`);
          }

          if (check.kind === 'correction' && check.correctText){
            pushExplainLine(lines, `Исправленный вариант целиком: ${qText(check.correctText)}.`);
          }

          const stativeIssue = detectStativeContinuousIssue(item.prompt || '', check.correctText || check.closestText || '');
          if (stativeIssue){
            pushExplainLine(lines, `Глагол «${stativeIssue.base}» — state verb (состояние), поэтому форма Continuous «${stativeIssue.ing}» здесь не используется.`);
            if (stativeIssue.chosenForm){
              pushExplainLine(lines, `Нужна форма без -ing: «${stativeIssue.chosenForm}» (по контексту предложения).`);
            } else {
              pushExplainLine(lines, 'Нужна форма без -ing в нужном времени (Simple/Perfect по контексту).');
            }
          }
        } else if (check.kind === 'multi'){
          if (check.ok){
            pushExplainLine(lines, `Верно: нужно выбрать ${joinReadable(check.correctLabels)}.`);
          } else {
            pushExplainLine(lines, `Твой набор: ${joinReadable(check.selectedLabels)}.`);
            if (check.missingLabels?.length) pushExplainLine(lines, `Нужно добавить: ${joinReadable(check.missingLabels)}.`);
            if (check.extraLabels?.length) pushExplainLine(lines, `Лишние варианты: ${joinReadable(check.extraLabels)}.`);
            pushExplainLine(lines, `Правильный набор: ${joinReadable(check.correctLabels)}.`);
          }
        } else if (check.kind === 'match'){
          if (check.ok){
            pushExplainLine(lines, 'Все пары собраны верно.');
          } else {
            const wrong = (check.mismatches || []).slice(0, 3).map(x=>`${x.left} -> ${x.user || '—'} (нужно: ${x.right})`);
            if (wrong.length) pushExplainLine(lines, `Неверные пары: ${wrong.join(' | ')}.`);
          }
        } else if (check.kind === 'multi_input'){
          if (check.ok){
            pushExplainLine(lines, `Верные формы: ${joinReadable(check.correctParts)}.`);
            if (check.anyAlmost) pushExplainLine(lines, 'Есть мелкие опечатки, но логика формы верная.');
          } else {
            const wrong = (check.slots || []).filter(s => s.state === 'wrong').slice(0, 3);
            const details = wrong.map(s=>`${s.index}) ${qText(s.raw)} -> ${qText(s.correct)}`);
            if (details.length) pushExplainLine(lines, `Исправь поля: ${details.join(' | ')}.`);
            if (check.correctParts?.length) pushExplainLine(lines, `Правильные формы: ${joinReadable(check.correctParts)}.`);
          }
        }
      }

      const quickMeta = (meta && typeof QUICK === 'object' && QUICK && QUICK[meta.id]) ? QUICK[meta.id] : null;
      if (quickMeta?.formula){
        pushExplainLine(lines, `Формула: ${quickMeta.formula}.`);
      }

      const base = cleanLegacyExplain(item.explain || '');
      if (lines.length < 3 && base){
        pushExplainLine(lines, base);
      }

      if (!lines.length) return 'Объяснение пока не готово.';
      return lines.join('\n');
    }

    function renderChoice(q){
      const p = document.createElement('div');
      p.className = 'sh-run-prompt';
      p.textContent = q.item.prompt;
      elCard.appendChild(p);

      const list = document.createElement('div');
      list.className = 'sh-choice-list';

      q.item.options.forEach((opt, i)=>{
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ik-btn sh-choice';
        btn.textContent = `${String.fromCharCode(97+i)}) ${opt}`;
        btn.addEventListener('click', ()=>{
          if (checked) return;
          selectedIndex = i;
          [...list.querySelectorAll('button')].forEach(b=> b.classList.remove('is-picked'));
          btn.classList.add('is-picked');
        });
        list.appendChild(btn);
      });

      elCard.appendChild(list);
    }

    function renderInput(q){
      const p = document.createElement('div');
      p.className = 'sh-run-prompt';
      p.textContent = q.item.prompt;
      elCard.appendChild(p);

      const row = document.createElement('div');
      row.className = 'ik-row';
      row.style.marginTop = '12px';

      const input = document.createElement('input');
      input.className = 'ik-input';
      input.id = 'shTRunInput';
      input.type = 'text';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.placeholder = 'Answer...';

      row.appendChild(input);
      elCard.appendChild(row);
      input.focus?.();
    }

    function renderMulti(q){
      const p = document.createElement('div');
      p.className = 'sh-run-prompt';
      p.textContent = q.item.prompt;
      elCard.appendChild(p);

      const list = document.createElement('div');
      list.className = 'sh-choice-list';

      q.item.options.forEach((opt, i)=>{
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ik-btn sh-choice';
        btn.textContent = `${String.fromCharCode(97+i)}) ${opt}`;
        btn.addEventListener('click', ()=>{
          if (checked) return;
          if (selectedSet.has(i)) selectedSet.delete(i);
          else selectedSet.add(i);
          btn.classList.toggle('is-picked', selectedSet.has(i));
        });
        list.appendChild(btn);
      });

      elCard.appendChild(list);

      const hint = document.createElement('p');
      hint.className = 'ik-footnote';
      hint.textContent = 'мультивыбор: можно выбрать несколько';
      elCard.appendChild(hint);
    }

    function shuffle(arr){
      const a = [...arr];
      for(let i=a.length-1;i>0;i--){
        const j = Math.floor(Math.random()*(i+1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    function renderMatch(q){
      const p = document.createElement('div');
      p.className = 'sh-run-prompt';
      p.textContent = q.item.prompt;
      elCard.appendChild(p);

      const pairs = q.item.pairs || [];
      const rights = shuffle(pairs.map(x=>x.right));
      const wrap = document.createElement('div');
      wrap.style.display = 'grid';
      wrap.style.gridTemplateColumns = '1fr 1fr';
      wrap.style.gap = '10px';
      wrap.style.marginTop = '12px';

      const selects = [];

      pairs.forEach((pair, idx)=>{
        const left = document.createElement('div');
        left.className = 'ik-badge';
        left.textContent = pair.left;

        const sel = document.createElement('select');
        sel.className = 'ik-select';
        sel.setAttribute('data-idx', String(idx));

        const opt0 = document.createElement('option');
        opt0.value = '';
        opt0.textContent = 'выбери...';
        sel.appendChild(opt0);

        rights.forEach(r=>{
          const o = document.createElement('option');
          o.value = r;
          o.textContent = r;
          sel.appendChild(o);
        });

        selects.push(sel);
        wrap.appendChild(left);
        wrap.appendChild(sel);
      });

      matchState = { rights, selects, pairs };
      elCard.appendChild(wrap);
    }

    function renderMultiInput(q){
      const p = document.createElement('div');
      p.className = 'sh-run-prompt';
      p.textContent = q.item.prompt;
      elCard.appendChild(p);

      const row = document.createElement('div');
      row.className = 'ik-row';
      row.style.marginTop = '12px';
      row.style.flexWrap = 'wrap';

      const inputs = [];
      (q.item.inputs || []).forEach((spec, i)=>{
        const input = document.createElement('input');
        input.className = 'ik-input';
        input.type = 'text';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.placeholder = '';
        input.style.minWidth = '220px';
        input.setAttribute('data-idx', String(i));
        row.appendChild(input);
        inputs.push(input);
      });

      multiInputs = inputs;
      elCard.appendChild(row);
      inputs[0] && inputs[0].focus?.();
    }

    function renderCurrent(){
      checked = false;
      btnCheckNext.textContent = 'check';
      setExplainAvailability(false);
      if (elExplain){ elExplain.hidden = true; elExplain.textContent = ''; }
      resetPerQuestionState();
      setFeedback('idle', 'ready', 'выбери ответ или введи ответ и нажми check');


const q = queue[idx];

// progress
try{
  const bar = runWrap.querySelector('#shTRunProgress > div');
  if (bar){
    const pct = Math.round(((idx) / Math.max(1, queue.length)) * 100);
    bar.style.width = pct + '%';
  }
} catch(_){}
try{
  const hintEl = runWrap.querySelector('#shTRunHint');
  if (hintEl){
    hintEl.hidden = true;
    hintEl.textContent = '';
  }
} catch(_){}      elEx.textContent = `exercise: ${q.exTitle}`;
      elQ.textContent  = `question: ${idx+1}/${queue.length}`;

      elInstr.textContent = q.item.instruction || '';
      elCard.innerHTML = '';

      if (q.kind === 'choice'){
        renderChoice(q);
      } else if (q.kind === 'input' || q.kind === 'correction'){
        renderInput(q);
      } else if (q.kind === 'multi'){
        renderMulti(q);
      } else if (q.kind === 'match'){
        renderMatch(q);
      } else if (q.kind === 'multi_input'){
        renderMultiInput(q);
      } else {
        // fallback
        renderInput(q);
      }
    }

    function markChoice(correctIndex, chosenIndex){
      const btns = elCard.querySelectorAll('.sh-choice-list .sh-choice');
      btns.forEach((b, i)=>{
        b.classList.remove('is-correct', 'is-wrong');
        if (i === correctIndex) b.classList.add('is-correct');
        if (i === chosenIndex && i !== correctIndex) b.classList.add('is-wrong');
      });
    }

    function sameSet(aSet, bSet){
      if (aSet.size !== bSet.size) return false;
      for (const x of aSet) if (!bSet.has(x)) return false;
      return true;
    }

    function countAttempt(q){
      exTotals[q.exId] = (exTotals[q.exId] || 0) + 1;
    }

    function checkCurrent(){
      const q = queue[idx];
      if (q.kind === 'choice'){
        if (selectedIndex === null){
          setFeedback('idle', 'pick', 'сначала выбери вариант');
          lastCheck = null;
          return null;
        }
        countAttempt(q);
        const ok = selectedIndex === q.item.correctIndex;
        const selectedText = q.item.options?.[selectedIndex] || '';
        const correctText = q.item.options?.[q.item.correctIndex] || '';
        if (ok){
          exCorrect[q.exId] = (exCorrect[q.exId] || 0) + 1;
          mistakesSet.delete(q.item.id);
          setFeedback('correct', 'ok', 'верно');
        } else {
          mistakesSet.add(q.item.id);
          const corr = String.fromCharCode(97 + q.item.correctIndex);
          setFeedback('wrong', 'no', cbShowAfterLocal.checked ? `неверно (правильно: ${corr})` : 'неверно');
        }
        lastCheck = {
          kind: 'choice',
          ok,
          selectedIndex,
          correctIndex: q.item.correctIndex,
          selectedText,
          correctText
        };
        markChoice(q.item.correctIndex, selectedIndex);
        saveMistakesSnapshot();
        return ok;
      }

      if (q.kind === 'input' || q.kind === 'correction'){
        const input = elCard.querySelector('#shTRunInput');
        const raw = (input?.value || '').trim();
        if (!raw){ setFeedback('idle','input','введи ответ'); lastCheck = null; return null; }
        const accepted = q.item.accepted || [];
        let acceptedList = accepted;

        // For correction tasks: accept both the full corrected sentence and shorter fixes (single word / start of the question).
        if (q.kind === 'correction'){
          const extra = [];
          if (Array.isArray(q.item.acceptedShort)) extra.push(...q.item.acceptedShort);
          if (accepted && accepted[0]) extra.push(...deriveCorrectionKeywords(q.item.prompt || '', accepted[0] || ''));
          acceptedList = [...accepted, ...extra].filter(Boolean);
        }

        countAttempt(q);
        const res = checkInput(raw, acceptedList);
        const nearest = nearestAccepted(raw, acceptedList.length ? acceptedList : accepted);
        const primaryCorrect = (accepted && accepted[0]) ? accepted[0] : (nearest?.text || '');
        if (res.state === 'correct'){
          exCorrect[q.exId] = (exCorrect[q.exId] || 0) + 1;
          mistakesSet.delete(q.item.id);
          input.classList.remove('is-bad');
          input.classList.add('is-ok');
          setFeedback('correct', 'ok', 'верно');
        } else if (res.state === 'almost'){
          exCorrect[q.exId] = (exCorrect[q.exId] || 0) + 1;
          mistakesSet.delete(q.item.id);
          input.classList.remove('is-bad');
          input.classList.add('is-ok');
          setFeedback('correct', 'ok', 'верно (опечатка)');
        } else {
          mistakesSet.add(q.item.id);
          input.classList.remove('is-ok');
          input.classList.add('is-bad');
          if (cbShowAfterLocal.checked){
            setFeedback('wrong', 'no', `неверно (правильно: ${accepted[0] || ''})`);
          } else {
            setFeedback('wrong', 'no', 'неверно');
          }
        }
        lastCheck = {
          kind: q.kind,
          ok: res.state !== 'wrong',
          state: res.state,
          rawInput: raw,
          correctText: primaryCorrect,
          closestText: nearest?.text || ''
        };
        return res.state !== 'wrong';
      }

      if (q.kind === 'multi'){
        if (selectedSet.size === 0){ setFeedback('idle','pick','сначала выбери варианты'); lastCheck = null; return null; }
        countAttempt(q);
        const correctSet = new Set((q.item.correctIndices || []).map(x=>Number(x)));
        const ok = sameSet(selectedSet, correctSet);
        const selectedIdx = Array.from(selectedSet).sort((a,b)=>a-b);
        const correctIdx = Array.from(correctSet).sort((a,b)=>a-b);
        const selectedLabels = selectedIdx.map(i => q.item.options?.[i]).filter(Boolean);
        const correctLabels = correctIdx.map(i => q.item.options?.[i]).filter(Boolean);
        const missingLabels = correctIdx.filter(i => !selectedSet.has(i)).map(i => q.item.options?.[i]).filter(Boolean);
        const extraLabels = selectedIdx.filter(i => !correctSet.has(i)).map(i => q.item.options?.[i]).filter(Boolean);

        const btns = elCard.querySelectorAll('.sh-choice-list .sh-choice');
        btns.forEach((b, i)=>{
          b.classList.remove('is-correct', 'is-wrong');
          if (correctSet.has(i)) b.classList.add('is-correct');
          if (selectedSet.has(i) && !correctSet.has(i)) b.classList.add('is-wrong');
        });

        if (ok){
          exCorrect[q.exId] = (exCorrect[q.exId] || 0) + 1;
          mistakesSet.delete(q.item.id);
          setFeedback('correct', 'ok', 'верно');
        } else {
          mistakesSet.add(q.item.id);
          setFeedback('wrong', 'no', cbShowAfterLocal.checked ? `неверно (правильно: ${correctLabels.join(', ')})` : 'неверно');
        }

        lastCheck = {
          kind: 'multi',
          ok,
          selectedLabels,
          correctLabels,
          missingLabels,
          extraLabels
        };

        saveMistakesSnapshot();
        return ok;
      }

      if (q.kind === 'match'){
        const st = matchState;
        if (!st){
          setFeedback('idle', 'pick', 'сначала выбери варианты');
          lastCheck = null;
          return null;
        }

        let allPicked = true;
        let okCount = 0;

        st.selects.forEach((sel, i)=>{
          const v = sel.value;
          if (!v) allPicked = false;
          const isOk = v && v === st.pairs[i].right;
          sel.classList.toggle('is-ok', !!isOk);
          sel.classList.toggle('is-bad', !!v && !isOk);
          if (isOk) okCount += 1;
        });

        if (!allPicked){
          setFeedback('idle', 'pick', 'заполни все строки');
          lastCheck = null;
          return null;
        }

        countAttempt(q);
        const ok = okCount === st.pairs.length;
        const mismatches = st.pairs
          .map((p, i)=>({ left: p.left, right: p.right, user: st.selects[i]?.value || '' }))
          .filter(x => x.user !== x.right);
        if (ok){
          exCorrect[q.exId] = (exCorrect[q.exId] || 0) + 1;
          mistakesSet.delete(q.item.id);
          setFeedback('correct', 'ok', 'верно');
        } else {
          mistakesSet.add(q.item.id);
          const rightStr = st.pairs.map(p=>`${p.left} -> ${p.right}`).join(' | ');
          setFeedback('wrong', 'no', cbShowAfterLocal.checked ? `неверно (правильно: ${rightStr})` : 'неверно');
        }

        lastCheck = {
          kind: 'match',
          ok,
          mismatches
        };

        saveMistakesSnapshot();
        return ok;
      }

      if (q.kind === 'multi_input'){
        const specs = q.item.inputs || [];
        if (!multiInputs || multiInputs.length !== specs.length){
          setFeedback('idle', 'input', 'не удалось создать поля');
          lastCheck = null;
          return null;
        }

        let allOk = true;
        let anyAlmost = false;
        const slots = [];

        for (let i=0;i<specs.length;i++){
          const inputEl = multiInputs[i];
          const raw = (inputEl.value || '').trim();
          if (!raw){ setFeedback('idle','input','заполни все формы'); lastCheck = null; return null; }
          const accepted = specs[i].accepted || [];
          const res = checkInput(raw, accepted);
          const nearest = nearestAccepted(raw, accepted);
          const correct = (accepted && accepted[0]) ? accepted[0] : (nearest?.text || '');

          slots.push({
            index: i + 1,
            raw,
            correct,
            state: res.state
          });

          inputEl.classList.remove('is-ok','is-bad');
          if (res.state === 'wrong'){
            inputEl.classList.add('is-bad');
            allOk = false;
          } else {
            inputEl.classList.add('is-ok');
            if (res.state === 'almost') anyAlmost = true;
          }
        }

        countAttempt(q);
        if (allOk){
          exCorrect[q.exId] = (exCorrect[q.exId] || 0) + 1;
          mistakesSet.delete(q.item.id);
          setFeedback('correct', 'ok', anyAlmost ? 'верно (опечатка)' : 'верно');
        } else {
          mistakesSet.add(q.item.id);
          const firstAccepted = (specs[0] && specs[0].accepted && specs[0].accepted[0]) ? specs[0].accepted[0] : '';
          setFeedback('wrong', 'no', cbShowAfterLocal.checked ? `неверно (пример: ${firstAccepted} ...)` : 'неверно');
        }

        lastCheck = {
          kind: 'multi_input',
          ok: allOk,
          anyAlmost,
          slots,
          correctParts: slots.map(x => x.correct).filter(Boolean)
        };

        return allOk;
      }

      // fallback
      setFeedback('wrong', 'no', 'unknown task type');
      lastCheck = { kind: q.kind || 'unknown', ok: false };
      return false;
    }

    function finish(){
      // remove key handler
      if (runKeyHandler){
        document.removeEventListener('keydown', runKeyHandler, true);
        runKeyHandler = null;
      }

      // Update best + mastery
      const p = loadProgress(tenseObj.id);
      p.mistakes = [...mistakesSet];

      for (const exId of Object.keys(exTotals)){
        const total = exTotals[exId];
        const correct = exCorrect[exId] || 0;
        const prev = p.best?.[exId];
        const better = (!prev) || (correct/total > prev.correct/prev.total);
        if (!p.best) p.best = {};
        if (better) p.best[exId] = { correct, total };
      }

      const totalAll = Object.values(exTotals).reduce((a,b)=>a+b,0);
      const correctAll = Object.values(exCorrect).reduce((a,b)=>a+b,0);
      const pct = totalAll ? Math.round((correctAll/totalAll)*100) : 0;

      if (!options.onlyMistakes && totalAll > 0){
        if (pct >= 85) p.mastery = Math.min(5, (p.mastery || 0) + 1);
      }

      saveProgress(tenseObj.id, p);

      // update detail badge if opened
      if (currentId === tenseObj.id) updateMasteryUI(tenseObj.id);

      renderPracticeInfo();
      setStatus('saved');
    }

    // Global key handler while run is active:
    runKeyHandler = (e)=>{
      if (window.StudentHelperTabs?.getMainTab?.() !== 'tenses') return;
      if (practiceView.hidden) return;
      if (!practiceBody.querySelector('#shTRunCard')) return;

      if (e.key === 'Enter'){
        if (e.isComposing || e.repeat) return;
        if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
        e.preventDefault();
        e.stopPropagation();
        btnCheckNext.click();
        return;
      }

      // MCQ: 1-9
      if (e.key >= '1' && e.key <= '9' && !checked){
        const k = parseInt(e.key, 10) - 1;
        const btns = elCard.querySelectorAll('.sh-choice-list .sh-choice');
        if (btns.length && k >= 0 && k < btns.length){
          btns[k].click();
        }
      }
    };
    document.addEventListener('keydown', runKeyHandler, true);

    btnExit.addEventListener('click', finish);

    if (btnExplain){
      btnExplain.addEventListener('click', ()=>{
        if (btnExplain.dataset.locked === '1') return;
        const q = queue[idx];
        const t = buildSmartExplanation(q, lastCheck);
        if (!elExplain) return;
        if (elExplain.hidden){
          elExplain.textContent = t;
          elExplain.hidden = false;
          btnExplain.textContent = 'скрыть';
        } else {
          elExplain.hidden = true;
          elExplain.textContent = '';
          btnExplain.textContent = 'объяснение';
        }
      });
    }

    btnCheckNext.addEventListener('click', ()=>{
      if (!checked){
        const res = checkCurrent(); // null = ещё не готово
        if (res === null) return;
        checked = true;
        setExplainAvailability(true);
        btnCheckNext.textContent = (idx === queue.length - 1) ? 'finish' : 'next';
        return;
      }
      if (idx < queue.length - 1){
        idx += 1;
        renderCurrent();
      } else {
        finish();
      }
    });

    renderCurrent();
  }

  // -------------------------
  // Input checking (same idea as Structure)
  // -------------------------
  const CONTRACTIONS = [
    [/\bI'm\b/gi, "i am"],
    [/\bYou're\b/gi, "you are"],
    [/\bHe's\b/gi, "he is"],
    [/\bShe's\b/gi, "she is"],
    [/\bIt's\b/gi, "it is"],
    [/\bWe're\b/gi, "we are"],
    [/\bThey're\b/gi, "they are"],
    [/\bisn't\b/gi, "is not"],
    [/\baren't\b/gi, "are not"],
    [/\bwasn't\b/gi, "was not"],
    [/\bweren't\b/gi, "were not"],
    [/\bdon't\b/gi, "do not"],
    [/\bdoesn't\b/gi, "does not"],
    [/\bdidn't\b/gi, "did not"],
    [/\bcan't\b/gi, "cannot"],
    [/\bwon't\b/gi, "will not"],
    [/\bhaven't\b/gi, "have not"],
    [/\bhasn't\b/gi, "has not"],
    [/\bhadn't\b/gi, "had not"],
  ];

  function normalize(s){
    let t = (s || '').trim();
    t = t.replace(/[.!?]+$/g, '');
    t = t.replace(/\s+/g, ' ');
    for (const [re, rep] of CONTRACTIONS){
      t = t.replace(re, rep);
    }
    t = t.toLowerCase().trim();
    t = t.replace(/\s+/g, ' ');
    return t;
  }


  function tokensNormalized(s){
    const t = normalize(s);
    return t ? t.split(' ').filter(Boolean) : [];
  }

  function uniq(arr){
    const out = [];
    const seen = new Set();
    for (const x of (arr || [])){
      const k = normalize(x);
      if (!k) continue;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(x);
    }
    return out;
  }

  // Derive short acceptable fixes for correction tasks.
  // Example: "Did you went there?" -> accepted word "go"
  // Also helps with word order fixes: "You were watching TV?" -> accepts "were", "were you", "were you watching"
  function deriveCorrectionKeywords(wrongRaw, correctRaw){
    const wrong = tokensNormalized(wrongRaw);
    const correct = tokensNormalized(correctRaw);

    const counts = Object.create(null);
    for (const w of wrong){
      counts[w] = (counts[w] || 0) + 1;
    }

    const extra = [];
    for (const c of correct){
      if (counts[c] > 0) counts[c] -= 1;
      else extra.push(c);
    }

    // If no token differences (often just word order), accept the start of the correct sentence/question.
    if (extra.length === 0 && correct.length){
      extra.push(correct[0]);
      if (correct.length >= 2) extra.push(correct[0] + ' ' + correct[1]);
      if (correct.length >= 3) extra.push(correct[0] + ' ' + correct[1] + ' ' + correct[2]);
    }

    return uniq(extra);
  }

  function levenshtein(a, b){
    const m = a.length, n = b.length;
    const dp = new Array(n+1);
    for (let j=0;j<=n;j++) dp[j]=j;
    for (let i=1;i<=m;i++){
      let prev = dp[0];
      dp[0]=i;
      for (let j=1;j<=n;j++){
        const tmp = dp[j];
        const cost = a[i-1] === b[j-1] ? 0 : 1;
        dp[j] = Math.min(dp[j] + 1, dp[j-1] + 1, prev + cost);
        prev = tmp;
      }
    }
    return dp[n];
  }

  function checkInput(raw, accepted){
    const a = normalize(raw);
    const accNorm = (accepted || []).map(x=> normalize(x));

    if (accNorm.includes(a)){
      return { state: 'correct' };
    }

    const maxDist = a.length >= 12 ? 2 : 1;
    for (const ok of accNorm){
      const d = levenshtein(a, ok);
      if (d <= maxDist){
        return { state: 'almost' };
      }
    }
    return { state: 'wrong' };
  }

  // -------------------------
  // Events
  // -------------------------
  btnGoTheory.addEventListener('click', ()=>{
    renderList();
    showOnly('list');
    setStatus('list');
  });

  btnGoPractice.addEventListener('click', ()=>{
    showPractice();
  });
// Compare / Daily / Mixed Present quick start
btnGoCompare && btnGoCompare.addEventListener('click', ()=>{
  showCompare();
});

btnGoDaily && btnGoDaily.addEventListener('click', ()=>{
  showDaily();
});

btnGoMixedPresent && btnGoMixedPresent.addEventListener('click', ()=>{
  // open practice and start immediately
  showPractice();
  try{
    goalSelect.value = 'meaning';
    tenseSelect.value = 'mixedPresent';
  }catch(_){}
  setTimeout(()=>{ btnStart && btnStart.click(); }, 0);
});

btnBackHomeFromCompare && btnBackHomeFromCompare.addEventListener('click', ()=>{
  showOnly('home');
  setStatus('home');
});

btnBackHomeFromDaily && btnBackHomeFromDaily.addEventListener('click', ()=>{
  showOnly('home');
  setStatus('home');
});

btnClearMistakes && btnClearMistakes.addEventListener('click', ()=>{
  const id = (tenseSelect && tenseSelect.value) || '';
  if (!id) return;
  const p = loadProgress(id);
  p.mistakes = [];
  saveProgress(id, p);
  setStatus('mistakes cleared');
  showPracticeMeta();
});

btnResetProgress && btnResetProgress.addEventListener('click', ()=>{
  const id = (tenseSelect && tenseSelect.value) || '';
  if (!id) return;
  saveProgress(id, { mastery: 0, best: {}, mistakes: [] });
  setStatus('progress reset');
  showPracticeMeta();
});


  btnBackHomeFromList && btnBackHomeFromList.addEventListener('click', ()=>{
    showOnly('home');
    setStatus('home');
  });

  btnBackToList && btnBackToList.addEventListener('click', ()=>{
    renderList();
    showOnly('list');
    setStatus('list');
  });

  function showPractice(){
    fillGoalOptions();
    fillTenseOptions();
    renderCustomPicker();

    const ui = loadUIState();
    if (ui.goal && GOALS.some(x=>x.id === ui.goal)) goalSelect.value = ui.goal;
    if (ui.tense) tenseSelect.value = ui.tense;
    setCustomPickerVisible((tenseSelect && tenseSelect.value) === CUSTOM_TENSE_ID);

    showOnly('practice');
    renderPracticeInfo();
    setStatus('practice');
  }

  btnBackHomeFromPractice && btnBackHomeFromPractice.addEventListener('click', ()=>{
    showOnly('home');
    setStatus('home');
  });

  function goPracticeForTense(id){
    showPractice();
    tenseSelect.value = id;
    saveUIState({ tense: id });
    renderPracticeInfo();
  }

  btnGoPracticeFromDetail && btnGoPracticeFromDetail.addEventListener('click', ()=>{
    if (currentId) goPracticeForTense(currentId);
  });
  btnGoPracticeBottom && btnGoPracticeBottom.addEventListener('click', ()=>{
    if (currentId) goPracticeForTense(currentId);
  });

  goalSelect && goalSelect.addEventListener('change', renderPracticeInfo);
  tenseSelect && tenseSelect.addEventListener('change', ()=>{
    const isCustom = (tenseSelect.value === CUSTOM_TENSE_ID);
    setCustomPickerVisible(isCustom);
    if (isCustom) updateCustomHint(getCustomSelectedIds().length);
    renderPracticeInfo();
  });
  btnCustomSelectAll && btnCustomSelectAll.addEventListener('click', ()=> setAllCustomSelection(true));
  btnCustomClearAll && btnCustomClearAll.addEventListener('click', ()=> setAllCustomSelection(false));

  btnStart && btnStart.addEventListener('click', ()=>{
    const tenseId = tenseSelect.value || (REG.INDEX[0] && REG.INDEX[0].id);
    const tenseObj = getTenseForPractice(tenseId);
    const goalId = getSelectedGoalId();
    const exIds = gatherExerciseIds(tenseObj, goalId);

    const showAfter = !!cbShowAfter?.checked;
    startRun(tenseObj, exIds, { showAfterEach: showAfter, onlyMistakes: false });
  });

  btnRetry && btnRetry.addEventListener('click', ()=>{
    const tenseId = tenseSelect.value || (REG.INDEX[0] && REG.INDEX[0].id);
    const tenseObj = getTenseForPractice(tenseId);
    const goalId = getSelectedGoalId();
    const exIds = gatherExerciseIds(tenseObj, goalId);

    const showAfter = !!cbShowAfter?.checked;
    startRun(tenseObj, exIds, { showAfterEach: showAfter, onlyMistakes: true });
  });

// -------------------------
// Compare view
// -------------------------
const QUICK = {
  pastSimple: {
    when: "факт/завершённое • цепочка • привычка в прошлом",
    markers: "yesterday • last ... • ago • in 2010 • then",
    formula: "V2 / did (neg+q)"
  },
  pastContinuous: {
    when: "процесс в моменте • фон • параллельно • раздражение (always)",
    markers: "while • when • at 5 p.m. • all day",
    formula: "was/were + V-ing"
  },
  pastPerfect: {
    when: "действие до другого/момента в прошлом",
    markers: "before • by (time) • by the time • already",
    formula: "had + V3"
  },
  pastPerfectContinuous: {
    when: "процесс/длительность до момента в прошлом • причина результата",
    markers: "for • since • before • by the time • how long",
    formula: "had been + V-ing"
  },
  presentSimple: {
    when: "привычка/рутина • факт • расписание • состояния",
    markers: "always • usually • often • every day • on Mondays",
    formula: "V1 / do-does (neg+q), -s/-es"
  },
  presentContinuous: {
    when: "процесс сейчас • временно • развитие • раздражение always",
    markers: "now • at the moment • right now • these days • Look!",
    formula: "am/is/are + V-ing"
  },
  presentPerfect: {
    when: "результат/опыт до сейчас • незаконченный период",
    markers: "already • yet • just • ever/never • for/since",
    formula: "have/has + V3"
  },
  presentPerfectContinuous: {
    when: "длительность/процесс до сейчас • видимый результат",
    markers: "for/since • how long • lately/recently",
    formula: "have/has been + V-ing"
  },
  futureSimple: {
    when: "решение в момент речи • прогноз • обещание/предложение",
    markers: "tomorrow • next ... • soon • probably • I think",
    formula: "will + V1"
  },
  futureContinuous: {
    when: "процесс в конкретный момент в будущем • вежливый вопрос о планах",
    markers: "this time tomorrow • at 8 tomorrow • when/while",
    formula: "will be + V-ing"
  },
  futurePerfect: {
    when: "результат завершится к моменту в будущем",
    markers: "by • by the time • before • by then",
    formula: "will have + V3"
  },
  futurePerfectContinuous: {
    when: "длительность процесса к моменту в будущем",
    markers: "for ... by ... • by the time • how long",
    formula: "will have been + V-ing"
  }
};

function fillCompareSelects(){
  if (!cmpASelect || !cmpBSelect) return;
  cmpASelect.innerHTML = '';
  cmpBSelect.innerHTML = '';
  for (const meta of REG.INDEX){
    const o1=document.createElement('option');
    o1.value=meta.id; o1.textContent=meta.title;
    const o2=o1.cloneNode(true);
    cmpASelect.appendChild(o1);
    cmpBSelect.appendChild(o2);
  }
  // default: first two
  if (REG.INDEX.length>=2){
    cmpASelect.value = REG.INDEX[0].id;
    cmpBSelect.value = REG.INDEX[1].id;
  }
}

function superRule(aId,bId){
  const pair=[aId,bId].sort().join('|');
  if (pair==='presentContinuous|presentSimple') return 'Simple = привычка/факт/расписание (точка) • Continuous = процесс/временно (линия)';
  if (pair==='pastContinuous|pastSimple') return 'Past Simple = факт/событие (точка) • Past Continuous = процесс/фон (линия)';
  if (pair==='pastPerfect|pastSimple') return 'Past Perfect = действие до другого/момента в прошлом • Past Simple = факт/событие в прошлом';
  if (pair==='futureContinuous|futureSimple') return 'Future Simple = решение/факт/прогноз • Future Continuous = процесс в конкретный момент будущего';
  if (pair==='futurePerfect|futurePerfectContinuous') return 'Future Perfect = результат к сроку • Future Perfect Continuous = длительность к сроку';
  if (pair==='pastPerfect|pastPerfectContinuous') return 'Past Perfect = результат к моменту в прошлом • Past Perfect Continuous = процесс/длительность к моменту в прошлом';
  return 'Сравни: одно время — “более факт/обычно”, другое — “более процесс/контекст”.';
}

function renderCompare(){
  if (!cmpASelect || !cmpBSelect || !cmpRule || !cmpTable) return;
  const aId = cmpASelect.value;
  const bId = cmpBSelect.value;
  if (aId === bId){
    cmpRule.textContent = 'Выбери два разных времени.';
    cmpTable.innerHTML = '';
    return;
  }
  const A = REG.INDEX.find(x=>x.id===aId);
  const B = REG.INDEX.find(x=>x.id===bId);
  cmpRule.textContent = superRule(aId,bId);

  const qa = QUICK[aId] || {};
  const qb = QUICK[bId] || {};
  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr><th></th><th>${escapeHtml(A?.title||aId)}</th><th>${escapeHtml(B?.title||bId)}</th></tr>
    </thead>
    <tbody>
      <tr><th>когда</th><td>${escapeHtml(qa.when||'—')}</td><td>${escapeHtml(qb.when||'—')}</td></tr>
      <tr><th>маркеры</th><td>${escapeHtml(qa.markers||'—')}</td><td>${escapeHtml(qb.markers||'—')}</td></tr>
      <tr><th>формула</th><td>${escapeHtml(qa.formula||'—')}</td><td>${escapeHtml(qb.formula||'—')}</td></tr>
    </tbody>`;
  cmpTable.innerHTML='';
  cmpTable.appendChild(table);
}

function buildCompareItems(aId,bId,count){
  const aObj = REG.byId[aId];
  const bObj = REG.byId[bId];
  const A = REG.INDEX.find(x=>x.id===aId);
  const B = REG.INDEX.find(x=>x.id===bId);

  const items=[];
  function takeMeaning(tenseObj, correctIndex){
    const ex = (tenseObj?.practice?.exercises||[]).find(x=>x.id==='meaning');
    if (!ex || !Array.isArray(ex.items)) return;
    for (const it of ex.items.slice(0, 8)){
      const correctTenseId = correctIndex === 0 ? aId : bId;
      items.push({
        id: `cmp_${aId}_${bId}_${it.id}`,
        instruction: 'Какое время подходит?',
        prompt: it.prompt,
        options: [A?.title||aId, B?.title||bId],
        correctIndex,
        correctTenseId,
        sourceTenseId: it.correctTenseId || tenseObj?.id || correctTenseId,
        candidateTenseIds: [aId, bId],
        explain: it.explain || ''
      });
    }
  }
  takeMeaning(aObj,0);
  takeMeaning(bObj,1);

  // Add extra PS vs PC contrast from mixedPresent if relevant
  const pair=[aId,bId].sort().join('|');
  if (pair==='presentContinuous|presentSimple' && REG.byId.mixedPresent){
    const ex = (REG.byId.mixedPresent.practice?.exercises||[]).find(x=>x.id==='meaning');
    for (const it of (ex?.items||[]).slice(0,10)){
      const correctIndex = (it.correctTenseId===aId)?0:1;
      const correctTenseId = correctIndex === 0 ? aId : bId;
      items.push({
        id: `cmp_mpr_${it.id}`,
        instruction: it.instruction || 'Какое время?',
        prompt: it.prompt,
        options: [A?.title||aId, B?.title||bId],
        correctIndex,
        correctTenseId,
        sourceTenseId: it.correctTenseId || correctTenseId,
        candidateTenseIds: [aId, bId],
        explain: it.explain || ''
      });
    }
  }

  // shuffle
  for (let i=items.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [items[i],items[j]]=[items[j],items[i]];
  }
  return items.slice(0, Math.max(5, Math.min(10, count||10)));
}

function startCompareMini(n){
  const aId = cmpASelect.value;
  const bId = cmpBSelect.value;
  if (aId === bId) return;
  const items = buildCompareItems(aId,bId,n||10);
  const synth = {
    id: `compare_${aId}_vs_${bId}`,
    title: 'Compare',
    practice: { exercises: [{ id:'compare', title:'Compare', kind:'choice', items }] }
  };
  cmpRunBody.innerHTML='';
  startRun(synth, ['compare'], { showAfterEach: true, onlyMistakes: false }, cmpRunBody);
}

function showCompare(){
  fillCompareSelects();
  renderCompare();
  showOnly('compare');
  setStatus('compare');
}

btnCompare && btnCompare.addEventListener('click', ()=>{
  renderCompare();
});
btnCmpMini10 && btnCmpMini10.addEventListener('click', ()=> startCompareMini(10));
btnCmpMini5 && btnCmpMini5.addEventListener('click', ()=> startCompareMini(5));

cmpASelect && cmpASelect.addEventListener('change', renderCompare);
cmpBSelect && cmpBSelect.addEventListener('change', renderCompare);

// -------------------------
// Daily mini-session (10)
// -------------------------
const KEY_DAILY = 'sh_tenses_daily_v1';

function ymd(){
  const d=new Date();
  const yy=d.getFullYear();
  const mm=String(d.getMonth()+1).padStart(2,'0');
  const dd=String(d.getDate()).padStart(2,'0');
  return `${yy}-${mm}-${dd}`;
}

function pickDailySet(forceNew){
  const today = ymd();
  let state=null;
  try{ state = JSON.parse(localStorage.getItem(KEY_DAILY)||'null'); }catch(_){}
  if (!forceNew && state && state.date===today && Array.isArray(state.items) && state.items.length){
    return state.items;
  }

  // build pool from all tenses (including mixed + mixedPresent if present)
  const pool=[];
  const allIds = [...REG.INDEX.map(x=>x.id), 'mixed', 'mixedPresent', 'mixedPerfectPast'].filter(id=>REG.byId[id]);
  for (const tid of allIds){
    const t = REG.byId[tid];
    for (const ex of (t.practice?.exercises||[])){
      for (const it of (ex.items||[])){
        pool.push({ tid, exId: ex.id, kind: ex.kind, item: it });
      }
    }
  }
  // shuffle and take 10
  for (let i=pool.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [pool[i],pool[j]]=[pool[j],pool[i]];
  }
  const picked = pool.slice(0,10);
  try{ localStorage.setItem(KEY_DAILY, JSON.stringify({ date: today, items: picked })); }catch(_){}
  return picked;
}

function startDaily(forceNew){
  const picked = pickDailySet(!!forceNew);

  // group by kind into exercises
  const byKind = {};
  for (const q of picked){
    const k = q.kind || 'choice';
    byKind[k] = byKind[k] || [];
    // clone item and keep unique id
    const cloned = Object.assign({}, q.item, {
      id: `dy_${q.tid}_${q.item.id}`,
      sourceTenseId: q.item?.sourceTenseId || q.item?.correctTenseId || q.tid
    });
    if (!cloned.correctTenseId && q.item?.correctTenseId) cloned.correctTenseId = q.item.correctTenseId;
    byKind[k].push(cloned);
  }

  const exs = [];
  const ids = [];
  for (const k of Object.keys(byKind)){
    const exId = `daily_${k}`;
    exs.push({ id: exId, title: `Daily (${k})`, kind: k, items: byKind[k] });
    ids.push(exId);
  }

  const synth = { id: 'daily', title:'Daily', practice: { exercises: exs } };
  dailyRunBody.innerHTML='';
  startRun(synth, ids, { showAfterEach: true, onlyMistakes: false }, dailyRunBody);
}

function showDaily(){
  showOnly('daily');
  setStatus('daily');
}

btnDailyStart && btnDailyStart.addEventListener('click', ()=> startDaily(false));
btnDailyNew && btnDailyNew.addEventListener('click', ()=> startDaily(true));

  // Init
  if (countBadge) countBadge.textContent = `tenses: ${REG.INDEX.length}`;
  showOnly('home');

  // -------------------------
  // Utils
  // -------------------------
  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, (m)=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[m]);
  }
  }
})();
