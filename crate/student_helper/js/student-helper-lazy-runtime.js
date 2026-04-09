(function(){
  const loadedGroups = new Set();
  const loadingGroups = new Map();
  const loadingScripts = new Map();
  let commonWarmupQueued = false;
  let progressCloudWarmupQueued = false;

  const TRUE_SET = new Set(["1", "true", "yes", "on"]);
  const FALSE_SET = new Set(["0", "false", "no", "off"]);

  function parseFlag(raw){
    const value = String(raw || "").trim().toLowerCase();
    if(!value) return null;
    if(TRUE_SET.has(value)) return true;
    if(FALSE_SET.has(value)) return false;
    return null;
  }

  function resolveKey(src){
    try {
      return new URL(String(src || ""), document.baseURI).href;
    } catch (_err){
      return String(src || "");
    }
  }

  function findExistingScript(key){
    const scripts = document.querySelectorAll("script[src]");
    for(const script of scripts){
      const src = script.getAttribute("src");
      if(!src) continue;
      if(resolveKey(src) === key) return script;
    }
    return null;
  }

  function ensureScript(src){
    const key = resolveKey(src);
    if(loadingScripts.has(key)) return loadingScripts.get(key);

    const existing = findExistingScript(key);
    if(existing){
      const done = existing.dataset.ikLoaded === "1"
        || existing.readyState === "complete"
        || existing.readyState === "loaded";
      if(done) return Promise.resolve(existing);

      const waitExisting = new Promise((resolve, reject) => {
        const onLoad = () => {
          existing.dataset.ikLoaded = "1";
          resolve(existing);
        };
        const onError = () => {
          reject(new Error("script failed: " + src));
        };
        existing.addEventListener("load", onLoad, { once: true });
        existing.addEventListener("error", onError, { once: true });
        window.setTimeout(() => resolve(existing), 12000);
      });

      const trackedExisting = waitExisting.finally(() => {
        loadingScripts.delete(key);
      });
      loadingScripts.set(key, trackedExisting);
      return trackedExisting;
    }

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.dataset.ikLazy = "1";
      script.addEventListener("load", () => {
        script.dataset.ikLoaded = "1";
        resolve(script);
      }, { once: true });
      script.addEventListener("error", () => {
        reject(new Error("script failed: " + src));
      }, { once: true });
      document.head.appendChild(script);
    });

    const tracked = promise.finally(() => {
      loadingScripts.delete(key);
    });
    loadingScripts.set(key, tracked);
    return tracked;
  }

  async function ensureScripts(list){
    const queue = Array.isArray(list) ? list : [];
    for(const src of queue){
      // eslint-disable-next-line no-await-in-loop
      await ensureScript(src);
    }
  }

  function onceGroup(name, loader){
    if(loadedGroups.has(name)) return Promise.resolve();
    if(loadingGroups.has(name)) return loadingGroups.get(name);

    const promise = (async () => {
      await loader();
      loadedGroups.add(name);
    })();

    const tracked = promise.finally(() => {
      loadingGroups.delete(name);
    });
    loadingGroups.set(name, tracked);
    return tracked;
  }

  function ensureSupabase(){
    return onceGroup("supabase", async () => {
      await ensureScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
      await ensureScript("../../assets/js/supabase-client.js");
    });
  }

  function ensureLibrary(){
    return onceGroup("library", () => ensureScript("./js/library.js?v=20260331-03"));
  }

  function ensureGrammarLegacy(){
    return onceGroup("grammar-legacy", () => ensureScripts([
      "./js/structure_data.js",
      "./js/structure.js?v=20260331-01"
    ]));
  }

  function ensureDictionary(){
    return onceGroup("dictionary", async () => {
      await ensureSupabase();
      await ensureScripts([
        "./js/dictionary.js",
        "./js/student-helper-dict-fallback.js",
        "./js/dictionary_cloud.js"
      ]);
    });
  }

  function ensureWt(){
    return onceGroup("wt", async () => {
      await ensureSupabase();
      await ensureScript("./js/word_transformation.js?v=20260331-02");
    });
  }

  function ensureProgressCloud(){
    return onceGroup("progress-cloud", async () => {
      await ensureSupabase();
      await ensureScript("./js/progress_cloud.js");
    });
  }

  function ensureCommonEnhancers(){
    return onceGroup("common-enhancers", () => ensureScripts([
      "./js/backup_restore.js",
      "./js/enter_next.js"
    ]));
  }

  function ensureSettingsScript(){
    return onceGroup("site-settings", () => ensureScript("./js/ik-site-settings.js"));
  }

  function queueCommonWarmup(){
    if(commonWarmupQueued) return;
    commonWarmupQueued = true;
    scheduleIdle(() => {
      ensureCommonEnhancers().catch(() => {});
    }, 1400);
  }

  function queueProgressCloudWarmup(){
    if(progressCloudWarmupQueued) return;
    progressCloudWarmupQueued = true;
    scheduleIdle(() => {
      ensureProgressCloud().catch(() => {});
    }, 2200);
  }

  function normalizeRoute(raw){
    const route = String(raw || "").trim().toLowerCase();
    if(!route) return "";
    if(route === "menu") return "menu";
    if(route === "dict") return "dict";
    if(route === "library") return "library";
    if(route === "grammar" || route === "tenses" || route === "struct") return "grammar";
    if(route === "wt" || route === "wt-rule" || route === "wt-practice" || route === "wt-text" || route === "wt-builder") return "wt";
    return "";
  }

  function routeFromHash(){
    return normalizeRoute(String(window.location.hash || "").replace(/^#/, ""));
  }

  function routeFromStorage(){
    try {
      const seen = String(localStorage.getItem("sh_seen_lobby") || "").trim();
      if(!seen) return "menu";
      return normalizeRoute(localStorage.getItem("sh_last_module"));
    } catch (_err){
      return "";
    }
  }

  function getCurrentRoute(){
    try {
      if(window.StudentHelperRoute && typeof window.StudentHelperRoute.get === "function"){
        const live = normalizeRoute(window.StudentHelperRoute.get());
        if(live) return live;
      }
    } catch (_err){ }
    return routeFromHash() || routeFromStorage() || "menu";
  }

  function shouldWarmDictReact(){
    try {
      const params = new URLSearchParams(window.location.search || "");
      const fromQuery = parseFlag(params.get("dict_react"));
      if(fromQuery !== null) return fromQuery;
    } catch (_err){ }
    try {
      const fromStorage = parseFlag(localStorage.getItem("sh_dict_react_shell_v1"));
      if(fromStorage !== null) return fromStorage;
    } catch (_err){ }
    return false;
  }

  function scheduleIdle(task, timeoutMs){
    const run = () => {
      try { task(); } catch (_err){ }
    };
    if(typeof window.requestIdleCallback === "function"){
      window.requestIdleCallback(run, { timeout: Math.max(200, Number(timeoutMs) || 1200) });
      return;
    }
    window.setTimeout(run, Math.max(120, Number(timeoutMs) || 900));
  }

  function handleRoute(rawRoute){
    const route = normalizeRoute(rawRoute) || getCurrentRoute();
    if(!route || route === "menu") return;

    queueCommonWarmup();
    queueProgressCloudWarmup();
    ensureLibrary().catch(() => {});

    if(route === "grammar"){
      ensureGrammarLegacy().catch(() => {});
      return;
    }
    if(route === "dict"){
      ensureDictionary().catch(() => {});
      return;
    }
    if(route === "wt"){
      ensureWt().catch(() => {});
    }
  }

  document.addEventListener("sh:route", (event) => {
    const detail = event && event.detail ? event.detail : {};
    handleRoute(detail.route || detail.main || "");
  });

  scheduleIdle(() => {
    ensureSettingsScript().catch(() => {});
  }, 900);

  window.setTimeout(() => {
    const initialRoute = getCurrentRoute();
    handleRoute(initialRoute);
    if(shouldWarmDictReact()) ensureDictionary().catch(() => {});
  }, 0);
})();
