const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let db = null;
let currentUser = null;
let state = emptyState();
let editingItemId = null;
let editingActivityId = null;
let editingResourceId = null;
const signedImageCache = new Map();

function emptyState() {
  return {
    items: [],
    resources: [],
    milestones: [],
    curiosities: [],
    activity: [],
    hobbyNotes: {}
  };
}

function isOwnerMode() {
  return Boolean(currentUser);
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function normalizeWebUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";

  let candidate = raw;
  if (candidate.startsWith("//")) candidate = `https:${candidate}`;
  else if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;

  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatDate(value, includeYear = true) {
  if (!value) return "";
  const date = value.includes?.("T") ? new Date(value) : new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  const options = includeYear
    ? { day: "numeric", month: "short", year: "numeric" }
    : { day: "numeric", month: "short" };
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

function monthName(monthIndex) {
  return new Intl.DateTimeFormat(undefined, { month: "long" }).format(new Date(2026, monthIndex, 1));
}

function minutesLabel(minutes) {
  const total = Number(minutes || 0);
  if (total < 60) return `${total}m`;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
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
  entries.forEach(entry => {
    totals.set(entry.date, (totals.get(entry.date) || 0) + Number(entry.minutes || 0));
  });

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

function isConfigured() {
  const config = window.SUPABASE_CONFIG || {};
  return Boolean(
    config.url &&
    config.publishableKey &&
    !config.url.includes("YOUR-PROJECT") &&
    !config.publishableKey.includes("REPLACE_ME")
  );
}

function createDatabaseClient() {
  const config = window.SUPABASE_CONFIG;
  return window.supabase.createClient(config.url, config.publishableKey, {
    auth: {
      storage: window.sessionStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
}

function resolveHobbyPageConfig() {
  if (window.HOBBY_PAGE) return window.HOBBY_PAGE;
  const id = window.HOBBY_PAGE_ID;
  const registry = Array.isArray(window.HOBBIES) ? window.HOBBIES : [];
  return registry.find(hobby => hobby.id === id) || null;
}

function defaultItemVisibility() {
  return window.SUPABASE_CONFIG?.defaultItemVisibility === "private" ? "private" : "public";
}

function defaultPublicHeatmap() {
  return window.SUPABASE_CONFIG?.publicHeatmapByDefault !== false;
}

function initialTheme() {
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    document.body.classList.add("dark");
  }
}

function bindThemeButton() {
  const button = $("#themeToggle");
  if (!button) return;
  button.textContent = document.body.classList.contains("dark") ? "Light" : "Dark";
  button.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    button.textContent = document.body.classList.contains("dark") ? "Light" : "Dark";
  });
}

function renderSetupRequired(message = "") {
  $("#app").className = "";
  $("#app").innerHTML = `
    <main class="auth-shell page-width">
      <section class="auth-panel">
        <p class="eyebrow">DATABASE SETUP</p>
        <h1>Connect Supabase</h1>
        <p>This copy of the site has not been connected to its database yet.</p>
        <ol class="setup-list">
          <li>Create a Supabase project.</li>
          <li>Run <code>supabase-setup.sql</code> in its SQL Editor.</li>
          <li>Put the Project URL and publishable key into <code>config.js</code>.</li>
        </ol>
        ${message ? `<p class="error-note">${escapeHTML(message)}</p>` : ""}
        <p class="muted copy-small">Full instructions are included in <code>SUPABASE_SETUP.md</code>.</p>
      </section>
    </main>`;
}

function renderAuth(message = "") {
  $("#app").className = "";
  $("#app").innerHTML = `
    <main class="auth-shell page-width">
      <section class="auth-panel">
        <p class="eyebrow">OWNER ACCESS</p>
        <h1>Sign in</h1>
        <p class="muted">Signing in unlocks private notes and editing. The public journal remains readable without an account.</p>
        <form id="authForm" class="auth-form">
          <label>Email<input name="email" type="email" autocomplete="email" required /></label>
          <label>Password<input name="password" type="password" autocomplete="current-password" minlength="6" required /></label>
          <div class="button-row">
            <button class="primary-button" type="submit">Sign in</button>
            ${window.SUPABASE_CONFIG?.showCreateAccount !== false ? `<button class="quiet-button" id="createAccountButton" type="button">Create account</button>` : ""}
          </div>
        </form>
        <p id="authMessage" class="auth-message ${message ? "visible" : ""}">${escapeHTML(message)}</p>
        <button class="text-button auth-back" id="backToPublicButton" type="button">← Back to public site</button>
        <p class="muted copy-small auth-help">${window.SUPABASE_CONFIG?.showCreateAccount !== false ? "The create-account button is only needed for the first account. After that, disable new signups in Supabase." : "Use the account already created for this journal."}</p>
      </section>
    </main>`;

  const form = $("#authForm");
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const data = new FormData(form);
    setAuthMessage("Signing in…");
    const { error } = await db.auth.signInWithPassword({
      email: String(data.get("email")).trim(),
      password: String(data.get("password"))
    });
    if (error) {
      setAuthMessage(error.message, true);
      return;
    }
    await enterAuthenticatedApp();
  });

  $("#createAccountButton")?.addEventListener("click", async () => {
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    setAuthMessage("Creating account…");
    const redirectTo = window.location.href.split("#")[0].split("?")[0];
    const { data: result, error } = await db.auth.signUp({
      email: String(data.get("email")).trim(),
      password: String(data.get("password")),
      options: { emailRedirectTo: redirectTo }
    });
    if (error) {
      setAuthMessage(error.message, true);
      return;
    }
    if (result.session) {
      await enterAuthenticatedApp();
    } else {
      setAuthMessage("Account created. Check your email and open the confirmation link, then return here and sign in.");
    }
  });

  $("#backToPublicButton")?.addEventListener("click", enterPublicApp);
}

function setAuthMessage(message, isError = false) {
  const target = $("#authMessage");
  if (!target) return;
  target.textContent = message;
  target.classList.add("visible");
  target.classList.toggle("error-note", isError);
}

async function signOut() {
  await db.auth.signOut();
  currentUser = null;
  await enterPublicApp();
}

function bindGlobalHeader() {
  bindThemeButton();
  $("#signOutButton")?.addEventListener("click", signOut);
  $("#signInButton")?.addEventListener("click", () => renderAuth());
}

function mapItem(row) {
  return {
    id: row.id,
    hobbyId: row.hobby_id,
    title: row.title,
    kind: row.kind,
    status: row.status,
    progress: row.progress,
    tags: row.tags || [],
    notes: row.notes || "",
    nextAction: row.next_action || "",
    archived: Boolean(row.archived),
    isFocus: Boolean(row.is_focus),
    visibility: row.visibility || "public",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    touchedAt: row.touched_at,
    completedAt: row.completed_at,
    resources: []
  };
}

function mapResource(row) {
  return {
    id: row.id,
    hobbyId: row.hobby_id || "",
    itemId: row.item_id || "",
    label: row.label,
    type: row.type || "",
    url: row.url,
    note: row.note || "",
    visibility: row.visibility || "public",
    createdAt: row.created_at
  };
}

function mapMilestone(row) {
  return {
    id: row.id,
    hobbyId: row.hobby_id,
    title: row.title,
    type: row.type,
    status: row.status,
    targetDate: row.target_date || "",
    achievedDate: row.achieved_date || "",
    note: row.note || "",
    imagePath: row.image_path || "",
    visibility: row.visibility || "auto",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapCuriosity(row) {
  return {
    id: row.id,
    hobbyId: row.hobby_id,
    title: row.title,
    url: row.url || "",
    note: row.note || "",
    createdAt: row.created_at
  };
}

function mapActivity(row) {
  return {
    id: row.id || `${row.hobby_id}-${row.activity_date}-${row.minutes}-${Math.random()}`,
    hobbyId: row.hobby_id,
    itemId: row.item_id || "",
    date: row.activity_date,
    minutes: row.minutes,
    note: row.note || "",
    publicHeatmap: row.public_heatmap !== false,
    createdAt: row.created_at || ""
  };
}

function attachResources(items, resources) {
  const resourceMap = new Map();
  resources.forEach(resource => {
    if (!resource.itemId) return;
    if (!resourceMap.has(resource.itemId)) resourceMap.set(resource.itemId, []);
    resourceMap.get(resource.itemId).push(resource);
  });
  items.forEach(item => item.resources = resourceMap.get(item.id) || []);
}

async function loadOwnerState() {
  const [itemsResult, resourcesResult, milestonesResult, curiositiesResult, activityResult, notesResult] = await Promise.all([
    db.from("items").select("*").order("touched_at", { ascending: false }),
    db.from("resources").select("*").order("created_at", { ascending: true }),
    db.from("milestones").select("*").order("created_at", { ascending: false }),
    db.from("curiosities").select("*").order("created_at", { ascending: false }),
    db.from("activity").select("*").order("activity_date", { ascending: false }).order("created_at", { ascending: false }),
    db.from("hobby_notes").select("*")
  ]);

  const failure = [itemsResult, resourcesResult, milestonesResult, curiositiesResult, activityResult, notesResult].find(x => x.error);
  if (failure) throw failure.error;

  const items = itemsResult.data.map(mapItem);
  const resources = resourcesResult.data.map(mapResource);
  attachResources(items, resources);

  state = {
    items,
    resources,
    milestones: milestonesResult.data.map(mapMilestone),
    curiosities: curiositiesResult.data.map(mapCuriosity),
    activity: activityResult.data.map(mapActivity),
    hobbyNotes: Object.fromEntries(notesResult.data.map(row => [row.hobby_id, row.content || ""]))
  };
}

async function loadPublicState() {
  const [itemsResult, resourcesResult, milestonesResult, activityResult] = await Promise.all([
    db.from("items").select("id,hobby_id,title,kind,status,progress,tags,notes,archived,visibility,created_at,updated_at,touched_at,completed_at").order("touched_at", { ascending: false }),
    db.from("resources").select("id,hobby_id,item_id,label,type,url,note,visibility,created_at").order("created_at", { ascending: true }),
    db.from("milestones").select("id,hobby_id,title,type,status,target_date,achieved_date,note,image_path,visibility,created_at,updated_at").order("created_at", { ascending: false }),
    db.from("activity").select("hobby_id,activity_date,minutes").order("activity_date", { ascending: false })
  ]);

  const failure = [itemsResult, resourcesResult, milestonesResult, activityResult].find(x => x.error);
  if (failure) throw failure.error;

  const items = itemsResult.data.map(mapItem);
  const resources = resourcesResult.data.map(mapResource);
  attachResources(items, resources);

  state = {
    items,
    resources,
    milestones: milestonesResult.data.map(mapMilestone),
    curiosities: [],
    activity: activityResult.data.map(mapActivity),
    hobbyNotes: {}
  };
}

async function reloadState() {
  if (isOwnerMode()) await loadOwnerState();
  else await loadPublicState();
}

function showDataError(error) {
  console.error(error);
  const message = error?.message || "Something went wrong while saving.";
  alert(message);
}

async function runWrite(operation) {
  if (!currentUser) throw new Error("Sign in to make changes.");
  try {
    const result = await operation();
    if (result?.error) throw result.error;
    return result;
  } catch (error) {
    showDataError(error);
    throw error;
  }
}

function exportSnapshot() {
  const data = {
    exportedAt: new Date().toISOString(),
    items: state.items,
    resources: state.resources,
    milestones: state.milestones,
    curiosities: state.curiosities,
    activity: state.activity,
    hobbyNotes: state.hobbyNotes
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `my-hobbies-snapshot-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function headerActions() {
  return `<div class="button-row">
    <button class="quiet-button" id="themeToggle" type="button">Dark</button>
    ${isOwnerMode()
      ? `<button class="text-button" id="signOutButton" type="button">Sign out</button>`
      : `<button class="text-button" id="signInButton" type="button">Sign in</button>`}
  </div>`;
}

function homeDialogMarkup() {
  const hobbies = Array.isArray(window.HOBBIES) ? window.HOBBIES : [];
  return `
  <dialog id="curiosityDialog"><form id="curiosityForm" class="dialog-body">
    <div class="dialog-heading"><h2>Add curiosity</h2><button type="button" class="dialog-close" data-close="curiosityDialog">×</button></div>
    <div class="form-grid">
      <label class="full">What caught my attention?<input name="title" required /></label>
      <label class="full">Link (optional)<input name="url" type="text" inputmode="url" autocomplete="url" placeholder="youtube.com or https://…" /></label>
      <label class="full">Note<textarea name="note" placeholder="Why this looked interesting"></textarea></label>
    </div>
    <div class="dialog-actions"><button type="button" class="quiet-button" data-close="curiosityDialog">Cancel</button><button class="primary-button" type="submit">Save</button></div>
  </form></dialog>

  <dialog id="promoteCuriosityDialog"><form id="promoteCuriosityForm" class="dialog-body">
    <div class="dialog-heading"><h2>Move to a hobby</h2><button type="button" class="dialog-close" data-close="promoteCuriosityDialog">×</button></div>
    <input name="curiosityId" type="hidden" />
    <div class="form-grid">
      <label>Hobby<select name="hobbyId" required>${hobbies.map(hobby => `<option value="${escapeHTML(hobby.id)}">${escapeHTML(hobby.name)}</option>`).join("")}</select></label>
      <label>Type<select name="kind"><option value="learning">Learning</option><option value="project">Project</option></select></label>
    </div>
    <p class="form-note">This creates a planned item. If the curiosity has a link, it is kept as a hobby resource.</p>
    <div class="dialog-actions"><button type="button" class="quiet-button" data-close="promoteCuriosityDialog">Cancel</button><button class="primary-button" type="submit">Move</button></div>
  </form></dialog>`;
}

function renderHome() {
  const allHobbies = Array.isArray(window.HOBBIES) ? window.HOBBIES : [];
  const registry = allHobbies;
  const owner = isOwnerMode();
  document.title = "My Hobbies";
  $("#app").className = "";
  $("#app").innerHTML = `
    <header class="site-header">
      <div class="page-width header-inner">
        <a class="site-title" href="index.html">My Hobbies</a>
        ${headerActions()}
      </div>
    </header>

    <main class="page-width home-main">
      <section class="home-intro">
        <h1>My hobbies</h1>
        <p>A quiet place to keep track of what I’m learning, making, practicing, and saving for later.</p>
      </section>

      <section aria-labelledby="hobbiesTitle">
        <div class="section-line">
          <h2 id="hobbiesTitle">Hobbies</h2>
          <span class="muted">${registry.length} ${registry.length === 1 ? "hobby" : "hobbies"}</span>
        </div>
        <div class="hobby-list">${registry.map(hobby => {
          const items = state.items.filter(x => x.hobbyId === hobby.id && !x.archived);
          const active = items.filter(x => x.status === "active").length;
          const done = items.filter(x => x.status === "done").length;
          const trophies = state.milestones.filter(x => x.hobbyId === hobby.id && x.status === "achieved").length;
          return `<a class="hobby-link" href="${escapeHTML(hobby.page)}">
            <span>
              <span class="hobby-name">${escapeHTML(hobby.name)}</span>
              <span class="hobby-description">${escapeHTML(hobby.description || "")}</span>
            </span>
            <span class="hobby-meta"><span>${active} active</span><span>${done} done</span><span>${trophies} trophies</span><span>→</span></span>
          </a>`;
        }).join("")}</div>
      </section>

      <section class="home-search-section" aria-labelledby="searchTitle">
        <div class="section-line"><h2 id="searchTitle">Search</h2><span class="muted">Across hobbies</span></div>
        <input id="globalSearch" class="global-search-input" type="search" placeholder="Search items, resources, and milestones…" autocomplete="off" />
        <div id="globalSearchResults" class="global-search-results" hidden></div>
      </section>

      <section class="home-grid ${owner ? "" : "public-home-grid"}">
        <div class="plain-panel">
          <div class="section-line">
            <h2>Activity</h2>
            <span id="totalMinutes" class="muted"></span>
          </div>
          <div class="heatmap-wrap"><div id="homeHeatmap" class="heatmap" aria-label="Overall activity heatmap"></div></div>
          ${owner ? `<div id="recentActivity" class="simple-list"></div>` : `<p class="muted copy-small public-view-note">The heatmap is public; activity notes remain private.</p>`}
        </div>

        ${owner ? `<div class="plain-panel database-panel">
          <h2>Saved</h2>
          <p class="muted copy-small">Changes are stored in Supabase and available on my other devices after I sign in.</p>
          <div class="database-status"><span class="status-dot"></span><span>${escapeHTML(currentUser.email || "Signed in")}</span></div>
          <button id="exportButton" class="quiet-button" type="button">Download snapshot</button>
        </div>` : ""}
      </section>

      ${owner ? `<section class="home-owner-grid">
        <div class="plain-panel home-section-panel">
          <div class="section-line"><h2>Recently touched</h2><span class="muted">Latest 5</span></div>
          <div id="recentlyTouched" class="simple-list"></div>
        </div>
        <div class="plain-panel home-section-panel">
          <div class="section-line"><div><h2>Curiosity inbox</h2><p class="home-section-copy">Things that look interesting before I decide where they belong.</p></div><button id="addCuriosityButton" class="quiet-button" type="button">Add</button></div>
          <div id="curiosityList" class="curiosity-list"></div>
        </div>
      </section>` : ""}
    </main>

    <footer class="page-width footer"><span>Personal hobby journal</span></footer>
    ${owner ? homeDialogMarkup() : ""}`;

  const activity = [...state.activity].sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`));
  buildHeatmap($("#homeHeatmap"), activity);
  $("#totalMinutes").textContent = `${minutesLabel(activity.reduce((sum, x) => sum + Number(x.minutes || 0), 0))} logged`;

  function hobbyFor(id) {
    return allHobbies.find(x => x.id === id);
  }

  function resultLink(hobbyId, hash = "") {
    const hobby = hobbyFor(hobbyId);
    return hobby ? `${hobby.page}${hash}` : "#";
  }

  function renderGlobalSearch() {
    const query = ($("#globalSearch")?.value || "").trim().toLowerCase();
    const target = $("#globalSearchResults");
    if (!target) return;
    if (!query) {
      target.hidden = true;
      target.innerHTML = "";
      return;
    }

    const results = [];
    state.items.filter(item => !item.archived).forEach(item => {
      const haystack = [item.title, item.notes, item.nextAction, ...(item.tags || [])].join(" ").toLowerCase();
      if (haystack.includes(query)) results.push({ hobbyId: item.hobbyId, type: itemKindLabel(item.kind), title: item.title, detail: itemStatusLabel(item.status), href: resultLink(item.hobbyId, `#item-${item.id}`) });
    });
    state.resources.forEach(resource => {
      const haystack = [resource.label, resource.type, resource.note, resource.url].join(" ").toLowerCase();
      if (!haystack.includes(query)) return;
      const parent = resource.itemId ? state.items.find(item => item.id === resource.itemId) : null;
      results.push({ hobbyId: resource.hobbyId || parent?.hobbyId || "", type: "Resource", title: resource.label, detail: resource.type || (parent ? `For ${parent.title}` : "Hobby resource"), href: resultLink(resource.hobbyId || parent?.hobbyId, parent ? `#item-${parent.id}` : "#resources") });
    });
    state.milestones.forEach(milestone => {
      const haystack = [milestone.title, milestone.type, milestone.note].join(" ").toLowerCase();
      if (haystack.includes(query)) results.push({ hobbyId: milestone.hobbyId, type: "Milestone", title: milestone.title, detail: milestone.status === "achieved" ? "Achieved" : "Working toward", href: resultLink(milestone.hobbyId, "#milestones") });
    });

    target.hidden = false;
    target.innerHTML = results.length ? results.slice(0, 12).map(result => {
      const hobby = hobbyFor(result.hobbyId);
      return `<a class="search-result-row" href="${escapeHTML(result.href)}"><span><span class="search-result-title">${escapeHTML(result.title)}</span><span class="row-meta">${escapeHTML(result.type)}${result.detail ? ` · ${escapeHTML(result.detail)}` : ""}</span></span><span class="muted">${escapeHTML(hobby?.name || result.hobbyId || "")}</span></a>`;
    }).join("") : `<div class="empty-state compact-empty">No matches.</div>`;
  }

  $("#globalSearch")?.addEventListener("input", renderGlobalSearch);

  if (owner) {
    const recent = activity.slice(0, 6);
    const recentTarget = $("#recentActivity");
    recentTarget.innerHTML = recent.length ? recent.map(entry => {
      const hobby = hobbyFor(entry.hobbyId);
      const item = state.items.find(x => x.id === entry.itemId);
      return `<div class="simple-row">
        <span>${escapeHTML(entry.note || item?.title || "Practice session")}</span>
        <span class="muted">${escapeHTML(hobby?.name || entry.hobbyId)} · ${entry.minutes} min · ${formatDate(entry.date)}</span>
      </div>`;
    }).join("") : `<div class="empty-state">No activity logged yet.</div>`;

    const touched = state.items
      .filter(item => !item.archived && item.touchedAt)
      .sort((a, b) => String(b.touchedAt).localeCompare(String(a.touchedAt)))
      .slice(0, 5);
    $("#recentlyTouched").innerHTML = touched.length ? touched.map(item => {
      const hobby = hobbyFor(item.hobbyId);
      return `<a class="recent-touch-row" href="${escapeHTML(resultLink(item.hobbyId, `#item-${item.id}`))}"><span><span class="row-title">${escapeHTML(item.title)}</span><span class="row-meta">${escapeHTML(hobby?.name || item.hobbyId)} · ${itemKindLabel(item.kind)} · ${itemStatusLabel(item.status)}</span></span><span class="muted">${formatDate(item.touchedAt)}</span></a>`;
    }).join("") : `<div class="empty-state compact-empty">Nothing touched yet.</div>`;

    function renderHomeCuriosity() {
      const target = $("#curiosityList");
      const curiosities = [...state.curiosities].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      target.innerHTML = curiosities.length ? curiosities.map(item => {
        const oldHobby = item.hobbyId ? hobbyFor(item.hobbyId) : null;
        return `<article class="curiosity-row"><div class="curiosity-top"><div class="row-main"><div class="row-title">${escapeHTML(item.title)}</div>${oldHobby ? `<div class="row-meta">Previously filed under ${escapeHTML(oldHobby.name)}</div>` : ""}${item.note ? `<p class="row-note">${escapeHTML(item.note)}</p>` : ""}${item.url ? `<div class="row-meta"><a href="${escapeHTML(item.url)}" target="_blank" rel="noreferrer">Open link ↗</a></div>` : ""}</div><div class="row-actions"><button class="mini-button" data-promote-curiosity="${item.id}" type="button">Move to hobby</button><button class="text-button danger" data-delete-curiosity="${item.id}" type="button">Delete</button></div></div></article>`;
      }).join("") : `<div class="empty-state compact-empty">Nothing waiting here.</div>`;

      $$('[data-promote-curiosity]').forEach(button => button.addEventListener("click", () => {
        const form = $("#promoteCuriosityForm");
        form.reset();
        form.elements.curiosityId.value = button.dataset.promoteCuriosity;
        $("#promoteCuriosityDialog").showModal();
      }));
      $$('[data-delete-curiosity]').forEach(button => button.addEventListener("click", async () => {
        const curiosity = state.curiosities.find(x => x.id === button.dataset.deleteCuriosity);
        if (!curiosity || !confirm(`Delete “${curiosity.title}”?`)) return;
        await runWrite(() => db.from("curiosities").delete().eq("id", curiosity.id));
        await reloadState();
        renderHome();
      }));
    }

    renderHomeCuriosity();
    $("#exportButton")?.addEventListener("click", exportSnapshot);
    $("#addCuriosityButton")?.addEventListener("click", () => {
      $("#curiosityForm").reset();
      $("#curiosityDialog").showModal();
    });
    $$('[data-close]').forEach(button => button.addEventListener("click", () => document.getElementById(button.dataset.close)?.close()));

    $("#curiosityForm")?.addEventListener("submit", async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const curiosityUrl = normalizeWebUrl(data.get("url"));
      if (curiosityUrl === null) {
        alert("That link does not look like a valid web address.");
        return;
      }
      await runWrite(() => db.from("curiosities").insert({
        hobby_id: null,
        title: String(data.get("title")).trim(),
        url: curiosityUrl,
        note: String(data.get("note") || "").trim()
      }));
      await reloadState();
      $("#curiosityDialog").close();
      renderHome();
    });

    $("#promoteCuriosityForm")?.addEventListener("submit", async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const curiosity = state.curiosities.find(x => x.id === String(data.get("curiosityId")));
      if (!curiosity) return;
      const hobbyId = String(data.get("hobbyId"));
      const kind = String(data.get("kind"));
      const now = new Date().toISOString();
      await runWrite(() => db.from("items").insert({
        hobby_id: hobbyId,
        title: curiosity.title,
        kind,
        status: "planned",
        progress: 0,
        notes: curiosity.note || "",
        next_action: "",
        tags: ["from-curiosity"],
        visibility: defaultItemVisibility(),
        touched_at: now
      }));
      if (curiosity.url) {
        await runWrite(() => db.from("resources").insert({
          hobby_id: hobbyId,
          item_id: null,
          label: curiosity.title,
          type: "Reference",
          url: curiosity.url,
          note: "Saved from curiosity inbox",
          visibility: defaultItemVisibility()
        }));
      }
      await runWrite(() => db.from("curiosities").delete().eq("id", curiosity.id));
      await reloadState();
      $("#promoteCuriosityDialog").close();
      renderHome();
    });
  }

  bindGlobalHeader();
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
    <div class="dialog-heading"><h2 id="activityDialogTitle">Log activity</h2><button type="button" class="dialog-close" data-close="activityDialog">×</button></div>
    <div class="form-grid">
      <label>Date<input name="date" type="date" required /></label>
      <label>Minutes<input name="minutes" type="number" min="1" max="1440" value="30" required /></label>
      <label class="full">Related item<select name="itemId" id="activityItemSelect"><option value="">General practice</option></select></label>
      <label class="full">Note<input name="note" placeholder="What I worked on" /></label>
      <label class="full checkbox-label"><input name="publicHeatmap" type="checkbox" value="yes" /> Include date + minutes in the public heatmap</label>
    </div>
    <p class="form-note">Public heatmap entries expose only the date and minutes, not this note or related item.</p>
    <div class="dialog-actions"><button type="button" class="quiet-button" data-close="activityDialog">Cancel</button><button class="primary-button" type="submit">Save</button></div>
  </form></dialog>

  <dialog id="resourceDialog"><form id="resourceForm" class="dialog-body">
    <div class="dialog-heading"><h2 id="resourceDialogTitle">Add resource</h2><button type="button" class="dialog-close" data-close="resourceDialog">×</button></div>
    <input name="itemId" type="hidden" />
    <div class="form-grid">
      <label>Label<input name="label" required /></label>
      <label>Type<input name="type" list="resourceTypeSuggestions" placeholder="Book, video, website…" /></label>
      <datalist id="resourceTypeSuggestions"><option value="Article"></option><option value="Book"></option><option value="Video"></option><option value="Website"></option><option value="Paper"></option><option value="App"></option><option value="Course"></option><option value="Podcast"></option><option value="Reference"></option><option value="Person"></option><option value="Place"></option></datalist>
      <label class="full">URL (optional)<input name="url" type="text" inputmode="url" autocomplete="url" placeholder="youtube.com or https://…" /></label>
      <label class="full">Note<input name="note" placeholder="Why I saved this" /></label>
      <label id="resourceVisibilityField">Visibility<select name="visibility"><option value="public">Public</option><option value="private">Private</option></select></label>
    </div>
    <p id="resourceFormNote" class="form-note">Hobby resources can be public or private.</p>
    <div class="dialog-actions"><button type="button" class="quiet-button" data-close="resourceDialog">Cancel</button><button class="primary-button" type="submit">Save</button></div>
  </form></dialog>

  <dialog id="milestoneDialog"><form id="milestoneForm" class="dialog-body">
    <div class="dialog-heading"><h2>Add milestone</h2><button type="button" class="dialog-close" data-close="milestoneDialog">×</button></div>
    <div class="form-grid">
      <label>Milestone<input name="title" required /></label>
      <label>Type<select name="type"><option value="first">First</option><option value="completion">Completion</option><option value="personal-best">Personal best</option><option value="consistency">Consistency</option><option value="project">Project</option><option value="custom">Custom</option></select></label>
      <label>Status<select name="status"><option value="working">Working toward</option><option value="achieved">Already achieved</option></select></label>
      <label>Date<input name="date" type="date" /></label>
      <label class="full">Note<input name="note" placeholder="Optional context" /></label>
      <label class="full">Trophy image (optional)<input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" /></label>
    </div>
    <p class="form-note">Milestones use automatic visibility by default: private while working toward them, public after achievement. You can override this later from the milestone row.</p>
    <div class="dialog-actions"><button type="button" class="quiet-button" data-close="milestoneDialog">Cancel</button><button class="primary-button" type="submit">Save</button></div>
  </form></dialog>

  <dialog id="trophyImageDialog"><form id="trophyImageForm" class="dialog-body">
    <div class="dialog-heading"><h2>Add trophy image</h2><button type="button" class="dialog-close" data-close="trophyImageDialog">×</button></div>
    <input name="milestoneId" type="hidden" />
    <div class="form-grid"><label class="full">Image<input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required /></label></div>
    <p class="form-note">JPEG, PNG, WebP or GIF. Maximum 5 MB.</p>
    <div class="dialog-actions"><button type="button" class="quiet-button" data-close="trophyImageDialog">Cancel</button><button class="primary-button" type="submit">Upload</button></div>
  </form></dialog>`;
}

function renderHobbyShell(config) {
  const owner = isOwnerMode();
  document.title = `${config.name} · My Hobbies`;
  $("#app").className = "";
  $("#app").innerHTML = `
    <header class="site-header">
      <div class="page-width header-inner">
        <div class="breadcrumbs"><a href="../index.html">My Hobbies</a> / ${escapeHTML(config.name)}</div>
        ${headerActions()}
      </div>
    </header>

    <main class="page-width hobby-main">
      <section class="hobby-heading">
        <div><h1>${escapeHTML(config.name)}</h1><p>${escapeHTML(config.description || "")}</p></div>
        ${owner ? `<div class="button-row"><button id="logActivityButton" class="quiet-button" type="button">Log activity</button><button id="addItemButton" class="primary-button" type="button">Add item</button></div>` : ""}
      </section>

      <nav class="hobby-nav" aria-label="Page sections">
        ${owner ? `<a href="#focus">Focus</a>` : ""}<a href="#overview">Activity</a><a href="#work">Items</a><a href="#resources">Resources</a><a href="#milestones">Milestones</a><a href="#history">History</a>${owner ? `<a href="#archive">Archive</a>` : ""}
      </nav>

      <section class="summary-row" aria-label="Hobby summary">
        <div class="summary-item"><span>Active</span><strong id="summaryActive">0</strong></div>
        <div class="summary-item"><span>Done</span><strong id="summaryDone">0</strong></div>
        <div class="summary-item"><span>Trophies</span><strong id="summaryTrophies">0</strong></div>
        <div class="summary-item"><span>Time logged</span><strong id="summaryTime">0m</strong></div>
      </section>

      ${owner ? `<section id="focus" class="section-block focus-section">
        <div class="section-heading"><div><h2>Current focus</h2><p>One or two things I want to keep visible right now.</p></div></div>
        <div id="focusList" class="focus-list"></div>
      </section>` : ""}

      <section id="overview" class="section-block ${owner ? "overview-grid" : ""}">
        <div>
          <div class="section-heading"><div><h2>Activity</h2><p>Practice over time.</p></div></div>
          <div class="heatmap-wrap"><div id="hobbyHeatmap" class="heatmap"></div></div>
          <div id="activityCaption" class="heatmap-caption"></div>
          ${owner ? `<div id="activityList" class="simple-list"></div>` : `<p class="muted copy-small public-view-note">Only dates and minutes included in the public heatmap are shown here.</p>`}
        </div>
        ${owner ? `<div class="notes-box">
          <div class="section-heading"><div><h2>Notes</h2><p>A private scratchpad for this hobby.</p></div></div>
          <textarea id="hobbyNotes" placeholder="Notes, ideas, reminders…"></textarea>
          <div id="notesSaved" class="autosave-note">Saved to Supabase.</div>
        </div>` : ""}
      </section>

      <section id="work" class="section-block">
        <div class="section-heading">
          <div><h2>Learning & projects</h2><p>Everything I’m working on in one place. The type is just a tag.</p></div>
          ${owner ? `<button id="addItemButton2" class="quiet-button" type="button">Add item</button>` : ""}
        </div>
        <div class="toolbar toolbar-three">
          <input id="itemSearch" type="search" placeholder="Search items…" />
          <select id="itemStatus"><option value="all">All statuses</option><option value="planned">Planned</option><option value="active">Active</option><option value="paused">Paused</option><option value="done">Done</option></select>
          <select id="itemKind"><option value="all">All types</option><option value="learning">Learning</option><option value="project">Project</option></select>
        </div>
        <div id="itemList" class="item-list"></div>
      </section>

      <section id="resources" class="section-block">
        <div class="section-heading">
          <div><h2>Resources</h2><p>Links and references I want to keep for this hobby, without attaching them to a specific project.</p></div>
          ${owner ? `<button id="addHobbyResourceButton" class="quiet-button" type="button">Add resource</button>` : ""}
        </div>
        <div class="toolbar resource-toolbar">
          <input id="resourceSearch" type="search" placeholder="Search resources…" />
        </div>
        <div id="hobbyResourceList" class="resource-library"></div>
      </section>

      <section id="milestones" class="section-block">
        <div class="section-heading"><div><h2>Milestones</h2><p>${owner ? "What I’m working toward, and a trophy case for what I’ve achieved." : "Milestones and achievements I’ve chosen to share."}</p></div>${owner ? `<button id="addMilestoneButton" class="quiet-button" type="button">Add milestone</button>` : ""}</div>
        <div id="milestoneList"></div>
      </section>

      <section id="history" class="section-block">
        <div class="section-heading"><div><h2>History</h2><p>An automatic month-by-month record from things already logged.</p></div></div>
        <div id="historyList" class="history-list"></div>
      </section>

      ${owner ? `<section id="archive" class="section-block">
        <div class="section-heading"><div><h2>Archived items</h2><p>Things I want to keep in the record without keeping them in the main list.</p></div></div>
        <div id="archiveList" class="archive-list"></div>
      </section>` : ""}
    </main>

    <footer class="page-width footer"><span>${escapeHTML(config.name)} · My Hobbies</span></footer>
    ${owner ? dialogMarkup() : ""}`;
}

function itemStatusLabel(status) {
  return ({ planned: "Planned", active: "Active", paused: "Paused", done: "Done" })[status] || status;
}

function itemKindLabel(kind) {
  return kind === "project" ? "Project" : "Learning";
}

function itemVisibilityControl(item) {
  if (!isOwnerMode()) return "";
  return `<select class="visibility-select" data-item-visibility="${item.id}" aria-label="Visibility for ${escapeHTML(item.title)}">
    <option value="public" ${item.visibility === "public" ? "selected" : ""}>Public</option>
    <option value="private" ${item.visibility === "private" ? "selected" : ""}>Private</option>
  </select>`;
}

function milestoneVisibilityControl(milestone) {
  if (!isOwnerMode()) return "";
  return `<select class="visibility-select" data-milestone-visibility="${milestone.id}" aria-label="Visibility for ${escapeHTML(milestone.title)}" title="Auto = private while working, public when achieved">
    <option value="auto" ${milestone.visibility === "auto" ? "selected" : ""}>Auto</option>
    <option value="public" ${milestone.visibility === "public" ? "selected" : ""}>Public</option>
    <option value="private" ${milestone.visibility === "private" ? "selected" : ""}>Private</option>
  </select>`;
}

async function getSignedImageUrl(path) {
  if (!path) return "";
  if (signedImageCache.has(path)) return signedImageCache.get(path);
  const { data, error } = await db.storage.from("milestone-images").createSignedUrl(path, 3600);
  if (error) return "";
  signedImageCache.set(path, data.signedUrl);
  return data.signedUrl;
}

async function uploadMilestoneImage(file, hobbyId) {
  if (!file) return "";
  if (file.size > 5 * 1024 * 1024) throw new Error("Trophy images must be 5 MB or smaller.");
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) throw new Error("Use a JPEG, PNG, WebP or GIF image.");
  const extension = (file.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const path = `${currentUser.id}/${hobbyId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await db.storage.from("milestone-images").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

async function deleteMilestoneImage(path) {
  if (!path || !currentUser) return;
  signedImageCache.delete(path);
  const { error } = await db.storage.from("milestone-images").remove([path]);
  if (error) console.warn("Could not remove old trophy image", error);
}

function initHobbyPage(config) {
  if (!config) {
    $("#app").innerHTML = `<main class="page-width auth-shell"><section class="auth-panel"><h1>Hobby not found</h1><p class="muted">Check the hobby ID in this page and in hobbies.js.</p></section></main>`;
    return;
  }
  renderHobbyShell(config);
  bindGlobalHeader();

  const owner = isOwnerMode();
  const hobbyId = config.id;
  const hobbyItems = () => state.items.filter(x => x.hobbyId === hobbyId);
  const visibleItems = () => hobbyItems().filter(x => !x.archived);
  const activeItems = () => visibleItems().filter(x => x.status !== "done");
  const hobbyMilestones = () => state.milestones.filter(x => x.hobbyId === hobbyId);
  const hobbyActivity = () => state.activity.filter(x => x.hobbyId === hobbyId);
  const hobbyResources = () => state.resources.filter(x => x.hobbyId === hobbyId && !x.itemId);

  function renderSummary() {
    const items = visibleItems();
    $("#summaryActive").textContent = items.filter(x => x.status === "active").length;
    $("#summaryDone").textContent = items.filter(x => x.status === "done").length;
    $("#summaryTrophies").textContent = hobbyMilestones().filter(x => x.status === "achieved").length;
    $("#summaryTime").textContent = minutesLabel(hobbyActivity().reduce((sum, x) => sum + Number(x.minutes || 0), 0));
  }

  function renderFocus() {
    if (!owner) return;
    const focus = visibleItems().filter(x => x.isFocus).slice(0, 2);
    const target = $("#focusList");
    if (!focus.length) {
      target.innerHTML = `<div class="empty-state compact-empty">Nothing pinned. Use “Pin” on an item when I want it kept in view.</div>`;
      return;
    }
    target.innerHTML = focus.map(item => `<article class="focus-card">
      <div class="row-labels"><span class="type-tag">${itemKindLabel(item.kind)}</span><span class="status">${itemStatusLabel(item.status)}</span>${itemVisibilityControl(item)}</div>
      <div class="focus-title">${escapeHTML(item.title)}</div>
      ${item.nextAction ? `<div class="focus-next">Next: ${escapeHTML(item.nextAction)}</div>` : ""}
      <div class="row-meta">Last touched ${formatDate(item.touchedAt)}</div>
      <div class="focus-actions"><button class="mini-button" data-log-item="${item.id}">Log activity</button><button class="text-button" data-focus-item="${item.id}">Unpin</button></div>
    </article>`).join("");
    bindItemActionButtons();
    bindItemVisibilityControls();
  }

  function renderActivity() {
    const entries = hobbyActivity().sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`));
    buildHeatmap($("#hobbyHeatmap"), entries);
    const minutes = entries.reduce((sum, x) => sum + Number(x.minutes || 0), 0);
    $("#activityCaption").textContent = entries.length ? `${entries.length} ${entries.length === 1 ? "entry" : "entries"} · ${minutesLabel(minutes)} logged` : "No activity logged yet.";
    if (!owner) return;
    const target = $("#activityList");
    target.innerHTML = entries.map(entry => {
      const item = state.items.find(x => x.id === entry.itemId);
      return `<div class="simple-row activity-row">
        <div class="row-main">
          <div>${escapeHTML(entry.note || item?.title || "Practice session")}</div>
          <div class="row-meta">${entry.minutes} min · ${formatDate(entry.date)}${item ? ` · ${escapeHTML(item.title)}` : ""}${entry.publicHeatmap ? " · public heatmap" : " · private"}</div>
        </div>
        <div class="row-actions">
          <button class="mini-button" data-edit-activity="${entry.id}" type="button">Edit</button>
          <button class="text-button danger" data-delete-activity="${entry.id}" type="button">Delete</button>
        </div>
      </div>`;
    }).join("") || `<div class="empty-state compact-empty">No sessions logged yet.</div>`;

    $$("[data-edit-activity]").forEach(button => button.addEventListener("click", () => {
      const entry = state.activity.find(x => x.id === button.dataset.editActivity);
      if (entry) openActivity(entry.itemId, entry);
    }));
    $$("[data-delete-activity]").forEach(button => button.addEventListener("click", async () => {
      const entry = state.activity.find(x => x.id === button.dataset.deleteActivity);
      if (!entry || !confirm(`Delete the ${entry.minutes}-minute activity from ${formatDate(entry.date)}?`)) return;
      await runWrite(() => db.from("activity").delete().eq("id", entry.id));
      await reloadState();
      refresh();
    }));
  }

  function itemMatchesFilters(item) {
    const query = $("#itemSearch").value.trim().toLowerCase();
    const status = $("#itemStatus").value;
    const kind = $("#itemKind").value;
    const haystack = [item.title, item.notes, owner ? item.nextAction : "", ...(item.tags || [])].join(" ").toLowerCase();
    return (!query || haystack.includes(query)) && (status === "all" || item.status === status) && (kind === "all" || item.kind === kind);
  }

  function renderItems() {
    const items = visibleItems().filter(itemMatchesFilters).sort((a, b) => {
      if (owner && a.isFocus !== b.isFocus) return a.isFocus ? -1 : 1;
      return String(b.touchedAt).localeCompare(String(a.touchedAt));
    });
    const target = $("#itemList");
    if (!items.length) {
      target.innerHTML = `<div class="empty-state">No matching items.</div>`;
      return;
    }

    target.innerHTML = items.map(item => {
      const resources = item.kind === "project" ? (item.resources || []) : [];
      return `<article class="item-row" id="item-${item.id}">
        <div class="item-top">
          <div class="row-main">
            <div class="row-labels">${owner && item.isFocus ? `<span class="focus-badge">Focus</span>` : ""}<span class="type-tag">${itemKindLabel(item.kind)}</span><span class="status">${itemStatusLabel(item.status)}</span>${itemVisibilityControl(item)}</div>
            <div class="row-title item-title">${escapeHTML(item.title)}</div>
            <div class="row-meta">Last touched ${formatDate(item.touchedAt)}${item.tags.length ? ` · ${item.tags.map(tag => escapeHTML(tag)).join(" · ")}` : ""}</div>
            ${item.notes ? `<p class="row-note">${escapeHTML(item.notes)}</p>` : ""}
            ${owner && item.nextAction ? `<p class="row-next"><strong>Next:</strong> ${escapeHTML(item.nextAction)}</p>` : ""}
            ${Number(item.progress) > 0 ? `<div class="progress-line" title="${item.progress}%"><span style="width:${item.progress}%"></span></div>` : ""}
          </div>
          ${owner ? `<div class="row-actions">
            <button class="mini-button" data-log-item="${item.id}">Log</button>
            <button class="mini-button" data-focus-item="${item.id}">${item.isFocus ? "Unpin" : "Pin"}</button>
            ${item.kind === "project" ? `<button class="mini-button" data-add-resource="${item.id}">Resource</button>` : ""}
            <button class="mini-button" data-edit-item="${item.id}">Edit</button>
            <button class="text-button" data-archive-item="${item.id}">Archive</button>
          </div>` : ""}
        </div>
        ${item.kind === "project" ? `<div class="resource-shelf">
          <div class="resource-heading"><h4>Resources</h4></div>
          ${resources.length ? resources.map(resource => `<div class="resource-row"><div>${resource.url ? `<a href="${escapeHTML(resource.url)}" target="_blank" rel="noreferrer">${escapeHTML(resource.label)} ↗</a>` : `<span class="resource-title-static">${escapeHTML(resource.label)}</span>`}${resource.type ? `<small>${escapeHTML(resource.type)}</small>` : ""}${resource.note ? `<small>${escapeHTML(resource.note)}</small>` : ""}</div>${owner ? `<div class="row-actions"><button class="text-button" data-edit-resource="${resource.id}">Edit</button><button class="text-button danger" data-delete-resource="${resource.id}">Remove</button></div>` : ""}</div>`).join("") : `<div class="muted copy-small">No saved resources.</div>`}
        </div>` : ""}
      </article>`;
    }).join("");

    if (!owner) return;
    bindItemActionButtons();
    bindItemVisibilityControls();
    $$('[data-edit-item]').forEach(button => button.addEventListener("click", () => openItem(state.items.find(x => x.id === button.dataset.editItem))));
    $$('[data-add-resource]').forEach(button => button.addEventListener("click", () => openResource(button.dataset.addResource)));
    $$('[data-edit-resource]').forEach(button => button.addEventListener("click", () => {
      const resource = state.resources.find(x => x.id === button.dataset.editResource);
      if (resource) openResource(resource.itemId, resource);
    }));
    $$('[data-archive-item]').forEach(button => button.addEventListener("click", async () => {
      await runWrite(() => db.from("items").update({ archived: true, is_focus: false }).eq("id", button.dataset.archiveItem));
      await reloadState(); refresh();
    }));
    $$('[data-delete-resource]').forEach(button => button.addEventListener("click", async () => {
      const resource = state.resources.find(x => x.id === button.dataset.deleteResource);
      await runWrite(() => db.from("resources").delete().eq("id", button.dataset.deleteResource));
      if (resource?.itemId) await db.from("items").update({ touched_at: new Date().toISOString() }).eq("id", resource.itemId);
      await reloadState(); refresh();
    }));
  }

  function bindItemVisibilityControls() {
    if (!owner) return;
    $$('[data-item-visibility]').forEach(select => {
      if (select.dataset.bound) return;
      select.dataset.bound = "1";
      select.addEventListener("change", async () => {
        await runWrite(() => db.from("items").update({ visibility: select.value }).eq("id", select.dataset.itemVisibility));
        await reloadState(); refresh();
      });
    });
  }

  function bindItemActionButtons() {
    if (!owner) return;
    $$('[data-log-item]').forEach(button => {
      if (button.dataset.bound) return;
      button.dataset.bound = "1";
      button.addEventListener("click", () => openActivity(button.dataset.logItem));
    });
    $$('[data-focus-item]').forEach(button => {
      if (button.dataset.bound) return;
      button.dataset.bound = "1";
      button.addEventListener("click", async () => {
        const item = state.items.find(x => x.id === button.dataset.focusItem);
        if (!item) return;
        const focusCount = visibleItems().filter(x => x.isFocus).length;
        if (!item.isFocus && focusCount >= 2) {
          alert("Current focus is intentionally limited to two items. Unpin one first.");
          return;
        }
        await runWrite(() => db.from("items").update({ is_focus: !item.isFocus }).eq("id", item.id));
        await reloadState(); refresh();
      });
    });
  }

  function resourceVisibilityControl(resource) {
    if (!owner) return "";
    return `<select class="visibility-select" data-resource-visibility="${resource.id}" aria-label="Visibility for ${escapeHTML(resource.label)}">
      <option value="public" ${resource.visibility === "public" ? "selected" : ""}>Public</option>
      <option value="private" ${resource.visibility === "private" ? "selected" : ""}>Private</option>
    </select>`;
  }

  function renderResources() {
    const target = $("#hobbyResourceList");
    if (!target) return;
    const query = ($("#resourceSearch")?.value || "").trim().toLowerCase();
    const resources = hobbyResources()
      .filter(resource => !query || [resource.label, resource.type, resource.note, resource.url].join(" ").toLowerCase().includes(query))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    target.innerHTML = resources.length ? resources.map(resource => `<article class="library-resource-row" id="resource-${resource.id}">
      <div class="row-main">
        <div class="row-labels">${resource.type ? `<span class="type-tag">${escapeHTML(resource.type)}</span>` : ""}${resourceVisibilityControl(resource)}</div>
        ${resource.url ? `<a class="library-resource-title" href="${escapeHTML(resource.url)}" target="_blank" rel="noreferrer">${escapeHTML(resource.label)} ↗</a>` : `<span class="library-resource-title resource-title-static">${escapeHTML(resource.label)}</span>`}
        ${resource.note ? `<p class="row-note">${escapeHTML(resource.note)}</p>` : ""}
      </div>
      ${owner ? `<div class="row-actions"><button class="mini-button" data-edit-hobby-resource="${resource.id}" type="button">Edit</button><button class="text-button danger" data-delete-hobby-resource="${resource.id}" type="button">Delete</button></div>` : ""}
    </article>`).join("") : `<div class="empty-state">${query ? "No matching resources." : "No hobby resources saved yet."}</div>`;

    if (!owner) return;
    $$("[data-resource-visibility]").forEach(select => select.addEventListener("change", async () => {
      await runWrite(() => db.from("resources").update({ visibility: select.value }).eq("id", select.dataset.resourceVisibility));
      await reloadState();
      refresh();
    }));
    $$("[data-edit-hobby-resource]").forEach(button => button.addEventListener("click", () => {
      const resource = state.resources.find(x => x.id === button.dataset.editHobbyResource);
      if (resource) openResource("", resource);
    }));
    $$("[data-delete-hobby-resource]").forEach(button => button.addEventListener("click", async () => {
      const resource = state.resources.find(x => x.id === button.dataset.deleteHobbyResource);
      if (!resource || !confirm(`Delete resource “${resource.label}”?`)) return;
      await runWrite(() => db.from("resources").delete().eq("id", resource.id));
      await reloadState();
      refresh();
    }));
  }

  async function renderMilestones() {
    const milestones = hobbyMilestones();
    const working = milestones.filter(x => x.status === "working");
    const achieved = milestones.filter(x => x.status === "achieved").sort((a, b) => String(b.achievedDate).localeCompare(String(a.achievedDate)));
    const target = $("#milestoneList");
    target.innerHTML = `<div class="milestone-groups">
      ${working.length || owner ? `<div>
        <div class="subsection-heading"><h3>Working toward</h3><span class="muted">${working.length}</span></div>
        <div class="milestone-list">${working.length ? working.map(m => `<article class="milestone-row"><div class="milestone-top"><div class="row-main"><div class="row-labels">${milestoneVisibilityControl(m)}</div><div class="row-title">${escapeHTML(m.title)}</div><div class="row-meta">${escapeHTML(m.type)}${m.targetDate ? ` · target ${formatDate(m.targetDate)}` : ""}</div>${m.note ? `<p class="row-note">${escapeHTML(m.note)}</p>` : ""}</div>${owner ? `<div class="row-actions"><button class="mini-button" data-achieve-milestone="${m.id}">Mark achieved</button><button class="text-button danger" data-delete-milestone="${m.id}">Delete</button></div>` : ""}</div></article>`).join("") : `<div class="empty-state compact-empty">No milestones in progress.</div>`}</div>
      </div>` : ""}
      <div class="trophy-section">
        <div class="subsection-heading"><h3>Trophy case</h3><span class="muted">${achieved.length}</span></div>
        <div class="trophy-grid">${achieved.length ? achieved.map(m => `<article class="trophy-card">
          ${m.imagePath ? `<div class="trophy-image-wrap"><div class="trophy-image-placeholder" data-trophy-image="${escapeHTML(m.imagePath)}"></div></div>` : `<div class="trophy-mark">◇</div>`}
          ${owner ? `<div class="row-labels trophy-visibility">${milestoneVisibilityControl(m)}</div>` : ""}
          <div class="trophy-title">${escapeHTML(m.title)}</div>
          <div class="row-meta">${formatDate(m.achievedDate)} · ${escapeHTML(m.type)}</div>
          ${m.note ? `<p class="row-note">${escapeHTML(m.note)}</p>` : ""}
          ${owner ? `<div class="trophy-actions"><button class="mini-button" data-trophy-image-button="${m.id}">${m.imagePath ? "Replace image" : "Add image"}</button><button class="text-button" data-reopen-milestone="${m.id}">Move back</button><button class="text-button danger" data-delete-milestone="${m.id}">Delete</button></div>` : ""}
        </article>`).join("") : `<div class="empty-state trophy-empty">Nothing here yet.</div>`}</div>
      </div>
    </div>`;

    if (owner) {
      $$('[data-milestone-visibility]').forEach(select => select.addEventListener("change", async () => {
        await runWrite(() => db.from("milestones").update({ visibility: select.value }).eq("id", select.dataset.milestoneVisibility));
        await reloadState(); refresh();
      }));
      $$('[data-achieve-milestone]').forEach(button => button.addEventListener("click", async () => {
        await runWrite(() => db.from("milestones").update({ status: "achieved", achieved_date: todayISO() }).eq("id", button.dataset.achieveMilestone));
        await reloadState(); refresh();
      }));
      $$('[data-reopen-milestone]').forEach(button => button.addEventListener("click", async () => {
        await runWrite(() => db.from("milestones").update({ status: "working", achieved_date: null }).eq("id", button.dataset.reopenMilestone));
        await reloadState(); refresh();
      }));
      $$('[data-delete-milestone]').forEach(button => button.addEventListener("click", async () => {
        const milestone = state.milestones.find(x => x.id === button.dataset.deleteMilestone);
        if (!confirm("Delete this milestone?")) return;
        if (milestone?.imagePath) await deleteMilestoneImage(milestone.imagePath);
        await runWrite(() => db.from("milestones").delete().eq("id", button.dataset.deleteMilestone));
        await reloadState(); refresh();
      }));
      $$('[data-trophy-image-button]').forEach(button => button.addEventListener("click", () => {
        const form = $("#trophyImageForm");
        form.reset();
        form.elements.milestoneId.value = button.dataset.trophyImageButton;
        $("#trophyImageDialog").showModal();
      }));
    }

    for (const placeholder of $$('[data-trophy-image]')) {
      const url = await getSignedImageUrl(placeholder.dataset.trophyImage);
      if (url) placeholder.innerHTML = `<img src="${escapeHTML(url)}" alt="Milestone image" loading="lazy" />`;
    }
  }


  function buildHistoryEvents() {
    const events = [];
    hobbyItems().filter(item => item.completedAt).forEach(item => events.push({
      date: item.completedAt.slice(0, 10),
      title: `Completed ${itemKindLabel(item.kind).toLowerCase()}: ${item.title}`,
      detail: ""
    }));
    hobbyMilestones().filter(m => m.status === "achieved" && m.achievedDate).forEach(m => events.push({
      date: m.achievedDate,
      title: `Milestone: ${m.title}`,
      detail: m.note || ""
    }));

    if (owner) {
      const projectMonthMap = new Map();
      hobbyActivity().forEach(entry => {
        const item = state.items.find(x => x.id === entry.itemId && x.kind === "project");
        if (!item) return;
        const key = `${entry.date.slice(0, 7)}|${item.id}`;
        const existing = projectMonthMap.get(key) || { date: entry.date, item, minutes: 0 };
        existing.minutes += Number(entry.minutes || 0);
        if (entry.date > existing.date) existing.date = entry.date;
        projectMonthMap.set(key, existing);
      });
      projectMonthMap.forEach(value => events.push({
        date: value.date,
        title: `Worked on: ${value.item.title}`,
        detail: minutesLabel(value.minutes)
      }));
    }

    return events.sort((a, b) => b.date.localeCompare(a.date));
  }

  function renderHistory() {
    const events = buildHistoryEvents();
    const target = $("#historyList");
    if (!events.length) {
      target.innerHTML = `<div class="empty-state">History will build itself from completed items and milestones${owner ? ", plus project activity" : ""}.</div>`;
      return;
    }
    const years = new Map();
    events.forEach(event => {
      const year = event.date.slice(0, 4);
      const month = Number(event.date.slice(5, 7)) - 1;
      if (!years.has(year)) years.set(year, new Map());
      if (!years.get(year).has(month)) years.get(year).set(month, []);
      years.get(year).get(month).push(event);
    });

    const currentYear = String(new Date().getFullYear());
    target.innerHTML = [...years.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([year, months]) => `<details class="history-year" ${year === currentYear ? "open" : ""}>
      <summary>${year}</summary>
      <div class="history-months">${[...months.entries()].sort((a, b) => b[0] - a[0]).map(([month, monthEvents]) => `<section class="history-month"><h3>${monthName(month)}</h3><div class="history-events">${monthEvents.map(event => `<div class="history-event"><span class="history-dot"></span><div><div>${escapeHTML(event.title)}</div><div class="row-meta">${formatDate(event.date, false)}${event.detail ? ` · ${escapeHTML(event.detail)}` : ""}</div></div></div>`).join("")}</div></section>`).join("")}</div>
    </details>`).join("");
  }

  function renderArchive() {
    if (!owner) return;
    const archived = hobbyItems().filter(x => x.archived);
    const target = $("#archiveList");
    if (!archived.length) {
      target.innerHTML = `<div class="empty-state">Archive is empty.</div>`;
      return;
    }
    target.innerHTML = archived.map(item => `<article class="archive-row"><div class="archive-top"><div><div class="row-title">${escapeHTML(item.title)}</div><div class="row-meta">${itemKindLabel(item.kind)} · ${itemStatusLabel(item.status)} · last touched ${formatDate(item.touchedAt)}</div></div><div class="row-actions"><button class="mini-button" data-restore-item="${item.id}">Restore</button><button class="text-button danger" data-delete-item="${item.id}">Delete permanently</button></div></div></article>`).join("");

    $$('[data-restore-item]').forEach(button => button.addEventListener("click", async () => {
      await runWrite(() => db.from("items").update({ archived: false }).eq("id", button.dataset.restoreItem));
      await reloadState(); refresh();
    }));
    $$('[data-delete-item]').forEach(button => button.addEventListener("click", async () => {
      if (!confirm("Permanently delete this item and its resources?")) return;
      await runWrite(() => db.from("items").delete().eq("id", button.dataset.deleteItem));
      await reloadState(); refresh();
    }));
  }

  function renderActivitySelect(selected = "") {
    const select = $("#activityItemSelect");
    select.innerHTML = `<option value="">General practice</option>` + visibleItems().map(item => `<option value="${item.id}">${escapeHTML(item.title)}</option>`).join("");
    select.value = selected || "";
  }

  function openItem(item = null) {
    const form = $("#itemForm");
    editingItemId = item?.id || null;
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

  function openActivity(itemId = "", entry = null) {
    const form = $("#activityForm");
    editingActivityId = entry?.id || null;
    form.reset();
    $("#activityDialogTitle").textContent = entry ? "Edit activity" : "Log activity";
    form.elements.date.value = entry?.date || todayISO();
    form.elements.minutes.value = Number(entry?.minutes || 30);
    form.elements.note.value = entry?.note || "";
    form.elements.publicHeatmap.checked = entry ? Boolean(entry.publicHeatmap) : defaultPublicHeatmap();
    renderActivitySelect(entry?.itemId || itemId);
    $("#activityDialog").showModal();
  }

  function openResource(itemId = "", resource = null) {
    const form = $("#resourceForm");
    editingResourceId = resource?.id || null;
    form.reset();
    const linkedItemId = resource?.itemId || itemId || "";
    form.elements.itemId.value = linkedItemId;
    form.elements.label.value = resource?.label || "";
    form.elements.type.value = resource?.type || "";
    form.elements.url.value = resource?.url || "";
    form.elements.note.value = resource?.note || "";
    form.elements.visibility.value = resource?.visibility || "public";
    $("#resourceDialogTitle").textContent = resource ? "Edit resource" : "Add resource";
    const standalone = !linkedItemId;
    $("#resourceVisibilityField").hidden = !standalone;
    $("#resourceFormNote").textContent = standalone
      ? "This resource belongs to the hobby itself and can be public or private."
      : "This resource belongs to a project and inherits that project's public/private setting.";
    $("#resourceDialog").showModal();
  }

  function refresh() {
    renderSummary();
    renderFocus();
    renderActivity();
    renderItems();
    renderResources();
    renderMilestones();
    renderHistory();
    renderArchive();
  }

  $("#itemSearch").addEventListener("input", renderItems);
  $("#itemStatus").addEventListener("change", renderItems);
  $("#itemKind").addEventListener("change", renderItems);
  $("#resourceSearch")?.addEventListener("input", renderResources);

  if (owner) {
    $("#hobbyNotes").value = state.hobbyNotes[hobbyId] || "";
    let noteTimer;
    $("#hobbyNotes").addEventListener("input", event => {
      clearTimeout(noteTimer);
      $("#notesSaved").textContent = "Saving…";
      const content = event.target.value;
      noteTimer = setTimeout(async () => {
        const { error } = await db.from("hobby_notes").upsert({
          user_id: currentUser.id,
          hobby_id: hobbyId,
          content,
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id,hobby_id" });
        if (error) {
          $("#notesSaved").textContent = "Could not save.";
          console.error(error);
        } else {
          state.hobbyNotes[hobbyId] = content;
          $("#notesSaved").textContent = "Saved to Supabase.";
        }
      }, 700);
    });

    $("#addItemButton").addEventListener("click", () => openItem());
    $("#addItemButton2").addEventListener("click", () => openItem());
    $("#logActivityButton").addEventListener("click", () => openActivity());
    $("#addHobbyResourceButton").addEventListener("click", () => openResource());
    $("#addMilestoneButton").addEventListener("click", () => $("#milestoneDialog").showModal());
    $$('[data-close]').forEach(button => button.addEventListener("click", () => document.getElementById(button.dataset.close)?.close()));

    $("#itemForm").addEventListener("submit", async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const old = state.items.find(x => x.id === editingItemId);
      const status = String(data.get("status"));
      const now = new Date().toISOString();
      const payload = {
        hobby_id: hobbyId,
        title: String(data.get("title")).trim(),
        kind: String(data.get("kind")),
        status,
        progress: Math.min(100, Math.max(0, Number(data.get("progress")) || 0)),
        tags: String(data.get("tags") || "").split(",").map(x => x.trim()).filter(Boolean),
        notes: String(data.get("notes") || "").trim(),
        next_action: String(data.get("nextAction") || "").trim(),
        touched_at: now,
        completed_at: status === "done" ? (old?.completedAt || now) : null,
        is_focus: status === "done" ? false : Boolean(old?.isFocus),
        visibility: old?.visibility || defaultItemVisibility()
      };
      if (editingItemId) {
        await runWrite(() => db.from("items").update(payload).eq("id", editingItemId));
      } else {
        await runWrite(() => db.from("items").insert(payload));
      }
      await reloadState();
      $("#itemDialog").close();
      refresh();
    });

    $("#activityForm").addEventListener("submit", async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const itemId = String(data.get("itemId") || "") || null;
      const payload = {
        hobby_id: hobbyId,
        activity_date: String(data.get("date")),
        minutes: Number(data.get("minutes")) || 0,
        item_id: itemId,
        note: String(data.get("note") || "").trim(),
        public_heatmap: data.get("publicHeatmap") === "yes"
      };
      if (editingActivityId) {
        await runWrite(() => db.from("activity").update(payload).eq("id", editingActivityId));
      } else {
        await runWrite(() => db.from("activity").insert(payload));
      }
      if (itemId) {
        await runWrite(() => db.from("items").update({ touched_at: new Date().toISOString() }).eq("id", itemId));
      }
      editingActivityId = null;
      await reloadState();
      $("#activityDialog").close();
      refresh();
    });

    $("#resourceForm").addEventListener("submit", async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const itemId = String(data.get("itemId") || "") || null;
      const payload = {
        hobby_id: hobbyId,
        item_id: itemId,
        label: String(data.get("label")).trim(),
        type: String(data.get("type") || "").trim(),
        url: normalizeWebUrl(data.get("url")),
        note: String(data.get("note") || "").trim(),
        visibility: itemId ? "public" : String(data.get("visibility") || "public")
      };
      if (payload.url === null) {
        alert("That link does not look like a valid web address.");
        return;
      }
      if (editingResourceId) {
        await runWrite(() => db.from("resources").update(payload).eq("id", editingResourceId));
      } else {
        await runWrite(() => db.from("resources").insert(payload));
      }
      if (itemId) {
        await db.from("items").update({ touched_at: new Date().toISOString() }).eq("id", itemId);
      }
      editingResourceId = null;
      await reloadState();
      $("#resourceDialog").close();
      refresh();
    });

    $("#milestoneForm").addEventListener("submit", async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const status = String(data.get("status"));
      const date = String(data.get("date") || "");
      const file = data.get("image");
      let imagePath = "";
      try {
        if (file instanceof File && file.size) imagePath = await uploadMilestoneImage(file, hobbyId);
        const result = await db.from("milestones").insert({
          hobby_id: hobbyId,
          title: String(data.get("title")).trim(),
          type: String(data.get("type")),
          status,
          target_date: status === "working" && date ? date : null,
          achieved_date: status === "achieved" ? (date || todayISO()) : null,
          note: String(data.get("note") || "").trim(),
          image_path: imagePath || null,
          visibility: "auto"
        });
        if (result.error) throw result.error;
      } catch (error) {
        if (imagePath) await deleteMilestoneImage(imagePath);
        showDataError(error);
        return;
      }
      await reloadState();
      event.currentTarget.reset();
      $("#milestoneDialog").close();
      refresh();
    });

    $("#trophyImageForm").addEventListener("submit", async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const milestone = state.milestones.find(x => x.id === String(data.get("milestoneId")));
      const file = data.get("image");
      if (!milestone || !(file instanceof File) || !file.size) return;
      let newPath = "";
      try {
        newPath = await uploadMilestoneImage(file, hobbyId);
        const { error } = await db.from("milestones").update({ image_path: newPath }).eq("id", milestone.id);
        if (error) throw error;
        if (milestone.imagePath) await deleteMilestoneImage(milestone.imagePath);
      } catch (error) {
        if (newPath) await deleteMilestoneImage(newPath);
        showDataError(error);
        return;
      }
      await reloadState();
      $("#trophyImageDialog").close();
      refresh();
    });
  }

  refresh();
}

function renderCurrentPage() {
  if (document.body.dataset.page === "home") renderHome();
  else if (document.body.dataset.page === "hobby") initHobbyPage(resolveHobbyPageConfig());
}

async function enterAuthenticatedApp() {
  const { data, error } = await db.auth.getSession();
  if (error || !data.session) {
    renderAuth(error?.message || "Please sign in.");
    return;
  }
  currentUser = data.session.user;
  $("#app").innerHTML = `<div class="app-loading">Loading journal…</div>`;
  try {
    await loadOwnerState();
  } catch (error) {
    console.error(error);
    renderSetupRequired(`Supabase is connected, but the journal tables could not be loaded: ${error.message}`);
    return;
  }
  renderCurrentPage();
}

async function enterPublicApp() {
  currentUser = null;
  $("#app").innerHTML = `<div class="app-loading">Loading journal…</div>`;
  try {
    await loadPublicState();
  } catch (error) {
    console.error(error);
    renderSetupRequired(`Supabase is connected, but the public journal could not be loaded: ${error.message}`);
    return;
  }
  renderCurrentPage();
}

async function boot() {
  initialTheme();
  if (!window.supabase) {
    renderSetupRequired("The Supabase JavaScript library did not load. Check the internet connection or CDN script.");
    return;
  }
  if (!isConfigured()) {
    renderSetupRequired();
    return;
  }
  db = createDatabaseClient();
  const { data, error } = await db.auth.getSession();
  if (error) {
    await enterPublicApp();
    return;
  }
  if (data.session) await enterAuthenticatedApp();
  else await enterPublicApp();
}

boot();
