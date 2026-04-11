import fs from "fs";
import path from "path";
import Head from "next/head";

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

export default function OnoiNotesPage({ onoiNotesBodyHtml }) {
  const rootHtml = typeof onoiNotesBodyHtml === "string" && onoiNotesBodyHtml.trim()
    ? onoiNotesBodyHtml
    : ROOT_FALLBACK_HTML;

  return (
    <>
      <Head>
        <title>Item Key - onoi_notes</title>
        <link rel="stylesheet" href="../../assets/css/styles.css" />
        <link rel="stylesheet" href="./onoi-notes-inline.css" />
        <link rel="stylesheet" href="../../assets/css/theme.css" />
      </Head>

      <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />

      <div id="ik-onoi-notes-root" dangerouslySetInnerHTML={{ __html: rootHtml }} />

      <script defer src="../../assets/js/main.js" />
      <script defer src="./js/onoi-notes-back-nav.js" />
      <script defer src="./js/onoi-notes-core.js" />
      <script defer id="ik-site-settings-js" src="./js/ik-site-settings.js" />
      <script defer src="../../assets/js/theme.js" />
      <script defer src="./js/onoi-notes-mobile.js" />
      <script defer src="./js/onoi-notes-fallback.js" />
      <script defer src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" />
      <script defer src="../../assets/js/supabase-client.js" />
      <script type="module" src="./onoi_shared.js" />
    </>
  );
}

export async function getStaticProps() {
  const bodyPath = path.join(process.cwd(), "public", "crate", "onoi_notes", "onoi-notes-body.html");
  let onoiNotesBodyHtml = "";

  try {
    onoiNotesBodyHtml = fs.readFileSync(bodyPath, "utf8");
  } catch (_err) {
    onoiNotesBodyHtml = "";
  }

  return {
    props: {
      onoiNotesBodyHtml,
    },
  };
}
