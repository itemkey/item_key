import Head from "next/head";

const THEME_BOOTSTRAP_SCRIPT = `
(function () {
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

const BACK_SCRIPT = `
document.addEventListener('DOMContentLoaded', function () {
  var backBtn = document.getElementById('ikBackBtn');

  function safeBrowserBack(fallbackHref) {
    if (window.history.length <= 1) {
      window.location.href = fallbackHref;
      return;
    }

    var currentHref = window.location.href;
    var navigated = false;
    var markNavigated = function () { navigated = true; };

    window.addEventListener('pagehide', markNavigated, { once: true });
    window.addEventListener('popstate', markNavigated, { once: true });

    window.history.back();

    window.setTimeout(function () {
      if (navigated) return;
      if (window.location.href === currentHref) {
        window.location.href = fallbackHref;
      }
    }, 450);
  }

  if (backBtn) {
    backBtn.addEventListener('click', function (event) {
      event.preventDefault();
      if (window.IKLoading && typeof window.IKLoading.leave === 'function') {
        window.IKLoading.leave(function () { safeBrowserBack('../../item-crate/'); });
      } else {
        safeBrowserBack('../../item-crate/');
      }
    });
  }

  if (window.IKLoading) window.IKLoading.done();
});
`;

export default function SchedulePage() {
  return (
    <>
      <Head>
        <title>Item Key - Расписание</title>
        <link rel="stylesheet" href="../../assets/css/styles.css" />
        <link rel="stylesheet" href="./schedule.css" />
        <link rel="stylesheet" href="../../assets/css/theme.css" />
      </Head>

      <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />

      <header className="ik-site-nav" id="ikSiteNav">
        <button type="button" className="ik-site-nav__link" id="ikBackBtn" title="Вернуться назад">← Назад</button>
        <a className="ik-site-nav__link" href="../../index.html">Главное меню</a>
      </header>

      <main className="center-stage" aria-label="центр расписания">
        <section className="schedule-shell">
          <header className="schedule-head" data-ik-stage="hero">
            <div className="schedule-title">
              <div className="kicker">module</div>
              <h1>расписание</h1>
            </div>

            <div className="schedule-head__actions">
              <button className="btn" type="button" id="btnNewItem">+ план</button>
              <button className="btn" type="button" id="btnNewBlock">+ слот</button>
            </div>
          </header>

          <nav className="schedule-tabs" aria-label="Разделы расписания" data-ik-stage="top">
            <button className="schedule-tab is-active" type="button" data-tab="today">Сегодня</button>
            <button className="schedule-tab" type="button" data-tab="calendar">Общее расписание</button>
            <button className="schedule-tab" type="button" data-tab="assistant">Помощник</button>
            <button className="schedule-tab" type="button" data-tab="settings">Настройки</button>
          </nav>

          <section id="scheduleContent" className="schedule-content" data-ik-stage="content" />
        </section>
      </main>

      <div className="modal" id="modal" hidden>
        <div className="modal__backdrop" data-close="true" />
        <div className="modal__panel" role="dialog" aria-modal="true">
          <div className="modal__head">
            <div className="modal__title" id="modalTitle" />
            <button className="icon-btn" type="button" data-close="true" aria-label="Закрыть">×</button>
          </div>
          <div className="modal__body" id="modalBody" />
        </div>
      </div>

      <div className="toast-stack" id="toasts" aria-live="polite" />

      <script defer src="../../assets/js/theme.js" />
      <script defer src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" />
      <script defer src="../../assets/js/supabase-client.js" />
      <script type="module" src="./schedule.js" />
      <script dangerouslySetInnerHTML={{ __html: BACK_SCRIPT }} />
    </>
  );
}
