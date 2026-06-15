const STORAGE_KEY = "curriculum-data";

const DEFAULT_DATA = {
  categories: [
    { id: cid(), name: "Engineering", items: [
      { id: cid(), title: "Pick a project to build", notes: "", status: "todo" }
    ]},
    { id: cid(), name: "Mathematics", items: [
      { id: cid(), title: "Choose a textbook / course", notes: "", status: "todo" }
    ]},
    { id: cid(), name: "Languages", items: [] },
    { id: cid(), name: "Literature", items: [] },
    { id: cid(), name: "History / Politics", items: [] },
  ]
};

function cid() {
  return Math.random().toString(36).slice(2, 10);
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(DEFAULT_DATA);
  try { return JSON.parse(raw); } catch { return structuredClone(DEFAULT_DATA); }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let data = load();

const board = document.getElementById("board");

function render() {
  board.innerHTML = "";
  for (const cat of data.categories) {
    board.appendChild(renderCategory(cat));
  }
}

function renderCategory(cat) {
  const done = cat.items.filter(i => i.status === "done").length;
  const total = cat.items.length;

  const el = document.createElement("section");
  el.className = "category";

  const header = document.createElement("div");
  header.className = "category-header";
  header.innerHTML = `
    <div>
      <h2>${escapeHtml(cat.name)}</h2>
      <div class="meta">${done}/${total} done</div>
    </div>
    <div class="category-actions">
      <button class="del-cat" title="Delete category">✕</button>
    </div>
  `;
  header.querySelector(".del-cat").addEventListener("click", () => {
    if (confirm(`Delete category "${cat.name}" and all its items?`)) {
      data.categories = data.categories.filter(c => c.id !== cat.id);
      save();
      render();
    }
  });
  el.appendChild(header);

  const itemsEl = document.createElement("div");
  itemsEl.className = "items";
  if (cat.items.length === 0) {
    const hint = document.createElement("div");
    hint.className = "empty-hint";
    hint.textContent = "No items yet.";
    itemsEl.appendChild(hint);
  }
  for (const item of cat.items) {
    itemsEl.appendChild(renderItem(cat, item));
  }
  el.appendChild(itemsEl);

  const addBtn = document.createElement("button");
  addBtn.className = "add-item-btn";
  addBtn.textContent = "+ Add item";
  addBtn.addEventListener("click", () => openItemDialog(cat.id, null));
  el.appendChild(addBtn);

  return el;
}

function renderItem(cat, item) {
  const el = document.createElement("div");
  el.className = `item ${item.status}`;
  el.innerHTML = `
    <div class="item-title">${escapeHtml(item.title)}</div>
    ${item.notes ? `<div class="item-notes">${escapeHtml(item.notes)}</div>` : ""}
  `;
  el.addEventListener("click", () => openItemDialog(cat.id, item.id));
  return el;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// --- Item dialog ---
const itemDialog = document.getElementById("itemDialog");
const itemForm = document.getElementById("itemForm");
const dialogTitle = document.getElementById("dialogTitle");
const categoryIdInput = document.getElementById("categoryId");
const itemIdInput = document.getElementById("itemId");
const itemTitleInput = document.getElementById("itemTitle");
const itemNotesInput = document.getElementById("itemNotes");
const itemStatusInput = document.getElementById("itemStatus");
const deleteItemBtn = document.getElementById("deleteItemBtn");
const cancelItemBtn = document.getElementById("cancelItemBtn");

function openItemDialog(catId, itemId) {
  categoryIdInput.value = catId;
  itemIdInput.value = itemId || "";

  if (itemId) {
    const cat = data.categories.find(c => c.id === catId);
    const item = cat.items.find(i => i.id === itemId);
    dialogTitle.textContent = "Edit Item";
    itemTitleInput.value = item.title;
    itemNotesInput.value = item.notes;
    itemStatusInput.value = item.status;
    deleteItemBtn.style.display = "inline-block";
  } else {
    dialogTitle.textContent = "Add Item";
    itemTitleInput.value = "";
    itemNotesInput.value = "";
    itemStatusInput.value = "todo";
    deleteItemBtn.style.display = "none";
  }
  itemDialog.showModal();
  itemTitleInput.focus();
}

itemForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const catId = categoryIdInput.value;
  const itemId = itemIdInput.value;
  const cat = data.categories.find(c => c.id === catId);

  if (itemId) {
    const item = cat.items.find(i => i.id === itemId);
    item.title = itemTitleInput.value.trim();
    item.notes = itemNotesInput.value.trim();
    item.status = itemStatusInput.value;
  } else {
    cat.items.push({
      id: cid(),
      title: itemTitleInput.value.trim(),
      notes: itemNotesInput.value.trim(),
      status: itemStatusInput.value
    });
  }
  save();
  render();
  itemDialog.close();
});

cancelItemBtn.addEventListener("click", () => itemDialog.close());

deleteItemBtn.addEventListener("click", () => {
  const catId = categoryIdInput.value;
  const itemId = itemIdInput.value;
  const cat = data.categories.find(c => c.id === catId);
  cat.items = cat.items.filter(i => i.id !== itemId);
  save();
  render();
  itemDialog.close();
});

// --- Category dialog ---
const categoryDialog = document.getElementById("categoryDialog");
const categoryForm = document.getElementById("categoryForm");
const categoryNameInput = document.getElementById("categoryName");
const cancelCategoryBtn = document.getElementById("cancelCategoryBtn");

document.getElementById("addCategoryBtn").addEventListener("click", () => {
  categoryNameInput.value = "";
  categoryDialog.showModal();
  categoryNameInput.focus();
});

cancelCategoryBtn.addEventListener("click", () => categoryDialog.close());

categoryForm.addEventListener("submit", (e) => {
  e.preventDefault();
  data.categories.push({ id: cid(), name: categoryNameInput.value.trim(), items: [] });
  save();
  render();
  categoryDialog.close();
});

render();
