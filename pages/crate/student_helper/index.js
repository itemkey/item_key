import Head from "next/head";
import fs from "node:fs";
import path from "node:path";
import GrammarReactAppPortal from "../../../components/student-helper/GrammarReactAppPortal";

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

export default function StudentHelperPage({ studentHelperBodyHtml }) {
  const rootHtml = String(studentHelperBodyHtml || "").trim() || ROOT_FALLBACK_HTML;

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

      <GrammarReactAppPortal />

      <script defer src="../../assets/js/theme.js" />
      <script defer src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" />
      <script defer src="../../assets/js/supabase-client.js" />
      <script defer src="./js/tabs.js?v=20260331-03" />
      <script defer src="./js/student-helper-back-nav.js" />
      <script defer src="./js/lobby.js?v=20260331-03" />
      <script defer src="./js/library.js?v=20260331-03" />
      <script defer src="./js/structure_data.js" />
      <script defer src="./js/structure.js?v=20260331-01" />
      <script defer src="./js/word_transformation.js?v=20260331-02" />
      <script defer src="./js/dictionary.js" />
      <script defer src="./js/student-helper-dict-fallback.js" />
      <script defer src="./js/dictionary_cloud.js" />
      <script defer src="./js/progress_cloud.js" />
      <script defer src="./js/backup_restore.js" />
      <script defer src="./js/enter_next.js" />
      <script defer id="ik-site-settings-js" src="./js/ik-site-settings.js" />
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
