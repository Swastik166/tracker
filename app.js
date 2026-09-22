const STATE_KEY = "learning-atlas-state-v2";
const LEGACY_ITEMS_KEY = "hobby-atlas-items-v1";
const THEME_KEY = "hobby-atlas-theme";

const starterState = {
  items: [
    { id: crypto.randomUUID(), title: "JavaScript fundamentals", hobby: "Coding", status: "learning", progress: 65, notes: "Getting more comfortable with async code, DOM events, and small browser projects.", nextAction: "Build one tiny app without following a tutorial.", tags: ["web", "fundamentals"], archived: false },
    { id: crypto.randomUUID(), title: "Street photography composition", hobby: "Photography", status: "planned", progress: 10, notes: "I want to get better at framing, layers, timing, and noticing interesting moments.", nextAction: "Take a 30-minute photo walk with one composition rule in mind.", tags: ["creative", "practice"], archived: false },
    { id: crypto.randomUUID(), title: "Open chord changes", hobby: "Guitar", status: "learned", progress: 100, notes: "Comfortable moving between the common open chord shapes.", nextAction: "Use them in complete songs rather than isolated drills.", tags: ["music", "foundation"], archived: false }
  ],
  projects: [
    { id: crypto.randomUUID(), title: "My personal learning website", hobby: "Coding", status: "active", progress: 35, description: "A useful home for the hobbies, skills, projects, resources, and milestones I collect over time.", resources: [
      { id: crypto.randomUUID(), label: "MDN Web Docs", type: "Reference", url: "https://developer.mozilla.org/", note: "Reliable browser and JavaScript reference." },
      { id: crypto.randomUUID(), label: "GitHub Pages docs", type: "Reference", url: "https://docs.github.com/en/pages", note: "Publishing and configuration notes." }
    ] }
  ],
  curiosities: [
    { id: crypto.randomUUID(), title: "How film photography development works", hobby: "Photography", note: "I keep hearing about different film stocks and development methods.", url: "" }
  ],
  milestones: [
    { id: crypto.randomUUID(), title: "Publish the first version of this site", type: "project", hobby: "Coding", targetDate: "", note: "A small but complete version online is the goal.", done: false }
  ],
  activity: []
};

let state = loadState();
let editingItemId = null;
let editingProjectId = null;

const $ = selector => document.querySelector(selector);
const cardsEl = $("#cards");
const cardTemplate = $("#cardTemplate");
const searchInput = $("#searchInput");
const statusFilter = $("#statusFilter");
const hobbyFilter = $("#hobbyFilter");

function cloneStarter() {
  return JSON.parse(JSON.stringify(starterState));
}

function loadState() {
  const saved = localStorage.getItem(STATE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return normalizeState(parsed);
    } catch {}
  }

  const legacy = localStorage.getItem(LEGACY_ITEMS_KEY);
  if (legacy) {
    try {
      const oldItems = JSON.parse(legacy);
      if (Array.isArray(oldItems)) {
        const migrated = cloneStarter();
        migrated.items = oldItems.map(item => ({
          ...item,
          nextAction: item.nextAction || "",
          archived: false
        }));
        return migrated;
      }
    } catch {}
  }
  return cloneStarter();
}

function normalizeState(input) {
  return {
    items: Array.isArray(input.items) ? input.items.map(x => ({ ...x, archived: Boolean(x.archived), nextAction: x.nextAction || "", tags: Array.isArray(x.tags) ? x.tags : [] })) : [],
    projects: Array.isArray(input.projects) ? input.projects.map(p => ({ ...p, resources: Array.isArray(p.resources) ? p.resources : [] })) : [],
    curiosities: Array.isArray(input.curiosities) ? input.curiosities : [],
    milestones: Array.isArray(input.milestones) ? input.milestones : [],
    activity: Array.isArray(input.activity) ? input.activity : []
  };
}

function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function statusLabel(status) {
  return ({ planned: "Planned", learning: "Learning", learned: "Learned", idea: "Idea", active: "Active", paused: "Paused", done: "Done" })[status] || status;
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#039;", '"':"&quot;" })[char]);
}

function renderLearning() {
  const query = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;
  const hobby = hobbyFilter.value;
  const currentItems = state.items.filter(item => !item.archived);
  const filtered = currentItems.filter(item => {
    const haystack = [item.title, item.hobby, item.notes, item.nextAction, ...(item.tags || [])].join(" ").toLowerCase();
    return (!query || haystack.includes(query)) && (status === "all" || item.status === status) && (hobby === "all" || item.hobby === hobby);
  });

  cardsEl.innerHTML = "";
  if (!filtered.length) cardsEl.innerHTML = `<div class="empty-state"><strong>Nothing here yet.</strong><p>Add something I want to learn, or change the current filters.</p></div>`;

  filtered.forEach(item => {
    const card = cardTemplate.content.firstElementChild.cloneNode(true);
    card.querySelector(".hobby-pill").textContent = item.hobby;
    card.querySelector(".status-pill").textContent = statusLabel(item.status);
    card.querySelector(".card-title").textContent = item.title;
    card.querySelector(".card-notes").textContent = item.notes || "No notes yet.";
    card.querySelector(".progress-value").textContent = `${item.progress}%`;
    card.querySelector(".progress-bar").style.width = `${item.progress}%`;
    card.querySelector(".next-action").textContent = item.nextAction ? `Next: ${item.nextAction}` : "";

    const tagsEl = card.querySelector(".tags");
    (item.tags || []).forEach(tag => {
      const span = document.createElement("span");
      span.textContent = `#${tag}`;
      tagsEl.appendChild(span);
    });

    card.querySelector(".log-button").addEventListener("click", () => openActivityDialog(item.id));
    card.querySelector(".edit-button").addEventListener("click", () => openItemDialog(item));
    card.querySelector(".archive-button").addEventListener("click", () => archiveItem(item.id));
    cardsEl.appendChild(card);
  });
}

function renderStats() {
  const visible = state.items.filter(x => !x.archived);
  $("#learningCount").textContent = visible.filter(x => x.status === "learning").length;
  $("#learnedCount").textContent = visible.filter(x => x.status === "learned").length;
  $("#projectCount").textContent = state.projects.filter(x => x.status === "active").length;
  $("#streakCount").textContent = calculateStreak();
}

function renderFocus() {
  const active = state.items.filter(x => !x.archived && x.status === "learning").slice(0, 4);
  const target = $("#focusList");
  if (!active.length) {
    target.innerHTML = `<div class="empty-state">Nothing is marked “Learning” right now.</div>`;
    return;
  }
  target.innerHTML = active.map(item => `<div class="focus-item"><strong>${escapeHTML(item.title)}</strong><span>${escapeHTML(item.nextAction || `${item.progress}% complete`)}</span></div>`).join("");
}

function refreshHobbyFilter() {
  const current = hobbyFilter.value;
  const hobbies = [...new Set(state.items.filter(x => !x.archived).map(x => x.hobby).filter(Boolean))].sort();
  hobbyFilter.innerHTML = `<option value="all">All hobbies</option>`;
  hobbies.forEach(hobby => hobbyFilter.insertAdjacentHTML("beforeend", `<option value="${escapeHTML(hobby)}">${escapeHTML(hobby)}</option>`));
  hobbyFilter.value = hobbies.includes(current) ? current : "all";
}

function renderProjects() {
  const grid = $("#projectsGrid");
  if (!state.projects.length) {
    grid.innerHTML = `<div class="empty-state">No projects yet. Projects are where finished things, experiments, and their resources can live together.</div>`;
    return;
  }

  grid.innerHTML = state.projects.map(project => {
    const resources = project.resources || [];
    const resourceHTML = resources.length ? resources.map(r => `
      <div class="resource-row">
        <div><a href="${escapeHTML(r.url)}" target="_blank" rel="noreferrer">${escapeHTML(r.label)} ↗</a><small>${escapeHTML(r.type)}${r.note ? ` · ${escapeHTML(r.note)}` : ""}</small></div>
        <button class="mini-button danger" data-delete-resource="${r.id}" data-project-id="${project.id}">×</button>
      </div>`).join("") : `<div class="empty-state">No resources saved for this project.</div>`;

    return `<article class="project-card" data-project="${project.id}">
      <div class="project-topline"><span class="hobby-pill">${escapeHTML(project.hobby)}</span><span class="status-pill">${statusLabel(project.status)}</span></div>
      <h3 class="project-title">${escapeHTML(project.title)}</h3>
      <p class="project-description">${escapeHTML(project.description || "No description yet.")}</p>
      <div class="project-progress">
        <div class="progress-copy"><span>Progress</span><strong>${project.progress}%</strong></div>
        <div class="progress-track"><div class="progress-bar" style="width:${project.progress}%"></div></div>
      </div>
      <div class="resource-shelf">
        <div class="resource-shelf-header"><h4>Resource shelf <span class="muted-count">(${resources.length})</span></h4><button class="mini-button" data-add-resource="${project.id}">+ Resource</button></div>
        <div class="resource-list">${resourceHTML}</div>
      </div>
      <div class="card-footer"><span></span><div><button class="mini-button" data-edit-project="${project.id}">Edit</button><button class="mini-button danger" data-delete-project="${project.id}">Delete</button></div></div>
    </article>`;
  }).join("");

  grid.querySelectorAll("[data-add-resource]").forEach(btn => btn.addEventListener("click", () => openResourceDialog(btn.dataset.addResource)));
  grid.querySelectorAll("[data-edit-project]").forEach(btn => btn.addEventListener("click", () => openProjectDialog(state.projects.find(p => p.id === btn.dataset.editProject))));
  grid.querySelectorAll("[data-delete-project]").forEach(btn => btn.addEventListener("click", () => deleteProject(btn.dataset.deleteProject)));
  grid.querySelectorAll("[data-delete-resource]").forEach(btn => btn.addEventListener("click", () => deleteResource(btn.dataset.projectId, btn.dataset.deleteResource)));
}

function renderMilestones() {
  const list = $("#milestoneList");
  if (!state.milestones.length) {
    list.innerHTML = `<div class="empty-state">No milestones yet. I can use these for firsts, streaks, completions, personal bests, or anything else worth marking.</div>`;
    return;
  }
  const sorted = [...state.milestones].sort((a,b) => Number(a.done) - Number(b.done));
  list.innerHTML = sorted.map(m => `<article class="milestone-item ${m.done ? "done" : ""}">
    <div class="milestone-main">
      <input class="milestone-check" type="checkbox" ${m.done ? "checked" : ""} data-toggle-milestone="${m.id}" aria-label="Toggle milestone complete" />
      <div class="milestone-copy"><strong>${escapeHTML(m.title)}</strong><small>${escapeHTML(m.hobby || "General")} · ${escapeHTML(labelMilestoneType(m.type))}${m.targetDate ? ` · target ${formatDate(m.targetDate)}` : ""}${m.note ? ` · ${escapeHTML(m.note)}` : ""}</small></div>
    </div>
    <button class="mini-button danger" data-delete-milestone="${m.id}">Delete</button>
  </article>`).join("");
  list.querySelectorAll("[data-toggle-milestone]").forEach(input => input.addEventListener("change", () => toggleMilestone(input.dataset.toggleMilestone)));
  list.querySelectorAll("[data-delete-milestone]").forEach(btn => btn.addEventListener("click", () => deleteMilestone(btn.dataset.deleteMilestone)));
}

function labelMilestoneType(type) {
  return ({ first: "First", completion: "Completion", "personal-best": "Personal best", consistency: "Consistency", project: "Project", custom: "Custom" })[type] || type;
}

function renderCuriosity() {
  const grid = $("#curiosityGrid");
  if (!state.curiosities.length) {
    grid.innerHTML = `<div class="empty-state">Inbox zero. The next interesting idea can land here without becoming a commitment.</div>`;
    return;
  }
  grid.innerHTML = state.curiosities.map(c => `<article class="curiosity-card">
    <div class="curiosity-top"><span class="hobby-pill">${escapeHTML(c.hobby || "Curiosity")}</span><span class="status-pill">Inbox</span></div>
    <h3>${escapeHTML(c.title)}</h3>
    <p>${escapeHTML(c.note || "")}</p>
    ${c.url ? `<a class="text-button" href="${escapeHTML(c.url)}" target="_blank" rel="noreferrer">Open source ↗</a>` : ""}
    <div class="curiosity-actions"><button class="mini-button" data-promote-curiosity="${c.id}">Move to learning</button><button class="mini-button danger" data-delete-curiosity="${c.id}">Dismiss</button></div>
  </article>`).join("");
  grid.querySelectorAll("[data-promote-curiosity]").forEach(btn => btn.addEventListener("click", () => promoteCuriosity(btn.dataset.promoteCuriosity)));
  grid.querySelectorAll("[data-delete-curiosity]").forEach(btn => btn.addEventListener("click", () => deleteCuriosity(btn.dataset.deleteCuriosity)));
}

function renderArchive() {
  const archived = state.items.filter(x => x.archived);
  const list = $("#archiveList");
  if (!archived.length) {
    list.innerHTML = `<div class="empty-state">The archive is empty. Anything I retire from the active learning list will stay here instead of disappearing.</div>`;
    return;
  }
  list.innerHTML = archived.map(item => `<article class="archive-item">
    <div><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.hobby)} · ${statusLabel(item.status)} · ${item.progress}% complete</small></div>
    <div class="archive-actions"><button class="mini-button" data-restore="${item.id}">Restore</button><button class="mini-button danger" data-delete-item="${item.id}">Delete forever</button></div>
  </article>`).join("");
  list.querySelectorAll("[data-restore]").forEach(btn => btn.addEventListener("click", () => restoreItem(btn.dataset.restore)));
  list.querySelectorAll("[data-delete-item]").forEach(btn => btn.addEventListener("click", () => deleteItem(btn.dataset.deleteItem)));
}

function localDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function renderHeatmap() {
  const heatmap = $("#heatmap");
  const activityByDate = new Map();
  state.activity.forEach(entry => activityByDate.set(entry.date, (activityByDate.get(entry.date) || 0) + Number(entry.minutes || 0)));

  const today = new Date();
  today.setHours(0,0,0,0);
  const start = new Date(today);
  start.setDate(start.getDate() - 139);
  heatmap.innerHTML = "";

  for (let i = 0; i < 140; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = localDateString(date);
    const minutes = activityByDate.get(key) || 0;
    const level = minutes === 0 ? 0 : minutes < 20 ? 1 : minutes < 45 ? 2 : minutes < 90 ? 3 : 4;
    const cell = document.createElement("div");
    cell.className = "heatmap-cell";
    cell.dataset.level = level;
    cell.title = `${key}: ${minutes} min`;
    heatmap.appendChild(cell);
  }

  $("#activityDays").textContent = activityByDate.size;
  $("#activityMinutes").textContent = state.activity.reduce((sum, x) => sum + Number(x.minutes || 0), 0);
}

function calculateStreak() {
  const activeDates = new Set(state.activity.filter(x => Number(x.minutes) > 0).map(x => x.date));
  let date = new Date();
  date.setHours(0,0,0,0);
  if (!activeDates.has(localDateString(date))) {
    date.setDate(date.getDate() - 1);
  }
  let streak = 0;
  while (activeDates.has(localDateString(date))) {
    streak++;
    date.setDate(date.getDate() - 1);
  }
  return streak;
}

function refreshAll() {
  refreshHobbyFilter();
  renderLearning();
  renderStats();
  renderFocus();
  renderProjects();
  renderMilestones();
  renderCuriosity();
  renderArchive();
  renderHeatmap();
  refreshActivitySelect();
}

function openItemDialog(item = null) {
  editingItemId = item?.id || null;
  const form = $("#itemForm");
  form.reset();
  $("#itemDialogTitle").textContent = item ? "Edit learning entry" : "Add something I want to learn";
  if (item) {
    form.elements.title.value = item.title;
    form.elements.hobby.value = item.hobby;
    form.elements.status.value = item.status;
    form.elements.progress.value = item.progress;
    form.elements.notes.value = item.notes || "";
    form.elements.nextAction.value = item.nextAction || "";
    form.elements.tags.value = (item.tags || []).join(", ");
  } else {
    form.elements.status.value = "planned";
    form.elements.progress.value = 0;
  }
  $("#itemDialog").showModal();
}

function openActivityDialog(itemId = "") {
  const form = $("#activityForm");
  form.reset();
  form.elements.date.value = localDateString(new Date());
  form.elements.minutes.value = 30;
  refreshActivitySelect();
  if (itemId) form.elements.itemId.value = itemId;
  $("#activityDialog").showModal();
}

function openProjectDialog(project = null) {
  editingProjectId = project?.id || null;
  const form = $("#projectForm");
  form.reset();
  $("#projectDialogTitle").textContent = project ? "Edit project" : "Add a project";
  if (project) {
    form.elements.title.value = project.title;
    form.elements.hobby.value = project.hobby;
    form.elements.status.value = project.status;
    form.elements.progress.value = project.progress;
    form.elements.description.value = project.description || "";
  } else {
    form.elements.status.value = "idea";
    form.elements.progress.value = 0;
  }
  $("#projectDialog").showModal();
}

function openResourceDialog(projectId) {
  const form = $("#resourceForm");
  form.reset();
  form.elements.projectId.value = projectId;
  $("#resourceDialog").showModal();
}

function refreshActivitySelect() {
  const select = $("#activityItemSelect");
  const current = select.value;
  const items = state.items.filter(x => !x.archived);
  select.innerHTML = items.length ? items.map(item => `<option value="${item.id}">${escapeHTML(item.hobby)} — ${escapeHTML(item.title)}</option>`).join("") : `<option value="">General practice</option>`;
  if ([...select.options].some(o => o.value === current)) select.value = current;
}

function archiveItem(id) {
  const item = state.items.find(x => x.id === id);
  if (!item) return;
  item.archived = true;
  saveState(); refreshAll();
}
function restoreItem(id) { const item = state.items.find(x => x.id === id); if (item) { item.archived = false; saveState(); refreshAll(); } }
function deleteItem(id) { if (confirm("Permanently delete this archived item?")) { state.items = state.items.filter(x => x.id !== id); saveState(); refreshAll(); } }
function deleteProject(id) { if (confirm("Delete this project and its saved resource shelf?")) { state.projects = state.projects.filter(x => x.id !== id); saveState(); refreshAll(); } }
function deleteResource(projectId, resourceId) { const p = state.projects.find(x => x.id === projectId); if (p) { p.resources = (p.resources || []).filter(x => x.id !== resourceId); saveState(); renderProjects(); } }
function toggleMilestone(id) { const m = state.milestones.find(x => x.id === id); if (m) { m.done = !m.done; saveState(); refreshAll(); } }
function deleteMilestone(id) { state.milestones = state.milestones.filter(x => x.id !== id); saveState(); renderMilestones(); }
function deleteCuriosity(id) { state.curiosities = state.curiosities.filter(x => x.id !== id); saveState(); renderCuriosity(); }
function promoteCuriosity(id) {
  const c = state.curiosities.find(x => x.id === id); if (!c) return;
  state.items.unshift({ id: crypto.randomUUID(), title: c.title, hobby: c.hobby || "General", status: "planned", progress: 0, notes: c.note || "", nextAction: "Decide the first small step.", tags: ["from-curiosity"], archived: false });
  state.curiosities = state.curiosities.filter(x => x.id !== id);
  saveState(); refreshAll();
  location.hash = "#learning";
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

$("#itemForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const entry = {
    id: editingItemId || crypto.randomUUID(),
    title: String(data.get("title")).trim(), hobby: String(data.get("hobby")).trim(), status: String(data.get("status")),
    progress: Math.min(100, Math.max(0, Number(data.get("progress")) || 0)), notes: String(data.get("notes")).trim(),
    nextAction: String(data.get("nextAction")).trim(), tags: String(data.get("tags")).split(",").map(x => x.trim()).filter(Boolean), archived: false
  };
  if (editingItemId) state.items = state.items.map(x => x.id === editingItemId ? { ...entry, archived: x.archived } : x); else state.items.unshift(entry);
  saveState(); $("#itemDialog").close(); refreshAll();
});

$("#activityForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  state.activity.push({ id: crypto.randomUUID(), date: String(data.get("date")), minutes: Number(data.get("minutes")) || 0, itemId: String(data.get("itemId") || ""), note: String(data.get("note")).trim() });
  saveState(); $("#activityDialog").close(); refreshAll();
});

$("#projectForm").addEventListener("submit", event => {
  event.preventDefault(); const data = new FormData(event.currentTarget);
  const existing = state.projects.find(x => x.id === editingProjectId);
  const project = { id: editingProjectId || crypto.randomUUID(), title: String(data.get("title")).trim(), hobby: String(data.get("hobby")).trim(), status: String(data.get("status")), progress: Math.min(100, Math.max(0, Number(data.get("progress")) || 0)), description: String(data.get("description")).trim(), resources: existing?.resources || [] };
  if (editingProjectId) state.projects = state.projects.map(x => x.id === editingProjectId ? project : x); else state.projects.unshift(project);
  saveState(); $("#projectDialog").close(); refreshAll();
});

$("#resourceForm").addEventListener("submit", event => {
  event.preventDefault(); const data = new FormData(event.currentTarget); const project = state.projects.find(x => x.id === data.get("projectId"));
  if (project) { project.resources ||= []; project.resources.push({ id: crypto.randomUUID(), label: String(data.get("label")).trim(), type: String(data.get("type")), url: String(data.get("url")).trim(), note: String(data.get("note")).trim() }); }
  saveState(); $("#resourceDialog").close(); renderProjects();
});

$("#milestoneForm").addEventListener("submit", event => {
  event.preventDefault(); const data = new FormData(event.currentTarget);
  state.milestones.unshift({ id: crypto.randomUUID(), title: String(data.get("title")).trim(), type: String(data.get("type")), hobby: String(data.get("hobby")).trim(), targetDate: String(data.get("targetDate") || ""), note: String(data.get("note")).trim(), done: false });
  saveState(); $("#milestoneDialog").close(); refreshAll();
});

$("#curiosityForm").addEventListener("submit", event => {
  event.preventDefault(); const data = new FormData(event.currentTarget);
  state.curiosities.unshift({ id: crypto.randomUUID(), title: String(data.get("title")).trim(), hobby: String(data.get("hobby")).trim(), url: String(data.get("url")).trim(), note: String(data.get("note")).trim() });
  saveState(); $("#curiosityDialog").close(); renderCuriosity();
});

$("#addButton").addEventListener("click", () => openItemDialog());
$("#logActivityButton").addEventListener("click", () => openActivityDialog());
$("#addProjectButton").addEventListener("click", () => openProjectDialog());
$("#addMilestoneButton").addEventListener("click", () => { $("#milestoneForm").reset(); $("#milestoneDialog").showModal(); });
$("#addCuriosityButton").addEventListener("click", () => { $("#curiosityForm").reset(); $("#curiosityDialog").showModal(); });
document.querySelectorAll("[data-close]").forEach(btn => btn.addEventListener("click", () => document.getElementById(btn.dataset.close).close()));
searchInput.addEventListener("input", renderLearning);
statusFilter.addEventListener("change", renderLearning);
hobbyFilter.addEventListener("change", renderLearning);

$("#randomFocusButton").addEventListener("click", () => {
  const choices = state.items.filter(x => !x.archived && (x.status === "learning" || x.status === "planned"));
  if (!choices.length) return alert("There is nothing in the active learning list yet.");
  const item = choices[Math.floor(Math.random() * choices.length)];
  const action = item.nextAction || `Spend 20 minutes on ${item.title}.`;
  alert(`${item.title}\n\n${action}`);
});

$("#exportButton").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = `learning-atlas-backup-${localDateString(new Date())}.json`; a.click(); URL.revokeObjectURL(url);
});

$("#importInput").addEventListener("change", async event => {
  const file = event.target.files?.[0]; if (!file) return;
  try { state = normalizeState(JSON.parse(await file.text())); saveState(); refreshAll(); alert("Backup imported."); }
  catch { alert("That file is not a valid Learning Atlas backup."); }
  finally { event.target.value = ""; }
});

const themeToggle = $("#themeToggle");
if (localStorage.getItem(THEME_KEY) === "dark") document.body.classList.add("dark");
function updateThemeIcon() { themeToggle.textContent = document.body.classList.contains("dark") ? "☀" : "☾"; }
updateThemeIcon();
themeToggle.addEventListener("click", () => { document.body.classList.toggle("dark"); localStorage.setItem(THEME_KEY, document.body.classList.contains("dark") ? "dark" : "light"); updateThemeIcon(); });

const prompts = [
  "What would make today feel like a small step forward?",
  "What am I curious enough to spend twenty minutes on?",
  "Which unfinished thing would feel good to move one step ahead?",
  "What have I learned recently that I don’t want to forget?",
  "What can I make, test, or practice instead of only reading about it?"
];
$("#dailyPrompt").textContent = prompts[new Date().getDate() % prompts.length];

refreshAll();
