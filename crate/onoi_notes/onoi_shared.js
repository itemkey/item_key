const SCOPE_KEY = 'onoi_notes_scope_v1';
const CHAT_PREFS_KEY = 'onoi_notes_shared_chat_prefs_v1';

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function briefError(error) {
  return String((error && (error.message || error.details || error.hint || error.code)) || error || 'unknown error');
}

class OnoiSharedApp {
  constructor() {
    this.client = null;
    this.user = null;
    this.channel = null;

    this.state = {
      scope: 'personal',
      categories: [],
      sections: [],
      messages: [],
      friends: [],
      activeCategoryId: null,
      activeSectionId: null,
      activeRole: '',
      busy: false
    };

    this.els = {
      scopeSwitch: document.getElementById('notesScopeSwitch'),
      nShell: document.querySelector('.n-shell'),
      mobileDock: document.querySelector('.mobile-dock'),
      searchInput: document.getElementById('searchInput'),
      sharedWrap: document.getElementById('sharedWrap'),
      sharedCategoryList: document.getElementById('sharedCategoryList'),
      sharedSectionList: document.getElementById('sharedSectionList'),
      sharedMessageList: document.getElementById('sharedMessageList'),
      sharedCategoryMeta: document.getElementById('sharedCategoryMeta'),
      sharedSectionMeta: document.getElementById('sharedSectionMeta'),
      sharedCreateCategoryBtn: document.getElementById('sharedCreateCategoryBtn'),
      sharedInviteBtn: document.getElementById('sharedInviteBtn'),
      sharedCreateSectionBtn: document.getElementById('sharedCreateSectionBtn'),
      sharedComposer: document.getElementById('sharedComposer'),
      sharedSendBtn: document.getElementById('sharedSendBtn'),
      sharedFontSelect: document.getElementById('sharedFontSelect'),
      sharedFontSizeSelect: document.getElementById('sharedFontSizeSelect')
    };
  }

  async init() {
    this.bindScopeSwitch();
    this.bindSharedActions();
    this.applyChatPrefs();

    try {
      if (!(window.IKSupabase && typeof window.IKSupabase.getClient === 'function')) return;
      this.client = window.IKSupabase.getClient();
      if (!this.client) return;

      const { data } = await this.client.auth.getUser();
      this.user = data && data.user ? data.user : null;
    } catch (_) {
      this.user = null;
    }

    const storedScope = this.getStoredScope();
    await this.setScope(storedScope, { force: true });
  }

  getStoredScope() {
    try {
      const s = localStorage.getItem(SCOPE_KEY);
      return s === 'shared' ? 'shared' : 'personal';
    } catch (_) {
      return 'personal';
    }
  }

  setStoredScope(scope) {
    try {
      localStorage.setItem(SCOPE_KEY, scope === 'shared' ? 'shared' : 'personal');
    } catch (_) {}
  }

  bindScopeSwitch() {
    const root = this.els.scopeSwitch;
    if (!root) return;
    root.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-scope]');
      if (!btn) return;
      const scope = String(btn.getAttribute('data-scope') || 'personal');
      void this.setScope(scope).catch(() => {});
    });
  }

  bindSharedActions() {
    const {
      sharedCreateCategoryBtn,
      sharedInviteBtn,
      sharedCreateSectionBtn,
      sharedSendBtn,
      sharedComposer,
      sharedFontSelect,
      sharedFontSizeSelect
    } = this.els;

    if (sharedCreateCategoryBtn) {
      sharedCreateCategoryBtn.addEventListener('click', () => {
        void this.createCategory().catch((error) => this.showError(error));
      });
    }

    if (sharedInviteBtn) {
      sharedInviteBtn.addEventListener('click', () => {
        void this.inviteFriend().catch((error) => this.showError(error));
      });
    }

    if (sharedCreateSectionBtn) {
      sharedCreateSectionBtn.addEventListener('click', () => {
        void this.createSection().catch((error) => this.showError(error));
      });
    }

    if (sharedSendBtn) {
      sharedSendBtn.addEventListener('click', () => {
        void this.sendMessage().catch((error) => this.showError(error));
      });
    }

    if (sharedComposer) {
      sharedComposer.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          void this.sendMessage().catch((error) => this.showError(error));
        }
      });
    }

    if (sharedFontSelect) {
      sharedFontSelect.addEventListener('change', () => {
        this.applyChatPrefsFromInputs();
      });
    }

    if (sharedFontSizeSelect) {
      sharedFontSizeSelect.addEventListener('change', () => {
        this.applyChatPrefsFromInputs();
      });
    }
  }

  setScopeButtons(scope) {
    if (!this.els.scopeSwitch) return;
    this.els.scopeSwitch.querySelectorAll('[data-scope]').forEach((btn) => {
      const mode = String(btn.getAttribute('data-scope') || 'personal');
      const active = mode === scope;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  async setScope(scope, options = {}) {
    const next = scope === 'shared' ? 'shared' : 'personal';
    if (!options.force && next === this.state.scope) return;

    if (next === 'shared' && !this.user) {
      alert('Для общих заметок нужно войти в аккаунт.');
      this.state.scope = 'personal';
      this.setScopeButtons('personal');
      this.applyScopeUI();
      return;
    }

    this.state.scope = next;
    this.setStoredScope(next);
    this.setScopeButtons(next);
    this.applyScopeUI();

    if (next === 'shared') {
      await this.loadCategories();
      await this.loadFriends();
    } else {
      await this.unsubscribeSection();
    }
  }

  applyScopeUI() {
    const shared = this.state.scope === 'shared';
    if (this.els.nShell) this.els.nShell.hidden = shared;
    if (this.els.mobileDock) this.els.mobileDock.hidden = shared;
    if (this.els.sharedWrap) this.els.sharedWrap.hidden = !shared;
    if (this.els.searchInput) {
      this.els.searchInput.disabled = shared;
      this.els.searchInput.placeholder = shared ? 'Поиск в личных заметках отключен в режиме общих.' : 'Поиск по заметкам…';
    }
  }

  async rpc(fn, args) {
    if (!this.client) throw new Error('supabase client missing');
    const { data, error } = await this.client.rpc(fn, args || {});
    if (error) throw error;
    return data;
  }

  async loadCategories() {
    const data = await this.rpc('ik_onoi_shared_list_categories');
    this.state.categories = Array.isArray(data) ? data : [];

    if (!this.state.categories.length) {
      this.state.activeCategoryId = null;
      this.state.sections = [];
      this.state.activeSectionId = null;
      this.state.messages = [];
      this.state.activeRole = '';
      this.renderCategories();
      this.renderSections();
      this.renderMessages();
      return;
    }

    if (!this.state.categories.some((x) => String(x.id) === String(this.state.activeCategoryId || ''))) {
      this.state.activeCategoryId = this.state.categories[0].id;
    }

    const active = this.state.categories.find((x) => String(x.id) === String(this.state.activeCategoryId));
    this.state.activeRole = String((active && active.my_role) || 'viewer');

    this.renderCategories();
    await this.loadSections();
  }

  async loadSections() {
    if (!this.state.activeCategoryId) {
      this.state.sections = [];
      this.state.activeSectionId = null;
      this.state.messages = [];
      this.renderSections();
      this.renderMessages();
      return;
    }

    const data = await this.rpc('ik_onoi_shared_list_sections', { p_category_id: this.state.activeCategoryId });
    this.state.sections = Array.isArray(data) ? data : [];

    if (!this.state.sections.some((x) => String(x.id) === String(this.state.activeSectionId || ''))) {
      this.state.activeSectionId = this.state.sections[0] ? this.state.sections[0].id : null;
    }

    this.renderSections();
    await this.loadMessages();
  }

  async loadMessages(options = {}) {
    if (!this.state.activeSectionId) {
      this.state.messages = [];
      this.renderMessages();
      await this.unsubscribeSection();
      return;
    }

    const data = await this.rpc('ik_onoi_shared_get_messages', {
      p_section_id: this.state.activeSectionId,
      p_limit: 300
    });
    this.state.messages = (Array.isArray(data) ? data : []).slice().sort((a, b) => {
      const at = Date.parse(String(a.created_at || '')) || 0;
      const bt = Date.parse(String(b.created_at || '')) || 0;
      return at - bt;
    });

    this.renderMessages(options.keepScroll ? false : true);
    await this.subscribeSection(this.state.activeSectionId);
  }

  async subscribeSection(sectionId) {
    await this.unsubscribeSection();
    if (!this.client || !sectionId) return;

    const channel = this.client.channel(`onoi-shared-${sectionId}`);
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'sh_onoi_shared_messages',
        filter: `section_id=eq.${sectionId}`
      },
      () => {
        void this.loadMessages({ keepScroll: true }).catch(() => {});
      }
    );
    channel.subscribe();
    this.channel = channel;
  }

  async unsubscribeSection() {
    if (!this.client || !this.channel) return;
    try {
      await this.client.removeChannel(this.channel);
    } catch (_) {}
    this.channel = null;
  }

  canEditShared() {
    return this.state.activeRole === 'owner' || this.state.activeRole === 'editor';
  }

  renderCategories() {
    const el = this.els.sharedCategoryList;
    if (!el) return;

    const rows = this.state.categories;
    if (!rows.length) {
      el.innerHTML = '<div class="shared-empty">Нет общих категорий. Создай первую.</div>';
      if (this.els.sharedCategoryMeta) this.els.sharedCategoryMeta.textContent = 'У тебя пока нет общих категорий.';
      return;
    }

    el.innerHTML = rows.map((cat) => {
      const active = String(cat.id) === String(this.state.activeCategoryId || '');
      const role = String(cat.my_role || 'viewer');
      return `
        <div class="shared-item${active ? ' is-active' : ''}" data-cat-id="${escapeHtml(cat.id)}">
          <div>${escapeHtml(cat.name || 'category')}</div>
          <div class="shared-item__meta">role: ${escapeHtml(role)} | members: ${Number(cat.member_count || 0)}</div>
        </div>
      `;
    }).join('');

    el.querySelectorAll('[data-cat-id]').forEach((node) => {
      node.addEventListener('click', () => {
        this.state.activeCategoryId = node.getAttribute('data-cat-id');
        const active = this.state.categories.find((x) => String(x.id) === String(this.state.activeCategoryId));
        this.state.activeRole = String((active && active.my_role) || 'viewer');
        this.renderCategories();
        void this.loadSections().catch((error) => this.showError(error));
      });
    });

    const active = this.state.categories.find((x) => String(x.id) === String(this.state.activeCategoryId));
    if (this.els.sharedCategoryMeta) {
      this.els.sharedCategoryMeta.textContent = active
        ? `Категория: ${active.name} | твоя роль: ${active.my_role}`
        : 'Выбери категорию.';
    }

    if (this.els.sharedInviteBtn) {
      this.els.sharedInviteBtn.disabled = !active || String(active.my_role) !== 'owner';
    }
    if (this.els.sharedCreateSectionBtn) {
      this.els.sharedCreateSectionBtn.disabled = !active || !this.canEditShared();
    }
  }

  renderSections() {
    const el = this.els.sharedSectionList;
    if (!el) return;

    const rows = this.state.sections;
    if (!rows.length) {
      el.innerHTML = '<div class="shared-empty">Нет разделов. Создай раздел для переписки.</div>';
      if (this.els.sharedSectionMeta) this.els.sharedSectionMeta.textContent = 'Разделы внутри выбранной категории.';
      return;
    }

    el.innerHTML = rows.map((section) => {
      const active = String(section.id) === String(this.state.activeSectionId || '');
      return `
        <div class="shared-item${active ? ' is-active' : ''}" data-section-id="${escapeHtml(section.id)}">
          <div>${escapeHtml(section.name || 'section')}</div>
          <div class="shared-item__meta">updated: ${escapeHtml(this.fmtTime(section.updated_at))}</div>
        </div>
      `;
    }).join('');

    el.querySelectorAll('[data-section-id]').forEach((node) => {
      node.addEventListener('click', () => {
        this.state.activeSectionId = node.getAttribute('data-section-id');
        this.renderSections();
        void this.loadMessages().catch((error) => this.showError(error));
      });
    });

    const active = this.state.sections.find((x) => String(x.id) === String(this.state.activeSectionId));
    if (this.els.sharedSectionMeta) {
      this.els.sharedSectionMeta.textContent = active
        ? `Раздел: ${active.name}`
        : 'Выбери раздел.';
    }
  }

  renderMessages(scrollBottom = false) {
    const el = this.els.sharedMessageList;
    if (!el) return;

    const canEdit = this.canEditShared();
    const rows = this.state.messages;
    if (!rows.length) {
      el.innerHTML = '<div class="shared-empty">Пока нет сообщений.</div>';
      return;
    }

    el.innerHTML = rows.map((msg) => {
      const author = String(msg.author_nickname || msg.author_user_id || 'user').trim();
      const edited = msg.edited_at ? ' · edited' : '';
      return `
        <article class="shared-msg" data-msg-id="${escapeHtml(msg.id)}">
          <div class="shared-msg__head">
            <span>@${escapeHtml(author)}</span>
            <span>${escapeHtml(this.fmtTime(msg.created_at))}${edited}</span>
          </div>
          <div class="shared-msg__body">${escapeHtml(msg.body || '')}</div>
          ${canEdit ? '<div class="shared-msg__actions"><button class="n-btn" type="button" data-act="edit">Изменить</button><button class="n-btn" type="button" data-act="del">Удалить</button></div>' : ''}
        </article>
      `;
    }).join('');

    if (canEdit) {
      el.querySelectorAll('[data-act="edit"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const root = btn.closest('[data-msg-id]');
          if (!root) return;
          const msgId = root.getAttribute('data-msg-id');
          void this.editMessage(msgId).catch((error) => this.showError(error));
        });
      });
      el.querySelectorAll('[data-act="del"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const root = btn.closest('[data-msg-id]');
          if (!root) return;
          const msgId = root.getAttribute('data-msg-id');
          void this.deleteMessage(msgId).catch((error) => this.showError(error));
        });
      });
    }

    if (scrollBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }

  fmtTime(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '-';
    const z = (n) => String(n).padStart(2, '0');
    return `${z(d.getDate())}.${z(d.getMonth() + 1)}.${d.getFullYear()} ${z(d.getHours())}:${z(d.getMinutes())}`;
  }

  async createCategory() {
    const raw = prompt('Название общей категории:');
    const name = String(raw || '').trim();
    if (!name) return;
    await this.rpc('ik_onoi_shared_create_category', { p_name: name });
    await this.loadCategories();
  }

  async inviteFriend() {
    if (!this.state.activeCategoryId) {
      alert('Сначала выбери категорию.');
      return;
    }
    if (this.state.activeRole !== 'owner') {
      alert('Приглашать друзей может только владелец категории.');
      return;
    }

    await this.loadFriends();
    if (!this.state.friends.length) {
      alert('Список друзей пуст. Добавь друзей в модуле аккаунта.');
      return;
    }

    const friendHints = this.state.friends.map((f) => f.user_id).slice(0, 10).join(', ');
    const target = prompt(`User-id друга (${friendHints}):`);
    const userId = String(target || '').trim();
    if (!userId) return;

    const roleRaw = prompt('Роль (editor/viewer). Enter = editor', 'editor');
    const role = String(roleRaw || 'editor').trim().toLowerCase() === 'viewer' ? 'viewer' : 'editor';

    await this.rpc('ik_onoi_shared_add_friend', {
      p_category_id: this.state.activeCategoryId,
      p_target_user_id: userId,
      p_role: role
    });
    alert('Друг добавлен в категорию.');
    await this.loadCategories();
  }

  async createSection() {
    if (!this.state.activeCategoryId) {
      alert('Сначала выбери категорию.');
      return;
    }
    if (!this.canEditShared()) {
      alert('Только owner/editor может создавать разделы.');
      return;
    }
    const raw = prompt('Название раздела:');
    const name = String(raw || '').trim();
    if (!name) return;

    await this.rpc('ik_onoi_shared_create_section', {
      p_category_id: this.state.activeCategoryId,
      p_name: name
    });
    await this.loadSections();
  }

  async sendMessage() {
    if (!this.state.activeSectionId) {
      alert('Сначала выбери раздел.');
      return;
    }
    if (!this.canEditShared()) {
      alert('Только owner/editor может отправлять сообщения.');
      return;
    }

    const body = String((this.els.sharedComposer && this.els.sharedComposer.value) || '').trim();
    if (!body) return;

    await this.rpc('ik_onoi_shared_send_message', {
      p_section_id: this.state.activeSectionId,
      p_body: body
    });

    if (this.els.sharedComposer) this.els.sharedComposer.value = '';
    await this.loadMessages({ keepScroll: true });
    this.renderMessages(true);
  }

  async editMessage(messageId) {
    if (!messageId || !this.canEditShared()) return;
    const current = this.state.messages.find((m) => String(m.id) === String(messageId));
    const raw = prompt('Изменить сообщение:', current ? current.body || '' : '');
    if (raw === null) return;
    const nextBody = String(raw || '').trim();
    if (!nextBody) return;
    await this.rpc('ik_onoi_shared_edit_message', {
      p_message_id: messageId,
      p_body: nextBody
    });
    await this.loadMessages({ keepScroll: true });
  }

  async deleteMessage(messageId) {
    if (!messageId || !this.canEditShared()) return;
    if (!confirm('Удалить сообщение без восстановления?')) return;
    await this.rpc('ik_onoi_shared_delete_message', {
      p_message_id: messageId
    });
    await this.loadMessages({ keepScroll: true });
  }

  async loadFriends() {
    if (!this.client || !this.user) return;
    const uid = String(this.user.id || '');
    if (!uid) return;

    const { data: links, error: linksError } = await this.client
      .from('ik_friendships')
      .select('user_low,user_high')
      .or(`user_low.eq.${uid},user_high.eq.${uid}`);
    if (linksError) throw linksError;

    const friendIds = new Set();
    (Array.isArray(links) ? links : []).forEach((row) => {
      const low = String(row && row.user_low || '');
      const high = String(row && row.user_high || '');
      if (!low || !high) return;
      friendIds.add(low === uid ? high : low);
    });

    const ids = Array.from(friendIds);
    if (!ids.length) {
      this.state.friends = [];
      return;
    }

    const { data: profiles, error: profilesError } = await this.client
      .from('ik_user_profiles')
      .select('id,user_id,nickname')
      .in('id', ids);
    if (profilesError) throw profilesError;

    const byId = new Map();
    (Array.isArray(profiles) ? profiles : []).forEach((p) => {
      byId.set(String(p.id), p);
    });

    this.state.friends = ids.map((id) => {
      const p = byId.get(String(id)) || null;
      return {
        id,
        user_id: String((p && p.user_id) || '').trim(),
        nickname: String((p && p.nickname) || '').trim()
      };
    }).filter((x) => x.user_id);
  }

  applyChatPrefs() {
    let font = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
    let size = '14';
    try {
      const raw = localStorage.getItem(CHAT_PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.font) font = String(parsed.font);
        if (parsed && parsed.size) size = String(parsed.size);
      }
    } catch (_) {}

    if (this.els.sharedFontSelect) this.els.sharedFontSelect.value = font;
    if (this.els.sharedFontSizeSelect) this.els.sharedFontSizeSelect.value = size;
    this.applyChatStyles(font, size);
  }

  applyChatPrefsFromInputs() {
    const font = this.els.sharedFontSelect ? String(this.els.sharedFontSelect.value || '') : '';
    const size = this.els.sharedFontSizeSelect ? String(this.els.sharedFontSizeSelect.value || '14') : '14';
    this.applyChatStyles(font, size);
    try {
      localStorage.setItem(CHAT_PREFS_KEY, JSON.stringify({ font, size }));
    } catch (_) {}
  }

  applyChatStyles(font, size) {
    const f = String(font || 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif');
    const s = Math.max(12, Math.min(20, Number(size) || 14));
    if (this.els.sharedComposer) {
      this.els.sharedComposer.style.fontFamily = f;
      this.els.sharedComposer.style.fontSize = `${s}px`;
    }
    if (this.els.sharedMessageList) {
      this.els.sharedMessageList.style.fontFamily = f;
      this.els.sharedMessageList.style.fontSize = `${s}px`;
    }
  }

  showError(error) {
    alert(briefError(error));
  }
}

const app = new OnoiSharedApp();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void app.init();
  });
} else {
  void app.init();
}
