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

  // Utilities (Since we can't use 'path' module in renderer)
  path: {
    basename: (p) => path.basename(p),
  },
});
