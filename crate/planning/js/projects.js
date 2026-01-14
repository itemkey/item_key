function uid(){
  if (globalThis.crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

function defaultColumns(){
  return [
    { id: uid(), name: "backlog",     role: "todo",  color: "#111111", order: 0 },
    { id: uid(), name: "in progress", role: "doing", color: "#AA5F00", order: 1 },
    { id: uid(), name: "review",      role: "doing", color: "#005AAA", order: 2 },
    { id: uid(), name: "done",        role: "done",  color: "#008C46", order: 3 },
  ];
}

export class Projects {
  constructor(store, ui) {
    this.store = store;
    this.ui = ui;
    this.selectEl = null;
  }

  mount(selectEl) {
    this.selectEl = selectEl;
    this.renderSelect();

    this.selectEl.addEventListener("change", () => {
      const id = this.selectEl.value;
      this.store.patch((s) => (s.activeProjectId = id));
      document.dispatchEvent(new CustomEvent("planning:projectChanged", { detail: { id } }));
    });
  }

  renderSelect() {
    const state = this.store.getState();
    const { projects, activeProjectId } = state;

    this.selectEl.innerHTML = "";
    for (const p of projects) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = String(p.name ?? "").toUpperCase();
      if (p.id === activeProjectId) opt.selected = true;
      this.selectEl.appendChild(opt);
    }
  }

  openCreateModal() {
    this.ui.openModal({
      title: "new project",
      bodyHtml: `
        <form class="form">
          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            name
            <input class="ctl" name="name" required maxlength="32" />
          </label>

          <label style="display:grid; gap:6px; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
            description
            <textarea class="ctl" name="desc" rows="3" maxlength="120"></textarea>
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

        const id = uid();
        this.store.patch((s) => {
          s.projects.push({
            id,
            name,
            desc: String(data.desc ?? "").trim(),
            columns: defaultColumns(),
            createdAt: Date.now()
          });
          s.activeProjectId = id;
        });

        this.renderSelect();
        this.ui.closeModal();
        this.ui.toast("project created");
        document.dispatchEvent(new CustomEvent("planning:projectChanged", { detail: { id } }));
        document.dispatchEvent(new CustomEvent("planning:tasksChanged"));
      },
    });
  }

  openDeleteModal(projectId){
    const state = this.store.getState();
    const pid = String(projectId ?? state.activeProjectId ?? "");
    if(!pid){
      this.ui.toast("select project");
      return;
    }

    const project = state.projects.find(p => p.id === pid);
    if(!project){
      this.ui.toast("project not found");
      return;
    }

    const tasksCount = state.tasks.filter(t => t.projectId === pid).length;

    this.ui.openModal({
      title: "delete project",
      bodyHtml: `
        <form class="form">
          <div style="font-size:11px; letter-spacing:2px; text-transform:uppercase; color:rgba(0,0,0,.75); line-height:1.5;">
            confirm deletion. tasks inside will be deleted too.
          </div>

          <div style="margin-top:8px; font-size:12px; opacity:.85;">
            ${escapeHtml(String(project.name ?? "").toUpperCase())}
            <span style="opacity:.6;">• tasks: ${tasksCount}</span>
          </div>

          <div class="form__actions">
            <button class="btn" type="button" data-close>cancel</button>
            <button class="btn" type="submit">delete</button>
          </div>
        </form>
      `,
      onSubmit: () => {
        let nextActiveId = null;

        this.store.patch((s) => {
          s.projects = s.projects.filter(p => p.id !== pid);
          s.tasks = s.tasks.filter(t => t.projectId !== pid);

          if(s.activeProjectId === pid){
            nextActiveId = s.projects[0]?.id ?? null;

            if(!nextActiveId){
              const id = uid();
              s.projects.push({ id, name: "default", desc: "auto created", columns: defaultColumns(), createdAt: Date.now() });
              nextActiveId = id;
            }

            s.activeProjectId = nextActiveId;
          } else {
            nextActiveId = s.activeProjectId;
          }
        });

        this.renderSelect();
        this.ui.closeModal();
        this.ui.toast("project deleted");

        document.dispatchEvent(new CustomEvent("planning:tasksChanged"));
        document.dispatchEvent(new CustomEvent("planning:projectChanged", { detail: { id: nextActiveId } }));
      }
    });
  }

  openColumnsModal(projectId){
    const state = this.store.getState();
    const pid = String(projectId ?? state.activeProjectId ?? "");
    if(!pid){
      this.ui.toast("select project");
      return;
    }

    const project = state.projects.find(p => p.id === pid);
    if(!project){
      this.ui.toast("project not found");
      return;
    }

    const cols = (project.columns || []).slice().sort((a,b)=>(a.order??0)-(b.order??0));

    const rowsHtml = cols.map(c => `
      <div class="cols-row" data-col-row data-id="${escapeAttr(c.id)}">
        <input class="ctl cols-name" name="col_name_${escapeAttr(c.id)}" value="${escapeAttr(c.name)}" maxlength="24" />
        <input class="ctl cols-color" type="color" name="col_color_${escapeAttr(c.id)}" value="${escapeAttr(c.color || "#111111")}" />
        <label class="cols-done">
          <input type="radio" name="doneCol" value="${escapeAttr(c.id)}" ${c.role==="done" ? "checked" : ""} />
          done
        </label>
        <div class="cols-actions">
          <button class="btn cols-up" type="button" data-up>↑</button>
          <button class="btn cols-down" type="button" data-down>↓</button>
          <button class="btn cols-del" type="button" data-del>×</button>
        </div>
      </div>
    `).join("");

    this.ui.openModal({
      title: "columns",
      bodyHtml: `
        <form class="form" data-cols-form>
          <div style="font-size:11px; letter-spacing:2px; text-transform:uppercase; opacity:.75;">
            manage columns for project
          </div>

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
        // Read rows from DOM (source of truth)
        const list = form.querySelector("[data-cols-list]");
        const rows = Array.from(list.querySelectorAll("[data-col-row]"));

        const next = [];
        for(let i=0;i<rows.length;i++){
          const row = rows[i];
          const id = row.getAttribute("data-id");
          const nameEl = row.querySelector(".cols-name");
          const colorEl = row.querySelector(".cols-color");
          const name = String(nameEl?.value ?? "").trim() || "column";
          const color = String(colorEl?.value ?? "#111111").trim() || "#111111";
          next.push({ id, name, color, order: i, role: null });
        }

        // done role
        const doneId = String(data.doneCol ?? "");
        if(doneId){
          const d = next.find(c => c.id === doneId);
          if(d) d.role = "done";
        }

        // Ensure at least one column
        if(next.length === 0){
          this.ui.toast("need at least 1 column");
          return;
        }

        this.store.patch((s) => {
          const p = s.projects.find(x => x.id === pid);
          if(!p) return;

          const prevIds = new Set((p.columns || []).map(c => c.id));
          const nextIds = new Set(next.map(c => c.id));

          // Move tasks from deleted columns -> first column
          const fallbackId = next[0].id;
          for(const t of s.tasks){
            if(t.projectId !== pid) continue;
            if(!t.columnId || !nextIds.has(t.columnId)){
              t.columnId = fallbackId;
            }
          }

          p.columns = next;
        });

        this.renderSelect();
        this.ui.closeModal();
        this.ui.toast("columns saved");
        document.dispatchEvent(new CustomEvent("planning:tasksChanged"));
        document.dispatchEvent(new CustomEvent("planning:projectChanged", { detail: { id: pid } }));
      },
      onMount: (bodyEl) => {
        const ui = this.ui;
        const form = bodyEl.querySelector("[data-cols-form]");
        const list = bodyEl.querySelector("[data-cols-list]");
        const addBtn = bodyEl.querySelector("[data-add]");

        function bindRow(row){
          row.querySelector("[data-up]")?.addEventListener("click", () => {
            const prev = row.previousElementSibling;
            if(prev) list.insertBefore(row, prev);
          });
          row.querySelector("[data-down]")?.addEventListener("click", () => {
            const next = row.nextElementSibling;
            if(next) list.insertBefore(next, row);
          });
          row.querySelector("[data-del]")?.addEventListener("click", () => {
            if(list.querySelectorAll("[data-col-row]").length <= 1){
              ui.toast("need at least 1 column");
              return;
            }
            row.remove();
          });
        }

        // bind existing
        Array.from(list.querySelectorAll("[data-col-row]")).forEach(bindRow);

        addBtn?.addEventListener("click", () => {
          const id = uid();
          const row = document.createElement("div");
          row.className = "cols-row";
          row.setAttribute("data-col-row", "");
          row.setAttribute("data-id", id);
          row.innerHTML = `
            <input class="ctl cols-name" name="col_name_${id}" value="new column" maxlength="24" />
            <input class="ctl cols-color" type="color" name="col_color_${id}" value="#111111" />
            <label class="cols-done">
              <input type="radio" name="doneCol" value="${id}" />
              done
            </label>
            <div class="cols-actions">
              <button class="btn cols-up" type="button" data-up>↑</button>
              <button class="btn cols-down" type="button" data-down>↓</button>
              <button class="btn cols-del" type="button" data-del>×</button>
            </div>
          `;
          list.appendChild(row);
          bindRow(row);
        });
      }
    });
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
