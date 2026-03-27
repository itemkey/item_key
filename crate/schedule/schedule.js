const TABS = ['today', 'calendar', 'assistant', 'settings'];
const CALENDAR_MODES = ['day', 'week', 'month', 'year'];
const CATEGORY_VALUES = ['mandatory', 'personal', 'temporary'];
const PRIORITY_VALUES = ['low', 'mid', 'high', 'critical'];
const FLEXIBILITY_VALUES = ['fixed', 'flexible', 'very_flexible'];
const REPEAT_VALUES = ['none', 'daily', 'weekly', 'monthly', 'yearly', 'weekdays', 'weekends'];
const PERIOD_VALUES = ['any', 'morning', 'afternoon', 'evening', 'night'];
const ASSISTANT_MODES = ['auto', 'deadline_focus', 'balanced', 'light'];
const ASSISTANT_PLAN_MODES = ['deadline', 'day_flexible', 'weekly_flexible'];
const PRESERVED_FORM_SELECTORS = [
  '[data-assistant-item-form]',
  '[data-recurring-busy-form]',
  '[data-assistant-run-form]',
  '[data-settings-form]'
];
const WEEKDAY_SHORT_RU = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

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

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function addDays(d, days) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
  x.setDate(x.getDate() + Number(days || 0));
  return x;
}

function addMinutes(d, minutes) {
  return new Date(d.getTime() + Number(minutes || 0) * 60000);
}

function toISODate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toTimeText(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function parseISODate(text) {
  const s = String(text || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

function parseTimeText(text) {
  const s = String(text || '').trim();
  const match = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return { hh, mm };
}

function composeDateTime(dateText, timeText, fallbackHour = 0, fallbackMinute = 0) {
  const date = parseISODate(dateText);
  if (!date) return null;
  const t = parseTimeText(timeText);
  const hh = t ? t.hh : fallbackHour;
  const mm = t ? t.mm : fallbackMinute;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hh, mm, 0, 0);
}

function parseDateTimeLocal(value) {
  const s = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return null;
  const [dp, tp] = s.split('T');
  const date = parseISODate(dp);
  const time = parseTimeText(tp);
  if (!date || !time) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.hh, time.mm, 0, 0);
}

function formatDateTimeLocal(d) {
  return `${toISODate(d)}T${toTimeText(d)}`;
}

function dayDiff(fromDate, toDate) {
  const a = startOfDay(fromDate).getTime();
  const b = startOfDay(toDate).getTime();
  return Math.round((b - a) / 86400000);
}

function startOfWeek(date) {
  const d = startOfDay(date);
  const day = d.getDay();
  const shift = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + shift);
  return d;
}

function firstWeekdayOnOrAfter(baseDate, weekday) {
  const d = startOfDay(baseDate);
  const target = Number(weekday);
  if (!Number.isInteger(target) || target < 0 || target > 6) return d;
  const cur = d.getDay();
  const delta = (target - cur + 7) % 7;
  d.setDate(d.getDate() + delta);
  return d;
}

function shortText(value, max = 120) {
  const txt = String(value || '').replace(/\s+/g, ' ').trim();
  if (!txt) return '';
  if (txt.length <= max) return txt;
  return `${txt.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function toEpoch(v) {
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.getTime() : 0;
}

function isOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

function normalizeCategory(v) {
  const s = String(v || '').toLowerCase();
  return CATEGORY_VALUES.includes(s) ? s : 'mandatory';
}

function normalizePriority(v) {
  const s = String(v || '').toLowerCase();
  return PRIORITY_VALUES.includes(s) ? s : 'mid';
}

function normalizeFlexibility(v) {
  const s = String(v || '').toLowerCase();
  return FLEXIBILITY_VALUES.includes(s) ? s : 'flexible';
}

function normalizeRepeat(v) {
  const s = String(v || '').toLowerCase();
  return REPEAT_VALUES.includes(s) ? s : 'none';
}

function normalizePeriod(v) {
  const s = String(v || '').toLowerCase();
  return PERIOD_VALUES.includes(s) ? s : 'any';
}

function normalizeMode(v) {
  const s = String(v || '').toLowerCase();
  return ASSISTANT_MODES.includes(s) ? s : 'auto';
}

function normalizeAssistantPlanMode(v) {
  const s = String(v || '').toLowerCase();
  return ASSISTANT_PLAN_MODES.includes(s) ? s : 'deadline';
}

function parseOffsets(raw) {
  const parts = String(raw || '')
    .split(',')
    .map((x) => Number.parseInt(String(x).trim(), 10))
    .filter((x) => Number.isFinite(x) && x >= 0 && x <= 10080);
  return Array.from(new Set(parts));
}

function parseJsonMaybe(raw, fallback) {
  try {
    if (raw == null || raw === '') return fallback;
    if (typeof raw === 'object') return raw;
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

function schemaMissingError(error) {
  const code = String((error && error.code) || '').toUpperCase();
  const txt = String((error && (error.message || error.details || error.hint || error.code)) || '').toLowerCase();
  if (code === '42P01' || code === '42883' || code === '42703') return true;
  return txt.includes('ik_sched_') || txt.includes('ik_sched');
}

function categoryLabel(v) {
  const k = normalizeCategory(v);
  if (k === 'personal') return 'Личное';
  if (k === 'temporary') return 'Временное';
  return 'Обязательное';
}

function priorityLabel(v) {
  const k = normalizePriority(v);
  if (k === 'critical') return 'CRITICAL';
  if (k === 'high') return 'HIGH';
  if (k === 'low') return 'LOW';
  return 'MID';
}

function repeatLabel(v) {
  const k = normalizeRepeat(v);
  if (k === 'daily') return 'Ежедневно';
  if (k === 'weekly') return 'Еженедельно';
  if (k === 'monthly') return 'Ежемесячно';
  if (k === 'yearly') return 'Ежегодно';
  if (k === 'weekdays') return 'Будни';
  if (k === 'weekends') return 'Выходные';
  return 'Без повтора';
}

function periodLabel(v) {
  const k = normalizePeriod(v);
  if (k === 'morning') return 'Утро';
  if (k === 'afternoon') return 'День';
  if (k === 'evening') return 'Вечер';
  if (k === 'night') return 'Ночь';
  return 'Любое время';
}

function flexibilityLabel(v) {
  const k = normalizeFlexibility(v);
  if (k === 'fixed') return 'Фиксированно';
  if (k === 'very_flexible') return 'Очень гибко';
  return 'Гибко';
}

function urgencyScore(item, now, horizonDays) {
  const priorityWeight = {
    low: 0.8,
    mid: 1,
    high: 1.35,
    critical: 1.8
  }[normalizePriority(item.priority)] || 1;

  const estimate = clamp(Number(item.estimated_minutes || 60), 15, 720);
  const estimateWeight = 1 + (estimate / 240);
  const requiredWeight = item.is_required ? 1.22 : 1;

  let deadlineWeight = 0.72;
  if (item.deadline_at) {
    const deadline = new Date(item.deadline_at);
    const days = dayDiff(now, deadline);
    if (days <= 0) deadlineWeight = 2.6;
    else if (days <= 2) deadlineWeight = 2.3;
    else if (days <= 7) deadlineWeight = 1.8;
    else if (days <= 30) deadlineWeight = 1.25;
    else if (days <= 90) deadlineWeight = 1;
    else deadlineWeight = 0.84;
  } else {
    deadlineWeight = horizonDays >= 45 ? 0.74 : 0.9;
  }

  return priorityWeight * estimateWeight * requiredWeight * deadlineWeight;
}

class UI {
  constructor() {
    this.modalEl = document.getElementById('modal');
    this.modalTitleEl = document.getElementById('modalTitle');
    this.modalBodyEl = document.getElementById('modalBody');
    this.toastStack = document.getElementById('toasts');

    this.modalEl?.addEventListener('click', (event) => {
      const t = event.target;
      if (t?.matches('[data-close]') || t?.closest('[data-close]')) this.closeModal();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.modalEl && !this.modalEl.hidden) this.closeModal();
    });
  }

  openModal({ title, bodyHtml, onSubmit, onMount }) {
    if (!this.modalEl || !this.modalTitleEl || !this.modalBodyEl) return;
    this.modalTitleEl.textContent = title || '';
    this.modalBodyEl.innerHTML = bodyHtml || '';

    const form = this.modalBodyEl.querySelector('form');
    if (form && typeof onSubmit === 'function') {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        onSubmit(data, form);
      });
    }

    if (typeof onMount === 'function') {
      onMount(this.modalBodyEl, this.modalEl);
    }

    this.modalEl.hidden = false;
    this.modalEl.removeAttribute('hidden');
    this.modalEl.style.display = 'block';
  }

  closeModal() {
    if (!this.modalEl) return;
    this.modalEl.hidden = true;
    this.modalEl.setAttribute('hidden', '');
    this.modalEl.style.display = 'none';
    if (this.modalTitleEl) this.modalTitleEl.textContent = '';
    if (this.modalBodyEl) this.modalBodyEl.innerHTML = '';
  }

  toast(text, timeout = 2600) {
    if (!this.toastStack) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = String(text || '');
    this.toastStack.appendChild(el);
    setTimeout(() => el.remove(), timeout);
  }
}

class ScheduleApp {
  constructor() {
    this.ui = new UI();

    this.els = {
      tabsRoot: document.querySelector('.schedule-tabs'),
      content: document.getElementById('scheduleContent'),
      btnNewItem: document.getElementById('btnNewItem'),
      btnNewBlock: document.getElementById('btnNewBlock')
    };

    const today = startOfDay(new Date());

    this.client = null;
    this.user = null;

    this.state = {
      activeTab: 'today',
      calendarMode: 'month',
      anchorDate: today,
      selectedDate: today,
      space: null,
      prefs: null,
      items: [],
      blocks: [],
      suggestions: [],
      runs: [],
      loading: false,
      lastError: ''
    };
  }

  async init() {
    this.bindStaticHandlers();
    this.renderLoading('Подключение к облаку расписания...');

    if (!(window.IKSupabase && typeof window.IKSupabase.getClient === 'function')) {
      this.renderFatal('Supabase client missing');
      return;
    }

    this.client = window.IKSupabase.getClient();
    if (!this.client) {
      this.renderFatal('Supabase unavailable');
      return;
    }

    const { data: userData, error: userError } = await this.client.auth.getUser();
    if (userError) {
      this.renderFatal(userError.message || 'auth failed');
      return;
    }

    this.user = userData && userData.user ? userData.user : null;
    if (!this.user) {
      this.renderLoginRequired();
      return;
    }

    try {
      await this.ensureDefaultSpace();
      await this.loadPrefs();
      await this.reloadAll({ showLoading: true });
      this.render();
    } catch (error) {
      this.onError(error);
    }
  }

  bindStaticHandlers() {
    this.els.tabsRoot?.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-tab]');
      if (!btn) return;
      const tab = String(btn.getAttribute('data-tab') || 'today');
      if (!TABS.includes(tab)) return;
      this.state.activeTab = tab;
      this.render();
    });

    this.els.btnNewItem?.addEventListener('click', () => this.openItemModal());
    this.els.btnNewBlock?.addEventListener('click', () => this.openBlockModal());

    this.els.content?.addEventListener('click', (event) => {
      void this.handleContentClick(event).catch((error) => this.onError(error));
    });

    this.els.content?.addEventListener('submit', (event) => {
      void this.handleContentSubmit(event).catch((error) => this.onError(error));
    });

    this.els.content?.addEventListener('change', (event) => {
      void this.handleContentChange(event).catch((error) => this.onError(error));
    });
  }

  async handleContentSubmit(event) {
    const form = event.target.closest('form');
    if (!form) return;

    if (form.matches('[data-assistant-item-form]')) {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      await this.createAssistantInboxItem(data);
      return;
    }

    if (form.matches('[data-recurring-busy-form]')) {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      await this.createRecurringBusyBlocks(data);
      return;
    }

    if (form.matches('[data-assistant-run-form]')) {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      await this.runAssistant(data);
      return;
    }

    if (form.matches('[data-settings-form]')) {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      await this.saveSettings(data);
    }
  }

  async handleContentChange(event) {
    const modeSelect = event.target.closest('[data-assistant-plan-mode]');
    if (modeSelect) {
      const form = modeSelect.closest('form');
      if (form) this.syncAssistantInboxMode(form);
    }
  }

  async handleContentClick(event) {
    const modeBtn = event.target.closest('[data-mode]');
    if (modeBtn) {
      const mode = String(modeBtn.getAttribute('data-mode') || 'month');
      if (CALENDAR_MODES.includes(mode)) {
        this.state.calendarMode = mode;
        this.render();
      }
      return;
    }

    const navBtn = event.target.closest('[data-nav]');
    if (navBtn) {
      const action = String(navBtn.getAttribute('data-nav') || 'today');
      this.shiftCalendar(action);
      this.render();
      return;
    }

    const dayBtn = event.target.closest('[data-day]');
    if (dayBtn) {
      const day = parseISODate(dayBtn.getAttribute('data-day'));
      if (day) {
        this.state.selectedDate = day;
        if (this.state.calendarMode === 'day') {
          this.state.anchorDate = day;
        }
        this.render();
      }
      return;
    }

    const openBusyDayBtn = event.target.closest('[data-open-busy-day]');
    if (openBusyDayBtn) {
      const day = parseISODate(openBusyDayBtn.getAttribute('data-open-busy-day'));
      if (day) this.openCalendarAt(day);
      return;
    }

    const newDayBlockBtn = event.target.closest('[data-new-block-day]');
    if (newDayBlockBtn) {
      const day = parseISODate(newDayBlockBtn.getAttribute('data-new-block-day')) || this.state.selectedDate;
      this.openBlockModal(null, day);
      return;
    }

    const openItemBtn = event.target.closest('[data-open-item]');
    if (openItemBtn) {
      const itemId = String(openItemBtn.getAttribute('data-open-item') || '').trim();
      if (!itemId) {
        this.openItemModal();
        return;
      }
      const item = this.findItem(itemId);
      if (item) this.openItemModal(item);
      return;
    }

    const deleteItemBtn = event.target.closest('[data-delete-item]');
    if (deleteItemBtn) {
      const id = String(deleteItemBtn.getAttribute('data-delete-item') || '');
      if (id) this.openDeleteItemModal(id);
      return;
    }

    const duplicateItemBtn = event.target.closest('[data-duplicate-item]');
    if (duplicateItemBtn) {
      const id = String(duplicateItemBtn.getAttribute('data-duplicate-item') || '');
      if (id) await this.duplicateItem(id);
      return;
    }

    const openBlockBtn = event.target.closest('[data-open-block]');
    if (openBlockBtn) {
      const block = this.findBlock(openBlockBtn.getAttribute('data-open-block'));
      if (block) this.openBlockModal(block);
      return;
    }

    const deleteBlockBtn = event.target.closest('[data-delete-block]');
    if (deleteBlockBtn) {
      const id = String(deleteBlockBtn.getAttribute('data-delete-block') || '');
      if (id) this.openDeleteBlockModal(id);
      return;
    }

    const moveBlockBtn = event.target.closest('[data-move-block]');
    if (moveBlockBtn) {
      const id = String(moveBlockBtn.getAttribute('data-move-block') || '');
      if (id) await this.moveBlockToTomorrow(id);
      return;
    }

    const doneBlockBtn = event.target.closest('[data-done-block]');
    if (doneBlockBtn) {
      const id = String(doneBlockBtn.getAttribute('data-done-block') || '');
      if (id) await this.toggleBlockDone(id);
      return;
    }

    const runAssistantBtn = event.target.closest('[data-run-assistant]');
    if (runAssistantBtn) {
      const form = this.els.content.querySelector('[data-assistant-run-form]');
      const data = form ? Object.fromEntries(new FormData(form).entries()) : {};
      await this.runAssistant(data);
      return;
    }

    const acceptSuggestionBtn = event.target.closest('[data-suggest-accept]');
    if (acceptSuggestionBtn) {
      const id = String(acceptSuggestionBtn.getAttribute('data-suggest-accept') || '');
      if (id) await this.acceptSuggestion(id);
      return;
    }

    const rejectSuggestionBtn = event.target.closest('[data-suggest-reject]');
    if (rejectSuggestionBtn) {
      const id = String(rejectSuggestionBtn.getAttribute('data-suggest-reject') || '');
      if (id) await this.rejectSuggestion(id);
      return;
    }

    const adjustSuggestionBtn = event.target.closest('[data-suggest-adjust]');
    if (adjustSuggestionBtn) {
      const id = String(adjustSuggestionBtn.getAttribute('data-suggest-adjust') || '');
      if (id) this.openAdjustSuggestionModal(id);
      return;
    }
  }

  async ensureDefaultSpace() {
    const { data, error } = await this.client.rpc('ik_sched_get_or_create_default_space', {
      p_name: 'Мое расписание'
    });
    if (error) throw error;
    const spaceId = String(data || '').trim();
    if (!spaceId) throw new Error('default space was not created');

    const { data: spaceRow, error: spaceError } = await this.client
      .from('ik_sched_spaces')
      .select('*')
      .eq('id', spaceId)
      .maybeSingle();

    if (spaceError) throw spaceError;
    this.state.space = spaceRow || null;
  }

  async loadPrefs() {
    const { data, error } = await this.client
      .from('ik_sched_prefs')
      .select('*')
      .eq('user_id', this.user.id)
      .maybeSingle();
    if (error) throw error;

    const defaults = {
      user_id: this.user.id,
      default_space_id: this.state.space ? this.state.space.id : null,
      notification_defaults: {
        enabled: true,
        offsets: [60, 15]
      },
      assistant_defaults: {
        mode: 'deadline_focus',
        horizon_days: 30,
        day_start: '08:00',
        day_end: '22:00'
      },
      view_defaults: {
        mode: 'month'
      }
    };

    this.state.prefs = data || defaults;

    const viewDefaults = parseJsonMaybe(this.state.prefs.view_defaults, {});
    const mode = String(viewDefaults.mode || '').toLowerCase();
    if (CALENDAR_MODES.includes(mode)) this.state.calendarMode = mode;
  }

  async reloadAll(options = null) {
    if (!this.state.space) return;

    const showLoading = !!(options && options.showLoading);
    if (showLoading) {
      this.state.loading = true;
      this.render();
    }

    const spaceId = this.state.space.id;
    const fromIso = addDays(new Date(), -90).toISOString();
    const toIso = addDays(new Date(), 370).toISOString();

    try {
      const [itemsRes, blocksRes, suggestionsRes, runsRes] = await Promise.all([
        this.client
          .from('ik_sched_items')
          .select('*')
          .eq('space_id', spaceId)
          .order('created_at', { ascending: false }),
        this.client
          .from('ik_sched_blocks')
          .select('*')
          .eq('space_id', spaceId)
          .gte('starts_at', fromIso)
          .lte('starts_at', toIso)
          .order('starts_at', { ascending: true }),
        this.client
          .from('ik_sched_assistant_suggestions')
          .select('*')
          .eq('space_id', spaceId)
          .order('created_at', { ascending: false })
          .limit(500),
        this.client
          .from('ik_sched_assistant_runs')
          .select('*')
          .eq('space_id', spaceId)
          .order('started_at', { ascending: false })
          .limit(20)
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (blocksRes.error) throw blocksRes.error;
      if (suggestionsRes.error) throw suggestionsRes.error;
      if (runsRes.error) throw runsRes.error;

      this.state.items = asArray(itemsRes.data);
      this.state.blocks = asArray(blocksRes.data);
      this.state.suggestions = asArray(suggestionsRes.data);
      this.state.runs = asArray(runsRes.data);
    } finally {
      this.state.loading = false;
    }
  }

  renderLoading(text) {
    if (!this.els.content) return;
    this.els.content.innerHTML = `<div class="empty-note">${escapeHtml(text)}</div>`;
  }

  renderFatal(text) {
    if (!this.els.content) return;
    this.els.content.innerHTML = `
      <div class="sched-pane">
        <section class="sched-block">
          <div class="sched-block__title">Расписание недоступно</div>
          <div class="assistant-note">${escapeHtml(text)}</div>
        </section>
      </div>
    `;
  }

  renderLoginRequired() {
    this.renderFatal('Нужна авторизация. Откройте item-user и войдите в аккаунт.');
  }

  onError(error) {
    const text = String((error && (error.message || error.details || error.hint || error.code)) || error || 'unknown error');
    if (schemaMissingError(error)) {
      this.renderFatal('Нужен SQL этап stage18_schedule_v2.sql. Примените его в Supabase и перезагрузите страницу.');
      return;
    }
    this.state.lastError = text;
    this.ui.toast(text);
  }

  setTab(tab) {
    if (!TABS.includes(tab)) return;
    this.state.activeTab = tab;
    this.render();
  }

  openCalendarAt(date) {
    const day = startOfDay(date || new Date());
    this.state.activeTab = 'calendar';
    this.state.anchorDate = day;
    this.state.selectedDate = day;
    this.render();
  }

  syncAssistantInboxMode(form) {
    if (!(form instanceof HTMLFormElement)) return;
    const select = form.querySelector('[data-assistant-plan-mode]');
    const mode = normalizeAssistantPlanMode(select ? select.value : 'deadline');

    form.querySelectorAll('[data-mode-only]').forEach((node) => {
      const raw = String(node.getAttribute('data-mode-only') || '');
      const allowed = raw.split(/[\s,]+/).filter(Boolean).map((x) => String(x).toLowerCase());
      const visible = allowed.includes(mode);
      node.hidden = false;
      node.classList.toggle('is-unavailable', !visible);

      node.querySelectorAll('input, select, textarea').forEach((control) => {
        control.disabled = !visible;
      });
    });
  }

  renderTabs() {
    this.els.tabsRoot?.querySelectorAll('[data-tab]').forEach((node) => {
      const active = String(node.getAttribute('data-tab')) === this.state.activeTab;
      node.classList.toggle('is-active', active);
    });
  }

  captureFormState(form) {
    const out = {};
    if (!(form instanceof HTMLFormElement)) return out;

    Array.from(form.elements).forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const name = el.getAttribute('name');
      if (!name) return;
      const type = String(el.getAttribute('type') || '').toLowerCase();

      if (el instanceof HTMLInputElement && type === 'checkbox') {
        out[name] = { kind: 'checkbox', value: el.checked };
        return;
      }

      if (el instanceof HTMLInputElement && type === 'radio') {
        if (el.checked) out[name] = { kind: 'radio', value: el.value };
        return;
      }

      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
        out[name] = { kind: 'value', value: el.value };
      }
    });

    return out;
  }

  restoreFormState(form, state) {
    if (!(form instanceof HTMLFormElement) || !state || typeof state !== 'object') return;

    Array.from(form.elements).forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const name = el.getAttribute('name');
      if (!name || !(name in state)) return;

      const saved = state[name];
      if (!saved || typeof saved !== 'object') return;

      const type = String(el.getAttribute('type') || '').toLowerCase();

      if (el instanceof HTMLInputElement && type === 'checkbox') {
        el.checked = !!saved.value;
        return;
      }

      if (el instanceof HTMLInputElement && type === 'radio') {
        el.checked = String(el.value) === String(saved.value || '');
        return;
      }

      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
        el.value = saved.value == null ? '' : String(saved.value);
      }
    });
  }

  captureViewState() {
    const state = {
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      focusSelector: '',
      forms: {}
    };

    if (!this.els.content) return state;

    PRESERVED_FORM_SELECTORS.forEach((selector) => {
      const form = this.els.content.querySelector(selector);
      if (form instanceof HTMLFormElement) {
        state.forms[selector] = this.captureFormState(form);
      }
    });

    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !this.els.content.contains(active)) return state;

    const form = active.closest('form');
    const fieldName = active.getAttribute('name');
    if (!form || !fieldName) return state;

    const escapedName = String(fieldName).replaceAll('"', '\\"');
    if (form.matches('[data-assistant-item-form]')) {
      state.focusSelector = `[data-assistant-item-form] [name="${escapedName}"]`;
    } else if (form.matches('[data-recurring-busy-form]')) {
      state.focusSelector = `[data-recurring-busy-form] [name="${escapedName}"]`;
    } else if (form.matches('[data-assistant-run-form]')) {
      state.focusSelector = `[data-assistant-run-form] [name="${escapedName}"]`;
    } else if (form.matches('[data-settings-form]')) {
      state.focusSelector = `[data-settings-form] [name="${escapedName}"]`;
    }

    return state;
  }

  restoreViewState(state) {
    if (!state) return;

    if (this.els.content && state.forms && typeof state.forms === 'object') {
      PRESERVED_FORM_SELECTORS.forEach((selector) => {
        const form = this.els.content.querySelector(selector);
        if (form instanceof HTMLFormElement && state.forms[selector]) {
          this.restoreFormState(form, state.forms[selector]);
        }
      });
    }

    if (Number.isFinite(state.scrollX) && Number.isFinite(state.scrollY)) {
      window.scrollTo(state.scrollX, state.scrollY);
    }

    if (!state.focusSelector || !this.els.content) return;
    const node = this.els.content.querySelector(state.focusSelector);
    if (node && typeof node.focus === 'function') {
      try {
        node.focus({ preventScroll: true });
      } catch (_) {
        node.focus();
      }
    }
  }

  render(options = null) {
    this.renderTabs();

    if (!this.els.content) return;
    if (this.state.loading) {
      this.renderLoading('Синхронизация данных...');
      return;
    }

    if (!this.state.space) {
      this.renderFatal('Пространство расписания не создано.');
      return;
    }

    const preserveView = !!(options && options.preserveView);
    const viewState = preserveView ? this.captureViewState() : null;
    let html = '';

    if (this.state.activeTab === 'today') {
      html = this.renderTodayTab();
    } else if (this.state.activeTab === 'calendar') {
      html = this.renderCalendarTab();
    } else if (this.state.activeTab === 'assistant') {
      html = this.renderAssistantTab();
    } else {
      html = this.renderSettingsTab();
    }

    this.els.content.innerHTML = html;
    if (preserveView) this.restoreViewState(viewState);

    if (this.state.activeTab === 'assistant') {
      const form = this.els.content.querySelector('[data-assistant-item-form]');
      if (form) this.syncAssistantInboxMode(form);
    }
  }

  findItem(id) {
    return this.state.items.find((x) => String(x.id) === String(id)) || null;
  }

  findBlock(id) {
    return this.state.blocks.find((x) => String(x.id) === String(id)) || null;
  }

  findSuggestion(id) {
    return this.state.suggestions.find((x) => String(x.id) === String(id)) || null;
  }

  itemMetaLine(item) {
    const parts = [];
    parts.push(categoryLabel(item.category));
    parts.push(priorityLabel(item.priority));
    if (item.estimated_minutes) parts.push(`${item.estimated_minutes} мин`);
    if (item.desired_day) parts.push(`день ${item.desired_day}`);
    if (item.deadline_at) {
      const d = new Date(item.deadline_at);
      parts.push(`дедлайн ${toISODate(d)} ${toTimeText(d)}`);
    }
    if (item.repeat_rule && normalizeRepeat(item.repeat_rule) !== 'none') {
      parts.push(repeatLabel(item.repeat_rule));
    }
    return parts.join(' · ');
  }

  blockTimeLine(block) {
    const start = new Date(block.starts_at);
    const end = new Date(block.ends_at);
    return `${toISODate(start)} ${toTimeText(start)} - ${toTimeText(end)}`;
  }

  getBlocksForDate(day) {
    const from = startOfDay(day).getTime();
    const to = endOfDay(day).getTime();
    return this.state.blocks
      .filter((b) => {
        const s = toEpoch(b.starts_at);
        const e = toEpoch(b.ends_at);
        return s <= to && e >= from;
      })
      .slice()
      .sort((a, b) => toEpoch(a.starts_at) - toEpoch(b.starts_at));
  }

  getDueItemsForDate(day) {
    const key = toISODate(day);
    return this.state.items
      .filter((item) => {
        if (!item.deadline_at) return false;
        const d = new Date(item.deadline_at);
        return toISODate(d) === key;
      })
      .slice()
      .sort((a, b) => urgencyScore(b, day, 30) - urgencyScore(a, day, 30));
  }

  getOverdueItems(referenceDate) {
    const ref = startOfDay(referenceDate).getTime();
    return this.state.items
      .filter((item) => {
        if (!item.deadline_at) return false;
        if (String(item.status || '') === 'done' || String(item.status || '') === 'archived') return false;
        const d = new Date(item.deadline_at).getTime();
        return d < ref;
      })
      .slice()
      .sort((a, b) => toEpoch(a.deadline_at) - toEpoch(b.deadline_at));
  }

  renderTodayBlockCard(block, linkedItem = null) {
    const category = normalizeCategory(block.category || (linkedItem && linkedItem.category));
    const title = String(block.title || (linkedItem && linkedItem.title) || 'Слот');
    const metaParts = [];
    if (linkedItem) metaParts.push(this.itemMetaLine(linkedItem));
    if (block.source) metaParts.push(`источник: ${block.source}`);
    if (block.status) metaParts.push(`статус: ${String(block.status).toUpperCase()}`);

    return `
      <article class="today-card today-card--${escapeAttr(category)}">
        <div class="today-card__time">${escapeHtml(this.blockTimeLine(block))}</div>
        <div class="today-card__title">${escapeHtml(title)}</div>
        ${metaParts.length ? `<div class="today-card__meta">${escapeHtml(metaParts.join(' | '))}</div>` : ''}
        <div class="today-card__actions">
          <button class="btn btn--thin" type="button" data-open-block="${escapeAttr(block.id)}">Открыть</button>
          <button class="btn btn--thin" type="button" data-move-block="${escapeAttr(block.id)}">На завтра</button>
          <button class="btn btn--thin" type="button" data-done-block="${escapeAttr(block.id)}">Готово</button>
        </div>
      </article>
    `;
  }

  renderTodayTab() {
    const today = startOfDay(new Date());
    const blocks = this.getBlocksForDate(today);
    const linkedMap = new Map(this.state.items.map((x) => [String(x.id), x]));

    const mandatory = [];
    const personal = [];
    const temporary = [];

    blocks.forEach((block) => {
      const linked = block.item_id ? linkedMap.get(String(block.item_id)) : null;
      const category = normalizeCategory(block.category || (linked && linked.category));
      const payload = { block, linked };
      if (category === 'personal') {
        personal.push(payload);
      } else if (category === 'temporary') {
        temporary.push(payload);
      } else {
        mandatory.push(payload);
      }
    });

    const dueToday = this.getDueItemsForDate(today);
    const overdue = this.getOverdueItems(today);

    const renderColumn = (title, rows) => {
      if (!rows.length) {
        return `
          <section class="sched-block">
            <header class="sched-block__head">
              <div class="sched-block__title">${escapeHtml(title)}</div>
              <button class="btn btn--thin" type="button" data-new-block-day="${escapeAttr(toISODate(today))}">+ слот</button>
            </header>
            <div class="empty-note">Пусто на сегодня</div>
          </section>
        `;
      }

      return `
        <section class="sched-block">
          <header class="sched-block__head">
            <div class="sched-block__title">${escapeHtml(title)} · ${rows.length}</div>
            <button class="btn btn--thin" type="button" data-new-block-day="${escapeAttr(toISODate(today))}">+ слот</button>
          </header>
          <div class="today-list">
            ${rows.map((row) => this.renderTodayBlockCard(row.block, row.linked)).join('')}
          </div>
        </section>
      `;
    };

    return `
      <div class="sched-pane">
        <section class="sched-block">
          <header class="sched-block__head">
            <div class="sched-block__title">Сегодня · ${escapeHtml(toISODate(today))}</div>
            <div class="today-card__actions">
              <button class="btn btn--thin" type="button" id="todayAddItem" data-open-item="">+ план</button>
              <button class="btn btn--thin" type="button" data-new-block-day="${escapeAttr(toISODate(today))}">+ слот</button>
            </div>
          </header>
          <div class="assistant-note">Показываются только задачи и события текущего дня. Без лишних блоков и без шума.</div>
        </section>

        <div class="today-grid">
          <div class="sched-pane">
            ${renderColumn('Обязательные', mandatory)}
            ${renderColumn('Личные', personal)}
            ${renderColumn('Временные', temporary)}
          </div>

          <div class="sched-pane">
            <section class="sched-block">
              <header class="sched-block__head">
                <div class="sched-block__title">Дедлайны сегодня</div>
              </header>
              ${dueToday.length ? `<div class="item-list">${dueToday.map((item) => this.renderItemCompact(item)).join('')}</div>` : '<div class="empty-note">Сегодня дедлайнов нет</div>'}
            </section>

            <section class="sched-block">
              <header class="sched-block__head">
                <div class="sched-block__title">Просрочено</div>
              </header>
              ${overdue.length ? `<div class="item-list">${overdue.slice(0, 8).map((item) => this.renderItemCompact(item)).join('')}</div>` : '<div class="empty-note">Просроченных задач нет</div>'}
            </section>
          </div>
        </div>
      </div>
    `;
  }

  renderItemCompact(item, options = null) {
    const canDelete = !!(options && options.allowDelete);
    return `
      <article class="item-card">
        <div class="item-card__title">${escapeHtml(String(item.title || 'План'))}</div>
        <div class="item-card__meta">${escapeHtml(this.itemMetaLine(item))}</div>
        <div class="item-card__actions">
          <button class="btn btn--thin" type="button" data-open-item="${escapeAttr(item.id)}">Открыть</button>
          <button class="btn btn--thin" type="button" data-duplicate-item="${escapeAttr(item.id)}">Дубль</button>
          ${canDelete ? `<button class="btn btn--thin btn--danger" type="button" data-delete-item="${escapeAttr(item.id)}">Удалить</button>` : ''}
        </div>
      </article>
    `;
  }

  shiftCalendar(action) {
    if (action === 'today') {
      const now = startOfDay(new Date());
      this.state.anchorDate = now;
      this.state.selectedDate = now;
      return;
    }

    const sign = action === 'prev' ? -1 : 1;
    const mode = this.state.calendarMode;
    if (mode === 'day') {
      this.state.anchorDate = addDays(this.state.anchorDate, sign);
    } else if (mode === 'week') {
      this.state.anchorDate = addDays(this.state.anchorDate, sign * 7);
    } else if (mode === 'month') {
      this.state.anchorDate = new Date(this.state.anchorDate.getFullYear(), this.state.anchorDate.getMonth() + sign, 1);
    } else {
      this.state.anchorDate = new Date(this.state.anchorDate.getFullYear() + sign, this.state.anchorDate.getMonth(), 1);
    }
  }

  calendarRangeTitle() {
    const mode = this.state.calendarMode;
    const anchor = this.state.anchorDate;
    const locale = 'ru-RU';

    if (mode === 'day') {
      return new Intl.DateTimeFormat(locale, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(anchor);
    }

    if (mode === 'week') {
      const ws = startOfWeek(anchor);
      const we = addDays(ws, 6);
      return `${new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' }).format(ws)} - ${new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(we)}`;
    }

    if (mode === 'month') {
      return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(anchor);
    }

    return String(anchor.getFullYear());
  }

  renderCalendarTab() {
    const modeButtons = [
      { key: 'day', label: 'День' },
      { key: 'week', label: 'Неделя' },
      { key: 'month', label: 'Месяц' },
      { key: 'year', label: 'Год' }
    ];

    let gridHtml = '';
    if (this.state.calendarMode === 'day') gridHtml = this.renderCalendarDayMode();
    if (this.state.calendarMode === 'week') gridHtml = this.renderCalendarWeekMode();
    if (this.state.calendarMode === 'month') gridHtml = this.renderCalendarMonthMode();
    if (this.state.calendarMode === 'year') gridHtml = this.renderCalendarYearMode();

    const side = this.renderSelectedDateSidePanel();

    return `
      <div class="sched-pane">
        <section class="sched-block">
          <div class="calendar-toolbar">
            <button class="btn btn--thin" type="button" data-nav="prev">← Назад</button>
            <button class="btn btn--thin" type="button" data-nav="today">Сегодня</button>

            <div class="range-title">${escapeHtml(this.calendarRangeTitle())}</div>

            <button class="btn btn--thin" type="button" data-nav="next">Вперед →</button>
            <button class="btn" type="button" data-new-block-day="${escapeAttr(toISODate(this.state.selectedDate))}">+ слот</button>
          </div>

          <div class="mode-switch">
            ${modeButtons.map((btn) => `<button class="mode-btn${btn.key === this.state.calendarMode ? ' is-active' : ''}" type="button" data-mode="${btn.key}">${btn.label}</button>`).join('')}
          </div>
        </section>

        <div class="assistant-note">Календарь показывает только даты. Нажмите на дату, чтобы увидеть детали ниже.</div>

        <div class="calendar-wrap">
          ${gridHtml}
          ${side}
        </div>
      </div>
    `;
  }

  renderCalendarDayMode() {
    const day = startOfDay(this.state.anchorDate);
    const blocks = this.getBlocksForDate(day);
    const due = this.getDueItemsForDate(day);

    const left = `
      <section class="sched-block">
        <header class="sched-block__head">
          <div class="sched-block__title">События дня</div>
          <button class="btn btn--thin" type="button" data-new-block-day="${escapeAttr(toISODate(day))}">+ слот</button>
        </header>
        ${blocks.length ? `<div class="item-list">${blocks.map((block) => this.renderCalendarBlockItem(block)).join('')}</div>` : '<div class="empty-note">На день слотов нет</div>'}
      </section>
    `;

    const right = `
      <section class="sched-block">
        <header class="sched-block__head">
          <div class="sched-block__title">Планы и дедлайны</div>
          <button class="btn btn--thin" type="button" data-open-item="">+ план</button>
        </header>
        ${due.length ? `<div class="item-list">${due.map((item) => this.renderItemCompact(item)).join('')}</div>` : '<div class="empty-note">На эту дату дедлайнов нет</div>'}
      </section>
    `;

    return `<div class="calendar-grid calendar-grid--day">${left}${right}</div>`;
  }

  renderCalendarWeekMode() {
    const weekStart = startOfWeek(this.state.anchorDate);
    const days = [];
    for (let i = 0; i < 7; i += 1) days.push(addDays(weekStart, i));

    const cells = days.map((day) => {
      const key = toISODate(day);
      const blocks = this.getBlocksForDate(day);
      const due = this.getDueItemsForDate(day).length;
      const isSelected = toISODate(this.state.selectedDate) === key;
      return `
        <button class="calendar-cell calendar-cell--compact${isSelected ? ' is-selected' : ''}" type="button" data-day="${escapeAttr(key)}">
          <div class="calendar-cell__head">
            <div class="calendar-cell__day">${escapeHtml(new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(day))}</div>
            <div class="calendar-cell__num">${day.getDate()}</div>
          </div>
          <div class="calendar-cell__markers">
            ${blocks.length ? `<span class="calendar-dot" title="Слоты: ${blocks.length}"></span>` : ''}
            ${due ? `<span class="calendar-dot calendar-dot--deadline" title="Дедлайны: ${due}"></span>` : ''}
          </div>
        </button>
      `;
    }).join('');

    return `<div class="calendar-grid calendar-grid--week">${cells}</div>`;
  }

  renderCalendarMonthMode() {
    const monthStart = new Date(this.state.anchorDate.getFullYear(), this.state.anchorDate.getMonth(), 1);
    const monthEnd = new Date(this.state.anchorDate.getFullYear(), this.state.anchorDate.getMonth() + 1, 1);
    const gridStart = startOfWeek(monthStart);

    let gridEnd = new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate());
    while (gridEnd.getDay() !== 1) {
      gridEnd = addDays(gridEnd, 1);
    }

    const cells = [];
    for (let d = new Date(gridStart); d < gridEnd; d = addDays(d, 1)) {
      const key = toISODate(d);
      const blocks = this.getBlocksForDate(d);
      const due = this.getDueItemsForDate(d).length;
      const selected = toISODate(this.state.selectedDate) === key;
      const outside = d.getMonth() !== monthStart.getMonth();

      cells.push(`
        <button class="calendar-cell calendar-cell--compact${selected ? ' is-selected' : ''}${outside ? ' is-outside' : ''}" type="button" data-day="${escapeAttr(key)}">
          <div class="calendar-cell__head">
            <div class="calendar-cell__num">${d.getDate()}</div>
          </div>
          <div class="calendar-cell__markers">
            ${blocks.length ? `<span class="calendar-dot" title="Слоты: ${blocks.length}"></span>` : ''}
            ${due ? `<span class="calendar-dot calendar-dot--deadline" title="Дедлайны: ${due}"></span>` : ''}
          </div>
        </button>
      `);
    }

    return `<div class="calendar-grid calendar-grid--month">${cells.join('')}</div>`;
  }

  renderCalendarYearMode() {
    const year = this.state.anchorDate.getFullYear();
    const months = [];
    for (let m = 0; m < 12; m += 1) {
      const monthStart = new Date(year, m, 1);
      const monthEnd = new Date(year, m + 1, 1);
      const blocks = this.state.blocks.filter((b) => {
        const s = toEpoch(b.starts_at);
        return s >= monthStart.getTime() && s < monthEnd.getTime();
      });
      const due = this.state.items.filter((item) => {
        if (!item.deadline_at) return false;
        const d = new Date(item.deadline_at);
        return d.getFullYear() === year && d.getMonth() === m;
      });
      const selected = this.state.selectedDate.getFullYear() === year && this.state.selectedDate.getMonth() === m;
      months.push(`
        <button class="calendar-cell calendar-cell--compact${selected ? ' is-selected' : ''}" type="button" data-day="${escapeAttr(toISODate(monthStart))}">
          <div class="calendar-cell__head">
            <div class="calendar-cell__day">${escapeHtml(new Intl.DateTimeFormat('ru-RU', { month: 'long' }).format(monthStart))}</div>
            <div class="calendar-cell__num">${m + 1}</div>
          </div>
          <div class="calendar-cell__markers">
            ${blocks.length ? `<span class="calendar-dot" title="Слоты: ${blocks.length}"></span>` : ''}
            ${due.length ? `<span class="calendar-dot calendar-dot--deadline" title="Дедлайны: ${due.length}"></span>` : ''}
          </div>
        </button>
      `);
    }
    return `<div class="calendar-grid calendar-grid--year">${months.join('')}</div>`;
  }

  renderCalendarBlockItem(block) {
    const item = block.item_id ? this.findItem(block.item_id) : null;
    const meta = [];
    if (item) meta.push(categoryLabel(item.category));
    if (block.status) meta.push(String(block.status).toUpperCase());
    return `
      <article class="calendar-item">
        <div class="calendar-item__time">${escapeHtml(this.blockTimeLine(block))}</div>
        <div class="calendar-item__title">${escapeHtml(String(block.title || (item && item.title) || 'слот'))}</div>
        ${meta.length ? `<div class="calendar-item__meta">${escapeHtml(meta.join(' · '))}</div>` : ''}
        <div class="calendar-item__actions">
          <button class="btn btn--thin" type="button" data-open-block="${escapeAttr(block.id)}">Открыть</button>
          <button class="btn btn--thin" type="button" data-delete-block="${escapeAttr(block.id)}">Удалить</button>
        </div>
      </article>
    `;
  }

  renderSelectedDateSidePanel() {
    const day = this.state.selectedDate;
    const blocks = this.getBlocksForDate(day);
    const due = this.getDueItemsForDate(day);
    const overdue = this.getOverdueItems(day).slice(0, 6);

    return `
      <aside class="calendar-side">
        <header class="sched-block__head">
          <div class="sched-block__title">Детали даты: ${escapeHtml(toISODate(day))}</div>
          <button class="btn btn--thin" type="button" data-new-block-day="${escapeAttr(toISODate(day))}">+ слот</button>
        </header>

        <section class="sched-pane">
          <div class="sched-block__title">Слоты дня</div>
          ${blocks.length ? `<div class="item-list">${blocks.map((b) => this.renderCalendarBlockItem(b)).join('')}</div>` : '<div class="empty-note">Слотов нет</div>'}
        </section>

        <section class="sched-pane">
          <div class="sched-block__title">Дедлайны дня</div>
          ${due.length ? `<div class="item-list">${due.map((i) => this.renderItemCompact(i)).join('')}</div>` : '<div class="empty-note">Дедлайнов нет</div>'}
        </section>

        <section class="sched-pane">
          <div class="sched-block__title">Срочные просроченные</div>
          ${overdue.length ? `<div class="item-list">${overdue.map((i) => this.renderItemCompact(i)).join('')}</div>` : '<div class="empty-note">Нет просроченных</div>'}
        </section>
      </aside>
    `;
  }

  unscheduledItems() {
    const futureBlocksByItem = new Map();
    const now = Date.now();
    this.state.blocks.forEach((block) => {
      if (!block.item_id) return;
      const end = toEpoch(block.ends_at);
      if (end < now) return;
      const key = String(block.item_id);
      futureBlocksByItem.set(key, (futureBlocksByItem.get(key) || 0) + 1);
    });

    return this.state.items
      .filter((item) => {
        const status = String(item.status || '').toLowerCase();
        if (status === 'done' || status === 'archived') return false;
        const scheduled = futureBlocksByItem.get(String(item.id)) || 0;
        return scheduled === 0;
      })
      .slice()
      .sort((a, b) => urgencyScore(b, new Date(), 30) - urgencyScore(a, new Date(), 30));
  }

  pendingSuggestions() {
    return this.state.suggestions
      .filter((s) => String(s.status || '') === 'pending')
      .slice()
      .sort((a, b) => toEpoch(a.suggested_start_at) - toEpoch(b.suggested_start_at));
  }

  allUpcomingBusyBlocks() {
    const now = Date.now();
    return this.state.blocks
      .filter((block) => {
        if (block.item_id) return false;
        if (!block.is_locked) return false;
        if (String(block.status || '') === 'cancelled') return false;
        return toEpoch(block.ends_at) >= now;
      })
      .slice()
      .sort((a, b) => toEpoch(a.starts_at) - toEpoch(b.starts_at));
  }

  upcomingBusyBlocks(limit = 8) {
    return this
      .allUpcomingBusyBlocks()
      .slice(0, Math.max(1, Number(limit) || 8));
  }

  renderBusyPreviewCard(block) {
    const start = new Date(block.starts_at);
    const end = new Date(block.ends_at);
    const dayKey = toISODate(start);
    return `
      <article class="item-card">
        <div class="item-card__title">${escapeHtml(String(block.title || 'Занятость'))}</div>
        <div class="item-card__meta">${escapeHtml(`${dayKey} ${toTimeText(start)} - ${toTimeText(end)}`)}</div>
        <div class="item-card__actions">
          <button class="btn btn--thin" type="button" data-open-busy-day="${escapeAttr(dayKey)}">Открыть в календаре</button>
        </div>
      </article>
    `;
  }

  renderSuggestionCard(s) {
    const item = this.findItem(s.item_id);
    const start = new Date(s.suggested_start_at);
    const end = new Date(s.suggested_end_at);
    const score = Number.parseFloat(String(s.score || 0));
    return `
      <article class="suggest-card">
        <div class="suggest-card__title">${escapeHtml(item ? item.title : 'План')}</div>
        <div class="suggest-card__meta">${escapeHtml(`${toISODate(start)} ${toTimeText(start)} - ${toTimeText(end)} · score ${score.toFixed(2)}`)}</div>
        ${s.reason ? `<div class="suggest-card__reason">${escapeHtml(String(s.reason))}</div>` : ''}
        <div class="suggest-card__actions">
          <button class="btn btn--thin" type="button" data-suggest-reject="${escapeAttr(s.id)}">Отклонить</button>
          <button class="btn btn--thin" type="button" data-suggest-adjust="${escapeAttr(s.id)}">Изменить</button>
          <button class="btn" type="button" data-suggest-accept="${escapeAttr(s.id)}">Принять</button>
        </div>
      </article>
    `;
  }

  renderAssistantTab() {
    const unscheduled = this.unscheduledItems();
    const suggestions = this.pendingSuggestions();
    const latestRun = this.state.runs[0] || null;
    const summary = latestRun ? parseJsonMaybe(latestRun.summary, {}) : {};
    const warnings = asArray(summary.warnings).slice(0, 8);

    const defaults = parseJsonMaybe(this.state.prefs && this.state.prefs.assistant_defaults, {});
    const horizonDefault = clamp(Number(defaults.horizon_days || 30), 3, 180);
    const modeDefault = normalizeMode(defaults.mode || 'deadline_focus');
    const busyPreview = this.upcomingBusyBlocks(8);
    const busyTotal = this.allUpcomingBusyBlocks().length;

    return `
      <div class="sched-pane">
        <section class="sched-block">
          <div class="sched-block__head">
            <div class="sched-block__title">Помощник по составлению расписания</div>
            <button class="btn" type="button" data-run-assistant>Сформировать предложения</button>
          </div>
          <div class="assistant-note">Сначала добавь постоянные занятости (уроки, работа, тренировки), потом выгрузи планы в inbox. Помощник учитывает дедлайн, объем, обязательность, приоритет и свободные окна.</div>
        </section>

        <section class="sched-block">
          <header class="sched-block__head">
            <div class="sched-block__title">Регулярная занятость</div>
          </header>
          <div class="assistant-note">Пример: школа каждый понедельник с 08:30 до 14:45.</div>
          <form class="form" data-recurring-busy-form>
            <div class="form__grid2">
              <label class="field">Название
                <input class="ctl" name="title" maxlength="220" />
              </label>
              <label class="field">Категория
                <select class="ctl" name="category">
                  <option value="mandatory" selected>Обязательное</option>
                  <option value="personal">Личное</option>
                  <option value="temporary">Временное</option>
                </select>
              </label>
            </div>

            <div class="form__grid2">
              <label class="field">День недели
                <select class="ctl" name="weekday">
                  <option value="1" selected>Понедельник</option>
                  <option value="2">Вторник</option>
                  <option value="3">Среда</option>
                  <option value="4">Четверг</option>
                  <option value="5">Пятница</option>
                  <option value="6">Суббота</option>
                  <option value="0">Воскресенье</option>
                </select>
              </label>
              <label class="field">Начиная с даты
                <input class="ctl" type="date" name="from_date" />
              </label>
            </div>

            <div class="form__grid2">
              <label class="field">Начало
                <input class="ctl" type="time" name="start_time" required />
              </label>
              <label class="field">Конец
                <input class="ctl" type="time" name="end_time" required />
              </label>
            </div>

            <div class="form__grid2">
              <label class="field">Повторять до (необязательно)
                <input class="ctl" type="date" name="until_date" />
              </label>
              <div class="assistant-note">Если оставить пусто, создается только ближайшая дата. Чтобы получить серию, укажи дату окончания.</div>
            </div>

            <div class="form__actions">
              <button class="btn" type="submit">Добавить регулярную занятость</button>
            </div>
          </form>

          <div class="sched-block__title">Ближайшие занятости${busyTotal ? ` · показано ${busyPreview.length} из ${busyTotal}` : ''}</div>
          ${busyPreview.length
            ? `<div class="item-list">${busyPreview.map((block) => this.renderBusyPreviewCard(block)).join('')}</div>`
            : '<div class="empty-note">Пока нет регулярных занятостей</div>'}
        </section>

        <div class="assistant-grid">
          <section class="sched-block">
            <header class="sched-block__head">
              <div class="sched-block__title">Inbox планов</div>
            </header>

            <form class="form" data-assistant-item-form>
              <div class="form__grid2">
                <label class="field">Название
                  <input class="ctl" name="title" required maxlength="220" />
                </label>
                <label class="field">Категория
                  <select class="ctl" name="category">
                    <option value="mandatory">Обязательное</option>
                    <option value="personal">Личное</option>
                    <option value="temporary">Временное</option>
                  </select>
                </label>
              </div>

              <div class="form__grid2">
                <label class="field">Формат плана
                  <select class="ctl" name="plan_mode" data-assistant-plan-mode>
                    <option value="deadline" selected>По дедлайну</option>
                    <option value="day_flexible">На конкретный день (время подберет помощник)</option>
                    <option value="weekly_flexible">Регулярно по дням недели (время подберет помощник)</option>
                  </select>
                </label>
                <label class="field" data-mode-only="day_flexible">Нужный день
                  <input class="ctl" name="desired_day" type="date" />
                </label>
              </div>

              <div class="form__grid2" data-mode-only="weekly_flexible">
                <label class="field">Начиная с даты
                  <input class="ctl" name="from_date" type="date" />
                </label>
                <label class="field">Повторять до (необязательно)
                  <input class="ctl" name="until_date" type="date" />
                </label>
              </div>

              <div class="field" data-mode-only="weekly_flexible">
                <span>Дни недели</span>
                <div class="weekday-pick">
                  <label class="field-inline"><input type="checkbox" name="weekday_1" checked />Пн</label>
                  <label class="field-inline"><input type="checkbox" name="weekday_2" />Вт</label>
                  <label class="field-inline"><input type="checkbox" name="weekday_3" />Ср</label>
                  <label class="field-inline"><input type="checkbox" name="weekday_4" />Чт</label>
                  <label class="field-inline"><input type="checkbox" name="weekday_5" />Пт</label>
                  <label class="field-inline"><input type="checkbox" name="weekday_6" />Сб</label>
                  <label class="field-inline"><input type="checkbox" name="weekday_0" />Вс</label>
                </div>
              </div>

              <div class="assistant-note" data-mode-only="day_flexible">Дедлайн можно не указывать. Помощник сам поставит точное время в выбранный день.</div>
              <div class="assistant-note" data-mode-only="weekly_flexible">Помощник создаст отдельный inbox-план на каждую выбранную дату и сам подберет точное время внутри дня. Если дата окончания не указана, берется 8 недель вперед.</div>

              <div class="form__grid2">
                <label class="field">Приоритет
                  <select class="ctl" name="priority">
                    <option value="low">LOW</option>
                    <option value="mid" selected>MID</option>
                    <option value="high">HIGH</option>
                    <option value="critical">CRITICAL</option>
                  </select>
                </label>
                <label class="field">Оценка времени (мин)
                  <input class="ctl" name="estimated_minutes" type="number" min="15" max="720" value="60" />
                </label>
              </div>

              <div class="form__grid2" data-mode-only="deadline">
                <label class="field">Дедлайн (дата, необязательно)
                  <input class="ctl" name="deadline_date" type="date" />
                </label>
                <label class="field">Дедлайн (время, необязательно)
                  <input class="ctl" name="deadline_time" type="time" />
                </label>
              </div>
              <div class="assistant-note" data-mode-only="deadline">Если время дедлайна не указано, используется конец дня.</div>

              <div class="form__grid2">
                <label class="field">Предпочтительное время
                  <select class="ctl" name="preferred_period">
                    <option value="any">Любое</option>
                    <option value="morning">Утро</option>
                    <option value="afternoon">День</option>
                    <option value="evening">Вечер</option>
                    <option value="night">Ночь</option>
                  </select>
                </label>
                <label class="field">Гибкость
                  <select class="ctl" name="flexibility">
                    <option value="fixed">Фиксированно</option>
                    <option value="flexible" selected>Гибко</option>
                    <option value="very_flexible">Очень гибко</option>
                  </select>
                </label>
              </div>

              <label class="field">Комментарий
                <textarea class="ctl" name="note" rows="3" maxlength="500"></textarea>
              </label>

              <div class="field-inline">
                <input type="checkbox" name="is_required" id="assistantRequired" />
                <label for="assistantRequired">Обязательное исполнение</label>
              </div>

              <div class="form__actions">
                <button class="btn" type="submit">Добавить в inbox</button>
              </div>
            </form>

            <div class="sched-block__title">Нераспределенные планы · ${unscheduled.length}</div>
            ${unscheduled.length
              ? `<div class="item-list">${unscheduled.slice(0, 18).map((item) => this.renderItemCompact(item, { allowDelete: true })).join('')}</div>`
              : '<div class="empty-note">Все планы уже распределены или закрыты</div>'}
          </section>

          <section class="sched-block">
            <header class="sched-block__head">
              <div class="sched-block__title">Параметры запуска</div>
            </header>

            <form class="form" data-assistant-run-form>
              <div class="form__grid2">
                <label class="field">Режим
                  <select class="ctl" name="mode">
                    <option value="deadline_focus" ${modeDefault === 'deadline_focus' ? 'selected' : ''}>Дедлайн-фокус</option>
                    <option value="balanced" ${modeDefault === 'balanced' ? 'selected' : ''}>Сбалансированный</option>
                    <option value="light" ${modeDefault === 'light' ? 'selected' : ''}>Мягкий</option>
                    <option value="auto" ${modeDefault === 'auto' ? 'selected' : ''}>Авто</option>
                  </select>
                </label>

                <label class="field">Горизонт (дней)
                  <input class="ctl" type="number" name="horizon_days" min="3" max="180" value="${horizonDefault}" />
                </label>
              </div>
              <div class="form__actions">
                <button class="btn" type="submit">Запустить помощник</button>
              </div>
            </form>

            <div class="sched-block__title">Предложения · ${suggestions.length}</div>
            ${suggestions.length
              ? `<div class="suggest-list">${suggestions.slice(0, 80).map((s) => this.renderSuggestionCard(s)).join('')}</div>`
              : '<div class="empty-note">Пока нет предложений. Запусти помощник.</div>'}

            <div class="sched-block__title">Последний запуск</div>
            ${latestRun
              ? `
                <div class="assistant-note">Статус: ${escapeHtml(String(latestRun.status || 'completed'))} · ${escapeHtml(new Date(latestRun.started_at).toLocaleString())}</div>
                ${warnings.length
                  ? `<div class="item-list">${warnings.map((w) => `<div class="empty-note">${escapeHtml(String(w))}</div>`).join('')}</div>`
                  : '<div class="assistant-note">Предупреждений нет.</div>'}
              `
              : '<div class="assistant-note">Еще не запускали.</div>'}
          </section>
        </div>
      </div>
    `;
  }

  renderSettingsTab() {
    const notifyDefaults = parseJsonMaybe(this.state.prefs && this.state.prefs.notification_defaults, {});
    const assistantDefaults = parseJsonMaybe(this.state.prefs && this.state.prefs.assistant_defaults, {});
    const viewDefaults = parseJsonMaybe(this.state.prefs && this.state.prefs.view_defaults, {});

    const offsets = asArray(notifyDefaults.offsets).join(', ') || '60, 15';
    const mode = CALENDAR_MODES.includes(String(viewDefaults.mode || '').toLowerCase()) ? String(viewDefaults.mode) : 'month';
    const horizon = clamp(Number(assistantDefaults.horizon_days || 30), 3, 180);
    const start = String(assistantDefaults.day_start || '08:00');
    const end = String(assistantDefaults.day_end || '22:00');

    return `
      <div class="sched-pane">
        <section class="sched-block">
          <div class="sched-block__head">
            <div class="sched-block__title">Настройки расписания</div>
          </div>
          <form class="form settings-grid" data-settings-form>
            <label class="field">Режим календаря по умолчанию
              <select class="ctl" name="view_mode">
                <option value="day" ${mode === 'day' ? 'selected' : ''}>День</option>
                <option value="week" ${mode === 'week' ? 'selected' : ''}>Неделя</option>
                <option value="month" ${mode === 'month' ? 'selected' : ''}>Месяц</option>
                <option value="year" ${mode === 'year' ? 'selected' : ''}>Год</option>
              </select>
            </label>

            <label class="field">Горизонт помощника (дни)
              <input class="ctl" type="number" min="3" max="180" name="assistant_horizon" value="${horizon}" />
            </label>

            <label class="field">Начало рабочего дня
              <input class="ctl" type="time" name="day_start" value="${escapeAttr(start)}" />
            </label>

            <label class="field">Конец рабочего дня
              <input class="ctl" type="time" name="day_end" value="${escapeAttr(end)}" />
            </label>

            <label class="field">Напоминания (мин до события, через запятую)
              <input class="ctl" type="text" name="notify_offsets" value="${escapeAttr(offsets)}" />
            </label>

            <label class="field">Режим помощника по умолчанию
              <select class="ctl" name="assistant_mode">
                <option value="deadline_focus" ${normalizeMode(assistantDefaults.mode) === 'deadline_focus' ? 'selected' : ''}>Дедлайн-фокус</option>
                <option value="balanced" ${normalizeMode(assistantDefaults.mode) === 'balanced' ? 'selected' : ''}>Сбалансированный</option>
                <option value="light" ${normalizeMode(assistantDefaults.mode) === 'light' ? 'selected' : ''}>Мягкий</option>
                <option value="auto" ${normalizeMode(assistantDefaults.mode) === 'auto' ? 'selected' : ''}>Авто</option>
              </select>
            </label>

            <label class="field field-inline" style="grid-column: 1 / -1;">
              <input type="checkbox" name="notifications_enabled" ${notifyDefaults.enabled === false ? '' : 'checked'} />
              Уведомления включены
            </label>

            <div class="form__actions" style="grid-column: 1 / -1;">
              <button class="btn" type="submit">Сохранить настройки</button>
            </div>
          </form>
        </section>

        <section class="sched-block">
          <div class="sched-block__title">Данные в БД</div>
          <div class="assistant-note">Все планы, слоты, предложения помощника и настройки сохраняются в базе данных. Локально ничего критичного не хранится.</div>
        </section>
      </div>
    `;
  }

  openItemModal(item = null) {
    const now = new Date();
    const isEdit = !!item;
    const title = isEdit ? 'План: редактирование' : 'Новый план';

    const deadlineDate = item && item.deadline_at ? toISODate(new Date(item.deadline_at)) : '';
    const deadlineTime = item && item.deadline_at ? toTimeText(new Date(item.deadline_at)) : '';
    const desiredDate = item && item.desired_day ? String(item.desired_day) : '';
    const preferredFrom = item && item.preferred_time_from ? String(item.preferred_time_from).slice(0, 5) : '';
    const preferredTo = item && item.preferred_time_to ? String(item.preferred_time_to).slice(0, 5) : '';
    const repeatUntil = item && item.repeat_until ? String(item.repeat_until) : '';
    const offsets = item ? asArray(item.notify_offsets).join(', ') : '60, 15';

    this.ui.openModal({
      title,
      bodyHtml: `
        <form class="form" data-item-form>
          <label class="field">Название
            <input class="ctl" name="title" required maxlength="220" value="${escapeAttr(item ? item.title : '')}" />
          </label>

          <label class="field">Описание
            <textarea class="ctl" name="description" rows="3" maxlength="1000">${escapeHtml(item ? item.description : '')}</textarea>
          </label>

          <div class="form__grid2">
            <label class="field">Категория
              <select class="ctl" name="category">
                <option value="mandatory" ${normalizeCategory(item && item.category) === 'mandatory' ? 'selected' : ''}>Обязательное</option>
                <option value="personal" ${normalizeCategory(item && item.category) === 'personal' ? 'selected' : ''}>Личное</option>
                <option value="temporary" ${normalizeCategory(item && item.category) === 'temporary' ? 'selected' : ''}>Временное</option>
              </select>
            </label>

            <label class="field">Тип
              <select class="ctl" name="item_type">
                <option value="task" ${String(item && item.item_type || 'task') === 'task' ? 'selected' : ''}>Задача</option>
                <option value="event" ${String(item && item.item_type || '') === 'event' ? 'selected' : ''}>Событие</option>
              </select>
            </label>
          </div>

          <div class="form__grid2">
            <label class="field">Приоритет
              <select class="ctl" name="priority">
                <option value="low" ${normalizePriority(item && item.priority) === 'low' ? 'selected' : ''}>LOW</option>
                <option value="mid" ${normalizePriority(item && item.priority) === 'mid' ? 'selected' : ''}>MID</option>
                <option value="high" ${normalizePriority(item && item.priority) === 'high' ? 'selected' : ''}>HIGH</option>
                <option value="critical" ${normalizePriority(item && item.priority) === 'critical' ? 'selected' : ''}>CRITICAL</option>
              </select>
            </label>

            <label class="field">Оценка времени (мин)
              <input class="ctl" type="number" min="15" max="720" name="estimated_minutes" value="${escapeAttr(String(item && item.estimated_minutes || 60))}" />
            </label>
          </div>

          <div class="form__grid2">
            <label class="field">Дедлайн (дата, необязательно)
              <input class="ctl" type="date" name="deadline_date" value="${escapeAttr(deadlineDate)}" />
            </label>
            <label class="field">Дедлайн (время, необязательно)
              <input class="ctl" type="time" name="deadline_time" value="${escapeAttr(deadlineTime)}" />
            </label>
          </div>

          <div class="assistant-note">Без времени дедлайн считается на конец выбранного дня.</div>

          <div class="form__grid2">
            <label class="field">Желаемая дата
              <input class="ctl" type="date" name="desired_day" value="${escapeAttr(desiredDate)}" />
            </label>
            <label class="field">Предпочтительный период
              <select class="ctl" name="preferred_period">
                <option value="any" ${normalizePeriod(item && item.preferred_period) === 'any' ? 'selected' : ''}>Любое время</option>
                <option value="morning" ${normalizePeriod(item && item.preferred_period) === 'morning' ? 'selected' : ''}>Утро</option>
                <option value="afternoon" ${normalizePeriod(item && item.preferred_period) === 'afternoon' ? 'selected' : ''}>День</option>
                <option value="evening" ${normalizePeriod(item && item.preferred_period) === 'evening' ? 'selected' : ''}>Вечер</option>
                <option value="night" ${normalizePeriod(item && item.preferred_period) === 'night' ? 'selected' : ''}>Ночь</option>
              </select>
            </label>
          </div>

          <div class="form__grid2">
            <label class="field">Предпочтительно с
              <input class="ctl" type="time" name="preferred_from" value="${escapeAttr(preferredFrom)}" />
            </label>
            <label class="field">Предпочтительно до
              <input class="ctl" type="time" name="preferred_to" value="${escapeAttr(preferredTo)}" />
            </label>
          </div>

          <div class="form__grid2">
            <label class="field">Гибкость
              <select class="ctl" name="flexibility">
                <option value="fixed" ${normalizeFlexibility(item && item.flexibility) === 'fixed' ? 'selected' : ''}>Фиксированно</option>
                <option value="flexible" ${normalizeFlexibility(item && item.flexibility) === 'flexible' ? 'selected' : ''}>Гибко</option>
                <option value="very_flexible" ${normalizeFlexibility(item && item.flexibility) === 'very_flexible' ? 'selected' : ''}>Очень гибко</option>
              </select>
            </label>

            <label class="field">Повтор
              <select class="ctl" name="repeat_rule">
                <option value="none" ${normalizeRepeat(item && item.repeat_rule) === 'none' ? 'selected' : ''}>Без повтора</option>
                <option value="daily" ${normalizeRepeat(item && item.repeat_rule) === 'daily' ? 'selected' : ''}>Ежедневно</option>
                <option value="weekly" ${normalizeRepeat(item && item.repeat_rule) === 'weekly' ? 'selected' : ''}>Еженедельно</option>
                <option value="monthly" ${normalizeRepeat(item && item.repeat_rule) === 'monthly' ? 'selected' : ''}>Ежемесячно</option>
                <option value="yearly" ${normalizeRepeat(item && item.repeat_rule) === 'yearly' ? 'selected' : ''}>Ежегодно</option>
                <option value="weekdays" ${normalizeRepeat(item && item.repeat_rule) === 'weekdays' ? 'selected' : ''}>Будни</option>
                <option value="weekends" ${normalizeRepeat(item && item.repeat_rule) === 'weekends' ? 'selected' : ''}>Выходные</option>
              </select>
            </label>
          </div>

          <div class="form__grid2">
            <label class="field">Повторять до
              <input class="ctl" type="date" name="repeat_until" value="${escapeAttr(repeatUntil)}" />
            </label>
            <label class="field">Уведомления (мин)
              <input class="ctl" type="text" name="notify_offsets" value="${escapeAttr(offsets)}" />
            </label>
          </div>

          <label class="field">Комментарий
            <textarea class="ctl" name="note" rows="2" maxlength="1000">${escapeHtml(item ? item.note : '')}</textarea>
          </label>

          <div class="field-inline">
            <input type="checkbox" name="is_required" id="itemRequired" ${item && item.is_required ? 'checked' : ''} />
            <label for="itemRequired">Обязательное исполнение</label>
          </div>

          <div class="field-inline">
            <input type="checkbox" name="notify_enabled" id="itemNotify" ${item && item.notify_enabled === false ? '' : 'checked'} />
            <label for="itemNotify">Уведомления включены</label>
          </div>

          <div class="form__actions">
            <button class="btn" type="button" data-close>Отмена</button>
            <button class="btn" type="submit">${isEdit ? 'Сохранить' : 'Создать'}</button>
          </div>
        </form>
      `,
      onSubmit: (data) => {
        if (isEdit) {
          void this.updateItem(item, data).catch((error) => this.onError(error));
        } else {
          void this.createItem(data).catch((error) => this.onError(error));
        }
      }
    });
  }

  buildItemPayload(data) {
    const title = String(data.title || '').trim();
    if (!title) {
      this.ui.toast('Укажите название');
      return null;
    }

    const estimate = clamp(Number.parseInt(String(data.estimated_minutes || '60'), 10) || 60, 15, 720);
    const deadline = data.deadline_date
      ? composeDateTime(data.deadline_date, data.deadline_time, 23, 59)
      : null;

    const desiredDay = parseISODate(data.desired_day) ? String(data.desired_day) : null;
    const preferredFrom = parseTimeText(data.preferred_from) ? String(data.preferred_from) : null;
    const preferredTo = parseTimeText(data.preferred_to) ? String(data.preferred_to) : null;
    if (preferredFrom && preferredTo && preferredTo <= preferredFrom) {
      this.ui.toast('Окно времени: конец должен быть позже начала');
      return null;
    }

    const repeatRule = normalizeRepeat(data.repeat_rule);
    const repeatUntil = parseISODate(data.repeat_until) ? String(data.repeat_until) : null;

    const offsets = parseOffsets(data.notify_offsets);

    return {
      title,
      description: String(data.description || '').trim(),
      category: normalizeCategory(data.category),
      item_type: String(data.item_type || 'task') === 'event' ? 'event' : 'task',
      priority: normalizePriority(data.priority),
      is_required: data.is_required === 'on' || data.is_required === true,
      estimated_minutes: estimate,
      deadline_at: deadline ? deadline.toISOString() : null,
      preferred_period: normalizePeriod(data.preferred_period),
      preferred_time_from: preferredFrom,
      preferred_time_to: preferredTo,
      flexibility: normalizeFlexibility(data.flexibility),
      desired_day: desiredDay,
      desired_start: null,
      desired_end: null,
      repeat_rule: repeatRule,
      repeat_until: repeatRule === 'none' ? null : repeatUntil,
      notify_enabled: data.notify_enabled === 'on' || data.notify_enabled === true,
      notify_offsets: offsets,
      note: String(data.note || '').trim()
    };
  }

  async createItem(data) {
    const payload = this.buildItemPayload(data);
    if (!payload || !this.state.space) return;

    const { error } = await this.client
      .from('ik_sched_items')
      .insert({
        space_id: this.state.space.id,
        ...payload,
        status: 'pending',
        created_by: this.user.id,
        updated_by: this.user.id
      });

    if (error) throw error;
    this.ui.closeModal();
    await this.reloadAll();
    this.render({ preserveView: true });
    this.ui.toast('План создан');
  }

  async updateItem(item, data) {
    const payload = this.buildItemPayload(data);
    if (!payload || !this.state.space || !item) return;

    const { error } = await this.client
      .from('ik_sched_items')
      .update({
        ...payload,
        updated_by: this.user.id
      })
      .eq('id', item.id)
      .eq('space_id', this.state.space.id);

    if (error) throw error;
    this.ui.closeModal();
    await this.reloadAll();
    this.render({ preserveView: true });
    this.ui.toast('План сохранен');
  }

  openDeleteItemModal(itemId) {
    const item = this.findItem(itemId);
    if (!item) return;
    this.ui.openModal({
      title: 'Удалить план',
      bodyHtml: `
        <form class="form">
          <div class="assistant-note">Удалить план "${escapeHtml(String(item.title || ''))}"?</div>
          <div class="form__actions">
            <button class="btn" type="button" data-close>Отмена</button>
            <button class="btn btn--danger" type="submit">Удалить</button>
          </div>
        </form>
      `,
      onSubmit: () => {
        void this.deleteItem(item.id).catch((error) => this.onError(error));
      }
    });
  }

  async deleteItem(itemId) {
    const { error } = await this.client
      .from('ik_sched_items')
      .delete()
      .eq('id', itemId)
      .eq('space_id', this.state.space.id);
    if (error) throw error;
    this.ui.closeModal();
    await this.reloadAll();
    this.render({ preserveView: true });
    this.ui.toast('План удален');
  }

  async duplicateItem(itemId) {
    const item = this.findItem(itemId);
    if (!item || !this.state.space) return;
    const copy = {
      space_id: this.state.space.id,
      title: `${item.title} (копия)`,
      description: item.description || '',
      category: normalizeCategory(item.category),
      item_type: String(item.item_type || 'task') === 'event' ? 'event' : 'task',
      priority: normalizePriority(item.priority),
      is_required: !!item.is_required,
      estimated_minutes: clamp(Number(item.estimated_minutes || 60), 15, 720),
      deadline_at: item.deadline_at || null,
      preferred_period: normalizePeriod(item.preferred_period),
      preferred_time_from: item.preferred_time_from || null,
      preferred_time_to: item.preferred_time_to || null,
      flexibility: normalizeFlexibility(item.flexibility),
      desired_day: item.desired_day || null,
      desired_start: item.desired_start || null,
      desired_end: item.desired_end || null,
      repeat_rule: normalizeRepeat(item.repeat_rule),
      repeat_until: item.repeat_until || null,
      notify_enabled: item.notify_enabled !== false,
      notify_offsets: asArray(item.notify_offsets),
      status: 'pending',
      note: item.note || '',
      created_by: this.user.id,
      updated_by: this.user.id
    };

    const { error } = await this.client.from('ik_sched_items').insert(copy);
    if (error) throw error;
    await this.reloadAll();
    this.render({ preserveView: true });
    this.ui.toast('Создан дубль плана');
  }

  itemOptionsHtml(selectedId = '') {
    const selected = String(selectedId || '');
    const rows = this.state.items
      .slice()
      .sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));

    return [`<option value="">Без привязки</option>`]
      .concat(rows.map((item) => `<option value="${escapeAttr(item.id)}" ${String(item.id) === selected ? 'selected' : ''}>${escapeHtml(shortText(item.title, 60))}</option>`))
      .join('');
  }

  openBlockModal(block = null, seedDay = null) {
    const isEdit = !!block;
    const title = isEdit ? 'Слот: редактирование' : 'Новый слот';

    const start = block
      ? new Date(block.starts_at)
      : composeDateTime(seedDay ? toISODate(seedDay) : toISODate(new Date()), '09:00', 9, 0);
    const end = block
      ? new Date(block.ends_at)
      : addMinutes(start, 60);

    const linkedItem = block && block.item_id ? this.findItem(block.item_id) : null;
    const category = normalizeCategory(block ? block.category : (linkedItem && linkedItem.category));

    this.ui.openModal({
      title,
      bodyHtml: `
        <form class="form" data-block-form>
          <label class="field">Название
            <input class="ctl" name="title" required maxlength="220" value="${escapeAttr(block ? block.title : '')}" />
          </label>

          <div class="form__grid2">
            <label class="field">Привязать к плану
              <select class="ctl" name="item_id">${this.itemOptionsHtml(block ? block.item_id : '')}</select>
            </label>

            <label class="field">Категория
              <select class="ctl" name="category">
                <option value="mandatory" ${category === 'mandatory' ? 'selected' : ''}>Обязательное</option>
                <option value="personal" ${category === 'personal' ? 'selected' : ''}>Личное</option>
                <option value="temporary" ${category === 'temporary' ? 'selected' : ''}>Временное</option>
              </select>
            </label>
          </div>

          <div class="form__grid2">
            <label class="field">Дата
              <input class="ctl" type="date" name="date" value="${escapeAttr(toISODate(start))}" required />
            </label>
            <label class="field">Старт
              <input class="ctl" type="time" name="start_time" value="${escapeAttr(toTimeText(start))}" required />
            </label>
          </div>

          <div class="form__grid2">
            <label class="field">Финиш
              <input class="ctl" type="time" name="end_time" value="${escapeAttr(toTimeText(end))}" required />
            </label>
            <label class="field">Статус
              <select class="ctl" name="status">
                <option value="planned" ${String(block && block.status || 'planned') === 'planned' ? 'selected' : ''}>PLANNED</option>
                <option value="done" ${String(block && block.status || '') === 'done' ? 'selected' : ''}>DONE</option>
                <option value="skipped" ${String(block && block.status || '') === 'skipped' ? 'selected' : ''}>SKIPPED</option>
                <option value="cancelled" ${String(block && block.status || '') === 'cancelled' ? 'selected' : ''}>CANCELLED</option>
              </select>
            </label>
          </div>

          ${isEdit ? '' : `
            <div class="form__grid2">
              <label class="field">Повтор слота
                <select class="ctl" name="repeat_rule">
                  <option value="none" selected>Без повтора</option>
                  <option value="weekly">Еженедельно</option>
                  <option value="weekdays">По будням</option>
                  <option value="daily">Ежедневно</option>
                </select>
              </label>
              <label class="field">Повторять до
                <input class="ctl" type="date" name="repeat_until" />
              </label>
            </div>
            <div class="assistant-note">Если повтор включен и дата не задана, серия создается на 12 недель вперед.</div>
          `}

          <div class="field-inline">
            <input type="checkbox" name="is_locked" id="blockLocked" ${block && block.is_locked ? 'checked' : ''} />
            <label for="blockLocked">Зафиксированный слот</label>
          </div>

          <div class="form__actions">
            <button class="btn" type="button" data-close>Отмена</button>
            <button class="btn" type="submit">${isEdit ? 'Сохранить' : 'Создать'}</button>
          </div>
        </form>
      `,
      onSubmit: (data) => {
        if (isEdit) {
          void this.updateBlock(block, data).catch((error) => this.onError(error));
        } else {
          void this.createBlock(data).catch((error) => this.onError(error));
        }
      }
    });
  }

  buildBlockPayload(data, fallbackCategory = 'mandatory') {
    const title = String(data.title || '').trim();
    if (!title) {
      this.ui.toast('Укажи название слота');
      return null;
    }

    const startAt = composeDateTime(data.date, data.start_time, 9, 0);
    const endAt = composeDateTime(data.date, data.end_time, 10, 0);
    if (!startAt || !endAt || endAt <= startAt) {
      this.ui.toast('Проверь время: конец должен быть позже начала');
      return null;
    }

    const status = ['planned', 'done', 'skipped', 'cancelled'].includes(String(data.status || 'planned'))
      ? String(data.status)
      : 'planned';

    return {
      title,
      item_id: String(data.item_id || '').trim() || null,
      category: normalizeCategory(data.category || fallbackCategory),
      starts_at: startAt.toISOString(),
      ends_at: endAt.toISOString(),
      status,
      is_locked: data.is_locked === 'on' || data.is_locked === true
    };
  }

  buildRecurringBlockRows(payload, data) {
    const repeatRule = String(data.repeat_rule || 'none').toLowerCase();
    if (!['none', 'weekly', 'weekdays', 'daily'].includes(repeatRule)) return [payload];
    if (repeatRule === 'none') return [payload];

    const baseStart = new Date(payload.starts_at);
    const baseEnd = new Date(payload.ends_at);
    if (!Number.isFinite(baseStart.getTime()) || !Number.isFinite(baseEnd.getTime()) || baseEnd <= baseStart) {
      return [payload];
    }

    const baseDay = startOfDay(baseStart);
    const untilDate = parseISODate(data.repeat_until) || addDays(baseDay, 84);
    if (startOfDay(untilDate) < baseDay) {
      this.ui.toast('Дата повтора раньше даты слота');
      return null;
    }

    const durationMs = baseEnd.getTime() - baseStart.getTime();
    const startHour = baseStart.getHours();
    const startMinute = baseStart.getMinutes();

    const rows = [];
    const maxRows = 260;
    const pushRow = (day) => {
      if (rows.length >= maxRows) return;
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), startHour, startMinute, 0, 0);
      const end = new Date(start.getTime() + durationMs);
      rows.push({
        ...payload,
        starts_at: start.toISOString(),
        ends_at: end.toISOString()
      });
    };

    if (repeatRule === 'weekly') {
      for (let cursor = new Date(baseDay); cursor <= untilDate && rows.length < maxRows; cursor = addDays(cursor, 7)) {
        pushRow(cursor);
      }
    } else {
      for (let cursor = new Date(baseDay); cursor <= untilDate && rows.length < maxRows; cursor = addDays(cursor, 1)) {
        if (repeatRule === 'weekdays' && (cursor.getDay() === 0 || cursor.getDay() === 6)) continue;
        pushRow(cursor);
      }
    }

    if (!rows.length) rows.push(payload);
    return rows;
  }

  async createBlock(data) {
    if (!this.state.space) return;
    const payload = this.buildBlockPayload(data);
    if (!payload) return;

    const seriesRows = this.buildRecurringBlockRows(payload, data);
    if (!seriesRows || !seriesRows.length) return;

    const insertPayload = seriesRows.map((row) => ({
      ...row,
      space_id: this.state.space.id,
      source: 'manual',
      created_by: this.user.id,
      updated_by: this.user.id
    }));

    const { data: insertRows, error } = await this.client
      .from('ik_sched_blocks')
      .insert(insertPayload)
      .select('id,item_id');
    if (error) throw error;

    const linkedIds = Array.from(new Set(
      asArray(insertRows)
        .map((row) => String(row.item_id || '').trim())
        .filter(Boolean)
    ));
    if (linkedIds.length) {
      await this.client
        .from('ik_sched_items')
        .update({ status: 'scheduled', updated_by: this.user.id })
        .in('id', linkedIds)
        .eq('space_id', this.state.space.id)
        .in('status', ['pending', 'in_progress']);
    }

    this.ui.closeModal();
    await this.reloadAll();
    if (insertPayload.length > 1) {
      this.render({ preserveView: true });
      this.ui.toast(`Слотов создано: ${insertPayload.length}`);
      return;
    }
    this.render({ preserveView: true });
    this.ui.toast('Слот создан');
  }

  async updateBlock(block, data) {
    if (!this.state.space || !block) return;
    const payload = this.buildBlockPayload(data, block.category);
    if (!payload) return;

    const { error } = await this.client
      .from('ik_sched_blocks')
      .update({
        ...payload,
        updated_by: this.user.id
      })
      .eq('id', block.id)
      .eq('space_id', this.state.space.id);
    if (error) throw error;

    if (payload.item_id) {
      await this.client
        .from('ik_sched_items')
        .update({ status: 'scheduled', updated_by: this.user.id })
        .eq('id', payload.item_id)
        .eq('space_id', this.state.space.id)
        .in('status', ['pending', 'in_progress']);
    }

    this.ui.closeModal();
    await this.reloadAll();
    this.render({ preserveView: true });
    this.ui.toast('Слот сохранен');
  }

  findMatchingRecurringBusySeriesIds(block, futureOnly = true) {
    if (!block) return [];

    const baseStart = new Date(block.starts_at);
    const baseEnd = new Date(block.ends_at);
    if (!Number.isFinite(baseStart.getTime()) || !Number.isFinite(baseEnd.getTime()) || baseEnd <= baseStart) {
      return [];
    }

    if (block.item_id || !block.is_locked) return [];

    const baseTitle = String(block.title || '').trim().toLowerCase();
    const baseCategory = normalizeCategory(block.category);
    const baseSource = String(block.source || 'manual');
    const baseStartClock = toTimeText(baseStart);
    const baseEndClock = toTimeText(baseEnd);
    const fromEpoch = startOfDay(baseStart).getTime();

    return this.state.blocks
      .filter((candidate) => {
        if (!candidate || candidate.item_id || !candidate.is_locked) return false;
        if (!!candidate.is_locked !== !!block.is_locked) return false;
        if (normalizeCategory(candidate.category) !== baseCategory) return false;
        if (String(candidate.source || 'manual') !== baseSource) return false;
        if (String(candidate.title || '').trim().toLowerCase() !== baseTitle) return false;

        const s = new Date(candidate.starts_at);
        const e = new Date(candidate.ends_at);
        if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime()) || e <= s) return false;
        if (futureOnly && s.getTime() < fromEpoch) return false;
        if (toTimeText(s) !== baseStartClock || toTimeText(e) !== baseEndClock) return false;
        return true;
      })
      .map((candidate) => String(candidate.id));
  }

  openDeleteBlockModal(blockId) {
    const block = this.findBlock(blockId);
    if (!block) return;

    const seriesIds = this.findMatchingRecurringBusySeriesIds(block, true);
    const canDeleteSeries = seriesIds.length > 1;

    this.ui.openModal({
      title: 'Удалить слот',
      bodyHtml: `
        <form class="form">
          <div class="assistant-note">Удалить слот "${escapeHtml(String(block.title || ''))}"?</div>
          ${canDeleteSeries ? `<div class="assistant-note">Найдено повторов в серии: ${seriesIds.length}. Можно удалить только этот слот или всю серию.</div>` : ''}
          <div class="form__actions">
            <button class="btn" type="button" data-close>Отмена</button>
            ${canDeleteSeries ? `<button class="btn" type="button" data-delete-block-single="${escapeAttr(block.id)}">Удалить только этот</button>` : ''}
            <button class="btn btn--danger" type="submit">${canDeleteSeries ? `Удалить серию (${seriesIds.length})` : 'Удалить'}</button>
          </div>
        </form>
      `,
      onMount: (root) => {
        const singleBtn = root.querySelector('[data-delete-block-single]');
        if (singleBtn) {
          singleBtn.addEventListener('click', () => {
            this.ui.closeModal();
            void this.deleteBlock(block.id).catch((error) => this.onError(error));
          });
        }
      },
      onSubmit: () => {
        if (canDeleteSeries) {
          void this.deleteBlockSeries(block.id).catch((error) => this.onError(error));
          return;
        }
        void this.deleteBlock(block.id).catch((error) => this.onError(error));
      }
    });
  }

  async deleteBlockSeries(blockId) {
    const block = this.findBlock(blockId);
    if (!block || !this.state.space) return;

    const ids = this.findMatchingRecurringBusySeriesIds(block, true);
    if (!ids.length) return;
    if (ids.length === 1) {
      await this.deleteBlock(ids[0]);
      return;
    }

    const { error } = await this.client
      .from('ik_sched_blocks')
      .delete()
      .eq('space_id', this.state.space.id)
      .in('id', ids);

    if (error) throw error;

    this.ui.closeModal();
    await this.reloadAll();
    this.render({ preserveView: true });
    this.ui.toast(`Удалена серия слотов: ${ids.length}`);
  }

  async deleteBlock(blockId) {
    const { error } = await this.client
      .from('ik_sched_blocks')
      .delete()
      .eq('id', blockId)
      .eq('space_id', this.state.space.id);
    if (error) throw error;
    this.ui.closeModal();
    await this.reloadAll();
    this.render({ preserveView: true });
    this.ui.toast('Слот удален');
  }

  async moveBlockToTomorrow(blockId) {
    const block = this.findBlock(blockId);
    if (!block || !this.state.space) return;

    const start = addDays(new Date(block.starts_at), 1);
    const end = addDays(new Date(block.ends_at), 1);

    const { error } = await this.client
      .from('ik_sched_blocks')
      .update({
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        updated_by: this.user.id
      })
      .eq('id', block.id)
      .eq('space_id', this.state.space.id);
    if (error) throw error;

    await this.reloadAll();
    this.render({ preserveView: true });
    this.ui.toast('Слот перенесен на завтра');
  }

  async toggleBlockDone(blockId) {
    const block = this.findBlock(blockId);
    if (!block || !this.state.space) return;
    const nextStatus = String(block.status || '') === 'done' ? 'planned' : 'done';

    const { error } = await this.client
      .from('ik_sched_blocks')
      .update({ status: nextStatus, updated_by: this.user.id })
      .eq('id', block.id)
      .eq('space_id', this.state.space.id);
    if (error) throw error;

    if (block.item_id && nextStatus === 'done') {
      await this.client
        .from('ik_sched_items')
        .update({ status: 'done', updated_by: this.user.id })
        .eq('id', block.item_id)
        .eq('space_id', this.state.space.id)
        .neq('status', 'archived');
    }

    await this.reloadAll();
    this.render({ preserveView: true });
    this.ui.toast(nextStatus === 'done' ? 'Слот отмечен как выполненный' : 'Слот вернулся в план');
  }

  assistantWeekdaysFromData(data) {
    const out = [];
    for (let i = 0; i < 7; i += 1) {
      const v = data[`weekday_${i}`];
      if (v === 'on' || v === true || v === 'true' || v === '1' || v === 1) out.push(i);
    }
    return out;
  }

  buildAssistantInboxItemPayload(data, overrides = null) {
    const cfg = overrides || {};
    const notePrefix = String(cfg.note_prefix || '').trim();
    const baseNote = String(data.note || '').trim();
    const note = [notePrefix, baseNote].filter(Boolean).join(baseNote && notePrefix ? ' | ' : '');

    return this.buildItemPayload({
      ...data,
      item_type: 'task',
      desired_day: cfg.desired_day == null ? String(data.desired_day || '') : String(cfg.desired_day || ''),
      deadline_date: cfg.deadline_date == null ? String(data.deadline_date || '') : String(cfg.deadline_date || ''),
      deadline_time: cfg.deadline_time == null ? String(data.deadline_time || '') : String(cfg.deadline_time || ''),
      preferred_from: '',
      preferred_to: '',
      repeat_rule: 'none',
      repeat_until: '',
      notify_enabled: 'on',
      notify_offsets: '60, 15',
      flexibility: cfg.flexibility || data.flexibility || 'flexible',
      note
    });
  }

  async createAssistantInboxItem(data) {
    if (!this.state.space) return;

    const mode = normalizeAssistantPlanMode(data.plan_mode);
    const payloads = [];

    if (mode === 'deadline') {
      const payload = this.buildAssistantInboxItemPayload(data);
      if (!payload) return;
      payloads.push(payload);
    } else if (mode === 'day_flexible') {
      const desired = parseISODate(data.desired_day);
      if (!desired) {
        this.ui.toast('Укажи день для режима "на конкретный день"');
        return;
      }

      const dayKey = toISODate(desired);
      const payload = this.buildAssistantInboxItemPayload(data, {
        desired_day: dayKey,
        deadline_date: '',
        deadline_time: '',
        flexibility: 'fixed',
        note_prefix: `[плавающий график · день ${dayKey}]`
      });
      if (!payload) return;
      payloads.push(payload);
    } else {
      const weekdays = this.assistantWeekdaysFromData(data);
      if (!weekdays.length) {
        this.ui.toast('Выбери хотя бы один день недели');
        return;
      }

      const fromDate = parseISODate(data.from_date) || startOfDay(new Date());
      const untilDate = parseISODate(data.until_date) || addDays(fromDate, 56);
      if (startOfDay(untilDate) < startOfDay(fromDate)) {
        this.ui.toast('Дата окончания серии раньше даты старта');
        return;
      }

      const maxRows = 180;
      for (let day = new Date(fromDate); day <= untilDate && payloads.length < maxRows; day = addDays(day, 1)) {
        if (!weekdays.includes(day.getDay())) continue;

        const dayKey = toISODate(day);
        const weekday = WEEKDAY_SHORT_RU[day.getDay()] || '';
        const payload = this.buildAssistantInboxItemPayload(data, {
          desired_day: dayKey,
          deadline_date: '',
          deadline_time: '',
          flexibility: 'fixed',
          note_prefix: `[плавающий график · ${weekday} ${dayKey}]`
        });

        if (!payload) return;
        payloads.push(payload);
      }

      if (!payloads.length) {
        this.ui.toast('Нет дат для выбранных дней недели в указанном диапазоне');
        return;
      }
    }

    const rows = payloads.map((payload) => ({
      ...payload,
      space_id: this.state.space.id,
      status: 'pending',
      created_by: this.user.id,
      updated_by: this.user.id
    }));

    const { error } = await this.client.from('ik_sched_items').insert(rows);
    if (error) throw error;

    await this.reloadAll();
    this.render({ preserveView: true });

    if (mode === 'weekly_flexible') {
      if (rows.length >= 180) {
        this.ui.toast(`В inbox добавлено ${rows.length} планов (ограничение серии)`);
        return;
      }
      this.ui.toast(`В inbox добавлено ${rows.length} регулярных планов`);
      return;
    }

    if (mode === 'day_flexible') {
      this.ui.toast('План на выбранный день добавлен в inbox');
      return;
    }

    this.ui.toast('План добавлен в inbox');
  }

  async createRecurringBusyBlocks(data) {
    if (!this.state.space) return;

    const title = String(data.title || '').trim() || 'Занятость';
    const weekdayNum = Number.parseInt(String(data.weekday || '1'), 10);
    const weekday = Number.isInteger(weekdayNum) && weekdayNum >= 0 && weekdayNum <= 6 ? weekdayNum : 1;

    const fromDate = parseISODate(data.from_date) || startOfDay(new Date());
    const firstDate = firstWeekdayOnOrAfter(fromDate, weekday);
    const untilDate = parseISODate(data.until_date) || firstDate;

    if (startOfDay(untilDate) < startOfDay(firstDate)) {
      this.ui.toast('Дата окончания серии раньше даты старта');
      return;
    }

    const startTime = parseTimeText(data.start_time);
    const endTime = parseTimeText(data.end_time);
    if (!startTime || !endTime) {
      this.ui.toast('Укажи корректное время начала и конца');
      return;
    }

    const firstStart = composeDateTime(toISODate(firstDate), data.start_time, startTime.hh, startTime.mm);
    const firstEnd = composeDateTime(toISODate(firstDate), data.end_time, endTime.hh, endTime.mm);
    if (!firstStart || !firstEnd || firstEnd <= firstStart) {
      this.ui.toast('Проверь время: конец должен быть позже начала');
      return;
    }

    const durationMs = firstEnd.getTime() - firstStart.getTime();
    const category = normalizeCategory(data.category);

    const rows = [];
    const maxRows = 260;
    for (let cursor = new Date(firstDate); cursor <= untilDate && rows.length < maxRows; cursor = addDays(cursor, 7)) {
      const start = composeDateTime(toISODate(cursor), data.start_time, startTime.hh, startTime.mm);
      if (!start) continue;
      const end = new Date(start.getTime() + durationMs);
      rows.push({
        space_id: this.state.space.id,
        item_id: null,
        suggestion_id: null,
        title,
        category,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        status: 'planned',
        is_locked: true,
        source: 'manual',
        created_by: this.user.id,
        updated_by: this.user.id
      });
    }

    if (!rows.length) {
      this.ui.toast('Не удалось построить серию');
      return;
    }

    const { error } = await this.client.from('ik_sched_blocks').insert(rows);
    if (error) throw error;

    await this.reloadAll();
    this.render({ preserveView: true });
    if (rows.length === 1) {
      this.ui.toast('Добавлен 1 слот регулярной занятости');
      return;
    }
    if (rows.length === maxRows) {
      this.ui.toast(`Добавлено ${rows.length} слотов (ограничение серии)`);
      return;
    }
    this.ui.toast(`Добавлено регулярных слотов: ${rows.length} (до ${toISODate(untilDate)}). Они видны ниже в "Ближайшие занятости".`);
  }

  workingWindowFromPrefs() {
    const assistantDefaults = parseJsonMaybe(this.state.prefs && this.state.prefs.assistant_defaults, {});
    const startTxt = parseTimeText(assistantDefaults.day_start) ? assistantDefaults.day_start : '08:00';
    const endTxt = parseTimeText(assistantDefaults.day_end) ? assistantDefaults.day_end : '22:00';
    const start = parseTimeText(startTxt);
    const end = parseTimeText(endTxt);
    return {
      start: start ? `${pad2(start.hh)}:${pad2(start.mm)}` : '08:00',
      end: end ? `${pad2(end.hh)}:${pad2(end.mm)}` : '22:00'
    };
  }

  periodWindowsForDay(baseDate, period, dayStartTxt, dayEndTxt) {
    const windows = [];
    const dayStart = composeDateTime(toISODate(baseDate), dayStartTxt, 8, 0);
    const dayEnd = composeDateTime(toISODate(baseDate), dayEndTxt, 22, 0);
    if (!dayStart || !dayEnd || dayEnd <= dayStart) return windows;

    const mk = (startTxt, endTxt) => {
      const s = composeDateTime(toISODate(baseDate), startTxt, 8, 0);
      const e = composeDateTime(toISODate(baseDate), endTxt, 12, 0);
      if (!s || !e || e <= s) return;
      const from = s < dayStart ? dayStart : s;
      const to = e > dayEnd ? dayEnd : e;
      if (to > from) windows.push([from, to]);
    };

    const p = normalizePeriod(period);
    if (p === 'morning') mk('07:00', '12:00');
    else if (p === 'afternoon') mk('12:00', '17:00');
    else if (p === 'evening') mk('17:00', '22:30');
    else if (p === 'night') mk('20:00', '23:30');
    else {
      mk(dayStartTxt, dayEndTxt);
      mk('07:30', '11:30');
      mk('12:00', '16:30');
      mk('17:00', '21:30');
    }

    if (!windows.length) windows.push([dayStart, dayEnd]);

    windows.sort((a, b) => a[0].getTime() - b[0].getTime());
    return windows;
  }

  buildOccupancyMap(includePendingSuggestions = true) {
    const map = new Map();

    const push = (startIso, endIso) => {
      const s = new Date(startIso);
      const e = new Date(endIso);
      if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime()) || e <= s) return;
      const dayKey = toISODate(s);
      if (!map.has(dayKey)) map.set(dayKey, []);
      map.get(dayKey).push([s, e]);
    };

    this.state.blocks.forEach((block) => {
      if (String(block.status || '') === 'cancelled') return;
      push(block.starts_at, block.ends_at);
    });

    if (includePendingSuggestions) {
      this.pendingSuggestions().forEach((s) => {
        push(s.suggested_start_at, s.suggested_end_at);
      });
    }

    for (const [key, rows] of map.entries()) {
      rows.sort((a, b) => a[0].getTime() - b[0].getTime());
      map.set(key, rows);
    }

    return map;
  }

  freeSlotInWindows(day, windows, occupancy, durationMinutes) {
    const dayKey = toISODate(day);
    const rows = occupancy.get(dayKey) || [];

    for (const [wStart, wEnd] of windows) {
      let cursor = new Date(wStart.getTime());
      const limit = wEnd.getTime();

      while (cursor.getTime() + durationMinutes * 60000 <= limit) {
        const end = addMinutes(cursor, durationMinutes);
        const hasConflict = rows.some(([busyStart, busyEnd]) => isOverlap(cursor.getTime(), end.getTime(), busyStart.getTime(), busyEnd.getTime()));
        if (!hasConflict) {
          return [new Date(cursor.getTime()), end];
        }
        cursor = addMinutes(cursor, 30);
      }
    }

    return null;
  }

  reasonForSuggestion(item, chunkIndex, chunkTotal, deadlineDate) {
    const lines = [];
    if (item.desired_day) {
      lines.push(`привязка к дню ${item.desired_day}: подобрано точное время в пределах дня`);
    }
    if (deadlineDate) {
      const days = dayDiff(new Date(), deadlineDate);
      if (days <= 2) lines.push('очень близкий дедлайн: вынесено в ближайшие свободные слоты');
      else if (days <= 7) lines.push('дедлайн в пределах недели: добавлен стабильный прогресс');
      else if (days <= 30) lines.push('дедлайн в пределах месяца: равномерное распределение');
      else lines.push('дедлайн далекий: мягкое планирование без перегруза');
    } else {
      lines.push('без дедлайна: мягкое распределение по свободным окнам');
    }

    if (chunkTotal > 1) lines.push(`задача разбита на части (${chunkIndex}/${chunkTotal})`);
    if (item.is_required) lines.push('обязательная задача получила приоритетный слот');
    return lines.join(' · ');
  }

  async runAssistant(rawData) {
    if (!this.state.space) return;

    const mode = normalizeMode(rawData.mode);
    const horizonDays = clamp(Number.parseInt(String(rawData.horizon_days || '30'), 10) || 30, 3, 180);

    const candidates = this.unscheduledItems();
    if (!candidates.length) {
      this.ui.toast('Нет задач для автоматического распределения');
      return;
    }

    const now = startOfDay(new Date());
    const windowPrefs = this.workingWindowFromPrefs();
    const occupancy = this.buildOccupancyMap(true);
    const warnings = [];

    const sorted = candidates
      .slice()
      .sort((a, b) => urgencyScore(b, now, horizonDays) - urgencyScore(a, now, horizonDays));

    const { data: runRow, error: runError } = await this.client
      .from('ik_sched_assistant_runs')
      .insert({
        space_id: this.state.space.id,
        requested_by: this.user.id,
        mode,
        horizon_days: horizonDays,
        status: 'completed',
        summary: {}
      })
      .select('*')
      .single();
    if (runError) throw runError;

    const runId = String(runRow.id);
    const suggestions = [];

    for (const item of sorted) {
      const estimate = clamp(Number(item.estimated_minutes || 60), 15, 720);
      const chunkSize = estimate <= 90 ? estimate : (estimate <= 240 ? 90 : 60);
      const totalChunks = Math.max(1, Math.ceil(estimate / chunkSize));

      const deadlineDate = item.deadline_at ? new Date(item.deadline_at) : null;
      const horizonEnd = addDays(now, horizonDays);
      const searchEnd = deadlineDate && deadlineDate < horizonEnd ? deadlineDate : horizonEnd;

      let failed = false;
      for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx += 1) {
        let placed = null;

        const desiredDay = item.desired_day ? parseISODate(item.desired_day) : null;
        const strictDesiredDay = !!desiredDay && normalizeFlexibility(item.flexibility) === 'fixed';

        if (desiredDay) {
          const windows = this.periodWindowsForDay(desiredDay, item.preferred_period, windowPrefs.start, windowPrefs.end);
          placed = this.freeSlotInWindows(desiredDay, windows, occupancy, chunkSize);

          if (!placed && strictDesiredDay) {
            failed = true;
            warnings.push(`Нет окна в выбранный день ${item.desired_day}: ${item.title}`);
            break;
          }
        }

        if (!placed) {
          let dayCursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          while (dayCursor <= searchEnd) {
            const windows = this.periodWindowsForDay(dayCursor, item.preferred_period, windowPrefs.start, windowPrefs.end);
            placed = this.freeSlotInWindows(dayCursor, windows, occupancy, chunkSize);
            if (placed) break;
            dayCursor = addDays(dayCursor, 1);
          }
        }

        if (!placed) {
          failed = true;
          warnings.push(`Не хватило окон: ${item.title}`);
          break;
        }

        const [start, end] = placed;
        const dayKey = toISODate(start);
        if (!occupancy.has(dayKey)) occupancy.set(dayKey, []);
        occupancy.get(dayKey).push([start, end]);

        suggestions.push({
          run_id: runId,
          space_id: this.state.space.id,
          item_id: item.id,
          chunk_index: chunkIdx + 1,
          chunk_total: totalChunks,
          suggested_start_at: start.toISOString(),
          suggested_end_at: end.toISOString(),
          score: urgencyScore(item, now, horizonDays),
          reason: this.reasonForSuggestion(item, chunkIdx + 1, totalChunks, deadlineDate),
          status: 'pending'
        });
      }

      if (failed && deadlineDate && dayDiff(now, deadlineDate) <= 3) {
        warnings.push(`Критично: "${item.title}" может не успеть к дедлайну`);
      }
    }

    if (suggestions.length) {
      const { error: insertError } = await this.client.from('ik_sched_assistant_suggestions').insert(suggestions);
      if (insertError) throw insertError;
    }

    const summary = {
      generated: suggestions.length,
      items_considered: sorted.length,
      warnings
    };

    const { error: runUpdateError } = await this.client
      .from('ik_sched_assistant_runs')
      .update({
        completed_at: new Date().toISOString(),
        summary
      })
      .eq('id', runId)
      .eq('space_id', this.state.space.id);
    if (runUpdateError) throw runUpdateError;

    await this.reloadAll();
    this.render({ preserveView: true });
    this.ui.toast(`Помощник создал предложений: ${suggestions.length}`);
    if (warnings.length) this.ui.toast(`Есть предупреждения: ${warnings.length}`);
  }

  async acceptSuggestion(suggestionId, edited = null) {
    const suggestion = this.findSuggestion(suggestionId);
    if (!suggestion || String(suggestion.status || '') !== 'pending') return;
    if (!this.state.space) return;

    const start = edited && edited.start ? edited.start : new Date(suggestion.suggested_start_at);
    const end = edited && edited.end ? edited.end : new Date(suggestion.suggested_end_at);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      this.ui.toast('Некорректное время предложения');
      return;
    }

    const item = this.findItem(suggestion.item_id);
    const payload = {
      space_id: this.state.space.id,
      item_id: suggestion.item_id,
      title: item ? item.title : 'Слот',
      category: normalizeCategory(item && item.category),
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      status: 'planned',
      is_locked: normalizeFlexibility(item && item.flexibility) === 'fixed',
      source: 'assistant',
      suggestion_id: suggestion.id,
      created_by: this.user.id,
      updated_by: this.user.id
    };

    const { data: blockRows, error: blockError } = await this.client
      .from('ik_sched_blocks')
      .insert(payload)
      .select('id')
      .limit(1);
    if (blockError) throw blockError;

    const block = asArray(blockRows)[0] || null;
    const suggestionStatus = edited ? 'accepted_edited' : 'accepted';

    const { error: suggestError } = await this.client
      .from('ik_sched_assistant_suggestions')
      .update({
        status: suggestionStatus,
        applied_block_id: block ? block.id : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', suggestion.id)
      .eq('space_id', this.state.space.id);
    if (suggestError) throw suggestError;

    if (item) {
      await this.client
        .from('ik_sched_items')
        .update({ status: 'scheduled', updated_by: this.user.id })
        .eq('id', item.id)
        .eq('space_id', this.state.space.id)
        .in('status', ['pending', 'in_progress']);
    }

    await this.reloadAll();
    this.render({ preserveView: true });
    this.ui.toast('Предложение применено');
  }

  async rejectSuggestion(suggestionId) {
    const suggestion = this.findSuggestion(suggestionId);
    if (!suggestion || String(suggestion.status || '') !== 'pending' || !this.state.space) return;

    const { error } = await this.client
      .from('ik_sched_assistant_suggestions')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', suggestion.id)
      .eq('space_id', this.state.space.id);
    if (error) throw error;

    await this.reloadAll();
    this.render({ preserveView: true });
    this.ui.toast('Предложение отклонено');
  }

  openAdjustSuggestionModal(suggestionId) {
    const suggestion = this.findSuggestion(suggestionId);
    if (!suggestion) return;
    const start = new Date(suggestion.suggested_start_at);
    const end = new Date(suggestion.suggested_end_at);

    this.ui.openModal({
      title: 'Изменить предложение',
      bodyHtml: `
        <form class="form">
          <label class="field">Начало
            <input class="ctl" type="datetime-local" name="start_at" value="${escapeAttr(formatDateTimeLocal(start))}" required />
          </label>
          <label class="field">Конец
            <input class="ctl" type="datetime-local" name="end_at" value="${escapeAttr(formatDateTimeLocal(end))}" required />
          </label>
          <div class="form__actions">
            <button class="btn" type="button" data-close>Отмена</button>
            <button class="btn" type="submit">Применить</button>
          </div>
        </form>
      `,
      onSubmit: (data) => {
        const s = parseDateTimeLocal(data.start_at);
        const e = parseDateTimeLocal(data.end_at);
        if (!s || !e || e <= s) {
          this.ui.toast('Проверь время');
          return;
        }
        this.ui.closeModal();
        void this.acceptSuggestion(suggestion.id, { start: s, end: e }).catch((error) => this.onError(error));
      }
    });
  }

  async saveSettings(data) {
    if (!this.state.space || !this.state.prefs) return;

    const mode = CALENDAR_MODES.includes(String(data.view_mode || '').toLowerCase()) ? String(data.view_mode).toLowerCase() : 'month';
    const horizon = clamp(Number.parseInt(String(data.assistant_horizon || '30'), 10) || 30, 3, 180);
    const dayStart = parseTimeText(data.day_start) ? String(data.day_start) : '08:00';
    const dayEnd = parseTimeText(data.day_end) ? String(data.day_end) : '22:00';
    const notifyOffsets = parseOffsets(data.notify_offsets);
    const assistantMode = normalizeMode(data.assistant_mode);

    const payload = {
      user_id: this.user.id,
      default_space_id: this.state.space.id,
      notification_defaults: {
        enabled: data.notifications_enabled === 'on' || data.notifications_enabled === true,
        offsets: notifyOffsets.length ? notifyOffsets : [60, 15]
      },
      assistant_defaults: {
        mode: assistantMode,
        horizon_days: horizon,
        day_start: dayStart,
        day_end: dayEnd
      },
      view_defaults: {
        mode
      },
      updated_at: new Date().toISOString()
    };

    const { error } = await this.client
      .from('ik_sched_prefs')
      .upsert(payload, { onConflict: 'user_id' });
    if (error) throw error;

    this.state.prefs = payload;
    this.state.calendarMode = mode;
    this.render({ preserveView: true });
    this.ui.toast('Настройки сохранены');
  }
}

const app = new ScheduleApp();
app.init().catch((error) => {
  const txt = String((error && (error.message || error.details || error.hint || error.code)) || error || 'unknown');
  console.error(error);
  const target = document.getElementById('scheduleContent');
  if (target) {
    target.innerHTML = `<div class="empty-note">schedule boot failed: ${escapeHtml(txt)}</div>`;
  }
});
