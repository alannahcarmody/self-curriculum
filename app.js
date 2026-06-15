const STORAGE_KEY = "commonplace-data";

function cid() {
  return Math.random().toString(36).slice(2, 10);
}

function newContainer(name, desc) {
  return { id: cid(), name, desc, cover: "", entries: [], refs: [], notes: "" };
}

const DEFAULT_DATA = {
  homeIntro: "",
  homeLinks: [],
  sections: [
    Object.assign(newContainer("Articles & Notes", "Articles read, with notes and analysis."), { subsections: [] }),
    Object.assign(newContainer("Books & Analysis", "Books read, with reflections and arguments."), { subsections: [] }),
    Object.assign(newContainer("History & Politics", "Historical readings, DBQ-style analysis, and political thought."), { subsections: [
      newContainer("IB History Review", "Revisiting IB History content, essays, and source analysis technique."),
    ] }),
    Object.assign(newContainer("Writing", "Notes on craft, and takeaways from writing practice."), { subsections: [
      newContainer("IB Lang & Lit Techniques", "Literary devices, rhetorical analysis, and commentary technique from IB."),
    ] }),
    Object.assign(newContainer("Engineering Research", "Research notes, designs, and technical explorations."), { subsections: [
      newContainer("Thermodynamics", ""),
      newContainer("Controls", ""),
      newContainer("Heat Transfer", ""),
      newContainer("Fluids", ""),
      newContainer("How Things Are Made", "Reverse-engineering and manufacturing notes, drawing on UCLA coursework."),
    ] }),
    Object.assign(newContainer("Past Projects", "A record of completed projects."), { subsections: [] }),
  ]
};

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(DEFAULT_DATA);
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.sections) return structuredClone(DEFAULT_DATA);
    if (parsed.homeIntro === undefined) parsed.homeIntro = "";
    if (!parsed.homeLinks) parsed.homeLinks = [];
    for (const sec of parsed.sections) {
      normalizeContainer(sec);
      if (!sec.subsections) sec.subsections = [];
      for (const sub of sec.subsections) normalizeContainer(sub);
    }
    return parsed;
  } catch {
    return structuredClone(DEFAULT_DATA);
  }
}

function normalizeContainer(c) {
  if (!c.refs) c.refs = [];
  if (c.notes === undefined) c.notes = "";
  if (!c.entries) c.entries = [];
  if (c.cover === undefined) c.cover = "";
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let data = load();
let activeSectionId = null;
let activeSubsectionId = "home";

const sectionNav = document.getElementById("sectionNav");
const sectionTitle = document.getElementById("sectionTitle");
const sectionDesc = document.getElementById("sectionDesc");
const entryList = document.getElementById("entryList");
const breadcrumb = document.getElementById("breadcrumb");
const categoryGrid = document.getElementById("categoryGrid");
const addCategoryBtn = document.getElementById("addCategoryBtn");

const listView = document.getElementById("listView");
const pageView = document.getElementById("pageView");
const homeView = document.getElementById("homeView");

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function getActiveSection() {
  return data.sections.find(s => s.id === activeSectionId) || data.sections[0];
}

// The "container" is whichever level is currently open: a top-level section,
// or a category (subsection) within it.
function getActiveContainer() {
  const sec = getActiveSection();
  if (!sec) return null;
  if (activeSubsectionId) {
    return sec.subsections.find(c => c.id === activeSubsectionId) || sec;
  }
  return sec;
}

function findContainer(sectionId, subsectionId) {
  const sec = data.sections.find(s => s.id === sectionId);
  if (!sec) return null;
  return subsectionId ? sec.subsections.find(c => c.id === subsectionId) : sec;
}

function showView(view) {
  listView.hidden = view !== "list";
  pageView.hidden = view !== "page";
  homeView.hidden = view !== "home";
}

function render() {
  renderNav();
  if (activeSectionId === null && activeSubsectionId === "home") {
    renderHome();
    showView("home");
    return;
  }
  renderContent();
  showView("list");
}

function goHome() {
  activeSectionId = null;
  activeSubsectionId = "home";
  render();
}

document.getElementById("homeNavBtn").addEventListener("click", goHome);

function renderHome() {
  document.getElementById("homeIntro").innerHTML = data.homeIntro || "";
  renderHomeLinks();

  const grid = document.getElementById("homeSectionGrid");
  grid.innerHTML = "";
  for (const sec of data.sections) {
    const totalPages = sec.entries.length + sec.subsections.reduce((n, s) => n + s.entries.length, 0);
    const card = document.createElement("button");
    card.className = "category-card";
    card.innerHTML = `
      ${sec.cover ? `<img class="category-card-cover" src="${sec.cover}" alt="">` : ""}
      <h4>${escapeHtml(sec.name)}</h4>
      ${sec.desc ? `<p>${escapeHtml(sec.desc)}</p>` : ""}
      <span class="category-count">${totalPages} page${totalPages === 1 ? "" : "s"}${sec.subsections.length ? ` · ${sec.subsections.length} categor${sec.subsections.length === 1 ? "y" : "ies"}` : ""}</span>
    `;
    card.addEventListener("click", () => {
      activeSectionId = sec.id;
      activeSubsectionId = null;
      render();
    });
    grid.appendChild(card);
  }

  // Recently updated pages across all sections/categories
  const all = [];
  for (const sec of data.sections) {
    for (const e of sec.entries) all.push({ entry: e, sectionId: sec.id, subsectionId: null, sectionName: sec.name });
    for (const sub of sec.subsections) {
      for (const e of sub.entries) all.push({ entry: e, sectionId: sec.id, subsectionId: sub.id, sectionName: `${sec.name} / ${sub.name}` });
    }
  }
  all.sort((a, b) => (b.entry.date || "").localeCompare(a.entry.date || ""));

  const recentList = document.getElementById("homeRecentList");
  recentList.innerHTML = "";
  if (all.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Nothing written yet. Pick a section to get started.";
    recentList.appendChild(empty);
    return;
  }
  for (const item of all.slice(0, 10)) {
    const card = renderEntryCard(item.entry);
    const path = document.createElement("p");
    path.className = "home-recent-path";
    path.textContent = item.sectionName;
    card.insertBefore(path, card.firstChild);
    card.onclick = () => openPage(item.sectionId, item.subsectionId, item.entry.id);
    recentList.appendChild(card);
  }
}

// ================= UNDO =================
const undoToast = document.getElementById("undoToast");
const undoMessage = document.getElementById("undoMessage");
const undoBtn = document.getElementById("undoBtn");
let undoTimer = null;
let pendingRestore = null;

function offerUndo(message, snapshot) {
  pendingRestore = snapshot;
  undoMessage.textContent = message;
  undoToast.hidden = false;
  clearTimeout(undoTimer);
  undoTimer = setTimeout(() => { undoToast.hidden = true; pendingRestore = null; }, 8000);
}

undoBtn.addEventListener("click", () => {
  if (!pendingRestore) return;
  data = pendingRestore;
  save();
  undoToast.hidden = true;
  pendingRestore = null;
  render();
});

function snapshot() {
  return structuredClone(data);
}

// ================= NAV =================
function renderNav() {
  document.getElementById("homeNavBtn").classList.toggle("active", activeSectionId === null);
  sectionNav.innerHTML = "";
  for (const sec of data.sections) {
    const btn = document.createElement("button");
    btn.className = "nav-item" + (sec.id === activeSectionId && !activeSubsectionId ? " active" : "");
    btn.textContent = sec.name;
    btn.addEventListener("click", () => {
      activeSectionId = sec.id;
      activeSubsectionId = null;
      render();
    });
    sectionNav.appendChild(btn);

    if (sec.id === activeSectionId) {
      for (const sub of sec.subsections) {
        const subBtn = document.createElement("button");
        subBtn.className = "nav-subitem" + (sub.id === activeSubsectionId ? " active" : "");
        subBtn.textContent = sub.name;
        subBtn.addEventListener("click", () => {
          activeSectionId = sec.id;
          activeSubsectionId = sub.id;
          render();
        });
        sectionNav.appendChild(subBtn);
      }
    }
  }
}

// ================= CONTENT =================
const coverWrap = document.getElementById("coverWrap");
const coverImg = document.getElementById("coverImg");
const addCoverBtn = document.getElementById("addCoverBtn");
const changeCoverBtn = document.getElementById("changeCoverBtn");
const removeCoverBtn = document.getElementById("removeCoverBtn");
const coverFileInput = document.getElementById("coverFileInput");

function renderContent() {
  const sec = getActiveSection();
  const container = getActiveContainer();

  if (!container) {
    sectionTitle.textContent = "No sections yet";
    sectionDesc.textContent = "";
    entryList.innerHTML = "";
    categoryGrid.innerHTML = "";
    breadcrumb.hidden = true;
    addCategoryBtn.hidden = true;
    coverWrap.hidden = true;
    addCoverBtn.hidden = true;
    renderRefs(null);
    return;
  }

  // Cover image
  if (container.cover) {
    coverWrap.hidden = false;
    coverImg.src = container.cover;
    addCoverBtn.hidden = true;
  } else {
    coverWrap.hidden = true;
    addCoverBtn.hidden = false;
  }

  // Breadcrumb
  if (activeSubsectionId) {
    breadcrumb.hidden = false;
    breadcrumb.innerHTML = "";
    const link = document.createElement("a");
    link.textContent = sec.name;
    link.addEventListener("click", () => {
      activeSubsectionId = null;
      render();
    });
    breadcrumb.appendChild(link);
    breadcrumb.appendChild(document.createTextNode(" / " + container.name));
  } else {
    breadcrumb.hidden = true;
  }

  sectionTitle.textContent = container.name;
  sectionDesc.textContent = container.desc || "";

  // Category grid (only at section root)
  addCategoryBtn.hidden = !!activeSubsectionId;
  categoryGrid.innerHTML = "";
  if (!activeSubsectionId) {
    for (const sub of sec.subsections) {
      const card = document.createElement("button");
      card.className = "category-card";
      card.innerHTML = `
        ${sub.cover ? `<img class="category-card-cover" src="${sub.cover}" alt="">` : ""}
        <h4>${escapeHtml(sub.name)}</h4>
        ${sub.desc ? `<p>${escapeHtml(sub.desc)}</p>` : ""}
        <span class="category-count">${sub.entries.length} page${sub.entries.length === 1 ? "" : "s"}</span>
      `;
      card.addEventListener("click", () => {
        activeSubsectionId = sub.id;
        render();
      });
      categoryGrid.appendChild(card);
    }
  }

  renderRefs(container);

  entryList.innerHTML = "";
  if (container.entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = activeSubsectionId
      ? "Nothing here yet. Add your first page."
      : "Nothing here yet. Add a page, or break this section into categories above.";
    entryList.appendChild(empty);
    return;
  }

  const sorted = [...container.entries].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  for (const entry of sorted) {
    entryList.appendChild(renderEntryCard(entry));
  }
}

function renderEntryCard(entry) {
  const card = document.createElement("article");
  card.className = "entry-card";

  const tagsHtml = (entry.tags || [])
    .map(t => `<span class="tag">${escapeHtml(t)}</span>`)
    .join("");

  const dateStr = entry.date ? formatDate(entry.date) : "";
  const excerptText = (entry.body || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const excerpt = excerptText.slice(0, 220);

  card.innerHTML = `
    <h3 class="entry-title">${escapeHtml(entry.title) || "Untitled"}</h3>
    <p class="entry-meta">${[dateStr, entry.ref].filter(Boolean).map(escapeHtml).join(" — ")}</p>
    <p class="entry-excerpt">${escapeHtml(excerpt)}${excerptText.length > 220 ? "…" : ""}</p>
    <div>${tagsHtml}</div>
  `;
  card.addEventListener("click", () => openPage(activeSectionId, activeSubsectionId, entry.id));
  return card;
}

function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

// ================= COVER IMAGE =================
let coverTargetIsCategory = false;

function openCoverPicker() {
  coverFileInput.click();
}

addCoverBtn.addEventListener("click", openCoverPicker);
changeCoverBtn.addEventListener("click", openCoverPicker);

coverFileInput.addEventListener("change", () => {
  const file = coverFileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const container = getActiveContainer();
    container.cover = reader.result;
    save();
    render();
  };
  reader.readAsDataURL(file);
  coverFileInput.value = "";
});

removeCoverBtn.addEventListener("click", () => {
  const before = snapshot();
  const container = getActiveContainer();
  container.cover = "";
  save();
  render();
  offerUndo("Cover image removed.", before);
});

// ================= PAGE VIEW (Notion-style) =================
const sectionIdInput = document.getElementById("sectionId");
const subsectionIdInput = document.getElementById("subsectionId");
const entryIdInput = document.getElementById("entryId");
const entryTitleInput = document.getElementById("entryTitle");
const entryDateInput = document.getElementById("entryDate");
const entryTagsInput = document.getElementById("entryTags");
const entryRefInput = document.getElementById("entryRef");
const entryBodyEl = document.getElementById("entryBody");
const imageFileInput = document.getElementById("imageFileInput");
const saveIndicator = document.getElementById("saveIndicator");
const deleteEntryBtn = document.getElementById("deleteEntryBtn");

let saveDebounce = null;

function openPage(sectionId, subsectionId, entryId) {
  sectionIdInput.value = sectionId;
  subsectionIdInput.value = subsectionId || "";
  entryIdInput.value = entryId;

  const container = findContainer(sectionId, subsectionId);
  const entry = container.entries.find(e => e.id === entryId);

  entryTitleInput.value = entry.title || "";
  entryDateInput.value = entry.date || "";
  entryTagsInput.value = (entry.tags || []).join(", ");
  entryRefInput.value = entry.ref || "";
  entryBodyEl.innerHTML = entry.body || "";

  saveIndicator.classList.remove("visible");
  showView("page");
  if (!entry.title) {
    entryTitleInput.focus();
  }
}

function getCurrentEntry() {
  const container = findContainer(sectionIdInput.value, subsectionIdInput.value || null);
  if (!container) return null;
  return container.entries.find(e => e.id === entryIdInput.value);
}

function persistCurrentEntry() {
  const entry = getCurrentEntry();
  if (!entry) return;
  entry.title = entryTitleInput.value.trim();
  entry.date = entryDateInput.value;
  entry.tags = entryTagsInput.value.split(",").map(t => t.trim()).filter(Boolean);
  entry.ref = entryRefInput.value.trim();
  entry.body = entryBodyEl.innerHTML;
  save();
  flashSaved();
}

function flashSaved() {
  saveIndicator.textContent = "Saved";
  saveIndicator.classList.add("visible");
  clearTimeout(saveDebounce);
  saveDebounce = setTimeout(() => saveIndicator.classList.remove("visible"), 1200);
}

let inputDebounce = null;
function scheduleSave() {
  clearTimeout(inputDebounce);
  inputDebounce = setTimeout(persistCurrentEntry, 500);
}

[entryTitleInput, entryDateInput, entryTagsInput, entryRefInput].forEach(el => {
  el.addEventListener("input", scheduleSave);
});
entryBodyEl.addEventListener("input", scheduleSave);

document.getElementById("addEntryBtn").addEventListener("click", () => {
  const container = getActiveContainer();
  if (!container) return alert("Create a section first.");
  const entry = {
    id: cid(),
    title: "",
    date: new Date().toISOString().slice(0, 10),
    tags: [],
    ref: "",
    body: "",
  };
  container.entries.push(entry);
  save();
  openPage(activeSectionId, activeSubsectionId, entry.id);
});

document.getElementById("backFromPageBtn").addEventListener("click", () => {
  clearTimeout(inputDebounce);
  persistCurrentEntry();

  // Remove untouched blank pages so navigating away doesn't litter empty entries
  const entry = getCurrentEntry();
  const container = findContainer(sectionIdInput.value, subsectionIdInput.value || null);
  if (entry && !entry.title && !entry.body.trim() && entry.tags.length === 0 && !entry.ref) {
    container.entries = container.entries.filter(e => e.id !== entry.id);
    save();
  }
  render();
});

deleteEntryBtn.addEventListener("click", () => {
  if (!confirm("Delete this page?")) return;
  const before = snapshot();
  const container = findContainer(sectionIdInput.value, subsectionIdInput.value || null);
  container.entries = container.entries.filter(e => e.id !== entryIdInput.value);
  save();
  render();
  offerUndo("Page deleted.", before);
});

// Image insertion
document.getElementById("insertImageBtn").addEventListener("click", () => {
  imageFileInput.click();
});

imageFileInput.addEventListener("change", () => {
  const file = imageFileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    entryBodyEl.focus();
    document.execCommand("insertImage", false, reader.result);
    scheduleSave();
  };
  reader.readAsDataURL(file);
  imageFileInput.value = "";
});

// ================= REFERENCES / READING LIST =================
const refItems = document.getElementById("refItems");
const refCount = document.getElementById("refCount");
const refNotesEl = document.getElementById("refNotes");
const notesDisplay = document.getElementById("notesDisplay");
const notesIndicator = document.getElementById("notesIndicator");

const TYPE_LABELS = {
  book: "Book",
  article: "Article",
  paper: "Paper",
  topic: "Topic",
  other: "Other",
};

function renderRefs(container) {
  // Notes / Plan & Skills — bullet display, click to edit
  if (!container) {
    notesDisplay.innerHTML = `<div class="ref-empty">Nothing yet.</div>`;
    notesIndicator.textContent = "";
    refNotesEl.value = "";
    refNotesEl.hidden = true;
    notesDisplay.hidden = false;
  } else {
    const lines = (container.notes || "").split("\n").map(l => l.trim()).filter(Boolean);
    notesIndicator.textContent = lines.length ? `(${lines.length})` : "";
    if (lines.length) {
      notesDisplay.innerHTML = `<ul>${lines.map(l => `<li>${escapeHtml(l.replace(/^[-*]\s*/, ""))}</li>`).join("")}</ul>`;
    } else {
      notesDisplay.innerHTML = `<div class="ref-empty">Click to add focus areas, skills, and plans for this ${activeSubsectionId ? "category" : "section"}.</div>`;
    }
    refNotesEl.value = container.notes || "";
  }

  // Linked references
  refItems.innerHTML = "";
  if (!container || container.refs.length === 0) {
    refCount.textContent = "";
    const empty = document.createElement("div");
    empty.className = "ref-empty";
    empty.textContent = "Nothing on the list yet.";
    refItems.appendChild(empty);
    return;
  }
  refCount.textContent = `(${container.refs.length})`;
  for (const ref of container.refs) {
    const row = document.createElement("div");
    row.className = "ref-item";

    const main = document.createElement("div");
    main.className = "ref-item-main";
    main.innerHTML = `
      <span class="ref-type">${escapeHtml(TYPE_LABELS[ref.type] || "Other")}</span>
      <span class="ref-title">${escapeHtml(ref.title)}</span>
      ${ref.note ? `<span class="ref-note">${escapeHtml(ref.note)}</span>` : ""}
    `;
    if (ref.link) {
      main.addEventListener("click", () => window.open(ref.link, "_blank", "noopener"));
    }
    row.appendChild(main);

    const actions = document.createElement("div");
    actions.className = "ref-item-actions";
    const editBtn = document.createElement("button");
    editBtn.className = "ref-icon-btn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", (e) => { e.stopPropagation(); openRefDialog(ref.id); });
    const delBtn = document.createElement("button");
    delBtn.className = "ref-icon-btn";
    delBtn.textContent = "Remove";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const before = snapshot();
      container.refs = container.refs.filter(r => r.id !== ref.id);
      save();
      render();
      document.getElementById("readingList").open = true;
      offerUndo("Reference removed.", before);
    });
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    row.appendChild(actions);

    refItems.appendChild(row);
  }
}

// Notes click-to-edit
notesDisplay.addEventListener("click", () => {
  const container = getActiveContainer();
  if (!container) return;
  notesDisplay.hidden = true;
  refNotesEl.hidden = false;
  refNotesEl.focus();
});

refNotesEl.addEventListener("blur", () => {
  const container = getActiveContainer();
  if (!container) return;
  container.notes = refNotesEl.value;
  save();
  refNotesEl.hidden = true;
  notesDisplay.hidden = false;
  renderRefs(container);
});

const refDialog = document.getElementById("refDialog");
const refForm = document.getElementById("refForm");
const refDialogTitle = document.getElementById("refDialogTitle");
const refIdInput = document.getElementById("refId");
const refTitleInput = document.getElementById("refTitle");
const refTypeInput = document.getElementById("refType");
const refLinkInput = document.getElementById("refLink");
const refNoteInput = document.getElementById("refNote");
const deleteRefBtn = document.getElementById("deleteRefBtn");
const cancelRefBtn = document.getElementById("cancelRefBtn");

function openRefDialog(refId) {
  refIdInput.value = refId || "";
  if (refId) {
    const container = getActiveContainer();
    const ref = container.refs.find(r => r.id === refId);
    refDialogTitle.textContent = "Edit Reference";
    refTitleInput.value = ref.title;
    refTypeInput.value = ref.type;
    refLinkInput.value = ref.link || "";
    refNoteInput.value = ref.note || "";
    deleteRefBtn.style.display = "inline-block";
  } else {
    refDialogTitle.textContent = "Add Reference";
    refTitleInput.value = "";
    refTypeInput.value = "book";
    refLinkInput.value = "";
    refNoteInput.value = "";
    deleteRefBtn.style.display = "none";
  }
  refDialog.showModal();
  refTitleInput.focus();
}

document.getElementById("addRefBtn").addEventListener("click", () => {
  const container = getActiveContainer();
  if (!container) return;
  document.getElementById("readingList").open = true;
  openRefDialog(null);
});

cancelRefBtn.addEventListener("click", () => refDialog.close());

refForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const container = getActiveContainer();
  const refId = refIdInput.value;
  const refData = {
    title: refTitleInput.value.trim(),
    type: refTypeInput.value,
    link: refLinkInput.value.trim(),
    note: refNoteInput.value.trim(),
  };
  if (refId) {
    Object.assign(container.refs.find(r => r.id === refId), refData);
  } else {
    container.refs.push({ id: cid(), ...refData });
  }
  save();
  render();
  document.getElementById("readingList").open = true;
  refDialog.close();
});

deleteRefBtn.addEventListener("click", () => {
  const before = snapshot();
  const container = getActiveContainer();
  container.refs = container.refs.filter(r => r.id !== refIdInput.value);
  save();
  render();
  document.getElementById("readingList").open = true;
  refDialog.close();
  offerUndo("Reference removed.", before);
});

// ================= SECTIONS (top level) =================
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

cancelSectionBtn.addEventListener("click", () => sectionDialog.close());

sectionForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const editId = sectionEditIdInput.value;
  if (editId) {
    const sec = data.sections.find(s => s.id === editId);
    sec.name = sectionNameInput.value.trim();
    sec.desc = sectionDescInput.value.trim();
  } else {
    const sec = Object.assign(newContainer(sectionNameInput.value.trim(), sectionDescInput.value.trim()), { subsections: [] });
    data.sections.push(sec);
    activeSectionId = sec.id;
    activeSubsectionId = null;
  }
  save();
  render();
  sectionDialog.close();
});

// ================= CATEGORIES (subsections) =================
const categoryDialog = document.getElementById("categoryDialog");
const categoryForm = document.getElementById("categoryForm");
const categoryDialogTitle = document.getElementById("categoryDialogTitle");
const categoryEditIdInput = document.getElementById("categoryEditId");
const categoryNameInput = document.getElementById("categoryName");
const categoryDescInput = document.getElementById("categoryDescInput");
const deleteCategoryBtn = document.getElementById("deleteCategoryBtn");
const cancelCategoryBtn = document.getElementById("cancelCategoryBtn");

addCategoryBtn.addEventListener("click", () => {
  categoryDialogTitle.textContent = "New Category";
  categoryEditIdInput.value = "";
  categoryNameInput.value = "";
  categoryDescInput.value = "";
  deleteCategoryBtn.style.display = "none";
  categoryDialog.showModal();
  categoryNameInput.focus();
});

cancelCategoryBtn.addEventListener("click", () => categoryDialog.close());

categoryForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const sec = getActiveSection();
  const editId = categoryEditIdInput.value;
  if (editId) {
    const sub = sec.subsections.find(c => c.id === editId);
    sub.name = categoryNameInput.value.trim();
    sub.desc = categoryDescInput.value.trim();
  } else {
    const sub = newContainer(categoryNameInput.value.trim(), categoryDescInput.value.trim());
    sec.subsections.push(sub);
  }
  save();
  render();
  categoryDialog.close();
});

deleteCategoryBtn.addEventListener("click", () => {
  const sec = getActiveSection();
  const editId = categoryEditIdInput.value;
  const sub = sec.subsections.find(c => c.id === editId);
  if (!confirm(`Delete category "${sub.name}" and all its pages?`)) return;
  const before = snapshot();
  sec.subsections = sec.subsections.filter(c => c.id !== editId);
  if (activeSubsectionId === editId) activeSubsectionId = null;
  save();
  render();
  categoryDialog.close();
  offerUndo(`Category "${sub.name}" deleted.`, before);
});

// ================= RENAME / DELETE (current container) =================
document.getElementById("renameSectionBtn").addEventListener("click", () => {
  if (activeSubsectionId) {
    const sec = getActiveSection();
    const sub = sec.subsections.find(c => c.id === activeSubsectionId);
    categoryDialogTitle.textContent = "Edit Category";
    categoryEditIdInput.value = sub.id;
    categoryNameInput.value = sub.name;
    categoryDescInput.value = sub.desc || "";
    deleteCategoryBtn.style.display = "inline-block";
    categoryDialog.showModal();
    categoryNameInput.focus();
  } else {
    const sec = getActiveSection();
    if (!sec) return;
    sectionDialogTitle.textContent = "Edit Section";
    sectionEditIdInput.value = sec.id;
    sectionNameInput.value = sec.name;
    sectionDescInput.value = sec.desc || "";
    sectionDialog.showModal();
    sectionNameInput.focus();
  }
});

document.getElementById("deleteSectionBtn").addEventListener("click", () => {
  if (activeSubsectionId) {
    const sec = getActiveSection();
    const sub = sec.subsections.find(c => c.id === activeSubsectionId);
    if (!confirm(`Delete category "${sub.name}" and all its pages?`)) return;
    const before = snapshot();
    sec.subsections = sec.subsections.filter(c => c.id !== activeSubsectionId);
    activeSubsectionId = null;
    save();
    render();
    offerUndo(`Category "${sub.name}" deleted.`, before);
  } else {
    const sec = getActiveSection();
    if (!sec) return;
    if (!confirm(`Delete section "${sec.name}", all its categories, and all its pages?`)) return;
    const before = snapshot();
    data.sections = data.sections.filter(s => s.id !== sec.id);
    activeSectionId = data.sections[0]?.id || null;
    activeSubsectionId = null;
    save();
    render();
    offerUndo(`Section "${sec.name}" deleted.`, before);
  }
});

// ================= HOME: INTRO + LINKS =================
document.getElementById("homeIntro").addEventListener("blur", () => {
  data.homeIntro = document.getElementById("homeIntro").innerHTML;
  save();
});

function renderHomeLinks() {
  const list = document.getElementById("homeLinks");
  list.innerHTML = "";
  if (data.homeLinks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "ref-empty";
    empty.textContent = "No links yet.";
    list.appendChild(empty);
    return;
  }
  for (const link of data.homeLinks) {
    const row = document.createElement("div");
    row.className = "ref-item";

    const main = document.createElement("div");
    main.className = "ref-item-main";
    main.innerHTML = `<span class="ref-title">${escapeHtml(link.title)}</span>`;
    main.addEventListener("click", () => window.open(link.url, "_blank", "noopener"));
    row.appendChild(main);

    const actions = document.createElement("div");
    actions.className = "ref-item-actions";
    const editBtn = document.createElement("button");
    editBtn.className = "ref-icon-btn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", (e) => { e.stopPropagation(); openHomeLinkDialog(link.id); });
    const delBtn = document.createElement("button");
    delBtn.className = "ref-icon-btn";
    delBtn.textContent = "Remove";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const before = snapshot();
      data.homeLinks = data.homeLinks.filter(l => l.id !== link.id);
      save();
      renderHomeLinks();
      offerUndo("Link removed.", before);
    });
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    row.appendChild(actions);

    list.appendChild(row);
  }
}

const homeLinkDialog = document.getElementById("homeLinkDialog");
const homeLinkForm = document.getElementById("homeLinkForm");
const homeLinkDialogTitle = document.getElementById("homeLinkDialogTitle");
const homeLinkIdInput = document.getElementById("homeLinkId");
const homeLinkTitleInput = document.getElementById("homeLinkTitle");
const homeLinkUrlInput = document.getElementById("homeLinkUrl");
const deleteHomeLinkBtn = document.getElementById("deleteHomeLinkBtn");

function openHomeLinkDialog(linkId) {
  homeLinkIdInput.value = linkId || "";
  if (linkId) {
    const link = data.homeLinks.find(l => l.id === linkId);
    homeLinkDialogTitle.textContent = "Edit Link";
    homeLinkTitleInput.value = link.title;
    homeLinkUrlInput.value = link.url;
    deleteHomeLinkBtn.style.display = "inline-block";
  } else {
    homeLinkDialogTitle.textContent = "Add Link";
    homeLinkTitleInput.value = "";
    homeLinkUrlInput.value = "";
    deleteHomeLinkBtn.style.display = "none";
  }
  homeLinkDialog.showModal();
  homeLinkTitleInput.focus();
}

document.getElementById("addHomeLinkBtn").addEventListener("click", () => openHomeLinkDialog(null));
document.getElementById("cancelHomeLinkBtn").addEventListener("click", () => homeLinkDialog.close());

homeLinkForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const linkId = homeLinkIdInput.value;
  const linkData = { title: homeLinkTitleInput.value.trim(), url: homeLinkUrlInput.value.trim() };
  if (linkId) {
    Object.assign(data.homeLinks.find(l => l.id === linkId), linkData);
  } else {
    data.homeLinks.push({ id: cid(), ...linkData });
  }
  save();
  renderHomeLinks();
  homeLinkDialog.close();
});

deleteHomeLinkBtn.addEventListener("click", () => {
  const before = snapshot();
  data.homeLinks = data.homeLinks.filter(l => l.id !== homeLinkIdInput.value);
  save();
  renderHomeLinks();
  homeLinkDialog.close();
  offerUndo("Link removed.", before);
});

render();
