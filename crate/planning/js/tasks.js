const PRIORITIES = [
  { key: "low", label: "low" },
  { key: "mid", label: "mid" },
  { key: "high", label: "high" },
];

function uid(){
  if (globalThis.crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

function parseTags(raw){
  return String(raw ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function parseFilterTags(raw){
  return String(raw ?? "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
}

function pad2(n){ return String(n).padStart(2, "0"); }
function formatLocalISO(d){
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}
function parseISOToLocalDate(iso){
  const s = String(iso ?? "").trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y,m,day] = s.split("-").map(Number);
  return new Date(y, (m||1)-1, day||1);
}
function addDaysLocal(d, days){
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + Number(days||0));
  return x;
}

export class Tasks {
  constructor(store, ui) {
    this.store = store;
    this.ui = ui;
    this.search = "";
    this.filters = {
      tags: "",
      priority: "all",
      deadline: "all",
      sort: "default",
    };
    this.boardEl = null;

    document.addEventListener("planning:projectChanged", () => {
      if (this.boardEl) this.renderBoard(this.boardEl);
    });
  }

  setSearch(q) {
    this.search = String(q ?? "").trim().toLowerCase();
  }

  setFilters(partial){
    const p = partial && typeof partial === "object" ? partial : {};
    this.filters = {
      ...this.filters,
      tags: typeof p.tags === "string" ? p.tags : this.filters.tags,
      priority: typeof p.priority === "string" ? p.priority : this.filters.priority,
      deadline: typeof p.deadline === "string" ? p.deadline : this.filters.deadline,
      sort: typeof p.sort === "string" ? p.sort : this.filters.sort,
    };
  }

  openCreateModal() {
    const state = this.store.getState();
    const pid = state.activeProjectId;
    if (!pid) {
      this.ui.toast("select project");
      return;
    }

    const project = state.projects.find(p => p.id === pid);
    const cols = (project?.columns || []).slice().sort((a,b)=>(a.order??0)-(b.order??0));
    const firstColId = cols[0]?.id;
    if(!firstColId){
      this.ui.toast("no columns");
      return;
    }

    this.ui.openModal({
      title: "new task",
      bodyHtml: `
        <form class="form">
          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            name
            <input class="ctl" name="name" required maxlength="48" />
          </label>

          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            description
            <textarea class="ctl" name="desc" rows="4" maxlength="280"></textarea>
          </label>

          <div class="form__grid2">
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              deadline
              <input class="ctl" name="deadline" type="date" />
            </label>

            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              priority
              <select class="ctl" name="priority">
                ${PRIORITIES.map(p => `<option value="${p.key}">${p.label.toUpperCase()}</option>`).join("")}
              </select>
            </label>
          </div>

          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            tags (comma)
            <input class="ctl" name="tags" placeholder="study, work, exam" maxlength="80" />
          </label>

          <div class="form__actions">
            <button class="btn" type="button" data-close>cancel</button>
            <button class="btn" type="submit">create</button>
          </div>
        </form>
      `,
      onSubmit: (data) => {
        const name = String(data.name ?? "").trim();
        if (!name) return;

        const task = {
          id: uid(),
          projectId: pid,
          columnId: firstColId,
          name,
          desc: String(data.desc ?? "").trim(),
          priority: String(data.priority ?? "mid"),
          deadline: String(data.deadline ?? ""),
          tags: parseTags(data.tags),
          createdAt: Date.now(),
        };

        this.store.patch((s) => s.tasks.push(task));

        document.dispatchEvent(new CustomEvent("planning:tasksChanged"));
        this.ui.closeModal();
        this.ui.toast("task created");
        if (this.boardEl) this.renderBoard(this.boardEl);
      }
    });
  }

  renderBoard(boardEl) {
    this.boardEl = boardEl;

    const state = this.store.getState();
    const pid = state.activeProjectId;
    const project = state.projects.find(p => p.id === pid);
    const cols = (project?.columns || []).slice().sort((a,b)=>(a.order??0)-(b.order??0));

    const all = state.tasks.filter(t => t.projectId === pid);

    const colById = new Map(cols.map(c => [c.id, c]));

    // precompute date boundaries (local)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayISO = formatLocalISO(today);
    const weekEnd = addDaysLocal(today, 7);
    const weekEndTime = weekEnd.getTime();

    const f = this.filters || {};
    const q = this.search;
    const wantTags = parseFilterTags(f.tags);
    const wantPriority = String(f.priority || "all");
    const wantDeadline = String(f.deadline || "all");

    const filtered = all.filter(t => {
      // search (name/desc/tags)
      if(q){
        const hay = `${t.name} ${t.desc} ${(t.tags || []).join(" ")}`.toLowerCase();
        if(!hay.includes(q)) return false;
      }

      // tags (AND: every tag must exist in task tags)
      if(wantTags.length){
        const taskTags = (t.tags || []).map(x => String(x).toLowerCase());
        for(const tag of wantTags){
          if(!taskTags.includes(tag)) return false;
        }
      }

      // priority
      if(wantPriority !== "all"){
        if(String(t.priority || "").toLowerCase() !== wantPriority) return false;
      }

      // deadline filters
      if(wantDeadline !== "all"){
        const d = parseISOToLocalDate(t.deadline);
        if(!d) return false;

        const time = d.getTime();
        const isDone = colById.get(t.columnId)?.role === "done";

        if(wantDeadline === "today"){
          if(formatLocalISO(d) !== todayISO) return false;
        }
        if(wantDeadline === "overdue"){
          // overdue means: deadline < today AND not in done column
          if(isDone) return false;
          if(time >= today.getTime()) return false;
        }
        if(wantDeadline === "week"){
          if(time < today.getTime() || time > weekEndTime) return false;
        }
      }

      return true;
    });

    boardEl.innerHTML = "";
    boardEl.hidden = false;

    if(!cols.length){
      boardEl.innerHTML = `
        <div style="font-size:11px; letter-spacing:3px; text-transform:uppercase; opacity:.65;">
          no columns
        </div>`;
      return;
    }

    const sortMode = String(f.sort || "default");
    const priorityRank = { high: 3, mid: 2, low: 1 };
    const sortBy = (a, b) => {
      if(sortMode === "newest"){
        return (b.createdAt || 0) - (a.createdAt || 0);
      }

      const ad = a.deadline ? String(a.deadline) : "";
      const bd = b.deadline ? String(b.deadline) : "";
      const aHasD = Boolean(ad);
      const bHasD = Boolean(bd);

      if(sortMode === "priority"){
        const ap = priorityRank[String(a.priority||"").toLowerCase()] || 0;
        const bp = priorityRank[String(b.priority||"").toLowerCase()] || 0;
        if(bp !== ap) return bp - ap;
        // tie-breaker: earliest deadline first, then newest
        if(aHasD !== bHasD) return aHasD ? -1 : 1;
        const dcmp = ad.localeCompare(bd);
        if(dcmp) return dcmp;
        return (b.createdAt || 0) - (a.createdAt || 0);
      }

      if(sortMode === "deadline" || sortMode === "default"){
        // tasks without deadline go last
        if(aHasD !== bHasD) return aHasD ? -1 : 1;
        const dcmp = ad.localeCompare(bd);
        if(dcmp) return dcmp;
        return (b.createdAt || 0) - (a.createdAt || 0);
      }

      // fallback: newest
      return (b.createdAt || 0) - (a.createdAt || 0);
    };

    for (const col of cols) {
      const colEl = document.createElement("section");
      colEl.className = "column";
      colEl.dataset.colId = col.id;

      const items = filtered
        .filter(t => t.columnId === col.id)
        .sort(sortBy);

      colEl.innerHTML = `
        <div class="column__head">
          <div class="column__title">
            <span class="col-dot" style="--c:${escapeAttr(col.color || "#111111")}"></span>
            ${escapeHtml(col.name)}
          </div>
          <div class="column__count">${items.length}</div>
        </div>
        <div class="column__dropzone" data-dropzone></div>
      `;

      const zone = colEl.querySelector("[data-dropzone]");
      zone.addEventListener("dragover", (e) => e.preventDefault());
      zone.addEventListener("drop", (e) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData("text/taskId");
        if (!taskId) return;
        this.moveTask(taskId, col.id);
      });

      for (const task of items) zone.appendChild(this.renderCard(task, project));
      boardEl.appendChild(colEl);
    }
  }

  renderCard(task, project) {
    const el = document.createElement("article");
    const col = project?.columns?.find(c => c.id === task.columnId);
    const accent = col?.color || "#111111";
    const isDone = col?.role === "done";

    el.className = "card" + (isDone ? " card--done" : "");
    el.style.setProperty("--accent", accent);

    el.draggable = true;
    el.dataset.id = task.id;

    const metaParts = [];
    if (task.priority) metaParts.push(`priority: ${task.priority}`);
    if (task.deadline) metaParts.push(`deadline: ${task.deadline}`);
    if (task.tags?.length) metaParts.push(`tags: ${task.tags.join(" · ")}`);

    el.innerHTML = `
      <h3 class="card__name">${escapeHtml(task.name)}</h3>
      <p class="card__meta">${escapeHtml(metaParts.join(" • ") || "—")}</p>
      <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:2px;">
        <button class="btn" type="button" data-act="open">open</button>
        <button class="btn" type="button" data-act="del">delete</button>
      </div>
    `;

    el.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/taskId", task.id);
      e.dataTransfer.effectAllowed = "move";
    });

    el.querySelector('[data-act="open"]').addEventListener("click", () => this.openTask(task.id));
    el.querySelector('[data-act="del"]').addEventListener("click", () => this.deleteTask(task.id));
    return el;
  }

  openTask(taskId) {
    const state = this.store.getState();
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const project = state.projects.find(p => p.id === task.projectId);
    const cols = (project?.columns || []).slice().sort((a,b)=>(a.order??0)-(b.order??0));
    const colOptions = cols.map(c =>
      `<option value="${escapeAttr(c.id)}" ${c.id===task.columnId ? "selected" : ""}>${escapeHtml(String(c.name).toUpperCase())}</option>`
    ).join("");

    const projectOptions = state.projects.map(p => `
      <option value="${escapeAttr(p.id)}" ${p.id===task.projectId ? "selected":""}>${escapeHtml(String(p.name ?? "").toUpperCase())}</option>
    `).join("");

    this.ui.openModal({
      title: "task",
      bodyHtml: `
        <form class="form">
          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            name
            <input class="ctl" name="name" required maxlength="48" value="${escapeAttr(task.name)}" />
          </label>

          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            description
            <textarea class="ctl" name="desc" rows="5" maxlength="280">${escapeHtml(task.desc || "")}</textarea>
          </label>

          <div class="form__grid2">
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              project
              <select class="ctl" name="projectId">
                ${projectOptions}
              </select>
            </label>

            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              column
              <select class="ctl" name="columnId">
                ${colOptions || ""}
              </select>
            </label>
          </div>

          <div class="form__grid2">
            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              priority
              <select class="ctl" name="priority">
                ${PRIORITIES.map(p => `<option value="${p.key}" ${p.key===task.priority?"selected":""}>${p.label.toUpperCase()}</option>`).join("")}
              </select>
            </label>

            <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
              deadline
              <input class="ctl" name="deadline" type="date" value="${escapeAttr(task.deadline || "")}" />
            </label>
          </div>

          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            tags (comma)
            <input class="ctl" name="tags" maxlength="80" value="${escapeAttr((task.tags||[]).join(", "))}" />
          </label>

          <div class="form__actions">
            <button class="btn" type="button" data-close>close</button>
            <button class="btn" type="submit">save</button>
          </div>
        </form>
      `,
      onSubmit: (data) => {
        const name = String(data.name ?? "").trim();
        if (!name) return;

        const newProjectId = String(data.projectId ?? task.projectId);
        const tags = parseTags(data.tags);

        this.store.patch((s) => {
          const t = s.tasks.find(x => x.id === taskId);
          if (!t) return;

          // apply base fields
          t.name = name;
          t.desc = String(data.desc ?? "").trim();
          t.priority = String(data.priority ?? "mid");
          t.deadline = String(data.deadline ?? "");
          t.tags = tags;

          const prevProjectId = t.projectId;
          t.projectId = newProjectId;

          // if project changed -> put into first column of target project
          if(prevProjectId !== newProjectId){
            const proj = s.projects.find(p => p.id === newProjectId);
            const cols2 = (proj?.columns || []).slice().sort((a,b)=>(a.order??0)-(b.order??0));
            t.columnId = cols2[0]?.id || t.columnId;
          } else {
            // same project -> allow changing column
            const newColId = String(data.columnId ?? t.columnId);
            t.columnId = newColId || t.columnId;
          }
        });

        document.dispatchEvent(new CustomEvent("planning:tasksChanged"));
        this.ui.closeModal();
        this.ui.toast("task saved");
        if (this.boardEl) this.renderBoard(this.boardEl);
      }
    });
  }

  deleteTask(taskId) {
    this.ui.openModal({
      title: "delete task",
      bodyHtml: `
        <form class="form">
          <div style="font-size:11px; letter-spacing:2px; text-transform:uppercase; color:rgba(0,0,0,.75); line-height:1.5;">
            confirm deletion. this action cannot be undone.
          </div>
          <div class="form__actions">
            <button class="btn" type="button" data-close>cancel</button>
            <button class="btn" type="submit">delete</button>
          </div>
        </form>
      `,
      onSubmit: () => {
        this.store.patch((s) => { s.tasks = s.tasks.filter(t => t.id !== taskId); });

        document.dispatchEvent(new CustomEvent("planning:tasksChanged"));
        this.ui.closeModal();
        this.ui.toast("task deleted");
        if (this.boardEl) this.renderBoard(this.boardEl);
      }
    });
  }

  moveTask(taskId, newColumnId) {
    this.store.patch((s) => {
      const t = s.tasks.find(x => x.id === taskId);
      if (!t) return;
      t.columnId = newColumnId;
    });

    document.dispatchEvent(new CustomEvent("planning:tasksChanged"));
    this.ui.toast("moved");
    if (this.boardEl) this.renderBoard(this.boardEl);
  }

  // drag task onto project-chip
  moveTaskToProject(taskId, projectId) {
    const pid = String(projectId || "");
    if (!pid) return;

    this.store.patch((s) => {
      const t = s.tasks.find(x => x.id === taskId);
      if (!t) return;

      const prev = t.projectId;
      t.projectId = pid;

      const proj = s.projects.find(p => p.id === pid);
      const cols = (proj?.columns || []).slice().sort((a,b)=>(a.order??0)-(b.order??0));
      const firstColId = cols[0]?.id;

      if(prev !== pid && firstColId){
        t.columnId = firstColId;
      } else if(!t.columnId && firstColId){
        t.columnId = firstColId;
      }
    });

    document.dispatchEvent(new CustomEvent("planning:tasksChanged"));
    this.ui.toast("moved to project");
    if (this.boardEl) this.renderBoard(this.boardEl);
  }
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function escapeAttr(str) {
  return escapeHtml(str).replaceAll("\n", " ");
}
