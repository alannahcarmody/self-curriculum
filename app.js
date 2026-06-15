const STORAGE_KEY = "commonplace-data";

function cid() {
  return Math.random().toString(36).slice(2, 10);
}

function newContainer(name, desc) {
  return { id: cid(), name, desc, entries: [], refs: [], notes: "" };
}

const DEFAULT_DATA = {
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
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let data = load();
let activeSectionId = data.sections[0]?.id || null;
let activeSubsectionId = null;

const sectionNav = document.getElementById("sectionNav");
const sectionTitle = document.getElementById("sectionTitle");
const sectionDesc = document.getElementById("sectionDesc");
const entryList = document.getElementById("entryList");
const breadcrumb = document.getElementById("breadcrumb");
const categoryGrid = document.getElementById("categoryGrid");
const addCategoryBtn = document.getElementById("addCategoryBtn");

const listView = document.getElementById("listView");
const readView = document.getElementById("readView");
const editView = document.getElementById("editView");

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
  readView.hidden = view !== "read";
  editView.hidden = view !== "edit";
}

function render() {
  renderNav();
  renderContent();
  showView("list");
}

function renderNav() {
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
    renderRefs(null);
    return;
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
    <h3 class="entry-title">${escapeHtml(entry.title)}</h3>
    <p class="entry-meta">${[dateStr, entry.ref].filter(Boolean).map(escapeHtml).join(" — ")}</p>
    <p class="entry-excerpt">${escapeHtml(excerpt)}${excerptText.length > 220 ? "…" : ""}</p>
    <div>${tagsHtml}</div>
  `;
  card.addEventListener("click", () => openEntryRead(activeSectionId, activeSubsectionId, entry.id));
  return card;
}

function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

// ================= READ VIEW =================
const viewTitle = document.getElementById("viewTitle");
const viewMeta = document.getElementById("viewMeta");
const viewRef = document.getElementById("viewRef");
const viewBody = document.getElementById("viewBody");

let viewingSectionId = null;
let viewingSubsectionId = null;
let viewingEntryId = null;

function openEntryRead(sectionId, subsectionId, entryId) {
  const container = findContainer(sectionId, subsectionId);
  const entry = container.entries.find(e => e.id === entryId);
  viewingSectionId = sectionId;
  viewingSubsectionId = subsectionId;
  viewingEntryId = entryId;

  viewTitle.textContent = entry.title;
  const dateStr = entry.date ? formatDate(entry.date) : "";
  const tags = (entry.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("");
  viewMeta.innerHTML = [escapeHtml(dateStr), tags].filter(Boolean).join(" &nbsp; ");
  viewRef.textContent = entry.ref || "";
  viewRef.style.display = entry.ref ? "block" : "none";
  viewBody.innerHTML = entry.body || "";

  showView("read");
}

document.getElementById("backFromReadBtn").addEventListener("click", () => {
  render();
});

document.getElementById("editEntryBtn").addEventListener("click", () => {
  openEntryEdit(viewingSectionId, viewingSubsectionId, viewingEntryId);
});

document.getElementById("deleteEntryFromReadBtn").addEventListener("click", () => {
  const container = findContainer(viewingSectionId, viewingSubsectionId);
  if (!confirm("Delete this page?")) return;
  container.entries = container.entries.filter(e => e.id !== viewingEntryId);
  save();
  render();
});

// ================= EDIT VIEW =================
const sectionIdInput = document.getElementById("sectionId");
const subsectionIdInput = document.getElementById("subsectionId");
const entryIdInput = document.getElementById("entryId");
const entryTitleInput = document.getElementById("entryTitle");
const entryDateInput = document.getElementById("entryDate");
const entryTagsInput = document.getElementById("entryTags");
const entryRefInput = document.getElementById("entryRef");
const entryBodyEl = document.getElementById("entryBody");
const imageFileInput = document.getElementById("imageFileInput");

function openEntryEdit(sectionId, subsectionId, entryId) {
  sectionIdInput.value = sectionId;
  subsectionIdInput.value = subsectionId || "";
  entryIdInput.value = entryId || "";

  if (entryId) {
    const container = findContainer(sectionId, subsectionId);
    const entry = container.entries.find(e => e.id === entryId);
    entryTitleInput.value = entry.title;
    entryDateInput.value = entry.date || "";
    entryTagsInput.value = (entry.tags || []).join(", ");
    entryRefInput.value = entry.ref || "";
    entryBodyEl.innerHTML = entry.body || "";
  } else {
    entryTitleInput.value = "";
    entryDateInput.value = new Date().toISOString().slice(0, 10);
    entryTagsInput.value = "";
    entryRefInput.value = "";
    entryBodyEl.innerHTML = "";
  }
  showView("edit");
  entryTitleInput.focus();
}

document.getElementById("addEntryBtn").addEventListener("click", () => {
  const container = getActiveContainer();
  if (!container) return alert("Create a section first.");
  openEntryEdit(activeSectionId, activeSubsectionId, null);
});

document.getElementById("backFromEditBtn").addEventListener("click", () => {
  if (entryIdInput.value) {
    openEntryRead(sectionIdInput.value, subsectionIdInput.value || null, entryIdInput.value);
  } else {
    render();
  }
});

document.getElementById("saveEntryBtn").addEventListener("click", () => {
  const title = entryTitleInput.value.trim();
  if (!title) {
    entryTitleInput.focus();
    return;
  }
  const container = findContainer(sectionIdInput.value, subsectionIdInput.value || null);
  const entryId = entryIdInput.value;

  const tags = entryTagsInput.value
    .split(",")
    .map(t => t.trim())
    .filter(Boolean);

  const bodyHtml = entryBodyEl.innerHTML;

  let savedEntryId;
  if (entryId) {
    const entry = container.entries.find(e => e.id === entryId);
    entry.title = title;
    entry.date = entryDateInput.value;
    entry.tags = tags;
    entry.ref = entryRefInput.value.trim();
    entry.body = bodyHtml;
    savedEntryId = entryId;
  } else {
    savedEntryId = cid();
    container.entries.push({
      id: savedEntryId,
      title,
      date: entryDateInput.value,
      tags,
      ref: entryRefInput.value.trim(),
      body: bodyHtml,
    });
  }
  save();
  openEntryRead(sectionIdInput.value, subsectionIdInput.value || null, savedEntryId);
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
  };
  reader.readAsDataURL(file);
  imageFileInput.value = "";
});

// ================= REFERENCES / READING LIST =================
const refItems = document.getElementById("refItems");
const refCount = document.getElementById("refCount");
const refNotesEl = document.getElementById("refNotes");

const TYPE_LABELS = {
  book: "Book",
  article: "Article",
  paper: "Paper",
  topic: "Topic",
  other: "Other",
};

function renderRefs(container) {
  refNotesEl.value = container ? (container.notes || "") : "";
  refNotesEl.disabled = !container;

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
    row.innerHTML = `
      <span class="ref-type">${escapeHtml(TYPE_LABELS[ref.type] || "Other")}</span>
      <span class="ref-title">${escapeHtml(ref.title)}</span>
      ${ref.note ? `<span class="ref-note">${escapeHtml(ref.note)}</span>` : ""}
    `;
    row.addEventListener("click", () => {
      if (ref.link) {
        window.open(ref.link, "_blank", "noopener");
      } else {
        openRefDialog(ref.id);
      }
    });
    row.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      openRefDialog(ref.id);
    });
    refItems.appendChild(row);
  }
}

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

refNotesEl.addEventListener("blur", () => {
  const container = getActiveContainer();
  if (!container) return;
  container.notes = refNotesEl.value;
  save();
});

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
  const container = getActiveContainer();
  container.refs = container.refs.filter(r => r.id !== refIdInput.value);
  save();
  render();
  document.getElementById("readingList").open = true;
  refDialog.close();
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
  sec.subsections = sec.subsections.filter(c => c.id !== editId);
  if (activeSubsectionId === editId) activeSubsectionId = null;
  save();
  render();
  categoryDialog.close();
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
    sec.subsections = sec.subsections.filter(c => c.id !== activeSubsectionId);
    activeSubsectionId = null;
    save();
    render();
  } else {
    const sec = getActiveSection();
    if (!sec) return;
    if (!confirm(`Delete section "${sec.name}", all its categories, and all its pages?`)) return;
    data.sections = data.sections.filter(s => s.id !== sec.id);
    activeSectionId = data.sections[0]?.id || null;
    activeSubsectionId = null;
    save();
    render();
  }
});

render();
