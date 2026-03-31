(function(){
  const STORAGE_KEY = 'sh_library_v1';

  const panel = document.getElementById('panel-library');
  const countBadge = document.getElementById('libraryCountBadge');
  const statusEl = document.getElementById('libraryStatus');
  const newCategoryInput = document.getElementById('libraryNewCategoryInput');
  const addCategoryBtn = document.getElementById('libraryAddCategoryBtn');
  const renameCategoryBtn = document.getElementById('libraryRenameCategoryBtn');
  const deleteCategoryBtn = document.getElementById('libraryDeleteCategoryBtn');
  const categoryList = document.getElementById('libraryCategoryList');
  const activeCategoryTitle = document.getElementById('libraryActiveCategoryTitle');
  const itemSearchInput = document.getElementById('libraryItemSearchInput');
  const startCategoryPracticeBtn = document.getElementById('libraryStartCategoryPracticeBtn');
  const clearCategoryBtn = document.getElementById('libraryClearCategoryBtn');
  const itemList = document.getElementById('libraryItemList');
  const emptyHint = document.getElementById('libraryEmptyHint');

  if (!panel || !categoryList || !itemList) return;

  function now(){ return Date.now(); }

  function uid(){
    return `lib_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizeSource(source){
    const key = String(source || '').trim().toLowerCase();
    if (key === 'grammar' || key === 'tenses') return 'tenses';
    if (key === 'structure' || key === 'struct') return 'structure';
    if (key === 'wt' || key === 'word_transformation' || key === 'word transformation') return 'wt';
    return '';
  }

  function sourceLabel(source){
    if (source === 'tenses') return 'grammar';
    if (source === 'structure') return 'structure';
    if (source === 'wt') return 'word transformation';
    return source || 'unknown';
  }

  function normalizeItem(item){
    const source = normalizeSource(item && item.source);
    const id = String(item && item.id || '').trim();
    if (!source || !id) return null;
    return {
      source,
      id,
      title: String(item && item.title || id),
      subtitle: String(item && item.subtitle || ''),
      createdAt: Number(item && item.createdAt) || now()
    };
  }

  function normalizeCategory(cat){
    const id = String(cat && cat.id || '').trim() || uid();
    const name = String(cat && cat.name || '').trim();
    const itemsRaw = Array.isArray(cat && cat.items) ? cat.items : [];
    const seen = new Set();
    const items = [];
    for (const raw of itemsRaw){
      const item = normalizeItem(raw);
      if (!item) continue;
      const key = `${item.source}::${item.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
    return {
      id,
      name: name || 'категория',
      createdAt: Number(cat && cat.createdAt) || now(),
      items
    };
  }

  function normalizeState(raw){
    const src = raw && typeof raw === 'object' ? raw : {};
    const categoriesRaw = Array.isArray(src.categories) ? src.categories : [];
    const categories = categoriesRaw.map(normalizeCategory);
    const validIds = new Set(categories.map((x) => x.id));
    const selectedCategoryId = validIds.has(src.selectedCategoryId) ? src.selectedCategoryId : (categories[0] ? categories[0].id : '');
    return {
      version: 1,
      categories,
      selectedCategoryId
    };
  }

  function loadState(){
    try{
      return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
    }catch(_){
      return normalizeState({});
    }
  }

  let state = loadState();
  let itemQuery = '';
  let pickerModal = null;
  let pickerTitleEl = null;
  let pickerItemEl = null;
  let pickerListEl = null;
  let pickerNameInput = null;
  let pickerCreateBtn = null;
  let pickerCloseBtn = null;
  let pickerPendingItem = null;
  let pickerLastFocus = null;

  function saveState(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function setStatus(text){
    if (!statusEl) return;
    statusEl.textContent = text;
    if (text !== 'ready'){
      setTimeout(()=>{
        if (statusEl.textContent === text) statusEl.textContent = 'ready';
      }, 900);
    }
  }

  function totalItemsCount(){
    return state.categories.reduce((sum, cat)=> sum + (Array.isArray(cat.items) ? cat.items.length : 0), 0);
  }

  function selectedCategory(){
    const found = state.categories.find((x)=> x.id === state.selectedCategoryId);
    if (found) return found;
    return null;
  }

  function selectCategory(id){
    const key = String(id || '').trim();
    if (!key) return;
    if (!state.categories.some((x)=> x.id === key)) return;
    state.selectedCategoryId = key;
    saveState();
    render();
  }

  function ensureDefaultCategory(){
    if (state.categories.length) return state.categories[0];
    const cat = {
      id: uid(),
      name: 'основное',
      createdAt: now(),
      items: []
    };
    state.categories.push(cat);
    state.selectedCategoryId = cat.id;
    saveState();
    return cat;
  }

  function filteredItems(category){
    const q = String(itemQuery || '').trim().toLowerCase();
    if (!category) return [];
    if (!q) return category.items.slice();
    return category.items.filter((item)=>{
      const text = `${item.title} ${item.subtitle} ${sourceLabel(item.source)}`.toLowerCase();
      return text.includes(q);
    });
  }

  function dispatchOpen(item){
    const source = normalizeSource(item && item.source);
    if (!source) return;

    if (window.StudentHelperRoute && typeof window.StudentHelperRoute.go === 'function'){
      if (source === 'tenses') window.StudentHelperRoute.go('grammar');
      if (source === 'structure') window.StudentHelperRoute.go('grammar');
      if (source === 'wt') window.StudentHelperRoute.go('wt-rule');
    }

    if (source === 'structure' && window.StudentHelperTabs && typeof window.StudentHelperTabs.setMainTab === 'function'){
      window.StudentHelperTabs.setMainTab('struct');
    }
    if (source === 'tenses' && window.StudentHelperTabs && typeof window.StudentHelperTabs.setMainTab === 'function'){
      window.StudentHelperTabs.setMainTab('tenses');
    }

    setTimeout(()=>{
      document.dispatchEvent(new CustomEvent('sh:library-open', {
        detail: {
          source,
          id: String(item.id || '')
        }
      }));
    }, 0);
  }

  function dispatchPractice(source, ids){
    const src = normalizeSource(source);
    const uniq = [];
    const seen = new Set();
    for (const raw of (Array.isArray(ids) ? ids : [])){
      const id = String(raw || '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      uniq.push(id);
    }
    if (!src || !uniq.length) return;

    if (window.StudentHelperRoute && typeof window.StudentHelperRoute.go === 'function'){
      if (src === 'tenses') window.StudentHelperRoute.go('grammar');
      if (src === 'structure') window.StudentHelperRoute.go('grammar');
      if (src === 'wt') window.StudentHelperRoute.go('wt-practice');
    }

    if (src === 'structure' && window.StudentHelperTabs && typeof window.StudentHelperTabs.setMainTab === 'function'){
      window.StudentHelperTabs.setMainTab('struct');
    }
    if (src === 'tenses' && window.StudentHelperTabs && typeof window.StudentHelperTabs.setMainTab === 'function'){
      window.StudentHelperTabs.setMainTab('tenses');
    }

    setTimeout(()=>{
      document.dispatchEvent(new CustomEvent('sh:library-practice', {
        detail: {
          source: src,
          ids: uniq,
          autoStart: true
        }
      }));
    }, 0);
  }

  function startPracticeForCategory(){
    const category = selectedCategory();
    if (!category || !category.items.length){
      setStatus('пусто');
      return;
    }

    const grouped = {
      tenses: [],
      structure: [],
      wt: []
    };
    for (const item of category.items){
      const src = normalizeSource(item.source);
      if (!src || !grouped[src]) continue;
      grouped[src].push(item.id);
    }

    if (grouped.tenses.length){
      dispatchPractice('tenses', grouped.tenses);
      return;
    }
    if (grouped.structure.length){
      dispatchPractice('structure', grouped.structure);
      return;
    }
    if (grouped.wt.length){
      dispatchPractice('wt', grouped.wt);
      return;
    }

    setStatus('нет правил');
  }

  function removeItem(categoryId, source, id){
    const cat = state.categories.find((x)=> x.id === categoryId);
    if (!cat) return;
    const before = cat.items.length;
    cat.items = cat.items.filter((item)=> !(item.source === source && item.id === id));
    if (cat.items.length === before) return;
    saveState();
    render();
    setStatus('удалено');
  }

  function renderCategories(){
    categoryList.innerHTML = '';
    for (const cat of state.categories){
      const li = document.createElement('li');
      li.className = 'sh-library-category-item';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ik-btn sh-library-category-btn';
      if (cat.id === state.selectedCategoryId) btn.classList.add('ik-btn--black');
      btn.innerHTML = `${escapeHtml(cat.name)} <span class="sh-library-cat-count">${cat.items.length}</span>`;
      btn.addEventListener('click', ()=> selectCategory(cat.id));

      li.appendChild(btn);
      categoryList.appendChild(li);
    }
  }

  function renderItems(){
    itemList.innerHTML = '';
    const cat = selectedCategory();
    const title = cat ? `категория: ${cat.name}` : 'категория: -';
    if (activeCategoryTitle) activeCategoryTitle.textContent = title;

    const rows = filteredItems(cat);
    if (!rows.length){
      if (emptyHint) emptyHint.hidden = false;
      return;
    }
    if (emptyHint) emptyHint.hidden = true;

    for (const item of rows){
      const li = document.createElement('li');
      li.className = 'sh-topic-row';

      const left = document.createElement('div');
      left.innerHTML = `<p class="ik-itemline"><b>${escapeHtml(item.title)}</b></p>
        <p class="ik-itemline ik-muted">${escapeHtml(sourceLabel(item.source))}${item.subtitle ? ` • ${escapeHtml(item.subtitle)}` : ''}</p>`;

      const right = document.createElement('div');
      right.className = 'ik-mini';

      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'ik-btn ik-btn--black';
      openBtn.textContent = 'open';
      openBtn.addEventListener('click', ()=> dispatchOpen(item));

      const practiceBtn = document.createElement('button');
      practiceBtn.type = 'button';
      practiceBtn.className = 'ik-btn';
      practiceBtn.textContent = 'practice';
      practiceBtn.addEventListener('click', ()=> dispatchPractice(item.source, [item.id]));

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'ik-btn';
      removeBtn.textContent = 'remove';
      removeBtn.addEventListener('click', ()=> removeItem(cat.id, item.source, item.id));

      right.appendChild(openBtn);
      right.appendChild(practiceBtn);
      right.appendChild(removeBtn);

      li.appendChild(left);
      li.appendChild(right);
      itemList.appendChild(li);
    }
  }

  function render(){
    if (countBadge) countBadge.textContent = `library: ${totalItemsCount()}`;
    if (!state.selectedCategoryId && state.categories[0]) state.selectedCategoryId = state.categories[0].id;
    renderCategories();
    renderItems();
    if (renameCategoryBtn) renameCategoryBtn.disabled = !selectedCategory();
    if (deleteCategoryBtn) deleteCategoryBtn.disabled = !selectedCategory();
    if (startCategoryPracticeBtn) startCategoryPracticeBtn.disabled = !selectedCategory() || !selectedCategory().items.length;
    if (clearCategoryBtn) clearCategoryBtn.disabled = !selectedCategory() || !selectedCategory().items.length;
  }

  function normalizeCategoryName(name){
    return String(name || '').trim();
  }

  function findCategoryByName(rawName){
    const name = normalizeCategoryName(rawName).toLowerCase();
    if (!name) return null;
    for (const cat of state.categories){
      if (String(cat && cat.name || '').trim().toLowerCase() === name) return cat;
    }
    return null;
  }

  function createCategory(rawName, options){
    const opts = options || {};
    const name = normalizeCategoryName(rawName);
    if (!name){
      if (!opts.silentStatus) setStatus('без имени');
      return null;
    }

    const existing = findCategoryByName(name);
    if (existing){
      state.selectedCategoryId = existing.id;
      saveState();
      render();
      if (!opts.silentStatus) setStatus('уже есть');
      return existing;
    }

    const cat = {
      id: uid(),
      name,
      createdAt: now(),
      items: []
    };
    state.categories.push(cat);
    state.selectedCategoryId = cat.id;
    saveState();
    render();
    if (!opts.silentStatus) setStatus('создано');
    return cat;
  }

  function setPickerCreateState(){
    if (!pickerCreateBtn || !pickerNameInput) return;
    pickerCreateBtn.disabled = !normalizeCategoryName(pickerNameInput.value);
  }

  function closePickerModal(){
    if (!pickerModal || pickerModal.hidden) return;
    pickerModal.hidden = true;
    pickerPendingItem = null;
    document.documentElement.classList.remove('sh-library-picker-open');
    document.body.classList.remove('sh-library-picker-open');
    if (pickerLastFocus && typeof pickerLastFocus.focus === 'function'){
      pickerLastFocus.focus({ preventScroll: true });
    }
    pickerLastFocus = null;
  }

  function applyPickerCategory(category){
    if (!pickerPendingItem || !category) return;
    const result = quickAdd(pickerPendingItem, { categoryId: category.id, silentStatus: true });
    if (result && result.ok){
      const tail = category.name ? `: ${category.name}` : '';
      setStatus(result.added ? `добавлено${tail}` : `уже есть${tail}`);
    }
    closePickerModal();
  }

  function renderPickerCategories(){
    if (!pickerListEl) return;
    pickerListEl.innerHTML = '';
    const categories = state.categories.slice();
    for (const cat of categories){
      const li = document.createElement('li');

      const left = document.createElement('div');
      left.innerHTML = `<p class="ik-itemline"><b>${escapeHtml(cat.name)}</b></p>
        <p class="ik-itemline ik-muted">правил: ${Array.isArray(cat.items) ? cat.items.length : 0}</p>`;

      const right = document.createElement('div');
      right.className = 'ik-mini';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ik-btn';
      btn.textContent = 'добавить';
      if (cat.id === state.selectedCategoryId) btn.classList.add('ik-btn--black');
      btn.addEventListener('click', ()=> applyPickerCategory(cat));

      right.appendChild(btn);
      li.appendChild(left);
      li.appendChild(right);
      pickerListEl.appendChild(li);
    }
  }

  function ensurePickerModal(){
    if (pickerModal) return;

    pickerModal = document.createElement('div');
    pickerModal.className = 'sh-library-picker';
    pickerModal.hidden = true;
    pickerModal.innerHTML = `
      <section class="sh-library-picker__panel" role="dialog" aria-modal="true" aria-label="Выбор категории библиотеки">
        <div class="sh-library-picker__head">
          <p class="ik-title" id="libraryPickerTitle">куда добавить правило</p>
          <button class="ik-btn" id="libraryPickerCloseBtn" type="button">закрыть</button>
        </div>
        <div class="sh-library-picker__body">
          <p class="ik-sub" id="libraryPickerItemLine">—</p>
          <ul class="ik-list sh-library-picker__list" id="libraryPickerList" aria-label="Категории для добавления"></ul>
          <div class="ik-row sh-library-picker__new-row">
            <input class="ik-input" id="libraryPickerNameInput" type="text" autocomplete="off" spellcheck="false" placeholder="или новая категория" />
            <button class="ik-btn ik-btn--black" id="libraryPickerCreateBtn" type="button">создать и добавить</button>
          </div>
          <p class="ik-footnote">выбери существующую категорию или введи новую</p>
        </div>
      </section>
    `;
    document.body.appendChild(pickerModal);

    pickerTitleEl = pickerModal.querySelector('#libraryPickerTitle');
    pickerItemEl = pickerModal.querySelector('#libraryPickerItemLine');
    pickerListEl = pickerModal.querySelector('#libraryPickerList');
    pickerNameInput = pickerModal.querySelector('#libraryPickerNameInput');
    pickerCreateBtn = pickerModal.querySelector('#libraryPickerCreateBtn');
    pickerCloseBtn = pickerModal.querySelector('#libraryPickerCloseBtn');

    pickerCloseBtn && pickerCloseBtn.addEventListener('click', closePickerModal);
    pickerModal.addEventListener('click', (e)=>{
      if (e.target === pickerModal) closePickerModal();
    });

    pickerNameInput && pickerNameInput.addEventListener('input', setPickerCreateState);
    pickerNameInput && pickerNameInput.addEventListener('keydown', (e)=>{
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (pickerCreateBtn) pickerCreateBtn.click();
    });

    pickerCreateBtn && pickerCreateBtn.addEventListener('click', ()=>{
      if (!pickerPendingItem) return;
      const cat = createCategory(pickerNameInput ? pickerNameInput.value : '', { silentStatus: true });
      if (!cat){
        pickerNameInput && pickerNameInput.focus();
        return;
      }
      applyPickerCategory(cat);
    });

    document.addEventListener('keydown', (e)=>{
      if (e.key !== 'Escape') return;
      if (!pickerModal || pickerModal.hidden) return;
      e.preventDefault();
      closePickerModal();
    });
  }

  function openPickerModal(item, options){
    const opts = options || {};
    ensureDefaultCategory();
    ensurePickerModal();
    if (!pickerModal) return;

    pickerPendingItem = item;
    pickerLastFocus = document.activeElement;

    if (pickerTitleEl) pickerTitleEl.textContent = String(opts.promptTitle || 'куда добавить правило');
    if (pickerItemEl){
      const source = sourceLabel(item.source);
      pickerItemEl.innerHTML = `<b>${escapeHtml(item.title || item.id)}</b> • ${escapeHtml(source)}`;
    }
    if (pickerNameInput) pickerNameInput.value = '';

    renderPickerCategories();
    setPickerCreateState();

    pickerModal.hidden = false;
    document.documentElement.classList.add('sh-library-picker-open');
    document.body.classList.add('sh-library-picker-open');

    if (pickerNameInput){
      setTimeout(()=>{ pickerNameInput.focus(); }, 0);
    }
  }

  function addCategory(rawName){
    const cat = createCategory(rawName);
    if (!cat) return;
    if (newCategoryInput) newCategoryInput.value = '';
  }

  function renameCurrentCategory(){
    const cat = selectedCategory();
    if (!cat) return;
    const next = prompt('Новое имя категории', cat.name || '');
    if (next == null) return;
    const name = String(next || '').trim();
    if (!name){
      setStatus('без имени');
      return;
    }
    cat.name = name;
    saveState();
    render();
    setStatus('переименовано');
  }

  function deleteCurrentCategory(){
    const cat = selectedCategory();
    if (!cat) return;
    const ok = confirm(`Удалить категорию "${cat.name}"?`);
    if (!ok) return;
    state.categories = state.categories.filter((x)=> x.id !== cat.id);
    state.selectedCategoryId = state.categories[0] ? state.categories[0].id : '';
    saveState();
    render();
    setStatus('удалено');
  }

  function clearCurrentCategory(){
    const cat = selectedCategory();
    if (!cat || !cat.items.length) return;
    const ok = confirm(`Очистить категорию "${cat.name}"?`);
    if (!ok) return;
    cat.items = [];
    saveState();
    render();
    setStatus('очищено');
  }

  function quickAdd(rawItem, options){
    const item = normalizeItem(rawItem);
    if (!item) return { ok: false, error: 'invalid_item' };
    ensureDefaultCategory();

    const opts = options || {};
    const silentStatus = !!opts.silentStatus;
    const targetId = String(opts.categoryId || state.selectedCategoryId || '').trim();
    const cat = state.categories.find((x)=> x.id === targetId) || state.categories[0];
    if (!cat) return { ok: false, error: 'no_category' };

    const exists = cat.items.some((x)=> x.source === item.source && x.id === item.id);
    if (exists){
      state.selectedCategoryId = cat.id;
      saveState();
      render();
      if (!silentStatus) setStatus('уже есть');
      return { ok: true, added: false, categoryId: cat.id };
    }

    cat.items.unshift(item);
    state.selectedCategoryId = cat.id;
    saveState();
    render();
    if (!silentStatus) setStatus('добавлено');
    return { ok: true, added: true, categoryId: cat.id };
  }

  function quickAddWithPicker(rawItem, options){
    const item = normalizeItem(rawItem);
    if (!item) return { ok: false, error: 'invalid_item' };
    openPickerModal(item, options || {});
    return { ok: true, pending: true };
  }

  addCategoryBtn && addCategoryBtn.addEventListener('click', ()=> addCategory(newCategoryInput && newCategoryInput.value));
  newCategoryInput && newCategoryInput.addEventListener('keydown', (e)=>{
    if (e.key !== 'Enter') return;
    e.preventDefault();
    addCategory(newCategoryInput.value);
  });
  renameCategoryBtn && renameCategoryBtn.addEventListener('click', renameCurrentCategory);
  deleteCategoryBtn && deleteCategoryBtn.addEventListener('click', deleteCurrentCategory);
  clearCategoryBtn && clearCategoryBtn.addEventListener('click', clearCurrentCategory);
  startCategoryPracticeBtn && startCategoryPracticeBtn.addEventListener('click', startPracticeForCategory);
  itemSearchInput && itemSearchInput.addEventListener('input', ()=>{
    itemQuery = String(itemSearchInput.value || '');
    renderItems();
  });

  window.StudentHelperLibrary = {
    quickAdd,
    quickAddWithPicker,
    ensureDefaultCategory,
    getState: ()=> JSON.parse(JSON.stringify(state)),
    selectCategory
  };

  render();

  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, (m)=>({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }
})();
