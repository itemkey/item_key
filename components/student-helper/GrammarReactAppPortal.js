import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CONSTRUCTOR_NODES, CONSTRUCTOR_RESULTS } from "./grammarConstructorData";

const INDEX_PATH = "./db/tenses/index.json";
const DB_DIR = "./db/tenses/";
const RULE_PREVIEW_LIMIT = 10;
const SYNTH_COMPARE_ID = "__react_compare__";
const SYNTH_DAILY_ID = "__react_daily__";
const SYNTH_LIBRARY_ID = "__react_library__";
const KEY_DAILY = "sh_tenses_daily_v1";
const KEY_LAST_TOPIC = "sh_grammar_last_topic_v1";
const KEY_LAST_VIEW = "sh_tenses_last_view_react";
const KEY_LEVEL = "sh_grammar_level_v1";
const LEVELS = ["A2-B1", "B1-B2", "B2-C1"];

function shuffleList(items) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function todayKey() {
  const d = new Date();
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function asText(value) {
  return String(value || "").trim();
}

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function normalize(value) {
  return asText(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function toTopicFile(meta) {
  const file = asText(meta && meta.file);
  if (file) return file;
  const id = asText(meta && meta.id);
  return id ? `${id}.json` : "";
}

function groupTitle(group) {
  const g = asText(group).toLowerCase();
  if (g === "present") return "present";
  if (g === "past") return "past";
  if (g === "future") return "future";
  if (g === "universal") return "universal";
  return g || "other";
}

function compareRuleHint(aId, bId) {
  const pair = [asText(aId), asText(bId)].sort().join("|");
  if (pair === "presentContinuous|presentSimple") {
    return "Simple = привычка/факт/расписание (точка) • Continuous = процесс/временно (линия)";
  }
  if (pair === "pastContinuous|pastSimple") {
    return "Past Simple = факт/событие (точка) • Past Continuous = процесс/фон (линия)";
  }
  if (pair === "pastPerfect|pastSimple") {
    return "Past Perfect = действие до другого момента в прошлом • Past Simple = факт/событие в прошлом";
  }
  if (pair === "futureContinuous|futureSimple") {
    return "Future Simple = решение/факт/прогноз • Future Continuous = процесс в конкретный момент будущего";
  }
  if (pair === "futurePerfect|futurePerfectContinuous") {
    return "Future Perfect = результат к сроку • Future Perfect Continuous = длительность к сроку";
  }
  if (pair === "pastPerfect|pastPerfectContinuous") {
    return "Past Perfect = результат к моменту в прошлом • Past Perfect Continuous = процесс/длительность к моменту в прошлом";
  }
  return "Сравни: одно время обычно более факт/результат, второе — более процесс/контекст.";
}

function keyProgress(id) {
  return `sh_tenses_progress_${asText(id)}`;
}

function loadProgress(id) {
  const topicId = asText(id);
  if (!topicId) return { mastery: 0, best: {}, mistakes: [] };
  try {
    const raw = localStorage.getItem(keyProgress(topicId));
    if (!raw) return { mastery: 0, best: {}, mistakes: [] };
    const parsed = JSON.parse(raw);
    return {
      mastery: Number(parsed && parsed.mastery) || 0,
      best: (parsed && parsed.best && typeof parsed.best === "object") ? parsed.best : {},
      mistakes: asList(parsed && parsed.mistakes).map(asText).filter(Boolean),
    };
  } catch (_err) {
    return { mastery: 0, best: {}, mistakes: [] };
  }
}

function saveProgress(id, progress) {
  const topicId = asText(id);
  if (!topicId) return;
  try {
    localStorage.setItem(keyProgress(topicId), JSON.stringify(progress || { mastery: 0, best: {}, mistakes: [] }));
  } catch (_err) {}
}

function masteryLabel(mastery) {
  const m = Number(mastery) || 0;
  if (m >= 4) return "Mastered";
  if (m >= 2) return "Learning";
  return "New";
}

function normalizeLevel(level) {
  const value = asText(level);
  return LEVELS.includes(value) ? value : "";
}

function readStoredLevel() {
  try {
    return normalizeLevel(localStorage.getItem(KEY_LEVEL));
  } catch (_err) {
    return "";
  }
}

function isLevelMatch(meta, level) {
  if (!level) return true;
  return asList(meta && meta.levels).map(asText).includes(level);
}

function normalizeSearchText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function splitWords(text) {
  const normalized = normalizeSearchText(text);
  if (!normalized) return [];
  return normalized.split(/[^a-zа-яё0-9]+/i).filter(Boolean);
}

function analyzeConstructorPhrase(rawText) {
  const text = normalizeSearchText(rawText);
  if (!text) {
    return {
      hasText: false,
      text: "",
      hasNow: false,
      isStative: false,
      hasPlan: false,
      isWouldIdea: false,
    };
  }

  const words = splitWords(text);
  const hasWord = (arr) => arr.some((w) => words.includes(w));
  const hasChunk = (arr) => arr.some((s) => text.includes(s));

  const hasNow =
    hasWord(["сейчас", "теперь", "now"]) ||
    hasChunk(["прямо сейчас", "в данный момент", "at the moment", "right now"]);

  const isStative =
    hasWord([
      "want", "wants", "wanted", "need", "needs", "know", "knows", "like", "likes",
      "love", "loves", "believe", "believes", "understand", "understands", "remember",
      "remembers", "prefer", "prefers", "seem", "seems",
    ]) ||
    hasChunk([
      "хочу", "хочешь", "хочет", "хотим", "хотите", "хотят",
      "нравится", "люблю", "любит", "любят", "знаю", "знает", "знают",
      "понимаю", "понимает", "помню", "помнит", "верю", "верит", "кажется", "нужно", "надо",
    ]);

  const hasPlan =
    hasWord(["plan", "planned", "intend", "intends", "going"]) ||
    hasChunk(["планирую", "собираюсь", "собираемся", "собирается", "going to", "intend to"]);

  const isWouldIdea =
    hasChunk([
      "было бы неплохо",
      "было бы не плохо",
      "было бы хорошо",
      "было бы лучше",
      "было бы здорово",
      "было бы классно",
      "было бы круто",
      "было бы полезно",
      "would be good",
      "would be nice",
      "would be better",
      "it would be good",
      "it would be nice",
      "it would be better",
    ]) ||
    /было\s*бы\s*(не\s*)?(плохо|хорошо|лучше|здорово|классно|круто|полезно)/i.test(text) ||
    (words.includes("would") && (words.includes("good") || words.includes("nice") || words.includes("better")));

  return {
    hasText: true,
    text,
    hasNow,
    isStative,
    hasPlan,
    isWouldIdea,
  };
}

function tuneConstructorResult(resultKey, phraseInfo) {
  let key = asText(resultKey);
  let noteKey = "";

  if (!phraseInfo || !phraseInfo.hasText) return { key, noteKey };

  if (phraseInfo.isWouldIdea && (
    key.startsWith("future_") ||
    key === "modal_obligation" ||
    key === "modal_deduction" ||
    key === "present_process" ||
    key === "present_habit" ||
    key === "present_state" ||
    key === "present_map"
  )) {
    key = "would_idea";
    noteKey = "would_idea";
  } else if ((key === "present_process" || key === "present_duration" || key === "present_habit") && phraseInfo.isStative) {
    key = "present_state";
    noteKey = "stative";
  } else if ((key === "present_habit" || key === "present_state") && phraseInfo.hasNow && !phraseInfo.isStative) {
    key = "present_process";
    noteKey = "now_process";
  } else if (key === "future_decision" && phraseInfo.hasPlan) {
    key = "future_plan";
    noteKey = "plan";
  }

  return { key, noteKey };
}

function constructorSmartNote(noteKey) {
  if (noteKey === "stative") {
    return "Умная проверка: по фразе это похоже на состояние/желание (want/know/like), поэтому обычно лучше Present Simple.";
  }
  if (noteKey === "now_process") {
    return "Умная проверка: во фразе есть маркер \"сейчас\" и динамика действия, поэтому вероятнее Present Continuous.";
  }
  if (noteKey === "plan") {
    return "Умная проверка: во фразе заметен план/намерение, поэтому чаще подходит be going to.";
  }
  if (noteKey === "would_idea") {
    return "Умная проверка: фраза похожа на мягкую идею (\"было бы неплохо/лучше\"), поэтому лучше использовать would-шаблон, а не be going to.";
  }
  return "";
}

function normalizeConstructorPicks(picks, topicById) {
  const out = [];
  const seen = new Set();
  for (const idRaw of asList(picks)) {
    const id = asText(idRaw);
    if (!id || seen.has(id)) continue;
    if (!topicById.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function buildConstructorRecommendation(resultKey, phrase, topicById, level) {
  const sourceKey = asText(resultKey);
  if (!sourceKey) return null;

  const tuned = tuneConstructorResult(sourceKey, analyzeConstructorPhrase(phrase));
  const raw = CONSTRUCTOR_RESULTS[tuned.key] || CONSTRUCTOR_RESULTS[sourceKey];
  if (!raw) return null;

  const picks = normalizeConstructorPicks(raw.picks, topicById);
  if (!picks.length) return null;

  let mainId = picks[0];
  if (level && !isLevelMatch(topicById.get(mainId), level)) {
    const fit = picks.find((id) => isLevelMatch(topicById.get(id), level));
    if (fit) mainId = fit;
  }

  const alternatives = picks
    .filter((id) => id !== mainId)
    .map((id, index) => ({
      id,
      index,
      fit: isLevelMatch(topicById.get(id), level) ? 1 : 0,
    }))
    .sort((a, b) => b.fit - a.fit || a.index - b.index)
    .slice(0, 2)
    .map((row) => row.id);

  return {
    sourceKey,
    tunedKey: tuned.key,
    reason: asText(raw.reason),
    smartNote: constructorSmartNote(tuned.noteKey),
    mainId,
    alternatives,
    outOfLevel: !!(level && !isLevelMatch(topicById.get(mainId), level)),
  };
}

function exactSetEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) {
    if (!b.has(x)) return false;
  }
  return true;
}

function inputAccepted(raw, accepted, acceptedShort) {
  const current = normalize(raw);
  if (!current) return false;

  const full = new Set(asList(accepted).map(normalize).filter(Boolean));
  if (full.has(current)) return true;

  const short = new Set(asList(acceptedShort).map(normalize).filter(Boolean));
  if (short.has(current)) return true;
  for (const token of short) {
    if (token && (current === token || current.includes(token))) return true;
  }
  return false;
}

function buildQueue(topicDoc, options) {
  const onlyItemIds = new Set(asList(options && options.onlyItemIds).map(asText).filter(Boolean));
  const useFilter = onlyItemIds.size > 0;
  const exercises = asList(topicDoc && topicDoc.practice && topicDoc.practice.exercises);
  const queue = [];
  for (const ex of exercises) {
    const items = asList(ex && ex.items);
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i] || {};
      const itemId = asText(item && item.id);
      if (useFilter && (!itemId || !onlyItemIds.has(itemId))) continue;
      queue.push({
        key: `${asText(ex && ex.id) || "ex"}-${itemId || i}`,
        kind: asText(ex && ex.kind),
        exerciseTitle: asText(ex && ex.title),
        exerciseId: asText(ex && ex.id),
        itemId,
        item,
      });
    }
  }
  return queue;
}

function initAnswer(node) {
  const kind = asText(node && node.kind);
  const item = (node && node.item) || {};

  if (kind === "choice") return { selectedIndex: -1 };
  if (kind === "multi") return { selected: {} };
  if (kind === "input" || kind === "correction") return { text: "" };
  if (kind === "multi_input") return { values: asList(item.inputs).map(() => "") };
  if (kind === "inline_select") return { values: asList(item.blanks).map(() => -1) };
  if (kind === "match") {
    const picks = {};
    for (const pair of asList(item.pairs)) {
      const left = asText(pair && pair.left);
      if (!left) continue;
      picks[left] = "";
    }
    return { picks };
  }
  if (kind === "drag_sort") {
    return { picks: asList(item.words).map(() => "") };
  }
  return {};
}

function evaluateAnswer(node, answer) {
  const kind = asText(node && node.kind);
  const item = (node && node.item) || {};

  if (kind === "choice") {
    const expected = Number(item.correctIndex);
    const actual = Number(answer && answer.selectedIndex);
    const ok = Number.isFinite(actual) && actual === expected;
    return {
      ok,
      expectedText: asText(asList(item.options)[expected]),
      explain: asText(item.explain),
      linkedTopicId: asText(item.correctTenseId),
    };
  }

  if (kind === "multi") {
    const expectedSet = new Set(asList(item.correctIndices).map((x) => Number(x)));
    const selectedMap = (answer && answer.selected) || {};
    const actualSet = new Set(
      Object.keys(selectedMap)
        .filter((k) => selectedMap[k])
        .map((k) => Number(k)),
    );
    const ok = exactSetEqual(expectedSet, actualSet);
    const expectedText = [...expectedSet]
      .sort((a, b) => a - b)
      .map((idx) => asText(asList(item.options)[idx]))
      .filter(Boolean)
      .join(", ");
    return { ok, expectedText, explain: asText(item.explain) };
  }

  if (kind === "input" || kind === "correction") {
    const ok = inputAccepted(answer && answer.text, item.accepted, item.acceptedShort);
    const expectedText = asList(item.accepted).slice(0, 3).join(" / ");
    return { ok, expectedText, explain: asText(item.explain) };
  }

  if (kind === "multi_input") {
    const inputs = asList(item.inputs);
    const values = asList(answer && answer.values);
    let ok = true;
    for (let i = 0; i < inputs.length; i += 1) {
      const part = inputs[i] || {};
      if (!inputAccepted(values[i], part.accepted, part.acceptedShort)) {
        ok = false;
        break;
      }
    }
    const expectedText = inputs
      .map((part, idx) => `${idx + 1}) ${asList(part && part.accepted).join(" / ")}`)
      .join("; ");
    return { ok, expectedText, explain: asText(item.explain) };
  }

  if (kind === "inline_select") {
    const blanks = asList(item.blanks);
    const values = asList(answer && answer.values);
    let ok = true;
    for (let i = 0; i < blanks.length; i += 1) {
      const expected = Number(blanks[i] && blanks[i].correctIndex);
      const actual = Number(values[i]);
      if (!Number.isFinite(actual) || actual !== expected) {
        ok = false;
        break;
      }
    }
    const expectedText = blanks
      .map((blank) => asText(asList(blank && blank.options)[Number(blank && blank.correctIndex)]))
      .join(" / ");
    return { ok, expectedText, explain: asText(item.explain) };
  }

  if (kind === "match") {
    const pairs = asList(item.pairs);
    const picks = (answer && answer.picks) || {};
    let ok = true;
    for (const pair of pairs) {
      const left = asText(pair && pair.left);
      const right = asText(pair && pair.right);
      if (!left || !right) continue;
      if (asText(picks[left]) !== right) {
        ok = false;
        break;
      }
    }
    const expectedText = pairs.map((pair) => `${asText(pair && pair.left)} -> ${asText(pair && pair.right)}`).join("; ");
    return { ok, expectedText, explain: asText(item.explain) };
  }

  if (kind === "drag_sort") {
    const words = asList(item.words);
    const picks = asList(answer && answer.picks);
    let ok = true;
    for (let i = 0; i < words.length; i += 1) {
      const expected = asText(words[i] && words[i].bin);
      const actual = asText(picks[i]);
      if (!expected || expected !== actual) {
        ok = false;
        break;
      }
    }
    const expectedText = words.map((w) => `${asText(w && w.text)} -> ${asText(w && w.bin)}`).join("; ");
    return { ok, expectedText, explain: asText(item.explain) };
  }

  return { ok: false, expectedText: "unsupported exercise kind", explain: "" };
}

function RuleTable({ block }) {
  const cols = asList(block && block.columns);
  const rows = asList(block && block.rows);
  if (!cols.length && !rows.length) return null;

  return (
    <div className="tw-overflow-x-auto tw-border tw-border-zinc-300">
      <table className="tw-min-w-full tw-border-collapse tw-text-left tw-text-sm">
        {cols.length ? (
          <thead className="tw-bg-zinc-100">
            <tr>
              {cols.map((col, idx) => (
                <th key={`${idx}-${asText(col)}`} className="tw-border-b tw-border-zinc-300 tw-px-3 tw-py-2 tw-font-semibold tw-text-zinc-900">
                  {asText(col)}
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={`${rowIdx}`} className="odd:tw-bg-white even:tw-bg-zinc-50">
              {asList(row).map((cell, cellIdx) => (
                <td key={`${rowIdx}-${cellIdx}`} className="tw-border-b tw-border-zinc-200 tw-px-3 tw-py-2 tw-align-top tw-text-zinc-800">
                  {asText(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function extractQuickField(blocks, field) {
  const list = asList(blocks);
  const target = normalize(field);

  for (const block of list) {
    const type = asText(block && block.type);
    if (type !== "highlight" && type !== "table") continue;

    const marker = [block && block.title, block && block.caption, block && block.text]
      .map(normalize)
      .join(" ");

    if (!marker.includes(target)) continue;

    if (type === "highlight") {
      const lines = asList(block && block.lines)
        .map(asText)
        .filter(Boolean)
        .slice(0, 4);
      if (lines.length) return lines.join(" • ");
    }

    if (type === "table") {
      const rows = asList(block && block.rows);
      const parts = [];
      for (const row of rows.slice(0, 4)) {
        const cells = asList(row).map(asText).filter(Boolean);
        if (cells.length >= 2) parts.push(cells[1]);
        else if (cells.length) parts.push(cells[0]);
      }
      if (parts.length) return parts.join(" • ");
    }
  }

  return "";
}

function extractFormula(blocks) {
  const list = asList(blocks);
  for (const block of list) {
    if (asText(block && block.type) !== "table") continue;
    const caption = normalize(block && block.caption);
    if (!caption.includes("формул") && !caption.includes("formula")) continue;

    const firstRow = asList(block && block.rows)[0];
    const cells = asList(firstRow).map(asText).filter(Boolean);
    if (cells.length >= 2) return cells[1];
    if (cells.length) return cells[0];
  }
  return "";
}

function quickCompareData(meta, doc) {
  const blocks = asList(doc && doc.ruleBlocks);
  return {
    when: asText(meta && (meta.subtitle || meta.hint)) || "—",
    markers: extractQuickField(blocks, "маркеры") || extractQuickField(blocks, "markers") || "—",
    formula: extractFormula(blocks) || "—",
  };
}

export default function GrammarReactAppPortal() {
  const [hostEl, setHostEl] = useState(null);
  const legacyNodesRef = useRef([]);
  const sessionMistakesRef = useRef(new Set());
  const [loadingIndex, setLoadingIndex] = useState(true);
  const [indexError, setIndexError] = useState("");
  const [topics, setTopics] = useState([]);
  const [topicDocs, setTopicDocs] = useState({});
  const [docError, setDocError] = useState("");
  const [grammarLevel, setGrammarLevel] = useState("");
  const [view, setView] = useState("home");
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [expandedRule, setExpandedRule] = useState(false);
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [compareBusy, setCompareBusy] = useState(false);
  const [practiceTitle, setPracticeTitle] = useState("");
  const [practiceFilterIds, setPracticeFilterIds] = useState([]);
  const [practiceOriginTopicId, setPracticeOriginTopicId] = useState("");
  const [dailyCached, setDailyCached] = useState(null);
  const [dailyBusy, setDailyBusy] = useState(false);
  const [progressById, setProgressById] = useState({});
  const [constructorPhrase, setConstructorPhrase] = useState("");
  const [constructorNodeId, setConstructorNodeId] = useState("root");
  const [constructorPath, setConstructorPath] = useState([]);
  const [constructorRec, setConstructorRec] = useState(null);
  const [sessionSaved, setSessionSaved] = useState(false);

  const [cursor, setCursor] = useState(0);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [attempted, setAttempted] = useState(0);
  const [answerState, setAnswerState] = useState({});
  const [resultState, setResultState] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    let detach = null;

    const attach = () => {
      if (cancelled) return;
      const panel = document.getElementById("panel-tenses");
      if (!panel) {
        timer = window.setTimeout(attach, 120);
        return;
      }

      const legacyNodes = [];
      for (const child of Array.from(panel.children)) {
        legacyNodes.push({ el: child, display: child.style.display });
        child.style.display = "none";
      }
      legacyNodesRef.current = legacyNodes;

      const mount = document.createElement("div");
      mount.id = "grammarReactAppMount";
      panel.appendChild(mount);
      setHostEl(mount);

      detach = () => {
        setHostEl(null);
        if (mount.parentNode === panel) panel.removeChild(mount);
        for (const item of legacyNodesRef.current) {
          item.el.style.display = item.display;
        }
        legacyNodesRef.current = [];
      };
    };

    attach();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      if (typeof detach === "function") detach();
    };
  }, []);

  useEffect(() => {
    setDailyCached(readDailyCache());
  }, []);

  useEffect(() => {
    setGrammarLevel(readStoredLevel());

    const onStorage = (event) => {
      if (!event || event.key !== KEY_LEVEL) return;
      setGrammarLevel(readStoredLevel());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    try {
      const lastView = asText(localStorage.getItem(KEY_LAST_VIEW));
      if (lastView && ["home", "list", "detail", "constructor", "compare", "daily", "practice"].includes(lastView)) {
        setView(lastView);
      }
    } catch (_err) {}
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadIndex = async () => {
      setLoadingIndex(true);
      setIndexError("");
      try {
        const res = await fetch(INDEX_PATH, { cache: "no-cache" });
        if (!res.ok) throw new Error(`grammar index load failed (${res.status})`);
        const json = await res.json();
        const list = asList(json)
          .map((item) => ({
            id: asText(item && item.id),
            title: asText(item && item.title),
            subtitle: asText(item && item.subtitle),
            hint: asText(item && item.hint),
            file: toTopicFile(item),
            levels: asList(item && item.levels),
            group: asText(item && item.group),
            kind: asText(item && item.kind),
            compare: item && item.compare,
            aliases: asList(item && item.aliases),
          }))
          .filter((item) => item.id && item.file);

        if (cancelled) return;
        setTopics(list);
        const nextProgress = {};
        for (const topic of list) {
          nextProgress[topic.id] = loadProgress(topic.id);
        }
        setProgressById(nextProgress);

        if (!selectedId && list.length) {
          let lastTopic = "";
          try {
            lastTopic = asText(localStorage.getItem(KEY_LAST_TOPIC));
          } catch (_err) {}
          const hasLast = lastTopic && list.some((topic) => topic.id === lastTopic);
          setSelectedId(hasLast ? lastTopic : list[0].id);
        }
      } catch (err) {
        if (cancelled) return;
        setIndexError(asText(err && err.message) || "failed to load grammar index");
      } finally {
        if (!cancelled) setLoadingIndex(false);
      }
    };

    loadIndex();
    return () => {
      cancelled = true;
    };
  }, []);

  const topicById = useMemo(() => {
    const map = new Map();
    for (const topic of topics) {
      map.set(topic.id, topic);
    }
    return map;
  }, [topics]);

  const ensureDoc = async (topicId) => {
    const id = asText(topicId);
    if (!id) return null;
    if (topicDocs[id]) return topicDocs[id];

    const meta = topicById.get(id);
    if (!meta || !meta.file) return null;

    setDocError("");
    try {
      const res = await fetch(`${DB_DIR}${meta.file}`, { cache: "no-cache" });
      if (!res.ok) throw new Error(`topic load failed (${res.status})`);
      const doc = await res.json();
      setTopicDocs((prev) => ({ ...prev, [id]: doc }));
      return doc;
    } catch (err) {
      setDocError(asText(err && err.message) || "failed to load topic");
      return null;
    }
  };

  const selectedMeta = selectedId ? topicById.get(selectedId) : null;
  const selectedDoc = selectedId ? topicDocs[selectedId] : null;
  const queue = useMemo(
    () => buildQueue(selectedDoc, { onlyItemIds: practiceFilterIds }),
    [practiceFilterIds, selectedDoc],
  );
  const current = queue[cursor] || null;
  const done = checked && cursor >= Math.max(0, queue.length - 1);
  const constructorNode = CONSTRUCTOR_NODES[constructorNodeId] || CONSTRUCTOR_NODES.root;

  const persistGrammarLevel = (levelRaw) => {
    const level = normalizeLevel(levelRaw);
    setGrammarLevel(level);
    try {
      if (level) localStorage.setItem(KEY_LEVEL, level);
      else localStorage.removeItem(KEY_LEVEL);
    } catch (_err) {}
  };

  useEffect(() => {
    setExpandedRule(false);
  }, [selectedId]);

  useEffect(() => {
    if (!current) {
      setAnswerState({});
      setChecked(false);
      setResultState(null);
      return;
    }
    setAnswerState(initAnswer(current));
    setChecked(false);
    setResultState(null);
  }, [current]);

  const topicsByLevel = useMemo(() => {
    if (!grammarLevel) return topics;
    return topics.filter((topic) => isLevelMatch(topic, grammarLevel));
  }, [grammarLevel, topics]);

  const groups = useMemo(() => {
    const set = new Set();
    for (const topic of topicsByLevel) {
      const g = asText(topic.group);
      if (g) set.add(g);
    }
    return [...set].sort((a, b) => groupTitle(a).localeCompare(groupTitle(b)));
  }, [topicsByLevel]);

  const filteredTopics = useMemo(() => {
    const q = normalize(search);
    return topicsByLevel.filter((topic) => {
      if (groupFilter !== "all" && topic.group !== groupFilter) return false;
      if (!q) return true;

      const hay = [
        topic.id,
        topic.title,
        topic.subtitle,
        topic.hint,
        topic.group,
        topic.kind,
        ...topic.levels,
        ...topic.aliases,
      ]
        .map(normalize)
        .join(" ");

      return hay.includes(q);
    });
  }, [groupFilter, search, topicsByLevel]);

  const comparableTopics = useMemo(() => {
    return topicsByLevel.filter((topic) => String(topic.kind || "").toLowerCase() === "tense" && topic.compare !== false);
  }, [topicsByLevel]);

  useEffect(() => {
    if (!comparableTopics.length) {
      setCompareA("");
      setCompareB("");
      return;
    }

    const ids = new Set(comparableTopics.map((topic) => topic.id));
    if (!ids.has(compareA)) {
      setCompareA(comparableTopics[0].id);
    }

    if (!ids.has(compareB)) {
      setCompareB(comparableTopics.length > 1 ? comparableTopics[1].id : comparableTopics[0].id);
    }
  }, [compareA, compareB, comparableTopics]);

  const resetPracticeState = () => {
    setCursor(0);
    setScore(0);
    setAttempted(0);
    setChecked(false);
    setResultState(null);
    setSessionSaved(false);
  };

  const resetConstructor = () => {
    setConstructorNodeId("root");
    setConstructorPath([]);
    setConstructorRec(null);
  };

  const updateConstructorPhrase = (value) => {
    setConstructorPhrase(value);
    if (!constructorRec || !constructorRec.sourceKey) return;
    const next = buildConstructorRecommendation(constructorRec.sourceKey, value, topicById, grammarLevel);
    setConstructorRec(next);
  };

  const chooseConstructorOption = (option) => {
    const opt = option || {};
    setConstructorPath((prev) => [...prev, { node: constructorNodeId, option: asText(opt.id) }]);

    if (asText(opt.next)) {
      setConstructorNodeId(asText(opt.next));
      setConstructorRec(null);
      return;
    }

    const rec = buildConstructorRecommendation(opt.result, constructorPhrase, topicById, grammarLevel);
    setConstructorRec(rec);
  };

  const backConstructorStep = () => {
    if (!constructorPath.length) return;
    const prev = constructorPath[constructorPath.length - 1];
    setConstructorPath((list) => list.slice(0, Math.max(0, list.length - 1)));
    setConstructorNodeId(asText(prev && prev.node) || "root");
    setConstructorRec(null);
  };

  const openConstructorRule = (id) => {
    openTopic(id);
  };

  const commitPracticeProgress = (topicId, stats) => {
    const id = asText(topicId);
    if (!id || !topicById.has(id)) return;

    const attemptedCount = Number(stats && stats.totalAttempted) || 0;
    if (attemptedCount <= 0) return;

    const correct = Math.max(0, Number(stats && stats.totalCorrect) || 0);
    const total = Math.max(1, Number(stats && stats.totalQuestions) || attemptedCount);

    const prev = progressById[id] || loadProgress(id);
    const next = {
      mastery: Math.max(0, Math.min(5, Number(prev.mastery) || 0)),
      best: (prev.best && typeof prev.best === "object") ? { ...prev.best } : {},
      mistakes: asList(prev.mistakes).map(asText).filter(Boolean),
    };

    const key = `len_${total}`;
    const pct = Math.round((correct / total) * 100);
    const prevBest = Number(next.best[key]) || 0;
    next.best[key] = Math.max(prevBest, pct);

    if (attemptedCount >= 5 && pct >= 85) {
      next.mastery = Math.min(5, next.mastery + 1);
    }

    next.mistakes = [...new Set(asList(stats && stats.mistakes).map(asText).filter(Boolean))];

    saveProgress(id, next);
    setProgressById((map) => ({ ...map, [id]: next }));
  };

  const applyPracticeMistakeResult = (node, result) => {
    const topicId = asText(practiceOriginTopicId || selectedId);
    if (!topicId || !topicById.has(topicId)) return;
    const itemId = asText(node && (node.itemId || (node.item && node.item.id)));
    if (!itemId) return;

    if (result && result.ok) sessionMistakesRef.current.delete(itemId);
    else sessionMistakesRef.current.add(itemId);
  };

  const openTopic = async (id) => {
    const topicId = asText(id);
    if (!topicId) return;
    setSelectedId(topicId);
    setPracticeFilterIds([]);
    setPracticeOriginTopicId("");
    setPracticeTitle("");
    setView("detail");
    await ensureDoc(topicId);
  };

  const startTopicPractice = async (id) => {
    const topicId = asText(id);
    if (!topicId) return;

    const meta = topicById.get(topicId);
    setSelectedId(topicId);
    setPracticeOriginTopicId(topicId);
    setPracticeFilterIds([]);
    sessionMistakesRef.current = new Set(asList(progressById[topicId] && progressById[topicId].mistakes).map(asText).filter(Boolean));
    setView("practice");
    setPracticeTitle(asText(meta && meta.title) || topicId);

    const doc = await ensureDoc(topicId);
    if (!doc) return;
    resetPracticeState();
  };

  const startTopicMistakesPractice = async (id) => {
    const topicId = asText(id);
    if (!topicId || !topicById.has(topicId)) return;

    const progress = progressById[topicId] || loadProgress(topicId);
    const mistakes = [...new Set(asList(progress && progress.mistakes).map(asText).filter(Boolean))];
    if (!mistakes.length) {
      setDocError("для этой темы пока нет сохраненных ошибок");
      return;
    }

    const meta = topicById.get(topicId);
    setDocError("");
    setSelectedId(topicId);
    setPracticeOriginTopicId(topicId);
    setPracticeFilterIds(mistakes);
    sessionMistakesRef.current = new Set(mistakes);
    setPracticeTitle(`mistakes: ${asText(meta && meta.title) || topicId}`);
    setView("practice");

    const doc = await ensureDoc(topicId);
    if (!doc) return;
    resetPracticeState();
  };

  const clearTopicMistakes = (id) => {
    const topicId = asText(id);
    if (!topicId || !topicById.has(topicId)) return;

    const prev = progressById[topicId] || loadProgress(topicId);
    const next = {
      mastery: Number(prev.mastery) || 0,
      best: (prev.best && typeof prev.best === "object") ? { ...prev.best } : {},
      mistakes: [],
    };
    saveProgress(topicId, next);
    setProgressById((map) => ({ ...map, [topicId]: next }));
    if (practiceOriginTopicId === topicId) {
      sessionMistakesRef.current = new Set();
    }
  };

  const resetTopicProgress = (id) => {
    const topicId = asText(id);
    if (!topicId || !topicById.has(topicId)) return;

    const next = { mastery: 0, best: {}, mistakes: [] };
    saveProgress(topicId, next);
    setProgressById((map) => ({ ...map, [topicId]: next }));
    if (practiceOriginTopicId === topicId) {
      sessionMistakesRef.current = new Set();
    }
  };

  const buildCompareItems = async (aId, bId, count) => {
    const aid = asText(aId);
    const bid = asText(bId);
    if (!aid || !bid || aid === bid) return [];

    const [aDoc, bDoc] = await Promise.all([ensureDoc(aid), ensureDoc(bid)]);
    if (!aDoc || !bDoc) return [];

    const aMeta = topicById.get(aid);
    const bMeta = topicById.get(bid);
    const options = [asText(aMeta && aMeta.title) || aid, asText(bMeta && bMeta.title) || bid];

    const items = [];
    const pushMeaning = (doc, correctIndex, sourceId) => {
      const meaningEx = asList(doc && doc.practice && doc.practice.exercises).find((ex) => asText(ex && ex.id) === "meaning");
      const sourceItems = asList(meaningEx && meaningEx.items).slice(0, 9);
      for (const src of sourceItems) {
        items.push({
          id: `cmp_${aid}_${bid}_${asText(src && src.id) || Math.random()}`,
          instruction: asText(src && src.instruction) || "Какое время подходит?",
          prompt: asText(src && src.prompt),
          options,
          correctIndex,
          correctTenseId: correctIndex === 0 ? aid : bid,
          sourceTenseId: asText(src && src.correctTenseId) || sourceId,
          explain: asText(src && src.explain),
        });
      }
    };

    pushMeaning(aDoc, 0, aid);
    pushMeaning(bDoc, 1, bid);

    return shuffleList(items).slice(0, Math.max(5, Math.min(10, Number(count || 10))));
  };

  const startComparePractice = async (count) => {
    const aid = asText(compareA);
    const bid = asText(compareB);
    if (!aid || !bid || aid === bid) return;

    setCompareBusy(true);
    setDocError("");
    try {
      const items = await buildCompareItems(aid, bid, count);
      if (!items.length) {
        setDocError("нет enough compare items для этих тем");
        return;
      }

      const synth = {
        id: SYNTH_COMPARE_ID,
        title: "compare",
        practice: {
          exercises: [
            {
              id: "compare",
              title: "compare",
              kind: "choice",
              items,
            },
          ],
        },
      };

      const aMeta = topicById.get(aid);
      const bMeta = topicById.get(bid);
      const labelA = asText(aMeta && aMeta.title) || aid;
      const labelB = asText(bMeta && bMeta.title) || bid;

      setTopicDocs((prev) => ({ ...prev, [SYNTH_COMPARE_ID]: synth }));
      setSelectedId(SYNTH_COMPARE_ID);
      setPracticeOriginTopicId("");
      setPracticeFilterIds([]);
      sessionMistakesRef.current = new Set();
      setPracticeTitle(`compare: ${labelA} vs ${labelB}`);
      setView("practice");
      resetPracticeState();
    } finally {
      setCompareBusy(false);
    }
  };

  const readDailyCache = () => {
    try {
      const raw = localStorage.getItem(KEY_DAILY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items)) return null;
      return parsed;
    } catch (_err) {
      return null;
    }
  };

  const buildDailyPool = async () => {
    const docs = await Promise.all(topics.map((topic) => ensureDoc(topic.id)));
    const pool = [];

    for (let i = 0; i < topics.length; i += 1) {
      const topic = topics[i];
      const doc = docs[i];
      if (!topic || !doc) continue;

      const exercises = asList(doc && doc.practice && doc.practice.exercises);
      for (const ex of exercises) {
        const kind = asText(ex && ex.kind) || "choice";
        for (const item of asList(ex && ex.items)) {
          pool.push({
            tid: topic.id,
            kind,
            item: {
              ...(item || {}),
              sourceTenseId: asText(item && item.sourceTenseId) || topic.id,
            },
          });
        }
      }
    }

    return pool;
  };

  const pickDailySet = async (forceNew) => {
    const today = todayKey();
    const cached = readDailyCache();
    if (!forceNew && cached && cached.date === today && Array.isArray(cached.items) && cached.items.length) {
      setDailyCached(cached);
      return cached.items;
    }

    const pool = await buildDailyPool();
    const picked = shuffleList(pool).slice(0, 10).map((row, idx) => ({
      ...row,
      item: {
        ...(row.item || {}),
        id: `dy_${row.tid}_${asText(row.item && row.item.id) || idx}`,
      },
    }));

    const next = { date: today, items: picked };
    try {
      localStorage.setItem(KEY_DAILY, JSON.stringify(next));
    } catch (_err) {}
    setDailyCached(next);
    return picked;
  };

  const startDailyPractice = async (forceNew) => {
    setDailyBusy(true);
    setDocError("");
    try {
      const picked = await pickDailySet(!!forceNew);
      if (!picked.length) {
        setDocError("daily pool is empty");
        return;
      }

      const byKind = {};
      for (const row of picked) {
        const kind = asText(row && row.kind) || "choice";
        if (!byKind[kind]) byKind[kind] = [];
        byKind[kind].push({ ...(row && row.item ? row.item : {}) });
      }

      const exercises = Object.keys(byKind).map((kind) => ({
        id: `daily_${kind}`,
        title: `daily (${kind})`,
        kind,
        items: byKind[kind],
      }));

      const synth = {
        id: SYNTH_DAILY_ID,
        title: "daily",
        practice: {
          exercises,
        },
      };

      setTopicDocs((prev) => ({ ...prev, [SYNTH_DAILY_ID]: synth }));
      setSelectedId(SYNTH_DAILY_ID);
      setPracticeOriginTopicId("");
      setPracticeFilterIds([]);
      sessionMistakesRef.current = new Set();
      setPracticeTitle(`daily • ${todayKey()}`);
      setView("practice");
      resetPracticeState();
    } finally {
      setDailyBusy(false);
    }
  };

  const startLibraryPractice = async (idsRaw, autoStart) => {
    const ids = asList(idsRaw)
      .map(asText)
      .filter(Boolean)
      .filter((id, idx, arr) => arr.indexOf(id) === idx)
      .filter((id) => topicById.has(id));

    if (!ids.length) return;

    const docs = await Promise.all(ids.map((id) => ensureDoc(id)));
    const byKind = {};

    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i];
      const doc = docs[i];
      if (!doc) continue;

      for (const ex of asList(doc && doc.practice && doc.practice.exercises)) {
        const kind = asText(ex && ex.kind) || "choice";
        if (!byKind[kind]) byKind[kind] = [];
        for (const item of asList(ex && ex.items)) {
          byKind[kind].push({
            ...(item || {}),
            sourceTenseId: asText(item && item.sourceTenseId) || id,
          });
        }
      }
    }

    const exercises = Object.keys(byKind).map((kind) => ({
      id: `library_${kind}`,
      title: `library (${kind})`,
      kind,
      items: byKind[kind],
    }));

    if (!exercises.length) return;

    const titleParts = ids.slice(0, 3).map((id) => asText(topicById.get(id) && topicById.get(id).title) || id);
    const title = ids.length > 3 ? `${titleParts.join(", ")} +${ids.length - 3}` : titleParts.join(", ");

    setTopicDocs((prev) => ({
      ...prev,
      [SYNTH_LIBRARY_ID]: {
        id: SYNTH_LIBRARY_ID,
        title: "library",
        practice: { exercises },
      },
    }));

    setSelectedId(SYNTH_LIBRARY_ID);
    setPracticeOriginTopicId("");
    setPracticeFilterIds([]);
    sessionMistakesRef.current = new Set();
    setPracticeTitle(`library practice • ${title}`);
    setView("practice");
    resetPracticeState();

    if (autoStart === false) {
      setChecked(false);
    }
  };

  const addTopicToLibrary = (id) => {
    const topicId = asText(id);
    if (!topicId) return;

    const meta = topicById.get(topicId);
    if (!meta) return;

    const lib = window.StudentHelperLibrary;
    if (!lib) return;

    const payload = {
      source: "tenses",
      id: topicId,
      title: asText(meta.title || meta.id),
      subtitle: asText(meta.hint || meta.subtitle),
    };

    if (typeof lib.quickAddWithPicker === "function") lib.quickAddWithPicker(payload);
    else if (typeof lib.quickAdd === "function") lib.quickAdd(payload);
  };

  useEffect(() => {
    if (view !== "compare") return;
    if (compareA) ensureDoc(compareA);
    if (compareB && compareB !== compareA) ensureDoc(compareB);
  }, [compareA, compareB, view]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY_LAST_VIEW, view);
    } catch (_err) {}
  }, [view]);

  useEffect(() => {
    if (!selectedId || !topicById.has(selectedId)) return;
    try {
      localStorage.setItem(KEY_LAST_TOPIC, selectedId);
    } catch (_err) {}
  }, [selectedId, topicById]);

  useEffect(() => {
    if (!checked || !done || !resultState || sessionSaved) return;
    const progressTopicId = asText(practiceOriginTopicId || selectedId);
    if (!progressTopicId || !topicById.has(progressTopicId)) return;

    applyPracticeMistakeResult(current, resultState);
    const totalCorrect = score + (resultState.ok ? 1 : 0);
    const totalAttempted = attempted + 1;
    commitPracticeProgress(progressTopicId, {
      totalCorrect,
      totalAttempted,
      totalQuestions: queue.length,
      mistakes: [...sessionMistakesRef.current],
    });
    setSessionSaved(true);
  }, [
    attempted,
    checked,
    current,
    done,
    practiceOriginTopicId,
    queue.length,
    resultState,
    score,
    selectedId,
    sessionSaved,
    topicById,
  ]);

  useEffect(() => {
    const onLibraryOpen = (event) => {
      const detail = event && event.detail ? event.detail : {};
      if (normalize(detail.source) !== "tenses") return;
      const id = asText(detail.id);
      if (!id || !topicById.has(id)) return;
      if (window.StudentHelperTabs && typeof window.StudentHelperTabs.setMainTab === "function") {
        window.StudentHelperTabs.setMainTab("tenses");
      }
      openTopic(id);
    };

    const onLibraryPractice = (event) => {
      const detail = event && event.detail ? event.detail : {};
      if (normalize(detail.source) !== "tenses") return;

      const ids = Array.isArray(detail.ids) && detail.ids.length ? detail.ids : [detail.id];
      if (window.StudentHelperTabs && typeof window.StudentHelperTabs.setMainTab === "function") {
        window.StudentHelperTabs.setMainTab("tenses");
      }
      startLibraryPractice(ids, detail.autoStart);
    };

    document.addEventListener("sh:library-open", onLibraryOpen);
    document.addEventListener("sh:library-practice", onLibraryPractice);
    return () => {
      document.removeEventListener("sh:library-open", onLibraryOpen);
      document.removeEventListener("sh:library-practice", onLibraryPractice);
    };
  }, [topicById]);

  const checkCurrent = () => {
    if (!current) return;
    const result = evaluateAnswer(current, answerState);
    setResultState(result);
    setChecked(true);
  };

  const nextCurrent = () => {
    if (!current || !resultState) return;
    applyPracticeMistakeResult(current, resultState);
    setAttempted((v) => v + 1);
    if (resultState.ok) setScore((v) => v + 1);

    if (cursor < queue.length - 1) {
      setCursor((v) => v + 1);
      return;
    }

    setChecked(true);
  };

  const restartPractice = () => {
    resetPracticeState();
    if (queue.length) {
      setAnswerState(initAnswer(queue[0]));
    }
  };

  const renderRuleBlock = (block, idx) => {
    const type = asText(block && block.type);

    if (type === "heading") {
      return (
        <h3 key={`${idx}-heading`} className="tw-m-0 tw-text-base tw-font-semibold tw-text-zinc-900">
          {asText(block.text)}
        </h3>
      );
    }

    if (type === "text") {
      return (
        <p key={`${idx}-text`} className="tw-m-0 tw-text-sm tw-leading-relaxed tw-text-zinc-800">
          {asText(block.text)}
        </p>
      );
    }

    if (type === "highlight") {
      return (
        <div key={`${idx}-highlight`} className="tw-border tw-border-zinc-300 tw-bg-zinc-50 tw-p-3">
          {asText(block.title) ? <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-zinc-900">{asText(block.title)}</p> : null}
          <ul className="tw-m-0 tw-mt-2 tw-list-disc tw-space-y-1 tw-pl-5 tw-text-sm tw-text-zinc-800">
            {asList(block.lines).map((line, lineIdx) => (
              <li key={`${idx}-line-${lineIdx}`}>{asText(line)}</li>
            ))}
          </ul>
        </div>
      );
    }

    if (type === "table") {
      return (
        <div key={`${idx}-table`} className="tw-space-y-2">
          {asText(block.caption) ? <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-zinc-900">{asText(block.caption)}</p> : null}
          <RuleTable block={block} />
        </div>
      );
    }

    if (type === "examples") {
      return (
        <div key={`${idx}-examples`} className="tw-border tw-border-zinc-300 tw-bg-white tw-p-3">
          <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-zinc-900">examples</p>
          <ul className="tw-m-0 tw-mt-2 tw-list-none tw-space-y-2 tw-p-0">
            {asList(block.items).map((item, itemIdx) => (
              <li key={`${idx}-example-${itemIdx}`} className="tw-border-b tw-border-zinc-200 tw-pb-2 last:tw-border-b-0 last:tw-pb-0">
                <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-zinc-900">{asText(item && item.en)}</p>
                <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-zinc-700">{asText(item && item.ru)}</p>
              </li>
            ))}
          </ul>
        </div>
      );
    }

    if (type === "topicLinks") {
      return (
        <div key={`${idx}-links`} className="tw-border tw-border-zinc-300 tw-bg-zinc-50 tw-p-3">
          {asText(block.title) ? <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-zinc-900">{asText(block.title)}</p> : null}
          {asText(block.note) ? <p className="tw-m-0 tw-mt-1 tw-text-xs tw-text-zinc-600">{asText(block.note)}</p> : null}
          <div className="tw-mt-2 tw-space-y-2">
            {asList(block.items).map((item, itemIdx) => {
              const linkedId = asText(item && item.id);
              return (
                <div key={`${idx}-topic-link-${itemIdx}`} className="tw-border tw-border-zinc-200 tw-bg-white tw-p-2">
                  <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-zinc-900">{asText(item && item.label) || linkedId || "topic"}</p>
                  {asText(item && item.note) ? <p className="tw-m-0 tw-mt-1 tw-text-xs tw-text-zinc-600">{asText(item.note)}</p> : null}
                  {linkedId ? (
                    <button
                      type="button"
                      className="tw-mt-2 tw-border tw-border-zinc-400 tw-bg-white tw-px-2 tw-py-1 tw-text-[11px] tw-uppercase tw-tracking-[0.08em] hover:tw-border-black"
                      onClick={() => openTopic(linkedId)}
                    >
                      открыть тему
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <pre key={`${idx}-unknown`} className="tw-overflow-auto tw-border tw-border-zinc-300 tw-bg-zinc-50 tw-p-2 tw-text-xs tw-text-zinc-700">
        {JSON.stringify(block, null, 2)}
      </pre>
    );
  };

  const renderPracticeInput = () => {
    if (!current) return null;
    const item = current.item || {};
    const kind = asText(current.kind);

    if (kind === "choice") {
      return (
        <ul className="tw-m-0 tw-list-none tw-space-y-2 tw-p-0">
          {asList(item.options).map((opt, idx) => {
            const active = Number(answerState.selectedIndex) === idx;
            return (
              <li key={`${current.key}-choice-${idx}`}>
                <button
                  type="button"
                  onClick={() => setAnswerState({ selectedIndex: idx })}
                  className={[
                    "tw-w-full tw-border tw-px-3 tw-py-2 tw-text-left tw-text-sm",
                    active ? "tw-border-black tw-bg-black tw-text-white" : "tw-border-zinc-300 tw-bg-white tw-text-zinc-900 hover:tw-border-zinc-500",
                  ].join(" ")}
                >
                  {asText(opt)}
                </button>
              </li>
            );
          })}
        </ul>
      );
    }

    if (kind === "multi") {
      return (
        <ul className="tw-m-0 tw-list-none tw-space-y-2 tw-p-0">
          {asList(item.options).map((opt, idx) => {
            const selected = !!(answerState.selected && answerState.selected[idx]);
            return (
              <li key={`${current.key}-multi-${idx}`}>
                <label className="tw-flex tw-items-start tw-gap-2 tw-border tw-border-zinc-300 tw-bg-white tw-px-3 tw-py-2 tw-text-sm tw-text-zinc-900">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(e) => {
                      setAnswerState((prev) => ({
                        selected: {
                          ...(prev && prev.selected ? prev.selected : {}),
                          [idx]: !!e.target.checked,
                        },
                      }));
                    }}
                  />
                  <span>{asText(opt)}</span>
                </label>
              </li>
            );
          })}
        </ul>
      );
    }

    if (kind === "input" || kind === "correction") {
      return (
        <textarea
          className="tw-min-h-[92px] tw-w-full tw-border tw-border-zinc-400 tw-bg-white tw-px-3 tw-py-2 tw-text-sm tw-text-zinc-900 tw-outline-none focus:tw-border-black"
          value={asText(answerState.text)}
          onChange={(e) => setAnswerState({ text: e.target.value })}
          placeholder="введи ответ"
        />
      );
    }

    if (kind === "multi_input") {
      const inputs = asList(item.inputs);
      const values = asList(answerState.values);
      return (
        <div className="tw-space-y-2">
          {inputs.map((_, idx) => (
            <input
              key={`${current.key}-multi-input-${idx}`}
              className="tw-w-full tw-border tw-border-zinc-400 tw-bg-white tw-px-3 tw-py-2 tw-text-sm tw-text-zinc-900 tw-outline-none focus:tw-border-black"
              value={asText(values[idx])}
              onChange={(e) => {
                const next = values.slice();
                next[idx] = e.target.value;
                setAnswerState({ values: next });
              }}
              placeholder={`ответ ${idx + 1}`}
            />
          ))}
        </div>
      );
    }

    if (kind === "inline_select") {
      const segments = asList(item.segments);
      const blanks = asList(item.blanks);
      const values = asList(answerState.values);
      return (
        <div className="tw-space-y-3">
          {asText(item.storyTitle) ? <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-zinc-900">{asText(item.storyTitle)}</p> : null}
          <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-text-sm tw-text-zinc-900">
            {blanks.map((blank, idx) => (
              <span key={`${current.key}-inline-${idx}`} className="tw-flex tw-items-center tw-gap-2">
                <span>{asText(segments[idx])}</span>
                <select
                  className="tw-border tw-border-zinc-400 tw-bg-white tw-px-2 tw-py-1 tw-text-sm tw-outline-none focus:tw-border-black"
                  value={Number.isFinite(Number(values[idx])) ? String(values[idx]) : ""}
                  onChange={(e) => {
                    const next = values.slice();
                    const v = asText(e.target.value);
                    next[idx] = v === "" ? -1 : Number(v);
                    setAnswerState({ values: next });
                  }}
                >
                  <option value="">...</option>
                  {asList(blank && blank.options).map((opt, optIdx) => (
                    <option key={`${current.key}-inline-opt-${idx}-${optIdx}`} value={String(optIdx)}>
                      {asText(opt)}
                    </option>
                  ))}
                </select>
              </span>
            ))}
            <span>{asText(segments[blanks.length])}</span>
          </div>
        </div>
      );
    }

    if (kind === "match") {
      const pairs = asList(item.pairs);
      const rights = [...new Set(pairs.map((pair) => asText(pair && pair.right)).filter(Boolean))];
      const picks = (answerState && answerState.picks) || {};

      return (
        <div className="tw-space-y-2">
          {pairs.map((pair, idx) => {
            const left = asText(pair && pair.left);
            return (
              <div key={`${current.key}-match-${idx}`} className="tw-grid tw-gap-2 sm:tw-grid-cols-[minmax(180px,1fr)_minmax(200px,1fr)]">
                <div className="tw-border tw-border-zinc-300 tw-bg-zinc-50 tw-px-3 tw-py-2 tw-text-sm tw-text-zinc-900">{left}</div>
                <select
                  className="tw-border tw-border-zinc-400 tw-bg-white tw-px-2 tw-py-2 tw-text-sm tw-outline-none focus:tw-border-black"
                  value={asText(picks[left])}
                  onChange={(e) => {
                    setAnswerState((prev) => ({
                      picks: {
                        ...(prev && prev.picks ? prev.picks : {}),
                        [left]: e.target.value,
                      },
                    }));
                  }}
                >
                  <option value="">...</option>
                  {rights.map((right, rightIdx) => (
                    <option key={`${current.key}-match-opt-${idx}-${rightIdx}`} value={right}>
                      {right}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      );
    }

    if (kind === "drag_sort") {
      const bins = asList(item.bins);
      const words = asList(item.words);
      const picks = asList(answerState.picks);

      return (
        <div className="tw-space-y-2">
          {words.map((word, idx) => (
            <div key={`${current.key}-drag-${idx}`} className="tw-grid tw-gap-2 sm:tw-grid-cols-[minmax(180px,1fr)_minmax(200px,1fr)]">
              <div className="tw-border tw-border-zinc-300 tw-bg-zinc-50 tw-px-3 tw-py-2 tw-text-sm tw-text-zinc-900">{asText(word && word.text)}</div>
              <select
                className="tw-border tw-border-zinc-400 tw-bg-white tw-px-2 tw-py-2 tw-text-sm tw-outline-none focus:tw-border-black"
                value={asText(picks[idx])}
                onChange={(e) => {
                  const next = picks.slice();
                  next[idx] = e.target.value;
                  setAnswerState({ picks: next });
                }}
              >
                <option value="">...</option>
                {bins.map((bin, binIdx) => (
                  <option key={`${current.key}-drag-bin-${idx}-${binIdx}`} value={asText(bin)}>
                    {asText(bin)}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      );
    }

    return (
      <pre className="tw-overflow-auto tw-border tw-border-zinc-300 tw-bg-zinc-50 tw-p-2 tw-text-xs tw-text-zinc-700">
        {JSON.stringify(item, null, 2)}
      </pre>
    );
  };

  if (!hostEl) return null;

  const ruleBlocks = asList(selectedDoc && selectedDoc.ruleBlocks);
  const shownRuleBlocks = expandedRule ? ruleBlocks : ruleBlocks.slice(0, RULE_PREVIEW_LIMIT);
  const compareMetaA = compareA ? topicById.get(compareA) : null;
  const compareMetaB = compareB ? topicById.get(compareB) : null;
  const compareDocA = compareA ? topicDocs[compareA] : null;
  const compareDocB = compareB ? topicDocs[compareB] : null;
  const compareQuickA = compareMetaA ? quickCompareData(compareMetaA, compareDocA) : null;
  const compareQuickB = compareMetaB ? quickCompareData(compareMetaB, compareDocB) : null;
  const practiceHeading = asText(selectedMeta && selectedMeta.title) || asText(practiceTitle) || asText(selectedId);
  const dailyDate = asText(dailyCached && dailyCached.date);
  const dailyCount = Number(dailyCached && asList(dailyCached.items).length) || 0;
  const selectedProgress = selectedMeta ? (progressById[selectedMeta.id] || { mastery: 0, best: {}, mistakes: [] }) : null;
  const selectedMistakes = asList(selectedProgress && selectedProgress.mistakes);
  const selectedMistakesCount = selectedMistakes.length;
  const practiceMistakesMode = practiceFilterIds.length > 0;
  const constructorMainMeta = constructorRec && constructorRec.mainId ? topicById.get(constructorRec.mainId) : null;
  const constructorAltMetas = asList(constructorRec && constructorRec.alternatives)
    .map((id) => topicById.get(id))
    .filter(Boolean);
  const constructorPathLabels = constructorPath
    .map((step) => {
      const node = CONSTRUCTOR_NODES[asText(step && step.node)] || CONSTRUCTOR_NODES.root;
      const option = asList(node && node.options).find((opt) => asText(opt && opt.id) === asText(step && step.option));
      return asText(option && option.label);
    })
    .filter(Boolean);

  return createPortal(
    <section className="tw-border tw-border-black tw-bg-white tw-p-4" aria-label="Grammar React section">
      <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-border-b tw-border-zinc-300 tw-pb-3">
        <p className="tw-m-0 tw-text-lg tw-font-semibold tw-uppercase tw-tracking-[0.16em]">grammar</p>
        <span className="tw-border tw-border-zinc-400 tw-px-2 tw-py-0.5 tw-text-[11px] tw-uppercase tw-tracking-[0.12em]">next/react/tailwind</span>
        <div className="tw-ml-auto tw-flex tw-flex-wrap tw-gap-2">
          <button
            type="button"
            onClick={() => setView("home")}
            className={[
              "tw-border tw-px-3 tw-py-1.5 tw-text-xs tw-uppercase tw-tracking-[0.1em]",
              view === "home" ? "tw-border-black tw-bg-black tw-text-white" : "tw-border-zinc-400 tw-bg-white hover:tw-border-black",
            ].join(" ")}
          >
            home
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            className={[
              "tw-border tw-px-3 tw-py-1.5 tw-text-xs tw-uppercase tw-tracking-[0.1em]",
              view === "list" ? "tw-border-black tw-bg-black tw-text-white" : "tw-border-zinc-400 tw-bg-white hover:tw-border-black",
            ].join(" ")}
          >
            topics
          </button>
          <button
            type="button"
            onClick={() => {
              if (!selectedId) return;
              setView("detail");
              ensureDoc(selectedId);
            }}
            className={[
              "tw-border tw-px-3 tw-py-1.5 tw-text-xs tw-uppercase tw-tracking-[0.1em]",
              view === "detail" ? "tw-border-black tw-bg-black tw-text-white" : "tw-border-zinc-400 tw-bg-white hover:tw-border-black",
            ].join(" ")}
            disabled={!selectedId}
          >
            rule
          </button>
          <button
            type="button"
            onClick={() => setView("constructor")}
            className={[
              "tw-border tw-px-3 tw-py-1.5 tw-text-xs tw-uppercase tw-tracking-[0.1em]",
              view === "constructor" ? "tw-border-black tw-bg-black tw-text-white" : "tw-border-zinc-400 tw-bg-white hover:tw-border-black",
            ].join(" ")}
          >
            constructor
          </button>
          <button
            type="button"
            onClick={() => setView("compare")}
            className={[
              "tw-border tw-px-3 tw-py-1.5 tw-text-xs tw-uppercase tw-tracking-[0.1em]",
              view === "compare" ? "tw-border-black tw-bg-black tw-text-white" : "tw-border-zinc-400 tw-bg-white hover:tw-border-black",
            ].join(" ")}
          >
            compare
          </button>
          <button
            type="button"
            onClick={() => setView("daily")}
            className={[
              "tw-border tw-px-3 tw-py-1.5 tw-text-xs tw-uppercase tw-tracking-[0.1em]",
              view === "daily" ? "tw-border-black tw-bg-black tw-text-white" : "tw-border-zinc-400 tw-bg-white hover:tw-border-black",
            ].join(" ")}
          >
            daily
          </button>
          <button
            type="button"
            onClick={() => {
              if (!selectedId) return;
              startTopicPractice(selectedId);
            }}
            className={[
              "tw-border tw-px-3 tw-py-1.5 tw-text-xs tw-uppercase tw-tracking-[0.1em]",
              view === "practice" ? "tw-border-black tw-bg-black tw-text-white" : "tw-border-zinc-400 tw-bg-white hover:tw-border-black",
            ].join(" ")}
            disabled={!selectedId}
          >
            practice
          </button>
        </div>
      </div>

      <p className="tw-m-0 tw-mt-2 tw-text-sm tw-text-zinc-700">
        Новые правила и упражнения добавляй в `crate/student_helper/db/tenses/index.json` и `crate/student_helper/db/tenses/*.json`.
      </p>

      {loadingIndex ? <p className="tw-m-0 tw-mt-3 tw-text-sm tw-text-zinc-600">загрузка grammar index...</p> : null}
      {indexError ? <p className="tw-m-0 tw-mt-3 tw-text-sm tw-text-red-700">{indexError}</p> : null}
      {docError ? <p className="tw-m-0 tw-mt-2 tw-text-sm tw-text-red-700">{docError}</p> : null}

      {view === "home" ? (
        <div className="tw-mt-4 tw-space-y-4">
          <div className="tw-border tw-border-zinc-300 tw-bg-zinc-50 tw-p-3">
            <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-zinc-900">уровень grammar</p>
            <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-zinc-700">фильтрует каталог и помогает constructor выбирать более точные рекомендации.</p>
            <div className="tw-mt-2 tw-flex tw-flex-wrap tw-gap-2">
              <button
                type="button"
                onClick={() => persistGrammarLevel("")}
                className={[
                  "tw-border tw-px-3 tw-py-1.5 tw-text-xs tw-uppercase tw-tracking-[0.08em]",
                  !grammarLevel ? "tw-border-black tw-bg-black tw-text-white" : "tw-border-zinc-400 tw-bg-white hover:tw-border-black",
                ].join(" ")}
              >
                all levels
              </button>
              {LEVELS.map((level) => (
                <button
                  key={`level-home-${level}`}
                  type="button"
                  onClick={() => persistGrammarLevel(level)}
                  className={[
                    "tw-border tw-px-3 tw-py-1.5 tw-text-xs tw-uppercase tw-tracking-[0.08em]",
                    grammarLevel === level ? "tw-border-black tw-bg-black tw-text-white" : "tw-border-zinc-400 tw-bg-white hover:tw-border-black",
                  ].join(" ")}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="tw-grid tw-gap-3 md:tw-grid-cols-2 xl:tw-grid-cols-4">
            {groups.map((group) => {
              const count = topicsByLevel.filter((topic) => topic.group === group).length;
              return (
                <button
                  key={`group-${group}`}
                  type="button"
                  onClick={() => {
                    setGroupFilter(group);
                    setView("list");
                  }}
                  className="tw-border tw-border-zinc-300 tw-bg-zinc-50 tw-p-3 tw-text-left hover:tw-border-black"
                >
                  <span className="tw-block tw-text-xs tw-uppercase tw-tracking-[0.1em] tw-text-zinc-600">group</span>
                  <span className="tw-mt-1 tw-block tw-text-base tw-font-semibold tw-text-zinc-900">{groupTitle(group)}</span>
                  <span className="tw-mt-1 tw-block tw-text-sm tw-text-zinc-700">тем: {count}</span>
                </button>
              );
            })}
          </div>
          {!topicsByLevel.length ? <p className="tw-m-0 tw-text-sm tw-text-zinc-600">для выбранного уровня пока нет тем</p> : null}

          <div className="tw-border tw-border-zinc-300 tw-bg-white tw-p-3">
            <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-zinc-900">быстрый старт</p>
            <div className="tw-mt-2 tw-flex tw-flex-wrap tw-gap-2">
              {topicsByLevel.slice(0, 8).map((topic) => (
                <button
                  key={`quick-${topic.id}`}
                  type="button"
                  onClick={() => openTopic(topic.id)}
                  className="tw-border tw-border-zinc-400 tw-bg-white tw-px-3 tw-py-1.5 tw-text-xs tw-text-zinc-900 hover:tw-border-black"
                >
                  {topic.title || topic.id}
                </button>
              ))}
            </div>
          </div>

          <div className="tw-border tw-border-zinc-300 tw-bg-zinc-50 tw-p-3">
            <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-zinc-900">grammar constructor</p>
            <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-zinc-700">если не уверен какое правило выбрать, задай смысл и получи 1 главный вариант + альтернативы.</p>
            <div className="tw-mt-2 tw-flex tw-flex-wrap tw-gap-2">
              <button
                type="button"
                onClick={() => setView("constructor")}
                className="tw-border tw-border-black tw-bg-black tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.1em] tw-text-white hover:tw-bg-zinc-800"
              >
                открыть constructor
              </button>
              <button
                type="button"
                onClick={resetConstructor}
                className="tw-border tw-border-zinc-400 tw-bg-white tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.1em] hover:tw-border-black"
              >
                сбросить шаги
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {view === "list" ? (
        <div className="tw-mt-4 tw-space-y-3">
          <div className="tw-flex tw-flex-wrap tw-gap-2">
            <select
              className="tw-border tw-border-zinc-400 tw-bg-white tw-px-2 tw-py-2 tw-text-sm tw-outline-none focus:tw-border-black"
              value={grammarLevel}
              onChange={(e) => persistGrammarLevel(e.target.value)}
            >
              <option value="">all levels</option>
              {LEVELS.map((level) => (
                <option key={`level-list-${level}`} value={level}>
                  {level}
                </option>
              ))}
            </select>

            <select
              className="tw-border tw-border-zinc-400 tw-bg-white tw-px-2 tw-py-2 tw-text-sm tw-outline-none focus:tw-border-black"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
            >
              <option value="all">all groups</option>
              {groups.map((group) => (
                <option key={`filter-${group}`} value={group}>
                  {groupTitle(group)}
                </option>
              ))}
            </select>

            <input
              className="tw-min-w-[240px] tw-flex-1 tw-border tw-border-zinc-400 tw-bg-white tw-px-3 tw-py-2 tw-text-sm tw-outline-none focus:tw-border-black"
              type="search"
              placeholder="поиск: perfect, passive, adverbs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setSearch("")}
              className="tw-border tw-border-zinc-400 tw-bg-white tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.1em] hover:tw-border-black"
            >
              очистить
            </button>
          </div>

          {!filteredTopics.length ? <p className="tw-m-0 tw-text-sm tw-text-zinc-600">ничего не найдено</p> : null}

          <ul className="tw-m-0 tw-list-none tw-space-y-2 tw-p-0">
            {filteredTopics.map((topic) => (
              <li key={`topic-row-${topic.id}`} className="tw-border tw-border-zinc-300 tw-bg-white tw-p-3">
                <div className="tw-flex tw-flex-wrap tw-items-start tw-gap-2">
                  <div>
                    <p className="tw-m-0 tw-text-base tw-font-semibold tw-text-zinc-900">{topic.title || topic.id}</p>
                    <p className="tw-mt-1 tw-text-sm tw-text-zinc-700">{topic.subtitle || topic.hint || "—"}</p>
                    <p className="tw-mt-1 tw-text-xs tw-text-zinc-600">group: {groupTitle(topic.group)} • kind: {topic.kind || "topic"}</p>
                    <p className="tw-mt-1 tw-text-xs tw-text-zinc-600">
                      mastery: {Number(progressById[topic.id] && progressById[topic.id].mastery) || 0}/5 ({masteryLabel(progressById[topic.id] && progressById[topic.id].mastery)})
                    </p>
                    <p className="tw-mt-1 tw-text-xs tw-text-zinc-600">
                      mistakes: {asList(progressById[topic.id] && progressById[topic.id].mistakes).length}
                    </p>
                  </div>
                  <div className="tw-ml-auto tw-flex tw-flex-wrap tw-gap-2">
                    <button
                      type="button"
                      onClick={() => openTopic(topic.id)}
                      className="tw-border tw-border-black tw-bg-black tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.1em] tw-text-white hover:tw-bg-zinc-800"
                    >
                      открыть
                    </button>
                    <button
                      type="button"
                      onClick={() => startTopicPractice(topic.id)}
                      className="tw-border tw-border-zinc-400 tw-bg-white tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.1em] hover:tw-border-black"
                    >
                      practice
                    </button>
                    {asList(progressById[topic.id] && progressById[topic.id].mistakes).length ? (
                      <button
                        type="button"
                        onClick={() => startTopicMistakesPractice(topic.id)}
                        className="tw-border tw-border-zinc-400 tw-bg-white tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.1em] hover:tw-border-black"
                      >
                        mistakes
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => addTopicToLibrary(topic.id)}
                      className="tw-border tw-border-zinc-400 tw-bg-white tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.1em] hover:tw-border-black"
                    >
                      в библиотеку
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {view === "constructor" ? (
        <div className="tw-mt-4 tw-space-y-3">
          <div className="tw-border tw-border-zinc-300 tw-bg-zinc-50 tw-p-3">
            <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-zinc-900">grammar constructor</p>
            <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-zinc-700">опиши свою фразу (по желанию), пройди по шагам и получи точную тему + альтернативы.</p>
            {grammarLevel ? <p className="tw-m-0 tw-mt-1 tw-text-xs tw-text-zinc-600">активный уровень: {grammarLevel}</p> : null}
            <textarea
              className="tw-mt-2 tw-min-h-[82px] tw-w-full tw-border tw-border-zinc-400 tw-bg-white tw-px-3 tw-py-2 tw-text-sm tw-text-zinc-900 tw-outline-none focus:tw-border-black"
              value={constructorPhrase}
              onChange={(e) => updateConstructorPhrase(e.target.value)}
              placeholder="пример: Я планирую начать курс в следующем месяце"
            />
          </div>

          {!constructorRec ? (
            <div className="tw-border tw-border-zinc-300 tw-bg-white tw-p-3">
              <p className="tw-m-0 tw-text-xs tw-uppercase tw-tracking-[0.1em] tw-text-zinc-600">шаг {constructorPath.length + 1}</p>
              <p className="tw-m-0 tw-mt-2 tw-text-base tw-font-semibold tw-text-zinc-900">{asText(constructorNode && constructorNode.q) || "выбери вариант"}</p>
              {asText(constructorNode && constructorNode.hint) ? (
                <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-zinc-700">{asText(constructorNode.hint)}</p>
              ) : null}
              {constructorPathLabels.length ? (
                <p className="tw-m-0 tw-mt-2 tw-text-xs tw-text-zinc-600">путь: {constructorPathLabels.join(" -> ")}</p>
              ) : null}
              <div className="tw-mt-3 tw-flex tw-flex-wrap tw-gap-2">
                {asList(constructorNode && constructorNode.options).map((opt, idx) => (
                  <button
                    key={`constructor-opt-${constructorNodeId}-${idx}`}
                    type="button"
                    onClick={() => chooseConstructorOption(opt)}
                    className="tw-border tw-border-zinc-400 tw-bg-white tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.08em] hover:tw-border-black"
                  >
                    {asText(opt && opt.label) || asText(opt && opt.id) || "option"}
                  </button>
                ))}
                {constructorPath.length ? (
                  <button
                    type="button"
                    onClick={backConstructorStep}
                    className="tw-border tw-border-zinc-400 tw-bg-white tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.08em] hover:tw-border-black"
                  >
                    назад
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={resetConstructor}
                  className="tw-border tw-border-zinc-400 tw-bg-white tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.08em] hover:tw-border-black"
                >
                  сброс
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="tw-border tw-border-zinc-300 tw-bg-white tw-p-3">
                <p className="tw-m-0 tw-text-xs tw-uppercase tw-tracking-[0.1em] tw-text-zinc-600">главный вариант</p>
                <p className="tw-m-0 tw-mt-2 tw-text-lg tw-font-semibold tw-text-zinc-900">{asText(constructorMainMeta && constructorMainMeta.title) || asText(constructorRec.mainId)}</p>
                <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-zinc-700">{asText(constructorMainMeta && (constructorMainMeta.subtitle || constructorMainMeta.hint)) || "—"}</p>
                {asText(constructorRec.reason) ? <p className="tw-m-0 tw-mt-2 tw-text-sm tw-text-zinc-800">{asText(constructorRec.reason)}</p> : null}
                {asText(constructorRec.smartNote) ? (
                  <p className="tw-m-0 tw-mt-2 tw-border tw-border-zinc-300 tw-bg-zinc-50 tw-p-2 tw-text-sm tw-text-zinc-800">{asText(constructorRec.smartNote)}</p>
                ) : null}
                {constructorRec.outOfLevel ? (
                  <p className="tw-m-0 tw-mt-2 tw-text-xs tw-text-zinc-600">тема может быть выше/ниже текущего уровня, но по смыслу она наиболее точная.</p>
                ) : null}

                <div className="tw-mt-3 tw-flex tw-flex-wrap tw-gap-2">
                  <button
                    type="button"
                    onClick={() => openConstructorRule(constructorRec.mainId)}
                    className="tw-border tw-border-black tw-bg-black tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.1em] tw-text-white hover:tw-bg-zinc-800"
                  >
                    открыть правило
                  </button>
                  <button
                    type="button"
                    onClick={() => startTopicPractice(constructorRec.mainId)}
                    className="tw-border tw-border-zinc-400 tw-bg-white tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.1em] hover:tw-border-black"
                  >
                    сразу practice
                  </button>
                  <button
                    type="button"
                    onClick={() => addTopicToLibrary(constructorRec.mainId)}
                    className="tw-border tw-border-zinc-400 tw-bg-white tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.1em] hover:tw-border-black"
                  >
                    в библиотеку
                  </button>
                  <button
                    type="button"
                    onClick={resetConstructor}
                    className="tw-border tw-border-zinc-400 tw-bg-white tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.1em] hover:tw-border-black"
                  >
                    начать заново
                  </button>
                </div>
              </div>

              {constructorAltMetas.length ? (
                <div className="tw-space-y-2">
                  <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-zinc-900">альтернативы</p>
                  {constructorAltMetas.map((meta) => (
                    <div key={`constructor-alt-${meta.id}`} className="tw-border tw-border-zinc-300 tw-bg-white tw-p-3">
                      <p className="tw-m-0 tw-text-base tw-font-semibold tw-text-zinc-900">{meta.title || meta.id}</p>
                      <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-zinc-700">{meta.subtitle || meta.hint || "—"}</p>
                      <div className="tw-mt-2 tw-flex tw-flex-wrap tw-gap-2">
                        <button
                          type="button"
                          onClick={() => openConstructorRule(meta.id)}
                          className="tw-border tw-border-zinc-400 tw-bg-white tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.08em] hover:tw-border-black"
                        >
                          открыть
                        </button>
                        <button
                          type="button"
                          onClick={() => startTopicPractice(meta.id)}
                          className="tw-border tw-border-zinc-400 tw-bg-white tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.08em] hover:tw-border-black"
                        >
                          practice
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {view === "compare" ? (
        <div className="tw-mt-4 tw-space-y-3">
          {!comparableTopics.length ? (
            <p className="tw-m-0 tw-text-sm tw-text-zinc-600">для compare нужно минимум 2 темы с kind: tense</p>
          ) : (
            <>
              <div className="tw-grid tw-gap-2 sm:tw-grid-cols-2">
                <label className="tw-space-y-1 tw-text-sm tw-text-zinc-700">
                  <span className="tw-block tw-text-xs tw-uppercase tw-tracking-[0.1em]">topic A</span>
                  <select
                    className="tw-w-full tw-border tw-border-zinc-400 tw-bg-white tw-px-2 tw-py-2 tw-text-sm tw-outline-none focus:tw-border-black"
                    value={compareA}
                    onChange={(e) => setCompareA(e.target.value)}
                  >
                    {comparableTopics.map((topic) => (
                      <option key={`cmp-a-${topic.id}`} value={topic.id}>
                        {topic.title || topic.id}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="tw-space-y-1 tw-text-sm tw-text-zinc-700">
                  <span className="tw-block tw-text-xs tw-uppercase tw-tracking-[0.1em]">topic B</span>
                  <select
                    className="tw-w-full tw-border tw-border-zinc-400 tw-bg-white tw-px-2 tw-py-2 tw-text-sm tw-outline-none focus:tw-border-black"
                    value={compareB}
                    onChange={(e) => setCompareB(e.target.value)}
                  >
                    {comparableTopics.map((topic) => (
                      <option key={`cmp-b-${topic.id}`} value={topic.id}>
                        {topic.title || topic.id}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {compareA && compareB && compareA !== compareB ? (
                <>
                  <div className="tw-border tw-border-zinc-300 tw-bg-zinc-50 tw-p-3 tw-text-sm tw-text-zinc-800">
                    {compareRuleHint(compareA, compareB)}
                  </div>
                  <div className="tw-overflow-x-auto tw-border tw-border-zinc-300">
                    <table className="tw-min-w-full tw-border-collapse tw-text-left tw-text-sm">
                      <thead className="tw-bg-zinc-100">
                        <tr>
                          <th className="tw-border-b tw-border-zinc-300 tw-px-3 tw-py-2" />
                          <th className="tw-border-b tw-border-zinc-300 tw-px-3 tw-py-2 tw-font-semibold tw-text-zinc-900">
                            {asText(compareMetaA && compareMetaA.title) || compareA}
                          </th>
                          <th className="tw-border-b tw-border-zinc-300 tw-px-3 tw-py-2 tw-font-semibold tw-text-zinc-900">
                            {asText(compareMetaB && compareMetaB.title) || compareB}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="odd:tw-bg-white even:tw-bg-zinc-50">
                          <th className="tw-border-b tw-border-zinc-200 tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.08em] tw-text-zinc-600">когда</th>
                          <td className="tw-border-b tw-border-zinc-200 tw-px-3 tw-py-2 tw-text-zinc-800">{asText(compareQuickA && compareQuickA.when) || "—"}</td>
                          <td className="tw-border-b tw-border-zinc-200 tw-px-3 tw-py-2 tw-text-zinc-800">{asText(compareQuickB && compareQuickB.when) || "—"}</td>
                        </tr>
                        <tr className="odd:tw-bg-white even:tw-bg-zinc-50">
                          <th className="tw-border-b tw-border-zinc-200 tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.08em] tw-text-zinc-600">маркеры</th>
                          <td className="tw-border-b tw-border-zinc-200 tw-px-3 tw-py-2 tw-text-zinc-800">{asText(compareQuickA && compareQuickA.markers) || "—"}</td>
                          <td className="tw-border-b tw-border-zinc-200 tw-px-3 tw-py-2 tw-text-zinc-800">{asText(compareQuickB && compareQuickB.markers) || "—"}</td>
                        </tr>
                        <tr className="odd:tw-bg-white even:tw-bg-zinc-50">
                          <th className="tw-border-b tw-border-zinc-200 tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.08em] tw-text-zinc-600">формула</th>
                          <td className="tw-border-b tw-border-zinc-200 tw-px-3 tw-py-2 tw-text-zinc-800">{asText(compareQuickA && compareQuickA.formula) || "—"}</td>
                          <td className="tw-border-b tw-border-zinc-200 tw-px-3 tw-py-2 tw-text-zinc-800">{asText(compareQuickB && compareQuickB.formula) || "—"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="tw-flex tw-flex-wrap tw-gap-2">
                    <button
                      type="button"
                      onClick={() => startComparePractice(10)}
                      className="tw-border tw-border-black tw-bg-black tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.1em] tw-text-white hover:tw-bg-zinc-800"
                      disabled={compareBusy}
                    >
                      {compareBusy ? "loading..." : "mini training (10)"}
                    </button>
                    <button
                      type="button"
                      onClick={() => startComparePractice(5)}
                      className="tw-border tw-border-zinc-400 tw-bg-white tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.1em] hover:tw-border-black"
                      disabled={compareBusy}
                    >
                      mini (5)
                    </button>
                  </div>
                </>
              ) : (
                <p className="tw-m-0 tw-text-sm tw-text-zinc-600">выбери 2 разные темы</p>
              )}
            </>
          )}
        </div>
      ) : null}

      {view === "daily" ? (
        <div className="tw-mt-4 tw-space-y-3">
          <div className="tw-border tw-border-zinc-300 tw-bg-zinc-50 tw-p-3">
            <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-zinc-900">daily mini-session</p>
            <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-zinc-700">10 случайных заданий на сегодня из текущей grammar базы.</p>
            {dailyDate ? <p className="tw-m-0 tw-mt-1 tw-text-xs tw-text-zinc-600">кэш: {dailyDate} • заданий: {dailyCount}</p> : null}
          </div>

          <div className="tw-flex tw-flex-wrap tw-gap-2">
            <button
              type="button"
              onClick={() => startDailyPractice(false)}
              className="tw-border tw-border-black tw-bg-black tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.1em] tw-text-white hover:tw-bg-zinc-800"
              disabled={dailyBusy}
            >
              {dailyBusy ? "loading..." : "start daily (10)"}
            </button>
            <button
              type="button"
              onClick={() => startDailyPractice(true)}
              className="tw-border tw-border-zinc-400 tw-bg-white tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.1em] hover:tw-border-black"
              disabled={dailyBusy}
            >
              new set
            </button>
          </div>
        </div>
      ) : null}

      {view === "detail" ? (
        <div className="tw-mt-4 tw-space-y-3">
          {!selectedMeta ? (
            <p className="tw-m-0 tw-text-sm tw-text-zinc-600">выбери тему в topics</p>
          ) : (
            <>
              <div className="tw-flex tw-flex-wrap tw-items-start tw-gap-2">
                <div>
                  <p className="tw-m-0 tw-text-lg tw-font-semibold tw-text-zinc-900">{selectedMeta.title || selectedMeta.id}</p>
                  <p className="tw-mt-1 tw-text-sm tw-text-zinc-700">{selectedMeta.subtitle || selectedMeta.hint || "—"}</p>
                  <p className="tw-mt-1 tw-text-xs tw-text-zinc-600">
                    mastery: {Number(selectedProgress && selectedProgress.mastery) || 0}/5 ({masteryLabel(selectedProgress && selectedProgress.mastery)})
                  </p>
                  <p className="tw-mt-1 tw-text-xs tw-text-zinc-600">mistakes: {selectedMistakesCount}</p>
                </div>
                <div className="tw-ml-auto tw-flex tw-flex-wrap tw-gap-2">
                  <button
                    type="button"
                    onClick={() => startTopicPractice(selectedMeta.id)}
                    className="tw-border tw-border-black tw-bg-black tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.1em] tw-text-white hover:tw-bg-zinc-800"
                  >
                    начать practice
                  </button>
                  {selectedMistakesCount ? (
                    <button
                      type="button"
                      onClick={() => startTopicMistakesPractice(selectedMeta.id)}
                      className="tw-border tw-border-zinc-400 tw-bg-white tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.1em] hover:tw-border-black"
                    >
                      practice mistakes
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => addTopicToLibrary(selectedMeta.id)}
                    className="tw-border tw-border-zinc-400 tw-bg-white tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.1em] hover:tw-border-black"
                  >
                    в библиотеку
                  </button>
                  <button
                    type="button"
                    onClick={() => clearTopicMistakes(selectedMeta.id)}
                    className="tw-border tw-border-zinc-400 tw-bg-white tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.1em] hover:tw-border-black"
                  >
                    очистить ошибки
                  </button>
                  <button
                    type="button"
                    onClick={() => resetTopicProgress(selectedMeta.id)}
                    className="tw-border tw-border-zinc-400 tw-bg-white tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.1em] hover:tw-border-black"
                  >
                    reset progress
                  </button>
                </div>
              </div>

              {!selectedDoc ? (
                <p className="tw-m-0 tw-text-sm tw-text-zinc-600">загрузка правила...</p>
              ) : (
                <div className="tw-space-y-3">
                  {shownRuleBlocks.map((block, idx) => renderRuleBlock(block, idx))}
                  {ruleBlocks.length > RULE_PREVIEW_LIMIT ? (
                    <button
                      type="button"
                      onClick={() => setExpandedRule((v) => !v)}
                      className="tw-border tw-border-zinc-400 tw-bg-white tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.1em] hover:tw-border-black"
                    >
                      {expandedRule ? "показать меньше" : `показать все (${ruleBlocks.length})`}
                    </button>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>
      ) : null}

      {view === "practice" ? (
        <div className="tw-mt-4 tw-space-y-3">
          {!selectedId ? (
            <p className="tw-m-0 tw-text-sm tw-text-zinc-600">выбери тему в topics</p>
          ) : !selectedDoc ? (
            <p className="tw-m-0 tw-text-sm tw-text-zinc-600">загрузка practice...</p>
          ) : !queue.length ? (
            <div className="tw-border tw-border-zinc-300 tw-bg-zinc-50 tw-p-3">
              <p className="tw-m-0 tw-text-sm tw-text-zinc-700">
                {practiceMistakesMode ? "Для этой темы сейчас нет сохраненных ошибок для повтора." : "Для этой темы пока нет упражнений в `practice.exercises`."}
              </p>
            </div>
          ) : (
            <>
              <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
                <p className="tw-m-0 tw-text-base tw-font-semibold tw-text-zinc-900">{practiceHeading || "practice"}</p>
                <span className="tw-border tw-border-zinc-400 tw-px-2 tw-py-0.5 tw-text-xs tw-text-zinc-700">
                  {cursor + 1} / {queue.length}
                </span>
                <span className="tw-border tw-border-zinc-400 tw-px-2 tw-py-0.5 tw-text-xs tw-text-zinc-700">
                  score: {score + (checked && resultState && resultState.ok ? 1 : 0)} / {attempted + (checked ? 1 : 0)}
                </span>
                <span className="tw-border tw-border-zinc-400 tw-px-2 tw-py-0.5 tw-text-xs tw-text-zinc-700">
                  mode: {practiceMistakesMode ? "mistakes" : "all"}
                </span>
                {selectedMeta && selectedMistakesCount ? (
                  <button
                    type="button"
                    onClick={() => startTopicMistakesPractice(selectedMeta.id)}
                    className="tw-border tw-border-zinc-400 tw-bg-white tw-px-2 tw-py-1 tw-text-[11px] tw-uppercase tw-tracking-[0.08em] hover:tw-border-black"
                  >
                    retry mistakes ({selectedMistakesCount})
                  </button>
                ) : null}
              </div>

              <div className="tw-border tw-border-zinc-300 tw-bg-white tw-p-3">
                <p className="tw-m-0 tw-text-xs tw-uppercase tw-tracking-[0.1em] tw-text-zinc-600">{asText(current.exerciseTitle) || asText(current.exerciseId) || current.kind}</p>
                {asText(current.item && current.item.instruction) ? (
                  <p className="tw-m-0 tw-mt-2 tw-text-sm tw-font-semibold tw-text-zinc-900">{asText(current.item.instruction)}</p>
                ) : null}
                {asText(current.item && current.item.prompt) ? (
                  <p className="tw-m-0 tw-mt-2 tw-whitespace-pre-wrap tw-text-sm tw-text-zinc-800">{asText(current.item.prompt)}</p>
                ) : null}

                <div className="tw-mt-3">{renderPracticeInput()}</div>

                {checked && resultState ? (
                  <div
                    className={[
                      "tw-mt-3 tw-border tw-p-3",
                      resultState.ok ? "tw-border-emerald-300 tw-bg-emerald-50" : "tw-border-amber-300 tw-bg-amber-50",
                    ].join(" ")}
                  >
                    <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-zinc-900">{resultState.ok ? "верно" : "нужно поправить"}</p>
                    {resultState.expectedText ? <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-zinc-800">ожидалось: {resultState.expectedText}</p> : null}
                    {resultState.explain ? <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-zinc-700">{resultState.explain}</p> : null}
                    {!resultState.ok && resultState.linkedTopicId ? (
                      <button
                        type="button"
                        onClick={() => openTopic(resultState.linkedTopicId)}
                        className="tw-mt-2 tw-border tw-border-zinc-400 tw-bg-white tw-px-2 tw-py-1 tw-text-[11px] tw-uppercase tw-tracking-[0.08em] hover:tw-border-black"
                      >
                        открыть связанное правило
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <div className="tw-mt-3 tw-flex tw-flex-wrap tw-gap-2">
                  {!checked ? (
                    <button
                      type="button"
                      onClick={checkCurrent}
                      className="tw-border tw-border-black tw-bg-black tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.1em] tw-text-white hover:tw-bg-zinc-800"
                    >
                      check
                    </button>
                  ) : !done ? (
                    <button
                      type="button"
                      onClick={nextCurrent}
                      className="tw-border tw-border-black tw-bg-black tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.1em] tw-text-white hover:tw-bg-zinc-800"
                    >
                      next
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={restartPractice}
                        className="tw-border tw-border-black tw-bg-black tw-px-3 tw-py-2 tw-text-xs tw-uppercase tw-tracking-[0.1em] tw-text-white hover:tw-bg-zinc-800"
                      >
                        restart
                      </button>
                      <p className="tw-m-0 tw-self-center tw-text-sm tw-text-zinc-700">итог: {score + (resultState && resultState.ok ? 1 : 0)} / {queue.length}</p>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>,
    hostEl,
  );
}
