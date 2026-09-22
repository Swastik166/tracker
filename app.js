const STORAGE_KEY = "hobby-atlas-items-v1";
const THEME_KEY = "hobby-atlas-theme";

const starterItems = [
  {
    id: crypto.randomUUID(),
    title: "JavaScript fundamentals",
    hobby: "Coding",
    status: "learning",
    progress: 65,
    notes: "Focus on array methods, async/await, DOM events and small browser projects.",
    tags: ["web", "fundamentals"],
    resource: "https://developer.mozilla.org/en-US/docs/Web/JavaScript"
  },
  {
    id: crypto.randomUUID(),
    title: "Street photography composition",
    hobby: "Photography",
    status: "planned",
    progress: 10,
    notes: "Study framing, leading lines and how to anticipate moments in public spaces.",
    tags: ["creative", "practice"],
    resource: ""
  },
  {
    id: crypto.randomUUID(),
    title: "Major and minor open chords",
    hobby: "Guitar",
    status: "learned",
    progress: 100,
    notes: "Comfortable switching between the common open chord shapes.",
    tags: ["music", "foundation"],
    resource: ""
  },
  {
    id: crypto.randomUUID(),
    title: "Knife skills and mise en place",
    hobby: "Cooking",
    status: "learning",
    progress: 45,
    notes: "Practice consistent cuts and preparing ingredients before starting to cook.",
    tags: ["kitchen", "technique"],
    resource: ""
  }
];

let items = loadItems();
let editingId = null;

const cardsEl = document.querySelector("#cards");
const template = document.querySelector("#cardTemplate");
const dialog = document.querySelector("#itemDialog");
const form = document.querySelector("#itemForm");
const searchInput = document.querySelector("#searchInput");
const statusFilter = document.querySelector("#statusFilter");
const hobbyFilter = document.querySelector("#hobbyFilter");

function loadItems() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return starterItems;
  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : starterItems;
  } catch {
    return starterItems;
  }
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function statusLabel(status) {
  return {
    planned: "Planned",
    learning: "Learning",
    learned: "Learned"
  }[status] || status;
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;
  const hobby = hobbyFilter.value;

  const filtered = items.filter(item => {
    const haystack = [
      item.title,
      item.hobby,
      item.notes,
      ...(item.tags || [])
    ].join(" ").toLowerCase();

    const matchesQuery = !query || haystack.includes(query);
    const matchesStatus = status === "all" || item.status === status;
    const matchesHobby = hobby === "all" || item.hobby === hobby;

    return matchesQuery && matchesStatus && matchesHobby;
  });

  cardsEl.innerHTML = "";

  if (!filtered.length) {
    cardsEl.innerHTML = `<div class="empty-state">
      <strong>No items found.</strong>
      <p>Try another filter or add a new learning item.</p>
    </div>`;
  }

  filtered.forEach(item => {
    const card = template.content.firstElementChild.cloneNode(true);
    card.dataset.id = item.id;

    card.querySelector(".hobby-pill").textContent = item.hobby;
    card.querySelector(".status-pill").textContent = statusLabel(item.status);
    card.querySelector(".card-title").textContent = item.title;
    card.querySelector(".card-notes").textContent = item.notes || "No notes yet.";
    card.querySelector(".progress-value").textContent = `${item.progress}%`;
    card.querySelector(".progress-bar").style.width = `${item.progress}%`;

    const tagsEl = card.querySelector(".tags");
    (item.tags || []).forEach(tag => {
      const tagEl = document.createElement("span");
      tagEl.textContent = `#${tag}`;
      tagsEl.appendChild(tagEl);
    });

    const resourceLink = card.querySelector(".resource-link");
    if (item.resource) {
      resourceLink.href = item.resource;
    } else {
      resourceLink.style.visibility = "hidden";
    }

    card.querySelector(".edit-button").addEventListener("click", () => openEditDialog(item));
    card.querySelector(".delete-button").addEventListener("click", () => {
      if (confirm(`Delete "${item.title}"?`)) {
        items = items.filter(x => x.id !== item.id);
        saveItems();
        refreshAll();
      }
    });

    cardsEl.appendChild(card);
  });

  updateStats();
}

function updateStats() {
  document.querySelector("#plannedCount").textContent = items.filter(x => x.status === "planned").length;
  document.querySelector("#learningCount").textContent = items.filter(x => x.status === "learning").length;
  document.querySelector("#learnedCount").textContent = items.filter(x => x.status === "learned").length;
  document.querySelector("#hobbyCount").textContent = new Set(items.map(x => x.hobby)).size;
}

function refreshHobbyFilter() {
  const current = hobbyFilter.value;
  const hobbies = [...new Set(items.map(x => x.hobby).filter(Boolean))].sort();

  hobbyFilter.innerHTML = `<option value="all">All hobbies</option>`;
  hobbies.forEach(hobby => {
    const option = document.createElement("option");
    option.value = hobby;
    option.textContent = hobby;
    hobbyFilter.appendChild(option);
  });

  hobbyFilter.value = hobbies.includes(current) ? current : "all";
}

function refreshAll() {
  refreshHobbyFilter();
  render();
}

function openNewDialog() {
  editingId = null;
  form.reset();
  form.elements.status.value = "planned";
  form.elements.progress.value = 0;
  dialog.showModal();
}

function openEditDialog(item) {
  editingId = item.id;
  form.elements.title.value = item.title;
  form.elements.hobby.value = item.hobby;
  form.elements.status.value = item.status;
  form.elements.progress.value = item.progress;
  form.elements.notes.value = item.notes || "";
  form.elements.tags.value = (item.tags || []).join(", ");
  form.elements.resource.value = item.resource || "";
  dialog.showModal();
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const data = new FormData(form);

  const entry = {
    id: editingId || crypto.randomUUID(),
    title: String(data.get("title")).trim(),
    hobby: String(data.get("hobby")).trim(),
    status: String(data.get("status")),
    progress: Math.min(100, Math.max(0, Number(data.get("progress")) || 0)),
    notes: String(data.get("notes")).trim(),
    tags: String(data.get("tags"))
      .split(",")
      .map(tag => tag.trim())
      .filter(Boolean),
    resource: String(data.get("resource")).trim()
  };

  if (editingId) {
    items = items.map(item => item.id === editingId ? entry : item);
  } else {
    items.unshift(entry);
  }

  saveItems();
  dialog.close();
  refreshAll();
});

document.querySelector("#addButton").addEventListener("click", openNewDialog);
document.querySelector("#closeDialog").addEventListener("click", () => dialog.close());
document.querySelector("#cancelButton").addEventListener("click", () => dialog.close());

searchInput.addEventListener("input", render);
statusFilter.addEventListener("change", render);
hobbyFilter.addEventListener("change", render);

document.querySelector("#exportButton").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "hobby-atlas-data.json";
  a.click();
  URL.revokeObjectURL(url);
});

document.querySelector("#importInput").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported)) throw new Error("Expected an array.");
    items = imported;
    saveItems();
    refreshAll();
    alert("Import complete.");
  } catch {
    alert("That file does not look like a valid Hobby Atlas JSON export.");
  } finally {
    event.target.value = "";
  }
});

const themeToggle = document.querySelector("#themeToggle");
const storedTheme = localStorage.getItem(THEME_KEY);
if (storedTheme === "dark") document.body.classList.add("dark");

function updateThemeIcon() {
  themeToggle.textContent = document.body.classList.contains("dark") ? "☀" : "☾";
}
updateThemeIcon();

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem(THEME_KEY, document.body.classList.contains("dark") ? "dark" : "light");
  updateThemeIcon();
});

const prompts = [
  "What is one tiny thing you can practice for 20 minutes today?",
  "What did you understand this week that felt confusing last week?",
  "Which hobby deserves a small, finished project next?",
  "What could you teach someone else now?",
  "What are you avoiding because the first step feels unclear?"
];
document.querySelector("#dailyPrompt").textContent =
  prompts[new Date().getDate() % prompts.length];

refreshAll();
