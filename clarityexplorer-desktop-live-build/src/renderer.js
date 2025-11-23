const { ipcRenderer } = require("electron");
const path = require("path");

// -------------------------------------------------------------
// STATE
// -------------------------------------------------------------
let projects = {};
let currentProject = null;
let currentFiles = [];
let currentFilePath = null;
let currentFileHash = null;
let currentAnnotations = { notes: "", highlights: [] };

// -------------------------------------------------------------
// ELEMENTS
// -------------------------------------------------------------
const projectListEl = document.getElementById("project-list");
const fileListEl = document.getElementById("file-list");
const previewTitleEl = document.getElementById("preview-title");
const previewBodyEl = document.getElementById("preview-body");

const notesBoxEl = document.getElementById("notes-box");
const tagsContainerEl = document.getElementById("tags-container");
const tagInputEl = document.getElementById("tag-input");

const projectSearchEl = document.getElementById("project-search");
const globalSearchEl = document.getElementById("global-search");

const addProjectBtn = document.getElementById("add-project-btn");
const addFileBtn = document.getElementById("add-file-btn");
const removeFileBtn = document.getElementById("remove-file-btn");
const deleteProjectBtn = document.getElementById("delete-project-btn");
const openFileBtn = document.getElementById("open-file-btn");

const exportFileNotesBtn = document.getElementById("export-file-notes-btn");
const exportProjectNotesBtn = document.getElementById(
  "export-project-notes-btn"
);

const newProjectBar = document.getElementById("new-project-bar");
const newProjectInput = document.getElementById("new-project-input");
const newProjectCreate = document.getElementById("new-project-create");
const newProjectCancel = document.getElementById("new-project-cancel");

const themeToggleBtn = document.getElementById("theme-toggle-btn");

// -------------------------------------------------------------
// THEME
// -------------------------------------------------------------
function applyTheme(theme) {
  const t = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);
  themeToggleBtn.textContent = t === "dark" ? "☾" : "☀";
  localStorage.setItem("clarityExplorerTheme", t);
}

// -------------------------------------------------------------
// INIT
// -------------------------------------------------------------
(async function init() {
  // Theme init
  const savedTheme = localStorage.getItem("clarityExplorerTheme");
  applyTheme(savedTheme || "dark");

  projects = await ipcRenderer.invoke("projects:load");
  if (!projects) projects = {};
  renderProjects();
})();

themeToggleBtn.onclick = () => {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  applyTheme(current === "dark" ? "light" : "dark");
};

projectSearchEl.oninput = () => renderFileList(false);
globalSearchEl.oninput = () => renderFileList(true);

addProjectBtn.onclick = () => toggleNewProjectBar();
addFileBtn.onclick = () => onAddFiles();
removeFileBtn.onclick = () => onRemoveFile();
deleteProjectBtn.onclick = () => onDeleteProject();
openFileBtn.onclick = () => {
  if (!currentFilePath) {
    alert("Select a file to open.");
    return;
  }
  openExternally(currentFilePath);
};

exportFileNotesBtn.onclick = () => onExportFileNotes();
exportProjectNotesBtn.onclick = () => onExportProjectNotes();

newProjectCreate.onclick = () => createProject();
newProjectCancel.onclick = () => hideNewProjectBar();

newProjectInput.onkeydown = (e) => {
  if (e.key === "Enter") createProject();
  if (e.key === "Escape") hideNewProjectBar();
};

// Notes autosave
notesBoxEl.onblur = saveNotes;

// Tag adding
tagInputEl.onkeydown = (e) => {
  if (e.key === "Enter") {
    const val = tagInputEl.value.trim();
    if (val) {
      addTag(val);
      tagInputEl.value = "";
    }
  }
};

// -------------------------------------------------------------
// Project Bar / CRUD
// -------------------------------------------------------------
function toggleNewProjectBar() {
  if (newProjectBar.classList.contains("hidden")) {
    newProjectInput.value = "";
    newProjectBar.classList.remove("hidden");
    newProjectBar.style.display = "flex";
    newProjectInput.focus();
  } else {
    hideNewProjectBar();
  }
}

function hideNewProjectBar() {
  newProjectBar.classList.add("hidden");
}

function createProject() {
  const name = newProjectInput.value.trim();
  if (!name) return hideNewProjectBar();
  if (!projects[name]) {
    projects[name] = [];
    saveProjects();
    currentProject = name;
    renderProjects();
    renderFileList(false);
  }
  hideNewProjectBar();
}

function onDeleteProject() {
  if (!currentProject) {
    alert("No project selected.");
    return;
  }
  const ok = confirm(
    `Delete project "${currentProject}" from Clarity Explorer?\n\nThis does NOT delete any files on disk.`
  );
  if (!ok) return;

  delete projects[currentProject];
  saveProjects();

  currentProject = null;
  currentFilePath = null;
  currentFileHash = null;
  currentAnnotations = { notes: "", highlights: [] };

  projectSearchEl.value = "";
  globalSearchEl.value = "";
  previewTitleEl.textContent = "";
  previewBodyEl.innerHTML = "";
  notesBoxEl.value = "";
  tagsContainerEl.innerHTML = "";

  renderProjects();
  renderFileList(false);
}

function saveProjects() {
  ipcRenderer.invoke("projects:save", projects);
}

// -------------------------------------------------------------
// Export Notes
// -------------------------------------------------------------
async function onExportFileNotes() {
  if (!currentFilePath) {
    alert("Select a file first.");
    return;
  }
  const res = await ipcRenderer.invoke("export:file-notes", currentFilePath);
  if (res && res.ok && res.savedPath) {
    alert("Notes exported to:\n" + res.savedPath);
  }
}

async function onExportProjectNotes() {
  if (!currentProject) {
    alert("Select a project first.");
    return;
  }
  const res = await ipcRenderer.invoke("export:project-notes", currentProject);
  if (res && res.ok && res.savedPath) {
    alert("Project notes exported to:\n" + res.savedPath);
  }
}

// -------------------------------------------------------------
// Rendering: Projects
// -------------------------------------------------------------
function renderProjects() {
  projectListEl.innerHTML = "";
  Object.keys(projects).forEach((name) => {
    const li = document.createElement("li");
    li.textContent = name;
    if (name === currentProject) li.classList.add("active");
    li.onclick = () => {
      currentProject = name;
      projectSearchEl.value = "";
      globalSearchEl.value = "";
      renderProjects();
      renderFileList(false);
    };
    projectListEl.appendChild(li);
  });
}

// -------------------------------------------------------------
// FILES
// -------------------------------------------------------------
async function onAddFiles() {
  if (!currentProject) {
    alert("Select a project first.");
    return;
  }
  const paths = await ipcRenderer.invoke("dialog:pick-files");
  if (!paths || paths.length === 0) return;

  const list = projects[currentProject];
  paths.forEach((p) => {
    if (!list.some((f) => f.file_path === p)) {
      list.push({ file_path: p, tags: [] });
    }
  });

  saveProjects();
  renderFileList(false);
}

function onRemoveFile() {
  if (!currentProject || !currentFilePath) {
    alert("Select a file to remove from this project.");
    return;
  }
  const base = path.basename(currentFilePath);
  const ok = confirm(
    `Remove "${base}" from project "${currentProject}"?\n\nThe file will NOT be deleted from disk.`
  );
  if (!ok) return;

  const list = projects[currentProject];
  projects[currentProject] = list.filter(
    (f) => f.file_path !== currentFilePath
  );
  saveProjects();

  currentFilePath = null;
  previewTitleEl.textContent = "";
  previewBodyEl.innerHTML = "";
  notesBoxEl.value = "";
  tagsContainerEl.innerHTML = "";

  renderFileList(false);
}

function renderFileList(globalMode = false) {
  fileListEl.innerHTML = "";
  currentFiles = [];

  const pf = projectSearchEl.value.toLowerCase().trim();
  const gf = globalSearchEl.value.toLowerCase().trim();

  if (globalMode && gf) {
    Object.entries(projects).forEach(([proj, files]) => {
      files.forEach((f) => {
        const base = path.basename(f.file_path);
        const tags = (f.tags || []).join(" ");
        const match = (base + " " + tags).toLowerCase();
        if (match.includes(gf)) {
          currentFiles.push({ project: proj, ...f });
        }
      });
    });
  } else if (currentProject) {
    projects[currentProject].forEach((f) => {
      const base = path.basename(f.file_path);
      const tags = (f.tags || []).join(" ");
      const match = (base + " " + tags).toLowerCase();
      if (!pf || match.includes(pf)) {
        currentFiles.push({ project: currentProject, ...f });
      }
    });
  }

  currentFiles.forEach((f) => {
    const base = path.basename(f.file_path);
    const li = document.createElement("li");
    li.textContent = base;

    li.onclick = () => {
      [...fileListEl.children].forEach((c) => c.classList.remove("selected"));
      li.classList.add("selected");
      loadFile(f);
    };

    li.ondblclick = () => {
      openExternally(f.file_path);
    };

    fileListEl.appendChild(li);
  });
}

// -------------------------------------------------------------
// FILE PREVIEW
// -------------------------------------------------------------
async function loadFile(f) {
  currentFilePath = f.file_path;
  previewTitleEl.textContent = currentFilePath;
  previewBodyEl.innerHTML = "";
  notesBoxEl.value = "";
  tagsContainerEl.innerHTML = "";
  currentFileHash = await ipcRenderer.invoke("annot:get-hash", currentFilePath);

  if (currentFileHash) {
    currentAnnotations = await ipcRenderer.invoke(
      "annot:load",
      currentFileHash
    );
  } else {
    currentAnnotations = {};
  }

  // Fill notes
  notesBoxEl.value = currentAnnotations.notes || "";

  // Fill tags
  const tags = f.tags || [];
  tags.forEach((t) => makeTagChip(t));

  const ext = currentFilePath.split(".").pop().toLowerCase();
  if (["txt", "md"].includes(ext)) return previewText();
  if (["html", "htm"].includes(ext)) return previewHTML();
  if (["png", "jpg", "jpeg", "gif"].includes(ext)) return previewImage();
  if (ext === "pdf") return previewPDF();
  if (ext === "docx") return previewDocx();

  previewBodyEl.textContent = "No preview for this file type.";
}

async function previewText() {
  const res = await ipcRenderer.invoke("file:read-text", currentFilePath);
  previewBodyEl.textContent = res.ok ? res.contents : "Error loading file.";
}

async function previewHTML() {
  const res = await ipcRenderer.invoke("file:read-text", currentFilePath);
  previewBodyEl.innerHTML = res.ok ? res.contents : "Error loading file.";
}

function previewImage() {
  previewBodyEl.innerHTML = `<img src="file://${currentFilePath}" style="max-width:100%;" />`;
}

function previewPDF() {
  previewBodyEl.innerHTML = `
    <iframe src="file://${currentFilePath}" style="width:100%;height:80vh;border:none;"></iframe>
  `;
}

async function previewDocx() {
  const res = await ipcRenderer.invoke("file:read-docx", currentFilePath);
  previewBodyEl.innerHTML = res.ok ? res.html : "Error loading DOCX.";
}

// -------------------------------------------------------------
// NOTES
// -------------------------------------------------------------
function saveNotes() {
  if (!currentFileHash) return;
  currentAnnotations.notes = notesBoxEl.value;
  ipcRenderer.invoke("annot:save", currentFileHash, currentAnnotations);
}

// -------------------------------------------------------------
// TAGS
// -------------------------------------------------------------
function makeTagChip(tag) {
  const d = document.createElement("div");
  d.className = "tag";
  d.innerHTML = `${tag} <span class="tag-x" data-t="${tag}">×</span>`;
  tagsContainerEl.appendChild(d);

  d.querySelector(".tag-x").onclick = () => removeTag(tag);
}

function addTag(t) {
  if (!currentProject || !currentFilePath) return;
  const fileObj = projects[currentProject].find(
    (f) => f.file_path === currentFilePath
  );
  if (!fileObj) return;
  if (!fileObj.tags.includes(t)) {
    fileObj.tags.push(t);
    saveProjects();
    makeTagChip(t);
  }
}

function removeTag(t) {
  if (!currentProject || !currentFilePath) return;
  const fileObj = projects[currentProject].find(
    (f) => f.file_path === currentFilePath
  );
  if (!fileObj) return;
  fileObj.tags = fileObj.tags.filter((x) => x !== t);
  saveProjects();
  renderFileList(false);
  loadFile(fileObj);
}

// -------------------------------------------------------------
// OPEN EXTERNALLY
// -------------------------------------------------------------
async function openExternally(filePath) {
  const res = await ipcRenderer.invoke("file:open-default", filePath);
  if (!res || !res.ok) {
    alert("Could not open file. It may have been moved or deleted.");
  }
}
