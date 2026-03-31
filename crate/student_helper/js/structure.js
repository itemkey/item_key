(function(){
  const REG = window.StudentHelperStructures;
  if (!REG || !REG.STRUCTURES) return;

  const listView = document.getElementById('structListView');
  const detailView = document.getElementById('structDetailView');
  const listEl = document.getElementById('structList');

  const countBadge = document.getElementById('structCountBadge');
  const statusEl = document.getElementById('structStatus');

  const btnBack = document.getElementById('structBackToList');
  const titleEl = document.getElementById('structTitle');
  const subEl = document.getElementById('structSubtitle');
  const masteryBadge = document.getElementById('structMasteryBadge');
  const btnStartTop = document.getElementById('structStartPracticeTop');
  const btnAddToLibrary = document.getElementById('structAddToLibraryBtn');

  const tabRule = document.getElementById('struct-tab-rule');
  const tabPractice = document.getElementById('struct-tab-practice');
  const panelRule = document.getElementById('struct-panel-rule');
  const panelPractice = document.getElementById('struct-panel-practice');

  const ruleBody = document.getElementById('structRuleBody');
  const practiceBody = document.getElementById('structPracticeBody');

  let currentId = null;
  let runKeyHandler = null;

  // -------------------------
  // Storage
  // -------------------------
  function keyProgress(id){ return `sh_struct_progress_${id}`; }

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

  // -------------------------
  // UI helpers
  // -------------------------
  function setVisible(el, visible){
    if (!el) return;
    el.hidden = !visible;
  }

  function setSubTab(which){
    const isRule = which === 'rule';
    tabRule.setAttribute('aria-selected', String(isRule));
    tabPractice.setAttribute('aria-selected', String(!isRule));
    panelRule.hidden = !isRule;
    panelPractice.hidden = isRule;
  }

  function setStatus(text){
    if (!statusEl) return;
    statusEl.textContent = text;
    if (text !== 'ready'){
      setTimeout(()=>{ if (statusEl.textContent === text) statusEl.textContent = 'ready'; }, 650);
    }
  }

  // -------------------------
  // List render
  // -------------------------
  function renderList(){
    if (countBadge) countBadge.textContent = `structures: ${REG.STRUCTURES.length}`;
    if (!listEl) return;

    listEl.innerHTML = '';
    for (const s of REG.STRUCTURES){
      const prog = loadProgress(s.id);

      const li = document.createElement('li');

      const left = document.createElement('div');
      left.innerHTML = `<p class="ik-itemline"><b>${escapeHtml(s.title)}</b></p>
                        <p class="ik-itemline ik-muted">${escapeHtml(s.subtitle || '')}</p>`;

      const right = document.createElement('div');
      right.className = 'ik-mini';

      const badge = document.createElement('span');
      badge.className = 'ik-badge';
      badge.textContent = `${masteryLabel(prog.mastery)} - ${prog.mastery}/5`;

      const btn = document.createElement('button');
      btn.className = 'ik-btn ik-btn--black';
      btn.type = 'button';
      btn.textContent = 'open';
      btn.addEventListener('click', ()=> openStructure(s.id));

      right.appendChild(badge);
      right.appendChild(btn);

      li.appendChild(left);
      li.appendChild(right);
      listEl.appendChild(li);
    }
  }

  // -------------------------
  // Detail render - Rule
  // -------------------------
  function renderRule(structure){
    ruleBody.innerHTML = '';
    const blocks = structure.ruleBlocks || [];
    for (const b of blocks){
      if (b.type === 'heading'){
        const h = document.createElement('h3');
        h.className = 'sh-rule-h';
        h.textContent = b.text || '';
        ruleBody.appendChild(h);
      } else if (b.type === 'text'){
        const p = document.createElement('p');
        p.className = 'sh-rule-p';
        p.textContent = b.text || '';
        ruleBody.appendChild(p);
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
        ruleBody.appendChild(wrap);
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
        ruleBody.appendChild(box);
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
        ruleBody.appendChild(box);
      }
    }
  }

  // -------------------------
  // Practice
  // -------------------------
  function renderPracticeHome(structure){
    practiceBody.innerHTML = '';

    const prog = loadProgress(structure.id);

    const top = document.createElement('div');
    top.className = 'ik-row';
    top.innerHTML = `
      <button class="ik-btn ik-btn--black" id="structStartFull" type="button">start full practice</button>
      <button class="ik-btn" id="structRetryMistakes" type="button">retry mistakes</button>
      <span class="ik-spacer" aria-hidden="true"></span>
      <label class="ik-label" style="display:flex; align-items:center; gap:8px;">
        <input type="checkbox" id="structShowAfterEach" checked />
        show answers after each
      </label>
    `;
    practiceBody.appendChild(top);

    const retryBtn = top.querySelector('#structRetryMistakes');
    if (!prog.mistakes || prog.mistakes.length === 0){
      retryBtn.disabled = true;
      retryBtn.title = 'Нет ошибок';
    }

    const exList = document.createElement('ul');
    exList.className = 'ik-list';
    exList.setAttribute('aria-label', 'Exercises');

    const exercises = (structure.practice && structure.practice.exercises) || [];
    for (const ex of exercises){
      const li = document.createElement('li');

      const left = document.createElement('div');
      const qCount = (ex.items || []).length;
      const best = prog.best?.[ex.id];
      const bestText = best ? `${best.correct}/${best.total}` : `0/${qCount}`;

      left.innerHTML = `<p class="ik-itemline"><b>${escapeHtml(ex.title)}</b></p>
                        <p class="ik-itemline ik-muted">questions: ${qCount} - best: ${bestText}</p>`;

      const right = document.createElement('div');
      right.className = 'ik-mini';

      const btn = document.createElement('button');
      btn.className = 'ik-btn ik-btn--black';
      btn.type = 'button';
      btn.textContent = 'start';
      btn.addEventListener('click', ()=>{
        const showAfter = !!document.getElementById('structShowAfterEach')?.checked;
        startRun(structure, [ex.id], { showAfterEach: showAfter });
      });

      const btnRetry = document.createElement('button');
      btnRetry.className = 'ik-btn';
      btnRetry.type = 'button';
      btnRetry.textContent = 'retry';
      btnRetry.addEventListener('click', ()=>{
        const showAfter = !!document.getElementById('structShowAfterEach')?.checked;
        startRun(structure, [ex.id], { showAfterEach: showAfter });
      });

      right.appendChild(btn);
      right.appendChild(btnRetry);

      li.appendChild(left);
      li.appendChild(right);
      exList.appendChild(li);
    }

    const divider = document.createElement('div');
    divider.className = 'ik-divider';
    practiceBody.appendChild(divider);
    practiceBody.appendChild(exList);

    // Wire buttons
    top.querySelector('#structStartFull').addEventListener('click', ()=>{
      const showAfter = !!document.getElementById('structShowAfterEach')?.checked;
      startRun(structure, exercises.map(x=>x.id), { showAfterEach: showAfter });
    });

    retryBtn.addEventListener('click', ()=>{
      const showAfter = !!document.getElementById('structShowAfterEach')?.checked;
      startRun(structure, exercises.map(x=>x.id), { showAfterEach: showAfter, onlyMistakes: true });
    });
  }

  function startRun(structure, exerciseIds, opts){
    const options = Object.assign({ showAfterEach: true, onlyMistakes: false }, opts || {});
    const exercises = (structure.practice && structure.practice.exercises) || [];
    const chosen = exercises.filter(ex => exerciseIds.includes(ex.id));

    const prog = loadProgress(structure.id);
    const mistakesSet = new Set(prog.mistakes || []);

    // Build task queue
    const queue = [];
    for (const ex of chosen){
      for (const item of (ex.items || [])){
        if (options.onlyMistakes && !mistakesSet.has(item.id)) continue;
        queue.push({ exId: ex.id, exTitle: ex.title, kind: ex.kind, item });
      }
    }

    if (options.onlyMistakes && queue.length === 0){
      setStatus('нет ошибок');
      return;
    }

    // Clear any old key handler
    if (runKeyHandler){
      document.removeEventListener('keydown', runKeyHandler);
      runKeyHandler = null;
    }

    // Render run UI
    practiceBody.innerHTML = '';
    const runWrap = document.createElement('div');
    runWrap.className = 'sh-practice-run';

    runWrap.innerHTML = `
      <div class="ik-row">
        <span class="ik-badge" id="shRunEx">exercise</span>
        <span class="ik-badge" id="shRunQ">question</span>
        <span class="ik-spacer" aria-hidden="true"></span>
        <label class="ik-label" style="display:flex; align-items:center; gap:8px;">
          <input type="checkbox" id="shRunShowAfter" ${options.showAfterEach ? 'checked' : ''} />
          show answers after each
        </label>
        <button class="ik-btn" id="shRunExit" type="button">exit</button>
      </div>

      <div class="ik-divider"></div>

      <p class="ik-prompt" id="shRunInstr">...</p>
      <div class="sh-run-card" id="shRunCard"></div>

      <div class="ik-divider"></div>

      <div class="ik-feedback" id="shRunFeedback" data-state="idle" aria-live="polite">
        <div class="ik-feedback__stamp" id="shRunStamp">ready</div>
        <p class="ik-feedback__line" id="shRunLine">выбери ответ или введи ответ и нажми check</p>
      </div>

      <div class="ik-row" style="margin-top:12px;">
        <button class="ik-btn ik-btn--black" id="shRunCheckNext" type="button">check</button>
      </div>
    `;

    practiceBody.appendChild(runWrap);

    const elEx = runWrap.querySelector('#shRunEx');
    const elQ  = runWrap.querySelector('#shRunQ');
    const elInstr = runWrap.querySelector('#shRunInstr');
    const elCard = runWrap.querySelector('#shRunCard');

    const elFb = runWrap.querySelector('#shRunFeedback');
    const elStamp = runWrap.querySelector('#shRunStamp');
    const elLine = runWrap.querySelector('#shRunLine');
    const btnExit = runWrap.querySelector('#shRunExit');
    const btnCheckNext = runWrap.querySelector('#shRunCheckNext');
    const cbShowAfter = runWrap.querySelector('#shRunShowAfter');

    let idx = 0;
    let checked = false;
    let selectedIndex = null;

    // scoring per exercise
    const exTotals = {};
    const exCorrect = {};

    function setFeedback(state, stamp, line){
      elFb.setAttribute('data-state', state);
      elStamp.textContent = stamp;
      elLine.textContent = line;
    }

    function renderCurrent(){
      checked = false;
      selectedIndex = null;
      btnCheckNext.textContent = 'check';
      setFeedback('idle', 'ready', 'выбери ответ или введи ответ и нажми check');

      const q = queue[idx];
      elEx.textContent = `exercise: ${q.exTitle}`;
      elQ.textContent  = `question: ${idx+1}/${queue.length}`;

      elInstr.textContent = q.item.instruction || '';
      elCard.innerHTML = '';

      if (q.kind === 'choice'){
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
      } else {
        const p = document.createElement('div');
        p.className = 'sh-run-prompt';
        p.textContent = q.item.prompt;
        elCard.appendChild(p);

        const row = document.createElement('div');
        row.className = 'ik-row';
        row.style.marginTop = '12px';

        const input = document.createElement('input');
        input.className = 'ik-input';
        input.id = 'shRunInput';
        input.type = 'text';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.placeholder = (q.item.mode === 'full_sentence') ? 'Full sentence...' : 'Answer...';

        row.appendChild(input);
        elCard.appendChild(row);
        input.focus?.();
      }
    }

    function finish(){
      // remove key handler
      if (runKeyHandler){
        document.removeEventListener('keydown', runKeyHandler);
        runKeyHandler = null;
      }

      // Update best + mastery
      const p = loadProgress(structure.id);
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

      saveProgress(structure.id, p);
      updateMasteryUI(structure.id);

      renderPracticeHome(structure);
      setStatus('saved');
    }

    function check(){
      const q = queue[idx];
      exTotals[q.exId] = (exTotals[q.exId] || 0) + 1;

      if (q.kind === 'choice'){
        if (selectedIndex === null){
          setFeedback('idle', 'pick', 'сначала выбери вариант');
          return false;
        }
        const ok = selectedIndex === q.item.correctIndex;
        if (ok){
          exCorrect[q.exId] = (exCorrect[q.exId] || 0) + 1;
          mistakesSet.delete(q.item.id);
          setFeedback('correct', 'ok', `Correct answer: ${String.fromCharCode(97 + q.item.correctIndex)}`);
        } else {
          mistakesSet.add(q.item.id);
          setFeedback('wrong', 'no', `Correct answer: ${String.fromCharCode(97 + q.item.correctIndex)}`);
        }

        const btns = elCard.querySelectorAll('.sh-choice-list .sh-choice');
        btns.forEach((b, i)=>{
          b.classList.remove('is-correct', 'is-wrong');
          if (i === q.item.correctIndex) b.classList.add('is-correct');
          if (i === selectedIndex && !ok) b.classList.add('is-wrong');
        });

        return ok;
      } else {
        const input = elCard.querySelector('#shRunInput');
        const raw = (input?.value || '').trim();
        const accepted = q.item.accepted || [];

        const res = checkInput(raw, accepted);
        if (res.state === 'correct'){
          exCorrect[q.exId] = (exCorrect[q.exId] || 0) + 1;
          mistakesSet.delete(q.item.id);
          input.classList.remove('is-bad');
          input.classList.add('is-ok');
          setFeedback('correct', 'ok', 'correct');
        } else if (res.state === 'almost'){
          exCorrect[q.exId] = (exCorrect[q.exId] || 0) + 1;
          mistakesSet.delete(q.item.id);
          input.classList.remove('is-bad');
          input.classList.add('is-ok');
          setFeedback('correct', 'ok', 'almost correct (typo)');
        } else {
          mistakesSet.add(q.item.id);
          input.classList.remove('is-ok');
          input.classList.add('is-bad');
          if (cbShowAfter.checked){
            setFeedback('wrong', 'no', `Correct: ${accepted[0] || ''}`);
          } else {
            setFeedback('wrong', 'no', 'wrong');
          }
        }
        return res.state !== 'wrong';
      }
    }

    // Global key handler while run is active:
    runKeyHandler = (e)=>{
      if (window.StudentHelperTabs?.getMainTab?.() !== 'struct') return;
      if (detailView.hidden) return;
      if (panelPractice.hidden) return;

      if (e.key === 'Enter'){
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
    document.addEventListener('keydown', runKeyHandler);

    btnExit.addEventListener('click', finish);

    btnCheckNext.addEventListener('click', ()=>{
      if (!checked){
        check();
        checked = true;
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
  // Input checking
  // -------------------------
  const CONTRACTIONS = [
    [/I'm/gi, "i am"],
    [/You're/gi, "you are"],
    [/He's/gi, "he is"],
    [/She's/gi, "she is"],
    [/It's/gi, "it is"],
    [/We're/gi, "we are"],
    [/They're/gi, "they are"],
    [/isn't/gi, "is not"],
    [/aren't/gi, "are not"],
    [/wasn't/gi, "was not"],
    [/weren't/gi, "were not"],
    [/don't/gi, "do not"],
    [/doesn't/gi, "does not"],
    [/didn't/gi, "did not"],
    [/can't/gi, "cannot"],
    [/won't/gi, "will not"],
    [/haven't/gi, "have not"],
    [/hasn't/gi, "has not"],
    [/hadn't/gi, "had not"],
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
  // Navigation
  // -------------------------
  function openStructure(id){
    const s = REG.byId[id];
    if (!s) return;

    currentId = id;

    setVisible(listView, false);
    setVisible(detailView, true);

    titleEl.textContent = s.title;
    subEl.textContent = s.subtitle || '';

    renderRule(s);
    renderPracticeHome(s);
    updateMasteryUI(id);
    setSubTab('rule');

    setStatus('open');
    window.scrollTo(0, 0);
  }

  function backToList(){
    currentId = null;

    if (runKeyHandler){
      document.removeEventListener('keydown', runKeyHandler);
      runKeyHandler = null;
    }

    setVisible(detailView, false);
    setVisible(listView, true);
    renderList();
    window.scrollTo(0, 0);
  }

  function updateMasteryUI(id){
    const p = loadProgress(id);
    masteryBadge.textContent = `mastery ${p.mastery || 0}/5`;
    masteryBadge.title = masteryLabel(p.mastery || 0);
  }

  function addCurrentToLibrary(){
    if (!currentId) return;
    const s = REG.byId[currentId];
    if (!s) return;
    const lib = window.StudentHelperLibrary;
    if (!lib) return;
    const payload = {
      source: 'structure',
      id: String(s.id || currentId),
      title: String(s.title || currentId),
      subtitle: String(s.subtitle || '')
    };
    if (typeof lib.quickAddWithPicker === 'function') lib.quickAddWithPicker(payload);
    else if (typeof lib.quickAdd === 'function') lib.quickAdd(payload);
  }

  // -------------------------
  // Events
  // -------------------------
  btnBack.addEventListener('click', backToList);

  tabRule.addEventListener('click', ()=> setSubTab('rule'));
  tabPractice.addEventListener('click', ()=> setSubTab('practice'));

  btnStartTop.addEventListener('click', ()=>{
    setSubTab('practice');
    const s = REG.byId[currentId];
    if (s) renderPracticeHome(s);
    const btn = practiceBody.querySelector('#structStartFull');
    btn && btn.click();
  });

  btnAddToLibrary && btnAddToLibrary.addEventListener('click', addCurrentToLibrary);

  document.addEventListener('sh:library-open', (e)=>{
    const detail = e && e.detail ? e.detail : {};
    if (String(detail.source || '').toLowerCase() !== 'structure') return;
    const id = String(detail.id || '').trim();
    if (!id || !REG.byId[id]) return;
    openStructure(id);
    setSubTab('rule');
  });

  document.addEventListener('sh:library-practice', (e)=>{
    const detail = e && e.detail ? e.detail : {};
    if (String(detail.source || '').toLowerCase() !== 'structure') return;
    const ids = Array.isArray(detail.ids) ? detail.ids : [];
    const id = String(ids[0] || detail.id || '').trim();
    if (!id || !REG.byId[id]) return;
    openStructure(id);
    setSubTab('practice');
    const btn = practiceBody.querySelector('#structStartFull');
    if (btn) btn.click();
  });

  // Init
  renderList();
  setVisible(detailView, false);
  setVisible(listView, true);

  // -------------------------
  // Utils
  // -------------------------
  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, (m)=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[m]);
  }
})();
