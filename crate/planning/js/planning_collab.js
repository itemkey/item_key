const UI_PREFS_KEY = 'itemkey_planning_ui_v2';
const ACTIVE_PROJECT_KEY = 'itemkey_planning_active_project_v2';
const CARD_DRAFT_KEY_PREFIX = 'itemkey_planning_card_draft_v1__';
const INCOMING_REFRESH_MS = 15000;
const BOARD_RELOAD_DEBOUNCE_MS = 120;
const EDITING_TTL_MS = 30000;
const EDITING_PING_MS = 10000;
const PROJECTS_RETRY_MS = 6000;
const LIVE_EVENTS_POLL_MS = 1500;
const FRIENDS_CACHE_MS = 30000;
const PERSONAL_PLAN_ORDER_KEY_PREFIX = 'itemkey_planning_ps_plan_order_v1__';

const PROJECT_SCOPES = ['personal', 'shared', 'all'];
const ASSIGNEE_FILTERS = ['all', 'me', 'unassigned'];

const PRIORITIES = [
  { key: 'low', label: 'LOW' },
  { key: 'mid', label: 'MID' },
  { key: 'high', label: 'HIGH' }
];

const SCHEDULE_RANGES = ['today', 'this_week', 'next_week', 'two_weeks', 'month'];
const SCHEDULE_TEMPLATE_KEYS = ['none', 'study', 'work', 'balanced'];
const PERSONAL_SCHEDULE_TABS = ['today', 'lists', 'calendar'];
const PERSONAL_REPEAT_RULES = ['none', 'daily', 'weekly', 'monthly', 'yearly', 'weekdays', 'weekends'];

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

function addMinutes(date, minutes) {
  return new Date(date.getTime() + Number(minutes || 0) * 60000);
}

function startOfWeekLocal(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const shift = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + shift);
  return d;
}

function startOfMonthLocal(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatTimeHM(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatDateTimeInputValue(date) {
  return `${formatLocalISO(date)}T${formatTimeHM(date)}`;
}

function parseDateTimeInput(value) {
  const s = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return null;
  const [datePart, timePart] = s.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
}

function toLocalDayKey(dateValue) {
  const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  return formatLocalISO(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
}

function eventTimeLabel(startAt, endAt, allDay, lang = 'ru') {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (!(start instanceof Date) || Number.isNaN(start.getTime()) || !(end instanceof Date) || Number.isNaN(end.getTime())) {
    return lang === 'en' ? 'time unknown' : 'время не указано';
  }
  if (allDay) return lang === 'en' ? 'all day' : 'весь день';
  return `${formatTimeHM(start)} - ${formatTimeHM(end)}`;
}

function shortText(value, limit = 140) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(1, limit - 1)).trimEnd()}…`;
}

function normalizeTimeText(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const m = raw.match(/^(\d{2}:\d{2})(?::\d{2})?$/);
  return m ? m[1] : '';
}

function normalizeRepeatRule(value) {
  const key = String(value || '').toLowerCase();
  return PERSONAL_REPEAT_RULES.includes(key) ? key : 'none';
}

function dayDiffLocal(a, b) {
  const ad = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bd = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  const ms = bd.getTime() - ad.getTime();
  return Math.round(ms / 86400000);
}

function timeLabelHM(startTime, endTime, lang = 'ru') {
  const st = normalizeTimeText(startTime);
  const et = normalizeTimeText(endTime);
  if (st && et) return `${st} - ${et}`;
  if (st) return st;
  if (et) return et;
  return lang === 'en' ? 'no time' : 'без времени';
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

function roleLabel(role, lang = 'en') {
  const r = String(role || '').toLowerCase();
  const ru = lang === 'ru';
  if (r === 'owner') return ru ? 'владелец' : 'OWNER';
  if (r === 'editor') return ru ? 'редактор' : 'EDITOR';
  if (r === 'viewer') return ru ? 'наблюдатель' : 'VIEWER';
  return ru ? 'участник' : 'MEMBER';
}

export class PlanningCollabApp {
  constructor(ui, els) {
    this.ui = ui;
    this.els = els;

    const todayIso = formatLocalISO(new Date());

    this.client = null;
    this.user = null;
    this.profile = null;

    this.state = {
      projects: [],
      board: null,
      activeProjectId: null,
      friends: [],
      incomingInvites: [],
      realtimeStatus: 'off',
      presence: [],
      schedule: {
        events: [],
        loading: false,
        available: true,
        unavailableReason: '',
        lastRangeKey: '',
        workspace: {
          lists: [],
          plans: [],
          calendarCounts: [],
          loading: false,
          available: true,
          unavailableReason: '',
          lastProjectId: '',
          selectedDay: todayIso,
          monthAnchor: todayIso,
          tab: 'today'
        }
      }
    };

    this.uiPrefs = this.loadUIPrefs();
    this.state.schedule.workspace.tab = this.normalizePersonalScheduleTab(this.uiPrefs.scheduleTab);
    this.state.schedule.workspace.selectedDay = parseISOToLocalDate(this.uiPrefs.scheduleSelectedDay)
      ? String(this.uiPrefs.scheduleSelectedDay)
      : todayIso;
    this.state.schedule.workspace.monthAnchor = parseISOToLocalDate(this.uiPrefs.scheduleMonthAnchor)
      ? String(this.uiPrefs.scheduleMonthAnchor)
      : todayIso;
    this.channel = null;
    this.boardReloadTimer = null;
    this.projectsRetryTimer = null;
    this.liveEventsTimer = null;
    this.inboxPollTimer = null;
    this.editingGcTimer = null;
    this.editingPingTimer = null;
    this.boardLoadInFlight = false;
    this.lastRealtimeEventAt = 0;
    this.friendsLoadedAt = 0;
    this.currentEditingCardId = null;
    this.editingByKey = new Map();
    this.schemaWarnShown = false;
    this.scheduleSchemaWarnShown = false;
    this.personalScheduleSchemaWarnShown = false;
    this.actionsHardDisabled = false;
    this.handlersBound = false;
    this.personalScheduleDrag = null;
    this.personalPlanOrderProjectId = '';
    this.personalPlanOrderByList = new Map();
    this.scopeReturnProjectId = '';

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

    this.client.auth.onAuthStateChange((evt, session) => {
      const nextUser = session && session.user ? session.user : null;
      const nextId = nextUser ? String(nextUser.id) : '';
      const currentId = this.user ? String(this.user.id) : '';

      const eventType = String(evt || '').toUpperCase();
      if (nextId && nextId !== currentId) {
        window.location.reload();
        return;
      }

      if (!nextId && (eventType === 'SIGNED_OUT' || eventType === 'USER_DELETED')) {
        window.location.reload();
      }
    });

    await this.loadProfile();
    await this.loadFriends({ quiet: true });
    await this.loadIncomingInvitations({ quiet: true });

    const loaded = await this.loadProjects();
    this.renderInboxButton();
    if (!loaded) {
      this.state.activeProjectId = null;
      this.state.board = null;
      this.state.schedule.events = [];
      this.state.schedule.lastRangeKey = '';
      this.renderProjectSelect();
      this.renderProjectBar();
      this.renderAssigneeFilter();
      this.renderSchedule();

      if (this.schemaWarnShown) {
        this.renderEmptyBoard(this.t('структура planning устарела. примените stage9 + stage10 sql.', 'planning schema is outdated. apply stage9 + stage10 sql.'));
        this.setActionsDisabled(true);
        return;
      }

      this.renderEmptyBoard(this.t('проекты временно недоступны. проверьте сеть и повторите.', 'projects are temporarily unavailable. check network and retry.'), { retry: true });
      this.scheduleProjectsRetry();
      this.startBackgroundLoops();
      this.setActionsDisabled(false);
      this.syncToolbarByProject();
      this.setCloudBadge('sync', this.t('проекты недоступны', 'projects unavailable'));
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
        this.renderEmptyBoard(this.t('в этом разделе нет проектов. переключите фильтр.', 'no projects in this section. switch scope filter.'));
        this.setCloudBadge('ready', this.t('нет проектов в разделе', 'no projects in scope'));
      } else {
        this.renderEmptyBoard(this.t('проектов пока нет. создайте первый проект.', 'no projects yet. create your first project.'));
        this.setCloudBadge('ready', this.t('нет активного проекта', 'no active project'));
      }
    }

    this.startBackgroundLoops();
    this.setActionsDisabled(false);
    this.syncToolbarByProject();
  }

  getLang() {
    try {
      if (window.IKSiteLang && typeof window.IKSiteLang.get === 'function') {
        return window.IKSiteLang.get() === 'en' ? 'en' : 'ru';
      }
    } catch (_) {}
    return String(document.documentElement.lang || '').toLowerCase().startsWith('en') ? 'en' : 'ru';
  }

  t(ru, en) {
    return this.getLang() === 'en' ? en : ru;
  }

  normalizeScopeValue(scope) {
    const s = String(scope || '').toLowerCase();
    return PROJECT_SCOPES.includes(s) ? s : 'all';
  }

  normalizeProjectKind(kind) {
    return String(kind || '').toLowerCase() === 'schedule' ? 'schedule' : 'board';
  }

  normalizeScheduleRange(range) {
    const value = String(range || '').toLowerCase();
    return SCHEDULE_RANGES.includes(value) ? value : 'this_week';
  }

  normalizePersonalScheduleTab(tab) {
    const value = String(tab || '').toLowerCase();
    return PERSONAL_SCHEDULE_TABS.includes(value) ? value : 'today';
  }

  activeProjectMeta() {
    const activeId = String(this.state.activeProjectId || '');
    if (!activeId) return null;
    return this.state.projects.find((p) => String(p.id) === activeId) || null;
  }

  activeProjectKind() {
    const target = this.activeProjectMeta();
    return this.normalizeProjectKind(target && target.kind);
  }

  isScheduleProject(project = null) {
    const target = project || this.activeProjectMeta();
    return this.normalizeProjectKind(target && target.kind) === 'schedule';
  }

  readScheduleAnchorDate() {
    const parsed = parseISOToLocalDate(this.uiPrefs.scheduleAnchor);
    if (parsed) return parsed;
    return new Date();
  }

  normalizeProjectScope(project) {
    if (this.normalizeProjectKind(project && project.kind) === 'schedule') {
      return 'personal';
    }
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

  rememberScopeReturnProject(projectId) {
    const id = String(projectId || '').trim();
    if (!id) return;
    if (!this.state.projects.some((p) => String(p.id) === id)) return;
    this.scopeReturnProjectId = id;
  }

  resolveScopedProjectId(scopedProjects, options = {}) {
    const rows = asArray(scopedProjects);
    if (!rows.length) return '';

    const rowById = new Map(rows.map((project) => [String(project.id || ''), project]));
    const preferred = [];
    const pushPreferred = (value) => {
      const id = String(value || '').trim();
      if (!id) return;
      if (preferred.includes(id)) return;
      preferred.push(id);
    };

    pushPreferred(options.preferId);
    pushPreferred(this.scopeReturnProjectId);
    pushPreferred(this.readStoredActiveProjectId());

    for (const id of preferred) {
      if (rowById.has(id)) return id;
    }

    const boardFirst = rows.find((project) => this.normalizeProjectKind(project && project.kind) !== 'schedule');
    if (boardFirst && boardFirst.id) return String(boardFirst.id);

    return String(rows[0] && rows[0].id || '');
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
      this.rememberScopeReturnProject(this.state.activeProjectId);
      await this.unsubscribeProject();
      this.state.activeProjectId = null;
      this.state.board = null;
      this.state.schedule.events = [];
      this.state.schedule.lastRangeKey = '';
      this.renderProjectSelect();
      this.renderProjectBar();
      this.renderPresence();
      this.renderAssigneeFilter();
      this.renderBoard();
      this.renderSchedule();
      this.syncToolbarByProject();
      return true;
    }

    const stillVisible = scoped.some((p) => String(p.id) === String(this.state.activeProjectId || ''));
    if (!stillVisible) {
      const nextId = this.resolveScopedProjectId(scoped, {
        preferId: this.state.activeProjectId
      });
      this.state.activeProjectId = nextId || scoped[0].id;
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
      this.renderSchedule();
      this.renderAssigneeFilter();
      this.renderPresence();
      this.syncToolbarByProject();
      return;
    }

    if (!scoped.length) {
      this.rememberScopeReturnProject(this.state.activeProjectId);
      await this.unsubscribeProject();
      this.state.activeProjectId = null;
      this.state.board = null;
      this.state.schedule.events = [];
      this.state.schedule.lastRangeKey = '';
      this.renderProjectSelect();
      this.renderProjectBar();
      this.renderPresence();
      this.renderAssigneeFilter();
      this.renderBoard();
      this.renderSchedule();
      this.syncToolbarByProject();
      return;
    }

    const nextId = this.resolveScopedProjectId(scoped, {
      preferId: this.state.activeProjectId
    });
    await this.selectProject(nextId || scoped[0].id, { force: true });
  }

  bindHandlers() {
    if (this.handlersBound) return;
    this.handlersBound = true;

    const refreshViews = () => {
      this.renderBoard();
      this.renderSchedule();
    };

    document.addEventListener('ik:languagechange', () => {
      this.renderProjectScopeToggle();
      this.renderProjectSelect();
      this.renderProjectBar();
      this.renderInboxButton();
      this.renderAssigneeFilter();
      this.syncToolbarByProject();
      refreshViews();
    });

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
        refreshViews();
      });
    }

    if (this.els.tagsFilter) {
      this.els.tagsFilter.addEventListener('input', () => {
        this.uiPrefs.tags = String(this.els.tagsFilter.value || '').trim();
        this.persistUIPrefs();
        refreshViews();
      });
    }

    if (this.els.assigneeFilter) {
      this.els.assigneeFilter.addEventListener('change', () => {
        const next = String(this.els.assigneeFilter.value || 'all');
        this.uiPrefs.assignee = next || 'all';
        this.persistUIPrefs();
        refreshViews();
      });
    }

    if (this.els.priorityFilter) {
      this.els.priorityFilter.addEventListener('change', () => {
        this.uiPrefs.priority = String(this.els.priorityFilter.value || 'all');
        this.persistUIPrefs();
        refreshViews();
      });
    }

    if (this.els.deadlineFilter) {
      this.els.deadlineFilter.addEventListener('change', () => {
        this.uiPrefs.deadline = String(this.els.deadlineFilter.value || 'all');
        this.persistUIPrefs();
        refreshViews();
      });
    }

    if (this.els.sortSelect) {
      this.els.sortSelect.addEventListener('change', () => {
        this.uiPrefs.sort = String(this.els.sortSelect.value || 'default');
        this.persistUIPrefs();
        refreshViews();
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
        refreshViews();
        this.ui.toast(this.t('фильтры очищены', 'filters cleared'));
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
      this.els.btnInviteFriend.addEventListener('click', () => {
        void this.openInviteFriendModal().catch((error) => this.onMutationError(error));
      });
    }

    if (this.els.btnInvitesInbox) {
      this.els.btnInvitesInbox.addEventListener('click', () => {
        void this.openIncomingInvitesModal().catch((error) => this.onMutationError(error));
      });
    }

    if (this.els.btnNewEvent) {
      this.els.btnNewEvent.addEventListener('click', () => {
        void this.openCreateScheduleProjectModal().catch((error) => this.onMutationError(error));
      });
    }

    if (this.els.scheduleView) {
      this.els.scheduleView.addEventListener('click', (event) => {
        if (this.isScheduleProject()) {
          this.handlePersonalScheduleClick(event);
          return;
        }

        const rangeBtn = event.target.closest('[data-schedule-range]');
        if (rangeBtn) {
          const range = String(rangeBtn.getAttribute('data-schedule-range') || 'this_week');
          void this.setScheduleRange(range).catch((error) => this.onMutationError(error));
          return;
        }

        const navBtn = event.target.closest('[data-schedule-nav]');
        if (navBtn) {
          const mode = String(navBtn.getAttribute('data-schedule-nav') || 'today');
          if (mode === 'today') {
            void this.setScheduleAnchor(new Date(), { forceReload: true }).catch((error) => this.onMutationError(error));
          } else {
            void this.shiftScheduleWindow(mode === 'prev' ? -1 : 1).catch((error) => this.onMutationError(error));
          }
          return;
        }

        const addDayBtn = event.target.closest('[data-schedule-add-day]');
        if (addDayBtn) {
          const dayKey = String(addDayBtn.getAttribute('data-schedule-add-day') || '');
          void this.openCreateScheduleEventModal({ day: dayKey }).catch((error) => this.onMutationError(error));
          return;
        }

        const openBtn = event.target.closest('[data-schedule-open]');
        if (openBtn) {
          const eventId = String(openBtn.getAttribute('data-schedule-open') || '');
          if (eventId) void this.openScheduleEventModal(eventId).catch((error) => this.onMutationError(error));
          return;
        }

        const delBtn = event.target.closest('[data-schedule-del]');
        if (delBtn) {
          const eventId = String(delBtn.getAttribute('data-schedule-del') || '');
          if (eventId) void this.openDeleteScheduleEventModal(eventId).catch((error) => this.onMutationError(error));
          return;
        }

        const addBtn = event.target.closest('[data-schedule-new]');
        if (addBtn) {
          void this.openCreateScheduleEventModal().catch((error) => this.onMutationError(error));
          return;
        }

        const copyBtn = event.target.closest('[data-schedule-copy-week]');
        if (copyBtn) {
          void this.copyCurrentWeekToNext().catch((error) => this.onMutationError(error));
        }
      });

      this.els.scheduleView.addEventListener('submit', (event) => {
        if (this.isScheduleProject()) {
          this.handlePersonalScheduleSubmit(event);
          return;
        }

        const form = event.target.closest('[data-schedule-quick-form]');
        if (!form) return;
        event.preventDefault();
        const fd = new FormData(form);
        const raw = String(fd.get('quick') || '').trim();
        if (!raw) return;
        void this.quickAddSchedule(raw).catch((error) => this.onMutationError(error));
      });

      this.els.scheduleView.addEventListener('dragstart', (event) => {
        if (!this.isScheduleProject()) return;
        this.handlePersonalScheduleDragStart(event);
      });

      this.els.scheduleView.addEventListener('dragover', (event) => {
        if (!this.isScheduleProject()) return;
        this.handlePersonalScheduleDragOver(event);
      });

      this.els.scheduleView.addEventListener('drop', (event) => {
        if (!this.isScheduleProject()) return;
        void this.handlePersonalScheduleDrop(event).catch((error) => this.onMutationError(error));
      });

      this.els.scheduleView.addEventListener('dragend', () => {
        if (!this.isScheduleProject()) return;
        this.handlePersonalScheduleDragEnd();
      });

      this.els.scheduleView.addEventListener('dragleave', (event) => {
        if (!this.isScheduleProject()) return;
        const related = event.relatedTarget;
        if (related instanceof Node && this.els.scheduleView.contains(related)) return;
        this.clearPersonalScheduleDragHints();
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

    if (!this.liveEventsTimer) {
      this.liveEventsTimer = setInterval(() => {
        void this.pollProjectEventsFallback().catch(() => {});
      }, LIVE_EVENTS_POLL_MS);
    }
  }

  async pollProjectEventsFallback() {
    if (!this.state.activeProjectId || !this.state.board || !this.state.board.project) return;
    if (this.boardLoadInFlight) return;
    if (typeof document !== 'undefined' && document.hidden) return;

    const projectId = String(this.state.activeProjectId || '');
    if (!projectId) return;

    const currentRevision = Number(this.state.board.project.revision || 0);
    if (!Number.isFinite(currentRevision)) return;

    if (this.state.realtimeStatus === 'SUBSCRIBED' && Date.now() - this.lastRealtimeEventAt < LIVE_EVENTS_POLL_MS * 2) {
      return;
    }

    try {
      const events = await this.rpc('ik_plan_get_events_since', {
        p_project_id: projectId,
        p_since: currentRevision
      });
      if (asArray(events).length > 0) {
        this.lastRealtimeEventAt = Date.now();
        this.scheduleBoardReload(0);
        if (this.uiPrefs.view === 'schedule') {
          void this.loadScheduleWindow({ force: true }).catch(() => {});
        }
      }
    } catch (_) {}
  }

  loadUIPrefs() {
    const todayIso = formatLocalISO(new Date());
    const defaults = {
      projectScope: 'all',
      q: '',
      assignee: 'all',
      tags: '',
      priority: 'all',
      deadline: 'all',
      sort: 'default',
      view: 'board',
      scheduleRange: 'this_week',
      scheduleAnchor: todayIso,
      scheduleTab: 'today',
      scheduleSelectedDay: todayIso,
      scheduleMonthAnchor: todayIso
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
        view: ['board', 'schedule'].includes(String(parsed.view)) ? String(parsed.view) : defaults.view,
        scheduleRange: this.normalizeScheduleRange(parsed.scheduleRange),
        scheduleAnchor: parseISOToLocalDate(parsed.scheduleAnchor) ? String(parsed.scheduleAnchor) : todayIso,
        scheduleTab: this.normalizePersonalScheduleTab(parsed.scheduleTab),
        scheduleSelectedDay: parseISOToLocalDate(parsed.scheduleSelectedDay) ? String(parsed.scheduleSelectedDay) : todayIso,
        scheduleMonthAnchor: parseISOToLocalDate(parsed.scheduleMonthAnchor) ? String(parsed.scheduleMonthAnchor) : todayIso
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

  cardDraftKey(mode, projectId, cardId = '') {
    const m = mode === 'edit' ? 'edit' : 'create';
    const p = String(projectId || 'none');
    const c = String(cardId || 'none');
    return `${CARD_DRAFT_KEY_PREFIX}${m}__${p}__${c}`;
  }

  loadCardDraft(mode, projectId, cardId = '') {
    try {
      const raw = localStorage.getItem(this.cardDraftKey(mode, projectId, cardId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  saveCardDraft(mode, projectId, cardId, payload) {
    try {
      const value = payload && typeof payload === 'object' ? payload : {};
      localStorage.setItem(this.cardDraftKey(mode, projectId, cardId), JSON.stringify(value));
    } catch (_) {}
  }

  clearCardDraft(mode, projectId, cardId = '') {
    try {
      localStorage.removeItem(this.cardDraftKey(mode, projectId, cardId));
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
    this.actionsHardDisabled = !!disabled;
    const ids = [
      this.els.btnNewProject,
      this.els.btnNewTask,
      this.els.btnInviteFriend,
      this.els.btnInvitesInbox,
      this.els.btnNewEvent,
      this.els.viewSelect
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

  syncToolbarByProject() {
    const body = typeof document !== 'undefined' ? document.body : null;
    const titleEl = typeof document !== 'undefined' ? document.querySelector('.planning-title h1') : null;

    if (this.actionsHardDisabled) {
      if (body) body.classList.remove('planning-mode-schedule');
      if (titleEl) {
        titleEl.textContent = this.t('планирование', 'planning');
      }
      return;
    }

    const hasProject = !!this.state.activeProjectId;
    const scheduleMode = hasProject && this.isScheduleProject();

    if (body) {
      body.classList.toggle('planning-mode-schedule', scheduleMode);
    }

    if (titleEl) {
      titleEl.textContent = scheduleMode
        ? this.t('расписание', 'schedule')
        : this.t('планирование', 'planning');
    }

    if (this.els.searchInput) {
      this.els.searchInput.placeholder = scheduleMode
        ? this.t('поиск планов…', 'search plans…')
        : this.t('поиск задач…', 'search tasks…');
    }

    const hiddenInSchedule = [
      this.els.projectScope,
      this.els.assigneeFilter,
      this.els.tagsFilter,
      this.els.deadlineFilter,
      this.els.sortSelect,
      this.els.clearFilters,
      this.els.viewSelect,
      this.els.planningPresence,
      this.els.btnNewTask,
      this.els.btnInviteFriend
    ];
    for (const el of hiddenInSchedule) {
      if (!el) continue;
      el.hidden = scheduleMode;
    }

    if (this.els.btnNewTask) {
      this.els.btnNewTask.disabled = !hasProject || scheduleMode;
    }

    if (this.els.btnInviteFriend) {
      this.els.btnInviteFriend.disabled = !hasProject || scheduleMode;
    }

    if (this.els.viewSelect) {
      if (scheduleMode && this.els.viewSelect.value !== 'schedule') {
        this.els.viewSelect.value = 'schedule';
      }
      this.els.viewSelect.disabled = scheduleMode;
    }

    const scheduleOnlyControls = [
      this.els.tagsFilter,
      this.els.deadlineFilter,
      this.els.sortSelect
    ];
    for (const el of scheduleOnlyControls) {
      if (!el) continue;
      el.disabled = scheduleMode;
    }
  }

  renderFatal(text) {
    this.setActionsDisabled(true);
    this.uiPrefs.view = 'board';
    if (this.els.viewSelect) this.els.viewSelect.value = 'board';
    this.setView('board');
    this.renderAssigneeFilter();
    this.renderEmptyBoard(`${this.t('planning недоступен', 'planning unavailable')}: ${escapeHtml(text)}`);
  }

  renderLoginRequired() {
    this.setActionsDisabled(true);
    this.uiPrefs.view = 'board';
    if (this.els.viewSelect) this.els.viewSelect.value = 'board';
    this.setView('board');
    this.renderAssigneeFilter();
    this.renderEmptyBoard(this.t('требуется вход. откройте item-user.html и авторизуйтесь.', 'login required. open item-user.html and sign in.'));
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
      ${showRetry ? `<button class="btn" type="button" data-retry-projects style="margin-top:10px;">${escapeHtml(this.t('повторить', 'retry'))}</button>` : ''}
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
      this.state.projects = asArray(data).map((p) => {
        const project = {
          ...p,
          kind: this.normalizeProjectKind(p && p.kind)
        };
        return {
          ...project,
          scope: this.normalizeProjectScope(project)
        };
      });
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
        this.setCloudBadge('sync', this.t('повторная загрузка проектов', 'retrying projects load'));
      }
      if (!this.state.projects.length) this.state.projects = [];
      this.renderProjectSelect();
      this.renderProjectBar();
      return false;
    }
  }

  async loadFriends(options = {}) {
    if (!this.client || !this.user) return [];
    const quiet = !!options.quiet;
    const force = !!options.force;
    const now = Date.now();

    if (!force && this.friendsLoadedAt > 0 && now - this.friendsLoadedAt < FRIENDS_CACHE_MS) {
      return this.state.friends;
    }

    try {
      const uid = String(this.user.id);
      const { data: links, error: linksError } = await this.client
        .from('ik_friendships')
        .select('user_low,user_high,created_at')
        .or(`user_low.eq.${uid},user_high.eq.${uid}`)
        .order('created_at', { ascending: false });

      if (linksError) throw linksError;

      const friendIds = new Set();
      asArray(links).forEach((row) => {
        const low = String(row && row.user_low || '');
        const high = String(row && row.user_high || '');
        if (!low || !high) return;
        friendIds.add(low === uid ? high : low);
      });

      const ids = Array.from(friendIds);
      if (!ids.length) {
        this.state.friends = [];
        this.friendsLoadedAt = now;
        return this.state.friends;
      }

      const { data: profiles, error: profilesError } = await this.client
        .from('ik_user_profiles')
        .select('id,user_id,nickname,avatar_url')
        .in('id', ids);

      if (profilesError) throw profilesError;

      const byId = new Map();
      asArray(profiles).forEach((p) => {
        byId.set(String(p.id), p);
      });

      this.state.friends = ids.map((id) => {
        const p = byId.get(String(id)) || null;
        const handle = String((p && p.user_id) || '').trim() || String(id).slice(0, 8);
        const nickname = String((p && p.nickname) || '').trim();
        const label = nickname && nickname.toLowerCase() !== handle.toLowerCase()
          ? `${nickname} (@${handle})`
          : `@${handle}`;
        return {
          id: String(id),
          user_id: handle,
          nickname,
          avatar_url: String((p && p.avatar_url) || ''),
          label
        };
      }).sort((a, b) => {
        return String(a.label || a.user_id).localeCompare(String(b.label || b.user_id));
      });

      this.friendsLoadedAt = now;
      return this.state.friends;
    } catch (error) {
      if (!quiet) await this.onMutationError(error);
      return this.state.friends;
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
    const base = this.t('входящие', 'inbox');
    this.els.btnInvitesInbox.textContent = count > 0 ? `${base} (${count})` : base;
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
    this.rememberScopeReturnProject(id);
    this.state.activeProjectId = id;
    this.storeActiveProjectId(id);

    this.renderProjectSelect();
    this.renderProjectBar();

    const kind = this.normalizeProjectKind(target.kind);

    if (kind === 'schedule') {
      await this.unsubscribeProject();
      this.state.board = null;
      this.state.presence = [];
      this.state.realtimeStatus = 'off';
      this.setCloudBadge('ready', this.t('личное расписание', 'personal schedule'));
      this.renderPresence();
      this.renderAssigneeFilter();
      this.setView('schedule');
      await this.loadPersonalScheduleWorkspace({ force: true });
      this.syncToolbarByProject();
      return;
    }

    if (this.uiPrefs.view !== 'board') {
      this.setView('board');
    }

    await this.loadBoard(id);
    await this.subscribeProject(id);
    this.renderPresence();
    this.syncToolbarByProject();
    this.renderSchedule();
  }

  async loadBoard(projectId) {
    const id = String(projectId || this.state.activeProjectId || '').trim();
    if (!id) {
      this.state.board = null;
      this.state.schedule.events = [];
      this.state.schedule.lastRangeKey = '';
      this.renderAssigneeFilter();
      this.renderBoard();
      this.renderSchedule();
      return;
    }

    this.boardLoadInFlight = true;

    try {
      const data = await this.rpc('ik_plan_get_board', { p_project_id: id });
      this.state.board = data && typeof data === 'object' ? data : null;
      this.renderProjectBar();
      this.renderAssigneeFilter();
      this.renderBoard();
      this.renderSchedule();
      this.renderPresence();
    } catch (error) {
      this.state.board = null;
      this.state.schedule.events = [];
      this.state.schedule.lastRangeKey = '';
      this.renderAssigneeFilter();
      this.renderBoard();
      this.renderSchedule();
      this.renderPresence();
      await this.onMutationError(error);
    } finally {
      this.boardLoadInFlight = false;
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
    this.lastRealtimeEventAt = Date.now();
    const eventType = String((eventRow && eventRow.event_type) || '');
    if (!eventRow || !this.state.board || !this.state.board.project) {
      this.scheduleBoardReload(80);
      if (this.uiPrefs.view === 'schedule' && eventType.startsWith('schedule.')) {
        void this.loadScheduleWindow({ force: true }).catch(() => {});
      }
      return;
    }

    const incomingRevision = Number(eventRow.revision || 0);
    const localRevision = Number(this.state.board.project.revision || 0);

    if (!incomingRevision) {
      this.scheduleBoardReload(80);
      if (this.uiPrefs.view === 'schedule' && eventType.startsWith('schedule.')) {
        void this.loadScheduleWindow({ force: true }).catch(() => {});
      }
      return;
    }

    if (incomingRevision <= localRevision) return;

    if (incomingRevision > localRevision + 1) {
      this.scheduleBoardReload(0);
      if (this.uiPrefs.view === 'schedule' && eventType.startsWith('schedule.')) {
        void this.loadScheduleWindow({ force: true }).catch(() => {});
      }
      return;
    }

    this.scheduleBoardReload(90);
    if (this.uiPrefs.view === 'schedule' && eventType.startsWith('schedule.')) {
      void this.loadScheduleWindow({ force: true }).catch(() => {});
    }
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
      { value: 'all', label: this.t('исполнитель: все', 'assignee: all') },
      { value: 'me', label: this.t('исполнитель: мои', 'assignee: mine') },
      { value: 'unassigned', label: this.t('исполнитель: без ответ.', 'assignee: unassigned') }
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
    const out = [`<option value="">${escapeHtml(this.t('без ответственного', 'unassigned'))}</option>`];
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
    return this.normalizeProjectScope(project) === 'shared'
      ? this.t('общий', 'shared')
      : this.t('личный', 'personal');
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

    const status = this.state.realtimeStatus === 'SUBSCRIBED'
      ? this.t('LIVE', 'LIVE')
      : this.t('SYNC', 'SYNC');
    const chips = this.state.presence.map((p) => {
      const m = memberById.get(String(p.user_id));
      const nick = String((m && (m.nickname || m.profile_user_id)) || p.nickname || p.user_id).trim() || 'user';
      const isSelf = String(p.user_id) === String(this.user.id);
      return `<span class="planning-presence__chip${isSelf ? ' is-self' : ''}"><span class="planning-presence__dot"></span>${escapeHtml(nick)}</span>`;
    }).join('');

    const totalMembers = members.length;
    const onlineCount = this.state.presence.length;
    const statusText = `${status} | ${this.t('онлайн', 'online')} ${onlineCount}/${totalMembers || 0}`;

    this.els.planningPresence.innerHTML = `
      <span class="planning-presence__status">${escapeHtml(statusText)}</span>
      ${chips}
    `;
  }

  setView(view) {
    const forcedSchedule = this.isScheduleProject();
    const safeView = forcedSchedule ? 'schedule' : (view === 'schedule' ? 'schedule' : 'board');
    this.uiPrefs.view = safeView;
    this.persistUIPrefs();

    if (this.els.viewSelect && this.els.viewSelect.value !== safeView) {
      this.els.viewSelect.value = safeView;
    }

    if (this.els.boardView) this.els.boardView.hidden = safeView !== 'board';
    if (this.els.scheduleView) this.els.scheduleView.hidden = safeView !== 'schedule';

    if (safeView === 'board') {
      this.renderBoard();
      return;
    }

    this.renderSchedule();
    if (forcedSchedule) {
      void this.loadPersonalScheduleWorkspace().catch((error) => this.onMutationError(error));
    } else {
      void this.loadScheduleWindow().catch((error) => this.onMutationError(error));
    }
  }

  getScheduleWindow() {
    const range = this.normalizeScheduleRange(this.uiPrefs.scheduleRange);
    const anchor = this.readScheduleAnchorDate();
    const anchorDate = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());

    let startDate;
    let endDate;

    if (range === 'today') {
      startDate = anchorDate;
      endDate = addDaysLocal(startDate, 1);
    } else if (range === 'this_week') {
      startDate = startOfWeekLocal(anchorDate);
      endDate = addDaysLocal(startDate, 7);
    } else if (range === 'next_week') {
      startDate = addDaysLocal(startOfWeekLocal(anchorDate), 7);
      endDate = addDaysLocal(startDate, 7);
    } else if (range === 'two_weeks') {
      startDate = startOfWeekLocal(anchorDate);
      endDate = addDaysLocal(startDate, 14);
    } else {
      startDate = startOfMonthLocal(anchorDate);
      endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
    }

    const days = [];
    for (let d = new Date(startDate); d < endDate; d = addDaysLocal(d, 1)) {
      days.push(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
    }

    return {
      key: range,
      startDate,
      endDate,
      fromIso: startDate.toISOString(),
      toIso: endDate.toISOString(),
      dayKeys: days.map((d) => formatLocalISO(d)),
      days,
      isGrid: days.length <= 14
    };
  }

  scheduleRangeLabel(rangeKey) {
    const key = this.normalizeScheduleRange(rangeKey);
    if (key === 'today') return this.t('сегодня', 'today');
    if (key === 'this_week') return this.t('эта неделя', 'this week');
    if (key === 'next_week') return this.t('следующая неделя', 'next week');
    if (key === 'two_weeks') return this.t('2 недели', '2 weeks');
    return this.t('месяц', 'month');
  }

  formatScheduleRangeTitle(win) {
    const locale = this.getLang() === 'en' ? 'en-US' : 'ru-RU';
    const fmt = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' });
    const endInclusive = addDaysLocal(win.endDate, -1);
    return `${fmt.format(win.startDate)} - ${fmt.format(endInclusive)}`;
  }

  formatScheduleDayLabel(day) {
    const locale = this.getLang() === 'en' ? 'en-US' : 'ru-RU';
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short', day: '2-digit', month: 'short' });
    return fmt.format(day);
  }

  async setScheduleRange(range) {
    const next = this.normalizeScheduleRange(range);
    if (next === this.normalizeScheduleRange(this.uiPrefs.scheduleRange)) {
      this.renderSchedule();
      await this.loadScheduleWindow({ force: false });
      return;
    }

    this.uiPrefs.scheduleRange = next;
    if (!parseISOToLocalDate(this.uiPrefs.scheduleAnchor)) {
      this.uiPrefs.scheduleAnchor = formatLocalISO(new Date());
    }
    this.persistUIPrefs();
    this.renderSchedule();
    await this.loadScheduleWindow({ force: true });
  }

  async setScheduleAnchor(dateValue, options = {}) {
    const forceReload = !!options.forceReload;
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return;
    this.uiPrefs.scheduleAnchor = formatLocalISO(date);
    this.persistUIPrefs();
    this.renderSchedule();
    await this.loadScheduleWindow({ force: forceReload });
  }

  async shiftScheduleWindow(step) {
    const dir = Number(step || 0);
    if (!dir) return;

    const range = this.normalizeScheduleRange(this.uiPrefs.scheduleRange);
    const anchor = this.readScheduleAnchorDate();
    const base = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());

    if (range === 'month') {
      base.setMonth(base.getMonth() + dir);
    } else if (range === 'today') {
      base.setDate(base.getDate() + dir);
    } else {
      base.setDate(base.getDate() + dir * 7);
    }

    await this.setScheduleAnchor(base, { forceReload: true });
  }

  looksLikeScheduleSchemaError(error) {
    const txt = briefError(error).toLowerCase();
    const code = String((error && error.code) || '').toUpperCase();
    if (code === '42883' || code === '42P01' || code === '42703') {
      return txt.includes('ik_plan_schedule') || txt.includes('ik_plan_list_schedule_events');
    }
    return txt.includes('ik_plan_schedule_events') || txt.includes('ik_plan_list_schedule_events');
  }

  disableSchedule(reason) {
    this.state.schedule.available = false;
    this.state.schedule.unavailableReason = String(reason || '').trim();
    this.state.schedule.loading = false;
    this.state.schedule.events = [];
    this.state.schedule.lastRangeKey = '';
    this.renderSchedule();
  }

  resetScheduleAvailability() {
    this.state.schedule.available = true;
    this.state.schedule.unavailableReason = '';
  }

  async loadScheduleWindow(options = {}) {
    const force = !!options.force;
    if (this.isScheduleProject()) {
      this.renderSchedule();
      return;
    }

    if (!this.state.activeProjectId || !(this.state.board && this.state.board.project)) {
      this.state.schedule.events = [];
      this.state.schedule.lastRangeKey = '';
      this.renderSchedule();
      return;
    }

    if (!this.state.schedule.available) {
      this.renderSchedule();
      return;
    }

    const win = this.getScheduleWindow();
    const rangeKey = `${this.state.activeProjectId}:${win.fromIso}:${win.toIso}`;
    if (!force && this.state.schedule.lastRangeKey === rangeKey) {
      this.renderSchedule();
      return;
    }

    this.state.schedule.loading = true;
    this.renderSchedule();

    try {
      const data = await this.rpc('ik_plan_list_schedule_events', {
        p_project_id: this.state.activeProjectId,
        p_from: win.fromIso,
        p_to: win.toIso
      });
      this.state.schedule.events = asArray(data);
      this.state.schedule.lastRangeKey = rangeKey;
      this.resetScheduleAvailability();
    } catch (error) {
      if (this.looksLikeScheduleSchemaError(error)) {
        if (!this.scheduleSchemaWarnShown) {
          this.scheduleSchemaWarnShown = true;
          this.ui.toast(this.t(
            'для расписания примените SQL: supabase/sql/stage15_planning_schedule.sql',
            'for schedule apply SQL: supabase/sql/stage15_planning_schedule.sql'
          ));
        }
        this.disableSchedule(this.t('расписание недоступно: требуется stage15 sql', 'schedule unavailable: stage15 sql required'));
      } else {
        this.state.schedule.events = [];
        this.state.schedule.lastRangeKey = '';
        this.state.schedule.loading = false;
        await this.onMutationError(error);
      }
    } finally {
      this.state.schedule.loading = false;
      this.renderSchedule();
    }
  }

  looksLikePersonalScheduleSchemaError(error) {
    const txt = briefError(error).toLowerCase();
    const code = String((error && error.code) || '').toUpperCase();
    if (code === '42883' || code === '42P01' || code === '42703') {
      return txt.includes('ik_plan_create_schedule')
        || txt.includes('ik_plan_get_schedule_workspace')
        || txt.includes('ik_plan_create_schedule_plan')
        || txt.includes('ik_plan_update_schedule_plan')
        || txt.includes('ik_plan_schedule_lists')
        || txt.includes('ik_plan_schedule_plans');
    }
    return txt.includes('ik_plan_schedule_lists')
      || txt.includes('ik_plan_schedule_plans')
      || txt.includes('ik_plan_create_schedule_plan')
      || txt.includes('ik_plan_update_schedule_plan')
      || txt.includes('ik_plan_get_schedule_workspace')
      || txt.includes('schedule_project_required');
  }

  personalScheduleState() {
    return this.state.schedule.workspace;
  }

  persistPersonalSchedulePrefs() {
    const ws = this.personalScheduleState();
    this.uiPrefs.scheduleTab = this.normalizePersonalScheduleTab(ws.tab);
    this.uiPrefs.scheduleSelectedDay = String(ws.selectedDay || formatLocalISO(new Date()));
    this.uiPrefs.scheduleMonthAnchor = String(ws.monthAnchor || formatLocalISO(new Date()));
    this.persistUIPrefs();
  }

  clearPersonalScheduleWorkspace() {
    const ws = this.personalScheduleState();
    ws.lists = [];
    ws.plans = [];
    ws.calendarCounts = [];
    ws.loading = false;
    ws.available = true;
    ws.unavailableReason = '';
    ws.lastProjectId = '';
    this.personalPlanOrderProjectId = '';
    this.personalPlanOrderByList = new Map();
  }

  disablePersonalScheduleWorkspace(reason) {
    const ws = this.personalScheduleState();
    ws.available = false;
    ws.unavailableReason = String(reason || '').trim();
    ws.loading = false;
    ws.lists = [];
    ws.plans = [];
    ws.calendarCounts = [];
    this.renderSchedule();
  }

  resetPersonalScheduleAvailability() {
    const ws = this.personalScheduleState();
    ws.available = true;
    ws.unavailableReason = '';
  }

  setPersonalScheduleTab(tabKey) {
    const ws = this.personalScheduleState();
    ws.tab = this.normalizePersonalScheduleTab(tabKey);
    this.persistPersonalSchedulePrefs();
    this.renderSchedule();
  }

  setPersonalScheduleSelectedDay(dayIso, options = {}) {
    const ws = this.personalScheduleState();
    const date = parseISOToLocalDate(dayIso);
    if (!date) return;
    ws.selectedDay = formatLocalISO(date);
    if (options.syncMonth) {
      ws.monthAnchor = formatLocalISO(new Date(date.getFullYear(), date.getMonth(), 1));
    }
    this.persistPersonalSchedulePrefs();
    this.renderSchedule();
  }

  shiftPersonalScheduleMonth(step) {
    const ws = this.personalScheduleState();
    const anchorDate = parseISOToLocalDate(ws.monthAnchor) || parseISOToLocalDate(ws.selectedDay) || new Date();
    const next = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + Number(step || 0), 1);
    ws.monthAnchor = formatLocalISO(next);
    this.persistPersonalSchedulePrefs();
    this.renderSchedule();
  }

  async loadPersonalScheduleWorkspace(options = {}) {
    const force = !!options.force;
    const silent = !!options.silent;
    const ws = this.personalScheduleState();
    const active = this.activeProjectMeta();
    const projectId = String(active && active.id || '');

    if (!projectId || !this.isScheduleProject(active)) {
      this.clearPersonalScheduleWorkspace();
      this.renderSchedule();
      return;
    }

    if (!force && ws.lastProjectId === projectId) {
      this.ensurePersonalPlanOrderReady(projectId);
      this.renderSchedule();
      return;
    }

    if (!silent) {
      ws.loading = true;
      this.renderSchedule();
    }

    try {
      const data = await this.rpc('ik_plan_get_schedule_workspace', {
        p_project_id: projectId
      });
      ws.lists = asArray(data && data.lists);
      ws.plans = asArray(data && data.plans);
      ws.calendarCounts = asArray(data && data.calendar_counts);
      ws.lastProjectId = projectId;
      this.ensurePersonalPlanOrderReady(projectId);
      this.resetPersonalScheduleAvailability();
    } catch (error) {
      if (this.looksLikePersonalScheduleSchemaError(error)) {
        if (!this.personalScheduleSchemaWarnShown) {
          this.personalScheduleSchemaWarnShown = true;
          this.ui.toast(this.t(
            'для личного расписания примените SQL: supabase/sql/stage16_planning_personal_schedule.sql',
            'for personal schedule apply SQL: supabase/sql/stage16_planning_personal_schedule.sql'
          ));
        }
        this.disablePersonalScheduleWorkspace(this.t(
          'расписание недоступно: требуется stage16 sql',
          'schedule unavailable: stage16 sql required'
        ));
      } else {
        ws.lists = [];
        ws.plans = [];
        ws.calendarCounts = [];
        ws.lastProjectId = '';
        this.personalPlanOrderProjectId = '';
        this.personalPlanOrderByList = new Map();
        await this.onMutationError(error);
      }
    } finally {
      if (!silent) ws.loading = false;
      this.renderSchedule();
    }
  }

  scheduleListsSorted() {
    const ws = this.personalScheduleState();
    return asArray(ws.lists).slice().sort((a, b) => {
      const ap = toPositionNumber(a.position);
      const bp = toPositionNumber(b.position);
      if (ap !== bp) return ap - bp;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
  }

  scheduleListById(listId) {
    const id = String(listId || '').trim();
    if (!id) return null;
    return this.scheduleListsSorted().find((x) => String(x.id) === id) || null;
  }

  schedulePlanById(planId) {
    const ws = this.personalScheduleState();
    const id = String(planId || '').trim();
    if (!id) return null;
    return asArray(ws.plans).find((x) => String(x.id) === id) || null;
  }

  normalizePersonalPlanOrderListKey(listId) {
    return String(listId || '').trim();
  }

  personalPlanOrderStorageKey(projectId) {
    const id = String(projectId || '').trim() || 'none';
    return `${PERSONAL_PLAN_ORDER_KEY_PREFIX}${id}`;
  }

  serializePersonalPlanOrder() {
    const out = {};
    for (const [listKey, ids] of this.personalPlanOrderByList.entries()) {
      const safeKey = this.normalizePersonalPlanOrderListKey(listKey);
      const safeIds = asArray(ids)
        .map((id) => String(id || '').trim())
        .filter(Boolean);
      if (!safeIds.length) continue;
      out[safeKey] = Array.from(new Set(safeIds));
    }
    return out;
  }

  restorePersonalPlanOrder(rawValue) {
    const next = new Map();
    if (rawValue && typeof rawValue === 'object') {
      for (const [listKey, ids] of Object.entries(rawValue)) {
        const key = this.normalizePersonalPlanOrderListKey(listKey);
        const safeIds = asArray(ids)
          .map((id) => String(id || '').trim())
          .filter(Boolean);
        if (!safeIds.length) continue;
        next.set(key, Array.from(new Set(safeIds)));
      }
    }
    this.personalPlanOrderByList = next;
  }

  loadPersonalPlanOrder(projectId) {
    const id = String(projectId || '').trim();
    this.personalPlanOrderProjectId = id;
    this.personalPlanOrderByList = new Map();
    if (!id) return;
    try {
      const raw = localStorage.getItem(this.personalPlanOrderStorageKey(id));
      if (!raw) return;
      this.restorePersonalPlanOrder(JSON.parse(raw));
    } catch (_) {
      this.personalPlanOrderByList = new Map();
    }
  }

  savePersonalPlanOrder() {
    const projectId = String(this.personalPlanOrderProjectId || '').trim();
    if (!projectId) return;
    try {
      localStorage.setItem(
        this.personalPlanOrderStorageKey(projectId),
        JSON.stringify(this.serializePersonalPlanOrder())
      );
    } catch (_) {}
  }

  ensurePersonalPlanOrderReady(projectId = '') {
    const active = this.activeProjectMeta();
    const targetId = String(projectId || (active && active.id) || '').trim();
    if (!targetId) {
      this.personalPlanOrderProjectId = '';
      this.personalPlanOrderByList = new Map();
      return;
    }
    if (this.personalPlanOrderProjectId !== targetId) {
      this.loadPersonalPlanOrder(targetId);
    }
    this.syncPersonalPlanOrderWithWorkspace();
  }

  syncPersonalPlanOrderWithWorkspace() {
    const ws = this.personalScheduleState();
    const rows = asArray(ws.plans);
    const rowsByList = new Map();
    rows.forEach((row) => {
      const key = this.normalizePersonalPlanOrderListKey(row && row.list_id);
      if (!rowsByList.has(key)) rowsByList.set(key, []);
      rowsByList.get(key).push(row);
    });

    const knownListKeys = new Set(['']);
    rowsByList.forEach((_value, key) => knownListKeys.add(key));
    this.scheduleListsSorted().forEach((list) => {
      knownListKeys.add(this.normalizePersonalPlanOrderListKey(list && list.id));
    });

    const prevJson = JSON.stringify(this.serializePersonalPlanOrder());
    const next = new Map();

    knownListKeys.forEach((listKey) => {
      const listRows = asArray(rowsByList.get(listKey));
      const existing = asArray(this.personalPlanOrderByList.get(listKey));
      const rowIdsSet = new Set(listRows.map((row) => String(row && row.id || '').trim()).filter(Boolean));
      const orderedIds = [];
      const seen = new Set();

      for (const id of existing) {
        const safeId = String(id || '').trim();
        if (!safeId || !rowIdsSet.has(safeId) || seen.has(safeId)) continue;
        orderedIds.push(safeId);
        seen.add(safeId);
      }

      for (const row of this.sortPersonalPlans(listRows)) {
        const safeId = String(row && row.id || '').trim();
        if (!safeId || seen.has(safeId)) continue;
        orderedIds.push(safeId);
        seen.add(safeId);
      }

      if (orderedIds.length) {
        next.set(listKey, orderedIds);
      }
    });

    this.personalPlanOrderByList = next;
    const nextJson = JSON.stringify(this.serializePersonalPlanOrder());
    if (nextJson !== prevJson) {
      this.savePersonalPlanOrder();
    }
  }

  sortPersonalPlansForList(rows, listId = '') {
    const sorted = this.sortPersonalPlans(rows);
    const key = this.normalizePersonalPlanOrderListKey(listId);
    const order = asArray(this.personalPlanOrderByList.get(key));
    if (!order.length) return sorted;

    const rank = new Map(order.map((id, index) => [String(id || ''), index]));
    const fallback = new Map(sorted.map((row, index) => [String(row && row.id || ''), index]));

    return sorted.slice().sort((a, b) => {
      const aid = String(a && a.id || '');
      const bid = String(b && b.id || '');
      const ar = rank.has(aid) ? rank.get(aid) : Number.MAX_SAFE_INTEGER;
      const br = rank.has(bid) ? rank.get(bid) : Number.MAX_SAFE_INTEGER;
      if (ar !== br) return ar - br;
      const af = fallback.has(aid) ? fallback.get(aid) : Number.MAX_SAFE_INTEGER;
      const bf = fallback.has(bid) ? fallback.get(bid) : Number.MAX_SAFE_INTEGER;
      return af - bf;
    });
  }

  applyPersonalPlanOrderMove(planId, targetListId, options = {}) {
    const id = String(planId || '').trim();
    if (!id) return;
    this.ensurePersonalPlanOrderReady();

    const insertKey = this.normalizePersonalPlanOrderListKey(targetListId);
    for (const [listKey, ids] of this.personalPlanOrderByList.entries()) {
      const filtered = asArray(ids).map((x) => String(x || '').trim()).filter((x) => x && x !== id);
      if (filtered.length) this.personalPlanOrderByList.set(listKey, filtered);
      else this.personalPlanOrderByList.delete(listKey);
    }

    const targetIds = asArray(this.personalPlanOrderByList.get(insertKey))
      .map((x) => String(x || '').trim())
      .filter(Boolean);

    const rawIndex = Number(options.insertIndex);
    const insertIndex = Number.isFinite(rawIndex)
      ? Math.max(0, Math.min(targetIds.length, Math.floor(rawIndex)))
      : targetIds.length;

    targetIds.splice(insertIndex, 0, id);
    this.personalPlanOrderByList.set(insertKey, targetIds);
    this.savePersonalPlanOrder();
  }

  sortPersonalPlans(rows) {
    return asArray(rows).slice().sort((a, b) => {
      const ad = !!a.is_done;
      const bd = !!b.is_done;
      if (ad !== bd) return ad ? 1 : -1;

      const adate = String(a._occursOn || a.plan_date || '');
      const bdate = String(b._occursOn || b.plan_date || '');
      if (adate !== bdate) {
        if (!adate) return 1;
        if (!bdate) return -1;
        return adate.localeCompare(bdate);
      }

      const atime = normalizeTimeText(a.start_time) || '99:99';
      const btime = normalizeTimeText(b.start_time) || '99:99';
      if (atime !== btime) return atime.localeCompare(btime);

      return String(a.title || '').localeCompare(String(b.title || ''));
    });
  }

  personalRepeatLabel(ruleValue) {
    const rule = normalizeRepeatRule(ruleValue);
    if (rule === 'daily') return this.t('ежедневно', 'daily');
    if (rule === 'weekly') return this.t('еженедельно', 'weekly');
    if (rule === 'monthly') return this.t('ежемесячно', 'monthly');
    if (rule === 'yearly') return this.t('ежегодно', 'yearly');
    if (rule === 'weekdays') return this.t('каждый будний день', 'every weekday');
    if (rule === 'weekends') return this.t('каждый выходной', 'every weekend');
    return this.t('не повторять', 'no repeat');
  }

  schedulePlanOccursOnDay(plan, dayIso) {
    const day = parseISOToLocalDate(dayIso);
    if (!day) return false;

    const baseKey = String(plan && plan.plan_date || '').trim();
    const repeatRule = normalizeRepeatRule(plan && plan.repeat_rule);

    if (!baseKey) {
      return repeatRule === 'none' ? false : false;
    }

    if (repeatRule === 'none') {
      return baseKey === dayIso;
    }

    const baseDate = parseISOToLocalDate(baseKey);
    if (!baseDate) return false;
    const targetDate = day;
    if (targetDate.getTime() < baseDate.getTime()) return false;

    const untilDate = parseISOToLocalDate(plan && plan.repeat_until);
    if (untilDate && targetDate.getTime() > untilDate.getTime()) return false;

    const diff = dayDiffLocal(baseDate, targetDate);
    const targetWeekDay = targetDate.getDay();

    if (repeatRule === 'daily') return true;
    if (repeatRule === 'weekly') return targetWeekDay === baseDate.getDay() && diff % 7 === 0;
    if (repeatRule === 'monthly') return targetDate.getDate() === baseDate.getDate();
    if (repeatRule === 'yearly') return targetDate.getDate() === baseDate.getDate() && targetDate.getMonth() === baseDate.getMonth();
    if (repeatRule === 'weekdays') return targetWeekDay >= 1 && targetWeekDay <= 5;
    if (repeatRule === 'weekends') return targetWeekDay === 0 || targetWeekDay === 6;
    return false;
  }

  expandPlansForDay(dayIso, rows = null) {
    const targetDay = String(dayIso || '').trim();
    if (!targetDay) return [];
    const source = rows || this.filteredPersonalSchedulePlans();
    const out = [];
    for (const row of source) {
      if (!this.schedulePlanOccursOnDay(row, targetDay)) continue;
      out.push({ ...row, _occursOn: targetDay });
    }
    return this.sortPersonalPlans(out);
  }

  countPlansForDay(dayIso, rows = null) {
    return this.expandPlansForDay(dayIso, rows).length;
  }

  filteredPersonalSchedulePlans() {
    const ws = this.personalScheduleState();
    const q = String(this.uiPrefs.q || '').trim().toLowerCase();
    const priority = String(this.uiPrefs.priority || 'all').toLowerCase();
    return asArray(ws.plans).filter((row) => {
      if (q) {
        const hay = `${row.title || ''} ${row.note || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (priority !== 'all' && String(row.priority || '').toLowerCase() !== priority) {
        return false;
      }
      return true;
    });
  }

  plansForDay(dayIso, rows = null) {
    return this.expandPlansForDay(dayIso, rows);
  }

  scheduleListOptionsHtml(selectedId = '') {
    const selected = String(selectedId || '');
    const options = [`<option value="">${escapeHtml(this.t('без списка', 'no list'))}</option>`];
    for (const list of this.scheduleListsSorted()) {
      const id = String(list.id || '');
      if (!id) continue;
      const pick = id === selected ? 'selected' : '';
      options.push(`<option value="${escapeAttr(id)}" ${pick}>${escapeHtml(String(list.name || 'list'))}</option>`);
    }
    return options.join('');
  }

  scheduleRepeatRuleOptionsHtml(selectedRule = 'none') {
    const selected = normalizeRepeatRule(selectedRule);
    const options = [
      { key: 'none', label: this.t('не повторять', 'no repeat') },
      { key: 'daily', label: this.t('ежедневно', 'daily') },
      { key: 'weekly', label: this.t('еженедельно', 'weekly') },
      { key: 'monthly', label: this.t('ежемесячно', 'monthly') },
      { key: 'yearly', label: this.t('ежегодно', 'yearly') },
      { key: 'weekdays', label: this.t('каждый будний день', 'every weekday') },
      { key: 'weekends', label: this.t('каждый выходной', 'every weekend') }
    ];
    return options
      .map((opt) => `<option value="${opt.key}" ${opt.key === selected ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`)
      .join('');
  }

  renderPersonalPlanRow(row, listById = new Map(), options = {}) {
    const planId = String(row.id || '');
    const overrideListId = Object.prototype.hasOwnProperty.call(options, 'listId')
      ? String(options.listId || '')
      : String(row.list_id || '');
    const list = overrideListId ? listById.get(overrideListId) : null;
    const dateText = String(row._occursOn || row.plan_date || '') || this.t('без даты', 'no date');
    const timeText = timeLabelHM(row.start_time, row.end_time, this.getLang());
    const done = !!row.is_done;
    const priorityRaw = String(row.priority || 'mid').toLowerCase();
    const priority = ['low', 'mid', 'high'].includes(priorityRaw) ? priorityRaw : 'mid';
    const repeatRule = normalizeRepeatRule(row.repeat_rule);
    const dragEnabled = !!options.dragEnabled;

    const facts = [
      `${this.t('дата', 'date')}: ${dateText}`,
      `${this.t('время', 'time')}: ${timeText}`
    ];

    if (repeatRule !== 'none') {
      const repeatText = this.personalRepeatLabel(repeatRule);
      const untilText = String(row.repeat_until || '').trim();
      facts.push(untilText
        ? `${this.t('повтор', 'repeat')}: ${repeatText} (${this.t('до', 'until')} ${untilText})`
        : `${this.t('повтор', 'repeat')}: ${repeatText}`);
    }

    if (list) {
      facts.push(`${this.t('список', 'list')}: ${String(list.name || '')}`);
    }

    const dragAttrs = dragEnabled ? ' draggable="true" data-ps-plan-draggable="1"' : '';

    return `
      <article class="ps-plan${done ? ' is-done' : ''}${dragEnabled ? ' is-draggable' : ''}" data-ps-plan-id="${escapeAttr(planId)}" data-ps-plan-list-id="${escapeAttr(overrideListId)}"${dragAttrs}>
        <div class="ps-plan__left">
          <input type="checkbox" data-ps-toggle="${escapeAttr(planId)}" ${done ? 'checked' : ''} />
        </div>
        <div class="ps-plan__body">
          <div class="ps-plan__title-row">
            <div class="ps-plan__title">${escapeHtml(String(row.title || this.t('план', 'plan')))}</div>
            <span class="ps-plan__priority ps-plan__priority--${escapeAttr(priority)}">${escapeHtml(priority.toUpperCase())}</span>
          </div>
          <div class="ps-plan__facts">${facts.map((entry) => `<span class="ps-plan__fact">${escapeHtml(entry)}</span>`).join('')}</div>
          ${row.note ? `<div class="ps-plan__note">${escapeHtml(shortText(row.note, 200))}</div>` : ''}
        </div>
        <div class="ps-plan__actions">
          <button class="btn btn--thin" type="button" data-ps-open-plan="${escapeAttr(planId)}">${escapeHtml(this.t('открыть', 'open'))}</button>
          <button class="btn btn--thin" type="button" data-ps-del-plan="${escapeAttr(planId)}">${escapeHtml(this.t('удалить', 'delete'))}</button>
        </div>
      </article>
    `;
  }

  formatPersonalScheduleDayLabel(dayIso) {
    const day = parseISOToLocalDate(dayIso);
    if (!day) return String(dayIso || '');
    const locale = this.getLang() === 'en' ? 'en-US' : 'ru-RU';
    return new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(day);
  }

  renderPersonalScheduleDayListBlock(options = {}) {
    const listId = String(options.listId || '');
    const title = String(options.title || this.t('список', 'list'));
    const color = String(options.color || '#2f6f4f');
    const dayIso = String(options.dayIso || '');
    const rows = this.sortPersonalPlansForList(options.rows || [], listId);
    const listById = options.listById instanceof Map ? options.listById : new Map();
    const allowListDrag = !!options.allowListDrag && !!listId;
    const listAttr = listId ? `data-list-id="${escapeAttr(listId)}"` : '';
    const bodyHtml = rows.length
      ? rows.map((row) => this.renderPersonalPlanRow(row, listById, {
          dragEnabled: true,
          listId
        })).join('')
      : `<div class="ps-empty">${escapeHtml(this.t('в этом блоке пока пусто', 'this block is empty'))}</div>`;

    return `
      <section class="ps-day-list${listId ? '' : ' is-no-list'}" data-ps-day-list-id="${escapeAttr(listId)}" data-ps-day-list-drop-id="${escapeAttr(listId)}"${allowListDrag ? ` draggable="true" data-ps-list-drag-handle="${escapeAttr(listId)}"` : ''}>
        <header class="ps-day-list__head">
          <div class="ps-day-list__title-wrap">
            ${allowListDrag
              ? `<span class="ps-day-list__drag" aria-hidden="true">::</span>`
              : '<span class="ps-day-list__drag is-static" aria-hidden="true">::</span>'}
            <div class="ps-day-list__title"><span class="ps-dot" style="--ps-dot:${escapeAttr(color)}"></span>${escapeHtml(title)}</div>
            <div class="ps-day-list__count">${escapeHtml(`${rows.length} ${this.t('планов', 'plans')}`)}</div>
          </div>
          <div class="ps-day-list__actions">
            <button class="btn btn--thin" type="button" data-ps-new-plan ${listAttr} data-day="${escapeAttr(dayIso)}">+ ${escapeHtml(this.t('план', 'plan'))}</button>
          </div>
        </header>
        <div class="ps-day-list__body">${bodyHtml}</div>
      </section>
    `;
  }

  renderPersonalScheduleDayPanel(selectedDayKey, selectedPlans, listById) {
    this.ensurePersonalPlanOrderReady();
    const lists = this.scheduleListsSorted();
    const groupedByList = new Map();
    lists.forEach((list) => {
      groupedByList.set(String(list.id || ''), []);
    });

    const noListRows = [];
    selectedPlans.forEach((plan) => {
      const listId = String(plan.list_id || '');
      if (!listId || !groupedByList.has(listId)) {
        noListRows.push(plan);
        return;
      }
      groupedByList.get(listId).push(plan);
    });

    const listBlocks = lists.map((list) => this.renderPersonalScheduleDayListBlock({
      listId: String(list.id || ''),
      title: String(list.name || this.t('список', 'list')),
      color: String(list.color || '#2f6f4f'),
      rows: groupedByList.get(String(list.id || '')) || [],
      dayIso: selectedDayKey,
      listById,
      allowListDrag: true
    })).join('');

    const noListBlock = this.renderPersonalScheduleDayListBlock({
      listId: '',
      title: this.t('без списка', 'no list'),
      color: '#6b7280',
      rows: noListRows,
      dayIso: selectedDayKey,
      listById,
      allowListDrag: false
    });

    const totalBlocks = lists.length + 1;
    const subLine = `${selectedPlans.length} ${this.t('планов', 'plans')} | ${totalBlocks} ${this.t('блоков', 'blocks')}`;

    return {
      dateLabel: this.formatPersonalScheduleDayLabel(selectedDayKey),
      subLine,
      bodyHtml: `<div class="ps-day-lists" data-ps-day-lists-root>${listBlocks}${noListBlock}</div>`
    };
  }

  renderPersonalScheduleToday() {
    const todayIso = formatLocalISO(new Date());
    const all = this.filteredPersonalSchedulePlans();
    const listById = new Map(this.scheduleListsSorted().map((x) => [String(x.id), x]));

    const today = this.plansForDay(todayIso, all);
    const overdue = this.sortPersonalPlans(all.filter((x) => {
      const day = String(x.plan_date || '');
      const repeatRule = normalizeRepeatRule(x.repeat_rule);
      return repeatRule === 'none' && day && day < todayIso && !x.is_done;
    }));
    const inbox = this.sortPersonalPlans(all.filter((x) => {
      const repeatRule = normalizeRepeatRule(x.repeat_rule);
      return repeatRule === 'none' && !String(x.plan_date || '').trim() && !x.is_done;
    }));

    const renderBlock = (title, rows, emptyText, attrs = '') => {
      const listHtml = rows.length
        ? rows.map((row) => this.renderPersonalPlanRow(row, listById)).join('')
        : `<div class="ps-empty">${escapeHtml(emptyText)}</div>`;
      return `
        <section class="ps-block">
          <header class="ps-block__head">
            <div class="ps-block__title">${escapeHtml(title)}</div>
            <button class="btn btn--thin" type="button" data-ps-new-plan ${attrs}>+ ${escapeHtml(this.t('план', 'plan'))}</button>
          </header>
          <div class="ps-block__body">${listHtml}</div>
        </section>
      `;
    };

    return `
      <div class="ps-layout">
        ${renderBlock(this.t('сегодня', 'today'), today, this.t('на сегодня планов нет', 'no plans for today'), `data-day="${escapeAttr(todayIso)}"`)}
        ${renderBlock(this.t('просрочено', 'overdue'), overdue, this.t('просроченных планов нет', 'no overdue plans'))}
        ${renderBlock(this.t('без даты', 'no date'), inbox, this.t('пусто', 'empty'))}
      </div>
    `;
  }

  renderPersonalScheduleLists() {
    const rows = this.filteredPersonalSchedulePlans();
    const byListId = new Map();
    this.scheduleListsSorted().forEach((list) => {
      byListId.set(String(list.id), []);
    });

    const unassigned = [];
    rows.forEach((row) => {
      const listId = String(row.list_id || '');
      if (!listId || !byListId.has(listId)) {
        unassigned.push(row);
        return;
      }
      byListId.get(listId).push(row);
    });

    const sections = this.scheduleListsSorted().map((list) => {
      const listId = String(list.id || '');
      const listRows = this.sortPersonalPlans(byListId.get(listId) || []);
      const content = listRows.length
        ? listRows.map((row) => this.renderPersonalPlanRow(row, new Map([[listId, list]]))).join('')
        : `<div class="ps-empty">${escapeHtml(this.t('в этом списке пока пусто', 'this list is empty'))}</div>`;
      return `
        <section class="ps-list-block">
          <header class="ps-list-block__head">
            <div class="ps-list-block__title"><span class="ps-dot" style="--ps-dot:${escapeAttr(String(list.color || '#2f6f4f'))}"></span>${escapeHtml(String(list.name || 'list'))}</div>
            <div class="ps-list-block__actions">
              <button class="btn btn--thin" type="button" data-ps-new-plan data-list-id="${escapeAttr(listId)}">+ ${escapeHtml(this.t('план', 'plan'))}</button>
              <button class="btn btn--thin" type="button" data-ps-edit-list="${escapeAttr(listId)}">${escapeHtml(this.t('редакт', 'edit'))}</button>
              <button class="btn btn--thin" type="button" data-ps-del-list="${escapeAttr(listId)}">${escapeHtml(this.t('удалить', 'delete'))}</button>
            </div>
          </header>
          <div class="ps-list-block__body">${content}</div>
        </section>
      `;
    }).join('');

    const unassignedHtml = this.sortPersonalPlans(unassigned);

    return `
      <div class="ps-layout">
        <div class="ps-top-actions">
          <button class="btn" type="button" data-ps-new-list>+ ${escapeHtml(this.t('список', 'list'))}</button>
        </div>
        ${sections || `<div class="ps-empty">${escapeHtml(this.t('создайте первый список', 'create your first list'))}</div>`}
        <section class="ps-list-block">
          <header class="ps-list-block__head">
            <div class="ps-list-block__title">${escapeHtml(this.t('без списка', 'no list'))}</div>
            <button class="btn btn--thin" type="button" data-ps-new-plan>+ ${escapeHtml(this.t('план', 'plan'))}</button>
          </header>
          <div class="ps-list-block__body">
            ${unassignedHtml.length ? unassignedHtml.map((row) => this.renderPersonalPlanRow(row)).join('') : `<div class="ps-empty">${escapeHtml(this.t('пусто', 'empty'))}</div>`}
          </div>
        </section>
      </div>
    `;
  }

  renderPersonalScheduleCalendar() {
    const ws = this.personalScheduleState();
    const listById = new Map(this.scheduleListsSorted().map((x) => [String(x.id), x]));
    const selected = parseISOToLocalDate(ws.selectedDay) || new Date();
    const monthAnchor = parseISOToLocalDate(ws.monthAnchor) || new Date(selected.getFullYear(), selected.getMonth(), 1);
    const monthStart = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
    const monthEnd = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1);
    const gridStart = startOfWeekLocal(monthStart);

    let gridEnd = new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate());
    while (gridEnd.getDay() !== 1) {
      gridEnd = addDaysLocal(gridEnd, 1);
    }

    const allPlans = this.filteredPersonalSchedulePlans();
    const countMap = new Map();
    for (let d = new Date(gridStart); d < gridEnd; d = addDaysLocal(d, 1)) {
      const dayKey = formatLocalISO(d);
      countMap.set(dayKey, this.countPlansForDay(dayKey, allPlans));
    }

    const dayButtons = [];
    for (let d = new Date(gridStart); d < gridEnd; d = addDaysLocal(d, 1)) {
      const dayKey = formatLocalISO(d);
      const inMonth = d.getMonth() === monthStart.getMonth();
      const selectedDay = dayKey === formatLocalISO(selected);
      const count = Number(countMap.get(dayKey) || 0);
      dayButtons.push(`
        <button class="ps-cal__day${inMonth ? '' : ' is-out'}${selectedDay ? ' is-selected' : ''}" type="button" data-ps-day="${escapeAttr(dayKey)}">
          <span class="ps-cal__num">${d.getDate()}</span>
          <span class="ps-cal__count">${count > 0 ? count : ''}</span>
        </button>
      `);
    }

    const selectedDayKey = formatLocalISO(selected);
    const selectedPlans = this.plansForDay(selectedDayKey, allPlans);
    const dayPanel = this.renderPersonalScheduleDayPanel(selectedDayKey, selectedPlans, listById);

    const locale = this.getLang() === 'en' ? 'en-US' : 'ru-RU';
    const monthTitle = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(monthStart);

    return `
      <div class="ps-calendar-layout">
        <section class="ps-cal">
          <header class="ps-cal__head">
            <button class="btn btn--thin" type="button" data-ps-month-nav="prev">${escapeHtml(this.t('назад', 'prev'))}</button>
            <div class="ps-cal__title">${escapeHtml(monthTitle)}</div>
            <div class="ps-cal__head-actions">
              <button class="btn btn--thin" type="button" data-ps-month-nav="today">${escapeHtml(this.t('сегодня', 'today'))}</button>
              <button class="btn btn--thin" type="button" data-ps-month-nav="next">${escapeHtml(this.t('вперед', 'next'))}</button>
            </div>
          </header>
          <div class="ps-cal__grid">${dayButtons.join('')}</div>
        </section>
        <section class="ps-day-panel">
          <header class="ps-day-panel__head">
            <div class="ps-day-panel__title-wrap">
              <div class="ps-day-panel__label">${escapeHtml(this.t('выбранный день', 'selected day'))}</div>
              <div class="ps-day-panel__date">${escapeHtml(dayPanel.dateLabel)}</div>
              <div class="ps-day-panel__iso">${escapeHtml(selectedDayKey)}</div>
              <div class="ps-day-panel__sub">${escapeHtml(dayPanel.subLine)}</div>
            </div>
            <button class="btn" type="button" data-ps-new-plan data-day="${escapeAttr(selectedDayKey)}">+ ${escapeHtml(this.t('план', 'plan'))}</button>
          </header>
          <div class="ps-day-panel__body">${dayPanel.bodyHtml}</div>
        </section>
      </div>
    `;
  }

  renderPersonalScheduleWorkspace() {
    if (!this.els.scheduleView || this.uiPrefs.view !== 'schedule') return;
    if (this.els.boardView) this.els.boardView.hidden = true;
    const ws = this.personalScheduleState();
    const active = this.activeProjectMeta();

    if (!active || !this.isScheduleProject(active)) {
      this.els.scheduleView.innerHTML = `<div class="schedule-placeholder">${escapeHtml(this.t('сначала выберите расписание', 'select schedule first'))}</div>`;
      return;
    }

    if (!ws.available) {
      this.els.scheduleView.innerHTML = `
        <div class="schedule-unavailable">
          <div class="schedule-unavailable__title">${escapeHtml(this.t('расписание временно недоступно', 'schedule is temporarily unavailable'))}</div>
          <div class="schedule-unavailable__text">${escapeHtml(ws.unavailableReason || this.t('примените stage16 sql', 'apply stage16 sql'))}</div>
        </div>
      `;
      return;
    }

    const tab = this.normalizePersonalScheduleTab(ws.tab);
    const tabItems = [
      { key: 'today', label: this.t('сегодня', 'today') },
      { key: 'lists', label: this.t('списки', 'lists') },
      { key: 'calendar', label: this.t('календарь', 'calendar') }
    ];

    let contentHtml = '';
    if (ws.loading) {
      contentHtml = `<div class="schedule-loading">${escapeHtml(this.t('загрузка расписания...', 'loading schedule...'))}</div>`;
    } else if (tab === 'today') {
      contentHtml = this.renderPersonalScheduleToday();
    } else if (tab === 'lists') {
      contentHtml = this.renderPersonalScheduleLists();
    } else {
      contentHtml = this.renderPersonalScheduleCalendar();
    }

    this.els.scheduleView.innerHTML = `
      <div class="ps-shell">
        <header class="ps-shell__head">
          <div class="ps-shell__title-wrap">
            <div class="ps-shell__kicker">${escapeHtml(this.t('личное расписание', 'personal schedule'))}</div>
            <div class="ps-shell__title">${escapeHtml(String(active.name || this.t('расписание', 'schedule')))}</div>
          </div>
          <div class="ps-shell__actions">
            <button class="btn btn--thin" type="button" data-ps-new-list>+ ${escapeHtml(this.t('список', 'list'))}</button>
            <button class="btn" type="button" data-ps-new-plan>+ ${escapeHtml(this.t('план', 'plan'))}</button>
          </div>
        </header>

        <div class="ps-tabs" role="tablist" aria-label="schedule tabs">
          ${tabItems.map((item) => `<button class="ps-tab${item.key === tab ? ' is-active' : ''}" type="button" data-ps-tab="${item.key}">${escapeHtml(item.label)}</button>`).join('')}
        </div>

        <div class="ps-content">${contentHtml}</div>
      </div>
    `;
  }

  handlePersonalScheduleClick(event) {
    const tabBtn = event.target.closest('[data-ps-tab]');
    if (tabBtn) {
      const tab = String(tabBtn.getAttribute('data-ps-tab') || 'today');
      this.setPersonalScheduleTab(tab);
      return;
    }

    const monthBtn = event.target.closest('[data-ps-month-nav]');
    if (monthBtn) {
      const mode = String(monthBtn.getAttribute('data-ps-month-nav') || 'today');
      if (mode === 'today') {
        const today = new Date();
        const todayIso = formatLocalISO(today);
        const ws = this.personalScheduleState();
        ws.monthAnchor = formatLocalISO(new Date(today.getFullYear(), today.getMonth(), 1));
        ws.selectedDay = todayIso;
        this.persistPersonalSchedulePrefs();
        this.renderSchedule();
      } else {
        this.shiftPersonalScheduleMonth(mode === 'prev' ? -1 : 1);
      }
      return;
    }

    const dayBtn = event.target.closest('[data-ps-day]');
    if (dayBtn) {
      const day = String(dayBtn.getAttribute('data-ps-day') || '');
      this.setPersonalScheduleSelectedDay(day, { syncMonth: true });
      return;
    }

    const newListBtn = event.target.closest('[data-ps-new-list]');
    if (newListBtn) {
      this.openScheduleListModal();
      return;
    }

    const editListBtn = event.target.closest('[data-ps-edit-list]');
    if (editListBtn) {
      const listId = String(editListBtn.getAttribute('data-ps-edit-list') || '');
      if (listId) this.openScheduleListModal(listId);
      return;
    }

    const delListBtn = event.target.closest('[data-ps-del-list]');
    if (delListBtn) {
      const listId = String(delListBtn.getAttribute('data-ps-del-list') || '');
      if (listId) this.openDeleteScheduleListModal(listId);
      return;
    }

    const newPlanBtn = event.target.closest('[data-ps-new-plan]');
    if (newPlanBtn) {
      const listId = String(newPlanBtn.getAttribute('data-list-id') || '').trim();
      const day = String(newPlanBtn.getAttribute('data-day') || '').trim();
      this.openCreatePersonalSchedulePlanModal({
        list_id: listId || null,
        plan_date: day || null
      });
      return;
    }

    const openPlanBtn = event.target.closest('[data-ps-open-plan]');
    if (openPlanBtn) {
      const planId = String(openPlanBtn.getAttribute('data-ps-open-plan') || '');
      if (planId) this.openEditPersonalSchedulePlanModal(planId);
      return;
    }

    const delPlanBtn = event.target.closest('[data-ps-del-plan]');
    if (delPlanBtn) {
      const planId = String(delPlanBtn.getAttribute('data-ps-del-plan') || '');
      if (planId) this.openDeletePersonalSchedulePlanModal(planId);
      return;
    }

    const toggle = event.target.closest('[data-ps-toggle]');
    if (toggle) {
      const planId = String(toggle.getAttribute('data-ps-toggle') || '');
      if (!planId) return;
      const isDone = !!toggle.checked;
      void this.toggleSchedulePlanDone(planId, isDone).catch((error) => this.onMutationError(error));
    }
  }

  handlePersonalScheduleSubmit(event) {
    event.preventDefault();
    const form = event.target.closest('[data-ps-quick-form]');
    if (!form) return;
  }

  clearPersonalScheduleDragHints(options = {}) {
    if (!this.els.scheduleView) return;
    const keepDragging = !!options.keepDragging;
    this.els.scheduleView.querySelectorAll('.ps-day-list.is-plan-drop-target,.ps-day-list.is-list-drop-before,.ps-day-list.is-list-drop-after').forEach((node) => {
      node.classList.remove('is-plan-drop-target', 'is-list-drop-before', 'is-list-drop-after');
    });
    this.els.scheduleView.querySelectorAll('.ps-plan.is-drop-before,.ps-plan.is-drop-after').forEach((node) => {
      node.classList.remove('is-drop-before', 'is-drop-after');
    });
    if (!keepDragging) {
      this.els.scheduleView.querySelectorAll('.ps-day-list.is-dragging,.ps-plan.is-dragging').forEach((node) => {
        node.classList.remove('is-dragging');
      });
    }
  }

  handlePersonalScheduleDragStart(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const planNode = target.closest('[data-ps-plan-id][data-ps-plan-draggable]');
    if (planNode) {
      const planId = String(planNode.getAttribute('data-ps-plan-id') || '').trim();
      if (!planId) return;
      const sourceListId = String(planNode.getAttribute('data-ps-plan-list-id') || '').trim();

      this.personalScheduleDrag = {
        type: 'plan',
        planId,
        sourceListId
      };

      planNode.classList.add('is-dragging');
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        try {
          event.dataTransfer.setData('text/ps-plan-id', planId);
        } catch (_) {}
      }
      this.clearPersonalScheduleDragHints({ keepDragging: true });
      return;
    }

    const listHandle = target.closest('[data-ps-list-drag-handle]');
    if (listHandle) {
      if (target.closest('button,input,select,textarea,a,label')) return;
      const listId = String(listHandle.getAttribute('data-ps-list-drag-handle') || '').trim();
      if (!listId) return;
      this.personalScheduleDrag = {
        type: 'list',
        listId
      };

      const listBlock = listHandle.closest('[data-ps-day-list-id]');
      if (listBlock) listBlock.classList.add('is-dragging');

      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        try {
          event.dataTransfer.setData('text/ps-list-id', listId);
        } catch (_) {}
      }
      this.clearPersonalScheduleDragHints({ keepDragging: true });
      return;
    }
  }

  resolvePersonalScheduleListDropTarget(target, clientY, sourceListId = '') {
    if (!(target instanceof Element)) return null;

    const sourceId = String(sourceListId || '').trim();
    const direct = target.closest('[data-ps-day-list-id]');
    if (direct) {
      const directId = String(direct.getAttribute('data-ps-day-list-id') || '').trim();
      if (directId && directId !== sourceId) {
        return direct;
      }
    }

    const root = target.closest('[data-ps-day-lists-root]');
    if (!root) return null;

    const candidates = Array.from(root.querySelectorAll('[data-ps-day-list-id]')).filter((node) => {
      const id = String(node.getAttribute('data-ps-day-list-id') || '').trim();
      return !!id && id !== sourceId;
    });
    if (!candidates.length) return null;

    let best = candidates[0];
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const node of candidates) {
      const rect = node.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const dist = Math.abs(Number(clientY) - center);
      if (dist < bestDistance) {
        best = node;
        bestDistance = dist;
      }
    }

    return best;
  }

  handlePersonalScheduleDragOver(event) {
    const drag = this.personalScheduleDrag;
    if (!drag || !drag.type) return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    if (drag.type === 'list') {
      const sourceId = String(drag.listId || '').trim();
      const listBlock = this.resolvePersonalScheduleListDropTarget(target, event.clientY, sourceId);
      if (!listBlock) return;
      const targetListId = String(listBlock.getAttribute('data-ps-day-list-id') || '').trim();
      if (!targetListId || !sourceId || targetListId === sourceId) return;

      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      this.clearPersonalScheduleDragHints({ keepDragging: true });

      const dropAfter = this.personalScheduleListDropAfter(listBlock, event.clientY);
      listBlock.classList.add(dropAfter ? 'is-list-drop-after' : 'is-list-drop-before');
      return;
    }

    if (drag.type === 'plan') {
      const listBlock = target.closest('[data-ps-day-list-drop-id]');
      if (!listBlock) return;

      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      this.clearPersonalScheduleDragHints({ keepDragging: true });
      listBlock.classList.add('is-plan-drop-target');

      const targetPlan = target.closest('[data-ps-plan-id]');
      if (targetPlan) {
        const targetPlanId = String(targetPlan.getAttribute('data-ps-plan-id') || '').trim();
        const draggedPlanId = String(drag.planId || '').trim();
        if (targetPlanId && draggedPlanId && targetPlanId !== draggedPlanId) {
          const rect = targetPlan.getBoundingClientRect();
          const dropAfter = (event.clientY - rect.top) > rect.height / 2;
          targetPlan.classList.add(dropAfter ? 'is-drop-after' : 'is-drop-before');
        }
      }
    }
  }

  handlePersonalScheduleDragEnd() {
    this.personalScheduleDrag = null;
    this.clearPersonalScheduleDragHints();
  }

  personalScheduleListDropAfter(listBlock, clientY) {
    if (!(listBlock instanceof Element)) return false;
    const rect = listBlock.getBoundingClientRect();
    if (!rect || rect.height <= 0) return false;
    const ratio = (Number(clientY) - rect.top) / rect.height;
    return ratio >= 0.55;
  }

  async handlePersonalScheduleDrop(event) {
    const drag = this.personalScheduleDrag;
    if (!drag || !drag.type) return;

    const target = event.target;
    if (!(target instanceof Element)) {
      this.handlePersonalScheduleDragEnd();
      return;
    }

    if (drag.type === 'list') {
      const sourceListId = String(drag.listId || '').trim();
      const listBlock = this.resolvePersonalScheduleListDropTarget(target, event.clientY, sourceListId);
      if (!listBlock) {
        this.handlePersonalScheduleDragEnd();
        return;
      }

      const targetListId = String(listBlock.getAttribute('data-ps-day-list-id') || '').trim();
      if (!targetListId || !sourceListId || targetListId === sourceListId) {
        this.handlePersonalScheduleDragEnd();
        return;
      }

      event.preventDefault();
      const dropAfter = this.personalScheduleListDropAfter(listBlock, event.clientY);
      this.handlePersonalScheduleDragEnd();
      await this.movePersonalScheduleList(sourceListId, targetListId, { dropAfter });
      return;
    }

    if (drag.type === 'plan') {
      const targetPlan = target.closest('[data-ps-plan-id]');
      const listBlock = target.closest('[data-ps-day-list-drop-id]');
      if (!listBlock) {
        this.handlePersonalScheduleDragEnd();
        return;
      }

      event.preventDefault();
      const planId = String(drag.planId || '').trim();
      const rawListId = String(listBlock.getAttribute('data-ps-day-list-drop-id') || '').trim();
      const targetListId = rawListId || null;
      let insertIndex = null;

      const planIdsInBlock = Array.from(listBlock.querySelectorAll('[data-ps-plan-id]'))
        .map((node) => String(node.getAttribute('data-ps-plan-id') || '').trim())
        .filter((id) => id && id !== planId);

      if (targetPlan) {
        const targetPlanId = String(targetPlan.getAttribute('data-ps-plan-id') || '').trim();
        const idx = planIdsInBlock.indexOf(targetPlanId);
        if (idx >= 0) {
          const rect = targetPlan.getBoundingClientRect();
          const dropAfter = (event.clientY - rect.top) > rect.height / 2;
          insertIndex = dropAfter ? idx + 1 : idx;
        }
      }

      if (insertIndex === null) {
        insertIndex = planIdsInBlock.length;
      }

      this.handlePersonalScheduleDragEnd();
      await this.movePersonalSchedulePlanToList(planId, targetListId, { insertIndex });
    }
  }

  async movePersonalScheduleList(listId, targetListId, options = {}) {
    const active = this.activeProjectMeta();
    if (!active || !this.isScheduleProject(active)) return;

    const sourceId = String(listId || '').trim();
    const targetId = String(targetListId || '').trim();
    if (!sourceId || !targetId || sourceId === targetId) return;

    const sortedLists = this.scheduleListsSorted().filter((list) => String(list.id || '').trim());
    const currentOrder = sortedLists.map((list) => String(list.id || '').trim());
    if (!currentOrder.includes(sourceId) || !currentOrder.includes(targetId)) return;

    const buildOrder = (dropAfter) => {
      const order = currentOrder.filter((id) => id !== sourceId);
      const targetIndex = order.indexOf(targetId);
      if (targetIndex < 0) return currentOrder.slice();
      const insertIndex = dropAfter ? targetIndex + 1 : targetIndex;
      order.splice(insertIndex, 0, sourceId);
      return order;
    };

    let nextOrder = buildOrder(!!options.dropAfter);
    if (nextOrder.join('|') === currentOrder.join('|')) {
      const flippedOrder = buildOrder(!options.dropAfter);
      if (flippedOrder.join('|') === currentOrder.join('|')) return;
      nextOrder = flippedOrder;
    }

    const ws = this.personalScheduleState();
    const prevLists = asArray(ws.lists).map((list) => ({ ...list }));
    const byId = new Map(asArray(ws.lists).map((list) => [String(list && list.id || ''), { ...list }]));

    let cursor = 1024;
    for (const id of nextOrder) {
      const list = byId.get(id);
      if (!list) continue;
      list.position = cursor;
      cursor += 1024;
      byId.set(id, list);
    }

    ws.lists = asArray(ws.lists).map((list) => {
      const id = String(list && list.id || '');
      return byId.get(id) || list;
    });
    this.renderSchedule();

    const updates = [];
    const prevById = new Map(prevLists.map((list) => [String(list && list.id || ''), list]));
    for (const id of nextOrder) {
      const nextList = byId.get(id);
      if (!nextList) continue;
      const prevList = prevById.get(id);
      const prevPos = prevList ? toPositionNumber(prevList.position) : Number.NaN;
      const nextPos = toPositionNumber(nextList.position);
      if (Number.isFinite(prevPos) && Math.abs(prevPos - nextPos) < 0.0001) continue;
      updates.push({
        p_project_id: active.id,
        p_list_id: nextList.id,
        p_name: String(nextList.name || 'list'),
        p_color: String(nextList.color || '#2f6f4f'),
        p_position: nextList.position
      });
    }

    try {
      for (const payload of updates) {
        await this.rpc('ik_plan_update_schedule_list', payload);
      }
      void this.refreshPersonalScheduleAfterMutation({ silent: true }).catch((error) => this.onMutationError(error));
    } catch (error) {
      ws.lists = prevLists;
      this.renderSchedule();
      throw error;
    }
  }

  async movePersonalSchedulePlanToList(planId, targetListId, options = {}) {
    const active = this.activeProjectMeta();
    if (!active || !this.isScheduleProject(active)) return;

    const id = String(planId || '').trim();
    if (!id) return;

    const ws = this.personalScheduleState();
    const plan = this.schedulePlanById(id);
    if (!plan) return;

    const currentListId = String(plan.list_id || '').trim() || null;
    const nextListId = String(targetListId || '').trim() || null;

    const rawInsertIndex = Number(options.insertIndex);
    const insertIndex = Number.isFinite(rawInsertIndex)
      ? Math.max(0, Math.floor(rawInsertIndex))
      : null;

    const sameList = (currentListId || '') === (nextListId || '');
    if (sameList && insertIndex === null) return;

    const prevPlans = asArray(ws.plans).map((row) => ({ ...row }));
    const prevOrder = this.serializePersonalPlanOrder();

    ws.plans = asArray(ws.plans).map((row) => {
      if (String(row && row.id || '') !== id) return row;
      return {
        ...row,
        list_id: nextListId
      };
    });
    this.applyPersonalPlanOrderMove(id, nextListId, { insertIndex });
    this.renderSchedule();

    if (sameList) return;

    const priorityRaw = String(plan.priority || 'mid').toLowerCase();
    const priority = ['low', 'mid', 'high'].includes(priorityRaw) ? priorityRaw : 'mid';

    try {
      await this.rpc('ik_plan_update_schedule_plan', {
        p_project_id: active.id,
        p_plan_id: plan.id,
        p_list_id: nextListId,
        p_title: String(plan.title || 'plan'),
        p_note: String(plan.note || ''),
        p_plan_date: String(plan.plan_date || '').trim() || null,
        p_start_time: normalizeTimeText(plan.start_time) || null,
        p_end_time: normalizeTimeText(plan.end_time) || null,
        p_priority: priority,
        p_repeat_rule: normalizeRepeatRule(plan.repeat_rule),
        p_repeat_until: String(plan.repeat_until || '').trim() || null,
        p_is_done: !!plan.is_done
      });
      void this.loadProjects({ quiet: true });
    } catch (error) {
      ws.plans = prevPlans;
      this.restorePersonalPlanOrder(prevOrder);
      this.savePersonalPlanOrder();
      this.renderSchedule();
      throw error;
    }
  }

  async openCreateScheduleProjectModal() {
    this.ui.openModal({
      title: this.t('новое расписание', 'new schedule'),
      bodyHtml: `
        <form class="form">
          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            ${this.t('название', 'name')}
            <input class="ctl" name="name" required maxlength="120" />
          </label>
          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            ${this.t('описание', 'description')}
            <textarea class="ctl" name="description" rows="3" maxlength="500"></textarea>
          </label>
          <div class="planning-modal-note">${escapeHtml(this.t('это личное расписание с вкладками: сегодня, списки, календарь', 'this is personal schedule with tabs: today, lists, calendar'))}</div>
          <div class="form__actions">
            <button class="btn" type="button" data-close>${this.t('отмена', 'cancel')}</button>
            <button class="btn" type="submit">${this.t('создать', 'create')}</button>
          </div>
        </form>
      `,
      onSubmit: (data) => {
        void this.createScheduleProjectSubmit(data).catch((error) => this.onMutationError(error));
      }
    });
  }

  async createScheduleProjectSubmit(data) {
    const name = String(data.name || '').trim();
    if (!name) {
      this.ui.toast(this.t('укажите название', 'name is required'));
      return;
    }
    const description = String(data.description || '').trim();
    const scheduleId = await this.rpc('ik_plan_create_schedule', {
      p_name: name,
      p_description: description
    });

    this.ui.closeModal();
    await this.loadProjects({ quiet: true });
    await this.selectProject(String(scheduleId), { force: true });
    this.setView('schedule');
    this.ui.toast(this.t('расписание создано', 'schedule created'));
  }

  openScheduleListModal(listId = '') {
    const base = listId ? this.scheduleListById(listId) : null;
    const title = base ? this.t('список: редактирование', 'edit list') : this.t('новый список', 'new list');
    this.ui.openModal({
      title,
      bodyHtml: `
        <form class="form">
          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            ${this.t('название', 'name')}
            <input class="ctl" name="name" required maxlength="80" value="${escapeAttr(String(base && base.name || ''))}" />
          </label>
          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            ${this.t('цвет', 'color')}
            <input class="ctl" name="color" type="color" value="${escapeAttr(String(base && base.color || '#2f6f4f'))}" />
          </label>
          <div class="form__actions">
            <button class="btn" type="button" data-close>${this.t('отмена', 'cancel')}</button>
            <button class="btn" type="submit">${this.t('сохранить', 'save')}</button>
          </div>
        </form>
      `,
      onSubmit: (data) => {
        void this.saveScheduleListSubmit(base, data).catch((error) => this.onMutationError(error));
      }
    });
  }

  async saveScheduleListSubmit(base, data) {
    const active = this.activeProjectMeta();
    if (!active || !this.isScheduleProject(active)) return;
    const ws = this.personalScheduleState();
    const name = String(data.name || '').trim();
    if (!name) {
      this.ui.toast(this.t('укажите название списка', 'list name is required'));
      return;
    }
    const color = String(data.color || '#2f6f4f');
    const nowIso = new Date().toISOString();

    if (base && base.id) {
      await this.rpc('ik_plan_update_schedule_list', {
        p_project_id: active.id,
        p_list_id: base.id,
        p_name: name,
        p_color: color,
        p_position: base.position
      });

      ws.lists = asArray(ws.lists).map((row) => {
        if (String(row && row.id || '') !== String(base.id)) return row;
        return {
          ...row,
          name,
          color,
          position: base.position,
          updated_at: nowIso
        };
      });
    } else {
      const listId = await this.rpc('ik_plan_create_schedule_list', {
        p_project_id: active.id,
        p_name: name,
        p_color: color
      });

      const maxPos = asArray(ws.lists).reduce((maxValue, row) => {
        return Math.max(maxValue, toPositionNumber(row && row.position));
      }, 0);

      ws.lists = [
        ...asArray(ws.lists),
        {
          id: String(listId || ''),
          project_id: String(active.id),
          name,
          color,
          position: maxPos + 1024,
          version: 1,
          created_at: nowIso,
          updated_at: nowIso
        }
      ];
    }

    this.ui.closeModal();
    this.ensurePersonalPlanOrderReady(String(active.id));
    this.renderSchedule();
    void this.refreshPersonalScheduleAfterMutation({ silent: true }).catch((error) => this.onMutationError(error));
    this.ui.toast(this.t('список сохранен', 'list saved'));
  }

  openDeleteScheduleListModal(listId) {
    const list = this.scheduleListById(listId);
    if (!list) return;
    this.ui.openModal({
      title: this.t('удалить список', 'delete list'),
      bodyHtml: `
        <form class="form">
          <div style="font-size:11px; letter-spacing:2px; text-transform:uppercase; opacity:.82; line-height:1.5;">
            ${escapeHtml(this.t('удалить список', 'delete list'))}: ${escapeHtml(String(list.name || ''))}?
          </div>
          <div class="planning-modal-note">${escapeHtml(this.t('планы из списка останутся и будут без списка', 'plans stay, but without list'))}</div>
          <div class="form__actions">
            <button class="btn" type="button" data-close>${this.t('отмена', 'cancel')}</button>
            <button class="btn" type="submit">${this.t('удалить', 'delete')}</button>
          </div>
        </form>
      `,
      onSubmit: () => {
        void this.deleteScheduleListSubmit(list).catch((error) => this.onMutationError(error));
      }
    });
  }

  async deleteScheduleListSubmit(list) {
    const active = this.activeProjectMeta();
    if (!active || !this.isScheduleProject(active)) return;
    const ws = this.personalScheduleState();

    await this.rpc('ik_plan_delete_schedule_list', {
      p_project_id: active.id,
      p_list_id: list.id,
      p_move_plan_to: null
    });

    ws.lists = asArray(ws.lists).filter((row) => String(row && row.id || '') !== String(list.id || ''));
    ws.plans = asArray(ws.plans).map((row) => {
      if (String(row && row.list_id || '') !== String(list.id || '')) return row;
      return {
        ...row,
        list_id: null
      };
    });
    this.ensurePersonalPlanOrderReady(String(active.id));
    this.syncPersonalPlanOrderWithWorkspace();

    this.ui.closeModal();
    this.renderSchedule();
    void this.refreshPersonalScheduleAfterMutation({ silent: true }).catch((error) => this.onMutationError(error));
    this.ui.toast(this.t('список удален', 'list deleted'));
  }

  buildSchedulePlanPayloadFromForm(data) {
    const title = String(data.title || '').trim();
    if (!title) {
      this.ui.toast(this.t('укажите название плана', 'plan title is required'));
      return null;
    }

    const planDate = parseISOToLocalDate(data.plan_date)
      ? String(data.plan_date)
      : null;
    const startTime = normalizeTimeText(data.start_time) || null;
    const endTime = normalizeTimeText(data.end_time) || null;
    if (startTime && endTime && endTime <= startTime) {
      this.ui.toast(this.t('конец должен быть позже начала', 'end must be later than start'));
      return null;
    }

    const priority = ['low', 'mid', 'high'].includes(String(data.priority || '').toLowerCase())
      ? String(data.priority).toLowerCase()
      : 'mid';

    const repeatRule = normalizeRepeatRule(data.repeat_rule);
    const repeatUntil = parseISOToLocalDate(data.repeat_until)
      ? String(data.repeat_until)
      : null;

    if (repeatRule !== 'none' && !planDate) {
      this.ui.toast(this.t('для повторения укажите дату', 'set a date for repeat'));
      return null;
    }

    if (repeatRule !== 'none' && repeatUntil && planDate && repeatUntil < planDate) {
      this.ui.toast(this.t('дата окончания повторения не может быть раньше даты плана', 'repeat end date cannot be earlier than plan date'));
      return null;
    }

    return {
      list_id: String(data.list_id || '').trim() || null,
      title,
      note: String(data.note || '').trim(),
      plan_date: planDate,
      start_time: startTime,
      end_time: endTime,
      priority,
      repeat_rule: repeatRule,
      repeat_until: repeatRule === 'none' ? null : repeatUntil,
      is_done: data.is_done === 'on' || String(data.is_done || '').toLowerCase() === 'true'
    };
  }

  openCreatePersonalSchedulePlanModal(seed = {}) {
    const ws = this.personalScheduleState();
    const day = parseISOToLocalDate(seed.plan_date || ws.selectedDay) || new Date();
    const listId = String(seed.list_id || '').trim();
    const repeatRule = normalizeRepeatRule(seed.repeat_rule || 'none');
    const repeatUntil = parseISOToLocalDate(seed.repeat_until) ? String(seed.repeat_until) : '';
    this.ui.openModal({
      title: this.t('новый план', 'new plan'),
      bodyHtml: `
        <form class="form">
          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            ${this.t('название', 'title')}
            <input class="ctl" name="title" required maxlength="220" />
          </label>
          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            ${this.t('заметка', 'note')}
            <textarea class="ctl" name="note" rows="3" maxlength="2000"></textarea>
          </label>
          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            ${this.t('список', 'list')}
            <select class="ctl" name="list_id">${this.scheduleListOptionsHtml(listId)}</select>
          </label>
          <div class="form__grid2">
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('дата', 'date')}
              <input class="ctl" type="date" name="plan_date" value="${escapeAttr(formatLocalISO(day))}" />
            </label>
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('приоритет', 'priority')}
              <select class="ctl" name="priority">
                <option value="low">LOW</option>
                <option value="mid" selected>MID</option>
                <option value="high">HIGH</option>
              </select>
            </label>
          </div>
          <div class="form__grid2">
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('повторение', 'repeat')}
              <select class="ctl" name="repeat_rule">${this.scheduleRepeatRuleOptionsHtml(repeatRule)}</select>
            </label>
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('повторять до', 'repeat until')}
              <input class="ctl" type="date" name="repeat_until" value="${escapeAttr(repeatUntil)}" />
            </label>
          </div>
          <div class="form__grid2">
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('начало', 'start')}
              <input class="ctl" type="time" name="start_time" />
            </label>
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('конец', 'end')}
              <input class="ctl" type="time" name="end_time" />
            </label>
          </div>
          <div class="form__actions">
            <button class="btn" type="button" data-close>${this.t('отмена', 'cancel')}</button>
            <button class="btn" type="submit">${this.t('сохранить', 'save')}</button>
          </div>
        </form>
      `,
      onSubmit: (data) => {
        void this.saveSchedulePlanSubmit(null, data).catch((error) => this.onMutationError(error));
      }
    });
  }

  openEditPersonalSchedulePlanModal(planId) {
    const plan = this.schedulePlanById(planId);
    if (!plan) return;
    this.ui.openModal({
      title: this.t('редактировать план', 'edit plan'),
      bodyHtml: `
        <form class="form">
          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            ${this.t('название', 'title')}
            <input class="ctl" name="title" required maxlength="220" value="${escapeAttr(String(plan.title || ''))}" />
          </label>
          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            ${this.t('заметка', 'note')}
            <textarea class="ctl" name="note" rows="3" maxlength="2000">${escapeHtml(String(plan.note || ''))}</textarea>
          </label>
          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            ${this.t('список', 'list')}
            <select class="ctl" name="list_id">${this.scheduleListOptionsHtml(String(plan.list_id || ''))}</select>
          </label>
          <div class="form__grid2">
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('дата', 'date')}
              <input class="ctl" type="date" name="plan_date" value="${escapeAttr(String(plan.plan_date || ''))}" />
            </label>
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('приоритет', 'priority')}
              <select class="ctl" name="priority">
                <option value="low" ${String(plan.priority) === 'low' ? 'selected' : ''}>LOW</option>
                <option value="mid" ${String(plan.priority) !== 'low' && String(plan.priority) !== 'high' ? 'selected' : ''}>MID</option>
                <option value="high" ${String(plan.priority) === 'high' ? 'selected' : ''}>HIGH</option>
              </select>
            </label>
          </div>
          <div class="form__grid2">
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('повторение', 'repeat')}
              <select class="ctl" name="repeat_rule">${this.scheduleRepeatRuleOptionsHtml(String(plan.repeat_rule || 'none'))}</select>
            </label>
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('повторять до', 'repeat until')}
              <input class="ctl" type="date" name="repeat_until" value="${escapeAttr(String(plan.repeat_until || ''))}" />
            </label>
          </div>
          <div class="form__grid2">
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('начало', 'start')}
              <input class="ctl" type="time" name="start_time" value="${escapeAttr(normalizeTimeText(plan.start_time))}" />
            </label>
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('конец', 'end')}
              <input class="ctl" type="time" name="end_time" value="${escapeAttr(normalizeTimeText(plan.end_time))}" />
            </label>
          </div>
          <label style="display:flex; align-items:center; gap:8px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            <input type="checkbox" name="is_done" ${plan.is_done ? 'checked' : ''} />
            ${this.t('выполнено', 'done')}
          </label>
          <div class="form__actions">
            <button class="btn" type="button" data-close>${this.t('отмена', 'cancel')}</button>
            <button class="btn" type="submit">${this.t('сохранить', 'save')}</button>
          </div>
        </form>
      `,
      onSubmit: (data) => {
        void this.saveSchedulePlanSubmit(plan, data).catch((error) => this.onMutationError(error));
      }
    });
  }

  async saveSchedulePlanSubmit(basePlan, data) {
    const active = this.activeProjectMeta();
    if (!active || !this.isScheduleProject(active)) return;
    const ws = this.personalScheduleState();
    const payload = this.buildSchedulePlanPayloadFromForm(data);
    if (!payload) return;
    const nowIso = new Date().toISOString();

    if (basePlan && basePlan.id) {
      await this.rpc('ik_plan_update_schedule_plan', {
        p_project_id: active.id,
        p_plan_id: basePlan.id,
        p_list_id: payload.list_id,
        p_title: payload.title,
        p_note: payload.note,
        p_plan_date: payload.plan_date,
        p_start_time: payload.start_time,
        p_end_time: payload.end_time,
        p_priority: payload.priority,
        p_repeat_rule: payload.repeat_rule,
        p_repeat_until: payload.repeat_until,
        p_is_done: payload.is_done
      });

      ws.plans = asArray(ws.plans).map((row) => {
        if (String(row && row.id || '') !== String(basePlan.id || '')) return row;
        return {
          ...row,
          list_id: payload.list_id,
          title: payload.title,
          note: payload.note,
          plan_date: payload.plan_date,
          start_time: payload.start_time,
          end_time: payload.end_time,
          priority: payload.priority,
          repeat_rule: payload.repeat_rule,
          repeat_until: payload.repeat_until,
          is_done: payload.is_done,
          updated_at: nowIso
        };
      });

      const prevListId = String(basePlan.list_id || '').trim() || null;
      const nextListId = String(payload.list_id || '').trim() || null;
      if ((prevListId || '') !== (nextListId || '')) {
        this.applyPersonalPlanOrderMove(String(basePlan.id || ''), payload.list_id, {});
      }
    } else {
      const planId = await this.rpc('ik_plan_create_schedule_plan', {
        p_project_id: active.id,
        p_list_id: payload.list_id,
        p_title: payload.title,
        p_note: payload.note,
        p_plan_date: payload.plan_date,
        p_start_time: payload.start_time,
        p_end_time: payload.end_time,
        p_priority: payload.priority,
        p_repeat_rule: payload.repeat_rule,
        p_repeat_until: payload.repeat_until
      });

      const id = String(planId || '');
      ws.plans = [
        ...asArray(ws.plans),
        {
          id,
          project_id: String(active.id),
          list_id: payload.list_id,
          title: payload.title,
          note: payload.note,
          plan_date: payload.plan_date,
          start_time: payload.start_time,
          end_time: payload.end_time,
          priority: payload.priority,
          repeat_rule: payload.repeat_rule,
          repeat_until: payload.repeat_until,
          is_done: false,
          version: 1,
          created_at: nowIso,
          updated_at: nowIso
        }
      ];
      this.applyPersonalPlanOrderMove(id, payload.list_id, {});
    }

    this.ui.closeModal();
    this.ensurePersonalPlanOrderReady(String(active.id));
    this.syncPersonalPlanOrderWithWorkspace();
    this.renderSchedule();
    void this.refreshPersonalScheduleAfterMutation({ silent: true }).catch((error) => this.onMutationError(error));
    this.ui.toast(this.t('план сохранен', 'plan saved'));
  }

  openDeletePersonalSchedulePlanModal(planId) {
    const plan = this.schedulePlanById(planId);
    if (!plan) return;
    this.ui.openModal({
      title: this.t('удалить план', 'delete plan'),
      bodyHtml: `
        <form class="form">
          <div style="font-size:11px; letter-spacing:2px; text-transform:uppercase; opacity:.82; line-height:1.5;">
            ${escapeHtml(this.t('удалить план', 'delete plan'))}: ${escapeHtml(String(plan.title || ''))}?
          </div>
          <div class="form__actions">
            <button class="btn" type="button" data-close>${this.t('отмена', 'cancel')}</button>
            <button class="btn" type="submit">${this.t('удалить', 'delete')}</button>
          </div>
        </form>
      `,
      onSubmit: () => {
        void this.deleteSchedulePlanSubmit(plan).catch((error) => this.onMutationError(error));
      }
    });
  }

  async deleteSchedulePlanSubmit(plan) {
    const active = this.activeProjectMeta();
    if (!active || !this.isScheduleProject(active)) return;
    const ws = this.personalScheduleState();

    await this.rpc('ik_plan_delete_schedule_plan', {
      p_project_id: active.id,
      p_plan_id: plan.id
    });

    ws.plans = asArray(ws.plans).filter((row) => String(row && row.id || '') !== String(plan.id || ''));
    this.ensurePersonalPlanOrderReady(String(active.id));
    this.syncPersonalPlanOrderWithWorkspace();

    this.ui.closeModal();
    this.renderSchedule();
    void this.refreshPersonalScheduleAfterMutation({ silent: true }).catch((error) => this.onMutationError(error));
    this.ui.toast(this.t('план удален', 'plan deleted'));
  }

  async toggleSchedulePlanDone(planId, isDone) {
    const active = this.activeProjectMeta();
    if (!active || !this.isScheduleProject(active)) return;

    const ws = this.personalScheduleState();
    const prevPlans = asArray(ws.plans).map((row) => ({ ...row }));
    ws.plans = asArray(ws.plans).map((row) => {
      if (String(row && row.id || '') !== String(planId || '')) return row;
      return {
        ...row,
        is_done: !!isDone
      };
    });
    this.renderSchedule();

    try {
      await this.rpc('ik_plan_toggle_schedule_plan_done', {
        p_project_id: active.id,
        p_plan_id: planId,
        p_is_done: !!isDone
      });
      await this.refreshPersonalScheduleAfterMutation({ silent: true });
    } catch (error) {
      ws.plans = prevPlans;
      this.renderSchedule();
      throw error;
    }
  }

  async refreshPersonalScheduleAfterMutation(options = {}) {
    const silent = options.silent !== false;
    await this.loadProjects({ quiet: true });
    await this.loadPersonalScheduleWorkspace({ force: true, silent });
    this.renderProjectSelect();
    this.renderProjectBar();
  }

  eventAssigneeLabel(eventRow) {
    const handle = String(eventRow.assignee_user_id || eventRow.assignee_nickname || eventRow.assignee_id || '').trim();
    if (!handle) return '';
    return handle.startsWith('@') ? handle : `@${handle}`;
  }

  scheduleEventMatchesFilters(row) {
    const assignee = String(this.uiPrefs.assignee || 'all');
    const assigneeId = String((row && row.assignee_id) || '');

    if (assignee === 'me' && assigneeId !== String(this.user && this.user.id || '')) return false;
    if (assignee === 'unassigned' && assigneeId) return false;
    if (assignee !== 'all' && assignee !== 'me' && assignee !== 'unassigned' && assigneeId !== assignee) return false;

    const q = String(this.uiPrefs.q || '').trim().toLowerCase();
    if (q) {
      const hay = `${row.title || ''} ${row.description || ''} ${row.location || ''} ${asArray(row.tags).join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    const wantedTags = parseFilterTags(this.uiPrefs.tags || '');
    if (wantedTags.length) {
      const eventTags = asArray(row.tags).map((x) => String(x).toLowerCase());
      for (const tag of wantedTags) {
        if (!eventTags.includes(tag)) return false;
      }
    }

    return true;
  }

  getTaskDeadlinesByDay(dayKeys) {
    const result = new Map(dayKeys.map((k) => [k, []]));
    const board = this.state.board;
    if (!board || !board.project) return result;

    const q = String(this.uiPrefs.q || '').trim().toLowerCase();
    const wantedTags = parseFilterTags(this.uiPrefs.tags || '');
    const wantedAssignee = String(this.uiPrefs.assignee || 'all').trim();
    const wantedPriority = String(this.uiPrefs.priority || 'all').trim();

    const cards = this.getCardsForProject().filter((card) => {
      const key = String(card.deadline || '').trim();
      if (!key || !result.has(key)) return false;

      if (q) {
        const hay = `${card.name || ''} ${card.description || ''} ${asArray(card.tags).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (wantedTags.length) {
        const taskTags = asArray(card.tags).map((x) => String(x).toLowerCase());
        for (const tag of wantedTags) {
          if (!taskTags.includes(tag)) return false;
        }
      }

      if (wantedPriority !== 'all' && String(card.priority || '').toLowerCase() !== wantedPriority) {
        return false;
      }

      const assigneeId = String(card.assignee_id || '');
      if (wantedAssignee === 'me' && assigneeId !== String(this.user && this.user.id || '')) return false;
      if (wantedAssignee === 'unassigned' && assigneeId) return false;
      if (wantedAssignee !== 'all' && wantedAssignee !== 'me' && wantedAssignee !== 'unassigned' && assigneeId !== wantedAssignee) {
        return false;
      }

      return true;
    });

    for (const card of cards) {
      const key = String(card.deadline || '').trim();
      if (!key || !result.has(key)) continue;
      result.get(key).push(card);
    }

    for (const [key, list] of result.entries()) {
      list.sort((a, b) => {
        const ap = { high: 3, mid: 2, low: 1 }[String(a.priority || '').toLowerCase()] || 0;
        const bp = { high: 3, mid: 2, low: 1 }[String(b.priority || '').toLowerCase()] || 0;
        if (bp !== ap) return bp - ap;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
      result.set(key, list.slice(0, 6));
    }

    return result;
  }

  renderScheduleEventRow(row) {
    const assignee = this.eventAssigneeLabel(row);
    const tags = asArray(row.tags);
    const pieces = [];
    if (assignee) pieces.push(`${this.t('ответственный', 'assignee')}: ${assignee}`);
    if (row.location) pieces.push(`${this.t('место', 'location')}: ${String(row.location)}`);
    if (tags.length) pieces.push(`#${tags.slice(0, 4).join(' #')}`);

    return `
      <article class="schedule-item${row.all_day ? ' is-all-day' : ''}" data-event-id="${escapeAttr(String(row.id))}">
        <div class="schedule-item__time">${escapeHtml(eventTimeLabel(row.start_at, row.end_at, !!row.all_day, this.getLang()))}</div>
        <div class="schedule-item__title">${escapeHtml(String(row.title || this.t('событие', 'event')))}</div>
        ${row.description ? `<div class="schedule-item__desc">${escapeHtml(shortText(row.description, 130))}</div>` : ''}
        ${pieces.length ? `<div class="schedule-item__meta">${escapeHtml(pieces.join(' | '))}</div>` : ''}
        <div class="schedule-item__actions">
          <button class="btn btn--thin" type="button" data-schedule-open="${escapeAttr(String(row.id))}">${escapeHtml(this.t('открыть', 'open'))}</button>
          <button class="btn btn--thin" type="button" data-schedule-del="${escapeAttr(String(row.id))}">${escapeHtml(this.t('удалить', 'delete'))}</button>
        </div>
      </article>
    `;
  }

  renderSchedule() {
    if (!this.els.scheduleView || this.uiPrefs.view !== 'schedule') return;

    if (this.isScheduleProject()) {
      this.renderPersonalScheduleWorkspace();
      return;
    }

    const board = this.state.board;
    if (!board || !board.project) {
      this.els.scheduleView.innerHTML = `
        <div class="schedule-placeholder">${escapeHtml(this.t('сначала выберите проект', 'select project first'))}</div>
      `;
      return;
    }

    if (!this.state.schedule.available) {
      this.els.scheduleView.innerHTML = `
        <div class="schedule-unavailable">
          <div class="schedule-unavailable__title">${escapeHtml(this.t('расписание временно недоступно', 'schedule is temporarily unavailable'))}</div>
          <div class="schedule-unavailable__text">${escapeHtml(this.state.schedule.unavailableReason || this.t('примените stage15 sql', 'apply stage15 sql'))}</div>
        </div>
      `;
      return;
    }

    const win = this.getScheduleWindow();
    const allEvents = asArray(this.state.schedule.events).filter((row) => this.scheduleEventMatchesFilters(row));
    const eventsByDay = new Map(win.dayKeys.map((k) => [k, []]));

    for (const row of allEvents) {
      const key = toLocalDayKey(row.start_at);
      if (!eventsByDay.has(key)) continue;
      eventsByDay.get(key).push(row);
    }

    for (const [key, list] of eventsByDay.entries()) {
      list.sort((a, b) => {
        const ad = Date.parse(String(a.start_at || ''));
        const bd = Date.parse(String(b.start_at || ''));
        return ad - bd;
      });
      eventsByDay.set(key, list);
    }

    const deadlineByDay = this.getTaskDeadlinesByDay(win.dayKeys);
    const totalEvents = allEvents.length;
    const rangeButtons = [
      { key: 'today', label: this.t('сегодня', 'today') },
      { key: 'this_week', label: this.t('эта неделя', 'this week') },
      { key: 'next_week', label: this.t('следующая неделя', 'next week') },
      { key: 'two_weeks', label: this.t('2 недели', '2 weeks') },
      { key: 'month', label: this.t('месяц', 'month') }
    ];

    const headerHtml = `
      <div class="schedule-headline">
        <div class="schedule-headline__left">
          <div class="schedule-headline__kicker">${escapeHtml(this.t('расписание', 'schedule'))}</div>
          <div class="schedule-headline__range">${escapeHtml(this.formatScheduleRangeTitle(win))}</div>
          <div class="schedule-headline__meta">${escapeHtml(this.t('событий', 'events'))}: ${totalEvents}</div>
        </div>
        <div class="schedule-headline__actions">
          <button class="btn btn--thin" type="button" data-schedule-nav="prev">${escapeHtml(this.t('назад', 'prev'))}</button>
          <button class="btn btn--thin" type="button" data-schedule-nav="today">${escapeHtml(this.t('сегодня', 'today'))}</button>
          <button class="btn btn--thin" type="button" data-schedule-nav="next">${escapeHtml(this.t('вперед', 'next'))}</button>
          <button class="btn" type="button" data-schedule-new>${escapeHtml(this.t('+ событие', '+ event'))}</button>
        </div>
      </div>

      <div class="schedule-ranges">
        ${rangeButtons.map((x) => `<button class="schedule-ranges__btn${x.key === win.key ? ' is-active' : ''}" type="button" data-schedule-range="${x.key}">${escapeHtml(x.label)}</button>`).join('')}
        <button class="schedule-ranges__btn" type="button" data-schedule-copy-week>${escapeHtml(this.t('копировать неделю +1', 'copy week +1'))}</button>
      </div>

      <form class="schedule-quick" data-schedule-quick-form>
        <input class="ctl schedule-quick__input" name="quick" placeholder="${escapeAttr(this.t('быстро: пн 14:00-15:30 математика', 'quick: mon 14:00-15:30 math'))}" />
        <button class="btn" type="submit">${escapeHtml(this.t('добавить', 'add'))}</button>
      </form>
    `;

    if (this.state.schedule.loading) {
      this.els.scheduleView.innerHTML = `
        <div class="schedule-app">
          ${headerHtml}
          <div class="schedule-loading">${escapeHtml(this.t('загрузка расписания...', 'loading schedule...'))}</div>
        </div>
      `;
      return;
    }

    const gridHtml = win.days.map((day) => {
      const dayKey = formatLocalISO(day);
      const events = eventsByDay.get(dayKey) || [];
      const cards = deadlineByDay.get(dayKey) || [];
      const eventsHtml = events.length
        ? events.map((row) => this.renderScheduleEventRow(row)).join('')
        : `<div class="schedule-day__empty">${escapeHtml(this.t('нет событий', 'no events'))}</div>`;
      const cardsHtml = cards.length
        ? `<div class="schedule-day__tasks">${cards.map((card) => `<span class="schedule-task-chip schedule-task-chip--${escapeAttr(String(card.priority || 'mid'))}">${escapeHtml(shortText(card.name, 42))}</span>`).join('')}</div>`
        : '';
      return `
        <section class="schedule-day" data-day="${escapeAttr(dayKey)}">
          <header class="schedule-day__head">
            <div class="schedule-day__title">${escapeHtml(this.formatScheduleDayLabel(day))}</div>
            <button class="btn btn--thin" type="button" data-schedule-add-day="${escapeAttr(dayKey)}">+ ${escapeHtml(this.t('событие', 'event'))}</button>
          </header>
          <div class="schedule-day__body">${eventsHtml}</div>
          ${cardsHtml}
        </section>
      `;
    }).join('');

    this.els.scheduleView.innerHTML = `
      <div class="schedule-app">
        ${headerHtml}
        <div class="schedule-grid schedule-grid--${win.days.length}">
          ${gridHtml}
        </div>
      </div>
    `;
  }

  findScheduleEventById(eventId) {
    return asArray(this.state.schedule.events).find((x) => String(x.id) === String(eventId)) || null;
  }

  buildSchedulePayloadFromForm(data) {
    const title = String(data.title || '').trim();
    if (!title) {
      this.ui.toast(this.t('укажите название события', 'event title is required'));
      return null;
    }

    const day = parseISOToLocalDate(data.date);
    if (!day) {
      this.ui.toast(this.t('укажите дату', 'date is required'));
      return null;
    }

    const allDay = data.all_day === 'on' || data.all_day === true || String(data.all_day || '') === 'true';
    const startText = String(data.start_time || '').trim() || '09:00';
    const endText = String(data.end_time || '').trim() || '10:00';

    let startAt;
    let endAt;

    if (allDay) {
      startAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
      endAt = addDaysLocal(startAt, 1);
    } else {
      const startMatch = startText.match(/^(\d{1,2}):(\d{2})$/);
      const endMatch = endText.match(/^(\d{1,2}):(\d{2})$/);
      if (!startMatch || !endMatch) {
        this.ui.toast(this.t('проверьте формат времени HH:MM', 'check time format HH:MM'));
        return null;
      }

      startAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(startMatch[1]), Number(startMatch[2]), 0, 0);
      endAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(endMatch[1]), Number(endMatch[2]), 0, 0);
      if (endAt.getTime() <= startAt.getTime()) {
        endAt = addMinutes(startAt, 60);
      }
    }

    let repeatRule = String(data.repeat_rule || 'none').trim().toLowerCase();
    if (!['none', 'weekly'].includes(repeatRule)) repeatRule = 'none';
    const repeatUntil = repeatRule === 'weekly' && parseISOToLocalDate(data.repeat_until)
      ? String(data.repeat_until)
      : null;

    return {
      title,
      description: String(data.description || '').trim(),
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      all_day: allDay,
      location: String(data.location || '').trim(),
      tags: parseTags(data.tags),
      assignee_id: String(data.assignee_id || '').trim() || null,
      repeat_rule: repeatRule,
      repeat_until: repeatUntil
    };
  }

  async createScheduleEvent(payload, options = {}) {
    const board = this.state.board;
    if (!board || !board.project) return null;
    const skipReload = !!options.skipReload;

    const result = await this.rpc('ik_plan_create_schedule_event', {
      p_project_id: board.project.id,
      p_title: payload.title,
      p_description: payload.description,
      p_start_at: payload.start_at,
      p_end_at: payload.end_at,
      p_all_day: payload.all_day,
      p_location: payload.location,
      p_tags: payload.tags,
      p_assignee_id: payload.assignee_id,
      p_repeat_rule: payload.repeat_rule,
      p_repeat_until: payload.repeat_until,
      p_base_revision: board.project.revision
    });

    if (!skipReload) {
      await this.loadBoard(board.project.id);
      await this.loadScheduleWindow({ force: true });
    }

    return result;
  }

  async quickAddSchedule(raw) {
    const payload = this.parseQuickSchedule(raw);
    if (!payload) {
      this.ui.toast(this.t('формат: пн 14:00-15:30 математика', 'format: mon 14:00-15:30 math'));
      return;
    }

    await this.createScheduleEvent(payload);
    const input = this.els.scheduleView && this.els.scheduleView.querySelector('[name="quick"]');
    if (input) input.value = '';
    this.ui.toast(this.t('событие добавлено', 'event added'));
    this.renderSchedule();
  }

  parseQuickSchedule(raw) {
    const text = String(raw || '').trim();
    if (!text) return null;

    const dayMap = {
      'пн': 1, 'пон': 1, mon: 1,
      'вт': 2, 'вто': 2, tue: 2,
      'ср': 3, 'сре': 3, wed: 3,
      'чт': 4, 'чет': 4, thu: 4,
      'пт': 5, 'пят': 5, fri: 5,
      'сб': 6, 'суб': 6, sat: 6,
      'вс': 0, 'воск': 0, sun: 0
    };

    const match = text.match(/^(?:(\S+)\s+)?(?:(\d{1,2}:\d{2})(?:\s*[-–]\s*(\d{1,2}:\d{2}))?\s+)?(.+)$/i);
    if (!match) return null;

    const dayToken = String(match[1] || '').toLowerCase();
    const startTime = String(match[2] || '').trim();
    const endTime = String(match[3] || '').trim();
    const title = String(match[4] || '').trim();
    if (!title) return null;

    const win = this.getScheduleWindow();
    let dayDate = win.startDate;

    if (dayToken && Object.prototype.hasOwnProperty.call(dayMap, dayToken)) {
      const wanted = dayMap[dayToken];
      const found = win.days.find((d) => d.getDay() === wanted) || null;
      dayDate = found || win.startDate;
    }

    let startAt;
    let endAt;
    let allDay = false;

    if (startTime) {
      const s = startTime.match(/^(\d{1,2}):(\d{2})$/);
      if (!s) return null;
      const e = endTime ? endTime.match(/^(\d{1,2}):(\d{2})$/) : null;
      startAt = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), Number(s[1]), Number(s[2]), 0, 0);
      if (e) {
        endAt = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), Number(e[1]), Number(e[2]), 0, 0);
      } else {
        endAt = addMinutes(startAt, 60);
      }
      if (endAt.getTime() <= startAt.getTime()) endAt = addMinutes(startAt, 60);
    } else {
      allDay = true;
      startAt = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 0, 0, 0, 0);
      endAt = addDaysLocal(startAt, 1);
    }

    return {
      title,
      description: '',
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      all_day: allDay,
      location: '',
      tags: [],
      assignee_id: null,
      repeat_rule: 'none',
      repeat_until: null
    };
  }

  async openCreateScheduleEventModal(seed = {}) {
    const board = this.state.board;
    if (!board || !board.project) {
      this.ui.toast(this.t('сначала выберите проект', 'select project first'));
      return;
    }

    const day = parseISOToLocalDate(seed.day) || new Date();
    const dateValue = formatLocalISO(day);
    const startValue = '09:00';
    const endValue = '10:00';
    const assigneeOptions = this.assigneeOptionsHtml('');

    this.ui.openModal({
      title: this.t('новое событие', 'new event'),
      bodyHtml: `
        <form class="form" data-schedule-form>
          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            ${this.t('название', 'title')}
            <input class="ctl" name="title" required maxlength="180" />
          </label>

          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            ${this.t('описание', 'description')}
            <textarea class="ctl" name="description" rows="3" maxlength="500"></textarea>
          </label>

          <div class="form__grid2">
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('дата', 'date')}
              <input class="ctl" name="date" type="date" required value="${escapeAttr(dateValue)}" />
            </label>

            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('весь день', 'all day')}
              <select class="ctl" name="all_day">
                <option value="false">${this.t('нет', 'no')}</option>
                <option value="true">${this.t('да', 'yes')}</option>
              </select>
            </label>
          </div>

          <div class="form__grid2">
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('начало', 'start')}
              <input class="ctl" name="start_time" type="time" value="${escapeAttr(startValue)}" />
            </label>

            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('конец', 'end')}
              <input class="ctl" name="end_time" type="time" value="${escapeAttr(endValue)}" />
            </label>
          </div>

          <div class="form__grid2">
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('место', 'location')}
              <input class="ctl" name="location" maxlength="120" />
            </label>

            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('теги', 'tags')}
              <input class="ctl" name="tags" maxlength="120" placeholder="study, work" />
            </label>
          </div>

          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            ${this.t('ответственный', 'assignee')}
            <select class="ctl" name="assignee_id">${assigneeOptions}</select>
          </label>

          <div class="form__grid2">
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('повтор', 'repeat')}
              <select class="ctl" name="repeat_rule">
                <option value="none">${this.t('без повтора', 'none')}</option>
                <option value="weekly">${this.t('каждую неделю', 'weekly')}</option>
              </select>
            </label>

            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('повторять до', 'repeat until')}
              <input class="ctl" name="repeat_until" type="date" />
            </label>
          </div>

          <div class="form__actions">
            <button class="btn" type="button" data-close>${this.t('отмена', 'cancel')}</button>
            <button class="btn" type="submit">${this.t('сохранить', 'save')}</button>
          </div>
        </form>
      `,
      onSubmit: (data) => {
        void this.createScheduleEventSubmit(data).catch((error) => this.onMutationError(error));
      }
    });
  }

  async createScheduleEventSubmit(data) {
    const payload = this.buildSchedulePayloadFromForm(data);
    if (!payload) return;

    try {
      const out = await this.createScheduleEvent(payload);
      const created = Number(out && out.created || 1);
      this.ui.closeModal();
      this.ui.toast(created > 1
        ? this.t(`добавлено событий: ${created}`, `events added: ${created}`)
        : this.t('событие создано', 'event created'));
    } catch (error) {
      if (this.looksLikeScheduleSchemaError(error)) {
        this.disableSchedule(this.t('расписание недоступно: требуется stage15 sql', 'schedule unavailable: stage15 sql required'));
        if (!this.scheduleSchemaWarnShown) {
          this.scheduleSchemaWarnShown = true;
          this.ui.toast(this.t(
            'для расписания примените SQL: supabase/sql/stage15_planning_schedule.sql',
            'for schedule apply SQL: supabase/sql/stage15_planning_schedule.sql'
          ));
        }
        return;
      }
      throw error;
    }
  }

  async openScheduleEventModal(eventId) {
    const row = this.findScheduleEventById(eventId);
    if (!row) return;

    const start = new Date(row.start_at);
    const end = new Date(row.end_at);
    const dateValue = formatLocalISO(start);
    const startValue = formatTimeHM(start);
    const endValue = formatTimeHM(end);
    const assigneeOptions = this.assigneeOptionsHtml(String(row.assignee_id || ''));

    this.ui.openModal({
      title: this.t('редактировать событие', 'edit event'),
      bodyHtml: `
        <form class="form">
          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            ${this.t('название', 'title')}
            <input class="ctl" name="title" required maxlength="180" value="${escapeAttr(String(row.title || ''))}" />
          </label>

          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            ${this.t('описание', 'description')}
            <textarea class="ctl" name="description" rows="3" maxlength="500">${escapeHtml(String(row.description || ''))}</textarea>
          </label>

          <div class="form__grid2">
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('дата', 'date')}
              <input class="ctl" name="date" type="date" required value="${escapeAttr(dateValue)}" />
            </label>
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('весь день', 'all day')}
              <select class="ctl" name="all_day">
                <option value="false" ${row.all_day ? '' : 'selected'}>${this.t('нет', 'no')}</option>
                <option value="true" ${row.all_day ? 'selected' : ''}>${this.t('да', 'yes')}</option>
              </select>
            </label>
          </div>

          <div class="form__grid2">
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('начало', 'start')}
              <input class="ctl" name="start_time" type="time" value="${escapeAttr(startValue)}" />
            </label>
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('конец', 'end')}
              <input class="ctl" name="end_time" type="time" value="${escapeAttr(endValue)}" />
            </label>
          </div>

          <div class="form__grid2">
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('место', 'location')}
              <input class="ctl" name="location" maxlength="120" value="${escapeAttr(String(row.location || ''))}" />
            </label>
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('теги', 'tags')}
              <input class="ctl" name="tags" maxlength="120" value="${escapeAttr(asArray(row.tags).join(', '))}" />
            </label>
          </div>

          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            ${this.t('ответственный', 'assignee')}
            <select class="ctl" name="assignee_id">${assigneeOptions}</select>
          </label>

          <div class="form__actions">
            <button class="btn" type="button" data-close>${this.t('отмена', 'cancel')}</button>
            <button class="btn" type="submit">${this.t('сохранить', 'save')}</button>
          </div>
        </form>
      `,
      onSubmit: (data) => {
        void this.updateScheduleEventSubmit(row, data).catch((error) => this.onMutationError(error));
      }
    });
  }

  async updateScheduleEventSubmit(baseRow, data) {
    const board = this.state.board;
    if (!board || !board.project) return;
    const payload = this.buildSchedulePayloadFromForm(data);
    if (!payload) return;

    try {
      await this.rpc('ik_plan_update_schedule_event', {
        p_project_id: board.project.id,
        p_event_id: baseRow.id,
        p_title: payload.title,
        p_description: payload.description,
        p_start_at: payload.start_at,
        p_end_at: payload.end_at,
        p_all_day: payload.all_day,
        p_location: payload.location,
        p_tags: payload.tags,
        p_assignee_id: payload.assignee_id,
        p_base_version: baseRow.version,
        p_base_revision: board.project.revision
      });
      this.ui.closeModal();
      await this.loadBoard(board.project.id);
      await this.loadScheduleWindow({ force: true });
      this.ui.toast(this.t('событие сохранено', 'event saved'));
    } catch (error) {
      if (this.looksLikeScheduleSchemaError(error)) {
        this.disableSchedule(this.t('расписание недоступно: требуется stage15 sql', 'schedule unavailable: stage15 sql required'));
        return;
      }
      throw error;
    }
  }

  async openDeleteScheduleEventModal(eventId) {
    const row = this.findScheduleEventById(eventId);
    if (!row) return;
    this.ui.openModal({
      title: this.t('удалить событие', 'delete event'),
      bodyHtml: `
        <form class="form">
          <div style="font-size:11px; letter-spacing:2px; text-transform:uppercase; opacity:.8; line-height:1.5;">
            ${escapeHtml(this.t('удалить событие', 'delete event'))}: ${escapeHtml(String(row.title || ''))}?
          </div>
          <div class="form__actions">
            <button class="btn" type="button" data-close>${this.t('отмена', 'cancel')}</button>
            <button class="btn" type="submit">${this.t('удалить', 'delete')}</button>
          </div>
        </form>
      `,
      onSubmit: () => {
        void this.deleteScheduleEventSubmit(row).catch((error) => this.onMutationError(error));
      }
    });
  }

  async deleteScheduleEventSubmit(row) {
    const board = this.state.board;
    if (!board || !board.project) return;

    try {
      await this.rpc('ik_plan_delete_schedule_event', {
        p_project_id: board.project.id,
        p_event_id: row.id,
        p_base_version: row.version,
        p_base_revision: board.project.revision
      });
    } catch (error) {
      if (this.looksLikeScheduleSchemaError(error)) {
        this.disableSchedule(this.t('расписание недоступно: требуется stage15 sql', 'schedule unavailable: stage15 sql required'));
        return;
      }
      throw error;
    }

    this.ui.closeModal();
    await this.loadBoard(board.project.id);
    await this.loadScheduleWindow({ force: true });
    this.ui.toast(this.t('событие удалено', 'event deleted'));
  }

  async copyCurrentWeekToNext() {
    const board = this.state.board;
    if (!board || !board.project) return;

    const win = this.getScheduleWindow();
    if (!['this_week', 'next_week', 'two_weeks'].includes(win.key)) {
      this.ui.toast(this.t('копирование недели доступно в недельном режиме', 'week copy is available in week mode'));
      return;
    }

    const sourceStart = formatLocalISO(startOfWeekLocal(win.startDate));
    const targetStart = formatLocalISO(addDaysLocal(startOfWeekLocal(win.startDate), 7));

    let copied = 0;
    try {
      copied = await this.rpc('ik_plan_copy_schedule_week', {
        p_project_id: board.project.id,
        p_source_week_start: sourceStart,
        p_target_week_start: targetStart,
        p_base_revision: board.project.revision
      });
    } catch (error) {
      if (this.looksLikeScheduleSchemaError(error)) {
        this.disableSchedule(this.t('расписание недоступно: требуется stage15 sql', 'schedule unavailable: stage15 sql required'));
        return;
      }
      throw error;
    }

    await this.loadBoard(board.project.id);
    await this.loadScheduleWindow({ force: true });
    this.ui.toast(this.t(`скопировано событий: ${copied}`, `events copied: ${copied}`));
  }

  renderProjectSelect() {
    const el = this.els.projectSelect;
    if (!el) return;

    const projects = this.getScopeFilteredProjects();
    el.innerHTML = '';

    if (!projects.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = this.state.projects.length
        ? this.t('НЕТ ПРОЕКТОВ В РАЗДЕЛЕ', 'NO PROJECTS IN SCOPE')
        : this.t('НЕТ ПРОЕКТОВ', 'NO PROJECTS');
      opt.selected = true;
      el.appendChild(opt);
      el.disabled = true;
      return;
    }

    el.disabled = false;
    for (const p of projects) {
      const opt = document.createElement('option');
      opt.value = p.id;
      const projectName = String(p.name || '').toUpperCase();
      const kind = this.normalizeProjectKind(p.kind);
      opt.textContent = kind === 'schedule'
        ? `${this.t('РАСПИСАНИЕ', 'SCHEDULE')} · ${projectName}`
        : projectName;
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
      const kind = this.normalizeProjectKind(p.kind);
      chip.setAttribute('data-kind', kind);

      const role = roleLabel(p.role, this.getLang());
      const scopeText = this.projectScopeText(p);
      const count = kind === 'schedule'
        ? Number(p.plan_count || 0)
        : (
          this.state.board &&
          this.state.board.project &&
          String(this.state.board.project.id) === String(p.id)
            ? asArray(this.state.board.cards).length
            : Number(p.card_count || 0)
        );
      const canDelete = String(p.role || '') === 'owner';
      const kindText = kind === 'schedule'
        ? this.t('расписание', 'schedule')
        : this.t('проект', 'project');
      const deleteLabel = kind === 'schedule'
        ? this.t('удалить расписание', 'delete schedule')
        : this.t('удалить проект', 'delete project');
      const controlsHtml = kind === 'board'
        ? `<button class="proj-chip__ctl" type="button" aria-label="${escapeAttr(this.t('управление колонками', 'manage columns'))}">c</button>`
        : '';

      chip.innerHTML = `
        <span class="proj-chip__name">${escapeHtml(String(p.name || '').toUpperCase())}</span>
        <span class="proj-chip__count">${count}</span>
        <span class="proj-chip__scope">${escapeHtml(scopeText)}</span>
        <span class="proj-chip__kind">${escapeHtml(kindText)}</span>
        <span class="proj-chip__count">${escapeHtml(role)}</span>
        ${controlsHtml}
        <button class="proj-chip__del" type="button" aria-label="${escapeAttr(deleteLabel)}" ${canDelete ? '' : 'disabled'}>x</button>
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
    if (assignee) parts.push(`${this.t('ответственный', 'assignee')}: ${assignee}`);
    const tags = asArray(card.tags);
    if (tags.length) parts.push(`tags: ${tags.join(' | ')}`);
    return parts.join(' | ') || '-';
  }

  renderBoard() {
    if (!this.els.boardView || this.uiPrefs.view === 'schedule') return;

    const board = this.state.board;
    if (!board || !board.project) {
      if (!this.state.projects.length) {
        this.renderEmptyBoard(this.t('проектов пока нет. создайте первый проект.', 'no projects yet. create your first project.'));
      } else if (!this.getScopeFilteredProjects().length) {
        this.renderEmptyBoard(this.t('в этом разделе нет проектов. переключите фильтр.', 'no projects in this section. switch scope filter.'));
      } else {
        this.renderEmptyBoard(this.t('нет активного проекта', 'no active project'));
      }
      return;
    }

    const columns = this.getSortedColumns();
    if (!columns.length) {
      this.renderEmptyBoard(this.t('нет колонок. откройте настройки колонок и создайте минимум одну.', 'no columns. open column settings and create at least one.'));
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
    const priorityKey = String(card.priority || 'mid').toLowerCase();
    const deadlineDate = parseISOToLocalDate(card.deadline);
    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const isOverdue = !!deadlineDate && deadlineDate.getTime() < todayDate.getTime() && !isDone;
    const isToday = !!deadlineDate && deadlineDate.getTime() === todayDate.getTime();

    cardEl.className = `card${isDone ? ' card--done' : ''}${isOverdue ? ' card--overdue' : ''}${isToday ? ' card--today' : ''}`;
    cardEl.style.setProperty('--accent', column.color || '#111111');
    cardEl.draggable = true;
    cardEl.dataset.id = String(card.id);
    cardEl.dataset.columnId = String(card.column_id);

    const assignee = this.assigneeLabel(card);
    const tags = asArray(card.tags).slice(0, 5);
    const description = shortText(card.description, 130);
    const priorityLabel = this.t('приоритет', 'priority');
    const deadlineLabel = this.t('срок', 'deadline');
    const deadlineText = card.deadline
      ? String(card.deadline)
      : this.t('без срока', 'no deadline');

    cardEl.innerHTML = `
      <div class="card__top">
        <h3 class="card__name">${escapeHtml(card.name || this.t('задача', 'task'))}</h3>
        <span class="card__priority card__priority--${escapeAttr(priorityKey)}">${escapeHtml(String(priorityKey || 'mid').toUpperCase())}</span>
      </div>
      ${description ? `<p class="card__desc">${escapeHtml(description)}</p>` : ''}
      <div class="card__facts">
        <span class="card__fact"><strong>${escapeHtml(priorityLabel)}:</strong> ${escapeHtml(String(priorityKey || 'mid').toUpperCase())}</span>
        <span class="card__fact"><strong>${escapeHtml(deadlineLabel)}:</strong> ${escapeHtml(deadlineText)}</span>
        ${assignee ? `<span class="card__fact"><strong>${escapeHtml(this.t('ответственный', 'assignee'))}:</strong> ${escapeHtml(assignee)}</span>` : ''}
      </div>
      ${tags.length ? `<div class="card__tags">${tags.map((tag) => `<span class="card__tag">#${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
      <p class="card__editing" data-editing></p>
      <div class="card__actions">
        <button class="btn btn--thin" type="button" data-act="open">${escapeHtml(this.t('открыть', 'open'))}</button>
        <button class="btn btn--thin" type="button" data-act="del">${escapeHtml(this.t('удалить', 'delete'))}</button>
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
      this.ui.toast(this.t('позиция пересчитана', 'position rebased'));
    }
    this.scheduleBoardReload(40);
  }

  findCardById(cardId) {
    const cards = asArray(this.state.board && this.state.board.cards);
    return cards.find((c) => String(c.id) === String(cardId)) || null;
  }

  boardPresetColumns(preset) {
    const key = String(preset || 'classic').toLowerCase();
    if (key === 'study') {
      return [
        { id: uid(), name: 'ideas', color: '#264653', role: 'todo' },
        { id: uid(), name: 'this week', color: '#1d3557', role: 'doing' },
        { id: uid(), name: 'today', color: '#e09f3e', role: 'doing' },
        { id: uid(), name: 'done', color: '#2a9d8f', role: 'done' }
      ];
    }
    if (key === 'lean') {
      return [
        { id: uid(), name: 'todo', color: '#1f2937', role: 'todo' },
        { id: uid(), name: 'in progress', color: '#c26d1f', role: 'doing' },
        { id: uid(), name: 'done', color: '#2f855a', role: 'done' }
      ];
    }
    return [
      { id: uid(), name: 'backlog', color: '#111111', role: 'todo' },
      { id: uid(), name: 'in progress', color: '#aa5f00', role: 'doing' },
      { id: uid(), name: 'review', color: '#005aaa', role: 'doing' },
      { id: uid(), name: 'done', color: '#008c46', role: 'done' }
    ];
  }

  buildTemplateScheduleEntries(template, weekOffset) {
    const key = SCHEDULE_TEMPLATE_KEYS.includes(String(template || '').toLowerCase())
      ? String(template || '').toLowerCase()
      : 'none';
    if (key === 'none') return [];

    const start = addDaysLocal(startOfWeekLocal(new Date()), Number(weekOffset || 0) * 7);
    const entries = [];

    const addEntry = (dayOffset, startTime, endTime, title, description = '', tags = []) => {
      const day = addDaysLocal(start, dayOffset);
      const s = startTime.match(/^(\d{1,2}):(\d{2})$/);
      const e = endTime.match(/^(\d{1,2}):(\d{2})$/);
      if (!s || !e) return;
      const startAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(s[1]), Number(s[2]), 0, 0);
      const endAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(e[1]), Number(e[2]), 0, 0);
      entries.push({
        title,
        description,
        start_at: startAt.toISOString(),
        end_at: endAt.getTime() > startAt.getTime() ? endAt.toISOString() : addMinutes(startAt, 60).toISOString(),
        all_day: false,
        location: '',
        tags,
        assignee_id: null,
        repeat_rule: 'none',
        repeat_until: null
      });
    };

    if (key === 'study') {
      for (let i = 0; i < 5; i += 1) {
        addEntry(i, '09:00', '10:30', this.t('фокус-блок', 'focus block'), this.t('главная учебная цель дня', 'main study goal of the day'), ['study']);
        addEntry(i, '11:00', '12:30', this.t('практика', 'practice'), this.t('закрепление материала', 'practice and reinforcement'), ['practice']);
      }
      addEntry(5, '11:00', '12:00', this.t('повторение недели', 'weekly recap'), this.t('разбор сложных тем', 'review difficult topics'), ['recap']);
    } else if (key === 'work') {
      for (let i = 0; i < 5; i += 1) {
        addEntry(i, '09:00', '13:00', this.t('рабочий блок', 'work block'), this.t('ключевые задачи', 'key priorities'), ['work']);
        addEntry(i, '14:00', '17:30', this.t('глубокая работа', 'deep work'), this.t('без отвлечений', 'no distractions'), ['deep']);
      }
    } else if (key === 'balanced') {
      for (let i = 0; i < 5; i += 1) {
        addEntry(i, '09:00', '10:30', this.t('план дня', 'day planning'), this.t('определить главное', 'define key outcomes'), ['plan']);
        addEntry(i, '11:00', '13:00', this.t('главный блок', 'main block'), this.t('самое важное', 'highest impact task'), ['focus']);
        addEntry(i, '18:00', '19:00', this.t('личные дела', 'personal time'), this.t('дом, спорт, отдых', 'home, fitness, rest'), ['life']);
      }
      addEntry(6, '12:00', '13:00', this.t('подготовка следующей недели', 'next week prep'), this.t('план + приоритеты', 'plan and priorities'), ['weekly']);
    }

    return entries;
  }

  parseScheduleSeedLines(raw, weekOffset) {
    const lines = String(raw || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean).slice(0, 40);
    if (!lines.length) return [];

    const start = addDaysLocal(startOfWeekLocal(new Date()), Number(weekOffset || 0) * 7);
    const dayMap = {
      'пн': 0, 'пон': 0, mon: 0,
      'вт': 1, 'вто': 1, tue: 1,
      'ср': 2, 'сре': 2, wed: 2,
      'чт': 3, 'чет': 3, thu: 3,
      'пт': 4, 'пят': 4, fri: 4,
      'сб': 5, 'суб': 5, sat: 5,
      'вс': 6, 'воск': 6, sun: 6
    };

    const out = [];

    for (const line of lines) {
      const m = line.match(/^(\S+)\s+(\d{1,2}:\d{2})(?:\s*[-–]\s*(\d{1,2}:\d{2}))?\s+(.+)$/i);
      if (!m) continue;
      const dayToken = String(m[1] || '').toLowerCase();
      if (!Object.prototype.hasOwnProperty.call(dayMap, dayToken)) continue;
      const day = addDaysLocal(start, dayMap[dayToken]);

      const st = String(m[2] || '09:00');
      const et = String(m[3] || '');
      const title = String(m[4] || '').trim();
      if (!title) continue;

      const s = st.match(/^(\d{1,2}):(\d{2})$/);
      const e = et.match(/^(\d{1,2}):(\d{2})$/);
      if (!s) continue;

      const startAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(s[1]), Number(s[2]), 0, 0);
      const endAt = e
        ? new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(e[1]), Number(e[2]), 0, 0)
        : addMinutes(startAt, 60);

      out.push({
        title,
        description: '',
        start_at: startAt.toISOString(),
        end_at: endAt.getTime() > startAt.getTime() ? endAt.toISOString() : addMinutes(startAt, 60).toISOString(),
        all_day: false,
        location: '',
        tags: [],
        assignee_id: null,
        repeat_rule: 'none',
        repeat_until: null
      });
    }

    return out;
  }

  async seedScheduleEntries(projectId, entries) {
    const rows = asArray(entries).filter(Boolean);
    if (!rows.length) return 0;

    let count = 0;
    for (const row of rows) {
      try {
        await this.rpc('ik_plan_create_schedule_event', {
          p_project_id: projectId,
          p_title: row.title,
          p_description: row.description || '',
          p_start_at: row.start_at,
          p_end_at: row.end_at,
          p_all_day: !!row.all_day,
          p_location: row.location || '',
          p_tags: asArray(row.tags),
          p_assignee_id: row.assignee_id || null,
          p_repeat_rule: 'none',
          p_repeat_until: null,
          p_base_revision: null
        });
        count += 1;
      } catch (error) {
        if (this.looksLikeScheduleSchemaError(error)) {
          if (!this.scheduleSchemaWarnShown) {
            this.scheduleSchemaWarnShown = true;
            this.ui.toast(this.t(
              'для расписания примените SQL: supabase/sql/stage15_planning_schedule.sql',
              'for schedule apply SQL: supabase/sql/stage15_planning_schedule.sql'
            ));
          }
          this.disableSchedule(this.t('расписание недоступно: требуется stage15 sql', 'schedule unavailable: stage15 sql required'));
          break;
        }
        throw error;
      }
    }

    return count;
  }

  openCreateProjectModal() {
    this.ui.openModal({
      title: this.t('новый проект', 'new project'),
      bodyHtml: `
        <form class="form" data-project-wizard>
          <div class="planning-wizard-tabs" role="tablist" aria-label="project create tabs">
            <button class="planning-wizard-tab is-active" type="button" data-wizard-tab="project">${escapeHtml(this.t('проект', 'project'))}</button>
            <button class="planning-wizard-tab" type="button" data-wizard-tab="board">${escapeHtml(this.t('доска', 'board'))}</button>
            <button class="planning-wizard-tab" type="button" data-wizard-tab="schedule">${escapeHtml(this.t('расписание', 'schedule'))}</button>
          </div>

          <section class="planning-wizard-panel" data-wizard-panel="project">
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('название', 'name')}
              <input class="ctl" name="name" required maxlength="120" />
            </label>

            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('описание', 'description')}
              <textarea class="ctl" name="description" rows="3" maxlength="500"></textarea>
            </label>
          </section>

          <section class="planning-wizard-panel" data-wizard-panel="board" hidden>
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('шаблон доски', 'board preset')}
              <select class="ctl" name="board_preset">
                <option value="classic">${this.t('классический', 'classic')}</option>
                <option value="study">${this.t('учебный', 'study')}</option>
                <option value="lean">${this.t('компактный', 'lean')}</option>
              </select>
            </label>
            <div class="planning-modal-note">${escapeHtml(this.t('можно изменить потом через управление колонками', 'you can change later in columns settings'))}</div>
          </section>

          <section class="planning-wizard-panel" data-wizard-panel="schedule" hidden>
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('старт расписания', 'schedule start')}
              <select class="ctl" name="schedule_start_week">
                <option value="0">${this.t('эта неделя', 'this week')}</option>
                <option value="1">${this.t('следующая неделя', 'next week')}</option>
              </select>
            </label>

            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('шаблон расписания', 'schedule template')}
              <select class="ctl" name="schedule_template">
                <option value="none">${this.t('без шаблона', 'none')}</option>
                <option value="study">${this.t('учебная неделя', 'study week')}</option>
                <option value="work">${this.t('рабочая неделя', 'work week')}</option>
                <option value="balanced">${this.t('сбалансированная', 'balanced')}</option>
              </select>
            </label>

            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              ${this.t('быстрые строки расписания', 'quick schedule lines')}
              <textarea class="ctl" name="schedule_lines" rows="5" placeholder="пн 14:00-15:30 математика&#10;вт 10:00-11:00 english"></textarea>
            </label>
            <div class="planning-modal-note">${escapeHtml(this.t('формат строки: день время-время название', 'line format: day time-time title'))}</div>
          </section>

          <div class="form__actions">
            <button class="btn" type="button" data-close>${this.t('отмена', 'cancel')}</button>
            <button class="btn" type="submit">${this.t('создать', 'create')}</button>
          </div>
        </form>
      `,
      onSubmit: (data) => {
        void this.createProjectSubmit(data).catch((error) => this.onMutationError(error));
      },
      onMount: (bodyEl) => {
        const tabs = Array.from(bodyEl.querySelectorAll('[data-wizard-tab]'));
        const panels = Array.from(bodyEl.querySelectorAll('[data-wizard-panel]'));
        const switchTab = (key) => {
          tabs.forEach((tab) => {
            const active = String(tab.getAttribute('data-wizard-tab')) === key;
            tab.classList.toggle('is-active', active);
          });
          panels.forEach((panel) => {
            panel.hidden = String(panel.getAttribute('data-wizard-panel')) !== key;
          });
        };

        tabs.forEach((tab) => {
          tab.addEventListener('click', () => {
            switchTab(String(tab.getAttribute('data-wizard-tab') || 'project'));
          });
        });
      }
    });
  }

  async createProjectSubmit(data) {
    const name = String(data.name || '').trim();
    if (!name) return;
    const description = String(data.description || '').trim();
    const boardPreset = ['classic', 'study', 'lean'].includes(String(data.board_preset || ''))
      ? String(data.board_preset)
      : 'classic';
    const scheduleTemplate = SCHEDULE_TEMPLATE_KEYS.includes(String(data.schedule_template || '').toLowerCase())
      ? String(data.schedule_template || '').toLowerCase()
      : 'none';
    const scheduleWeekOffset = Number.parseInt(String(data.schedule_start_week || '0'), 10) === 1 ? 1 : 0;
    const scheduleLines = String(data.schedule_lines || '');

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

    if (boardPreset !== 'classic') {
      await this.rpc('ik_plan_save_columns', {
        p_project_id: projectId,
        p_columns: this.boardPresetColumns(boardPreset),
        p_base_revision: null
      });
    }

    const scheduleEntries = [
      ...this.buildTemplateScheduleEntries(scheduleTemplate, scheduleWeekOffset),
      ...this.parseScheduleSeedLines(scheduleLines, scheduleWeekOffset)
    ];

    let seeded = 0;
    if (scheduleEntries.length) {
      seeded = await this.seedScheduleEntries(projectId, scheduleEntries);
    }

    await this.selectProject(String(projectId), { force: true });
    if (this.uiPrefs.view === 'schedule') {
      await this.loadScheduleWindow({ force: true });
    }

    this.ui.toast(this.t('проект создан', 'project created'));
    if (seeded > 0) {
      this.ui.toast(this.t(`добавлено событий: ${seeded}`, `events added: ${seeded}`));
    }
  }

  openDeleteProjectModal(projectId) {
    const target = this.state.projects.find((p) => String(p.id) === String(projectId));
    if (!target) return;

    const isSchedule = this.normalizeProjectKind(target.kind) === 'schedule';
    const noun = isSchedule ? this.t('расписание', 'schedule') : this.t('проект', 'project');
    const title = `${this.t('удалить', 'delete')} ${noun}`;

    this.ui.openModal({
      title,
      bodyHtml: `
        <form class="form">
          <div style="font-size:11px; letter-spacing:2px; text-transform:uppercase; opacity:.8; line-height:1.5;">
            ${escapeHtml(this.t('удалить', 'delete'))} ${escapeHtml(noun)} ${escapeHtml(String(target.name || '').toUpperCase())}? ${escapeHtml(this.t('действие необратимо', 'this action cannot be undone'))}.
          </div>
          <div class="form__actions">
            <button class="btn" type="button" data-close>${this.t('отмена', 'cancel')}</button>
            <button class="btn" type="submit">${this.t('удалить', 'delete')}</button>
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
    const fallbackId = this.resolveScopedProjectId(scoped, { preferId: prevActiveId });
    this.state.activeProjectId = stillActive ? stillActive.id : (fallbackId || (scoped[0] ? scoped[0].id : null));
    this.storeActiveProjectId(this.state.activeProjectId);

    if (this.state.activeProjectId) {
      await this.selectProject(this.state.activeProjectId, { force: true });
    } else {
      this.state.board = null;
      this.state.schedule.events = [];
      this.state.schedule.lastRangeKey = '';
      this.renderBoard();
      this.renderSchedule();
      this.renderPresence();
      this.renderAssigneeFilter();
      this.syncToolbarByProject();
    }

    this.ui.toast(this.t('проект удален', 'project deleted'));
  }

  async openInviteFriendModal() {
    const board = this.state.board;
    if (!board || !board.project) {
      this.ui.toast(this.t('сначала выберите проект', 'select project first'));
      return;
    }

    await this.loadFriends({ quiet: true, force: true });

    const canManageMembers = ['owner', 'editor'].includes(String(board.project.role || '').toLowerCase());
    const scopeText = this.projectScopeText(board.project);
    const lang = this.getLang();

    const friendOptions = this.state.friends.map((f) => {
      return `<option value="${escapeAttr(String(f.user_id || ''))}">${escapeHtml(String(f.label || f.user_id || ''))}</option>`;
    }).join('');

    const pending = asArray(board.invitations)
      .filter((x) => String(x.status) === 'pending')
      .map((x) => {
        const invitee = String(x.invitee_user_id || x.invitee_nickname || x.invitee_id || 'user');
        return `
          <div class="planning-member-row">
            <div class="planning-member-row__main">${escapeHtml(invitee)}</div>
            <button class="btn" type="button" data-cancel-invite="${escapeAttr(String(x.id))}">${lang === 'en' ? 'cancel' : 'отменить'}</button>
          </div>
        `;
      })
      .join('');

    const members = asArray(board.members)
      .map((m) => {
        const userId = String(m.user_id || '').trim();
        const role = roleLabel(m.role, this.getLang());
        const label = this.resolveMemberLabel(m);
        const isSelf = userId === String(this.user && this.user.id || '');
        const canRemove = canManageMembers && !isSelf;
        return `
          <div class="planning-member-row">
            <div class="planning-member-row__meta">
              <div class="planning-member-row__main">${escapeHtml(label)}</div>
              <div class="planning-member-row__sub">${escapeHtml(role)}</div>
            </div>
            <button class="btn" type="button" data-remove-member="${escapeAttr(userId)}" ${canRemove ? '' : 'disabled'}>${lang === 'en' ? 'remove' : 'удалить'}</button>
          </div>
        `;
      })
      .join('');

    this.ui.openModal({
      title: this.t('добавить друга', 'invite friend'),
      bodyHtml: `
        <form class="form" data-invite-form>
          <div class="planning-modal-note">${this.t('тип проекта', 'project scope')}: ${escapeHtml(scopeText)}</div>

          <label class="planning-modal-field">
            ${this.t('друг из списка', 'friend from list')}
            <select class="ctl" name="friend_user_id" data-friend-pick>
              <option value="">${this.state.friends.length ? this.t('выбрать друга', 'choose friend') : this.t('друзей пока нет', 'no friends yet')}</option>
              ${friendOptions}
            </select>
          </label>

          <label class="planning-modal-field">
            ${this.t('или user-id друга', 'or friend user-id')}
            <input class="ctl" name="target_user_id" maxlength="32" autocomplete="off" data-friend-user-id />
          </label>

          <label class="planning-modal-field">
            ${this.t('сообщение (необязательно)', 'message (optional)')}
            <input class="ctl" name="message" maxlength="300" />
          </label>

          <div class="form__actions">
            <button class="btn" type="button" data-close>${this.t('закрыть', 'close')}</button>
            <button class="btn" type="submit">${this.t('отправить приглашение', 'send invite')}</button>
          </div>
        </form>

        <div class="planning-modal-title">${this.t('ожидающие приглашения', 'pending invites')}</div>
        <div class="planning-modal-list">
          ${pending || `<div class="planning-modal-empty">${this.t('нет ожидающих приглашений', 'no pending invites')}</div>`}
        </div>

        <div class="planning-modal-title">${this.t('участники', 'members')}</div>
        <div class="planning-modal-list">
          ${members || `<div class="planning-modal-empty">${this.t('участников пока нет', 'no members yet')}</div>`}
        </div>
      `,
      onSubmit: (data) => {
        void this.inviteFriendSubmit(data).catch((error) => this.onMutationError(error));
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

    const targetFromInput = String(data.target_user_id || '').trim().toLowerCase();
    const targetFromPick = String(data.friend_user_id || '').trim().toLowerCase();
    const targetUserId = targetFromInput || targetFromPick;
    const message = String(data.message || '').trim();
    if (!targetUserId) {
      this.ui.toast(this.t('выберите друга из списка или введите user-id', 'select friend or enter user-id'));
      return;
    }

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
    this.ui.toast(this.t('приглашение отправлено', 'invite sent'));
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
    this.ui.toast(this.t('приглашение отменено', 'invite cancelled'));
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
    this.ui.toast(this.t('участник удален', 'member removed'));
  }

  async openIncomingInvitesModal() {
    await this.loadIncomingInvitations({ quiet: true });
    const invites = this.state.incomingInvites;
    const lang = this.getLang();

    const rows = invites.map((row) => {
      const inviter = String(row.inviter_user_id || row.inviter_nickname || row.inviter_id || 'user');
      const project = String(row.project_name || this.t('проект', 'project'));
      const expiresAt = String(row.expires_at || '');
      const expiresText = expiresAt ? new Date(expiresAt).toLocaleString() : '';
      return `
        <article class="planning-invite-row">
          <div class="planning-invite-row__project">${escapeHtml(project)}</div>
          <div class="planning-invite-row__from">${lang === 'en' ? 'from' : 'от'} @${escapeHtml(inviter)}</div>
          ${expiresText ? `<div class="planning-invite-row__meta">${lang === 'en' ? 'expires' : 'до'}: ${escapeHtml(expiresText)}</div>` : ''}
          <div class="planning-invite-row__actions">
            <button class="btn" type="button" data-invite-action="reject" data-id="${escapeAttr(String(row.invitation_id))}">${lang === 'en' ? 'reject' : 'отклонить'}</button>
            <button class="btn" type="button" data-invite-action="accept" data-id="${escapeAttr(String(row.invitation_id))}">${lang === 'en' ? 'accept' : 'принять'}</button>
          </div>
        </article>
      `;
    }).join('');

    this.ui.openModal({
      title: this.t('входящие приглашения', 'incoming invites'),
      bodyHtml: `
        <div class="planning-invite-list">
          ${rows || `<div class="planning-modal-empty">${this.t('нет входящих приглашений', 'no incoming invites')}</div>`}
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

    this.ui.toast(accept ? this.t('приглашение принято', 'invitation accepted') : this.t('приглашение отклонено', 'invitation rejected'));
  }

  openColumnsModal() {
    const board = this.state.board;
    if (!board || !board.project) {
      this.ui.toast(this.t('сначала выберите проект', 'select project first'));
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
              this.ui.toast(this.t('нужна минимум одна колонка', 'at least one column required'));
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
      this.ui.toast(this.t('нужна минимум одна колонка', 'at least one column required'));
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
    this.ui.toast(this.t('колонки сохранены', 'columns saved'));
  }

  openCreateCardModal() {
    const board = this.state.board;
    if (!board || !board.project) {
      this.ui.toast(this.t('сначала выберите проект', 'select project first'));
      return;
    }

    const columns = this.getSortedColumns();
    if (!columns.length) {
      this.ui.toast(this.t('нет колонок', 'no columns'));
      return;
    }

    const draft = this.loadCardDraft('create', board.project.id) || {};
    const assigneeOptions = this.assigneeOptionsHtml(String(draft.assignee_id || ''));

    this.ui.openModal({
      title: 'new task',
      bodyHtml: `
        <form class="form">
          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            name
            <input class="ctl" name="name" required maxlength="240" value="${escapeAttr(draft.name || '')}" />
          </label>

          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            description
            <textarea class="ctl" name="description" rows="4" maxlength="4000">${escapeHtml(draft.description || '')}</textarea>
          </label>

          <div class="form__grid2">
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              column
              <select class="ctl" name="column_id">${columns.map((c) => {
                const selected = String(c.id) === String(draft.column_id || columns[0]?.id || '') ? 'selected' : '';
                return `<option value="${escapeAttr(c.id)}" ${selected}>${escapeHtml(String(c.name || '').toUpperCase())}</option>`;
              }).join('')}</select>
            </label>

            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              priority
              <select class="ctl" name="priority">
                ${PRIORITIES.map((p) => `<option value="${p.key}" ${String(draft.priority || 'mid') === p.key ? 'selected' : ''}>${p.label}</option>`).join('')}
              </select>
            </label>
          </div>

          <div class="form__grid2">
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              deadline
              <input class="ctl" name="deadline" type="date" value="${escapeAttr(draft.deadline || '')}" />
            </label>

            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              tags
              <input class="ctl" name="tags" maxlength="120" placeholder="study, work" value="${escapeAttr(draft.tags || '')}" />
            </label>
          </div>

          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            ${this.t('ответственный', 'assignee')}
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
      },
      onMount: (bodyEl) => {
        const form = bodyEl.querySelector('form');
        if (!form || !board || !board.project) return;
        const saveDraft = () => {
          const fd = new FormData(form);
          this.saveCardDraft('create', board.project.id, '', {
            name: String(fd.get('name') || ''),
            description: String(fd.get('description') || ''),
            column_id: String(fd.get('column_id') || ''),
            priority: String(fd.get('priority') || 'mid'),
            deadline: String(fd.get('deadline') || ''),
            tags: String(fd.get('tags') || ''),
            assignee_id: String(fd.get('assignee_id') || '')
          });
        };
        form.addEventListener('input', saveDraft);
        form.addEventListener('change', saveDraft);
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
          this.ui.toast(this.t('примените stage10 sql для поддержки ответственного', 'apply stage10 sql for assignee support'));
        }
      } else {
        throw error;
      }
    }

    this.clearCardDraft('create', board.project.id, '');
    this.ui.closeModal();
    await this.loadBoard(board.project.id);
    this.ui.toast(this.t('задача создана', 'task created'));
  }

  openCardModal(cardId) {
    const board = this.state.board;
    if (!board || !board.project) return;

    const card = this.findCardById(cardId);
    if (!card) return;

    const draft = this.loadCardDraft('edit', this.state.activeProjectId, card.id) || {};
    const cardView = {
      ...card,
      name: String(draft.name ?? card.name ?? ''),
      description: String(draft.description ?? card.description ?? ''),
      column_id: String(draft.column_id ?? card.column_id ?? ''),
      priority: String(draft.priority ?? card.priority ?? 'mid'),
      deadline: String(draft.deadline ?? card.deadline ?? ''),
      tags: typeof draft.tags === 'string' ? parseTags(draft.tags) : asArray(card.tags),
      assignee_id: String(draft.assignee_id ?? card.assignee_id ?? '')
    };

    const columns = this.getSortedColumns();
    const colOptions = columns
      .map((c) => `<option value="${escapeAttr(c.id)}" ${String(c.id) === String(cardView.column_id) ? 'selected' : ''}>${escapeHtml(String(c.name || '').toUpperCase())}</option>`)
      .join('');
    const assigneeOptions = this.assigneeOptionsHtml(String(cardView.assignee_id || ''));

    this.startCurrentEditing(card.id);

    this.ui.openModal({
      title: 'task',
      bodyHtml: `
        <form class="form">
          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            name
            <input class="ctl" name="name" required maxlength="240" value="${escapeAttr(cardView.name || '')}" />
          </label>

          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            description
            <textarea class="ctl" name="description" rows="5" maxlength="4000">${escapeHtml(cardView.description || '')}</textarea>
          </label>

          <div class="form__grid2">
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              column
              <select class="ctl" name="column_id">${colOptions}</select>
            </label>

            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              priority
              <select class="ctl" name="priority">
                ${PRIORITIES.map((p) => `<option value="${p.key}" ${String(cardView.priority) === p.key ? 'selected' : ''}>${p.label}</option>`).join('')}
              </select>
            </label>
          </div>

          <div class="form__grid2">
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              deadline
              <input class="ctl" name="deadline" type="date" value="${escapeAttr(cardView.deadline || '')}" />
            </label>

            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              tags
              <input class="ctl" name="tags" maxlength="120" value="${escapeAttr(asArray(cardView.tags).join(', '))}" />
            </label>
          </div>

          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            ${this.t('ответственный', 'assignee')}
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
      },
      onMount: (bodyEl) => {
        const form = bodyEl.querySelector('form');
        if (!form || !this.state.activeProjectId || !card || !card.id) return;
        const saveDraft = () => {
          const fd = new FormData(form);
          this.saveCardDraft('edit', this.state.activeProjectId, card.id, {
            name: String(fd.get('name') || ''),
            description: String(fd.get('description') || ''),
            column_id: String(fd.get('column_id') || ''),
            priority: String(fd.get('priority') || 'mid'),
            deadline: String(fd.get('deadline') || ''),
            tags: String(fd.get('tags') || ''),
            assignee_id: String(fd.get('assignee_id') || '')
          });
        };
        form.addEventListener('input', saveDraft);
        form.addEventListener('change', saveDraft);
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
          this.ui.toast(this.t('примените stage10 sql для поддержки ответственного', 'apply stage10 sql for assignee support'));
        }
      } else {
        throw error;
      }
    }

    this.clearCardDraft('edit', board.project.id, baseCard.id);
    this.ui.closeModal();
    await this.loadBoard(board.project.id);
    this.ui.toast(this.t('задача сохранена', 'task saved'));
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

    this.clearCardDraft('edit', board.project.id, card.id);
    this.ui.closeModal();
    await this.loadBoard(board.project.id);
    this.ui.toast(this.t('задача удалена', 'task deleted'));
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

    if (this.looksLikePersonalScheduleSchemaError(error)) {
      if (!this.personalScheduleSchemaWarnShown) {
        this.personalScheduleSchemaWarnShown = true;
        this.ui.toast(this.t(
          'примените SQL: supabase/sql/stage16_planning_personal_schedule.sql',
          'apply SQL: supabase/sql/stage16_planning_personal_schedule.sql'
        ));
      }
      if (this.isScheduleProject()) {
        this.disablePersonalScheduleWorkspace(this.t(
          'расписание недоступно: требуется stage16 sql',
          'schedule unavailable: stage16 sql required'
        ));
      }
      return;
    }

    if (looksLikeSchemaError(error)) {
      if (!this.schemaWarnShown) {
        this.schemaWarnShown = true;
        this.ui.toast(this.t(
          'примените SQL: supabase/sql/stage9_planning_collab.sql и затем supabase/sql/stage10_planning_shared_personal_tasks.sql',
          'apply SQL: supabase/sql/stage9_planning_collab.sql then supabase/sql/stage10_planning_shared_personal_tasks.sql'
        ));
      }
      this.clearProjectsRetry();
      this.setActionsDisabled(true);
      this.setCloudBadge('off', this.t('отсутствуют planning sql', 'planning sql missing'));
      return;
    }

    if (looksTransientError(error)) {
      this.setCloudBadge('sync', this.t('проблема сети, повторяем', 'network issue, retrying'));
      this.scheduleProjectsRetry();
      this.ui.toast(this.t('проблема сети, повторяем', 'network issue, retrying'));
      return;
    }

    if (low.includes('revision_conflict') || low.includes('version_conflict')) {
      this.ui.toast(this.t('обнаружен конфликт, обновляю доску', 'conflict detected, refreshing board'));
      if (this.state.activeProjectId) {
        if (this.isScheduleProject()) {
          await this.loadPersonalScheduleWorkspace({ force: true });
          await this.loadProjects({ quiet: true });
        } else {
          await this.loadBoard(this.state.activeProjectId);
          if (this.uiPrefs.view === 'schedule') {
            await this.loadScheduleWindow({ force: true });
          }
        }
      }
      return;
    }

    if (low.includes('invalid_time_range')) {
      this.ui.toast(this.t('проверьте время события: конец должен быть позже начала', 'check event time: end must be after start'));
      return;
    }

    if (low.includes('repeat_requires_date')) {
      this.ui.toast(this.t('для повторения укажите дату', 'set a date for repeat'));
      return;
    }

    if (low.includes('invalid_repeat_until')) {
      this.ui.toast(this.t('дата окончания повторения не может быть раньше даты плана', 'repeat end date cannot be earlier than plan date'));
      return;
    }

    if (low.includes('schedule_event_not_found')) {
      this.ui.toast(this.t('событие не найдено', 'event not found'));
      return;
    }

    if (low.includes('schedule_list_not_found')) {
      this.ui.toast(this.t('список не найден', 'list not found'));
      return;
    }

    if (low.includes('schedule_plan_not_found')) {
      this.ui.toast(this.t('план не найден', 'plan not found'));
      return;
    }

    if (low.includes('schedule_project_required')) {
      this.ui.toast(this.t('нужен проект типа расписание', 'schedule project is required'));
      return;
    }

    if (low.includes('invalid_week_range')) {
      this.ui.toast(this.t('некорректный диапазон недели', 'invalid week range'));
      return;
    }

    if (low.includes('not_friends')) {
      this.ui.toast(this.t('приглашать можно только друзей', 'you can invite only friends'));
      return;
    }

    if (low.includes('target_user_not_found')) {
      this.ui.toast(this.t('user-id не найден', 'user-id not found'));
      return;
    }

    if (low.includes('already_member')) {
      this.ui.toast(this.t('пользователь уже в проекте', 'user is already in project'));
      return;
    }

    if (low.includes('assignee_not_member')) {
      this.ui.toast(this.t('ответственный должен быть участником проекта', 'assignee must be a project member'));
      return;
    }

    if (low.includes('member_not_found')) {
      this.ui.toast(this.t('участник не найден', 'member not found'));
      return;
    }

    if (low.includes('owner_cannot_leave')) {
      this.ui.toast(this.t('владельца нельзя удалить из проекта', 'owner cannot be removed from project'));
      return;
    }

    if (low.includes('invitation_not_pending')) {
      this.ui.toast(this.t('приглашение уже обработано', 'invitation already resolved'));
      return;
    }

    if (low.includes('only_owner_can_delete_project')) {
      this.ui.toast(this.t('только владелец может удалить проект', 'only owner can delete project'));
      return;
    }

    if (low.includes('invitation_expired')) {
      this.ui.toast(this.t('срок приглашения истек', 'invitation expired'));
      await this.loadIncomingInvitations({ quiet: true });
      return;
    }

    if (low.includes('forbidden')) {
      this.ui.toast(this.t('доступ запрещен', 'access denied'));
      return;
    }

    this.ui.toast(text);
  }
}
