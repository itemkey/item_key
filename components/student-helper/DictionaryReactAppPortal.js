import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  defaultDictionaryBuilderModel,
  defaultDictionaryCardsModel,
  defaultDictionaryFirstPickModel,
  defaultDictionaryLearnModel,
  defaultDictionaryPracticeModel,
  defaultDictionarySnapshot,
  defaultDictionaryViewModel,
  dictionaryBuilderAddSection,
  dictionaryBuilderAddWord,
  dictionaryBuilderDeleteSection,
  dictionaryBuilderDeleteWord,
  dictionaryBuilderExport,
  dictionaryBuilderImport,
  dictionaryBuilderSubmit,
  dictionaryCardsNext,
  dictionaryCardsPrev,
  dictionaryCardsRestart,
  dictionaryCardsToggleFlip,
  dictionaryLearnCheckOrNext,
  dictionaryLearnGiveUp,
  dictionaryLearnHint,
  dictionaryLearnIntroMcqSelect,
  dictionaryLearnToggleFlip,
  dictionaryPracticeCheckOrNext,
  dictionaryPracticeFuzzyResolve,
  dictionaryPracticeMcqSelect,
  dictionaryPracticeSkip,
  dictionaryPracticeToggleFlip,
  dictionaryPracticeUseHint,
  enterDictionarySection,
  getDictionaryBuilderState,
  getDictionarySnapshot,
  listDictionaryFirstPick,
  listDictionaryView,
  loadDictionaryBuilderSection,
  loadDictionaryCardsSection,
  loadDictionaryLearnSection,
  loadDictionaryPracticeSection,
  loadDictionaryViewSection,
  normalizeDictionarySnapshot,
  openDictionaryConstructor,
  refreshDictionarySnapshot,
  resolveDictionaryShellEnabled,
  setDictionaryCardsFront,
  setDictionaryCardsRandom,
  setDictionaryLearnAnswer,
  setDictionaryLearnConfig,
  setDictionaryPracticeAnswer,
  setDictionaryPracticeConfig,
  setDictionaryPracticeMode,
  showDictionaryFirstPick,
  startDictionaryLearnSession,
  setDictionaryShellEnabled,
  setDictionarySource,
  toggleDictionaryLearnSettings,
  toggleDictionaryPracticeSettings,
  waitForDictionaryBridge,
} from "./dictionary/legacyAdapter";

const SOURCE_OPTIONS = [
  { value: "personal", label: "Личные" },
  { value: "system", label: "Системные" },
  { value: "user", label: "Пользовательские" },
];

function canManageSource(snapshot, source) {
  const caps = snapshot && snapshot.capabilities ? snapshot.capabilities : {};
  if (source === "system") return caps.canManageSystemDicts === true;
  if (source === "user") return caps.canManageUserDicts === true;
  return snapshot && snapshot.personalGuest !== true;
}

export default function DictionaryReactAppPortal({ defaultEnabled = false }) {
  const [enabled, setEnabled] = useState(false);
  const [hostEl, setHostEl] = useState(null);

  const [snapshot, setSnapshot] = useState(defaultDictionarySnapshot());
  const [firstPick, setFirstPick] = useState(defaultDictionaryFirstPickModel());
  const [viewModel, setViewModel] = useState(defaultDictionaryViewModel());
  const [builderModel, setBuilderModel] = useState(defaultDictionaryBuilderModel());
  const [builderSection, setBuilderSection] = useState("");
  const [builderNewSectionName, setBuilderNewSectionName] = useState("");
  const [builderEn, setBuilderEn] = useState("");
  const [builderRu, setBuilderRu] = useState("");
  const [builderImportReplace, setBuilderImportReplace] = useState(false);
  const [cardsModel, setCardsModel] = useState(defaultDictionaryCardsModel());
  const [learnModel, setLearnModel] = useState(defaultDictionaryLearnModel());
  const [practiceModel, setPracticeModel] = useState(defaultDictionaryPracticeModel());
  const [cardsSections, setCardsSections] = useState([]);
  const [cardsSection, setCardsSection] = useState("");
  const [learnSections, setLearnSections] = useState([]);
  const [learnSection, setLearnSection] = useState("");
  const [learnAnswer, setLearnAnswer] = useState("");
  const [practiceSections, setPracticeSections] = useState([]);
  const [practiceSection, setPracticeSection] = useState("");
  const [practiceAnswer, setPracticeAnswer] = useState("");
  const [viewSections, setViewSections] = useState([]);
  const [viewSection, setViewSection] = useState("");
  const [viewQuery, setViewQuery] = useState("");

  const [loadingSnapshot, setLoadingSnapshot] = useState(true);
  const [refreshingSnapshot, setRefreshingSnapshot] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingView, setLoadingView] = useState(false);
  const [loadingBuilder, setLoadingBuilder] = useState(false);
  const [loadingCards, setLoadingCards] = useState(false);
  const [loadingLearn, setLoadingLearn] = useState(false);
  const [loadingPractice, setLoadingPractice] = useState(false);

  const [busySource, setBusySource] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [listRevision, setListRevision] = useState(0);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    setEnabled(resolveDictionaryShellEnabled(defaultEnabled));
  }, [defaultEnabled]);

  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;
    let timer = 0;
    let panelEl = null;
    let mountEl = null;
    let legacyFirstPickEl = null;
    let legacyState = null;

    const attach = () => {
      if (cancelled) return;

      panelEl = document.getElementById("panel-dict");
      legacyFirstPickEl = document.getElementById("dictFirstPick");
      if (!panelEl || !legacyFirstPickEl) {
        timer = window.setTimeout(attach, 120);
        return;
      }

      const existingMount = panelEl.querySelector("#dictionaryReactAppMount");
      if (existingMount && existingMount.parentNode === panelEl) {
        panelEl.removeChild(existingMount);
      }

      legacyState = {
        display: legacyFirstPickEl.style.display,
        ariaHidden: legacyFirstPickEl.getAttribute("aria-hidden"),
      };

      legacyFirstPickEl.style.display = "none";
      legacyFirstPickEl.setAttribute("aria-hidden", "true");

      mountEl = document.createElement("div");
      mountEl.id = "dictionaryReactAppMount";
      panelEl.insertBefore(mountEl, legacyFirstPickEl.nextSibling);
      setHostEl(mountEl);
    };

    attach();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);

      setHostEl(null);
      if (mountEl && panelEl && mountEl.parentNode === panelEl) {
        panelEl.removeChild(mountEl);
      }

      if (legacyFirstPickEl && legacyState) {
        legacyFirstPickEl.style.display = legacyState.display;
        if (legacyState.ariaHidden === null) legacyFirstPickEl.removeAttribute("aria-hidden");
        else legacyFirstPickEl.setAttribute("aria-hidden", legacyState.ariaHidden);
      }
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    const panel = document.getElementById("dict-panel-view");
    if (!panel) return undefined;

    if (snapshot.subtab === "view") {
      if (panel.dataset.reactShellViewHidden !== "1") {
        panel.dataset.reactShellViewHidden = "1";
        panel.dataset.reactShellPrevDisplay = panel.style.display || "";
        panel.dataset.reactShellPrevAriaHidden = panel.getAttribute("aria-hidden") || "";
      }
      panel.style.display = "none";
      panel.setAttribute("aria-hidden", "true");
      return () => {
        if (panel.dataset.reactShellViewHidden === "1") {
          panel.style.display = panel.dataset.reactShellPrevDisplay || "";
          const prevAria = panel.dataset.reactShellPrevAriaHidden || "";
          if (prevAria) panel.setAttribute("aria-hidden", prevAria);
          else panel.removeAttribute("aria-hidden");
          delete panel.dataset.reactShellViewHidden;
          delete panel.dataset.reactShellPrevDisplay;
          delete panel.dataset.reactShellPrevAriaHidden;
        }
      };
    }

    if (panel.dataset.reactShellViewHidden === "1") {
      panel.style.display = panel.dataset.reactShellPrevDisplay || "";
      const prevAria = panel.dataset.reactShellPrevAriaHidden || "";
      if (prevAria) panel.setAttribute("aria-hidden", prevAria);
      else panel.removeAttribute("aria-hidden");
      delete panel.dataset.reactShellViewHidden;
      delete panel.dataset.reactShellPrevDisplay;
      delete panel.dataset.reactShellPrevAriaHidden;
    }

    return () => {
      if (panel.dataset.reactShellViewHidden === "1") {
        panel.style.display = panel.dataset.reactShellPrevDisplay || "";
        const prevAria = panel.dataset.reactShellPrevAriaHidden || "";
        if (prevAria) panel.setAttribute("aria-hidden", prevAria);
        else panel.removeAttribute("aria-hidden");
        delete panel.dataset.reactShellViewHidden;
        delete panel.dataset.reactShellPrevDisplay;
        delete panel.dataset.reactShellPrevAriaHidden;
      }
    };
  }, [enabled, snapshot.subtab]);

  useEffect(() => {
    if (!enabled) return undefined;
    const panel = document.getElementById("dict-panel-cards");
    if (!panel) return undefined;

    if (snapshot.subtab === "cards") {
      if (panel.dataset.reactShellCardsHidden !== "1") {
        panel.dataset.reactShellCardsHidden = "1";
        panel.dataset.reactShellCardsPrevDisplay = panel.style.display || "";
        panel.dataset.reactShellCardsPrevAriaHidden = panel.getAttribute("aria-hidden") || "";
      }
      panel.style.display = "none";
      panel.setAttribute("aria-hidden", "true");
      return () => {
        if (panel.dataset.reactShellCardsHidden === "1") {
          panel.style.display = panel.dataset.reactShellCardsPrevDisplay || "";
          const prevAria = panel.dataset.reactShellCardsPrevAriaHidden || "";
          if (prevAria) panel.setAttribute("aria-hidden", prevAria);
          else panel.removeAttribute("aria-hidden");
          delete panel.dataset.reactShellCardsHidden;
          delete panel.dataset.reactShellCardsPrevDisplay;
          delete panel.dataset.reactShellCardsPrevAriaHidden;
        }
      };
    }

    if (panel.dataset.reactShellCardsHidden === "1") {
      panel.style.display = panel.dataset.reactShellCardsPrevDisplay || "";
      const prevAria = panel.dataset.reactShellCardsPrevAriaHidden || "";
      if (prevAria) panel.setAttribute("aria-hidden", prevAria);
      else panel.removeAttribute("aria-hidden");
      delete panel.dataset.reactShellCardsHidden;
      delete panel.dataset.reactShellCardsPrevDisplay;
      delete panel.dataset.reactShellCardsPrevAriaHidden;
    }

    return () => {
      if (panel.dataset.reactShellCardsHidden === "1") {
        panel.style.display = panel.dataset.reactShellCardsPrevDisplay || "";
        const prevAria = panel.dataset.reactShellCardsPrevAriaHidden || "";
        if (prevAria) panel.setAttribute("aria-hidden", prevAria);
        else panel.removeAttribute("aria-hidden");
        delete panel.dataset.reactShellCardsHidden;
        delete panel.dataset.reactShellCardsPrevDisplay;
        delete panel.dataset.reactShellCardsPrevAriaHidden;
      }
    };
  }, [enabled, snapshot.subtab]);

  useEffect(() => {
    if (!enabled) return undefined;
    const panel = document.getElementById("dict-panel-quiz");
    if (!panel) return undefined;

    if (snapshot.subtab === "practice") {
      if (panel.dataset.reactShellPracticeHidden !== "1") {
        panel.dataset.reactShellPracticeHidden = "1";
        panel.dataset.reactShellPracticePrevDisplay = panel.style.display || "";
        panel.dataset.reactShellPracticePrevAriaHidden = panel.getAttribute("aria-hidden") || "";
      }
      panel.style.display = "none";
      panel.setAttribute("aria-hidden", "true");
      return () => {
        if (panel.dataset.reactShellPracticeHidden === "1") {
          panel.style.display = panel.dataset.reactShellPracticePrevDisplay || "";
          const prevAria = panel.dataset.reactShellPracticePrevAriaHidden || "";
          if (prevAria) panel.setAttribute("aria-hidden", prevAria);
          else panel.removeAttribute("aria-hidden");
          delete panel.dataset.reactShellPracticeHidden;
          delete panel.dataset.reactShellPracticePrevDisplay;
          delete panel.dataset.reactShellPracticePrevAriaHidden;
        }
      };
    }

    if (panel.dataset.reactShellPracticeHidden === "1") {
      panel.style.display = panel.dataset.reactShellPracticePrevDisplay || "";
      const prevAria = panel.dataset.reactShellPracticePrevAriaHidden || "";
      if (prevAria) panel.setAttribute("aria-hidden", prevAria);
      else panel.removeAttribute("aria-hidden");
      delete panel.dataset.reactShellPracticeHidden;
      delete panel.dataset.reactShellPracticePrevDisplay;
      delete panel.dataset.reactShellPracticePrevAriaHidden;
    }

    return () => {
      if (panel.dataset.reactShellPracticeHidden === "1") {
        panel.style.display = panel.dataset.reactShellPracticePrevDisplay || "";
        const prevAria = panel.dataset.reactShellPracticePrevAriaHidden || "";
        if (prevAria) panel.setAttribute("aria-hidden", prevAria);
        else panel.removeAttribute("aria-hidden");
        delete panel.dataset.reactShellPracticeHidden;
        delete panel.dataset.reactShellPracticePrevDisplay;
        delete panel.dataset.reactShellPracticePrevAriaHidden;
      }
    };
  }, [enabled, snapshot.subtab]);

  useEffect(() => {
    if (!enabled) return undefined;
    const panel = document.getElementById("dict-panel-learn");
    if (!panel) return undefined;

    if (snapshot.subtab === "learn") {
      if (panel.dataset.reactShellLearnHidden !== "1") {
        panel.dataset.reactShellLearnHidden = "1";
        panel.dataset.reactShellLearnPrevDisplay = panel.style.display || "";
        panel.dataset.reactShellLearnPrevAriaHidden = panel.getAttribute("aria-hidden") || "";
      }
      panel.style.display = "none";
      panel.setAttribute("aria-hidden", "true");
      return () => {
        if (panel.dataset.reactShellLearnHidden === "1") {
          panel.style.display = panel.dataset.reactShellLearnPrevDisplay || "";
          const prevAria = panel.dataset.reactShellLearnPrevAriaHidden || "";
          if (prevAria) panel.setAttribute("aria-hidden", prevAria);
          else panel.removeAttribute("aria-hidden");
          delete panel.dataset.reactShellLearnHidden;
          delete panel.dataset.reactShellLearnPrevDisplay;
          delete panel.dataset.reactShellLearnPrevAriaHidden;
        }
      };
    }

    if (panel.dataset.reactShellLearnHidden === "1") {
      panel.style.display = panel.dataset.reactShellLearnPrevDisplay || "";
      const prevAria = panel.dataset.reactShellLearnPrevAriaHidden || "";
      if (prevAria) panel.setAttribute("aria-hidden", prevAria);
      else panel.removeAttribute("aria-hidden");
      delete panel.dataset.reactShellLearnHidden;
      delete panel.dataset.reactShellLearnPrevDisplay;
      delete panel.dataset.reactShellLearnPrevAriaHidden;
    }

    return () => {
      if (panel.dataset.reactShellLearnHidden === "1") {
        panel.style.display = panel.dataset.reactShellLearnPrevDisplay || "";
        const prevAria = panel.dataset.reactShellLearnPrevAriaHidden || "";
        if (prevAria) panel.setAttribute("aria-hidden", prevAria);
        else panel.removeAttribute("aria-hidden");
        delete panel.dataset.reactShellLearnHidden;
        delete panel.dataset.reactShellLearnPrevDisplay;
        delete panel.dataset.reactShellLearnPrevAriaHidden;
      }
    };
  }, [enabled, snapshot.subtab]);

  useEffect(() => {
    if (!enabled) return undefined;
    const panel = document.getElementById("dict-panel-builder");
    if (!panel) return undefined;

    if (snapshot.subtab === "builder") {
      if (panel.dataset.reactShellBuilderHidden !== "1") {
        panel.dataset.reactShellBuilderHidden = "1";
        panel.dataset.reactShellBuilderPrevDisplay = panel.style.display || "";
        panel.dataset.reactShellBuilderPrevAriaHidden = panel.getAttribute("aria-hidden") || "";
      }
      panel.style.display = "none";
      panel.setAttribute("aria-hidden", "true");
      return () => {
        if (panel.dataset.reactShellBuilderHidden === "1") {
          panel.style.display = panel.dataset.reactShellBuilderPrevDisplay || "";
          const prevAria = panel.dataset.reactShellBuilderPrevAriaHidden || "";
          if (prevAria) panel.setAttribute("aria-hidden", prevAria);
          else panel.removeAttribute("aria-hidden");
          delete panel.dataset.reactShellBuilderHidden;
          delete panel.dataset.reactShellBuilderPrevDisplay;
          delete panel.dataset.reactShellBuilderPrevAriaHidden;
        }
      };
    }

    if (panel.dataset.reactShellBuilderHidden === "1") {
      panel.style.display = panel.dataset.reactShellBuilderPrevDisplay || "";
      const prevAria = panel.dataset.reactShellBuilderPrevAriaHidden || "";
      if (prevAria) panel.setAttribute("aria-hidden", prevAria);
      else panel.removeAttribute("aria-hidden");
      delete panel.dataset.reactShellBuilderHidden;
      delete panel.dataset.reactShellBuilderPrevDisplay;
      delete panel.dataset.reactShellBuilderPrevAriaHidden;
    }

    return () => {
      if (panel.dataset.reactShellBuilderHidden === "1") {
        panel.style.display = panel.dataset.reactShellBuilderPrevDisplay || "";
        const prevAria = panel.dataset.reactShellBuilderPrevAriaHidden || "";
        if (prevAria) panel.setAttribute("aria-hidden", prevAria);
        else panel.removeAttribute("aria-hidden");
        delete panel.dataset.reactShellBuilderHidden;
        delete panel.dataset.reactShellBuilderPrevDisplay;
        delete panel.dataset.reactShellBuilderPrevAriaHidden;
      }
    };
  }, [enabled, snapshot.subtab]);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;

    const syncSnapshot = async (mode) => {
      const isRefresh = mode === "refresh";
      if (isRefresh) setRefreshingSnapshot(true);
      else setLoadingSnapshot(true);

      setErrorText("");
      try {
        await waitForDictionaryBridge(7000);
        const next = isRefresh
          ? await refreshDictionarySnapshot()
          : await getDictionarySnapshot();
        if (cancelled) return;
        setSnapshot(next);
        setListRevision((v) => v + 1);
      } catch (_err) {
        if (!cancelled) {
          setErrorText("Не удалось обновить состояние dictionary shell.");
        }
      } finally {
        if (!cancelled) {
          if (isRefresh) setRefreshingSnapshot(false);
          else setLoadingSnapshot(false);
        }
      }
    };

    const onDictState = (event) => {
      if (cancelled) return;
      const next = normalizeDictionarySnapshot(event && event.detail);
      setSnapshot(next);
      setLoadingSnapshot(false);
      setRefreshingSnapshot(false);
      setListRevision((v) => v + 1);
    };

    const onAuthChange = () => {
      syncSnapshot("refresh").catch(() => {});
    };

    const onStorage = (event) => {
      if (!event) return;
      if (event.key === "itemkey.currentUser" || event.key === "student_helper_dict_source_v1") {
        syncSnapshot("refresh").catch(() => {});
      }
    };

    syncSnapshot("init").catch(() => {});
    window.addEventListener("dict:state", onDictState);
    document.addEventListener("ik:authchange", onAuthChange);
    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      window.removeEventListener("dict:state", onDictState);
      document.removeEventListener("ik:authchange", onAuthChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (snapshot.subtab !== "first-pick") {
      setLoadingList(false);
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoadingList(true);
      try {
        const model = await listDictionaryFirstPick(searchQuery);
        if (!cancelled) setFirstPick(model);
      } catch (_err) {
        if (!cancelled) {
          setErrorText("Не удалось загрузить список разделов.");
        }
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    }, 140);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    enabled,
    searchQuery,
    listRevision,
    snapshot.subtab,
    snapshot.source,
    snapshot.personalGuest,
    snapshot.counts.sections,
    snapshot.counts.words,
  ]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (snapshot.subtab !== "view") {
      setLoadingView(false);
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoadingView(true);
      setErrorText("");
      try {
        const catalog = await listDictionaryFirstPick("");
        if (cancelled) return;
        const options = Array.isArray(catalog.items) ? catalog.items : [];
        setViewSections(options);

        let selected = String(viewSection || snapshot.currentSection || "").trim();
        const hasSelected = options.some((item) => String(item.sid) === selected);
        if (!selected || !hasSelected) {
          if (options.some((item) => String(item.sid) === "All")) selected = "All";
          else selected = options[0] ? String(options[0].sid) : "";
        }
        if (selected !== viewSection) setViewSection(selected);

        if (!selected) {
          setViewModel(defaultDictionaryViewModel());
          return;
        }

        const loaded = await loadDictionaryViewSection(selected);
        if (cancelled) return;
        if (loaded && loaded.state) setSnapshot(loaded.state);
        if (loaded && loaded.view) {
          const nextView = await listDictionaryView(selected, viewQuery);
          if (!cancelled) setViewModel(nextView);
        }
      } catch (_err) {
        if (!cancelled) {
          setErrorText("Не удалось загрузить просмотр словаря.");
        }
      } finally {
        if (!cancelled) setLoadingView(false);
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, listRevision, snapshot.subtab, snapshot.source]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (snapshot.subtab !== "view") return undefined;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (!viewSection) {
        setViewModel(defaultDictionaryViewModel());
        return;
      }
      try {
        const model = await listDictionaryView(viewSection, viewQuery);
        if (!cancelled) setViewModel(model);
      } catch (_err) {
        if (!cancelled) setErrorText("Не удалось обновить список слов.");
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, snapshot.subtab, viewSection, viewQuery]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (snapshot.subtab !== "builder") {
      setLoadingBuilder(false);
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoadingBuilder(true);
      setErrorText("");
      try {
        const basePayload = await getDictionaryBuilderState();
        if (cancelled) return;

        if (basePayload && basePayload.state) setSnapshot(basePayload.state);
        if (basePayload && basePayload.builder) {
          setBuilderModel(basePayload.builder);
          const currentSelected = String(basePayload.builder.selected || "").trim();
          if (currentSelected !== builderSection) setBuilderSection(currentSelected);
        }

        let selected = String(
          (basePayload && basePayload.builder && basePayload.builder.selected)
          || builderSection
          || snapshot.currentSection
          || ""
        ).trim();
        const sections = (basePayload && basePayload.builder && Array.isArray(basePayload.builder.sections))
          ? basePayload.builder.sections
          : [];
        if (selected && !sections.some((item) => String(item.sid) === selected)) selected = "";

        const payload = await loadDictionaryBuilderSection(selected);
        if (cancelled) return;
        if (payload && payload.state) setSnapshot(payload.state);
        if (payload && payload.builder) {
          setBuilderModel(payload.builder);
          const nextSelected = String(payload.builder.selected || "").trim();
          if (nextSelected !== builderSection) setBuilderSection(nextSelected);
        }
      } catch (_err) {
        if (!cancelled) {
          setErrorText("Не удалось загрузить constructor.");
        }
      } finally {
        if (!cancelled) setLoadingBuilder(false);
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, listRevision, snapshot.subtab, snapshot.source]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (snapshot.subtab !== "cards") {
      setLoadingCards(false);
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoadingCards(true);
      setErrorText("");
      try {
        const catalog = await listDictionaryFirstPick("");
        if (cancelled) return;
        const options = Array.isArray(catalog.items) ? catalog.items : [];
        setCardsSections(options);

        let selected = String(cardsSection || snapshot.currentSection || "").trim();
        const hasSelected = options.some((item) => String(item.sid) === selected);
        if (!selected || !hasSelected) {
          if (options.some((item) => String(item.sid) === "All")) selected = "All";
          else selected = options[0] ? String(options[0].sid) : "";
        }
        if (selected !== cardsSection) setCardsSection(selected);

        if (!selected) {
          setCardsModel(defaultDictionaryCardsModel());
          return;
        }

        const payload = await loadDictionaryCardsSection(selected);
        if (cancelled) return;
        if (payload && payload.state) setSnapshot(payload.state);
        if (payload && payload.cards) setCardsModel(payload.cards);
      } catch (_err) {
        if (!cancelled) {
          setErrorText("Не удалось загрузить карточки.");
        }
      } finally {
        if (!cancelled) setLoadingCards(false);
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, listRevision, snapshot.subtab, snapshot.source]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (snapshot.subtab !== "learn") {
      setLoadingLearn(false);
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoadingLearn(true);
      setErrorText("");
      try {
        const catalog = await listDictionaryFirstPick("");
        if (cancelled) return;
        const options = Array.isArray(catalog.items) ? catalog.items : [];
        setLearnSections(options);

        let selected = String(learnSection || snapshot.currentSection || "").trim();
        const hasSelected = options.some((item) => String(item.sid) === selected);
        if (!selected || !hasSelected) {
          if (options.some((item) => String(item.sid) === "All")) selected = "All";
          else selected = options[0] ? String(options[0].sid) : "";
        }
        if (selected !== learnSection) setLearnSection(selected);

        if (!selected) {
          setLearnModel(defaultDictionaryLearnModel());
          setLearnAnswer("");
          return;
        }

        const payload = await loadDictionaryLearnSection(selected);
        if (cancelled) return;
        if (payload && payload.state) setSnapshot(payload.state);
        if (payload && payload.learn) {
          setLearnModel(payload.learn);
          setLearnAnswer(payload.learn.input ? payload.learn.input.value || "" : "");
        }
      } catch (_err) {
        if (!cancelled) {
          setErrorText("Не удалось загрузить learn.");
        }
      } finally {
        if (!cancelled) setLoadingLearn(false);
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, listRevision, snapshot.subtab, snapshot.source]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (snapshot.subtab !== "learn") return undefined;
    setLearnAnswer(learnModel && learnModel.input ? String(learnModel.input.value || "") : "");
    return undefined;
  }, [enabled, snapshot.subtab, learnModel.input]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (snapshot.subtab !== "practice") {
      setLoadingPractice(false);
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoadingPractice(true);
      setErrorText("");
      try {
        const catalog = await listDictionaryFirstPick("");
        if (cancelled) return;
        const options = Array.isArray(catalog.items) ? catalog.items : [];
        setPracticeSections(options);

        let selected = String(practiceSection || snapshot.currentSection || "").trim();
        const hasSelected = options.some((item) => String(item.sid) === selected);
        if (!selected || !hasSelected) {
          if (options.some((item) => String(item.sid) === "All")) selected = "All";
          else selected = options[0] ? String(options[0].sid) : "";
        }
        if (selected !== practiceSection) setPracticeSection(selected);

        if (!selected) {
          setPracticeModel(defaultDictionaryPracticeModel());
          setPracticeAnswer("");
          return;
        }

        const payload = await loadDictionaryPracticeSection(selected);
        if (cancelled) return;
        if (payload && payload.state) setSnapshot(payload.state);
        if (payload && payload.practice) {
          setPracticeModel(payload.practice);
          setPracticeAnswer(payload.practice.input ? payload.practice.input.value || "" : "");
        }
      } catch (_err) {
        if (!cancelled) {
          setErrorText("Не удалось загрузить practice.");
        }
      } finally {
        if (!cancelled) setLoadingPractice(false);
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, listRevision, snapshot.subtab, snapshot.source]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (snapshot.subtab !== "practice") return undefined;
    setPracticeAnswer(practiceModel && practiceModel.input ? String(practiceModel.input.value || "") : "");
    return undefined;
  }, [enabled, snapshot.subtab, practiceModel.input]);

  const sourceHint = useMemo(() => {
    if (snapshot.source === "personal" && snapshot.personalGuest) {
      return "Гостевой режим: личные словари доступны после входа.";
    }
    if (snapshot.source === "system") {
      return canManageSource(snapshot, "system")
        ? "Можно редактировать системные словари."
        : "Только просмотр системных словарей.";
    }
    if (snapshot.source === "user") {
      return canManageSource(snapshot, "user")
        ? "Можно редактировать пользовательские публичные словари."
        : "Только просмотр пользовательских словарей.";
    }
    return "Личные словари редактируются владельцем аккаунта.";
  }, [snapshot]);

  if (!enabled || !hostEl) return null;
  const isFirstPick = snapshot.subtab === "first-pick";
  const isView = snapshot.subtab === "view";
  const isBuilder = snapshot.subtab === "builder";
  const isCards = snapshot.subtab === "cards";
  const isLearn = snapshot.subtab === "learn";
  const isPractice = snapshot.subtab === "practice";
  if (!isFirstPick && !isView && !isBuilder && !isCards && !isLearn && !isPractice) return createPortal(null, hostEl);

  const controlsBusy = loadingSnapshot || refreshingSnapshot || loadingList || loadingView || loadingBuilder || loadingCards || loadingLearn || loadingPractice || !!busySource || !!busyAction;

  const handleOpenSection = async (sid, tab) => {
    if (!sid || controlsBusy) return;
    const actionKey = `${sid}:${tab}`;
    setBusyAction(actionKey);
    setErrorText("");
    try {
      const next = await enterDictionarySection(sid, tab);
      setSnapshot(next);
    } catch (_err) {
      setErrorText("Не удалось открыть раздел.");
    } finally {
      setBusyAction("");
    }
  };

  const handleViewSectionChange = async (nextSection) => {
    const selected = String(nextSection || "").trim();
    setViewSection(selected);
    setBusyAction(`view:${selected}`);
    setErrorText("");
    try {
      if (!selected) {
        setViewModel(defaultDictionaryViewModel());
        return;
      }
      const loaded = await loadDictionaryViewSection(selected);
      if (loaded && loaded.state) setSnapshot(loaded.state);
      const model = await listDictionaryView(selected, viewQuery);
      setViewModel(model);
    } catch (_err) {
      setErrorText("Не удалось переключить раздел просмотра.");
    } finally {
      setBusyAction("");
    }
  };

  const applyCardsPayload = (payload) => {
    if (!payload || typeof payload !== "object") return;
    if (payload.state) setSnapshot(payload.state);
    if (payload.cards) {
      setCardsModel(payload.cards);
      if (payload.cards.selected && payload.cards.selected !== cardsSection) {
        setCardsSection(String(payload.cards.selected));
      }
    }
  };

  const handleCardsSectionChange = async (nextSection) => {
    const selected = String(nextSection || "").trim();
    setCardsSection(selected);
    setBusyAction(`cards:section:${selected}`);
    setErrorText("");
    try {
      if (!selected) {
        setCardsModel(defaultDictionaryCardsModel());
        return;
      }
      const payload = await loadDictionaryCardsSection(selected);
      applyCardsPayload(payload);
    } catch (_err) {
      setErrorText("Не удалось переключить раздел карточек.");
    } finally {
      setBusyAction("");
    }
  };

  const handleCardsAction = async (kind, run) => {
    setBusyAction(`cards:${kind}`);
    setErrorText("");
    try {
      const payload = await run();
      applyCardsPayload(payload);
    } catch (_err) {
      setErrorText("Ошибка в режиме cards.");
    } finally {
      setBusyAction("");
    }
  };

  const applyBuilderPayload = (payload) => {
    if (!payload || typeof payload !== "object") return;
    if (payload.state) setSnapshot(payload.state);
    if (payload.builder) {
      setBuilderModel(payload.builder);
      const nextSelected = String(payload.builder.selected || "").trim();
      if (nextSelected !== builderSection) setBuilderSection(nextSelected);
    }
  };

  const handleBuilderSectionChange = async (nextSection) => {
    const selected = String(nextSection || "").trim();
    setBuilderSection(selected);
    setBusyAction(`builder:section:${selected}`);
    setErrorText("");
    try {
      const payload = await loadDictionaryBuilderSection(selected);
      applyBuilderPayload(payload);
    } catch (_err) {
      setErrorText("Не удалось переключить section конструктора.");
    } finally {
      setBusyAction("");
    }
  };

  const handleBuilderAction = async (kind, run) => {
    setBusyAction(`builder:${kind}`);
    setErrorText("");
    try {
      const payload = await run();
      applyBuilderPayload(payload);
      if (kind === "add-section") setBuilderNewSectionName("");
      if (kind === "add-word") {
        setBuilderEn("");
        setBuilderRu("");
      }
    } catch (_err) {
      setErrorText("Ошибка в режиме constructor.");
    } finally {
      setBusyAction("");
    }
  };

  const applyPracticePayload = (payload) => {
    if (!payload || typeof payload !== "object") return;
    if (payload.state) setSnapshot(payload.state);
    if (payload.practice) {
      setPracticeModel(payload.practice);
      if (payload.practice.selected && payload.practice.selected !== practiceSection) {
        setPracticeSection(String(payload.practice.selected));
      }
      const nextInput = payload.practice.input ? String(payload.practice.input.value || "") : "";
      setPracticeAnswer(nextInput);
    }
  };

  const handlePracticeSectionChange = async (nextSection) => {
    const selected = String(nextSection || "").trim();
    setPracticeSection(selected);
    setBusyAction(`practice:section:${selected}`);
    setErrorText("");
    try {
      if (!selected) {
        setPracticeModel(defaultDictionaryPracticeModel());
        setPracticeAnswer("");
        return;
      }
      const payload = await loadDictionaryPracticeSection(selected);
      applyPracticePayload(payload);
    } catch (_err) {
      setErrorText("Не удалось переключить practice section.");
    } finally {
      setBusyAction("");
    }
  };

  const handlePracticeAction = async (kind, run) => {
    setBusyAction(`practice:${kind}`);
    setErrorText("");
    try {
      const payload = await run();
      applyPracticePayload(payload);
    } catch (_err) {
      setErrorText("Ошибка в режиме practice.");
    } finally {
      setBusyAction("");
    }
  };

  const updatePracticeConfig = (patch) => {
    const merged = {
      ...(practiceModel && practiceModel.settings ? practiceModel.settings : {}),
      ...(patch || {}),
    };
    handlePracticeAction("config", () => setDictionaryPracticeConfig(merged)).catch(() => {});
  };

  const applyLearnPayload = (payload) => {
    if (!payload || typeof payload !== "object") return;
    if (payload.state) setSnapshot(payload.state);
    if (payload.learn) {
      setLearnModel(payload.learn);
      if (payload.learn.selected && payload.learn.selected !== learnSection) {
        setLearnSection(String(payload.learn.selected));
      }
      const nextInput = payload.learn.input ? String(payload.learn.input.value || "") : "";
      setLearnAnswer(nextInput);
    }
  };

  const handleLearnSectionChange = async (nextSection) => {
    const selected = String(nextSection || "").trim();
    setLearnSection(selected);
    setBusyAction(`learn:section:${selected}`);
    setErrorText("");
    try {
      if (!selected) {
        setLearnModel(defaultDictionaryLearnModel());
        setLearnAnswer("");
        return;
      }
      const payload = await loadDictionaryLearnSection(selected);
      applyLearnPayload(payload);
    } catch (_err) {
      setErrorText("Не удалось переключить learn section.");
    } finally {
      setBusyAction("");
    }
  };

  const handleLearnAction = async (kind, run) => {
    setBusyAction(`learn:${kind}`);
    setErrorText("");
    try {
      const payload = await run();
      applyLearnPayload(payload);
    } catch (_err) {
      setErrorText("Ошибка в режиме learn.");
    } finally {
      setBusyAction("");
    }
  };

  const updateLearnConfig = (patch) => {
    const merged = {
      ...(learnModel && learnModel.settings ? learnModel.settings : {}),
      ...(patch || {}),
    };
    handleLearnAction("config", () => setDictionaryLearnConfig(merged)).catch(() => {});
  };

  return createPortal(
    <section className="tw-rounded-3xl tw-border tw-border-slate-300 tw-bg-gradient-to-br tw-from-amber-50 tw-via-white tw-to-sky-50 tw-p-5 tw-shadow-sm">
      <div className="tw-flex tw-flex-wrap tw-items-start tw-justify-between tw-gap-3">
        <div>
          <p className="tw-m-0 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.12em] tw-text-slate-500">Dictionary React Shell</p>
          <h3 className="tw-m-0 tw-mt-1 tw-text-lg tw-font-semibold tw-text-slate-900">
            {isBuilder
              ? "Constructor (React UI + legacy engine)"
              : (isLearn
              ? "Learn (React UI + legacy engine)"
              : (isPractice
              ? "Practice (React UI + legacy engine)"
              : (isCards ? "Cards (React UI + legacy engine)" : (isView ? "Просмотр словаря (read-only)" : "Выбери раздел чтобы начать"))))}
          </h3>
          <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-600">
            {isBuilder
              ? "React рендерит constructor, при этом IndexedDB/Supabase операции и проверки прав выполняются legacy runtime через bridge."
              : (isLearn
              ? "React рендерит learn, при этом логика очередей, retype и SRS остается в legacy runtime через bridge."
              : (isPractice
                ? "React рендерит practice, при этом логика проверки ответов, MCQ и наград остается в legacy runtime через bridge."
                : (isCards
                  ? "React рендерит cards, при этом логика колоды и загрузки остается в legacy runtime через bridge."
                  : (isView
                    ? "React рендерит view; cards/learn/practice/constructor также работают в React UI через bridge."
                    : "React управляет first-pick; cards/view/learn/practice/constructor работают в React UI через bridge."))))}
          </p>
        </div>

        <div className="tw-flex tw-flex-wrap tw-gap-2">
          {snapshot.canUseBuilderForCurrentSource ? (
            <button
              type="button"
              className="ik-btn"
              disabled={controlsBusy}
              onClick={async () => {
                setErrorText("");
                setBusyAction("constructor");
                try {
                  const next = await openDictionaryConstructor();
                  setSnapshot(next);
                } catch (_err) {
                  setErrorText("Не удалось открыть constructor.");
                } finally {
                  setBusyAction("");
                }
              }}
            >
              constructor
            </button>
          ) : null}

          <button
            type="button"
            className="ik-btn"
            disabled={refreshingSnapshot}
            onClick={async () => {
              setRefreshingSnapshot(true);
              setErrorText("");
              try {
                const next = await refreshDictionarySnapshot();
                setSnapshot(next);
                setListRevision((v) => v + 1);
              } catch (_err) {
                setErrorText("Не удалось обновить права или источник.");
              } finally {
                setRefreshingSnapshot(false);
              }
            }}
          >
            {refreshingSnapshot ? "Обновление..." : "Обновить"}
          </button>

          <button
            type="button"
            className="ik-btn ik-btn--black"
            onClick={() => {
              setDictionaryShellEnabled(false);
              window.location.reload();
            }}
          >
            Вернуться в legacy
          </button>
        </div>
      </div>

      <div className="tw-mt-4 tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white/80 tw-p-3">
        <p className="tw-m-0 tw-text-sm tw-font-medium tw-text-slate-800">Источник</p>
        <div className="tw-mt-2 tw-flex tw-flex-wrap tw-gap-2">
          {SOURCE_OPTIONS.map((option) => {
            const active = snapshot.source === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={active ? "ik-btn ik-btn--black" : "ik-btn"}
                disabled={busySource === option.value || loadingSnapshot}
                onClick={async () => {
                  setBusySource(option.value);
                  setErrorText("");
                  try {
                    const next = await setDictionarySource(option.value);
                    setSnapshot(next);
                    setListRevision((v) => v + 1);
                  } catch (_err) {
                    setErrorText("Не удалось переключить источник.");
                  } finally {
                    setBusySource("");
                  }
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="tw-m-0 tw-mt-2 tw-text-xs tw-text-slate-600">{sourceHint}</p>
      </div>

      {isFirstPick ? (
        <div className="tw-mt-4 tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white/80 tw-p-3">
          <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
            <input
              className="ik-input tw-min-w-[260px] tw-flex-1"
              type="search"
              value={searchQuery}
              placeholder="поиск по разделам..."
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <span className="ik-badge">sections: {snapshot.counts.sections}</span>
            <span className="ik-badge">words: {snapshot.counts.words}</span>
          </div>

          <div className="tw-mt-3">
            {loadingList ? (
              <p className="tw-m-0 tw-text-sm tw-text-slate-600">Загрузка разделов...</p>
            ) : null}

            {!loadingList && firstPick.personalGuest ? (
              <p className="tw-m-0 tw-text-sm tw-font-medium tw-text-slate-700">{firstPick.message || "войдите, чтобы видеть личные словари"}</p>
            ) : null}

            {!loadingList && !firstPick.personalGuest && (!Array.isArray(firstPick.items) || firstPick.items.length === 0) ? (
              <p className="tw-m-0 tw-text-sm tw-font-medium tw-text-slate-700">ничего не найдено</p>
            ) : null}

            {!loadingList && !firstPick.personalGuest && Array.isArray(firstPick.items) && firstPick.items.length > 0 ? (
              <ul className="ik-list">
                {firstPick.items.map((item) => {
                  const rowActionKey = `${item.sid}:cards`;
                  return (
                    <li
                      key={`${item.sid}:${item.name}`}
                      className="is-clickable"
                      onClick={() => {
                        handleOpenSection(item.sid, "cards").catch(() => {});
                      }}
                    >
                      <div>
                        <p className="ik-itemline">
                          <b>{item.name}</b> <span className="ik-muted">({item.count})</span>
                        </p>
                      </div>
                      <div className="ik-mini">
                        <button
                          type="button"
                          className="ik-btn"
                          disabled={controlsBusy}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenSection(item.sid, "view").catch(() => {});
                          }}
                        >
                          просмотр
                        </button>
                        <button
                          type="button"
                          className="ik-btn ik-btn--black"
                          disabled={controlsBusy || busyAction === rowActionKey}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenSection(item.sid, "cards").catch(() => {});
                          }}
                        >
                          cards
                        </button>
                        <button
                          type="button"
                          className="ik-btn"
                          disabled={controlsBusy}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenSection(item.sid, "learn").catch(() => {});
                          }}
                        >
                          learn
                        </button>
                        <button
                          type="button"
                          className="ik-btn"
                          disabled={controlsBusy}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenSection(item.sid, "practice").catch(() => {});
                          }}
                        >
                          practice
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      {isView ? (
        <div className="tw-mt-4 tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white/80 tw-p-3">
          <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
            <label className="ik-label" htmlFor="dictReactViewSection">section</label>
            <select
              id="dictReactViewSection"
              className="ik-select"
              style={{ minWidth: "260px" }}
              value={viewSection}
              disabled={controlsBusy}
              onChange={(event) => {
                handleViewSectionChange(event.target.value).catch(() => {});
              }}
            >
              <option value="">choose section...</option>
              {viewSections.map((item) => (
                <option key={`view-opt:${item.sid}:${item.name}`} value={String(item.sid)}>
                  {item.name} ({item.count})
                </option>
              ))}
            </select>
            <span className="ik-spacer" aria-hidden="true" />
            <span className="ik-badge">{viewModel.meta}</span>
          </div>

          <div className="tw-mt-3">
            <input
              className="ik-input"
              type="search"
              value={viewQuery}
              placeholder="поиск по EN/RU..."
              disabled={controlsBusy}
              onChange={(event) => setViewQuery(event.target.value)}
            />
          </div>

          <div className="tw-mt-3">
            {loadingView ? (
              <p className="tw-m-0 tw-text-sm tw-text-slate-600">Загрузка слов...</p>
            ) : null}
            {!loadingView && viewModel.empty ? (
              <p className="tw-m-0 tw-text-sm tw-font-medium tw-text-slate-700">{viewModel.message}</p>
            ) : null}
            {!loadingView && !viewModel.empty ? (
              <ul className="ik-list dict-view-list">
                {viewModel.items.map((item) => (
                  <li key={`view-row:${item.id != null ? item.id : `${item.sectionId}:${item.en}:${item.ru}`}`}>
                    <p className="ik-itemline">
                      <b>{item.en}</b> - {item.ru}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      {isBuilder ? (
        <div className="tw-mt-4 tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white/80 tw-p-3">
          <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
            <button
              type="button"
              className="ik-btn"
              disabled={controlsBusy}
              onClick={async () => {
                setBusyAction("builder:sections");
                setErrorText("");
                try {
                  const next = await showDictionaryFirstPick();
                  setSnapshot(next);
                } catch (_err) {
                  setErrorText("Не удалось открыть список разделов.");
                } finally {
                  setBusyAction("");
                }
              }}
            >
              разделы
            </button>

            <span className="ik-badge">sections: {builderModel.counts.sections}</span>
            <span className="ik-badge">words: {builderModel.counts.words}</span>

            {builderModel.canSubmit ? (
              <button
                type="button"
                className="ik-btn ik-btn--black"
                title={builderModel.submitTitle || ""}
                disabled={controlsBusy}
                onClick={() => {
                  handleBuilderAction("submit", dictionaryBuilderSubmit).catch(() => {});
                }}
              >
                {builderModel.submitLabel || "submit"}
              </button>
            ) : null}
          </div>

          <div className="ik-divider" />

          <div className="ik-row" style={{ gap: "10px", flexWrap: "wrap" }}>
            <label className="ik-label" htmlFor="dictReactBuilderNewSection">новый раздел</label>
            <input
              id="dictReactBuilderNewSection"
              className="ik-input"
              style={{ minWidth: "280px" }}
              type="text"
              placeholder="название раздела"
              value={builderNewSectionName}
              disabled={controlsBusy || !builderModel.canCreateSection}
              onChange={(event) => setBuilderNewSectionName(event.target.value)}
            />
            <button
              type="button"
              className="ik-btn ik-btn--black"
              disabled={controlsBusy || !builderModel.canCreateSection}
              onClick={() => {
                handleBuilderAction("add-section", () => dictionaryBuilderAddSection(builderNewSectionName)).catch(() => {});
              }}
            >
              создать
            </button>
          </div>

          <div className="ik-row" style={{ gap: "10px", flexWrap: "wrap", marginTop: "10px" }}>
            <label className="ik-label" htmlFor="dictReactBuilderSection">section</label>
            <select
              id="dictReactBuilderSection"
              className="ik-select"
              style={{ minWidth: "260px" }}
              value={builderSection}
              disabled={controlsBusy}
              onChange={(event) => {
                handleBuilderSectionChange(event.target.value).catch(() => {});
              }}
            >
              <option value="">choose section...</option>
              {(builderModel.sections || []).map((item) => (
                <option key={`builder-opt:${item.sid}:${item.name}`} value={String(item.sid)}>
                  {item.name} ({item.count})
                </option>
              ))}
            </select>

            <button
              type="button"
              className="ik-btn"
              disabled={controlsBusy || !builderModel.canDeleteSection || !builderSection}
              onClick={() => {
                handleBuilderAction("delete-section", () => dictionaryBuilderDeleteSection(builderSection)).catch(() => {});
              }}
            >
              удалить раздел
            </button>

            <button
              type="button"
              className="ik-btn"
              disabled={controlsBusy || !builderModel.canImportExport || !builderSection}
              onClick={() => {
                handleBuilderAction("export", () => dictionaryBuilderExport(builderSection)).catch(() => {});
              }}
            >
              save db
            </button>

            <button
              type="button"
              className="ik-btn"
              disabled={controlsBusy || !builderModel.canImportExport}
              onClick={() => {
                const input = document.getElementById("dictReactBuilderImportFile");
                if (!input) return;
                input.value = "";
                input.click();
              }}
            >
              load db
            </button>

            <label className="ik-label" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={builderImportReplace}
                disabled={controlsBusy || !builderModel.canImportExport}
                onChange={(event) => setBuilderImportReplace(event.target.checked)}
              />
              replace existing
            </label>

            <input
              id="dictReactBuilderImportFile"
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(event) => {
                const file = event.target.files && event.target.files[0];
                if (!file) return;
                handleBuilderAction("import", () => dictionaryBuilderImport(file, builderImportReplace)).catch(() => {});
              }}
            />
          </div>

          <div className="ik-row" style={{ gap: "10px", flexWrap: "wrap", marginTop: "10px" }}>
            <input
              className="ik-input"
              style={{ minWidth: "260px" }}
              type="text"
              placeholder="word/phrase (EN)"
              value={builderEn}
              disabled={controlsBusy || !builderModel.canEditWords}
              onChange={(event) => setBuilderEn(event.target.value)}
            />
            <input
              className="ik-input"
              style={{ minWidth: "260px" }}
              type="text"
              placeholder="перевод (RU)"
              value={builderRu}
              disabled={controlsBusy || !builderModel.canEditWords}
              onChange={(event) => setBuilderRu(event.target.value)}
            />
            <button
              type="button"
              className="ik-btn ik-btn--black"
              disabled={controlsBusy || !builderModel.canEditWords}
              onClick={() => {
                handleBuilderAction("add-word", () => dictionaryBuilderAddWord(builderSection, builderEn, builderRu)).catch(() => {});
              }}
            >
              сохранить
            </button>
          </div>

          <div className="tw-mt-3">
            {loadingBuilder ? (
              <p className="tw-m-0 tw-text-sm tw-text-slate-600">Загрузка constructor...</p>
            ) : null}

            {!loadingBuilder && builderModel.readOnlyMessage ? (
              <p className="tw-m-0 tw-text-sm tw-font-medium tw-text-slate-700">{builderModel.readOnlyMessage}</p>
            ) : null}

            {!loadingBuilder && !builderModel.readOnlyMessage && !builderSection ? (
              <p className="tw-m-0 tw-text-sm tw-font-medium tw-text-slate-700">выбери раздел</p>
            ) : null}

            {!loadingBuilder && !builderModel.readOnlyMessage && builderSection && (!Array.isArray(builderModel.words) || builderModel.words.length === 0) ? (
              <p className="tw-m-0 tw-text-sm tw-font-medium tw-text-slate-700">пусто - добавь слова выше</p>
            ) : null}

            {!loadingBuilder && !builderModel.readOnlyMessage && builderSection && Array.isArray(builderModel.words) && builderModel.words.length > 0 ? (
              <ul className="ik-list">
                {builderModel.words.map((word) => (
                  <li key={`builder-word:${word.id != null ? word.id : `${word.sectionId}:${word.en}:${word.ru}`}`}>
                    <div>
                      <p className="ik-itemline">
                        <b>{word.en}</b> - {word.ru}
                      </p>
                    </div>
                    <div className="ik-mini">
                      <button
                        type="button"
                        className="ik-btn"
                        disabled={controlsBusy || !builderModel.canEditWords}
                        onClick={() => {
                          handleBuilderAction("delete-word", () => dictionaryBuilderDeleteWord(word.id)).catch(() => {});
                        }}
                      >
                        удалить
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      {isCards ? (
        <div className="tw-mt-4 tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white/80 tw-p-3">
          <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
            <button
              type="button"
              className="ik-btn"
              disabled={controlsBusy}
              onClick={async () => {
                setBusyAction("cards:sections");
                setErrorText("");
                try {
                  const next = await showDictionaryFirstPick();
                  setSnapshot(next);
                } catch (_err) {
                  setErrorText("Не удалось открыть список разделов.");
                } finally {
                  setBusyAction("");
                }
              }}
            >
              разделы
            </button>

            <button
              type="button"
              className="ik-btn"
              disabled={controlsBusy}
              onClick={() => {
                handleCardsAction("prev", dictionaryCardsPrev).catch(() => {});
              }}
            >
              назад
            </button>

            <button
              type="button"
              className="ik-btn ik-btn--black"
              disabled={controlsBusy}
              onClick={() => {
                handleCardsAction("next", dictionaryCardsNext).catch(() => {});
              }}
            >
              далее
            </button>

            <label className="ik-label" htmlFor="dictReactCardsRandom">
              <input
                id="dictReactCardsRandom"
                type="checkbox"
                checked={cardsModel.random}
                disabled={controlsBusy}
                onChange={(event) => {
                  handleCardsAction("random", () => setDictionaryCardsRandom(event.target.checked)).catch(() => {});
                }}
              />{" "}
              random
            </label>

            <label className="ik-label" htmlFor="dictReactCardsFront">front</label>
            <select
              id="dictReactCardsFront"
              className="ik-select"
              style={{ minWidth: "150px" }}
              value={cardsModel.frontPreference}
              disabled={controlsBusy}
              onChange={(event) => {
                handleCardsAction("front", () => setDictionaryCardsFront(event.target.value)).catch(() => {});
              }}
            >
              <option value="en">англ</option>
              <option value="ru">рус</option>
              <option value="mix">mix</option>
            </select>

            <span className="ik-spacer" aria-hidden="true" />

            <label className="ik-label" htmlFor="dictReactCardsSection">section</label>
            <select
              id="dictReactCardsSection"
              className="ik-select"
              style={{ minWidth: "260px" }}
              value={cardsSection}
              disabled={controlsBusy}
              onChange={(event) => {
                handleCardsSectionChange(event.target.value).catch(() => {});
              }}
            >
              <option value="">choose section...</option>
              {cardsSections.map((item) => (
                <option key={`cards-opt:${item.sid}:${item.name}`} value={String(item.sid)}>
                  {item.name} ({item.count})
                </option>
              ))}
            </select>
          </div>

          <div className="ik-divider" />

          <p className="ik-prompt">нажми на карточку чтобы перевернуть</p>

          <div className="ik-flip-stage" aria-label="Flashcard">
            <div
              className={`ik-flip-card ${cardsModel.flipped ? "is-flipped" : ""}`}
              role="button"
              tabIndex={0}
              aria-pressed={cardsModel.flipped ? "true" : "false"}
              onClick={() => {
                handleCardsAction("flip", dictionaryCardsToggleFlip).catch(() => {});
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleCardsAction("flip", dictionaryCardsToggleFlip).catch(() => {});
                }
              }}
            >
              <div className="ik-flip-inner">
                <div className="ik-flip-face ik-flip-front">
                  <p className="ik-word">{cardsModel.frontText || "..."}</p>
                  <p className="ik-sub ik-muted">{cardsModel.frontLang || ""}</p>
                </div>
                <div className="ik-flip-face ik-flip-back">
                  <p className="ik-word">{cardsModel.backText || "..."}</p>
                  <p className="ik-sub ik-muted">{cardsModel.backLang || ""}</p>
                </div>
              </div>
            </div>
          </div>

          <p className="ik-footnote">{cardsModel.meta || ""}</p>

          {cardsModel.done ? (
            <div className="ik-row" style={{ justifyContent: "center", gap: "10px", marginTop: "8px" }}>
              <span className="ik-footnote">вы просмотрели все слова</span>
              <button
                type="button"
                className="ik-btn ik-btn--black"
                disabled={controlsBusy}
                onClick={() => {
                  handleCardsAction("restart", dictionaryCardsRestart).catch(() => {});
                }}
              >
                еще раз
              </button>
            </div>
          ) : null}

          {loadingCards ? <p className="tw-m-0 tw-mt-2 tw-text-sm tw-text-slate-600">Загрузка карточек...</p> : null}
        </div>
      ) : null}

      {isLearn ? (
        <div className="tw-mt-4 tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white/80 tw-p-3">
          <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
            <button
              type="button"
              className="ik-btn"
              disabled={controlsBusy}
              onClick={async () => {
                setBusyAction("learn:sections");
                setErrorText("");
                try {
                  const next = await showDictionaryFirstPick();
                  setSnapshot(next);
                } catch (_err) {
                  setErrorText("Не удалось открыть список разделов.");
                } finally {
                  setBusyAction("");
                }
              }}
            >
              разделы
            </button>

            <span className="ik-badge">{learnModel.progress || "0/0"}</span>

            <button
              type="button"
              className="ik-btn"
              disabled={controlsBusy}
              onClick={() => {
                handleLearnAction("settings", () => toggleDictionaryLearnSettings()).catch(() => {});
              }}
              title="Настройки learn"
            >
              ⚙
            </button>

            <button
              type="button"
              className="ik-btn ik-btn--black"
              disabled={controlsBusy}
              onClick={() => {
                handleLearnAction("start", startDictionaryLearnSession).catch(() => {});
              }}
            >
              start
            </button>

            <span className="ik-spacer" aria-hidden="true" />

            <label className="ik-label" htmlFor="dictReactLearnSection">section</label>
            <select
              id="dictReactLearnSection"
              className="ik-select"
              style={{ minWidth: "260px" }}
              value={learnSection}
              disabled={controlsBusy}
              onChange={(event) => {
                handleLearnSectionChange(event.target.value).catch(() => {});
              }}
            >
              <option value="">choose section...</option>
              {learnSections.map((item) => (
                <option key={`learn-opt:${item.sid}:${item.name}`} value={String(item.sid)}>
                  {item.name} ({item.count})
                </option>
              ))}
            </select>
          </div>

          {learnModel.settingsOpen ? (
            <div style={{ margin: "10px 0 6px 0" }}>
              <div className="ik-row" style={{ gap: "12px", flexWrap: "wrap" }}>
                <label className="ik-label" htmlFor="dictReactLearnSource">источник</label>
                <select
                  id="dictReactLearnSource"
                  className="ik-select"
                  style={{ minWidth: "180px" }}
                  value={String(learnModel.settings.source || "new")}
                  disabled={controlsBusy}
                  onChange={(event) => updateLearnConfig({ source: event.target.value })}
                >
                  <option value="new">новые</option>
                  <option value="due">пора повторить</option>
                  <option value="weak">слабые</option>
                  <option value="all">все</option>
                </select>

                <label className="ik-label" htmlFor="dictReactLearnPortion">порция</label>
                <select
                  id="dictReactLearnPortion"
                  className="ik-select"
                  style={{ minWidth: "120px" }}
                  value={String(learnModel.settings.portion || "8")}
                  disabled={controlsBusy}
                  onChange={(event) => updateLearnConfig({ portion: event.target.value })}
                >
                  <option value="5">5</option>
                  <option value="8">8</option>
                  <option value="10">10</option>
                  <option value="12">12</option>
                </select>

                <label className="ik-label" htmlFor="dictReactLearnDir">направление</label>
                <select
                  id="dictReactLearnDir"
                  className="ik-select"
                  style={{ minWidth: "180px" }}
                  value={String(learnModel.settings.dir || "ru")}
                  disabled={controlsBusy}
                  onChange={(event) => updateLearnConfig({ dir: event.target.value })}
                >
                  <option value="ru">RU -&gt; EN</option>
                  <option value="en">EN -&gt; RU</option>
                  <option value="mix">mix</option>
                  <option value="weak">по слабым</option>
                </select>

                <label className="ik-label" htmlFor="dictReactLearnGoal">цель</label>
                <select
                  id="dictReactLearnGoal"
                  className="ik-select"
                  style={{ minWidth: "180px" }}
                  value={String(learnModel.settings.goal || "fast")}
                  disabled={controlsBusy}
                  onChange={(event) => updateLearnConfig({ goal: event.target.value })}
                >
                  <option value="fast">быстрое закрепление</option>
                  <option value="long">долгосрочная память</option>
                </select>

                <label className="ik-label" htmlFor="dictReactLearnStrict">строгость</label>
                <select
                  id="dictReactLearnStrict"
                  className="ik-select"
                  style={{ minWidth: "140px" }}
                  value={String(learnModel.settings.strict || "soft")}
                  disabled={controlsBusy}
                  onChange={(event) => updateLearnConfig({ strict: event.target.value })}
                >
                  <option value="soft">мягко</option>
                  <option value="strict">строго</option>
                </select>

                <label className="ik-label" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={learnModel.settings.typos !== false}
                    disabled={controlsBusy}
                    onChange={(event) => updateLearnConfig({ typos: event.target.checked })}
                  />
                  опечатки
                </label>

                <label className="ik-label" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={learnModel.settings.acceptForms !== false}
                    disabled={controlsBusy}
                    onChange={(event) => updateLearnConfig({ acceptForms: event.target.checked })}
                  />
                  принимать формы
                </label>

                <label className="ik-label" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={learnModel.settings.ignoreTo !== false}
                    disabled={controlsBusy}
                    onChange={(event) => updateLearnConfig({ ignoreTo: event.target.checked })}
                  />
                  "to" не обяз.
                </label>

                <label className="ik-label" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={learnModel.settings.ignoreArticles !== false}
                    disabled={controlsBusy}
                    onChange={(event) => updateLearnConfig({ ignoreArticles: event.target.checked })}
                  />
                  артикли не обяз.
                </label>

                <label className="ik-label" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={learnModel.settings.hints !== false}
                    disabled={controlsBusy}
                    onChange={(event) => updateLearnConfig({ hints: event.target.checked })}
                  />
                  подсказки
                </label>

                <label className="ik-label" htmlFor="dictReactLearnIntroMode">этап 1</label>
                <select
                  id="dictReactLearnIntroMode"
                  className="ik-select"
                  style={{ minWidth: "220px" }}
                  value={String(learnModel.settings.introMode || "card")}
                  disabled={controlsBusy}
                  onChange={(event) => updateLearnConfig({ introMode: event.target.value })}
                >
                  <option value="card">Card</option>
                  <option value="mcq">Выбор правильного ответа</option>
                  <option value="mix">Mix</option>
                </select>

                <label className="ik-label" htmlFor="dictReactLearnIntroMcqCount">вариантов</label>
                <select
                  id="dictReactLearnIntroMcqCount"
                  className="ik-select"
                  style={{ minWidth: "120px" }}
                  value={String(learnModel.settings.introMcqCount || 4)}
                  disabled={controlsBusy}
                  onChange={(event) => updateLearnConfig({ introMcqCount: Number(event.target.value || 4) })}
                >
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                  <option value="6">6</option>
                  <option value="7">7</option>
                  <option value="8">8</option>
                </select>

                <label className="ik-label" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={learnModel.settings.introShowPos === true}
                    disabled={controlsBusy}
                    onChange={(event) => updateLearnConfig({ introShowPos: event.target.checked })}
                  />
                  показывать (v)/(n)
                </label>
              </div>
              <p className="ik-footnote" style={{ marginTop: "6px" }}>настройки сохраняются в браузере</p>
            </div>
          ) : null}

          <div className="ik-divider" />

          <p className="ik-prompt">{learnModel.prompt || "..."}</p>

          <div className="ik-flip-stage" aria-label="Learn card">
            <div
              className={`ik-flip-card ${learnModel.flipped ? "is-flipped" : ""}`}
              role="button"
              tabIndex={0}
              aria-pressed={learnModel.flipped ? "true" : "false"}
              onClick={() => {
                if (learnModel.checkMode !== "next") return;
                handleLearnAction("flip", dictionaryLearnToggleFlip).catch(() => {});
              }}
              onKeyDown={(event) => {
                if (learnModel.checkMode !== "next") return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleLearnAction("flip", dictionaryLearnToggleFlip).catch(() => {});
                }
              }}
            >
              <div className="ik-flip-inner">
                <div className="ik-flip-face ik-flip-front">
                  <p className="ik-word">{learnModel.frontText || "..."}</p>
                  <p className="ik-sub ik-muted">{learnModel.frontLang || ""}</p>
                </div>
                <div className="ik-flip-face ik-flip-back">
                  <p className="ik-word">{learnModel.backText || "..."}</p>
                  <p className="ik-sub ik-muted">{learnModel.backLang || ""}</p>
                </div>
              </div>
            </div>
          </div>

          {learnModel.mcq.visible ? (
            <div style={{ marginTop: "10px" }}>
              {learnModel.mcq.meta ? <p className="ik-footnote ik-muted">{learnModel.mcq.meta}</p> : null}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
                {(learnModel.mcq.options || []).map((opt) => {
                  const style = {};
                  if (opt.correct) {
                    style.border = "2px solid #2ecc71";
                    style.background = "rgba(46,204,113,0.16)";
                  } else if (opt.selected && !opt.correct) {
                    style.border = "2px solid #e74c3c";
                    style.background = "rgba(231,76,60,0.16)";
                  } else if (learnModel.mcq.locked) {
                    style.opacity = 0.75;
                  }
                  return (
                    <button
                      key={`learn-mcq-${opt.index}`}
                      type="button"
                      className="ik-btn"
                      style={style}
                      disabled={controlsBusy || learnModel.mcq.locked}
                      onClick={() => {
                        handleLearnAction("mcq", () => dictionaryLearnIntroMcqSelect(opt.index)).catch(() => {});
                      }}
                    >
                      {`${Number(opt.index) + 1}. ${opt.text}`}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {learnModel.input.visible ? (
            <div className="ik-row" style={{ marginTop: "12px" }}>
              <input
                className={`ik-input${learnModel.input.isOk ? " is-ok" : ""}${learnModel.input.isBad ? " is-bad" : ""}`}
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder={learnModel.input.placeholder || "Введите перевод..."}
                value={learnAnswer}
                disabled={controlsBusy || learnModel.input.disabled}
                onChange={(event) => setLearnAnswer(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  handleLearnAction("check", async () => {
                    await setDictionaryLearnAnswer(learnAnswer);
                    return dictionaryLearnCheckOrNext();
                  }).catch(() => {});
                }}
              />
            </div>
          ) : null}

          <div className="ik-row" style={{ marginTop: "10px" }}>
            <button
              type="button"
              className="ik-btn ik-btn--black"
              disabled={controlsBusy}
              onClick={() => {
                handleLearnAction("check", async () => {
                  if (learnModel.input.visible) {
                    await setDictionaryLearnAnswer(learnAnswer);
                  }
                  return dictionaryLearnCheckOrNext();
                }).catch(() => {});
              }}
            >
              {learnModel.checkLabel || "check"}
            </button>

            {learnModel.hintVisible ? (
              <button
                type="button"
                className="ik-btn"
                disabled={controlsBusy}
                onClick={() => {
                  handleLearnAction("hint", dictionaryLearnHint).catch(() => {});
                }}
              >
                hint
              </button>
            ) : null}

            {learnModel.giveUpVisible ? (
              <button
                type="button"
                className="ik-btn"
                disabled={controlsBusy}
                onClick={() => {
                  handleLearnAction("giveup", dictionaryLearnGiveUp).catch(() => {});
                }}
              >
                {learnModel.giveUpLabel || "сдаюсь"}
              </button>
            ) : null}
          </div>

          <div className="ik-divider" />

          <div className="ik-feedback" data-state={learnModel.feedback.state || "idle"} aria-live="polite">
            <div className="ik-feedback__stamp">{learnModel.feedback.stamp || "ready"}</div>
            <p className="ik-feedback__line">{learnModel.feedback.line || "нажми start или выбери section"}</p>
          </div>

          <p className="ik-footnote">если ошибся, слово вернется позже; иногда нужен retype перед продолжением.</p>

          {loadingLearn ? <p className="tw-m-0 tw-mt-2 tw-text-sm tw-text-slate-600">Загрузка learn...</p> : null}
        </div>
      ) : null}

      {isPractice ? (
        <div className="tw-mt-4 tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white/80 tw-p-3">
          <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
            <button
              type="button"
              className="ik-btn"
              disabled={controlsBusy}
              onClick={async () => {
                setBusyAction("practice:sections");
                setErrorText("");
                try {
                  const next = await showDictionaryFirstPick();
                  setSnapshot(next);
                } catch (_err) {
                  setErrorText("Не удалось открыть список разделов.");
                } finally {
                  setBusyAction("");
                }
              }}
            >
              разделы
            </button>

            <label className="ik-label" htmlFor="dictReactPracticeMode">направление</label>
            <select
              id="dictReactPracticeMode"
              className="ik-select"
              style={{ minWidth: "180px" }}
              value={practiceModel.mode}
              disabled={controlsBusy}
              onChange={(event) => {
                handlePracticeAction("mode", () => setDictionaryPracticeMode(event.target.value)).catch(() => {});
              }}
            >
              <option value="en">EN -&gt; RU</option>
              <option value="ru">RU -&gt; EN</option>
              <option value="mix">mix</option>
              <option value="weak">по слабым</option>
            </select>

            <span className="ik-badge">{practiceModel.score}</span>

            <button
              type="button"
              className="ik-btn"
              disabled={controlsBusy}
              onClick={() => {
                handlePracticeAction("settings", () => toggleDictionaryPracticeSettings()).catch(() => {});
              }}
              title="Настройки practice"
            >
              ⚙
            </button>

            <span className="ik-spacer" aria-hidden="true" />

            <label className="ik-label" htmlFor="dictReactPracticeSection">section</label>
            <select
              id="dictReactPracticeSection"
              className="ik-select"
              style={{ minWidth: "260px" }}
              value={practiceSection}
              disabled={controlsBusy}
              onChange={(event) => {
                handlePracticeSectionChange(event.target.value).catch(() => {});
              }}
            >
              <option value="">choose section...</option>
              {practiceSections.map((item) => (
                <option key={`practice-opt:${item.sid}:${item.name}`} value={String(item.sid)}>
                  {item.name} ({item.count})
                </option>
              ))}
            </select>
          </div>

          {practiceModel.settingsOpen ? (
            <div style={{ margin: "10px 0 6px 0" }}>
              <div className="ik-row" style={{ gap: "12px", flexWrap: "wrap" }}>
                <label className="ik-label" htmlFor="dictReactPracticeSession">сессия</label>
                <select
                  id="dictReactPracticeSession"
                  className="ik-select"
                  style={{ minWidth: "120px" }}
                  value={String(practiceModel.settings.session || "20")}
                  disabled={controlsBusy}
                  onChange={(event) => {
                    updatePracticeConfig({ session: event.target.value });
                  }}
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="all">all</option>
                </select>

                <label className="ik-label" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={practiceModel.settings.typos}
                    disabled={controlsBusy}
                    onChange={(event) => updatePracticeConfig({ typos: event.target.checked })}
                  />
                  опечатки
                </label>

                <label className="ik-label" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={practiceModel.settings.ignoreTo}
                    disabled={controlsBusy}
                    onChange={(event) => updatePracticeConfig({ ignoreTo: event.target.checked })}
                  />
                  "to" не обяз.
                </label>

                <label className="ik-label" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={practiceModel.settings.ignoreArticles}
                    disabled={controlsBusy}
                    onChange={(event) => updatePracticeConfig({ ignoreArticles: event.target.checked })}
                  />
                  артикли не обяз.
                </label>

                <label className="ik-label" htmlFor="dictReactPracticeTaskMode">тип заданий</label>
                <select
                  id="dictReactPracticeTaskMode"
                  className="ik-select"
                  style={{ minWidth: "220px" }}
                  value={String(practiceModel.settings.taskMode || "mix")}
                  disabled={controlsBusy}
                  onChange={(event) => updatePracticeConfig({ taskMode: event.target.value })}
                >
                  <option value="input">Написание ответа</option>
                  <option value="mcq">Выбор правильного ответа</option>
                  <option value="mix">Микс</option>
                </select>

                <label className="ik-label" htmlFor="dictReactPracticeMixInputPct">в миксе: % ввод</label>
                <select
                  id="dictReactPracticeMixInputPct"
                  className="ik-select"
                  style={{ minWidth: "120px" }}
                  value={String(practiceModel.settings.mixInputPct || 60)}
                  disabled={controlsBusy}
                  onChange={(event) => updatePracticeConfig({ mixInputPct: Number(event.target.value || 60) })}
                >
                  <option value="50">50</option>
                  <option value="60">60</option>
                  <option value="70">70</option>
                  <option value="80">80</option>
                </select>

                <label className="ik-label" htmlFor="dictReactPracticeMcqCount">вариантов</label>
                <select
                  id="dictReactPracticeMcqCount"
                  className="ik-select"
                  style={{ minWidth: "120px" }}
                  value={String(practiceModel.settings.mcqCount || 4)}
                  disabled={controlsBusy}
                  onChange={(event) => updatePracticeConfig({ mcqCount: Number(event.target.value || 4) })}
                >
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                  <option value="6">6</option>
                  <option value="7">7</option>
                  <option value="8">8</option>
                </select>

                <label className="ik-label" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={practiceModel.settings.showPos}
                    disabled={controlsBusy}
                    onChange={(event) => updatePracticeConfig({ showPos: event.target.checked })}
                  />
                  показывать (v)/(n)
                </label>

                <label className="ik-label" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={practiceModel.settings.softMcq}
                    disabled={controlsBusy}
                    onChange={(event) => updatePracticeConfig({ softMcq: event.target.checked })}
                  />
                  MCQ влияет мягче
                </label>
              </div>
              <p className="ik-footnote" style={{ marginTop: "6px" }}>настройки сохраняются в браузере</p>
            </div>
          ) : null}

          <div className="ik-divider" />

          <p className="ik-prompt">{practiceModel.prompt || "переведи"}</p>

          <div className="ik-flip-stage" aria-label="Quiz card">
            <div
              className={`ik-flip-card ${practiceModel.flipped ? "is-flipped" : ""}`}
              role="button"
              tabIndex={0}
              aria-pressed={practiceModel.flipped ? "true" : "false"}
              onClick={() => {
                if (practiceModel.checkMode !== "next") return;
                handlePracticeAction("flip", dictionaryPracticeToggleFlip).catch(() => {});
              }}
              onKeyDown={(event) => {
                if (practiceModel.checkMode !== "next") return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handlePracticeAction("flip", dictionaryPracticeToggleFlip).catch(() => {});
                }
              }}
            >
              <div className="ik-flip-inner">
                <div className="ik-flip-face ik-flip-front">
                  <p className="ik-word">{practiceModel.frontText || "..."}</p>
                  <p className="ik-sub ik-muted">{practiceModel.frontLang || ""}</p>
                </div>
                <div className="ik-flip-face ik-flip-back">
                  <p className="ik-word">{practiceModel.backText || "..."}</p>
                  <p className="ik-sub ik-muted">{practiceModel.backLang || ""}</p>
                </div>
              </div>
            </div>
          </div>

          {practiceModel.mcq.visible ? (
            <div style={{ marginTop: "10px" }}>
              {practiceModel.mcq.meta ? <p className="ik-footnote ik-muted">{practiceModel.mcq.meta}</p> : null}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
                {(practiceModel.mcq.options || []).map((opt) => {
                  const style = {};
                  if (opt.correct) {
                    style.border = "2px solid #2ecc71";
                    style.background = "rgba(46,204,113,0.16)";
                  } else if (opt.selected && !opt.correct) {
                    style.border = "2px solid #e74c3c";
                    style.background = "rgba(231,76,60,0.16)";
                  } else if (practiceModel.mcq.locked) {
                    style.opacity = 0.75;
                  }
                  return (
                    <button
                      key={`practice-mcq-${opt.index}`}
                      type="button"
                      className="ik-btn"
                      style={style}
                      disabled={controlsBusy || practiceModel.mcq.locked}
                      onClick={() => {
                        handlePracticeAction("mcq", () => dictionaryPracticeMcqSelect(opt.index)).catch(() => {});
                      }}
                    >
                      {`${Number(opt.index) + 1}. ${opt.text}`}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {practiceModel.input.visible ? (
            <div className="ik-row" style={{ marginTop: "12px" }}>
              <input
                className={`ik-input${practiceModel.input.isOk ? " is-ok" : ""}${practiceModel.input.isBad ? " is-bad" : ""}`}
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder={practiceModel.input.placeholder || "Ответ"}
                value={practiceAnswer}
                disabled={controlsBusy || practiceModel.input.disabled}
                onChange={(event) => setPracticeAnswer(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  handlePracticeAction("check", async () => {
                    await setDictionaryPracticeAnswer(practiceAnswer);
                    return dictionaryPracticeCheckOrNext();
                  }).catch(() => {});
                }}
              />
            </div>
          ) : null}

          <div className="ik-row" style={{ marginTop: "10px" }}>
            <button
              type="button"
              className="ik-btn ik-btn--black"
              disabled={controlsBusy}
              onClick={() => {
                handlePracticeAction("check", async () => {
                  if (practiceModel.input.visible) {
                    await setDictionaryPracticeAnswer(practiceAnswer);
                  }
                  return dictionaryPracticeCheckOrNext();
                }).catch(() => {});
              }}
            >
              {practiceModel.checkLabel || "check"}
            </button>

            {practiceModel.hintVisible ? (
              <button
                type="button"
                className="ik-btn"
                disabled={controlsBusy}
                onClick={() => {
                  handlePracticeAction("hint", dictionaryPracticeUseHint).catch(() => {});
                }}
              >
                hint
              </button>
            ) : null}

            <button
              type="button"
              className="ik-btn"
              disabled={controlsBusy}
              onClick={() => {
                handlePracticeAction("skip", dictionaryPracticeSkip).catch(() => {});
              }}
            >
              {practiceModel.skipLabel || "сдаюсь"}
            </button>
          </div>

          {practiceModel.fuzzyVisible ? (
            <div className="ik-row" style={{ justifyContent: "center", gap: "10px", marginTop: "10px" }}>
              <button
                type="button"
                className="ik-btn ik-btn--black"
                disabled={controlsBusy}
                onClick={() => {
                  handlePracticeAction("fuzzy-accept", () => dictionaryPracticeFuzzyResolve(true)).catch(() => {});
                }}
              >
                засчитать
              </button>
              <button
                type="button"
                className="ik-btn"
                disabled={controlsBusy}
                onClick={() => {
                  handlePracticeAction("fuzzy-reject", () => dictionaryPracticeFuzzyResolve(false)).catch(() => {});
                }}
              >
                не засчитывать
              </button>
            </div>
          ) : null}

          <div className="ik-divider" />

          <div className="ik-feedback" data-state={practiceModel.feedback.state || "idle"} aria-live="polite">
            <div className="ik-feedback__stamp">{practiceModel.feedback.stamp || "ready"}</div>
            <p className="ik-feedback__line">{practiceModel.feedback.line || "введи перевод и нажми check"}</p>
          </div>

          <p className="ik-footnote">правило: после проверки переписать нельзя - только далее. неверные слова вернутся позже.</p>

          {loadingPractice ? <p className="tw-m-0 tw-mt-2 tw-text-sm tw-text-slate-600">Загрузка practice...</p> : null}
        </div>
      ) : null}

      <div className="tw-mt-4 tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white/80 tw-p-3 tw-text-xs tw-text-slate-600">
        <p className="tw-m-0">Runtime: {snapshot.booted ? "booted" : "booting"} | source: {snapshot.source} | subtab: {snapshot.subtab}</p>
        <p className="tw-m-0">
          can manage system: {snapshot.capabilities.canManageSystemDicts ? "yes" : "no"} | can manage user: {snapshot.capabilities.canManageUserDicts ? "yes" : "no"}
        </p>
        {errorText ? <p className="tw-m-0 tw-text-rose-600">{errorText}</p> : null}
      </div>
    </section>,
    hostEl,
  );
}
