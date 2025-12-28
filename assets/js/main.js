// Небольшой “живой” штрих: подсветка активной страницы и мягкий звук/эффект можно добавить позже.
(() => {
  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();

  const links = document.querySelectorAll("a[href]");
  links.forEach(a => {
    const href = (a.getAttribute("href") || "").toLowerCase();
    if (href === path) a.classList.add("is-active");
  });
})();

(() => {
  const canvas = document.getElementById("logoCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  // === НАСТРОЙКИ СЕКВЕНЦИИ ===
 const SEQ = {
  // поставь реальное число кадров, которое у тебя есть
  frameCount: 120,

  // logo01_00001.png ... logo01_00120.png
  makeSrc: (i) => `assets/img/logo_seq/logo01_${String(i).padStart(5, "0")}.png`,

  fps: 24,
  loop: true,
};


  // === НАСТРОЙКИ ГЛИТЧА (дорого, не “дешёвый мем”) ===
  const GLITCH = {
    // шанс “события” на кадр
    eventChance: 0.07,
    // интенсивность сдвига каналов
    rgbShift: 10,
    // количество “срезов”
    slicesMin: 2,
    slicesMax: 7,
    // вертикальное дрожание
    jitterY: 2,
    // редкие сильные провалы
    hardDropChance: 0.01,
  };

  // ресайз canvas под CSS size
  function fitCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * DPR);
    canvas.height = Math.round(rect.height * DPR);
  }
  fitCanvas();
  window.addEventListener("resize", fitCanvas);

  // preload frames
  const frames = new Array(SEQ.frameCount);
  let loaded = 0;
  let ready = false;

  function loadFrame(i) {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = SEQ.makeSrc(i + 1);
    });
  }

  (async () => {
    // грузим последовательно, чтобы не убить память
    for (let i = 0; i < SEQ.frameCount; i++) {
      frames[i] = await loadFrame(i);
      if (frames[i]) loaded++;
    }
    ready = loaded > 0;
  })();

  // helpers
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));

  function drawContain(img) {
    const cw = canvas.width, ch = canvas.height;
    ctx.clearRect(0, 0, cw, ch);

    // фон прозрачный, но можно оставить “бумажность” через CSS тела
    if (!img) return;

    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;

    const scale = Math.min(cw / iw, ch / ih);
    const w = Math.round(iw * scale);
    const h = Math.round(ih * scale);
    const x = Math.round((cw - w) / 2);
    const y = Math.round((ch - h) / 2);

    ctx.drawImage(img, x, y, w, h);
  }

  function glitchPass() {
    const cw = canvas.width, ch = canvas.height;

    // редкий “жёсткий провал”
    const hardDrop = Math.random() < GLITCH.hardDropChance;
    const doEvent = hardDrop || Math.random() < GLITCH.eventChance;

    if (!doEvent) {
      // микродрожание очень мягко
      const jy = (Math.random() - 0.5) * GLITCH.jitterY;
      if (Math.abs(jy) > 0.2) {
        const imgData = ctx.getImageData(0, 0, cw, ch);
        ctx.clearRect(0, 0, cw, ch);
        ctx.putImageData(imgData, 0, jy);
      }
      return;
    }

    // базовый снимок
    const base = ctx.getImageData(0, 0, cw, ch);

    // “scanlines” лёгкие
    ctx.save();
    ctx.globalAlpha = hardDrop ? 0.18 : 0.08;
    for (let y = 0; y < ch; y += randi(6, 10)) {
      ctx.fillStyle = "rgba(0,0,0,1)";
      ctx.fillRect(0, y, cw, 1);
    }
    ctx.restore();

    // RGB shift (дорого: чуть-чуть, не кислотно)
    const shift = hardDrop ? GLITCH.rgbShift * 2 : GLITCH.rgbShift;
    const dxR = randi(-shift, shift);
    const dxB = randi(-shift, shift);

    ctx.clearRect(0, 0, cw, ch);

    // рисуем base как слой
    ctx.putImageData(base, 0, 0);

    // “каналы” имитируем смещением копий с небольшой прозрачностью
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = hardDrop ? 0.55 : 0.28;
    ctx.drawImage(canvas, dxR, 0);
    ctx.globalAlpha = hardDrop ? 0.45 : 0.22;
    ctx.drawImage(canvas, dxB, 0);
    ctx.restore();

    // СЛАЙСЫ (разрезы по горизонтали)
    const slices = randi(GLITCH.slicesMin, GLITCH.slicesMax) * (hardDrop ? 2 : 1);

    for (let i = 0; i < slices; i++) {
      const sh = randi(10, Math.max(18, Math.floor(ch * 0.10)));
      const sy = randi(0, ch - sh);
      const sx = 0;

      const offset = randi(-Math.floor(cw * 0.08), Math.floor(cw * 0.08)) * (hardDrop ? 2 : 1);
      const slice = ctx.getImageData(sx, sy, cw, sh);

      ctx.putImageData(slice, offset, sy);

      // тонкая “трещина”
      ctx.save();
      ctx.globalAlpha = hardDrop ? 0.25 : 0.12;
      ctx.fillStyle = "rgba(0,0,0,1)";
      ctx.fillRect(0, sy + randi(0, sh), cw, 1);
      ctx.restore();
    }

    // “архивный выпад” — чуть выцветания
    if (hardDrop) {
      ctx.save();
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = "rgba(255,255,255,1)";
      ctx.fillRect(0, 0, cw, ch);
      ctx.restore();
    }
  }

  // playback
  let frame = 0;
  let last = performance.now();
  const frameMS = 1000 / SEQ.fps;

  function tick(now) {
    requestAnimationFrame(tick);

    if (!ready) {
      // запасной вариант: пока кадры не готовы — статичное лого
      // (можно оставить пустым)
      return;
    }

    if (now - last < frameMS) return;
    last = now;

    const img = frames[frame] || frames.find(Boolean);
    drawContain(img);
    glitchPass();

    frame++;
    if (frame >= SEQ.frameCount) frame = SEQ.loop ? 0 : SEQ.frameCount - 1;
  }

  requestAnimationFrame(tick);
})();


/* =========================


/* =========================
   ITEM-MANUFACTURE STORE
   - Дом: только вступление (без подкатегорий)
   - item / guests: витрина + кнопка "add clothing"
   - карточка: в сетке только фото+название+цена, остальное при раскрытии
   - "база": seed-файл assets/js/item-manufacture.db.json + localStorage
   ========================= */

(() => {
  if (!document.body.classList.contains("page-manufacture")) return;

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // UI
  const tabButtons = $$(".tab");
  const chipWrap = $("#sectionChips");
  const chipButtons = $$(".chip");
  const searchInput = $("#shopSearch");
  const currencySelect = $("#currencySelect");

  const homePanel = $("#homePanel");
  const grid = $("#productGrid");

  const toolbar = $("#marketToolbar");
  const scopePill = $("#marketScope");
  const addClothBtn = $("#addClothBtn");
  const saveDbBtn = $("#saveDbBtn");

  const goItem = $("#goItem");
  const goGuests = $("#goGuests");

  // Cart UI
  const cart = $("#cart");
  const cartOpen = $("#cartOpen");
  const cartClose = $("#cartClose");
  const cartList = $("#cartList");
  const cartCount = $("#cartCount");
  const cartTotal = $("#cartTotal");

  // Modal UI
  const modal = $("#clothModal");
  const modalClose = $("#clothClose");
  const form = $("#clothForm");
  const ownerHidden = $("#clothOwner");

  const exportDbBtn = $("#exportDbBtn");
  const importDbInput = $("#importDbInput");
  const clearDbBtn = $("#clearDbBtn");

  // Stats (optional)
  const statTotal = $("#statTotal");
  const statItem = $("#statItem");
  const statGuests = $("#statGuests");

  // Keys
  const KEY_PRODUCTS = "itemkey.manufacture.products.v3";
  const KEY_CART = "itemkey.manufacture.cart.v3";
  const KEY_CURRENCY = "itemkey.manufacture.currency.v3";
  const SEED_URL = "assets/js/item-manufacture.db.json";

  const state = {
    tab: "home",        // home | item | guests
    section: "all",
    query: "",
    openCardId: null,
    currency: "BYN",
    // временные курсы (потом подключим реальные)
    rates: { BYN: 1, USD: 0.31, EUR: 0.29, RUB: 29.0 },
    products: [],
    cart: []
  };

  function uid(){
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }
  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }
  function normCat(c){
    return (c || "").trim().toLowerCase() || "другое";
  }

  function loadJSON(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    }catch{ return fallback; }
  }
  function saveJSON(key, value){
    localStorage.setItem(key, JSON.stringify(value));
  }
  function persist(){
    saveJSON(KEY_PRODUCTS, state.products);
    saveJSON(KEY_CART, state.cart);
    saveJSON(KEY_CURRENCY, state.currency);
  }

  function money(amountBYN){
    const cur = state.currency;
    const rate = state.rates[cur] ?? 1;
    const v = amountBYN * rate;
    const fmt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: cur==="RUB"?0:2 });
    return `${fmt.format(v)} ${cur}`;
  }

  async function loadProducts(){
    const existing = loadJSON(KEY_PRODUCTS, null);
    if (Array.isArray(existing)) return existing;

    // пробуем seed
    try{
      const res = await fetch(SEED_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("seed not found");
      const data = await res.json();
      if (Array.isArray(data)) {
        saveJSON(KEY_PRODUCTS, data);
        return data;
      }
    }catch{
      // ignore
    }
    return [];
  }

  function setTab(tab){
    state.tab = tab;
    state.openCardId = null;

    tabButtons.forEach(b => b.setAttribute("aria-selected", b.dataset.tab === tab ? "true" : "false"));

    // Дом: скрываем подкатегории и тулбар
    const isHome = (tab === "home");

    if (homePanel) homePanel.style.display = isHome ? "block" : "none";
    if (chipWrap) {
      chipWrap.style.display = isHome ? "none" : "flex";
      chipWrap.dataset.hidden = isHome ? "true" : "false";
    }
    if (toolbar) toolbar.style.display = isHome ? "none" : "flex";

    if (scopePill) scopePill.textContent = `scope: ${tab}`;
    if (ownerHidden) ownerHidden.value = tab;

    render();
  }

  function setSection(cat){
    state.section = cat;
    state.openCardId = null;
    chipButtons.forEach(c => c.dataset.active = (c.dataset.cat === cat) ? "true" : "false");
    render();
  }

  function filtered(){
    const q = state.query.trim().toLowerCase();
    return state.products
      .filter(p => state.tab === "home" ? false : (p.owner === state.tab))
      .filter(p => state.section === "all" ? true : normCat(p.category) === normCat(state.section))
      .filter(p => {
        if (!q) return true;
        const hay = `${p.name} ${p.desc} ${p.category}`.toLowerCase();
        return hay.includes(q);
      });
  }

  function renderStats(){
    if (!statTotal) return;
    const total = state.products.length;
    const item = state.products.filter(p => p.owner === "item").length;
    const guests = state.products.filter(p => p.owner === "guests").length;
    statTotal.textContent = String(total);
    statItem.textContent = String(item);
    statGuests.textContent = String(guests);
  }

  function cardHTML(p, open){
    const img = p.image
      ? `<img src="${p.image}" alt="${esc(p.name)}">`
      : `<div class="placeholder">image</div>`;

    // summary always visible: фото + название + цена
    return `
      <article class="card ${open ? "card--open" : "card--summary"}" data-id="${p.id}">
        <div class="card__media">${img}</div>
        <div class="card__body">
          <div class="card__top">
            <h3 class="card__name">${esc(p.name)}</h3>
            <div class="card__price">${money(p.priceBYN)}</div>
          </div>

          <p class="card__desc">${esc(p.desc || "")}</p>

          <div class="card__actions">
            <button class="btn btn--primary" data-act="add">add to cart</button>
            <button class="btn" data-act="close">close</button>
          </div>
        </div>
      </article>
    `;
  }

  function renderGrid(){
    if (!grid) return;

    if (state.tab === "home"){
      grid.innerHTML = "";
      return;
    }

    const list = filtered();

    if (!list.length){
      grid.innerHTML = `
        <div class="empty">
          <b>пока пусто</b>
          нажми <u>add clothing</u> и создай первую карточку.
        </div>
      `;
      return;
    }

    grid.innerHTML = list.map(p => cardHTML(p, state.openCardId === p.id)).join("");
  }

  // Cart
  function openCart(on){
    if (!cart) return;
    cart.dataset.open = on ? "true" : "false";
  }
  function cartQty(){
    return state.cart.reduce((s, x) => s + x.qty, 0);
  }
  function renderCart(){
    if (!cartCount || !cartList || !cartTotal) return;
    cartCount.textContent = String(cartQty());

    if (!state.cart.length){
      cartList.innerHTML = `<div class="helper">Корзина пуста.</div>`;
      cartTotal.textContent = money(0);
      return;
    }

    cartList.innerHTML = state.cart.map(it => {
      const p = state.products.find(x => x.id === it.id);
      if (!p) return "";
      return `
        <div class="cart-item" data-id="${it.id}">
          <div>
            <div class="cart-item__name">${esc(p.name)}</div>
            <div class="cart-item__meta">${money(p.priceBYN)} · ${esc(p.category || "—")}</div>
          </div>
          <div class="cart-item__qty">
            <button class="qtybtn" data-q="dec">−</button>
            <div>${it.qty}</div>
            <button class="qtybtn" data-q="inc">+</button>
          </div>
        </div>
      `;
    }).join("");

    const totalBYN = state.cart.reduce((sum, it) => {
      const p = state.products.find(x => x.id === it.id);
      return sum + (p ? p.priceBYN * it.qty : 0);
    }, 0);

    cartTotal.textContent = money(totalBYN);
  }

  function addToCart(id){
    const it = state.cart.find(x => x.id === id);
    if (it) it.qty += 1;
    else state.cart.push({ id, qty: 1 });
    persist();
    renderCart();
  }

  function adjustQty(id, delta){
    const it = state.cart.find(x => x.id === id);
    if (!it) return;
    it.qty += delta;
    if (it.qty <= 0) state.cart = state.cart.filter(x => x.id !== id);
    persist();
    renderCart();
  }

  // Modal
  function openModal(on){
    if (!modal) return;
    modal.dataset.open = on ? "true" : "false";
    modal.setAttribute("aria-hidden", on ? "false" : "true");
  }

  function readFileAsDataURL(file){
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  async function onPublish(e){
    e.preventDefault();

    const fd = new FormData(form);
    const owner = String(fd.get("owner") || state.tab || "item");
    const category = String(fd.get("category") || "другое").trim() || "другое";
    const name = String(fd.get("name") || "").trim();
    const desc = String(fd.get("desc") || "").trim();
    const priceBYN = Number(String(fd.get("price") || "0").replace(",", "."));

    if (!name || !Number.isFinite(priceBYN) || priceBYN <= 0){
      alert("Заполни название и цену (числом).");
      return;
    }

    let image = String(fd.get("imageUrl") || "").trim();
    const file = form.querySelector('input[name="imageFile"]')?.files?.[0];
    if (file){
      try{ image = await readFileAsDataURL(file); }catch{}
    }

    const product = {
      id: uid(),
      owner: owner === "guests" ? "guests" : "item",
      category,
      name,
      priceBYN,
      image,
      desc,
      createdAt: Date.now()
    };

    state.products.unshift(product);
    persist();

    // сброс и закрыть
    form.reset();
    ownerHidden.value = state.tab;
    openModal(false);

    // показать в текущей вкладке и раскрыть карточку
    state.openCardId = product.id;
    render();
  }

  // Save DB to file: try File System Access API, else download
  async function saveDbToFile(){
    const json = JSON.stringify(state.products, null, 2);

    // 1) File System Access API (Chromium)
    try{
      if (window.showSaveFilePicker){
        const handle = await window.showSaveFilePicker({
          suggestedName: "item-manufacture.db.json",
          types: [{ description: "JSON", accept: { "application/json": [".json"] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        alert("DB сохранена в файл.");
        return;
      }
    }catch{
      // ignore and fallback
    }

    // 2) Fallback: download
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "item-manufacture.db.json";
    a.click();
    URL.revokeObjectURL(a.href);
    alert("DB скачана. Положи файл в assets/js/ и замени старый.");
  }

  function exportDb(){
    const blob = new Blob([JSON.stringify(state.products, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "item-manufacture.db.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importDb(file){
    const txt = await file.text();
    const data = JSON.parse(txt);
    if (!Array.isArray(data)) throw new Error("bad db");
    state.products = data.map(x => ({
      id: String(x.id || uid()),
      owner: (x.owner === "guests") ? "guests" : "item",
      category: String(x.category || "другое"),
      name: String(x.name || "Untitled"),
      priceBYN: Number(x.priceBYN || 0),
      image: String(x.image || ""),
      desc: String(x.desc || ""),
      createdAt: Number(x.createdAt || Date.now())
    }));
    state.openCardId = null;
    persist();
    render();
    alert("DB импортирована.");
  }

  function clearAll(){
    if (!confirm("Очистить все карточки?")) return;
    state.products = [];
    state.cart = [];
    state.openCardId = null;
    persist();
    render();
    renderCart();
  }

  function render(){
    renderGrid();
    renderCart();
    renderStats();
    if (currencySelect) currencySelect.value = state.currency;
  }

  // ===== Events wiring =====
  tabButtons.forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));

  chipButtons.forEach(c => c.addEventListener("click", () => setSection(c.dataset.cat)));

  if (searchInput){
    searchInput.addEventListener("input", (e) => {
      state.query = e.target.value || "";
      state.openCardId = null;
      render();
    });
  }

  if (currencySelect){
    currencySelect.addEventListener("change", (e) => {
      state.currency = e.target.value;
      persist();
      render();
    });
  }

  cartOpen?.addEventListener("click", () => openCart(true));
  cartClose?.addEventListener("click", () => openCart(false));

  cart?.addEventListener("click", (e) => {
    const btn = e.target.closest(".qtybtn");
    if (!btn) return;
    const row = e.target.closest(".cart-item");
    if (!row) return;
    adjustQty(row.dataset.id, btn.dataset.q === "inc" ? 1 : -1);
  });

  // Card click: open/close + add to cart
  grid?.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;
    const id = card.dataset.id;

    const act = e.target.dataset.act;
    if (act === "add"){
      e.stopPropagation();
      addToCart(id);
      return;
    }
    if (act === "close"){
      e.stopPropagation();
      state.openCardId = null;
      render();
      return;
    }

    // toggle open
    state.openCardId = (state.openCardId === id) ? null : id;
    render();
  });

  // Add clothing button (must exist in item/guests)
  addClothBtn?.addEventListener("click", () => {
    if (state.tab === "home") return;
    ownerHidden.value = state.tab;
    openModal(true);
  });

  saveDbBtn?.addEventListener("click", saveDbToFile);

  modalClose?.addEventListener("click", () => openModal(false));
  modal?.addEventListener("click", (e) => { if (e.target === modal) openModal(false); });

  form?.addEventListener("submit", onPublish);

  exportDbBtn?.addEventListener("click", exportDb);
  importDbInput?.addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try{ await importDb(f); }catch{ alert("Ошибка импорта."); }
    importDbInput.value = "";
  });
  clearDbBtn?.addEventListener("click", clearAll);

  goItem?.addEventListener("click", () => setTab("item"));
  goGuests?.addEventListener("click", () => setTab("guests"));

  // ===== init =====
  state.cart = loadJSON(KEY_CART, []);
  state.currency = loadJSON(KEY_CURRENCY, "BYN") || "BYN";

  (async () => {
    state.products = await loadProducts();
    // старт — Дом, без подкатегорий и тулбара
    setTab("home");
  })();
})();
/* =========================
   ITEM-USER HEADER LABEL
   показывает @login когда пользователь вошёл
   ========================= */
(() => {
  const CURRENT_KEY = "itemkey.currentUser";

  let current = null;
  try {
    current = JSON.parse(localStorage.getItem(CURRENT_KEY) || "null");
  } catch {
    current = null;
  }

  // Ищем ссылку в шапке на item-user.html (есть на всех твоих страницах)
  const userLink = document.querySelector('a.toplink[href="item-user.html"]');
  if (!userLink) return;

  const tag = userLink.querySelector(".tag");
  if (!tag) return;

  if (current && current.name) {
    tag.textContent = `item-user · @${current.name}`;
    userLink.setAttribute("aria-label", `Item User ${current.name}`);
  } else {
    tag.textContent = "item-user";
    userLink.setAttribute("aria-label", "Item User");
  }
})();

