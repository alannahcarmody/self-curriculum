const STORAGE_KEY = "commonplace-data";

function cid() {
  return Math.random().toString(36).slice(2, 10);
}

const DEFAULT_DATA = {
  sections: [
    { id: cid(), name: "Articles & Notes", desc: "Articles read, with notes and analysis.", entries: [] },
    { id: cid(), name: "Books & Analysis", desc: "Books read, with reflections and arguments.", entries: [] },
    { id: cid(), name: "History & Politics", desc: "Historical readings, DBQ-style analysis, and political thought.", entries: [] },
    { id: cid(), name: "Writing", desc: "Notes on craft, and takeaways from writing practice.", entries: [] },
    { id: cid(), name: "Engineering Research", desc: "Research notes, designs, and technical explorations.", entries: [] },
    { id: cid(), name: "Past Projects", desc: "A record of completed projects.", entries: [] },
  ]
};

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(DEFAULT_DATA);
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.sections) return structuredClone(DEFAULT_DATA);
    return parsed;
  } catch {
    return structuredClone(DEFAULT_DATA);
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let data = load();
let activeSectionId = data.sections[0]?.id || null;

const sectionNav = document.getElementById("sectionNav");
const sectionTitle = document.getElementById("sectionTitle");
const sectionDesc = document.getElementById("sectionDesc");
const entryList = document.getElementById("entryList");

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function getActiveSection() {
  return data.sections.find(s => s.id === activeSectionId) || data.sections[0];
}

function render() {
  renderNav();
  renderContent();
}

function renderNav() {
  sectionNav.innerHTML = "";
  for (const sec of data.sections) {
    const btn = document.createElement("button");
    btn.className = "nav-item" + (sec.id === activeSectionId ? " active" : "");
    btn.textContent = sec.name;
    btn.addEventListener("click", () => {
      activeSectionId = sec.id;
      render();
    });
    sectionNav.appendChild(btn);
  }
}

function renderContent() {
  const sec = getActiveSection();
  if (!sec) {
    sectionTitle.textContent = "No sections yet";
    sectionDesc.textContent = "";
    entryList.innerHTML = "";
    return;
  }
  sectionTitle.textContent = sec.name;
  sectionDesc.textContent = sec.desc || "";

  entryList.innerHTML = "";
  if (sec.entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Nothing here yet. Add your first entry.";
    entryList.appendChild(empty);
    return;
  }

  const sorted = [...sec.entries].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  for (const entry of sorted) {
    entryList.appendChild(renderEntryCard(sec, entry));
  }
}

function renderEntryCard(sec, entry) {
  const card = document.createElement("article");
  card.className = "entry-card";

  const tagsHtml = (entry.tags || [])
    .map(t => `<span class="tag">${escapeHtml(t)}</span>`)
    .join("");

  const dateStr = entry.date ? formatDate(entry.date) : "";
  const excerpt = (entry.body || "").slice(0, 220);

  card.innerHTML = `
    <h3 class="entry-title">${escapeHtml(entry.title)}</h3>
    <p class="entry-meta">${[dateStr, entry.ref].filter(Boolean).map(escapeHtml).join(" — ")}</p>
    <p class="entry-excerpt">${escapeHtml(excerpt)}${entry.body && entry.body.length > 220 ? "…" : ""}</p>
    <div>${tagsHtml}</div>
  `;
  card.addEventListener("click", () => openEntryView(sec.id, entry.id));
  return card;
}

function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

// --- Entry edit dialog ---
const entryDialog = document.getElementById("entryDialog");
const entryForm = document.getElementById("entryForm");
const entryDialogTitle = document.getElementById("entryDialogTitle");
const sectionIdInput = document.getElementById("sectionId");
const entryIdInput = document.getElementById("entryId");
const entryTitleInput = document.getElementById("entryTitle");
const entryDateInput = document.getElementById("entryDate");
const entryTagsInput = document.getElementById("entryTags");
const entryRefInput = document.getElementById("entryRef");
const entryBodyInput = document.getElementById("entryBody");
const deleteEntryBtn = document.getElementById("deleteEntryBtn");
const cancelEntryBtn = document.getElementById("cancelEntryBtn");

function openEntryDialog(sectionId, entryId) {
  sectionIdInput.value = sectionId;
  entryIdInput.value = entryId || "";

  if (entryId) {
    const sec = data.sections.find(s => s.id === sectionId);
    const entry = sec.entries.find(e => e.id === entryId);
    entryDialogTitle.textContent = "Edit Entry";
    entryTitleInput.value = entry.title;
    entryDateInput.value = entry.date || "";
    entryTagsInput.value = (entry.tags || []).join(", ");
    entryRefInput.value = entry.ref || "";
    entryBodyInput.value = entry.body || "";
    deleteEntryBtn.style.display = "inline-block";
  } else {
    entryDialogTitle.textContent = "New Entry";
    entryTitleInput.value = "";
    entryDateInput.value = new Date().toISOString().slice(0, 10);
    entryTagsInput.value = "";
    entryRefInput.value = "";
    entryBodyInput.value = "";
    deleteEntryBtn.style.display = "none";
  }
  entryDialog.showModal();
  entryTitleInput.focus();
}

entryForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const sec = data.sections.find(s => s.id === sectionIdInput.value);
  const entryId = entryIdInput.value;

  const tags = entryTagsInput.value
    .split(",")
    .map(t => t.trim())
    .filter(Boolean);

  if (entryId) {
    const entry = sec.entries.find(e => e.id === entryId);
    entry.title = entryTitleInput.value.trim();
    entry.date = entryDateInput.value;
    entry.tags = tags;
    entry.ref = entryRefInput.value.trim();
    entry.body = entryBodyInput.value;
  } else {
    sec.entries.push({
      id: cid(),
      title: entryTitleInput.value.trim(),
      date: entryDateInput.value,
      tags,
      ref: entryRefInput.value.trim(),
      body: entryBodyInput.value,
    });
  }
  save();
  render();
  entryDialog.close();
});

cancelEntryBtn.addEventListener("click", () => entryDialog.close());

deleteEntryBtn.addEventListener("click", () => {
  const sec = data.sections.find(s => s.id === sectionIdInput.value);
  sec.entries = sec.entries.filter(e => e.id !== entryIdInput.value);
  save();
  render();
  entryDialog.close();
  entryViewDialog.close();
});

document.getElementById("addEntryBtn").addEventListener("click", () => {
  const sec = getActiveSection();
  if (!sec) return alert("Create a section first.");
  openEntryDialog(sec.id, null);
});

// --- Entry view dialog ---
const entryViewDialog = document.getElementById("entryViewDialog");
const viewTitle = document.getElementById("viewTitle");
const viewMeta = document.getElementById("viewMeta");
const viewRef = document.getElementById("viewRef");
const viewBody = document.getElementById("viewBody");
const editEntryBtn = document.getElementById("editEntryBtn");
const closeViewBtn = document.getElementById("closeViewBtn");

let viewingSectionId = null;
let viewingEntryId = null;

function openEntryView(sectionId, entryId) {
  const sec = data.sections.find(s => s.id === sectionId);
  const entry = sec.entries.find(e => e.id === entryId);
  viewingSectionId = sectionId;
  viewingEntryId = entryId;

  viewTitle.textContent = entry.title;
  const dateStr = entry.date ? formatDate(entry.date) : "";
  const tags = (entry.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("");
  viewMeta.innerHTML = [escapeHtml(dateStr), tags].filter(Boolean).join(" &nbsp; ");
  viewRef.textContent = entry.ref || "";
  viewRef.style.display = entry.ref ? "block" : "none";
  viewBody.textContent = entry.body || "";

  entryViewDialog.showModal();
}

editEntryBtn.addEventListener("click", () => {
  entryViewDialog.close();
  openEntryDialog(viewingSectionId, viewingEntryId);
});

closeViewBtn.addEventListener("click", () => entryViewDialog.close());

// --- Section dialog (add / rename) ---
const sectionDialog = document.getElementById("sectionDialog");
const sectionForm = document.getElementById("sectionForm");
const sectionDialogTitle = document.getElementById("sectionDialogTitle");
const sectionEditIdInput = document.getElementById("sectionEditId");
const sectionNameInput = document.getElementById("sectionName");
const sectionDescInput = document.getElementById("sectionDescInput");
const cancelSectionBtn = document.getElementById("cancelSectionBtn");

document.getElementById("addSectionBtn").addEventListener("click", () => {
  sectionDialogTitle.textContent = "New Section";
  sectionEditIdInput.value = "";
  sectionNameInput.value = "";
  sectionDescInput.value = "";
  sectionDialog.showModal();
  sectionNameInput.focus();
});

document.getElementById("renameSectionBtn").addEventListener("click", () => {
  const sec = getActiveSection();
  if (!sec) return;
  sectionDialogTitle.textContent = "Edit Section";
  sectionEditIdInput.value = sec.id;
  sectionNameInput.value = sec.name;
  sectionDescInput.value = sec.desc || "";
  sectionDialog.showModal();
  sectionNameInput.focus();
});

cancelSectionBtn.addEventListener("click", () => sectionDialog.close());

sectionForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const editId = sectionEditIdInput.value;
  if (editId) {
    const sec = data.sections.find(s => s.id === editId);
    sec.name = sectionNameInput.value.trim();
    sec.desc = sectionDescInput.value.trim();
  } else {
    const sec = { id: cid(), name: sectionNameInput.value.trim(), desc: sectionDescInput.value.trim(), entries: [] };
    data.sections.push(sec);
    activeSectionId = sec.id;
  }
  save();
  render();
  sectionDialog.close();
});

document.getElementById("deleteSectionBtn").addEventListener("click", () => {
  const sec = getActiveSection();
  if (!sec) return;
  if (!confirm(`Delete section "${sec.name}" and all its entries?`)) return;
  data.sections = data.sections.filter(s => s.id !== sec.id);
  activeSectionId = data.sections[0]?.id || null;
  save();
  render();
});

render();
