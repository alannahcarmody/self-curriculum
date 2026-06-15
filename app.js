const STORAGE_KEY = "commonplace-data";

function cid() {
  return Math.random().toString(36).slice(2, 10);
}

const DEFAULT_DATA = {
  sections: [
    { id: cid(), name: "Articles & Notes", desc: "Articles read, with notes and analysis.", entries: [], refs: [], notes: "" },
    { id: cid(), name: "Books & Analysis", desc: "Books read, with reflections and arguments.", entries: [], refs: [], notes: "" },
    { id: cid(), name: "History & Politics", desc: "Historical readings, DBQ-style analysis, and political thought.", entries: [], refs: [], notes: "" },
    { id: cid(), name: "Writing", desc: "Notes on craft, and takeaways from writing practice.", entries: [], refs: [], notes: "" },
    { id: cid(), name: "Engineering Research", desc: "Research notes, designs, and technical explorations.", entries: [], refs: [], notes: "" },
    { id: cid(), name: "Past Projects", desc: "A record of completed projects.", entries: [], refs: [], notes: "" },
  ]
};

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(DEFAULT_DATA);
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.sections) return structuredClone(DEFAULT_DATA);
    for (const sec of parsed.sections) {
      if (!sec.refs) sec.refs = [];
      if (sec.notes === undefined) sec.notes = "";
    }
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
    renderRefs(null);
    return;
  }
  sectionTitle.textContent = sec.name;
  sectionDesc.textContent = sec.desc || "";

  renderRefs(sec);

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
  const excerptText = (entry.body || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const excerpt = excerptText.slice(0, 220);

  card.innerHTML = `
    <h3 class="entry-title">${escapeHtml(entry.title)}</h3>
    <p class="entry-meta">${[dateStr, entry.ref].filter(Boolean).map(escapeHtml).join(" — ")}</p>
    <p class="entry-excerpt">${escapeHtml(excerpt)}${excerptText.length > 220 ? "…" : ""}</p>
    <div>${tagsHtml}</div>
  `;
  card.addEventListener("click", () => openEntryRead(sec.id, entry.id));
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
let viewingEntryId = null;

function openEntryRead(sectionId, entryId) {
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
  viewBody.innerHTML = entry.body || "";

  showView("read");
}

document.getElementById("backFromReadBtn").addEventListener("click", () => {
  render();
});

document.getElementById("editEntryBtn").addEventListener("click", () => {
  openEntryEdit(viewingSectionId, viewingEntryId);
});

document.getElementById("deleteEntryFromReadBtn").addEventListener("click", () => {
  const sec = data.sections.find(s => s.id === viewingSectionId);
  if (!confirm("Delete this entry?")) return;
  sec.entries = sec.entries.filter(e => e.id !== viewingEntryId);
  save();
  render();
});

// ================= EDIT VIEW =================
const sectionIdInput = document.getElementById("sectionId");
const entryIdInput = document.getElementById("entryId");
const entryTitleInput = document.getElementById("entryTitle");
const entryDateInput = document.getElementById("entryDate");
const entryTagsInput = document.getElementById("entryTags");
const entryRefInput = document.getElementById("entryRef");
const entryBodyEl = document.getElementById("entryBody");
const imageFileInput = document.getElementById("imageFileInput");

function openEntryEdit(sectionId, entryId) {
  sectionIdInput.value = sectionId;
  entryIdInput.value = entryId || "";

  if (entryId) {
    const sec = data.sections.find(s => s.id === sectionId);
    const entry = sec.entries.find(e => e.id === entryId);
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
  const sec = getActiveSection();
  if (!sec) return alert("Create a section first.");
  openEntryEdit(sec.id, null);
});

document.getElementById("backFromEditBtn").addEventListener("click", () => {
  if (entryIdInput.value) {
    openEntryRead(sectionIdInput.value, entryIdInput.value);
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
  const sec = data.sections.find(s => s.id === sectionIdInput.value);
  const entryId = entryIdInput.value;

  const tags = entryTagsInput.value
    .split(",")
    .map(t => t.trim())
    .filter(Boolean);

  const bodyHtml = entryBodyEl.innerHTML;

  let savedEntryId;
  if (entryId) {
    const entry = sec.entries.find(e => e.id === entryId);
    entry.title = title;
    entry.date = entryDateInput.value;
    entry.tags = tags;
    entry.ref = entryRefInput.value.trim();
    entry.body = bodyHtml;
    savedEntryId = entryId;
  } else {
    savedEntryId = cid();
    sec.entries.push({
      id: savedEntryId,
      title,
      date: entryDateInput.value,
      tags,
      ref: entryRefInput.value.trim(),
      body: bodyHtml,
    });
  }
  save();
  openEntryRead(sec.id, savedEntryId);
}

);

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

const TYPE_LABELS = {
  book: "Book",
  article: "Article",
  paper: "Paper",
  topic: "Topic",
  other: "Other",
};

const refNotesEl = document.getElementById("refNotes");

function renderRefs(sec) {
  refNotesEl.value = sec ? (sec.notes || "") : "";
  refNotesEl.disabled = !sec;

  refItems.innerHTML = "";
  if (!sec || sec.refs.length === 0) {
    refCount.textContent = "";
    const empty = document.createElement("div");
    empty.className = "ref-empty";
    empty.textContent = "Nothing on the list yet.";
    refItems.appendChild(empty);
    return;
  }
  refCount.textContent = `(${sec.refs.length})`;
  for (const ref of sec.refs) {
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
        openRefDialog(sec.id, ref.id);
      }
    });
    row.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      openRefDialog(sec.id, ref.id);
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

let refSectionId = null;

function openRefDialog(sectionId, refId) {
  refSectionId = sectionId;
  refIdInput.value = refId || "";
  if (refId) {
    const sec = data.sections.find(s => s.id === sectionId);
    const ref = sec.refs.find(r => r.id === refId);
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
  const sec = getActiveSection();
  if (!sec) return;
  sec.notes = refNotesEl.value;
  save();
});

document.getElementById("addRefBtn").addEventListener("click", () => {
  const sec = getActiveSection();
  if (!sec) return;
  document.getElementById("readingList").open = true;
  openRefDialog(sec.id, null);
});

cancelRefBtn.addEventListener("click", () => refDialog.close());

refForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const sec = data.sections.find(s => s.id === refSectionId);
  const refId = refIdInput.value;
  const refData = {
    title: refTitleInput.value.trim(),
    type: refTypeInput.value,
    link: refLinkInput.value.trim(),
    note: refNoteInput.value.trim(),
  };
  if (refId) {
    Object.assign(sec.refs.find(r => r.id === refId), refData);
  } else {
    sec.refs.push({ id: cid(), ...refData });
  }
  save();
  document.getElementById("readingList").open = true;
  render();
  document.getElementById("readingList").open = true;
  refDialog.close();
});

deleteRefBtn.addEventListener("click", () => {
  const sec = data.sections.find(s => s.id === refSectionId);
  sec.refs = sec.refs.filter(r => r.id !== refIdInput.value);
  save();
  document.getElementById("readingList").open = true;
  render();
  document.getElementById("readingList").open = true;
  refDialog.close();
});

// ================= SECTIONS =================
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
    const sec = { id: cid(), name: sectionNameInput.value.trim(), desc: sectionDescInput.value.trim(), entries: [], refs: [] };
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
