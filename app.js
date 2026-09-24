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

function normalizedStatus(status = "planned") {
  return ({
    planned: "planned",
    idea: "planned",
    learning: "active",
    active: "active",
    paused: "paused",
    learned: "done",
    done: "done"
  })[status] || "planned";
}

function normalizeState(input = {}) {
  const itemMap = new Map();

  (Array.isArray(input.items) ? input.items : []).forEach(x => {
    const item = {
      ...x,
      hobbyId: x.hobbyId || slugify(x.hobby || "general"),
      kind: x.kind === "project" ? "project" : "learning",
      status: normalizedStatus(x.status),
      archived: Boolean(x.archived),
      nextAction: x.nextAction || "",
      tags: Array.isArray(x.tags) ? x.tags : [],
      resources: Array.isArray(x.resources) ? x.resources : []
    };
    itemMap.set(item.id || crypto.randomUUID(), item);
  });

  // v3 kept projects in a separate array. Convert them once into normal items.
  (Array.isArray(input.projects) ? input.projects : []).forEach(project => {
    const id = project.id || crypto.randomUUID();
    if (itemMap.has(id)) return;
    itemMap.set(id, {
      id,
      hobbyId: project.hobbyId || slugify(project.hobby || "general"),
      kind: "project",
      title: project.title || "Untitled project",
      status: normalizedStatus(project.status),
      progress: Math.min(100, Math.max(0, Number(project.progress) || 0)),
      notes: project.description || "",
      nextAction: project.nextAction || "",
      tags: Array.isArray(project.tags) ? project.tags : [],
      resources: Array.isArray(project.resources) ? project.resources : [],
      archived: Boolean(project.archived)
    });
  });

  return {
    items: [...itemMap.values()],
    projects: [],
    milestones: Array.isArray(input.milestones) ? input.milestones.map(x => ({
      ...x,
      hobbyId: x.hobbyId || slugify(x.hobby || "general"),
      status: x.status === "achieved" || x.done ? "achieved" : "working",
      targetDate: x.targetDate || "",
      achievedDate: x.achievedDate || (x.done ? (x.targetDate || "") : ""),
      done: undefined
    })) : [],
    curiosities: Array.isArray(input.curiosities) ? input.curiosities.map(x => ({
      ...x,
      hobbyId: x.hobbyId || slugify(x.hobby || "general")
    })) : [],
    activity: Array.isArray(input.activity) ? input.activity.map(x => {
      let hobbyId = x.hobbyId;
      if (!hobbyId && x.itemId) {
        const sourceItems = Array.isArray(input.items) ? input.items : [];
        const item = sourceItems.find(item => item.id === x.itemId);
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
    try {
      const normalized = normalizeState(JSON.parse(saved));
      localStorage.setItem(STATE_KEY, JSON.stringify(normalized));
      return normalized;
    } catch {}
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
    const items = state.items.filter(x => x.hobbyId === hobby.id && !x.archived);
    const active = items.filter(x => x.status === "active").length;
    const trophies = state.milestones.filter(x => x.hobbyId === hobby.id && x.status === "achieved").length;
    return `<a class="hobby-link" href="${escapeHTML(hobby.page)}">
      <span>
        <span class="hobby-name">${escapeHTML(hobby.name)}</span>
        <span class="hobby-description">${escapeHTML(hobby.description || "")}</span>
      </span>
      <span class="hobby-meta"><span>${active} active</span><span>${trophies} milestones</span><span>→</span></span>
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
          <button id="addItemButton" class="primary-button" type="button">Add item</button>
        </div>
      </section>

      <nav class="hobby-nav" aria-label="Page sections">
        <a href="#overview">Overview</a>
        <a href="#work">Items</a>
        <a href="#milestones">Milestones</a>
        <a href="#curiosity">Curiosity</a>
        <a href="#archive">Archive</a>
      </nav>

      <section class="summary-row" aria-label="Hobby summary">
        <div class="summary-item"><span>Active</span><strong id="summaryActive">0</strong></div>
        <div class="summary-item"><span>Done</span><strong id="summaryDone">0</strong></div>
        <div class="summary-item"><span>Trophies</span><strong id="summaryTrophies">0</strong></div>
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

      <section id="work" class="section-block">
        <div class="section-heading">
          <div><h2>Learning & projects</h2><p>Everything I’m working on in one place. The type is just a tag.</p></div>
          <button id="addItemButton2" class="quiet-button" type="button">Add item</button>
        </div>
        <div class="toolbar toolbar-three">
          <input id="itemSearch" type="search" placeholder="Search items…" />
          <select id="itemStatus"><option value="all">All statuses</option><option value="planned">Planned</option><option value="active">Active</option><option value="paused">Paused</option><option value="done">Done</option></select>
          <select id="itemKind"><option value="all">All types</option><option value="learning">Learning</option><option value="project">Project</option></select>
        </div>
        <div id="itemList" class="item-list"></div>
      </section>

      <section id="milestones" class="section-block">
        <div class="section-heading">
          <div><h2>Milestones</h2><p>What I’m working toward, and a record of what I’ve achieved.</p></div>
          <button id="addMilestoneButton" class="quiet-button" type="button">Add milestone</button>
        </div>
        <div id="milestoneList"></div>
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
    <div class="dialog-heading"><h2 id="itemDialogTitle">Add item</h2><button type="button" class="dialog-close" data-close="itemDialog">×</button></div>
    <div class="form-grid">
      <label>Title<input name="title" required /></label>
      <label>Type<select name="kind"><option value="learning">Learning</option><option value="project">Project</option></select></label>
      <label>Status<select name="status"><option value="planned">Planned</option><option value="active">Active</option><option value="paused">Paused</option><option value="done">Done</option></select></label>
      <label>Progress %<input name="progress" type="number" min="0" max="100" value="0" /></label>
      <label class="full">Tags<input name="tags" placeholder="theory, technique, reference" /></label>
      <label class="full">Notes<textarea name="notes" placeholder="What I want to understand, build, or remember…"></textarea></label>
      <label class="full">Next action<input name="nextAction" placeholder="The next small thing to do" /></label>
    </div>
    <div class="dialog-actions"><button type="button" class="quiet-button" data-close="itemDialog">Cancel</button><button class="primary-button" type="submit">Save</button></div>
  </form></dialog>

  <dialog id="activityDialog"><form id="activityForm" class="dialog-body">
    <div class="dialog-heading"><h2>Log activity</h2><button type="button" class="dialog-close" data-close="activityDialog">×</button></div>
    <div class="form-grid">
      <label>Date<input name="date" type="date" required /></label>
      <label>Minutes<input name="minutes" type="number" min="1" max="1440" value="30" required /></label>
      <label class="full">Related item<select name="itemId" id="activityItemSelect"><option value="">General practice</option></select></label>
      <label class="full">Note<input name="note" placeholder="What I worked on" /></label>
    </div>
    <div class="dialog-actions"><button type="button" class="quiet-button" data-close="activityDialog">Cancel</button><button class="primary-button" type="submit">Save</button></div>
  </form></dialog>

  <dialog id="resourceDialog"><form id="resourceForm" class="dialog-body">
    <div class="dialog-heading"><h2>Add resource</h2><button type="button" class="dialog-close" data-close="resourceDialog">×</button></div>
    <input name="itemId" type="hidden" />
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
      <label>Status<select name="status"><option value="working">Working toward</option><option value="achieved">Already achieved</option></select></label>
      <label>Date (optional)<input name="date" type="date" /></label>
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

  const hobbyItems = () => state.items.filter(x => x.hobbyId === hobbyId);
  const activeItems = () => hobbyItems().filter(x => !x.archived);
  const hobbyMilestones = () => state.milestones.filter(x => x.hobbyId === hobbyId);
  const hobbyCuriosities = () => state.curiosities.filter(x => x.hobbyId === hobbyId);
  const hobbyActivity = () => state.activity.filter(x => x.hobbyId === hobbyId);

  function renderSummary() {
    $("#summaryActive").textContent = activeItems().filter(x => x.status === "active").length;
    $("#summaryDone").textContent = activeItems().filter(x => x.status === "done").length;
    $("#summaryTrophies").textContent = hobbyMilestones().filter(x => x.status === "achieved").length;
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

  function renderItems() {
    const query = $("#itemSearch").value.trim().toLowerCase();
    const status = $("#itemStatus").value;
    const kind = $("#itemKind").value;
    const order = { active: 0, planned: 1, paused: 2, done: 3 };

    const items = activeItems().filter(item => {
      const haystack = [item.title, item.notes, item.nextAction, ...(item.tags || [])].join(" ").toLowerCase();
      return (!query || haystack.includes(query)) &&
        (status === "all" || item.status === status) &&
        (kind === "all" || item.kind === kind);
    }).sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));

    const target = $("#itemList");
    if (!items.length) {
      target.innerHTML = `<div class="empty-state">Nothing here yet.</div>`;
      return;
    }

    target.innerHTML = items.map(item => {
      const isProject = item.kind === "project";
      const resources = Array.isArray(item.resources) ? item.resources : [];
      return `<article class="item-row">
        <div class="item-top">
          <div class="row-main">
            <div class="row-labels"><span class="type-tag">${isProject ? "Project" : "Learning"}</span><span class="status">${escapeHTML(item.status)}</span></div>
            <div class="row-title item-title">${escapeHTML(item.title)}</div>
            ${item.notes ? `<p class="row-note">${escapeHTML(item.notes)}</p>` : ""}
            ${item.nextAction ? `<p class="row-next"><strong>Next:</strong> ${escapeHTML(item.nextAction)}</p>` : ""}
            ${(item.tags || []).length ? `<div class="tag-row">${item.tags.map(tag => `<span class="tag">#${escapeHTML(tag)}</span>`).join("")}</div>` : ""}
          </div>
          <div class="row-actions">
            <button class="mini-button" data-log-item="${item.id}">Log</button>
            ${isProject ? `<button class="mini-button" data-add-resource="${item.id}">Add resource</button>` : ""}
            <button class="mini-button" data-edit-item="${item.id}">Edit</button>
            <button class="mini-button" data-archive-item="${item.id}">Archive</button>
          </div>
        </div>
        <div class="row-meta">${Number(item.progress || 0)}% complete</div>
        <div class="progress-line"><span style="width:${Math.min(100, Math.max(0, Number(item.progress || 0)))}%"></span></div>
        ${isProject ? `<div class="resource-shelf">
          <div class="resource-heading"><h4>Resources</h4><span class="muted">${resources.length}</span></div>
          ${resources.length ? resources.map(resource => `<div class="resource-row">
            <div><a href="${escapeHTML(resource.url)}" target="_blank" rel="noreferrer">${escapeHTML(resource.label)} ↗</a><small>${escapeHTML(resource.type || "Resource")}${resource.note ? ` · ${escapeHTML(resource.note)}` : ""}</small></div>
            <button class="mini-button danger" data-delete-resource="${resource.id}" data-item-id="${item.id}">Remove</button>
          </div>`).join("") : `<div class="empty-state compact-empty">No resources saved for this project.</div>`}
        </div>` : ""}
      </article>`;
    }).join("");

    $$('[data-log-item]').forEach(button => button.addEventListener("click", () => openActivity(button.dataset.logItem)));
    $$('[data-edit-item]').forEach(button => button.addEventListener("click", () => openItem(state.items.find(x => x.id === button.dataset.editItem))));
    $$('[data-archive-item]').forEach(button => button.addEventListener("click", () => {
      const item = state.items.find(x => x.id === button.dataset.archiveItem);
      if (item) { item.archived = true; saveState(); refresh(); }
    }));
    $$('[data-add-resource]').forEach(button => button.addEventListener("click", () => openResource(button.dataset.addResource)));
    $$('[data-delete-resource]').forEach(button => button.addEventListener("click", () => {
      const item = state.items.find(x => x.id === button.dataset.itemId);
      if (item) {
        item.resources = (item.resources || []).filter(x => x.id !== button.dataset.deleteResource);
        saveState(); renderItems();
      }
    }));
  }

  function renderMilestones() {
    const milestones = hobbyMilestones();
    const working = milestones.filter(x => x.status !== "achieved");
    const achieved = milestones.filter(x => x.status === "achieved")
      .sort((a, b) => String(b.achievedDate || "").localeCompare(String(a.achievedDate || "")));
    const target = $("#milestoneList");

    const workingHTML = working.length ? working.map(milestone => `<article class="milestone-row">
      <div class="milestone-top">
        <div class="row-main">
          <div class="row-title">${escapeHTML(milestone.title)}</div>
          <div class="row-meta">${escapeHTML(milestone.type || "custom")}${milestone.targetDate ? ` · target ${formatDate(milestone.targetDate)}` : ""}</div>
          ${milestone.note ? `<p class="row-note">${escapeHTML(milestone.note)}</p>` : ""}
        </div>
        <div class="row-actions">
          <button class="mini-button" data-achieve-milestone="${milestone.id}">Mark achieved</button>
          <button class="mini-button danger" data-delete-milestone="${milestone.id}">Delete</button>
        </div>
      </div>
    </article>`).join("") : `<div class="empty-state compact-empty">Nothing in progress.</div>`;

    const trophyHTML = achieved.length ? achieved.map(milestone => `<article class="trophy-card">
      <div class="trophy-mark" aria-hidden="true">🏆</div>
      <div class="trophy-title">${escapeHTML(milestone.title)}</div>
      <div class="row-meta">${escapeHTML(milestone.type || "custom")}${milestone.achievedDate ? ` · ${formatDate(milestone.achievedDate)}` : ""}</div>
      ${milestone.note ? `<p class="row-note">${escapeHTML(milestone.note)}</p>` : ""}
      <div class="trophy-actions">
        <button class="mini-button" data-reopen-milestone="${milestone.id}">Move back</button>
        <button class="mini-button danger" data-delete-milestone="${milestone.id}">Delete</button>
      </div>
    </article>`).join("") : `<div class="empty-state trophy-empty">Completed milestones will appear here.</div>`;

    target.innerHTML = `<div class="milestone-groups">
      <div class="milestone-working">
        <div class="subsection-heading"><h3>Working toward</h3><span class="muted">${working.length}</span></div>
        <div class="milestone-list">${workingHTML}</div>
      </div>
      <div class="trophy-section">
        <div class="subsection-heading"><h3>Trophy case</h3><span class="muted">${achieved.length}</span></div>
        <div class="trophy-grid">${trophyHTML}</div>
      </div>
    </div>`;

    $$('[data-achieve-milestone]').forEach(button => button.addEventListener("click", () => {
      const milestone = state.milestones.find(x => x.id === button.dataset.achieveMilestone);
      if (milestone) {
        milestone.status = "achieved";
        milestone.achievedDate = todayISO();
        saveState(); refresh();
      }
    }));
    $$('[data-reopen-milestone]').forEach(button => button.addEventListener("click", () => {
      const milestone = state.milestones.find(x => x.id === button.dataset.reopenMilestone);
      if (milestone) {
        milestone.status = "working";
        milestone.achievedDate = "";
        saveState(); refresh();
      }
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
          <button class="mini-button" data-promote-curiosity="${item.id}">Move to items</button>
          <button class="mini-button danger" data-delete-curiosity="${item.id}">Delete</button>
        </div>
      </div>
    </article>`).join("");

    $$('[data-promote-curiosity]').forEach(button => button.addEventListener("click", () => {
      const curiosity = state.curiosities.find(x => x.id === button.dataset.promoteCuriosity);
      if (!curiosity) return;
      state.items.unshift({
        id: crypto.randomUUID(), hobbyId, kind: "learning", title: curiosity.title, status: "planned", progress: 0,
        notes: curiosity.note || "", nextAction: "", tags: ["from-curiosity"], resources: [], archived: false
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
      <div class="archive-top"><div><div class="row-title">${escapeHTML(item.title)}</div><div class="row-meta">${item.kind === "project" ? "Project" : "Learning"} · ${escapeHTML(item.status)}</div></div>
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
    $("#itemDialogTitle").textContent = item ? "Edit item" : "Add item";
    if (item) {
      form.elements.title.value = item.title || "";
      form.elements.kind.value = item.kind || "learning";
      form.elements.status.value = item.status || "planned";
      form.elements.progress.value = Number(item.progress || 0);
      form.elements.tags.value = (item.tags || []).join(", ");
      form.elements.notes.value = item.notes || "";
      form.elements.nextAction.value = item.nextAction || "";
    } else {
      form.elements.kind.value = "learning";
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

  function openResource(itemId) {
    const form = $("#resourceForm");
    form.reset();
    form.elements.itemId.value = itemId;
    $("#resourceDialog").showModal();
  }

  function refresh() {
    renderSummary();
    renderActivity();
    renderItems();
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

  $("#itemSearch").addEventListener("input", renderItems);
  $("#itemStatus").addEventListener("change", renderItems);
  $("#itemKind").addEventListener("change", renderItems);
  $("#addItemButton").addEventListener("click", () => openItem());
  $("#addItemButton2").addEventListener("click", () => openItem());
  $("#logActivityButton").addEventListener("click", () => openActivity());
  $("#addMilestoneButton").addEventListener("click", () => $("#milestoneDialog").showModal());
  $("#addCuriosityButton").addEventListener("click", () => $("#curiosityDialog").showModal());

  $$('[data-close]').forEach(button => button.addEventListener("click", () => document.getElementById(button.dataset.close)?.close()));

  $("#itemForm").addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const old = state.items.find(x => x.id === editingItemId);
    const entry = {
      id: editingItemId || crypto.randomUUID(), hobbyId,
      title: String(data.get("title")).trim(), kind: String(data.get("kind")), status: String(data.get("status")),
      progress: Math.min(100, Math.max(0, Number(data.get("progress")) || 0)),
      tags: String(data.get("tags") || "").split(",").map(x => x.trim()).filter(Boolean),
      notes: String(data.get("notes") || "").trim(), nextAction: String(data.get("nextAction") || "").trim(),
      resources: old?.resources || [], archived: old?.archived || false
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

  $("#resourceForm").addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const item = state.items.find(x => x.id === data.get("itemId"));
    if (item) {
      item.resources = item.resources || [];
      item.resources.push({
        id: crypto.randomUUID(), label: String(data.get("label")).trim(), type: String(data.get("type") || "").trim(),
        url: String(data.get("url")).trim(), note: String(data.get("note") || "").trim()
      });
      saveState();
    }
    $("#resourceDialog").close(); renderItems();
  });

  $("#milestoneForm").addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const status = String(data.get("status"));
    const date = String(data.get("date") || "");
    state.milestones.unshift({
      id: crypto.randomUUID(), hobbyId, title: String(data.get("title")).trim(), type: String(data.get("type")),
      status, targetDate: status === "working" ? date : "", achievedDate: status === "achieved" ? (date || todayISO()) : "",
      note: String(data.get("note") || "").trim()
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
