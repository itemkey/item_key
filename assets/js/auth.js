(() => {
  const CURRENT_KEY = "itemkey.currentUser";
  const NOTICE_STYLE_ID = "ikAuthNoticeStyles";
  const PROFILE_TABLE = "ik_user_profiles";
  const FRIENDS_TABLE = "ik_friendships";
  const REQUESTS_TABLE = "ik_friend_requests";
  const MAX_AVATAR_BYTES = 900 * 1024;
  const FRIENDS_POLL_MS = 12000;
  const ADMIN_EMAILS = ["itemkeygithub@gmail.com", "kravetznikita@gmail.com"];

  const state = {
    supa: null,
    user: null,
    profile: null,
    avatarDraft: null,
    activeView: "profile",
    socialPollId: null,
    schemaWarnShown: false,
    refreshingFriends: false,
    lastRegisterEmail: null,
  };

  function getAuthRedirectUrl() {
    const origin = window.location.origin;
    if (!origin || origin === "null") return null;
    const path = String(window.location.pathname || "/");
    const baseDir = path.replace(/[^/]*$/, "");
    let base = origin + baseDir;
    if (!base.endsWith("/")) base += "/";
    return base + "item-user.html";
  }

  async function resendSignupEmail(email) {
    if (!state.supa) throw new Error("Нет авторизации");
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) throw new Error("Нужна почта");
    const emailRedirectTo = getAuthRedirectUrl();
    if (typeof state.supa.auth.resend === "function") {
      const { error } = await state.supa.auth.resend({
        type: "signup",
        email: cleanEmail,
        options: emailRedirectTo ? { emailRedirectTo } : undefined,
      });
      if (error) throw error;
      return;
    }
    throw new Error("Функция повторной отправки не поддерживается");
  }

  const el = {
    guestBox: document.getElementById("authGuest"),
    workspaceBox: document.getElementById("authWorkspace"),
    loginForm: document.getElementById("loginForm"),
    registerForm: document.getElementById("registerForm"),
    logoutBtn: document.getElementById("logoutBtn"),
    profileForm: document.getElementById("profileForm"),
    profileNick: document.getElementById("profileNick"),
    profileUserId: document.getElementById("profileUserId"),
    profileBio: document.getElementById("profileBio"),
    profileAvatarInput: document.getElementById("profileAvatarInput"),
    profileAvatarPreview: document.getElementById("profileAvatarPreview"),
    constructorToggle: document.getElementById("constructorToggle"),
    constructorPanel: document.getElementById("constructorPanel"),
    constructorEmail: document.getElementById("constructorEmail"),
    constructorMaskedPassword: document.getElementById("constructorMaskedPassword"),
    emailChangeForm: document.getElementById("emailChangeForm"),
    passwordChangeForm: document.getElementById("passwordChangeForm"),
    addFriendForm: document.getElementById("addFriendForm"),
    friendsRefreshBtn: document.getElementById("friendsRefreshBtn"),
    incomingRequestsList: document.getElementById("incomingRequestsList"),
    outgoingRequestsList: document.getElementById("outgoingRequestsList"),
    friendsList: document.getElementById("friendsList"),
    profileView: document.getElementById("profileView"),
    friendsView: document.getElementById("friendsView"),
  };

  function ensureNoticeStyles() {
    if (document.getElementById(NOTICE_STYLE_ID)) return;
    const st = document.createElement("style");
    st.id = NOTICE_STYLE_ID;
    st.textContent = [
      ".ik-auth-notice-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;z-index:100200;padding:16px;}",
      ".ik-auth-notice{width:min(440px,96vw);background:#fff;border:1px solid rgba(0,0,0,.18);box-shadow:0 10px 32px rgba(0,0,0,.16);padding:16px;}",
      ".ik-auth-notice__text{margin:0 0 12px;font-size:14px;line-height:1.45;color:#111;}",
      ".ik-auth-notice__actions{display:flex;gap:8px;justify-content:flex-end;}",
      ".ik-auth-notice__btn{appearance:none;border:1px solid rgba(0,0,0,.2);background:#fff;color:#111;padding:8px 12px;cursor:pointer;font-size:12px;letter-spacing:.04em;text-transform:uppercase;}",
      ".ik-auth-notice__btn--main{background:#111;color:#fff;border-color:#111;}"
    ].join("");
    document.head.appendChild(st);
  }

  function showNotice(text, options) {
    ensureNoticeStyles();
    const opts = options || {};
    const backdrop = document.createElement("div");
    backdrop.className = "ik-auth-notice-backdrop";

    const box = document.createElement("div");
    box.className = "ik-auth-notice";

    const p = document.createElement("p");
    p.className = "ik-auth-notice__text";
    p.textContent = String(text || "").trim() || "Готово";

    const actions = document.createElement("div");
    actions.className = "ik-auth-notice__actions";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "ik-auth-notice__btn";
    closeBtn.textContent = opts.closeLabel || "Закрыть";
    closeBtn.addEventListener("click", () => backdrop.remove());
    actions.appendChild(closeBtn);

    if (opts.actionLabel && typeof opts.onAction === "function") {
      const goBtn = document.createElement("button");
      goBtn.type = "button";
      goBtn.className = "ik-auth-notice__btn ik-auth-notice__btn--main";
      goBtn.textContent = opts.actionLabel;
      goBtn.addEventListener("click", () => {
        try {
          opts.onAction();
        } finally {
          backdrop.remove();
        }
      });
      actions.appendChild(goBtn);
    }

    box.appendChild(p);
    box.appendChild(actions);
    backdrop.appendChild(box);

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) backdrop.remove();
    });

    document.body.appendChild(backdrop);
  }

  function briefError(err) {
    const text = String((err && (err.message || err.error_description || err.error || err)) || "").trim();
    if (!text) return "Неизвестная ошибка";
    if (/invalid login credentials/i.test(text)) return "Неверная почта или пароль";
    if (/already registered|user already registered/i.test(text)) return "Почта уже зарегистрирована";
    if (/password/i.test(text) && /short|at least/i.test(text)) return "Пароль слишком короткий";
    if (/duplicate key|unique/i.test(text) && /user_id|ik_user_profiles/i.test(text)) return "Такой user-id уже занят";
    if (/friend request already pending/i.test(text)) return "Приглашение уже отправлено";
    if (/already friends/i.test(text)) return "Вы уже в друзьях";
    if (/user id not found/i.test(text)) return "Пользователь с таким user-id не найден";
    if (/cannot add yourself/i.test(text)) return "Себя добавить нельзя";
    return text;
  }

  function normalizeEmail(v) {
    return String(v || "").trim().toLowerCase();
  }

  function normalizeUserId(v) {
    return String(v || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "")
      .slice(0, 32);
  }

  function validUserId(v) {
    return /^[a-z0-9._-]{4,32}$/.test(String(v || ""));
  }

  function randomSuffix(size) {
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    let out = "";
    for (let i = 0; i < size; i += 1) {
      out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return out;
  }

  function looksLikeSchemaError(error) {
    const text = String((error && (error.message || error.details || error.hint || error)) || "").toLowerCase();
    return (
      text.includes("ik_user_profiles") ||
      text.includes("ik_friendships") ||
      text.includes("ik_friend_requests") ||
      text.includes("does not exist") ||
      text.includes("schema cache")
    );
  }

  function schemaMissingNotice() {
    if (state.schemaWarnShown) return;
    state.schemaWarnShown = true;
    showNotice("Нужно применить SQL stage8: supabase/sql/stage8_accounts_social.sql");
  }

  function isUniqueViolation(error) {
    if (!error) return false;
    if (String(error.code || "") === "23505") return true;
    return /duplicate key|unique/i.test(String(error.message || ""));
  }

  function isAdminEmail(email) {
    return ADMIN_EMAILS.includes(normalizeEmail(email));
  }

  function fallbackNickname(user) {
    const meta = (user && user.user_metadata) || {};
    const fromMeta = String(meta.nickname || meta.username || meta.login || "").trim();
    if (fromMeta) return fromMeta;
    const localPart = String((user && user.email) || "").split("@")[0];
    return localPart || "user";
  }

  function fallbackUserId(user) {
    const meta = (user && user.user_metadata) || {};
    const fromMeta = normalizeUserId(meta.user_id || "");
    if (validUserId(fromMeta)) return fromMeta;
    const localPart = normalizeUserId(String((user && user.email) || "").split("@")[0]);
    if (validUserId(localPart)) return localPart;
    return `user_${randomSuffix(6)}`;
  }

  function emitAuthChanged() {
    document.dispatchEvent(new CustomEvent("ik:authchange"));
  }

  function setLegacyCurrentUser(user, profile) {
    if (!user) {
      try {
        localStorage.removeItem(CURRENT_KEY);
      } catch (_) {}
      emitAuthChanged();
      return;
    }

    const payload = {
      id: user.id,
      name: String((profile && profile.nickname) || fallbackNickname(user)).trim() || "user",
      email: String(user.email || "").trim(),
      userId: String((profile && profile.user_id) || fallbackUserId(user)).trim(),
      isAdmin: Boolean((profile && profile.is_admin) || isAdminEmail(user.email || "")),
      provider: "supabase",
    };

    try {
      localStorage.setItem(CURRENT_KEY, JSON.stringify(payload));
    } catch (_) {}
    emitAuthChanged();
  }

  function getRequestedView() {
    const params = new URLSearchParams(window.location.search);
    const view = String(params.get("view") || "").trim().toLowerCase();
    return view === "friends" ? "friends" : "profile";
  }

  function persistView(view) {
    const next = view === "friends" ? "friends" : "profile";
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function setWorkspaceView(view, persist) {
    const next = view === "friends" ? "friends" : "profile";
    state.activeView = next;

    document.querySelectorAll(".auth-view-tab").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-view") === next);
    });

    if (el.profileView) el.profileView.classList.toggle("hidden", next !== "profile");
    if (el.friendsView) el.friendsView.classList.toggle("hidden", next !== "friends");

    if (persist) persistView(next);

    if (next === "friends") {
      refreshFriendsData(true).catch(() => {});
      startFriendsPolling();
    } else {
      stopFriendsPolling();
    }
  }

  function setupAuthTabs() {
    document.querySelectorAll(".auth-tab[data-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".auth-tab[data-tab]").forEach((t) => t.classList.remove("is-active"));
        tab.classList.add("is-active");
        if (el.loginForm) el.loginForm.classList.toggle("hidden", tab.dataset.tab !== "login");
        if (el.registerForm) el.registerForm.classList.toggle("hidden", tab.dataset.tab !== "register");
      });
    });
  }

  function setupWorkspaceTabs() {
    document.querySelectorAll(".auth-view-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const view = tab.getAttribute("data-view") || "profile";
        setWorkspaceView(view, true);
      });
    });
  }

  function avatarLetters(name) {
    const clean = String(name || "").replace(/\s+/g, " ").trim();
    if (!clean) return "IK";
    const parts = clean.split(" ").filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }

  function renderAvatar(avatarUrl, nickname) {
    if (!el.profileAvatarPreview) return;
    const url = String(avatarUrl || "").trim();
    const allowed = /^data:image\//i.test(url) || /^https?:\/\//i.test(url) || /^blob:/i.test(url);

    if (!allowed) {
      el.profileAvatarPreview.innerHTML = "";
      el.profileAvatarPreview.textContent = avatarLetters(nickname);
      return;
    }

    const img = document.createElement("img");
    img.src = url;
    img.alt = "avatar";
    img.loading = "lazy";

    el.profileAvatarPreview.innerHTML = "";
    el.profileAvatarPreview.appendChild(img);
  }

  function candidateUserIds(base) {
    const cleaned = normalizeUserId(base);
    let seed = cleaned;
    if (!seed) seed = `user_${randomSuffix(6)}`;
    if (seed.length < 4) seed = `${seed}${randomSuffix(4)}`;
    seed = seed.slice(0, 32);

    const root = seed.slice(0, 24);
    const out = [seed];
    for (let i = 0; i < 14; i += 1) {
      out.push(`${root}_${randomSuffix(5)}`.slice(0, 32));
    }
    return Array.from(new Set(out.filter((x) => validUserId(x))));
  }

  async function fetchOwnProfile(userId) {
    const { data, error } = await state.supa
      .from(PROFILE_TABLE)
      .select("id,user_id,nickname,bio,avatar_url,is_admin")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  async function createOwnProfile(user, options) {
    const opts = options || {};
    const strict = !!opts.strictUserId;
    const nickname = String(opts.nickname || fallbackNickname(user)).trim().slice(0, 48) || "user";
    const bio = String(opts.bio || "").trim().slice(0, 280);
    const avatarUrl = typeof opts.avatarUrl === "string" ? opts.avatarUrl : null;

    const ids = candidateUserIds(opts.userId || fallbackUserId(user));
    let lastError = null;

    for (let i = 0; i < ids.length; i += 1) {
      const candidate = ids[i];
      const payload = {
        id: user.id,
        user_id: candidate,
        nickname,
        bio,
        avatar_url: avatarUrl,
      };

      const { data, error } = await state.supa
        .from(PROFILE_TABLE)
        .insert(payload)
        .select("id,user_id,nickname,bio,avatar_url,is_admin")
        .single();

      if (!error) return data;

      if (looksLikeSchemaError(error)) throw error;

      if (isUniqueViolation(error)) {
        const own = await fetchOwnProfile(user.id).catch(() => null);
        if (own) return own;
        if (strict && i === 0) {
          const e = new Error("Такой user-id уже занят");
          e.code = "USER_ID_TAKEN";
          throw e;
        }
        lastError = error;
        continue;
      }

      throw error;
    }

    throw lastError || new Error("Не удалось создать профиль");
  }

  async function ensureOwnProfile(user, options) {
    try {
      const existing = await fetchOwnProfile(user.id);
      if (existing) return existing;
      return await createOwnProfile(user, options);
    } catch (error) {
      if (looksLikeSchemaError(error)) {
        schemaMissingNotice();
        return {
          id: user.id,
          user_id: fallbackUserId(user),
          nickname: fallbackNickname(user),
          bio: "",
          avatar_url: "",
          is_admin: isAdminEmail(user.email || ""),
        };
      }
      throw error;
    }
  }

  async function syncAuthMetadata(profile) {
    if (!state.supa || !profile) return;
    try {
      await state.supa.auth.updateUser({
        data: {
          nickname: String(profile.nickname || ""),
          user_id: String(profile.user_id || ""),
        },
      });
    } catch (_) {}
  }

  function applyProfileToUI(user, profile) {
    const p = profile || {
      user_id: fallbackUserId(user),
      nickname: fallbackNickname(user),
      bio: "",
      avatar_url: "",
    };

    if (el.profileNick) el.profileNick.value = String(p.nickname || "");
    if (el.profileUserId) el.profileUserId.value = String(p.user_id || "");
    if (el.profileBio) el.profileBio.value = String(p.bio || "");
    if (el.constructorEmail) el.constructorEmail.textContent = String((user && user.email) || "-");
    if (el.constructorMaskedPassword) el.constructorMaskedPassword.textContent = "********";

    renderAvatar(state.avatarDraft || p.avatar_url || "", p.nickname || fallbackNickname(user));
  }

  function stopFriendsPolling() {
    if (!state.socialPollId) return;
    window.clearInterval(state.socialPollId);
    state.socialPollId = null;
  }

  function startFriendsPolling() {
    stopFriendsPolling();
    state.socialPollId = window.setInterval(() => {
      if (!state.user || state.activeView !== "friends") return;
      refreshFriendsData(false).catch(() => {});
    }, FRIENDS_POLL_MS);
  }

  function setSignedOutUI() {
    if (el.guestBox) el.guestBox.classList.remove("hidden");
    if (el.workspaceBox) el.workspaceBox.classList.add("hidden");
    if (el.constructorPanel) el.constructorPanel.classList.add("hidden");

    state.user = null;
    state.profile = null;
    state.avatarDraft = null;

    setLegacyCurrentUser(null, null);
    stopFriendsPolling();

    if (el.incomingRequestsList) el.incomingRequestsList.innerHTML = "";
    if (el.outgoingRequestsList) el.outgoingRequestsList.innerHTML = "";
    if (el.friendsList) el.friendsList.innerHTML = "";
  }

  async function setSignedInUI(user, profileOptions) {
    if (!user) {
      setSignedOutUI();
      return;
    }

    if (el.guestBox) el.guestBox.classList.add("hidden");
    if (el.workspaceBox) el.workspaceBox.classList.remove("hidden");

    state.user = user;
    state.profile = await ensureOwnProfile(user, profileOptions || {});
    setLegacyCurrentUser(user, state.profile);
    applyProfileToUI(user, state.profile);

    const requested = getRequestedView();
    setWorkspaceView(requested, false);
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error("Не удалось прочитать файл"));
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(file);
    });
  }

  async function handleAvatarPick(e) {
    const file = e.target && e.target.files ? e.target.files[0] : null;
    if (!file) return;
    if (!/^image\//i.test(String(file.type || ""))) {
      showNotice("Нужен файл изображения");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      showNotice("Аватар слишком большой. максимум 900KB");
      e.target.value = "";
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      state.avatarDraft = dataUrl;
      renderAvatar(dataUrl, (state.profile && state.profile.nickname) || fallbackNickname(state.user));
    } catch (error) {
      showNotice(`Ошибка файла: ${briefError(error)}`);
    }
  }

  function renderEmptyList(container, text) {
    if (!container) return;
    container.innerHTML = "";
    const row = document.createElement("div");
    row.className = "friends-empty";
    row.textContent = text;
    container.appendChild(row);
  }

  function friendProfile(map, userId) {
    return map[userId] || {
      id: userId,
      user_id: "unknown",
      nickname: "unknown",
      avatar_url: "",
      bio: "",
    };
  }

  function formatStamp(ts) {
    const date = new Date(ts || "");
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString();
  }

  function buildFriendCard(profile, metaText) {
    const card = document.createElement("article");
    card.className = "friend-card";

    const avatar = document.createElement("div");
    avatar.className = "friend-avatar";
    const url = String((profile && profile.avatar_url) || "").trim();
    if (/^data:image\//i.test(url) || /^https?:\/\//i.test(url) || /^blob:/i.test(url)) {
      const img = document.createElement("img");
      img.src = url;
      img.alt = "avatar";
      img.loading = "lazy";
      avatar.appendChild(img);
    } else {
      avatar.textContent = avatarLetters((profile && profile.nickname) || "");
    }

    const body = document.createElement("div");
    body.className = "friend-main";

    const name = document.createElement("div");
    name.className = "friend-name";
    name.textContent = String((profile && profile.nickname) || "unknown");

    const uid = document.createElement("div");
    uid.className = "friend-user-id";
    uid.textContent = `@${String((profile && profile.user_id) || "unknown")}`;

    body.appendChild(name);
    body.appendChild(uid);

    if (metaText) {
      const meta = document.createElement("div");
      meta.className = "friend-meta";
      meta.textContent = metaText;
      body.appendChild(meta);
    }

    card.appendChild(avatar);
    card.appendChild(body);
    return card;
  }

  async function fetchFriendsBundle(user) {
    const uid = user.id;

    const [friendsRes, incomingRes, outgoingRes] = await Promise.all([
      state.supa
        .from(FRIENDS_TABLE)
        .select("id,user_low,user_high,created_at")
        .or(`user_low.eq.${uid},user_high.eq.${uid}`)
        .order("created_at", { ascending: false }),
      state.supa
        .from(REQUESTS_TABLE)
        .select("id,requester_id,addressee_id,status,created_at")
        .eq("addressee_id", uid)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      state.supa
        .from(REQUESTS_TABLE)
        .select("id,requester_id,addressee_id,status,created_at")
        .eq("requester_id", uid)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

    if (friendsRes.error) throw friendsRes.error;
    if (incomingRes.error) throw incomingRes.error;
    if (outgoingRes.error) throw outgoingRes.error;

    const friends = Array.isArray(friendsRes.data) ? friendsRes.data : [];
    const incoming = Array.isArray(incomingRes.data) ? incomingRes.data : [];
    const outgoing = Array.isArray(outgoingRes.data) ? outgoingRes.data : [];

    const ids = new Set();
    friends.forEach((row) => {
      ids.add(row.user_low === uid ? row.user_high : row.user_low);
    });
    incoming.forEach((row) => ids.add(row.requester_id));
    outgoing.forEach((row) => ids.add(row.addressee_id));

    const profileMap = {};
    const profileIds = Array.from(ids);
    if (profileIds.length > 0) {
      const profilesRes = await state.supa
        .from(PROFILE_TABLE)
        .select("id,user_id,nickname,bio,avatar_url")
        .in("id", profileIds);

      if (profilesRes.error) throw profilesRes.error;
      (profilesRes.data || []).forEach((row) => {
        profileMap[row.id] = row;
      });
    }

    return { friends, incoming, outgoing, profileMap };
  }

  function renderIncoming(incoming, profileMap) {
    if (!el.incomingRequestsList) return;
    if (!incoming.length) {
      renderEmptyList(el.incomingRequestsList, "нет входящих приглашений");
      return;
    }

    el.incomingRequestsList.innerHTML = "";
    incoming.forEach((row) => {
      const profile = friendProfile(profileMap, row.requester_id);
      const card = buildFriendCard(profile, `приглашение: ${formatStamp(row.created_at)}`);

      const actions = document.createElement("div");
      actions.className = "friend-actions";

      const accept = document.createElement("button");
      accept.type = "button";
      accept.className = "btn btn--primary friend-action-btn";
      accept.textContent = "принять";
      accept.setAttribute("data-request-id", String(row.id));
      accept.setAttribute("data-request-action", "accept");

      const decline = document.createElement("button");
      decline.type = "button";
      decline.className = "btn friend-action-btn";
      decline.textContent = "отклонить";
      decline.setAttribute("data-request-id", String(row.id));
      decline.setAttribute("data-request-action", "decline");

      actions.appendChild(accept);
      actions.appendChild(decline);
      card.appendChild(actions);
      el.incomingRequestsList.appendChild(card);
    });
  }

  function renderOutgoing(outgoing, profileMap) {
    if (!el.outgoingRequestsList) return;
    if (!outgoing.length) {
      renderEmptyList(el.outgoingRequestsList, "нет исходящих приглашений");
      return;
    }

    el.outgoingRequestsList.innerHTML = "";
    outgoing.forEach((row) => {
      const profile = friendProfile(profileMap, row.addressee_id);
      const card = buildFriendCard(profile, `ожидает ответа: ${formatStamp(row.created_at)}`);
      el.outgoingRequestsList.appendChild(card);
    });
  }

  function renderFriends(friends, profileMap, uid) {
    if (!el.friendsList) return;
    if (!friends.length) {
      renderEmptyList(el.friendsList, "пока нет друзей");
      return;
    }

    el.friendsList.innerHTML = "";
    friends.forEach((row) => {
      const friendId = row.user_low === uid ? row.user_high : row.user_low;
      const profile = friendProfile(profileMap, friendId);
      const card = buildFriendCard(profile, `с ${formatStamp(row.created_at)}`);
      el.friendsList.appendChild(card);
    });
  }

  async function refreshFriendsData(showErrors) {
    if (!state.user || !state.supa) return;
    if (state.refreshingFriends) return;
    state.refreshingFriends = true;

    try {
      const bundle = await fetchFriendsBundle(state.user);
      renderIncoming(bundle.incoming, bundle.profileMap);
      renderOutgoing(bundle.outgoing, bundle.profileMap);
      renderFriends(bundle.friends, bundle.profileMap, state.user.id);
    } catch (error) {
      if (looksLikeSchemaError(error)) {
        schemaMissingNotice();
      } else if (showErrors) {
        showNotice(`Ошибка друзей: ${briefError(error)}`);
      }
    } finally {
      state.refreshingFriends = false;
    }
  }

  async function verifyCurrentPassword(currentPassword) {
    const pass = String(currentPassword || "");
    if (!state.user || !state.supa) throw new Error("Нет авторизации");
    if (!pass) throw new Error("Нужен текущий пароль");

    const { error } = await state.supa.auth.signInWithPassword({
      email: String(state.user.email || ""),
      password: pass,
    });

    if (error) throw new Error("Проверка пароля не пройдена");
  }

  async function onRegisterSubmit(e) {
    e.preventDefault();
    if (!state.supa) return;

    const userIdInput = document.getElementById("regUserId");
    const nickInput = document.getElementById("regNick");
    const emailInput = document.getElementById("regEmail");
    const passInput = document.getElementById("regPass");

    const userId = normalizeUserId(userIdInput && userIdInput.value);
    const nickname = String((nickInput && nickInput.value) || "").trim();
    const email = normalizeEmail(emailInput && emailInput.value);
    const pass = String((passInput && passInput.value) || "");

    if (!validUserId(userId)) {
      showNotice("Некорректный user-id. минимум 4 символа: латиница, цифры, ., _, -");
      return;
    }
    if (!nickname) {
      showNotice("Введи ник");
      return;
    }
    if (!email || !pass) {
      showNotice("Заполни почту и пароль");
      return;
    }

    const { data, error } = await state.supa.auth.signUp({
      email,
      password: pass,
      options: {
        data: {
          nickname,
          user_id: userId,
        },
        emailRedirectTo: getAuthRedirectUrl() || undefined,
      },
    });

    if (error) {
      showNotice(`Ошибка регистрации: ${briefError(error)}`);
      return;
    }

    const user = data && data.user ? data.user : null;
    const session = data && data.session ? data.session : null;

    if (user && session) {
      try {
        await ensureOwnProfile(user, { userId, nickname, strictUserId: true });
      } catch (profileError) {
        showNotice(`Регистрация создана, но профиль не заполнен: ${briefError(profileError)}`);
      }
    }

    if (session && user) {
      await setSignedInUI(user, { userId, nickname, strictUserId: true });
      showNotice("Успешная регистрация", {
        actionLabel: "Перейти к сайту",
        closeLabel: "Остаться",
        onAction: () => {
          window.location.href = "index.html";
        },
      });
      return;
    }

    state.lastRegisterEmail = email;
    showNotice("Аккаунт создан. Подтверди почту и войди в аккаунт.", {
      actionLabel: "Отправить повторно",
      closeLabel: "Закрыть",
      onAction: async () => {
        try {
          await resendSignupEmail(state.lastRegisterEmail);
          showNotice("Письмо отправлено повторно. Проверь почту.");
        } catch (resendError) {
          showNotice(`Не удалось отправить письмо: ${briefError(resendError)}`);
        }
      },
    });
  }

  async function onLoginSubmit(e) {
    e.preventDefault();
    if (!state.supa) return;

    const loginInput = document.getElementById("loginName");
    const passInput = document.getElementById("loginPass");

    const email = normalizeEmail(loginInput && loginInput.value);
    const pass = String((passInput && passInput.value) || "");

    if (!email || !pass) {
      showNotice("Введи почту и пароль");
      return;
    }

    const { data, error } = await state.supa.auth.signInWithPassword({ email, password: pass });
    if (error) {
      showNotice(`Ошибка входа: ${briefError(error)}`);
      return;
    }

    if (data && data.user) {
      await setSignedInUI(data.user);
    }
  }

  async function onProfileSubmit(e) {
    e.preventDefault();
    if (!state.user || !state.supa) return;

    const nickname = String((el.profileNick && el.profileNick.value) || "").trim();
    const userId = normalizeUserId((el.profileUserId && el.profileUserId.value) || "");
    const bio = String((el.profileBio && el.profileBio.value) || "").trim().slice(0, 280);

    if (!nickname) {
      showNotice("Ник обязателен");
      return;
    }
    if (!validUserId(userId)) {
      showNotice("Некорректный user-id");
      return;
    }

    const payload = {
      nickname,
      user_id: userId,
      bio,
      avatar_url: typeof state.avatarDraft === "string"
        ? state.avatarDraft
        : String((state.profile && state.profile.avatar_url) || "") || null,
    };

    const { data, error } = await state.supa
      .from(PROFILE_TABLE)
      .update(payload)
      .eq("id", state.user.id)
      .select("id,user_id,nickname,bio,avatar_url,is_admin")
      .single();

    if (error) {
      if (looksLikeSchemaError(error)) {
        schemaMissingNotice();
      } else {
        showNotice(`Ошибка профиля: ${briefError(error)}`);
      }
      return;
    }

    state.profile = data;
    state.avatarDraft = null;
    setLegacyCurrentUser(state.user, state.profile);
    applyProfileToUI(state.user, state.profile);
    await syncAuthMetadata(state.profile);
    showNotice("Профиль сохранен");
  }

  async function onEmailChangeSubmit(e) {
    e.preventDefault();
    if (!state.user || !state.supa) return;

    const passInput = document.getElementById("emailCurrentPass");
    const nextInput = document.getElementById("emailNewValue");

    const currentPass = String((passInput && passInput.value) || "");
    const nextEmail = normalizeEmail(nextInput && nextInput.value);

    if (!nextEmail) {
      showNotice("Введи новую почту");
      return;
    }
    if (nextEmail === normalizeEmail(state.user.email || "")) {
      showNotice("Это уже текущая почта");
      return;
    }

    try {
      await verifyCurrentPassword(currentPass);
    } catch (error) {
      showNotice(briefError(error));
      return;
    }

    const emailRedirectTo = getAuthRedirectUrl();
    const { error } = await state.supa.auth.updateUser(
      { email: nextEmail },
      emailRedirectTo ? { emailRedirectTo } : undefined
    );
    if (error) {
      showNotice(`Ошибка смены почты: ${briefError(error)}`);
      return;
    }

    if (el.emailChangeForm) el.emailChangeForm.reset();
    showNotice("Проверь новую почту: Supabase отправил письмо для подтверждения.");
  }

  async function onPasswordChangeSubmit(e) {
    e.preventDefault();
    if (!state.user || !state.supa) return;

    const oldPassInput = document.getElementById("passwordCurrentPass");
    const nextPassInput = document.getElementById("passwordNewValue");
    const repeatPassInput = document.getElementById("passwordRepeatValue");

    const oldPass = String((oldPassInput && oldPassInput.value) || "");
    const nextPass = String((nextPassInput && nextPassInput.value) || "");
    const repeatPass = String((repeatPassInput && repeatPassInput.value) || "");

    if (nextPass.length < 6) {
      showNotice("Новый пароль слишком короткий");
      return;
    }
    if (nextPass !== repeatPass) {
      showNotice("Повтор нового пароля не совпадает");
      return;
    }

    try {
      await verifyCurrentPassword(oldPass);
    } catch (error) {
      showNotice(briefError(error));
      return;
    }

    const { error } = await state.supa.auth.updateUser({ password: nextPass });
    if (error) {
      showNotice(`Ошибка смены пароля: ${briefError(error)}`);
      return;
    }

    if (el.passwordChangeForm) el.passwordChangeForm.reset();
    showNotice("Пароль обновлен");
  }

  async function onAddFriendSubmit(e) {
    e.preventDefault();
    if (!state.user || !state.supa) return;

    const input = document.getElementById("addFriendUserId");
    const targetUserId = normalizeUserId(input && input.value);

    if (!validUserId(targetUserId)) {
      showNotice("Введи корректный user-id");
      return;
    }

    const { error } = await state.supa.rpc("ik_send_friend_request", {
      target_user_id: targetUserId,
    });

    if (error) {
      if (looksLikeSchemaError(error)) {
        schemaMissingNotice();
      } else {
        showNotice(`Ошибка приглашения: ${briefError(error)}`);
      }
      return;
    }

    if (el.addFriendForm) el.addFriendForm.reset();
    await refreshFriendsData(true);
    showNotice("Приглашение отправлено");
  }

  async function respondToFriendRequest(requestId, accept) {
    if (!state.user || !state.supa) return;
    const id = Number(requestId || 0);
    if (!id) return;

    const { error } = await state.supa.rpc("ik_respond_friend_request", {
      p_request_id: id,
      p_accept: !!accept,
    });

    if (error) {
      if (looksLikeSchemaError(error)) {
        schemaMissingNotice();
      } else {
        showNotice(`Ошибка ответа: ${briefError(error)}`);
      }
      return;
    }

    await refreshFriendsData(true);
  }

  async function onLogoutClick() {
    if (!state.supa) return;
    const { error } = await state.supa.auth.signOut();
    if (error) {
      showNotice(`Ошибка выхода: ${briefError(error)}`);
      return;
    }
    setSignedOutUI();
  }

  function bindEvents() {
    setupAuthTabs();
    setupWorkspaceTabs();

    if (el.registerForm) el.registerForm.addEventListener("submit", onRegisterSubmit);
    if (el.loginForm) el.loginForm.addEventListener("submit", onLoginSubmit);
    if (el.profileForm) el.profileForm.addEventListener("submit", onProfileSubmit);
    if (el.emailChangeForm) el.emailChangeForm.addEventListener("submit", onEmailChangeSubmit);
    if (el.passwordChangeForm) el.passwordChangeForm.addEventListener("submit", onPasswordChangeSubmit);
    if (el.addFriendForm) el.addFriendForm.addEventListener("submit", onAddFriendSubmit);
    if (el.logoutBtn) el.logoutBtn.addEventListener("click", onLogoutClick);
    if (el.profileAvatarInput) el.profileAvatarInput.addEventListener("change", handleAvatarPick);

    if (el.constructorToggle && el.constructorPanel) {
      el.constructorToggle.addEventListener("click", () => {
        el.constructorPanel.classList.toggle("hidden");
      });
    }

    if (el.friendsRefreshBtn) {
      el.friendsRefreshBtn.addEventListener("click", () => {
        refreshFriendsData(true).catch(() => {});
      });
    }

    if (el.incomingRequestsList) {
      el.incomingRequestsList.addEventListener("click", (event) => {
        const button = event.target && event.target.closest ? event.target.closest("button[data-request-action]") : null;
        if (!button) return;
        const action = button.getAttribute("data-request-action");
        const requestId = button.getAttribute("data-request-id");
        respondToFriendRequest(requestId, action === "accept").catch(() => {});
      });
    }
  }

  async function init() {
    bindEvents();
    state.activeView = getRequestedView();

    if (!(window.IKSupabase && typeof window.IKSupabase.getClient === "function")) {
      showNotice("Ошибка инициализации Supabase");
      return;
    }

    state.supa = window.IKSupabase.getClient();
    if (!state.supa) {
      showNotice("Ошибка инициализации Supabase");
      return;
    }

    const { data: sessionData } = await state.supa.auth.getSession();
    await setSignedInUI(sessionData && sessionData.session ? sessionData.session.user : null);

    state.supa.auth.onAuthStateChange((_evt, session) => {
      const user = session ? session.user : null;
      setSignedInUI(user).catch((error) => {
        showNotice(`Ошибка сессии: ${briefError(error)}`);
      });
    });
  }

  init().catch((error) => {
    console.error(error);
    showNotice(`Ошибка инициализации: ${briefError(error)}`);
  });
})();
