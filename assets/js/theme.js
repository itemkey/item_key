(() => {
  const STORAGE_KEY = "ik_site_theme_v1";
  const DARK = "dark";
  const LIGHT = "light";
  const PANEL_SELECTOR = "#ikSiteSettingsPanel";
  const FAB_ID = "ikThemeFab";

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

  function enhancePanel(panel) {
    if (!panel || panel.querySelector(".ik-theme-group")) return;
    const current = resolveTheme(document.documentElement.getAttribute("data-theme"));
    panel.appendChild(buildThemeGroup(current));
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
    if (document.querySelector(PANEL_SELECTOR)) {
      removeFab();
    } else {
      ensureFab();
    }
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

  document.addEventListener("DOMContentLoaded", () => {
    enhanceSettingsPanels();

    const observer = new MutationObserver(() => {
      enhanceSettingsPanels();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    initSystemListener();
  });
})();
