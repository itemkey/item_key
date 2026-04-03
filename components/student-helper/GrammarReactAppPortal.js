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

function canCheckAnswer(node, answer) {
  const kind = asText(node && node.kind);
  const item = (node && node.item) || {};

  if (kind === "choice") return Number(answer && answer.selectedIndex) >= 0;

  if (kind === "multi") {
    const selected = (answer && answer.selected) || {};
    return Object.keys(selected).some((key) => !!selected[key]);
  }

  if (kind === "input" || kind === "correction") {
    return asText(answer && answer.text).length > 0;
  }

  if (kind === "multi_input") {
    const values = asList(answer && answer.values);
    if (!values.length) return false;
    return values.every((value) => asText(value).length > 0);
  }

  if (kind === "inline_select") {
    const blanks = asList(item && item.blanks);
    if (!blanks.length) return false;
    const values = asList(answer && answer.values);
    return blanks.every((_, idx) => Number(values[idx]) >= 0);
  }

  if (kind === "match") {
    const pairs = asList(item && item.pairs);
    if (!pairs.length) return false;
    const picks = (answer && answer.picks) || {};
    return pairs.every((pair) => {
      const left = asText(pair && pair.left);
      return left && asText(picks[left]).length > 0;
    });
  }

  if (kind === "drag_sort") {
    const words = asList(item && item.words);
    if (!words.length) return false;
    const picks = asList(answer && answer.picks);
    return words.every((_, idx) => asText(picks[idx]).length > 0);
  }

  return true;
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
        if (["constructor", "compare", "daily"].includes(lastView)) setView("home");
        else setView(lastView);
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
        setIndexError("Не удалось загрузить каталог тем.");
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
      setDocError("Не удалось открыть эту тему.");
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
        setDocError("Для выбранной пары пока нет заданий для сравнения.");
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
        setDocError("На сегодня нет доступных заданий.");
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
    const cardClass = "tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5";

    if (type === "heading") {
      return (
        <div key={`${idx}-heading`} className={cardClass}>
          <h3 className="tw-m-0 tw-text-base tw-font-semibold tw-text-slate-900">{asText(block.text)}</h3>
        </div>
      );
    }

    if (type === "text") {
      return (
        <div key={`${idx}-text`} className={cardClass}>
          <p className="tw-m-0 tw-text-sm tw-leading-relaxed tw-text-slate-700">{asText(block.text)}</p>
        </div>
      );
    }

    if (type === "highlight") {
      return (
        <div key={`${idx}-highlight`} className={`${cardClass} tw-bg-slate-50`}>
          {asText(block.title) ? <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">{asText(block.title)}</p> : null}
          <ul className="tw-m-0 tw-list-disc tw-space-y-1.5 tw-pl-5 tw-text-sm tw-text-slate-700">
            {asList(block.lines).map((line, lineIdx) => (
              <li key={`${idx}-line-${lineIdx}`}>{asText(line)}</li>
            ))}
          </ul>
        </div>
      );
    }

    if (type === "table") {
      return (
        <div key={`${idx}-table`} className={cardClass}>
          {asText(block.caption) ? <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">{asText(block.caption)}</p> : null}
          <RuleTable block={block} />
        </div>
      );
    }

    if (type === "examples") {
      return (
        <div key={`${idx}-examples`} className={cardClass}>
          <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">Примеры</p>
          <ul className="tw-m-0 tw-list-none tw-space-y-2 tw-p-0">
            {asList(block.items).map((item, itemIdx) => (
              <li key={`${idx}-example-${itemIdx}`} className="tw-rounded-xl tw-border tw-border-slate-200 tw-bg-slate-50 tw-p-3">
                <p className="tw-m-0 tw-text-sm tw-font-medium tw-text-slate-900">{asText(item && item.en)}</p>
                <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-600">{asText(item && item.ru)}</p>
              </li>
            ))}
          </ul>
        </div>
      );
    }

    if (type === "topicLinks") {
      return (
        <div key={`${idx}-links`} className={`${cardClass} tw-bg-slate-50`}>
          {asText(block.title) ? <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">{asText(block.title)}</p> : null}
          {asText(block.note) ? <p className="tw-m-0 tw-text-sm tw-text-slate-600">{asText(block.note)}</p> : null}
          <div className="tw-space-y-2">
            {asList(block.items).map((item, itemIdx) => {
              const linkedId = asText(item && item.id);
              return (
                <div key={`${idx}-topic-link-${itemIdx}`} className="tw-rounded-xl tw-border tw-border-slate-200 tw-bg-white tw-p-3">
                  <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">{asText(item && item.label) || linkedId || "Тема"}</p>
                  {asText(item && item.note) ? <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-600">{asText(item.note)}</p> : null}
                  {linkedId ? (
                    <button
                      type="button"
                      className="tw-mt-3 tw-inline-flex tw-items-center tw-rounded-lg tw-border tw-border-slate-300 tw-bg-white tw-px-3 tw-py-1.5 tw-text-xs tw-font-medium tw-text-slate-700 hover:tw-border-slate-500"
                      onClick={() => openTopic(linkedId)}
                    >
                      Открыть тему
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
      <div key={`${idx}-unknown`} className={`${cardClass} tw-bg-slate-50`}>
        <p className="tw-m-0 tw-text-sm tw-text-slate-600">Дополнительный материал недоступен в упрощенном режиме.</p>
      </div>
    );
  };

  const renderPracticeInput = () => {
    if (!current) return null;
    const item = current.item || {};
    const kind = asText(current.kind);

    if (kind === "choice") {
      const selectedIndex = Number(answerState && answerState.selectedIndex);
      const correctIndex = Number(item && item.correctIndex);
      return (
        <ul className="tw-m-0 tw-list-none tw-space-y-3 tw-p-0">
          {asList(item.options).map((opt, idx) => {
            const active = selectedIndex === idx;
            const isCorrect = checked && idx === correctIndex;
            const isWrong = checked && active && idx !== correctIndex;
            const baseClass = "tw-w-full tw-rounded-xl tw-border tw-px-4 tw-py-3 tw-text-left tw-text-sm tw-font-medium tw-transition";
            let stateClass = "tw-border-slate-200 tw-bg-white tw-text-slate-800 hover:tw-border-slate-400";

            if (active && !checked) stateClass = "tw-border-sky-500 tw-bg-sky-50 tw-text-slate-900";
            if (isCorrect) stateClass = "tw-border-emerald-400 tw-bg-emerald-50 tw-text-emerald-900";
            if (isWrong) stateClass = "tw-border-rose-400 tw-bg-rose-50 tw-text-rose-900";

            return (
              <li key={`${current.key}-choice-${idx}`}>
                <button
                  type="button"
                  disabled={checked}
                  onClick={() => setAnswerState({ selectedIndex: idx })}
                  className={`${baseClass} ${stateClass}`}
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
      const expectedSet = new Set(asList(item.correctIndices).map((x) => Number(x)));
      return (
        <ul className="tw-m-0 tw-list-none tw-space-y-3 tw-p-0">
          {asList(item.options).map((opt, idx) => {
            const selected = !!(answerState.selected && answerState.selected[idx]);
            const expected = expectedSet.has(idx);
            const isCorrect = checked && selected && expected;
            const isWrong = checked && selected && !expected;
            const isMissed = checked && !selected && expected;
            let stateClass = "tw-border-slate-200 tw-bg-white";
            if (selected && !checked) stateClass = "tw-border-sky-500 tw-bg-sky-50";
            if (isCorrect) stateClass = "tw-border-emerald-400 tw-bg-emerald-50";
            if (isWrong) stateClass = "tw-border-rose-400 tw-bg-rose-50";
            if (isMissed) stateClass = "tw-border-amber-400 tw-bg-amber-50";
            return (
              <li key={`${current.key}-multi-${idx}`}>
                <label className={`tw-flex tw-items-start tw-gap-3 tw-rounded-xl tw-border tw-px-4 tw-py-3 tw-text-sm tw-text-slate-800 ${stateClass}`}>
                  <input
                    type="checkbox"
                    disabled={checked}
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
      let fieldClass = "tw-border-slate-300 focus:tw-border-sky-500";
      if (checked && resultState && resultState.ok) fieldClass = "tw-border-emerald-500 tw-bg-emerald-50";
      if (checked && resultState && !resultState.ok) fieldClass = "tw-border-rose-500 tw-bg-rose-50";
      return (
        <textarea
          className={`tw-min-h-[120px] tw-w-full tw-rounded-xl tw-border tw-bg-white tw-px-4 tw-py-3 tw-text-sm tw-text-slate-900 tw-outline-none ${fieldClass}`}
          disabled={checked}
          value={asText(answerState.text)}
          onChange={(e) => setAnswerState({ text: e.target.value })}
          placeholder="Введите ответ"
        />
      );
    }

    if (kind === "multi_input") {
      const inputs = asList(item.inputs);
      const values = asList(answerState.values);
      return (
        <div className="tw-space-y-3">
          {inputs.map((_, idx) => (
            <div key={`${current.key}-multi-input-wrap-${idx}`} className="tw-space-y-1">
              <p className="tw-m-0 tw-text-xs tw-font-medium tw-uppercase tw-tracking-[0.08em] tw-text-slate-500">Ответ {idx + 1}</p>
              <input
                key={`${current.key}-multi-input-${idx}`}
                className={[
                  "tw-w-full tw-rounded-xl tw-border tw-bg-white tw-px-4 tw-py-3 tw-text-sm tw-text-slate-900 tw-outline-none",
                  checked
                    ? (inputAccepted(values[idx], inputs[idx] && inputs[idx].accepted, inputs[idx] && inputs[idx].acceptedShort)
                      ? "tw-border-emerald-500 tw-bg-emerald-50"
                      : "tw-border-rose-500 tw-bg-rose-50")
                    : "tw-border-slate-300 focus:tw-border-sky-500",
                ].join(" ")}
                disabled={checked}
                value={asText(values[idx])}
                onChange={(e) => {
                  const next = values.slice();
                  next[idx] = e.target.value;
                  setAnswerState({ values: next });
                }}
                placeholder={`Ответ ${idx + 1}`}
              />
            </div>
          ))}
        </div>
      );
    }

    if (kind === "inline_select") {
      const segments = asList(item.segments);
      const blanks = asList(item.blanks);
      const values = asList(answerState.values);
      return (
        <div className="tw-space-y-4">
          {asText(item.storyTitle) ? <p className="tw-m-0 tw-text-base tw-font-semibold tw-text-slate-900">{asText(item.storyTitle)}</p> : null}
          <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-text-sm tw-leading-relaxed tw-text-slate-800">
            {blanks.map((blank, idx) => (
              <span key={`${current.key}-inline-${idx}`} className="tw-flex tw-items-center tw-gap-2">
                <span>{asText(segments[idx])}</span>
                <select
                  className={[
                    "tw-rounded-lg tw-border tw-bg-white tw-px-2.5 tw-py-1.5 tw-text-sm tw-outline-none",
                    checked
                      ? (Number(values[idx]) === Number(blank && blank.correctIndex)
                        ? "tw-border-emerald-500 tw-bg-emerald-50"
                        : "tw-border-rose-500 tw-bg-rose-50")
                      : "tw-border-slate-300 focus:tw-border-sky-500",
                  ].join(" ")}
                  disabled={checked}
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
        <div className="tw-space-y-3">
          {pairs.map((pair, idx) => {
            const left = asText(pair && pair.left);
            const expected = asText(pair && pair.right);
            const actual = asText(picks[left]);
            const rowState = !checked
              ? "tw-border-slate-200"
              : (actual && actual === expected ? "tw-border-emerald-400 tw-bg-emerald-50" : "tw-border-rose-400 tw-bg-rose-50");
            return (
              <div key={`${current.key}-match-${idx}`} className={`tw-grid tw-gap-2 tw-rounded-xl tw-border tw-p-3 sm:tw-grid-cols-[minmax(180px,1fr)_minmax(220px,1fr)] ${rowState}`}>
                <div className="tw-text-sm tw-font-medium tw-text-slate-900">{left}</div>
                <select
                  className="tw-rounded-lg tw-border tw-border-slate-300 tw-bg-white tw-px-3 tw-py-2 tw-text-sm tw-outline-none focus:tw-border-sky-500"
                  disabled={checked}
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
        <div className="tw-space-y-3">
          {words.map((word, idx) => (
            <div
              key={`${current.key}-drag-${idx}`}
              className={[
                "tw-grid tw-gap-2 tw-rounded-xl tw-border tw-p-3 sm:tw-grid-cols-[minmax(180px,1fr)_minmax(220px,1fr)]",
                !checked
                  ? "tw-border-slate-200"
                  : (asText(picks[idx]) === asText(word && word.bin) ? "tw-border-emerald-400 tw-bg-emerald-50" : "tw-border-rose-400 tw-bg-rose-50"),
              ].join(" ")}
            >
              <div className="tw-text-sm tw-font-medium tw-text-slate-900">{asText(word && word.text)}</div>
              <select
                className="tw-rounded-lg tw-border tw-border-slate-300 tw-bg-white tw-px-3 tw-py-2 tw-text-sm tw-outline-none focus:tw-border-sky-500"
                disabled={checked}
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
      <div className="tw-rounded-xl tw-border tw-border-slate-200 tw-bg-slate-50 tw-p-4 tw-text-sm tw-text-slate-600">
        Этот тип задания скоро появится в обновленном режиме практики.
      </div>
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

  const isHomeTab = view === "home" || view === "constructor" || view === "compare" || view === "daily";
  const isTopicsTab = view === "list" || view === "detail";
  const isPracticeTab = view === "practice";
  const canCheckCurrent = canCheckAnswer(current, answerState);
  const answeredCount = attempted + (checked ? 1 : 0);
  const liveScore = score + (checked && resultState && resultState.ok ? 1 : 0);
  const practiceProgressPercent = queue.length ? Math.round(((cursor + 1) / queue.length) * 100) : 0;

  const groupedTopicsMap = {};
  for (const topic of filteredTopics) {
    const group = asText(topic && topic.group) || "other";
    if (!groupedTopicsMap[group]) groupedTopicsMap[group] = [];
    groupedTopicsMap[group].push(topic);
  }
  const groupedTopics = Object.keys(groupedTopicsMap)
    .sort((a, b) => groupTitle(a).localeCompare(groupTitle(b)))
    .map((group) => ({ group, items: groupedTopicsMap[group] }));

  const explanationLines = [];
  const markerLinesRaw = [];
  const formulaLinesRaw = [];
  const exampleItemsRaw = [];
  const compareItemsRaw = [];
  let compareNote = "";

  for (const block of ruleBlocks) {
    const type = asText(block && block.type);

    if (type === "heading" || type === "text") {
      const text = asText(block && block.text);
      if (text) explanationLines.push(text);
    }

    if (type === "highlight") {
      const title = normalize(block && block.title);
      const lines = asList(block && block.lines).map(asText).filter(Boolean);
      if (title.includes("маркер") || title.includes("marker")) markerLinesRaw.push(...lines);
      else if (lines.length && explanationLines.length < 4) explanationLines.push(...lines.slice(0, 2));
    }

    if (type === "table") {
      const caption = normalize(block && block.caption);
      if (caption.includes("формул") || caption.includes("formula")) {
        const rows = asList(block && block.rows);
        for (const row of rows.slice(0, 4)) {
          const cells = asList(row).map(asText).filter(Boolean);
          if (cells.length >= 2) formulaLinesRaw.push(`${cells[0]}: ${cells[1]}`);
          else if (cells.length) formulaLinesRaw.push(cells[0]);
        }
      }
    }

    if (type === "examples") {
      for (const item of asList(block && block.items)) {
        const en = asText(item && item.en);
        const ru = asText(item && item.ru);
        if (en || ru) exampleItemsRaw.push({ en, ru });
      }
    }

    if (type === "topicLinks") {
      compareNote = asText(block && block.note) || compareNote;
      for (const item of asList(block && block.items)) {
        const label = asText(item && item.label);
        const note = asText(item && item.note);
        if (label || note) compareItemsRaw.push({ label, note, id: asText(item && item.id) });
      }
    }
  }

  if (!explanationLines.length) {
    const fallback = asText(selectedMeta && (selectedMeta.subtitle || selectedMeta.hint)) || asText(selectedDoc && selectedDoc.subtitle);
    if (fallback) explanationLines.push(fallback);
  }

  if (!markerLinesRaw.length) {
    const markerText = extractQuickField(ruleBlocks, "маркеры") || extractQuickField(ruleBlocks, "markers");
    if (markerText) markerLinesRaw.push(...markerText.split("•").map(asText).filter(Boolean));
  }

  if (!formulaLinesRaw.length) {
    const formulaText = extractFormula(ruleBlocks);
    if (formulaText) formulaLinesRaw.push(formulaText);
  }

  const markerLines = [...new Set(markerLinesRaw)].slice(0, 6);
  const formulaLines = [...new Set(formulaLinesRaw)].slice(0, 4);
  const exampleItems = exampleItemsRaw.slice(0, 6);
  const compareItems = compareItemsRaw.slice(0, 4);

  const topTabClass = (active) => [
    "tw-rounded-lg tw-border tw-px-3 tw-py-2 tw-text-xs tw-font-medium tw-uppercase tw-tracking-[0.08em] tw-transition",
    active ? "tw-border-slate-900 tw-bg-slate-900 tw-text-white" : "tw-border-slate-300 tw-bg-white tw-text-slate-700 hover:tw-border-slate-500",
  ].join(" ");

  const levelClass = (active) => [
    "tw-rounded-lg tw-border tw-px-3 tw-py-1.5 tw-text-xs tw-font-medium tw-uppercase tw-tracking-[0.06em] tw-transition",
    active ? "tw-border-slate-900 tw-bg-slate-900 tw-text-white" : "tw-border-slate-300 tw-bg-white tw-text-slate-700 hover:tw-border-slate-500",
  ].join(" ");

  const primaryBtnClass = "tw-inline-flex tw-items-center tw-justify-center tw-rounded-xl tw-border tw-border-slate-900 tw-bg-slate-900 tw-px-4 tw-py-2.5 tw-text-sm tw-font-semibold tw-text-white tw-transition hover:tw-bg-slate-700 disabled:tw-cursor-not-allowed disabled:tw-opacity-50";
  const secondaryBtnClass = "tw-inline-flex tw-items-center tw-justify-center tw-rounded-xl tw-border tw-border-slate-300 tw-bg-white tw-px-4 tw-py-2.5 tw-text-sm tw-font-semibold tw-text-slate-700 tw-transition hover:tw-border-slate-500 disabled:tw-cursor-not-allowed disabled:tw-opacity-50";

  return createPortal(
    <section className="sh-react-grammar tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-slate-50 tw-p-4 sm:tw-p-6" aria-label="Grammar section">
      <div className="tw-space-y-4">
        <header className="tw-flex tw-flex-wrap tw-items-start tw-justify-between tw-gap-3">
          <div>
            <p className="tw-m-0 tw-text-lg tw-font-semibold tw-text-slate-900">Grammar</p>
            <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-600">Четкие блоки, короткие шаги и фокус на действии.</p>
          </div>
          <nav className="tw-flex tw-flex-wrap tw-gap-2" aria-label="Grammar views">
            <button type="button" onClick={() => setView("home")} className={topTabClass(isHomeTab)}>Home</button>
            <button
              type="button"
              onClick={() => {
                setGroupFilter("all");
                setView("list");
              }}
              className={topTabClass(isTopicsTab)}
            >
              Topics
            </button>
            <button
              type="button"
              onClick={() => {
                const id = selectedId || asText(topicsByLevel[0] && topicsByLevel[0].id);
                if (!id) {
                  setView("list");
                  return;
                }
                startTopicPractice(id);
              }}
              className={topTabClass(isPracticeTab)}
              disabled={!topicsByLevel.length}
            >
              Practice
            </button>
          </nav>
        </header>

        {loadingIndex ? <p className="tw-m-0 tw-text-sm tw-text-slate-500">Загрузка грамматических тем...</p> : null}
        {indexError ? <p className="tw-m-0 tw-rounded-xl tw-border tw-border-rose-200 tw-bg-rose-50 tw-p-3 tw-text-sm tw-text-rose-700">Не удалось загрузить темы. Попробуйте обновить страницу.</p> : null}
        {docError ? <p className="tw-m-0 tw-rounded-xl tw-border tw-border-rose-200 tw-bg-rose-50 tw-p-3 tw-text-sm tw-text-rose-700">{docError}</p> : null}

        {view === "home" ? (
          <div className="tw-space-y-4">
            <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5">
              <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">Выберите уровень</p>
              <div className="tw-mt-3 tw-flex tw-flex-wrap tw-gap-2">
                <button type="button" onClick={() => persistGrammarLevel("")} className={levelClass(!grammarLevel)}>Все</button>
                {LEVELS.map((level) => (
                  <button key={`level-home-${level}`} type="button" onClick={() => persistGrammarLevel(level)} className={levelClass(grammarLevel === level)}>
                    {level}
                  </button>
                ))}
              </div>
            </section>

            <section className="tw-grid tw-gap-3 md:tw-grid-cols-3">
              <button
                type="button"
                onClick={() => {
                  resetConstructor();
                  setView("constructor");
                }}
                className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-text-left tw-transition hover:tw-border-slate-400"
              >
                <p className="tw-m-0 tw-text-base tw-font-semibold tw-text-slate-900">Конструктор</p>
                <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-600">Пошагово подобрать нужное правило.</p>
              </button>
              <button
                type="button"
                onClick={() => setView("compare")}
                className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-text-left tw-transition hover:tw-border-slate-400"
              >
                <p className="tw-m-0 tw-text-base tw-font-semibold tw-text-slate-900">Сравнить</p>
                <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-600">Аккуратно увидеть разницу между темами.</p>
              </button>
              <button
                type="button"
                onClick={() => setView("daily")}
                className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-text-left tw-transition hover:tw-border-slate-400"
              >
                <p className="tw-m-0 tw-text-base tw-font-semibold tw-text-slate-900">На сегодня</p>
                <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-600">Короткая ежедневная мини-сессия.</p>
              </button>
            </section>
          </div>
        ) : null}

        {view === "list" ? (
          <div className="tw-space-y-4">
            <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5">
              <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
                <p className="tw-m-0 tw-text-base tw-font-semibold tw-text-slate-900">Topics</p>
                {grammarLevel ? <span className="tw-rounded-full tw-bg-slate-100 tw-px-2.5 tw-py-1 tw-text-xs tw-font-medium tw-text-slate-700">{grammarLevel}</span> : null}
              </div>
              <div className="tw-mt-3 tw-grid tw-gap-2 sm:tw-grid-cols-[220px_1fr_auto]">
                <select
                  className="tw-rounded-xl tw-border tw-border-slate-300 tw-bg-white tw-px-3 tw-py-2 tw-text-sm tw-outline-none focus:tw-border-sky-500"
                  value={grammarLevel}
                  onChange={(e) => persistGrammarLevel(e.target.value)}
                >
                  <option value="">Все уровни</option>
                  {LEVELS.map((level) => (
                    <option key={`level-list-${level}`} value={level}>{level}</option>
                  ))}
                </select>
                <input
                  className="tw-rounded-xl tw-border tw-border-slate-300 tw-bg-white tw-px-3 tw-py-2 tw-text-sm tw-outline-none focus:tw-border-sky-500"
                  type="search"
                  placeholder="Поиск темы..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button type="button" onClick={() => setSearch("")} className={secondaryBtnClass}>Очистить</button>
              </div>
            </section>

            {!groupedTopics.length ? (
              <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-text-sm tw-text-slate-600">Темы не найдены для выбранного фильтра.</div>
            ) : (
              groupedTopics.map((groupRow) => (
                <section key={`topic-group-${groupRow.group}`} className="tw-space-y-3">
                  <p className="tw-m-0 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.08em] tw-text-slate-500">{groupTitle(groupRow.group)}</p>
                  <div className="tw-grid tw-gap-3 lg:tw-grid-cols-2">
                    {groupRow.items.map((topic) => {
                      const mastery = Number(progressById[topic.id] && progressById[topic.id].mastery) || 0;
                      return (
                        <article key={`topic-row-${topic.id}`} className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5">
                          <div className="tw-flex tw-items-start tw-justify-between tw-gap-2">
                            <div>
                              <p className="tw-m-0 tw-text-base tw-font-semibold tw-text-slate-900">{topic.title || topic.id}</p>
                              <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-600">{topic.subtitle || topic.hint || "Краткое описание темы"}</p>
                            </div>
                            <span className="tw-rounded-full tw-bg-slate-100 tw-px-2.5 tw-py-1 tw-text-xs tw-font-medium tw-text-slate-700">{masteryLabel(mastery)}</span>
                          </div>
                          <div className="tw-mt-4 tw-flex tw-flex-wrap tw-gap-2">
                            <button type="button" onClick={() => openTopic(topic.id)} className={primaryBtnClass}>Открыть правило</button>
                            <button type="button" onClick={() => startTopicPractice(topic.id)} className={secondaryBtnClass}>Practice</button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>
        ) : null}

        {view === "detail" ? (
          <div className="tw-space-y-4">
            {!selectedMeta ? (
              <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-text-sm tw-text-slate-600">Выберите тему на вкладке Topics.</div>
            ) : (
              <>
                <button type="button" onClick={() => setView("list")} className={secondaryBtnClass}>Назад к темам</button>

                <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5">
                  <div className="tw-flex tw-flex-wrap tw-items-start tw-justify-between tw-gap-2">
                    <div>
                      <p className="tw-m-0 tw-text-xl tw-font-semibold tw-text-slate-900">{selectedMeta.title || selectedMeta.id}</p>
                      <p className="tw-m-0 tw-mt-2 tw-text-sm tw-text-slate-600">{asText(selectedMeta.subtitle || selectedMeta.hint) || "Короткое объяснение темы."}</p>
                    </div>
                    {selectedProgress ? (
                      <span className="tw-rounded-full tw-bg-slate-100 tw-px-2.5 tw-py-1 tw-text-xs tw-font-medium tw-text-slate-700">{masteryLabel(selectedProgress.mastery)}</span>
                    ) : null}
                  </div>
                </section>

                <div className="tw-grid tw-gap-3 md:tw-grid-cols-2">
                  <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5">
                    <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">Формула</p>
                    {formulaLines.length ? (
                      <ul className="tw-m-0 tw-mt-2 tw-list-disc tw-space-y-1.5 tw-pl-5 tw-text-sm tw-text-slate-700">
                        {formulaLines.map((line, idx) => <li key={`formula-${idx}`}>{line}</li>)}
                      </ul>
                    ) : (
                      <p className="tw-m-0 tw-mt-2 tw-text-sm tw-text-slate-500">Формула не указана.</p>
                    )}
                  </section>

                  <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5">
                    <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">Ключевые маркеры</p>
                    {markerLines.length ? (
                      <div className="tw-mt-2 tw-flex tw-flex-wrap tw-gap-2">
                        {markerLines.map((line, idx) => (
                          <span key={`marker-${idx}`} className="tw-rounded-full tw-bg-slate-100 tw-px-2.5 tw-py-1 tw-text-xs tw-font-medium tw-text-slate-700">{line}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="tw-m-0 tw-mt-2 tw-text-sm tw-text-slate-500">Маркеров для этой темы пока нет.</p>
                    )}
                  </section>
                </div>

                <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5">
                  <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">Кратко о правиле</p>
                  <div className="tw-mt-2 tw-space-y-2">
                    {explanationLines.map((line, idx) => (
                      <p key={`explain-${idx}`} className="tw-m-0 tw-text-sm tw-leading-relaxed tw-text-slate-700">{line}</p>
                    ))}
                  </div>
                </section>

                {exampleItems.length ? (
                  <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5">
                    <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">Примеры</p>
                    <ul className="tw-m-0 tw-mt-3 tw-list-none tw-space-y-2 tw-p-0">
                      {exampleItems.map((item, idx) => (
                        <li key={`example-${idx}`} className="tw-rounded-xl tw-border tw-border-slate-200 tw-bg-slate-50 tw-p-3">
                          <p className="tw-m-0 tw-text-sm tw-font-medium tw-text-slate-900">{item.en}</p>
                          <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-600">{item.ru}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {compareItems.length || compareNote ? (
                  <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5">
                    <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">Сравнение и близкие темы</p>
                    {compareNote ? <p className="tw-m-0 tw-mt-2 tw-text-sm tw-text-slate-700">{compareNote}</p> : null}
                    {compareItems.length ? (
                      <div className="tw-mt-3 tw-grid tw-gap-2 sm:tw-grid-cols-2">
                        {compareItems.map((item, idx) => (
                          <button
                            key={`compare-item-${idx}`}
                            type="button"
                            onClick={() => {
                              if (!item.id) return;
                              openTopic(item.id);
                            }}
                            disabled={!item.id}
                            className="tw-rounded-xl tw-border tw-border-slate-200 tw-bg-slate-50 tw-p-3 tw-text-left tw-transition enabled:hover:tw-border-slate-400 disabled:tw-opacity-60"
                          >
                            <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">{item.label || "Тема"}</p>
                            {item.note ? <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-600">{item.note}</p> : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </section>
                ) : null}

                <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5">
                  <div className="tw-flex tw-flex-wrap tw-gap-2">
                    <button type="button" onClick={() => startTopicPractice(selectedMeta.id)} className={primaryBtnClass}>Practice this rule</button>
                    <button type="button" onClick={() => setView("list")} className={secondaryBtnClass}>Back to Topics</button>
                  </div>
                </section>

                {!selectedDoc ? (
                  <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-text-sm tw-text-slate-600">Загрузка полного материала...</div>
                ) : (
                  <section className="tw-space-y-3">
                    {shownRuleBlocks.map((block, idx) => renderRuleBlock(block, idx))}
                    {ruleBlocks.length > RULE_PREVIEW_LIMIT ? (
                      <button type="button" onClick={() => setExpandedRule((v) => !v)} className={secondaryBtnClass}>
                        {expandedRule ? "Свернуть материал" : `Показать все блоки (${ruleBlocks.length})`}
                      </button>
                    ) : null}
                  </section>
                )}
              </>
            )}
          </div>
        ) : null}

        {view === "constructor" ? (
          <div className="tw-space-y-4">
            <button type="button" onClick={() => setView("home")} className={secondaryBtnClass}>Назад на Home</button>

            <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5">
              <p className="tw-m-0 tw-text-base tw-font-semibold tw-text-slate-900">Конструктор</p>
              <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-600">Пройдите шаги и получите точное правило.</p>
              <textarea
                className="tw-mt-3 tw-min-h-[92px] tw-w-full tw-rounded-xl tw-border tw-border-slate-300 tw-bg-white tw-px-4 tw-py-3 tw-text-sm tw-text-slate-900 tw-outline-none focus:tw-border-sky-500"
                value={constructorPhrase}
                onChange={(e) => updateConstructorPhrase(e.target.value)}
                placeholder="Пример: Я планирую начать курс в следующем месяце"
              />
            </section>

            {!constructorRec ? (
              <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5">
                <p className="tw-m-0 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.08em] tw-text-slate-500">Шаг {constructorPath.length + 1}</p>
                <p className="tw-m-0 tw-mt-2 tw-text-lg tw-font-semibold tw-text-slate-900">{asText(constructorNode && constructorNode.q) || "Выберите вариант"}</p>
                {asText(constructorNode && constructorNode.hint) ? <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-600">{asText(constructorNode.hint)}</p> : null}
                {constructorPathLabels.length ? <p className="tw-m-0 tw-mt-2 tw-text-xs tw-text-slate-500">Путь: {constructorPathLabels.join(" -> ")}</p> : null}

                <div className="tw-mt-4 tw-grid tw-gap-2 sm:tw-grid-cols-2">
                  {asList(constructorNode && constructorNode.options).map((opt, idx) => (
                    <button
                      key={`constructor-opt-${constructorNodeId}-${idx}`}
                      type="button"
                      onClick={() => chooseConstructorOption(opt)}
                      className="tw-rounded-xl tw-border tw-border-slate-300 tw-bg-white tw-px-4 tw-py-3 tw-text-left tw-text-sm tw-font-medium tw-text-slate-700 tw-transition hover:tw-border-slate-500"
                    >
                      {asText(opt && opt.label) || asText(opt && opt.id) || "Вариант"}
                    </button>
                  ))}
                </div>

                <div className="tw-mt-3 tw-flex tw-flex-wrap tw-gap-2">
                  {constructorPath.length ? <button type="button" onClick={backConstructorStep} className={secondaryBtnClass}>Назад</button> : null}
                  <button type="button" onClick={resetConstructor} className={secondaryBtnClass}>Сброс</button>
                </div>
              </section>
            ) : (
              <>
                <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5">
                  <p className="tw-m-0 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.08em] tw-text-slate-500">Главный вариант</p>
                  <p className="tw-m-0 tw-mt-2 tw-text-xl tw-font-semibold tw-text-slate-900">{asText(constructorMainMeta && constructorMainMeta.title) || asText(constructorRec.mainId)}</p>
                  <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-600">{asText(constructorMainMeta && (constructorMainMeta.subtitle || constructorMainMeta.hint)) || "Короткое описание темы"}</p>
                  {asText(constructorRec.reason) ? <p className="tw-m-0 tw-mt-2 tw-text-sm tw-text-slate-700">{asText(constructorRec.reason)}</p> : null}
                  {asText(constructorRec.smartNote) ? <p className="tw-m-0 tw-mt-2 tw-rounded-xl tw-border tw-border-slate-200 tw-bg-slate-50 tw-p-3 tw-text-sm tw-text-slate-700">{asText(constructorRec.smartNote)}</p> : null}

                  <div className="tw-mt-4 tw-flex tw-flex-wrap tw-gap-2">
                    <button type="button" onClick={() => openConstructorRule(constructorRec.mainId)} className={primaryBtnClass}>Открыть правило</button>
                    <button type="button" onClick={() => startTopicPractice(constructorRec.mainId)} className={secondaryBtnClass}>Practice</button>
                    <button type="button" onClick={resetConstructor} className={secondaryBtnClass}>Новый выбор</button>
                  </div>
                </section>

                {constructorAltMetas.length ? (
                  <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5">
                    <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">Альтернативы</p>
                    <div className="tw-mt-3 tw-grid tw-gap-2 sm:tw-grid-cols-2">
                      {constructorAltMetas.map((meta) => (
                        <article key={`constructor-alt-${meta.id}`} className="tw-rounded-xl tw-border tw-border-slate-200 tw-bg-slate-50 tw-p-3">
                          <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">{meta.title || meta.id}</p>
                          <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-600">{meta.subtitle || meta.hint || "Описание темы"}</p>
                          <div className="tw-mt-2 tw-flex tw-gap-2">
                            <button type="button" onClick={() => openConstructorRule(meta.id)} className={secondaryBtnClass}>Открыть</button>
                            <button type="button" onClick={() => startTopicPractice(meta.id)} className={secondaryBtnClass}>Practice</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {view === "compare" ? (
          <div className="tw-space-y-4">
            <button type="button" onClick={() => setView("home")} className={secondaryBtnClass}>Назад на Home</button>

            {!comparableTopics.length ? (
              <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-text-sm tw-text-slate-600">Недостаточно тем для сравнения.</div>
            ) : (
              <>
                <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5">
                  <p className="tw-m-0 tw-text-base tw-font-semibold tw-text-slate-900">Сравнение правил</p>
                  <div className="tw-mt-3 tw-grid tw-gap-2 sm:tw-grid-cols-2">
                    <label className="tw-space-y-1 tw-text-sm tw-text-slate-700">
                      <span className="tw-block tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.08em] tw-text-slate-500">Правило A</span>
                      <select
                        className="tw-w-full tw-rounded-xl tw-border tw-border-slate-300 tw-bg-white tw-px-3 tw-py-2 tw-text-sm tw-outline-none focus:tw-border-sky-500"
                        value={compareA}
                        onChange={(e) => setCompareA(e.target.value)}
                      >
                        {comparableTopics.map((topic) => (
                          <option key={`cmp-a-${topic.id}`} value={topic.id}>{topic.title || topic.id}</option>
                        ))}
                      </select>
                    </label>
                    <label className="tw-space-y-1 tw-text-sm tw-text-slate-700">
                      <span className="tw-block tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.08em] tw-text-slate-500">Правило B</span>
                      <select
                        className="tw-w-full tw-rounded-xl tw-border tw-border-slate-300 tw-bg-white tw-px-3 tw-py-2 tw-text-sm tw-outline-none focus:tw-border-sky-500"
                        value={compareB}
                        onChange={(e) => setCompareB(e.target.value)}
                      >
                        {comparableTopics.map((topic) => (
                          <option key={`cmp-b-${topic.id}`} value={topic.id}>{topic.title || topic.id}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </section>

                {compareA && compareB && compareA !== compareB ? (
                  <>
                    <div className="tw-grid tw-gap-3 lg:tw-grid-cols-2">
                      <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5">
                        <p className="tw-m-0 tw-text-base tw-font-semibold tw-text-slate-900">{asText(compareMetaA && compareMetaA.title) || compareA}</p>
                        <div className="tw-mt-3 tw-space-y-3">
                          <div>
                            <p className="tw-m-0 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.08em] tw-text-slate-500">Когда использовать</p>
                            <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-700">{asText(compareQuickA && compareQuickA.when) || "—"}</p>
                          </div>
                          <div>
                            <p className="tw-m-0 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.08em] tw-text-slate-500">Маркеры</p>
                            <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-700">{asText(compareQuickA && compareQuickA.markers) || "—"}</p>
                          </div>
                          <div>
                            <p className="tw-m-0 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.08em] tw-text-slate-500">Формула</p>
                            <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-700">{asText(compareQuickA && compareQuickA.formula) || "—"}</p>
                          </div>
                        </div>
                      </section>

                      <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5">
                        <p className="tw-m-0 tw-text-base tw-font-semibold tw-text-slate-900">{asText(compareMetaB && compareMetaB.title) || compareB}</p>
                        <div className="tw-mt-3 tw-space-y-3">
                          <div>
                            <p className="tw-m-0 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.08em] tw-text-slate-500">Когда использовать</p>
                            <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-700">{asText(compareQuickB && compareQuickB.when) || "—"}</p>
                          </div>
                          <div>
                            <p className="tw-m-0 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.08em] tw-text-slate-500">Маркеры</p>
                            <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-700">{asText(compareQuickB && compareQuickB.markers) || "—"}</p>
                          </div>
                          <div>
                            <p className="tw-m-0 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.08em] tw-text-slate-500">Формула</p>
                            <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-700">{asText(compareQuickB && compareQuickB.formula) || "—"}</p>
                          </div>
                        </div>
                      </section>
                    </div>

                    <section className="tw-rounded-2xl tw-border tw-border-amber-200 tw-bg-amber-50 tw-p-4 tw-text-sm tw-text-amber-900">
                      {compareRuleHint(compareA, compareB)}
                    </section>

                    <div className="tw-flex tw-flex-wrap tw-gap-2">
                      <button type="button" onClick={() => startComparePractice(10)} className={primaryBtnClass} disabled={compareBusy}>
                        {compareBusy ? "Подготовка..." : "Тренировка (10)"}
                      </button>
                      <button type="button" onClick={() => startComparePractice(5)} className={secondaryBtnClass} disabled={compareBusy}>Короткая (5)</button>
                    </div>
                  </>
                ) : (
                  <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-text-sm tw-text-slate-600">Выберите две разные темы для сравнения.</div>
                )}
              </>
            )}
          </div>
        ) : null}

        {view === "daily" ? (
          <div className="tw-space-y-4">
            <button type="button" onClick={() => setView("home")} className={secondaryBtnClass}>Назад на Home</button>

            <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5">
              <p className="tw-m-0 tw-text-base tw-font-semibold tw-text-slate-900">На сегодня</p>
              <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-600">Короткая мини-сессия из 10 случайных заданий.</p>
              {dailyDate ? <p className="tw-m-0 tw-mt-2 tw-text-xs tw-text-slate-500">Последний набор: {dailyDate} ({dailyCount} заданий)</p> : null}
              <div className="tw-mt-4 tw-flex tw-flex-wrap tw-gap-2">
                <button type="button" onClick={() => startDailyPractice(false)} className={primaryBtnClass} disabled={dailyBusy}>
                  {dailyBusy ? "Подготовка..." : "Начать сессию"}
                </button>
                <button type="button" onClick={() => setView("list")} className={secondaryBtnClass}>К темам</button>
              </div>
            </section>
          </div>
        ) : null}

        {view === "practice" ? (
          <div className="tw-space-y-4">
            {!selectedId ? (
              <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-text-sm tw-text-slate-600">Сначала выберите тему в Topics.</div>
            ) : !selectedDoc ? (
              <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-text-sm tw-text-slate-600">Подготовка практики...</div>
            ) : !queue.length ? (
              <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-text-sm tw-text-slate-600">
                {practiceMistakesMode ? "Для режима ошибок пока нет заданий." : "Для этой темы пока нет упражнений."}
              </div>
            ) : (
              <>
                <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5">
                  <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-2">
                    <p className="tw-m-0 tw-text-base tw-font-semibold tw-text-slate-900">Practice · {practiceHeading || "Тренировка"}</p>
                    <div className="tw-flex tw-flex-wrap tw-gap-2">
                      <span className="tw-rounded-full tw-bg-slate-100 tw-px-2.5 tw-py-1 tw-text-xs tw-font-medium tw-text-slate-700">{cursor + 1} / {queue.length}</span>
                      <span className="tw-rounded-full tw-bg-slate-100 tw-px-2.5 tw-py-1 tw-text-xs tw-font-medium tw-text-slate-700">Счет {liveScore} / {answeredCount}</span>
                    </div>
                  </div>
                  <div className="tw-mt-3 tw-h-2 tw-w-full tw-overflow-hidden tw-rounded-full tw-bg-slate-200">
                    <div className="tw-h-full tw-rounded-full tw-bg-slate-900 tw-transition-all" style={{ width: `${Math.max(4, practiceProgressPercent)}%` }} />
                  </div>
                </section>

                <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-6">
                  {asText(current.item && current.item.instruction) ? (
                    <p className="tw-m-0 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.08em] tw-text-slate-500">{asText(current.item.instruction)}</p>
                  ) : null}
                  {asText(current.item && current.item.prompt) ? (
                    <p className="tw-m-0 tw-mt-3 tw-whitespace-pre-wrap tw-text-lg tw-font-semibold tw-leading-relaxed tw-text-slate-900">{asText(current.item.prompt)}</p>
                  ) : null}

                  <div className="tw-mt-5">{renderPracticeInput()}</div>
                </section>

                {checked && resultState ? (
                  <section className={[
                    "tw-rounded-2xl tw-border tw-p-4 sm:tw-p-5",
                    resultState.ok ? "tw-border-emerald-300 tw-bg-emerald-50" : "tw-border-rose-300 tw-bg-rose-50",
                  ].join(" ")}>
                    <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">{resultState.ok ? "Правильно" : "Есть ошибка"}</p>
                    {resultState.expectedText ? <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-700">Верный вариант: {resultState.expectedText}</p> : null}
                    {resultState.explain ? <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-700">{resultState.explain}</p> : null}
                    {!resultState.ok && resultState.linkedTopicId ? (
                      <button type="button" onClick={() => openTopic(resultState.linkedTopicId)} className="tw-mt-3 tw-inline-flex tw-items-center tw-rounded-lg tw-border tw-border-slate-300 tw-bg-white tw-px-3 tw-py-1.5 tw-text-xs tw-font-medium tw-text-slate-700 hover:tw-border-slate-500">
                        Открыть нужное правило
                      </button>
                    ) : null}
                  </section>
                ) : null}

                <section className="tw-flex tw-flex-wrap tw-gap-2">
                  {!checked ? (
                    <button type="button" onClick={checkCurrent} className={primaryBtnClass} disabled={!canCheckCurrent}>Проверить</button>
                  ) : !done ? (
                    <button type="button" onClick={nextCurrent} className={primaryBtnClass}>Дальше</button>
                  ) : (
                    <>
                      <button type="button" onClick={restartPractice} className={primaryBtnClass}>Пройти заново</button>
                      <button type="button" onClick={() => setView("list")} className={secondaryBtnClass}>К темам</button>
                    </>
                  )}

                  {selectedMeta && selectedMistakesCount && !practiceMistakesMode ? (
                    <button type="button" onClick={() => startTopicMistakesPractice(selectedMeta.id)} className={secondaryBtnClass}>
                      Повторить ошибки ({selectedMistakesCount})
                    </button>
                  ) : null}
                </section>
              </>
            )}
          </div>
        ) : null}
      </div>
    </section>,
    hostEl,
  );
}
