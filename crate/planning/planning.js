import { Store } from "./js/store.js";
import { UI } from "./js/ui.js";
import { Projects } from "./js/projects.js";
import { Tasks } from "./js/tasks.js";

const store = new Store("itemkey_planning_v1");
const ui = new UI();

const projects = new Projects(store, ui);
const tasks = new Tasks(store, ui);

const els = {
  projectSelect: document.getElementById("projectSelect"),
  projectBar: document.getElementById("projectBar"),
  searchInput: document.getElementById("searchInput"),
  tagsFilter: document.getElementById("tagsFilter"),
  priorityFilter: document.getElementById("priorityFilter"),
  deadlineFilter: document.getElementById("deadlineFilter"),
  sortSelect: document.getElementById("sortSelect"),
  clearFilters: document.getElementById("clearFilters"),
  viewSelect: document.getElementById("viewSelect"),
  boardView: document.getElementById("boardView"),
  scheduleView: document.getElementById("scheduleView"),
  btnNewProject: document.getElementById("btnNewProject"),
  btnNewTask: document.getElementById("btnNewTask"),
  btnNewEvent: document.getElementById("btnNewEvent"),
};

function setView(view) {
  els.boardView.hidden = view !== "board";
  els.scheduleView.hidden = view !== "schedule";

  if (view === "board") tasks.renderBoard(els.boardView);

  if (view === "schedule") {
    els.scheduleView.innerHTML = `
      <div style="font-size:11px; letter-spacing:3px; text-transform:uppercase; color:rgba(0,0,0,.65);">
        schedule is next step
      </div>`;
  }
}

function readFiltersFromUI(){
  return {
    q: String(els.searchInput?.value ?? "").trim(),
    tags: String(els.tagsFilter?.value ?? "").trim(),
    priority: String(els.priorityFilter?.value ?? "all"),
    deadline: String(els.deadlineFilter?.value ?? "all"),
    sort: String(els.sortSelect?.value ?? "default"),
  };
}

function applyFiltersToTasks(){
  const f = readFiltersFromUI();
  tasks.setSearch(f.q);
  tasks.setFilters({
    tags: f.tags,
    priority: f.priority,
    deadline: f.deadline,
    sort: f.sort,
  });

  // persist
  store.patch((s) => {
    s.ui = s.ui || {};
    s.ui.taskFilters = s.ui.taskFilters || {};
    s.ui.taskFilters.q = f.q;
    s.ui.taskFilters.tags = f.tags;
    s.ui.taskFilters.priority = f.priority;
    s.ui.taskFilters.deadline = f.deadline;
    s.ui.taskFilters.sort = f.sort;
  });
}

function renderProjectBar(){
  const bar = els.projectBar;
  if(!bar) return;

  const state = store.getState();
  const { projects: ps, tasks: ts, activeProjectId } = state;

  bar.innerHTML = "";

  for(const p of ps){
    const count = ts.filter(t => t.projectId === p.id).length;

    const chip = document.createElement("div");
    chip.className = "proj-chip" + (p.id === activeProjectId ? " is-active" : "");
    chip.dataset.pid = p.id;

    chip.innerHTML = `
      <span class="proj-chip__name">${String(p.name ?? "").toUpperCase()}</span>
      <span class="proj-chip__count">${count}</span>
      <button class="proj-chip__ctl" type="button" aria-label="manage columns">⚙</button>
      <button class="proj-chip__del" type="button" aria-label="delete project">×</button>
    `;

    // switch project (click chip but not buttons)
    chip.addEventListener("click", (e) => {
      if(e.target.closest(".proj-chip__del") || e.target.closest(".proj-chip__ctl")) return;

      store.patch((s) => { s.activeProjectId = p.id; });
      projects.renderSelect();
      document.dispatchEvent(new CustomEvent("planning:projectChanged", { detail: { id: p.id } }));
      renderProjectBar();
      tasks.renderBoard(els.boardView);
    });

    // manage columns
    chip.querySelector(".proj-chip__ctl")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      projects.openColumnsModal(p.id);
    });

    // delete project
    chip.querySelector(".proj-chip__del")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      projects.openDeleteModal(p.id);
    });

    // drop task onto project
    chip.addEventListener("dragover", (e) => {
      e.preventDefault();
      chip.classList.add("is-drop");
    });
    chip.addEventListener("dragleave", () => chip.classList.remove("is-drop"));
    chip.addEventListener("drop", (e) => {
      e.preventDefault();
      chip.classList.remove("is-drop");
      const taskId = e.dataTransfer.getData("text/taskId");
      if(!taskId) return;
      tasks.moveTaskToProject(taskId, p.id);
      renderProjectBar();
    });

    bar.appendChild(chip);
  }
}

function bootstrap() {
  // seed project
  store.ensureSeed();

  // projects dropdown
  projects.mount(els.projectSelect);

  // hydrate persisted filters + view
  {
    const s = store.getState();
    const tf = s.ui?.taskFilters || {};

    if(els.searchInput) els.searchInput.value = String(tf.q ?? "");
    if(els.tagsFilter) els.tagsFilter.value = String(tf.tags ?? "");
    if(els.priorityFilter) els.priorityFilter.value = String(tf.priority ?? "all");
    if(els.deadlineFilter) els.deadlineFilter.value = String(tf.deadline ?? "all");
    if(els.sortSelect) els.sortSelect.value = String(tf.sort ?? "default");
    if(els.viewSelect) els.viewSelect.value = String(s.ui?.view ?? "board");

    applyFiltersToTasks();
  }

  // view switch
  els.viewSelect.addEventListener("change", () => {
    const v = els.viewSelect.value;
    store.patch((s) => { s.ui = s.ui || {}; s.ui.view = v; });
    setView(v);
  });

  // filters
  const rerender = () => { applyFiltersToTasks(); tasks.renderBoard(els.boardView); };
  els.searchInput.addEventListener("input", rerender);
  els.tagsFilter?.addEventListener("input", rerender);
  els.priorityFilter?.addEventListener("change", rerender);
  els.deadlineFilter?.addEventListener("change", rerender);
  els.sortSelect?.addEventListener("change", rerender);

  els.clearFilters?.addEventListener("click", () => {
    if(els.searchInput) els.searchInput.value = "";
    if(els.tagsFilter) els.tagsFilter.value = "";
    if(els.priorityFilter) els.priorityFilter.value = "all";
    if(els.deadlineFilter) els.deadlineFilter.value = "all";
    if(els.sortSelect) els.sortSelect.value = "default";
    rerender();
    ui.toast("filters cleared");
  });

  // actions
  els.btnNewProject.addEventListener("click", () => projects.openCreateModal());
  els.btnNewTask.addEventListener("click", () => tasks.openCreateModal());
  els.btnNewEvent.addEventListener("click", () => ui.toast("schedule next"));

  // project bar
  renderProjectBar();
  document.addEventListener("planning:projectChanged", renderProjectBar);
  document.addEventListener("planning:tasksChanged", renderProjectBar);

  // init
  setView(els.viewSelect.value || "board");
}

bootstrap();
