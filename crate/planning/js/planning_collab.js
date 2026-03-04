const UI_PREFS_KEY = 'itemkey_planning_ui_v2';
const ACTIVE_PROJECT_KEY = 'itemkey_planning_active_project_v2';
const INCOMING_REFRESH_MS = 15000;
const BOARD_RELOAD_DEBOUNCE_MS = 120;
const EDITING_TTL_MS = 30000;
const EDITING_PING_MS = 10000;
const PROJECTS_RETRY_MS = 6000;

const PROJECT_SCOPES = ['personal', 'shared', 'all'];
const ASSIGNEE_FILTERS = ['all', 'me', 'unassigned'];

const PRIORITIES = [
  { key: 'low', label: 'LOW' },
  { key: 'mid', label: 'MID' },
  { key: 'high', label: 'HIGH' }
];

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

function uid() {
  if (globalThis.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseTags(raw) {
  return String(raw ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function parseFilterTags(raw) {
  return String(raw ?? '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
}

function parseISOToLocalDate(iso) {
  const s = String(iso ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatLocalISO(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function addDaysLocal(date, days) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

function toPositionNumber(v) {
  const n = Number.parseFloat(String(v ?? '0'));
  return Number.isFinite(n) ? n : 0;
}

function toEpoch(v) {
  const t = Date.parse(String(v || ''));
  return Number.isFinite(t) ? t : 0;
}

function briefError(error) {
  const txt = String((error && (error.message || error.details || error.hint || error.code || error)) || '').trim();
  if (!txt) return 'unknown error';
  return txt;
}

function looksLikeSchemaError(error) {
  const txt = briefError(error).toLowerCase();
  const code = String((error && error.code) || '').toUpperCase();
  if (code === '42883' || code === '42P01' || code === '42703') return true;
  return (
    (txt.includes('schema cache') && txt.includes('ik_plan')) ||
    (txt.includes('function public.ik_plan') && txt.includes('does not exist')) ||
    (txt.includes('relation') && txt.includes('ik_plan') && txt.includes('does not exist')) ||
    (txt.includes('column') && txt.includes('ik_plan') && txt.includes('does not exist'))
  );
}

function looksTransientError(error) {
  const txt = briefError(error).toLowerCase();
  return (
    txt.includes('failed to fetch') ||
    txt.includes('network') ||
    txt.includes('timeout') ||
    txt.includes('timed out') ||
    txt.includes('gateway') ||
    txt.includes('503') ||
    txt.includes('502') ||
    txt.includes('429')
  );
}

function roleLabel(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'owner') return 'OWNER';
  if (r === 'editor') return 'EDITOR';
  if (r === 'viewer') return 'VIEWER';
  return 'MEMBER';
}

export class PlanningCollabApp {
  constructor(ui, els) {
    this.ui = ui;
    this.els = els;

    this.client = null;
    this.user = null;
    this.profile = null;

    this.state = {
      projects: [],
      board: null,
      activeProjectId: null,
      incomingInvites: [],
      realtimeStatus: 'off',
      presence: []
    };

    this.uiPrefs = this.loadUIPrefs();
    this.channel = null;
    this.boardReloadTimer = null;
    this.projectsRetryTimer = null;
    this.inboxPollTimer = null;
    this.editingGcTimer = null;
    this.editingPingTimer = null;
    this.currentEditingCardId = null;
    this.editingByKey = new Map();
    this.schemaWarnShown = false;
    this.handlersBound = false;

    const baseCloseModal = this.ui.closeModal.bind(this.ui);
    this.ui.closeModal = () => {
      this.stopCurrentEditing();
      baseCloseModal();
    };
  }

  async init() {
    this.bindHandlers();
    this.applyPrefsToControls();
    this.renderProjectScopeToggle();
    this.setView(this.uiPrefs.view);

    if (!(window.IKSupabase && typeof window.IKSupabase.getClient === 'function')) {
      this.renderFatal('Supabase client missing');
      this.setCloudBadge('off', 'supabase client missing');
      return;
    }

    this.client = window.IKSupabase.getClient();
    if (!this.client) {
      this.renderFatal('Supabase unavailable');
      this.setCloudBadge('off', 'supabase unavailable');
      return;
    }

    const { data, error } = await this.client.auth.getUser();
    if (error) {
      this.renderFatal(briefError(error));
      this.setCloudBadge('off', briefError(error));
      return;
    }

    this.user = data && data.user ? data.user : null;
    if (!this.user) {
      this.renderLoginRequired();
      this.setCloudBadge('off', 'login required');
      return;
    }

    this.client.auth.onAuthStateChange((_evt, session) => {
      const nextUser = session && session.user ? session.user : null;
      const nextId = nextUser ? String(nextUser.id) : '';
      const currentId = this.user ? String(this.user.id) : '';
      if (!nextId || nextId !== currentId) {
        window.location.reload();
      }
    });

    await this.loadProfile();
    await this.loadIncomingInvitations({ quiet: true });

    const loaded = await this.loadProjects();
    this.renderInboxButton();
    if (!loaded) {
      this.state.activeProjectId = null;
      this.state.board = null;
      this.renderProjectSelect();
      this.renderProjectBar();
      this.renderAssigneeFilter();

      if (this.schemaWarnShown) {
        this.renderEmptyBoard('Planning schema is outdated. Apply stage9 + stage10 SQL.');
        this.setActionsDisabled(true);
        return;
      }

      this.renderEmptyBoard('Projects unavailable. Check connection and retry.', { retry: true });
      this.scheduleProjectsRetry();
      this.startBackgroundLoops();
      this.setActionsDisabled(false);
      this.setCloudBadge('sync', 'projects unavailable');
      return;
    }

    this.state.activeProjectId = this.readStoredActiveProjectId();
    if (!this.state.activeProjectId || !this.state.projects.some((p) => p.id === this.state.activeProjectId)) {
      this.state.activeProjectId = this.state.projects[0] ? this.state.projects[0].id : null;
    }

    const scopeProjects = this.getScopeFilteredProjects();
    if (scopeProjects.length === 0) {
      this.state.activeProjectId = null;
    } else if (!scopeProjects.some((p) => String(p.id) === String(this.state.activeProjectId || ''))) {
      this.state.activeProjectId = scopeProjects[0].id;
    }
    this.storeActiveProjectId(this.state.activeProjectId);

    this.renderProjectSelect();
    this.renderProjectBar();
    this.renderInboxButton();

    if (this.state.activeProjectId) {
      await this.selectProject(this.state.activeProjectId, { force: true });
    } else {
      this.renderAssigneeFilter();
      this.renderPresence();
      if (this.state.projects.length > 0) {
        this.renderEmptyBoard('No projects in this section. Switch scope filter.');
        this.setCloudBadge('ready', 'no projects in scope');
      } else {
        this.renderEmptyBoard('No projects yet. Create your first project.');
        this.setCloudBadge('ready', 'no active project');
      }
    }

    this.startBackgroundLoops();
    this.setActionsDisabled(false);
  }

  normalizeScopeValue(scope) {
    const s = String(scope || '').toLowerCase();
    return PROJECT_SCOPES.includes(s) ? s : 'all';
  }

  normalizeProjectScope(project) {
    const scope = String((project && project.scope) || '').toLowerCase();
    if (scope === 'personal' || scope === 'shared') return scope;
    let memberCount = Number((project && project.member_count) || 0);
    let pendingInviteCount = Number((project && project.pending_invite_count) || 0);

    const board = this.state.board;
    const sameAsBoard = board && board.project && String(board.project.id || '') === String((project && project.id) || '');
    if (sameAsBoard) {
      if (memberCount <= 0) memberCount = asArray(board.members).length;
      if (pendingInviteCount <= 0) {
        pendingInviteCount = asArray(board.invitations).filter((x) => String(x.status) === 'pending').length;
      }
    }

    return memberCount > 1 || pendingInviteCount > 0 ? 'shared' : 'personal';
  }

  getScopeFilteredProjects() {
    const mode = this.normalizeScopeValue(this.uiPrefs.projectScope);
    if (mode === 'all') return this.state.projects.slice();
    return this.state.projects.filter((p) => this.normalizeProjectScope(p) === mode);
  }

  renderProjectScopeToggle() {
    const root = this.els.projectScope;
    if (!root) return;
    const current = this.normalizeScopeValue(this.uiPrefs.projectScope);
    root.querySelectorAll('[data-scope]').forEach((node) => {
      const mode = this.normalizeScopeValue(node.getAttribute('data-scope'));
      const active = mode === current;
      node.classList.toggle('is-active', active);
      node.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  clearProjectsRetry() {
    if (!this.projectsRetryTimer) return;
    clearTimeout(this.projectsRetryTimer);
    this.projectsRetryTimer = null;
  }

  scheduleProjectsRetry(delay = PROJECTS_RETRY_MS) {
    this.clearProjectsRetry();
    this.projectsRetryTimer = setTimeout(() => {
      this.projectsRetryTimer = null;
      void this.retryLoadProjects().catch(() => {});
    }, Math.max(1000, Number(delay) || PROJECTS_RETRY_MS));
  }

  async retryLoadProjects() {
    const loaded = await this.loadProjects({ quiet: true });
    if (!loaded) {
      if (!this.schemaWarnShown) this.scheduleProjectsRetry();
      return false;
    }

    const scoped = this.getScopeFilteredProjects();
    if (!scoped.length) {
      await this.unsubscribeProject();
      this.state.activeProjectId = null;
      this.storeActiveProjectId(null);
      this.state.board = null;
      this.renderProjectSelect();
      this.renderProjectBar();
      this.renderPresence();
      this.renderAssigneeFilter();
      this.renderBoard();
      return true;
    }

    const stillVisible = scoped.some((p) => String(p.id) === String(this.state.activeProjectId || ''));
    if (!stillVisible) {
      this.state.activeProjectId = scoped[0].id;
      this.storeActiveProjectId(this.state.activeProjectId);
    }

    if (!this.state.activeProjectId) return true;
    await this.selectProject(this.state.activeProjectId, { force: true });
    return true;
  }

  async setProjectScope(scope, options = {}) {
    const force = !!options.force;
    const nextScope = this.normalizeScopeValue(scope);
    if (!force && this.normalizeScopeValue(this.uiPrefs.projectScope) === nextScope) {
      this.renderProjectScopeToggle();
      return;
    }

    this.uiPrefs.projectScope = nextScope;
    this.persistUIPrefs();
    this.renderProjectScopeToggle();

    const scoped = this.getScopeFilteredProjects();
    const currentVisible = scoped.some((p) => String(p.id) === String(this.state.activeProjectId || ''));

    if (currentVisible && this.state.activeProjectId) {
      this.renderProjectSelect();
      this.renderProjectBar();
      this.renderBoard();
      this.renderAssigneeFilter();
      this.renderPresence();
      return;
    }

    if (!scoped.length) {
      await this.unsubscribeProject();
      this.state.activeProjectId = null;
      this.storeActiveProjectId(null);
      this.state.board = null;
      this.renderProjectSelect();
      this.renderProjectBar();
      this.renderPresence();
      this.renderAssigneeFilter();
      this.renderBoard();
      return;
    }

    await this.selectProject(scoped[0].id, { force: true });
  }

  bindHandlers() {
    if (this.handlersBound) return;
    this.handlersBound = true;

    if (this.els.projectScope) {
      this.els.projectScope.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-scope]');
        if (!btn) return;
        const scope = String(btn.getAttribute('data-scope') || 'all');
        void this.setProjectScope(scope).catch((error) => this.onMutationError(error));
      });
    }

    if (this.els.projectSelect) {
      this.els.projectSelect.addEventListener('change', () => {
        const id = String(this.els.projectSelect.value || '').trim();
        if (!id) return;
        void this.selectProject(id).catch((error) => this.onMutationError(error));
      });
    }

    if (this.els.searchInput) {
      this.els.searchInput.addEventListener('input', () => {
        this.uiPrefs.q = String(this.els.searchInput.value || '').trim();
        this.persistUIPrefs();
        this.renderBoard();
      });
    }

    if (this.els.tagsFilter) {
      this.els.tagsFilter.addEventListener('input', () => {
        this.uiPrefs.tags = String(this.els.tagsFilter.value || '').trim();
        this.persistUIPrefs();
        this.renderBoard();
      });
    }

    if (this.els.assigneeFilter) {
      this.els.assigneeFilter.addEventListener('change', () => {
        const next = String(this.els.assigneeFilter.value || 'all');
        this.uiPrefs.assignee = next || 'all';
        this.persistUIPrefs();
        this.renderBoard();
      });
    }

    if (this.els.priorityFilter) {
      this.els.priorityFilter.addEventListener('change', () => {
        this.uiPrefs.priority = String(this.els.priorityFilter.value || 'all');
        this.persistUIPrefs();
        this.renderBoard();
      });
    }

    if (this.els.deadlineFilter) {
      this.els.deadlineFilter.addEventListener('change', () => {
        this.uiPrefs.deadline = String(this.els.deadlineFilter.value || 'all');
        this.persistUIPrefs();
        this.renderBoard();
      });
    }

    if (this.els.sortSelect) {
      this.els.sortSelect.addEventListener('change', () => {
        this.uiPrefs.sort = String(this.els.sortSelect.value || 'default');
        this.persistUIPrefs();
        this.renderBoard();
      });
    }

    if (this.els.clearFilters) {
      this.els.clearFilters.addEventListener('click', () => {
        this.uiPrefs.q = '';
        this.uiPrefs.tags = '';
        this.uiPrefs.assignee = 'all';
        this.uiPrefs.priority = 'all';
        this.uiPrefs.deadline = 'all';
        this.uiPrefs.sort = 'default';
        this.applyPrefsToControls();
        this.persistUIPrefs();
        this.renderBoard();
        this.ui.toast('filters cleared');
      });
    }

    if (this.els.viewSelect) {
      this.els.viewSelect.addEventListener('change', () => {
        this.uiPrefs.view = String(this.els.viewSelect.value || 'board');
        this.persistUIPrefs();
        this.setView(this.uiPrefs.view);
      });
    }

    if (this.els.btnNewProject) {
      this.els.btnNewProject.addEventListener('click', () => this.openCreateProjectModal());
    }

    if (this.els.btnNewTask) {
      this.els.btnNewTask.addEventListener('click', () => this.openCreateCardModal());
    }

    if (this.els.btnInviteFriend) {
      this.els.btnInviteFriend.addEventListener('click', () => this.openInviteFriendModal());
    }

    if (this.els.btnInvitesInbox) {
      this.els.btnInvitesInbox.addEventListener('click', () => {
        void this.openIncomingInvitesModal().catch((error) => this.onMutationError(error));
      });
    }

    if (this.els.btnNewEvent) {
      this.els.btnNewEvent.addEventListener('click', () => {
        this.ui.toast('schedule module is not implemented yet');
      });
    }
  }

  startBackgroundLoops() {
    if (!this.inboxPollTimer) {
      this.inboxPollTimer = setInterval(() => {
        void this.loadIncomingInvitations({ quiet: true }).catch(() => {});
      }, INCOMING_REFRESH_MS);
    }

    if (!this.editingGcTimer) {
      this.editingGcTimer = setInterval(() => {
        this.cleanupEditingMap();
      }, 5000);
    }
  }

  loadUIPrefs() {
    const defaults = {
      projectScope: 'all',
      q: '',
      assignee: 'all',
      tags: '',
      priority: 'all',
      deadline: 'all',
      sort: 'default',
      view: 'board'
    };

    try {
      const raw = localStorage.getItem(UI_PREFS_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      const parsedScope = String(parsed.projectScope || parsed.scope || '').toLowerCase();
      const parsedAssignee = String(parsed.assignee || '').trim();
      const parsedAssigneeLower = parsedAssignee.toLowerCase();
      const safeAssignee = parsedAssignee
        ? (ASSIGNEE_FILTERS.includes(parsedAssigneeLower) ? parsedAssigneeLower : parsedAssignee)
        : defaults.assignee;
      return {
        projectScope: PROJECT_SCOPES.includes(parsedScope) ? parsedScope : defaults.projectScope,
        q: typeof parsed.q === 'string' ? parsed.q : defaults.q,
        assignee: safeAssignee,
        tags: typeof parsed.tags === 'string' ? parsed.tags : defaults.tags,
        priority: ['all', 'low', 'mid', 'high'].includes(String(parsed.priority)) ? String(parsed.priority) : defaults.priority,
        deadline: ['all', 'today', 'overdue', 'week'].includes(String(parsed.deadline)) ? String(parsed.deadline) : defaults.deadline,
        sort: ['default', 'deadline', 'priority', 'newest'].includes(String(parsed.sort)) ? String(parsed.sort) : defaults.sort,
        view: ['board', 'schedule'].includes(String(parsed.view)) ? String(parsed.view) : defaults.view
      };
    } catch (_) {
      return defaults;
    }
  }

  persistUIPrefs() {
    try {
      localStorage.setItem(UI_PREFS_KEY, JSON.stringify(this.uiPrefs));
    } catch (_) {}
  }

  applyPrefsToControls() {
    if (this.els.searchInput) this.els.searchInput.value = this.uiPrefs.q;
    if (this.els.assigneeFilter) this.els.assigneeFilter.value = this.uiPrefs.assignee;
    if (this.els.tagsFilter) this.els.tagsFilter.value = this.uiPrefs.tags;
    if (this.els.priorityFilter) this.els.priorityFilter.value = this.uiPrefs.priority;
    if (this.els.deadlineFilter) this.els.deadlineFilter.value = this.uiPrefs.deadline;
    if (this.els.sortSelect) this.els.sortSelect.value = this.uiPrefs.sort;
    if (this.els.viewSelect) this.els.viewSelect.value = this.uiPrefs.view;
    this.renderProjectScopeToggle();
  }

  readStoredActiveProjectId() {
    try {
      return localStorage.getItem(ACTIVE_PROJECT_KEY);
    } catch (_) {
      return null;
    }
  }

  storeActiveProjectId(projectId) {
    try {
      if (!projectId) localStorage.removeItem(ACTIVE_PROJECT_KEY);
      else localStorage.setItem(ACTIVE_PROJECT_KEY, String(projectId));
    } catch (_) {}
  }

  setCloudBadge(text, title) {
    if (window.IKPlanningCloud && typeof window.IKPlanningCloud.setBadge === 'function') {
      window.IKPlanningCloud.setBadge(text, title);
      return;
    }
    const badge = document.getElementById('planningCloudBadge');
    if (!badge) return;
    badge.textContent = `planning cloud: ${text}`;
    if (title) badge.title = title;
  }

  setActionsDisabled(disabled) {
    const ids = [
      this.els.btnNewProject,
      this.els.btnNewTask,
      this.els.btnInviteFriend,
      this.els.btnInvitesInbox,
      this.els.btnNewEvent
    ];
    for (const el of ids) {
      if (!el) continue;
      el.disabled = !!disabled;
    }

    if (this.els.projectScope) {
      this.els.projectScope.querySelectorAll('[data-scope]').forEach((el) => {
        el.disabled = !!disabled;
      });
    }
  }

  renderFatal(text) {
    this.setActionsDisabled(true);
    this.uiPrefs.view = 'board';
    if (this.els.viewSelect) this.els.viewSelect.value = 'board';
    this.setView('board');
    this.renderAssigneeFilter();
    this.renderEmptyBoard(`Planning unavailable: ${escapeHtml(text)}`);
  }

  renderLoginRequired() {
    this.setActionsDisabled(true);
    this.uiPrefs.view = 'board';
    if (this.els.viewSelect) this.els.viewSelect.value = 'board';
    this.setView('board');
    this.renderAssigneeFilter();
    this.renderEmptyBoard('Login required. Open item-user.html and sign in.');
    this.renderProjectSelect();
    this.renderProjectBar();
    this.renderPresence();
  }

  renderEmptyBoard(message, options = {}) {
    if (!this.els.boardView) return;
    const showRetry = !!options.retry;
    this.els.boardView.innerHTML = `
      <div style="font-size:11px; letter-spacing:2px; text-transform:uppercase; opacity:.7; line-height:1.5;">
        ${escapeHtml(message)}
      </div>
      ${showRetry ? '<button class="btn" type="button" data-retry-projects style="margin-top:10px;">retry</button>' : ''}
    `;
    if (showRetry) {
      this.els.boardView.querySelector('[data-retry-projects]')?.addEventListener('click', () => {
        void this.retryLoadProjects().catch((error) => this.onMutationError(error));
      });
    }
    this.els.boardView.hidden = false;
  }

  async loadProfile() {
    if (!this.client || !this.user) return;
    try {
      const { data, error } = await this.client
        .from('ik_user_profiles')
        .select('id,user_id,nickname,avatar_url')
        .eq('id', this.user.id)
        .maybeSingle();
      if (error) return;
      this.profile = data || null;
    } catch (_) {
      this.profile = null;
    }
  }

  async rpc(fn, args) {
    if (!this.client) throw new Error('client not initialized');
    const { data, error } = await this.client.rpc(fn, args || {});
    if (error) throw error;
    return data;
  }

  async loadProjects(options = {}) {
    const quiet = !!options.quiet;
    try {
      const data = await this.rpc('ik_plan_list_projects');
      this.state.projects = asArray(data).map((p) => ({
        ...p,
        scope: this.normalizeProjectScope(p)
      }));
      this.clearProjectsRetry();
      this.renderProjectSelect();
      this.renderProjectBar();
      return true;
    } catch (error) {
      if (looksLikeSchemaError(error)) {
        await this.onMutationError(error);
      } else if (!quiet) {
        await this.onMutationError(error);
      } else if (looksTransientError(error)) {
        this.setCloudBadge('sync', 'projects retrying');
      }
      if (!this.state.projects.length) this.state.projects = [];
      this.renderProjectSelect();
      this.renderProjectBar();
      return false;
    }
  }

  async loadIncomingInvitations({ quiet } = { quiet: false }) {
    if (!this.user) return;
    try {
      const data = await this.rpc('ik_plan_list_incoming_invitations');
      this.state.incomingInvites = asArray(data);
      this.renderInboxButton();
    } catch (error) {
      if (!quiet) await this.onMutationError(error);
    }
  }

  renderInboxButton() {
    if (!this.els.btnInvitesInbox) return;
    const count = this.state.incomingInvites.length;
    this.els.btnInvitesInbox.textContent = count > 0 ? `inbox (${count})` : 'inbox';
  }

  async selectProject(projectId, options = {}) {
    const force = !!options.force;
    const id = String(projectId || '').trim();
    if (!id) return;

    const target = this.state.projects.find((p) => String(p.id) === id);
    if (!target) return;

    const visible = this.getScopeFilteredProjects().some((p) => String(p.id) === id);
    if (!visible) {
      this.uiPrefs.projectScope = 'all';
      this.persistUIPrefs();
      this.renderProjectScopeToggle();
    }

    if (!force && this.state.activeProjectId === id) return;
    this.state.activeProjectId = id;
    this.storeActiveProjectId(id);

    this.renderProjectSelect();
    this.renderProjectBar();

    await this.loadBoard(id);
    await this.subscribeProject(id);
    this.renderPresence();
  }

  async loadBoard(projectId) {
    const id = String(projectId || this.state.activeProjectId || '').trim();
    if (!id) {
      this.state.board = null;
      this.renderAssigneeFilter();
      this.renderBoard();
      return;
    }

    try {
      const data = await this.rpc('ik_plan_get_board', { p_project_id: id });
      this.state.board = data && typeof data === 'object' ? data : null;
      this.renderProjectBar();
      this.renderAssigneeFilter();
      this.renderBoard();
      this.renderPresence();
    } catch (error) {
      this.state.board = null;
      this.renderAssigneeFilter();
      this.renderBoard();
      this.renderPresence();
      await this.onMutationError(error);
    }
  }

  scheduleBoardReload(delay = BOARD_RELOAD_DEBOUNCE_MS) {
    if (this.boardReloadTimer) {
      clearTimeout(this.boardReloadTimer);
      this.boardReloadTimer = null;
    }
    this.boardReloadTimer = setTimeout(() => {
      this.boardReloadTimer = null;
      if (!this.state.activeProjectId) return;
      void this.loadBoard(this.state.activeProjectId).catch(() => {});
    }, Math.max(0, Number(delay) || 0));
  }

  async subscribeProject(projectId) {
    await this.unsubscribeProject();

    if (!this.client || !projectId) return;

    const channel = this.client.channel(`ik-plan-${projectId}`, {
      config: {
        presence: { key: String(this.user.id) }
      }
    });

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'ik_plan_events',
        filter: `project_id=eq.${projectId}`
      },
      (payload) => {
        this.onProjectEvent(payload && payload.new ? payload.new : null);
      }
    );

    channel.on('presence', { event: 'sync' }, () => {
      this.syncPresence();
    });

    channel.on('presence', { event: 'join' }, () => {
      this.syncPresence();
    });

    channel.on('presence', { event: 'leave' }, () => {
      this.syncPresence();
    });

    channel.on('broadcast', { event: 'editing' }, (packet) => {
      this.onEditingBroadcast(packet ? packet.payload : null);
    });

    channel.subscribe(async (status) => {
      this.state.realtimeStatus = String(status || 'off');
      if (status === 'SUBSCRIBED') {
        this.setCloudBadge('live', 'realtime connected');
        try {
          await channel.track({
            user_id: this.user.id,
            nickname: this.resolveSelfName(),
            at: Date.now()
          });
        } catch (_) {}
        this.syncPresence();
        this.scheduleBoardReload(50);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        this.setCloudBadge('off', `realtime ${status}`);
      } else {
        this.setCloudBadge('sync', `realtime ${status}`);
      }
      this.renderPresence();
    });

    this.channel = channel;
  }

  async unsubscribeProject() {
    if (!this.client || !this.channel) return;
    try {
      await this.client.removeChannel(this.channel);
    } catch (_) {}
    this.channel = null;
    this.state.presence = [];
    this.state.realtimeStatus = 'off';
  }

  onProjectEvent(eventRow) {
    if (!eventRow || !this.state.board || !this.state.board.project) {
      this.scheduleBoardReload(80);
      return;
    }

    const incomingRevision = Number(eventRow.revision || 0);
    const localRevision = Number(this.state.board.project.revision || 0);

    if (!incomingRevision) {
      this.scheduleBoardReload(80);
      return;
    }

    if (incomingRevision <= localRevision) return;

    if (incomingRevision > localRevision + 1) {
      this.scheduleBoardReload(0);
      return;
    }

    this.scheduleBoardReload(90);
  }

  syncPresence() {
    if (!this.channel || typeof this.channel.presenceState !== 'function') {
      this.state.presence = [];
      this.renderPresence();
      return;
    }

    const raw = this.channel.presenceState();
    const byUser = new Map();

    for (const key of Object.keys(raw || {})) {
      const metas = asArray(raw[key]);
      for (const meta of metas) {
        const userId = String(meta && (meta.user_id || key) || '').trim();
        if (!userId) continue;
        const prev = byUser.get(userId);
        const ts = Number(meta && meta.at ? meta.at : Date.now());
        if (!prev || ts >= prev.ts) {
          byUser.set(userId, {
            user_id: userId,
            nickname: String(meta && meta.nickname ? meta.nickname : ''),
            ts
          });
        }
      }
    }

    this.state.presence = Array.from(byUser.values()).sort((a, b) => {
      if (a.user_id === this.user.id) return -1;
      if (b.user_id === this.user.id) return 1;
      return String(a.nickname || a.user_id).localeCompare(String(b.nickname || b.user_id));
    });

    this.renderPresence();
  }

  resolveSelfName() {
    if (this.profile && this.profile.nickname) return String(this.profile.nickname);
    if (this.user && this.user.email) return String(this.user.email).split('@')[0];
    return 'me';
  }

  resolveMemberHandle(member) {
    const handle = String((member && (member.profile_user_id || member.user_id || member.nickname)) || '').trim();
    if (handle) return handle;
    const uidText = String((member && member.user_id) || '').trim();
    if (!uidText) return 'user';
    return uidText.slice(0, 8);
  }

  resolveMemberLabel(member) {
    const nick = String((member && member.nickname) || '').trim();
    const handle = this.resolveMemberHandle(member);
    if (nick && nick.toLowerCase() !== handle.toLowerCase()) {
      return `${nick} (@${handle})`;
    }
    return `@${handle}`;
  }

  renderAssigneeFilter() {
    const el = this.els.assigneeFilter;
    if (!el) return;

    const board = this.state.board;
    const members = asArray(board && board.members);
    const selected = String(this.uiPrefs.assignee || 'all');

    const options = [
      { value: 'all', label: 'исполнитель: все' },
      { value: 'me', label: 'исполнитель: мои' },
      { value: 'unassigned', label: 'исполнитель: без ответ.' }
    ];

    for (const m of members) {
      const userId = String(m.user_id || '').trim();
      if (!userId) continue;
      options.push({ value: userId, label: this.resolveMemberLabel(m) });
    }

    el.innerHTML = options
      .map((opt) => `<option value="${escapeAttr(opt.value)}">${escapeHtml(opt.label)}</option>`)
      .join('');

    const exists = options.some((opt) => String(opt.value) === selected);
    const safeValue = exists ? selected : 'all';
    this.uiPrefs.assignee = safeValue;
    if (safeValue !== selected) this.persistUIPrefs();
    el.value = safeValue;
    el.disabled = !board || !board.project;
  }

  assigneeOptionsHtml(selectedId = '') {
    const board = this.state.board;
    const members = asArray(board && board.members);
    const selected = String(selectedId || '');
    const out = ['<option value="">unassigned</option>'];
    for (const m of members) {
      const userId = String(m.user_id || '').trim();
      if (!userId) continue;
      const picked = userId === selected ? 'selected' : '';
      out.push(`<option value="${escapeAttr(userId)}" ${picked}>${escapeHtml(this.resolveMemberLabel(m))}</option>`);
    }
    return out.join('');
  }

  assigneeLabel(card) {
    if (!card || !card.assignee_id) return '';
    const handle = String(card.assignee_user_id || card.assignee_nickname || card.assignee_id).trim();
    if (!handle) return '';
    return handle.startsWith('@') ? handle : `@${handle}`;
  }

  projectScopeText(project) {
    return this.normalizeProjectScope(project) === 'shared' ? 'общий' : 'личный';
  }

  renderPresence() {
    if (!this.els.planningPresence) return;

    const board = this.state.board;
    if (!board || !board.project) {
      this.els.planningPresence.innerHTML = '';
      return;
    }

    const members = asArray(board.members);
    const memberById = new Map();
    members.forEach((m) => {
      memberById.set(String(m.user_id), m);
    });

    const status = this.state.realtimeStatus === 'SUBSCRIBED' ? 'LIVE' : 'SYNC';
    const chips = this.state.presence.map((p) => {
      const m = memberById.get(String(p.user_id));
      const nick = String((m && (m.nickname || m.profile_user_id)) || p.nickname || p.user_id).trim() || 'user';
      const isSelf = String(p.user_id) === String(this.user.id);
      return `<span class="planning-presence__chip${isSelf ? ' is-self' : ''}"><span class="planning-presence__dot"></span>${escapeHtml(nick)}</span>`;
    }).join('');

    const totalMembers = members.length;
    const onlineCount = this.state.presence.length;
    const statusText = `${status} | online ${onlineCount}/${totalMembers || 0}`;

    this.els.planningPresence.innerHTML = `
      <span class="planning-presence__status">${escapeHtml(statusText)}</span>
      ${chips}
    `;
  }

  setView(view) {
    const safeView = view === 'schedule' ? 'schedule' : 'board';

    if (this.els.boardView) this.els.boardView.hidden = safeView !== 'board';
    if (this.els.scheduleView) this.els.scheduleView.hidden = safeView !== 'schedule';

    if (safeView === 'schedule' && this.els.scheduleView) {
      this.els.scheduleView.innerHTML = `
        <div class="schedule-placeholder" style="font-size:11px; letter-spacing:3px; text-transform:uppercase;">
          schedule is next step
        </div>
      `;
    }

    if (safeView === 'board') {
      this.renderBoard();
    }
  }

  renderProjectSelect() {
    const el = this.els.projectSelect;
    if (!el) return;

    const projects = this.getScopeFilteredProjects();
    el.innerHTML = '';

    if (!projects.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = this.state.projects.length ? 'NO PROJECTS IN SCOPE' : 'NO PROJECTS';
      opt.selected = true;
      el.appendChild(opt);
      el.disabled = true;
      return;
    }

    el.disabled = false;
    for (const p of projects) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = String(p.name || '').toUpperCase();
      if (String(p.id) === String(this.state.activeProjectId || '')) opt.selected = true;
      el.appendChild(opt);
    }
  }

  renderProjectBar() {
    const bar = this.els.projectBar;
    if (!bar) return;

    const projects = this.getScopeFilteredProjects();
    bar.innerHTML = '';

    for (const p of projects) {
      const chip = document.createElement('div');
      const isActive = String(p.id) === String(this.state.activeProjectId || '');
      chip.className = `proj-chip${isActive ? ' is-active' : ''}`;

      const role = roleLabel(p.role);
      const scopeText = this.projectScopeText(p);
      const count =
        this.state.board &&
        this.state.board.project &&
        String(this.state.board.project.id) === String(p.id)
          ? asArray(this.state.board.cards).length
          : Number(p.card_count || 0);
      const canDelete = String(p.role || '') === 'owner';

      chip.innerHTML = `
        <span class="proj-chip__name">${escapeHtml(String(p.name || '').toUpperCase())}</span>
        <span class="proj-chip__count">${count}</span>
        <span class="proj-chip__scope">${escapeHtml(scopeText)}</span>
        <span class="proj-chip__count">${escapeHtml(role)}</span>
        <button class="proj-chip__ctl" type="button" aria-label="manage columns">c</button>
        <button class="proj-chip__del" type="button" aria-label="delete project" ${canDelete ? '' : 'disabled'}>x</button>
      `;

      chip.addEventListener('click', (event) => {
        if (event.target.closest('.proj-chip__ctl') || event.target.closest('.proj-chip__del')) return;
        void this.selectProject(p.id).catch((error) => this.onMutationError(error));
      });

      const ctl = chip.querySelector('.proj-chip__ctl');
      if (ctl) {
        ctl.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          void this.selectProject(p.id, { force: true })
            .then(() => this.openColumnsModal())
            .catch((error) => this.onMutationError(error));
        });
      }

      const del = chip.querySelector('.proj-chip__del');
      if (del) {
        del.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (del.disabled) return;
          this.openDeleteProjectModal(p.id);
        });
      }

      bar.appendChild(chip);
    }
  }

  getSortedColumns() {
    const cols = asArray(this.state.board && this.state.board.columns);
    return cols.slice().sort((a, b) => {
      const ap = toPositionNumber(a.position);
      const bp = toPositionNumber(b.position);
      if (ap !== bp) return ap - bp;
      return String(a.id).localeCompare(String(b.id));
    });
  }

  getCardsForProject() {
    return asArray(this.state.board && this.state.board.cards);
  }

  filterCards(cards, columnsById) {
    const q = String(this.uiPrefs.q || '').trim().toLowerCase();
    const wantedAssignee = String(this.uiPrefs.assignee || 'all').trim();
    const wantedTags = parseFilterTags(this.uiPrefs.tags || '');
    const wantedPriority = String(this.uiPrefs.priority || 'all');
    const wantedDeadline = String(this.uiPrefs.deadline || 'all');

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayISO = formatLocalISO(today);
    const weekEnd = addDaysLocal(today, 7);
    const weekEndTime = weekEnd.getTime();

    return cards.filter((card) => {
      if (q) {
        const hay = `${card.name || ''} ${card.description || ''} ${asArray(card.tags).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (wantedTags.length) {
        const taskTags = asArray(card.tags).map((t) => String(t).toLowerCase());
        for (const tag of wantedTags) {
          if (!taskTags.includes(tag)) return false;
        }
      }

      if (wantedPriority !== 'all') {
        if (String(card.priority || '').toLowerCase() !== wantedPriority) return false;
      }

      if (wantedAssignee && wantedAssignee !== 'all') {
        const assigneeId = String(card.assignee_id || '');
        if (wantedAssignee === 'me') {
          if (assigneeId !== String(this.user && this.user.id || '')) return false;
        } else if (wantedAssignee === 'unassigned') {
          if (assigneeId) return false;
        } else if (assigneeId !== wantedAssignee) {
          return false;
        }
      }

      if (wantedDeadline !== 'all') {
        const deadlineDate = parseISOToLocalDate(card.deadline);
        if (!deadlineDate) return false;

        const deadlineTime = deadlineDate.getTime();
        const col = columnsById.get(String(card.column_id || ''));
        const isDone = String(col && col.role || '') === 'done';

        if (wantedDeadline === 'today') {
          if (formatLocalISO(deadlineDate) !== todayISO) return false;
        }

        if (wantedDeadline === 'overdue') {
          if (isDone) return false;
          if (deadlineTime >= today.getTime()) return false;
        }

        if (wantedDeadline === 'week') {
          if (deadlineTime < today.getTime() || deadlineTime > weekEndTime) return false;
        }
      }

      return true;
    });
  }

  sortCards(cards) {
    const mode = String(this.uiPrefs.sort || 'default');
    const priorityRank = { high: 3, mid: 2, low: 1 };

    return cards.slice().sort((a, b) => {
      if (mode === 'newest') {
        return toEpoch(b.created_at) - toEpoch(a.created_at);
      }

      const aDeadline = a.deadline ? String(a.deadline) : '';
      const bDeadline = b.deadline ? String(b.deadline) : '';
      const aHasDeadline = Boolean(aDeadline);
      const bHasDeadline = Boolean(bDeadline);

      if (mode === 'priority') {
        const ap = priorityRank[String(a.priority || '').toLowerCase()] || 0;
        const bp = priorityRank[String(b.priority || '').toLowerCase()] || 0;
        if (bp !== ap) return bp - ap;
        if (aHasDeadline !== bHasDeadline) return aHasDeadline ? -1 : 1;
        const cmp = aDeadline.localeCompare(bDeadline);
        if (cmp) return cmp;
        return toEpoch(b.created_at) - toEpoch(a.created_at);
      }

      if (mode === 'deadline') {
        if (aHasDeadline !== bHasDeadline) return aHasDeadline ? -1 : 1;
        const cmp = aDeadline.localeCompare(bDeadline);
        if (cmp) return cmp;
        return toEpoch(b.created_at) - toEpoch(a.created_at);
      }

      const aPos = toPositionNumber(a.position);
      const bPos = toPositionNumber(b.position);
      if (aPos !== bPos) return aPos - bPos;
      return toEpoch(a.created_at) - toEpoch(b.created_at);
    });
  }

  cardMeta(card) {
    const parts = [];
    if (card.priority) parts.push(`priority: ${String(card.priority).toUpperCase()}`);
    if (card.deadline) parts.push(`deadline: ${String(card.deadline)}`);
    const assignee = this.assigneeLabel(card);
    if (assignee) parts.push(`assignee: ${assignee}`);
    const tags = asArray(card.tags);
    if (tags.length) parts.push(`tags: ${tags.join(' | ')}`);
    return parts.join(' | ') || '-';
  }

  renderBoard() {
    if (!this.els.boardView || this.uiPrefs.view === 'schedule') return;

    const board = this.state.board;
    if (!board || !board.project) {
      if (!this.state.projects.length) {
        this.renderEmptyBoard('No projects yet. Create your first project.');
      } else if (!this.getScopeFilteredProjects().length) {
        this.renderEmptyBoard('No projects in this section. Switch scope filter.');
      } else {
        this.renderEmptyBoard('No active project');
      }
      return;
    }

    const columns = this.getSortedColumns();
    if (!columns.length) {
      this.renderEmptyBoard('No columns. Open column settings and create at least one.');
      return;
    }

    const columnsById = new Map(columns.map((c) => [String(c.id), c]));
    const cards = this.getCardsForProject();
    const filtered = this.filterCards(cards, columnsById);

    this.els.boardView.innerHTML = '';
    this.els.boardView.hidden = false;

    for (const col of columns) {
      const colCards = this.sortCards(filtered.filter((card) => String(card.column_id) === String(col.id)));
      const section = document.createElement('section');
      section.className = 'column';
      section.dataset.colId = String(col.id);

      section.innerHTML = `
        <div class="column__head">
          <div class="column__title">
            <span class="col-dot" style="--c:${escapeAttr(col.color || '#111111')}"></span>
            ${escapeHtml(col.name || 'column')}
          </div>
          <div class="column__count">${colCards.length}</div>
        </div>
        <div class="column__dropzone" data-dropzone></div>
      `;

      const zone = section.querySelector('[data-dropzone]');
      zone.addEventListener('dragover', (event) => {
        event.preventDefault();
        zone.classList.add('is-drop-target');
      });

      zone.addEventListener('dragleave', () => {
        zone.classList.remove('is-drop-target');
      });

      zone.addEventListener('drop', (event) => {
        event.preventDefault();
        zone.classList.remove('is-drop-target');
        this.clearDropHints();
        void this.handleDropOnZone(event, String(col.id)).catch((error) => this.onMutationError(error));
      });

      for (const card of colCards) {
        zone.appendChild(this.renderCard(card, col));
      }

      this.els.boardView.appendChild(section);
    }

    this.updateEditingBadges();
  }

  renderCard(card, column) {
    const cardEl = document.createElement('article');
    const isDone = String(column.role || '') === 'done';
    cardEl.className = `card${isDone ? ' card--done' : ''}`;
    cardEl.style.setProperty('--accent', column.color || '#111111');
    cardEl.draggable = true;
    cardEl.dataset.id = String(card.id);
    cardEl.dataset.columnId = String(card.column_id);

    cardEl.innerHTML = `
      <h3 class="card__name">${escapeHtml(card.name || 'task')}</h3>
      <p class="card__meta">${escapeHtml(this.cardMeta(card))}</p>
      <p class="card__editing" data-editing></p>
      <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:2px;">
        <button class="btn" type="button" data-act="open">open</button>
        <button class="btn" type="button" data-act="del">delete</button>
      </div>
    `;

    cardEl.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/taskId', String(card.id));
      event.dataTransfer.effectAllowed = 'move';
    });

    cardEl.addEventListener('dragend', () => {
      this.clearDropHints();
    });

    cardEl.addEventListener('dragover', (event) => {
      event.preventDefault();
      const rect = cardEl.getBoundingClientRect();
      const isAfter = (event.clientY - rect.top) > rect.height / 2;
      cardEl.classList.toggle('is-drop-after', isAfter);
      cardEl.classList.toggle('is-drop-before', !isAfter);
    });

    cardEl.addEventListener('dragleave', () => {
      cardEl.classList.remove('is-drop-before', 'is-drop-after');
    });

    cardEl.addEventListener('drop', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void this.handleDropOnCard(event, String(card.id), String(card.column_id)).catch((error) => this.onMutationError(error));
    });

    cardEl.querySelector('[data-act="open"]')?.addEventListener('click', () => {
      this.openCardModal(String(card.id));
    });

    cardEl.querySelector('[data-act="del"]')?.addEventListener('click', () => {
      this.openDeleteCardModal(String(card.id));
    });

    return cardEl;
  }

  clearDropHints() {
    if (!this.els.boardView) return;
    this.els.boardView.querySelectorAll('.card.is-drop-before,.card.is-drop-after').forEach((node) => {
      node.classList.remove('is-drop-before', 'is-drop-after');
    });
    this.els.boardView.querySelectorAll('.column__dropzone.is-drop-target').forEach((node) => {
      node.classList.remove('is-drop-target');
    });
  }

  async handleDropOnCard(event, targetCardId, targetColumnId) {
    this.clearDropHints();
    const dataTransfer = event.dataTransfer;
    const draggedId = String(dataTransfer ? dataTransfer.getData('text/taskId') : '').trim();
    if (!draggedId || !targetCardId || draggedId === targetCardId) return;

    const targetEl = event.currentTarget;
    const rect = targetEl.getBoundingClientRect();
    const dropAfter = (event.clientY - rect.top) > rect.height / 2;

    const colEl = targetEl.closest('.column');
    if (!colEl) return;
    const cardsInColumn = Array.from(colEl.querySelectorAll('.card[data-id]'));
    const cardIds = cardsInColumn.map((node) => String(node.dataset.id || '')).filter((id) => id && id !== draggedId);
    const targetIdx = cardIds.indexOf(targetCardId);
    if (targetIdx < 0) return;

    let beforeCardId = null;
    let afterCardId = null;

    if (dropAfter) {
      beforeCardId = targetCardId;
      afterCardId = cardIds[targetIdx + 1] || null;
    } else {
      beforeCardId = cardIds[targetIdx - 1] || null;
      afterCardId = targetCardId;
    }

    await this.moveCard(draggedId, targetColumnId, { beforeCardId, afterCardId });
  }

  async handleDropOnZone(event, targetColumnId) {
    const dataTransfer = event.dataTransfer;
    const draggedId = String(dataTransfer ? dataTransfer.getData('text/taskId') : '').trim();
    if (!draggedId || !targetColumnId) return;

    const zone = event.currentTarget;
    const cards = Array.from(zone.querySelectorAll('.card[data-id]'));
    const ids = cards.map((node) => String(node.dataset.id || '')).filter((id) => id && id !== draggedId);

    const beforeCardId = ids.length ? ids[ids.length - 1] : null;
    await this.moveCard(draggedId, targetColumnId, { beforeCardId, afterCardId: null });
  }

  async moveCard(cardId, toColumnId, opts = {}) {
    const board = this.state.board;
    if (!board || !board.project) return;

    const card = asArray(board.cards).find((x) => String(x.id) === String(cardId));
    if (!card) return;

    const payload = {
      p_project_id: board.project.id,
      p_card_id: card.id,
      p_to_column_id: toColumnId,
      p_before_card_id: opts.beforeCardId || null,
      p_after_card_id: opts.afterCardId || null,
      p_base_revision: board.project.revision,
      p_base_version: card.version
    };

    const res = await this.rpc('ik_plan_move_card', payload);
    if (res && res.rebased) {
      this.ui.toast('position rebased');
    }
    this.scheduleBoardReload(40);
  }

  findCardById(cardId) {
    const cards = asArray(this.state.board && this.state.board.cards);
    return cards.find((c) => String(c.id) === String(cardId)) || null;
  }

  openCreateProjectModal() {
    this.ui.openModal({
      title: 'new project',
      bodyHtml: `
        <form class="form">
          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            name
            <input class="ctl" name="name" required maxlength="120" />
          </label>

          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            description
            <textarea class="ctl" name="description" rows="3" maxlength="500"></textarea>
          </label>

          <div class="form__actions">
            <button class="btn" type="button" data-close>cancel</button>
            <button class="btn" type="submit">create</button>
          </div>
        </form>
      `,
      onSubmit: (data) => {
        void this.createProjectSubmit(data).catch((error) => this.onMutationError(error));
      }
    });
  }

  async createProjectSubmit(data) {
    const name = String(data.name || '').trim();
    if (!name) return;
    const description = String(data.description || '').trim();

    const projectId = await this.rpc('ik_plan_create_project', {
      p_name: name,
      p_description: description
    });

    this.ui.closeModal();
    await this.loadProjects({ quiet: true });
    const created = this.state.projects.find((p) => String(p.id) === String(projectId));
    if (created) {
      this.uiPrefs.projectScope = this.normalizeProjectScope(created);
      this.persistUIPrefs();
      this.renderProjectScopeToggle();
    }
    await this.selectProject(String(projectId), { force: true });
    this.ui.toast('project created');
  }

  openDeleteProjectModal(projectId) {
    const target = this.state.projects.find((p) => String(p.id) === String(projectId));
    if (!target) return;

    this.ui.openModal({
      title: 'delete project',
      bodyHtml: `
        <form class="form">
          <div style="font-size:11px; letter-spacing:2px; text-transform:uppercase; opacity:.8; line-height:1.5;">
            delete project ${escapeHtml(String(target.name || '').toUpperCase())}? this action cannot be undone.
          </div>
          <div class="form__actions">
            <button class="btn" type="button" data-close>cancel</button>
            <button class="btn" type="submit">delete</button>
          </div>
        </form>
      `,
      onSubmit: () => {
        void this.deleteProjectSubmit(target).catch((error) => this.onMutationError(error));
      }
    });
  }

  async deleteProjectSubmit(project) {
    const prevActiveId = this.state.activeProjectId;
    const baseRevision =
      this.state.board && this.state.board.project && String(this.state.board.project.id) === String(project.id)
        ? this.state.board.project.revision
        : null;

    await this.rpc('ik_plan_delete_project', {
      p_project_id: project.id,
      p_base_revision: baseRevision
    });

    this.ui.closeModal();
    await this.unsubscribeProject();
    await this.loadProjects({ quiet: true });

    const scoped = this.getScopeFilteredProjects();
    const stillActive = scoped.find((p) => String(p.id) === String(prevActiveId || ''));
    this.state.activeProjectId = stillActive ? stillActive.id : (scoped[0] ? scoped[0].id : null);
    this.storeActiveProjectId(this.state.activeProjectId);

    if (this.state.activeProjectId) {
      await this.selectProject(this.state.activeProjectId, { force: true });
    } else {
      this.state.board = null;
      this.renderBoard();
      this.renderPresence();
      this.renderAssigneeFilter();
    }

    this.ui.toast('project deleted');
  }

  openInviteFriendModal() {
    const board = this.state.board;
    if (!board || !board.project) {
      this.ui.toast('select project first');
      return;
    }

    const canManageMembers = ['owner', 'editor'].includes(String(board.project.role || '').toLowerCase());
    const scopeText = this.projectScopeText(board.project);

    const pending = asArray(board.invitations)
      .filter((x) => String(x.status) === 'pending')
      .map((x) => {
        const invitee = String(x.invitee_user_id || x.invitee_nickname || x.invitee_id || 'user');
        return `
          <div class="friend-card" style="padding:8px; border:1px solid rgba(0,0,0,.14); display:flex; align-items:center; justify-content:space-between; gap:8px;">
            <div style="font-size:11px; letter-spacing:1px;">${escapeHtml(invitee)}</div>
            <button class="btn" type="button" data-cancel-invite="${escapeAttr(String(x.id))}">cancel</button>
          </div>
        `;
      })
      .join('');

    const members = asArray(board.members)
      .map((m) => {
        const userId = String(m.user_id || '').trim();
        const role = roleLabel(m.role);
        const label = this.resolveMemberLabel(m);
        const isSelf = userId === String(this.user && this.user.id || '');
        const canRemove = canManageMembers && !isSelf;
        return `
          <div class="friend-card" style="padding:8px; border:1px solid rgba(0,0,0,.14); display:flex; align-items:center; justify-content:space-between; gap:8px;">
            <div style="display:grid; gap:2px; min-width:0;">
              <div style="font-size:11px; letter-spacing:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(label)}</div>
              <div style="font-size:10px; letter-spacing:2px; text-transform:uppercase; opacity:.65;">${escapeHtml(role)}</div>
            </div>
            <button class="btn" type="button" data-remove-member="${escapeAttr(userId)}" ${canRemove ? '' : 'disabled'}>remove</button>
          </div>
        `;
      })
      .join('');

    this.ui.openModal({
      title: 'invite friend',
      bodyHtml: `
        <form class="form" data-invite-form>
          <div style="font-size:10px; letter-spacing:2px; text-transform:uppercase; opacity:.7;">project scope: ${escapeHtml(scopeText)}</div>

          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            friend user-id
            <input class="ctl" name="target_user_id" required maxlength="32" autocomplete="off" />
          </label>

          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            message (optional)
            <input class="ctl" name="message" maxlength="300" />
          </label>

          <div class="form__actions">
            <button class="btn" type="button" data-close>close</button>
            <button class="btn" type="submit">send invite</button>
          </div>
        </form>

        <div style="font-size:11px; letter-spacing:2px; text-transform:uppercase; opacity:.75; margin-top:8px;">pending invites</div>
        <div style="display:grid; gap:8px; margin-top:6px;">
          ${pending || '<div style="font-size:11px; opacity:.7;">no pending invites</div>'}
        </div>

        <div style="font-size:11px; letter-spacing:2px; text-transform:uppercase; opacity:.75; margin-top:8px;">members</div>
        <div style="display:grid; gap:8px; margin-top:6px;">
          ${members || '<div style="font-size:11px; opacity:.7;">no members</div>'}
        </div>
      `,
      onSubmit: (data) => {
        void this.inviteFriendSubmit(data).catch((error) => this.onMutationError(error));
      },
      onMount: (bodyEl) => {
        bodyEl.addEventListener('click', (event) => {
          const btn = event.target.closest('[data-cancel-invite]');
          if (btn) {
            const invitationId = String(btn.getAttribute('data-cancel-invite') || '');
            if (!invitationId) return;
            void this.cancelInvitation(invitationId).catch((error) => this.onMutationError(error));
            return;
          }

          const rm = event.target.closest('[data-remove-member]');
          if (!rm || rm.disabled) return;
          const memberId = String(rm.getAttribute('data-remove-member') || '').trim();
          if (!memberId) return;
          void this.removeMember(memberId).catch((error) => this.onMutationError(error));
        });
      }
    });
  }

  async inviteFriendSubmit(data) {
    const board = this.state.board;
    if (!board || !board.project) return;

    const targetUserId = String(data.target_user_id || '').trim().toLowerCase();
    const message = String(data.message || '').trim();
    if (!targetUserId) return;

    await this.rpc('ik_plan_invite_friend', {
      p_project_id: board.project.id,
      p_target_user_id: targetUserId,
      p_message: message
    });

    this.uiPrefs.projectScope = 'shared';
    this.persistUIPrefs();
    this.renderProjectScopeToggle();
    this.ui.closeModal();
    await this.loadProjects({ quiet: true });
    await this.setProjectScope('shared', { force: true });
    await this.selectProject(board.project.id, { force: true });
    await this.loadIncomingInvitations({ quiet: true });
    this.ui.toast('invite sent');
  }

  async cancelInvitation(invitationId) {
    await this.rpc('ik_plan_cancel_invitation', {
      p_invitation_id: invitationId
    });
    this.ui.closeModal();
    await this.loadProjects({ quiet: true });
    await this.setProjectScope(this.uiPrefs.projectScope, { force: true });
    if (this.state.activeProjectId) {
      await this.loadBoard(this.state.activeProjectId);
    }
    this.ui.toast('invite cancelled');
  }

  async removeMember(memberId) {
    const board = this.state.board;
    if (!board || !board.project) return;

    await this.rpc('ik_plan_remove_member', {
      p_project_id: board.project.id,
      p_member_id: memberId
    });

    this.ui.closeModal();
    await this.loadProjects({ quiet: true });
    await this.setProjectScope(this.uiPrefs.projectScope, { force: true });
    if (this.state.activeProjectId) {
      await this.loadBoard(this.state.activeProjectId);
    }
    this.ui.toast('member removed');
  }

  async openIncomingInvitesModal() {
    await this.loadIncomingInvitations({ quiet: true });
    const invites = this.state.incomingInvites;

    const rows = invites.map((row) => {
      const inviter = String(row.inviter_user_id || row.inviter_nickname || row.inviter_id || 'user');
      const project = String(row.project_name || 'project');
      return `
        <div class="friend-card" style="padding:10px; border:1px solid rgba(0,0,0,.14); display:grid; gap:8px;">
          <div style="font-size:11px; letter-spacing:2px; text-transform:uppercase;">${escapeHtml(project)}</div>
          <div style="font-size:12px;">from @${escapeHtml(inviter)}</div>
          <div style="display:flex; gap:8px; justify-content:flex-end;">
            <button class="btn" type="button" data-invite-action="reject" data-id="${escapeAttr(String(row.invitation_id))}">reject</button>
            <button class="btn" type="button" data-invite-action="accept" data-id="${escapeAttr(String(row.invitation_id))}">accept</button>
          </div>
        </div>
      `;
    }).join('');

    this.ui.openModal({
      title: 'incoming invites',
      bodyHtml: `
        <div style="display:grid; gap:10px;">
          ${rows || '<div style="font-size:11px; opacity:.7; letter-spacing:2px; text-transform:uppercase;">no incoming invites</div>'}
        </div>
      `,
      onMount: (bodyEl) => {
        bodyEl.addEventListener('click', (event) => {
          const btn = event.target.closest('[data-invite-action]');
          if (!btn) return;
          const action = String(btn.getAttribute('data-invite-action') || 'reject');
          const id = String(btn.getAttribute('data-id') || '');
          if (!id) return;
          void this.respondIncomingInvite(id, action === 'accept').catch((error) => this.onMutationError(error));
        });
      }
    });
  }

  async respondIncomingInvite(invitationId, accept) {
    const out = await this.rpc('ik_plan_respond_invitation', {
      p_invitation_id: invitationId,
      p_accept: !!accept
    });

    const projectId = out && out.project_id ? String(out.project_id) : null;
    this.ui.closeModal();
    await this.loadIncomingInvitations({ quiet: true });
    await this.loadProjects({ quiet: true });

    if (accept && projectId) {
      this.uiPrefs.projectScope = 'shared';
      this.persistUIPrefs();
      this.renderProjectScopeToggle();
      await this.setProjectScope('shared', { force: true });
      await this.selectProject(projectId, { force: true });
    } else if (this.state.activeProjectId) {
      await this.setProjectScope(this.uiPrefs.projectScope, { force: true });
      await this.loadBoard(this.state.activeProjectId);
    } else {
      await this.setProjectScope(this.uiPrefs.projectScope, { force: true });
    }

    this.ui.toast(accept ? 'invitation accepted' : 'invitation rejected');
  }

  openColumnsModal() {
    const board = this.state.board;
    if (!board || !board.project) {
      this.ui.toast('select project first');
      return;
    }

    const cols = this.getSortedColumns();

    const rowsHtml = cols.map((c) => `
      <div class="cols-row" data-col-row data-id="${escapeAttr(c.id)}">
        <input class="ctl cols-name" value="${escapeAttr(c.name || '')}" maxlength="120" />
        <input class="ctl cols-color" type="color" value="${escapeAttr(c.color || '#111111')}" />
        <label class="cols-done">
          <input type="radio" name="doneCol" value="${escapeAttr(c.id)}" ${String(c.role) === 'done' ? 'checked' : ''} />
          done
        </label>
        <div class="cols-actions">
          <button class="btn" type="button" data-up>^</button>
          <button class="btn" type="button" data-down>v</button>
          <button class="btn" type="button" data-del>x</button>
        </div>
      </div>
    `).join('');

    this.ui.openModal({
      title: 'columns',
      bodyHtml: `
        <form class="form" data-cols-form>
          <div style="font-size:11px; letter-spacing:2px; text-transform:uppercase; opacity:.75;">manage columns</div>

          <div class="cols-list" data-cols-list>
            ${rowsHtml}
          </div>

          <div class="form__actions" style="justify-content:space-between;">
            <button class="btn" type="button" data-add>+ column</button>
            <div style="display:flex; gap:10px;">
              <button class="btn" type="button" data-close>close</button>
              <button class="btn" type="submit">save</button>
            </div>
          </div>
        </form>
      `,
      onSubmit: (data, form) => {
        void this.saveColumnsSubmit(data, form).catch((error) => this.onMutationError(error));
      },
      onMount: (bodyEl) => {
        const list = bodyEl.querySelector('[data-cols-list]');
        const addBtn = bodyEl.querySelector('[data-add]');

        const bindRow = (row) => {
          row.querySelector('[data-up]')?.addEventListener('click', () => {
            const prev = row.previousElementSibling;
            if (prev) list.insertBefore(row, prev);
          });

          row.querySelector('[data-down]')?.addEventListener('click', () => {
            const next = row.nextElementSibling;
            if (next) list.insertBefore(next, row);
          });

          row.querySelector('[data-del]')?.addEventListener('click', () => {
            const rows = list.querySelectorAll('[data-col-row]');
            if (rows.length <= 1) {
              this.ui.toast('at least one column required');
              return;
            }
            row.remove();
          });
        };

        Array.from(list.querySelectorAll('[data-col-row]')).forEach(bindRow);

        addBtn?.addEventListener('click', () => {
          const id = uid();
          const row = document.createElement('div');
          row.className = 'cols-row';
          row.setAttribute('data-col-row', '');
          row.setAttribute('data-id', id);
          row.innerHTML = `
            <input class="ctl cols-name" value="new column" maxlength="120" />
            <input class="ctl cols-color" type="color" value="#111111" />
            <label class="cols-done">
              <input type="radio" name="doneCol" value="${escapeAttr(id)}" />
              done
            </label>
            <div class="cols-actions">
              <button class="btn" type="button" data-up>^</button>
              <button class="btn" type="button" data-down>v</button>
              <button class="btn" type="button" data-del>x</button>
            </div>
          `;
          list.appendChild(row);
          bindRow(row);
        });
      }
    });
  }

  async saveColumnsSubmit(data, form) {
    const board = this.state.board;
    if (!board || !board.project) return;

    const list = form.querySelector('[data-cols-list]');
    const rows = Array.from(list.querySelectorAll('[data-col-row]'));
    if (!rows.length) {
      this.ui.toast('at least one column required');
      return;
    }

    const prevById = new Map(this.getSortedColumns().map((col) => [String(col.id), col]));

    const next = rows.map((row) => {
      const id = String(row.getAttribute('data-id') || '').trim();
      const name = String(row.querySelector('.cols-name')?.value || '').trim() || 'column';
      const color = String(row.querySelector('.cols-color')?.value || '#111111').trim() || '#111111';
      const prevRole = String((prevById.get(id) || {}).role || 'todo');
      return { id, name, color, role: prevRole === 'done' ? 'done' : prevRole === 'doing' ? 'doing' : 'todo' };
    });

    const doneId = String(data.doneCol || '').trim();
    if (doneId) {
      const doneCol = next.find((c) => String(c.id) === doneId);
      if (doneCol) doneCol.role = 'done';
    }

    await this.rpc('ik_plan_save_columns', {
      p_project_id: board.project.id,
      p_columns: next,
      p_base_revision: board.project.revision
    });

    this.ui.closeModal();
    await this.loadBoard(board.project.id);
    this.ui.toast('columns saved');
  }

  openCreateCardModal() {
    const board = this.state.board;
    if (!board || !board.project) {
      this.ui.toast('select project first');
      return;
    }

    const columns = this.getSortedColumns();
    if (!columns.length) {
      this.ui.toast('no columns');
      return;
    }

    const options = columns
      .map((c) => `<option value="${escapeAttr(c.id)}">${escapeHtml(String(c.name || '').toUpperCase())}</option>`)
      .join('');
    const assigneeOptions = this.assigneeOptionsHtml('');

    this.ui.openModal({
      title: 'new task',
      bodyHtml: `
        <form class="form">
          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            name
            <input class="ctl" name="name" required maxlength="240" />
          </label>

          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            description
            <textarea class="ctl" name="description" rows="4" maxlength="4000"></textarea>
          </label>

          <div class="form__grid2">
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              column
              <select class="ctl" name="column_id">${options}</select>
            </label>

            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              priority
              <select class="ctl" name="priority">
                ${PRIORITIES.map((p) => `<option value="${p.key}">${p.label}</option>`).join('')}
              </select>
            </label>
          </div>

          <div class="form__grid2">
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              deadline
              <input class="ctl" name="deadline" type="date" />
            </label>

            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              tags
              <input class="ctl" name="tags" maxlength="120" placeholder="study, work" />
            </label>
          </div>

          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            assignee
            <select class="ctl" name="assignee_id">${assigneeOptions}</select>
          </label>

          <div class="form__actions">
            <button class="btn" type="button" data-close>cancel</button>
            <button class="btn" type="submit">create</button>
          </div>
        </form>
      `,
      onSubmit: (data) => {
        void this.createCardSubmit(data).catch((error) => this.onMutationError(error));
      }
    });
  }

  async createCardSubmit(data) {
    const board = this.state.board;
    if (!board || !board.project) return;

    const name = String(data.name || '').trim();
    if (!name) return;

    const payload = {
      p_project_id: board.project.id,
      p_column_id: String(data.column_id || '').trim(),
      p_name: name,
      p_description: String(data.description || '').trim(),
      p_priority: String(data.priority || 'mid'),
      p_deadline: String(data.deadline || '').trim() || null,
      p_tags: parseTags(data.tags),
      p_assignee_id: String(data.assignee_id || '').trim() || null,
      p_base_revision: board.project.revision
    };

    try {
      await this.rpc('ik_plan_create_card', payload);
    } catch (error) {
      const low = briefError(error).toLowerCase();
      const code = String((error && error.code) || '').toUpperCase();
      if (code === '42883' && low.includes('ik_plan_create_card')) {
        const fallback = { ...payload };
        delete fallback.p_assignee_id;
        await this.rpc('ik_plan_create_card', fallback);
        if (payload.p_assignee_id) {
          this.ui.toast('apply stage10 sql for assignee support');
        }
      } else {
        throw error;
      }
    }

    this.ui.closeModal();
    await this.loadBoard(board.project.id);
    this.ui.toast('task created');
  }

  openCardModal(cardId) {
    const board = this.state.board;
    if (!board || !board.project) return;

    const card = this.findCardById(cardId);
    if (!card) return;

    const columns = this.getSortedColumns();
    const colOptions = columns
      .map((c) => `<option value="${escapeAttr(c.id)}" ${String(c.id) === String(card.column_id) ? 'selected' : ''}>${escapeHtml(String(c.name || '').toUpperCase())}</option>`)
      .join('');
    const assigneeOptions = this.assigneeOptionsHtml(String(card.assignee_id || ''));

    this.startCurrentEditing(card.id);

    this.ui.openModal({
      title: 'task',
      bodyHtml: `
        <form class="form">
          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            name
            <input class="ctl" name="name" required maxlength="240" value="${escapeAttr(card.name || '')}" />
          </label>

          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            description
            <textarea class="ctl" name="description" rows="5" maxlength="4000">${escapeHtml(card.description || '')}</textarea>
          </label>

          <div class="form__grid2">
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              column
              <select class="ctl" name="column_id">${colOptions}</select>
            </label>

            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              priority
              <select class="ctl" name="priority">
                ${PRIORITIES.map((p) => `<option value="${p.key}" ${String(card.priority) === p.key ? 'selected' : ''}>${p.label}</option>`).join('')}
              </select>
            </label>
          </div>

          <div class="form__grid2">
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              deadline
              <input class="ctl" name="deadline" type="date" value="${escapeAttr(card.deadline || '')}" />
            </label>

            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              tags
              <input class="ctl" name="tags" maxlength="120" value="${escapeAttr(asArray(card.tags).join(', '))}" />
            </label>
          </div>

          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            assignee
            <select class="ctl" name="assignee_id">${assigneeOptions}</select>
          </label>

          <div class="form__actions">
            <button class="btn" type="button" data-close>close</button>
            <button class="btn" type="submit">save</button>
          </div>
        </form>
      `,
      onSubmit: (data) => {
        void this.updateCardSubmit(card, data).catch((error) => this.onMutationError(error));
      }
    });
  }

  async updateCardSubmit(baseCard, data) {
    const board = this.state.board;
    if (!board || !board.project) return;

    const name = String(data.name || '').trim();
    if (!name) return;

    const payload = {
      p_project_id: board.project.id,
      p_card_id: baseCard.id,
      p_name: name,
      p_description: String(data.description || '').trim(),
      p_priority: String(data.priority || 'mid').toLowerCase(),
      p_deadline: String(data.deadline || '').trim() || null,
      p_tags: parseTags(data.tags),
      p_column_id: String(data.column_id || '').trim() || null,
      p_assignee_id: String(data.assignee_id || '').trim() || null,
      p_base_version: baseCard.version,
      p_base_revision: board.project.revision
    };

    try {
      await this.rpc('ik_plan_update_card', payload);
    } catch (error) {
      const low = briefError(error).toLowerCase();
      const code = String((error && error.code) || '').toUpperCase();
      if (code === '42883' && low.includes('ik_plan_update_card')) {
        const fallback = { ...payload };
        delete fallback.p_assignee_id;
        await this.rpc('ik_plan_update_card', fallback);
        if (payload.p_assignee_id) {
          this.ui.toast('apply stage10 sql for assignee support');
        }
      } else {
        throw error;
      }
    }

    this.ui.closeModal();
    await this.loadBoard(board.project.id);
    this.ui.toast('task saved');
  }

  openDeleteCardModal(cardId) {
    const card = this.findCardById(cardId);
    if (!card) return;

    this.ui.openModal({
      title: 'delete task',
      bodyHtml: `
        <form class="form">
          <div style="font-size:11px; letter-spacing:2px; text-transform:uppercase; opacity:.8; line-height:1.5;">
            delete task ${escapeHtml(String(card.name || '').toUpperCase())}?
          </div>
          <div class="form__actions">
            <button class="btn" type="button" data-close>cancel</button>
            <button class="btn" type="submit">delete</button>
          </div>
        </form>
      `,
      onSubmit: () => {
        void this.deleteCardSubmit(card).catch((error) => this.onMutationError(error));
      }
    });
  }

  async deleteCardSubmit(card) {
    const board = this.state.board;
    if (!board || !board.project) return;

    await this.rpc('ik_plan_delete_card', {
      p_project_id: board.project.id,
      p_card_id: card.id,
      p_base_version: card.version,
      p_base_revision: board.project.revision
    });

    this.ui.closeModal();
    await this.loadBoard(board.project.id);
    this.ui.toast('task deleted');
  }

  startCurrentEditing(cardId) {
    this.stopCurrentEditing();

    const id = String(cardId || '').trim();
    if (!id) return;

    this.currentEditingCardId = id;
    this.sendEditingSignal(id, true);
    this.editingPingTimer = setInterval(() => {
      if (!this.currentEditingCardId) return;
      this.sendEditingSignal(this.currentEditingCardId, true);
    }, EDITING_PING_MS);
  }

  stopCurrentEditing() {
    const id = this.currentEditingCardId;
    this.currentEditingCardId = null;

    if (this.editingPingTimer) {
      clearInterval(this.editingPingTimer);
      this.editingPingTimer = null;
    }

    if (id) {
      this.sendEditingSignal(id, false);
    }
  }

  sendEditingSignal(cardId, editing) {
    if (!this.channel || !cardId) return;

    const payload = {
      project_id: this.state.activeProjectId,
      card_id: cardId,
      user_id: this.user ? this.user.id : null,
      nickname: this.resolveSelfName(),
      editing: !!editing,
      ts: Date.now()
    };

    this.channel.send({
      type: 'broadcast',
      event: 'editing',
      payload
    }).catch(() => {});
  }

  onEditingBroadcast(payload) {
    if (!payload || typeof payload !== 'object') return;

    const userId = String(payload.user_id || '').trim();
    const cardId = String(payload.card_id || '').trim();
    const projectId = String(payload.project_id || '').trim();

    if (!userId || !cardId || !projectId) return;
    if (String(this.state.activeProjectId || '') !== projectId) return;
    if (String(this.user && this.user.id || '') === userId) return;

    const key = `${userId}:${cardId}`;

    if (payload.editing) {
      this.editingByKey.set(key, {
        userId,
        cardId,
        nickname: String(payload.nickname || userId),
        ts: Number(payload.ts || Date.now())
      });
    } else {
      this.editingByKey.delete(key);
    }

    this.updateEditingBadges();
  }

  cleanupEditingMap() {
    const now = Date.now();
    let changed = false;
    for (const [key, entry] of this.editingByKey.entries()) {
      if (now - Number(entry.ts || 0) > EDITING_TTL_MS) {
        this.editingByKey.delete(key);
        changed = true;
      }
    }
    if (changed) this.updateEditingBadges();
  }

  editorsForCard(cardId) {
    const now = Date.now();
    const out = [];
    const seen = new Set();

    for (const entry of this.editingByKey.values()) {
      if (String(entry.cardId) !== String(cardId)) continue;
      if (now - Number(entry.ts || 0) > EDITING_TTL_MS) continue;
      if (seen.has(entry.userId)) continue;
      seen.add(entry.userId);
      out.push(String(entry.nickname || entry.userId));
    }

    return out;
  }

  updateEditingBadges() {
    if (!this.els.boardView) return;

    const cards = this.els.boardView.querySelectorAll('.card[data-id]');
    cards.forEach((cardEl) => {
      const cardId = String(cardEl.getAttribute('data-id') || '');
      const editors = this.editorsForCard(cardId);
      const label = cardEl.querySelector('[data-editing]');
      if (!label) return;
      label.textContent = editors.length ? `editing: ${editors.join(', ')}` : '';
    });
  }

  async onMutationError(error) {
    const text = briefError(error);
    const low = text.toLowerCase();

    if (looksLikeSchemaError(error)) {
      if (!this.schemaWarnShown) {
        this.schemaWarnShown = true;
        this.ui.toast('apply SQL: supabase/sql/stage9_planning_collab.sql then supabase/sql/stage10_planning_shared_personal_tasks.sql');
      }
      this.clearProjectsRetry();
      this.setActionsDisabled(true);
      this.setCloudBadge('off', 'planning sql missing');
      return;
    }

    if (looksTransientError(error)) {
      this.setCloudBadge('sync', 'network issue, retrying');
      this.scheduleProjectsRetry();
      this.ui.toast('network issue, retrying');
      return;
    }

    if (low.includes('revision_conflict') || low.includes('version_conflict')) {
      this.ui.toast('conflict detected, refreshing board');
      if (this.state.activeProjectId) {
        await this.loadBoard(this.state.activeProjectId);
      }
      return;
    }

    if (low.includes('not_friends')) {
      this.ui.toast('you can invite only friends');
      return;
    }

    if (low.includes('target_user_not_found')) {
      this.ui.toast('user-id not found');
      return;
    }

    if (low.includes('already_member')) {
      this.ui.toast('user is already in project');
      return;
    }

    if (low.includes('assignee_not_member')) {
      this.ui.toast('assignee must be a project member');
      return;
    }

    if (low.includes('member_not_found')) {
      this.ui.toast('member not found');
      return;
    }

    if (low.includes('owner_cannot_leave')) {
      this.ui.toast('owner cannot be removed from project');
      return;
    }

    if (low.includes('invitation_not_pending')) {
      this.ui.toast('invitation already resolved');
      return;
    }

    if (low.includes('only_owner_can_delete_project')) {
      this.ui.toast('only owner can delete project');
      return;
    }

    if (low.includes('invitation_expired')) {
      this.ui.toast('invitation expired');
      await this.loadIncomingInvitations({ quiet: true });
      return;
    }

    if (low.includes('forbidden')) {
      this.ui.toast('access denied');
      return;
    }

    this.ui.toast(text);
  }
}
