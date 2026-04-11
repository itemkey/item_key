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

const PLANNING_BOOT_SCRIPT = `
let bootError = null;
try {
  const { initPlanningCloud } = await import('./js/planning_cloud.js');
  try {
    await initPlanningCloud();
  } catch (error) {
    console.error('planning cloud init failed', error);
  }
  await import('./planning.js');
} catch (error) {
  bootError = error;
  console.error('planning boot failed', error);
} finally {
  if (window.IKLoading) window.IKLoading.done();
}

if (bootError) {
  const view = document.getElementById('boardView');
  if (view) {
    view.hidden = false;
    view.innerHTML = '<div style="font-size:11px; letter-spacing:2px; text-transform:uppercase; opacity:.78;">planning boot failed. reload page.</div>';
  }
}
`;

const NAV_SCRIPT = `
document.addEventListener('DOMContentLoaded', function(){
  var backBtn = document.getElementById('ikBackBtn');
  var viewSelect = document.getElementById('viewSelect');
  var modal = document.getElementById('modal');

  var ignoreNextHashChange = false;
  var applyFromHashInProgress = false;

  function safeBrowserBack(fallbackHref){
    if(window.history.length <= 1){
      window.location.href = fallbackHref;
      return;
    }

    var currentHref = window.location.href;
    var navigated = false;
    var markNavigated = function(){ navigated = true; };

    window.addEventListener('pagehide', markNavigated, { once: true });
    window.addEventListener('popstate', markNavigated, { once: true });

    window.history.back();

    window.setTimeout(function(){
      if(navigated) return;
      if(window.location.href === currentHref){
        window.location.href = fallbackHref;
      }
    }, 450);
  }

  function readViewFromHash(){
    var raw = String(window.location.hash || '').replace('#', '').trim().toLowerCase();
    if(raw === 'board') return raw;
    return '';
  }

  function writeHashForView(view, replace){
    var next = '#' + view;
    if(window.location.hash === next) return;

    if(replace){
      var base = window.location.pathname + window.location.search + next;
      window.history.replaceState(window.history.state, '', base);
      return;
    }

    ignoreNextHashChange = true;
    window.location.hash = view;
  }

  function closeOpenModal(){
    if(!modal || modal.hidden) return false;
    var closeBtn = modal.querySelector('.icon-btn[data-close], [data-close]');
    if(closeBtn){
      closeBtn.click();
    } else {
      modal.hidden = true;
    }
    return true;
  }

  function getFallbackHref(){
    var menuLink = document.querySelector('#ikSiteNav a.ik-site-nav__link[href]');
    var href = menuLink ? String(menuLink.getAttribute('href') || '').trim() : '';
    return href || '../../index.html';
  }

  if(viewSelect){
    var hashView = readViewFromHash();
    if(hashView && hashView !== viewSelect.value){
      applyFromHashInProgress = true;
      viewSelect.value = hashView;
      viewSelect.dispatchEvent(new Event('change', { bubbles: true }));
      applyFromHashInProgress = false;
    } else {
      writeHashForView(viewSelect.value || 'board', true);
    }

    viewSelect.addEventListener('change', function(){
      if(applyFromHashInProgress) return;
      writeHashForView(viewSelect.value || 'board', false);
    });

    window.addEventListener('hashchange', function(){
      if(ignoreNextHashChange){
        ignoreNextHashChange = false;
        return;
      }

      var nextView = readViewFromHash();
      if(!nextView || nextView === viewSelect.value) return;

      applyFromHashInProgress = true;
      viewSelect.value = nextView;
      viewSelect.dispatchEvent(new Event('change', { bubbles: true }));
      applyFromHashInProgress = false;
    });
  }

  if(backBtn){
    backBtn.addEventListener('click', function(event){
      event.preventDefault();
      if(closeOpenModal()) return;
      var fallbackHref = getFallbackHref();
      if(window.IKLoading && typeof window.IKLoading.leave === 'function'){
        window.IKLoading.leave(function(){ safeBrowserBack(fallbackHref); });
      } else {
        safeBrowserBack(fallbackHref);
      }
    });
  }
});
`;

export default function PlanningPage() {
  return (
    <>
      <Head>
        <title>Item Key - Планирование</title>
        <link rel="stylesheet" href="../../assets/css/styles.css" />
        <link rel="stylesheet" href="./planning.css" />
        <link rel="stylesheet" href="./ik-site-settings.css" />
        <link rel="stylesheet" href="../../assets/css/theme.css" />
      </Head>

      <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />

      <header className="ik-site-nav" id="ikSiteNav">
        <button type="button" className="ik-site-nav__link" id="ikBackBtn" title="Вернуться назад">← Назад</button>
        <a className="ik-site-nav__link" href="../../index.html">Главное меню</a>
      </header>

      <main className="center-stage" aria-label="центр планирования">
        <section className="planning-shell">
          <header className="planning-head" data-ik-stage="hero">
            <div className="planning-title">
              <div className="kicker">модуль</div>
              <h1>планирование</h1>
            </div>

            <div className="planning-actions">
              <button className="btn" id="btnNewProject" type="button">+ проект</button>
              <button className="btn" id="btnNewTask" type="button">+ задача</button>
              <button className="btn" id="btnInviteFriend" type="button">+ друг</button>
              <button className="btn" id="btnInvitesInbox" type="button">входящие</button>
            </div>
          </header>

          <div className="planning-toolbar" data-ik-stage="top">
            <div id="projectScope" className="scope-switch" role="tablist" aria-label="Раздел проектов">
              <button className="scope-switch__btn" id="scopePersonal" type="button" data-scope="personal" aria-pressed="false">Личные</button>
              <button className="scope-switch__btn" id="scopeShared" type="button" data-scope="shared" aria-pressed="false">Общие</button>
              <button className="scope-switch__btn is-active" id="scopeAll" type="button" data-scope="all" aria-pressed="true">Все</button>
            </div>

            <select id="projectSelect" className="ctl" aria-label="Проект" />
            <input id="searchInput" className="ctl" type="search" placeholder="поиск задач…" aria-label="Поиск" />

            <select id="assigneeFilter" className="ctl" aria-label="Фильтр по исполнителю">
              <option value="all">исполнитель: все</option>
              <option value="me">исполнитель: мои</option>
              <option value="unassigned">исполнитель: без ответ.</option>
            </select>

            <input id="tagsFilter" className="ctl" type="text" placeholder="теги: учёба, работа" aria-label="Фильтр по тегам" />

            <select id="priorityFilter" className="ctl" aria-label="Фильтр по приоритету">
              <option value="all">приоритет: все</option>
              <option value="high">приоритет: высокий</option>
              <option value="mid">приоритет: средний</option>
              <option value="low">приоритет: низкий</option>
            </select>

            <select id="deadlineFilter" className="ctl" aria-label="Фильтр по сроку">
              <option value="all">срок: все</option>
              <option value="today">срок: сегодня</option>
              <option value="overdue">срок: просрочено</option>
              <option value="week">срок: неделя</option>
            </select>

            <select id="sortSelect" className="ctl" aria-label="Сортировка задач">
              <option value="default">сортировка: по умолчанию</option>
              <option value="deadline">сортировка: по сроку</option>
              <option value="priority">сортировка: по приоритету</option>
              <option value="newest">сортировка: сначала новые</option>
            </select>

            <button className="btn btn--thin" id="clearFilters" type="button">очистить</button>
            <select id="viewSelect" className="ctl" aria-label="Вид">
              <option value="board">доска</option>
            </select>
          </div>

          <div id="planningPresence" className="planning-presence" aria-live="polite" />
          <div id="projectBar" className="projectbar" aria-label="Проекты" data-ik-stage="top" />

          <section className="planning-content" data-ik-stage="content">
            <div id="boardView" className="board" hidden />
          </section>
        </section>
      </main>

      <div className="modal" id="modal" hidden>
        <div className="modal__backdrop" data-close="true" />
        <div className="modal__panel" role="dialog" aria-modal="true">
          <div className="modal__head">
            <div className="modal__title" id="modalTitle" />
            <button className="icon-btn" data-close="true" aria-label="Закрыть">×</button>
          </div>
          <div className="modal__body" id="modalBody" />
        </div>
      </div>

      <div className="toast-stack" id="toasts" aria-live="polite" />

      <script defer src="../../assets/js/theme.js" />
      <script defer src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" />
      <script defer src="../../assets/js/supabase-client.js" />
      <script type="module" dangerouslySetInnerHTML={{ __html: PLANNING_BOOT_SCRIPT }} />
      <script dangerouslySetInnerHTML={{ __html: NAV_SCRIPT }} />
      <script defer id="ik-site-settings-js" src="./js/ik-site-settings.js" />
    </>
  );
}
