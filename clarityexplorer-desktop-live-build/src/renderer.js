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
// Lists & Preview
const projectListEl = document.getElementById("project-list");
const fileListEl = document.getElementById("file-list");
const previewTitleEl = document.getElementById("preview-title");
const previewBodyEl = document.getElementById("preview-body");

// Notes & Tags
const notesBoxEl = document.getElementById("notes-box");
const tagsContainerEl = document.getElementById("tags-container");
const tagInputEl = document.getElementById("tag-input");

// Search
const projectSearchEl = document.getElementById("project-search");
const globalSearchEl = document.getElementById("global-search");

// Buttons (Toolbar)
const addProjectBtn = document.getElementById("add-project-btn");
const addFileBtn = document.getElementById("add-file-btn");
const removeFileBtn = document.getElementById("remove-file-btn");
const deleteProjectBtn = document.getElementById("delete-project-btn");
const openFileBtn = document.getElementById("open-file-btn");
const exportFileNotesBtn = document.getElementById("export-file-notes-btn");
const exportProjectNotesBtn = document.getElementById(
  "export-project-notes-btn"
);

// New Project Bar
const newProjectBar = document.getElementById("new-project-bar");
const newProjectInput = document.getElementById("new-project-input");
const newProjectCreate = document.getElementById("new-project-create");
const newProjectCancel = document.getElementById("new-project-cancel");

// Global UI
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const aboutBtn = document.getElementById("about-btn");
const aboutPanel = document.getElementById("about-panel");

// Project Meta Panel (Sidebar)
const projectMetaPanel = document.getElementById("project-meta-panel");
const projectMetaNameEl = document.getElementById("project-meta-name");
const projectDescriptionEl = document.getElementById("project-description");
const renameProjectBtn = document.getElementById("rename-project-btn");
const metaCreatedEl = document.getElementById("meta-created");
const metaUpdatedEl = document.getElementById("meta-updated");

// Rename Modal Elements
const renameModal = document.getElementById("rename-modal");
const renameInput = document.getElementById("rename-input");
const renameConfirmBtn = document.getElementById("rename-confirm-btn");
const renameCancelBtn = document.getElementById("rename-cancel-btn");

// -------------------------------------------------------------
// THEME
// -------------------------------------------------------------
function applyTheme(theme) {
  const t = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("clarityExplorerTheme", t);
}

// -------------------------------------------------------------
// INIT
// -------------------------------------------------------------
(async function init() {
  const savedTheme = localStorage.getItem("clarityExplorerTheme");
  applyTheme(savedTheme || "dark");

  // Load projects safely via Bridge
  try {
    projects = await window.api.loadProjects();
  } catch (e) {
    console.error("Failed to load projects:", e);
    projects = {};
  }

  if (!projects) projects = {};
  renderProjects();
})();

// Global Button Listeners
if (themeToggleBtn) {
  themeToggleBtn.onclick = () => {
    const current =
      document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  };
}

if (aboutBtn && aboutPanel) {
  aboutBtn.onclick = () => {
    aboutPanel.classList.toggle("hidden");
  };
}

// Search Listeners
projectSearchEl.oninput = () => renderFileList(false);
globalSearchEl.oninput = () => renderFileList(true);

// Toolbar Listeners
addProjectBtn.onclick = () => toggleNewProjectBar();
addFileBtn.onclick = () => onAddFiles();
removeFileBtn.onclick = () => onRemoveFile();
deleteProjectBtn.onclick = () => onDeleteProject();
renameProjectBtn.onclick = () => renameProject(); // Triggers Modal

openFileBtn.onclick = () => {
  if (!currentFilePath) {
    alert("Select a file to open.");
    return;
  }
  openExternally(currentFilePath);
};

exportFileNotesBtn.onclick = () => onExportFileNotes();
exportProjectNotesBtn.onclick = () => onExportProjectNotes();

// New Project Bar Listeners
newProjectCreate.onclick = () => createProject();
newProjectCancel.onclick = () => hideNewProjectBar();
newProjectInput.onkeydown = (e) => {
  if (e.key === "Enter") createProject();
  if (e.key === "Escape") hideNewProjectBar();
};

// Rename Modal Listeners (Safe Check)
if (renameModal && renameCancelBtn && renameConfirmBtn && renameInput) {
  renameCancelBtn.onclick = () => {
    renameModal.classList.add("hidden");
  };
  renameConfirmBtn.onclick = () => {
    confirmRename();
  };
  renameInput.onkeydown = (e) => {
    if (e.key === "Enter") confirmRename();
    if (e.key === "Escape") renameModal.classList.add("hidden");
  };
}

// Autosave & Input Listeners
notesBoxEl.onblur = saveNotes;
projectDescriptionEl.onblur = saveProjectMeta;

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
// KEYBOARD SHORTCUTS
// -------------------------------------------------------------
document.addEventListener("keydown", (e) => {
  const meta = e.metaKey || e.ctrlKey;
  if (!meta) return;

  if (meta && !e.shiftKey && e.key.toLowerCase() === "n") {
    e.preventDefault();
    toggleNewProjectBar();
  } else if (meta && !e.shiftKey && e.key.toLowerCase() === "o") {
    e.preventDefault();
    onAddFiles();
  } else if (meta && !e.shiftKey && e.key.toLowerCase() === "f") {
    e.preventDefault();
    projectSearchEl.focus();
    projectSearchEl.select();
  } else if (meta && e.shiftKey && e.key.toLowerCase() === "f") {
    e.preventDefault();
    globalSearchEl.focus();
    globalSearchEl.select();
  }
});

// -------------------------------------------------------------
// Project Meta & Renaming logic
// -------------------------------------------------------------
function loadProjectMeta() {
  if (!currentProject || !projects[currentProject]) {
    projectMetaPanel.classList.add("hidden");
    projectMetaNameEl.textContent = "";
    projectDescriptionEl.value = "";
    return;
  }

  const proj = projects[currentProject];
  const meta = proj.meta || {};

  projectMetaPanel.classList.remove("hidden");
  projectMetaNameEl.textContent = currentProject;
  projectDescriptionEl.value = meta.description || "";

  // Format Dates
  const created = meta.created_at
    ? new Date(meta.created_at).toLocaleDateString()
    : "-";
  const updated = meta.updated_at
    ? new Date(meta.updated_at).toLocaleDateString()
    : "-";

  if (metaCreatedEl) metaCreatedEl.textContent = `Created: ${created}`;
  if (metaUpdatedEl) metaUpdatedEl.textContent = `Updated: ${updated}`;
}

function saveProjectMeta() {
  if (!currentProject || !projects[currentProject]) return;
  const proj = projects[currentProject];
  if (!proj.meta) proj.meta = {};

  const now = new Date().toISOString();
  proj.meta.description = projectDescriptionEl.value || "";
  proj.meta.updated_at = now;

  if (!proj.meta.created_at) proj.meta.created_at = now;

  window.api.saveProjects(projects);
  loadProjectMeta(); // Refresh date display
}

// 1. Triggered by Pencil Icon
function renameProject() {
  if (!currentProject) return;
  renameInput.value = currentProject;
  renameModal.classList.remove("hidden");
  renameInput.focus();
  renameInput.select();
}

// 2. Triggered by Modal Button
async function confirmRename() {
  const newName = renameInput.value.trim();

  if (!newName || newName === currentProject) {
    renameModal.classList.add("hidden");
    return;
  }

  if (projects[newName]) {
    alert("A project with that name already exists.");
    return;
  }

  // Copy data to new key
  projects[newName] = projects[currentProject];

  // Update timestamp
  projects[newName].meta.updated_at = new Date().toISOString();

  // Delete old key
  delete projects[currentProject];

  // Save and switch
  await window.api.saveProjects(projects);
  currentProject = newName;

  // Cleanup UI
  renameModal.classList.add("hidden");
  renderProjects();
  loadProjectMeta();
  renderFileList(false);
}

// -------------------------------------------------------------
// Project CRUD
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
    const now = new Date().toISOString();
    projects[name] = {
      meta: {
        type: "general",
        description: "",
        created_at: now,
        updated_at: now,
      },
      files: [],
    };
    window.api.saveProjects(projects);
    currentProject = name;
    renderProjects();
    renderFileList(false);
    loadProjectMeta();
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
  window.api.saveProjects(projects);

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

  loadProjectMeta();
  renderProjects();
  renderFileList(false);
}

// -------------------------------------------------------------
// Export Notes
// -------------------------------------------------------------
async function onExportFileNotes() {
  if (!currentFilePath) {
    alert("Select a file first.");
    return;
  }
  const res = await window.api.exportFileNotes(currentFilePath);
  if (res && res.ok && res.savedPath) {
    alert("Notes exported to:\n" + res.savedPath);
  }
}

async function onExportProjectNotes() {
  if (!currentProject) {
    alert("Select a project first.");
    return;
  }
  const res = await window.api.exportProjectNotes(currentProject);
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
      loadProjectMeta();
    };
    projectListEl.appendChild(li);
  });

  loadProjectMeta();
}

// -------------------------------------------------------------
// FILES
// -------------------------------------------------------------
async function onAddFiles() {
  if (!currentProject) {
    alert("Select a project first.");
    return;
  }
  const paths = await window.api.pickFiles();
  if (!paths || paths.length === 0) return;

  const proj = projects[currentProject];
  const list = proj.files;
  paths.forEach((p) => {
    if (!list.some((f) => f.file_path === p)) {
      list.push({ file_path: p, tags: [] });
    }
  });

  proj.meta.updated_at = new Date().toISOString();
  window.api.saveProjects(projects);
  renderFileList(false);
}

function onRemoveFile() {
  if (!currentProject || !currentFilePath) {
    alert("Select a file to remove from this project.");
    return;
  }
  // Use exposed path helper
  const base = window.api.path.basename(currentFilePath);
  const ok = confirm(
    `Remove "${base}" from project "${currentProject}"?\n\nThe file will NOT be deleted from disk.`
  );
  if (!ok) return;

  const proj = projects[currentProject];
  proj.files = proj.files.filter((f) => f.file_path !== currentFilePath);
  proj.meta.updated_at = new Date().toISOString();
  window.api.saveProjects(projects);

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
    Object.entries(projects).forEach(([projName, proj]) => {
      const files = proj.files || [];
      files.forEach((f) => {
        const base = window.api.path.basename(f.file_path);
        const tags = (f.tags || []).join(" ");
        const match = (base + " " + tags).toLowerCase();
        if (match.includes(gf)) {
          currentFiles.push({
            project: projName,
            file_path: f.file_path,
            tags: f.tags || [],
          });
        }
      });
    });
  } else if (currentProject && projects[currentProject]) {
    const files = projects[currentProject].files || [];
    files.forEach((f) => {
      const base = window.api.path.basename(f.file_path);
      const tags = (f.tags || []).join(" ");
      const match = (base + " " + tags).toLowerCase();
      if (!pf || match.includes(pf)) {
        currentFiles.push({
          project: currentProject,
          file_path: f.file_path,
          tags: f.tags || [],
        });
      }
    });
  }

  currentFiles.forEach((f) => {
    const base = window.api.path.basename(f.file_path);
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
// FILE PREVIEW + MISSING FILE HANDLING
// -------------------------------------------------------------
async function loadFile(f) {
  const owningProject = f.project || currentProject;

  currentFilePath = f.file_path;
  previewTitleEl.textContent = currentFilePath;
  previewBodyEl.innerHTML = "";
  notesBoxEl.value = "";
  tagsContainerEl.innerHTML = "";
  currentFileHash = await window.api.getHash(currentFilePath);

  if (currentFileHash) {
    currentAnnotations = await window.api.loadAnnotations(currentFileHash);
  } else {
    currentAnnotations = {};
  }

  // Notes
  notesBoxEl.value = currentAnnotations.notes || "";

  // Tags
  let tags = f.tags || [];
  if (owningProject && projects[owningProject]) {
    const fileObj = (projects[owningProject].files || []).find(
      (x) => x.file_path === currentFilePath
    );
    if (fileObj && fileObj.tags) tags = fileObj.tags;
  }
  tags.forEach((t) => makeTagChip(t));

  // Check if file exists
  const exists = await window.api.fileExists(currentFilePath);
  if (!exists) {
    showMissingFileUI(owningProject, currentFilePath);
    return;
  }

  // Preview based on extension
  const ext = currentFilePath.split(".").pop().toLowerCase();
  if (["txt", "md"].includes(ext)) return previewText();
  if (["html", "htm"].includes(ext)) return previewHTML();
  if (["png", "jpg", "jpeg", "gif"].includes(ext)) return previewImage();
  if (ext === "pdf") return previewPDF();
  if (ext === "docx") return previewDocx();

  previewBodyEl.textContent = "No preview for this file type.";
}

function showMissingFileUI(projectName, filePath) {
  const base = window.api.path.basename(filePath);
  previewBodyEl.innerHTML = `
    <div class="missing-file">
      <p>
        The file <strong>${base}</strong> could not be found at:<br />
        <code>${filePath}</code>
      </p>
      <div class="missing-file-actions">
        <button id="locate-file-btn">Locate…</button>
        <button id="remove-file-inline-btn">Remove from project</button>
      </div>
    </div>
  `;

  const locateBtn = document.getElementById("locate-file-btn");
  const removeBtn = document.getElementById("remove-file-inline-btn");

  locateBtn.onclick = async () => {
    const paths = await window.api.pickFiles();
    if (!paths || paths.length === 0) return;
    const newPath = paths[0];

    // FIX: Migrate the old notes to the new file hash
    await window.api.migrateAnnotations(filePath, newPath);

    const proj = projects[projectName];
    if (!proj) return;
    const fileObj = (proj.files || []).find((f) => f.file_path === filePath);
    if (!fileObj) return;

    fileObj.file_path = newPath;
    proj.meta.updated_at = new Date().toISOString();
    window.api.saveProjects(projects);

    currentFilePath = newPath;
    renderFileList(false);
    loadFile({
      project: projectName,
      file_path: newPath,
      tags: fileObj.tags || [],
    });
  };

  removeBtn.onclick = () => {
    const proj = projects[projectName];
    if (!proj) return;
    proj.files = (proj.files || []).filter((f) => f.file_path !== filePath);
    proj.meta.updated_at = new Date().toISOString();
    window.api.saveProjects(projects);

    if (projectName === currentProject) {
      renderFileList(false);
    }

    previewTitleEl.textContent = "";
    previewBodyEl.innerHTML = "File removed from project.";
    notesBoxEl.value = "";
    tagsContainerEl.innerHTML = "";
  };
}

async function previewText() {
  const res = await window.api.readText(currentFilePath);
  previewBodyEl.textContent = res.ok ? res.contents : "Error loading file.";
}

async function previewHTML() {
  const res = await window.api.readText(currentFilePath);
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
  const res = await window.api.readDocx(currentFilePath);
  previewBodyEl.innerHTML = res.ok ? res.html : "Error loading DOCX.";
}

// -------------------------------------------------------------
// NOTES
// -------------------------------------------------------------
function saveNotes() {
  if (!currentFileHash) return;
  currentAnnotations.notes = notesBoxEl.value;
  window.api.saveAnnotations(currentFileHash, currentAnnotations);
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
  const proj = projects[currentProject];
  if (!proj) return;
  const fileObj = (proj.files || []).find(
    (f) => f.file_path === currentFilePath
  );
  if (!fileObj) return;
  if (!fileObj.tags.includes(t)) {
    fileObj.tags.push(t);
    proj.meta.updated_at = new Date().toISOString();
    window.api.saveProjects(projects);
    makeTagChip(t);
  }
}

function removeTag(t) {
  if (!currentProject || !currentFilePath) return;
  const proj = projects[currentProject];
  if (!proj) return;
  const fileObj = (proj.files || []).find(
    (f) => f.file_path === currentFilePath
  );
  if (!fileObj) return;
  fileObj.tags = fileObj.tags.filter((x) => x !== t);
  proj.meta.updated_at = new Date().toISOString();
  window.api.saveProjects(projects);
  renderFileList(false);
  loadFile({
    project: currentProject,
    file_path: fileObj.file_path,
    tags: fileObj.tags,
  });
}

// -------------------------------------------------------------
// OPEN EXTERNALLY
// -------------------------------------------------------------
async function openExternally(filePath) {
  const res = await window.api.openDefault(filePath);
  if (!res || !res.ok) {
    alert("Could not open file. It may have been moved or deleted.");
  }
}
