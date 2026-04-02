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

const RETURN_LINK_SCRIPT = `
(() => {
  const link = document.querySelector("header .toplink");
  if (!link) return;
  const tag = link.querySelector(".tag");

  const params = new URLSearchParams(location.search);
  const ownPath = String(location.pathname || "").replace(/^\\/+/, "");
  const ownParts = ownPath.split("/").filter(Boolean);
  const appRoot = ownParts.length ? ownParts[0] : "";

  const getRefPath = () => {
    const ref = document.referrer || "";
    if (!ref) return null;
    try {
      const u = new URL(ref);
      const path = String(u.pathname || "").replace(/^\\/+/, "");
      return path || null;
    } catch (e) {
      const path = String(ref).split("?")[0].split("#")[0].replace(/^\\/+/, "");
      return path || null;
    }
  };

  const refPath = getRefPath();

  const candidate =
    params.get("returnTo") ||
    params.get("from") ||
    (refPath && !/item-user\\.html$/i.test(refPath) ? refPath : null) ||
    sessionStorage.getItem("itemkey.user.returnTo") ||
    localStorage.getItem("itemkey.user.returnTo") ||
    localStorage.getItem("itemkey.lastPage") ||
    localStorage.getItem("itemkey.returnTo") ||
    localStorage.getItem("itemkey.prevPage") ||
    localStorage.getItem("itemkey.nav.return") ||
    localStorage.getItem("itemkey.user.from") ||
    "index.html";

  const safePath = (v) => {
    if (!v) return null;
    let clean = String(v)
      .split("?")[0]
      .split("#")[0]
      .replace(/\\\\/g, "/")
      .replace(/^\\/+/, "")
      .trim();
    if (appRoot && clean.toLowerCase().startsWith((appRoot + "/").toLowerCase())) {
      clean = clean.slice(appRoot.length + 1);
    }
    if (!clean || clean.includes("..")) return null;

    const isHtml = /^[a-z0-9_./\\-]+\\.html$/i.test(clean);
    const isCanonical = /^[a-z0-9_./\\-]+\\/?$/i.test(clean);
    if (!isHtml && !isCanonical) return null;

    clean = clean.replace(/\\/+$/, "");
    if (!clean || /^index(?:\\.html)?$/i.test(clean)) return "index.html";
    if (/item-user(?:\\.html)?$/i.test(clean)) return null;

    if (/\\.html$/i.test(clean)) return clean;
    if (clean === "item-crate" || clean === "item-user" || clean.startsWith("crate/")) return clean + "/";
    return clean + "/";
  };

  const dest = safePath(candidate) || "index.html";
  link.href = dest;
  try { sessionStorage.setItem("itemkey.user.returnTo", dest); } catch (e) {}
  try { localStorage.setItem("itemkey.user.returnTo", dest); } catch (e) {}

  const label =
    /^index(?:\\.html)?$/i.test(dest)
      ? "item-key"
      : dest.replace(/\\/$/, "").split("/").pop().replace(/\\.html$/i, "");

  if (tag) tag.textContent = label;
  link.setAttribute("aria-label", "back to " + label);
})();
`;

export default function ItemUserPage() {
  return (
    <>
      <Head>
        <title>Item Key — item-user</title>
        <base href="../" />
        <link rel="stylesheet" href="assets/css/styles.css" />
        <link rel="stylesheet" href="assets/css/theme.css" />
      </Head>

      <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />

      <header className="topbar topbar--edge">
        <a className="toplink" href="index.html">
          <span className="tag">item-key</span>
        </a>
      </header>

      <main className="center-stage">
        <section id="authGuest" className="auth-box" data-ik-stage="hero">
          <h1>item-user</h1>
          <p className="muted">доступ к архиву</p>

          <div className="auth-tabs">
            <button data-tab="login" className="auth-tab is-active" type="button">вход</button>
            <button data-tab="register" className="auth-tab" type="button">регистрация</button>
          </div>

          <form id="loginForm" className="auth-form">
            <input required type="email" placeholder="почта" id="loginName" autoComplete="email" />
            <input required type="password" placeholder="пароль" id="loginPass" />
            <button className="btn btn--primary" type="submit">войти</button>
          </form>

          <form id="registerForm" className="auth-form hidden">
            <input required type="text" placeholder="user-id (уникальный)" id="regUserId" minLength="4" maxLength="32" autoComplete="off" />
            <input required type="text" placeholder="ник" id="regNick" maxLength="48" autoComplete="nickname" />
            <input required type="email" placeholder="почта" id="regEmail" />
            <input required type="password" placeholder="пароль" id="regPass" />
            <p className="muted auth-tip">user-id нужен для друзей. допустимо: латиница, цифры, <code>.</code> <code>_</code> <code>-</code></p>
            <button className="btn btn--primary" type="submit">создать аккаунт</button>
          </form>
        </section>

        <section id="authWorkspace" className="auth-box account-center hidden" data-ik-stage="content">
          <h1>account center</h1>
          <p className="muted">управление профилем и друзьями</p>

          <div className="auth-tabs auth-tabs--workspace">
            <button data-view="profile" className="auth-tab auth-view-tab profile-tab is-active" type="button">My profile</button>
            <button data-view="friends" className="auth-tab auth-view-tab" type="button">friends</button>
          </div>

          <div id="profileView" className="user-view">
            <section className="profile-showcase" aria-label="витрина профиля">
              <div className="profile-showcase__avatar" aria-hidden="true" id="profileShowcaseAvatar">IK</div>
              <div className="profile-showcase__info">
                <div className="profile-showcase__name" id="profileShowcaseName">user</div>
                <div className="profile-showcase__id">
                  <span className="profile-showcase__label">user-id</span>
                  <button className="profile-showcase__value profile-copy-trigger" id="profileShowcaseUserId" type="button">user_id</button>
                </div>
                <p className="profile-showcase__bio" id="profileShowcaseBio">—</p>
              </div>
            </section>

            <section className="profile-stats" aria-label="статистика аккаунта">
              <div className="profile-stat">
                <div className="profile-stat__label">EKO</div>
                <div className="profile-stat__value" id="profileStatExp">0</div>
              </div>
              <div className="profile-stat profile-stat--cash">
                <div className="profile-stat__label">I-bit þ</div>
                <div className="profile-stat__value" id="profileStatCash">0</div>
              </div>
            </section>

            <button id="constructorToggle" className="btn" type="button">конструктор</button>

            <section id="constructorPanel" className="constructor-panel hidden" aria-label="конструктор аккаунта">
              <div className="profile-avatar-row">
                <div className="profile-avatar" id="profileAvatarPreview" aria-label="avatar">IK</div>
                <label className="btn profile-avatar-upload" htmlFor="profileAvatarInput">сменить аватар</label>
                <input className="visually-hidden" type="file" id="profileAvatarInput" accept="image/*" />
              </div>
              <form id="profileForm" className="auth-form constructor-form">
                <div className="profile-field">
                  <label htmlFor="profileNick">ник</label>
                  <input required type="text" placeholder="ник" id="profileNick" maxLength="48" />
                </div>
                <div className="profile-field">
                  <label htmlFor="profileUserId">user-id</label>
                  <input required type="text" placeholder="user-id" id="profileUserId" minLength="4" maxLength="32" autoComplete="off" />
                </div>
                <div className="profile-field">
                  <label htmlFor="profileBio">описание</label>
                  <textarea id="profileBio" placeholder="описание профиля" rows="4" maxLength="280" />
                </div>
                <button className="btn btn--primary" type="submit">сохранить профиль</button>
              </form>
              <div className="constructor-line"><b>почта:</b> <span id="constructorEmail">-</span></div>
              <div className="constructor-line"><b>пароль:</b> <span id="constructorMaskedPassword">********</span></div>

              <form id="emailChangeForm" className="auth-form constructor-form">
                <input required type="password" id="emailCurrentPass" placeholder="текущий пароль (проверка)" />
                <input required type="email" id="emailNewValue" placeholder="новая почта" />
                <button className="btn" type="submit">сменить почту</button>
              </form>

              <form id="passwordChangeForm" className="auth-form constructor-form">
                <input required type="password" id="passwordCurrentPass" placeholder="текущий пароль (проверка)" />
                <input required type="password" id="passwordNewValue" placeholder="новый пароль" />
                <input required type="password" id="passwordRepeatValue" placeholder="повтори новый пароль" />
                <button className="btn" type="submit">сменить пароль</button>
              </form>
            </section>

            <button id="logoutBtn" className="btn" type="button">выйти</button>
          </div>

          <div id="friendsView" className="user-view hidden">
            <form id="addFriendForm" className="auth-form">
              <input required type="text" id="addFriendUserId" placeholder="user-id друга" minLength="4" maxLength="32" autoComplete="off" />
              <button className="btn btn--primary" type="submit">add friend</button>
            </form>

            <button id="friendsRefreshBtn" className="btn" type="button">обновить</button>

            <section className="friends-block">
              <h2 className="friends-title">входящие приглашения</h2>
              <div id="incomingRequestsList" className="friends-list" />
            </section>

            <section className="friends-block">
              <h2 className="friends-title">исходящие приглашения</h2>
              <div id="outgoingRequestsList" className="friends-list" />
            </section>

            <section className="friends-block">
              <h2 className="friends-title">друзья</h2>
              <div id="friendsList" className="friends-list" />
            </section>
          </div>
        </section>
      </main>

      <script dangerouslySetInnerHTML={{ __html: RETURN_LINK_SCRIPT }} />
      <script src="assets/js/theme.js" />
      <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" />
      <script src="assets/js/supabase-client.js" />
      <script src="assets/js/auth.js" />
    </>
  );
}
