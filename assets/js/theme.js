(() => {
  const STORAGE_KEY = "ik_site_theme_v1";
  const DARK = "dark";
  const LIGHT = "light";
  const PANEL_SELECTOR = "#ikSiteSettingsPanel";
  const FAB_ID = "ikThemeFab";
  const ADMIN_EMAILS = ["itemkeygithub@gmail.com", "kravetznikita@gmail.com"];
  const SUPABASE_SDK_SRC = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  const ACCOUNT_LINK_STYLE_ID = "ikAccountLinksStyle";
  const LOADING_ATTR = "data-ik-loading";
  const LOADING_MIN_MS = 320;

  const scriptRef = (() => {
    const direct = document.currentScript;
    if (direct && direct.getAttribute) return direct;
    const scripts = Array.from(document.querySelectorAll("script[src]"));
    return scripts.find((el) => /assets\/js\/theme\.js(?:$|[?#])/i.test(String(el.getAttribute("src") || ""))) || null;
  })();

  const appPrefix = (() => {
    const srcAttr = scriptRef ? String(scriptRef.getAttribute("src") || "") : "";
    if (!srcAttr) return "";
    const clean = srcAttr.replace(/\\/g, "/").split("?")[0].split("#")[0];
    const marker = "assets/js/theme.js";
    const idx = clean.toLowerCase().lastIndexOf(marker);
    if (idx < 0) return "";
    return clean.slice(0, idx);
  })();

  const appRootPath = (() => {
    try {
      return new URL(appPrefix || "./", window.location.href).pathname;
    } catch {
      return "/";
    }
  })();

  const adminState = {
    isAdmin: false,
    logs: [],
    maxLogs: 600,
    hooksInstalled: false,
    dockReady: false,
    tab: "console",
    filters: { error: true, warn: true, log: true },
    query: "",
    refreshing: false,
    adminUiReady: false,
  };

  const rewardState = {
    booted: false,
    lastActionAt: 0,
    actions: 0,
    tickId: null,
    dailyClaimed: false,
  };

  let loadingStartAt = 0;
  let loadingFallbackTimer = null;
  let loadingShowTimer = null;
  let loadingVisible = false;
  let pageShellReady = false;
  let pageLeaving = false;
  let bootRevealTimer = null;

  function ensurePageShell() {
    if (!document.body || !document.body.hasAttribute(LOADING_ATTR)) return;
    const shell = document.querySelector("main");
    if (!shell) return;
    if (!shell.classList.contains("ik-page-shell")) shell.classList.add("ik-page-shell");
    if (!pageShellReady) shell.classList.add("is-pending");
  }

  function markPageShellReady() {
    pageShellReady = true;
    if (!document.body) return;
    document.body.classList.add("ik-page-loaded");
    if (!document.body.classList.contains("ik-boot-skip")) {
      document.body.classList.add("ik-boot-reveal");
      document.body.classList.remove("ik-booting");
      if (bootRevealTimer) window.clearTimeout(bootRevealTimer);
      bootRevealTimer = window.setTimeout(() => {
        document.body.classList.remove("ik-boot-reveal");
        bootRevealTimer = null;
      }, 1100);
    }
    const shell = document.querySelector("main.ik-page-shell") || document.querySelector("main");
    if (!shell) return;
    shell.classList.add("is-ready");
    shell.classList.remove("is-pending");
  }

  function ensureLoadingOverlay() {
    if (document.querySelector(".ik-loading-overlay")) return;
    const overlay = document.createElement("div");
    overlay.className = "ik-loading-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="ik-loading-bar"></div>
    `;
    document.body.appendChild(overlay);
  }

  function showLoading() {
    if (!document.body) return;
    if (loadingVisible || loadingShowTimer) return;
    ensurePageShell();
    loadingShowTimer = window.setTimeout(() => {
      loadingShowTimer = null;
      ensureLoadingOverlay();
      loadingStartAt = Date.now();
      loadingVisible = true;
      document.body.classList.add("ik-loading");
      if (loadingFallbackTimer) window.clearTimeout(loadingFallbackTimer);
      loadingFallbackTimer = window.setTimeout(() => {
        doneLoading();
      }, 5000);
    }, 120);
  }

  function doneLoading() {
    if (!document.body) return;
    if (loadingShowTimer) {
      window.clearTimeout(loadingShowTimer);
      loadingShowTimer = null;
      markPageShellReady();
      return;
    }
    if (!loadingVisible) {
      markPageShellReady();
      return;
    }
    const elapsed = Date.now() - loadingStartAt;
    const wait = Math.max(0, LOADING_MIN_MS - elapsed);
    window.setTimeout(() => {
      document.body.classList.remove("ik-loading");
      loadingVisible = false;
      markPageShellReady();
    }, wait);
  }

  function beginPageLeave() {
    if (!document.body || pageLeaving) return false;
    pageLeaving = true;
    document.body.classList.add("ik-page-leaving");
    return true;
  }

  function leaveWith(action, delayMs) {
    const delay = Math.max(0, Number(delayMs) || 170);
    const run = () => {
      try { action(); } catch (_) {}
    };
    if (!beginPageLeave()) {
      run();
      return;
    }
    window.setTimeout(run, delay);
  }

  function gotoWithLeave(url, delayMs) {
    if (!url) return;
    leaveWith(() => { window.location.href = url; }, delayMs);
  }

  function shouldInterceptLink(anchor, event) {
    if (!anchor) return false;
    if (anchor.hasAttribute("download") || anchor.hasAttribute("data-no-transition")) return false;
    if (anchor.target && anchor.target !== "_self") return false;
    if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return false;
    if (event && typeof event.button === "number" && event.button !== 0) return false;
    const rawHref = String(anchor.getAttribute("href") || "").trim();
    if (!rawHref || rawHref.startsWith("#") || /^javascript:/i.test(rawHref) || /^mailto:/i.test(rawHref) || /^tel:/i.test(rawHref)) return false;

    let targetUrl;
    try {
      targetUrl = new URL(anchor.href, window.location.href);
    } catch {
      return false;
    }

    if (targetUrl.origin !== window.location.origin) return false;
    const sameDoc =
      targetUrl.pathname === window.location.pathname &&
      targetUrl.search === window.location.search &&
      targetUrl.hash !== window.location.hash;
    if (sameDoc) return false;
    return true;
  }

  function installPageLeaveHandlers() {
    if (!document.body) return;
    window.addEventListener("pagehide", () => {
      if (bootRevealTimer) {
        window.clearTimeout(bootRevealTimer);
        bootRevealTimer = null;
      }
    });

    window.addEventListener("pageshow", (ev) => {
      pageLeaving = false;
      document.body.classList.remove("ik-page-leaving");
      if (ev && ev.persisted) {
        document.body.classList.remove("ik-booting", "ik-boot-reveal");
        document.body.classList.add("ik-boot-skip");
        requestAnimationFrame(() => {
          document.body.classList.remove("ik-boot-skip");
        });
      }
    });

    document.addEventListener("click", (event) => {
      const anchor = event.target && event.target.closest ? event.target.closest("a[href]") : null;
      if (!shouldInterceptLink(anchor, event)) return;
      event.preventDefault();
      gotoWithLeave(anchor.href, 170);
    }, true);
  }

  function getStoredTheme() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === DARK || value === LIGHT ? value : null;
    } catch (e) {
      return null;
    }
  }

  function getSystemTheme() {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return DARK;
    }
    return LIGHT;
  }

  function resolveTheme(value) {
    if (value === DARK || value === LIGHT) return value;
    return getSystemTheme();
  }

  function saveTheme(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {}
  }

  function hasUserTheme() {
    return getStoredTheme() !== null;
  }

  function applyTheme(value) {
    const theme = resolveTheme(value);
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme;
    syncThemeControls(theme);
    updateFab(theme);
    document.dispatchEvent(new CustomEvent("ik:themechange", { detail: { theme } }));
    return theme;
  }

  function setTheme(value) {
    const next = resolveTheme(value);
    saveTheme(next);
    applyTheme(next);
  }

  function toggleTheme() {
    const current = resolveTheme(document.documentElement.getAttribute("data-theme"));
    setTheme(current === DARK ? LIGHT : DARK);
  }

  function markActive(options) {
    options.forEach((label) => {
      const input = label.querySelector("input");
      label.classList.toggle("is-active", Boolean(input && input.checked));
    });
  }

  function buildThemeGroup(theme) {
    const wrap = document.createElement("div");
    wrap.className = "ik-settings-group ik-theme-group";
    wrap.innerHTML = `
      <div class="ik-settings-label">Theme</div>
      <div class="ik-theme-switch">
        <label class="ik-theme-option" data-theme-option="light">
          <input type="radio" name="ikSiteTheme" value="light" ${theme === LIGHT ? "checked" : ""} />
          <span>Light</span>
        </label>
        <label class="ik-theme-option" data-theme-option="dark">
          <input type="radio" name="ikSiteTheme" value="dark" ${theme === DARK ? "checked" : ""} />
          <span>Dark</span>
        </label>
      </div>
    `;

    const labels = Array.from(wrap.querySelectorAll(".ik-theme-option"));
    labels.forEach((label) => {
      const input = label.querySelector("input");
      if (!input) return;
      input.addEventListener("change", () => {
        if (!input.checked) return;
        setTheme(input.value);
      });
    });

    markActive(labels);
    return wrap;
  }

  function ensureAdminStyle() {
    if (document.getElementById("ikAdminConsoleStyle")) return;
    const style = document.createElement("style");
    style.id = "ikAdminConsoleStyle";
    style.textContent = [
      ".ik-admin-open { padding-bottom: 290px; box-sizing: border-box; }",
      ".ik-admin-dock { position: fixed; left: 0; right: 0; bottom: 0; height: 280px; background: rgba(10,10,10,.98); color: #e8e8e8; border-top: 1px solid rgba(255,255,255,.16); z-index: 100300; display: grid; grid-template-rows: 36px 1fr; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }",
      ".ik-admin-dock[hidden] { display:none !important; }",
      ".ik-admin-head { display:flex; align-items:center; gap:8px; padding:0 10px; border-bottom:1px solid rgba(255,255,255,.12); overflow:auto; }",
      ".ik-admin-tab { appearance:none; border:1px solid rgba(255,255,255,.2); background: transparent; color:#ddd; font-size:11px; letter-spacing:.04em; text-transform:uppercase; padding:5px 8px; cursor:pointer; }",
      ".ik-admin-tab.is-active { background: rgba(255,255,255,.12); color:#fff; border-color: rgba(255,255,255,.36); }",
      ".ik-admin-filter { appearance:none; border:1px solid rgba(255,255,255,.22); background:transparent; color:#bbb; font-size:10px; letter-spacing:.04em; text-transform:uppercase; padding:4px 7px; cursor:pointer; }",
      ".ik-admin-filter.is-on { color:#fff; border-color: rgba(255,255,255,.5); background: rgba(255,255,255,.1); }",
      ".ik-admin-tool { appearance:none; border:1px solid rgba(255,255,255,.22); background:transparent; color:#ddd; font-size:10px; letter-spacing:.04em; text-transform:uppercase; padding:4px 7px; cursor:pointer; }",
      ".ik-admin-search { min-width: 150px; max-width: 260px; width: 18vw; appearance:none; border:1px solid rgba(255,255,255,.22); background: rgba(255,255,255,.04); color:#eee; font-size:11px; padding:5px 8px; }",
      ".ik-admin-search::placeholder { color: rgba(255,255,255,.56); }",
      ".ik-admin-spacer { flex:1; }",
      ".ik-admin-close { appearance:none; border:1px solid rgba(255,255,255,.2); background: transparent; color:#ddd; font-size:11px; letter-spacing:.04em; text-transform:uppercase; padding:5px 10px; cursor:pointer; }",
      ".ik-admin-body { overflow:auto; padding:10px; white-space:pre-wrap; font-size:12px; line-height:1.35; }",
      ".ik-admin-btn { margin-top: 12px; width: 100%; appearance:none; border:1px solid rgba(0,0,0,.14); background: rgba(255,255,255,.92); color: rgba(0,0,0,.88); min-height:42px; cursor:pointer; font-size:11px; letter-spacing:.16em; text-transform:uppercase; text-align:center; display:flex; align-items:center; justify-content:center; border-radius:0; transition: border-color .16s ease, background .16s ease, transform .16s ease; }",
      ".ik-admin-btn:hover { border-color: rgba(0,0,0,.34); background: rgba(0,0,0,.04); transform: translateY(-1px); }",
      ".ik-admin-btn:active { transform: translateY(0); }",
      ".ik-admin-btn:focus-visible { outline: 2px solid rgba(0,0,0,.48); outline-offset:2px; }"
    ].join("\n");
    document.head.appendChild(style);
  }

  function ensureAccountLinkStyle() {
    if (document.getElementById(ACCOUNT_LINK_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = ACCOUNT_LINK_STYLE_ID;
    style.textContent = [
      ".ik-settings-links { display:grid; gap:8px; margin: 0 0 10px; }",
      ".ik-settings-link { min-height:42px; border:1px solid var(--ik-border-strong); background: var(--ik-surface-soft); color: var(--ik-text); text-decoration:none; display:flex; align-items:center; justify-content:center; letter-spacing:.14em; text-transform:uppercase; font-size:11px; cursor:pointer; transition: border-color .16s ease, background .16s ease, transform .16s ease; border-radius:0; }",
      ".ik-settings-link:hover { border-color: var(--ik-border-strong); background: var(--ik-surface-alt); transform: translateY(-1px); }",
      ".ik-settings-link:active { transform: translateY(0); }",
      ".ik-settings-link:focus-visible { outline: 2px solid var(--ik-focus); outline-offset: 2px; }",
      ".ik-settings-link--profile { justify-content:flex-start; gap:12px; padding: 10px 12px; min-height:56px; text-transform:none; letter-spacing:.06em; }",
      ".ik-profile-avatar { width:42px; height:42px; border:1px solid var(--ik-border-strong); background: var(--ik-surface); display:grid; place-items:center; font-size:13px; letter-spacing:1px; text-transform:uppercase; overflow:hidden; flex:0 0 auto; border-radius:0; }",
      ".ik-profile-avatar img { width:100%; height:100%; object-fit:cover; display:block; }",
      ".ik-profile-meta { display:grid; gap:2px; min-width:0; }",
      ".ik-profile-name { font-size:12px; font-weight:600; letter-spacing:.08em; text-transform:none; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }",
      ".ik-profile-sub { font-size:10px; text-transform:uppercase; letter-spacing:.18em; opacity:.7; }"
    ].join("\n");
    document.head.appendChild(style);
  }

  function currentAppRelativePath() {
    const pathname = String(window.location.pathname || "");
    let relative = pathname.startsWith(appRootPath)
      ? pathname.slice(appRootPath.length)
      : pathname.replace(/^\/+/, "");
    if (!relative) relative = "index.html";
    if (relative.endsWith("/")) relative += "index.html";
    return relative;
  }

  function buildAccountHref(view) {
    const params = new URLSearchParams();
    params.set("view", view === "friends" ? "friends" : "profile");
    params.set("returnTo", currentAppRelativePath());
    return `${appPrefix}item-user.html?${params.toString()}`;
  }

  function ensureAccountLinks(panel) {
    if (!panel) return;
    ensureAccountLinkStyle();

    let wrap = panel.querySelector(".ik-settings-links");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "ik-settings-links";
      panel.insertBefore(wrap, panel.firstElementChild || null);
    }

    let profileLink = wrap.querySelector("#ikMyProfileLink");
    if (!profileLink) {
      profileLink = document.createElement("a");
      profileLink.id = "ikMyProfileLink";
      profileLink.className = "ik-settings-link ik-settings-link--profile";
      profileLink.innerHTML = "<span class=\"ik-profile-avatar\" aria-hidden=\"true\">IK</span><span class=\"ik-profile-meta\"><span class=\"ik-profile-name\">user</span><span class=\"ik-profile-sub\">my profile</span></span>";
      wrap.appendChild(profileLink);
    }

    let friendsLink = wrap.querySelector("#ikFriendsLink");
    if (!friendsLink) {
      friendsLink = document.createElement("a");
      friendsLink.id = "ikFriendsLink";
      friendsLink.className = "ik-settings-link";
      friendsLink.textContent = "friends";
      wrap.appendChild(friendsLink);
    }

    const snapshot = (() => {
      try {
        const raw = localStorage.getItem("itemkey.currentUser");
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })();

    const displayName = String((snapshot && snapshot.name) || "user").trim() || "user";
    const avatarUrl = String((snapshot && snapshot.avatarUrl) || "").trim();
    const avatarEl = profileLink.querySelector(".ik-profile-avatar");
    const nameEl = profileLink.querySelector(".ik-profile-name");

    if (nameEl && nameEl.textContent !== displayName) nameEl.textContent = displayName;
    if (avatarEl) {
      const allowed = /^data:image\//i.test(avatarUrl) || /^https?:\/\//i.test(avatarUrl) || /^blob:/i.test(avatarUrl);
      if (allowed) {
        const img = avatarEl.querySelector("img");
        if (!img || img.src !== avatarUrl) {
          avatarEl.innerHTML = "";
          const next = document.createElement("img");
          next.src = avatarUrl;
          next.alt = "avatar";
          next.loading = "lazy";
          avatarEl.appendChild(next);
        }
      } else {
        const parts = displayName.split(/\s+/).filter(Boolean);
        const letters = parts.length >= 2
          ? `${parts[0][0] || ""}${parts[1][0] || ""}`
          : (parts[0] || "").slice(0, 2);
        const nextLetters = (letters || "IK").toUpperCase();
        if (avatarEl.textContent !== nextLetters || avatarEl.querySelector("img")) {
          avatarEl.innerHTML = "";
          avatarEl.textContent = nextLetters;
        }
      }
    }

    profileLink.href = buildAccountHref("profile");
    friendsLink.href = buildAccountHref("friends");
  }

  function getLocalUserEmail() {
    try {
      const raw = localStorage.getItem("itemkey.currentUser");
      const user = raw ? JSON.parse(raw) : null;
      return String((user && user.email) || "").trim().toLowerCase();
    } catch {
      return "";
    }
  }

  async function computeAdmin() {
    let email = getLocalUserEmail();
    try {
      await ensureSupabaseClientReady();
      if (window.IKSupabase && typeof window.IKSupabase.getClient === "function") {
        const client = window.IKSupabase.getClient();
        if (client && client.auth && typeof client.auth.getUser === "function") {
          const out = await client.auth.getUser();
          const cloudEmail = String(out && out.data && out.data.user && out.data.user.email || "").trim().toLowerCase();
          if (cloudEmail) email = cloudEmail;
        }
      }
    } catch {}
    const emergency = ADMIN_EMAILS.includes(email);
    if (emergency) return true;

    // Prefer role-based access when available
    try {
      await ensureSupabaseClientReady();
      if (window.IKSupabase && typeof window.IKSupabase.getClient === "function") {
        const client = window.IKSupabase.getClient();
        if (client) {
          const out = await client.rpc("ik_can_open_admin_console");
          if (out && out.data === true) return true;
        }
      }
    } catch (_) {
      // fallback to emergency email only
    }

    return false;
  }

  let supaEnsurePromise = null;
  function loadScriptOnce(src, id) {
    return new Promise((resolve, reject) => {
      if (id && document.getElementById(id)) return resolve(true);
      const existing = Array.from(document.querySelectorAll("script[src]")).find((s) => String(s.getAttribute("src") || "").includes(src));
      if (existing) return resolve(true);
      const s = document.createElement("script");
      if (id) s.id = id;
      s.src = src;
      s.async = true;
      s.onload = () => resolve(true);
      s.onerror = () => reject(new Error(`failed to load ${src}`));
      document.head.appendChild(s);
    });
  }

  async function ensureSupabaseClientReady() {
    if (supaEnsurePromise) return supaEnsurePromise;
    supaEnsurePromise = (async () => {
      if (!(window.supabase && typeof window.supabase.createClient === "function")) {
        await loadScriptOnce(SUPABASE_SDK_SRC, "ikSupaSdk");
      }
      if (!(window.IKSupabase && typeof window.IKSupabase.getClient === "function")) {
        await loadScriptOnce(`${appPrefix}assets/js/supabase-client.js`, "ikSupaClient");
      }
      return true;
    })();
    return supaEnsurePromise;
  }

  function getSupaClient() {
    try {
      if (!(window.IKSupabase && typeof window.IKSupabase.getClient === "function")) return null;
      return window.IKSupabase.getClient();
    } catch (_) {
      return null;
    }
  }

  async function ensureRewardsBoot() {
    if (rewardState.booted) return;
    rewardState.booted = true;
    rewardState.lastActionAt = Date.now();
    rewardState.actions = 0;

    const action = () => {
      rewardState.lastActionAt = Date.now();
      rewardState.actions += 1;
    };

    ["keydown", "pointerdown", "mousedown", "touchstart", "wheel", "scroll", "input"].forEach((evt) => {
      window.addEventListener(evt, action, { passive: true, capture: true });
    });

    const tick = async () => {
      const client = getSupaClient();
      if (!client) return;
      let user = null;
      try {
        const u = await client.auth.getUser();
        user = u && u.data && u.data.user ? u.data.user : null;
      } catch (_) {
        user = null;
      }
      if (!user) return;

      // daily visit (best-effort, server is idempotent)
      if (!rewardState.dailyClaimed) {
        rewardState.dailyClaimed = true;
        try {
          await client.rpc("ik_claim_daily_visit");
        } catch (_) {}
      }

      const now = Date.now();
      const AFK_MS = 5 * 60 * 1000;
      const last = rewardState.lastActionAt || 0;
      const isAfk = now - last >= AFK_MS;
      if (isAfk) {
        rewardState.actions = 0;
        return;
      }

      const actions = Number(rewardState.actions || 0);
      if (actions <= 0) return;
      rewardState.actions = 0;

      try {
        await client.rpc("ik_award_active_minute", { p_actions: actions });
        document.dispatchEvent(new CustomEvent("ik:walletchanged"));
      } catch (_) {
        // ignore
      }
    };

    rewardState.tickId = window.setInterval(() => {
      tick().catch(() => {});
    }, 60 * 1000);

    // run one tick soon after boot
    window.setTimeout(() => {
      tick().catch(() => {});
    }, 1200);
  }

  function pushAdminLog(level, source, payload) {
    const text = (() => {
      if (payload instanceof Error) return payload.stack || payload.message || String(payload);
      if (typeof payload === "string") return payload;
      try { return JSON.stringify(payload); } catch { return String(payload); }
    })();
    adminState.logs.push({
      t: new Date().toISOString(),
      level: String(level || "info"),
      source: String(source || "runtime"),
      text,
    });
    if (adminState.logs.length > adminState.maxLogs) {
      adminState.logs.splice(0, adminState.logs.length - adminState.maxLogs);
    }
    if (adminState.tab !== "administrations") renderAdminDock();
  }

  function getAdminDock() {
    return document.getElementById("ikAdminDock");
  }

  function renderAdminDock() {
    const dock = getAdminDock();
    if (!dock) return;
    const body = dock.querySelector("#ikAdminDockBody");
    if (!body) return;

    if (adminState.tab === "administrations") {
      renderAdministrations(body);
      return;
    }

    const rows = adminState.logs
      .filter((x) => {
        if (x.level === "error") return adminState.filters.error;
        if (x.level === "warn") return adminState.filters.warn;
        return adminState.filters.log;
      })
      .filter((x) => {
        const q = String(adminState.query || "").trim().toLowerCase();
        if (!q) return true;
        const hay = `${x.t} ${x.level} ${x.source} ${x.text}`.toLowerCase();
        return hay.includes(q);
      })
      .map((x, i) => `[${i + 1}] ${x.t} | ${x.level} | ${x.source}\n${x.text}`);
    body.textContent = rows.join("\n\n") || "No logs yet.";
    body.scrollTop = body.scrollHeight;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderAdministrations(body) {
    // interactive admin tools (roles, moderation)
    body.innerHTML = `
<div style="display:grid; gap:12px;">
  <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
    <button type="button" class="ik-admin-tool" id="ikAdminAdmRefresh">refresh</button>
    <span style="opacity:.7; font-size:11px;">roles + dictionary moderation</span>
  </div>

  <section style="border:1px solid rgba(255,255,255,.14); padding:10px;">
    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:8px;">
      <b style="font-size:12px; letter-spacing:.04em;">Roles</b>
      <span style="opacity:.7; font-size:11px;">owner/admin/moderator</span>
    </div>
    <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
      <input id="ikAdmRoleUserId" class="ik-admin-search" style="width:260px;" placeholder="user-id or uuid" />
      <select id="ikAdmRoleName" class="ik-admin-search" style="width:190px;">
        <option value="moderator">moderator</option>
        <option value="admin">admin</option>
        <option value="owner">owner</option>
      </select>
      <label style="display:flex; gap:6px; align-items:center; font-size:11px; opacity:.9;">
        <input id="ikAdmRoleEnabled" type="checkbox" checked />
        enabled
      </label>
      <button type="button" class="ik-admin-tool" id="ikAdmRoleApply">apply</button>
      <button type="button" class="ik-admin-tool" id="ikAdmRoleFetch">show roles</button>
    </div>
    <div id="ikAdmRoleOut" style="margin-top:10px; white-space:pre-wrap; font-size:12px; opacity:.95;"></div>
  </section>

  <section style="border:1px solid rgba(255,255,255,.14); padding:10px;">
    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:8px;">
      <b style="font-size:12px; letter-spacing:.04em;">Dictionary moderation</b>
      <span style="opacity:.7; font-size:11px;">publish/update requests</span>
    </div>
    <div id="ikAdmModList" style="display:grid; gap:10px;"></div>
  </section>

  <section style="border:1px solid rgba(255,255,255,.14); padding:10px;">
    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:8px;">
      <b style="font-size:12px; letter-spacing:.04em;">System dictionaries</b>
      <span style="opacity:.7; font-size:11px;">owner/admin only</span>
    </div>
    <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
      <input id="ikAdmSysDictId" class="ik-admin-search" style="width:120px;" placeholder="dict_id (opt)" />
      <input id="ikAdmSysTitle" class="ik-admin-search" style="width:320px;" placeholder="title" />
      <button type="button" class="ik-admin-tool" id="ikAdmSysCreate">create/update</button>
    </div>
    <textarea id="ikAdmSysWords" placeholder="EN - RU (one per line)" style="margin-top:8px; width:100%; min-height:90px; background:rgba(255,255,255,.04); color:#eee; border:1px solid rgba(255,255,255,.18); padding:8px; font-size:12px;"></textarea>
    <div id="ikAdmSysOut" style="margin-top:8px; white-space:pre-wrap; font-size:12px; opacity:.95;"></div>
  </section>
</div>`;

    const byId = (id) => document.getElementById(id);
    const refreshBtn = byId("ikAdminAdmRefresh");
    const roleUser = byId("ikAdmRoleUserId");
    const roleName = byId("ikAdmRoleName");
    const roleEnabled = byId("ikAdmRoleEnabled");
    const roleApply = byId("ikAdmRoleApply");
    const roleFetch = byId("ikAdmRoleFetch");
    const roleOut = byId("ikAdmRoleOut");
    const modList = byId("ikAdmModList");

    const sysDictId = byId("ikAdmSysDictId");
    const sysTitle = byId("ikAdmSysTitle");
    const sysWords = byId("ikAdmSysWords");
    const sysCreate = byId("ikAdmSysCreate");
    const sysOut = byId("ikAdmSysOut");

    const client = getSupaClient();
    if (!client) {
      roleOut.textContent = "loading supabase...";
      ensureSupabaseClientReady()
        .then(() => renderAdminDock())
        .catch((e) => {
          roleOut.textContent = `Supabase load failed: ${String(e && (e.message || e) || "")}`;
        });
      return;
    }

    const rpc = async (name, params) => {
      const out = await client.rpc(name, params || {});
      if (out && out.error) throw out.error;
      return out ? out.data : null;
    };

    const shortErr = (e) => {
      const msg = String((e && (e.message || e.error_description || e.details)) || e || "").trim();
      return msg || "unknown error";
    };

    async function doRoleApply() {
      roleOut.textContent = "...";
      try {
        const id = String(roleUser.value || "").trim();
        const role = String(roleName.value || "moderator").trim();
        const enabled = !!roleEnabled.checked;
        const data = await rpc("ik_set_user_role_by_user_id", {
          p_user: id,
          p_role: role,
          p_enabled: enabled,
        });
        roleOut.textContent = JSON.stringify(data || { ok: true }, null, 2);
      } catch (e) {
        roleOut.textContent = `error: ${shortErr(e)}`;
      }
    }

    async function doRoleFetch() {
      roleOut.textContent = "...";
      try {
        const id = String(roleUser.value || "").trim();
        const data = await rpc("ik_get_user_roles_by_user_id", { p_user: id });
        roleOut.textContent = JSON.stringify(data || [], null, 2);
      } catch (e) {
        roleOut.textContent = `error: ${shortErr(e)}`;
      }
    }

    async function renderModeration() {
      modList.innerHTML = "<div style=\"opacity:.8; font-size:12px;\">loading...</div>";
      try {
        const rows = await rpc("ik_list_dict_publish_requests", { p_status: "pending" });
        const list = Array.isArray(rows) ? rows : [];
        if (!list.length) {
          modList.innerHTML = "<div style=\"opacity:.7; font-size:12px;\">no pending requests</div>";
          return;
        }

        modList.innerHTML = list.map((r) => {
          const id = Number(r.id || 0);
          const title = escapeHtml(r.title || "");
          const author = escapeHtml(r.author_user_id || r.owner_id || "");
          const when = escapeHtml(r.created_at || "");
          const wc = escapeHtml(String(r.words_count || 0));
          const type = escapeHtml(r.request_type || "publish");
          const target = r.target_dict_id ? ` target=${escapeHtml(String(r.target_dict_id))}` : "";
          return `
<article style="border:1px solid rgba(255,255,255,.12); padding:10px;">
  <div style="display:flex; gap:10px; align-items:baseline; flex-wrap:wrap;">
    <b>#${id}</b>
    <span style="opacity:.95;">${title}</span>
    <span style="opacity:.6; font-size:11px;">${type}${target}</span>
    <span style="opacity:.6; font-size:11px;">words: ${wc}</span>
  </div>
  <div style="opacity:.7; font-size:11px; margin-top:4px;">by: ${author} | ${when}</div>
  <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
    <button type="button" class="ik-admin-tool" data-mod-action="view" data-id="${id}">view</button>
    <button type="button" class="ik-admin-tool" data-mod-action="approve" data-id="${id}">approve</button>
    <button type="button" class="ik-admin-tool" data-mod-action="needs_work" data-id="${id}">needs work</button>
    <button type="button" class="ik-admin-tool" data-mod-action="reject" data-id="${id}">reject</button>
  </div>
  <textarea data-mod-note="${id}" placeholder="reason / note" style="margin-top:8px; width:100%; min-height:54px; background:rgba(255,255,255,.04); color:#eee; border:1px solid rgba(255,255,255,.18); padding:8px; font-size:12px;"></textarea>
  <div data-mod-out="${id}" style="margin-top:8px; white-space:pre-wrap; font-size:12px; opacity:.95;"></div>
</article>`;
        }).join("");
      } catch (e) {
        modList.innerHTML = `<div style=\"opacity:.85; font-size:12px;\">error: ${escapeHtml(shortErr(e))}</div>`;
      }
    }

    async function handleModerationAction(id, action) {
      const out = document.querySelector(`[data-mod-out=\"${id}\"]`);
      const noteEl = document.querySelector(`[data-mod-note=\"${id}\"]`);
      const note = String((noteEl && noteEl.value) || "").trim();
      if (out) out.textContent = "...";
      try {
        if (action === "view") {
          const data = await rpc("ik_get_dict_publish_request", { p_request_id: Number(id) });
          if (out) out.textContent = JSON.stringify(data, null, 2);
          return;
        }
        const decision = action === "approve" ? "approve" : action === "reject" ? "reject" : "needs_work";
        const data = await rpc("ik_review_dict_publish_request", {
          p_request_id: Number(id),
          p_decision: decision,
          p_note: note,
        });
        if (out) out.textContent = JSON.stringify(data, null, 2);
        // refresh list after decision
        await renderModeration();
      } catch (e) {
        if (out) out.textContent = `error: ${shortErr(e)}`;
      }
    }

    function parseWordsLines(text) {
      const out = [];
      const lines = String(text || "").split(/\r?\n/);
      for (const raw of lines) {
        const line = String(raw || "").trim();
        if (!line) continue;
        let en = "";
        let ru = "";
        if (line.includes(" - ")) {
          const parts = line.split(" - ");
          en = String(parts.shift() || "").trim();
          ru = String(parts.join(" - ") || "").trim();
        } else if (line.includes("\t")) {
          const parts = line.split("\t");
          en = String(parts[0] || "").trim();
          ru = String(parts.slice(1).join("\t") || "").trim();
        } else if (line.includes(";")) {
          const parts = line.split(";");
          en = String(parts[0] || "").trim();
          ru = String(parts.slice(1).join(";") || "").trim();
        }
        if (!en || !ru) continue;
        out.push({ en, ru });
      }
      return out;
    }

    async function doSystemCreate() {
      if (!sysOut) return;
      sysOut.textContent = "...";
      try {
        const title = String((sysTitle && sysTitle.value) || "").trim();
        const words = parseWordsLines((sysWords && sysWords.value) || "");
        const dictIdRaw = String((sysDictId && sysDictId.value) || "").trim();
        const dictId = dictIdRaw ? Number(dictIdRaw) : null;
        const data = await rpc("ik_admin_create_system_dict", {
          p_title: title,
          p_words: words,
          p_dict_id: dictId && Number.isFinite(dictId) ? dictId : null,
        });
        sysOut.textContent = JSON.stringify(data || { ok: true }, null, 2);
      } catch (e) {
        sysOut.textContent = `error: ${shortErr(e)}`;
      }
    }

    refreshBtn?.addEventListener("click", () => {
      renderModeration().catch(() => {});
    });
    roleApply?.addEventListener("click", () => doRoleApply().catch(() => {}));
    roleFetch?.addEventListener("click", () => doRoleFetch().catch(() => {}));
    sysCreate?.addEventListener("click", () => doSystemCreate().catch(() => {}));

    modList.addEventListener("click", (e) => {
      const btn = e.target && e.target.closest ? e.target.closest("button[data-mod-action]") : null;
      if (!btn) return;
      const id = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-mod-action");
      if (!id || !action) return;
      handleModerationAction(id, action).catch(() => {});
    });

    // initial load
    renderModeration().catch(() => {});
  }

  function exportAdminLogs(kind) {
    const rows = adminState.logs
      .filter((x) => (x.level === "error" ? adminState.filters.error : x.level === "warn" ? adminState.filters.warn : adminState.filters.log));
    let text = "";
    let filename = "admin-console";
    if (kind === "json") {
      text = JSON.stringify({ exportedAt: new Date().toISOString(), rows }, null, 2);
      filename += ".json";
    } else {
      text = rows.map((x, i) => `[${i + 1}] ${x.t} | ${x.level} | ${x.source}\n${x.text}`).join("\n\n");
      filename += ".txt";
    }
    const blob = new Blob([text], { type: kind === "json" ? "application/json" : "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function closeAdminDock() {
    const dock = getAdminDock();
    if (!dock) return;
    dock.hidden = true;
    document.body.classList.remove("ik-admin-open");
  }

  function openAdminDock() {
    if (!adminState.isAdmin) return;
    ensureAdminStyle();
    const dock = ensureAdminDock();
    if (!dock) return;
    dock.hidden = false;
    document.body.classList.add("ik-admin-open");
    renderAdminDock();
  }

  function ensureAdminDock() {
    let dock = getAdminDock();
    if (dock) return dock;

    dock = document.createElement("section");
    dock.id = "ikAdminDock";
    dock.className = "ik-admin-dock";
    dock.hidden = true;
    dock.innerHTML = `
      <div class="ik-admin-head">
        <button type="button" class="ik-admin-tab is-active" data-admin-tab="console">console</button>
        <button type="button" class="ik-admin-tab" data-admin-tab="administrations">administrations</button>
        <input type="search" class="ik-admin-search" id="ikAdminSearch" placeholder="filter logs..." />
        <button type="button" class="ik-admin-filter is-on" data-admin-filter="error">error</button>
        <button type="button" class="ik-admin-filter is-on" data-admin-filter="warn">warn</button>
        <button type="button" class="ik-admin-filter is-on" data-admin-filter="log">log</button>
        <button type="button" class="ik-admin-tool" id="ikAdminClear">clear</button>
        <button type="button" class="ik-admin-tool" id="ikAdminExportTxt">export .txt</button>
        <button type="button" class="ik-admin-tool" id="ikAdminExportJson">export .json</button>
        <span class="ik-admin-spacer"></span>
        <button type="button" class="ik-admin-close" id="ikAdminDockClose">close</button>
      </div>
      <div class="ik-admin-body" id="ikAdminDockBody"></div>
    `;
    document.body.appendChild(dock);

    dock.querySelectorAll("[data-admin-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        adminState.tab = btn.getAttribute("data-admin-tab") || "console";
        dock.querySelectorAll("[data-admin-tab]").forEach((x) => x.classList.remove("is-active"));
        btn.classList.add("is-active");
        renderAdminDock();
      });
    });
    dock.querySelectorAll("[data-admin-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const k = btn.getAttribute("data-admin-filter");
        if (!k) return;
        adminState.filters[k] = !adminState.filters[k];
        btn.classList.toggle("is-on", !!adminState.filters[k]);
        renderAdminDock();
      });
    });
    dock.querySelector("#ikAdminSearch")?.addEventListener("input", (e) => {
      adminState.query = String(e.target?.value || "");
      renderAdminDock();
    });
    dock.querySelector("#ikAdminClear")?.addEventListener("click", () => {
      adminState.logs = [];
      renderAdminDock();
    });
    dock.querySelector("#ikAdminExportTxt")?.addEventListener("click", () => exportAdminLogs("txt"));
    dock.querySelector("#ikAdminExportJson")?.addEventListener("click", () => exportAdminLogs("json"));
    dock.querySelector("#ikAdminDockClose")?.addEventListener("click", closeAdminDock);

    adminState.dockReady = true;
    return dock;
  }

  function ensureAdminButton(panel) {
    if (!panel) return;
    ensureAdminStyle();
    const existing = panel.querySelector("#ikAdminOpenBtn");
    if (!adminState.isAdmin) {
      if (existing) existing.remove();
      closeAdminDock();
      return;
    }
    if (existing) {
      if (existing.className !== "ik-admin-btn") existing.className = "ik-admin-btn";
      if (existing.textContent !== "admin-panel") existing.textContent = "admin-panel";
      return;
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "ikAdminOpenBtn";
    btn.className = "ik-admin-btn";
    btn.textContent = "admin-panel";
    btn.addEventListener("click", openAdminDock);
    panel.appendChild(btn);
  }

  function installAdminHooks() {
    if (adminState.hooksInstalled) return;
    adminState.hooksInstalled = true;

    window.addEventListener("error", (e) => {
      pushAdminLog("error", "window.error", e.error || e.message || e);
    });
    window.addEventListener("unhandledrejection", (e) => {
      pushAdminLog("error", "unhandledrejection", e.reason || e);
    });

    const wrap = (name) => {
      const original = console[name];
      if (typeof original !== "function") return;
      console[name] = function(...args) {
        try { pushAdminLog(name, "console", args.map((x) => (typeof x === "string" ? x : (() => { try { return JSON.stringify(x); } catch { return String(x); } })())).join(" ")); } catch {}
        return original.apply(this, args);
      };
    };
    ["error", "warn", "log"].forEach(wrap);
  }

  function enhancePanel(panel) {
    if (!panel) return;
    ensureAccountLinks(panel);
    if (panel.querySelector(".ik-theme-group")) {
      ensureAdminButton(panel);
      return;
    }
    const current = resolveTheme(document.documentElement.getAttribute("data-theme"));
    panel.appendChild(buildThemeGroup(current));
    ensureAdminButton(panel);
  }

  function syncThemeControls(theme) {
    document.querySelectorAll(".ik-theme-group").forEach((group) => {
      const options = Array.from(group.querySelectorAll(".ik-theme-option"));
      options.forEach((label) => {
        const input = label.querySelector("input");
        if (!input) return;
        input.checked = input.value === theme;
      });
      markActive(options);
    });
  }

  function updateFab(theme) {
    const fab = document.getElementById(FAB_ID);
    if (!fab) return;
    const next = theme === DARK ? "Light" : "Dark";
    fab.textContent = theme === DARK ? "LIGHT" : "DARK";
    fab.setAttribute("aria-label", `Switch to ${next} theme`);
    fab.setAttribute("title", `Switch to ${next} theme`);
  }

  function removeFab() {
    const fab = document.getElementById(FAB_ID);
    if (fab) fab.remove();
  }

  function ensureFab() {
    if (document.querySelector(PANEL_SELECTOR)) {
      removeFab();
      return;
    }
    if (document.getElementById(FAB_ID)) return;

    const fab = document.createElement("button");
    fab.type = "button";
    fab.id = FAB_ID;
    fab.className = "ik-theme-fab";
    fab.addEventListener("click", toggleTheme);
    document.body.appendChild(fab);
    updateFab(resolveTheme(document.documentElement.getAttribute("data-theme")));
  }

  function enhanceSettingsPanels() {
    document.querySelectorAll(PANEL_SELECTOR).forEach(enhancePanel);
    document.querySelectorAll(PANEL_SELECTOR).forEach(ensureAdminButton);
    if (document.querySelector(PANEL_SELECTOR)) {
      removeFab();
    } else {
      ensureFab();
    }
  }

  async function refreshAdminAccess() {
    if (adminState.refreshing) return;
    adminState.refreshing = true;
    adminState.isAdmin = await computeAdmin();
    enhanceSettingsPanels();
    adminState.refreshing = false;
  }

  function initSystemListener() {
    if (!window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applySystemIfNeeded = () => {
      if (hasUserTheme()) return;
      applyTheme(getSystemTheme());
    };

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", applySystemIfNeeded);
    } else if (typeof media.addListener === "function") {
      media.addListener(applySystemIfNeeded);
    }
  }

  const bootTheme = getStoredTheme() || document.documentElement.getAttribute("data-theme") || getSystemTheme();
  applyTheme(bootTheme);

  window.IKAdminLog = (level, source, payload) => {
    try { pushAdminLog(level, source, payload); } catch (_) {}
  };

  window.IKLoading = {
    show: showLoading,
    done: doneLoading,
    leave: leaveWith,
    go: gotoWithLeave
  };

  if (document.body && document.body.hasAttribute(LOADING_ATTR)) {
    ensurePageShell();
    showLoading();
  }

  document.addEventListener("DOMContentLoaded", () => {
    installAdminHooks();
    ensureAdminStyle();
    enhanceSettingsPanels();
    refreshAdminAccess();
    ensureRewardsBoot().catch(() => {});

    if (document.body && document.body.hasAttribute(LOADING_ATTR)) {
      ensurePageShell();
      showLoading();
    }

    const observer = new MutationObserver(() => {
      enhanceSettingsPanels();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("storage", (e) => {
      if (e.key === "itemkey.currentUser") refreshAdminAccess();
    });

    document.addEventListener("ik:authchange", refreshAdminAccess);

    initSystemListener();
    installPageLeaveHandlers();
  });
})();
