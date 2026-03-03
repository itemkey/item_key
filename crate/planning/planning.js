import { UI } from './js/ui.js';
import { PlanningCollabApp } from './js/planning_collab.js';

const ui = new UI();

const app = new PlanningCollabApp(ui, {
  projectSelect: document.getElementById('projectSelect'),
  projectBar: document.getElementById('projectBar'),
  planningPresence: document.getElementById('planningPresence'),
  searchInput: document.getElementById('searchInput'),
  tagsFilter: document.getElementById('tagsFilter'),
  priorityFilter: document.getElementById('priorityFilter'),
  deadlineFilter: document.getElementById('deadlineFilter'),
  sortSelect: document.getElementById('sortSelect'),
  clearFilters: document.getElementById('clearFilters'),
  viewSelect: document.getElementById('viewSelect'),
  boardView: document.getElementById('boardView'),
  scheduleView: document.getElementById('scheduleView'),
  btnNewProject: document.getElementById('btnNewProject'),
  btnNewTask: document.getElementById('btnNewTask'),
  btnInviteFriend: document.getElementById('btnInviteFriend'),
  btnInvitesInbox: document.getElementById('btnInvitesInbox'),
  btnNewEvent: document.getElementById('btnNewEvent')
});

try {
  await app.init();
} catch (error) {
  console.error(error);
  ui.toast('planning init failed');
}
