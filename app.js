const STATE_KEY = "personal-hobby-journal-v3";
const LEGACY_STATE_KEY = "learning-atlas-state-v2";
const THEME_KEY = "hobby-journal-theme";

const emptyState = () => ({
  items: [],
  projects: [],
  milestones: [],
  curiosities: [],
  activity: [],
  hobbyNotes: {}
});

let state = loadState();
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function slugify(value = "") {
  return String(value).trim().toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeState(input = {}) {
  return {
    items: Array.isArray(input.items) ? input.items.map(x => ({
      ...x,
      hobbyId: x.hobbyId || slugify(x.hobby || "general"),
      archived: Boolean(x.archived),
      nextAction: x.nextAction || "",
      tags: Array.isArray(x.tags) ? x.tags : []
    })) : [],
    projects: Array.isArray(input.projects) ? input.projects.map(x => ({
      ...x,
      hobbyId: x.hobbyId || slugify(x.hobby || "general"),
      resources: Array.isArray(x.resources) ? x.resources : []
    })) : [],
    milestones: Array.isArray(input.milestones) ? input.milestones.map(x => ({
      ...x,
      hobbyId: x.hobbyId || slugify(x.hobby || "general"),
      done: Boolean(x.done)
    })) : [],
    curiosities: Array.isArray(input.curiosities) ? input.curiosities.map(x => ({
      ...x,
      hobbyId: x.hobbyId || slugify(x.hobby || "general")
    })) : [],
    activity: Array.isArray(input.activity) ? input.activity.map(x => {
      let hobbyId = x.hobbyId;
      if (!hobbyId && x.itemId) {
        const item = (input.items || []).find(item => item.id === x.itemId);
        hobbyId = item ? (item.hobbyId || slugify(item.hobby || "general")) : "general";
      }
      return { ...x, hobbyId: hobbyId || "general" };
    }) : [],
    hobbyNotes: input.hobbyNotes && typeof input.hobbyNotes === "object" ? input.hobbyNotes : {}
  };
}

function loadState() {
  const saved = localStorage.getItem(STATE_KEY);
  if (saved) {
    try { return normalizeState(JSON.parse(saved)); } catch {}
  }

  const legacy = localStorage.getItem(LEGACY_STATE_KEY);
  if (legacy) {
    try {
      const migrated = normalizeState(JSON.parse(legacy));
      localStorage.setItem(STATE_KEY, JSON.stringify(migrated));
      return migrated;
    } catch {}
  }
  return emptyState();
}

function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function todayISO() {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function activityLevel(minutes) {
  const value = Number(minutes || 0);
  if (!value) return 0;
  if (value <= 15) return 1;
  if (value <= 30) return 2;
  if (value <= 60) return 3;
  return 4;
}

function buildHeatmap(target, entries, days = 182) {
  if (!target) return;
  const totals = new Map();
  entries.forEach(entry => totals.set(entry.date, (totals.get(entry.date) || 0) + Number(entry.minutes || 0)));

  const end = new Date();
  end.setHours(12, 0, 0, 0);
  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));
  start.setDate(start.getDate() - start.getDay());

  target.innerHTML = "";
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    const key = local.toISOString().slice(0, 10);
    const minutes = totals.get(key) || 0;
    const cell = document.createElement("span");
    cell.className = "heatmap-cell";
    cell.dataset.level = activityLevel(minutes);
    cell.title = `${formatDate(key)} · ${minutes} min`;
    target.appendChild(cell);
  }
}

function applyTheme() {
  if (localStorage.getItem(THEME_KEY) === "dark") document.body.classList.add("dark");
  const button = $("#themeToggle");
  if (button) button.textContent = document.body.classList.contains("dark") ? "Light" : "Dark";
}

function bindThemeButton() {
  const button = $("#themeToggle");
  if (!button) return;
  button.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    localStorage.setItem(THEME_KEY, document.body.classList.contains("dark") ? "dark" : "light");
    button.textContent = document.body.classList.contains("dark") ? "Light" : "Dark";
  });
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `my-hobbies-backup-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importData(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    state = normalizeState(parsed);
    saveState();
    location.reload();
  } catch {
    alert("That file does not look like a valid backup.");
  }
}

function bindBackupControls() {
  $("#exportButton")?.addEventListener("click", exportData);
  $("#importInput")?.addEventListener("change", event => importData(event.target.files?.[0]));
}

function renderHome() {
  const registry = Array.isArray(window.HOBBIES) ? window.HOBBIES : [];
  const list = $("#hobbyList");
  $("#hobbyCount").textContent = `${registry.length} ${registry.length === 1 ? "hobby" : "hobbies"}`;

  list.innerHTML = registry.map(hobby => {
    const learning = state.items.filter(x => x.hobbyId === hobby.id && !x.archived && x.status === "learning").length;
    const projects = state.projects.filter(x => x.hobbyId === hobby.id && x.status !== "done").length;
    return `<a class="hobby-link" href="${escapeHTML(hobby.page)}">
      <span>
        <span class="hobby-name">${escapeHTML(hobby.name)}</span>
        <span class="hobby-description">${escapeHTML(hobby.description || "")}</span>
      </span>
      <span class="hobby-meta"><span>${learning} learning</span><span>${projects} projects</span><span>→</span></span>
    </a>`;
  }).join("");

  const activity = [...state.activity].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  buildHeatmap($("#homeHeatmap"), activity);
  $("#totalMinutes").textContent = `${activity.reduce((sum, x) => sum + Number(x.minutes || 0), 0)} min logged`;

  const recent = activity.slice(0, 6);
  const recentTarget = $("#recentActivity");
  if (!recent.length) {
    recentTarget.innerHTML = `<div class="empty-state">No activity logged yet.</div>`;
  } else {
    recentTarget.innerHTML = recent.map(entry => {
      const hobby = registry.find(x => x.id === entry.hobbyId);
      return `<div class="simple-row">
        <span>${escapeHTML(entry.note || "Practice session")}</span>
        <span class="muted">${escapeHTML(hobby?.name || entry.hobbyId)} · ${entry.minutes} min · ${formatDate(entry.date)}</span>
      </div>`;
    }).join("");
  }
}

function renderHobbyShell(config) {
  document.title = `${config.name} · My Hobbies`;
  const app = $("#app");
  app.innerHTML = `
    <header class="site-header">
      <div class="page-width header-inner">
        <div class="breadcrumbs"><a href="../index.html">My Hobbies</a> / ${escapeHTML(config.name)}</div>
        <button class="quiet-button" id="themeToggle" type="button">Dark</button>
      </div>
    </header>

    <main class="page-width hobby-main">
      <section class="hobby-heading">
        <div>
          <h1>${escapeHTML(config.name)}</h1>
          <p>${escapeHTML(config.description || "")}</p>
        </div>
        <div class="button-row">
          <button id="logActivityButton" class="quiet-button" type="button">Log activity</button>
          <button id="addItemButton" class="primary-button" type="button">Add learning</button>
        </div>
      </section>

      <nav class="hobby-nav" aria-label="Page sections">
        <a href="#overview">Overview</a>
        <a href="#learning">Learning</a>
        <a href="#projects">Projects</a>
        <a href="#milestones">Milestones</a>
        <a href="#curiosity">Curiosity</a>
        <a href="#archive">Archive</a>
      </nav>

      <section class="summary-row" aria-label="Hobby summary">
        <div class="summary-item"><span>Learning</span><strong id="summaryLearning">0</strong></div>
        <div class="summary-item"><span>Projects</span><strong id="summaryProjects">0</strong></div>
        <div class="summary-item"><span>Milestones</span><strong id="summaryMilestones">0</strong></div>
        <div class="summary-item"><span>Time logged</span><strong id="summaryTime">0m</strong></div>
      </section>

      <section id="overview" class="section-block overview-grid">
        <div>
          <div class="section-heading"><div><h2>Activity</h2><p>Recent practice over time.</p></div></div>
          <div class="heatmap-wrap"><div id="hobbyHeatmap" class="heatmap"></div></div>
          <div id="activityCaption" class="heatmap-caption"></div>
          <div id="activityList" class="simple-list"></div>
        </div>
        <div class="notes-box">
          <div class="section-heading"><div><h2>Notes</h2><p>A simple scratchpad for this hobby.</p></div></div>
          <textarea id="hobbyNotes" placeholder="Notes, ideas, reminders…"></textarea>
          <div id="notesSaved" class="autosave-note">Saved automatically in this browser.</div>
        </div>
      </section>

      <section id="learning" class="section-block">
        <div class="section-heading">
          <div><h2>Learning</h2><p>Things I plan to learn, am learning now, or have finished.</p></div>
          <button id="addItemButton2" class="quiet-button" type="button">Add learning</button>
        </div>
        <div class="toolbar">
          <input id="learningSearch" type="search" placeholder="Search learning…" />
          <select id="learningStatus"><option value="all">All statuses</option><option value="planned">Planned</option><option value="learning">Learning</option><option value="learned">Learned</option></select>
        </div>
        <div id="learningList" class="item-list"></div>
      </section>

      <section id="projects" class="section-block">
        <div class="section-heading">
          <div><h2>Projects</h2><p>Things I’m making or working toward. Resources stay with the project they belong to.</p></div>
          <button id="addProjectButton" class="quiet-button" type="button">Add project</button>
        </div>
        <div id="projectList" class="project-list"></div>
      </section>

      <section id="milestones" class="section-block">
        <div class="section-heading">
          <div><h2>Milestones</h2><p>Firsts, completions, personal bests, and other markers worth keeping.</p></div>
          <button id="addMilestoneButton" class="quiet-button" type="button">Add milestone</button>
        </div>
        <div id="milestoneList" class="milestone-list"></div>
      </section>

      <section id="curiosity" class="section-block">
        <div class="section-heading">
          <div><h2>Curiosity inbox</h2><p>Interesting things I may want to explore later, without turning them into commitments yet.</p></div>
          <button id="addCuriosityButton" class="quiet-button" type="button">Add curiosity</button>
        </div>
        <div id="curiosityList" class="curiosity-list"></div>
      </section>

      <section id="archive" class="section-block">
        <div class="section-heading"><div><h2>Archive</h2><p>Things I want to keep in the record without keeping them active.</p></div></div>
        <div id="archiveList" class="archive-list"></div>
      </section>
    </main>

    <footer class="page-width footer">
      <span>${escapeHTML(config.name)} · My Hobbies</span>
    </footer>

    ${dialogMarkup()}
  `;
}

function dialogMarkup() {
  return `
  <dialog id="itemDialog"><form id="itemForm" class="dialog-body">
    <div class="dialog-heading"><h2 id="itemDialogTitle">Add learning</h2><button type="button" class="dialog-close" data-close="itemDialog">×</button></div>
    <div class="form-grid">
      <label>Topic<input name="title" required /></label>
      <label>Status<select name="status"><option value="planned">Planned</option><option value="learning">Learning</option><option value="learned">Learned</option></select></label>
      <label>Progress %<input name="progress" type="number" min="0" max="100" value="0" /></label>
      <label>Tags<input name="tags" placeholder="theory, technique" /></label>
      <label class="full">Notes<textarea name="notes" placeholder="What I want to understand or remember…"></textarea></label>
      <label class="full">Next action<input name="nextAction" placeholder="The next small thing to do" /></label>
    </div>
    <div class="dialog-actions"><button type="button" class="quiet-button" data-close="itemDialog">Cancel</button><button class="primary-button" type="submit">Save</button></div>
  </form></dialog>

  <dialog id="activityDialog"><form id="activityForm" class="dialog-body">
    <div class="dialog-heading"><h2>Log activity</h2><button type="button" class="dialog-close" data-close="activityDialog">×</button></div>
    <div class="form-grid">
      <label>Date<input name="date" type="date" required /></label>
      <label>Minutes<input name="minutes" type="number" min="1" max="1440" value="30" required /></label>
      <label class="full">Related learning<select name="itemId" id="activityItemSelect"><option value="">General practice</option></select></label>
      <label class="full">Note<input name="note" placeholder="What I worked on" /></label>
    </div>
    <div class="dialog-actions"><button type="button" class="quiet-button" data-close="activityDialog">Cancel</button><button class="primary-button" type="submit">Save</button></div>
  </form></dialog>

  <dialog id="projectDialog"><form id="projectForm" class="dialog-body">
    <div class="dialog-heading"><h2 id="projectDialogTitle">Add project</h2><button type="button" class="dialog-close" data-close="projectDialog">×</button></div>
    <div class="form-grid">
      <label>Project<input name="title" required /></label>
      <label>Status<select name="status"><option value="idea">Idea</option><option value="active">Active</option><option value="paused">Paused</option><option value="done">Done</option></select></label>
      <label>Progress %<input name="progress" type="number" min="0" max="100" value="0" /></label>
      <label class="full">Description<textarea name="description"></textarea></label>
    </div>
    <div class="dialog-actions"><button type="button" class="quiet-button" data-close="projectDialog">Cancel</button><button class="primary-button" type="submit">Save</button></div>
  </form></dialog>

  <dialog id="resourceDialog"><form id="resourceForm" class="dialog-body">
    <div class="dialog-heading"><h2>Add resource</h2><button type="button" class="dialog-close" data-close="resourceDialog">×</button></div>
    <input name="projectId" type="hidden" />
    <div class="form-grid">
      <label>Label<input name="label" required /></label>
      <label>Type<input name="type" placeholder="Article, book, video…" /></label>
      <label class="full">URL<input name="url" type="url" required placeholder="https://…" /></label>
      <label class="full">Note<input name="note" placeholder="Why I saved this" /></label>
    </div>
    <div class="dialog-actions"><button type="button" class="quiet-button" data-close="resourceDialog">Cancel</button><button class="primary-button" type="submit">Save</button></div>
  </form></dialog>

  <dialog id="milestoneDialog"><form id="milestoneForm" class="dialog-body">
    <div class="dialog-heading"><h2>Add milestone</h2><button type="button" class="dialog-close" data-close="milestoneDialog">×</button></div>
    <div class="form-grid">
      <label>Milestone<input name="title" required /></label>
      <label>Type<select name="type"><option value="first">First</option><option value="completion">Completion</option><option value="personal-best">Personal best</option><option value="consistency">Consistency</option><option value="project">Project</option><option value="custom">Custom</option></select></label>
      <label>Date<input name="targetDate" type="date" /></label>
      <label class="full">Note<input name="note" /></label>
    </div>
    <div class="dialog-actions"><button type="button" class="quiet-button" data-close="milestoneDialog">Cancel</button><button class="primary-button" type="submit">Save</button></div>
  </form></dialog>

  <dialog id="curiosityDialog"><form id="curiosityForm" class="dialog-body">
    <div class="dialog-heading"><h2>Add curiosity</h2><button type="button" class="dialog-close" data-close="curiosityDialog">×</button></div>
    <div class="form-grid">
      <label class="full">Idea<input name="title" required /></label>
      <label class="full">URL<input name="url" type="url" placeholder="https://…" /></label>
      <label class="full">Note<textarea name="note"></textarea></label>
    </div>
    <div class="dialog-actions"><button type="button" class="quiet-button" data-close="curiosityDialog">Cancel</button><button class="primary-button" type="submit">Save</button></div>
  </form></dialog>`;
}

function initHobbyPage(config) {
  const hobbyId = config.id;
  renderHobbyShell(config);
  applyTheme();
  bindThemeButton();

  let editingItemId = null;
  let editingProjectId = null;

  const hobbyItems = () => state.items.filter(x => x.hobbyId === hobbyId);
  const activeItems = () => hobbyItems().filter(x => !x.archived);
  const hobbyProjects = () => state.projects.filter(x => x.hobbyId === hobbyId);
  const hobbyMilestones = () => state.milestones.filter(x => x.hobbyId === hobbyId);
  const hobbyCuriosities = () => state.curiosities.filter(x => x.hobbyId === hobbyId);
  const hobbyActivity = () => state.activity.filter(x => x.hobbyId === hobbyId);

  function renderSummary() {
    $("#summaryLearning").textContent = activeItems().filter(x => x.status === "learning").length;
    $("#summaryProjects").textContent = hobbyProjects().filter(x => x.status !== "done").length;
    $("#summaryMilestones").textContent = hobbyMilestones().filter(x => x.done).length;
    const mins = hobbyActivity().reduce((sum, x) => sum + Number(x.minutes || 0), 0);
    $("#summaryTime").textContent = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  }

  function renderActivity() {
    const entries = [...hobbyActivity()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    buildHeatmap($("#hobbyHeatmap"), entries);
    const total = entries.reduce((sum, x) => sum + Number(x.minutes || 0), 0);
    const activeDays = new Set(entries.map(x => x.date)).size;
    $("#activityCaption").textContent = `${activeDays} active days · ${total} minutes logged`;

    const target = $("#activityList");
    if (!entries.length) {
      target.innerHTML = `<div class="empty-state">No activity logged yet.</div>`;
      return;
    }
    target.innerHTML = entries.slice(0, 6).map(entry => `<div class="simple-row"><span>${escapeHTML(entry.note || "Practice session")}</span><span class="muted">${entry.minutes} min · ${formatDate(entry.date)}</span></div>`).join("");
  }

  function renderLearning() {
    const query = $("#learningSearch").value.trim().toLowerCase();
    const status = $("#learningStatus").value;
    const items = activeItems().filter(item => {
      const haystack = [item.title, item.notes, item.nextAction, ...(item.tags || [])].join(" ").toLowerCase();
      return (!query || haystack.includes(query)) && (status === "all" || item.status === status);
    });
    const target = $("#learningList");
    if (!items.length) {
      target.innerHTML = `<div class="empty-state">Nothing here yet.</div>`;
      return;
    }
    target.innerHTML = items.map(item => `<article class="item-row">
      <div class="item-top">
        <div class="row-main">
          <div><span class="row-title">${escapeHTML(item.title)}</span> <span class="status">${escapeHTML(item.status)}</span></div>
          ${item.notes ? `<p class="row-note">${escapeHTML(item.notes)}</p>` : ""}
          ${item.nextAction ? `<p class="row-next"><strong>Next:</strong> ${escapeHTML(item.nextAction)}</p>` : ""}
          ${(item.tags || []).length ? `<div class="tag-row">${item.tags.map(tag => `<span class="tag">#${escapeHTML(tag)}</span>`).join("")}</div>` : ""}
        </div>
        <div class="row-actions">
          <button class="mini-button" data-log-item="${item.id}">Log</button>
          <button class="mini-button" data-edit-item="${item.id}">Edit</button>
          <button class="mini-button" data-archive-item="${item.id}">Archive</button>
        </div>
      </div>
      <div class="row-meta">${Number(item.progress || 0)}% complete</div>
      <div class="progress-line"><span style="width:${Math.min(100, Math.max(0, Number(item.progress || 0)))}%"></span></div>
    </article>`).join("");

    $$('[data-log-item]').forEach(button => button.addEventListener("click", () => openActivity(button.dataset.logItem)));
    $$('[data-edit-item]').forEach(button => button.addEventListener("click", () => openItem(state.items.find(x => x.id === button.dataset.editItem))));
    $$('[data-archive-item]').forEach(button => button.addEventListener("click", () => {
      const item = state.items.find(x => x.id === button.dataset.archiveItem);
      if (item) { item.archived = true; saveState(); refresh(); }
    }));
  }

  function renderProjects() {
    const projects = hobbyProjects();
    const target = $("#projectList");
    if (!projects.length) {
      target.innerHTML = `<div class="empty-state">No projects yet.</div>`;
      return;
    }
    target.innerHTML = projects.map(project => `<article class="project-row">
      <div class="project-top">
        <div class="row-main">
          <div><span class="row-title">${escapeHTML(project.title)}</span> <span class="status">${escapeHTML(project.status)}</span></div>
          ${project.description ? `<p class="project-description">${escapeHTML(project.description)}</p>` : ""}
          <div class="row-meta">${Number(project.progress || 0)}% complete</div>
          <div class="progress-line"><span style="width:${Math.min(100, Math.max(0, Number(project.progress || 0)))}%"></span></div>
        </div>
        <div class="row-actions">
          <button class="mini-button" data-add-resource="${project.id}">Add resource</button>
          <button class="mini-button" data-edit-project="${project.id}">Edit</button>
          <button class="mini-button danger" data-delete-project="${project.id}">Delete</button>
        </div>
      </div>
      <div class="resource-shelf">
        <div class="resource-heading"><h4>Resources</h4><span class="muted">${(project.resources || []).length}</span></div>
        ${(project.resources || []).length ? (project.resources || []).map(resource => `<div class="resource-row">
          <div><a href="${escapeHTML(resource.url)}" target="_blank" rel="noreferrer">${escapeHTML(resource.label)} ↗</a><small>${escapeHTML(resource.type || "Resource")}${resource.note ? ` · ${escapeHTML(resource.note)}` : ""}</small></div>
          <button class="mini-button danger" data-delete-resource="${resource.id}" data-project-id="${project.id}">Remove</button>
        </div>`).join("") : `<div class="empty-state">No resources saved for this project.</div>`}
      </div>
    </article>`).join("");

    $$('[data-add-resource]').forEach(button => button.addEventListener("click", () => openResource(button.dataset.addResource)));
    $$('[data-edit-project]').forEach(button => button.addEventListener("click", () => openProject(state.projects.find(x => x.id === button.dataset.editProject))));
    $$('[data-delete-project]').forEach(button => button.addEventListener("click", () => {
      if (confirm("Delete this project and its resources?")) {
        state.projects = state.projects.filter(x => x.id !== button.dataset.deleteProject);
        saveState(); refresh();
      }
    }));
    $$('[data-delete-resource]').forEach(button => button.addEventListener("click", () => {
      const project = state.projects.find(x => x.id === button.dataset.projectId);
      if (project) {
        project.resources = (project.resources || []).filter(x => x.id !== button.dataset.deleteResource);
        saveState(); renderProjects();
      }
    }));
  }

  function renderMilestones() {
    const milestones = hobbyMilestones();
    const target = $("#milestoneList");
    if (!milestones.length) {
      target.innerHTML = `<div class="empty-state">No milestones yet.</div>`;
      return;
    }
    target.innerHTML = milestones.map(milestone => `<article class="milestone-row ${milestone.done ? "is-done" : ""}">
      <div class="milestone-top">
        <div class="milestone-content">
          <button class="check-button ${milestone.done ? "done" : ""}" data-toggle-milestone="${milestone.id}" aria-label="Toggle milestone"></button>
          <div>
            <div class="row-title">${escapeHTML(milestone.title)}</div>
            <div class="row-meta">${escapeHTML(milestone.type || "custom")}${milestone.targetDate ? ` · ${formatDate(milestone.targetDate)}` : ""}</div>
            ${milestone.note ? `<p class="row-note">${escapeHTML(milestone.note)}</p>` : ""}
          </div>
        </div>
        <button class="mini-button danger" data-delete-milestone="${milestone.id}">Delete</button>
      </div>
    </article>`).join("");

    $$('[data-toggle-milestone]').forEach(button => button.addEventListener("click", () => {
      const milestone = state.milestones.find(x => x.id === button.dataset.toggleMilestone);
      if (milestone) { milestone.done = !milestone.done; saveState(); refresh(); }
    }));
    $$('[data-delete-milestone]').forEach(button => button.addEventListener("click", () => {
      state.milestones = state.milestones.filter(x => x.id !== button.dataset.deleteMilestone);
      saveState(); refresh();
    }));
  }

  function renderCuriosity() {
    const curiosities = hobbyCuriosities();
    const target = $("#curiosityList");
    if (!curiosities.length) {
      target.innerHTML = `<div class="empty-state">Nothing waiting here.</div>`;
      return;
    }
    target.innerHTML = curiosities.map(item => `<article class="curiosity-row">
      <div class="curiosity-top">
        <div class="row-main">
          <div class="row-title">${escapeHTML(item.title)}</div>
          ${item.note ? `<p class="row-note">${escapeHTML(item.note)}</p>` : ""}
          ${item.url ? `<div class="row-meta"><a href="${escapeHTML(item.url)}" target="_blank" rel="noreferrer">Open link ↗</a></div>` : ""}
        </div>
        <div class="row-actions">
          <button class="mini-button" data-promote-curiosity="${item.id}">Move to learning</button>
          <button class="mini-button danger" data-delete-curiosity="${item.id}">Delete</button>
        </div>
      </div>
    </article>`).join("");

    $$('[data-promote-curiosity]').forEach(button => button.addEventListener("click", () => {
      const curiosity = state.curiosities.find(x => x.id === button.dataset.promoteCuriosity);
      if (!curiosity) return;
      state.items.unshift({
        id: crypto.randomUUID(), hobbyId, title: curiosity.title, status: "planned", progress: 0,
        notes: curiosity.note || "", nextAction: "", tags: ["from-curiosity"], archived: false
      });
      state.curiosities = state.curiosities.filter(x => x.id !== curiosity.id);
      saveState(); refresh();
    }));
    $$('[data-delete-curiosity]').forEach(button => button.addEventListener("click", () => {
      state.curiosities = state.curiosities.filter(x => x.id !== button.dataset.deleteCuriosity);
      saveState(); refresh();
    }));
  }

  function renderArchive() {
    const archived = hobbyItems().filter(x => x.archived);
    const target = $("#archiveList");
    if (!archived.length) {
      target.innerHTML = `<div class="empty-state">Archive is empty.</div>`;
      return;
    }
    target.innerHTML = archived.map(item => `<article class="archive-row">
      <div class="archive-top"><div><div class="row-title">${escapeHTML(item.title)}</div><div class="row-meta">${escapeHTML(item.status)}</div></div>
      <div class="row-actions"><button class="mini-button" data-restore-item="${item.id}">Restore</button><button class="mini-button danger" data-delete-item="${item.id}">Delete permanently</button></div></div>
    </article>`).join("");

    $$('[data-restore-item]').forEach(button => button.addEventListener("click", () => {
      const item = state.items.find(x => x.id === button.dataset.restoreItem);
      if (item) { item.archived = false; saveState(); refresh(); }
    }));
    $$('[data-delete-item]').forEach(button => button.addEventListener("click", () => {
      if (confirm("Permanently delete this item?")) {
        state.items = state.items.filter(x => x.id !== button.dataset.deleteItem);
        saveState(); refresh();
      }
    }));
  }

  function renderActivitySelect(selected = "") {
    const select = $("#activityItemSelect");
    select.innerHTML = `<option value="">General practice</option>` + activeItems().map(item => `<option value="${item.id}">${escapeHTML(item.title)}</option>`).join("");
    select.value = selected || "";
  }

  function openItem(item = null) {
    editingItemId = item?.id || null;
    const form = $("#itemForm");
    form.reset();
    $("#itemDialogTitle").textContent = item ? "Edit learning" : "Add learning";
    if (item) {
      form.elements.title.value = item.title || "";
      form.elements.status.value = item.status || "planned";
      form.elements.progress.value = Number(item.progress || 0);
      form.elements.tags.value = (item.tags || []).join(", ");
      form.elements.notes.value = item.notes || "";
      form.elements.nextAction.value = item.nextAction || "";
    } else {
      form.elements.status.value = "planned";
      form.elements.progress.value = 0;
    }
    $("#itemDialog").showModal();
  }

  function openActivity(itemId = "") {
    const form = $("#activityForm");
    form.reset();
    form.elements.date.value = todayISO();
    form.elements.minutes.value = 30;
    renderActivitySelect(itemId);
    $("#activityDialog").showModal();
  }

  function openProject(project = null) {
    editingProjectId = project?.id || null;
    const form = $("#projectForm");
    form.reset();
    $("#projectDialogTitle").textContent = project ? "Edit project" : "Add project";
    if (project) {
      form.elements.title.value = project.title || "";
      form.elements.status.value = project.status || "active";
      form.elements.progress.value = Number(project.progress || 0);
      form.elements.description.value = project.description || "";
    } else {
      form.elements.status.value = "active";
      form.elements.progress.value = 0;
    }
    $("#projectDialog").showModal();
  }

  function openResource(projectId) {
    const form = $("#resourceForm");
    form.reset();
    form.elements.projectId.value = projectId;
    $("#resourceDialog").showModal();
  }

  function refresh() {
    renderSummary();
    renderActivity();
    renderLearning();
    renderProjects();
    renderMilestones();
    renderCuriosity();
    renderArchive();
  }

  $("#hobbyNotes").value = state.hobbyNotes[hobbyId] || "";
  let noteTimer;
  $("#hobbyNotes").addEventListener("input", event => {
    state.hobbyNotes[hobbyId] = event.target.value;
    clearTimeout(noteTimer);
    $("#notesSaved").textContent = "Saving…";
    noteTimer = setTimeout(() => {
      saveState();
      $("#notesSaved").textContent = "Saved automatically in this browser.";
    }, 300);
  });

  $("#learningSearch").addEventListener("input", renderLearning);
  $("#learningStatus").addEventListener("change", renderLearning);
  $("#addItemButton").addEventListener("click", () => openItem());
  $("#addItemButton2").addEventListener("click", () => openItem());
  $("#logActivityButton").addEventListener("click", () => openActivity());
  $("#addProjectButton").addEventListener("click", () => openProject());
  $("#addMilestoneButton").addEventListener("click", () => $("#milestoneDialog").showModal());
  $("#addCuriosityButton").addEventListener("click", () => $("#curiosityDialog").showModal());

  $$('[data-close]').forEach(button => button.addEventListener("click", () => document.getElementById(button.dataset.close)?.close()));

  $("#itemForm").addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const entry = {
      id: editingItemId || crypto.randomUUID(), hobbyId,
      title: String(data.get("title")).trim(), status: String(data.get("status")),
      progress: Math.min(100, Math.max(0, Number(data.get("progress")) || 0)),
      tags: String(data.get("tags") || "").split(",").map(x => x.trim()).filter(Boolean),
      notes: String(data.get("notes") || "").trim(), nextAction: String(data.get("nextAction") || "").trim(),
      archived: editingItemId ? Boolean(state.items.find(x => x.id === editingItemId)?.archived) : false
    };
    state.items = editingItemId ? state.items.map(x => x.id === editingItemId ? entry : x) : [entry, ...state.items];
    saveState(); $("#itemDialog").close(); refresh();
  });

  $("#activityForm").addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    state.activity.push({
      id: crypto.randomUUID(), hobbyId, date: String(data.get("date")), minutes: Number(data.get("minutes")) || 0,
      itemId: String(data.get("itemId") || ""), note: String(data.get("note") || "").trim()
    });
    saveState(); $("#activityDialog").close(); refresh();
  });

  $("#projectForm").addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const old = state.projects.find(x => x.id === editingProjectId);
    const project = {
      id: editingProjectId || crypto.randomUUID(), hobbyId,
      title: String(data.get("title")).trim(), status: String(data.get("status")),
      progress: Math.min(100, Math.max(0, Number(data.get("progress")) || 0)),
      description: String(data.get("description") || "").trim(), resources: old?.resources || []
    };
    state.projects = editingProjectId ? state.projects.map(x => x.id === editingProjectId ? project : x) : [project, ...state.projects];
    saveState(); $("#projectDialog").close(); refresh();
  });

  $("#resourceForm").addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const project = state.projects.find(x => x.id === data.get("projectId"));
    if (project) {
      project.resources = project.resources || [];
      project.resources.push({
        id: crypto.randomUUID(), label: String(data.get("label")).trim(), type: String(data.get("type") || "").trim(),
        url: String(data.get("url")).trim(), note: String(data.get("note") || "").trim()
      });
      saveState();
    }
    $("#resourceDialog").close(); renderProjects();
  });

  $("#milestoneForm").addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    state.milestones.unshift({
      id: crypto.randomUUID(), hobbyId, title: String(data.get("title")).trim(), type: String(data.get("type")),
      targetDate: String(data.get("targetDate") || ""), note: String(data.get("note") || "").trim(), done: false
    });
    saveState(); event.currentTarget.reset(); $("#milestoneDialog").close(); refresh();
  });

  $("#curiosityForm").addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    state.curiosities.unshift({
      id: crypto.randomUUID(), hobbyId, title: String(data.get("title")).trim(), url: String(data.get("url") || "").trim(), note: String(data.get("note") || "").trim()
    });
    saveState(); event.currentTarget.reset(); $("#curiosityDialog").close(); refresh();
  });

  refresh();
}

applyTheme();

if (document.body.dataset.page === "home") {
  bindThemeButton();
  bindBackupControls();
  renderHome();
} else if (window.HOBBY_PAGE) {
  initHobbyPage(window.HOBBY_PAGE);
}
