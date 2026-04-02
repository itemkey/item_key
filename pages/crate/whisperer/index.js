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

export default function WhispererPage() {
  return (
    <>
      <Head>
        <title>Item Key - whisperer</title>
        <link rel="stylesheet" href="../../assets/css/styles.css" />
        <link rel="stylesheet" href="./whisperer-inline.css" />
        <link rel="stylesheet" href="./whisperer-modal.css" />
        <link rel="stylesheet" href="../../assets/css/theme.css" />
      </Head>

      <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />

      <header className="ik-site-nav" id="ikSiteNav">
        <button type="button" className="ik-site-nav__link" id="ikBackBtn" title="Вернуться назад">← Назад</button>
        <a className="ik-site-nav__link" href="../../">Главное меню</a>
      </header>

      <main className="center-stage" aria-label="whisperer center">
        <section className="whisperer-wrap" aria-label="whisperer app">
          <div className="w-title" data-ik-stage="hero">
            <h1>whisperer</h1>
            <div className="sub">прошепчи моё имя, пожалуйста</div>
          </div>

          <div className="w-warning" id="supportBox" data-ik-stage="top" hidden>
            Ваш браузер не поддерживает Web Speech API (SpeechSynthesis). Попробуйте Chrome / Edge или обновите браузер.
          </div>

          <div className="w-warning" id="noticeBox" data-ik-stage="top" hidden aria-live="polite" />

          <div className="w-grid" data-ik-stage="content">
            <div className="w-card" aria-label="Ввод текста">
              <div className="w-label">text</div>
              <textarea className="w-text" id="textInput" placeholder="Вставь сюда текст..." />
              <p className="w-hint">
                Клик по слову в FOLLOW - начать чтение с него. Пауза/продолжить всегда сверху. Горячие клавиши: Ctrl+Enter - озвучить, Space - пауза/продолжить, Esc - стоп (если не заблокировано).
              </p>
            </div>

            <div className="w-card w-controls" aria-label="Настройки">
              <div className="w-label">settings</div>

              <div className="w-row">
                <div className="w-field">
                  <div className="w-label">text size (px)</div>
                  <input id="fontSizeNum" type="number" inputMode="numeric" min="12" max="30" step="1" defaultValue="16" />
                </div>

                <div className="w-field">
                  <div className="w-label">rate</div>
                  <input id="rateNum" type="number" inputMode="decimal" min="0.1" max="3" step="0.05" defaultValue="1" />
                </div>

                <div className="w-field">
                  <div className="w-label">pitch</div>
                  <input id="pitchNum" type="number" inputMode="decimal" min="0" max="2" step="0.05" defaultValue="1" />
                </div>

                <div className="w-field">
                  <div className="w-label">volume</div>
                  <input id="volNum" type="number" inputMode="decimal" min="0" max="1" step="0.05" defaultValue="1" />
                </div>
              </div>

              <div className="w-actions" aria-label="Инструменты">
                <button className="w-btn" id="clearBtn" type="button">Очистить</button>
                <button className="w-btn" id="fromNotesBtn" type="button">Из заметок</button>
              </div>

              <div className="w-actions w-actions--3" aria-label="Управление озвучкой">
                <button className="w-btn w-btn--primary" id="menuSpeakBtn" type="button">Озвучить</button>
                <button className="w-btn" id="menuStopBtn" type="button" disabled>Стоп</button>
                <button className="w-btn" id="menuLockBtn" type="button" aria-pressed="false">Заблокировать</button>
              </div>

              <details className="w-adv" id="voicesAdv">
                <summary>voices (optional)</summary>
                <div className="w-row">
                  <div className="w-field">
                    <div className="w-label">EN voice</div>
                    <select id="voiceEnSelect" aria-label="English voice">
                      <option value="__auto__">Auto</option>
                    </select>
                  </div>
                  <div className="w-field">
                    <div className="w-label">RU voice</div>
                    <select id="voiceRuSelect" aria-label="Russian voice">
                      <option value="__auto__">Auto</option>
                    </select>
                  </div>
                  <div className="w-field">
                    <div className="w-label">BE voice</div>
                    <select id="voiceBeSelect" aria-label="Belarusian voice">
                      <option value="__auto__">Auto</option>
                    </select>
                  </div>

                  <p className="w-hint">Авто сам выбирает язык (EN/RU/BE) по тексту. Эти списки - только если хочешь закрепить голос.</p>
                </div>
              </details>

              <div className="w-status" aria-label="Статус">
                <span className="w-pill" id="langPill">lang: auto</span>
                <span className="w-pill" id="modePill">mode: idle</span>
                <span className="w-pill" id="posPill">word: -</span>
              </div>
            </div>
          </div>

          <div className="w-reader" id="followCard" aria-label="Текст с подсветкой">
            <div className="w-reader-head">
              <div className="w-label">follow</div>
              <button className="w-winbtn" id="followFullBtn" type="button" aria-label="Развернуть FOLLOW" aria-pressed="false" title="Развернуть FOLLOW">
                <span className="ico" aria-hidden="true" />
              </button>
            </div>
            <p className="w-display" id="display" />
          </div>
        </section>
      </main>

      <div className="follow-scrim" id="followScrim" hidden aria-hidden="true" />

      <div className="w-floatbar" id="floatbar" aria-label="Пауза/продолжить">
        <button className="w-btn w-btn--primary" id="floatSpeakBtn" type="button">Озвучить</button>
        <button className="w-btn" id="pauseBtn" type="button" disabled hidden>Пауза</button>
      </div>

      <div className="modal" id="notesModal" role="dialog" aria-modal="true" aria-label="Заметки">
        <div className="modal-card">
          <div className="modal-head">
            <div>
              <div className="w-label">notes</div>
              <div style={{ fontSize: "11px", color: "var(--muted)", lineHeight: 1.45 }}>
                Выбери заметки - я вставлю их в поле текста. Можно сразу озвучить.
              </div>
            </div>
            <button className="w-btn" id="closeNotesModal" type="button">Закрыть</button>
          </div>

          <div className="modal-grid">
            <input id="notesSearch" className="modal-input" placeholder="Поиск заметок..." />
            <div className="modal-list" id="notesList" />

            <div className="modal-actions">
              <button className="w-btn" id="insertNotesBtn" type="button">Вставить</button>
              <button className="w-btn w-btn--primary" id="speakNotesBtn" type="button">Вставить и озвучить</button>
            </div>

            <div className="w-hint" style={{ marginTop: "8px" }}>
              Заметки берутся из onoi_notes (IndexedDB). Если включен Cloud Sync в заметках - тут тоже будет доступна та же база (на этом же домене).
            </div>
          </div>
        </div>
      </div>

      <script src="../../assets/js/theme.js" />
      <script src="../../assets/js/main.js" />
      <script src="./js/whisperer-nav.js" />
      <script src="./js/whisperer-core.js" />
      <script id="ik-site-settings-js" src="./js/ik-site-settings.js" />
    </>
  );
}
