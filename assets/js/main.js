// Небольшой “живой” штрих: подсветка активной страницы и мягкий звук/эффект можно добавить позже.
(() => {
  const normalizePath = (raw) => {
    const p = String(raw || "").trim().toLowerCase();
    if (!p || p === "/") return "index";
    const clean = p.replace(/^\/+/, "").replace(/\/+$/, "");
    if (!clean || clean === "index" || clean === "index.html") return "index";
    return clean.replace(/\.html$/i, "");
  };

  const path = normalizePath(location.pathname);

  const links = document.querySelectorAll("a[href]");
  links.forEach(a => {
    const hrefRaw = (a.getAttribute("href") || "").trim();
    if (!hrefRaw || hrefRaw.startsWith("#") || /^https?:/i.test(hrefRaw) || /^mailto:/i.test(hrefRaw) || /^tel:/i.test(hrefRaw)) return;
    let hrefPath = hrefRaw;
    try {
      hrefPath = new URL(hrefRaw, location.href).pathname;
    } catch (_) {}
    const href = normalizePath(hrefPath);
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

  // Ищем ссылку в шапке на item-user (legacy .html and canonical)
  const userLink = document.querySelector('a.toplink[href*="item-user"]');
  if (!userLink) return;

  const tag = userLink.querySelector(".tag");
  if (!tag) return;

  const setTag = (name) => {
    if (name) {
      tag.textContent = `item-user · @${name}`;
      userLink.setAttribute("aria-label", `Item User ${name}`);
      return;
    }
    tag.textContent = "item-user";
    userLink.setAttribute("aria-label", "Item User");
  };

  setTag(current && current.name ? current.name : "");

  if (!(window.IKSupabase && window.IKSupabase.getClient)) return;
  const supa = window.IKSupabase.getClient();
  if (!supa) return;

  supa.auth.getUser().then(({ data, error }) => {
    if (error || !data || !data.user) return;
    const user = data.user;
    const meta = user.user_metadata || {};
    const name = String(meta.nickname || meta.username || meta.login || "").trim() || String(user.email || "").split("@")[0] || "";
    setTag(name);
  }).catch(() => {});
})();

