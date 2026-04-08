import Head from "next/head";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

const THEME_BOOTSTRAP_SCRIPT = `
(function() {
  var key = "ik_site_theme_v1";
  var stored = null;
  try { stored = localStorage.getItem(key); } catch (e) {}
  var theme = (stored === "dark" || stored === "light")
    ? stored
    : ((window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
})();
`;

const LS = {
  fontSize: "whisperer_font_size_simple_v1",
  rate: "whisperer_rate_simple_v1",
  pitch: "whisperer_pitch_simple_v1",
  volume: "whisperer_volume_simple_v1",
  voiceEn: "whisperer_voice_en_simple_v1",
  voiceRu: "whisperer_voice_ru_simple_v1",
  voiceBe: "whisperer_voice_be_simple_v1",
};

const INBOUND_KEY = "onoi_whisper_payload_v1";

let notesLoaderPromise = null;
async function loadNotesModule() {
  if (!notesLoaderPromise) {
    notesLoaderPromise = import("../../../lib/whisperer/notes-loader");
  }
  return notesLoaderPromise;
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeText(input) {
  return String(input || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00A0/g, " ");
}

function preprocessForSpeech(raw) {
  let text = normalizeText(raw);
  text = text.replace(/([.!?…]+["'”’»)\]\}]+)(?=[A-Za-zА-Яа-яЁё])/g, "$1 ");
  text = text.replace(/([.!?…]+)(?=[A-Za-zА-Яа-яЁё])/g, "$1 ");
  text = text.replace(/([,;:]+["'”’»)\]\}]+)(?=[A-Za-zА-Яа-яЁё])/g, "$1 ");
  text = text.replace(/([,;:]+)(?=[A-Za-zА-Яа-яЁё])/g, "$1 ");
  text = text.replace(/([\-–—])(?=[A-Za-zА-Яа-яЁё])/g, "$1 ");
  return text;
}

function detectLangForWord(word, fallback) {
  const source = String(word || "");
  const hasCyr = /[\u0400-\u04FF]/.test(source);
  const hasLat = /[A-Za-z]/.test(source);
  const hasBe = /[ўЎіІ]/.test(source);

  if (hasCyr && !hasLat) return hasBe ? "be" : "ru";
  if (hasLat && !hasCyr) return "en";
  if (hasCyr && hasLat) return "en";
  return fallback || "en";
}

function parseText(raw) {
  const prepared = preprocessForSpeech(raw);
  const tokenStrings = prepared.match(/\S+|\s+/g) || [];

  const tokens = [];
  const words = [];
  const trails = [];

  for (let i = 0; i < tokenStrings.length; i += 1) {
    const token = tokenStrings[i];
    if (/^\s+$/.test(token)) {
      tokens.push({ type: "space", value: token });
      continue;
    }

    const wordIndex = words.length;
    words.push(token);

    const next = tokenStrings[i + 1];
    const trail = next && /^\s+$/.test(next) ? next : "";
    trails.push(trail);

    tokens.push({ type: "word", value: token, wordIndex });
  }

  const wordLang = [];
  let prev = "en";
  for (let i = 0; i < words.length; i += 1) {
    const lang = detectLangForWord(words[i], prev);
    wordLang.push(lang);
    prev = lang;
  }

  const hasEn = wordLang.includes("en");
  const hasRu = wordLang.includes("ru");
  const hasBe = wordLang.includes("be");

  let langLabel = "lang: auto";
  if (hasEn && hasRu && hasBe) langLabel = "lang: auto (EN+RU+BE)";
  else if (hasEn && hasRu) langLabel = "lang: auto (EN+RU)";
  else if (hasRu && hasBe) langLabel = "lang: auto (RU+BE)";
  else if (hasEn && hasBe) langLabel = "lang: auto (EN+BE)";
  else if (hasBe) langLabel = "lang: auto (BE)";
  else if (hasRu) langLabel = "lang: auto (RU)";
  else if (words.length > 0) langLabel = "lang: auto (EN)";

  return {
    prepared,
    tokens,
    words,
    trails,
    wordLang,
    langLabel,
  };
}

function isSentenceEnd(word) {
  return /[.!?…][\)\]\}"'»”’]*$/.test(String(word || ""));
}

function isParagraphBreak(trail) {
  const text = String(trail || "");
  const lineBreaks = text.match(/\n/g);
  return (lineBreaks ? lineBreaks.length : 0) >= 2;
}

function segmentLang(wordLang, start, end) {
  let ru = 0;
  let en = 0;
  let be = 0;
  for (let i = start; i <= end; i += 1) {
    if (wordLang[i] === "be") be += 1;
    else if (wordLang[i] === "ru") ru += 1;
    else en += 1;
  }
  const max = Math.max(ru, en, be);
  if (be === max && be > 0) return "be";
  if (ru === max) return "ru";
  return "en";
}

function buildSegments(parsed, fromWordIndex) {
  const words = parsed.words;
  const trails = parsed.trails;
  const wordLang = parsed.wordLang;

  if (!words.length) return [];

  const startAt = Math.min(words.length - 1, Math.max(0, Number(fromWordIndex) || 0));
  const segments = [];
  let segmentStart = startAt;

  for (let i = startAt; i < words.length; i += 1) {
    const boundary =
      isSentenceEnd(words[i]) ||
      isParagraphBreak(trails[i]) ||
      i === words.length - 1;

    if (!boundary) continue;

    const startWord = segmentStart;
    const endWord = i;

    let text = "";
    const wordStartsInSegment = [];

    for (let k = startWord; k <= endWord; k += 1) {
      wordStartsInSegment.push(text.length);
      text += `${words[k]}${trails[k] || " "}`;
    }

    segments.push({
      text: text.trimEnd(),
      lang: segmentLang(wordLang, startWord, endWord),
      startWord,
      wordStartsInSegment,
    });

    segmentStart = i + 1;
  }

  return segments;
}

function wordFromBoundary(segment, charIndex) {
  const starts = segment.wordStartsInSegment;
  let lo = 0;
  let hi = starts.length - 1;
  let answer = 0;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] <= charIndex) {
      answer = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return segment.startWord + answer;
}

function asVoiceArray(value) {
  if (Array.isArray(value)) return value;
  try {
    return Array.from(value || []);
  } catch (_) {
    return [];
  }
}

function pickVoiceForLang(lang, settings) {
  const { voices, voiceEn, voiceRu, voiceBe } = settings;
  const list = asVoiceArray(voices);

  const isBe = lang === "be";
  const isRu = lang === "ru";
  const forced = isBe ? voiceBe : isRu ? voiceRu : voiceEn;
  const prefix = isBe ? "be" : isRu ? "ru" : "en";

  if (forced && forced !== "__auto__") {
    return list.find((voice) => voice.name === forced) || null;
  }

  let byLang = list.filter((voice) =>
    String(voice.lang || "").toLowerCase().startsWith(prefix)
  );

  if (isBe && !byLang.length) {
    byLang = list.filter((voice) =>
      String(voice.lang || "").toLowerCase().startsWith("ru")
    );
  }

  const defaultVoice = byLang.find((voice) => !!voice.default);
  return defaultVoice || byLang[0] || null;
}

function useStoredNumber(key, fallback, min, max) {
  const [value, setValue] = useState(fallback);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        setValue(clampNumber(raw, min, max, fallback));
      }
    } catch (_) {}
    hydratedRef.current = true;
  }, [key, fallback, min, max]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hydratedRef.current) return;
    try {
      window.localStorage.setItem(key, String(clampNumber(value, min, max, fallback)));
    } catch (_) {}
  }, [key, value, fallback, min, max]);

  return [value, setValue];
}

function useStoredString(key, fallback) {
  const [value, setValue] = useState(fallback);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        setValue(String(raw || fallback));
      }
    } catch (_) {}
    hydratedRef.current = true;
  }, [key, fallback]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hydratedRef.current) return;
    try {
      window.localStorage.setItem(key, String(value || fallback));
    } catch (_) {}
  }, [key, value, fallback]);

  return [value, setValue];
}

function WhispererReactApp() {
  const [theme, setTheme] = useState("light");
  const [text, setText] = useState("");
  const [notice, setNotice] = useState("");
  const [speechSupported, setSpeechSupported] = useState(true);

  const [fontSize, setFontSize] = useStoredNumber(LS.fontSize, 16, 12, 30);
  const [rate, setRate] = useStoredNumber(LS.rate, 1, 0.1, 3);
  const [pitch, setPitch] = useStoredNumber(LS.pitch, 1, 0, 2);
  const [volume, setVolume] = useStoredNumber(LS.volume, 1, 0, 1);

  const [voiceEn, setVoiceEn] = useStoredString(LS.voiceEn, "__auto__");
  const [voiceRu, setVoiceRu] = useStoredString(LS.voiceRu, "__auto__");
  const [voiceBe, setVoiceBe] = useStoredString(LS.voiceBe, "__auto__");
  const [voices, setVoices] = useState([]);

  const [mode, setMode] = useState("idle");
  const [isLocked, setIsLocked] = useState(false);
  const [activeWord, setActiveWord] = useState(-1);
  const [followFull, setFollowFull] = useState(false);

  const [notesOpen, setNotesOpen] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesSearch, setNotesSearch] = useState("");
  const [notesRows, setNotesRows] = useState([]);
  const [notesCats, setNotesCats] = useState([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState([]);
  const [pendingSpeak, setPendingSpeak] = useState(false);

  const deferredText = useDeferredValue(text);
  const isFollowUpdating = deferredText !== text;
  const parsed = useMemo(() => parseText(deferredText), [deferredText]);
  const textRef = useRef(text);
  const parsedRef = useRef(parsed);
  const noticeTimerRef = useRef(null);
  const wordRefs = useRef(new Map());

  const settingsRef = useRef({
    voices: [],
    voiceEn: "__auto__",
    voiceRu: "__auto__",
    voiceBe: "__auto__",
    rate: 1,
    pitch: 1,
    volume: 1,
  });

  const speechRef = useRef({
    cancelled: false,
    segments: [],
    segIdx: 0,
    pausedWord: -1,
  });

  const showNotice = useCallback((message, ttl = 3200) => {
    const next = String(message || "").trim();
    setNotice(next);
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
    if (next && ttl > 0) {
      noticeTimerRef.current = window.setTimeout(() => {
        setNotice("");
        noticeTimerRef.current = null;
      }, ttl);
    }
  }, []);

  const stopAll = useCallback(() => {
    speechRef.current.cancelled = true;
    speechRef.current.segments = [];
    speechRef.current.segIdx = 0;
    speechRef.current.pausedWord = -1;

    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }

    setMode("idle");
    setActiveWord(-1);
  }, []);

  const runSegments = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;

    const synth = window.speechSynthesis;
    const state = speechRef.current;

    const speakCurrent = () => {
      if (state.cancelled) return;

      if (state.segIdx >= state.segments.length) {
        setMode("idle");
        setActiveWord(-1);
        return;
      }

      const segment = state.segments[state.segIdx];
      const current = settingsRef.current;
      const utterance = new window.SpeechSynthesisUtterance(segment.text);

      utterance.rate = clampNumber(current.rate, 0.1, 3, 1);
      utterance.pitch = clampNumber(current.pitch, 0, 2, 1);
      utterance.volume = clampNumber(current.volume, 0, 1, 1);

      const voice = pickVoiceForLang(segment.lang, current);
      if (voice) utterance.voice = voice;

      setMode("speaking");
      setActiveWord((prev) => (prev === segment.startWord ? prev : segment.startWord));

      utterance.onboundary = (event) => {
        if (typeof event.charIndex !== "number") return;
        const nextWord = wordFromBoundary(segment, event.charIndex);
        if (nextWord >= 0 && nextWord < parsedRef.current.words.length) {
          setActiveWord((prev) => (prev === nextWord ? prev : nextWord));
        }
      };

      utterance.onend = () => {
        if (state.cancelled) return;
        state.segIdx += 1;
        speakCurrent();
      };

      utterance.onerror = () => {
        if (state.cancelled) return;
        state.segIdx += 1;
        speakCurrent();
      };

      try {
        synth.speak(utterance);
      } catch (_) {
        state.segIdx += 1;
        speakCurrent();
      }
    };

    speakCurrent();
  }, []);

  const speakFromWord = useCallback(
    (index) => {
      if (isLocked) return;
      if (typeof window === "undefined") return;
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
        showNotice("Ваш браузер не поддерживает Web Speech API.", 3400);
        return;
      }

      const currentParsed = parseText(textRef.current);
      if (!currentParsed.words.length) {
        showNotice("Добавь текст для озвучки.", 2400);
        return;
      }

      parsedRef.current = currentParsed;

      stopAll();

      const start = Math.min(
        currentParsed.words.length - 1,
        Math.max(0, Number(index) || 0)
      );

      speechRef.current.cancelled = false;
      speechRef.current.segments = buildSegments(currentParsed, start);
      speechRef.current.segIdx = 0;
      speechRef.current.pausedWord = -1;

      if (!speechRef.current.segments.length) {
        setMode("idle");
        setActiveWord(-1);
        return;
      }

      runSegments();
    },
    [isLocked, runSegments, showNotice, stopAll]
  );

  const pauseNow = useCallback(() => {
    if (mode !== "speaking") return;

    const current = speechRef.current;
    const segment = current.segments[current.segIdx] || null;
    const pausedAt =
      activeWord >= 0 ? activeWord : segment ? segment.startWord : 0;

    current.pausedWord = pausedAt;
    current.cancelled = true;

    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }

    current.segments = [];
    current.segIdx = 0;

    setMode("paused");
    setActiveWord(pausedAt);
  }, [activeWord, mode]);

  const resumeFromPause = useCallback(() => {
    if (mode !== "paused") return;
    if (isLocked) return;

    const currentParsed = parsedRef.current;
    if (!currentParsed.words.length) {
      stopAll();
      return;
    }

    const start = Math.min(
      currentParsed.words.length - 1,
      Math.max(0, speechRef.current.pausedWord >= 0 ? speechRef.current.pausedWord : 0)
    );

    speechRef.current.cancelled = false;
    speechRef.current.segments = buildSegments(currentParsed, start);
    speechRef.current.segIdx = 0;

    if (!speechRef.current.segments.length) {
      setMode("idle");
      setActiveWord(-1);
      return;
    }

    setActiveWord(start);
    runSegments();
  }, [isLocked, mode, runSegments, stopAll]);

  const togglePause = useCallback(() => {
    if (mode === "paused") {
      resumeFromPause();
      return;
    }
    pauseNow();
  }, [mode, pauseNow, resumeFromPause]);

  const openNotesPicker = useCallback(async () => {
    setNotesOpen(true);
    setNotesLoading(true);
    setNotesSearch("");
    setSelectedNoteIds([]);

    try {
      const notesModule = await loadNotesModule();
      const snapshot = await notesModule.loadNotesSnapshot();
      setNotesRows(Array.isArray(snapshot.notes) ? snapshot.notes : []);
      setNotesCats(Array.isArray(snapshot.cats) ? snapshot.cats : []);
    } catch (_) {
      setNotesRows([]);
      setNotesCats([]);
      showNotice("Не удалось открыть базу заметок.", 3400);
    } finally {
      setNotesLoading(false);
    }
  }, [showNotice]);

  const notesById = useMemo(() => {
    const map = new Map();
    notesRows.forEach((note) => {
      map.set(String(note.id), note);
    });
    return map;
  }, [notesRows]);

  const catsById = useMemo(() => {
    const map = new Map();
    notesCats.forEach((cat) => {
      map.set(String(cat.id), String(cat.name || "-"));
    });
    return map;
  }, [notesCats]);

  const filteredNotes = useMemo(() => {
    const query = notesSearch.trim().toLowerCase();
    return notesRows
      .slice()
      .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
      .filter((note) => {
        if (!query) return true;
        const title = String(note.title || "").toLowerCase();
        const body = String(note.plainText || "").toLowerCase();
        return title.includes(query) || body.includes(query);
      });
  }, [notesRows, notesSearch]);

  const selectedText = useMemo(() => {
    const selected = selectedNoteIds
      .map((id) => notesById.get(String(id)))
      .filter(Boolean)
      .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));

    return selected
      .map((note) => {
        const title = String(note.title || "").trim();
        const body = String(note.plainText || "").trim();
        return title ? `${title}\n${body}` : body;
      })
      .filter(Boolean)
      .join("\n\n- - -\n\n")
      .trim();
  }, [notesById, selectedNoteIds]);

  const handleInsertNotes = useCallback(() => {
    if (selectedText) setText(selectedText);
    setNotesOpen(false);
  }, [selectedText]);

  const handleSpeakNotes = useCallback(() => {
    if (!selectedText) {
      setNotesOpen(false);
      return;
    }
    setText(selectedText);
    setNotesOpen(false);
    setPendingSpeak(true);
  }, [selectedText]);

  const safeGoBack = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = "../../";
  }, []);

  const handleBack = useCallback(
    (event) => {
      event.preventDefault();
      if (notesOpen) {
        setNotesOpen(false);
        return;
      }
      if (followFull) {
        setFollowFull(false);
        return;
      }
      safeGoBack();
    },
    [followFull, notesOpen, safeGoBack]
  );

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  useEffect(() => {
    parsedRef.current = parsed;
  }, [parsed]);

  useEffect(() => {
    settingsRef.current = {
      voices,
      voiceEn,
      voiceRu,
      voiceBe,
      rate,
      pitch,
      volume,
    };
  }, [voices, voiceEn, voiceRu, voiceBe, rate, pitch, volume]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setSpeechSupported(
      !!(window.speechSynthesis && window.SpeechSynthesisUtterance)
    );

    const stored = window.localStorage.getItem("ik_site_theme_v1");
    const systemDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolved =
      stored === "dark" || stored === "light"
        ? stored
        : systemDark
        ? "dark"
        : "light";
    setTheme(resolved);

    try {
      const params = new URLSearchParams(window.location.search);
      const queryText = String(params.get("text") || "");
      let inbound = queryText;

      if (!inbound.trim()) {
        const raw = window.localStorage.getItem(INBOUND_KEY);
        if (raw) {
          const payload = JSON.parse(raw);
          const payloadText =
            payload && typeof payload.text === "string" ? payload.text : "";
          inbound = payloadText;
        }
      }

      if (inbound.trim()) {
        setText(inbound);
      } else if (params.get("from") === "onoi_notes") {
        showNotice("Нет текста для whisperer.", 3400);
      }

      if (params.get("autoSpeak") === "1") {
        setPendingSpeak(true);
      }
    } catch (_) {}

    if (document.body) {
      document.body.classList.remove("ik-loading", "ik-booting", "ik-boot-reveal");
      document.body.removeAttribute("data-ik-loading");
    }

    return () => {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = null;
      }
    };
  }, [showNotice]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;
    let idleId = null;
    let timerId = null;

    const warmNotesModule = () => {
      if (cancelled) return;
      loadNotesModule().catch(() => {});
    };

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(warmNotesModule, { timeout: 2600 });
    } else {
      timerId = window.setTimeout(warmNotesModule, 900);
    }

    return () => {
      cancelled = true;
      if (idleId !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.speechSynthesis) return;

    const refreshVoices = () => {
      try {
        setVoices(asVoiceArray(window.speechSynthesis.getVoices()));
      } catch (_) {
        setVoices([]);
      }
    };

    refreshVoices();
    window.setTimeout(refreshVoices, 90);
    window.setTimeout(refreshVoices, 400);

    const synth = window.speechSynthesis;
    if (typeof synth.addEventListener === "function") {
      synth.addEventListener("voiceschanged", refreshVoices);
      return () => synth.removeEventListener("voiceschanged", refreshVoices);
    }

    const prev = synth.onvoiceschanged;
    synth.onvoiceschanged = refreshVoices;
    return () => {
      if (synth.onvoiceschanged === refreshVoices) {
        synth.onvoiceschanged = prev || null;
      }
    };
  }, []);

  useEffect(() => {
    if (pendingSpeak && text.trim().length > 0 && !isLocked) {
      setPendingSpeak(false);
      speakFromWord(0);
    }
  }, [pendingSpeak, text, isLocked, speakFromWord]);

  useEffect(() => {
    if (mode !== "idle") stopAll();
  }, [rate, pitch, volume, voiceEn, voiceRu, voiceBe]);

  useEffect(() => {
    if (activeWord < 0) return;
    const el = wordRefs.current.get(activeWord);
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    }
  }, [activeWord]);

  useEffect(() => {
    const lockScroll = notesOpen || followFull;
    if (!lockScroll || typeof document === "undefined") return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [notesOpen, followFull]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.ctrlKey && event.key === "Enter") {
        event.preventDefault();
        if (mode === "idle" && !isLocked) {
          speakFromWord(0);
        }
        return;
      }

      if (event.code === "Space") {
        const tag =
          event.target && event.target.tagName
            ? String(event.target.tagName).toLowerCase()
            : "";
        if (tag === "textarea" || tag === "input" || tag === "select") return;
        event.preventDefault();
        if (mode !== "idle") {
          togglePause();
        }
        return;
      }

      if (event.key === "Escape") {
        if (notesOpen) {
          event.preventDefault();
          setNotesOpen(false);
          return;
        }
        if (followFull) {
          event.preventDefault();
          setFollowFull(false);
          return;
        }
        if (!isLocked && mode !== "idle") {
          stopAll();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [followFull, isLocked, mode, notesOpen, speakFromWord, stopAll, togglePause]);

  useEffect(() => {
    return () => {
      stopAll();
    };
  }, [stopAll]);

  const applyTheme = useCallback((nextTheme) => {
    const resolved = nextTheme === "dark" ? "dark" : "light";
    setTheme(resolved);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", resolved);
      document.documentElement.style.colorScheme = resolved;
    }
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("ik_site_theme_v1", resolved);
      } catch (_) {}
    }
  }, []);

  const toggleTheme = useCallback(() => {
    applyTheme(theme === "dark" ? "light" : "dark");
  }, [applyTheme, theme]);

  const languageModes = useMemo(() => {
    return {
      en: voices.filter((voice) =>
        String(voice.lang || "").toLowerCase().startsWith("en")
      ),
      ru: voices.filter((voice) =>
        String(voice.lang || "").toLowerCase().startsWith("ru")
      ),
      be: voices.filter((voice) =>
        String(voice.lang || "").toLowerCase().startsWith("be")
      ),
    };
  }, [voices]);

  const modeLabel =
    mode === "paused"
      ? "mode: paused"
      : mode === "speaking"
      ? "mode: speaking"
      : "mode: idle";

  const posLabel =
    activeWord >= 0 && parsed.words.length > 0
      ? `word: ${activeWord + 1}/${parsed.words.length}`
      : "word: -";

  const isDark = theme === "dark";
  const cardClass = isDark
    ? "tw-border-slate-700 tw-bg-slate-900/85 tw-text-slate-100"
    : "tw-border-slate-300 tw-bg-white tw-text-slate-900";

  return (
    <>
      <Head>
        <title>Item Key - whisperer</title>
      </Head>

      <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />

      <div
        className={
          isDark
            ? "tw-min-h-screen tw-bg-slate-950 tw-text-slate-100"
            : "tw-min-h-screen tw-bg-slate-100 tw-text-slate-900"
        }
      >
        <div className="tw-mx-auto tw-w-full tw-max-w-7xl tw-px-3 tw-py-4 sm:tw-px-5 lg:tw-px-8">
          <header
            className={`tw-mb-3 tw-flex tw-items-center tw-justify-between tw-gap-2 tw-border tw-p-2 ${cardClass}`}
          >
            <button
              type="button"
              onClick={handleBack}
              className={`tw-min-h-11 tw-rounded-none tw-border tw-px-3 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.28em] ${
                isDark
                  ? "tw-border-slate-600 tw-bg-slate-900 hover:tw-border-slate-400"
                  : "tw-border-slate-400 tw-bg-slate-50 hover:tw-border-slate-700"
              }`}
            >
              Назад
            </button>

            <a
              href="../../"
              className={`tw-inline-flex tw-min-h-11 tw-items-center tw-justify-center tw-border tw-px-4 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.28em] ${
                isDark
                  ? "tw-border-slate-600 tw-bg-slate-900 hover:tw-border-slate-400"
                  : "tw-border-slate-400 tw-bg-slate-50 hover:tw-border-slate-700"
              }`}
            >
              Главное меню
            </a>

            <button
              type="button"
              onClick={toggleTheme}
              className={`tw-min-h-11 tw-rounded-none tw-border tw-px-3 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.28em] ${
                isDark
                  ? "tw-border-slate-600 tw-bg-slate-900 hover:tw-border-slate-400"
                  : "tw-border-slate-400 tw-bg-slate-50 hover:tw-border-slate-700"
              }`}
            >
              {isDark ? "Light" : "Dark"}
            </button>
          </header>

          <div className="tw-mb-3 tw-text-center">
            <h1 className="tw-text-sm tw-font-semibold tw-uppercase tw-tracking-[0.42em]">озвучка</h1>
            <p
              className={`tw-mt-1 tw-text-[11px] tw-uppercase tw-tracking-[0.38em] ${
                isDark ? "tw-text-slate-400" : "tw-text-slate-500"
              }`}
            >
              прошепчи мое имя, пожалуйста
            </p>
          </div>

          {!speechSupported && (
            <div
              className={`tw-mb-3 tw-border tw-p-3 tw-text-sm ${
                isDark
                  ? "tw-border-amber-500/40 tw-bg-amber-500/10 tw-text-amber-200"
                  : "tw-border-amber-400 tw-bg-amber-50 tw-text-amber-900"
              }`}
            >
              Ваш браузер не поддерживает Web Speech API (SpeechSynthesis). Попробуйте Chrome или Edge.
            </div>
          )}

          {notice && (
            <div
              className={`tw-mb-3 tw-border tw-p-3 tw-text-sm ${
                isDark
                  ? "tw-border-sky-500/50 tw-bg-sky-500/10 tw-text-sky-200"
                  : "tw-border-sky-400 tw-bg-sky-50 tw-text-sky-900"
              }`}
              aria-live="polite"
            >
              {notice}
            </div>
          )}

          <div
            className={`tw-sticky tw-top-2 tw-z-30 tw-mb-3 tw-grid tw-grid-cols-1 tw-gap-2 tw-border tw-p-2 sm:tw-grid-cols-2 ${cardClass}`}
          >
            {mode === "idle" ? (
              <button
                type="button"
                disabled={isLocked}
                onClick={() => speakFromWord(0)}
                className={`tw-min-h-11 tw-border tw-px-3 tw-text-xs tw-font-bold tw-uppercase tw-tracking-[0.32em] ${
                  isDark
                    ? "tw-border-slate-500 tw-bg-slate-800 hover:tw-border-slate-300 disabled:tw-opacity-50"
                    : "tw-border-slate-600 tw-bg-white hover:tw-border-slate-900 disabled:tw-opacity-50"
                }`}
              >
                Озвучить
              </button>
            ) : (
              <button
                type="button"
                onClick={togglePause}
                className={`tw-min-h-11 tw-border tw-px-3 tw-text-xs tw-font-bold tw-uppercase tw-tracking-[0.32em] ${
                  isDark
                    ? "tw-border-slate-500 tw-bg-slate-800 hover:tw-border-slate-300"
                    : "tw-border-slate-600 tw-bg-white hover:tw-border-slate-900"
                }`}
              >
                {mode === "paused" ? "Продолжить" : "Пауза"}
              </button>
            )}

            <button
              type="button"
              disabled={isLocked || mode === "idle"}
              onClick={stopAll}
              className={`tw-min-h-11 tw-border tw-px-3 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.32em] ${
                isDark
                  ? "tw-border-slate-500 tw-bg-slate-900 hover:tw-border-slate-300 disabled:tw-opacity-50"
                  : "tw-border-slate-400 tw-bg-slate-50 hover:tw-border-slate-700 disabled:tw-opacity-50"
              }`}
            >
              Стоп
            </button>
          </div>

          <main className="tw-grid tw-grid-cols-1 tw-gap-3 xl:tw-grid-cols-5">
            <section className={`tw-border tw-p-3 xl:tw-col-span-3 ${cardClass}`}>
              <div
                className={`tw-mb-2 tw-text-[11px] tw-uppercase tw-tracking-[0.34em] ${
                  isDark ? "tw-text-slate-400" : "tw-text-slate-500"
                }`}
              >
                текст
              </div>

              <textarea
                id="textInput"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Вставь сюда текст..."
                className={`tw-min-h-[260px] tw-w-full tw-resize-y tw-border tw-p-3 tw-leading-[1.7] tw-outline-none ${
                  isDark
                    ? "tw-border-slate-700 tw-bg-slate-950 tw-text-slate-100 focus:tw-border-slate-400"
                    : "tw-border-slate-300 tw-bg-white tw-text-slate-900 focus:tw-border-slate-700"
                }`}
                style={{ fontSize: `${fontSize}px` }}
              />

              <p
                className={`tw-mt-2 tw-text-xs tw-leading-relaxed ${
                  isDark ? "tw-text-slate-400" : "tw-text-slate-600"
                }`}
              >
                Клик по слову в FOLLOW - начать чтение с него. Горячие клавиши: Ctrl+Enter - озвучить, Space -
                пауза/продолжить, Esc - стоп.
              </p>

              {isFollowUpdating && (
                <p className={`tw-mt-1 tw-text-[11px] ${isDark ? "tw-text-slate-500" : "tw-text-slate-500"}`}>
                  Обновляю FOLLOW...
                </p>
              )}
            </section>

            <section className={`tw-border tw-p-3 xl:tw-col-span-2 ${cardClass}`}>
              <div
                className={`tw-mb-2 tw-text-[11px] tw-uppercase tw-tracking-[0.34em] ${
                  isDark ? "tw-text-slate-400" : "tw-text-slate-500"
                }`}
              >
                настройки
              </div>

              <div className="tw-grid tw-grid-cols-1 tw-gap-2 sm:tw-grid-cols-2">
                <label className="tw-grid tw-gap-1">
                  <span className="tw-text-[11px] tw-uppercase tw-tracking-[0.25em]">размер текста</span>
                  <input
                    type="number"
                    min="12"
                    max="30"
                    step="1"
                    value={fontSize}
                    onChange={(event) =>
                      setFontSize(clampNumber(event.target.value, 12, 30, 16))
                    }
                    className={`tw-h-11 tw-border tw-px-3 tw-text-sm tw-outline-none ${
                      isDark
                        ? "tw-border-slate-700 tw-bg-slate-950 tw-text-slate-100"
                        : "tw-border-slate-300 tw-bg-white tw-text-slate-900"
                    }`}
                  />
                </label>

                <label className="tw-grid tw-gap-1">
                  <span className="tw-text-[11px] tw-uppercase tw-tracking-[0.25em]">скорость</span>
                  <input
                    type="number"
                    min="0.1"
                    max="3"
                    step="0.05"
                    value={rate}
                    onChange={(event) =>
                      setRate(clampNumber(event.target.value, 0.1, 3, 1))
                    }
                    className={`tw-h-11 tw-border tw-px-3 tw-text-sm tw-outline-none ${
                      isDark
                        ? "tw-border-slate-700 tw-bg-slate-950 tw-text-slate-100"
                        : "tw-border-slate-300 tw-bg-white tw-text-slate-900"
                    }`}
                  />
                </label>

                <label className="tw-grid tw-gap-1">
                  <span className="tw-text-[11px] tw-uppercase tw-tracking-[0.25em]">тон</span>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.05"
                    value={pitch}
                    onChange={(event) =>
                      setPitch(clampNumber(event.target.value, 0, 2, 1))
                    }
                    className={`tw-h-11 tw-border tw-px-3 tw-text-sm tw-outline-none ${
                      isDark
                        ? "tw-border-slate-700 tw-bg-slate-950 tw-text-slate-100"
                        : "tw-border-slate-300 tw-bg-white tw-text-slate-900"
                    }`}
                  />
                </label>

                <label className="tw-grid tw-gap-1">
                  <span className="tw-text-[11px] tw-uppercase tw-tracking-[0.25em]">громкость</span>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={(event) =>
                      setVolume(clampNumber(event.target.value, 0, 1, 1))
                    }
                    className={`tw-h-11 tw-border tw-px-3 tw-text-sm tw-outline-none ${
                      isDark
                        ? "tw-border-slate-700 tw-bg-slate-950 tw-text-slate-100"
                        : "tw-border-slate-300 tw-bg-white tw-text-slate-900"
                    }`}
                  />
                </label>
              </div>

              <div className="tw-mt-2 tw-grid tw-grid-cols-1 tw-gap-2 sm:tw-grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    stopAll();
                    setText("");
                  }}
                  className={`tw-min-h-11 tw-border tw-px-3 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.28em] ${
                    isDark
                      ? "tw-border-slate-600 tw-bg-slate-900 hover:tw-border-slate-300"
                      : "tw-border-slate-400 tw-bg-slate-50 hover:tw-border-slate-700"
                  }`}
                >
                  Очистить
                </button>

                <button
                  type="button"
                  onClick={openNotesPicker}
                  className={`tw-min-h-11 tw-border tw-px-3 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.28em] ${
                    isDark
                      ? "tw-border-slate-600 tw-bg-slate-900 hover:tw-border-slate-300"
                      : "tw-border-slate-400 tw-bg-slate-50 hover:tw-border-slate-700"
                  }`}
                >
                  Из заметок
                </button>
              </div>

              <div className="tw-mt-2 tw-grid tw-grid-cols-1 tw-gap-2 sm:tw-grid-cols-3">
                <button
                  type="button"
                  onClick={() => speakFromWord(0)}
                  disabled={isLocked || mode !== "idle"}
                  className={`tw-min-h-11 tw-border tw-px-3 tw-text-xs tw-font-bold tw-uppercase tw-tracking-[0.3em] ${
                    isDark
                      ? "tw-border-slate-500 tw-bg-slate-800 hover:tw-border-slate-300 disabled:tw-opacity-50"
                      : "tw-border-slate-600 tw-bg-white hover:tw-border-slate-900 disabled:tw-opacity-50"
                  }`}
                >
                  Озвучить
                </button>

                <button
                  type="button"
                  onClick={stopAll}
                  disabled={isLocked || mode === "idle"}
                  className={`tw-min-h-11 tw-border tw-px-3 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.28em] ${
                    isDark
                      ? "tw-border-slate-600 tw-bg-slate-900 hover:tw-border-slate-300 disabled:tw-opacity-50"
                      : "tw-border-slate-400 tw-bg-slate-50 hover:tw-border-slate-700 disabled:tw-opacity-50"
                  }`}
                >
                  Стоп
                </button>

                <button
                  type="button"
                  onClick={() => setIsLocked((prev) => !prev)}
                  className={`tw-min-h-11 tw-border tw-px-3 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.28em] ${
                    isDark
                      ? "tw-border-slate-600 tw-bg-slate-900 hover:tw-border-slate-300"
                      : "tw-border-slate-400 tw-bg-slate-50 hover:tw-border-slate-700"
                  }`}
                >
                  {isLocked ? "Разблокировать" : "Заблокировать"}
                </button>
              </div>

              <details
                className={`tw-mt-3 tw-border tw-p-2 ${
                  isDark ? "tw-border-slate-700 tw-bg-slate-950/70" : "tw-border-slate-300 tw-bg-white"
                }`}
              >
                <summary className="tw-cursor-pointer tw-text-[11px] tw-uppercase tw-tracking-[0.34em]">
                  голоса (необязательно)
                </summary>

                <div className="tw-mt-2 tw-grid tw-grid-cols-1 tw-gap-2">
                  <label className="tw-grid tw-gap-1">
                    <span className="tw-text-[11px] tw-uppercase tw-tracking-[0.24em]">EN voice</span>
                    <select
                      value={voiceEn}
                      onChange={(event) => setVoiceEn(event.target.value)}
                      className={`tw-h-11 tw-border tw-px-3 tw-text-sm ${
                        isDark
                          ? "tw-border-slate-700 tw-bg-slate-950 tw-text-slate-100"
                          : "tw-border-slate-300 tw-bg-white tw-text-slate-900"
                      }`}
                    >
                      <option value="__auto__">Auto</option>
                      {languageModes.en.map((voice) => (
                        <option key={`en-${voice.name}`} value={voice.name}>
                          {voice.name}
                          {voice.default ? " (default)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="tw-grid tw-gap-1">
                    <span className="tw-text-[11px] tw-uppercase tw-tracking-[0.24em]">RU voice</span>
                    <select
                      value={voiceRu}
                      onChange={(event) => setVoiceRu(event.target.value)}
                      className={`tw-h-11 tw-border tw-px-3 tw-text-sm ${
                        isDark
                          ? "tw-border-slate-700 tw-bg-slate-950 tw-text-slate-100"
                          : "tw-border-slate-300 tw-bg-white tw-text-slate-900"
                      }`}
                    >
                      <option value="__auto__">Auto</option>
                      {languageModes.ru.map((voice) => (
                        <option key={`ru-${voice.name}`} value={voice.name}>
                          {voice.name}
                          {voice.default ? " (default)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="tw-grid tw-gap-1">
                    <span className="tw-text-[11px] tw-uppercase tw-tracking-[0.24em]">BE voice</span>
                    <select
                      value={voiceBe}
                      onChange={(event) => setVoiceBe(event.target.value)}
                      className={`tw-h-11 tw-border tw-px-3 tw-text-sm ${
                        isDark
                          ? "tw-border-slate-700 tw-bg-slate-950 tw-text-slate-100"
                          : "tw-border-slate-300 tw-bg-white tw-text-slate-900"
                      }`}
                    >
                      <option value="__auto__">Auto</option>
                      {languageModes.be.map((voice) => (
                        <option key={`be-${voice.name}`} value={voice.name}>
                          {voice.name}
                          {voice.default ? " (default)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <p className={`tw-text-xs ${isDark ? "tw-text-slate-400" : "tw-text-slate-600"}`}>
                    Авто сам выбирает язык (EN/RU/BE) по тексту. Эти списки нужны только если хочешь закрепить голос.
                  </p>
                </div>
              </details>

              <div className="tw-mt-3 tw-flex tw-flex-wrap tw-gap-2">
                {[parsed.langLabel, modeLabel, posLabel].map((pill) => (
                  <span
                    key={pill}
                    className={`tw-border tw-px-2 tw-py-1 tw-text-[11px] tw-uppercase tw-tracking-[0.22em] ${
                      isDark
                        ? "tw-border-slate-700 tw-bg-slate-950 tw-text-slate-300"
                        : "tw-border-slate-300 tw-bg-slate-50 tw-text-slate-700"
                    }`}
                  >
                    {pill}
                  </span>
                ))}
              </div>
            </section>
          </main>

          {followFull && (
            <button
              type="button"
              aria-label="Закрыть полный FOLLOW"
              className="tw-fixed tw-inset-0 tw-z-40 tw-bg-black/55"
              onClick={() => setFollowFull(false)}
            />
          )}

          <section
            className={`tw-mt-3 tw-border tw-p-3 ${cardClass} ${
              followFull
                ? "tw-fixed tw-inset-x-3 tw-bottom-3 tw-top-3 tw-z-50 tw-mt-0 tw-overflow-hidden"
                : ""
            }`}
            id="followCard"
          >
            <div className="tw-mb-2 tw-flex tw-items-center tw-justify-between tw-gap-2">
              <div
                className={`tw-text-[11px] tw-uppercase tw-tracking-[0.34em] ${
                  isDark ? "tw-text-slate-400" : "tw-text-slate-500"
                }`}
              >
                сопровождение
              </div>

              <button
                type="button"
                onClick={() => setFollowFull((prev) => !prev)}
                className={`tw-h-9 tw-w-9 tw-border tw-text-xs ${
                  isDark
                    ? "tw-border-slate-600 tw-bg-slate-900 hover:tw-border-slate-300"
                    : "tw-border-slate-400 tw-bg-slate-50 hover:tw-border-slate-700"
                }`}
                aria-label={followFull ? "Свернуть FOLLOW" : "Развернуть FOLLOW"}
              >
                □
              </button>
            </div>

            <p
              className={`tw-min-h-[86px] tw-border tw-p-3 tw-whitespace-pre-wrap tw-leading-[1.7] ${
                followFull ? "tw-h-[calc(100%-44px)] tw-overflow-auto" : ""
              } ${
                isDark
                  ? "tw-border-slate-700 tw-bg-slate-950"
                  : "tw-border-slate-300 tw-bg-white"
              }`}
              style={{ fontSize: `${fontSize}px` }}
              id="display"
            >
              {parsed.tokens.length === 0 && (
                <span className={isDark ? "tw-text-slate-500" : "tw-text-slate-400"}>...</span>
              )}

              {parsed.tokens.map((token, tokenIndex) => {
                if (token.type === "space") {
                  return <span key={`s-${tokenIndex}`}>{token.value}</span>;
                }

                const currentIndex = token.wordIndex;
                const isActive = activeWord === currentIndex;
                return (
                  <span
                    key={`w-${currentIndex}`}
                    ref={(el) => {
                      if (!el) {
                        wordRefs.current.delete(currentIndex);
                        return;
                      }
                      wordRefs.current.set(currentIndex, el);
                    }}
                    role="button"
                    tabIndex={0}
                    onClick={() => speakFromWord(currentIndex)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        speakFromWord(currentIndex);
                      }
                    }}
                    className={`tw-cursor-pointer tw-px-[2px] tw-outline-none ${
                      isActive
                        ? isDark
                          ? "tw-bg-sky-500/25 tw-underline tw-underline-offset-4"
                          : "tw-bg-sky-200 tw-underline tw-underline-offset-4"
                        : isDark
                        ? "hover:tw-bg-slate-800"
                        : "hover:tw-bg-slate-200"
                    }`}
                  >
                    {token.value}
                  </span>
                );
              })}
            </p>
          </section>
        </div>
      </div>

      {notesOpen && (
        <div className="tw-fixed tw-inset-0 tw-z-[70] tw-bg-black/60 tw-p-3 sm:tw-p-6">
          <div
            className={`tw-mx-auto tw-flex tw-h-full tw-w-full tw-max-w-4xl tw-flex-col tw-border tw-p-3 ${cardClass}`}
          >
            <div className="tw-mb-2 tw-flex tw-items-start tw-justify-between tw-gap-3">
              <div>
                <div
                  className={`tw-text-[11px] tw-uppercase tw-tracking-[0.34em] ${
                    isDark ? "tw-text-slate-400" : "tw-text-slate-500"
                  }`}
                >
                  notes
                </div>
                <p className={`tw-mt-1 tw-text-xs ${isDark ? "tw-text-slate-400" : "tw-text-slate-600"}`}>
                  Выбери заметки - я вставлю их в поле текста. Можно сразу озвучить.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNotesOpen(false)}
                className={`tw-min-h-10 tw-border tw-px-3 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.24em] ${
                  isDark
                    ? "tw-border-slate-600 tw-bg-slate-900 hover:tw-border-slate-300"
                    : "tw-border-slate-400 tw-bg-slate-50 hover:tw-border-slate-700"
                }`}
              >
                Закрыть
              </button>
            </div>

            <input
              value={notesSearch}
              onChange={(event) => setNotesSearch(event.target.value)}
              placeholder="Поиск заметок..."
              className={`tw-mb-2 tw-h-11 tw-border tw-px-3 tw-text-sm tw-outline-none ${
                isDark
                  ? "tw-border-slate-700 tw-bg-slate-950 tw-text-slate-100"
                  : "tw-border-slate-300 tw-bg-white tw-text-slate-900"
              }`}
            />

            <div
              className={`tw-min-h-0 tw-flex-1 tw-overflow-auto tw-border tw-p-2 ${
                isDark ? "tw-border-slate-700 tw-bg-slate-950" : "tw-border-slate-300 tw-bg-white"
              }`}
            >
              {notesLoading && (
                <div className={isDark ? "tw-text-slate-400" : "tw-text-slate-500"}>Загрузка заметок...</div>
              )}

              {!notesLoading && filteredNotes.length === 0 && (
                <div className={isDark ? "tw-text-slate-400" : "tw-text-slate-500"}>
                  Заметок не найдено.
                </div>
              )}

              {!notesLoading &&
                filteredNotes.map((note) => {
                  const id = String(note.id);
                  const checked = selectedNoteIds.includes(id);
                  return (
                    <label
                      key={id}
                      className={`tw-mb-2 tw-block tw-cursor-pointer tw-border tw-p-2 ${
                        checked
                          ? isDark
                            ? "tw-border-sky-500 tw-bg-sky-500/10"
                            : "tw-border-sky-500 tw-bg-sky-50"
                          : isDark
                          ? "tw-border-slate-700 tw-bg-slate-900/70"
                          : "tw-border-slate-300 tw-bg-slate-50"
                      }`}
                    >
                      <div className="tw-flex tw-items-start tw-gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedNoteIds((prev) =>
                              prev.includes(id)
                                ? prev.filter((x) => x !== id)
                                : [...prev, id]
                            );
                          }}
                          className="tw-mt-1"
                        />
                        <div className="tw-min-w-0 tw-flex-1">
                          <p className="tw-truncate tw-text-sm tw-font-semibold">
                            {String(note.title || "без названия")}
                          </p>
                          <p className={`tw-text-xs ${isDark ? "tw-text-slate-400" : "tw-text-slate-600"}`}>
                            {(catsById.get(String(note.catId)) || "-") +
                              " · " +
                              new Date(Number(note.updatedAt || Date.now())).toLocaleString("ru-RU")}
                          </p>
                          <p
                            className={`tw-mt-1 tw-line-clamp-2 tw-text-xs ${
                              isDark ? "tw-text-slate-300" : "tw-text-slate-700"
                            }`}
                          >
                            {String(note.plainText || "...")}
                          </p>
                        </div>
                      </div>
                    </label>
                  );
                })}
            </div>

            <div className="tw-mt-2 tw-grid tw-grid-cols-1 tw-gap-2 sm:tw-grid-cols-2">
              <button
                type="button"
                onClick={handleInsertNotes}
                className={`tw-min-h-11 tw-border tw-px-3 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.24em] ${
                  isDark
                    ? "tw-border-slate-600 tw-bg-slate-900 hover:tw-border-slate-300"
                    : "tw-border-slate-400 tw-bg-slate-50 hover:tw-border-slate-700"
                }`}
              >
                Вставить
              </button>

              <button
                type="button"
                onClick={handleSpeakNotes}
                className={`tw-min-h-11 tw-border tw-px-3 tw-text-xs tw-font-bold tw-uppercase tw-tracking-[0.24em] ${
                  isDark
                    ? "tw-border-slate-500 tw-bg-slate-800 hover:tw-border-slate-300"
                    : "tw-border-slate-600 tw-bg-white hover:tw-border-slate-900"
                }`}
              >
                Вставить и озвучить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function WhispererPage() {
  return <WhispererReactApp />;
}
