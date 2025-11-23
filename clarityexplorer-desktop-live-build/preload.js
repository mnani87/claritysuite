const { contextBridge, ipcRenderer } = require("electron");
const path = require("path");

contextBridge.exposeInMainWorld("api", {
  // Projects
  loadProjects: () => ipcRenderer.invoke("projects:load"),
  saveProjects: (projects) => ipcRenderer.invoke("projects:save", projects),

  // Files
  pickFiles: () => ipcRenderer.invoke("dialog:pick-files"),
  fileExists: (filePath) => ipcRenderer.invoke("file:exists", filePath),
  readText: (filePath) => ipcRenderer.invoke("file:read-text", filePath),
  readDocx: (filePath) => ipcRenderer.invoke("file:read-docx", filePath),
  openDefault: (filePath) => ipcRenderer.invoke("file:open-default", filePath),

  // Annotations
  getHash: (filePath) => ipcRenderer.invoke("annot:get-hash", filePath),
  loadAnnotations: (hash) => ipcRenderer.invoke("annot:load", hash),
  saveAnnotations: (hash, data) => ipcRenderer.invoke("annot:save", hash, data),
  migrateAnnotations: (oldPath, newPath) =>
    ipcRenderer.invoke("annot:migrate", oldPath, newPath),

  // Exports
  exportFileNotes: (filePath) =>
    ipcRenderer.invoke("export:file-notes", filePath),
  exportProjectNotes: (projectName) =>
    ipcRenderer.invoke("export:project-notes", projectName),

  // Search APIs
  searchProjectContent: (files, query) =>
    ipcRenderer.invoke("project:search-text", files, query),

  findStart: (text) => ipcRenderer.invoke("find:start", text),
  findStop: () => ipcRenderer.invoke("find:stop"),
  findNext: (text, forward) => ipcRenderer.invoke("find:next", text, forward),
  onFoundResult: (callback) =>
    ipcRenderer.on("found-in-page-result", (_event, result) =>
      callback(result)
    ),

  // --- NEW: Menu Command Listeners (Required for Shortcuts) ---
  onCmdNewProject: (callback) =>
    ipcRenderer.on("cmd:new-project", () => callback()),
  onCmdAddFiles: (callback) =>
    ipcRenderer.on("cmd:add-files", () => callback()),
  onCmdExportFile: (callback) =>
    ipcRenderer.on("cmd:export-file", () => callback()),
  onCmdExportProject: (callback) =>
    ipcRenderer.on("cmd:export-project", () => callback()),

  // Utilities
  path: {
    basename: (p) => path.basename(p),
  },
});
