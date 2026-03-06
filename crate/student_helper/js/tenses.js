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

  if (!homeView || !listView || !detailView || !practiceView) return;
  if (!btnGoTheory || !btnGoPractice || !listEl) return;

  let currentId = null;
  let runKeyHandler = null;

  const KEY_UI = 'sh_tenses_ui_v1';

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

    for (const meta of REG.INDEX){
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

  function getTenseForPractice(id){
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
        <button class="ik-btn" id="shTRunExplainBtn" type="button" hidden>объяснение</button>
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

    let idx = 0;
    let checked = false;

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
      if (btnExplain){ btnExplain.hidden = true; btnExplain.textContent = 'объяснение'; }
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

// hint detector (very lightweight)
try{
  const hintEl = runWrap.querySelector('#shTRunHint');
  if (hintEl){
    const txt = String(q.item?.prompt || '').toLowerCase();
    const hints = [];
    if (/(\bnow\b|at the moment|right now|currently|look!|listen!)/.test(txt)) hints.push('hint: Continuous (now / at the moment)');
    if (/(\balways\b|\busually\b|\boften\b|\bsometimes\b|\bnever\b|every day|every week|on mondays|at weekends|in general)/.test(txt)) hints.push('hint: Simple (always / usually / every...)');
    if (hints.length){
      hintEl.hidden = false;
      hintEl.textContent = hints.join(' • ');
    } else {
      hintEl.hidden = true;
      hintEl.textContent = '';
    }
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
          return null;
        }
        countAttempt(q);
        const ok = selectedIndex === q.item.correctIndex;
        if (ok){
          exCorrect[q.exId] = (exCorrect[q.exId] || 0) + 1;
          mistakesSet.delete(q.item.id);
          setFeedback('correct', 'ok', 'верно');
        } else {
          mistakesSet.add(q.item.id);
          const corr = String.fromCharCode(97 + q.item.correctIndex);
          setFeedback('wrong', 'no', cbShowAfterLocal.checked ? `неверно (правильно: ${corr})` : 'неверно');
        }
        markChoice(q.item.correctIndex, selectedIndex);
        saveMistakesSnapshot();
        return ok;
      }

      if (q.kind === 'input' || q.kind === 'correction'){
        const input = elCard.querySelector('#shTRunInput');
        const raw = (input?.value || '').trim();
        if (!raw){ setFeedback('idle','input','введи ответ'); return null; }
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
        return res.state !== 'wrong';
      }

      if (q.kind === 'multi'){
        if (selectedSet.size === 0){ setFeedback('idle','pick','сначала выбери варианты'); return null; }
        countAttempt(q);
        const correctSet = new Set((q.item.correctIndices || []).map(x=>Number(x)));
        const ok = sameSet(selectedSet, correctSet);

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
          const correctLabels = (q.item.correctIndices || []).map(i => q.item.options?.[i]).filter(Boolean);
          setFeedback('wrong', 'no', cbShowAfterLocal.checked ? `неверно (правильно: ${correctLabels.join(', ')})` : 'неверно');
        }

        saveMistakesSnapshot();
        return ok;
      }

      if (q.kind === 'match'){
        const st = matchState;
        if (!st){
          setFeedback('idle', 'pick', 'сначала выбери варианты');
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
          return null;
        }

        countAttempt(q);
        const ok = okCount === st.pairs.length;
        if (ok){
          exCorrect[q.exId] = (exCorrect[q.exId] || 0) + 1;
          mistakesSet.delete(q.item.id);
          setFeedback('correct', 'ok', 'верно');
        } else {
          mistakesSet.add(q.item.id);
          const rightStr = st.pairs.map(p=>`${p.left} -> ${p.right}`).join(' | ');
          setFeedback('wrong', 'no', cbShowAfterLocal.checked ? `неверно (правильно: ${rightStr})` : 'неверно');
        }

        saveMistakesSnapshot();
        return ok;
      }

      if (q.kind === 'multi_input'){
        const specs = q.item.inputs || [];
        if (!multiInputs || multiInputs.length !== specs.length){
          setFeedback('idle', 'input', 'не удалось создать поля');
          return null;
        }

        let allOk = true;
        let anyAlmost = false;

        for (let i=0;i<specs.length;i++){
          const inputEl = multiInputs[i];
          const raw = (inputEl.value || '').trim();
          if (!raw){ setFeedback('idle','input','заполни все формы'); return null; }
          const accepted = specs[i].accepted || [];
          const res = checkInput(raw, accepted);

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

        return allOk;
      }

      // fallback
      setFeedback('wrong', 'no', 'unknown task type');
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
        const q = queue[idx];
        const t = (q && q.item && q.item.explain) ? String(q.item.explain) : 'объяснения пока нет';
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
        if (btnExplain) btnExplain.hidden = false;
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

    const ui = loadUIState();
    if (ui.goal && GOALS.some(x=>x.id === ui.goal)) goalSelect.value = ui.goal;
    if (ui.tense) tenseSelect.value = ui.tense;

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
  tenseSelect && tenseSelect.addEventListener('change', renderPracticeInfo);

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
      items.push({
        id: `cmp_${aId}_${bId}_${it.id}`,
        instruction: 'Какое время подходит?',
        prompt: it.prompt,
        options: [A?.title||aId, B?.title||bId],
        correctIndex
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
      items.push({
        id: `cmp_mpr_${it.id}`,
        instruction: it.instruction || 'Какое время?',
        prompt: it.prompt,
        options: [A?.title||aId, B?.title||bId],
        correctIndex: (it.correctTenseId===aId)?0:1
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
    byKind[k].push(Object.assign({}, q.item, { id: `dy_${q.tid}_${q.item.id}` }));
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
