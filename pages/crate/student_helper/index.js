import Head from "next/head";
import dynamic from "next/dynamic";
import fs from "node:fs";
import path from "node:path";
import { useEffect, useState } from "react";

const GrammarReactAppPortal = dynamic(
  () => import("../../../components/student-helper/GrammarReactAppPortal"),
  { ssr: false, loading: () => null },
);

const DictionaryReactAppPortal = dynamic(
  () => import("../../../components/student-helper/DictionaryReactAppPortal"),
  { ssr: false, loading: () => null },
);

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

const ROOT_FALLBACK_HTML = "<main style=\"padding:24px;font-family:ui-monospace, Menlo, Consolas, monospace;font-weight:700\">загрузка...</main>";
const DICT_REACT_SHELL_DEFAULT = /^(1|true|yes|on)$/i.test(String(process.env.NEXT_PUBLIC_DICT_REACT_SHELL || ""));
const TRUE_SET = new Set(["1", "true", "yes", "on"]);
const FALSE_SET = new Set(["0", "false", "no", "off"]);

function parseBooleanFlag(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return null;
  if (TRUE_SET.has(value)) return true;
  if (FALSE_SET.has(value)) return false;
  return null;
}

function normalizeRoute(raw) {
  const route = String(raw || "").trim().toLowerCase();
  if (!route) return "";
  if (route === "tenses" || route === "struct" || route === "grammar") return "grammar";
  if (route === "dict") return "dict";
  if (route === "wt" || route === "wt-rule" || route === "wt-practice" || route === "wt-text" || route === "wt-builder") return "wt";
  if (route === "library") return "library";
  if (route === "menu") return "menu";
  return "";
}

function resolveDictShellEnabled(defaultEnabled) {
  if (typeof window === "undefined") return !!defaultEnabled;

  try {
    const params = new URLSearchParams(window.location.search || "");
    const fromQuery = parseBooleanFlag(params.get("dict_react"));
    if (fromQuery !== null) return fromQuery;
  } catch (_err) {}

  try {
    const fromStorage = parseBooleanFlag(localStorage.getItem("sh_dict_react_shell_v1"));
    if (fromStorage !== null) return fromStorage;
  } catch (_err) {}

  return !!defaultEnabled;
}

function inferInitialRoute() {
  if (typeof window === "undefined") return "";

  try {
    if (window.StudentHelperRoute && typeof window.StudentHelperRoute.get === "function") {
      const live = normalizeRoute(window.StudentHelperRoute.get());
      if (live) return live;
    }
  } catch (_err) {}

  const hashRoute = normalizeRoute(String(window.location.hash || "").replace(/^#/, ""));
  if (hashRoute) return hashRoute;

  try {
    const seen = String(localStorage.getItem("sh_seen_lobby") || "").trim();
    if (!seen) return "menu";
    const last = normalizeRoute(localStorage.getItem("sh_last_module"));
    if (last) return last;
  } catch (_err) {}

  return "menu";
}

export default function StudentHelperPage({ studentHelperBodyHtml }) {
  const rootHtml = String(studentHelperBodyHtml || "").trim() || ROOT_FALLBACK_HTML;
  const [mountGrammarReact, setMountGrammarReact] = useState(false);
  const [mountDictionaryReact, setMountDictionaryReact] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const maybeEnableByRoute = (rawRoute) => {
      const route = normalizeRoute(rawRoute);
      if (route === "grammar") setMountGrammarReact(true);
      if (route === "dict" && resolveDictShellEnabled(DICT_REACT_SHELL_DEFAULT)) {
        setMountDictionaryReact(true);
      }
    };

    maybeEnableByRoute(inferInitialRoute());

    const onRoute = (event) => {
      const detail = event && event.detail ? event.detail : {};
      maybeEnableByRoute(detail.route || detail.main || "");
    };

    document.addEventListener("sh:route", onRoute);
    return () => {
      document.removeEventListener("sh:route", onRoute);
    };
  }, []);

  return (
    <>
      <Head>
        <title>Student Helper</title>
        <link rel="stylesheet" href="../../assets/css/styles.css" />
        <link rel="stylesheet" href="./student_helper.css?v=20260402-11" />
        <link rel="stylesheet" href="./student-helper-inline.css" />
        <link rel="stylesheet" href="../../assets/css/theme.css" />
      </Head>

      <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />

      <div id="ik-student-helper-root" dangerouslySetInnerHTML={{ __html: rootHtml }} />

      {mountDictionaryReact ? <DictionaryReactAppPortal defaultEnabled={DICT_REACT_SHELL_DEFAULT} /> : null}
      {mountGrammarReact ? <GrammarReactAppPortal /> : null}

      <script defer src="../../assets/js/theme.js" />
      <script defer src="./js/tabs.js?v=20260331-03" />
      <script defer src="./js/student-helper-back-nav.js?v=20260409-01" />
      <script defer src="./js/student-helper-lazy-runtime.js?v=20260409-01" />
      <script defer src="./js/lobby.js?v=20260331-03" />
    </>
  );
}

export async function getStaticProps() {
  const bodyPath = path.join(process.cwd(), "public", "crate", "student_helper", "student-helper-body.html");
  let studentHelperBodyHtml = "";

  try {
    studentHelperBodyHtml = fs.readFileSync(bodyPath, "utf8");
  } catch (_err) {
    studentHelperBodyHtml = "";
  }

  return {
    props: {
      studentHelperBodyHtml,
    },
  };
}
