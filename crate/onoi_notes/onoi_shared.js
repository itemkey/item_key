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

function escapeAttr(str) {
  return escapeHtml(str).replaceAll('\n', ' ');
}

function briefError(error) {
  const txt = String((error && (error.message || error.details || error.hint || error.code || error)) || '').trim();
  return txt || 'unknown error';
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
      members: [],
      activeCategoryId: null,
      activeSectionId: null,
      activeRole: '',
      modalSubmit: null,
      modalMounted: null
    };

    this.els = {
      scopeSwitch: document.getElementById('notesScopeSwitch'),
      personalWrap: document.getElementById('personalWrap'),
      sharedWrap: document.getElementById('sharedWrap'),
      mobileDock: document.querySelector('.mobile-dock'),
      searchInput: document.getElementById('searchInput'),

      sharedCategoryList: document.getElementById('sharedCategoryList'),
      sharedSectionList: document.getElementById('sharedSectionList'),
      sharedMessageList: document.getElementById('sharedMessageList'),
      sharedCategoryMeta: document.getElementById('sharedCategoryMeta'),
      sharedSectionMeta: document.getElementById('sharedSectionMeta'),
      sharedCreateCategoryBtn: document.getElementById('sharedCreateCategoryBtn'),
      sharedDeleteCategoryBtn: document.getElementById('sharedDeleteCategoryBtn'),
      sharedInviteBtn: document.getElementById('sharedInviteBtn'),
      sharedCreateSectionBtn: document.getElementById('sharedCreateSectionBtn'),
      sharedDeleteSectionBtn: document.getElementById('sharedDeleteSectionBtn'),
      sharedComposer: document.getElementById('sharedComposer'),
      sharedSendBtn: document.getElementById('sharedSendBtn'),
      sharedFontSelect: document.getElementById('sharedFontSelect'),
      sharedFontSizeSelect: document.getElementById('sharedFontSizeSelect'),

      sharedModal: document.getElementById('sharedModal'),
      sharedModalTitle: document.getElementById('sharedModalTitle'),
      sharedModalBody: document.getElementById('sharedModalBody'),
      sharedModalClose: document.getElementById('sharedModalClose'),
      toastWrap: document.getElementById('toastWrap')
    };
  }

  async init() {
    this.bindScopeSwitch();
    this.bindSharedActions();
    this.bindModal();
    this.applyChatPrefs();

    try {
      if (window.IKSupabase && typeof window.IKSupabase.getClient === 'function') {
        this.client = window.IKSupabase.getClient();
      }
      if (this.client) {
        const { data } = await this.client.auth.getUser();
        this.user = data && data.user ? data.user : null;
      }
    } catch (_) {
      this.user = null;
    }

    await this.setScope(this.getStoredScope(), { force: true });
  }

  bindScopeSwitch() {
    if (!this.els.scopeSwitch) return;
    this.els.scopeSwitch.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-scope]');
      if (!btn) return;
      const scope = String(btn.getAttribute('data-scope') || 'personal');
      void this.setScope(scope).catch((error) => this.notifyError(error));
    });
  }

  bindSharedActions() {
    if (this.els.sharedCreateCategoryBtn) {
      this.els.sharedCreateCategoryBtn.addEventListener('click', () => {
        this.openCreateCategoryModal();
      });
    }

    if (this.els.sharedDeleteCategoryBtn) {
      this.els.sharedDeleteCategoryBtn.addEventListener('click', () => {
        this.openDeleteCategoryModal();
      });
    }

    if (this.els.sharedInviteBtn) {
      this.els.sharedInviteBtn.addEventListener('click', () => {
        void this.openInviteFriendModal().catch((error) => this.notifyError(error));
      });
    }

    if (this.els.sharedCreateSectionBtn) {
      this.els.sharedCreateSectionBtn.addEventListener('click', () => {
        this.openCreateSectionModal();
      });
    }

    if (this.els.sharedDeleteSectionBtn) {
      this.els.sharedDeleteSectionBtn.addEventListener('click', () => {
        this.openDeleteSectionModal();
      });
    }

    if (this.els.sharedSendBtn) {
      this.els.sharedSendBtn.addEventListener('click', () => {
        void this.sendMessage().catch((error) => this.notifyError(error));
      });
    }

    if (this.els.sharedComposer) {
      this.els.sharedComposer.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          void this.sendMessage().catch((error) => this.notifyError(error));
        }
      });
    }

    if (this.els.sharedFontSelect) {
      this.els.sharedFontSelect.addEventListener('change', () => {
        this.applyChatPrefsFromInputs();
      });
    }

    if (this.els.sharedFontSizeSelect) {
      this.els.sharedFontSizeSelect.addEventListener('change', () => {
        this.applyChatPrefsFromInputs();
      });
    }
  }

  bindModal() {
    const modal = this.els.sharedModal;
    if (!modal) return;
    if (this.els.sharedModalClose) {
      this.els.sharedModalClose.addEventListener('click', () => this.closeModal());
    }
    modal.addEventListener('click', (event) => {
      if (event.target === modal || event.target.closest('[data-close]')) {
        this.closeModal();
      }
    });
    modal.addEventListener('submit', (event) => {
      if (!(event.target instanceof HTMLFormElement)) return;
      event.preventDefault();
      if (typeof this.state.modalSubmit !== 'function') return;
      const data = Object.fromEntries(new FormData(event.target).entries());
      void Promise.resolve(this.state.modalSubmit(data, event.target))
        .catch((error) => this.notifyError(error));
    });
  }

  openModal({ title, bodyHtml, onSubmit, onMount }) {
    if (!this.els.sharedModal || !this.els.sharedModalTitle || !this.els.sharedModalBody) return;
    this.state.modalSubmit = typeof onSubmit === 'function' ? onSubmit : null;
    this.state.modalMounted = typeof onMount === 'function' ? onMount : null;
    this.els.sharedModalTitle.textContent = String(title || 'shared');
    this.els.sharedModalBody.innerHTML = String(bodyHtml || '');
    this.els.sharedModal.classList.add('is-open');
    document.body.classList.add('modal-open');
    if (this.state.modalMounted) {
      try {
        this.state.modalMounted(this.els.sharedModalBody);
      } catch (_) {}
    }
  }

  closeModal() {
    if (!this.els.sharedModal) return;
    this.els.sharedModal.classList.remove('is-open');
    document.body.classList.remove('modal-open');
    this.state.modalSubmit = null;
    this.state.modalMounted = null;
  }

  toast(title, body, ttl = 2800) {
    const wrap = this.els.toastWrap;
    if (!wrap) return;
    const card = document.createElement('div');
    card.className = 'toast';
    card.innerHTML = `<p class="toast-title">${escapeHtml(title || 'shared')}</p><p class="toast-body">${escapeHtml(body || '')}</p>`;
    wrap.appendChild(card);
    window.setTimeout(() => {
      try {
        card.remove();
      } catch (_) {}
    }, ttl);
  }

  notifyError(error) {
    this.toast('shared', briefError(error), 4200);
  }

  getStoredScope() {
    try {
      const v = localStorage.getItem(SCOPE_KEY);
      return v === 'shared' ? 'shared' : 'personal';
    } catch (_) {
      return 'personal';
    }
  }

  setStoredScope(scope) {
    try {
      localStorage.setItem(SCOPE_KEY, scope === 'shared' ? 'shared' : 'personal');
    } catch (_) {}
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
      this.toast('shared', 'Для режима общих заметок нужно войти в аккаунт.');
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
    if (this.els.personalWrap) this.els.personalWrap.hidden = shared;
    if (this.els.sharedWrap) this.els.sharedWrap.hidden = !shared;
    if (this.els.mobileDock) this.els.mobileDock.hidden = shared;
    if (this.els.searchInput) {
      this.els.searchInput.disabled = shared;
      this.els.searchInput.placeholder = shared ? 'Режим общих заметок: поиск личных отключен.' : 'Поиск по заметкам…';
    }
    document.body.classList.toggle('drawer-open', false);
  }

  async rpc(fn, args) {
    if (!this.client) throw new Error('supabase unavailable');
    const { data, error } = await this.client.rpc(fn, args || {});
    if (error) throw error;
    return data;
  }

  canEditShared() {
    return this.state.activeRole === 'owner' || this.state.activeRole === 'editor';
  }

  async loadCategories() {
    const data = await this.rpc('ik_onoi_shared_list_categories');
    this.state.categories = Array.isArray(data) ? data : [];

    if (!this.state.categories.length) {
      this.state.activeCategoryId = null;
      this.state.sections = [];
      this.state.activeSectionId = null;
      this.state.activeRole = '';
      this.state.messages = [];
      this.renderCategories();
      this.renderSections();
      this.renderMessages();
      return;
    }

    if (!this.state.categories.some((cat) => String(cat.id) === String(this.state.activeCategoryId || ''))) {
      this.state.activeCategoryId = this.state.categories[0].id;
    }
    const active = this.state.categories.find((cat) => String(cat.id) === String(this.state.activeCategoryId));
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
      await this.unsubscribeSection();
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
    this.renderMessages(!options.keepScroll);
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

  fmtTime(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '-';
    const z = (n) => String(n).padStart(2, '0');
    return `${z(d.getDate())}.${z(d.getMonth() + 1)}.${d.getFullYear()} ${z(d.getHours())}:${z(d.getMinutes())}`;
  }

  renderCategories() {
    const el = this.els.sharedCategoryList;
    if (!el) return;

    if (!this.state.categories.length) {
      el.innerHTML = '<div class="shared-empty">Нет общих категорий. Нажми "+ Категория".</div>';
      if (this.els.sharedCategoryMeta) this.els.sharedCategoryMeta.textContent = 'Общий раздел пуст.';
      if (this.els.sharedInviteBtn) this.els.sharedInviteBtn.disabled = true;
      if (this.els.sharedCreateSectionBtn) this.els.sharedCreateSectionBtn.disabled = true;
      if (this.els.sharedDeleteCategoryBtn) this.els.sharedDeleteCategoryBtn.disabled = true;
      if (this.els.sharedDeleteSectionBtn) this.els.sharedDeleteSectionBtn.disabled = true;
      return;
    }

    el.innerHTML = this.state.categories.map((cat) => {
      const active = String(cat.id) === String(this.state.activeCategoryId || '');
      return `
        <div class="shared-item${active ? ' is-active' : ''}" data-cat-id="${escapeAttr(cat.id)}">
          <div>${escapeHtml(cat.name || 'category')}</div>
          <div class="shared-item__meta">role: ${escapeHtml(String(cat.my_role || 'viewer'))} | members: ${Number(cat.member_count || 0)}</div>
        </div>
      `;
    }).join('');

    el.querySelectorAll('[data-cat-id]').forEach((node) => {
      node.addEventListener('click', () => {
        this.state.activeCategoryId = String(node.getAttribute('data-cat-id') || '');
        const active = this.state.categories.find((x) => String(x.id) === String(this.state.activeCategoryId));
        this.state.activeRole = String((active && active.my_role) || 'viewer');
        this.renderCategories();
        void this.loadSections().catch((error) => this.notifyError(error));
      });
    });

    const active = this.state.categories.find((x) => String(x.id) === String(this.state.activeCategoryId));
    if (this.els.sharedCategoryMeta) {
      this.els.sharedCategoryMeta.textContent = active
        ? `Категория: ${active.name} | роль: ${active.my_role}`
        : 'Выбери категорию.';
    }
    if (this.els.sharedInviteBtn) {
      this.els.sharedInviteBtn.disabled = !active || String(active.my_role) !== 'owner';
    }
    if (this.els.sharedDeleteCategoryBtn) {
      this.els.sharedDeleteCategoryBtn.disabled = !active || String(active.my_role) !== 'owner';
    }
    if (this.els.sharedCreateSectionBtn) {
      this.els.sharedCreateSectionBtn.disabled = !active || !this.canEditShared();
    }
  }

  renderSections() {
    const el = this.els.sharedSectionList;
    if (!el) return;
    if (!this.state.sections.length) {
      el.innerHTML = '<div class="shared-empty">Нет разделов. Создай первый раздел-чaт.</div>';
      if (this.els.sharedSectionMeta) this.els.sharedSectionMeta.textContent = 'Разделы внутри выбранной категории.';
      if (this.els.sharedDeleteSectionBtn) this.els.sharedDeleteSectionBtn.disabled = true;
      return;
    }

    el.innerHTML = this.state.sections.map((section) => {
      const active = String(section.id) === String(this.state.activeSectionId || '');
      return `
        <div class="shared-item${active ? ' is-active' : ''}" data-section-id="${escapeAttr(section.id)}">
          <div>${escapeHtml(section.name || 'section')}</div>
          <div class="shared-item__meta">updated: ${escapeHtml(this.fmtTime(section.updated_at))}</div>
        </div>
      `;
    }).join('');

    el.querySelectorAll('[data-section-id]').forEach((node) => {
      node.addEventListener('click', () => {
        this.state.activeSectionId = String(node.getAttribute('data-section-id') || '');
        this.renderSections();
        void this.loadMessages().catch((error) => this.notifyError(error));
      });
    });

    const active = this.state.sections.find((x) => String(x.id) === String(this.state.activeSectionId));
    if (this.els.sharedSectionMeta) {
      this.els.sharedSectionMeta.textContent = active ? `Раздел: ${active.name}` : 'Выбери раздел.';
    }
    if (this.els.sharedDeleteSectionBtn) {
      this.els.sharedDeleteSectionBtn.disabled = !active || !this.canEditShared();
    }
  }

  renderMessages(scrollBottom = false) {
    const el = this.els.sharedMessageList;
    if (!el) return;

    if (!this.state.messages.length) {
      el.innerHTML = '<div class="shared-empty">Пока нет сообщений.</div>';
      return;
    }

    const canEdit = this.canEditShared();
    el.innerHTML = this.state.messages.map((msg) => {
      const author = String(msg.author_nickname || msg.author_user_id || 'user').trim();
      const edited = msg.edited_at ? ' · edited' : '';
      return `
        <article class="shared-msg" data-msg-id="${escapeAttr(msg.id)}">
          <div class="shared-msg__head">
            <span>@${escapeHtml(author)}</span>
            <span>${escapeHtml(this.fmtTime(msg.created_at))}${edited}</span>
          </div>
          <div class="shared-msg__body">${escapeHtml(msg.body || '')}</div>
          ${canEdit ? '<div class="shared-msg__actions"><button class="n-btn" type="button" data-msg-edit>Изменить</button><button class="n-btn" type="button" data-msg-del>Удалить</button></div>' : ''}
        </article>
      `;
    }).join('');

    if (canEdit) {
      el.querySelectorAll('[data-msg-edit]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const row = btn.closest('[data-msg-id]');
          const messageId = row ? String(row.getAttribute('data-msg-id') || '') : '';
          if (!messageId) return;
          this.openEditMessageModal(messageId);
        });
      });
      el.querySelectorAll('[data-msg-del]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const row = btn.closest('[data-msg-id]');
          const messageId = row ? String(row.getAttribute('data-msg-id') || '') : '';
          if (!messageId) return;
          this.openDeleteMessageModal(messageId);
        });
      });
    }

    if (this.els.sharedComposer) this.els.sharedComposer.disabled = !canEdit || !this.state.activeSectionId;
    if (this.els.sharedSendBtn) this.els.sharedSendBtn.disabled = !canEdit || !this.state.activeSectionId;

    if (scrollBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }

  openCreateCategoryModal() {
    this.openModal({
      title: 'Новая общая категория',
      bodyHtml: `
        <form>
          <div class="shared-modal-field">
            <label>Название категории</label>
            <input class="dialog-input" name="name" maxlength="120" autocomplete="off" required />
          </div>
          <div class="modal-actions" style="grid-template-columns:1fr 1fr;">
            <button class="n-btn" type="button" data-close>Отмена</button>
            <button class="n-btn is-primary" type="submit">Создать</button>
          </div>
        </form>
      `,
      onSubmit: async (data) => {
        const name = String(data.name || '').trim();
        if (!name) return;
        await this.rpc('ik_onoi_shared_create_category', { p_name: name });
        this.closeModal();
        await this.loadCategories();
        this.toast('shared', 'Категория создана.');
      }
    });
  }

  openCreateSectionModal() {
    if (!this.state.activeCategoryId) {
      this.toast('shared', 'Сначала выбери категорию.');
      return;
    }
    if (!this.canEditShared()) {
      this.toast('shared', 'Создавать раздел может owner/editor.');
      return;
    }

    this.openModal({
      title: 'Новый раздел',
      bodyHtml: `
        <form>
          <div class="shared-modal-field">
            <label>Название раздела</label>
            <input class="dialog-input" name="name" maxlength="120" autocomplete="off" required />
          </div>
          <div class="modal-actions" style="grid-template-columns:1fr 1fr;">
            <button class="n-btn" type="button" data-close>Отмена</button>
            <button class="n-btn is-primary" type="submit">Создать</button>
          </div>
        </form>
      `,
      onSubmit: async (data) => {
        const name = String(data.name || '').trim();
        if (!name) return;
        await this.rpc('ik_onoi_shared_create_section', {
          p_category_id: this.state.activeCategoryId,
          p_name: name
        });
        this.closeModal();
        await this.loadSections();
        this.toast('shared', 'Раздел создан.');
      }
    });
  }

  openDeleteSectionModal() {
    if (!this.state.activeSectionId) {
      this.toast('shared', 'Сначала выбери раздел.');
      return;
    }
    if (!this.canEditShared()) {
      this.toast('shared', 'Удалять раздел может owner/editor.');
      return;
    }

    const active = this.state.sections.find((x) => String(x.id) === String(this.state.activeSectionId));
    this.openModal({
      title: 'Удалить раздел',
      bodyHtml: `
        <form>
          <div class="shared-empty">Удалить раздел ${escapeHtml(active ? active.name : '')} и все его сообщения?</div>
          <div class="modal-actions" style="grid-template-columns:1fr 1fr;">
            <button class="n-btn" type="button" data-close>Отмена</button>
            <button class="n-btn is-primary" type="submit">Удалить</button>
          </div>
        </form>
      `,
      onSubmit: async () => {
        await this.rpc('ik_onoi_shared_delete_section', {
          p_section_id: this.state.activeSectionId
        });
        this.closeModal();
        await this.loadSections();
        this.toast('shared', 'Раздел удален.');
      }
    });
  }

  openDeleteCategoryModal() {
    if (!this.state.activeCategoryId) {
      this.toast('shared', 'Сначала выбери категорию.');
      return;
    }
    if (this.state.activeRole !== 'owner') {
      this.toast('shared', 'Удалять категорию может только владелец.');
      return;
    }

    const active = this.state.categories.find((x) => String(x.id) === String(this.state.activeCategoryId));
    this.openModal({
      title: 'Удалить категорию',
      bodyHtml: `
        <form>
          <div class="shared-empty">Удалить категорию ${escapeHtml(active ? active.name : '')} вместе со всеми разделами и сообщениями?</div>
          <div class="modal-actions" style="grid-template-columns:1fr 1fr;">
            <button class="n-btn" type="button" data-close>Отмена</button>
            <button class="n-btn is-primary" type="submit">Удалить</button>
          </div>
        </form>
      `,
      onSubmit: async () => {
        await this.rpc('ik_onoi_shared_delete_category', {
          p_category_id: this.state.activeCategoryId
        });
        this.closeModal();
        await this.loadCategories();
        this.toast('shared', 'Категория удалена.');
      }
    });
  }

  async openInviteFriendModal() {
    if (!this.state.activeCategoryId) {
      this.toast('shared', 'Сначала выбери категорию.');
      return;
    }
    if (this.state.activeRole !== 'owner') {
      this.toast('shared', 'Приглашать друзей может только владелец категории.');
      return;
    }

    await this.loadFriends();
    await this.loadMembers();

    const friendOptions = this.state.friends.map((f) => {
      const label = f.nickname && f.nickname.toLowerCase() !== f.user_id.toLowerCase()
        ? `${f.nickname} (@${f.user_id})`
        : `@${f.user_id}`;
      return `<option value="${escapeAttr(f.user_id)}">${escapeHtml(label)}</option>`;
    }).join('');

    const memberRows = this.state.members.map((m) => {
      const handle = String(m.profile_user_id || m.user_id || '').trim() || 'user';
      const label = m.nickname && String(m.nickname).toLowerCase() !== handle.toLowerCase()
        ? `${m.nickname} (@${handle})`
        : `@${handle}`;
      return `<div class="shared-modal-row"><div>${escapeHtml(label)}<div class="shared-modal-sub">role: ${escapeHtml(m.role)}</div></div></div>`;
    }).join('');

    this.openModal({
      title: 'Добавить друга в категорию',
      bodyHtml: `
        <form>
          <div class="shared-modal-field">
            <label>Друг из списка</label>
            <select class="toolsel" name="friend_user_id" data-friend-pick>
              <option value="">${this.state.friends.length ? 'Выбери друга' : 'Список друзей пуст'}</option>
              ${friendOptions}
            </select>
          </div>

          <div class="shared-modal-field">
            <label>Или user-id друга</label>
            <input class="dialog-input" name="target_user_id" maxlength="32" autocomplete="off" data-friend-user-id />
          </div>

          <div class="shared-modal-field">
            <label>Роль</label>
            <select class="toolsel" name="role">
              <option value="editor">editor</option>
              <option value="viewer">viewer</option>
            </select>
          </div>

          <div class="modal-actions" style="grid-template-columns:1fr 1fr;">
            <button class="n-btn" type="button" data-close>Отмена</button>
            <button class="n-btn is-primary" type="submit">Добавить</button>
          </div>
        </form>

        <div class="n-label" style="margin-top:8px;">participants</div>
        <div class="shared-modal-list">
          ${memberRows || '<div class="shared-empty">Участников пока нет.</div>'}
        </div>
      `,
      onSubmit: async (data) => {
        const targetFromPick = String(data.friend_user_id || '').trim().toLowerCase();
        const targetFromInput = String(data.target_user_id || '').trim().toLowerCase();
        const target = targetFromInput || targetFromPick;
        if (!target) {
          this.toast('shared', 'Выбери друга из списка или введи user-id.');
          return;
        }
        const role = String(data.role || 'editor').trim().toLowerCase() === 'viewer' ? 'viewer' : 'editor';
        await this.rpc('ik_onoi_shared_add_friend', {
          p_category_id: this.state.activeCategoryId,
          p_target_user_id: target,
          p_role: role
        });
        this.closeModal();
        await this.loadCategories();
        this.toast('shared', 'Друг добавлен в категорию.');
      },
      onMount: (bodyEl) => {
        const pick = bodyEl.querySelector('[data-friend-pick]');
        const input = bodyEl.querySelector('[data-friend-user-id]');
        if (pick && input) {
          pick.addEventListener('change', () => {
            const v = String(pick.value || '').trim();
            if (v) input.value = v;
          });
        }
      }
    });
  }

  openEditMessageModal(messageId) {
    const msg = this.state.messages.find((x) => String(x.id) === String(messageId));
    if (!msg) return;

    this.openModal({
      title: 'Редактировать сообщение',
      bodyHtml: `
        <form>
          <div class="shared-modal-field">
            <label>Сообщение</label>
            <textarea class="dialog-input" name="body" rows="6" maxlength="4000" required>${escapeHtml(msg.body || '')}</textarea>
          </div>
          <div class="modal-actions" style="grid-template-columns:1fr 1fr;">
            <button class="n-btn" type="button" data-close>Отмена</button>
            <button class="n-btn is-primary" type="submit">Сохранить</button>
          </div>
        </form>
      `,
      onSubmit: async (data) => {
        const body = String(data.body || '').trim();
        if (!body) {
          this.toast('shared', 'Сообщение не может быть пустым.');
          return;
        }
        await this.rpc('ik_onoi_shared_edit_message', {
          p_message_id: messageId,
          p_body: body
        });
        this.closeModal();
        await this.loadMessages({ keepScroll: true });
        this.toast('shared', 'Сообщение обновлено.');
      }
    });
  }

  openDeleteMessageModal(messageId) {
    this.openModal({
      title: 'Удалить сообщение',
      bodyHtml: `
        <form>
          <div class="shared-empty">Удалить сообщение без восстановления?</div>
          <div class="modal-actions" style="grid-template-columns:1fr 1fr;">
            <button class="n-btn" type="button" data-close>Отмена</button>
            <button class="n-btn is-primary" type="submit">Удалить</button>
          </div>
        </form>
      `,
      onSubmit: async () => {
        await this.rpc('ik_onoi_shared_delete_message', { p_message_id: messageId });
        this.closeModal();
        await this.loadMessages({ keepScroll: true });
        this.toast('shared', 'Сообщение удалено.');
      }
    });
  }

  async sendMessage() {
    if (!this.state.activeSectionId) {
      this.toast('shared', 'Сначала выбери раздел.');
      return;
    }
    if (!this.canEditShared()) {
      this.toast('shared', 'Отправлять сообщения может owner/editor.');
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

  async loadFriends() {
    if (!this.client || !this.user) return;
    const uid = String(this.user.id || '');
    if (!uid) return;

    const { data: links, error: linksError } = await this.client
      .from('ik_friendships')
      .select('user_low,user_high')
      .or(`user_low.eq.${uid},user_high.eq.${uid}`);
    if (linksError) throw linksError;

    const ids = new Set();
    (Array.isArray(links) ? links : []).forEach((row) => {
      const low = String(row && row.user_low || '');
      const high = String(row && row.user_high || '');
      if (!low || !high) return;
      ids.add(low === uid ? high : low);
    });

    const friendIds = Array.from(ids);
    if (!friendIds.length) {
      this.state.friends = [];
      return;
    }

    const { data: profiles, error: profilesError } = await this.client
      .from('ik_user_profiles')
      .select('id,user_id,nickname')
      .in('id', friendIds);
    if (profilesError) throw profilesError;

    const byId = new Map();
    (Array.isArray(profiles) ? profiles : []).forEach((p) => {
      byId.set(String(p.id), p);
    });

    this.state.friends = friendIds.map((id) => {
      const p = byId.get(String(id)) || null;
      return {
        id,
        user_id: String((p && p.user_id) || '').trim(),
        nickname: String((p && p.nickname) || '').trim()
      };
    }).filter((f) => f.user_id).sort((a, b) => {
      const al = `${a.nickname} ${a.user_id}`.trim().toLowerCase();
      const bl = `${b.nickname} ${b.user_id}`.trim().toLowerCase();
      return al.localeCompare(bl);
    });
  }

  async loadMembers() {
    if (!this.state.activeCategoryId) {
      this.state.members = [];
      return;
    }
    try {
      const data = await this.rpc('ik_onoi_shared_list_members', {
        p_category_id: this.state.activeCategoryId
      });
      this.state.members = Array.isArray(data) ? data : [];
    } catch (_) {
      this.state.members = [];
    }
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
    const safeFont = String(font || 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif');
    const safeSize = Math.max(12, Math.min(20, Number(size) || 14));
    if (this.els.sharedComposer) {
      this.els.sharedComposer.style.fontFamily = safeFont;
      this.els.sharedComposer.style.fontSize = `${safeSize}px`;
    }
    if (this.els.sharedMessageList) {
      this.els.sharedMessageList.style.fontFamily = safeFont;
      this.els.sharedMessageList.style.fontSize = `${safeSize}px`;
    }
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
