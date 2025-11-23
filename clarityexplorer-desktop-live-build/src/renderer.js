// -------------------------------------------------------------
// STATE
// -------------------------------------------------------------
let projects = {};
let currentProject = null;
let currentFilePath = null;
let currentFileHash = null;
let currentAnnotations = { notes: "", highlights: [] };

// Search State
let searchMatches = [];
let currentMatchIndex = -1;

// -------------------------------------------------------------
// ELEMENTS
// -------------------------------------------------------------
const projectListEl = document.getElementById("project-list");
const fileListEl = document.getElementById("file-list");
const previewTitleEl = document.getElementById("preview-title");
const previewBodyEl = document.getElementById("preview-body");

const toggleSearchBtn = document.getElementById("toggle-search-btn");
const previewSearchBar = document.getElementById("preview-search-bar");
const previewSearchInput = document.getElementById("preview-search-input");
const searchPrevBtn = document.getElementById("search-prev-btn");
const searchNextBtn = document.getElementById("search-next-btn");
const searchCloseBtn = document.getElementById("search-close-btn");
const searchCountEl = document.getElementById("search-count");

const notesBoxEl = document.getElementById("notes-box");
const tagsContainerEl = document.getElementById("tags-container");
const tagInputEl = document.getElementById("tag-input");

const projectSearchEl = document.getElementById("project-search");
const contentSearchCheckbox = document.getElementById(
  "content-search-checkbox"
);
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
const aboutBtn = document.getElementById("about-btn");
const aboutPanel = document.getElementById("about-panel");

const projectMetaPanel = document.getElementById("project-meta-panel");
const projectMetaNameEl = document.getElementById("project-meta-name");
const projectDescriptionEl = document.getElementById("project-description");
const renameProjectBtn = document.getElementById("rename-project-btn");
const metaCreatedEl = document.getElementById("meta-created");
const metaUpdatedEl = document.getElementById("meta-updated");

const renameModal = document.getElementById("rename-modal");
const renameInput = document.getElementById("rename-input");
const renameConfirmBtn = document.getElementById("rename-confirm-btn");
const renameCancelBtn = document.getElementById("rename-cancel-btn");

const sidebarResizer = document.getElementById("resizer-sidebar");
const panelResizer = document.getElementById("resizer-panel");
const notesResizer = document.getElementById("resizer-notes");
const sidebarEl = document.getElementById("sidebar");
const filesPanelEl = document.getElementById("files-panel");
const metaViewPaneEl = document.getElementById("meta-view-pane");

// -------------------------------------------------------------
// INIT & MENU LISTENERS
// -------------------------------------------------------------
(async function init() {
  const savedTheme = localStorage.getItem("clarityExplorerTheme") || "dark";
  applyTheme(savedTheme);
  try {
    projects = await window.api.loadProjects();
  } catch (e) {
    projects = {};
  }
  if (!projects) projects = {};
  renderProjects();
})();

// Listen for Menu Commands (triggered by Main Process shortcuts)
window.api.onCmdNewProject(() => toggleNewProjectBar());
window.api.onCmdAddFiles(() => onAddFiles());
window.api.onCmdExportFile(() => onExportFileNotes());
window.api.onCmdExportProject(() => onExportProjectNotes());

function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("clarityExplorerTheme", t);
}

if (themeToggleBtn)
  themeToggleBtn.onclick = () => {
    const current =
      document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  };

if (aboutBtn && aboutPanel)
  aboutBtn.onclick = () => aboutPanel.classList.toggle("hidden");

// -------------------------------------------------------------
// KEYBOARD SHORTCUTS (Context Specific)
// -------------------------------------------------------------
document.addEventListener("keydown", (e) => {
  const meta = e.metaKey || e.ctrlKey;

  // Cmd+F: Smart Search Focus
  if (meta && !e.shiftKey && e.key.toLowerCase() === "f") {
    const isPdf =
      currentFilePath && currentFilePath.toLowerCase().endsWith(".pdf");

    // Priority 1: If PDF, let native browser find work (do nothing)
    if (isPdf) return;

    // Priority 2: If File is open, focus Preview Search
    if (currentFilePath && !toggleSearchBtn.classList.contains("hidden")) {
      e.preventDefault();
      if (previewSearchBar.classList.contains("hidden"))
        toggleSearchBtn.click();
      previewSearchInput.focus();
      previewSearchInput.select();
      return;
    }

    // Priority 3: Focus Sidebar Search
    e.preventDefault();
    if (projectSearchEl) {
      projectSearchEl.focus();
      projectSearchEl.select();
    }
  }
  // Cmd+Shift+F: Global Search
  else if (meta && e.shiftKey && e.key.toLowerCase() === "f") {
    e.preventDefault();
    if (globalSearchEl) {
      globalSearchEl.focus();
      globalSearchEl.select();
    }
  }
  // Enter: Open File (if sidebar is focused or generic context)
  else if (e.key === "Enter" && !meta && !e.shiftKey) {
    const active = document.activeElement;
    // Only trigger if not typing in an input/textarea
    if (
      active === document.body ||
      active.tagName === "UL" ||
      active.tagName === "LI"
    ) {
      if (currentFilePath) {
        e.preventDefault();
        openExternally(currentFilePath);
      }
    }
  }
});

// -------------------------------------------------------------
// RESIZERS LOGIC (Constrained)
// -------------------------------------------------------------
if (sidebarResizer && sidebarEl)
  makeResizable(sidebarResizer, sidebarEl, "width", true, 200, 500);
if (panelResizer && filesPanelEl)
  makeResizable(panelResizer, filesPanelEl, "width", true, 200, 600);
if (notesResizer && metaViewPaneEl)
  makeResizable(notesResizer, metaViewPaneEl, "height", false, 100, 600);

function makeResizable(resizer, target, dimension, isForward, min, max) {
  resizer.addEventListener("mousedown", (e) => {
    e.preventDefault();
    document.body.classList.add(
      dimension === "width" ? "resizing" : "resizing-v"
    );
    resizer.classList.add("active");

    const startSize = parseInt(getComputedStyle(target)[dimension], 10);
    const startCoord = dimension === "width" ? e.clientX : e.clientY;

    const doDrag = (ev) => {
      const currentCoord = dimension === "width" ? ev.clientX : ev.clientY;
      const delta = currentCoord - startCoord;
      let newSize = isForward ? startSize + delta : startSize - delta;
      newSize = Math.max(min, Math.min(max, newSize));
      target.style[dimension] = `${newSize}px`;
    };

    const stopDrag = () => {
      document.body.classList.remove("resizing");
      document.body.classList.remove("resizing-v");
      resizer.classList.remove("active");
      document.removeEventListener("mousemove", doDrag);
      document.removeEventListener("mouseup", stopDrag);
    };

    document.addEventListener("mousemove", doDrag);
    document.addEventListener("mouseup", stopDrag);
  });
}

// -------------------------------------------------------------
// SIDEBAR SEARCH
// -------------------------------------------------------------
if (projectSearchEl) {
  projectSearchEl.oninput = () => {
    if (contentSearchCheckbox && contentSearchCheckbox.checked) return;
    renderFileList(false);
  };
  projectSearchEl.onkeydown = async (e) => {
    if (
      e.key === "Enter" &&
      contentSearchCheckbox &&
      contentSearchCheckbox.checked
    ) {
      await performContentSearch();
    }
  };
}

if (contentSearchCheckbox) {
  contentSearchCheckbox.onchange = () => {
    if (contentSearchCheckbox.checked) {
      projectSearchEl.placeholder = "Search content (Press Enter)...";
    } else {
      projectSearchEl.placeholder = "Search filenames...";
      renderFileList(false);
    }
  };
}

if (globalSearchEl) globalSearchEl.oninput = () => renderFileList(true);

async function performContentSearch() {
  const query = projectSearchEl.value.trim();
  if (!currentProject || !query) return;

  fileListEl.innerHTML = `<li style="pointer-events:none; color:var(--ink-dim); padding:1rem;">Searching content...</li>`;

  const proj = projects[currentProject];
  const filesToCheck = proj.files.map((f) => f.file_path);

  const results = await window.api.searchProjectContent(filesToCheck, query);

  fileListEl.innerHTML = "";
  if (results.length === 0) {
    fileListEl.innerHTML = `<li style="pointer-events:none; color:var(--ink-dim); padding:1rem;">No matches found in content.</li>`;
    return;
  }

  results.forEach((match) => {
    const base = window.api.path.basename(match.file_path);
    const li = document.createElement("li");
    li.className = "search-result-item";
    li.innerHTML = `<div style="font-weight:bold">${base}</div><div class="search-snippet">${match.snippet}</div>`;

    li.onclick = () => {
      [...fileListEl.children].forEach((c) => c.classList.remove("selected"));
      li.classList.add("selected");
      loadFile({
        project: currentProject,
        file_path: match.file_path,
        tags: [],
      });

      // Auto-trigger preview search for the same term
      setTimeout(() => {
        if (toggleSearchBtn && !toggleSearchBtn.classList.contains("hidden")) {
          if (previewSearchBar && previewSearchBar.classList.contains("hidden"))
            toggleSearchBtn.click();
          if (previewSearchInput) {
            previewSearchInput.value = query;
            performSearch(query);
          }
        }
      }, 300);
    };
    fileListEl.appendChild(li);
  });
}

// -------------------------------------------------------------
// CRUD & TOOLBAR
// -------------------------------------------------------------
if (addProjectBtn) addProjectBtn.onclick = () => toggleNewProjectBar();
if (addFileBtn) addFileBtn.onclick = () => onAddFiles();
if (removeFileBtn) removeFileBtn.onclick = () => onRemoveFile();
if (deleteProjectBtn) deleteProjectBtn.onclick = () => onDeleteProject();
if (renameProjectBtn) renameProjectBtn.onclick = () => renameProject();
if (openFileBtn)
  openFileBtn.onclick = () => {
    if (currentFilePath) openExternally(currentFilePath);
    else alert("Select a file to open.");
  };
if (exportFileNotesBtn) exportFileNotesBtn.onclick = () => onExportFileNotes();
if (exportProjectNotesBtn)
  exportProjectNotesBtn.onclick = () => onExportProjectNotes();

if (newProjectCreate) newProjectCreate.onclick = () => createProject();
if (newProjectCancel) newProjectCancel.onclick = () => hideNewProjectBar();
if (newProjectInput)
  newProjectInput.onkeydown = (e) => {
    if (e.key === "Enter") createProject();
    if (e.key === "Escape") hideNewProjectBar();
  };

if (renameModal && renameCancelBtn) {
  renameCancelBtn.onclick = () => renameModal.classList.add("hidden");
  renameConfirmBtn.onclick = () => confirmRename();
  renameInput.onkeydown = (e) => {
    if (e.key === "Enter") confirmRename();
    if (e.key === "Escape") renameModal.classList.add("hidden");
  };
}

if (notesBoxEl) notesBoxEl.onblur = saveNotes;
if (projectDescriptionEl) projectDescriptionEl.onblur = saveProjectMeta;
if (tagInputEl)
  tagInputEl.onkeydown = (e) => {
    if (e.key === "Enter" && tagInputEl.value.trim()) {
      addTag(tagInputEl.value.trim());
      tagInputEl.value = "";
    }
  };

// -------------------------------------------------------------
// RENDERERS
// -------------------------------------------------------------
function renderProjects() {
  if (!projectListEl) return;
  projectListEl.innerHTML = "";
  Object.keys(projects).forEach((name) => {
    const li = document.createElement("li");
    li.textContent = name;
    if (name === currentProject) li.classList.add("active");
    li.onclick = () => {
      currentProject = name;
      if (projectSearchEl) {
        projectSearchEl.value = "";
        projectSearchEl.placeholder = "Search filenames...";
      }
      if (contentSearchCheckbox) contentSearchCheckbox.checked = false;
      renderProjects();
      renderFileList(false);
      loadProjectMeta();
    };
    projectListEl.appendChild(li);
  });
  loadProjectMeta();
}

function renderFileList(globalMode = false) {
  if (!fileListEl) return;
  fileListEl.innerHTML = "";
  currentFiles = [];
  const pf = projectSearchEl ? projectSearchEl.value.toLowerCase().trim() : "";
  const gf = globalSearchEl ? globalSearchEl.value.toLowerCase().trim() : "";

  let source = [];
  if (globalMode && gf) {
    Object.entries(projects).forEach(([pName, pObj]) => {
      (pObj.files || []).forEach((f) => source.push({ ...f, project: pName }));
    });
  } else if (currentProject && projects[currentProject]) {
    source = projects[currentProject].files || [];
  }

  source.forEach((f) => {
    const base = window.api.path.basename(f.file_path);
    const tags = (f.tags || []).join(" ");
    const matchStr = (base + " " + tags).toLowerCase();
    const query = globalMode ? gf : pf;
    if (!query || matchStr.includes(query)) {
      const item = { ...f, project: f.project || currentProject };
      currentFiles.push(item);
      const li = document.createElement("li");
      li.textContent = base;
      li.onclick = () => {
        [...fileListEl.children].forEach((c) => c.classList.remove("selected"));
        li.classList.add("selected");
        loadFile(item);
      };
      li.ondblclick = () => openExternally(item.file_path);
      fileListEl.appendChild(li);
    }
  });
}

async function loadFile(f) {
  const owningProject = f.project || currentProject;
  currentFilePath = f.file_path;
  previewTitleEl.textContent = currentFilePath;
  previewBodyEl.innerHTML = "";
  notesBoxEl.value = "";
  tagsContainerEl.innerHTML = "";

  closePreviewSearch();

  currentFileHash = await window.api.getHash(currentFilePath);
  if (currentFileHash) {
    currentAnnotations = await window.api.loadAnnotations(currentFileHash);
  } else {
    currentAnnotations = {};
  }
  notesBoxEl.value = currentAnnotations.notes || "";

  let tags = f.tags || [];
  if (owningProject && projects[owningProject]) {
    const fileObj = projects[owningProject].files.find(
      (x) => x.file_path === currentFilePath
    );
    if (fileObj && fileObj.tags) tags = fileObj.tags;
  }
  tags.forEach((t) => makeTagChip(t));

  const exists = await window.api.fileExists(currentFilePath);
  if (!exists) {
    showMissingFileUI(owningProject, currentFilePath);
    return;
  }

  const ext = currentFilePath.split(".").pop().toLowerCase();
  if (toggleSearchBtn) {
    if (["txt", "md", "html", "htm", "docx", "pdf"].includes(ext)) {
      toggleSearchBtn.classList.remove("hidden");
    } else {
      toggleSearchBtn.classList.add("hidden");
    }
  }

  // Reset styles
  previewBodyEl.className = "";

  if (["txt", "md"].includes(ext)) return previewText();
  if (["html", "htm"].includes(ext)) return previewHTML();
  if (["png", "jpg", "jpeg", "gif"].includes(ext)) return previewImage();
  if (ext === "pdf") return previewPDF();
  if (ext === "docx") return previewDocx();

  previewBodyEl.textContent = "No preview for this file type.";
}

// -------------------------------------------------------------
// PREVIEW SEARCH LOGIC (Safe & Fixed Regex)
// -------------------------------------------------------------
window.api.onFoundResult((result) => {
  if (currentFilePath && currentFilePath.toLowerCase().endsWith(".pdf")) {
    if (searchCountEl)
      searchCountEl.textContent = `${result.activeMatchOrdinal}/${result.matches}`;
  }
});

if (toggleSearchBtn && previewSearchBar && previewSearchInput) {
  toggleSearchBtn.onclick = () => {
    if (previewSearchBar.classList.contains("hidden")) {
      previewSearchBar.classList.remove("hidden");
      previewSearchInput.focus();
      if (previewSearchInput.value) performSearch(previewSearchInput.value);
    } else {
      closePreviewSearch();
    }
  };

  if (searchCloseBtn) searchCloseBtn.onclick = closePreviewSearch;

  previewSearchInput.oninput = (e) => performSearch(e.target.value);
  previewSearchInput.onkeydown = (e) => {
    if (e.key === "Enter") {
      if (e.shiftKey) navigateSearch(-1);
      else navigateSearch(1);
    }
    if (e.key === "Escape") closePreviewSearch();
  };

  if (searchNextBtn) searchNextBtn.onclick = () => navigateSearch(1);
  if (searchPrevBtn) searchPrevBtn.onclick = () => navigateSearch(-1);
}

function closePreviewSearch() {
  if (previewSearchBar) previewSearchBar.classList.add("hidden");
  if (previewSearchInput) previewSearchInput.value = "";
  if (searchCountEl) searchCountEl.textContent = "0/0";
  clearHighlights();
  window.api.findStop();
}

function performSearch(term) {
  const isPdf =
    currentFilePath && currentFilePath.toLowerCase().endsWith(".pdf");
  if (!term || term.length < 2) {
    if (searchCountEl) searchCountEl.textContent = "0/0";
    if (isPdf) window.api.findStop();
    else clearHighlights();
    return;
  }
  if (isPdf) window.api.findStart(term);
  else performDomSearch(term);
}

function navigateSearch(direction) {
  const isPdf =
    currentFilePath && currentFilePath.toLowerCase().endsWith(".pdf");
  const term = previewSearchInput.value;
  if (isPdf) {
    window.api.findNext(term, direction === 1);
  } else {
    if (searchMatches.length === 0) return;
    currentMatchIndex += direction;
    if (currentMatchIndex >= searchMatches.length) currentMatchIndex = 0;
    if (currentMatchIndex < 0) currentMatchIndex = searchMatches.length - 1;
    if (searchCountEl)
      searchCountEl.textContent = `${currentMatchIndex + 1}/${
        searchMatches.length
      }`;
    highlightActiveMatch();
  }
}

function clearHighlights() {
  const highlights = previewBodyEl.querySelectorAll(".search-highlight");
  highlights.forEach((span) => {
    const parent = span.parentNode;
    parent.replaceChild(document.createTextNode(span.textContent), span);
    parent.normalize();
  });
  searchMatches = [];
  currentMatchIndex = -1;
}

function performDomSearch(term) {
  clearHighlights();
  const walker = document.createTreeWalker(
    previewBodyEl,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) textNodes.push(node);

  const regex = new RegExp(`(${escapeRegExp(term)})`, "gi");

  textNodes.forEach((textNode) => {
    const text = textNode.nodeValue;
    regex.lastIndex = 0; // FIX: Reset regex state for each node

    if (regex.test(text)) {
      regex.lastIndex = 0; // Reset again before replace
      const fragment = document.createDocumentFragment();
      let lastIdx = 0;
      text.replace(regex, (match, p1, offset) => {
        fragment.appendChild(
          document.createTextNode(text.slice(lastIdx, offset))
        );
        const span = document.createElement("span");
        span.className = "search-highlight";
        span.textContent = match;
        fragment.appendChild(span);
        lastIdx = offset + match.length;
      });
      fragment.appendChild(document.createTextNode(text.slice(lastIdx)));
      textNode.parentNode.replaceChild(fragment, textNode);
    }
  });

  searchMatches = Array.from(
    previewBodyEl.querySelectorAll(".search-highlight")
  );
  if (searchCountEl)
    searchCountEl.textContent = `${searchMatches.length > 0 ? 1 : 0}/${
      searchMatches.length
    }`;
  if (searchMatches.length > 0) {
    currentMatchIndex = 0;
    highlightActiveMatch();
  }
}

function highlightActiveMatch() {
  searchMatches.forEach((m) => m.classList.remove("active"));
  const active = searchMatches[currentMatchIndex];
  if (active) {
    active.classList.add("active");
    active.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// -------------------------------------------------------------
// UTILS
// -------------------------------------------------------------
function showMissingFileUI(projectName, filePath) {
  const base = window.api.path.basename(filePath);
  previewBodyEl.innerHTML = `<div class="missing-file"><p>Missing: <code>${filePath}</code></p><div class="missing-file-actions"><button id="locate-file-btn">Locate…</button><button id="remove-file-inline-btn">Remove</button></div></div>`;

  document.getElementById("locate-file-btn").onclick = async () => {
    const paths = await window.api.pickFiles();
    if (!paths || !paths.length) return;
    await window.api.migrateAnnotations(filePath, paths[0]);
    const proj = projects[projectName];
    if (proj) {
      const f = proj.files.find((x) => x.file_path === filePath);
      if (f) {
        f.file_path = paths[0];
        window.api.saveProjects(projects);
      }
    }
    renderFileList(false);
    loadFile({ project: projectName, file_path: paths[0], tags: [] });
  };

  document.getElementById("remove-file-inline-btn").onclick = () => {
    const proj = projects[projectName];
    if (proj) {
      proj.files = proj.files.filter((f) => f.file_path !== filePath);
      window.api.saveProjects(projects);
    }
    renderFileList(false);
    previewBodyEl.innerHTML = "";
  };
}

async function previewText() {
  const res = await window.api.readText(currentFilePath);
  previewBodyEl.textContent = res.ok ? res.contents : "Error";
}
async function previewHTML() {
  const res = await window.api.readText(currentFilePath);
  previewBodyEl.innerHTML = res.ok ? res.contents : "Error";
}
function previewImage() {
  previewBodyEl.innerHTML = `<img src="file://${currentFilePath}" style="max-width:100%;" />`;
}
function previewPDF() {
  previewBodyEl.innerHTML = `<iframe src="file://${currentFilePath}" style="width:100%;height:100%;border:none;"></iframe>`;
}
async function previewDocx() {
  const res = await window.api.readDocx(currentFilePath);
  previewBodyEl.classList.add("mammoth-doc");
  previewBodyEl.innerHTML = res.ok ? res.html : "Error";
}

function loadProjectMeta() {
  if (!currentProject || !projects[currentProject]) {
    projectMetaPanel.classList.add("hidden");
    return;
  }
  projectMetaPanel.classList.remove("hidden");
  const p = projects[currentProject];
  projectMetaNameEl.textContent = currentProject;
  projectDescriptionEl.value = p.meta.description || "";
  if (metaCreatedEl)
    metaCreatedEl.textContent = `Created: ${
      p.meta.created_at ? new Date(p.meta.created_at).toLocaleDateString() : "-"
    }`;
  if (metaUpdatedEl)
    metaUpdatedEl.textContent = `Updated: ${
      p.meta.updated_at ? new Date(p.meta.updated_at).toLocaleDateString() : "-"
    }`;
}
function saveProjectMeta() {
  if (!currentProject) return;
  projects[currentProject].meta.description = projectDescriptionEl.value;
  projects[currentProject].meta.updated_at = new Date().toISOString();
  window.api.saveProjects(projects);
}
function renameProject() {
  if (!currentProject) return;
  renameInput.value = currentProject;
  renameModal.classList.remove("hidden");
  renameInput.select();
}
async function confirmRename() {
  const val = renameInput.value.trim();
  if (!val || val === currentProject || projects[val]) {
    renameModal.classList.add("hidden");
    return;
  }
  projects[val] = projects[currentProject];
  delete projects[currentProject];
  await window.api.saveProjects(projects);
  currentProject = val;
  renameModal.classList.add("hidden");
  renderProjects();
}
function toggleNewProjectBar() {
  newProjectBar.classList.toggle("hidden");
  if (!newProjectBar.classList.contains("hidden")) newProjectInput.focus();
}
function hideNewProjectBar() {
  newProjectBar.classList.add("hidden");
}
function createProject() {
  const name = newProjectInput.value.trim();
  if (!name) return hideNewProjectBar();
  if (!projects[name]) {
    projects[name] = {
      meta: { created_at: new Date().toISOString() },
      files: [],
    };
    window.api.saveProjects(projects);
    currentProject = name;
    renderProjects();
  }
  hideNewProjectBar();
}
function onDeleteProject() {
  if (!currentProject) return;
  if (confirm(`Delete project "${currentProject}"?`)) {
    delete projects[currentProject];
    window.api.saveProjects(projects);
    currentProject = null;
    renderProjects();
    renderFileList(false);
  }
}
function saveNotes() {
  if (!currentFileHash) return;
  currentAnnotations.notes = notesBoxEl.value;
  window.api.saveAnnotations(currentFileHash, currentAnnotations);
}
function makeTagChip(t) {
  const d = document.createElement("div");
  d.className = "tag";
  d.innerHTML = `${t} <span class="tag-x">×</span>`;
  tagsContainerEl.appendChild(d);
  d.querySelector(".tag-x").onclick = () => removeTag(t);
}
function addTag(t) {
  if (!currentProject || !currentFilePath) return;
  const f = projects[currentProject].files.find(
    (x) => x.file_path === currentFilePath
  );
  if (f && !f.tags.includes(t)) {
    f.tags.push(t);
    window.api.saveProjects(projects);
    makeTagChip(t);
  }
}
function removeTag(t) {
  if (!currentProject || !currentFilePath) return;
  const f = projects[currentProject].files.find(
    (x) => x.file_path === currentFilePath
  );
  if (f) {
    f.tags = f.tags.filter((x) => x !== t);
    window.api.saveProjects(projects);
    renderFileList(false);
    loadFile({
      project: currentProject,
      file_path: currentFilePath,
      tags: f.tags,
    });
  }
}
async function onAddFiles() {
  if (!currentProject) return;
  const paths = await window.api.pickFiles();
  if (!paths.length) return;
  const p = projects[currentProject];
  paths.forEach((path) => {
    if (!p.files.some((x) => x.file_path === path))
      p.files.push({ file_path: path, tags: [] });
  });
  window.api.saveProjects(projects);
  renderFileList(false);
}
function onRemoveFile() {
  if (!currentProject || !currentFilePath) return;
  const p = projects[currentProject];
  p.files = p.files.filter((x) => x.file_path !== currentFilePath);
  window.api.saveProjects(projects);
  currentFilePath = null;
  renderFileList(false);
  previewBodyEl.innerHTML = "";
}
async function openExternally(p) {
  window.api.openDefault(p);
}
async function onExportFileNotes() {
  if (currentFilePath) window.api.exportFileNotes(currentFilePath);
}
async function onExportProjectNotes() {
  if (currentProject) window.api.exportProjectNotes(currentProject);
}
