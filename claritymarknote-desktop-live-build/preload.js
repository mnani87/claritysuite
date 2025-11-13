// preload.js

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,

  // File Operations (Renderer -> Main)
  openFile: () => ipcRenderer.invoke("dialog:openFile"),
  saveFile: (content, defaultName, filters, currentPath) =>
    ipcRenderer.invoke(
      "dialog:saveFile",
      content,
      defaultName,
      filters,
      currentPath
    ),

  // File System Access (Synchronous for now, matching your graph logic)
  // NOTE: For large folders, these should be made truly async and moved to a web worker.
  listFiles: (dirPath) => ipcRenderer.invoke("fs:listFiles", dirPath),
  readFile: (filePath) => ipcRenderer.invoke("fs:readFile", filePath),

  // PDF Export
  printToPDF: (options) => ipcRenderer.invoke("window:printToPDF", options),
});
