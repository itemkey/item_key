import Head from "next/head";

const HASH_REDIRECT_SCRIPT = `
(function() {
  try {
    if (location.hash && /access_token=/.test(location.hash)) {
      var repoPath = "/item_key/";
      if (location.pathname === "/" || location.pathname === repoPath || /\\/index\\.html$/i.test(location.pathname)) {
        location.replace(repoPath + "item-user/" + location.hash);
      }
    }
  } catch (e) {}
})();
`;

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

export default function HomePage() {
  return (
    <>
      <Head>
        <title>Item Key — Главное меню</title>
        <link rel="stylesheet" href="assets/css/styles.css" />
        <link rel="stylesheet" href="index-inline.css" />
        <link rel="stylesheet" href="assets/css/theme.css" />
      </Head>

      <script dangerouslySetInnerHTML={{ __html: HASH_REDIRECT_SCRIPT }} />
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />

      <div className="dev-overlay" id="devOverlay" role="dialog" aria-modal="true" aria-labelledby="devOverlayTitle" aria-hidden="true">
        <div className="dev-window" role="document">
          <div className="dev-inner">
            <p className="dev-title" id="devOverlayTitle">отсек в разработке</p>
            <p className="dev-line" id="devOverlayText">Этот отсек ещё не ожил. Возвращайся позже.</p>
            <div className="dev-actions">
              <button className="dev-btn" id="devOverlayBack" type="button">вернуться назад</button>
              <span className="dev-hint">Esc - выйти</span>
            </div>
          </div>
        </div>
      </div>

      <a className="nav-btn nav-btn--user" href="item-user/?returnTo=index.html" aria-label="Item User">
        <span className="nav-btn__name">item-user</span>
        <span className="nav-btn__hint">перейти</span>
        <span className="nav-btn__arrow">→</span>
      </a>

      <a className="nav-btn nav-btn--crate" href="item-crate/" aria-label="Item Crate">
        <span className="nav-btn__name">item-crate</span>
        <span className="nav-btn__hint">перейти</span>
        <span className="nav-btn__arrow">→</span>
      </a>

      <main className="center-stage" aria-label="Центр">
        <div className="intro-stage" aria-hidden="true">
          <canvas id="introCanvas" />
        </div>
      </main>

      <script src="assets/js/theme.js" />
      <script src="assets/js/main.js" />
      <script src="./index-intro.js" />
      <script id="ik-site-settings-js" src="./js/ik-site-settings-index.js" />
    </>
  );
}
